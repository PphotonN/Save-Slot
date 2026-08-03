package com.saveslot.app.data.remote.media

import com.saveslot.app.core.text.PlatformNames
import com.saveslot.app.domain.model.Game

/**
 * Decides which artwork source wins for a given game and platform.
 *
 * Quality tiers are strict: release-aware archives and storefronts always finish before generic
 * encyclopedia imagery is considered. [ProviderChain] may adapt ordering only inside one tier.
 */
class MediaResolver(
    private val chain: ProviderChain,
    boxArtProviders: BoxArtProviders,
    screenshotProviders: ScreenshotProviders,
) {

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
        // Direct guesses and storefront records identify one concrete release.
        listOf(
            boxArtProviders.libretroGuess,
            boxArtProviders.steam,
        ),
        // Slower release-aware lookups and specialist catalogues.
        listOf(
            boxArtProviders.libretroIndex,
            boxArtProviders.gog,
            boxArtProviders.vndb,
            boxArtProviders.pcGamingWiki,
        ),
        // Entity and article lead images are useful but may represent another edition.
        listOf(
            boxArtProviders.wikidataEntity,
            boxArtProviders.wikipediaUk,
            boxArtProviders.wikipediaEn,
        ),
        // Broad free-media searches are the final fallback.
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
            val unique = result.value.distinctBy(::stableMediaKey).take(maxItems)
            if (unique.isNotEmpty()) {
                val source = if (candidate != platform) "${result.source}@$candidate" else result.source
                return result.copy(value = unique, source = source)
            }
        }
        return MediaResult(emptyList(), null, platform)
    }

    /**
     * The viewed release is tried first, followed by the inferred primary release and a bounded set
     * of alternatives. Canonicalisation prevents aliases such as PC/Windows or PS1/PlayStation from
     * causing duplicate provider passes.
     */
    private fun platformCandidates(game: Game, platform: String): List<String> {
        val primary = PlatformNames.inferPrimary(game.platforms, game.description)
        return (listOf(platform, primary) + game.platforms)
            .map(PlatformNames::canonical)
            .filter { it.isNotEmpty() }
            .distinct()
            .take(MAX_PLATFORM_FALLBACKS)
    }

    private fun stableMediaKey(url: String): String = url
        .substringBefore('#')
        .substringBefore('?')
        .removeSuffix("/")
        .lowercase()

    private companion object {
        const val MAX_PLATFORM_FALLBACKS = 4
    }
}
