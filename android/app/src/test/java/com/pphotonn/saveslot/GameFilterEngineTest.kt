package com.pphotonn.saveslot

import com.pphotonn.saveslot.model.Game
import com.pphotonn.saveslot.model.GameFilterEngine
import com.pphotonn.saveslot.model.SearchFilters
import com.pphotonn.saveslot.model.SortMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GameFilterEngineTest {
    private val games = listOf(
        Game("1", "Alpha", year = 1998, platforms = listOf("PlayStation"), genres = listOf("RPG"), relevance = 10.0, sourceOrder = 0),
        Game("2", "Beta", year = 2005, platforms = listOf("PC"), genres = listOf("Action"), relevance = 20.0, sourceOrder = 1),
        Game("3", "Gamma", year = 2001, platforms = listOf("PlayStation"), genres = listOf("Action"), relevance = 15.0, sourceOrder = 2),
    )

    @Test
    fun filteringAndSortingAreIndependent() {
        val filters = SearchFilters(platform = "PlayStation", sort = SortMode.YEAR_NEW)
        val result = GameFilterEngine.apply(games, filters, emptySet())
        assertEquals(listOf("Gamma", "Alpha"), result.map(Game::title))
    }

    @Test
    fun hidingSavedDoesNotMutateSourceOrder() {
        val result = GameFilterEngine.apply(
            games,
            SearchFilters(hideSaved = true, sort = SortMode.RELEVANCE),
            savedIds = setOf("2"),
        )
        assertEquals(listOf("Gamma", "Alpha"), result.map(Game::title))
        assertTrue(games.first { it.id == "2" }.sourceOrder == 1)
    }

    @Test
    fun randomSortIsStableForSeed() {
        val first = GameFilterEngine.apply(games, SearchFilters(sort = SortMode.RANDOM), emptySet(), randomSeed = 42)
        val second = GameFilterEngine.apply(games, SearchFilters(sort = SortMode.RANDOM), emptySet(), randomSeed = 42)
        assertEquals(first.map(Game::id), second.map(Game::id))
    }
}
