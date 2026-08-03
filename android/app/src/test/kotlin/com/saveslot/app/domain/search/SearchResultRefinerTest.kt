package com.saveslot.app.domain.search

import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SearchFilters
import com.saveslot.app.domain.model.SortOrder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SearchResultRefinerTest {

    @Test
    fun `filters platform genre year and unknown dates consistently`() {
        val games = listOf(
            game("1", "Known", 2001, listOf("PlayStation 2"), listOf("рольова відеогра")),
            game("2", "Unknown", null, listOf("PlayStation 2"), listOf("рольова відеогра")),
            game("3", "Wrong platform", 2001, listOf("Windows"), listOf("рольова відеогра")),
        )

        val result = SearchResultRefiner.refine(
            games = games,
            filters = SearchFilters(
                platform = "PS2",
                genre = "рольова відеогра",
                yearFrom = 2000,
                yearTo = 2005,
                includeUnknownYear = false,
            ),
            sortOrder = SortOrder.Relevance,
        )

        assertEquals(listOf("Known"), result.map { it.title })
    }

    @Test
    fun `artwork-first sorting remains deterministic`() {
        val games = listOf(
            game("1", "Without", 2024),
            game("2", "With", 1998, provisionalCover = "https://example.test/cover.jpg"),
        )

        val result = SearchResultRefiner.refine(
            games = games,
            filters = SearchFilters(),
            sortOrder = SortOrder.CoverFirst,
        )

        assertEquals(listOf("With", "Without"), result.map { it.title })
    }

    @Test
    fun `structured fallback requires every query token`() {
        val game = game(
            id = "1",
            title = "The Legend of Zelda: Ocarina of Time",
            year = 1998,
        ).copy(aliases = listOf("Zelda 64"))

        assertTrue(SearchResultRefiner.matchesQuery(game, "zelda ocarina"))
        assertTrue(SearchResultRefiner.matchesQuery(game, "zelda 64"))
        assertFalse(SearchResultRefiner.matchesQuery(game, "zelda majora"))
    }

    private fun game(
        id: String,
        title: String,
        year: Int?,
        platforms: List<String> = emptyList(),
        genres: List<String> = emptyList(),
        provisionalCover: String? = null,
    ) = Game(
        id = id,
        title = title,
        year = year,
        platforms = platforms,
        genres = genres,
        provisionalCover = provisionalCover,
    )
}
