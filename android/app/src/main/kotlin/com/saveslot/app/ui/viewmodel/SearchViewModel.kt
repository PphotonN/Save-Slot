package com.saveslot.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saveslot.app.core.text.PlatformNames
import com.saveslot.app.core.text.normalizeLoose
import com.saveslot.app.data.repository.GameRepository
import com.saveslot.app.data.repository.TaxonomyRepository
import com.saveslot.app.domain.model.Game
import com.saveslot.app.domain.model.SearchFilters
import com.saveslot.app.domain.model.SortOrder
import com.saveslot.app.domain.model.Taxonomy
import java.text.Collator
import java.util.Locale
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
 * Global search over Wikidata, with client-side filtering and sorting on top.
 *
 * Typing debounces into a network search, but filter and sort changes re-render the *existing*
 * results immediately and only trigger a new search after a further pause. Refetching on every
 * dropdown change would be both slow and wasteful, since most refinements only narrow what is
 * already on screen.
 */
@OptIn(FlowPreview::class)
class SearchViewModel(
    private val gameRepository: GameRepository,
    private val taxonomyRepository: TaxonomyRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    /**
     * All results as fetched; [uiState].results is this list filtered and sorted.
     *
     * Written from several artwork coroutines at once, so access goes through [resultMutex].
     */
    private var rawResults: List<Game> = emptyList()
    private val resultMutex = Mutex()

    private val queryInput = MutableStateFlow("")
    private val filterInput = MutableStateFlow(SearchFilters())

    /**
     * Coalesces re-filter requests from artwork arriving.
     *
     * `DROP_OLDEST` with a single slot means a burst of covers collapses into one refresh rather
     * than queueing one pass over the results per cover.
     */
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
                    if (query.isNotBlank() || filters.isActive) runSearch(query, filters)
                }
        }
        viewModelScope.launch {
            // One refresh per burst of resolved covers, rather than one per cover.
            artworkRefreshes.debounce(ARTWORK_REFRESH_MILLIS).collect { applyFilterAndSort() }
        }
    }

    fun onQueryChange(query: String) {
        _uiState.update { it.copy(query = query) }
        queryInput.value = query.trim()
        if (query.isBlank() && !_uiState.value.filters.isActive) {
            viewModelScope.launch { resultMutex.withLock { rawResults = emptyList() } }
            _uiState.update {
                it.copy(results = emptyList(), status = "Введи назву гри або обери фільтри.")
            }
        }
    }

    /** Enter on the keyboard searches at once rather than waiting out the debounce. */
    fun onQuerySubmit() {
        val query = _uiState.value.query.trim()
        if (query.isBlank() && !_uiState.value.filters.isActive) return
        viewModelScope.launch { runSearch(query, _uiState.value.filters) }
    }

    fun onFiltersChange(filters: SearchFilters) {
        val normalized = filters.normalized()
        _uiState.update { it.copy(filters = normalized) }
        // Re-apply to what is already on screen so the UI responds instantly...
        viewModelScope.launch { applyFilterAndSort() }
        // ...and schedule a fresh search for results the current page cannot contain.
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
        _uiState.update { it.copy(filters = SearchFilters(), sortOrder = SortOrder.Relevance) }
        filterInput.value = SearchFilters()
        viewModelScope.launch { applyFilterAndSort() }
    }

    private suspend fun runSearch(query: String, filters: SearchFilters) {
        searchJob?.cancel()
        val token = ++searchToken
        _uiState.update {
            it.copy(isLoading = true, status = "Шукаю ігри за запитом і вибраними фільтрами…")
        }
        searchJob = viewModelScope.launch {
            val games = runCatching { fetch(query, filters) }.getOrElse { error ->
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
            rawResults = games
            taxonomyRepository.learnFrom(games)
            _uiState.update { it.copy(isLoading = false) }
            applyFilterAndSort()
            games.forEach { resolveArtwork(it) }
        }
    }

    /**
     * Runs the text search, plus supplementary searches that fold the active filters into the query
     * text. Wikidata's entity search does not accept structured filters, so appending
     * "Chrono Trigger SNES" is what actually surfaces platform-specific entries.
     */
    private suspend fun fetch(query: String, filters: SearchFilters): List<Game> {
        if (query.isBlank()) {
            return if (filters.isActive) {
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
                gameRepository.search(supplement, limit = 12, useCache = true, lightweight = true)
            }.getOrDefault(emptyList())
        }

        return gameRepository.rankAndDedupe(pools.flatten(), query).take(RESULT_LIMIT)
    }

    /**
     * Resolves one result's artwork and folds it back into the list.
     *
     * Covers land one at a time and each arrival changes the displayed list, so the refreshes are
     * coalesced through [artworkRefreshes] instead of re-filtering and re-sorting per cover — with
     * 28 results that was 28 passes over the list on the main thread.
     */
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
        val filters = state.filters
        val snapshot = resultMutex.withLock { rawResults }

        val games = withContext(Dispatchers.Default) {
            var filtered = snapshot

            if (filters.platform.isNotEmpty()) {
                filtered = filtered.filter { PlatformNames.listsMatch(it.platforms, filters.platform) }
            }
            if (filters.genre.isNotEmpty()) {
                val target = normalizeLoose(filters.genre)
                filtered = filtered.filter { game -> game.genres.any { normalizeLoose(it) == target } }
            }
            val from = filters.yearFrom.takeIf { it > 0 } ?: 0
            val to = filters.yearTo.takeIf { it > 0 } ?: Int.MAX_VALUE
            // Games with no known year are kept: excluding them would hide most retro entries.
            filtered = filtered.filter { it.year == null || it.year in from..to }

            when (state.sortOrder) {
                SortOrder.Relevance -> filtered
                SortOrder.NewestFirst -> filtered.sortedByDescending { it.year ?: 0 }
                SortOrder.OldestFirst -> filtered.sortedBy { it.year ?: Int.MAX_VALUE }
                // Collation keys are computed once per title; comparing with a Collator directly
                // re-collates on every comparison, which is O(n log n) collations instead of O(n).
                SortOrder.Title -> filtered
                    .map { COLLATOR.getCollationKey(it.title) to it }
                    .sortedBy { it.first }
                    .map { it.second }
            }
        }

        _uiState.update {
            it.copy(
                results = games,
                status = when {
                    it.isLoading -> it.status
                    games.isEmpty() && rawResults.isNotEmpty() ->
                        "Немає результатів для обраних фільтрів."
                    games.isEmpty() -> "Точних результатів не знайдено."
                    else -> "${games.size} результатів"
                },
            )
        }
    }

    private companion object {
        const val RESULT_LIMIT = 28
        const val MAX_SUPPLEMENTAL_QUERIES = 3
        const val QUERY_DEBOUNCE_MILLIS = 520L
        const val FILTER_DEBOUNCE_MILLIS = 420L
        const val STOP_TIMEOUT_MILLIS = 5_000L

        /** Short enough that covers still appear promptly, long enough to batch a burst. */
        const val ARTWORK_REFRESH_MILLIS = 120L

        val COLLATOR: Collator = Collator.getInstance(Locale.forLanguageTag("uk"))
    }
}
