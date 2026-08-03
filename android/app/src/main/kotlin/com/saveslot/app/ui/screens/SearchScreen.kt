package com.saveslot.app.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SortOrder
import com.saveslot.app.ui.components.GameCard
import com.saveslot.app.ui.components.InlineStatus
import com.saveslot.app.ui.components.LocalCartridgePreviews
import com.saveslot.app.ui.components.SearchField
import com.saveslot.app.ui.components.SearchableDropdown
import com.saveslot.app.ui.components.SectionHeading
import com.saveslot.app.ui.components.SwitchRow
import com.saveslot.app.ui.components.cardArtwork
import com.saveslot.app.ui.viewmodel.SearchViewModel

/**
 * Global search with searchable platform and genre selectors, year bounds and local result policy.
 *
 * The whole screen is one grid, with the header and filters as full-width spans, so there is a
 * single scroll container and the search field scrolls away with the results.
 */
@Composable
fun SearchScreen(
    viewModel: SearchViewModel,
    onGameClick: (Game) -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val taxonomy by viewModel.taxonomy.collectAsStateWithLifecycle()
    val previews = LocalCartridgePreviews.current

    LazyVerticalGrid(
        columns = GridCells.Fixed(GRID_COLUMNS),
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }, key = "search-field") {
            SearchField(
                query = uiState.query,
                onQueryChange = viewModel::onQueryChange,
                onSubmit = viewModel::onQuerySubmit,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }

        item(span = { GridItemSpan(maxLineSpan) }, key = "heading") {
            SectionHeading(
                eyebrow = "ГЛОБАЛЬНИЙ ПОШУК",
                title = uiState.query.takeIf { it.isNotBlank() }?.let { "«$it»" } ?: "Результати",
                modifier = Modifier.padding(horizontal = 16.dp),
                action = {
                    TextButton(onClick = viewModel::toggleFilters) {
                        val count = uiState.filters.activeCount
                        Text(
                            text = when {
                                uiState.filtersExpanded -> "Сховати"
                                count > 0 -> "Фільтри ($count)"
                                else -> "Фільтри"
                            },
                            style = MaterialTheme.typography.labelLarge,
                        )
                    }
                },
            )
        }

        item(span = { GridItemSpan(maxLineSpan) }, key = "filters") {
            AnimatedVisibility(visible = uiState.filtersExpanded) {
                Column(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    SearchableDropdown(
                        label = "Платформа",
                        options = listOf("" to "Усі платформи") + taxonomy.platforms.map { it to it },
                        selected = uiState.filters.platform,
                        onSelect = { viewModel.onFiltersChange(uiState.filters.copy(platform = it)) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    SearchableDropdown(
                        label = "Жанр",
                        options = listOf("" to "Усі жанри") + taxonomy.genres.map { it to it },
                        selected = uiState.filters.genre,
                        onSelect = { viewModel.onFiltersChange(uiState.filters.copy(genre = it)) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        YearField(
                            label = "Рік від",
                            value = uiState.filters.yearFrom,
                            onValueChange = {
                                viewModel.onFiltersChange(uiState.filters.copy(yearFrom = it))
                            },
                            modifier = Modifier.weight(1f),
                        )
                        YearField(
                            label = "Рік до",
                            value = uiState.filters.yearTo,
                            onValueChange = {
                                viewModel.onFiltersChange(uiState.filters.copy(yearTo = it))
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    SwitchRow(
                        title = "Ігри без відомого року",
                        description = "Не приховувати записи, у яких джерела не вказали рік випуску.",
                        checked = uiState.filters.includeUnknownYear,
                        onCheckedChange = {
                            viewModel.onFiltersChange(uiState.filters.copy(includeUnknownYear = it))
                        },
                    )
                    SwitchRow(
                        title = "Лише з обкладинкою",
                        description = "Показувати результат після отримання перевіреної або попередньої обкладинки.",
                        checked = uiState.filters.artworkOnly,
                        onCheckedChange = {
                            viewModel.onFiltersChange(uiState.filters.copy(artworkOnly = it))
                        },
                    )
                    SearchableDropdown(
                        label = "Сортування",
                        options = SORT_OPTIONS,
                        selected = uiState.sortOrder.name,
                        onSelect = { viewModel.onSortOrderChange(SortOrder.valueOf(it)) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedButton(
                        onClick = viewModel::resetFilters,
                        enabled = uiState.filters.isActive || uiState.sortOrder != SortOrder.Relevance,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Скинути фільтри")
                    }
                }
            }
        }

        item(span = { GridItemSpan(maxLineSpan) }, key = "status") {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                if (uiState.isLoading) {
                    LinearProgressIndicator(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp),
                    )
                }
                InlineStatus(uiState.status)
            }
        }

        items(uiState.results, key = { it.id }) { game ->
            GameCard(
                game = game,
                artwork = game.cardArtwork(),
                onClick = { onGameClick(game) },
                cartridgePreview = { key -> previews?.preview(key) },
            )
        }
    }
}

@Composable
private fun YearField(
    label: String,
    value: Int,
    onValueChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value.takeIf { it > 0 }?.toString().orEmpty(),
        onValueChange = { raw ->
            onValueChange(raw.filter(Char::isDigit).take(4).toIntOrNull() ?: 0)
        },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = modifier,
    )
}

private val SORT_OPTIONS = listOf(
    SortOrder.Relevance.name to "Релевантність",
    SortOrder.CoverFirst.name to "Спочатку з обкладинкою",
    SortOrder.NewestFirst.name to "Спочатку нові",
    SortOrder.OldestFirst.name to "Спочатку старі",
    SortOrder.Title.name to "За назвою",
)

private const val GRID_COLUMNS = 2
