package com.saveslot.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saveslot.app.data.repository.GameRepository
import com.saveslot.app.data.repository.LibraryRepository
import com.saveslot.app.domain.model.CollectionEntry
import com.saveslot.app.domain.model.CopyFormat
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.NoteType
import com.saveslot.app.domain.model.PlayStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DetailUiState(
    val game: Game? = null,
    val entry: CollectionEntry? = null,
    val isLoading: Boolean = true,
    val coverStatus: CoverStatus = CoverStatus.Searching,
    val screenshotsLoading: Boolean = false,
    val screenshotStatus: String = "",
    val message: String? = null,
) {
    val isInCollection: Boolean get() = entry != null
}

enum class CoverStatus {
    Searching,
    Provisional,
    Ready,
    Missing,
}

/**
 * One game's page: facts, artwork, the user's own entry, and notes.
 *
 * Screenshots are only fetched here — never for cards — because they cost several extra requests
 * per platform and are the one place they are actually shown.
 */
class DetailViewModel(
    private val gameId: String,
    private val gameRepository: GameRepository,
    private val libraryRepository: LibraryRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DetailUiState())
    val uiState: StateFlow<DetailUiState> = _uiState.asStateFlow()

    /** Emits the cover to show in the slot whenever it changes, for the shared slot stage. */
    private val _slotCover = MutableStateFlow<String?>(null)
    val slotCover: StateFlow<String?> = _slotCover.asStateFlow()

    init {
        viewModelScope.launch {
            val cached = gameRepository.loadCached(gameId)
            if (cached == null) {
                _uiState.update {
                    it.copy(isLoading = false, message = "Гру не знайдено в локальному кеші.")
                }
                return@launch
            }
            // Stored records can predate a title fix; give them a chance to heal before display.
            val game = gameRepository.repairTitle(cached)
            _uiState.update {
                it.copy(game = game, isLoading = false, coverStatus = statusFor(game))
            }
            _slotCover.value = game.displayCover
            libraryRepository.rememberRecent(game)
            observeEntry()
            loadMedia(game, game.activePlatform)
        }
    }

    private fun observeEntry() {
        viewModelScope.launch {
            libraryRepository.entry(gameId).collect { entry ->
                _uiState.update { it.copy(entry = entry) }
            }
        }
    }

    /** Resolves box art and screenshots for [platform] and merges them into the page. */
    private fun loadMedia(game: Game, platform: String) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    screenshotsLoading = true,
                    screenshotStatus = "Завантажую скріншоти версії для ${platform.ifEmpty { "обраної платформи" }}…",
                )
            }
            val resolved = runCatching {
                gameRepository.resolveMedia(game, platform, includeScreenshots = true)
            }.getOrNull()

            if (resolved == null) {
                _uiState.update {
                    it.copy(
                        screenshotsLoading = false,
                        screenshotStatus = "Скріншоти не завантажились.",
                        coverStatus = CoverStatus.Missing,
                    )
                }
                return@launch
            }

            // The user may have switched platform while this was in flight.
            if (_uiState.value.game?.activePlatform != platform) return@launch

            _uiState.update {
                it.copy(
                    game = resolved,
                    coverStatus = statusFor(resolved),
                    screenshotsLoading = false,
                    screenshotStatus = if (resolved.screenshots.isEmpty()) {
                        "Для цієї платформи скріншотів не знайдено."
                    } else {
                        ""
                    },
                )
            }
            _slotCover.value = resolved.displayCover
        }
    }

    /** Switches to another platform release, which has its own artwork. */
    fun selectPlatform(platform: String) {
        val game = _uiState.value.game ?: return
        if (platform == game.activePlatform || platform !in game.platforms) return
        val switched = game.copy(selectedPlatform = platform)
        _uiState.update { it.copy(game = switched, coverStatus = statusFor(switched)) }
        _slotCover.value = switched.displayCover
        viewModelScope.launch { gameRepository.cacheGames(listOf(switched)) }
        loadMedia(switched, platform)
    }

    fun toggleCollection() {
        val game = _uiState.value.game ?: return
        viewModelScope.launch {
            if (libraryRepository.isInCollection(game.id)) {
                libraryRepository.removeFromCollection(game.id)
                showMessage("Видалено з колекції")
            } else {
                libraryRepository.addToCollection(game)
                showMessage("Додано до колекції")
            }
        }
    }

    fun toggleFavorite() {
        val game = _uiState.value.game ?: return
        viewModelScope.launch { libraryRepository.toggleFavorite(game) }
    }

    fun saveEntry(
        status: PlayStatus,
        format: CopyFormat,
        playedOn: String,
        rating: Double?,
        owned: Boolean,
    ) {
        val game = _uiState.value.game ?: return
        viewModelScope.launch {
            libraryRepository.saveEntryDetails(game, status, format, playedOn, rating, owned)
            showMessage("Дані колекції збережено")
        }
    }

    fun addNote(type: NoteType, title: String, body: String) {
        val game = _uiState.value.game ?: return
        if (body.isBlank()) {
            showMessage("Нотатка порожня")
            return
        }
        viewModelScope.launch {
            libraryRepository.addNote(game, type, title, body)
            showMessage("Нотатку збережено")
        }
    }

    fun deleteNote(noteId: String) {
        viewModelScope.launch { libraryRepository.deleteNote(noteId) }
    }

    fun consumeMessage() {
        _uiState.update { it.copy(message = null) }
    }

    private fun showMessage(message: String) {
        _uiState.update { it.copy(message = message) }
    }

    private fun statusFor(game: Game): CoverStatus = when {
        game.verifiedCover != null -> CoverStatus.Ready
        game.provisionalCover != null -> CoverStatus.Provisional
        game.mediaFor().boxArtResolved -> CoverStatus.Missing
        else -> CoverStatus.Searching
    }
}
