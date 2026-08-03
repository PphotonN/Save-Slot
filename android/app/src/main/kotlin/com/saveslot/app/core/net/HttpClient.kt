package com.saveslot.app.core.net

import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import okhttp3.Call
import okhttp3.Callback
import okhttp3.ConnectionPool
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.Buffer
import okio.BufferedSource

/**
 * Thin JSON-over-HTTP layer shared by every remote data source.
 *
 * The upstream APIs are plain query-string endpoints with loosely typed, frequently changing
 * response shapes, so requests are built by URL and parsed as [JsonElement] rather than through
 * a typed service interface. Per-call timeouts are honoured because the media providers race
 * each other and a slow provider must not hold up the chain.
 */
class HttpClient(userAgent: String) {

    val okHttp: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(6, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .callTimeout(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .connectionPool(ConnectionPool(8, 5, TimeUnit.MINUTES))
        .addInterceptor { chain ->
            chain.proceed(
                chain.request().newBuilder()
                    .header("User-Agent", userAgent)
                    .build(),
            )
        }
        .build()

    val json: Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        explicitNulls = false
    }

    suspend fun getJson(url: String, timeoutMillis: Long = DEFAULT_TIMEOUT_MS): JsonElement =
        request(
            Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .get()
                .build(),
            timeoutMillis,
        )

    suspend fun postJson(
        url: String,
        body: String,
        timeoutMillis: Long = DEFAULT_TIMEOUT_MS,
    ): JsonElement =
        request(
            Request.Builder()
                .url(url)
                .header("Accept", "application/json")
                .post(body.toRequestBody(JSON_MEDIA_TYPE))
                .build(),
            timeoutMillis,
        )

    private suspend fun request(request: Request, timeoutMillis: Long): JsonElement =
        withTimeout(timeoutMillis) {
            val body = okHttp.newCall(request).awaitBody()
            withContext(Dispatchers.Default) { json.parseToJsonElement(body) }
        }

    /**
     * Fetches only response headers. Used to check that an artwork URL exists before a heavier
     * decode, on hosts (Libretro mirrors, storefront CDNs) where a miss is a 404.
     */
    suspend fun headOk(url: String, timeoutMillis: Long): Boolean = runCatching {
        withTimeout(timeoutMillis) {
            okHttp.newCall(
                Request.Builder().url(url).head().build(),
            ).awaitResponse().use { it.isSuccessful }
        }
    }.getOrDefault(false)

    /**
     * Downloads a response body, optionally only its first [maxBytes].
     *
     * When [maxBytes] is set the request carries a `Range` header, and the read is capped even if the
     * server ignores it — so a caller that only needs an image header never buffers a whole
     * multi-megabyte file.
     */
    suspend fun getBytes(
        url: String,
        timeoutMillis: Long,
        maxBytes: Long? = null,
    ): ByteArray? = runCatching {
        withTimeout(timeoutMillis) {
            val builder = Request.Builder().url(url).get()
            if (maxBytes != null) builder.header("Range", "bytes=0-${maxBytes - 1}")
            okHttp.newCall(builder.build()).awaitResponse().use { response ->
                // 206 Partial Content when the range was honoured, 200 when it was ignored.
                if (!response.isSuccessful) return@use null
                val body = response.body ?: return@use null
                if (maxBytes == null) body.bytes() else body.source().readAtMost(maxBytes)
            }
        }
    }.getOrNull()

    companion object {
        const val DEFAULT_TIMEOUT_MS = 10_000L
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}

private suspend fun Call.awaitBody(): String = awaitResponse().use { response ->
    if (!response.isSuccessful) throw HttpStatusException(response.code)
    response.body?.string() ?: throw IOException("empty response body")
}

internal suspend fun Call.awaitResponse(): Response = suspendCancellableCoroutine { continuation ->
    continuation.invokeOnCancellation { runCatching { cancel() } }
    enqueue(
        object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resumeWithException(e)
            }

            override fun onResponse(call: Call, response: Response) {
                // A cancellation racing the callback — a per-call `withTimeout` expiring, or a
                // media provider losing its race — makes the machinery discard this value and
                // resume the caller with CancellationException instead, so the `use` block below
                // never runs. The response has to be closed here or its connection leaks.
                continuation.resume(response) { _, discarded, _ ->
                    runCatching { discarded.close() }
                }
            }
        },
    )
}

class HttpStatusException(val code: Int) : IOException("HTTP $code")

/**
 * Reads at most [limit] bytes, stopping early rather than buffering the rest of the body.
 *
 * A server that ignores `Range` would otherwise stream the whole image into memory. Reads are
 * looped because one `read` yields a single segment (~8 KB), which is not always a whole header.
 */
private fun BufferedSource.readAtMost(limit: Long): ByteArray {
    val buffer = Buffer()
    while (buffer.size < limit) {
        val read = read(buffer, limit - buffer.size)
        if (read == -1L) break
    }
    return buffer.readByteArray()
}
