package com.saveslot.app.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import com.saveslot.app.domain.model.UserSettings
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "save-slot-settings")

/** Haptics and reduced-motion preferences, which the slot animation and rails both read. */
class SettingsRepository(context: Context) {

    private val dataStore = context.settingsDataStore

    val settings: Flow<UserSettings> = dataStore.data.map { preferences ->
        UserSettings(
            // Haptics are the app's signature feedback, so they default on.
            haptics = preferences[KEY_HAPTICS] ?: true,
            reducedMotion = preferences[KEY_REDUCED_MOTION] ?: false,
        )
    }

    suspend fun setHaptics(enabled: Boolean) {
        dataStore.edit { it[KEY_HAPTICS] = enabled }
    }

    suspend fun setReducedMotion(enabled: Boolean) {
        dataStore.edit { it[KEY_REDUCED_MOTION] = enabled }
    }

    private companion object {
        val KEY_HAPTICS = booleanPreferencesKey("haptics")
        val KEY_REDUCED_MOTION = booleanPreferencesKey("reduced_motion")
    }
}
