package com.saveslot.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import coil3.SingletonImageLoader
import com.saveslot.app.di.AppContainer
import com.saveslot.app.ui.components.CartridgePreviewProvider
import com.saveslot.app.ui.components.LocalCartridgePreviews
import com.saveslot.app.ui.components.SlotStage
import com.saveslot.app.ui.navigation.Destination
import com.saveslot.app.ui.navigation.TopLevelDestination
import com.saveslot.app.ui.screens.CollectionScreen
import com.saveslot.app.ui.screens.DetailScreen
import com.saveslot.app.ui.screens.DiscoverScreen
import com.saveslot.app.ui.screens.NotesScreen
import com.saveslot.app.ui.screens.SearchScreen
import com.saveslot.app.ui.screens.SettingsScreen
import com.saveslot.app.ui.viewmodel.DetailViewModel
import com.saveslot.app.ui.viewmodel.DiscoverViewModel
import com.saveslot.app.ui.viewmodel.LibraryViewModel
import com.saveslot.app.ui.viewmodel.SaveSlotViewModelFactory
import com.saveslot.app.ui.viewmodel.SearchViewModel
import com.saveslot.app.ui.viewmodel.SettingsViewModel
import com.saveslot.app.ui.viewmodel.SlotViewModel

/**
 * The app shell: bottom navigation, the shared slot stage, and the screen graph.
 *
 * The slot lives above the navigation graph because a cartridge stays seated while the user moves
 * between screens — it is the console, not a screen element. It is deliberately fixed rather than
 * scrolling with the content: a `GLSurfaceView`'s surface is positioned by the compositor, not by
 * layout, so inside a scrolling list it trailed its slot and drew at the wrong height.
 */
@Composable
fun SaveSlotApp(container: AppContainer) {
    val context = LocalContext.current
    val imageLoader = SingletonImageLoader.get(context)
    val navController = rememberNavController()
    val snackbarHostState = remember { SnackbarHostState() }

    val previewProvider = remember(container) {
        CartridgePreviewProvider(
            context = context,
            imageLoader = imageLoader,
            // The factory itself is process-scoped; only this thin wrapper is per-composition.
            factory = container.cartridgePreviewFactory,
        )
    }

    val slotViewModel: SlotViewModel = viewModel(
        factory = SaveSlotViewModelFactory.slot(container, imageLoader, context),
    )
    val stageState by slotViewModel.stageState.collectAsStateWithLifecycle()

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination

    CompositionLocalProvider(LocalCartridgePreviews provides previewProvider) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            containerColor = MaterialTheme.colorScheme.background,
            snackbarHost = { SnackbarHost(snackbarHostState) },
            bottomBar = {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    TopLevelDestination.entries.forEach { item ->
                        val selected = currentDestination?.hierarchyMatches(item) == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = { navController.navigateTopLevel(item.destination) },
                            icon = { Icon(item.icon, contentDescription = null) },
                            label = { Text(item.label, style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                }
            },
        ) { scaffoldPadding ->
            val contentPadding = PaddingValues(
                bottom = scaffoldPadding.calculateBottomPadding() + 16.dp,
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = scaffoldPadding.calculateTopPadding()),
            ) {
                // The console face sits above the navigation graph, outside every scroll container.
                // It is one persistent GL surface for the whole app: a SurfaceView's position is
                // updated by the compositor rather than by layout, so inside a scrolling list it
                // rendered at the wrong height, and a per-screen instance rebuilt its EGL context
                // and replayed the insert animation on each navigation.
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        text = "SAVE SLOT",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    SlotStage(
                        state = stageState,
                        onEjectRequested = {
                            slotViewModel.eject()
                            // Ejecting is also "go back": the cartridge leaving the slot and the
                            // detail page closing are one gesture.
                            if (currentDestination?.hasRoute<Destination.Detail>() == true) {
                                navController.popBackStack()
                            }
                        },
                        onInsertComplete = slotViewModel::onInsertComplete,
                        onEjectComplete = slotViewModel::onEjectComplete,
                    )
                }

                NavHost(
                    navController = navController,
                    startDestination = Destination.Discover,
                    modifier = Modifier.fillMaxSize(),
                ) {
                composable<Destination.Discover> {
                    val vm: DiscoverViewModel = viewModel(
                        factory = SaveSlotViewModelFactory.discover(container, imageLoader),
                    )
                    DiscoverScreen(
                        viewModel = vm,
                        onGameClick = { navController.openDetail(it.id) },
                        contentPadding = contentPadding,
                    )
                }

                composable<Destination.Search> {
                    val vm: SearchViewModel = viewModel(
                        factory = SaveSlotViewModelFactory.search(container, imageLoader),
                    )
                    SearchScreen(
                        viewModel = vm,
                        onGameClick = { navController.openDetail(it.id) },
                        contentPadding = contentPadding,
                    )
                }

                composable<Destination.Collection> {
                    val vm: LibraryViewModel = viewModel(
                        factory = SaveSlotViewModelFactory.library(container, imageLoader),
                    )
                    CollectionScreen(
                        viewModel = vm,
                        onGameClick = { navController.openDetail(it.id) },
                        contentPadding = contentPadding,
                    )
                }

                composable<Destination.Notes> {
                    val vm: LibraryViewModel = viewModel(
                        factory = SaveSlotViewModelFactory.library(container, imageLoader),
                    )
                    NotesScreen(
                        viewModel = vm,
                        onGameClick = { navController.openDetail(it.id) },
                        contentPadding = contentPadding,
                    )
                }

                composable<Destination.Settings> {
                    val vm: SettingsViewModel = viewModel(
                        factory = SaveSlotViewModelFactory.settings(container, imageLoader),
                    )
                    val message by vm.message.collectAsStateWithLifecycle()
                    LaunchedEffect(message) {
                        message?.let {
                            snackbarHostState.showSnackbar(it)
                            vm.consumeMessage()
                        }
                    }
                    SettingsScreen(
                        viewModel = vm,
                        onTestHaptics = slotViewModel::testHaptics,
                        contentPadding = contentPadding,
                    )
                }

                composable<Destination.Detail> { entry ->
                    val route = entry.toRoute<Destination.Detail>()
                    val vm: DetailViewModel = viewModel(
                        factory = SaveSlotViewModelFactory.detail(container, imageLoader, route.gameId),
                    )
                    val detailState by vm.uiState.collectAsStateWithLifecycle()
                    val slotCover by vm.slotCover.collectAsStateWithLifecycle()

                    // One statement of what the slot should hold, re-sent as the cover resolves.
                    // Two separate effects raced here: both ran on first composition, and the
                    // cover one — firing with a null cover — cancelled the seating it was meant to
                    // follow, so the cartridge sometimes never changed at all.
                    LaunchedEffect(route.gameId, detailState.game?.title, slotCover) {
                        val game = detailState.game ?: return@LaunchedEffect
                        slotViewModel.show(game.id, game.title, slotCover)
                    }

                    val message = detailState.message
                    LaunchedEffect(message) {
                        message?.let {
                            snackbarHostState.showSnackbar(it)
                            vm.consumeMessage()
                        }
                    }

                    DetailScreen(
                        viewModel = vm,
                        contentPadding = contentPadding,
                    )
                    }
                }
            }
        }
    }
}

/**
 * Switches bottom-bar tab, discarding any detail page and ejecting the cartridge.
 *
 * `launchSingleTop` plus popping to the start destination keeps the back stack from growing one
 * entry per tab press, which is the standard bottom-navigation contract.
 */
private fun NavHostController.navigateTopLevel(destination: Destination) {
    navigate(destination) {
        popUpTo(graph.startDestinationId) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

private fun NavHostController.openDetail(gameId: String) {
    navigate(Destination.Detail(gameId)) { launchSingleTop = true }
}

private fun androidx.navigation.NavDestination.hierarchyMatches(
    item: TopLevelDestination,
): Boolean = when (item.destination) {
    Destination.Discover -> hasRoute<Destination.Discover>()
    Destination.Search -> hasRoute<Destination.Search>()
    Destination.Collection -> hasRoute<Destination.Collection>()
    Destination.Notes -> hasRoute<Destination.Notes>()
    Destination.Settings -> hasRoute<Destination.Settings>()
    else -> false
}
