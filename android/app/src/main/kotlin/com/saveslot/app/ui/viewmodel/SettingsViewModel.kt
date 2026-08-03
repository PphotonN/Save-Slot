package com.saveslot.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saveslot.app.data.remote.SourceStatusTracker
import com.saveslot.app.data.repository.GameRepository
import com.saveslot.app.data.repository.LibraryRepository
import com.saveslot.app.data.repository.SettingsRepository
import com.saveslot.app.domain.model.DataSource
import com.saveslot.app.domain.model.SourceStatus
import com.saveslot.app.domain.model.UserSettings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class SettingsUiState(
    val settings: UserSettings = UserSettings(),
    val sources: Map<DataSource, SourceStatus> = emptyMap(),
    val cacheSizeBytes: Long = 0L,
    val lastUpdate: Long = 0L,
    val hasVibrator: Boolean = true,
)

/** System screen: data-source health, feel of the slot, and local storage controls. */
class SettingsViewModel(
    private val settingsRepository: SettingsRepository,
    private val gameRepository: GameRepository,
    private val libraryRepository: LibraryRepository,
    sourceStatusTracker: SourceStatusTracker,
    hasVibrator: Boolean,
) : ViewModel() {

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    val uiState: StateFlow<SettingsUiState> = combine(
        settingsRepository.settings,
        sourceStatusTracker.statuses,
        gameRepository.cacheSizeBytes,
        gameRepository.lastUpdate,
    ) { settings, sources, cacheSize, lastUpdate ->
        SettingsUiState(
            settings = settings,
            sources = sources,
            cacheSizeBytes = cacheSize,
            lastUpdate = lastUpdate,
            hasVibrator = hasVibrator,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
        initialValue = SettingsUiState(hasVibrator = hasVibrator),
    )

    fun setHaptics(enabled: Boolean) {
        viewModelScope.launch { settingsRepository.setHaptics(enabled) }
    }

    fun setReducedMotion(enabled: Boolean) {
        viewModelScope.launch { settingsRepository.setReducedMotion(enabled) }
    }

    /** Clears fetched metadata only; the user's collection and notes are untouched. */
    fun clearCache() {
        viewModelScope.launch {
            gameRepository.clearCache()
            _message.value = "Кеш метаданих очищено"
        }
    }

    fun clearPersonalData() {
        viewModelScope.launch {
            libraryRepository.clearPersonalData()
            _message.value = "Особисті дані видалено"
        }
    }

    fun consumeMessage() {
        _message.value = null
    }

    private companion object {
        const val STOP_TIMEOUT_MILLIS = 5_000L
    }
}
