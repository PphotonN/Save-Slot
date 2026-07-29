package com.pphotonn.saveslot.ui.components

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.LruCache
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pphotonn.saveslot.model.Game
import com.pphotonn.saveslot.ui.theme.SaveAmber
import com.pphotonn.saveslot.ui.theme.SaveGreen
import com.pphotonn.saveslot.ui.theme.SaveMuted
import com.pphotonn.saveslot.ui.theme.SaveSurfaceHigh
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URI

@Composable
fun SlotScene(
    game: Game?,
    animationNonce: Int,
    reducedMotion: Boolean,
    modifier: Modifier = Modifier,
) {
    val progress = remember { Animatable(if (game == null) 1f else 0f) }

    LaunchedEffect(animationNonce, game?.id, reducedMotion) {
        if (game == null || reducedMotion) {
            progress.snapTo(1f)
        } else {
            progress.snapTo(0f)
            progress.animateTo(
                targetValue = 1f,
                animationSpec = tween(820, easing = FastOutSlowInEasing),
            )
        }
    }

    Box(
        modifier = modifier
            .height(330.dp)
            .clip(RoundedCornerShape(28.dp))
            .background(Brush.verticalGradient(listOf(Color(0xFF111614), Color(0xFF090B0A)))),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val slotWidth = size.width * 0.74f
            val slotHeight = size.height * 0.30f
            val left = (size.width - slotWidth) / 2f
            val top = size.height * 0.55f

            drawRoundRect(
                brush = Brush.verticalGradient(listOf(Color(0xFF46504C), Color(0xFF171C1A))),
                topLeft = Offset(left, top),
                size = Size(slotWidth, slotHeight),
                cornerRadius = CornerRadius(30f, 30f),
            )
            drawRoundRect(
                color = Color(0xFF050706),
                topLeft = Offset(left + slotWidth * 0.10f, top + slotHeight * 0.14f),
                size = Size(slotWidth * 0.80f, slotHeight * 0.25f),
                cornerRadius = CornerRadius(18f, 18f),
            )
            drawRoundRect(
                color = Color.White.copy(alpha = 0.08f),
                topLeft = Offset(left + slotWidth * 0.13f, top + slotHeight * 0.10f),
                size = Size(slotWidth * 0.74f, slotHeight * 0.035f),
                cornerRadius = CornerRadius(8f, 8f),
            )
        }

        if (game != null) {
            val p = progress.value
            Box(
                modifier = Modifier
                    .offset(
                        x = (126f * (1f - p)).dp,
                        y = (-150f * (1f - p) + 12f * p).dp,
                    )
                    .size(width = 158.dp, height = 212.dp)
                    .graphicsLayer {
                        rotationX = 38f * (1f - p)
                        rotationY = -20f * (1f - p)
                        rotationZ = 11f * (1f - p)
                        scaleX = 0.82f + 0.18f * p
                        scaleY = 0.82f + 0.18f * p
                        shadowElevation = 24f
                        cameraDistance = 14f * density
                    }
                    .clip(RoundedCornerShape(18.dp))
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xFF59645F), SaveSurfaceHigh, Color(0xFF202724))
                        )
                    ),
            ) {
                RemoteImage(
                    url = game.coverUrl,
                    contentDescription = game.title,
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(horizontal = 12.dp, vertical = 12.dp)
                        .fillMaxWidth()
                        .height(166.dp)
                        .clip(RoundedCornerShape(11.dp)),
                )
                Canvas(Modifier.fillMaxSize()) {
                    drawRoundRect(
                        color = Color.White.copy(alpha = 0.15f),
                        topLeft = Offset(size.width * 0.10f, size.height * 0.035f),
                        size = Size(size.width * 0.80f, size.height * 0.025f),
                        cornerRadius = CornerRadius(10f, 10f),
                    )
                    drawRoundRect(
                        color = Color(0xFF080B09).copy(alpha = 0.72f),
                        topLeft = Offset(size.width * 0.25f, size.height * 0.90f),
                        size = Size(size.width * 0.50f, size.height * 0.07f),
                        cornerRadius = CornerRadius(12f, 12f),
                    )
                }
            }
        }

        Canvas(Modifier.fillMaxSize()) {
            val slotWidth = size.width * 0.74f
            val slotHeight = size.height * 0.30f
            val left = (size.width - slotWidth) / 2f
            val top = size.height * 0.55f
            val frontTop = top + slotHeight * 0.38f

            drawRoundRect(
                brush = Brush.verticalGradient(listOf(Color(0xFF323B37), Color(0xFF141917))),
                topLeft = Offset(left, frontTop),
                size = Size(slotWidth, top + slotHeight - frontTop),
                cornerRadius = CornerRadius(24f, 24f),
            )
            drawRoundRect(
                color = Color(0xFF030504),
                topLeft = Offset(left + slotWidth * 0.10f, top + slotHeight * 0.14f),
                size = Size(slotWidth * 0.80f, slotHeight * 0.25f),
                cornerRadius = CornerRadius(18f, 18f),
            )
            drawRoundRect(
                brush = Brush.horizontalGradient(
                    listOf(SaveGreen.copy(alpha = 0.15f), SaveAmber.copy(alpha = 0.13f))
                ),
                topLeft = Offset(left + slotWidth * 0.08f, top + slotHeight * 0.73f),
                size = Size(slotWidth * 0.84f, slotHeight * 0.075f),
                cornerRadius = CornerRadius(8f, 8f),
            )
            drawCircle(
                color = if (game == null) Color(0xFF48514D) else SaveGreen,
                radius = 8f,
                center = Offset(left + slotWidth * 0.88f, top + slotHeight * 0.58f),
            )
        }
    }
}

@Composable
fun RemoteImage(
    url: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
) {
    var bitmap by remember(url) { mutableStateOf<ImageBitmap?>(url?.let(imageMemoryCache::get)) }
    var failed by remember(url) { mutableStateOf(false) }

    LaunchedEffect(url) {
        failed = false
        bitmap = when {
            url.isNullOrBlank() -> null
            imageMemoryCache.get(url) != null -> imageMemoryCache.get(url)
            else -> loadBitmap(url)?.also { imageMemoryCache.put(url, it) }
        }
        failed = bitmap == null
    }

    val image = bitmap
    if (image != null) {
        Image(
            bitmap = image,
            contentDescription = contentDescription,
            modifier = modifier,
            contentScale = ContentScale.Crop,
        )
    } else {
        Box(
            modifier = modifier.background(
                Brush.linearGradient(
                    listOf(Color(0xFF29352F), Color(0xFF111614), Color(0xFF3B2E1E))
                )
            ),
            contentAlignment = Alignment.Center,
        ) {
            TextFallback(contentDescription, failed)
        }
    }
}

@Composable
private fun TextFallback(title: String?, failed: Boolean) {
    androidx.compose.material3.Text(
        text = title?.trim()?.take(2)?.uppercase().orEmpty().ifBlank { if (failed) "×" else "…" },
        color = if (failed) SaveMuted else Color.White.copy(alpha = 0.7f),
        fontSize = 24.sp,
        fontWeight = FontWeight.Black,
        fontFamily = FontFamily.Monospace,
    )
}

private suspend fun loadBitmap(url: String): ImageBitmap? = withContext(Dispatchers.IO) {
    runCatching {
        val connection = URI(url).toURL().openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 12_000
            connection.readTimeout = 20_000
            connection.instanceFollowRedirects = true
            connection.setRequestProperty("User-Agent", "SaveSlotAndroid/1.1")
            connection.setRequestProperty("Accept", "image/*,*/*;q=0.8")
            val code = connection.responseCode
            if (code !in 200..299) return@runCatching null
            val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.RGB_565 }
            connection.inputStream.use { BitmapFactory.decodeStream(it, null, options)?.asImageBitmap() }
        } finally {
            connection.disconnect()
        }
    }.getOrNull()
}

private val imageMemoryCache = object : LruCache<String, ImageBitmap>(32) {}
