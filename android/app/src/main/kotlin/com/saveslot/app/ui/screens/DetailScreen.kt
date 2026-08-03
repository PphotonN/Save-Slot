package com.saveslot.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.saveslot.app.domain.model.CollectionEntry
import com.saveslot.app.domain.model.CopyFormat
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.NoteType
import com.saveslot.app.domain.model.PlayStatus
import com.saveslot.app.ui.components.Chip
import com.saveslot.app.ui.components.ConsolePanel
import com.saveslot.app.ui.components.Dropdown
import com.saveslot.app.ui.components.Eyebrow
import com.saveslot.app.ui.components.InlineStatus
import com.saveslot.app.ui.components.SelectablePill
import com.saveslot.app.ui.components.SwitchRow
import com.saveslot.app.ui.theme.LocalSaveSlotColors
import com.saveslot.app.ui.util.formatDate
import com.saveslot.app.ui.viewmodel.CoverStatus
import com.saveslot.app.ui.viewmodel.DetailUiState
import com.saveslot.app.ui.viewmodel.DetailViewModel

/**
 * One game's page: artwork, facts, screenshots, the user's own record and their notes.
 *
 * Editing the collection entry uses local form state seeded from the saved entry, so the user can
 * change several fields and commit them together rather than writing on every keystroke.
 */
@Composable
fun DetailScreen(
    viewModel: DetailViewModel,
    header: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val game = uiState.game

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item(key = "header") { header() }

        if (game == null) {
            item(key = "loading") {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    } else {
                        Text(
                            text = uiState.message ?: "Гру не знайдено.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = LocalSaveSlotColors.current.muted,
                        )
                    }
                }
            }
            return@LazyColumn
        }

        item(key = "hero") { DetailHero(game = game, uiState = uiState) }

        if (game.platforms.size > 1) {
            item(key = "platforms") {
                Column(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Eyebrow("ВЕРСІЯ ГРИ")
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(game.platforms, key = { it }) { platform ->
                            SelectablePill(
                                text = platform,
                                selected = platform == game.activePlatform,
                                onClick = { viewModel.selectPlatform(platform) },
                            )
                        }
                    }
                }
            }
        }

        item(key = "actions") {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Button(onClick = viewModel::toggleCollection, modifier = Modifier.weight(1f)) {
                    Text(if (uiState.isInCollection) "У колекції ✓" else "Додати до колекції")
                }
                OutlinedButton(onClick = viewModel::toggleFavorite) {
                    Text(if (uiState.entry?.favorite == true) "★" else "☆")
                }
            }
        }

        item(key = "about") {
            ConsolePanel(modifier = Modifier.padding(horizontal = 16.dp)) {
                Eyebrow("ПРО ГРУ")
                Text(
                    text = game.description.ifBlank {
                        "Докладний опис поки відсутній. Гру все одно можна додати до колекції " +
                            "та доповнити власними нотатками."
                    },
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }

        item(key = "dossier") {
            ConsolePanel(modifier = Modifier.padding(horizontal = 16.dp)) {
                Eyebrow("ДОСЬЄ")
                FactRow("Розробник", game.developers)
                FactRow("Видавець", game.publishers)
                FactRow("Серія", game.series)
                FactRow("Платформи", game.platforms)
            }
        }

        item(key = "gallery") {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Eyebrow("ЯК ГРА ВИГЛЯДАЄ", modifier = Modifier.padding(horizontal = 16.dp))
                if (game.screenshots.isNotEmpty()) {
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(game.screenshots, key = { it }) { url ->
                            AsyncImage(
                                model = url,
                                contentDescription = "Скріншот з ${game.title}",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .width(260.dp)
                                    .aspectRatio(16f / 9f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(LocalSaveSlotColors.current.plastic),
                            )
                        }
                    }
                }
                InlineStatus(
                    text = uiState.screenshotStatus,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }

        item(key = "entry-editor") {
            CollectionEditor(
                entry = uiState.entry,
                defaultPlatform = game.activePlatform,
                onSave = viewModel::saveEntry,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }

        item(key = "note-editor") {
            NoteEditor(
                onSave = viewModel::addNote,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }

        val notes = uiState.entry?.notes.orEmpty()
        if (notes.isNotEmpty()) {
            item(key = "notes-heading") {
                Eyebrow("НОТАТКИ ПРО ЦЮ ГРУ", modifier = Modifier.padding(horizontal = 16.dp))
            }
            items(notes, key = { it.id }) { note ->
                ConsolePanel(modifier = Modifier.padding(horizontal = 16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = note.type.displayName(),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            text = formatDate(note.updatedAt),
                            style = MaterialTheme.typography.labelSmall,
                            color = LocalSaveSlotColors.current.muted,
                        )
                    }
                    Text(
                        text = note.title,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = note.body,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    OutlinedButton(onClick = { viewModel.deleteNote(note.id) }) {
                        Text("Видалити")
                    }
                }
            }
        }
    }
}

@Composable
private fun DetailHero(game: Game, uiState: DetailUiState) {
    val extraColors = LocalSaveSlotColors.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Eyebrow(game.activePlatform.ifEmpty { "VIDEO GAME" })
        Text(
            text = game.title,
            style = MaterialTheme.typography.displaySmall,
            color = MaterialTheme.colorScheme.onSurface,
        )
        if (game.originalTitle.isNotBlank() && game.originalTitle != game.title) {
            Text(
                text = game.originalTitle,
                style = MaterialTheme.typography.bodyMedium,
                color = extraColors.muted,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            game.year?.let { Chip(text = it.toString(), accent = true) }
            game.genres.take(2).forEach { Chip(text = it) }
        }
        when (uiState.coverStatus) {
            CoverStatus.Searching -> InlineStatus("Шукаю обкладинку…")
            CoverStatus.Provisional -> InlineStatus("Показано резервне зображення")
            CoverStatus.Missing -> InlineStatus("Обкладинку не знайдено")
            CoverStatus.Ready -> Unit
        }
    }
}

@Composable
private fun FactRow(label: String, values: List<String>) {
    val extraColors = LocalSaveSlotColors.current
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = extraColors.muted,
        )
        Text(
            text = values.takeIf { it.isNotEmpty() }?.joinToString(", ") ?: "Немає даних",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

/**
 * Form for the user's own copy: status, format, platform played on, rating, ownership.
 *
 * The fields are re-seeded whenever the saved entry changes, so switching games or discarding an
 * edit does not leave the previous game's values on screen.
 */
@Composable
private fun CollectionEditor(
    entry: CollectionEntry?,
    defaultPlatform: String,
    onSave: (PlayStatus, CopyFormat, String, Double?, Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    var status by remember(entry?.game?.id) { mutableStateOf(entry?.status ?: PlayStatus.Planned) }
    var format by remember(entry?.game?.id) { mutableStateOf(entry?.format ?: CopyFormat.Unknown) }
    var playedOn by rememberSaveable(entry?.game?.id) {
        mutableStateOf(entry?.playedOn?.ifEmpty { defaultPlatform } ?: defaultPlatform)
    }
    var rating by rememberSaveable(entry?.game?.id) {
        mutableStateOf(entry?.rating?.toString().orEmpty())
    }
    var owned by remember(entry?.game?.id) { mutableStateOf(entry?.owned ?: false) }

    LaunchedEffect(entry) {
        entry?.let {
            status = it.status
            format = it.format
            playedOn = it.playedOn.ifEmpty { defaultPlatform }
            rating = it.rating?.toString().orEmpty()
            owned = it.owned
        }
    }

    ConsolePanel(modifier = modifier) {
        Eyebrow("МОЯ КОПІЯ ТА ПРОХОДЖЕННЯ")
        Dropdown(
            label = "Статус",
            options = STATUS_OPTIONS,
            selected = status.storageKey,
            onSelect = { status = PlayStatus.fromKey(it) },
        )
        Dropdown(
            label = "Формат",
            options = FORMAT_OPTIONS,
            selected = format.storageKey,
            onSelect = { format = CopyFormat.fromKey(it) },
        )
        OutlinedTextField(
            value = playedOn,
            onValueChange = { playedOn = it },
            label = { Text("Платформа, на якій граю") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = rating,
            onValueChange = { input ->
                // Ratings are 0–10 with an optional half point; reject anything else as typed.
                if (input.isEmpty() || RATING_PATTERN.matches(input)) rating = input
            },
            label = { Text("Особиста оцінка (0–10)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        SwitchRow(
            title = "Маю цю гру",
            description = "Фізична або цифрова копія",
            checked = owned,
            onCheckedChange = { owned = it },
        )
        Button(
            onClick = {
                onSave(status, format, playedOn, rating.toDoubleOrNull()?.coerceIn(0.0, 10.0), owned)
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Зберегти дані колекції")
        }
    }
}

@Composable
private fun NoteEditor(
    onSave: (NoteType, String, String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var type by remember { mutableStateOf(NoteType.Impression) }
    var title by rememberSaveable { mutableStateOf("Враження") }
    var body by rememberSaveable { mutableStateOf("") }

    ConsolePanel(modifier = modifier) {
        Eyebrow("НОВА НОТАТКА")
        Dropdown(
            label = "Тип",
            options = NOTE_TYPE_OPTIONS,
            selected = type.storageKey,
            onSelect = { type = NoteType.fromKey(it) },
        )
        OutlinedTextField(
            value = title,
            onValueChange = { if (it.length <= MAX_NOTE_TITLE) title = it },
            label = { Text("Назва") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = body,
            onValueChange = { body = it },
            label = { Text("Що варто запам’ятати про цю гру?") },
            minLines = 3,
            modifier = Modifier.fillMaxWidth(),
        )
        Button(
            onClick = {
                onSave(type, title, body)
                body = ""
            },
            enabled = body.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Зберегти нотатку")
        }
    }
}

private val STATUS_OPTIONS = listOf(
    PlayStatus.Planned.storageKey to "Планую",
    PlayStatus.Playing.storageKey to "Граю",
    PlayStatus.Completed.storageKey to "Пройдено",
    PlayStatus.CompletedFully.storageKey to "Завершено на 100%",
    PlayStatus.Paused.storageKey to "Відкладено",
    PlayStatus.Dropped.storageKey to "Покинуто",
    PlayStatus.Replaying.storageKey to "Перепроходжу",
)

private val FORMAT_OPTIONS = listOf(
    CopyFormat.Unknown.storageKey to "Не вказано",
    CopyFormat.Physical.storageKey to "Фізична копія",
    CopyFormat.Digital.storageKey to "Цифрова копія",
    CopyFormat.Cartridge.storageKey to "Картридж",
    CopyFormat.Disc.storageKey to "Диск",
    CopyFormat.Collector.storageKey to "Колекційне видання",
    CopyFormat.Backup.storageKey to "Резервна копія",
)

private val NOTE_TYPE_OPTIONS = listOf(
    NoteType.Impression.storageKey to "Враження",
    NoteType.Walkthrough.storageKey to "Проходження",
    NoteType.Technical.storageKey to "Технічна",
    NoteType.Translation.storageKey to "Переклад або мод",
    NoteType.CopyCondition.storageKey to "Стан копії",
)

private val RATING_PATTERN = Regex("^(10|\\d)(\\.[05])?$")

private const val MAX_NOTE_TITLE = 80
