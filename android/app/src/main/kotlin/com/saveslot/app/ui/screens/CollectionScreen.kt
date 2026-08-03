package com.saveslot.app.ui.screens

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.saveslot.app.domain.model.CollectionFilter
import com.saveslot.app.domain.model.Game
import com.saveslot.app.ui.components.EmptyState
import com.saveslot.app.ui.components.GameCard
import com.saveslot.app.ui.components.LocalCartridgePreviews
import com.saveslot.app.ui.components.SectionHeading
import com.saveslot.app.ui.components.SelectablePill
import com.saveslot.app.ui.components.cardArtwork
import com.saveslot.app.ui.viewmodel.LibraryViewModel

/** The personal archive, filterable by play status and ownership. */
@Composable
fun CollectionScreen(
    viewModel: LibraryViewModel,
    onGameClick: (Game) -> Unit,
    header: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
) {
    val entries by viewModel.entries.collectAsStateWithLifecycle()
    val filter by viewModel.filter.collectAsStateWithLifecycle()
    val previews = LocalCartridgePreviews.current

    LazyVerticalGrid(
        columns = GridCells.Fixed(GRID_COLUMNS),
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }, key = "header") { header() }

        item(span = { GridItemSpan(maxLineSpan) }, key = "heading") {
            SectionHeading(
                eyebrow = "ОСОБИСТИЙ АРХІВ",
                title = "Колекція",
                modifier = Modifier.padding(horizontal = 16.dp),
            )
        }

        item(span = { GridItemSpan(maxLineSpan) }, key = "filters") {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FILTER_LABELS.forEach { (value, label) ->
                    SelectablePill(
                        text = label,
                        selected = filter == value,
                        onClick = { viewModel.setFilter(value) },
                    )
                }
            }
        }

        if (entries.isEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }, key = "empty") {
                EmptyState(
                    title = "Колекція ще порожня",
                    description = "Відкрий гру й натисни «Додати до колекції».",
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        } else {
            items(entries, key = { it.game.id }) { entry ->
                GameCard(
                    game = entry.game,
                    artwork = entry.game.cardArtwork(),
                    onClick = { onGameClick(entry.game) },
                    cartridgePreview = { key -> previews?.preview(key) },
                )
            }
        }
    }
}

private val FILTER_LABELS = listOf(
    CollectionFilter.All to "Усе",
    CollectionFilter.Playing to "Граю",
    CollectionFilter.Planned to "Планую",
    CollectionFilter.Completed to "Пройдено",
    CollectionFilter.Owned to "Маю",
)

private const val GRID_COLUMNS = 2
