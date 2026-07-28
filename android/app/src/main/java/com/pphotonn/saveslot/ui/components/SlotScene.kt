package com.pphotonn.saveslot.ui.components

import android.graphics.BitmapFactory
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
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
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.pphotonn.saveslot.model.Game
import com.pphotonn.saveslot.ui.theme.SaveAmber
import com.pphotonn.saveslot.ui.theme.SaveGreen
import com.pphotonn.saveslot.ui.theme.SaveSurfaceHigh
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URI
import kotlin.math.roundToInt

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
                animationSpec = tween(760, easing = FastOutSlowInEasing),
            )
        }
    }

    Box(
        modifier = modifier
            .height(330.dp)
            .background(
                brush = Brush.verticalGradient(listOf(Color(0xFF111614), Color(0xFF090B0A))),
                shape = RoundedCornerShape(28.dp),
            ),
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val slotWidth = size.width * 0.72f
            val slotHeight = size.height * 0.28f
            val left = (size.width - slotWidth) / 2f
            val top = size.height * 0.56f

            drawRoundRect(
                brush = Brush.verticalGradient(listOf(Color(0xFF39413E), Color(0xFF161B19))),
                topLeft = Offset(left, top),
                size = Size(slotWidth, slotHeight),
                cornerRadius = CornerRadius(28f, 28f),
            )
            drawRoundRect(
                color = Color(0xFF060807),
                topLeft = Offset(left + slotWidth * 0.12f, top + slotHeight * 0.18f),
                size = Size(slotWidth * 0.76f, slotHeight * 0.22f),
                cornerRadius = CornerRadius(16f, 16f),
            )
            drawRoundRect(
                brush = Brush.horizontalGradient(listOf(SaveGreen.copy(alpha = 0.15f), SaveAmber.copy(alpha = 0.12f))),
                topLeft = Offset(left + slotWidth * 0.08f, top + slotHeight * 0.72f),
                size = Size(slotWidth * 0.84f, slotHeight * 0.08f),
                cornerRadius = CornerRadius(8f, 8f),
            )
            drawCircle(
                color = if (game == null) Color(0xFF48514D) else SaveGreen,
                radius = 8f,
                center = Offset(left + slotWidth * 0.88f, top + slotHeight * 0.58f),
            )
        }

        if (game != null) {
            val p = progress.value
            val x = (110f * (1f - p)).roundToInt()
            val y = (-125f * (1f - p) + 28f * p).roundToInt()
            Box(
                modifier = Modifier
                    .offset { IntOffset(x, y) }
                    .size(width = 154.dp, height = 206.dp)
                    .graphicsLayer {
                        rotationX = 38f * (1f - p)
                        rotationY = -18f * (1f - p)
                        rotationZ = 10f * (1f - p)
                        scaleX = 0.84f + 0.16f * p
                        scaleY = 0.84f + 0.16f * p
                        shadowElevation = 24f
                    }
                    .clip(RoundedCornerShape(18.dp))
                    .background(SaveSurfaceHigh),
            ) {
                RemoteImage(
                    url = game.coverUrl,
                    contentDescription = game.title,
                    modifier = Modifier.fillMaxSize(),
                )
                Canvas(Modifier.fillMaxSize()) {
                    drawRoundRect(
                        color = Color.White.copy(alpha = 0.14f),
                        topLeft = Offset(size.width * 0.08f, size.height * 0.05f),
                        size = Size(size.width * 0.84f, size.height * 0.03f),
                        cornerRadius = CornerRadius(12f, 12f),
                    )
                    drawRoundRect(
                        color = Color.Black.copy(alpha = 0.45f),
                        topLeft = Offset(size.width * 0.18f, size.height * 0.9f),
                        size = Size(size.width * 0.64f, size.height * 0.08f),
                        cornerRadius = CornerRadius(12f, 12f),
                    )
                }
            }
        }
    }
}

@Composable
fun RemoteImage(
    url: String?,
    contentDescription: String?,
    modifier: Modifier = Modifier,
) {
    var bitmap by remember(url) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(url) {
        bitmap = if (url.isNullOrBlank()) null else loadBitmap(url)
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
                    listOf(Color(0xFF24302B), Color(0xFF111614), Color(0xFF342A1C))
                )
            )
        )
    }
}

private suspend fun loadBitmap(url: String): ImageBitmap? = withContext(Dispatchers.IO) {
    runCatching {
        val connection = URI(url).toURL().openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("User-Agent", "SaveSlotAndroid/1.0")
            connection.inputStream.use { BitmapFactory.decodeStream(it)?.asImageBitmap() }
        } finally {
            connection.disconnect()
        }
    }.getOrNull()
}
