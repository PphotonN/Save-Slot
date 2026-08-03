package com.saveslot.app.core.text

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArtworkFilenamesTest {

    private val platforms = listOf("PlayStation 2", "Xbox")

    private val matcher = titleMatcherOf(
        title = "Silent Hill 2",
        originalTitle = "Silent Hill 2",
        aliases = emptyList(),
        year = 2001,
        activePlatform = "PlayStation 2",
    )

    @Test
    fun `a cover for the viewed platform is accepted`() {
        assertTrue(
            ArtworkFilenames.isCoverCandidate(
                "File:Silent Hill 2 PlayStation 2 cover.jpg",
                matcher,
                platforms,
                "PlayStation 2",
            ),
        )
    }

    @Test
    fun `a cover for another platform release is rejected`() {
        assertFalse(
            ArtworkFilenames.isCoverCandidate(
                "File:Silent Hill 2 Xbox cover.jpg",
                matcher,
                platforms,
                "PlayStation 2",
            ),
        )
    }

    @Test
    fun `an unlabelled cover is accepted`() {
        // Most Commons files name no platform at all; rejecting those would lose real covers.
        assertTrue(
            ArtworkFilenames.isCoverCandidate(
                "File:Silent Hill 2 box art.png",
                matcher,
                platforms,
                "PlayStation 2",
            ),
        )
    }

    @Test
    fun `rating badges and wiki chrome are never artwork`() {
        listOf(
            "File:ESRB Mature rating.png",
            "File:PEGI 18 Silent Hill 2.png",
            "File:Commons-logo.svg.png",
            "File:Ambox warning.png",
        ).forEach { name ->
            assertFalse(name, ArtworkFilenames.isScreenshotCandidate(name, matcher, platforms, "PlayStation 2"))
        }
    }

    @Test
    fun `a screenshot needs a gameplay word and a title match`() {
        assertTrue(
            ArtworkFilenames.isScreenshotCandidate(
                "File:Silent Hill 2 gameplay screenshot.jpg",
                matcher,
                platforms,
                "PlayStation 2",
            ),
        )
        assertFalse(
            ArtworkFilenames.isScreenshotCandidate(
                "File:Silent Hill 2 promotional poster.jpg",
                matcher,
                platforms,
                "PlayStation 2",
            ),
        )
    }

    @Test
    fun `a cover is not offered as a screenshot`() {
        assertFalse(
            ArtworkFilenames.isScreenshotCandidate(
                "File:Silent Hill 2 cover screen.jpg",
                matcher,
                platforms,
                "PlayStation 2",
            ),
        )
    }

    @Test
    fun `article screenshots do not require a title match`() {
        // The article is already about the right game, so the filename need not repeat its name.
        assertTrue(
            ArtworkFilenames.isArticleScreenshotCandidate(
                "File:Combat in a foggy street screenshot.jpg",
                matcher,
                platforms,
                "PlayStation 2",
            ),
        )
    }

    @Test
    fun `non-image files are ignored`() {
        assertFalse(ArtworkFilenames.isImage("File:Silent Hill 2 theme.ogg"))
        assertTrue(ArtworkFilenames.isImage("File:Silent Hill 2 cover.jpeg"))
    }

    @Test
    fun `other-platform detection ignores the selected platform`() {
        assertFalse(
            ArtworkFilenames.mentionsOtherPlatform(
                "silent hill 2 playstation 2 cover",
                platforms,
                "PlayStation 2",
            ),
        )
        assertTrue(
            ArtworkFilenames.mentionsOtherPlatform("silent hill 2 xbox cover", platforms, "PlayStation 2"),
        )
    }

    @Test
    fun `url-encoded names are decoded before matching`() {
        assertTrue(
            ArtworkFilenames.isCoverCandidate(
                "Silent%20Hill%202%20box%20art.jpg",
                matcher,
                platforms,
                "PlayStation 2",
            ),
        )
    }
}
