package com.saveslot.app.render

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.File
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

/**
 * Covers the persistence contract for pre-drawn cartridges: a cover is rendered once and then read
 * back, a corrupt file heals itself, and the directory stays bounded.
 */
@RunWith(AndroidJUnit4::class)
// Bitmap encoding and decoding used by this cache do not depend on API 36. Robolectric platform
// images lag the Android compile SDK, so the JVM test runs against its latest supported image.
@Config(sdk = [35])
class CartridgeDiskCacheTest {

    private lateinit var directory: File

    @Before
    fun setUp() {
        directory = File.createTempFile("cartridges", "").let { file ->
            file.delete()
            file.mkdirs()
            file
        }
    }

    @After
    fun tearDown() {
        directory.deleteRecursively()
    }

    private fun cartridge(color: Int = 0xFF3366CC.toInt()): Bitmap =
        Bitmap.createBitmap(8, 10, Bitmap.Config.ARGB_8888).apply { eraseColor(color) }

    @Test
    fun `a written cartridge is read back`() = runTest {
        val cache = CartridgeDiskCache(directory)
        cache.write("https://example.org/cover.png", cartridge())

        val restored = cache.read("https://example.org/cover.png")

        assertNotNull("cartridge was not persisted", restored)
        assertEquals(8, restored!!.width)
        assertEquals(10, restored.height)
    }

    @Test
    fun `an unrendered cover reads as absent`() = runTest {
        val cache = CartridgeDiskCache(directory)
        assertNull(cache.read("https://example.org/never-drawn.png"))
    }

    @Test
    fun `different covers do not collide`() = runTest {
        val cache = CartridgeDiskCache(directory)
        // Steam covers differ only in a path segment, so a weak key would merge them.
        cache.write("https://cdn/steam/apps/1/library_600x900.jpg", cartridge())
        cache.write("https://cdn/steam/apps/2/library_600x900.jpg", cartridge())

        assertEquals(2, directory.listFiles()?.count { it.isFile })
    }

    // Note: recovery from a truncated file (delete and re-render) is not covered here. Robolectric's
    // BitmapFactory shadow does not actually decode, so it hands back a bitmap for arbitrary bytes
    // and cannot express a decode failure. That path needs an instrumented test on a device.

    @Test
    fun `the directory is pruned back under its limit`() = runTest {
        // A limit far below one entry forces pruning on every write.
        val cache = CartridgeDiskCache(directory, maxBytes = 1)
        repeat(4) { index -> cache.write("https://example.org/$index.png", cartridge()) }

        val remaining = directory.listFiles()?.count { it.isFile } ?: 0
        assertTrue("pruning left $remaining files", remaining <= 1)
    }
}
