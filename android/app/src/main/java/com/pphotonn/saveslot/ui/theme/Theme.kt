package com.pphotonn.saveslot.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val SaveBlack = Color(0xFF0B0E0D)
val SaveSurface = Color(0xFF131817)
val SaveSurfaceHigh = Color(0xFF1B2220)
val SaveGreen = Color(0xFF9BE564)
val SaveAmber = Color(0xFFFFC857)
val SaveText = Color(0xFFF2F5F3)
val SaveMuted = Color(0xFF9AA6A0)
val SaveDanger = Color(0xFFFF6B6B)

private val SaveSlotScheme = darkColorScheme(
    primary = SaveGreen,
    onPrimary = SaveBlack,
    secondary = SaveAmber,
    onSecondary = SaveBlack,
    background = SaveBlack,
    onBackground = SaveText,
    surface = SaveSurface,
    onSurface = SaveText,
    surfaceVariant = SaveSurfaceHigh,
    onSurfaceVariant = SaveMuted,
    error = SaveDanger,
    onError = SaveBlack,
)

@Composable
fun SaveSlotTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SaveSlotScheme,
        typography = MaterialTheme.typography,
        content = content,
    )
}
