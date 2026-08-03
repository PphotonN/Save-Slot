package com.saveslot.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.saveslot.app.ui.theme.LocalSaveSlotColors

/** Small uppercase label above a heading, as in "ДОСЛІДЖЕННЯ". */
@Composable
fun Eyebrow(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
        modifier = modifier,
    )
}

/** Eyebrow plus title, with an optional trailing action. */
@Composable
fun SectionHeading(
    eyebrow: String,
    title: String,
    modifier: Modifier = Modifier,
    action: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Eyebrow(eyebrow)
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        action?.invoke()
    }
}

/** Rounded panel used for grouped content on the settings and detail screens. */
@Composable
fun ConsolePanel(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScopeAlias.() -> Unit,
) {
    val extraColors = LocalSaveSlotColors.current
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, extraColors.lineSoft, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

/** Alias so callers do not have to import Compose's ColumnScope for [ConsolePanel]. */
typealias ColumnScopeAlias = androidx.compose.foundation.layout.ColumnScope

/** Read-only pill, e.g. a year or genre on the detail screen. */
@Composable
fun Chip(
    text: String,
    modifier: Modifier = Modifier,
    accent: Boolean = false,
) {
    val extraColors = LocalSaveSlotColors.current
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = if (accent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(
                if (accent) MaterialTheme.colorScheme.primaryContainer else extraColors.plastic,
            )
            .padding(horizontal = 12.dp, vertical = 6.dp),
    )
}

/** Selectable pill, used for platform switching and collection tabs. */
@Composable
fun SelectablePill(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val extraColors = LocalSaveSlotColors.current
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = if (selected) MaterialTheme.colorScheme.onPrimary else extraColors.muted,
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(
                if (selected) MaterialTheme.colorScheme.primary else extraColors.plastic,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

/** Centred placeholder for an empty collection or notes list. */
@Composable
fun EmptyState(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
) {
    val extraColors = LocalSaveSlotColors.current
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center,
        )
        Text(
            text = description,
            style = MaterialTheme.typography.bodyMedium,
            color = extraColors.muted,
            textAlign = TextAlign.Center,
        )
    }
}

/** One-line progress or result message under a section heading. */
@Composable
fun InlineStatus(text: String, modifier: Modifier = Modifier) {
    if (text.isEmpty()) return
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = LocalSaveSlotColors.current.muted,
        modifier = modifier,
    )
}
