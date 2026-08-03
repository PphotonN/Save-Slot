package com.saveslot.app.render

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import com.saveslot.app.core.log.ImageLog
import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * On-disk store of finished cartridge images.
 *
 * Rendering a cartridge is the expensive half of showing a card, and the result never changes: the
 * geometry, camera and lighting are fixed, so a given cover always produces the same picture. Keeping
 * only a memory cache meant a cover was re-rendered every time it was evicted mid-scroll and again on
 * every cold start. Persisting the drawn cartridge means each cover is rendered *once, ever* — after
 * that a card costs a bitmap decode, and GL is not involved at all.
 *
 * Entries are content-addressed by cover URL plus [RENDER_VERSION]; bumping that version is what
 * invalidates every cached image after a change to the model, camera or shading.
 */
class CartridgeDiskCache(
    private val directory: File,
    private val maxBytes: Long = DEFAULT_MAX_BYTES,
) {

    /** Reads a previously drawn cartridge, or null when this cover has never been rendered. */
    suspend fun read(key: String): Bitmap? = withContext(Dispatchers.IO) {
        val file = fileFor(key)
        if (!file.exists()) return@withContext null
        val bitmap = runCatching {
            BitmapFactory.decodeFile(file.absolutePath, BitmapFactory.Options().apply {
                // The cartridge is composited over the card background, so alpha must survive.
                inPreferredConfig = Bitmap.Config.ARGB_8888
            })
        }.getOrNull()
        if (bitmap == null) {
            // A truncated file from a killed process would otherwise fail forever.
            ImageLog.w(TAG) { "unreadable cache file, dropping ${ImageLog.key(key)}" }
            file.delete()
            return@withContext null
        }
        // Touch so pruning treats this as recently used.
        file.setLastModified(System.currentTimeMillis())
        ImageLog.d(TAG) { "disk hit  ${ImageLog.key(key)} ${bitmap.width}x${bitmap.height}" }
        bitmap
    }

    /** Stores a drawn cartridge. Failures are logged and ignored — the cache is an optimisation. */
    suspend fun write(key: String, bitmap: Bitmap) = withContext(Dispatchers.IO) {
        runCatching {
            if (!directory.exists() && !directory.mkdirs()) {
                ImageLog.w(TAG) { "cannot create cache directory $directory" }
                return@withContext
            }
            // Write to a temporary name and rename, so a crash mid-write cannot leave a partial
            // file under the real key.
            val target = fileFor(key)
            val temporary = File(directory, "${target.name}.tmp")
            temporary.outputStream().use { stream ->
                if (!bitmap.compress(COMPRESS_FORMAT, COMPRESS_QUALITY, stream)) {
                    ImageLog.w(TAG) { "compress failed ${ImageLog.key(key)}" }
                    return@withContext
                }
            }
            if (!temporary.renameTo(target)) {
                temporary.delete()
                ImageLog.w(TAG) { "rename failed ${ImageLog.key(key)}" }
                return@withContext
            }
            ImageLog.d(TAG) { "disk put  ${ImageLog.key(key)} ${target.length() / 1024}KB" }
            prune()
        }.onFailure { error ->
            ImageLog.w(TAG, error) { "disk write threw ${ImageLog.key(key)}" }
        }
    }

    /** Drops the least recently used files once the directory exceeds [maxBytes]. */
    private fun prune() {
        val files = directory.listFiles()?.filter { it.isFile } ?: return
        var total = files.sumOf { it.length() }
        if (total <= maxBytes) return
        val oldestFirst = files.sortedBy { it.lastModified() }
        for (file in oldestFirst) {
            if (total <= maxBytes) break
            val size = file.length()
            if (file.delete()) total -= size
        }
        ImageLog.d(TAG) { "pruned to ${total / 1024}KB of ${maxBytes / 1024}KB" }
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        directory.listFiles()?.forEach { it.delete() }
        Unit
    }

    /**
     * Filename for a cover.
     *
     * Cover URLs contain characters that are illegal in filenames and run to hundreds of
     * characters, so the key is hashed. The render version is part of the hashed input, so an
     * appearance change cannot serve stale images.
     */
    private fun fileFor(key: String): File = File(directory, "${hash("$RENDER_VERSION|$key")}.img")

    private companion object {
        const val TAG = ImageLog.TAG_PREVIEW

        /**
         * Bump when the cartridge's appearance changes — model, camera, lighting or output size.
         * Cached images from an older version become unreachable rather than wrong.
         */
        // 2: re-framed so the cartridge is no longer clipped at the top.
        const val RENDER_VERSION = 2

        /** ~90 cartridges at typical compressed size; a few hundred KB of headroom per screen. */
        const val DEFAULT_MAX_BYTES = 32L * 1024 * 1024

        /**
         * Lossless WebP where available: the cartridge has hard edges and flat plastic, which lossy
         * compression smears, and it is roughly half the size of PNG for this content.
         */
        val COMPRESS_FORMAT: Bitmap.CompressFormat =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                Bitmap.CompressFormat.WEBP_LOSSLESS
            } else {
                Bitmap.CompressFormat.PNG
            }

        /** Ignored by both lossless formats, but the API requires a value. */
        const val COMPRESS_QUALITY = 100

        fun hash(value: String): String {
            val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray())
            return digest.take(16).joinToString("") { "%02x".format(it) }
        }
    }
}
