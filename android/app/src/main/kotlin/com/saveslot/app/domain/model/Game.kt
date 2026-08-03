package com.saveslot.app.domain.model

import kotlinx.serialization.Serializable

/**
 * A game as the app knows it: Wikidata facts plus per-platform artwork resolved lazily
 * from the media providers.
 *
 * [mediaByPlatform] is keyed by canonical platform name, with [GENERIC_PLATFORM_KEY] used for
 * games that have no known platform list. This mirrors the way artwork differs per release.
 */
@Serializable
data class Game(
    val id: String,
    val title: String,
    val originalTitle: String = title,
    val aliases: List<String> = emptyList(),
    val description: String = "",
    val year: Int? = null,
    val platforms: List<String> = emptyList(),
    val genres: List<String> = emptyList(),
    val developers: List<String> = emptyList(),
    val publishers: List<String> = emptyList(),
    val series: List<String> = emptyList(),
    val steamAppId: String? = null,
    val commonsCategory: String? = null,
    /** Provisional artwork straight off the Wikidata/Wikipedia entity, not yet validated. */
    val provisionalCover: String? = null,
    val provisionalCoverFilename: String? = null,
    val selectedPlatform: String = platforms.firstOrNull().orEmpty(),
    val mediaByPlatform: Map<String, MediaRecord> = emptyMap(),
    val ukWikiTitle: String? = null,
    val enWikiTitle: String? = null,
) {
    val activePlatform: String
        get() = selectedPlatform.takeIf { it.isNotEmpty() && platforms.contains(it) }
            ?: platforms.firstOrNull().orEmpty()

    fun mediaFor(platform: String = activePlatform): MediaRecord =
        mediaByPlatform[platform.ifEmpty { GENERIC_PLATFORM_KEY }] ?: MediaRecord(platform = platform)

    fun withMedia(platform: String, record: MediaRecord): Game {
        val key = platform.ifEmpty { GENERIC_PLATFORM_KEY }
        return copy(mediaByPlatform = mediaByPlatform + (key to record))
    }

    /** Artwork that passed provider validation, if any. */
    val verifiedCover: String?
        get() = mediaFor().boxArt

    /** Best cover to show right now, preferring verified artwork over the provisional entity image. */
    val displayCover: String?
        get() = verifiedCover ?: provisionalCover

    val screenshots: List<String>
        get() = mediaFor().screenshots

    val wikiTitles: Map<String, String>
        get() = buildMap {
            ukWikiTitle?.let { put("uk", it) }
            enWikiTitle?.let { put("en", it) }
        }

    companion object {
        const val GENERIC_PLATFORM_KEY = "_generic"
    }
}

/** Resolved artwork for one platform release of a game. */
@Serializable
data class MediaRecord(
    val platform: String = "",
    val boxArt: String? = null,
    val boxArtSource: String? = null,
    val boxArtResolved: Boolean = false,
    val boxArtCheckedAt: Long = 0L,
    val screenshots: List<String> = emptyList(),
    val screenshotSource: String? = null,
    val screenshotsResolved: Boolean = false,
    val screenshotsCheckedAt: Long = 0L,
)
