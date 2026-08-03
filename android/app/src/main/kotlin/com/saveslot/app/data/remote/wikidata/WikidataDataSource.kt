package com.saveslot.app.data.remote.wikidata

import com.saveslot.app.core.net.HttpClient
import com.saveslot.app.core.net.asArray
import com.saveslot.app.core.net.asString
import com.saveslot.app.core.net.get
import com.saveslot.app.core.net.objectValues
import com.saveslot.app.core.text.GameTitles
import com.saveslot.app.core.text.PlatformNames
import com.saveslot.app.core.text.normalizeLoose
import com.saveslot.app.data.remote.SourceStatusTracker
import com.saveslot.app.domain.model.DataSource
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SearchFilters
import com.saveslot.app.domain.model.SourceStatus
import java.net.URLEncoder
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/** A search hit before the full entity is fetched. */
data class WikidataHit(
    val id: String,
    val label: String?,
    val description: String?,
)

/**
 * Wikidata is the app's source of truth for what a game *is*: title, year, platforms, genres,
 * studios and series. Everything else in the data layer decorates these facts.
 */
class WikidataDataSource(
    private val httpClient: HttpClient,
    private val statusTracker: SourceStatusTracker,
) {

    /** Free-text entity search, run once per language so Ukrainian labels are not missed. */
    suspend fun search(query: String, language: String, limit: Int): List<WikidataHit> {
        val url = buildString {
            append("$API?action=wbsearchentities&format=json&origin=*&type=item")
            append("&language=$language&uselang=$language")
            append("&limit=$limit&search=${query.urlEncoded()}")
        }
        val payload = httpClient.getJson(url, timeoutMillis = 9_000)
        return payload["search"].asArray.mapNotNull { hit ->
            val id = hit["id"].asString ?: return@mapNotNull null
            WikidataHit(
                id = id,
                label = hit["label"].asString,
                description = hit["description"].asString,
            )
        }
    }

    /** Full entities including claims and sitelinks, for the two languages the app renders. */
    suspend fun entities(ids: List<String>): Map<String, JsonElement> {
        if (ids.isEmpty()) return emptyMap()
        val url = buildString {
            append("$API?action=wbgetentities&format=json&origin=*")
            append("&props=labels|aliases|descriptions|claims|sitelinks")
            append("&languages=uk|en&sitefilter=ukwiki|enwiki")
            append("&ids=${ids.joinToString("|")}")
        }
        val payload = httpClient.getJson(url, timeoutMillis = 12_000)
        return (payload["entities"] as? JsonObject)?.toMap().orEmpty()
    }

    /**
     * Resolves referenced entity ids (platforms, genres, studios) to display labels.
     * Chunked because `wbgetentities` accepts at most 50 ids per call.
     */
    suspend fun labels(ids: List<String>): Map<String, String> {
        if (ids.isEmpty()) return emptyMap()
        val output = mutableMapOf<String, String>()
        ids.distinct().chunked(50).forEach { chunk ->
            val url = buildString {
                append("$API?action=wbgetentities&format=json&origin=*&props=labels")
                append("&languages=uk|en&ids=${chunk.joinToString("|")}")
            }
            val payload = runCatching { httpClient.getJson(url, timeoutMillis = 10_000) }.getOrNull()
                ?: return@forEach
            payload["entities"].objectValues().forEach { entity ->
                val id = entity["id"].asString ?: return@forEach
                val label = GameTitles.chooseBest(
                    listOf(
                        entity["labels"]["uk"]["value"].asString,
                        entity["labels"]["en"]["value"].asString,
                        entity["sitelinks"]["ukwiki"]["title"].asString,
                        entity["sitelinks"]["enwiki"]["title"].asString,
                        id,
                    ),
                )
                if (label.isNotEmpty()) output[id] = label
            }
        }
        return output
    }

    /**
     * SPARQL query for browsing by platform/genre/year with no text query.
     *
     * `P31/P279*` walks the subclass chain up to "video game" so subtypes such as visual novels
     * are included; the same trick on `P136` catches genre subgenres.
     */
    suspend fun idsByFilters(
        filters: SearchFilters,
        platformEntityId: String?,
        genreEntityId: String?,
        limit: Int,
    ): List<String> {
        val clauses = buildList {
            add("?game wdt:P31/wdt:P279* wd:Q7889 .")
            platformEntityId?.let { add("?game wdt:P400 wd:$it .") }
            genreEntityId?.let { add("?game wdt:P136/wdt:P279* wd:$it .") }
            if (filters.yearFrom > 0 || filters.yearTo > 0) {
                add("?game wdt:P577 ?releaseDate .")
                if (filters.yearFrom > 0) add("FILTER(YEAR(?releaseDate) >= ${filters.yearFrom})")
                if (filters.yearTo > 0) add("FILTER(YEAR(?releaseDate) <= ${filters.yearTo})")
            }
        }
        val sparql = "SELECT DISTINCT ?game WHERE { ${clauses.joinToString(" ")} } LIMIT ${minOf(50, limit + 12)}"
        statusTracker.set(DataSource.Wikidata, SourceStatus.Loading)
        val url = "$SPARQL?format=json&query=${sparql.urlEncoded()}"
        val payload = httpClient.getJson(url, timeoutMillis = 10_000)
        val ids = payload["results"]["bindings"].asArray.mapNotNull { row ->
            row["game"]["value"].asString?.let { ENTITY_SUFFIX.find(it)?.value }
        }.distinct().take(50)
        if (ids.isNotEmpty()) statusTracker.set(DataSource.Wikidata, SourceStatus.Online)
        return ids
    }

    /**
     * Finds the entity id behind a human-readable filter value, e.g. "Nintendo 64" -> Q184839.
     * Descriptions are scored so a console named like a game does not win.
     */
    suspend fun resolveFilterEntityId(label: String, kind: FilterKind): String? {
        if (label.isBlank()) return null
        val hits = buildList {
            for (language in listOf("uk", "en")) {
                runCatching { addAll(search(label, language, limit = 10)) }
            }
        }.distinctBy { it.id }
        val target = normalizeLoose(label)
        val ranked = hits.map { hit ->
            val name = normalizeLoose(hit.label.orEmpty())
            val description = normalizeLoose(hit.description.orEmpty())
            var score = if (name == target) 100 else 0
            if (name.contains(target) || target.contains(name)) score += 40
            if (kind.descriptionHint.containsMatchIn(description)) score += 35
            hit to score
        }.sortedByDescending { it.second }
        return ranked.firstOrNull()?.takeIf { it.second >= 35 }?.first?.id
    }

    enum class FilterKind(val descriptionHint: Regex) {
        Platform(
            Regex(
                "(video game console|gaming platform|home video game console|handheld game console|ігрова консоль|платформа)",
                RegexOption.IGNORE_CASE,
            ),
        ),
        Genre(
            Regex(
                "(video game genre|genre of video game|жанр відеоігор|жанр відеогри)",
                RegexOption.IGNORE_CASE,
            ),
        ),
    }

    companion object {
        private const val API = "https://www.wikidata.org/w/api.php"
        private const val SPARQL = "https://query.wikidata.org/sparql"
        private val ENTITY_SUFFIX = Regex("Q\\d+$")

        /** Wikidata classes that count as a game: video game, visual novel, mod, game expansion. */
        private val GAME_CLASSES = setOf("Q7889", "Q7058673", "Q115123401", "Q1066707")
        private val GAME_DESCRIPTION = Regex(
            "(video game|computer game|arcade game|відеогра|комп'ютерна гра|комп’ютерна гра|гра для|visual novel)",
            RegexOption.IGNORE_CASE,
        )

        /**
         * Search results include films, albums and books that share a game's name, so an entity is
         * only accepted if its description reads like a game or it is an instance of a game class.
         */
        fun isLikelyGame(entity: JsonElement, hit: WikidataHit?): Boolean {
            val description = (
                entity["descriptions"]["uk"]["value"].asString
                    ?: entity["descriptions"]["en"]["value"].asString
                    ?: hit?.description
                ).orEmpty()
            if (GAME_DESCRIPTION.containsMatchIn(description)) return true
            return claimEntityIds(entity, "P31").any { it in GAME_CLASSES }
        }

        fun claimEntityIds(entity: JsonElement, property: String): List<String> =
            entity["claims"][property].asArray.mapNotNull {
                it["mainsnak"]["datavalue"]["value"]["id"].asString
            }

        fun claimStrings(entity: JsonElement, property: String): List<String> =
            entity["claims"][property].asArray.mapNotNull {
                it["mainsnak"]["datavalue"]["value"].asString
            }

        fun claimTimes(entity: JsonElement, property: String): List<String> =
            entity["claims"][property].asArray.mapNotNull {
                it["mainsnak"]["datavalue"]["value"]["time"].asString
            }

        fun description(entity: JsonElement, hit: WikidataHit?): String =
            entity["descriptions"]["uk"]["value"].asString
                ?: entity["descriptions"]["en"]["value"].asString
                ?: hit?.description
                ?: ""

        /** Best display title, falling back through labels, sitelinks, aliases and description. */
        fun resolveTitle(entity: JsonElement, hit: WikidataHit?): String {
            val aliases = entity["aliases"]["uk"].asArray.mapNotNull { it["value"].asString } +
                entity["aliases"]["en"].asArray.mapNotNull { it["value"].asString }
            return GameTitles.chooseBest(
                listOf(
                    entity["labels"]["uk"]["value"].asString,
                    entity["labels"]["en"]["value"].asString,
                    hit?.label,
                    entity["sitelinks"]["ukwiki"]["title"].asString,
                    entity["sitelinks"]["enwiki"]["title"].asString,
                ) + aliases + listOf(GameTitles.inferFromDescription(description(entity, hit))),
            )
        }

        /**
         * Maps a Wikidata entity onto the app's [Game].
         *
         * Property ids: P577 release date, P18 image, P400 platform, P136 genre, P178 developer,
         * P123 publisher, P179 series, P1733 Steam app id, P373 Commons category.
         */
        fun toGame(
            entity: JsonElement,
            labels: Map<String, String>,
            hit: WikidataHit?,
        ): Game? {
            val id = entity["id"].asString ?: return null
            val title = resolveTitle(entity, hit).ifEmpty { GameTitles.PENDING_TITLE }
            val englishTitle = entity["labels"]["en"]["value"].asString
            val description = description(entity, hit)
            // Release dates arrive as "+1998-11-21T00:00:00Z"; the earliest one is the debut year.
            val year = claimTimes(entity, "P577")
                .mapNotNull { Regex("[+-](\\d{4})").find(it)?.groupValues?.getOrNull(1)?.toIntOrNull() }
                .minOrNull()
            val imageFilename = claimStrings(entity, "P18").firstOrNull()
            val platforms = PlatformNames.sanitize(
                claimEntityIds(entity, "P400").map { labels[it] ?: it },
                isPlatform = true,
            )
            val genres = PlatformNames.sanitize(
                claimEntityIds(entity, "P136").map { labels[it] ?: it },
                isPlatform = false,
            )
            return Game(
                id = id,
                title = title,
                originalTitle = englishTitle ?: title,
                aliases = (
                    entity["aliases"]["uk"].asArray.mapNotNull { it["value"].asString } +
                        entity["aliases"]["en"].asArray.mapNotNull { it["value"].asString }
                    ).distinct().take(16),
                description = description,
                year = year,
                platforms = platforms,
                genres = genres,
                developers = PlatformNames.sanitize(
                    claimEntityIds(entity, "P178").map { labels[it] ?: it },
                    isPlatform = false,
                ),
                publishers = PlatformNames.sanitize(
                    claimEntityIds(entity, "P123").map { labels[it] ?: it },
                    isPlatform = false,
                ),
                series = PlatformNames.sanitize(
                    claimEntityIds(entity, "P179").map { labels[it] ?: it },
                    isPlatform = false,
                ),
                steamAppId = claimStrings(entity, "P1733").firstOrNull(),
                commonsCategory = claimStrings(entity, "P373").firstOrNull(),
                provisionalCover = imageFilename?.let { commonsImageUrl(it, width = 900) },
                provisionalCoverFilename = imageFilename,
                selectedPlatform = PlatformNames.inferPrimary(platforms, description),
                ukWikiTitle = entity["sitelinks"]["ukwiki"]["title"].asString,
                enWikiTitle = entity["sitelinks"]["enwiki"]["title"].asString,
            )
        }

        fun commonsImageUrl(filename: String, width: Int = 900): String =
            "https://commons.wikimedia.org/wiki/Special:Redirect/file/" +
                filename.replace(' ', '_').urlEncoded() + "?width=$width"
    }
}

internal fun String.urlEncoded(): String = URLEncoder.encode(this, "UTF-8").replace("+", "%20")
