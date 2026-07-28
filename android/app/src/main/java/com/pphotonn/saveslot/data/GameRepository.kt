package com.pphotonn.saveslot.data

import com.pphotonn.saveslot.model.AppSettings
import com.pphotonn.saveslot.model.Game
import com.pphotonn.saveslot.model.GameSource
import com.pphotonn.saveslot.model.HealthState
import com.pphotonn.saveslot.model.SearchResponse
import com.pphotonn.saveslot.model.SourceHealth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import kotlin.math.max

class GameRepository(private val store: LocalStore) {
    private val userAgent = "SaveSlotAndroid/1.0 (https://github.com/PphotonN/Save-Slot)"

    suspend fun search(query: String, settings: AppSettings): SearchResponse = withContext(Dispatchers.IO) {
        val cleanQuery = query.trim()
        if (cleanQuery.isBlank()) return@withContext SearchResponse(emptyList(), emptyList(), false)

        val cacheKey = "search|$cleanQuery|${settings.useWikidata}|${settings.rawgApiKey.isNotBlank()}"
        store.readCache(cacheKey, SEARCH_CACHE_TTL)?.let { cached ->
            return@withContext decodeSearchResponse(cached, fromCache = true)
        }

        val health = mutableListOf<SourceHealth>()
        val results = mutableListOf<Game>()

        if (settings.useWikidata) {
            runCatching { searchWikidata(cleanQuery) }
                .onSuccess {
                    results += it
                    health += SourceHealth("Wikidata", HealthState.READY, "${it.size} ігор")
                }
                .onFailure {
                    health += SourceHealth("Wikidata", HealthState.ERROR, it.compactMessage())
                }
        }

        if (settings.rawgApiKey.isNotBlank()) {
            runCatching { searchRawg(cleanQuery, settings.rawgApiKey) }
                .onSuccess {
                    results += it
                    health += SourceHealth("RAWG", HealthState.READY, "${it.size} ігор")
                }
                .onFailure {
                    health += SourceHealth("RAWG", HealthState.ERROR, it.compactMessage())
                }
        } else {
            health += SourceHealth("RAWG", HealthState.IDLE, "Ключ не задано")
        }

        val merged = mergeByIdentity(results)
        val enriched = if (settings.useSteamRatings) enrichSteamRatings(merged) else merged
        val response = SearchResponse(enriched, health, false)
        store.writeCache(cacheKey, encodeSearchResponse(response))
        response
    }

    suspend fun discover(settings: AppSettings): SearchResponse {
        val seeds = listOf(
            "action adventure game", "role-playing video game", "platform game", "survival horror game",
            "racing video game", "strategy video game", "indie video game", "Nintendo game",
            "PlayStation game", "Xbox game", "Sega game", "handheld video game"
        )
        val offset = ((System.currentTimeMillis() / 86_400_000L) % seeds.size).toInt()
        val selected = List(3) { seeds[(offset + it * 3) % seeds.size] }
        val batches = selected.map { seed -> search(seed, settings) }
        val games = mergeByIdentity(batches.flatMap { it.games }).shuffled().take(60)
        val health = batches.flatMap { it.health }
            .groupBy { it.name }
            .map { (name, states) ->
                states.firstOrNull { it.state == HealthState.READY }
                    ?: states.firstOrNull()
                    ?: SourceHealth(name, HealthState.IDLE, "Немає даних")
            }
        return SearchResponse(games, health, batches.all { it.fromCache })
    }

    private suspend fun searchWikidata(query: String): List<Game> {
        val searchUrl = buildUrl(
            "https://www.wikidata.org/w/api.php",
            mapOf(
                "action" to "wbsearchentities",
                "search" to query,
                "language" to "uk",
                "uselang" to "uk",
                "type" to "item",
                "limit" to "45",
                "format" to "json"
            )
        )
        val searchJson = JSONObject(get(searchUrl))
        val ids = searchJson.optJSONArray("search").idsFromSearch()
            .ifEmpty {
                val fallback = buildUrl(
                    "https://www.wikidata.org/w/api.php",
                    mapOf(
                        "action" to "wbsearchentities",
                        "search" to query,
                        "language" to "en",
                        "type" to "item",
                        "limit" to "45",
                        "format" to "json"
                    )
                )
                JSONObject(get(fallback)).optJSONArray("search").idsFromSearch()
            }
        if (ids.isEmpty()) return emptyList()

        val entityUrl = buildUrl(
            "https://www.wikidata.org/w/api.php",
            mapOf(
                "action" to "wbgetentities",
                "ids" to ids.joinToString("|"),
                "props" to "labels|descriptions|claims",
                "languages" to "uk|en",
                "languagefallback" to "1",
                "format" to "json"
            )
        )
        val entities = JSONObject(get(entityUrl)).getJSONObject("entities")

        val relatedIds = linkedSetOf<String>()
        ids.forEach { id ->
            val claims = entities.optJSONObject(id)?.optJSONObject("claims") ?: return@forEach
            relatedIds += claimEntityIds(claims, "P400")
            relatedIds += claimEntityIds(claims, "P136")
        }
        val labels = resolveLabels(relatedIds)

        return buildList {
            ids.forEachIndexed { index, id ->
                val entity = entities.optJSONObject(id) ?: return@forEachIndexed
                val claims = entity.optJSONObject("claims") ?: JSONObject()
                val description = localizedValue(entity.optJSONObject("descriptions"))
                val instances = claimEntityIds(claims, "P31")
                val looksLikeGame = "Q7889" in instances ||
                    description.contains("відеогр", true) ||
                    description.contains("video game", true)
                if (!looksLikeGame) return@forEachIndexed

                val title = localizedValue(entity.optJSONObject("labels")).ifBlank { return@forEachIndexed }
                val platformIds = claimEntityIds(claims, "P400")
                val genreIds = claimEntityIds(claims, "P136")
                val release = firstTime(claims, "P577")
                val image = firstString(claims, "P18")
                val steamId = firstString(claims, "P1733")
                add(
                    Game(
                        id = "wikidata:$id",
                        title = title,
                        description = description,
                        year = release?.take(5)?.drop(1)?.toIntOrNull(),
                        platforms = platformIds.mapNotNull(labels::get).distinct(),
                        genres = genreIds.mapNotNull(labels::get).distinct(),
                        coverUrl = image?.let(::commonsImageUrl),
                        source = GameSource.WIKIDATA,
                        sourceOrder = index,
                        relevance = max(0.0, 100.0 - index),
                        steamAppId = steamId,
                    )
                )
            }
        }
    }

    private suspend fun searchRawg(query: String, key: String): List<Game> {
        val url = buildUrl(
            "https://api.rawg.io/api/games",
            mapOf(
                "key" to key.trim(),
                "search" to query,
                "search_precise" to "true",
                "page_size" to "40"
            )
        )
        val json = JSONObject(get(url))
        val array = json.optJSONArray("results") ?: JSONArray()
        return buildList {
            for (index in 0 until array.length()) {
                val item = array.getJSONObject(index)
                val released = item.optString("released")
                val platforms = item.optJSONArray("platforms").stringValues { platformItem ->
                    platformItem.optJSONObject("platform")?.optString("name").orEmpty()
                }
                val genres = item.optJSONArray("genres").stringValues { it.optString("name") }
                val rating = item.optDouble("rating", 0.0)
                add(
                    Game(
                        id = "rawg:${item.optLong("id")}",
                        title = item.optString("name"),
                        year = released.take(4).toIntOrNull(),
                        platforms = platforms,
                        genres = genres,
                        coverUrl = item.optString("background_image").takeIf(String::isNotBlank),
                        source = GameSource.RAWG,
                        sourceOrder = index,
                        relevance = max(0.0, 95.0 - index),
                        ratingPercent = if (rating > 0.0) (rating * 20).toInt() else null,
                        ratingCount = item.optInt("ratings_count").takeIf { it > 0 },
                    )
                )
            }
        }.filter { it.title.isNotBlank() }
    }

    private suspend fun enrichSteamRatings(games: List<Game>): List<Game> = coroutineScope {
        games.map { game ->
            async(Dispatchers.IO) {
                val appId = game.steamAppId ?: return@async game
                runCatching {
                    val url = "https://store.steampowered.com/appreviews/${encode(appId)}?json=1&language=all&purchase_type=all&filter=summary"
                    val summary = JSONObject(get(url)).optJSONObject("query_summary") ?: return@runCatching game
                    val total = summary.optInt("total_reviews")
                    val positive = summary.optInt("total_positive")
                    if (total <= 0) game else game.copy(
                        ratingPercent = ((positive.toDouble() / total) * 100).toInt(),
                        ratingCount = total,
                    )
                }.getOrDefault(game)
            }
        }.awaitAll()
    }

    private suspend fun resolveLabels(ids: Set<String>): Map<String, String> {
        if (ids.isEmpty()) return emptyMap()
        val result = linkedMapOf<String, String>()
        ids.chunked(45).forEach { chunk ->
            val url = buildUrl(
                "https://www.wikidata.org/w/api.php",
                mapOf(
                    "action" to "wbgetentities",
                    "ids" to chunk.joinToString("|"),
                    "props" to "labels",
                    "languages" to "uk|en",
                    "languagefallback" to "1",
                    "format" to "json"
                )
            )
            val entities = JSONObject(get(url)).getJSONObject("entities")
            chunk.forEach { id ->
                localizedValue(entities.optJSONObject(id)?.optJSONObject("labels"))
                    .takeIf(String::isNotBlank)
                    ?.let { result[id] = it }
            }
        }
        return result
    }

    private fun mergeByIdentity(games: List<Game>): List<Game> {
        val map = linkedMapOf<String, Game>()
        games.forEach { candidate ->
            val key = candidate.title.lowercase().replace(Regex("[^a-zа-яіїєґ0-9]+"), "") + ":${candidate.year ?: 0}"
            val existing = map[key]
            map[key] = if (existing == null) candidate else existing.copy(
                description = existing.description.ifBlank { candidate.description },
                platforms = (existing.platforms + candidate.platforms).distinct(),
                genres = (existing.genres + candidate.genres).distinct(),
                coverUrl = existing.coverUrl ?: candidate.coverUrl,
                ratingPercent = existing.ratingPercent ?: candidate.ratingPercent,
                ratingCount = existing.ratingCount ?: candidate.ratingCount,
                steamAppId = existing.steamAppId ?: candidate.steamAppId,
                relevance = max(existing.relevance, candidate.relevance),
            )
        }
        return map.values.toList()
    }

    private fun claimEntityIds(claims: JSONObject, property: String): List<String> {
        val array = claims.optJSONArray(property) ?: return emptyList()
        return buildList {
            for (index in 0 until array.length()) {
                val id = array.optJSONObject(index)
                    ?.optJSONObject("mainsnak")
                    ?.optJSONObject("datavalue")
                    ?.optJSONObject("value")
                    ?.optString("id")
                if (!id.isNullOrBlank()) add(id)
            }
        }
    }

    private fun firstString(claims: JSONObject, property: String): String? = claims
        .optJSONArray(property)
        ?.optJSONObject(0)
        ?.optJSONObject("mainsnak")
        ?.optJSONObject("datavalue")
        ?.opt("value")
        ?.toString()
        ?.takeIf { it.isNotBlank() && it != "null" }

    private fun firstTime(claims: JSONObject, property: String): String? = claims
        .optJSONArray(property)
        ?.optJSONObject(0)
        ?.optJSONObject("mainsnak")
        ?.optJSONObject("datavalue")
        ?.optJSONObject("value")
        ?.optString("time")

    private fun localizedValue(values: JSONObject?): String {
        if (values == null) return ""
        return values.optJSONObject("uk")?.optString("value")
            ?.takeIf(String::isNotBlank)
            ?: values.optJSONObject("en")?.optString("value").orEmpty()
    }

    private fun JSONArray?.idsFromSearch(): List<String> {
        if (this == null) return emptyList()
        return buildList {
            for (index in 0 until length()) {
                optJSONObject(index)?.optString("id")?.takeIf(String::isNotBlank)?.let(::add)
            }
        }
    }

    private fun JSONArray?.stringValues(transform: (JSONObject) -> String): List<String> {
        if (this == null) return emptyList()
        return buildList {
            for (index in 0 until length()) {
                optJSONObject(index)?.let(transform)?.takeIf(String::isNotBlank)?.let(::add)
            }
        }
    }

    private fun commonsImageUrl(filename: String): String =
        "https://commons.wikimedia.org/wiki/Special:FilePath/${encode(filename)}?width=600"

    private fun buildUrl(base: String, parameters: Map<String, String>): String =
        base + "?" + parameters.entries.joinToString("&") { "${encode(it.key)}=${encode(it.value)}" }

    private fun encode(value: String): String = URLEncoder.encode(value, StandardCharsets.UTF_8.toString())

    private fun get(url: String): String {
        val connection = URI(url).toURL().openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 12_000
            connection.readTimeout = 18_000
            connection.setRequestProperty("User-Agent", userAgent)
            connection.setRequestProperty("Accept", "application/json")
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) error("HTTP $code")
            body
        } finally {
            connection.disconnect()
        }
    }

    private fun encodeSearchResponse(response: SearchResponse): String {
        val root = JSONObject().put("fromCache", response.fromCache)
        val games = JSONArray()
        response.games.forEach { game ->
            games.put(
                JSONObject()
                    .put("id", game.id)
                    .put("title", game.title)
                    .put("description", game.description)
                    .put("year", game.year)
                    .put("platforms", JSONArray(game.platforms))
                    .put("genres", JSONArray(game.genres))
                    .put("coverUrl", game.coverUrl)
                    .put("source", game.source.name)
                    .put("sourceOrder", game.sourceOrder)
                    .put("relevance", game.relevance)
                    .put("ratingPercent", game.ratingPercent)
                    .put("ratingCount", game.ratingCount)
                    .put("steamAppId", game.steamAppId)
            )
        }
        val health = JSONArray()
        response.health.forEach {
            health.put(JSONObject().put("name", it.name).put("state", it.state.name).put("message", it.message))
        }
        return root.put("games", games).put("health", health).toString()
    }

    private fun decodeSearchResponse(raw: String, fromCache: Boolean): SearchResponse {
        val root = JSONObject(raw)
        val gamesArray = root.optJSONArray("games") ?: JSONArray()
        val games = buildList {
            for (index in 0 until gamesArray.length()) {
                val item = gamesArray.getJSONObject(index)
                add(
                    Game(
                        id = item.getString("id"),
                        title = item.getString("title"),
                        description = item.optString("description"),
                        year = item.optInt("year").takeIf { item.has("year") },
                        platforms = item.optJSONArray("platforms").toStrings(),
                        genres = item.optJSONArray("genres").toStrings(),
                        coverUrl = item.optString("coverUrl").takeIf { it.isNotBlank() && it != "null" },
                        source = runCatching { GameSource.valueOf(item.optString("source")) }
                            .getOrDefault(GameSource.LOCAL_FALLBACK),
                        sourceOrder = item.optInt("sourceOrder", index),
                        relevance = item.optDouble("relevance", 0.0),
                        ratingPercent = item.optInt("ratingPercent").takeIf { item.has("ratingPercent") },
                        ratingCount = item.optInt("ratingCount").takeIf { item.has("ratingCount") },
                        steamAppId = item.optString("steamAppId").takeIf { it.isNotBlank() && it != "null" },
                    )
                )
            }
        }
        val healthArray = root.optJSONArray("health") ?: JSONArray()
        val health = buildList {
            for (index in 0 until healthArray.length()) {
                val item = healthArray.getJSONObject(index)
                add(
                    SourceHealth(
                        name = item.optString("name"),
                        state = runCatching { HealthState.valueOf(item.optString("state")) }
                            .getOrDefault(HealthState.IDLE),
                        message = item.optString("message"),
                    )
                )
            }
        }
        return SearchResponse(games, health, fromCache)
    }

    private fun JSONArray?.toStrings(): List<String> {
        if (this == null) return emptyList()
        return buildList {
            for (index in 0 until length()) optString(index).takeIf(String::isNotBlank)?.let(::add)
        }
    }

    private fun Throwable.compactMessage(): String = message?.take(80) ?: "Невідома помилка"

    companion object {
        private const val SEARCH_CACHE_TTL = 12L * 60L * 60L * 1000L
    }
}
