package com.saveslot.app.data.remote.media

import kotlin.time.Clock
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withTimeout

/**
 * Runs artwork providers with per-provider timeouts, failure cooldowns and tiered fan-out.
 *
 * Artwork lookup is a best-effort race against eight third-party services of wildly varying
 * reliability. Two behaviours matter:
 *
 *  - **Tiers.** Providers in the same tier run concurrently and the first acceptable answer in
 *    tier order wins; later tiers only run if the earlier ones came up empty. That keeps the fast,
 *    high-quality sources (Libretro, storefronts) ahead of the slow scraping fallbacks without
 *    serialising everything.
 *  - **Cooldowns.** A provider that fails twice in a row is benched for a while, so one dead host
 *    cannot keep costing every subsequent lookup its full timeout.
 */
class ProviderChain(private val clock: Clock = Clock.System) {

    private val health = mutableMapOf<String, Health>()
    private val lock = Any()

    private data class Health(
        var successes: Int = 0,
        var failures: Int = 0,
        var consecutiveFailures: Int = 0,
        var latencyMillis: Double = 900.0,
        var cooldownUntil: Long = 0L,
    )

    private fun healthOf(id: String): Health = synchronized(lock) { health.getOrPut(id) { Health() } }

    fun isAvailable(id: String): Boolean =
        healthOf(id).let { it.cooldownUntil <= clock.now().toEpochMilliseconds() }

    private fun record(id: String, outcome: Outcome, elapsedMillis: Long) {
        val entry = healthOf(id)
        synchronized(lock) {
            entry.latencyMillis = entry.latencyMillis * 0.72 + elapsedMillis * 0.28
            when (outcome) {
                Outcome.Success -> {
                    entry.successes++
                    entry.consecutiveFailures = 0
                    entry.cooldownUntil = 0L
                }
                // A clean "nothing here" is not a fault: many providers simply do not carry a
                // given game, and benching them for that would lose real hits later.
                Outcome.Miss -> Unit
                Outcome.Timeout, Outcome.Error -> {
                    entry.failures++
                    entry.consecutiveFailures++
                    if (entry.consecutiveFailures >= 2) {
                        val multiplier = minOf(4, entry.consecutiveFailures - 1)
                        entry.cooldownUntil =
                            clock.now().toEpochMilliseconds() + COOLDOWN_BASE_MS * multiplier
                    }
                }
            }
        }
    }

    private enum class Outcome { Success, Miss, Timeout, Error }

    /** Runs one provider under its own timeout, returning [fallback] on timeout or failure. */
    private suspend fun <T> execute(
        id: String,
        timeoutMillis: Long,
        fallback: T,
        accept: (T) -> Boolean,
        block: suspend () -> T,
    ): T {
        if (!isAvailable(id)) return fallback
        val started = clock.now().toEpochMilliseconds()
        return try {
            val value = withTimeout(timeoutMillis) { block() }
            val outcome = if (accept(value)) Outcome.Success else Outcome.Miss
            record(id, outcome, clock.now().toEpochMilliseconds() - started)
            value
        } catch (timeout: TimeoutCancellationException) {
            record(id, Outcome.Timeout, clock.now().toEpochMilliseconds() - started)
            fallback
        } catch (cancellation: kotlinx.coroutines.CancellationException) {
            throw cancellation
        } catch (error: Throwable) {
            record(id, Outcome.Error, clock.now().toEpochMilliseconds() - started)
            fallback
        }
    }

    /**
     * Resolves the first acceptable box art across [tiers]. Providers within a tier run in
     * parallel; tier order decides which answer wins when several succeed.
     */
    suspend fun firstBoxArt(
        tiers: List<List<BoxArtProvider>>,
        game: com.saveslot.app.domain.model.Game,
        platform: String,
    ): MediaResult<String>? {
        for (tier in tiers) {
            val eligible = tier.filter { it.supports(game, platform) }
            if (eligible.isEmpty()) continue
            // When every provider in the tier is cooling down, still try the first one: a total
            // stall is worse than one slow call, and a success clears the cooldown.
            val batch = eligible.filter { isAvailable(it.id) }.ifEmpty { eligible.take(1) }
            val results = coroutineScope {
                batch.map { provider ->
                    async {
                        execute(
                            id = provider.id,
                            timeoutMillis = provider.timeoutMillis,
                            fallback = null,
                            accept = { url: String? -> !url.isNullOrEmpty() },
                        ) { provider.boxArt(game, platform) }
                    }
                }.awaitAll()
            }
            results.forEachIndexed { index, url ->
                if (!url.isNullOrEmpty()) {
                    return MediaResult(value = url, source = batch[index].id, platform = platform)
                }
            }
        }
        return null
    }

    /**
     * Collects screenshots from [providers], two at a time, until [maxItems] distinct URLs are
     * gathered. Unlike box art, more sources are simply better here, so results accumulate.
     */
    suspend fun collectScreenshots(
        providers: List<ScreenshotProvider>,
        game: com.saveslot.app.domain.model.Game,
        platform: String,
        maxItems: Int,
    ): MediaResult<List<String>> {
        val collected = LinkedHashSet<String>()
        val sources = LinkedHashSet<String>()
        val eligible = providers.filter { it.supports(game, platform) }
        for (index in eligible.indices step 2) {
            val batch = eligible.subList(index, minOf(index + 2, eligible.size))
                .filter { isAvailable(it.id) }
            if (batch.isEmpty()) continue
            val results = coroutineScope {
                batch.map { provider ->
                    async {
                        execute(
                            id = provider.id,
                            timeoutMillis = provider.timeoutMillis,
                            fallback = emptyList(),
                            accept = { urls: List<String> -> urls.isNotEmpty() },
                        ) { provider.screenshots(game, platform) }
                    }
                }.awaitAll()
            }
            results.forEachIndexed { batchIndex, urls ->
                if (urls.isNotEmpty()) {
                    collected += urls
                    sources += batch[batchIndex].id
                }
            }
            if (collected.size >= maxItems) break
        }
        return MediaResult(
            value = collected.take(maxItems),
            source = sources.joinToString("+").ifEmpty { null },
            platform = platform,
        )
    }

    private companion object {
        const val COOLDOWN_BASE_MS = 12_000L
    }
}
