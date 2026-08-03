package com.saveslot.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import coil3.ImageLoader
import com.saveslot.app.di.AppContainer

/**
 * Bridges the hand-written container to `ViewModelProvider`.
 *
 * Each factory constructs exactly one view model type, which keeps the unchecked cast confined and
 * makes missing dependencies a compile error rather than a runtime one.
 */
@Suppress("UNCHECKED_CAST")
class SaveSlotViewModelFactory(
    private val container: AppContainer,
    private val imageLoader: ImageLoader,
    private val create: (AppContainer, ImageLoader) -> ViewModel,
) : ViewModelProvider.Factory {

    override fun <T : ViewModel> create(modelClass: Class<T>): T = create(container, imageLoader) as T

    companion object {
        fun discover(container: AppContainer, imageLoader: ImageLoader) =
            SaveSlotViewModelFactory(container, imageLoader) { app, _ ->
                DiscoverViewModel(
                    gameRepository = app.gameRepository,
                    libraryRepository = app.libraryRepository,
                    taxonomyRepository = app.taxonomyRepository,
                )
            }

        fun search(container: AppContainer, imageLoader: ImageLoader) =
            SaveSlotViewModelFactory(container, imageLoader) { app, _ ->
                SearchViewModel(
                    gameRepository = app.gameRepository,
                    taxonomyRepository = app.taxonomyRepository,
                )
            }

        fun detail(container: AppContainer, imageLoader: ImageLoader, gameId: String) =
            SaveSlotViewModelFactory(container, imageLoader) { app, _ ->
                DetailViewModel(
                    gameId = gameId,
                    gameRepository = app.gameRepository,
                    libraryRepository = app.libraryRepository,
                )
            }

        fun library(container: AppContainer, imageLoader: ImageLoader) =
            SaveSlotViewModelFactory(container, imageLoader) { app, _ ->
                LibraryViewModel(libraryRepository = app.libraryRepository)
            }

        fun settings(container: AppContainer, imageLoader: ImageLoader) =
            SaveSlotViewModelFactory(container, imageLoader) { app, _ ->
                SettingsViewModel(
                    settingsRepository = app.settingsRepository,
                    gameRepository = app.gameRepository,
                    libraryRepository = app.libraryRepository,
                    sourceStatusTracker = app.sourceStatusTracker,
                    hasVibrator = app.hapticsController.hasVibrator,
                )
            }

        fun slot(container: AppContainer, imageLoader: ImageLoader, context: android.content.Context) =
            SaveSlotViewModelFactory(container, imageLoader) { app, loader ->
                SlotViewModel(
                    context = context,
                    imageLoader = loader,
                    modelLoader = app.cartridgeModelLoader,
                    hapticsController = app.hapticsController,
                    settingsRepository = app.settingsRepository,
                )
            }
    }
}
