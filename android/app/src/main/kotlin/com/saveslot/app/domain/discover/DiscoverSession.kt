package com.saveslot.app.domain.discover

import com.saveslot.app.data.repository.GameRepository
import com.saveslot.app.data.repository.TaxonomyRepository
import com.saveslot.app.domain.model.Game
import kotlin.random.Random
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/**
 * Builds the "what shall we play today" rail.
 *
 * There is no games API to page through, so discovery works from a curated seed list of titles
 * shuffled per session and looked up in small batches. Two properties matter:
 *
 *  - **Different every session, stable within one.** The shuffle is seeded once, so scrolling back
 *    and forth does not reshuffle the rail, but reopening the app gives a fresh selection.
 *  - **Never a dead rail.** If lookups come up short — offline, or the seed titles are exhausted —
 *    the remainder is filled from the local cache rather than leaving the user an empty screen.
 *
 * A session is stateful (cursor, seen ids) and owned by the discover view model.
 */
class DiscoverSession(
    private val gameRepository: GameRepository,
    private val taxonomyRepository: TaxonomyRepository,
    private val seedTitles: List<String> = DiscoverSeeds.TITLES,
    seed: Int = Random.nextInt(),
) {

    private var random = Random(seed)
    private var order: List<String> = seedTitles.shuffled(random)
    private var cursor = 0
    private var cycle = 0
    private val seenIds = LinkedHashSet<String>()

    /** Marks games the user has already viewed so discovery does not re-suggest them. */
    fun excludeAll(gameIds: Collection<String>) {
        seenIds += gameIds
    }

    /**
     * Fetches the next batch of games.
     *
     * @param targetCount how many new games to add before returning.
     * @return newly found games, which may be fewer than [targetCount] when even the cache is dry.
     */
    suspend fun loadMore(targetCount: Int): List<Game> {
        val found = mutableListOf<Game>()
        var attempts = 0
        val maxAttempts = targetCount * ATTEMPTS_PER_TARGET

        while (found.size < targetCount && attempts < maxAttempts) {
            val batchTitles = nextTitles(BATCH_SIZE)
            if (batchTitles.isEmpty()) break
            attempts += batchTitles.size

            val batches = coroutineScope {
                batchTitles.map { title ->
                    async {
                        runCatching {
                            gameRepository.search(
                                query = title,
                                limit = 3,
                                useCache = true,
                                lightweight = true,
                            )
                        }.getOrDefault(emptyList())
                    }
                }.awaitAll()
            }

            for (results in batches) {
                // One game per seed title keeps the rail varied instead of showing three
                // near-identical entries for the same franchise.
                val game = results.firstOrNull { it.id !in seenIds } ?: continue
                seenIds += game.id
                found += game
            }
        }

        if (found.size < targetCount) {
            found += fillFromCache(targetCount - found.size)
        }

        taxonomyRepository.learnFrom(found)
        return found
    }

    /** Cached games as a last resort, so an offline launch still shows a populated rail. */
    private suspend fun fillFromCache(count: Int): List<Game> {
        if (count <= 0) return emptyList()
        val pool = gameRepository.cachedPool()
            .filter { it.id !in seenIds }
            .shuffled(random)
            .take(count)
        seenIds += pool.map { it.id }
        return pool
    }

    /**
     * Takes the next [count] seed titles, reshuffling with a derived seed when the list runs out so
     * a long scroll keeps producing a different order rather than repeating the first pass.
     */
    private fun nextTitles(count: Int): List<String> {
        if (cursor >= order.size) {
            cycle++
            cursor = 0
            random = Random(order.hashCode() + cycle * SHUFFLE_SALT)
            order = seedTitles.shuffled(random)
        }
        val slice = order.subList(cursor, minOf(cursor + count, order.size)).toList()
        cursor += slice.size
        return slice
    }

    private companion object {
        const val BATCH_SIZE = 4

        /** Most seed titles resolve, but allow several misses per requested game. */
        const val ATTEMPTS_PER_TARGET = 6

        /** Odd multiplier so successive cycles do not collide on the same shuffle. */
        const val SHUFFLE_SALT = 2654435761L.toInt()
    }
}
