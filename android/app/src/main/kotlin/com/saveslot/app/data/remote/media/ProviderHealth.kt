package com.saveslot.app.data.remote.media

import kotlin.time.Clock

/** Outcome of one upstream artwork request. */
internal enum class ProviderOutcome {
    Success,
    Miss,
    Timeout,
    Error,
}

/**
 * In-memory reliability and latency model for artwork providers.
 *
 * Quality tiers remain fixed in [MediaResolver]; this registry only reorders providers inside the
 * same tier and temporarily benches a repeatedly failing host. A clean miss is not considered a
 * failure because most sources simply do not contain every game.
 */
internal class ProviderHealthRegistry(
    private val clock: Clock = Clock.System,
) {
    private data class Health(
        var successes: Int = 0,
        var failures: Int = 0,
        var consecutiveFailures: Int = 0,
        var latencyMillis: Double = DEFAULT_LATENCY_MS,
        var cooldownUntil: Long = 0L,
    )

    private val records = mutableMapOf<String, Health>()
    private val lock = Any()

    fun isAvailable(id: String): Boolean = synchronized(lock) {
        val record = records.getOrPut(id) { Health() }
        record.cooldownUntil <= clock.now().toEpochMilliseconds()
    }

    fun record(id: String, outcome: ProviderOutcome, elapsedMillis: Long) {
        synchronized(lock) {
            val record = records.getOrPut(id) { Health() }
            record.latencyMillis = record.latencyMillis * LATENCY_HISTORY_WEIGHT +
                elapsedMillis * LATENCY_SAMPLE_WEIGHT

            when (outcome) {
                ProviderOutcome.Success -> {
                    record.successes++
                    record.consecutiveFailures = 0
                    record.cooldownUntil = 0L
                }
                ProviderOutcome.Miss -> Unit
                ProviderOutcome.Timeout, ProviderOutcome.Error -> {
                    record.failures++
                    record.consecutiveFailures++
                    if (record.consecutiveFailures >= FAILURES_BEFORE_COOLDOWN) {
                        val multiplier = minOf(
                            MAX_COOLDOWN_MULTIPLIER,
                            record.consecutiveFailures - FAILURES_BEFORE_COOLDOWN + 1,
                        )
                        record.cooldownUntil = clock.now().toEpochMilliseconds() +
                            COOLDOWN_BASE_MS * multiplier
                    }
                }
            }
        }
    }

    /** Orders comparable-quality providers by availability, reliability and observed latency. */
    fun <T> order(items: List<T>, idOf: (T) -> String): List<T> = items.sortedWith(
        compareByDescending<T> { isAvailable(idOf(it)) }
            .thenBy { score(idOf(it)) },
    )

    private fun score(id: String): Double = synchronized(lock) {
        val record = records.getOrPut(id) { Health() }
        val attempts = record.successes + record.failures
        val successRate = if (attempts == 0) NEUTRAL_SUCCESS_RATE
        else record.successes.toDouble() / attempts

        record.latencyMillis +
            record.consecutiveFailures * CONSECUTIVE_FAILURE_PENALTY_MS -
            successRate * SUCCESS_BONUS_MS
    }

    private companion object {
        const val DEFAULT_LATENCY_MS = 900.0
        const val LATENCY_HISTORY_WEIGHT = 0.72
        const val LATENCY_SAMPLE_WEIGHT = 0.28
        const val NEUTRAL_SUCCESS_RATE = 0.55
        const val SUCCESS_BONUS_MS = 420.0
        const val CONSECUTIVE_FAILURE_PENALTY_MS = 1_100.0
        const val FAILURES_BEFORE_COOLDOWN = 2
        const val MAX_COOLDOWN_MULTIPLIER = 4
        const val COOLDOWN_BASE_MS = 12_000L
    }
}
