package com.pphotonn.saveslot.model

data class Game(
    val id: String,
    val title: String,
    val description: String = "",
    val year: Int? = null,
    val platforms: List<String> = emptyList(),
    val genres: List<String> = emptyList(),
    val coverUrl: String? = null,
    val source: GameSource = GameSource.WIKIDATA,
    val sourceOrder: Int = Int.MAX_VALUE,
    val relevance: Double = 0.0,
    val ratingPercent: Int? = null,
    val ratingCount: Int? = null,
    val steamAppId: String? = null,
)

enum class GameSource(val label: String) {
    WIKIDATA("Wikidata"),
    RAWG("RAWG"),
    LOCAL_FALLBACK("Резерв")
}

data class SearchFilters(
    val platform: String? = null,
    val genre: String? = null,
    val yearFrom: Int = 1970,
    val yearTo: Int = 2035,
    val sort: SortMode = SortMode.RELEVANCE,
    val hideSaved: Boolean = false,
)

enum class SortMode(val label: String) {
    RELEVANCE("Точність"),
    RATING("Рейтинг"),
    REVIEWS("Кількість відгуків"),
    YEAR_NEW("Новіші"),
    YEAR_OLD("Старіші"),
    TITLE("Назва"),
    RANDOM("Випадково")
}

data class AppSettings(
    val useWikidata: Boolean = true,
    val useSteamRatings: Boolean = true,
    val rawgApiKey: String = "",
    val reducedMotion: Boolean = false,
)

data class LibraryEntry(
    val game: Game,
    val collection: String = "Основний список",
    val status: PlayStatus = PlayStatus.PLANNED,
    val priority: Int = 3,
    val personalRating: Int? = null,
    val notes: String = "",
    val addedAt: Long = System.currentTimeMillis(),
)

enum class PlayStatus(val label: String) {
    PLANNED("Заплановано"),
    PLAYING("Граю"),
    COMPLETED("Пройдено"),
    MASTERED("100%"),
    PAUSED("Відкладено"),
    DROPPED("Покинуто")
}

data class SourceHealth(
    val name: String,
    val state: HealthState,
    val message: String,
)

enum class HealthState { IDLE, LOADING, READY, ERROR }

data class SearchResponse(
    val games: List<Game>,
    val health: List<SourceHealth>,
    val fromCache: Boolean,
)

object GameFilterEngine {
    fun apply(
        games: List<Game>,
        filters: SearchFilters,
        savedIds: Set<String>,
        randomSeed: Int = 0,
    ): List<Game> {
        val visible = games.filter { game ->
            val platformMatches = filters.platform.isNullOrBlank() ||
                game.platforms.any { it.equals(filters.platform, ignoreCase = true) }
            val genreMatches = filters.genre.isNullOrBlank() ||
                game.genres.any { it.equals(filters.genre, ignoreCase = true) }
            val yearMatches = game.year == null || game.year in filters.yearFrom..filters.yearTo
            val savedMatches = !filters.hideSaved || game.id !in savedIds
            platformMatches && genreMatches && yearMatches && savedMatches
        }

        return when (filters.sort) {
            SortMode.RELEVANCE -> visible.sortedWith(
                compareByDescending<Game> { it.relevance }.thenBy { it.sourceOrder }
            )
            SortMode.RATING -> visible.sortedWith(
                compareByDescending<Game> { it.ratingPercent ?: -1 }.thenBy { it.sourceOrder }
            )
            SortMode.REVIEWS -> visible.sortedWith(
                compareByDescending<Game> { it.ratingCount ?: -1 }.thenBy { it.sourceOrder }
            )
            SortMode.YEAR_NEW -> visible.sortedWith(
                compareByDescending<Game> { it.year ?: Int.MIN_VALUE }.thenBy { it.sourceOrder }
            )
            SortMode.YEAR_OLD -> visible.sortedWith(
                compareBy<Game> { it.year ?: Int.MAX_VALUE }.thenBy { it.sourceOrder }
            )
            SortMode.TITLE -> visible.sortedBy { it.title.lowercase() }
            SortMode.RANDOM -> visible.sortedBy { stableRandomKey(it.id, randomSeed) }
        }
    }

    private fun stableRandomKey(value: String, seed: Int): Int {
        var hash = seed xor 0x45D9F3B
        value.forEach { hash = (hash * 31) xor it.code }
        return hash
    }
}
