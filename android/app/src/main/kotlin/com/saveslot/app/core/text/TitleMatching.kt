package com.saveslot.app.core.text

/**
 * Loose normalisation used everywhere titles, filenames and labels are compared:
 * lowercase, punctuation collapsed to single spaces.
 */
fun normalizeLoose(value: String): String =
    value.lowercase()
        .replace(LOOSE_PUNCTUATION, " ")
        .replace(WHITESPACE, " ")
        .trim()

private val LOOSE_PUNCTUATION = Regex("[_:()\\[\\],.-]+")
private val WHITESPACE = Regex("\\s+")

/** Strips the "(video game)" disambiguator Wikipedia and Wikidata append to titles. */
fun cleanTitleForMedia(value: String): String =
    value.replace(VIDEO_GAME_SUFFIX, "").replace(WHITESPACE, " ").trim()

private val VIDEO_GAME_SUFFIX = Regex("\\s*\\(video game\\)\\s*$", RegexOption.IGNORE_CASE)

/** Removes characters that are illegal in Libretro thumbnail filenames. */
fun thumbnailSafeName(value: String): String =
    value.replace(ILLEGAL_FILENAME_CHARS, "_").replace(WHITESPACE, " ").trim()

private val ILLEGAL_FILENAME_CHARS = Regex("[\\\\/*:?\"<>|]")

fun filenameFromUrl(url: String): String =
    Regex("([^/?#]+)(?:\\?|#|$)").find(url)?.groupValues?.getOrNull(1).orEmpty()

/**
 * Compares candidate titles (article names, storefront entries, artwork filenames) against a
 * game's known names.
 *
 * The dominant failure mode when searching for artwork is matching the wrong instalment of a
 * series — "Final Fantasy IX" artwork attached to "Final Fantasy", or "Mega Man 2" art for
 * "Mega Man". [installmentMismatch] exists to veto those before any scoring happens.
 */
class TitleMatcher(
    private val titleVariants: List<String>,
    private val expectedNumbers: Set<String>,
    private val ignoredNumbers: Set<String>,
    private val keywords: List<String>,
) {

    /**
     * True when the candidate names a different entry in the series than this game.
     *
     * A mismatch is either an expected instalment number missing from the candidate, or an
     * unexpected number >= 2 appearing in it that is not the release year or part of a platform
     * name (so "Nintendo 64" or "PlayStation 2" in a filename does not read as an instalment).
     *
     * Use this where the candidate's own text is the only evidence it is about this game — search
     * results and archive filenames. Where the source is already scoped to the right game, prefer
     * [installmentConflict].
     */
    fun installmentMismatch(candidate: String): Boolean {
        val candidateNumbers = titleNumberTokens(candidate).toSet()
        if (expectedNumbers.any { it !in candidateNumbers }) return true
        return conflicts(candidateNumbers)
    }

    /**
     * True only when the candidate names an instalment that contradicts this game.
     *
     * Unlike [installmentMismatch] this tolerates a candidate that names no number at all, which is
     * the normal case for images embedded in an article: the article is already about the right
     * game, so a file called "Combat in a foggy street.jpg" is perfectly valid for "Silent Hill 2".
     * Requiring the "2" there would discard most legitimate screenshots.
     */
    fun installmentConflict(candidate: String): Boolean = conflicts(titleNumberTokens(candidate).toSet())

    private fun conflicts(candidateNumbers: Set<String>): Boolean =
        candidateNumbers.any { token ->
            token !in expectedNumbers && token !in ignoredNumbers && (token.toIntOrNull() ?: 0) >= 2
        }

    /**
     * 0..180 similarity between [candidate] and the game's titles. Exact match scores highest,
     * then whole-title containment, then token overlap weighted by coverage and precision.
     */
    fun score(candidate: String): Double {
        val normalized = normalizeLoose(candidate)
        if (normalized.isEmpty() || installmentMismatch(normalized)) return 0.0
        var best = 0.0
        for (title in titleVariants) {
            if (title.isEmpty()) continue
            when {
                normalized == title -> best = maxOf(best, 180.0)
                " $normalized ".contains(" $title ") -> best = maxOf(best, 130.0)
                else -> {
                    val titleTokens = title.split(' ').filter { it.length > 1 }
                    val candidateTokens = normalized.split(' ').filter { it.length > 1 }
                    val shared = titleTokens.count { it in candidateTokens }
                    val coverage = if (titleTokens.isEmpty()) 0.0 else shared.toDouble() / titleTokens.size
                    val precision = if (candidateTokens.isEmpty()) 0.0 else shared.toDouble() / candidateTokens.size
                    best = maxOf(best, coverage * 80 + precision * 40)
                }
            }
        }
        return best
    }

    /** A [score] at or above this threshold is treated as "this file is about this game". */
    fun matchesTitle(candidate: String): Boolean = score(candidate) >= TITLE_MATCH_THRESHOLD

    fun keywordHits(candidate: String): Int {
        val normalized = normalizeLoose(candidate)
        return keywords.count { normalized.contains(it) }
    }

    companion object {
        const val TITLE_MATCH_THRESHOLD = 72.0

        private val ROMAN_NUMERALS = mapOf(
            "ii" to "2", "iii" to "3", "iv" to "4", "v" to "5",
            "vi" to "6", "vii" to "7", "viii" to "8", "ix" to "9", "x" to "10",
        )

        private val STOP_WORDS = setOf("the", "and", "from", "with", "game", "video")

        /**
         * Numbers that could denote a sequel. Values in 70..99 are dropped because two-digit
         * years and hardware model numbers ("Atari 7800", "'98") produce false mismatches.
         */
        fun titleNumberTokens(value: String): List<String> =
            normalizeLoose(value).split(' ')
                .map { ROMAN_NUMERALS[it] ?: it }
                .filter { it.toIntOrNull() != null }
                .filter { token ->
                    val number = token.toInt()
                    number in 1..99 && number !in 70..99
                }

        fun keywordsOf(titles: List<String>): List<String> =
            titles.flatMap { normalizeLoose(it).split(' ') }
                .filter { it.length >= 4 && it !in STOP_WORDS }
                .distinct()
    }
}

/** Builds a matcher from a game's titles, aliases, release year and active platform. */
fun titleMatcherOf(
    title: String,
    originalTitle: String?,
    aliases: List<String>,
    year: Int?,
    activePlatform: String,
): TitleMatcher {
    val rawTitles = (listOf(originalTitle, title) + aliases).filterNotNull().filter { it.isNotBlank() }
    val variants = rawTitles.map { normalizeLoose(cleanTitleForMedia(it)) }.filter { it.isNotEmpty() }.distinct()
    val expected = variants.flatMap { TitleMatcher.titleNumberTokens(it) }.toSet()
    val ignored = buildSet {
        year?.let { add(it.toString()) }
        addAll(PlatformNames.aliases(activePlatform).flatMap { TitleMatcher.titleNumberTokens(it) })
    }
    return TitleMatcher(
        titleVariants = variants,
        expectedNumbers = expected,
        ignoredNumbers = ignored,
        keywords = TitleMatcher.keywordsOf(rawTitles),
    )
}
