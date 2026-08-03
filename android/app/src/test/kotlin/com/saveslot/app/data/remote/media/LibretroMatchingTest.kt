package com.saveslot.app.data.remote.media

import com.saveslot.app.core.text.titleMatcherOf
import com.saveslot.app.domain.model.Game
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LibretroMatchingTest {

    private fun game(
        title: String,
        original: String = title,
        platforms: List<String> = listOf("Nintendo 64"),
        year: Int? = null,
    ) = Game(id = "Q1", title = title, originalTitle = original, platforms = platforms, year = year)

    private fun matcherFor(game: Game) = titleMatcherOf(
        title = game.title,
        originalTitle = game.originalTitle,
        aliases = game.aliases,
        year = game.year,
        activePlatform = game.activePlatform,
    )

    @Test
    fun `region and revision tags are stripped before comparison`() {
        assertEquals(
            "super mario 64",
            LibretroProvider.normalizeArchiveName("Named_Boxarts/Super Mario 64 (USA).png"),
        )
        assertEquals(
            "chrono trigger",
            LibretroProvider.normalizeArchiveName("Named_Snaps/Chrono%20Trigger%20(USA)%20(Rev%201).png"),
        )
    }

    @Test
    fun `a mid-string inverted article normalises to plain tokens`() {
        // The comma is dropped, leaving the same token set as "The Legend of Zelda Ocarina of Time",
        // which is what token-overlap scoring needs; word order is not significant to it.
        assertEquals(
            "legend of zelda the ocarina of time",
            LibretroProvider.normalizeArchiveName("Legend of Zelda, The - Ocarina of Time (USA).png"),
        )
    }

    @Test
    fun `a trailing inverted article is un-inverted`() {
        assertEquals(
            "shining force the",
            LibretroProvider.normalizeArchiveName("Shining Force, The (USA).png"),
        )
    }

    @Test
    fun `an exact archive filename scores at the top`() {
        val subject = game("Super Mario 64")
        val score = LibretroProvider.matchScore(
            "Named_Boxarts/Super Mario 64 (USA).png",
            subject,
            matcherFor(subject),
        )
        assertTrue("score was $score", score >= 200.0)
    }

    @Test
    fun `an inverted-article filename still matches the plain title`() {
        val subject = game("The Legend of Zelda: Ocarina of Time")
        val score = LibretroProvider.matchScore(
            "Named_Boxarts/Legend of Zelda, The - Ocarina of Time (USA).png",
            subject,
            matcherFor(subject),
        )
        assertTrue("score was $score", score >= 82.0)
    }

    @Test
    fun `a sequel's artwork does not match the original`() {
        val subject = game("Banjo-Kazooie")
        val score = LibretroProvider.matchScore(
            "Named_Boxarts/Banjo-Tooie (USA).png",
            subject,
            matcherFor(subject),
        )
        assertTrue("score was $score", score < 82.0)
    }

    @Test
    fun `a numbered sequel does not match a differently numbered title`() {
        val subject = game("Mega Man 2", platforms = listOf("Nintendo Entertainment System"))
        val score = LibretroProvider.matchScore(
            "Named_Boxarts/Mega Man 3 (USA).png",
            subject,
            matcherFor(subject),
        )
        assertEquals(0.0, score, 0.0)
    }

    @Test
    fun `filename candidates cover punctuation and article conventions`() {
        val candidates = LibretroProvider.titleCandidates(game("The Legend of Zelda: Ocarina of Time"))
        // The spelling the archive actually uses: article inverted, subtitle after " - ".
        assertTrue(candidates.contains("Legend of Zelda, The - Ocarina of Time"))
        assertTrue(candidates.contains("The Legend of Zelda - Ocarina of Time"))
        assertTrue(candidates.any { it.endsWith("(USA)") })
        // Colons are illegal in the archive's filenames, so no candidate may contain one.
        assertTrue(candidates.none { it.contains(':') })
    }

    @Test
    fun `the article moves before the subtitle, not to the very end`() {
        val forms = LibretroProvider.invertedArticleForms("The Legend of Zelda: Ocarina of Time")
        assertTrue(forms.contains("Legend of Zelda, The - Ocarina of Time"))
    }

    @Test
    fun `a title with no article produces no inverted form`() {
        assertTrue(LibretroProvider.invertedArticleForms("Chrono Trigger").isEmpty())
    }

    @Test
    fun `a title with no subtitle inverts the whole string`() {
        val forms = LibretroProvider.invertedArticleForms("The Last Guardian")
        assertTrue(forms.contains("Last Guardian, The"))
    }

    @Test
    fun `candidates are capped so a lookup cannot fan out unboundedly`() {
        val candidates = LibretroProvider.titleCandidates(
            game("A Very Long Title: With Subtitle & Ampersand").copy(
                aliases = List(20) { "Alias Number $it" },
            ),
        )
        assertTrue("was ${candidates.size}", candidates.size <= 48)
    }

    @Test
    fun `platform keys ignore vendor prefixes`() {
        assertEquals("playstation 2", LibretroProvider.normalizePlatformKey("Sony PlayStation 2"))
        assertEquals("xbox 360", LibretroProvider.normalizePlatformKey("Microsoft Xbox 360"))
    }

    @Test
    fun `repository slugs use underscores`() {
        assertEquals(
            "Nintendo_-_Nintendo_64",
            LibretroProvider.repoSlug("Nintendo - Nintendo 64"),
        )
    }

    @Test
    fun `thumbnail urls cover both mirrors`() {
        val urls = LibretroProvider.thumbnailUrls("Sony - PlayStation", "Named_Boxarts", "Vagrant Story")
        assertEquals(2, urls.size)
        assertTrue(urls[0].startsWith("https://thumbnails.libretro.com/"))
        assertTrue(urls[1].startsWith("https://raw.githubusercontent.com/libretro-thumbnails/"))
        assertTrue(urls.all { it.endsWith(".png") })
        // Spaces have to be percent-encoded or the CDN 404s.
        assertTrue(urls.none { it.contains(" ") })
    }
}
