package com.saveslot.app.ui.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.allowHardware
import coil3.toBitmap
import com.saveslot.app.core.log.ImageLog
import com.saveslot.app.data.repository.SettingsRepository
import com.saveslot.app.render.CartridgeModel
import com.saveslot.app.render.CartridgeModelLoader
import com.saveslot.app.system.HapticsController
import com.saveslot.app.ui.components.FallbackCover
import com.saveslot.app.ui.components.SlotStageState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Owns the console face: which cartridge is loaded, and the haptics that go with it.
 *
 * The slot is shared by every screen, so its state lives above navigation rather than in any one
 * screen's view model. Cover bitmaps are loaded here because the GL renderer needs decoded pixels,
 * not a URL.
 */
class SlotViewModel(
    private val context: Context,
    private val imageLoader: ImageLoader,
    private val modelLoader: CartridgeModelLoader,
    private val hapticsController: HapticsController,
    settingsRepository: SettingsRepository,
) : ViewModel() {

    private val model = MutableStateFlow<CartridgeModel?>(null)
    private val loadedGame = MutableStateFlow<LoadedCartridge?>(null)

    private data class LoadedCartridge(
        val gameId: String,
        val title: String,
        val cover: android.graphics.Bitmap?,
    )

    private val settings = settingsRepository.settings.stateIn(
        scope = viewModelScope,
        started = SharingStarted.Eagerly,
        initialValue = com.saveslot.app.domain.model.UserSettings(),
    )

    val stageState: StateFlow<SlotStageState> = combine(
        model,
        loadedGame,
        settings,
    ) { parsedModel, loaded, userSettings ->
        SlotStageState(
            model = parsedModel,
            cover = loaded?.cover,
            loadedGameId = loaded?.gameId,
            loadedGameTitle = loaded?.title,
            reducedMotion = userSettings.reducedMotion,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
        initialValue = SlotStageState(),
    )

    /** Newest request; anything older must not publish. Only touched on the main thread. */
    private var labelRequest = 0
    private var labelJob: Job? = null

    init {
        viewModelScope.launch {
            runCatching { modelLoader.load() }.getOrNull()?.let { model.value = it }
        }
    }

    /**
     * States which cartridge the slot should be holding, and with what artwork.
     *
     * One entry point rather than separate insert and re-label calls. Two calls meant two racing
     * cover loads: whichever finished last won, so opening game A then B could leave A in the slot,
     * and — once cancellation was added — a cover update arriving first could cancel the insert it
     * was meant to follow, leaving the cartridge unchanged entirely.
     *
     * Now the newest call always wins and always publishes a complete state. Whether that reads as
     * an insert or just a new label is the renderer's decision, made from [LoadedCartridge.gameId],
     * so calling this repeatedly as artwork resolves never replays the animation.
     */
    fun show(gameId: String, title: String, coverUrl: String?) {
        val request = ++labelRequest
        labelJob?.cancel()
        labelJob = viewModelScope.launch {
            val loaded = coverUrl?.let { loadBitmap(it) }
            // viewModelScope runs on the main thread, and rasterising the placeholder is a real
            // canvas draw, so it is pushed off-thread like any other bitmap work.
            val cover = loaded ?: withContext(Dispatchers.Default) { FallbackCover.bitmap() }
            if (request != labelRequest) {
                ImageLog.d(ImageLog.TAG_SLOT) { "discard stale request for '$title'" }
                return@launch
            }
            ImageLog.d(ImageLog.TAG_SLOT) {
                val label = when {
                    coverUrl == null -> "no url"
                    loaded == null -> "fetch failed, using fallback"
                    else -> ImageLog.key(coverUrl)
                }
                val action = if (loadedGame.value?.gameId == gameId) "relabel" else "insert"
                "$action '$title' label=$label ${cover.width}x${cover.height}"
            }
            loadedGame.value = LoadedCartridge(gameId = gameId, title = title, cover = cover)
        }
    }

    fun eject() {
        loadedGame.value = null
    }

    fun onInsertComplete() = hapticsController.insert(settings.value.haptics)

    fun onEjectComplete() = hapticsController.eject(settings.value.haptics)

    fun testHaptics() = hapticsController.insert(settings.value.haptics)

    private suspend fun loadBitmap(url: String): android.graphics.Bitmap? = runCatching {
        val request = ImageRequest.Builder(context)
            .data(url)
            // GL texture upload reads the pixels back, which a hardware bitmap disallows.
            .allowHardware(false)
            .build()
        imageLoader.execute(request).image?.toBitmap()
    }.onFailure { error ->
        ImageLog.w(ImageLog.TAG_SLOT, error) { "label fetch threw ${ImageLog.key(url)}" }
    }.getOrNull()

    private companion object {
        const val STOP_TIMEOUT_MILLIS = 5_000L
    }
}
