package com.saveslot.app.core.text

/**
 * Canonicalisation of platform names.
 *
 * Wikidata labels the same console many ways ("Microsoft Windows", "PC", "Sony PlayStation 2"),
 * and artwork lookups only work if a game's platform list collapses onto one spelling per system.
 */
object PlatformNames {

    private val CANONICAL: Map<String, String> = mapOf(
        "microsoft windows" to "Windows",
        "windows" to "Windows",
        "windows pc" to "Windows",
        "pc" to "Windows",
        "macos" to "macOS",
        "mac os" to "macOS",
        "macintosh operating systems" to "macOS",
        "classic mac os" to "macOS",
        "linux" to "Linux",
        "dos" to "DOS",
        "ms dos" to "DOS",
        "arcade game" to "Arcade",
        "arcade" to "Arcade",
        // Vendor-prefixed spellings appear in Wikidata aliases and in artwork filenames, and have
        // to fold onto the same canonical name or a game's platform list splits in two.
        "sony playstation" to "PlayStation",
        "playstation" to "PlayStation",
        "ps1" to "PlayStation",
        "playstation 2" to "PlayStation 2",
        "sony playstation 2" to "PlayStation 2",
        "ps2" to "PlayStation 2",
        "playstation 3" to "PlayStation 3",
        "sony playstation 3" to "PlayStation 3",
        "ps3" to "PlayStation 3",
        "playstation 4" to "PlayStation 4",
        "sony playstation 4" to "PlayStation 4",
        "ps4" to "PlayStation 4",
        "playstation 5" to "PlayStation 5",
        "sony playstation 5" to "PlayStation 5",
        "ps5" to "PlayStation 5",
        "playstation portable" to "PlayStation Portable",
        "sony playstation portable" to "PlayStation Portable",
        "psp" to "PlayStation Portable",
        "playstation vita" to "PlayStation Vita",
        "sony playstation vita" to "PlayStation Vita",
        "ps vita" to "PlayStation Vita",
        "nintendo gamecube" to "Nintendo GameCube",
        "gamecube" to "Nintendo GameCube",
        "nintendo entertainment system" to "Nintendo Entertainment System",
        "nes" to "Nintendo Entertainment System",
        "super nintendo entertainment system" to "Super Nintendo Entertainment System",
        "super nintendo" to "Super Nintendo Entertainment System",
        "snes" to "Super Nintendo Entertainment System",
        "nintendo 64" to "Nintendo 64",
        "n64" to "Nintendo 64",
        "nintendo ds" to "Nintendo DS",
        "nintendo dsi" to "Nintendo DS",
        "nintendo 3ds" to "Nintendo 3DS",
        "game boy" to "Game Boy",
        "game boy color" to "Game Boy Color",
        "game boy advance" to "Game Boy Advance",
        "wii" to "Wii",
        "wii u" to "Wii U",
        "nintendo switch" to "Nintendo Switch",
        "virtual boy" to "Virtual Boy",
        "microsoft xbox" to "Xbox",
        "xbox" to "Xbox",
        "xbox 360" to "Xbox 360",
        "microsoft xbox 360" to "Xbox 360",
        "xbox one" to "Xbox One",
        "microsoft xbox one" to "Xbox One",
        "xbox series x s" to "Xbox Series X/S",
        "xbox series x/s" to "Xbox Series X/S",
        "sega dreamcast" to "Dreamcast",
        "dreamcast" to "Dreamcast",
        "sega saturn" to "Sega Saturn",
        "saturn" to "Sega Saturn",
        "sega genesis" to "Sega Genesis",
        "genesis" to "Sega Genesis",
        "mega drive" to "Mega Drive",
        "sega mega drive" to "Mega Drive",
        "sega master system" to "Sega Master System",
        "master system" to "Sega Master System",
        "game gear" to "Game Gear",
        "sega game gear" to "Game Gear",
        "pc engine" to "PC Engine",
        "turbografx 16" to "TurboGrafx-16",
        "turbografx-16" to "TurboGrafx-16",
        "neo geo" to "Neo Geo",
        "neo geo pocket color" to "Neo Geo Pocket Color",
        "atari 2600" to "Atari 2600",
        "atari 7800" to "Atari 7800",
        "atari lynx" to "Atari Lynx",
        "atari jaguar" to "Jaguar",
        "jaguar" to "Jaguar",
        "commodore 64" to "Commodore 64",
        "amiga" to "Amiga",
        "zx spectrum" to "ZX Spectrum",
        "msx" to "MSX",
        "msx2" to "MSX",
    )

    /** Extra spellings that appear inside artwork filenames for a given canonical platform. */
    private val ALIASES: Map<String, List<String>> = mapOf(
        "playstation 2" to listOf("playstation 2", "sony playstation 2", "ps2", "ps 2"),
        "playstation 3" to listOf("playstation 3", "sony playstation 3", "ps3", "ps 3"),
        "playstation" to listOf("playstation", "sony playstation", "ps1", "psx"),
        "playstation portable" to listOf("playstation portable", "psp"),
        "playstation vita" to listOf("playstation vita", "ps vita", "vita"),
        "nintendo ds" to listOf("nintendo ds", "nintendo dsi", "ds", "nds"),
        "nintendo 3ds" to listOf("nintendo 3ds", "3ds"),
        "wii" to listOf("wii"),
        "wii u" to listOf("wii u"),
        "gamecube" to listOf("gamecube", "nintendo gamecube", "game cube", "gc"),
        "nintendo gamecube" to listOf("gamecube", "nintendo gamecube", "game cube", "gc"),
        "nintendo switch" to listOf("nintendo switch", "switch"),
        "game boy" to listOf("game boy", "gb"),
        "game boy color" to listOf("game boy color", "gbc"),
        "game boy advance" to listOf("game boy advance", "gba"),
        "nintendo 64" to listOf("nintendo 64", "n64"),
        "super nintendo entertainment system" to
            listOf("super nintendo entertainment system", "super nintendo", "snes"),
        "nintendo entertainment system" to listOf("nintendo entertainment system", "nes"),
        "windows" to listOf("windows", "pc"),
        "xbox 360" to listOf("xbox 360"),
        "xbox one" to listOf("xbox one"),
        "dreamcast" to listOf("dreamcast"),
        "saturn" to listOf("saturn", "sega saturn"),
        "sega saturn" to listOf("saturn", "sega saturn"),
        "mega drive" to listOf("mega drive", "genesis", "sega genesis"),
        "sega genesis" to listOf("mega drive", "genesis", "sega genesis"),
        "arcade game" to listOf("arcade", "arcade game"),
        "arcade" to listOf("arcade", "arcade game"),
    )

    private val PC_TOKENS = listOf("windows", "linux", "macos", "mac os", "pc", "steam deck")

    /** Names that describe a category rather than a system, and are never useful as a platform. */
    private val NON_PLATFORM = Regex("^(console|home computer|personal computer)$", RegexOption.IGNORE_CASE)

    fun canonical(value: String?): String {
        val raw = value?.trim().orEmpty()
        if (raw.isEmpty()) return ""
        return CANONICAL[normalizeLoose(raw)] ?: raw
    }

    fun aliases(platform: String?): List<String> {
        val key = normalizeLoose(platform.orEmpty())
        if (key.isEmpty()) return emptyList()
        return (listOf(key) + ALIASES[key].orEmpty()).distinct()
    }

    /** Every alias of the game's first few platforms — used to reject cross-platform artwork. */
    fun termsFor(platforms: List<String>): List<String> =
        platforms.take(3).flatMap { aliases(it) }.distinct()

    fun isPc(platform: String?): Boolean {
        val value = normalizeLoose(platform.orEmpty())
        if (value.isEmpty()) return false
        return PC_TOKENS.any { value == it || value.contains(it) }
    }

    /** True when [selected] and any entry of [platforms] describe the same system. */
    fun listsMatch(platforms: List<String>, selected: String): Boolean {
        if (selected.isEmpty()) return true
        val selectedTokens = aliases(canonical(selected)).toSet()
        return platforms.any { platform ->
            aliases(canonical(platform)).any { it in selectedTokens }
        }
    }

    fun sanitize(values: List<String>, isPlatform: Boolean): List<String> {
        val cleaned = LinkedHashSet<String>()
        for (raw in values) {
            var value = raw.trim()
            if (value.isEmpty() || WIKIDATA_ID.matches(value)) continue
            if (isPlatform) value = canonical(value)
            if (GENERIC_LABEL.matches(value)) continue
            if (isPlatform && NON_PLATFORM.matches(value)) continue
            cleaned += value
        }
        return cleaned.toList()
    }

    /**
     * Picks the platform a game is most associated with, by looking for platform mentions in its
     * description and preferring earlier entries when nothing stands out.
     */
    fun inferPrimary(platforms: List<String>, description: String): String {
        if (platforms.isEmpty()) return ""
        val text = normalizeLoose(description)
        var bestPlatform = platforms.first()
        var bestScore = 0.0
        platforms.forEachIndexed { index, platform ->
            val aliases = aliases(platform).filter { it.length > 2 }
            var score = aliases.sumOf { if (text.contains(it)) 18.0 else 0.0 }
            if (EXCLUSIVITY.containsMatchIn(text) && aliases.any { text.contains(it) }) score += 36.0
            score -= index * 0.35
            if (score > bestScore) {
                bestScore = score
                bestPlatform = platform
            }
        }
        return if (bestScore > 0) bestPlatform else platforms.first()
    }

    private val WIKIDATA_ID = Regex("^Q\\d+$", RegexOption.IGNORE_CASE)
    private val GENERIC_LABEL = Regex("^(wikimedia|wikipedia|video game)$", RegexOption.IGNORE_CASE)
    private val EXCLUSIVITY = Regex("(only|exclusively|originally|спочатку|лише|ексклюзивно)", RegexOption.IGNORE_CASE)
}
