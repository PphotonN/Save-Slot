package com.saveslot.app.core.text

/**
 * Chooses a human-readable title for a game.
 *
 * Wikidata items sometimes have no label in either supported language, in which case naive code
 * ends up showing the raw entity id ("Q12345"). These helpers pick the best available name and,
 * failing that, mine one out of the description sentence.
 */
object GameTitles {

    const val PENDING_TITLE = "Назва уточнюється"

    private val ENTITY_ID = Regex("^(?:Q|P|L)\\d+$", RegexOption.IGNORE_CASE)
    private val PLACEHOLDER = Regex(
        "^(?:unknown|undefined|null|невідома гра|назва уточнюється)$",
        RegexOption.IGNORE_CASE,
    )
    private val YEARED_DISAMBIGUATION = Regex("\\s*\\((?:19|20)\\d{2}\\s+video game\\)$", RegexOption.IGNORE_CASE)
    private val KIND_DISAMBIGUATION = Regex("\\s*\\((?:video game|computer game|arcade game)\\)$", RegexOption.IGNORE_CASE)
    private val BARE_KIND = Regex("^(?:video game|computer game|arcade game)$", RegexOption.IGNORE_CASE)

    /** A Unicode-aware stand-in for `\b` at the end of a word. */
    private const val WORD_END = "(?![\\p{L}\\p{N}_])"

    private val DESCRIPTION_PATTERNS = listOf(
        Regex("^(.{2,90}?)\\s+(?:is|was)\\s+(?:an?|the)\\s+\\d{4}\\b", RegexOption.IGNORE_CASE),
        Regex(
            "^(.{2,90}?)\\s+(?:is|was)\\s+(?:an?|the)\\s+" +
                "(?:video|computer|arcade|action|role-playing|adventure|platform|strategy|" +
                "simulation|racing|fighting|shooter|puzzle)\\b",
            RegexOption.IGNORE_CASE,
        ),
        // A literal \b is unusable here: on the JVM \w is ASCII-only, so the boundary after Cyrillic
        // never matches, and Android's ICU engine rejects the (?U) flag that would fix it. This
        // explicit lookahead means the same thing on both.
        Regex("^(.{2,90}?)\\s+[—–-]\\s+(?:це\\s+)?(?:відеогра|гра)$WORD_END", RegexOption.IGNORE_CASE),
        Regex("^(.{2,90}?)\\s+—\\s+відеогра$WORD_END", RegexOption.IGNORE_CASE),
    )

    fun isInvalid(value: String?): Boolean {
        val title = value?.trim().orEmpty()
        return title.isEmpty() || ENTITY_ID.matches(title) || PLACEHOLDER.matches(title)
    }

    /** True when the stored title is a placeholder that a fresh lookup could still improve. */
    fun needsRepair(value: String?): Boolean = isInvalid(value) || value == PENDING_TITLE

    fun cleanDisplay(value: String?): String {
        var title = value.orEmpty().replace('_', ' ').replace(Regex("\\s+"), " ").trim()
        if (title.isEmpty()) return ""
        title = title.replace(YEARED_DISAMBIGUATION, "")
        title = title.replace(KIND_DISAMBIGUATION, "")
        return title.trim()
    }

    /** Extracts a title from a lead sentence like "Chrono Trigger is a 1995 role-playing game". */
    fun inferFromDescription(description: String?): String {
        val text = description.orEmpty().replace(Regex("\\s+"), " ").trim()
        if (text.isEmpty()) return ""
        for (pattern in DESCRIPTION_PATTERNS) {
            val candidate = cleanDisplay(pattern.find(text)?.groupValues?.getOrNull(1))
            if (candidate.isNotEmpty() && !isInvalid(candidate) && candidate.length <= 90) return candidate
        }
        return ""
    }

    /** First usable name from [candidates], in caller-defined preference order. */
    fun chooseBest(candidates: List<String?>): String {
        for (raw in candidates) {
            val candidate = cleanDisplay(raw)
            if (candidate.isEmpty() || isInvalid(candidate) || BARE_KIND.matches(candidate)) continue
            return candidate
        }
        return ""
    }
}
