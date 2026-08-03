package com.saveslot.app.core.log

import android.util.Log
import coil3.ImageLoader
import com.saveslot.app.BuildConfig

/**
 * Tracing for the artwork pipeline.
 *
 * A single cover travels through three independent asynchronous stages — Coil's fetch/decode, the
 * off-screen cartridge render, and the card composable that consumes whichever finishes first — and
 * each has its own cache. When artwork appears and then vanishes, the useful question is *which*
 * stage changed its mind, so every stage logs under its own tag with the same cover key.
 *
 * Filter one stage:      `adb logcat -s SS.Coil`
 * Follow one cover:      `adb logcat | grep 'Foo.png'`
 * Everything, in order:  `adb logcat -s SS.Coil SS.Preview SS.Card SS.Slot`
 */
object ImageLog {

    /**
     * Whether the artwork trace writes anything.
     *
     * Defaults to debug builds only. `Log.d` is a synchronous write to the logging socket, and the
     * card-level trace fires as cards scroll in and out — on the main thread — so leaving it on in a
     * release build would cost frames during exactly the scroll it was added to diagnose. R8 also
     * folds the constant away, removing the message lambdas entirely.
     *
     * Set to true manually to trace a release build.
     */
    var enabled: Boolean = BuildConfig.DEBUG

    /** Coil requests: start, cache tier hit, cancel, failure. */
    const val TAG_COIL = "SS.Coil"

    /** The off-screen cartridge renderer and its bitmap cache. */
    const val TAG_PREVIEW = "SS.Preview"

    /** What each card actually has on screen right now. */
    const val TAG_CARD = "SS.Card"

    /** The cartridge seated in the console face. */
    const val TAG_SLOT = "SS.Slot"

    inline fun d(tag: String, message: () -> String) {
        if (enabled) Log.d(tag, message())
    }

    inline fun w(tag: String, error: Throwable? = null, message: () -> String) {
        if (!enabled) return
        val text = message()
        if (error == null) Log.w(tag, text) else Log.w(tag, text, error)
    }

    /**
     * Shortens a cover URL to something greppable.
     *
     * Artwork URLs run to a few hundred characters of percent-encoded title, which pushes the part
     * that identifies the image off the end of the logcat line.
     *
     * Keeps the host and the last *two* path segments, not just the filename: every Steam cover is
     * called `library_600x900.jpg` and is told apart only by the app id in the segment above it, so
     * trimming to the filename alone makes four different games print as one URL.
     */
    fun key(value: Any?): String {
        val raw = value?.toString().orEmpty()
        if (raw.isEmpty()) return "<none>"
        if (raw == FALLBACK_KEY) return "<fallback>"
        if (raw.length <= MAX_KEY_LENGTH) return raw
        val path = raw.substringAfter("://", raw).split('/').filter { it.isNotEmpty() }
        val host = path.firstOrNull().orEmpty()
        val tail = path.drop(1).takeLast(2).joinToString("/").takeLast(MAX_KEY_LENGTH)
        return if (tail.isEmpty()) "…${raw.takeLast(MAX_KEY_LENGTH)}" else "$host/…/$tail"
    }

    /** Occupancy of both Coil caches, for spotting artwork evicted mid-scroll. */
    fun coilCaches(imageLoader: ImageLoader): String {
        val memory = imageLoader.memoryCache
        val disk = imageLoader.diskCache
        val memoryPart = if (memory == null) {
            "mem=off"
        } else {
            "mem=${memory.size / MIB}/${memory.maxSize / MIB}MB(${memory.keys.size})"
        }
        val diskPart = if (disk == null) "disk=off" else "disk=${disk.size / MIB}/${disk.maxSize / MIB}MB"
        return "$memoryPart $diskPart"
    }

    private const val MAX_KEY_LENGTH = 48
    private const val MIB = 1024L * 1024L

    /**
     * Mirrors the cards' fallback preview key so it prints as a word rather than a sentinel. Kept
     * here as a literal to avoid a UI dependency from a logging utility.
     */
    private const val FALLBACK_KEY = "__save_slot_fallback__"
}
