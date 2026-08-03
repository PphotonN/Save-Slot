package com.saveslot.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

private val SaveSlotColorScheme = darkColorScheme(
    primary = ConsoleAccent,
    onPrimary = Color(0xFF241708),
    primaryContainer = ConsoleAccentSoft,
    onPrimaryContainer = ConsoleAccent,
    secondary = ConsoleGreen,
    onSecondary = Color(0xFF0C1A12),
    background = ConsoleBackground,
    onBackground = ConsoleText,
    surface = ConsolePanel,
    onSurface = ConsoleText,
    surfaceVariant = ConsolePanelRaised,
    onSurfaceVariant = ConsoleMuted,
    surfaceContainer = ConsolePanelRaised,
    surfaceContainerHigh = ConsolePlastic,
    outline = ConsoleLine,
    outlineVariant = ConsoleLineSoft,
    error = ConsoleDanger,
    onError = Color(0xFF2A1213),
)

/** Extra semantic colors that Material 3's scheme has no slot for. */
data class SaveSlotExtraColors(
    val plastic: Color = ConsolePlastic,
    val lineSoft: Color = ConsoleLineSoft,
    val muted: Color = ConsoleMuted,
    val online: Color = ConsoleGreen,
    val danger: Color = ConsoleDanger,
)

val LocalSaveSlotColors: ProvidableCompositionLocal<SaveSlotExtraColors> =
    staticCompositionLocalOf { SaveSlotExtraColors() }

@Composable
fun SaveSlotTheme(content: @Composable () -> Unit) {
    // The console face is intentionally always dark; the system setting is read only so that
    // future light-mode work has a hook, and so previews behave predictably.
    @Suppress("UNUSED_VARIABLE")
    val systemDark = isSystemInDarkTheme()
    CompositionLocalProvider(LocalSaveSlotColors provides SaveSlotExtraColors()) {
        MaterialTheme(
            colorScheme = SaveSlotColorScheme,
            typography = SaveSlotTypography,
            content = content,
        )
    }
}
