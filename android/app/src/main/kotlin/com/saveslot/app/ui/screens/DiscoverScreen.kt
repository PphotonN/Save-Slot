package com.saveslot.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.saveslot.app.domain.model.Game
import com.saveslot.app.ui.components.EmptyState
import com.saveslot.app.ui.components.GameCard
import com.saveslot.app.ui.components.InlineStatus
import com.saveslot.app.ui.components.LocalCartridgePreviews
import com.saveslot.app.ui.components.SectionHeading
import com.saveslot.app.ui.components.cardArtwork
import com.saveslot.app.ui.viewmodel.DiscoverViewModel

/**
 * The home screen: a rail of suggested games and one of recently opened ones.
 *
 * The suggestion rail pages as it is scrolled, so it behaves like an endless shelf rather than a
 * fixed list the user can exhaust.
 */
@Composable
fun DiscoverScreen(
    viewModel: DiscoverViewModel,
    onGameClick: (Game) -> Unit,
    header: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val recent by viewModel.recent.collectAsStateWithLifecycle()
    val railState = rememberLazyListState()

    // Prefetch the next batch a few cards before the end so scrolling never stalls.
    val shouldLoadMore by remember {
        derivedStateOf {
            val lastVisible = railState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            val total = railState.layoutInfo.totalItemsCount
            total > 0 && lastVisible >= total - PREFETCH_DISTANCE
        }
    }

    LaunchedEffect(railState) {
        snapshotFlow { shouldLoadMore }.collect { if (it) viewModel.loadMore() }
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "header") { header() }

        item(key = "discover-heading") {
            SectionHeading(
                eyebrow = "ДОСЛІДЖЕННЯ",
                title = "Що оберемо сьогодні?",
                modifier = Modifier.padding(horizontal = 16.dp),
                action = {
                    TextButton(onClick = { viewModel.refresh() }) {
                        Text("Інша добірка", style = MaterialTheme.typography.labelLarge)
                    }
                },
            )
        }

        item(key = "discover-status") {
            InlineStatus(uiState.status, modifier = Modifier.padding(horizontal = 16.dp))
        }

        if (uiState.games.isEmpty() && uiState.isLoading) {
            // Nothing to page through yet, so the spinner stands in for the whole rail rather than
            // sitting at its leading edge.
            item(key = "discover-loading") {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(RAIL_PLACEHOLDER_HEIGHT),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                }
            }
        } else {
            item(key = "discover-rail") {
                GameRail(
                    games = uiState.games,
                    listState = railState,
                    onGameClick = onGameClick,
                    trailing = if (uiState.isLoading) {
                        {
                            Box(
                                modifier = Modifier
                                    .height(RAIL_PLACEHOLDER_HEIGHT)
                                    .padding(horizontal = 28.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    } else {
                        null
                    },
                )
            }
        }

        if (recent.isNotEmpty()) {
            item(key = "recent-heading") {
                SectionHeading(
                    eyebrow = "ОСТАННІ",
                    title = "Продовжити дослідження",
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
            item(key = "recent-rail") {
                GameRail(games = recent, onGameClick = onGameClick, compact = true)
            }
        } else if (!uiState.isLoading && uiState.games.isEmpty()) {
            item(key = "discover-empty") {
                EmptyState(
                    title = "Каталог поки порожній",
                    description = "Перевір підключення до інтернету та спробуй оновити добірку.",
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }
    }
}

/**
 * A horizontally scrolling shelf of cartridges.
 *
 * Safe to nest inside a vertical list: the scroll axes differ, so neither container has to measure
 * the other's unbounded dimension.
 */
@Composable
internal fun GameRail(
    games: List<Game>,
    onGameClick: (Game) -> Unit,
    modifier: Modifier = Modifier,
    listState: LazyListState = rememberLazyListState(),
    compact: Boolean = false,
    trailing: (@Composable () -> Unit)? = null,
) {
    val previews = LocalCartridgePreviews.current
    LazyRow(
        state = listState,
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        items(games, key = { it.id }) { game ->
            GameCard(
                game = game,
                artwork = game.cardArtwork(),
                onClick = { onGameClick(game) },
                cartridgePreview = { key -> previews?.preview(key) },
                compact = compact,
            )
        }
        if (trailing != null) {
            item(key = "rail-trailing") { trailing() }
        }
    }
}

private const val PREFETCH_DISTANCE = 3

/** Roughly one card tall, so the rail does not jump in height when the first page lands. */
private val RAIL_PLACEHOLDER_HEIGHT = 236.dp
