package com.saveslot.app.domain.search

import com.saveslot.app.core.text.PlatformNames
import com.saveslot.app.core.text.normalizeLoose
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SearchFilters
import com.saveslot.app.domain.model.SortOrder
import java.text.Collator
import java.util.Locale

/**
 * Pure search-result policy shared by presentation code and tests.
 *
 * Keeping filtering and sorting out of the ViewModel makes the UI layer responsible only for
 * orchestration and state, while the domain layer owns the actual search behaviour.
 */
object SearchResultRefiner {

    fun refine(
        games: List<Game>,
        filters: SearchFilters,
        sortOrder: SortOrder,
    ): List<Game> {
        val normalized = filters.normalized()
        var filtered = games

        if (normalized.platform.isNotEmpty()) {
            filtered = filtered.filter {
                PlatformNames.listsMatch(it.platforms, normalized.platform)
            }
        }

        if (normalized.genre.isNotEmpty()) {
            val target = normalizeLoose(normalized.genre)
            filtered = filtered.filter { game ->
                game.genres.any { normalizeLoose(it) == target }
            }
        }

        val from = normalized.yearFrom.takeIf { it > 0 } ?: 0
        val to = normalized.yearTo.takeIf { it > 0 } ?: Int.MAX_VALUE
        filtered = filtered.filter { game ->
            val year = game.year
            when {
                year == null -> normalized.includeUnknownYear
                else -> year in from..to
            }
        }

        if (normalized.artworkOnly) {
            filtered = filtered.filter { it.displayCover != null }
        }

        return when (sortOrder) {
            SortOrder.Relevance -> filtered
            SortOrder.CoverFirst -> filtered.sortedWith(
                compareByDescending<Game> { it.displayCover != null }
                    .thenByDescending { it.year ?: 0 }
                    .thenBy { titleKey(it) },
            )
            SortOrder.NewestFirst -> filtered.sortedWith(
                compareByDescending<Game> { it.year ?: Int.MIN_VALUE }
                    .thenBy { titleKey(it) },
            )
            SortOrder.OldestFirst -> filtered.sortedWith(
                compareBy<Game> { it.year ?: Int.MAX_VALUE }
                    .thenBy { titleKey(it) },
            )
            SortOrder.Title -> filtered.sortedBy(::titleKey)
        }
    }

    /**
     * A lightweight title gate for structured-filter fallback results.
     *
     * It deliberately matches all query tokens instead of requiring an exact title, so aliases and
     * subtitles remain discoverable without admitting an unrelated SPARQL result merely because it
     * shares the selected platform or genre.
     */
    fun matchesQuery(game: Game, query: String): Boolean {
        val tokens = normalizeLoose(query)
            .split(' ')
            .filter { it.length >= 2 }
            .distinct()
        if (tokens.isEmpty()) return true

        val haystack = normalizeLoose(
            buildString {
                append(game.title)
                append(' ')
                append(game.originalTitle)
                append(' ')
                append(game.aliases.joinToString(" "))
                append(' ')
                append(game.series.joinToString(" "))
            },
        )
        return tokens.all(haystack::contains)
    }

    private fun titleKey(game: Game) = COLLATOR.getCollationKey(game.title)

    private val COLLATOR: Collator = Collator.getInstance(Locale.forLanguageTag("uk"))
}
