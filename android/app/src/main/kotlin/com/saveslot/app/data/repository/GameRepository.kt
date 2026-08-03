package com.saveslot.app.data.repository

import com.saveslot.app.core.net.asString
import com.saveslot.app.core.net.get
import com.saveslot.app.core.text.GameTitles
import com.saveslot.app.core.text.cleanTitleForMedia
import com.saveslot.app.core.text.filenameFromUrl
import com.saveslot.app.core.text.normalizeLoose
import com.saveslot.app.data.local.CachedGameEntity
import com.saveslot.app.data.local.GameCacheDao
import com.saveslot.app.data.local.GameSerializer
import com.saveslot.app.data.local.QueryCacheDao
import com.saveslot.app.data.local.QueryCacheEntity
import com.saveslot.app.data.remote.SourceStatusTracker
import com.saveslot.app.data.remote.media.MediaResolver
import com.saveslot.app.data.remote.wikidata.WikidataDataSource
import com.saveslot.app.data.remote.wikidata.WikidataHit
import com.saveslot.app.data.remote.wikipedia.WikipediaDataSource
import com.saveslot.app.domain.model.DataSource
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.MediaRecord
import com.saveslot.app.domain.model.SearchFilters
import com.saveslot.app.domain.model.SourceStatus
import kotlin.time.Clock
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.JsonElement
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

/**
 * Search, discovery and artwork for games, backed by a local cache.
 *
 * Every result is written through to the cache, and searches record which ids they produced, so a
 * repeated query — or a launch with no connectivity — is answered locally. Media resolution is
 * separate from metadata: a game appears as soon as Wikidata answers, and its cover fills in when
 * the artwork chain finishes.
 */
class GameRepository(
    private val wikidata: WikidataDataSource,
    private val wikipedia: WikipediaDataSource,
    private val mediaResolver: MediaResolver,
    private val gameCacheDao: GameCacheDao,
    private val queryCacheDao: QueryCacheDao,
    private val serializer: GameSerializer,
    private val statusTracker: SourceStatusTracker,
    private val clock: Clock = Clock.System,
) {

    /** Guards against two screens resolving the same game's artwork at once. */
    private val mediaLocks = mutableMapOf<String, Mutex>()
    private val mediaLocksGuard = Mutex()

    /** Caps concurrent artwork resolution so scrolling a rail cannot open dozens of sockets. */
    private val mediaPermits = Semaphore(MEDIA_CONCURRENCY)

    val cacheSizeBytes: Flow<Long> = gameCacheDao.approximateBytes().map { it ?: 0L }

    val lastUpdate: Flow<Long> = gameCacheDao.lastUpdate().map { it ?: 0L }

    // --- Search ---------------------------------------------------------------------------------

    /**
     * Full search: Wikidata entity search in both languages, with Wikipedia article search as a
     * backstop when Wikidata's own index is thin for the term.
     *
     * @param lightweight trims the Wikipedia enrichment to a short extract, used for rails where
     *   the long description would never be read.
     */
    suspend fun search(
        query: String,
        limit: Int = 18,
        useCache: Boolean = true,
        lightweight: Boolean = false,
    ): List<Game> {
        val normalized = query.trim().lowercase()
        if (normalized.isEmpty()) return emptyList()

        if (useCache) {
            cachedResults(normalized, limit)?.let { return it }
        }

        statusTracker.set(DataSource.Wikidata, SourceStatus.Loading)
        val candidates = try {
            coroutineScope {
                val uk = async { runCatching { wikidata.search(query, "uk", minOf(limit + 6, 30)) }.getOrDefault(emptyList()) }
                val en = async { runCatching { wikidata.search(query, "en", minOf(limit + 6, 30)) }.getOrDefault(emptyList()) }
                (uk.await() + en.await()).distinctBy { it.id }
            }.also { statusTracker.set(DataSource.Wikidata, SourceStatus.Online) }
        } catch (error: Throwable) {
            statusTracker.set(DataSource.Wikidata, SourceStatus.Error)
            throw error
        }

        val withFallback = if (candidates.size < MIN_CANDIDATES_BEFORE_FALLBACK) {
            val extra = coroutineScope {
                listOf("uk", "en").map { language ->
                    async { runCatching { wikipedia.searchGames(query, language) }.getOrDefault(emptyList()) }
                }.awaitAll().flatten()
            }
            (candidates + extra).distinctBy { it.id }
        } else {
            candidates
        }

        val games = hydrate(withFallback, limit, lightweight)
        val ranked = rankAndDedupe(games, query).take(limit)
        cacheGames(ranked)
        rememberQuery(normalized, ranked)
        return ranked
    }

    /** Filter-only browsing, via SPARQL, for when the user picks a platform/genre with no query. */
    suspend fun searchByFilters(filters: SearchFilters, limit: Int = 28): List<Game> {
        val normalized = filters.normalized()
        val (platformId, genreId) = coroutineScope {
            val platform = async {
                normalized.platform.takeIf { it.isNotEmpty() }?.let {
                    runCatching {
                        wikidata.resolveFilterEntityId(it, WikidataDataSource.FilterKind.Platform)
                    }.getOrNull()
                }
            }
            val genre = async {
                normalized.genre.takeIf { it.isNotEmpty() }?.let {
                    runCatching {
                        wikidata.resolveFilterEntityId(it, WikidataDataSource.FilterKind.Genre)
                    }.getOrNull()
                }
            }
            platform.await() to genre.await()
        }

        val ids = wikidata.idsByFilters(normalized, platformId, genreId, limit)
        if (ids.isEmpty()) {
            // No SPARQL matches: fall back to a text search built from the filter labels, which
            // still surfaces something useful when an entity id could not be resolved.
            val fallbackQuery = listOfNotNull(
                normalized.platform.takeIf { it.isNotEmpty() },
                normalized.genre.takeIf { it.isNotEmpty() },
                "video game",
            ).joinToString(" ")
            return search(fallbackQuery, limit, useCache = true, lightweight = true)
        }

        val hits = ids.map { WikidataHit(id = it, label = null, description = null) }
        val games = hydrate(hits, limit, lightweight = true)
        cacheGames(games)
        return games
    }

    /**
     * Turns search hits into games: fetch entities, resolve referenced labels, filter out non-games,
     * then enrich with Wikipedia prose.
     */
    private suspend fun hydrate(
        hits: List<WikidataHit>,
        limit: Int,
        lightweight: Boolean,
    ): List<Game> {
        val ids = hits.map { it.id }.filter { ENTITY_ID.matches(it) }.take(50)
        if (ids.isEmpty()) return emptyList()

        val entities = wikidata.entities(ids)
        val hitsById = hits.associateBy { it.id }
        val gameEntities = entities.values.filter {
            WikidataDataSource.isLikelyGame(it, hitsById[it.entityId()])
        }
        if (gameEntities.isEmpty()) return emptyList()

        // Platforms, genres, studios and series are referenced by id; resolve them in one batch.
        val dependencyIds = gameEntities.flatMap { entity ->
            LABEL_PROPERTIES.flatMap { WikidataDataSource.claimEntityIds(entity, it) }
        }.distinct()
        val labels = wikidata.labels(dependencyIds)

        val games = gameEntities.mapNotNull { entity ->
            WikidataDataSource.toGame(entity, labels, hitsById[entity.entityId()])
        }.take(limit)

        return enrichAll(games, lightweight)
    }

    /** Adds the article extract and, if the entity had no image, the article's lead image. */
    private suspend fun enrichAll(games: List<Game>, lightweight: Boolean): List<Game> =
        coroutineScope {
            val permits = Semaphore(ENRICH_CONCURRENCY)
            games.map { game ->
                async { permits.withPermit { enrich(game, lightweight) } }
            }.awaitAll()
        }

    private suspend fun enrich(game: Game, lightweight: Boolean): Game {
        val language = when {
            game.ukWikiTitle != null -> "uk"
            game.enWikiTitle != null -> "en"
            else -> return game
        }
        val title = game.wikiTitles[language] ?: return game
        val summary = wikipedia.articleSummary(title, language, lightweight) ?: return game
        var enriched = game
        // Only replace the Wikidata one-liner when the article actually says more.
        summary.extract?.let { extract ->
            if (extract.length > game.description.length) enriched = enriched.copy(description = extract)
        }
        if (enriched.provisionalCover == null) {
            summary.thumbnailUrl?.let { url ->
                enriched = enriched.copy(
                    provisionalCover = url,
                    provisionalCoverFilename = filenameFromUrl(url),
                )
                statusTracker.set(DataSource.Wikimedia, SourceStatus.Online)
            }
        }
        return enriched
    }

    // --- Artwork --------------------------------------------------------------------------------

    /**
     * Resolves and caches artwork for one platform of a game.
     *
     * A negative result is remembered with a timestamp rather than permanently, because artwork
     * misses are usually a slow provider rather than a genuine absence; after
     * [NEGATIVE_RETRY_MILLIS] the chain is allowed to try again.
     *
     * @param includeScreenshots screenshots cost several more requests, so rails skip them and only
     *   the detail screen asks for them.
     */
    suspend fun resolveMedia(
        game: Game,
        platform: String = game.activePlatform,
        includeScreenshots: Boolean = false,
    ): Game {
        val lockKey = "${game.id}|$platform"
        val mutex = mediaLocksGuard.withLock { mediaLocks.getOrPut(lockKey) { Mutex() } }

        return mutex.withLock {
            val cached = loadCached(game.id) ?: game
            var record = cached.mediaFor(platform)
            val now = clock.now().toEpochMilliseconds()

            val retryBoxArt = record.boxArt == null &&
                (record.boxArtCheckedAt == 0L || now - record.boxArtCheckedAt > NEGATIVE_RETRY_MILLIS)
            if (!record.boxArtResolved || retryBoxArt) {
                val resolved = mediaPermits.withPermit {
                    runCatching { mediaResolver.resolveBoxArt(game, platform) }.getOrNull()
                }
                record = record.copy(
                    platform = platform,
                    boxArt = resolved?.value,
                    boxArtSource = resolved?.source,
                    boxArtResolved = true,
                    boxArtCheckedAt = now,
                )
            }

            val retryScreens = record.screenshots.isEmpty() &&
                (record.screenshotsCheckedAt == 0L || now - record.screenshotsCheckedAt > NEGATIVE_RETRY_MILLIS)
            if (includeScreenshots && (!record.screenshotsResolved || retryScreens)) {
                val resolved = mediaPermits.withPermit {
                    runCatching { mediaResolver.resolveScreenshots(game, platform) }.getOrNull()
                }
                record = record.copy(
                    screenshots = resolved?.value.orEmpty().distinct().take(MAX_SCREENSHOTS),
                    screenshotSource = resolved?.source,
                    screenshotsResolved = true,
                    screenshotsCheckedAt = now,
                )
            }

            // Merge onto the freshest stored copy so a concurrent write for another platform,
            // or a metadata refresh, is not overwritten by this one.
            val updated = mergeMedia(base = cached, incoming = game, platform = platform, record = record)
            cacheGames(listOf(updated))
            updated
        }
    }

    private fun mergeMedia(
        base: Game,
        incoming: Game,
        platform: String,
        record: MediaRecord,
    ): Game {
        val merged = incoming.copy(mediaByPlatform = base.mediaByPlatform + incoming.mediaByPlatform)
        return merged.withMedia(platform, record)
    }

    // --- Titles ---------------------------------------------------------------------------------

    /**
     * Re-fetches the name of a game whose stored title is still a placeholder.
     *
     * Wikidata items occasionally have no label in either language at the moment they are first
     * seen; this gives cached rows a chance to heal instead of showing an entity id forever.
     */
    suspend fun repairTitle(game: Game): Game {
        if (!GameTitles.needsRepair(game.title) || !ENTITY_ID.matches(game.id)) return game
        val entity = runCatching { wikidata.entities(listOf(game.id)) }.getOrNull()?.get(game.id)
            ?: return game
        val title = WikidataDataSource.resolveTitle(entity, null)
        if (title.isEmpty()) return game
        val repaired = game.copy(
            title = title,
            originalTitle = if (GameTitles.isInvalid(game.originalTitle)) title else game.originalTitle,
        )
        cacheGames(listOf(repaired))
        return repaired
    }

    // --- Cache ----------------------------------------------------------------------------------

    suspend fun loadCached(gameId: String): Game? =
        gameCacheDao.byId(gameId)?.payload?.let(serializer::decode)

    /** Cached games, used to keep discovery populated when the network is unavailable. */
    suspend fun cachedPool(limit: Int = 180): List<Game> =
        gameCacheDao.recentlyCached(limit).mapNotNull { serializer.decode(it.payload) }

    suspend fun cacheGames(games: List<Game>) {
        if (games.isEmpty()) return
        val now = clock.now().toEpochMilliseconds()
        val rows = games.map { CachedGameEntity(it.id, serializer.encode(it), now) }
        gameCacheDao.upsert(rows)
        gameCacheDao.trimTo(MAX_CACHED_GAMES)
    }

    suspend fun clearCache() {
        gameCacheDao.clear()
        queryCacheDao.clear()
    }

    private suspend fun cachedResults(normalizedQuery: String, limit: Int): List<Game>? {
        val entry = queryCacheDao.byQuery(normalizedQuery) ?: return null
        val age = clock.now().toEpochMilliseconds() - entry.createdAt
        if (age > QUERY_CACHE_TTL_MILLIS) return null
        val ids = entry.gameIds.split(ID_SEPARATOR).filter { it.isNotEmpty() }
        if (ids.isEmpty()) return null
        val byId = gameCacheDao.byIds(ids).mapNotNull { serializer.decode(it.payload) }.associateBy { it.id }
        // Preserve the ranking the search produced rather than the database's row order.
        val ordered = ids.mapNotNull { byId[it] }
        return ordered.takeIf { it.isNotEmpty() }?.take(limit)
    }

    private suspend fun rememberQuery(normalizedQuery: String, games: List<Game>) {
        queryCacheDao.upsert(
            QueryCacheEntity(
                query = normalizedQuery,
                gameIds = games.joinToString(ID_SEPARATOR) { it.id },
                createdAt = clock.now().toEpochMilliseconds(),
            ),
        )
        queryCacheDao.trimTo(MAX_CACHED_QUERIES)
    }

    // --- Ranking --------------------------------------------------------------------------------

    /**
     * Collapses re-releases of the same game and orders by how well each matches the query.
     *
     * Wikidata often holds separate items per region or per platform for the same game; keying on
     * normalised title plus year merges them while keeping genuinely different entries apart.
     */
    suspend fun rankAndDedupe(games: List<Game>, query: String): List<Game> =
        withContext(Dispatchers.Default) {
            val best = LinkedHashMap<String, Game>()
            for (game in games) {
                val key = "${normalizeLoose(cleanTitleForMedia(game.originalTitle.ifEmpty { game.title }))}|${game.year ?: ""}"
                val current = best[key]
                if (current == null || relevance(game, query) > relevance(current, query)) {
                    best[key] = game
                }
            }
            best.values.sortedByDescending { relevance(it, query) }
        }

    private fun relevance(game: Game, query: String): Int {
        val target = normalizeLoose(cleanTitleForMedia(query))
        val title = normalizeLoose(cleanTitleForMedia(game.title))
        val original = normalizeLoose(cleanTitleForMedia(game.originalTitle))
        var score = 0
        if (title == target) score += 120
        if (original == target) score += 115
        if (title.startsWith(target) || original.startsWith(target)) score += 60
        if (title.contains(target) || original.contains(target)) score += 35
        val tokens = target.split(' ').filter { it.length > 2 }
        val haystack = "$title $original"
        score += tokens.count { haystack.contains(it) } * 12
        // Small nudges toward records that are actually complete enough to display well.
        if (game.platforms.isNotEmpty()) score += 4
        if (game.year != null) score += 2
        if (game.verifiedCover != null) score += 3
        return score
    }

    private companion object {
        const val MEDIA_CONCURRENCY = 3
        const val ENRICH_CONCURRENCY = 4
        const val MAX_CACHED_GAMES = 180
        const val MAX_CACHED_QUERIES = 50
        const val MAX_SCREENSHOTS = 8
        const val MIN_CANDIDATES_BEFORE_FALLBACK = 4
        const val ID_SEPARATOR = ","

        /** Cached search results stay usable for two weeks; game facts rarely change faster. */
        const val QUERY_CACHE_TTL_MILLIS = 14L * 24 * 60 * 60 * 1000

        /** How long a failed artwork lookup is trusted before the chain retries it. */
        const val NEGATIVE_RETRY_MILLIS = 90L * 1000

        val ENTITY_ID = Regex("^Q\\d+$", RegexOption.IGNORE_CASE)

        /** Claims whose values are entity references needing a label lookup. */
        val LABEL_PROPERTIES = listOf("P400", "P136", "P178", "P123", "P179")
    }
}

private fun JsonElement.entityId(): String = this["id"].asString.orEmpty()
