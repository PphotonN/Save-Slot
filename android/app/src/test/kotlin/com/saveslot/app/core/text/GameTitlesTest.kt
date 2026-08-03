package com.saveslot.app.core.text

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GameTitlesTest {

    @Test
    fun `entity ids and placeholders count as invalid titles`() {
        assertTrue(GameTitles.isInvalid("Q12345"))
        assertTrue(GameTitles.isInvalid(""))
        assertTrue(GameTitles.isInvalid("undefined"))
        assertTrue(GameTitles.isInvalid(GameTitles.PENDING_TITLE))
        assertFalse(GameTitles.isInvalid("Chrono Trigger"))
    }

    @Test
    fun `display titles lose their disambiguator`() {
        assertEquals("Ico", GameTitles.cleanDisplay("Ico (video game)"))
        assertEquals("Prey", GameTitles.cleanDisplay("Prey (2017 video game)"))
        assertEquals("Rez Infinite", GameTitles.cleanDisplay("Rez_Infinite"))
    }

    @Test
    fun `chooseBest takes the first usable candidate`() {
        assertEquals(
            "Vagrant Story",
            GameTitles.chooseBest(listOf("Q1234", "", "Vagrant Story", "Something Else")),
        )
    }

    @Test
    fun `chooseBest rejects bare category names`() {
        assertEquals("Klonoa", GameTitles.chooseBest(listOf("video game", "Klonoa")))
    }

    @Test
    fun `chooseBest returns empty when nothing is usable`() {
        assertEquals("", GameTitles.chooseBest(listOf("Q1", null, "unknown")))
    }

    @Test
    fun `a title can be mined out of an english lead sentence`() {
        assertEquals(
            "Chrono Trigger",
            GameTitles.inferFromDescription("Chrono Trigger is a 1995 role-playing video game"),
        )
        assertEquals(
            "System Shock 2",
            GameTitles.inferFromDescription("System Shock 2 is an action role-playing game developed by Irrational"),
        )
    }

    @Test
    fun `a title can be mined out of a ukrainian lead sentence`() {
        assertEquals("Космічні рейнджери", GameTitles.inferFromDescription("Космічні рейнджери — відеогра 2002 року"))
    }

    @Test
    fun `descriptions with no recognisable pattern yield nothing`() {
        assertEquals("", GameTitles.inferFromDescription("Released in several regions."))
        assertEquals("", GameTitles.inferFromDescription(null))
    }

    @Test
    fun `needsRepair covers placeholders that a fresh lookup could fix`() {
        assertTrue(GameTitles.needsRepair("Q999"))
        assertTrue(GameTitles.needsRepair(GameTitles.PENDING_TITLE))
        assertFalse(GameTitles.needsRepair("Panzer Dragoon Saga"))
    }
}
