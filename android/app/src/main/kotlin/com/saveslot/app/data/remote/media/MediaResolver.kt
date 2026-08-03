package com.saveslot.app.data.remote.media

import com.saveslot.app.core.text.PlatformNames
import com.saveslot.app.domain.model.Game

/**
 * Decides which artwork source wins for a given game and platform.
 *
 * Two policies live here:
 *
 *  - **Tier order.** Sources are ordered by how likely they are to return the *right* image for the
 *    exact release, not merely any image: the ROM archive and storefronts know a specific release,
 *    while wiki search knows a franchise. Cheap sources also come first so the common case resolves
 *    in one round trip.
 *  - **Platform fallback.** A game viewed on a platform with no artwork anywhere still deserves a
 *    cover, so lookup retries against the game's other releases and records which one it used.
 */
class MediaResolver(
    private val chain: ProviderChain,
    boxArtProviders: BoxArtProviders,
    screenshotProviders: ScreenshotProviders,
) {

    /** Box art sources, grouped into tiers that run in order. */
    class BoxArtProviders(
        val libretroGuess: BoxArtProvider,
        val libretroIndex: BoxArtProvider,
        val steam: BoxArtProvider,
        val gog: BoxArtProvider,
        val vndb: BoxArtProvider,
        val pcGamingWiki: BoxArtProvider,
        val wikidataEntity: BoxArtProvider,
        val wikipediaUk: BoxArtProvider,
        val wikipediaEn: BoxArtProvider,
        val wikipediaArticle: BoxArtProvider,
        val commonsCategory: BoxArtProvider,
        val commonsSearch: BoxArtProvider,
    )

    class ScreenshotProviders(
        val libretroGuess: ScreenshotProvider,
        val libretroIndex: ScreenshotProvider,
        val steam: ScreenshotProvider,
        val gog: ScreenshotProvider,
        val vndb: ScreenshotProvider,
        val commonsCategory: ScreenshotProvider,
        val commonsSearch: ScreenshotProvider,
        val wikipediaUk: ScreenshotProvider,
        val wikipediaEn: ScreenshotProvider,
    )

    private val boxArtTiers: List<List<BoxArtProvider>> = listOf(
        // Fast and release-accurate: the ROM archive, the storefront, and the image already on hand.
        listOf(
            boxArtProviders.libretroGuess,
            boxArtProviders.steam,
            boxArtProviders.wikidataEntity,
        ),
        // Slower but still release-specific.
        listOf(
            boxArtProviders.libretroIndex,
            boxArtProviders.gog,
            boxArtProviders.pcGamingWiki,
            boxArtProviders.vndb,
        ),
        // Encyclopaedic lead images: usually the cover, sometimes the wrong edition.
        listOf(
            boxArtProviders.wikipediaUk,
            boxArtProviders.wikipediaEn,
        ),
        // Broad search across free-media archives.
        listOf(
            boxArtProviders.commonsCategory,
            boxArtProviders.commonsSearch,
            boxArtProviders.wikipediaArticle,
        ),
    )

    private val screenshotProviderOrder: List<ScreenshotProvider> = listOf(
        screenshotProviders.libretroGuess,
        screenshotProviders.steam,
        screenshotProviders.gog,
        screenshotProviders.vndb,
        screenshotProviders.commonsCategory,
        screenshotProviders.commonsSearch,
        screenshotProviders.wikipediaUk,
        screenshotProviders.wikipediaEn,
        screenshotProviders.libretroIndex,
    )

    suspend fun resolveBoxArt(game: Game, platform: String): MediaResult<String>? {
        for (candidate in platformCandidates(game, platform)) {
            val result = chain.firstBoxArt(boxArtTiers, game, candidate)
            if (result != null) {
                // Note when the artwork actually belongs to a different release of the game.
                val source = if (candidate != platform) "${result.source}@$candidate" else result.source
                return result.copy(source = source)
            }
        }
        return null
    }

    suspend fun resolveScreenshots(
        game: Game,
        platform: String,
        maxItems: Int = 8,
    ): MediaResult<List<String>> {
        for (candidate in platformCandidates(game, platform)) {
            val result = chain.collectScreenshots(screenshotProviderOrder, game, candidate, maxItems)
            if (result.value.isNotEmpty()) {
                val source = if (candidate != platform) "${result.source}@$candidate" else result.source
                return result.copy(source = source)
            }
        }
        return MediaResult(emptyList(), null, platform)
    }

    /**
     * Platforms to try, in order: the one being viewed, the release the description emphasises,
     * then the rest. Deduplicated so a single-platform game costs one pass.
     */
    private fun platformCandidates(game: Game, platform: String): List<String> {
        val primary = PlatformNames.inferPrimary(game.platforms, game.description)
        return (listOf(platform, primary) + game.platforms)
            .filter { it.isNotEmpty() }
            .distinct()
    }
}
