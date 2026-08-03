package com.saveslot.app.core.text

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlatformNamesTest {

    @Test
    fun `wikidata labels canonicalise onto one spelling per system`() {
        assertEquals("Windows", PlatformNames.canonical("Microsoft Windows"))
        assertEquals("Windows", PlatformNames.canonical("PC"))
        assertEquals("Nintendo GameCube", PlatformNames.canonical("GameCube"))
        assertEquals("PlayStation Portable", PlatformNames.canonical("PSP"))
        assertEquals("PlayStation 2", PlatformNames.canonical("Sony PlayStation 2"))
    }

    @Test
    fun `unknown platforms are passed through unchanged`() {
        assertEquals("Fairchild Channel F", PlatformNames.canonical("Fairchild Channel F"))
        assertEquals("", PlatformNames.canonical(null))
    }

    @Test
    fun `aliases cover the spellings that appear in filenames`() {
        val aliases = PlatformNames.aliases("PlayStation 2")
        assertTrue(aliases.contains("ps2"))
        assertTrue(aliases.contains("playstation 2"))
    }

    @Test
    fun `pc detection spans the desktop platforms`() {
        assertTrue(PlatformNames.isPc("Windows"))
        assertTrue(PlatformNames.isPc("Linux"))
        assertTrue(PlatformNames.isPc("macOS"))
        assertFalse(PlatformNames.isPc("Nintendo Switch"))
        assertFalse(PlatformNames.isPc(""))
    }

    @Test
    fun `listsMatch compares across spellings`() {
        assertTrue(PlatformNames.listsMatch(listOf("Mega Drive"), "Sega Genesis"))
        assertTrue(PlatformNames.listsMatch(listOf("Microsoft Windows"), "PC"))
        assertFalse(PlatformNames.listsMatch(listOf("Nintendo 64"), "PlayStation"))
    }

    @Test
    fun `an empty selection matches everything`() {
        assertTrue(PlatformNames.listsMatch(listOf("Nintendo 64"), ""))
    }

    @Test
    fun `sanitize drops entity ids, category words and duplicates`() {
        val cleaned = PlatformNames.sanitize(
            listOf("Q12345", "Microsoft Windows", "PC", "console", "video game", "Nintendo 64"),
            isPlatform = true,
        )
        assertEquals(listOf("Windows", "Nintendo 64"), cleaned)
    }

    @Test
    fun `genre sanitisation keeps category-sounding names`() {
        // "console" is only meaningless as a platform; as a genre-ish label it is left alone.
        val cleaned = PlatformNames.sanitize(listOf("console", "платформер"), isPlatform = false)
        assertEquals(listOf("console", "платформер"), cleaned)
    }

    @Test
    fun `primary platform follows the description`() {
        val platforms = listOf("Nintendo 64", "PlayStation")
        val description = "originally released only for the PlayStation in 1998"
        assertEquals("PlayStation", PlatformNames.inferPrimary(platforms, description))
    }

    @Test
    fun `primary platform falls back to the first entry`() {
        val platforms = listOf("Nintendo 64", "PlayStation")
        assertEquals("Nintendo 64", PlatformNames.inferPrimary(platforms, "a video game"))
        assertEquals("", PlatformNames.inferPrimary(emptyList(), "a video game"))
    }
}
