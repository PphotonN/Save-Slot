package com.saveslot.app.render

import android.graphics.Bitmap
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLSurface
import android.opengl.GLES20
import androidx.collection.LruCache
import com.saveslot.app.core.log.ImageLog
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * Renders a cartridge holding a given cover into a bitmap, off-screen.
 *
 * The discovery and search screens can show dozens of cartridges at once. Giving each card its own
 * `GLSurfaceView` would mean dozens of EGL contexts and surfaces — expensive to create and a real
 * battery cost while scrolling. Instead one hidden pbuffer context renders each cover once, and the
 * resulting bitmap is cached and drawn as an ordinary image. Cards then cost no more than a photo,
 * while still showing the actual 3D cartridge.
 *
 * All GL work is serialised through [mutex] and confined to [glDispatcher], because a single EGL
 * context cannot be current on two threads at once.
 */
class CartridgePreviewFactory(private val modelLoader: CartridgeModelLoader) {

    private val mutex = Mutex()

    /**
     * The one thread every GL call runs on.
     *
     * `eglMakeCurrent` binds the context to the calling thread and is called once, when the context
     * is created. `Dispatchers.Default` hands out whichever worker is free per dispatch, so renders
     * that landed on a different worker than the one that initialised drew into *no* current context:
     * the draw calls were dropped, `glReadPixels` returned zeroes, and the card showed a fully
     * transparent cartridge while still reporting a successful render. Confining the context and
     * every draw to a single thread is what makes the context valid for all of them.
     */
    private val glDispatcher = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "cartridge-gl")
    }.asCoroutineDispatcher()

    private val cache = object : LruCache<String, Bitmap>(CACHE_ENTRIES) {
        override fun entryRemoved(evicted: Boolean, key: String, oldValue: Bitmap, newValue: Bitmap?) {
            // An eviction here means the next card asking for this cover pays for a full re-render,
            // which is the usual reason a cartridge blinks back to flat artwork while scrolling.
            ImageLog.d(TAG) {
                val reason = if (evicted) "evict" else "replace"
                "$reason     ${ImageLog.key(key)} ${cacheStats()}"
            }
        }
    }

    private var display: EGLDisplay? = null
    private var context: EGLContext? = null
    private var surface: EGLSurface? = null
    private var program: CartridgeProgram? = null
    private var groups: List<GpuGroup> = emptyList()
    private var cartridgeCenter = floatArrayOf(0f, 0f, 0f)
    private var initFailed = false

    /**
     * Returns the cartridge preview for [cover], rendering it if necessary.
     *
     * @param key stable cache key — normally the cover URL, so the same artwork is only rendered once.
     * @return the preview, or null when GL is unavailable, in which case callers fall back to
     *   drawing the cover art flat.
     */
    suspend fun preview(key: String, cover: Bitmap?): Bitmap? {
        cache[key]?.let { return it }
        return withContext(glDispatcher) {
            mutex.withLock {
                // A second caller may have rendered this cover while this one waited for the lock.
                cache[key]?.let {
                    ImageLog.d(TAG) { "lock hit  ${ImageLog.key(key)} ${cacheStats()}" }
                    return@withLock it
                }
                if (initFailed) return@withLock null
                if (!ensureContext()) {
                    ImageLog.w(TAG) { "GL unavailable; cartridges disabled for this session" }
                    initFailed = true
                    return@withLock null
                }
                val rendered = runCatching { render(cover) }
                    .onFailure { error -> ImageLog.w(TAG, error) { "render threw ${ImageLog.key(key)}" } }
                    .getOrNull()
                if (rendered != null) {
                    cache.put(key, rendered)
                    ImageLog.d(TAG) { "put       ${ImageLog.key(key)} ${cacheStats()}" }
                }
                rendered
            }
        }
    }

    fun cached(key: String): Bitmap? = cache[key]

    /** Occupancy and hit rate of the rendered-cartridge cache, for the artwork trace. */
    fun cacheStats(): String =
        "lru=${cache.size()}/${cache.maxSize()} hits=${cache.hitCount()} " +
            "misses=${cache.missCount()} evicted=${cache.evictionCount()}"

    private suspend fun ensureContext(): Boolean {
        if (context != null) return true

        val eglDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        if (eglDisplay == EGL14.EGL_NO_DISPLAY) return failInit("eglGetDisplay")
        val version = IntArray(2)
        if (!EGL14.eglInitialize(eglDisplay, version, 0, version, 1)) return failInit("eglInitialize")

        val configAttributes = intArrayOf(
            EGL14.EGL_RED_SIZE, 8,
            EGL14.EGL_GREEN_SIZE, 8,
            EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_ALPHA_SIZE, 8,
            EGL14.EGL_DEPTH_SIZE, 16,
            EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            // A pbuffer, not a window surface: there is nothing on screen to attach to.
            EGL14.EGL_SURFACE_TYPE, EGL14.EGL_PBUFFER_BIT,
            EGL14.EGL_NONE,
        )
        val configs = arrayOfNulls<EGLConfig>(1)
        val configCount = IntArray(1)
        if (!EGL14.eglChooseConfig(eglDisplay, configAttributes, 0, configs, 0, 1, configCount, 0) ||
            configCount[0] == 0
        ) {
            return failInit("eglChooseConfig")
        }
        val config = configs[0] ?: return failInit("eglChooseConfig returned no config")

        val eglContext = EGL14.eglCreateContext(
            eglDisplay,
            config,
            EGL14.EGL_NO_CONTEXT,
            intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE),
            0,
        )
        if (eglContext == EGL14.EGL_NO_CONTEXT) return failInit("eglCreateContext")

        val eglSurface = EGL14.eglCreatePbufferSurface(
            eglDisplay,
            config,
            intArrayOf(EGL14.EGL_WIDTH, WIDTH, EGL14.EGL_HEIGHT, HEIGHT, EGL14.EGL_NONE),
            0,
        )
        if (eglSurface == EGL14.EGL_NO_SURFACE) {
            EGL14.eglDestroyContext(eglDisplay, eglContext)
            return failInit("eglCreatePbufferSurface")
        }
        if (!EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)) {
            EGL14.eglDestroySurface(eglDisplay, eglSurface)
            EGL14.eglDestroyContext(eglDisplay, eglContext)
            return failInit("eglMakeCurrent")
        }

        display = eglDisplay
        context = eglContext
        surface = eglSurface

        val model = modelLoader.load()
        cartridgeCenter = model.centerOf(CartridgeModel.ROLE_CARTRIDGE)
        program = CartridgeProgram().apply { compile() }
        groups = uploadModel(model, CartridgeModel.ROLE_CARTRIDGE)

        GLES20.glEnable(GLES20.GL_DEPTH_TEST)
        GLES20.glDepthFunc(GLES20.GL_LEQUAL)
        GLES20.glDisable(GLES20.GL_CULL_FACE)
        GLES20.glClearColor(0f, 0f, 0f, 0f)
        if (groups.isEmpty()) return failInit("model carried no '${CartridgeModel.ROLE_CARTRIDGE}' geometry")
        ImageLog.d(TAG) {
            "GL ready  ${groups.size} groups, ${WIDTH}x$HEIGHT pbuffer, " +
                "context bound to ${Thread.currentThread().name}"
        }
        return true
    }

    private fun failInit(step: String): Boolean {
        ImageLog.w(TAG) { "GL init failed at $step (egl error 0x${EGL14.eglGetError().toString(16)})" }
        return false
    }

    private fun render(cover: Bitmap?): Bitmap? {
        val activeProgram = program ?: return null
        val textureId = cover?.let { uploadTexture(it) } ?: 0

        try {
            GLES20.glViewport(0, 0, WIDTH, HEIGHT)
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
            activeProgram.use()

            val camera = floatArrayOf(0f, 66f, 305f)
            val projection = Mat4.perspective(
                fovYRadians = (27.0 * Math.PI / 180.0).toFloat(),
                aspect = WIDTH.toFloat() / HEIGHT.toFloat(),
                near = 1f,
                far = 900f,
            )
            val view = Mat4.lookAt(camera, floatArrayOf(0f, 60f, 0f), floatArrayOf(0f, 1f, 0f))
            activeProgram.setCamera(Mat4.multiply(projection, view), camera)

            // A slight three-quarter tilt so the cartridge reads as a solid object in a still image.
            val modelMatrix = Mat4.centeredTransform(
                center = cartridgeCenter,
                translateY = -1.5f,
                rotationX = 0.045f,
                rotationY = -0.08f,
                scale = 0.965f,
            )
            val texture = textureId.takeIf { it != 0 }
            for (group in groups) activeProgram.draw(group, modelMatrix, texture)

            // A dropped draw still read back a correctly sized, entirely transparent bitmap, so the
            // trace reported success for a blank cartridge. Ask GL whether it accepted the work.
            val error = GLES20.glGetError()
            if (error != GLES20.GL_NO_ERROR) {
                ImageLog.w(TAG) {
                    "GL error 0x${error.toString(16)} while drawing on " +
                        Thread.currentThread().name
                }
            }
            return readPixels()
        } finally {
            releaseTexture(textureId)
        }
    }

    private fun readPixels(): Bitmap {
        val buffer = ByteBuffer.allocateDirect(WIDTH * HEIGHT * 4).order(ByteOrder.nativeOrder())
        GLES20.glReadPixels(0, 0, WIDTH, HEIGHT, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, buffer)
        buffer.rewind()
        val bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
        bitmap.copyPixelsFromBuffer(buffer)
        // GL's origin is bottom-left, Android's is top-left, so the read-back arrives inverted.
        return flipVertically(bitmap)
    }

    private fun flipVertically(source: Bitmap): Bitmap {
        val matrix = android.graphics.Matrix().apply { preScale(1f, -1f) }
        val flipped = Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, false)
        if (flipped !== source) source.recycle()
        return flipped
    }

    /** Tears down the hidden context; called when the app no longer needs previews. */
    suspend fun release() {
        // Teardown is GL work too, so it belongs on the thread the context is bound to.
        withContext(glDispatcher) {
            mutex.withLock {
                releaseGroups(groups)
                groups = emptyList()
                program?.release()
                program = null
                val eglDisplay = display
                if (eglDisplay != null) {
                    EGL14.eglMakeCurrent(
                        eglDisplay,
                        EGL14.EGL_NO_SURFACE,
                        EGL14.EGL_NO_SURFACE,
                        EGL14.EGL_NO_CONTEXT,
                    )
                    surface?.let { EGL14.eglDestroySurface(eglDisplay, it) }
                    context?.let { EGL14.eglDestroyContext(eglDisplay, it) }
                    EGL14.eglTerminate(eglDisplay)
                }
                display = null
                surface = null
                context = null
                cache.evictAll()
                ImageLog.d(TAG) { "GL released" }
            }
        }
        glDispatcher.close()
    }

    private companion object {
        const val TAG = ImageLog.TAG_PREVIEW

        /** Matches the card aspect ratio (roughly 0.77) at a size that stays sharp on a phone. */
        const val WIDTH = 300
        const val HEIGHT = 392

        /** Enough for a couple of screens of cards; bitmaps are ~470 KB each. */
        const val CACHE_ENTRIES = 24
    }
}
