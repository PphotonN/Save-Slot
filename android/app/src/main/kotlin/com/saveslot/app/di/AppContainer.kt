package com.saveslot.app.di

import android.content.Context
import com.saveslot.app.core.net.HttpClient
import com.saveslot.app.data.local.GameSerializer
import com.saveslot.app.data.local.SaveSlotDatabase
import com.saveslot.app.data.remote.SourceStatusTracker
import com.saveslot.app.data.remote.commons.CommonsDataSource
import com.saveslot.app.data.remote.media.CommonsCategoryBoxArtProvider
import com.saveslot.app.data.remote.media.CommonsCategoryScreenshotProvider
import com.saveslot.app.data.remote.media.CommonsSearchBoxArtProvider
import com.saveslot.app.data.remote.media.CommonsSearchScreenshotProvider
import com.saveslot.app.data.remote.media.GogBoxArtProvider
import com.saveslot.app.data.remote.media.GogProvider
import com.saveslot.app.data.remote.media.GogScreenshotProvider
import com.saveslot.app.data.remote.media.ImageProbe
import com.saveslot.app.data.remote.media.LibretroGuessBoxArtProvider
import com.saveslot.app.data.remote.media.LibretroGuessScreenshotProvider
import com.saveslot.app.data.remote.media.LibretroIndexBoxArtProvider
import com.saveslot.app.data.remote.media.LibretroIndexScreenshotProvider
import com.saveslot.app.data.remote.media.LibretroProvider
import com.saveslot.app.data.remote.media.MediaResolver
import com.saveslot.app.data.remote.media.PcGamingWikiBoxArtProvider
import com.saveslot.app.data.remote.media.ProviderChain
import com.saveslot.app.data.remote.media.SteamBoxArtProvider
import com.saveslot.app.data.remote.media.SteamProvider
import com.saveslot.app.data.remote.media.SteamScreenshotProvider
import com.saveslot.app.data.remote.media.VndbBoxArtProvider
import com.saveslot.app.data.remote.media.VndbProvider
import com.saveslot.app.data.remote.media.VndbScreenshotProvider
import com.saveslot.app.data.remote.media.WikidataEntityBoxArtProvider
import com.saveslot.app.data.remote.media.WikipediaArticleBoxArtProvider
import com.saveslot.app.data.remote.media.WikipediaArticleScreenshotProvider
import com.saveslot.app.data.remote.media.WikipediaPageImageProvider
import com.saveslot.app.data.remote.wikidata.WikidataDataSource
import com.saveslot.app.data.remote.wikipedia.WikipediaDataSource
import com.saveslot.app.data.repository.GameRepository
import com.saveslot.app.data.repository.LibraryRepository
import com.saveslot.app.data.repository.SettingsRepository
import com.saveslot.app.data.repository.TaxonomyRepository
import com.saveslot.app.render.CartridgeDiskCache
import com.saveslot.app.render.CartridgeModelLoader
import com.saveslot.app.render.CartridgePreviewFactory
import com.saveslot.app.system.HapticsController
import java.io.File

/**
 * Hand-written dependency graph.
 *
 * Everything here is constructor-injected and lazily created, so this class is the single place
 * that knows how the app is wired. A generated graph would buy little for a dependency tree this
 * shallow, and tests construct their own container with fakes instead.
 */
class AppContainer(private val context: Context) {

    val httpClient: HttpClient by lazy { HttpClient(userAgent = USER_AGENT) }

    val sourceStatusTracker: SourceStatusTracker by lazy { SourceStatusTracker() }

    val hapticsController: HapticsController by lazy { HapticsController(context) }

    val cartridgeModelLoader: CartridgeModelLoader by lazy { CartridgeModelLoader(context) }

    /**
     * Owns a dedicated GL thread, an EGL context and both cartridge caches, so there must be exactly
     * one for the process. It used to be `remember`ed inside the UI, which recreated the context — and
     * discarded every drawn cartridge — whenever the composable left composition.
     */
    val cartridgePreviewFactory: CartridgePreviewFactory by lazy {
        CartridgePreviewFactory(
            modelLoader = cartridgeModelLoader,
            diskCache = CartridgeDiskCache(directory = File(context.cacheDir, "cartridges")),
        )
    }

    private val database: SaveSlotDatabase by lazy { SaveSlotDatabase.build(context) }

    private val gameSerializer: GameSerializer by lazy { GameSerializer(httpClient.json) }

    private val imageProbe: ImageProbe by lazy { ImageProbe(httpClient) }

    private val wikidata: WikidataDataSource by lazy {
        WikidataDataSource(httpClient, sourceStatusTracker)
    }

    private val wikipedia: WikipediaDataSource by lazy {
        WikipediaDataSource(httpClient, sourceStatusTracker)
    }

    private val commons: CommonsDataSource by lazy { CommonsDataSource(httpClient) }

    private val libretro: LibretroProvider by lazy {
        LibretroProvider(httpClient, imageProbe, sourceStatusTracker)
    }

    private val steam: SteamProvider by lazy {
        SteamProvider(httpClient, imageProbe, sourceStatusTracker)
    }

    private val gog: GogProvider by lazy { GogProvider(httpClient, imageProbe, sourceStatusTracker) }

    private val vndb: VndbProvider by lazy { VndbProvider(httpClient, imageProbe, sourceStatusTracker) }

    private val mediaResolver: MediaResolver by lazy {
        MediaResolver(
            chain = ProviderChain(),
            boxArtProviders = MediaResolver.BoxArtProviders(
                libretroGuess = LibretroGuessBoxArtProvider(libretro),
                libretroIndex = LibretroIndexBoxArtProvider(libretro),
                steam = SteamBoxArtProvider(steam),
                gog = GogBoxArtProvider(gog),
                vndb = VndbBoxArtProvider(vndb),
                pcGamingWiki = PcGamingWikiBoxArtProvider(httpClient, imageProbe, sourceStatusTracker),
                wikidataEntity = WikidataEntityBoxArtProvider(imageProbe),
                wikipediaUk = WikipediaPageImageProvider(wikipedia, imageProbe, language = "uk"),
                wikipediaEn = WikipediaPageImageProvider(wikipedia, imageProbe, language = "en"),
                wikipediaArticle = WikipediaArticleBoxArtProvider(wikipedia, imageProbe),
                commonsCategory = CommonsCategoryBoxArtProvider(commons, sourceStatusTracker),
                commonsSearch = CommonsSearchBoxArtProvider(commons, imageProbe, sourceStatusTracker),
            ),
            screenshotProviders = MediaResolver.ScreenshotProviders(
                libretroGuess = LibretroGuessScreenshotProvider(libretro),
                libretroIndex = LibretroIndexScreenshotProvider(libretro),
                steam = SteamScreenshotProvider(steam),
                gog = GogScreenshotProvider(gog),
                vndb = VndbScreenshotProvider(vndb),
                commonsCategory = CommonsCategoryScreenshotProvider(commons, sourceStatusTracker),
                commonsSearch = CommonsSearchScreenshotProvider(commons, sourceStatusTracker),
                wikipediaUk = WikipediaArticleScreenshotProvider(wikipedia, language = "uk"),
                wikipediaEn = WikipediaArticleScreenshotProvider(wikipedia, language = "en"),
            ),
        )
    }

    val gameRepository: GameRepository by lazy {
        GameRepository(
            wikidata = wikidata,
            wikipedia = wikipedia,
            mediaResolver = mediaResolver,
            gameCacheDao = database.gameCacheDao(),
            queryCacheDao = database.queryCacheDao(),
            serializer = gameSerializer,
            statusTracker = sourceStatusTracker,
        )
    }

    val libraryRepository: LibraryRepository by lazy {
        LibraryRepository(
            collectionDao = database.collectionDao(),
            recentGamesDao = database.recentGamesDao(),
            serializer = gameSerializer,
        )
    }

    val taxonomyRepository: TaxonomyRepository by lazy {
        TaxonomyRepository(database.taxonomyDao())
    }

    val settingsRepository: SettingsRepository by lazy { SettingsRepository(context) }

    private companion object {
        /**
         * Wikimedia's API etiquette asks for a descriptive User-Agent with a contact point, and
         * some mirrors reject the default OkHttp string outright.
         */
        const val USER_AGENT =
            "SaveSlot/1.0 (Android native client; https://github.com/save-slot) OkHttp"
    }
}
