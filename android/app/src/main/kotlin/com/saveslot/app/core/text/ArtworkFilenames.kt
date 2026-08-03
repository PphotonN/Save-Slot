package com.saveslot.app.core.text

/**
 * Filename heuristics that decide whether a Commons/Wikipedia file is the cover or a screenshot
 * for a specific release.
 *
 * Wiki file naming is unregulated, so these rules are how the app avoids showing a PEGI logo, a
 * fan wallpaper, or the Xbox cover of a game the user is viewing on PlayStation. The checks are
 * deliberately conservative: a rejected good file just means falling through to another provider,
 * while an accepted bad file is visible wrongness.
 */
object ArtworkFilenames {

    private val IMAGE_EXTENSION = Regex("\\.(jpe?g|png|webp)$", RegexOption.IGNORE_CASE)

    /** Wiki furniture and rating badges that are never game artwork. */
    private val CHROME = Regex(
        "(icon|logo|symbol|flag|commons-logo|wikidata|question_book|ambox|crystal|padlock|" +
            "stub|fairuse|rating|esrb|pegi)",
        RegexOption.IGNORE_CASE,
    )

    private val COVER_HINT = Regex(
        "(cover|box.?art|packshot|front|case|jacket|box|poster)",
        RegexOption.IGNORE_CASE,
    )

    private val SCREENSHOT_HINT = Regex(
        "(screen|screenshot|gameplay|ingame|in game|battle|scene|shot)",
        RegexOption.IGNORE_CASE,
    )

    /** Cover-ish words that disqualify a file from being treated as a screenshot. */
    private val COVER_WORDS = Regex(
        "(cover|box.?art|packshot|poster|title[-_ ]?screen|boxart)",
        RegexOption.IGNORE_CASE,
    )

    /** Non-cover artwork: logos, sprites, concept art, maps. */
    private val NON_COVER_ART = Regex(
        "(logo|wordmark|icon|symbol|sprite|screenshot|gameplay|title[-_ ]?screen|titlecard|map|artwork|concept)",
        RegexOption.IGNORE_CASE,
    )

    fun isImage(name: String): Boolean = IMAGE_EXTENSION.containsMatchIn(name)

    /**
     * True when the filename names a platform this game was released on that is *not* the one
     * being viewed — i.e. the artwork belongs to a different release.
     */
    fun mentionsOtherPlatform(filename: String, platforms: List<String>, platform: String): Boolean {
        val low = normalizeLoose(filename)
        if (PlatformNames.aliases(platform).any { it.isNotEmpty() && low.contains(it) }) return false
        return platforms.filter { it != platform }
            .flatMap { PlatformNames.aliases(it) }
            .any { it.isNotEmpty() && low.contains(it) }
    }

    /**
     * Screenshot candidate found by Commons search.
     *
     * Requires a title match, a screenshot-ish word, and no evidence of another platform. When the
     * filename names no platform at all it is accepted, since most files are simply unlabelled.
     */
    fun isScreenshotCandidate(
        name: String,
        matcher: TitleMatcher,
        platforms: List<String>,
        platform: String,
    ): Boolean {
        if (!isImage(name)) return false
        val decoded = decode(name)
        if (CHROME.containsMatchIn(decoded) || COVER_WORDS.containsMatchIn(decoded)) return false
        if (!matcher.matchesTitle(decoded)) return false
        val low = normalizeLoose(decoded)
        val selectedHit = PlatformNames.aliases(platform).any { it.isNotEmpty() && low.contains(it) }
        val otherHit = platforms.filter { it != platform }
            .flatMap { PlatformNames.aliases(it) }
            .any { it.isNotEmpty() && low.contains(it) }
        if (otherHit) return false
        val namesSomePlatform = PlatformNames.termsFor(platforms).any { it.isNotEmpty() && low.contains(it) }
        return (selectedHit || !namesSomePlatform) && SCREENSHOT_HINT.containsMatchIn(decoded)
    }

    /**
     * Screenshot candidate embedded in an article.
     *
     * Article images are already scoped to the right game, so no title match is demanded — only
     * that the file is not chrome, not a cover, and not from another platform.
     */
    fun isArticleScreenshotCandidate(
        name: String,
        matcher: TitleMatcher,
        platforms: List<String>,
        platform: String,
    ): Boolean {
        if (!isImage(name)) return false
        val decoded = decode(name)
        if (CHROME.containsMatchIn(decoded) || COVER_WORDS.containsMatchIn(decoded)) return false
        // Only a contradicting instalment number disqualifies an article image; most are named
        // after their subject rather than the game, and demanding the number would drop them all.
        if (matcher.installmentConflict(decoded)) return false
        val low = normalizeLoose(decoded)
        val selectedHit = PlatformNames.aliases(platform).any { it.isNotEmpty() && low.contains(it) }
        val otherHit = platforms.filter { it != platform }
            .flatMap { PlatformNames.aliases(it) }
            .any { it.isNotEmpty() && low.contains(it) }
        if (otherHit && !selectedHit) return false
        return SCREENSHOT_HINT.containsMatchIn(decoded)
    }

    /** Cover candidate found by Commons search: needs a cover word *and* a title match. */
    fun isCoverCandidate(
        name: String,
        matcher: TitleMatcher,
        platforms: List<String>,
        platform: String,
    ): Boolean {
        if (!isImage(name)) return false
        val decoded = decode(name).lowercase()
        if (NON_COVER_ART.containsMatchIn(decoded) || matcher.installmentMismatch(decoded)) return false
        if (!COVER_HINT.containsMatchIn(decoded) || !matcher.matchesTitle(decoded)) return false
        val low = normalizeLoose(decoded)
        val selectedHit = PlatformNames.aliases(platform).any { it.isNotEmpty() && low.contains(it) }
        val otherHit = platforms.filter { it != platform }
            .flatMap { PlatformNames.aliases(it) }
            .any { it.isNotEmpty() && low.contains(it) }
        if (otherHit) return false
        val namesSomePlatform = PlatformNames.termsFor(platforms).any { it.isNotEmpty() && low.contains(it) }
        return selectedHit || !namesSomePlatform
    }

    /** Cover candidate embedded in an article: cover word required, title match implied. */
    fun isArticleCoverCandidate(
        name: String,
        matcher: TitleMatcher,
        platforms: List<String>,
        platform: String,
    ): Boolean {
        if (!isImage(name)) return false
        val decoded = decode(name).lowercase()
        if (NON_COVER_ART.containsMatchIn(decoded)) return false
        if (matcher.installmentMismatch(decoded)) return false
        if (mentionsOtherPlatform(decoded, platforms, platform)) return false
        return COVER_HINT.containsMatchIn(decoded)
    }

    /** Commons category files whose names read like a cover. */
    fun looksLikeCategoryCover(name: String): Boolean =
        isImage(name) &&
            Regex("(cover|box.?art|packshot|jacket|front cover|game cover|case)", RegexOption.IGNORE_CASE)
                .containsMatchIn(name)

    /** Commons category files that are plausibly in-game imagery rather than packaging or promo. */
    fun looksLikeCategoryScreenshot(name: String): Boolean =
        isImage(name) &&
            !Regex(
                "(logo|icon|cover|box.?art|poster|packshot|jacket|rating|esrb|pegi|promotional art)",
                RegexOption.IGNORE_CASE,
            ).containsMatchIn(name)

    fun hasScreenshotWord(name: String): Boolean = SCREENSHOT_HINT.containsMatchIn(name)

    fun hasCoverWord(name: String): Boolean = COVER_HINT.containsMatchIn(name)

    fun decode(value: String): String =
        runCatching { java.net.URLDecoder.decode(value, "UTF-8") }.getOrDefault(value)
}
