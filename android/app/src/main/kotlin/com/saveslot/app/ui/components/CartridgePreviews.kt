package com.saveslot.app.ui.components

import android.content.Context
import android.graphics.Bitmap
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.toBitmap
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
        factory.cached(coverUrl)?.let { return it.asImageBitmap() }
        val cover = if (coverUrl == FALLBACK_PREVIEW_KEY) {
            FallbackCover.bitmap()
        } else {
            loadCover(coverUrl) ?: FallbackCover.bitmap()
        }
        return factory.preview(coverUrl, cover)?.asImageBitmap()
    }

    private suspend fun loadCover(url: String): Bitmap? = runCatching {
        val request = ImageRequest.Builder(context)
            .data(url)
            // A hardware bitmap cannot be read back by glTexImage2D.
            .allowHardware(false)
            .build()
        imageLoader.execute(request).image?.toBitmap()
    }.getOrNull()
}

val LocalCartridgePreviews: ProvidableCompositionLocal<CartridgePreviewProvider?> =
    staticCompositionLocalOf { null }
