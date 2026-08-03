package com.saveslot.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saveslot.app.data.repository.GameRepository
import com.saveslot.app.data.repository.TaxonomyRepository
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SearchFilters
import com.saveslot.app.domain.model.SortOrder
import com.saveslot.app.domain.model.Taxonomy
import com.saveslot.app.domain.search.SearchResultRefiner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

data class SearchUiState(
    val query: String = "",
    val filters: SearchFilters = SearchFilters(),
    val sortOrder: SortOrder = SortOrder.Relevance,
    val results: List<Game> = emptyList(),
    val isLoading: Boolean = false,
    val status: String = "Введи назву гри або обери фільтри.",
    val filtersExpanded: Boolean = false,
)

/**
 * Coordinates global search and exposes immutable UI state.
 *
 * Filtering, sorting and query matching live in [SearchResultRefiner], keeping this ViewModel focused
 * on orchestration, cancellation and asynchronous artwork updates.
 */
@OptIn(FlowPreview::class)
class SearchViewModel(
    private val gameRepository: GameRepository,
    private val taxonomyRepository: TaxonomyRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    /** All fetched results; [uiState].results is this list refined for presentation. */
    private var rawResults: List<Game> = emptyList()
    private val resultMutex = Mutex()

    private val queryInput = MutableStateFlow("")
    private val filterInput = MutableStateFlow(SearchFilters())

    /** Coalesces a burst of artwork arrivals into one result refinement pass. */
    private val artworkRefreshes = MutableSharedFlow<Unit>(
        replay = 0,
        extraBufferCapacity = 1,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    private var searchJob: Job? = null
    private var searchToken = 0

    val taxonomy: StateFlow<Taxonomy> = taxonomyRepository.taxonomy.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
        initialValue = Taxonomy(),
    )

    init {
        viewModelScope.launch {
            queryInput
                .debounce(QUERY_DEBOUNCE_MILLIS)
                .distinctUntilChanged()
                .filter { it.isNotBlank() }
                .collect { runSearch(it, _uiState.value.filters) }
        }
        viewModelScope.launch {
            filterInput
                .debounce(FILTER_DEBOUNCE_MILLIS)
                .distinctUntilChanged()
                .collect { filters ->
                    val query = _uiState.value.query
                    if (query.isNotBlank() || filters.hasRemoteCriteria) {
                        runSearch(query, filters)
                    } else {
                        applyFilterAndSort()
                    }
                }
        }
        viewModelScope.launch {
            artworkRefreshes.debounce(ARTWORK_REFRESH_MILLIS).collect { applyFilterAndSort() }
        }
    }

    fun onQueryChange(query: String) {
        _uiState.update { it.copy(query = query) }
        queryInput.value = query.trim()
        if (query.isBlank() && !_uiState.value.filters.hasRemoteCriteria) {
            viewModelScope.launch { resultMutex.withLock { rawResults = emptyList() } }
            _uiState.update {
                it.copy(results = emptyList(), status = "Введи назву гри або обери фільтри.")
            }
        }
    }

    /** Enter on the keyboard searches immediately rather than waiting for debounce. */
    fun onQuerySubmit() {
        val query = _uiState.value.query.trim()
        if (query.isBlank() && !_uiState.value.filters.hasRemoteCriteria) return
        viewModelScope.launch { runSearch(query, _uiState.value.filters) }
    }

    fun onFiltersChange(filters: SearchFilters) {
        val normalized = filters.normalized()
        _uiState.update { it.copy(filters = normalized) }
        viewModelScope.launch { applyFilterAndSort() }
        filterInput.value = normalized
    }

    fun onSortOrderChange(order: SortOrder) {
        _uiState.update { it.copy(sortOrder = order) }
        viewModelScope.launch { applyFilterAndSort() }
    }

    fun toggleFilters() {
        _uiState.update { it.copy(filtersExpanded = !it.filtersExpanded) }
    }

    fun resetFilters() {
        val empty = SearchFilters()
        _uiState.update { it.copy(filters = empty, sortOrder = SortOrder.Relevance) }
        filterInput.value = empty
        viewModelScope.launch { applyFilterAndSort() }
    }

    private suspend fun runSearch(query: String, filters: SearchFilters) {
        searchJob?.cancel()
        val token = ++searchToken
        _uiState.update {
            it.copy(isLoading = true, status = "Шукаю ігри за запитом і вибраними фільтрами…")
        }
        searchJob = viewModelScope.launch {
            val games = runCatching { fetch(query, filters) }.getOrElse {
                if (token != searchToken) return@launch
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        results = emptyList(),
                        status = "Не вдалося отримати дані. Перевір підключення та спробуй ще раз.",
                    )
                }
                return@launch
            }
            if (token != searchToken) return@launch
            resultMutex.withLock { rawResults = games }
            taxonomyRepository.learnFrom(games)
            _uiState.update { it.copy(isLoading = false) }
            applyFilterAndSort()
            games.forEach(::resolveArtwork)
        }
    }

    /**
     * Combines title search, query supplements and a structured-filter fallback.
     *
     * The structured pool is gated through [SearchResultRefiner.matchesQuery], preventing an exact
     * platform or genre filter from flooding a title search with unrelated games.
     */
    private suspend fun fetch(query: String, filters: SearchFilters): List<Game> {
        if (query.isBlank()) {
            return if (filters.hasRemoteCriteria) {
                gameRepository.searchByFilters(filters, limit = RESULT_LIMIT)
            } else {
                emptyList()
            }
        }

        val pools = mutableListOf<List<Game>>()
        pools += gameRepository.search(query, limit = RESULT_LIMIT, useCache = true)

        val supplements = buildList {
            if (filters.platform.isNotEmpty()) add("$query ${filters.platform}")
            if (filters.genre.isNotEmpty()) add("$query ${filters.genre}")
            if (filters.platform.isNotEmpty() && filters.genre.isNotEmpty()) {
                add("$query ${filters.platform} ${filters.genre}")
            }
        }.distinct().take(MAX_SUPPLEMENTAL_QUERIES)

        for (supplement in supplements) {
            pools += runCatching {
                gameRepository.search(supplement, limit = SUPPLEMENT_LIMIT, useCache = true, lightweight = true)
            }.getOrDefault(emptyList())
        }

        if (filters.hasRemoteCriteria) {
            val structured = runCatching {
                gameRepository.searchByFilters(filters, limit = STRUCTURED_LIMIT)
            }.getOrDefault(emptyList())
                .filter { SearchResultRefiner.matchesQuery(it, query) }
            pools += structured
        }

        return gameRepository.rankAndDedupe(pools.flatten(), query).take(RESULT_LIMIT)
    }

    private fun resolveArtwork(game: Game) {
        viewModelScope.launch {
            val resolved = runCatching { gameRepository.resolveMedia(game) }.getOrNull() ?: return@launch
            resultMutex.withLock {
                rawResults = rawResults.map { if (it.id == resolved.id) resolved else it }
            }
            artworkRefreshes.tryEmit(Unit)
        }
    }

    private suspend fun applyFilterAndSort() {
        val state = _uiState.value
        val snapshot = resultMutex.withLock { rawResults }
        val games = withContext(Dispatchers.Default) {
            SearchResultRefiner.refine(snapshot, state.filters, state.sortOrder)
        }

        _uiState.update {
            it.copy(
                results = games,
                status = when {
                    it.isLoading -> it.status
                    games.isEmpty() && snapshot.isNotEmpty() ->
                        "Немає результатів для обраних фільтрів."
                    games.isEmpty() -> "Точних результатів не знайдено."
                    else -> "${games.size} результатів"
                },
            )
        }
    }

    private companion object {
        const val RESULT_LIMIT = 40
        const val SUPPLEMENT_LIMIT = 14
        const val STRUCTURED_LIMIT = 40
        const val MAX_SUPPLEMENTAL_QUERIES = 3
        const val QUERY_DEBOUNCE_MILLIS = 520L
        const val FILTER_DEBOUNCE_MILLIS = 420L
        const val STOP_TIMEOUT_MILLIS = 5_000L
        const val ARTWORK_REFRESH_MILLIS = 120L
    }
}
