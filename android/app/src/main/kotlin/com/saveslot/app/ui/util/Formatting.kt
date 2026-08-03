package com.saveslot.app.ui.util

import java.text.DateFormat
import java.util.Date
import java.util.Locale

/** Ukrainian date and size formatting for the notes journal and settings screen. */

private val UKRAINIAN = Locale.forLanguageTag("uk-UA")

fun formatDate(timestamp: Long): String =
    DateFormat.getDateInstance(DateFormat.MEDIUM, UKRAINIAN).format(Date(timestamp))

fun formatDateTime(timestamp: Long): String =
    DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT, UKRAINIAN)
        .format(Date(timestamp))

fun formatBytes(bytes: Long): String = when {
    bytes < 1024 -> "$bytes Б"
    bytes < 1024 * 1024 -> String.format(UKRAINIAN, "%.1f КБ", bytes / 1024.0)
    else -> String.format(UKRAINIAN, "%.1f МБ", bytes / (1024.0 * 1024.0))
}
