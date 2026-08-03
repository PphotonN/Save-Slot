package com.saveslot.app.core.net

import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.coroutines.CoroutineContext
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * The media providers race each other under per-call timeouts, so responses regularly arrive for
 * calls whose coroutine is already being cancelled. This pins down that such a response is still
 * closed: a dropped one holds its pooled connection open for the life of the process.
 */
class HttpClientTest {

    private val server = MockWebServer()
    private val client = HttpClient(userAgent = "SaveSlotTest")

    @Before
    fun startServer() {
        server.start()
    }

    @After
    fun stopServer() {
        server.shutdown()
    }

    @Test
    fun `a response delivered into a cancelled call does not hold its connection`() {
        server.enqueue(MockResponse().setBody("cover bytes"))
        val dispatcher = QueueingDispatcher()
        val job = CoroutineScope(dispatcher).launch {
            client.getBytes(server.url("/cover.png").toString(), timeoutMillis = 5_000)
        }

        // Run the coroutine up to its suspension inside awaitResponse, then let OkHttp's callback
        // queue the resumption without executing it — that gap is the window cancellation races.
        dispatcher.runQueued()
        assertTrue("the response never arrived", dispatcher.awaitQueuedTask())

        job.cancel()
        dispatcher.runQueued()

        val pool = client.okHttp.connectionPool
        assertEquals(
            "the discarded response leaked its connection",
            0,
            pool.connectionCount() - pool.idleConnectionCount(),
        )
    }

    /** Dispatcher that runs work only when the test says so, making the race deterministic. */
    private class QueueingDispatcher : CoroutineDispatcher() {

        private val queue = LinkedBlockingQueue<Runnable>()

        override fun dispatch(context: CoroutineContext, block: Runnable) {
            queue.add(block)
        }

        fun runQueued() {
            while (true) (queue.poll() ?: return).run()
        }

        /** Blocks until a task is waiting, leaving it queued. */
        fun awaitQueuedTask(): Boolean {
            val task = queue.poll(5, TimeUnit.SECONDS) ?: return false
            queue.add(task)
            return true
        }
    }
}
