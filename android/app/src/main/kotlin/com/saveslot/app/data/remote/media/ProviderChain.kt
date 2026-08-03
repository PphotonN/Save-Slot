package com.saveslot.app.data.remote.media

import kotlin.time.Clock
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.withTimeout

/**
 * Runs artwork providers with per-provider timeouts, adaptive ordering and tiered fan-out.
 *
 * Providers within one quality tier race each other. The first acceptable answer returns
 * immediately and cancels the remaining work, instead of waiting for the slowest timeout. Provider
 * reliability and latency only reorder peers inside a tier, so a fast generic wiki result never
 * jumps ahead of a release-accurate source from an earlier tier.
 */
class ProviderChain(clock: Clock = Clock.System) {

    private val health = ProviderHealthRegistry(clock)

    /** Runs one provider under its own timeout, returning [fallback] on timeout or failure. */
    private suspend fun <T> execute(
        id: String,
        timeoutMillis: Long,
        fallback: T,
        accept: (T) -> Boolean,
        block: suspend () -> T,
    ): T {
        if (!health.isAvailable(id)) return fallback
        val started = Clock.System.now().toEpochMilliseconds()
        return try {
            val value = withTimeout(timeoutMillis) { block() }
            val outcome = if (accept(value)) ProviderOutcome.Success else ProviderOutcome.Miss
            health.record(id, outcome, Clock.System.now().toEpochMilliseconds() - started)
            value
        } catch (timeout: TimeoutCancellationException) {
            health.record(
                id,
                ProviderOutcome.Timeout,
                Clock.System.now().toEpochMilliseconds() - started,
            )
            fallback
        } catch (cancellation: kotlinx.coroutines.CancellationException) {
            throw cancellation
        } catch (error: Throwable) {
            health.record(
                id,
                ProviderOutcome.Error,
                Clock.System.now().toEpochMilliseconds() - started,
            )
            fallback
        }
    }

    /**
     * Resolves the first acceptable box art across [tiers]. Providers within a tier run in
     * parallel; later tiers only start when the current tier has no acceptable result.
     */
    suspend fun firstBoxArt(
        tiers: List<List<BoxArtProvider>>,
        game: com.saveslot.app.domain.model.Game,
        platform: String,
    ): MediaResult<String>? {
        for (tier in tiers) {
            val eligible = tier.filter { it.supports(game, platform) }
            if (eligible.isEmpty()) continue

            val ordered = health.order(eligible) { it.id }
            // When every provider in the tier is cooling down, probe the best candidate rather than
            // stalling the entire resolver. A successful probe clears its cooldown.
            val batch = ordered.filter { health.isAvailable(it.id) }.ifEmpty { ordered.take(1) }
            val result = raceBoxArt(batch, game, platform)
            if (result != null) return result
        }
        return null
    }

    private suspend fun raceBoxArt(
        providers: List<BoxArtProvider>,
        game: com.saveslot.app.domain.model.Game,
        platform: String,
    ): MediaResult<String>? = supervisorScope {
        if (providers.isEmpty()) return@supervisorScope null

        val completions = Channel<Pair<BoxArtProvider, String?>>(capacity = providers.size)
        val jobs = providers.map { provider ->
            launch {
                val value = execute(
                    id = provider.id,
                    timeoutMillis = provider.timeoutMillis,
                    fallback = null,
                    accept = { url: String? -> !url.isNullOrEmpty() },
                ) { provider.boxArt(game, platform) }
                completions.trySend(provider to value)
            }
        }

        try {
            var remaining = providers.size
            while (remaining > 0) {
                val (provider, url) = completions.receive()
                remaining--
                if (!url.isNullOrEmpty()) {
                    jobs.forEach { if (it.isActive) it.cancel() }
                    return@supervisorScope MediaResult(
                        value = url,
                        source = provider.id,
                        platform = platform,
                    )
                }
            }
            null
        } finally {
            jobs.forEach { if (it.isActive) it.cancel() }
            completions.close()
        }
    }

    /**
     * Collects screenshots from [providers], two at a time, until [maxItems] distinct URLs are
     * gathered. Results accumulate because different sources often contain different scenes.
     */
    suspend fun collectScreenshots(
        providers: List<ScreenshotProvider>,
        game: com.saveslot.app.domain.model.Game,
        platform: String,
        maxItems: Int,
    ): MediaResult<List<String>> {
        val collected = LinkedHashSet<String>()
        val sources = LinkedHashSet<String>()
        val eligible = health.order(
            providers.filter { it.supports(game, platform) },
        ) { it.id }

        for (index in eligible.indices step SCREENSHOT_BATCH_SIZE) {
            val group = eligible.subList(index, minOf(index + SCREENSHOT_BATCH_SIZE, eligible.size))
            val batch = group.filter { health.isAvailable(it.id) }.ifEmpty { group.take(1) }
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
        const val SCREENSHOT_BATCH_SIZE = 2
    }
}
