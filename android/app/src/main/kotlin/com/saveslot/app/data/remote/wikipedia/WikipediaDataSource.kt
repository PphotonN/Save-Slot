package com.saveslot.app.data.remote.wikipedia

import androidx.collection.LruCache
import com.saveslot.app.core.net.HttpClient
import com.saveslot.app.core.net.asArray
import com.saveslot.app.core.net.asInt
import com.saveslot.app.core.net.asString
import com.saveslot.app.core.net.get
import com.saveslot.app.core.text.GameTitles
import com.saveslot.app.core.text.PlatformNames
import com.saveslot.app.core.text.cleanTitleForMedia
import com.saveslot.app.core.text.normalizeLoose
import com.saveslot.app.core.text.titleMatcherOf
import com.saveslot.app.data.remote.SourceStatusTracker
import com.saveslot.app.data.remote.wikidata.WikidataHit
import com.saveslot.app.data.remote.wikidata.urlEncoded
import com.saveslot.app.domain.model.DataSource
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SourceStatus
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** An image file referenced by an article, with the dimensions MediaWiki reports for it. */
data class WikiImage(
    val title: String,
    val url: String,
    val width: Int,
    val height: Int,
    val mime: String,
)

/** Article extract and lead image used to flesh out a game's description and provisional cover. */
data class ArticleSummary(
    val extract: String?,
    val thumbnailUrl: String?,
)

/**
 * Wikipedia supplies prose descriptions, and — when the dedicated artwork sources come up empty —
 * article images as a last-resort cover or screenshot.
 */
class WikipediaDataSource(
    private val httpClient: HttpClient,
    private val statusTracker: SourceStatusTracker,
) {

    /**
     * Article titles resolved for games whose Wikidata item has no sitelink.
     *
     * Only successful lookups are memoised; a failure stays retryable because it is usually a
     * timeout rather than a genuine absence.
     */
    private val resolvedTitles = LruCache<String, String>(256)
    private val titleLock = Mutex()

    /** Fallback discovery path: find games via article search when Wikidata search is thin. */
    suspend fun searchGames(query: String, language: String): List<WikidataHit> {
        statusTracker.set(DataSource.Wikipedia, SourceStatus.Loading)
        val url = buildString {
            append("https://$language.wikipedia.org/w/api.php?origin=*&action=query&format=json")
            append("&formatversion=2&generator=search&gsrnamespace=0&gsrlimit=10")
            append("&gsrsearch=${"$query video game".urlEncoded()}")
            append("&prop=pageprops|description")
        }
        val payload = httpClient.getJson(url, timeoutMillis = 9_000)
        statusTracker.set(DataSource.Wikipedia, SourceStatus.Online)
        return payload["query"]["pages"].asArray.mapNotNull { page ->
            val entityId = page["pageprops"]["wikibase_item"].asString ?: return@mapNotNull null
            WikidataHit(
                id = entityId,
                label = page["title"].asString,
                description = page["description"].asString,
            )
        }
    }

    /** Lead-section extract plus page image, for the game detail description. */
    suspend fun articleSummary(
        title: String,
        language: String,
        lightweight: Boolean,
    ): ArticleSummary? = runCatching {
        statusTracker.set(DataSource.Wikipedia, SourceStatus.Loading)
        val url = buildString {
            append("https://$language.wikipedia.org/w/api.php?origin=*&action=query&format=json")
            append("&formatversion=2&prop=extracts|pageimages&exintro=1&explaintext=1")
            append("&exchars=${if (lightweight) 700 else 1800}")
            append("&piprop=thumbnail&pithumbsize=900&titles=${title.urlEncoded()}")
        }
        val payload = httpClient.getJson(url, timeoutMillis = 10_000)
        val page = payload["query"]["pages"][0]
        statusTracker.set(DataSource.Wikipedia, SourceStatus.Online)
        ArticleSummary(
            extract = page["extract"].asString?.let(::cleanExtract),
            thumbnailUrl = page["thumbnail"]["source"].asString,
        )
    }.getOrElse {
        statusTracker.set(DataSource.Wikipedia, SourceStatus.Error)
        null
    }

    /** The article's own lead image, sized for use as a cover candidate. */
    suspend fun pageImage(title: String, language: String): String? = runCatching {
        val url = buildString {
            append("https://$language.wikipedia.org/w/api.php?origin=*&action=query&format=json")
            append("&formatversion=2&prop=pageimages&piprop=thumbnail&pithumbsize=1000")
            append("&titles=${title.urlEncoded()}")
        }
        httpClient.getJson(url, timeoutMillis = 3_200)["query"]["pages"][0]["thumbnail"]["source"].asString
    }.getOrNull()

    /** Every image file an article embeds, as raw file titles. */
    suspend fun articleImageNames(
        title: String,
        language: String,
        limit: Int,
        timeoutMillis: Long,
    ): List<String> = runCatching {
        val url = buildString {
            append("https://$language.wikipedia.org/w/api.php?origin=*&action=query&format=json")
            append("&formatversion=2&prop=images&imlimit=$limit&titles=${title.urlEncoded()}")
        }
        httpClient.getJson(url, timeoutMillis)["query"]["pages"][0]["images"].asArray
            .mapNotNull { it["title"].asString }
    }.getOrDefault(emptyList())

    /** Resolves file titles to URLs and dimensions in one call. */
    suspend fun imageInfo(
        fileTitles: List<String>,
        language: String,
        thumbWidth: Int,
        timeoutMillis: Long,
    ): List<WikiImage> {
        if (fileTitles.isEmpty()) return emptyList()
        return runCatching {
            val url = buildString {
                append("https://$language.wikipedia.org/w/api.php?origin=*&action=query&format=json")
                append("&formatversion=2&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=$thumbWidth")
                append("&titles=${fileTitles.take(25).joinToString("|").urlEncoded()}")
            }
            httpClient.getJson(url, timeoutMillis)["query"]["pages"].asArray.mapNotNull { page ->
                val info = page["imageinfo"][0] ?: return@mapNotNull null
                WikiImage(
                    title = page["title"].asString.orEmpty(),
                    url = info["thumburl"].asString ?: info["url"].asString ?: return@mapNotNull null,
                    width = info["width"].asInt ?: 0,
                    height = info["height"].asInt ?: 0,
                    mime = info["mime"].asString.orEmpty(),
                )
            }
        }.getOrDefault(emptyList())
    }

    /**
     * Finds the article for a game that has no Wikidata sitelink in [language].
     *
     * Candidate pages are scored on title similarity, whether the description reads like a game,
     * and platform mentions; an instalment mismatch is heavily penalised so "Final Fantasy" never
     * resolves to the "Final Fantasy VII" article.
     */
    suspend fun resolveArticleTitle(game: Game, language: String, platform: String): String? {
        game.wikiTitles[language]?.let { return it }
        val cacheKey = "$language|${normalizeLoose(game.originalTitle.ifEmpty { game.title })}|${normalizeLoose(platform)}"
        resolvedTitles[cacheKey]?.let { return it }

        return titleLock.withLock {
            resolvedTitles[cacheKey]?.let { return@withLock it }
            val resolved = lookupArticleTitle(game, language, platform)
            if (resolved != null) resolvedTitles.put(cacheKey, resolved)
            resolved
        }
    }

    private suspend fun lookupArticleTitle(game: Game, language: String, platform: String): String? {
        val baseTitle = cleanTitleForMedia(game.originalTitle.ifEmpty { game.title })
        val matcher = titleMatcherOf(
            title = game.title,
            originalTitle = game.originalTitle,
            aliases = game.aliases,
            year = game.year,
            activePlatform = platform,
        )
        val queries = listOfNotNull(
            "$baseTitle video game",
            "$baseTitle game",
            baseTitle,
            platform.takeIf { it.isNotEmpty() }?.let { "$baseTitle $it" },
            game.year?.let { "$baseTitle $it video game" },
        ).distinct()

        val target = normalizeLoose(baseTitle)
        for (query in queries) {
            val payload = runCatching {
                val url = buildString {
                    append("https://$language.wikipedia.org/w/api.php?origin=*&action=query&format=json")
                    append("&formatversion=2&generator=search&gsrnamespace=0&gsrlimit=6")
                    append("&gsrsearch=${query.urlEncoded()}&prop=pageprops|description")
                }
                httpClient.getJson(url, timeoutMillis = 3_400)
            }.getOrNull() ?: continue

            val ranked = payload["query"]["pages"].asArray.map { page ->
                val pageTitle = normalizeLoose(GameTitles.cleanDisplay(page["title"].asString))
                val description = normalizeLoose(page["description"].asString.orEmpty())
                var score = if (pageTitle == target) 120 else 0
                if (matcher.installmentMismatch(pageTitle)) score -= 160
                if (pageTitle.contains(target) || target.contains(pageTitle)) score += 55
                score += matcher.keywordHits(pageTitle) * 9
                if (GAME_DESCRIPTION.containsMatchIn(description)) score += 25
                if (PlatformNames.aliases(platform).any { description.contains(it) || pageTitle.contains(it) }) {
                    score += 18
                }
                page to score
            }.sortedByDescending { it.second }

            val best = ranked.firstOrNull()?.takeIf { it.second >= 42 }?.first
            best["title"].asString?.let { return it }
        }
        return null
    }

    private companion object {
        val GAME_DESCRIPTION = Regex("(video game|computer game|arcade game|відеогра)", RegexOption.IGNORE_CASE)

        /** Strips reference markers like "[12]" and collapses whitespace from plain-text extracts. */
        fun cleanExtract(text: String): String =
            text.replace(Regex("\\[\\d+]"), " ").replace(Regex("\\s+"), " ").trim()
    }
}
