package com.saveslot.app.data.remote.media

import androidx.collection.LruCache
import com.saveslot.app.core.net.HttpClient
import com.saveslot.app.core.net.asArray
import com.saveslot.app.core.net.asString
import com.saveslot.app.core.net.get
import com.saveslot.app.core.text.PlatformNames
import com.saveslot.app.core.text.cleanTitleForMedia
import com.saveslot.app.core.text.normalizeLoose
import com.saveslot.app.core.text.titleMatcherOf
import com.saveslot.app.data.remote.SourceStatusTracker
import com.saveslot.app.data.remote.wikidata.urlEncoded
import com.saveslot.app.domain.model.DataSource
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SourceStatus
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/**
 * Steam store lookups for PC releases.
 *
 * Steam has no public id-by-name endpoint, so the app searches the storefront and scores results
 * against the game's titles. Once an app id is known, artwork comes straight off the CDN.
 */
class SteamProvider(
    private val httpClient: HttpClient,
    private val imageProbe: ImageProbe,
    private val statusTracker: SourceStatusTracker,
) {

    private val appIdCache = LruCache<String, String>(128)
    private val appIdLock = Mutex()

    suspend fun resolveAppId(game: Game, platform: String): String? {
        if (!PlatformNames.isPc(platform)) return null
        game.steamAppId?.let { return it }
        val key = normalizeLoose(game.originalTitle.ifEmpty { game.title })
        appIdCache[key]?.let { return it }

        return appIdLock.withLock {
            appIdCache[key]?.let { return@withLock it }
            statusTracker.set(DataSource.Steam, SourceStatus.Loading)
            val payload = runCatching {
                val term = cleanTitleForMedia(game.originalTitle.ifEmpty { game.title }).urlEncoded()
                httpClient.getJson(
                    "https://store.steampowered.com/api/storesearch/?term=$term&l=english&cc=us",
                    timeoutMillis = 1_900,
                )
            }.getOrNull()
            if (payload == null) {
                statusTracker.clearLoading(DataSource.Steam)
                return@withLock null
            }
            val matcher = titleMatcherOf(
                title = game.title,
                originalTitle = game.originalTitle,
                aliases = game.aliases,
                year = game.year,
                activePlatform = platform,
            )
            val target = normalizeLoose(game.originalTitle.ifEmpty { game.title })
            val ranked = payload["items"].asArray.mapNotNull { item ->
                val id = item["id"].asString ?: return@mapNotNull null
                val name = item["name"].asString ?: return@mapNotNull null
                val normalized = normalizeLoose(name)
                var score = if (normalized == target) 100 else 0
                if (matcher.installmentMismatch(normalized)) score -= 160
                if (normalized.contains(target) || target.contains(normalized)) score += 45
                score += matcher.keywordHits(normalized) * 8
                id to score
            }.sortedByDescending { it.second }

            val resolved = ranked.firstOrNull()?.takeIf { it.second >= 16 }?.first
            if (resolved != null) {
                appIdCache.put(key, resolved)
                statusTracker.set(DataSource.Steam, SourceStatus.Online)
            } else {
                statusTracker.clearLoading(DataSource.Steam)
            }
            resolved
        }
    }

    /** Steam's vertical "library capsule" is the closest thing it has to box art. */
    suspend fun boxArt(game: Game, platform: String): String? {
        val appId = resolveAppId(game, platform) ?: return null
        statusTracker.set(DataSource.Steam, SourceStatus.Loading)
        val id = appId.urlEncoded()
        val candidates = listOf(
            "https://cdn.cloudflare.steamstatic.com/steam/apps/$id/library_600x900.jpg",
            "https://cdn.cloudflare.steamstatic.com/steam/apps/$id/library_600x900_2x.jpg",
            "https://cdn.akamai.steamstatic.com/steam/apps/$id/library_600x900.jpg",
            "https://cdn.akamai.steamstatic.com/steam/apps/$id/library_600x900_2x.jpg",
        )
        val found = imageProbe.firstMatching(
            urls = candidates,
            timeoutMillis = 1_500,
            batchSize = 2,
            validator = { it.tallerThanWideBy(1.2) },
        )
        if (found != null) statusTracker.set(DataSource.Steam, SourceStatus.Online)
        else statusTracker.clearLoading(DataSource.Steam)
        return found
    }

    suspend fun screenshots(game: Game, platform: String): List<String> {
        val appId = resolveAppId(game, platform) ?: return emptyList()
        statusTracker.set(DataSource.Steam, SourceStatus.Loading)
        return runCatching {
            val payload = httpClient.getJson(
                "https://store.steampowered.com/api/appdetails?appids=${appId.urlEncoded()}&l=english&cc=us",
                timeoutMillis = 2_300,
            )
            val urls = payload[appId]["data"]["screenshots"].asArray
                .mapNotNull { it["path_full"].asString ?: it["path_thumbnail"].asString }
                .take(8)
            if (urls.isNotEmpty()) statusTracker.set(DataSource.Steam, SourceStatus.Online)
            else statusTracker.clearLoading(DataSource.Steam)
            urls
        }.getOrElse {
            statusTracker.set(DataSource.Steam, SourceStatus.Error)
            emptyList()
        }
    }
}

/**
 * GOG catalogue lookups: a second opinion on PC artwork, and often the only source of a vertical
 * cover for older DOS and Windows games Steam never carried.
 */
class GogProvider(
    private val httpClient: HttpClient,
    private val imageProbe: ImageProbe,
    private val statusTracker: SourceStatusTracker,
) {

    private val catalogCache = LruCache<String, JsonObject>(128)
    private val catalogLock = Mutex()

    private suspend fun catalogRecord(game: Game, platform: String): JsonObject? {
        if (!PlatformNames.isPc(platform)) return null
        val key = normalizeLoose(game.originalTitle.ifEmpty { game.title })
        catalogCache[key]?.let { return it }

        return catalogLock.withLock {
            catalogCache[key]?.let { return@withLock it }
            statusTracker.set(DataSource.Gog, SourceStatus.Loading)
            val title = cleanTitleForMedia(game.originalTitle.ifEmpty { game.title })
            val payload = runCatching {
                httpClient.getJson(
                    "https://catalog.gog.com/v1/catalog?query=like:${title.urlEncoded()}" +
                        "&limit=12&countryCode=US&locale=en-US&currencyCode=USD",
                    timeoutMillis = 2_400,
                )
            }.getOrNull()
            if (payload == null) {
                statusTracker.set(DataSource.Gog, SourceStatus.Error)
                return@withLock null
            }
            val matcher = titleMatcherOf(
                title = game.title,
                originalTitle = game.originalTitle,
                aliases = game.aliases,
                year = game.year,
                activePlatform = platform,
            )
            val target = normalizeLoose(title)
            // The endpoint's result key has changed names over time; accept any of them.
            val products = listOf("products", "items", "results")
                .firstNotNullOfOrNull { payload[it]?.asArray?.takeIf { list -> list.isNotEmpty() } }
                .orEmpty()

            val ranked = products.mapNotNull { product ->
                val productTitle = normalizeLoose(
                    product["title"].asString
                        ?: product["name"].asString
                        ?: product["productTitle"].asString
                        ?: return@mapNotNull null,
                )
                var score = if (productTitle == target) 120 else 0
                if (matcher.installmentMismatch(productTitle)) score -= 180
                if (productTitle.contains(target) || target.contains(productTitle)) score += 50
                score += matcher.keywordHits(productTitle) * 7
                product to score
            }.sortedByDescending { it.second }

            val best = ranked.firstOrNull()?.takeIf { it.second >= 24 }?.first as? JsonObject
            if (best != null) {
                catalogCache.put(key, best)
                statusTracker.set(DataSource.Gog, SourceStatus.Online)
            } else {
                statusTracker.clearLoading(DataSource.Gog)
            }
            best
        }
    }

    suspend fun boxArt(game: Game, platform: String): String? {
        val product = catalogRecord(game, platform) ?: return null
        val candidates = listOf(
            product["coverVertical"], product["cover_vertical"],
            product["images"]["vertical"], product["images"]["coverVertical"],
            product["image"], product["cover"],
        ).mapNotNull { normalizeImageUrl(it.asString) }.distinct()
        return imageProbe.firstMatching(
            urls = candidates,
            timeoutMillis = 1_500,
            batchSize = 2,
            validator = { it.tallerThanWideBy(1.14) },
        )
    }

    suspend fun screenshots(game: Game, platform: String): List<String> {
        if (!PlatformNames.isPc(platform)) return emptyList()
        val product = catalogRecord(game, platform) ?: return emptyList()
        val candidates = listOf("screenshots", "gallery", "media", "images")
            .flatMap { collectImageUrls(product[it]) }
            .distinct()
            // Vertical covers and logos live in the same blobs; only wide art is a screenshot.
            .filterNot { COVER_ARTIFACT.containsMatchIn(it) }
            .take(24)
        val found = imageProbe.allMatching(
            urls = candidates,
            limit = 6,
            timeoutMillis = 1_400,
            batchSize = 4,
            validator = { it.widerThanTallBy(1.10) },
        )
        if (found.isNotEmpty()) statusTracker.set(DataSource.Gog, SourceStatus.Online)
        return found
    }

    private companion object {
        val COVER_ARTIFACT = Regex("(cover|logo|icon|product_card|vertical)", RegexOption.IGNORE_CASE)

        /**
         * GOG returns protocol-relative URLs and a `{formatter}` placeholder that has to be
         * substituted with a named size before the CDN will serve the image.
         */
        fun normalizeImageUrl(url: String?): String? {
            if (url.isNullOrBlank()) return null
            var value = url.trim()
            if (value.startsWith("//")) value = "https:$value"
            value = value.replace("{formatter}", "product_card_v2_mobile_slider_639")
            return value.takeIf { Regex("^https?:", RegexOption.IGNORE_CASE).containsMatchIn(it) }
        }

        /** Walks a nested JSON blob for anything that looks like an image URL. */
        fun collectImageUrls(value: JsonElement?, depth: Int = 0): List<String> {
            if (value == null || depth > 3) return emptyList()
            return when (value) {
                is kotlinx.serialization.json.JsonPrimitive ->
                    listOfNotNull(normalizeImageUrl(value.content))
                is kotlinx.serialization.json.JsonArray ->
                    value.flatMap { collectImageUrls(it, depth + 1) }
                is JsonObject -> value.entries
                    .filter { Regex("(screen|gallery|background|hero|image|media)", RegexOption.IGNORE_CASE)
                        .containsMatchIn(it.key) }
                    .flatMap { collectImageUrls(it.value, depth + 1) }
                else -> emptyList()
            }
        }
    }
}

class SteamBoxArtProvider(private val steam: SteamProvider) : BoxArtProvider {
    override val id = "steam"
    override val timeoutMillis = 2_700L
    override fun supports(game: Game, platform: String) = PlatformNames.isPc(platform)
    override suspend fun boxArt(game: Game, platform: String) = steam.boxArt(game, platform)
}

class SteamScreenshotProvider(private val steam: SteamProvider) : ScreenshotProvider {
    override val id = "steam"
    override val timeoutMillis = 3_000L
    override fun supports(game: Game, platform: String) = PlatformNames.isPc(platform)
    override suspend fun screenshots(game: Game, platform: String) = steam.screenshots(game, platform)
}

class GogBoxArtProvider(private val gog: GogProvider) : BoxArtProvider {
    override val id = "gog"
    override val timeoutMillis = 3_600L
    override fun supports(game: Game, platform: String) = PlatformNames.isPc(platform)
    override suspend fun boxArt(game: Game, platform: String) = gog.boxArt(game, platform)
}

class GogScreenshotProvider(private val gog: GogProvider) : ScreenshotProvider {
    override val id = "gog"
    override val timeoutMillis = 3_600L
    override fun supports(game: Game, platform: String) = PlatformNames.isPc(platform)
    override suspend fun screenshots(game: Game, platform: String) = gog.screenshots(game, platform)
}
