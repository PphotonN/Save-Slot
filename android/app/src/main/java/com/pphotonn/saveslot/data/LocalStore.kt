package com.pphotonn.saveslot.data

import android.content.Context
import com.pphotonn.saveslot.model.AppSettings
import com.pphotonn.saveslot.model.Game
import com.pphotonn.saveslot.model.GameSource
import com.pphotonn.saveslot.model.LibraryEntry
import com.pphotonn.saveslot.model.PlayStatus
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class LocalStore(context: Context) {
    private val appContext = context.applicationContext
    private val preferences = appContext.getSharedPreferences("save_slot", Context.MODE_PRIVATE)
    private val cacheDir = File(appContext.cacheDir, "search").apply { mkdirs() }

    fun loadSettings(): AppSettings = AppSettings(
        useWikidata = preferences.getBoolean("source_wikidata", true),
        useSteamRatings = preferences.getBoolean("source_steam", true),
        rawgApiKey = preferences.getString("rawg_key", "").orEmpty(),
        reducedMotion = preferences.getBoolean("reduced_motion", false),
    )

    fun saveSettings(settings: AppSettings) {
        preferences.edit()
            .putBoolean("source_wikidata", settings.useWikidata)
            .putBoolean("source_steam", settings.useSteamRatings)
            .putString("rawg_key", settings.rawgApiKey.trim())
            .putBoolean("reduced_motion", settings.reducedMotion)
            .apply()
    }

    fun loadLibrary(): List<LibraryEntry> {
        val raw = preferences.getString("library_json", null) ?: return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            buildList {
                for (index in 0 until array.length()) {
                    add(entryFromJson(array.getJSONObject(index)))
                }
            }
        }.getOrDefault(emptyList())
    }

    fun saveLibrary(entries: List<LibraryEntry>) {
        val array = JSONArray()
        entries.forEach { array.put(entryToJson(it)) }
        preferences.edit().putString("library_json", array.toString()).apply()
    }

    fun exportLibrary(entries: List<LibraryEntry>): String {
        val root = JSONObject()
            .put("schema", 1)
            .put("exportedAt", System.currentTimeMillis())
        val array = JSONArray()
        entries.forEach { array.put(entryToJson(it)) }
        root.put("entries", array)
        return root.toString(2)
    }

    fun importLibrary(json: String): List<LibraryEntry> {
        val root = JSONObject(json)
        val array = root.optJSONArray("entries") ?: JSONArray()
        return buildList {
            for (index in 0 until array.length()) {
                add(entryFromJson(array.getJSONObject(index)))
            }
        }
    }

    fun readCache(key: String, maxAgeMillis: Long): String? {
        val file = cacheFile(key)
        if (!file.exists()) return null
        if (System.currentTimeMillis() - file.lastModified() > maxAgeMillis) {
            file.delete()
            return null
        }
        return runCatching { file.readText() }.getOrNull()
    }

    fun writeCache(key: String, value: String) {
        runCatching { cacheFile(key).writeText(value) }
    }

    fun clearCache(): Int {
        val files = cacheDir.listFiles().orEmpty()
        val count = files.count { it.isFile }
        files.forEach { it.deleteRecursively() }
        return count
    }

    fun cacheSizeBytes(): Long = cacheDir.walkTopDown().filter { it.isFile }.sumOf { it.length() }

    private fun cacheFile(key: String): File {
        val safe = key.hashCode().toUInt().toString(16)
        return File(cacheDir, "$safe.json")
    }

    private fun entryToJson(entry: LibraryEntry): JSONObject = JSONObject()
        .put("game", gameToJson(entry.game))
        .put("collection", entry.collection)
        .put("status", entry.status.name)
        .put("priority", entry.priority)
        .put("personalRating", entry.personalRating)
        .put("notes", entry.notes)
        .put("addedAt", entry.addedAt)

    private fun entryFromJson(json: JSONObject): LibraryEntry = LibraryEntry(
        game = gameFromJson(json.getJSONObject("game")),
        collection = json.optString("collection", "Основний список"),
        status = runCatching { PlayStatus.valueOf(json.optString("status")) }
            .getOrDefault(PlayStatus.PLANNED),
        priority = json.optInt("priority", 3).coerceIn(1, 5),
        personalRating = json.optInt("personalRating").takeIf { json.has("personalRating") },
        notes = json.optString("notes"),
        addedAt = json.optLong("addedAt", System.currentTimeMillis()),
    )

    private fun gameToJson(game: Game): JSONObject = JSONObject()
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

    private fun gameFromJson(json: JSONObject): Game = Game(
        id = json.getString("id"),
        title = json.getString("title"),
        description = json.optString("description"),
        year = json.optInt("year").takeIf { json.has("year") },
        platforms = json.optJSONArray("platforms").toStringList(),
        genres = json.optJSONArray("genres").toStringList(),
        coverUrl = json.optString("coverUrl").takeIf { it.isNotBlank() && it != "null" },
        source = runCatching { GameSource.valueOf(json.optString("source")) }
            .getOrDefault(GameSource.LOCAL_FALLBACK),
        sourceOrder = json.optInt("sourceOrder", Int.MAX_VALUE),
        relevance = json.optDouble("relevance", 0.0),
        ratingPercent = json.optInt("ratingPercent").takeIf { json.has("ratingPercent") },
        ratingCount = json.optInt("ratingCount").takeIf { json.has("ratingCount") },
        steamAppId = json.optString("steamAppId").takeIf { it.isNotBlank() && it != "null" },
    )

    private fun JSONArray?.toStringList(): List<String> {
        if (this == null) return emptyList()
        return buildList {
            for (index in 0 until length()) add(optString(index))
        }.filter { it.isNotBlank() }
    }
}
