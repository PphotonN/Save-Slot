package com.saveslot.app.data.remote.media

import android.graphics.BitmapFactory
import androidx.collection.LruCache
import com.saveslot.app.core.net.HttpClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

data class ImageMeta(val ok: Boolean, val width: Int, val height: Int) {
    val isPortrait: Boolean get() = ok && height > width
    val isLandscape: Boolean get() = ok && width >= height

    /** True when the image is at least [ratio] times taller than it is wide. */
    fun tallerThanWideBy(ratio: Double): Boolean = ok && height > width * ratio

    /** True when the image is at least [ratio] times wider than it is tall. */
    fun widerThanTallBy(ratio: Double): Boolean = ok && width >= height * ratio

    companion object {
        val MISSING = ImageMeta(ok = false, width = 0, height = 0)
    }
}

/**
 * Reads an image's dimensions without decoding its pixels.
 *
 * Aspect ratio is the app's main artwork filter — portrait means box art, landscape means a
 * screenshot — so every candidate URL is probed before being accepted. Only the leading bytes are
 * fetched and only the header is parsed, and successful probes are cached because the same
 * candidate list is re-checked across platforms and screens.
 *
 * Negative results are deliberately *not* cached: a miss is often a transient network failure, and
 * caching it would permanently blacklist good artwork.
 */
class ImageProbe(private val httpClient: HttpClient) {

    private val cache = LruCache<String, ImageMeta>(320)
    private val inFlight = mutableMapOf<String, Mutex>()
    private val inFlightLock = Mutex()

    suspend fun probe(url: String?, timeoutMillis: Long = DEFAULT_TIMEOUT_MS): ImageMeta {
        if (url.isNullOrEmpty()) return ImageMeta.MISSING
        cache[url]?.let { return it }
        val mutex = inFlightLock.withLock { inFlight.getOrPut(url) { Mutex() } }
        return mutex.withLock {
            cache[url]?.let { return@withLock it }
            val meta = fetchMeta(url, timeoutMillis)
            if (meta.ok) cache.put(url, meta)
            inFlightLock.withLock { inFlight.remove(url) }
            meta
        }
    }

    /**
     * Reads dimensions from as little of the image as possible.
     *
     * A candidate list can run to dozens of URLs per game and only the header is needed, so the
     * first attempt asks for a small byte range. PNG carries its size in the first 33 bytes, WebP in
     * the first 30, and JPEG's frame header sits within the first few KB, so this almost always
     * succeeds — turning a multi-megabyte download per candidate into a few kilobytes. A server that
     * ignores `Range` simply returns the whole body, which also works; only if the prefix is too
     * short to decode does it fall back to a full fetch.
     */
    private suspend fun fetchMeta(url: String, timeoutMillis: Long): ImageMeta {
        val prefix = httpClient.getBytes(url, timeoutMillis, maxBytes = HEADER_BYTES)
        decodeBounds(prefix)?.let { return it }
        val full = httpClient.getBytes(url, timeoutMillis) ?: return ImageMeta.MISSING
        return decodeBounds(full) ?: ImageMeta.MISSING
    }

    private suspend fun decodeBounds(bytes: ByteArray?): ImageMeta? {
        if (bytes == null || bytes.isEmpty()) return null
        return withContext(Dispatchers.Default) {
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
            if (options.outWidth > 0 && options.outHeight > 0) {
                ImageMeta(ok = true, width = options.outWidth, height = options.outHeight)
            } else {
                null
            }
        }
    }

    /**
     * Returns the first URL that both loads and satisfies [validator], probing [batchSize]
     * candidates at a time so a long candidate list does not become a long serial wait.
     */
    suspend fun firstMatching(
        urls: List<String>,
        timeoutMillis: Long = DEFAULT_TIMEOUT_MS,
        batchSize: Int = 4,
        validator: (ImageMeta) -> Boolean = { it.ok },
    ): String? {
        val distinct = urls.filter { it.isNotEmpty() }.distinct()
        for (index in distinct.indices step batchSize) {
            val batch = distinct.subList(index, minOf(index + batchSize, distinct.size))
            val checked = coroutineScope {
                batch.map { url ->
                    async {
                        val meta = probe(url, timeoutMillis)
                        if (meta.ok && validator(meta)) url else null
                    }
                }.map { it.await() }
            }
            checked.firstOrNull { it != null }?.let { return it }
        }
        return null
    }

    /** Probes candidates in batches and keeps every URL that passes, up to [limit]. */
    suspend fun allMatching(
        urls: List<String>,
        limit: Int,
        timeoutMillis: Long = DEFAULT_TIMEOUT_MS,
        batchSize: Int = 4,
        validator: (ImageMeta) -> Boolean = { it.ok },
    ): List<String> {
        val found = LinkedHashSet<String>()
        val distinct = urls.filter { it.isNotEmpty() }.distinct()
        for (index in distinct.indices step batchSize) {
            if (found.size >= limit) break
            val batch = distinct.subList(index, minOf(index + batchSize, distinct.size))
            val checked = coroutineScope {
                batch.map { url ->
                    async {
                        val meta = probe(url, timeoutMillis)
                        if (meta.ok && validator(meta)) url else null
                    }
                }.map { it.await() }
            }
            found += checked.filterNotNull()
        }
        return found.take(limit)
    }

    companion object {
        const val DEFAULT_TIMEOUT_MS = 2_600L

        /** Comfortably covers PNG, WebP and JPEG headers without pulling image data. */
        private const val HEADER_BYTES = 32 * 1024L
    }
}
