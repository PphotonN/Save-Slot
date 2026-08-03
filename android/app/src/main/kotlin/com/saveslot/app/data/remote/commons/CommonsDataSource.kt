package com.saveslot.app.data.remote.commons

import com.saveslot.app.core.net.HttpClient
import com.saveslot.app.core.net.asArray
import com.saveslot.app.core.net.asInt
import com.saveslot.app.core.net.asString
import com.saveslot.app.core.net.get
import com.saveslot.app.data.remote.wikidata.urlEncoded
import com.saveslot.app.data.remote.wikipedia.WikiImage

/**
 * Wikimedia Commons: freely licensed covers and screenshots.
 *
 * Commons is queried two ways — by full-text file search, and by the Commons category a Wikidata
 * item points at (P373), which is far more precise when present.
 */
class CommonsDataSource(private val httpClient: HttpClient) {

    /** Full-text search restricted to the File namespace (6). */
    suspend fun searchFiles(query: String, limit: Int): List<String> = runCatching {
        val url = buildString {
            append("$API?origin=*&action=query&format=json&list=search")
            append("&srnamespace=6&srlimit=$limit&srsearch=${query.urlEncoded()}")
        }
        httpClient.getJson(url, timeoutMillis = 3_200)["query"]["search"].asArray
            .mapNotNull { it["title"].asString }
    }.getOrDefault(emptyList())

    /** Files filed under a game's Commons category. */
    suspend fun categoryFiles(category: String, limit: Int = 80): List<String> {
        val trimmed = category.trim()
        if (trimmed.isEmpty()) return emptyList()
        val title = if (trimmed.startsWith("Category:")) trimmed else "Category:$trimmed"
        return runCatching {
            val url = buildString {
                append("$API?origin=*&action=query&format=json&formatversion=2")
                append("&list=categorymembers&cmnamespace=6&cmtype=file&cmlimit=$limit")
                append("&cmtitle=${title.urlEncoded()}")
            }
            httpClient.getJson(url, timeoutMillis = 2_300)["query"]["categorymembers"].asArray
                .mapNotNull { it["title"].asString }
        }.getOrDefault(emptyList())
    }

    /** Resolves file titles to thumbnail URLs plus dimensions and MIME type. */
    suspend fun imageInfo(
        fileTitles: List<String>,
        thumbWidth: Int,
        timeoutMillis: Long = 2_400,
    ): List<WikiImage> {
        if (fileTitles.isEmpty()) return emptyList()
        return runCatching {
            val url = buildString {
                append("$API?origin=*&action=query&format=json&formatversion=2")
                append("&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=$thumbWidth")
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

    private companion object {
        const val API = "https://commons.wikimedia.org/w/api.php"
    }
}
