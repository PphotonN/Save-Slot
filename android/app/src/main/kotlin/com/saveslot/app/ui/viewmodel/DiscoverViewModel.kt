package com.saveslot.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saveslot.app.data.repository.GameRepository
import com.saveslot.app.data.repository.LibraryRepository
import com.saveslot.app.data.repository.TaxonomyRepository
import com.saveslot.app.domain.discover.DiscoverSession
import com.saveslot.app.domain.model.Game
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DiscoverUiState(
    val games: List<Game> = emptyList(),
    val isLoading: Boolean = false,
    val status: String = "",
)

/**
 * Drives the discovery rail.
 *
 * Metadata and artwork are deliberately loaded in two passes: games appear as soon as Wikidata
 * answers, then each cover is resolved in the background and merged in. Waiting for artwork before
 * showing anything would make the rail feel broken on a slow connection, since box art can take
 * several provider attempts.
 */
@OptIn(FlowPreview::class)
class DiscoverViewModel(
    private val gameRepository: GameRepository,
    private val libraryRepository: LibraryRepository,
    private val taxonomyRepository: TaxonomyRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DiscoverUiState())
    val uiState: StateFlow<DiscoverUiState> = _uiState.asStateFlow()

    val recent: StateFlow<List<Game>> = libraryRepository.recent.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
        initialValue = emptyList(),
    )

    private var session = newSession()
    private var loadJob: Job? = null

    /** Covers resolved but not yet published to the rail. */
    private val pendingArtwork = mutableMapOf<String, Game>()

    private val artworkRefreshes = MutableSharedFlow<Unit>(
        replay = 0,
        extraBufferCapacity = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    init {
        viewModelScope.launch {
            artworkRefreshes.debounce(ARTWORK_REFRESH_MILLIS).collect { applyPendingArtwork() }
        }
        refresh(initial = true)
    }

    /** Starts a fresh selection. [initial] only affects the status text and batch size. */
    fun refresh(initial: Boolean = false) {
        loadJob?.cancel()
        session = newSession()
        _uiState.value = DiscoverUiState(
            isLoading = true,
            status = if (initial) "Підготовка каталогу…" else "Завантаження випадкових ігор…",
        )
        loadJob = viewModelScope.launch {
            // Games the user already opened are poor suggestions; skip them this session.
            val alreadySeen = runCatching { libraryRepository.recent.first().map { it.id } }
                .getOrDefault(emptyList())
            session.excludeAll(alreadySeen)
            loadBatch(targetCount = INITIAL_BATCH)
        }
    }

    /** Called as the rail nears its end. */
    fun loadMore() {
        if (_uiState.value.isLoading) return
        loadJob = viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            loadBatch(targetCount = NEXT_BATCH)
        }
    }

    private suspend fun loadBatch(targetCount: Int) {
        val found = runCatching { session.loadMore(targetCount) }.getOrDefault(emptyList())
        _uiState.update { current ->
            val games = current.games + found
            current.copy(
                games = games,
                isLoading = false,
                status = when {
                    games.isEmpty() ->
                        "Не вдалося завантажити добірку. Перевір підключення або повтори спробу."
                    else -> "${games.size} ігор у добірці"
                },
            )
        }
        taxonomyRepository.learnFrom(found)
        found.forEach { resolveArtwork(it) }
    }

    /**
     * Resolves one game's cover and merges the result into the rail.
     *
     * Each game gets its own coroutine so a single slow provider chain does not stall the others;
     * concurrency is bounded inside the repository.
     *
     * Results are staged in [pendingArtwork] and applied in batches: a page of eight covers finishing
     * at once would otherwise publish eight new list instances, each rebuilding the rail's state.
     */
    private fun resolveArtwork(game: Game) {
        viewModelScope.launch {
            val resolved = runCatching { gameRepository.resolveMedia(game) }.getOrNull() ?: return@launch
            synchronized(pendingArtwork) { pendingArtwork[resolved.id] = resolved }
            artworkRefreshes.tryEmit(Unit)
        }
    }

    private fun applyPendingArtwork() {
        val resolved = synchronized(pendingArtwork) {
            if (pendingArtwork.isEmpty()) return
            pendingArtwork.toMap().also { pendingArtwork.clear() }
        }
        _uiState.update { current ->
            current.copy(games = current.games.map { resolved[it.id] ?: it })
        }
    }

    private fun newSession() = DiscoverSession(
        gameRepository = gameRepository,
        taxonomyRepository = taxonomyRepository,
    )

    private companion object {
        const val INITIAL_BATCH = 8
        const val NEXT_BATCH = 6
        const val STOP_TIMEOUT_MILLIS = 5_000L

        /** Short enough that covers still appear promptly, long enough to batch a burst. */
        const val ARTWORK_REFRESH_MILLIS = 120L
    }
}
