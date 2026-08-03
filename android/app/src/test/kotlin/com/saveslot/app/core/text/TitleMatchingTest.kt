package com.saveslot.app.core.text

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TitleMatchingTest {

    private fun matcher(
        title: String,
        original: String? = null,
        aliases: List<String> = emptyList(),
        year: Int? = null,
        platform: String = "",
    ) = titleMatcherOf(title, original ?: title, aliases, year, platform)

    @Test
    fun `normalizeLoose collapses separators but keeps apostrophes`() {
        // Apostrophes are load-bearing: "Demon's Souls" and "Demons Souls" both occur upstream, and
        // token overlap still matches them, whereas stripping them would merge unrelated words.
        assertEquals(
            "the legend of zelda link's awakening",
            normalizeLoose("The Legend of Zelda: Link's Awakening"),
        )
        assertEquals("final fantasy vii", normalizeLoose("Final_Fantasy  (VII)"))
    }

    @Test
    fun `cleanTitleForMedia drops the video game disambiguator`() {
        assertEquals("Ico", cleanTitleForMedia("Ico (video game)"))
        assertEquals("Rez", cleanTitleForMedia("Rez (Video Game) "))
    }

    @Test
    fun `exact title matches score highest`() {
        val subject = matcher("Chrono Trigger")
        assertTrue(subject.score("Chrono Trigger") >= 180.0)
        assertTrue(subject.matchesTitle("chrono trigger"))
    }

    @Test
    fun `a different instalment of the same series is rejected`() {
        val firstGame = matcher("Final Fantasy")
        assertTrue(firstGame.installmentMismatch("Final Fantasy VII"))
        assertEquals(0.0, firstGame.score("Final Fantasy VII"), 0.0)

        val seventh = matcher("Final Fantasy VII")
        assertTrue(seventh.installmentMismatch("Final Fantasy"))
        assertTrue(seventh.installmentMismatch("Final Fantasy VIII"))
        assertFalse(seventh.installmentMismatch("Final Fantasy VII cover"))
    }

    @Test
    fun `roman numerals are compared as numbers`() {
        val second = matcher("Silent Hill II")
        assertFalse(second.installmentMismatch("Silent Hill 2 box art"))
        assertTrue(second.installmentMismatch("Silent Hill 3"))
    }

    @Test
    fun `a release year in a filename is not read as an instalment`() {
        val subject = matcher("Prey", year = 2017)
        assertFalse(subject.installmentMismatch("Prey 2017 cover"))
    }

    @Test
    fun `platform model numbers are not read as instalments`() {
        val subject = matcher("GoldenEye 007", platform = "Nintendo 64")
        assertFalse(subject.installmentMismatch("GoldenEye 007 Nintendo 64 box"))
    }

    @Test
    fun `two-digit sports years do not trigger a mismatch`() {
        // Values in 70..99 are ignored precisely so "NHL 98" style titles stay matchable.
        val subject = matcher("NHL 98")
        assertFalse(subject.installmentMismatch("NHL 98 cover"))
    }

    @Test
    fun `unrelated titles do not match`() {
        val subject = matcher("Hollow Knight")
        assertFalse(subject.matchesTitle("Celeste cover"))
    }

    @Test
    fun `aliases widen matching`() {
        val subject = matcher("Мор", original = "Pathologic", aliases = listOf("Pathologic Classic HD"))
        assertTrue(subject.matchesTitle("Pathologic Classic HD front cover"))
    }

    @Test
    fun `keywords ignore short and generic words`() {
        val subject = matcher("The Last Guardian")
        // "last" and "guardian" both count; "the" is a stop word and too short anyway.
        assertEquals(2, subject.keywordHits("last guardian screenshot"))
        assertEquals(0, subject.keywordHits("the game video"))
    }

    @Test
    fun `installmentConflict tolerates an unnumbered candidate`() {
        val subject = matcher("Silent Hill 2")
        // Strict matching demands the "2"; the relaxed check only rejects a contradicting number.
        assertTrue(subject.installmentMismatch("foggy street screenshot"))
        assertFalse(subject.installmentConflict("foggy street screenshot"))
        assertTrue(subject.installmentConflict("Silent Hill 3 screenshot"))
    }

    @Test
    fun `filenameFromUrl strips query and path`() {
        assertEquals(
            "Chrono_Trigger_cover.png",
            filenameFromUrl("https://example.org/a/b/Chrono_Trigger_cover.png?width=900"),
        )
    }

    @Test
    fun `thumbnailSafeName removes characters archives cannot use`() {
        assertEquals("Ratchet _ Clank_ Up Your Arsenal", thumbnailSafeName("Ratchet / Clank: Up Your Arsenal"))
    }
}
