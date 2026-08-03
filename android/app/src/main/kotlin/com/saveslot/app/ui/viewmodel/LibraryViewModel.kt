package com.saveslot.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.saveslot.app.data.repository.LibraryRepository
import com.saveslot.app.domain.model.CollectionEntry
import com.saveslot.app.domain.model.CollectionFilter
import com.saveslot.app.domain.model.NoteWithGame
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** The personal archive: collection tabs and the notes journal. */
@OptIn(ExperimentalCoroutinesApi::class)
class LibraryViewModel(
    private val libraryRepository: LibraryRepository,
) : ViewModel() {

    private val _filter = MutableStateFlow(CollectionFilter.All)
    val filter: StateFlow<CollectionFilter> = _filter.asStateFlow()

    val entries: StateFlow<List<CollectionEntry>> = _filter
        .flatMapLatest { libraryRepository.filtered(it) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
            initialValue = emptyList(),
        )

    val notes: StateFlow<List<NoteWithGame>> = libraryRepository.notes.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MILLIS),
        initialValue = emptyList(),
    )

    fun setFilter(filter: CollectionFilter) {
        _filter.value = filter
    }

    fun deleteNote(noteId: String) {
        viewModelScope.launch { libraryRepository.deleteNote(noteId) }
    }

    private companion object {
        const val STOP_TIMEOUT_MILLIS = 5_000L
    }
}
