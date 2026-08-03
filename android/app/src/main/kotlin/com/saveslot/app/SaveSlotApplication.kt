package com.saveslot.app

import android.app.Application
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import coil3.request.crossfade
import coil3.util.DebugLogger
import com.saveslot.app.core.log.ArtworkEventListener
import com.saveslot.app.core.log.ImageLog
import com.saveslot.app.di.AppContainer
import okio.Path.Companion.toOkioPath

class SaveSlotApplication : Application(), SingletonImageLoader.Factory {

    /**
     * Manual dependency container. The graph is small and entirely constructor-injected, so a
     * hand-written container keeps the build free of annotation processing while staying just as
     * testable — tests build their own container with fakes.
     */
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components {
                // Share the app's OkHttp client so artwork requests reuse the same
                // connection pool and User-Agent the metadata APIs are called with.
                add(OkHttpNetworkFetcherFactory(callFactory = { container.httpClient.okHttp }))
            }
            .memoryCache {
                MemoryCache.Builder()
                    .maxSizePercent(context, 0.20)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("artwork").toOkioPath())
                    .maxSizeBytes(96L * 1024 * 1024)
                    .build()
            }
            .crossfade(true)
            // Artwork tracing: our own one-line-per-event trace, plus Coil's internal log for the
            // fetch/decode detail behind a failure. See ImageLog to silence both.
            .eventListener(ArtworkEventListener())
            // Coil's own logger is verbose and synchronous; keep it to debug builds so it cannot
            // add main-thread work to a release scroll.
            .apply { if (ImageLog.enabled) logger(DebugLogger()) }
            .build()
}
