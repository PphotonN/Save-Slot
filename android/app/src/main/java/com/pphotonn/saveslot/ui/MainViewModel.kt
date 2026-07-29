package com.pphotonn.saveslot.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.pphotonn.saveslot.data.GameRepository
import com.pphotonn.saveslot.data.LocalStore
import com.pphotonn.saveslot.model.AppSettings
import com.pphotonn.saveslot.model.Game
import com.pphotonn.saveslot.model.GameFilterEngine
import com.pphotonn.saveslot.model.HealthState
import com.pphotonn.saveslot.model.LibraryEntry
import com.pphotonn.saveslot.model.PlayStatus
import com.pphotonn.saveslot.model.SearchFilters
import com.pphotonn.saveslot.model.SourceHealth
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val store = LocalStore(application)
    private val repository = GameRepository(store)
    private var searchJob: Job? = null
    private var suggestionJob: Job? = null
    private var randomSeed = 1

    private val _state = MutableStateFlow(
        AppUiState(
            settings = store.loadSettings(),
            library = store.loadLibrary(),
            cacheBytes = store.cacheSizeBytes(),
        )
    )
    val state: StateFlow<AppUiState> = _state.asStateFlow()

    init {
        discover()
    }

    fun setScreen(screen: AppScreen) = _state.update { it.copy(screen = screen, suggestions = emptyList()) }

    fun setQuery(value: String) {
        suggestionJob?.cancel()
        _state.update { it.copy(query = value, suggestions = emptyList()) }
        val cleanQuery = value.trim()
        if (cleanQuery.length < 2) return

        suggestionJob = viewModelScope.launch {
            delay(320)
            val settings = _state.value.settings
            val suggestions = runCatching { repository.suggest(cleanQuery, settings) }.getOrDefault(emptyList())
            if (_state.value.query.trim() == cleanQuery) {
                _state.update { it.copy(suggestions = suggestions.filterNot { title -> title.equals(cleanQuery, true) }) }
            }
        }
    }

    fun chooseSuggestion(value: String) {
        suggestionJob?.cancel()
        _state.update { it.copy(query = value, suggestions = emptyList()) }
        runSearch(value, isDiscover = false)
    }

    fun search() {
        suggestionJob?.cancel()
        val query = _state.value.query.trim()
        _state.update { it.copy(suggestions = emptyList()) }
        if (query.isBlank()) {
            discover()
            return
        }
        runSearch(query, isDiscover = false)
    }

    fun discover() {
        suggestionJob?.cancel()
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            _state.update {
                it.copy(
                    loading = true,
                    suggestions = emptyList(),
                    sourceHealth = listOf(SourceHealth("Онлайн-джерела", HealthState.LOADING, "Оновлення каталогу")),
                    notice = null,
                )
            }
            runCatching { repository.discover(_state.value.settings) }
                .onSuccess { response ->
                    _state.update {
                        it.copy(
                            loading = false,
                            results = response.games,
                            sourceHealth = response.health,
                            notice = if (response.fromCache) "Каталог завантажено з кешу" else null,
                            screen = AppScreen.HOME,
                        ).recalculate()
                    }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            loading = false,
                            sourceHealth = listOf(SourceHealth("Онлайн-джерела", HealthState.ERROR, error.message ?: "Помилка")),
                            notice = "Не вдалося оновити каталог",
                        )
                    }
                }
        }
    }

    private fun runSearch(query: String, isDiscover: Boolean) {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            _state.update {
                it.copy(
                    loading = true,
                    suggestions = emptyList(),
                    sourceHealth = listOf(SourceHealth("Пошук", HealthState.LOADING, query)),
                    notice = null,
                    screen = if (isDiscover) AppScreen.HOME else AppScreen.SEARCH,
                )
            }
            runCatching { repository.search(query, _state.value.settings) }
                .onSuccess { response ->
                    _state.update {
                        it.copy(
                            loading = false,
                            results = response.games,
                            sourceHealth = response.health,
                            notice = if (response.fromCache) "Результати взято з кешу" else null,
                        ).recalculate()
                    }
                }
                .onFailure { error ->
                    _state.update {
                        it.copy(
                            loading = false,
                            sourceHealth = listOf(SourceHealth("Пошук", HealthState.ERROR, error.message ?: "Помилка")),
                            notice = "Пошук не завершено",
                        )
                    }
                }
        }
    }

    fun updateFilters(transform: (SearchFilters) -> SearchFilters) {
        randomSeed++
        _state.update { it.copy(filters = transform(it.filters)).recalculate(randomSeed) }
    }

    fun resetFilters() {
        _state.update { it.copy(filters = SearchFilters()).recalculate(randomSeed) }
    }

    fun selectGame(game: Game) {
        val snapshot = game.copy(
            platforms = game.platforms.toList(),
            genres = game.genres.toList(),
        )
        _state.update {
            it.copy(
                selectedGame = snapshot,
                animationNonce = it.animationNonce + 1,
                featuredFive = emptyList(),
                suggestions = emptyList(),
                screen = AppScreen.HOME,
            )
        }
    }

    fun selectRandom() {
        val candidates = _state.value.visibleResults
        if (candidates.isEmpty()) {
            _state.update { it.copy(notice = "Немає ігор за поточними фільтрами") }
            return
        }
        selectGame(candidates.random())
    }

    fun randomFive() {
        val candidates = _state.value.visibleResults
        if (candidates.isEmpty()) {
            _state.update { it.copy(notice = "Немає ігор за поточними фільтрами") }
            return
        }
        val platform = _state.value.filters.platform
        val pool = if (platform.isNullOrBlank()) candidates else candidates.filter {
            it.platforms.any { value -> value.equals(platform, true) }
        }
        _state.update { it.copy(featuredFive = pool.shuffled().distinctBy(Game::id).take(5), screen = AppScreen.HOME) }
    }

    fun addSelectedToLibrary() {
        _state.value.selectedGame?.let(::addToLibrary)
    }

    fun addToLibrary(game: Game) {
        if (_state.value.library.any { it.game.id == game.id }) {
            _state.update { it.copy(notice = "Гра вже є у списку") }
            return
        }
        val updated = _state.value.library + LibraryEntry(game = game)
        store.saveLibrary(updated)
        _state.update { it.copy(library = updated, notice = "Додано до списку").recalculate(randomSeed) }
    }

    fun removeFromLibrary(gameId: String) {
        val updated = _state.value.library.filterNot { it.game.id == gameId }
        store.saveLibrary(updated)
        _state.update { it.copy(library = updated).recalculate(randomSeed) }
    }

    fun updateLibraryEntry(
        gameId: String,
        status: PlayStatus,
        collection: String,
        priority: Int,
        personalRating: Int?,
        notes: String,
    ) {
        val updated = _state.value.library.map { entry ->
            if (entry.game.id != gameId) entry else entry.copy(
                status = status,
                collection = collection.trim().ifBlank { "Основний список" },
                priority = priority.coerceIn(1, 5),
                personalRating = personalRating?.coerceIn(1, 10),
                notes = notes,
            )
        }
        store.saveLibrary(updated)
        _state.update { it.copy(library = updated, notice = "Запис оновлено") }
    }

    fun saveSettings(settings: AppSettings) {
        store.saveSettings(settings)
        _state.update { it.copy(settings = settings, notice = "Параметри збережено") }
    }

    fun clearCache() {
        val count = store.clearCache()
        _state.update { it.copy(cacheBytes = 0L, notice = "Очищено файлів кешу: $count") }
    }

    fun exportLibrary(): String = store.exportLibrary(_state.value.library)

    fun importLibrary(raw: String, replace: Boolean) {
        runCatching { store.importLibrary(raw) }
            .onSuccess { imported ->
                val merged = if (replace) imported else (_state.value.library + imported)
                    .distinctBy { it.game.id }
                store.saveLibrary(merged)
                _state.update { it.copy(library = merged, notice = "Імпортовано: ${imported.size}").recalculate(randomSeed) }
            }
            .onFailure {
                _state.update { state -> state.copy(notice = "Файл не є резервною копією Save Slot") }
            }
    }

    fun clearNotice() = _state.update { it.copy(notice = null) }
}

data class AppUiState(
    val screen: AppScreen = AppScreen.HOME,
    val query: String = "",
    val suggestions: List<String> = emptyList(),
    val loading: Boolean = false,
    val results: List<Game> = emptyList(),
    val visibleResults: List<Game> = emptyList(),
    val filters: SearchFilters = SearchFilters(),
    val selectedGame: Game? = null,
    val featuredFive: List<Game> = emptyList(),
    val library: List<LibraryEntry> = emptyList(),
    val settings: AppSettings = AppSettings(),
    val sourceHealth: List<SourceHealth> = emptyList(),
    val animationNonce: Int = 0,
    val cacheBytes: Long = 0L,
    val notice: String? = null,
) {
    fun recalculate(seed: Int = 0): AppUiState = copy(
        visibleResults = GameFilterEngine.apply(
            games = results,
            filters = filters,
            savedIds = library.mapTo(linkedSetOf()) { it.game.id },
            randomSeed = seed,
        )
    )

    val platformOptions: List<String>
        get() = results.flatMap(Game::platforms).distinct().sorted()

    val genreOptions: List<String>
        get() = results.flatMap(Game::genres).distinct().sorted()
}

enum class AppScreen { HOME, SEARCH, LIBRARY, SETTINGS }
