package com.saveslot.app.domain.model

/** Search refinements the user can apply on the search screen. */
data class SearchFilters(
    val platform: String = "",
    val genre: String = "",
    val yearFrom: Int = 0,
    val yearTo: Int = 0,
) {
    val isActive: Boolean
        get() = platform.isNotEmpty() || genre.isNotEmpty() || yearFrom > 0 || yearTo > 0

    /** Swaps reversed year bounds so a typo cannot produce an empty range. */
    fun normalized(): SearchFilters {
        val from = yearFrom.coerceIn(0, MAX_YEAR)
        val to = yearTo.coerceIn(0, MAX_YEAR)
        return if (from > 0 && to > 0 && from > to) copy(yearFrom = to, yearTo = from)
        else copy(yearFrom = from, yearTo = to)
    }

    companion object {
        const val MAX_YEAR = 2100
    }
}

enum class SortOrder {
    Relevance,
    NewestFirst,
    OldestFirst,
    Title,
}

/** Known platforms and genres, grown from every game the app has seen. */
data class Taxonomy(
    val platforms: List<String> = emptyList(),
    val genres: List<String> = emptyList(),
    val updatedAt: Long = 0L,
)

/** Liveness of an upstream data source, surfaced on the settings screen. */
enum class SourceStatus {
    Idle,
    Loading,
    Online,
    Error,
}

/** The data sources the app reports on. */
enum class DataSource(val key: String) {
    Wikidata("wikidata"),
    Wikipedia("wikipedia"),
    Libretro("libretro"),
    Steam("steam"),
    Gog("gog"),
    Vndb("vndb"),
    PcGamingWiki("pcgamingwiki"),
    Wikimedia("wikimedia"),
}

data class UserSettings(
    val haptics: Boolean = true,
    val reducedMotion: Boolean = false,
)
