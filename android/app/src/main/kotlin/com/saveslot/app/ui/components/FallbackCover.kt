package com.saveslot.app.ui.components

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * The placeholder label shown when no box art could be found.
 *
 * It is drawn rather than shipped as a PNG so it scales cleanly and stays a single source of truth
 * with the palette; it doubles as the cartridge texture, which is why it is produced as a bitmap
 * rather than as composables.
 */
object FallbackCover {

    private const val WIDTH = 480
    private const val HEIGHT = 640

    @Volatile
    private var cached: Bitmap? = null

    /**
     * The placeholder label, drawn once and shared.
     *
     * Reached from several threads — the preview factory's render dispatcher, the slot view model,
     * and composition — so the one-time draw is guarded rather than racing to produce duplicates.
     */
    fun bitmap(): Bitmap = cached ?: synchronized(this) {
        cached ?: draw().also { cached = it }
    }

    private fun draw(): Bitmap {
        val bitmap = Bitmap.createBitmap(WIDTH, HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        paint.shader = LinearGradient(
            0f, 0f, WIDTH.toFloat(), HEIGHT.toFloat(),
            0xFF454F5A.toInt(), 0xFF1A2027.toInt(),
            Shader.TileMode.CLAMP,
        )
        canvas.drawRect(0f, 0f, WIDTH.toFloat(), HEIGHT.toFloat(), paint)
        paint.shader = null

        // Outer bezel
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 3f
        paint.color = 0xFF75818D.toInt()
        canvas.drawRoundRect(RectF(26f, 26f, 454f, 614f), 26f, 26f, paint)

        // Label window
        paint.style = Paint.Style.FILL
        paint.color = 0xFF14191F.toInt()
        canvas.drawRoundRect(RectF(80f, 96f, 400f, 456f), 18f, 18f, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 2f
        paint.color = 0xFF606A76.toInt()
        canvas.drawRoundRect(RectF(80f, 96f, 400f, 456f), 18f, 18f, paint)

        // Inner cartridge silhouette
        paint.style = Paint.Style.FILL
        paint.color = 0xFF202730.toInt()
        canvas.drawRoundRect(RectF(148f, 168f, 332f, 378f), 18f, 18f, paint)
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 3f
        paint.color = 0xFF7B8793.toInt()
        canvas.drawRoundRect(RectF(148f, 168f, 332f, 378f), 18f, 18f, paint)

        paint.strokeWidth = 8f
        paint.shader = LinearGradient(
            0f, 195f, 0f, 351f,
            0xFFF1B16D.toInt(), 0xFFBF7E3C.toInt(),
            Shader.TileMode.CLAMP,
        )
        canvas.drawRoundRect(RectF(175f, 195f, 305f, 351f), 12f, 12f, paint)
        paint.shader = null

        paint.style = Paint.Style.FILL
        paint.color = 0xFF6F7A86.toInt()
        canvas.drawRoundRect(RectF(194f, 374f, 286f, 386f), 6f, 6f, paint)

        paint.color = 0xFFF1B16D.toInt()
        paint.textAlign = Paint.Align.CENTER
        paint.textSize = 36f
        paint.letterSpacing = 0.22f
        paint.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        canvas.drawText("SAVE SLOT", WIDTH / 2f, 490f, paint)

        paint.color = 0xFF9CA7B2.toInt()
        paint.textSize = 18f
        paint.letterSpacing = 0.17f
        paint.typeface = Typeface.MONOSPACE
        canvas.drawText("NO BOX ART", WIDTH / 2f, 528f, paint)

        return bitmap
    }
}

/**
 * The placeholder label for use in composition.
 *
 * Produced off the main thread: the first call rasterises a 480x640 bitmap, and doing that inside
 * composition would stall the frame that first shows a card. Until it is ready the caller simply
 * has nothing to draw, which is the correct state anyway — artwork is still being resolved.
 */
@Composable
internal fun rememberFallbackCover(): ImageBitmap? {
    val bitmap by produceState<ImageBitmap?>(initialValue = null) {
        value = withContext(Dispatchers.Default) { FallbackCover.bitmap().asImageBitmap() }
    }
    return bitmap
}
