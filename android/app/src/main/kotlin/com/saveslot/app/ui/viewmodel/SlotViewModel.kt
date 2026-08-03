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
            loadedGameTitle = loaded?.title,
            reducedMotion = userSettings.reducedMotion,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
        initialValue = SlotStageState(),
    )

    /** The game currently seated in the slot, if any — used to avoid re-inserting the same one. */
    val loadedGameId: String? get() = loadedGame.value?.gameId

    init {
        viewModelScope.launch {
            runCatching { modelLoader.load() }.getOrNull()?.let { model.value = it }
        }
    }

    /** Slides a cartridge for [gameId] into the slot, fetching its cover first. */
    fun insert(gameId: String, title: String, coverUrl: String?) {
        viewModelScope.launch {
            val loaded = coverUrl?.let { loadBitmap(it) }
            // viewModelScope runs on the main thread, and rasterising the placeholder is a real
            // canvas draw, so it is pushed off-thread like any other bitmap work.
            val cover = loaded ?: withContext(Dispatchers.Default) { FallbackCover.bitmap() }
            ImageLog.d(ImageLog.TAG_SLOT) {
                val label = when {
                    coverUrl == null -> "no url"
                    loaded == null -> "fetch failed, using fallback"
                    else -> ImageLog.key(coverUrl)
                }
                "insert '$title' label=$label ${cover.width}x${cover.height}"
            }
            loadedGame.value = LoadedCartridge(gameId = gameId, title = title, cover = cover)
        }
    }

    /**
     * Swaps the label on the cartridge already in the slot.
     *
     * Used when better artwork resolves after the game opened, or when the user switches platform,
     * so the cover updates without replaying the insert animation.
     */
    fun updateCover(gameId: String, coverUrl: String?) {
        viewModelScope.launch {
            val current = loadedGame.value ?: return@launch
            if (current.gameId != gameId) {
                ImageLog.d(ImageLog.TAG_SLOT) { "ignore new label for $gameId; slot holds ${current.gameId}" }
                return@launch
            }
            val cover = coverUrl?.let { loadBitmap(it) } ?: run {
                ImageLog.w(ImageLog.TAG_SLOT) { "keeping old label; new one unusable ${ImageLog.key(coverUrl)}" }
                return@launch
            }
            ImageLog.d(ImageLog.TAG_SLOT) {
                "relabel '${current.title}' ${ImageLog.key(coverUrl)} ${cover.width}x${cover.height}"
            }
            loadedGame.value = current.copy(cover = cover)
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
