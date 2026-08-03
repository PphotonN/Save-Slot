package com.saveslot.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.NoteType
import com.saveslot.app.domain.model.NoteWithGame
import com.saveslot.app.ui.components.EmptyState
import com.saveslot.app.ui.components.SectionHeading
import com.saveslot.app.ui.theme.LocalSaveSlotColors
import com.saveslot.app.ui.util.formatDate
import com.saveslot.app.ui.viewmodel.LibraryViewModel

/** The journal: every note the user has written, newest first. */
@Composable
fun NotesScreen(
    viewModel: LibraryViewModel,
    onGameClick: (Game) -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
) {
    val notes by viewModel.notes.collectAsStateWithLifecycle()

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {

        item(key = "heading") {
            SectionHeading(
                eyebrow = "ОСОБИСТИЙ ЖУРНАЛ",
                title = "Нотатки",
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }

        if (notes.isEmpty()) {
            item(key = "empty") {
                EmptyState(
                    title = "Нотаток поки немає",
                    description = "Додай враження, технічну примітку або замітку про проходження " +
                        "на сторінці гри.",
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        } else {
            items(notes, key = { it.note.id }) { entry ->
                NoteCard(
                    entry = entry,
                    onClick = { onGameClick(entry.game) },
                    onDelete = { viewModel.deleteNote(entry.note.id) },
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
    }
}

@Composable
private fun NoteCard(
    entry: NoteWithGame,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val extraColors = LocalSaveSlotColors.current
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = entry.note.type.displayName(),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = formatDate(entry.note.updatedAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = extraColors.muted,
                )
                IconButton(onClick = onDelete) {
                    Icon(
                        imageVector = Icons.Filled.DeleteOutline,
                        contentDescription = "Видалити нотатку",
                        tint = extraColors.muted,
                    )
                }
            }
        }
        Text(
            text = entry.note.title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = entry.note.body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = entry.game.title,
            style = MaterialTheme.typography.labelSmall,
            color = extraColors.muted,
        )
    }
}

internal fun NoteType.displayName(): String = when (this) {
    NoteType.Impression -> "ВРАЖЕННЯ"
    NoteType.Walkthrough -> "ПРОХОДЖЕННЯ"
    NoteType.Technical -> "ТЕХНІЧНА"
    NoteType.Translation -> "ПЕРЕКЛАД / МОД"
    NoteType.CopyCondition -> "СТАН КОПІЇ"
}
