package com.saveslot.app.render

import android.graphics.Bitmap
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.abs
import kotlin.math.sin

/** Where the cartridge is, relative to being fully seated in the slot. */
internal data class CartridgePose(
    val y: Float = 0f,
    val z: Float = 0f,
    val rotationX: Float = 0f,
    val rotationY: Float = 0f,
    val scale: Float = 1f,
)

/** What the slot is currently doing, driven from the UI layer. */
sealed interface SlotCommand {
    data class Insert(val cover: Bitmap?, val reducedMotion: Boolean) : SlotCommand
    data class Eject(val reducedMotion: Boolean) : SlotCommand
    data class SetCover(val cover: Bitmap?) : SlotCommand
}

/**
 * Renders the slot with the cartridge that is currently loaded, and animates it in and out.
 *
 * Frames are drawn on demand rather than continuously: with `RENDERMODE_WHEN_DIRTY` the GPU is idle
 * whenever nothing is moving, which on this screen is most of the time. Anything that changes the
 * image — a running animation, a tilt gesture settling, a new cover — asks for a redraw.
 */
class SlotSceneRenderer(
    private val onRequestRender: () -> Unit,
    private val onInsertComplete: () -> Unit,
    private val onEjectComplete: () -> Unit,
) : GLSurfaceView.Renderer {

    private val program = CartridgeProgram()
    private var groups: List<GpuGroup> = emptyList()
    private var model: CartridgeModel? = null
    private var cartridgeCenter = floatArrayOf(0f, 0f, 0f)

    private var viewportWidth = 1
    private var viewportHeight = 1

    private var coverTextureId = 0
    private var pendingCover: Bitmap? = null
    private var hasPendingCover = false

    private var pose = CartridgePose()
    private var animation: PoseAnimation? = null
    private var pendingCommands = ArrayDeque<SlotCommand>()

    /** Whether a cartridge is loaded at all; when false the cartridge meshes are skipped. */
    @Volatile
    var hasCartridge: Boolean = false
        private set

    // Tilt follows the finger and eases back to centre on release.
    private var tiltX = 0f
    private var tiltY = 0f
    private var targetTiltX = 0f
    private var targetTiltY = 0f

    private var lastFrameNanos = 0L

    /** Set once the model JSON has been parsed; buffers upload on the next GL frame. */
    fun setModel(model: CartridgeModel) {
        synchronized(this) {
            this.model = model
            this.cartridgeCenter = model.centerOf(CartridgeModel.ROLE_CARTRIDGE)
            groups = emptyList()
        }
        onRequestRender()
    }

    fun enqueue(command: SlotCommand) {
        synchronized(pendingCommands) { pendingCommands.addLast(command) }
        onRequestRender()
    }

    fun setTiltTarget(x: Float, y: Float) {
        targetTiltX = x.coerceIn(-MAX_TILT_X, MAX_TILT_X)
        targetTiltY = y.coerceIn(-MAX_TILT_Y, MAX_TILT_Y)
        onRequestRender()
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        // The context is recreated on resume and after a context loss, so everything GL-side is
        // rebuilt here rather than assumed to survive.
        program.compile()
        GLES20.glEnable(GLES20.GL_DEPTH_TEST)
        GLES20.glDepthFunc(GLES20.GL_LEQUAL)
        GLES20.glDisable(GLES20.GL_CULL_FACE)
        GLES20.glClearColor(0f, 0f, 0f, 0f)
        groups = emptyList()
        coverTextureId = 0
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        viewportWidth = width.coerceAtLeast(1)
        viewportHeight = height.coerceAtLeast(1)
        GLES20.glViewport(0, 0, viewportWidth, viewportHeight)
    }

    override fun onDrawFrame(gl: GL10?) {
        ensureBuffers()
        applyPendingCover()
        drainCommands()

        val now = System.nanoTime()
        val deltaSeconds = if (lastFrameNanos == 0L) 0f else (now - lastFrameNanos) / 1_000_000_000f
        lastFrameNanos = now

        val stillAnimating = advanceAnimation(now)
        val stillSettling = settleTilt(deltaSeconds)

        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
        if (!program.isReady || groups.isEmpty()) return
        program.use()

        val aspect = viewportWidth.toFloat() / viewportHeight.toFloat()
        val camera = floatArrayOf(0f, 60f, 286f)
        val projection = Mat4.perspective(
            fovYRadians = (34.0 * Math.PI / 180.0).toFloat(),
            aspect = aspect,
            near = 1f,
            far = 800f,
        )
        val view = Mat4.lookAt(camera, floatArrayOf(0f, 55f, 0f), floatArrayOf(0f, 1f, 0f))
        program.setCamera(Mat4.multiply(projection, view), camera)

        val scene = Mat4.multiply(Mat4.rotateX(tiltX), Mat4.rotateY(tiltY))
        val texture = coverTextureId.takeIf { it != 0 }

        for (group in groups) {
            if (group.role == CartridgeModel.ROLE_CARTRIDGE && !hasCartridge) continue
            val local = if (group.role == CartridgeModel.ROLE_CARTRIDGE) {
                Mat4.multiply(
                    Mat4.translate(0f, pose.y, pose.z),
                    Mat4.multiply(
                        Mat4.rotateX(pose.rotationX),
                        Mat4.multiply(Mat4.rotateY(pose.rotationY), Mat4.scale(pose.scale)),
                    ),
                )
            } else {
                Mat4.identity()
            }
            program.draw(group, Mat4.multiply(scene, local), texture)
        }

        // Keep asking for frames while anything is outstanding. Commands queued during an
        // animation are only drained afterwards, so the queue itself has to keep the loop alive.
        val hasQueuedWork = synchronized(pendingCommands) { pendingCommands.isNotEmpty() }
        if (stillAnimating || stillSettling || hasQueuedWork) onRequestRender() else lastFrameNanos = 0L
    }

    private fun ensureBuffers() {
        val currentModel = synchronized(this) { model } ?: return
        if (groups.isNotEmpty()) return
        groups = uploadModel(currentModel)
    }

    private fun applyPendingCover() {
        val bitmap = synchronized(this) {
            if (!hasPendingCover) return
            hasPendingCover = false
            pendingCover.also { pendingCover = null }
        }
        releaseTexture(coverTextureId)
        coverTextureId = bitmap?.let { uploadTexture(it) } ?: 0
    }

    private fun drainCommands() {
        // Only one command is taken per frame: an insert must play out before the next one starts,
        // otherwise fast navigation would stack animations on top of each other.
        if (animation != null) return
        val command = synchronized(pendingCommands) { pendingCommands.removeFirstOrNull() } ?: return
        when (command) {
            is SlotCommand.SetCover -> queueCover(command.cover)
            is SlotCommand.Insert -> startInsert(command)
            is SlotCommand.Eject -> startEject(command)
        }
    }

    private fun queueCover(bitmap: Bitmap?) {
        synchronized(this) {
            pendingCover = bitmap
            hasPendingCover = true
        }
    }

    private fun startInsert(command: SlotCommand.Insert) {
        queueCover(command.cover)
        applyPendingCover()
        hasCartridge = true
        // Start above and behind the slot, tilted, then drop into place.
        pose = if (command.reducedMotion) {
            CartridgePose(y = 12f, z = 5f, rotationX = -0.03f, rotationY = 0.02f, scale = 0.99f)
        } else {
            CartridgePose(y = 48f, z = 23f, rotationX = -0.15f, rotationY = -0.17f, scale = 0.94f)
        }
        animation = PoseAnimation(
            from = pose,
            to = CartridgePose(),
            durationNanos = if (command.reducedMotion) INSERT_REDUCED_NANOS else INSERT_NANOS,
            easing = ::easeOutBackSoft,
            onFinished = onInsertComplete,
        )
    }

    private fun startEject(command: SlotCommand.Eject) {
        if (!hasCartridge) {
            onEjectComplete()
            return
        }
        animation = PoseAnimation(
            from = pose,
            to = if (command.reducedMotion) {
                CartridgePose(y = 14f, z = 7f, rotationX = -0.05f, rotationY = 0.05f, scale = 0.98f)
            } else {
                CartridgePose(y = 38f, z = 20f, rotationX = -0.12f, rotationY = 0.12f, scale = 0.98f)
            },
            durationNanos = if (command.reducedMotion) EJECT_REDUCED_NANOS else EJECT_NANOS,
            easing = ::easeInOut,
            onFinished = {
                hasCartridge = false
                pose = CartridgePose()
                releaseTexture(coverTextureId)
                coverTextureId = 0
                onEjectComplete()
            },
        )
    }

    private fun advanceAnimation(nowNanos: Long): Boolean {
        val current = animation ?: return false
        val progress = current.progress(nowNanos)
        pose = current.poseAt(progress)
        if (progress >= 1f) {
            animation = null
            current.onFinished()
            return false
        }
        return true
    }

    private fun settleTilt(deltaSeconds: Float): Boolean {
        if (abs(targetTiltX - tiltX) < TILT_EPSILON && abs(targetTiltY - tiltY) < TILT_EPSILON) {
            tiltX = targetTiltX
            tiltY = targetTiltY
            return false
        }
        // Frame-rate independent exponential approach, so the settle feels the same at 60 and 120Hz.
        val factor = (TILT_FOLLOW_RATE * deltaSeconds).coerceIn(0f, 1f)
        tiltX += (targetTiltX - tiltX) * factor
        tiltY += (targetTiltY - tiltY) * factor
        return true
    }

    /** Frees GL objects; called from the GL thread when the surface goes away. */
    fun release() {
        releaseGroups(groups)
        groups = emptyList()
        releaseTexture(coverTextureId)
        coverTextureId = 0
        program.release()
    }

    private class PoseAnimation(
        val from: CartridgePose,
        val to: CartridgePose,
        val durationNanos: Long,
        val easing: (Float) -> Float,
        val onFinished: () -> Unit,
    ) {
        private var startNanos = 0L

        fun progress(nowNanos: Long): Float {
            if (startNanos == 0L) startNanos = nowNanos
            if (durationNanos <= 0L) return 1f
            return ((nowNanos - startNanos).toFloat() / durationNanos).coerceIn(0f, 1f)
        }

        fun poseAt(progress: Float): CartridgePose {
            val t = easing(progress)
            return CartridgePose(
                y = lerp(from.y, to.y, t),
                z = lerp(from.z, to.z, t),
                rotationX = lerp(from.rotationX, to.rotationX, t),
                rotationY = lerp(from.rotationY, to.rotationY, t),
                scale = lerp(from.scale, to.scale, t),
            )
        }

        private fun lerp(a: Float, b: Float, t: Float) = a + (b - a) * t
    }

    private companion object {
        const val INSERT_NANOS = 900_000_000L
        const val INSERT_REDUCED_NANOS = 260_000_000L
        const val EJECT_NANOS = 420_000_000L
        const val EJECT_REDUCED_NANOS = 180_000_000L

        const val MAX_TILT_X = 0.12f
        const val MAX_TILT_Y = 0.23f
        const val TILT_EPSILON = 0.0005f
        const val TILT_FOLLOW_RATE = 6f
    }
}

/**
 * Renders a single cartridge floating in place, for the game cards.
 *
 * Unlike the slot scene there is no slot geometry and no insert animation — just a slow idle sway,
 * so a rail of cards still feels physical without each card paying for a full scene.
 */
class CartridgePreviewRenderer(
    private val onRequestRender: () -> Unit,
) : GLSurfaceView.Renderer {

    private val program = CartridgeProgram()
    private var groups: List<GpuGroup> = emptyList()
    private var model: CartridgeModel? = null
    private var cartridgeCenter = floatArrayOf(0f, 0f, 0f)
    private var viewportWidth = 1
    private var viewportHeight = 1

    private var coverTextureId = 0
    private var pendingCover: Bitmap? = null
    private var hasPendingCover = false
    private var startNanos = 0L

    /** Pauses the idle sway while the card is off-screen or the app is backgrounded. */
    @Volatile
    var animating: Boolean = true

    fun setModel(model: CartridgeModel) {
        synchronized(this) {
            this.model = model
            this.cartridgeCenter = model.centerOf(CartridgeModel.ROLE_CARTRIDGE)
            groups = emptyList()
        }
        onRequestRender()
    }

    fun setCover(bitmap: Bitmap?) {
        synchronized(this) {
            pendingCover = bitmap
            hasPendingCover = true
        }
        onRequestRender()
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        program.compile()
        GLES20.glEnable(GLES20.GL_DEPTH_TEST)
        GLES20.glDepthFunc(GLES20.GL_LEQUAL)
        GLES20.glDisable(GLES20.GL_CULL_FACE)
        GLES20.glClearColor(0f, 0f, 0f, 0f)
        groups = emptyList()
        coverTextureId = 0
        startNanos = 0L
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        viewportWidth = width.coerceAtLeast(1)
        viewportHeight = height.coerceAtLeast(1)
        GLES20.glViewport(0, 0, viewportWidth, viewportHeight)
    }

    override fun onDrawFrame(gl: GL10?) {
        synchronized(this) { model }?.let { if (groups.isEmpty()) groups = uploadModel(it, CartridgeModel.ROLE_CARTRIDGE) }

        val bitmap = synchronized(this) {
            if (hasPendingCover) {
                hasPendingCover = false
                pendingCover.also { pendingCover = null } to true
            } else {
                null to false
            }
        }
        if (bitmap.second) {
            releaseTexture(coverTextureId)
            coverTextureId = bitmap.first?.let { uploadTexture(it) } ?: 0
        }

        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
        if (!program.isReady || groups.isEmpty()) return
        program.use()

        val now = System.nanoTime()
        if (startNanos == 0L) startNanos = now
        val seconds = (now - startNanos) / 1_000_000_000f

        val aspect = viewportWidth.toFloat() / viewportHeight.toFloat()
        val camera = floatArrayOf(0f, 64f, 308f)
        val projection = Mat4.perspective((26.0 * Math.PI / 180.0).toFloat(), aspect, 1f, 900f)
        val view = Mat4.lookAt(camera, floatArrayOf(0f, 58f, 0f), floatArrayOf(0f, 1f, 0f))
        program.setCamera(Mat4.multiply(projection, view), camera)

        // Slow, low-amplitude drift: enough to look alive, not enough to distract while reading.
        val sway = if (animating) sin(seconds * 1.05f) * 0.055f else 0f
        val bob = if (animating) sin(seconds * 1.15f) * 0.35f else 0f
        val modelMatrix = Mat4.centeredTransform(
            center = cartridgeCenter,
            translateY = -1.5f + bob,
            rotationX = 0.028f,
            rotationY = sway,
            scale = 0.90f,
        )
        val texture = coverTextureId.takeIf { it != 0 }
        for (group in groups) program.draw(group, modelMatrix, texture)

        if (animating) onRequestRender()
    }

    fun release() {
        releaseGroups(groups)
        groups = emptyList()
        releaseTexture(coverTextureId)
        coverTextureId = 0
        program.release()
    }
}
