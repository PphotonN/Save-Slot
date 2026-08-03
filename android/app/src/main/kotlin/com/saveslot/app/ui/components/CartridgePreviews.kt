package com.saveslot.app.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.os.SystemClock
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.toBitmap
import com.saveslot.app.core.log.ImageLog
import com.saveslot.app.render.CartridgePreviewFactory

/**
 * Turns a cover URL into a rendered cartridge image for the UI.
 *
 * Fetching and rendering are separate concerns: Coil handles the network and disk caching of the
 * artwork, and [CartridgePreviewFactory] turns the decoded bitmap into a cartridge. Hardware
 * bitmaps are disabled for these requests because GL upload needs CPU-readable pixels.
 */
class CartridgePreviewProvider(
    private val context: Context,
    private val imageLoader: ImageLoader,
    private val factory: CartridgePreviewFactory,
) {

    suspend fun preview(coverUrl: String): ImageBitmap? {
        factory.cached(coverUrl)?.let {
            ImageLog.d(TAG) { "cache hit  ${ImageLog.key(coverUrl)} ${factory.cacheStats()}" }
            return it.asImageBitmap()
        }
        ImageLog.d(TAG) {
            "cache miss ${ImageLog.key(coverUrl)} ${factory.cacheStats()} " +
                ImageLog.coilCaches(imageLoader)
        }

        val startedAt = SystemClock.elapsedRealtime()
        val cover = if (coverUrl == FALLBACK_PREVIEW_KEY) {
            FallbackCover.bitmap()
        } else {
            val loaded = loadCover(coverUrl)
            if (loaded == null) {
                // Note: the cartridge is still rendered and cached under the cover's key, so this
                // URL keeps its placeholder label until the cache is dropped.
                ImageLog.w(TAG) { "cover missing, labelling with fallback ${ImageLog.key(coverUrl)}" }
                FallbackCover.bitmap()
            } else {
                ImageLog.d(TAG) {
                    "cover ok   ${ImageLog.key(coverUrl)} ${loaded.width}x${loaded.height} " +
                        "in ${SystemClock.elapsedRealtime() - startedAt}ms"
                }
                loaded
            }
        }

        val rendered = factory.preview(coverUrl, cover)
        ImageLog.d(TAG) {
            val outcome = if (rendered == null) "render FAILED" else "render ok ${rendered.width}x${rendered.height}"
            "$outcome ${ImageLog.key(coverUrl)} total=${SystemClock.elapsedRealtime() - startedAt}ms"
        }
        return rendered?.asImageBitmap()
    }

    private suspend fun loadCover(url: String): Bitmap? = runCatching {
        val request = ImageRequest.Builder(context)
            .data(url)
            // A hardware bitmap cannot be read back by glTexImage2D.
            .allowHardware(false)
            .build()
        imageLoader.execute(request).image?.toBitmap()
    }.onFailure { error ->
        ImageLog.w(TAG, error) { "cover fetch threw ${ImageLog.key(url)}" }
    }.getOrNull()

    private companion object {
        const val TAG = ImageLog.TAG_PREVIEW
    }
}

val LocalCartridgePreviews: ProvidableCompositionLocal<CartridgePreviewProvider?> =
    staticCompositionLocalOf { null }
