package com.saveslot.app.data.remote.media

import androidx.collection.LruCache
import com.saveslot.app.core.net.HttpClient
import com.saveslot.app.core.net.asArray
import com.saveslot.app.core.net.asString
import com.saveslot.app.core.net.get
import com.saveslot.app.core.text.PlatformNames
import com.saveslot.app.core.text.TitleMatcher
import com.saveslot.app.core.text.cleanTitleForMedia
import com.saveslot.app.core.text.normalizeLoose
import com.saveslot.app.core.text.thumbnailSafeName
import com.saveslot.app.core.text.titleMatcherOf
import com.saveslot.app.data.remote.SourceStatusTracker
import com.saveslot.app.data.remote.wikidata.urlEncoded
import com.saveslot.app.domain.model.DataSource
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SourceStatus
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * The Libretro thumbnail archive: the best source of authentic console box art and in-game shots.
 *
 * Files are named after the No-Intro/Redump ROM titles, so lookups happen in two passes:
 *
 *  1. **Guessing.** Generate plausible filenames from the game's titles and try them directly.
 *     Cheap and instant when it hits, which it does for most well-known games.
 *  2. **Indexing.** If guessing fails, pull the repository's full file listing once and fuzzy-match
 *     against it. Slower and rate-limited, so it runs in a later tier.
 */
class LibretroProvider(
    private val httpClient: HttpClient,
    private val imageProbe: ImageProbe,
    private val statusTracker: SourceStatusTracker,
) {

    private val treeCache = LruCache<String, RepositoryIndex>(8)
    private val treeLock = Mutex()

    data class RepositoryIndex(
        val repo: String,
        val boxArts: List<String>,
        val snaps: List<String>,
        val titleScreens: List<String>,
    )

    fun systemFor(platform: String): String? {
        val key = normalizePlatformKey(platform)
        return SYSTEMS[key]
    }

    // --- Pass 1: filename guessing -------------------------------------------------------------

    suspend fun guessBoxArt(game: Game, platform: String): String? {
        val system = systemFor(platform) ?: return null
        statusTracker.set(DataSource.Libretro, SourceStatus.Loading)
        val urls = titleCandidates(game).take(34)
            .flatMap { thumbnailUrls(system, FOLDER_BOXART, it) }
        val found = imageProbe.firstMatching(
            urls = urls,
            timeoutMillis = 1_250,
            batchSize = 6,
            validator = { it.tallerThanWideBy(1.05) },
        )
        reportOutcome(found != null)
        return found
    }

    suspend fun guessScreenshots(game: Game, platform: String): List<String> {
        val system = systemFor(platform) ?: return emptyList()
        statusTracker.set(DataSource.Libretro, SourceStatus.Loading)
        val candidates = titleCandidates(game).take(30)
        // Prefer real gameplay snaps; title screens are the consolation prize.
        val snap = imageProbe.firstMatching(
            urls = candidates.flatMap { thumbnailUrls(system, FOLDER_SNAP, it) },
            timeoutMillis = 1_150,
            batchSize = 6,
            validator = { it.widerThanTallBy(0.96) },
        ) ?: imageProbe.firstMatching(
            urls = candidates.flatMap { thumbnailUrls(system, FOLDER_TITLE, it) },
            timeoutMillis = 1_050,
            batchSize = 6,
            validator = { it.widerThanTallBy(0.96) },
        )
        reportOutcome(snap != null)
        return listOfNotNull(snap)
    }

    // --- Pass 2: repository index --------------------------------------------------------------

    suspend fun indexedBoxArt(game: Game, platform: String): String? =
        indexedImage(game, platform, ImageKind.BoxArt)

    suspend fun indexedScreenshots(game: Game, platform: String): List<String> {
        val found = indexedImage(game, platform, ImageKind.Snap)
            ?: indexedImage(game, platform, ImageKind.TitleScreen)
        return listOfNotNull(found)
    }

    private enum class ImageKind { BoxArt, Snap, TitleScreen }

    private suspend fun indexedImage(game: Game, platform: String, kind: ImageKind): String? {
        val system = systemFor(platform) ?: return null
        statusTracker.set(DataSource.Libretro, SourceStatus.Loading)
        val index = repositoryIndex(system) ?: run {
            statusTracker.clearLoading(DataSource.Libretro)
            return null
        }
        val paths = when (kind) {
            ImageKind.BoxArt -> index.boxArts
            ImageKind.Snap -> index.snaps
            ImageKind.TitleScreen -> index.titleScreens
        }
        val matcher = matcherFor(game, platform)
        val ranked = paths.asSequence()
            .map { path -> path to matchScore(path, game, matcher) }
            .filter { it.second >= INDEX_MATCH_THRESHOLD }
            .sortedByDescending { it.second }
            .take(6)
            .toList()

        for ((path, _) in ranked) {
            val url = rawUrl(index.repo, path)
            val meta = imageProbe.probe(url, timeoutMillis = 1_700)
            if (!meta.ok) continue
            val acceptable = when (kind) {
                ImageKind.BoxArt -> meta.tallerThanWideBy(1.04)
                else -> meta.widerThanTallBy(0.96)
            }
            if (acceptable) {
                statusTracker.set(DataSource.Libretro, SourceStatus.Online)
                return url
            }
        }
        statusTracker.clearLoading(DataSource.Libretro)
        return null
    }

    private suspend fun repositoryIndex(system: String): RepositoryIndex? {
        treeCache[system]?.let { return it }
        return treeLock.withLock {
            treeCache[system]?.let { return@withLock it }
            val repo = repoSlug(system)
            val url = "https://api.github.com/repos/libretro-thumbnails/$repo/git/trees/master?recursive=1"
            val payload = runCatching { httpClient.getJson(url, timeoutMillis = 5_200) }.getOrNull()
                ?: return@withLock null
            val paths = payload["tree"].asArray
                .filter { it["type"].asString == "blob" }
                .mapNotNull { it["path"].asString }
                .filter { INDEXED_PATH.matches(it) }
            if (paths.isEmpty()) return@withLock null
            RepositoryIndex(
                repo = repo,
                boxArts = paths.filter { it.startsWith("$FOLDER_BOXART/") },
                snaps = paths.filter { it.startsWith("$FOLDER_SNAP/") },
                titleScreens = paths.filter { it.startsWith("$FOLDER_TITLE/") },
            ).also { treeCache.put(system, it) }
        }
    }

    private fun reportOutcome(found: Boolean) {
        if (found) statusTracker.set(DataSource.Libretro, SourceStatus.Online)
        else statusTracker.clearLoading(DataSource.Libretro)
    }

    private fun matcherFor(game: Game, platform: String) = titleMatcherOf(
        title = game.title,
        originalTitle = game.originalTitle,
        aliases = game.aliases,
        year = game.year,
        activePlatform = platform,
    )

    companion object {
        private const val FOLDER_BOXART = "Named_Boxarts"
        private const val FOLDER_SNAP = "Named_Snaps"
        private const val FOLDER_TITLE = "Named_Titles"
        private const val INDEX_MATCH_THRESHOLD = 82.0

        private val INDEXED_PATH =
            Regex("^(Named_Boxarts|Named_Snaps|Named_Titles)/.+\\.png$", RegexOption.IGNORE_CASE)

        /** Region tags ROM sets append to filenames. */
        private val REGION_SUFFIXES =
            listOf("(USA)", "(Europe)", "(World)", "(Japan)", "(USA, Europe)")

        fun repoSlug(system: String): String = system.replace(' ', '_')

        fun thumbnailUrls(system: String, folder: String, title: String): List<String> {
            val encodedTitle = title.urlEncoded()
            return listOf(
                "https://thumbnails.libretro.com/${system.urlEncoded()}/$folder/$encodedTitle.png",
                "https://raw.githubusercontent.com/libretro-thumbnails/${repoSlug(system)}" +
                    "/master/$folder/$encodedTitle.png",
            )
        }

        fun rawUrl(repo: String, path: String): String {
            val encodedPath = path.split('/').joinToString("/") { it.urlEncoded() }
            return "https://raw.githubusercontent.com/libretro-thumbnails/$repo/master/$encodedPath"
        }

        /**
         * Every filename spelling worth trying, covering the punctuation and article conventions
         * ROM sets use: "The Legend of Zelda" is filed as "Legend of Zelda, The", subtitles appear
         * after either ":" or " - ", and "&" may be spelled "and".
         */
        fun titleCandidates(game: Game): List<String> {
            val bases = (listOf(game.originalTitle, game.title) + game.aliases)
                .filter { it.isNotBlank() }
                .map(::cleanTitleForMedia)
                .flatMap { value ->
                    listOf(
                        value,
                        value.replace(Regex("[™®©]"), "").trim(),
                        value.replace('’', '\'').replace('‘', '\''),
                        value.replace(Regex("\\s*&\\s*"), " and "),
                        value.replace(Regex("\\s+and\\s+", RegexOption.IGNORE_CASE), " & "),
                    )
                }
                .distinct()

            val variants = mutableListOf<String>()
            for (base in bases) {
                val punctuation = (
                    listOf(
                        base,
                        base.replace(Regex(":\\s*"), " - "),
                        base.replace(Regex("\\s+-\\s+"), ": "),
                        base.replace(Regex("[.:]"), ""),
                    ) + invertedArticleForms(base)
                    ).distinct()
                for (variant in punctuation) {
                    variants += variant
                    REGION_SUFFIXES.forEach { variants += "$variant $it" }
                }
            }
            return variants.map(::thumbnailSafeName).filter { it.isNotEmpty() }.distinct().take(48)
        }

        /**
         * Article-inverted spellings, as No-Intro and Redump name their files.
         *
         * The convention moves the leading article to the end of the *main* title, before the
         * subtitle: "The Legend of Zelda: Ocarina of Time" is filed as
         * "Legend of Zelda, The - Ocarina of Time". Appending the article to the whole string
         * instead ("...Ocarina of Time, The") never matches a real file, so both the subtitle-aware
         * form and the whole-string form are generated.
         */
        fun invertedArticleForms(base: String): List<String> {
            val article = ARTICLE_PREFIX.find(base) ?: return emptyList()
            val leadingArticle = article.groupValues[1]
            val remainder = article.groupValues[2]

            val separator = SUBTITLE_SEPARATOR.find(remainder)
            val forms = mutableListOf<String>()
            if (separator != null) {
                val mainTitle = remainder.substring(0, separator.range.first).trimEnd()
                val subtitle = remainder.substring(separator.range.last + 1).trimStart()
                forms += "$mainTitle, $leadingArticle - $subtitle"
                forms += "$mainTitle, $leadingArticle: $subtitle"
            }
            // No subtitle, or the archive simply appended the article to the full title.
            forms += "$remainder, $leadingArticle"
            forms += "$remainder, $leadingArticle".replace(Regex(":\\s*"), " - ")
            return forms.distinct()
        }

        private val ARTICLE_PREFIX = Regex("^(The|A|An)\\s+(.+)$", RegexOption.IGNORE_CASE)
        private val SUBTITLE_SEPARATOR = Regex(":\\s*|\\s+-\\s+")

        /**
         * Normalises an archive filename for comparison: drops the folder, extension, region and
         * revision tags, and un-inverts a trailing article.
         */
        fun normalizeArchiveName(value: String): String {
            val decoded = runCatching { java.net.URLDecoder.decode(value, "UTF-8") }.getOrDefault(value)
            return normalizeLoose(
                decoded
                    .replace(Regex("^.*/"), "")
                    .replace(Regex("\\.png$", RegexOption.IGNORE_CASE), "")
                    .replace(
                        Regex(
                            "\\s*\\((usa|europe|world|japan|asia|australia|korea|brazil|canada|" +
                                "france|germany|italy|spain|rev[^)]*|disc[^)]*|disk[^)]*|beta|" +
                                "proto|sample|demo|unl)[^)]*\\)\\s*",
                            RegexOption.IGNORE_CASE,
                        ),
                        " ",
                    )
                    .replace(Regex(",\\s*(the|a|an)$", RegexOption.IGNORE_CASE), " $1")
                    .replace('_', ' ')
                    .replace(Regex("[^a-zA-Z0-9\\u0400-\\u04ff]+"), " "),
            )
        }

        /**
         * Similarity between an archive filename and a game, with a hard penalty when a number in
         * the game's title is absent from the file — the archive is full of near-identical sequels.
         */
        fun matchScore(filename: String, game: Game, matcher: TitleMatcher): Double {
            val candidate = normalizeArchiveName(filename)
            if (candidate.isEmpty() || matcher.installmentMismatch(candidate)) return 0.0
            val titles = (listOf(game.originalTitle, game.title) + game.aliases)
                .filter { it.isNotBlank() }
                .map(::cleanTitleForMedia)
                .flatMap { title ->
                    val article = Regex("^(The|A|An)\\s+(.+)$", RegexOption.IGNORE_CASE).find(title)
                    listOfNotNull(title, article?.let { "${it.groupValues[2]}, ${it.groupValues[1]}" })
                }
                .map(::normalizeArchiveName)
                .filter { it.isNotEmpty() }
                .distinct()

            var best = 0.0
            for (title in titles) {
                if (candidate == title) best = maxOf(best, 200.0)
                if (candidate.startsWith("$title ") || title.startsWith("$candidate ")) {
                    best = maxOf(best, 135.0)
                }
                val titleTokens = title.split(' ').filter { it.length > 1 }
                val candidateTokens = candidate.split(' ').filter { it.length > 1 }
                if (titleTokens.isEmpty() || candidateTokens.isEmpty()) continue
                val shared = titleTokens.count { it in candidateTokens }
                val coverage = shared.toDouble() / titleTokens.size
                val precision = shared.toDouble() / candidateTokens.size
                var score = coverage * 85 + precision * 45
                if (" $candidate ".contains(" $title ") || " $title ".contains(" $candidate ")) score += 28
                val numberMismatch = titleTokens
                    .filter { it.toIntOrNull() != null }
                    .any { it !in candidateTokens }
                if (numberMismatch) score -= 55
                best = maxOf(best, score)
            }
            return best
        }

        /** Strips vendor prefixes so "Sony PlayStation 2" and "PlayStation 2" share a key. */
        fun normalizePlatformKey(platform: String): String =
            normalizeLoose(platform)
                .removePrefix("sony ")
                .removePrefix("microsoft ")
                .trim()

        /** Canonical platform name -> Libretro system folder. */
        private val SYSTEMS: Map<String, String> = mapOf(
            "nintendo entertainment system" to "Nintendo - Nintendo Entertainment System",
            "nes" to "Nintendo - Nintendo Entertainment System",
            "super nintendo entertainment system" to "Nintendo - Super Nintendo Entertainment System",
            "super nintendo" to "Nintendo - Super Nintendo Entertainment System",
            "snes" to "Nintendo - Super Nintendo Entertainment System",
            "nintendo 64" to "Nintendo - Nintendo 64",
            "game boy" to "Nintendo - Game Boy",
            "game boy color" to "Nintendo - Game Boy Color",
            "game boy advance" to "Nintendo - Game Boy Advance",
            "nintendo ds" to "Nintendo - Nintendo DS",
            "nintendo dsi" to "Nintendo - Nintendo DS",
            "nintendo 3ds" to "Nintendo - Nintendo 3DS",
            "gamecube" to "Nintendo - GameCube",
            "nintendo gamecube" to "Nintendo - GameCube",
            "wii" to "Nintendo - Wii",
            "wii u" to "Nintendo - Wii U",
            "nintendo switch" to "Nintendo - Nintendo Switch",
            "virtual boy" to "Nintendo - Virtual Boy",
            "playstation" to "Sony - PlayStation",
            "playstation 2" to "Sony - PlayStation 2",
            "playstation 3" to "Sony - PlayStation 3",
            "playstation 4" to "Sony - PlayStation 4",
            "playstation 5" to "Sony - PlayStation 5",
            "playstation portable" to "Sony - PlayStation Portable",
            "psp" to "Sony - PlayStation Portable",
            "playstation vita" to "Sony - PlayStation Vita",
            "xbox" to "Microsoft - Xbox",
            "xbox 360" to "Microsoft - Xbox 360",
            "xbox one" to "Microsoft - Xbox One",
            "mega drive" to "Sega - Mega Drive - Genesis",
            "sega genesis" to "Sega - Mega Drive - Genesis",
            "genesis" to "Sega - Mega Drive - Genesis",
            "sega saturn" to "Sega - Saturn",
            "saturn" to "Sega - Saturn",
            "dreamcast" to "Sega - Dreamcast",
            "game gear" to "Sega - Game Gear",
            "sega master system" to "Sega - Master System - Mark III",
            "master system" to "Sega - Master System - Mark III",
            "pc engine" to "NEC - PC Engine - TurboGrafx 16",
            "turbografx-16" to "NEC - PC Engine - TurboGrafx 16",
            "neo geo" to "SNK - Neo Geo",
            "neo geo pocket" to "SNK - Neo Geo Pocket",
            "neo geo pocket color" to "SNK - Neo Geo Pocket Color",
            "atari 2600" to "Atari - 2600",
            "atari 7800" to "Atari - 7800",
            "atari lynx" to "Atari - Lynx",
            "jaguar" to "Atari - Jaguar",
            "commodore 64" to "Commodore - 64",
            "amiga" to "Commodore - Amiga",
            "msx" to "Microsoft - MSX",
            "zx spectrum" to "Sinclair - ZX Spectrum",
            "dos" to "DOS",
            "arcade" to "MAME",
        )
    }
}

/** Guess-first box art lookup; fast enough for the first tier. */
class LibretroGuessBoxArtProvider(private val libretro: LibretroProvider) : BoxArtProvider {
    override val id = "libretro"
    override val timeoutMillis = 3_400L
    override fun supports(game: Game, platform: String) = libretro.systemFor(platform) != null
    override suspend fun boxArt(game: Game, platform: String) = libretro.guessBoxArt(game, platform)
}

/** Index-backed lookup; slower and rate-limited, so it sits in a later tier. */
class LibretroIndexBoxArtProvider(private val libretro: LibretroProvider) : BoxArtProvider {
    override val id = "libretro-index"
    override val timeoutMillis = 7_600L
    override fun supports(game: Game, platform: String) = libretro.systemFor(platform) != null
    override suspend fun boxArt(game: Game, platform: String) = libretro.indexedBoxArt(game, platform)
}

class LibretroGuessScreenshotProvider(private val libretro: LibretroProvider) : ScreenshotProvider {
    override val id = "libretro"
    override val timeoutMillis = 3_200L
    override fun supports(game: Game, platform: String) = libretro.systemFor(platform) != null
    override suspend fun screenshots(game: Game, platform: String) =
        libretro.guessScreenshots(game, platform)
}

class LibretroIndexScreenshotProvider(private val libretro: LibretroProvider) : ScreenshotProvider {
    override val id = "libretro-index"
    override val timeoutMillis = 7_600L
    override fun supports(game: Game, platform: String) = libretro.systemFor(platform) != null
    override suspend fun screenshots(game: Game, platform: String) =
        libretro.indexedScreenshots(game, platform)
}
