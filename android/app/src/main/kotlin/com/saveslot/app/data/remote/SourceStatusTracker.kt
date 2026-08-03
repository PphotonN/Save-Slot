package com.saveslot.app.data.remote

import com.saveslot.app.domain.model.DataSource
import com.saveslot.app.domain.model.SourceStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * Live health of every upstream source, as shown on the settings screen.
 *
 * Sources report themselves as loading before a call and online/error after, so the user can see
 * which of the eight providers is actually answering.
 */
class SourceStatusTracker {

    private val _statuses = MutableStateFlow(
        DataSource.entries.associateWith { SourceStatus.Idle },
    )

    val statuses: StateFlow<Map<DataSource, SourceStatus>> = _statuses.asStateFlow()

    fun set(source: DataSource, status: SourceStatus) {
        _statuses.update { it + (source to status) }
    }

    /** Resets a source from [SourceStatus.Loading] to idle when a lookup simply found nothing. */
    fun clearLoading(source: DataSource) {
        _statuses.update { current ->
            if (current[source] == SourceStatus.Loading) current + (source to SourceStatus.Idle) else current
        }
    }

    fun status(source: DataSource): SourceStatus = _statuses.value[source] ?: SourceStatus.Idle
}
