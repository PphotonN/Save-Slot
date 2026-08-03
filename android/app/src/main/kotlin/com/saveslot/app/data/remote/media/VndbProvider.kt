package com.saveslot.app.data.remote.media

import androidx.collection.LruCache
import com.saveslot.app.core.net.HttpClient
import com.saveslot.app.core.net.asArray
import com.saveslot.app.core.net.asDouble
import com.saveslot.app.core.net.asString
import com.saveslot.app.core.net.get
import com.saveslot.app.core.text.cleanTitleForMedia
import com.saveslot.app.core.text.normalizeLoose
import com.saveslot.app.core.text.titleMatcherOf
import com.saveslot.app.data.remote.SourceStatusTracker
import com.saveslot.app.domain.model.DataSource
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SourceStatus
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/**
 * The Visual Novel Database, for a genre the general-purpose sources cover badly.
 *
 * VNDB tags every image with sexual and violence ratings; anything above a mild threshold is
 * dropped, since the app shows artwork unprompted in rails and detail headers.
 */
class VndbProvider(
    private val httpClient: HttpClient,
    private val imageProbe: ImageProbe,
    private val statusTracker: SourceStatusTracker,
) {

    data class VndbMedia(val boxArt: String?, val screenshots: List<String>)

    private val cache = LruCache<String, VndbMedia>(96)
    private val lock = Mutex()

    fun isVisualNovel(game: Game): Boolean {
        val haystack = normalizeLoose("${game.genres.joinToString(" ")} ${game.description}")
        return VISUAL_NOVEL.containsMatchIn(haystack)
    }

    private suspend fun media(game: Game, platform: String): VndbMedia {
        if (!isVisualNovel(game)) return EMPTY
        val key = "${normalizeLoose(game.originalTitle.ifEmpty { game.title })}|${normalizeLoose(platform)}"
        cache[key]?.let { return it }

        return lock.withLock {
            cache[key]?.let { return@withLock it }
            statusTracker.set(DataSource.Vndb, SourceStatus.Loading)
            val resolved = runCatching { fetchMedia(game, platform) }.getOrElse {
                statusTracker.set(DataSource.Vndb, SourceStatus.Error)
                EMPTY
            }
            // Only remember hits: an empty result is usually a search miss worth retrying later.
            if (resolved.boxArt != null || resolved.screenshots.isNotEmpty()) cache.put(key, resolved)
            resolved
        }
    }

    private suspend fun fetchMedia(game: Game, platform: String): VndbMedia {
        val body = buildJsonObject {
            // VNDB's query language expects the filter as a ["field", "operator", value] triple.
            putJsonArray("filters") {
                add("search")
                add("=")
                add(cleanTitleForMedia(game.originalTitle.ifEmpty { game.title }))
            }
            put(
                "fields",
                "title,alttitle,aliases,platforms,image.url,image.thumbnail,image.dims," +
                    "image.sexual,image.violence,screenshots.url,screenshots.thumbnail," +
                    "screenshots.dims,screenshots.sexual,screenshots.violence",
            )
            put("sort", "searchrank")
            put("results", 8)
        }
        val payload = httpClient.postJson(
            url = "https://api.vndb.org/kana/vn",
            body = body.toString(),
            timeoutMillis = 2_600,
        )

        val matcher = titleMatcherOf(
            title = game.title,
            originalTitle = game.originalTitle,
            aliases = game.aliases,
            year = game.year,
            activePlatform = platform,
        )
        val target = normalizeLoose(game.originalTitle.ifEmpty { game.title })
        val platformCode = platformCode(platform)

        val ranked = payload["results"].asArray.map { item ->
            val titles = listOfNotNull(item["title"].asString, item["alttitle"].asString)
                .plus(item["aliases"].asArray.mapNotNull { it.asString })
                .map(::normalizeLoose)
            var score = if (titles.any { it == target }) 120 else 0
            if (titles.isNotEmpty() && titles.all { matcher.installmentMismatch(it) }) score -= 180
            if (titles.any { it.contains(target) || target.contains(it) }) score += 55
            score += titles.sumOf { matcher.keywordHits(it) } * 8
            if (platformCode != null && item["platforms"].asArray.any { it.asString == platformCode }) {
                score += 30
            }
            item to score
        }.sortedByDescending { it.second }

        val item = ranked.firstOrNull()?.takeIf { it.second >= 28 }?.first
        if (item == null) {
            statusTracker.clearLoading(DataSource.Vndb)
            return EMPTY
        }

        val cover = item["image"]
        val boxArt = if (cover == null || isSafe(cover)) {
            cover["url"].asString ?: cover["thumbnail"].asString
        } else {
            null
        }
        val screenshots = item["screenshots"].asArray
            .filter { isSafe(it) }
            .mapNotNull { it["url"].asString ?: it["thumbnail"].asString }
            .take(8)

        if (boxArt != null || screenshots.isNotEmpty()) {
            statusTracker.set(DataSource.Vndb, SourceStatus.Online)
        } else {
            statusTracker.clearLoading(DataSource.Vndb)
        }
        return VndbMedia(boxArt, screenshots)
    }

    suspend fun boxArt(game: Game, platform: String): String? {
        val url = media(game, platform).boxArt ?: return null
        // VNDB covers are portrait; a landscape hit means the entry's image is promo art.
        return url.takeIf { imageProbe.probe(it, timeoutMillis = 1_300).tallerThanWideBy(1.08) }
    }

    suspend fun screenshots(game: Game, platform: String): List<String> = media(game, platform).screenshots

    private companion object {
        val EMPTY = VndbMedia(null, emptyList())

        val VISUAL_NOVEL = Regex(
            "(visual novel|візуальна новела|interactive fiction|kinetic novel)",
            RegexOption.IGNORE_CASE,
        )

        /** VNDB image flags are 0..2 averages; anything past mild is not shown. */
        const val MAX_SEXUAL = 1.0
        const val MAX_VIOLENCE = 1.5

        fun isSafe(image: JsonElement?): Boolean =
            (image["sexual"].asDouble ?: 0.0) <= MAX_SEXUAL &&
                (image["violence"].asDouble ?: 0.0) <= MAX_VIOLENCE

        fun platformCode(platform: String): String? = when (normalizeLoose(platform)) {
            "windows" -> "win"
            "linux" -> "lin"
            "macos", "mac os" -> "mac"
            "dos" -> "dos"
            "playstation" -> "ps1"
            "playstation 2" -> "ps2"
            "playstation 3" -> "ps3"
            "playstation 4" -> "ps4"
            "playstation 5" -> "ps5"
            "playstation portable" -> "psp"
            "playstation vita" -> "psv"
            "nintendo ds" -> "nds"
            "nintendo 3ds" -> "3ds"
            "nintendo switch" -> "swi"
            "wii" -> "wii"
            "wii u" -> "wiu"
            "game boy" -> "gb"
            "game boy color" -> "gbc"
            "game boy advance" -> "gba"
            "xbox" -> "xbx"
            "xbox 360" -> "x360"
            "xbox one" -> "xone"
            "xbox series x/s" -> "xsx"
            "dreamcast" -> "dc"
            "sega saturn" -> "sat"
            else -> null
        }
    }
}

class VndbBoxArtProvider(private val vndb: VndbProvider) : BoxArtProvider {
    override val id = "vndb"
    override val timeoutMillis = 3_800L
    override fun supports(game: Game, platform: String) = vndb.isVisualNovel(game)
    override suspend fun boxArt(game: Game, platform: String) = vndb.boxArt(game, platform)
}

class VndbScreenshotProvider(private val vndb: VndbProvider) : ScreenshotProvider {
    override val id = "vndb"
    override val timeoutMillis = 3_800L
    override fun supports(game: Game, platform: String) = vndb.isVisualNovel(game)
    override suspend fun screenshots(game: Game, platform: String) = vndb.screenshots(game, platform)
}
