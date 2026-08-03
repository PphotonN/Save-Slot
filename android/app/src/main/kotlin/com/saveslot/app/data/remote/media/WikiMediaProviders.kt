package com.saveslot.app.data.remote.media

import com.saveslot.app.core.net.HttpClient
import com.saveslot.app.core.net.asArray
import com.saveslot.app.core.net.asString
import com.saveslot.app.core.net.get
import com.saveslot.app.core.text.ArtworkFilenames
import com.saveslot.app.core.text.PlatformNames
import com.saveslot.app.core.text.TitleMatcher
import com.saveslot.app.core.text.cleanTitleForMedia
import com.saveslot.app.core.text.filenameFromUrl
import com.saveslot.app.core.text.normalizeLoose
import com.saveslot.app.core.text.titleMatcherOf
import com.saveslot.app.data.remote.SourceStatusTracker
import com.saveslot.app.data.remote.commons.CommonsDataSource
import com.saveslot.app.data.remote.wikidata.urlEncoded
import com.saveslot.app.data.remote.wikipedia.WikiImage
import com.saveslot.app.data.remote.wikipedia.WikipediaDataSource
import com.saveslot.app.domain.model.DataSource
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SourceStatus

/**
 * The Wikidata entity's own P18 image.
 *
 * Free and instant — it is already in the game record — but frequently a logo, a screenshot or the
 * wrong region's cover, so it is only accepted when portrait and free of disqualifying words.
 */
class WikidataEntityBoxArtProvider(private val imageProbe: ImageProbe) : BoxArtProvider {
    override val id = "wikidata"
    override val timeoutMillis = 1_400L

    override fun supports(game: Game, platform: String) = game.provisionalCover != null

    override suspend fun boxArt(game: Game, platform: String): String? {
        val url = game.provisionalCover ?: return null
        val meta = imageProbe.probe(url, timeoutMillis = 2_400)
        if (!meta.tallerThanWideBy(1.10)) return null

        val filename = ArtworkFilenames
            .decode(game.provisionalCoverFilename ?: filenameFromUrl(url))
            .lowercase()
        if (NON_COVER.containsMatchIn(filename)) return null
        val matcher = titleMatcherOf(game.title, game.originalTitle, game.aliases, game.year, platform)
        if (matcher.installmentMismatch(filename)) return null
        if (ArtworkFilenames.mentionsOtherPlatform(filename, game.platforms, platform)) return null
        return url
    }

    private companion object {
        val NON_COVER = Regex(
            "(logo|wordmark|icon|symbol|screenshot|gameplay|title[-_ ]?screen|map)",
            RegexOption.IGNORE_CASE,
        )
    }
}

/** A Wikipedia article's lead image, which for most games is the box art. */
class WikipediaPageImageProvider(
    private val wikipedia: WikipediaDataSource,
    private val imageProbe: ImageProbe,
    private val language: String,
) : BoxArtProvider {
    override val id = "wikipedia-$language"
    override val timeoutMillis = 3_400L

    override suspend fun boxArt(game: Game, platform: String): String? {
        val title = wikipedia.resolveArticleTitle(game, language, platform) ?: return null
        val candidate = wikipedia.pageImage(title, language) ?: return null
        if (!imageProbe.probe(candidate, timeoutMillis = 2_200).tallerThanWideBy(1.08)) return null
        val filename = filenameFromUrl(candidate)
        val matcher = titleMatcherOf(game.title, game.originalTitle, game.aliases, game.year, platform)
        if (ArtworkFilenames.mentionsOtherPlatform(filename, game.platforms, platform)) return null
        if (matcher.installmentMismatch(filename)) return null
        return candidate
    }
}

/** Every image embedded in the article, filtered down to plausible covers. */
class WikipediaArticleBoxArtProvider(
    private val wikipedia: WikipediaDataSource,
    private val imageProbe: ImageProbe,
) : BoxArtProvider {
    override val id = "wikipedia"
    override val timeoutMillis = 3_400L

    override suspend fun boxArt(game: Game, platform: String): String? {
        // Ukrainian article first when one exists, matching the app's language.
        val languages = if (game.ukWikiTitle != null) listOf("uk", "en") else listOf("en", "uk")
        val matcher = titleMatcherOf(game.title, game.originalTitle, game.aliases, game.year, platform)
        for (language in languages) {
            val title = wikipedia.resolveArticleTitle(game, language, platform) ?: continue
            val names = wikipedia.articleImageNames(title, language, limit = 40, timeoutMillis = 1_900)
                .filter { ArtworkFilenames.isArticleCoverCandidate(it, matcher, game.platforms, platform) }
                .take(12)
            if (names.isEmpty()) continue
            val images = wikipedia.imageInfo(names, language, thumbWidth = 1000, timeoutMillis = 2_100)
            for (image in images) {
                if (isAcceptableCover(image.url, matcher, game, platform, imageProbe)) return image.url
            }
        }
        return null
    }
}

/** Screenshots embedded in the article, for platforms no dedicated source covers. */
class WikipediaArticleScreenshotProvider(
    private val wikipedia: WikipediaDataSource,
    private val language: String,
) : ScreenshotProvider {
    override val id = "wikipedia-$language"
    override val timeoutMillis = 3_400L

    override suspend fun screenshots(game: Game, platform: String): List<String> {
        val title = wikipedia.resolveArticleTitle(game, language, platform) ?: return emptyList()
        val matcher = titleMatcherOf(game.title, game.originalTitle, game.aliases, game.year, platform)
        val names = wikipedia.articleImageNames(title, language, limit = 35, timeoutMillis = 1_900)
            .filter { ArtworkFilenames.isArticleScreenshotCandidate(it, matcher, game.platforms, platform) }
            .take(14)
        if (names.isEmpty()) return emptyList()
        return wikipedia.imageInfo(names, language, thumbWidth = 1200, timeoutMillis = 1_900)
            .filter { it.isLandscapeScreenshot(minRatio = 1.12) }
            .map { it.url }
    }
}

/** Full-text Commons search for covers. */
class CommonsSearchBoxArtProvider(
    private val commons: CommonsDataSource,
    private val imageProbe: ImageProbe,
    private val statusTracker: SourceStatusTracker,
) : BoxArtProvider {
    override val id = "wikimedia"
    override val timeoutMillis = 3_800L

    override suspend fun boxArt(game: Game, platform: String): String? {
        val matcher = titleMatcherOf(game.title, game.originalTitle, game.aliases, game.year, platform)
        val fileTitles = mutableListOf<String>()
        for (query in coverQueries(game, platform)) {
            fileTitles += commons.searchFiles(query, limit = 8)
            if (fileTitles.size >= 10) break
        }
        val filtered = fileTitles.distinct()
            .filter { ArtworkFilenames.isCoverCandidate(it, matcher, game.platforms, platform) }
            .take(10)
        if (filtered.isEmpty()) return null

        val images = commons.imageInfo(filtered, thumbWidth = 1000, timeoutMillis = 2_100)
        for (image in images) {
            if (isAcceptableCover(image.url, matcher, game, platform, imageProbe)) {
                statusTracker.set(DataSource.Wikimedia, SourceStatus.Online)
                return image.url
            }
        }
        return null
    }

    private companion object {
        fun coverQueries(game: Game, platform: String): List<String> {
            val titles = (listOf(game.originalTitle, game.title) + game.aliases)
                .filter { it.isNotBlank() }
                .map(::cleanTitleForMedia)
                .distinct()
                .take(4)
            return buildList {
                for (title in titles) {
                    if (platform.isNotEmpty()) {
                        add("$title $platform cover")
                        add("$title $platform box art")
                        add("$title $platform front cover")
                    }
                    add("$title cover")
                    add("$title box art")
                    add("$title video game cover")
                    game.year?.let { add("$title $it cover") }
                }
            }.distinct()
        }
    }
}

/** Full-text Commons search for screenshots. */
class CommonsSearchScreenshotProvider(
    private val commons: CommonsDataSource,
    private val statusTracker: SourceStatusTracker,
) : ScreenshotProvider {
    override val id = "wikimedia"
    override val timeoutMillis = 3_600L

    override suspend fun screenshots(game: Game, platform: String): List<String> {
        val matcher = titleMatcherOf(game.title, game.originalTitle, game.aliases, game.year, platform)
        val fileTitles = mutableListOf<String>()
        for (query in screenshotQueries(game, platform)) {
            fileTitles += commons.searchFiles(query, limit = 10)
            if (fileTitles.size >= 14) break
        }
        val filtered = fileTitles.distinct()
            .filter { ArtworkFilenames.isScreenshotCandidate(it, matcher, game.platforms, platform) }
            .take(12)
        if (filtered.isEmpty()) return emptyList()

        val urls = commons.imageInfo(filtered, thumbWidth = 1200, timeoutMillis = 2_100)
            .filter { it.isLandscapeScreenshot(minRatio = 1.18) }
            .map { it.url }
        if (urls.isNotEmpty()) statusTracker.set(DataSource.Wikimedia, SourceStatus.Online)
        return urls
    }

    private companion object {
        fun screenshotQueries(game: Game, platform: String): List<String> {
            val titles = (listOf(game.originalTitle, game.title) + game.aliases)
                .filter { it.isNotBlank() }
                .map(::cleanTitleForMedia)
                .distinct()
                .take(4)
            return buildList {
                for (title in titles) {
                    if (platform.isNotEmpty()) {
                        add("$title $platform screenshot")
                        add("$title $platform gameplay")
                    }
                    add("$title screenshot")
                    add("$title gameplay")
                    add("$title video game screenshot")
                    game.year?.let { add("$title $it screenshot") }
                }
            }.distinct()
        }
    }
}

/**
 * Files in the game's own Commons category (Wikidata P373).
 *
 * More precise than search because the category is curated per game, so results are ranked rather
 * than filtered by title.
 */
class CommonsCategoryBoxArtProvider(
    private val commons: CommonsDataSource,
    private val statusTracker: SourceStatusTracker,
) : BoxArtProvider {
    override val id = "wikimedia-category"
    override val timeoutMillis = 3_800L

    override fun supports(game: Game, platform: String) = !game.commonsCategory.isNullOrBlank()

    override suspend fun boxArt(game: Game, platform: String): String? {
        val category = game.commonsCategory ?: return null
        val matcher = titleMatcherOf(game.title, game.originalTitle, game.aliases, game.year, platform)
        val files = commons.categoryFiles(category)
            .filter { ArtworkFilenames.looksLikeCategoryCover(it) }
            .filterNot { ArtworkFilenames.mentionsOtherPlatform(it, game.platforms, platform) }
            .take(20)
        if (files.isEmpty()) return null

        val ranked = commons.imageInfo(files, thumbWidth = 1000)
            .filter { it.mime.startsWith("image/") && it.height > it.width * 1.04 }
            .map { image ->
                val low = normalizeLoose(image.title)
                var score = 30
                if (PlatformNames.aliases(platform).any { it.isNotEmpty() && low.contains(it) }) score += 45
                if (matcher.keywordHits(low) > 0) score += 25
                if (ArtworkFilenames.hasCoverWord(image.title)) score += 20
                image.url to score
            }
            .sortedByDescending { it.second }

        return ranked.firstOrNull()?.first?.also {
            statusTracker.set(DataSource.Wikimedia, SourceStatus.Online)
        }
    }
}

class CommonsCategoryScreenshotProvider(
    private val commons: CommonsDataSource,
    private val statusTracker: SourceStatusTracker,
) : ScreenshotProvider {
    override val id = "wikimedia-category"
    override val timeoutMillis = 3_600L

    override fun supports(game: Game, platform: String) = !game.commonsCategory.isNullOrBlank()

    override suspend fun screenshots(game: Game, platform: String): List<String> {
        val category = game.commonsCategory ?: return emptyList()
        val matcher = titleMatcherOf(game.title, game.originalTitle, game.aliases, game.year, platform)
        val files = commons.categoryFiles(category)
            .filter { ArtworkFilenames.looksLikeCategoryScreenshot(it) }
            .filterNot { ArtworkFilenames.mentionsOtherPlatform(it, game.platforms, platform) }
            .take(25)
        if (files.isEmpty()) return emptyList()

        val urls = commons.imageInfo(files, thumbWidth = 1200)
            .filter { it.mime.startsWith("image/") && it.width >= it.height * 0.98 }
            .map { image ->
                val low = normalizeLoose(image.title)
                var score = 10
                if (ArtworkFilenames.hasScreenshotWord(image.title)) score += 45
                if (PlatformNames.aliases(platform).any { it.isNotEmpty() && low.contains(it) }) score += 25
                if (matcher.keywordHits(low) > 0) score += 18
                image.url to score
            }
            // A file with no screenshot word and no title/platform signal is most likely promo art.
            .filter { it.second >= 20 }
            .sortedByDescending { it.second }
            .map { it.first }
            .distinct()
            .take(6)

        if (urls.isNotEmpty()) statusTracker.set(DataSource.Wikimedia, SourceStatus.Online)
        return urls
    }
}

/** PCGamingWiki: a last resort for PC covers the storefronts do not carry. */
class PcGamingWikiBoxArtProvider(
    private val httpClient: HttpClient,
    private val imageProbe: ImageProbe,
    private val statusTracker: SourceStatusTracker,
) : BoxArtProvider {
    override val id = "pcgamingwiki"
    override val timeoutMillis = 3_400L

    override fun supports(game: Game, platform: String) = PlatformNames.isPc(platform)

    override suspend fun boxArt(game: Game, platform: String): String? {
        statusTracker.set(DataSource.PcGamingWiki, SourceStatus.Loading)
        val matcher = titleMatcherOf(game.title, game.originalTitle, game.aliases, game.year, platform)
        return runCatching {
            val title = cleanTitleForMedia(game.originalTitle.ifEmpty { game.title })
            val search = "intitle:\"${title.replace("\"", "")}\""
            val url = buildString {
                append("https://www.pcgamingwiki.com/w/api.php?origin=*&action=query&format=json")
                append("&formatversion=2&generator=search&gsrnamespace=0&gsrlimit=4")
                append("&gsrsearch=${search.urlEncoded()}")
                append("&prop=pageimages&piprop=thumbnail&pithumbsize=1000")
            }
            val payload = httpClient.getJson(url, timeoutMillis = 2_300)
            val candidates = payload["query"]["pages"].asArray
                .filter { page ->
                    val pageTitle = page["title"].asString.orEmpty()
                    matcher.matchesTitle(pageTitle) && !matcher.installmentMismatch(pageTitle)
                }
                .mapNotNull { it["thumbnail"]["source"].asString }
            val found = imageProbe.firstMatching(
                urls = candidates,
                timeoutMillis = 1_500,
                batchSize = 2,
                validator = { it.tallerThanWideBy(1.08) },
            )
            if (found != null) statusTracker.set(DataSource.PcGamingWiki, SourceStatus.Online)
            else statusTracker.clearLoading(DataSource.PcGamingWiki)
            found
        }.getOrElse {
            statusTracker.set(DataSource.PcGamingWiki, SourceStatus.Error)
            null
        }
    }
}

/** MediaWiki reports dimensions, so obvious non-screenshots are rejected without a fetch. */
private fun WikiImage.isLandscapeScreenshot(minRatio: Double): Boolean =
    mime.startsWith("image/") && width > 500 && width > height * minRatio

/**
 * Final gate before a wiki image becomes a cover: portrait enough to be packaging, named like a
 * cover, about the right game, and not from another platform's release.
 */
private suspend fun isAcceptableCover(
    url: String,
    matcher: TitleMatcher,
    game: Game,
    platform: String,
    imageProbe: ImageProbe,
): Boolean {
    val meta = imageProbe.probe(url)
    if (!meta.ok) return false
    // Covers are decisively portrait; a near-square image is usually promo art or a logo plate.
    if (!(meta.height > meta.width * 1.08 && meta.width.toDouble() / meta.height < 0.90)) return false
    val filename = ArtworkFilenames.decode(filenameFromUrl(url)).lowercase()
    if (matcher.installmentMismatch(filename)) return false
    if (!matcher.matchesTitle(filename)) return false
    if (ArtworkFilenames.mentionsOtherPlatform(filename, game.platforms, platform)) return false
    return ArtworkFilenames.hasCoverWord(filename)
}
