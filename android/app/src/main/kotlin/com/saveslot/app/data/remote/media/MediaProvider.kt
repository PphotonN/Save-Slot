package com.saveslot.app.data.remote.media

import com.saveslot.app.domain.model.Game

/**
 * One artwork source for one kind of image.
 *
 * Providers are pure lookups: given a game and a platform they either return a validated URL (or
 * screenshot list) or nothing. Ordering, timeouts and failure tracking are the chain's job, not
 * the provider's, which keeps each provider small enough to test on its own.
 */
interface BoxArtProvider {
    /** Stable id used in [MediaResult.source] and for health tracking. */
    val id: String

    /** Wall-clock budget for one attempt; the chain abandons the provider after this. */
    val timeoutMillis: Long

    /** False when this provider cannot possibly serve the platform (e.g. Steam for a Wii game). */
    fun supports(game: Game, platform: String): Boolean = true

    suspend fun boxArt(game: Game, platform: String): String?
}

interface ScreenshotProvider {
    val id: String
    val timeoutMillis: Long

    fun supports(game: Game, platform: String): Boolean = true

    suspend fun screenshots(game: Game, platform: String): List<String>
}

/** Where a resolved image came from, kept so cached artwork can be attributed and debugged. */
data class MediaResult<T>(
    val value: T,
    val source: String?,
    val platform: String,
)
