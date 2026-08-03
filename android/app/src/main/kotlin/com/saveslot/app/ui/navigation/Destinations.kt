package com.saveslot.app.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.EditNote
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ViewList
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.serialization.Serializable

/** Type-safe navigation routes. */
@Serializable
sealed interface Destination {

    @Serializable
    data object Discover : Destination

    @Serializable
    data object Search : Destination

    @Serializable
    data object Collection : Destination

    @Serializable
    data object Notes : Destination

    @Serializable
    data object Settings : Destination

    @Serializable
    data class Detail(val gameId: String) : Destination
}

/** The five bottom-bar destinations, in display order. */
enum class TopLevelDestination(
    val destination: Destination,
    val label: String,
    val icon: ImageVector,
) {
    Discover(Destination.Discover, "Головна", Icons.Filled.Dashboard),
    Search(Destination.Search, "Пошук", Icons.Filled.Search),
    Collection(Destination.Collection, "Колекція", Icons.Filled.ViewList),
    Notes(Destination.Notes, "Нотатки", Icons.Filled.EditNote),
    Settings(Destination.Settings, "Система", Icons.Filled.Settings),
}
