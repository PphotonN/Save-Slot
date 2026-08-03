package com.saveslot.app.data.repository

import com.saveslot.app.data.local.TaxonomyDao
import com.saveslot.app.data.local.TaxonomyTermEntity
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.Taxonomy
import kotlinx.coroutines.Dispatchers
import java.text.Collator
import java.util.Locale
import kotlin.time.Clock
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext

/**
 * The platform and genre vocabulary offered in the search filters.
 *
 * It starts from a curated seed list so the filters are useful on first launch with no network,
 * then grows with every game the app sees, so filters reflect the user's actual library over time.
 */
class TaxonomyRepository(
    private val taxonomyDao: TaxonomyDao,
    private val clock: Clock = Clock.System,
) {

    val taxonomy: Flow<Taxonomy> = combine(
        taxonomyDao.observe(TaxonomyTermEntity.KIND_PLATFORM),
        taxonomyDao.observe(TaxonomyTermEntity.KIND_GENRE),
    ) { platformRows, genreRows ->
        Taxonomy(
            platforms = merge(DEFAULT_PLATFORMS, platformRows.map { it.value }),
            genres = merge(DEFAULT_GENRES, genreRows.map { it.value }),
            updatedAt = (platformRows + genreRows).maxOfOrNull { it.updatedAt } ?: 0L,
        )
    }
        // Collation-sorting a few hundred terms is re-run every time a search teaches the app a new
        // platform or genre, which is often; it must not happen on the collector's (main) thread.
        .flowOn(Dispatchers.Default)
        .conflate()

    /** Adds any new platforms and genres seen in [games] to the vocabulary. */
    suspend fun learnFrom(games: List<Game>) {
        if (games.isEmpty()) return
        // Called after every search and every discovery batch, from viewModelScope; building a few
        // hundred rows belongs off the main thread.
        withContext(Dispatchers.Default) {
            val now = clock.now().toEpochMilliseconds()
            val terms = games.flatMap { game ->
                game.platforms.map { TaxonomyTermEntity(TaxonomyTermEntity.KIND_PLATFORM, it, now) } +
                    game.genres.map { TaxonomyTermEntity(TaxonomyTermEntity.KIND_GENRE, it, now) }
            }.distinctBy { it.kind to it.value }
            if (terms.isNotEmpty()) taxonomyDao.upsert(terms)
        }
    }

    private companion object {
        /** Ukrainian collation, so "Ї" and "І" sort where a Ukrainian reader expects. */
        val COLLATOR: Collator = Collator.getInstance(Locale.forLanguageTag("uk"))

        fun merge(seed: List<String>, learned: List<String>): List<String> =
            (seed + learned).distinct().sortedWith(COLLATOR)

        val DEFAULT_PLATFORMS = listOf(
            "Nintendo Entertainment System", "Super Nintendo Entertainment System", "Nintendo 64",
            "Nintendo GameCube", "Wii", "Wii U", "Nintendo Switch",
            "Game Boy", "Game Boy Color", "Game Boy Advance", "Nintendo DS", "Nintendo 3DS", "Virtual Boy",
            "PlayStation", "PlayStation 2", "PlayStation 3", "PlayStation 4", "PlayStation 5",
            "PlayStation Portable", "PlayStation Vita",
            "Xbox", "Xbox 360", "Xbox One", "Xbox Series X/S",
            "Sega Master System", "Mega Drive", "Sega Genesis", "Sega Saturn", "Dreamcast", "Game Gear",
            "PC Engine", "TurboGrafx-16", "Neo Geo", "Neo Geo Pocket Color",
            "Atari 2600", "Atari 7800", "Atari Lynx", "Jaguar",
            "Windows", "Linux", "macOS", "DOS", "Amiga", "Commodore 64", "ZX Spectrum", "MSX", "Arcade",
        )

        val DEFAULT_GENRES = listOf(
            "пригодницький бойовик", "рольова відеогра", "японська рольова гра", "екшн",
            "пригодницька гра", "платформер", "метроїдванія", "шутер від першої особи",
            "шутер від третьої особи", "тактичний шутер", "стелс", "виживання", "survival horror",
            "психологічний хорор", "головоломка", "стратегія", "стратегія в реальному часі",
            "покрокова стратегія", "тактична рольова гра", "симулятор", "автосимулятор", "перегони",
            "файтинг", "beat ’em up", "hack and slash", "ритм-гра", "візуальна новела",
            "інтерактивне кіно", "пісочниця", "відкритий світ", "roguelike", "roguelite",
            "карткова гра", "настільна гра", "спортивна гра", "MMORPG", "MOBA",
        )
    }
}
