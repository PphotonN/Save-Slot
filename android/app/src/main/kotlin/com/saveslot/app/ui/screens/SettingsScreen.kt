package com.saveslot.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.saveslot.app.domain.model.DataSource
import com.saveslot.app.domain.model.SourceStatus
import com.saveslot.app.ui.components.ConsolePanel
import com.saveslot.app.ui.components.Eyebrow
import com.saveslot.app.ui.components.SectionHeading
import com.saveslot.app.ui.components.SwitchRow
import com.saveslot.app.ui.theme.LocalSaveSlotColors
import com.saveslot.app.ui.util.formatBytes
import com.saveslot.app.ui.util.formatDateTime
import com.saveslot.app.ui.viewmodel.SettingsViewModel

/** System screen: data-source health, slot feel, and local storage controls. */
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel,
    onTestHaptics: () -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var confirmingWipe by remember { mutableStateOf(false) }
    val extraColors = LocalSaveSlotColors.current

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {

        item(key = "heading") {
            SectionHeading(
                eyebrow = "СИСТЕМА",
                title = "Налаштування",
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }

        item(key = "sources") {
            ConsolePanel(modifier = Modifier.padding(horizontal = 16.dp)) {
                Eyebrow("ДЖЕРЕЛА ДАНИХ")
                DataSource.entries.forEach { source ->
                    SourceRow(
                        title = source.displayName(),
                        description = source.description(),
                        status = uiState.sources[source] ?: SourceStatus.Idle,
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "Останнє оновлення",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = uiState.lastUpdate.takeIf { it > 0 }?.let(::formatDateTime)
                            ?: "Ще не виконувалось",
                        style = MaterialTheme.typography.bodySmall,
                        color = extraColors.muted,
                    )
                }
            }
        }

        item(key = "feel") {
            ConsolePanel(modifier = Modifier.padding(horizontal = 16.dp)) {
                Eyebrow("ВІДЧУТТЯ СЛОТА")
                SwitchRow(
                    title = "Тактильний відгук",
                    description = "Два короткі кліки під час вставляння та один під час витягання",
                    checked = uiState.settings.haptics,
                    onCheckedChange = viewModel::setHaptics,
                    enabled = uiState.hasVibrator,
                )
                if (!uiState.hasVibrator) {
                    Text(
                        text = "Цей пристрій не має вібромотора.",
                        style = MaterialTheme.typography.bodySmall,
                        color = extraColors.muted,
                    )
                }
                SwitchRow(
                    title = "Скорочені анімації",
                    description = "Менше руху під час швидкого перегляду",
                    checked = uiState.settings.reducedMotion,
                    onCheckedChange = viewModel::setReducedMotion,
                )
                OutlinedButton(
                    onClick = onTestHaptics,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = uiState.hasVibrator,
                ) {
                    Text("Перевірити хаптік-відгук")
                }
            }
        }

        item(key = "storage") {
            ConsolePanel(modifier = Modifier.padding(horizontal = 16.dp)) {
                Eyebrow("ЛОКАЛЬНІ ДАНІ")
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "Кеш метаданих",
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = formatBytes(uiState.cacheSizeBytes),
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                OutlinedButton(
                    onClick = viewModel::clearCache,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Очистити кеш метаданих")
                }
                Text(
                    text = "Колекція й нотатки під час очищення кешу не видаляються.",
                    style = MaterialTheme.typography.bodySmall,
                    color = extraColors.muted,
                )
                Button(
                    onClick = { confirmingWipe = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = extraColors.danger,
                        contentColor = MaterialTheme.colorScheme.onError,
                    ),
                ) {
                    Text("Видалити колекцію та нотатки")
                }
            }
        }

        item(key = "about") {
            ConsolePanel(modifier = Modifier.padding(horizontal = 16.dp)) {
                Text(
                    text = "Save Slot — нативна збірка",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = "Єдина база знань про ігри, особиста колекція та нотатник.",
                    style = MaterialTheme.typography.bodySmall,
                    color = extraColors.muted,
                )
            }
        }
    }

    if (confirmingWipe) {
        AlertDialog(
            onDismissRequest = { confirmingWipe = false },
            title = { Text("Видалити особисті дані?") },
            text = {
                Text("Колекція, нотатки та історія перегляду будуть видалені. Цю дію неможливо скасувати.")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirmingWipe = false
                        viewModel.clearPersonalData()
                    },
                ) {
                    Text("Видалити", color = extraColors.danger)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmingWipe = false }) { Text("Скасувати") }
            },
        )
    }
}

@Composable
private fun SourceRow(
    title: String,
    description: String,
    status: SourceStatus,
) {
    val extraColors = LocalSaveSlotColors.current
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(end = 12.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = extraColors.muted,
            )
        }
        Text(
            text = status.label(),
            style = MaterialTheme.typography.labelSmall,
            color = when (status) {
                SourceStatus.Online -> extraColors.online
                SourceStatus.Error -> extraColors.danger
                else -> extraColors.muted
            },
        )
    }
}

private fun SourceStatus.label(): String = when (this) {
    SourceStatus.Idle -> "—"
    SourceStatus.Loading -> "ПЕРЕВІРКА"
    SourceStatus.Online -> "ПРАЦЮЄ"
    SourceStatus.Error -> "ПОМИЛКА"
}

private fun DataSource.displayName(): String = when (this) {
    DataSource.Wikidata -> "Wikidata"
    DataSource.Wikipedia -> "Wikipedia"
    DataSource.Libretro -> "Libretro Thumbnails"
    DataSource.Steam -> "Steam"
    DataSource.Gog -> "GOG"
    DataSource.Vndb -> "VNDB"
    DataSource.PcGamingWiki -> "PCGamingWiki"
    DataSource.Wikimedia -> "Wikimedia"
}

private fun DataSource.description(): String = when (this) {
    DataSource.Wikidata -> "Назви, платформи, роки, розробники та зв’язки"
    DataSource.Wikipedia -> "Описи й сторінки ігор"
    DataSource.Libretro -> "Платформні обкладинки та ігрові скріншоти консольних релізів"
    DataSource.Steam -> "Пошук ПК-релізів за назвою, обкладинки та скріншоти"
    DataSource.Gog -> "Додаткові вертикальні обкладинки ПК-релізів"
    DataSource.Vndb -> "Обкладинки та скріншоти візуальних новел"
    DataSource.PcGamingWiki -> "Резервні обкладинки ПК-ігор"
    DataSource.Wikimedia -> "Резервні офіційні зображення"
}
