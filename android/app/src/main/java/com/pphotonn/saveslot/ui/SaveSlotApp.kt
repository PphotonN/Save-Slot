package com.pphotonn.saveslot.ui

import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pphotonn.saveslot.model.Game
import com.pphotonn.saveslot.model.HealthState
import com.pphotonn.saveslot.model.LibraryEntry
import com.pphotonn.saveslot.model.PlayStatus
import com.pphotonn.saveslot.model.SortMode
import com.pphotonn.saveslot.ui.components.RemoteImage
import com.pphotonn.saveslot.ui.components.SlotScene
import com.pphotonn.saveslot.ui.theme.SaveAmber
import com.pphotonn.saveslot.ui.theme.SaveDanger
import com.pphotonn.saveslot.ui.theme.SaveGreen
import com.pphotonn.saveslot.ui.theme.SaveMuted
import com.pphotonn.saveslot.ui.theme.SaveSurface
import com.pphotonn.saveslot.ui.theme.SaveSurfaceHigh

@Composable
fun SaveSlotApp(viewModel: MainViewModel) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }
    LaunchedEffect(state.notice) {
        state.notice?.let {
            snackbar.showSnackbar(it)
            viewModel.clearNotice()
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = { Header(state) },
        bottomBar = { BottomNavigation(state.screen, viewModel::setScreen) },
    ) { padding ->
        when (state.screen) {
            AppScreen.HOME -> HomeScreen(state, viewModel, padding)
            AppScreen.SEARCH -> SearchScreen(state, viewModel, padding)
            AppScreen.LIBRARY -> LibraryScreen(state, viewModel, padding)
            AppScreen.SETTINGS -> SettingsScreen(state, viewModel, padding)
        }
    }
}

@Composable
private fun Header(state: AppUiState) {
    Row(
        Modifier.fillMaxWidth().background(SaveSurface).statusBarsPadding().padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("SAVE SLOT", color = SaveGreen, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
        Spacer(Modifier.weight(1f))
        val health = when {
            state.loading -> SaveAmber
            state.sourceHealth.any { it.state == HealthState.READY } -> SaveGreen
            state.sourceHealth.any { it.state == HealthState.ERROR } -> SaveDanger
            else -> SaveMuted
        }
        Box(Modifier.size(9.dp).clip(RoundedCornerShape(50)).background(health))
        Spacer(Modifier.width(7.dp))
        Text(if (state.loading) "ОНОВЛЕННЯ" else "ОНЛАЙН", color = SaveMuted, fontSize = 10.sp)
    }
}

@Composable
private fun BottomNavigation(selected: AppScreen, onSelect: (AppScreen) -> Unit) {
    NavigationBar(Modifier.navigationBarsPadding(), containerColor = SaveSurface) {
        AppScreen.entries.forEach { screen ->
            NavigationBarItem(
                selected = selected == screen,
                onClick = { onSelect(screen) },
                icon = { Text(screen.icon, fontFamily = FontFamily.Monospace) },
                label = { Text(screen.title, fontSize = 11.sp) },
            )
        }
    }
}

@Composable
private fun HomeScreen(state: AppUiState, vm: MainViewModel, padding: PaddingValues) {
    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            SlotScene(
                game = state.selectedGame,
                animationNonce = state.animationNonce,
                reducedMotion = state.settings.reducedMotion,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Panel {
                Label(if (state.selectedGame == null) "СЛОТ ПОРОЖНІЙ" else "ОБРАНА ГРА")
                Text(
                    state.selectedGame?.title ?: "Обери наступну гру",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                state.selectedGame?.let { game ->
                    Text(meta(game), color = SaveMuted)
                    if (game.description.isNotBlank()) Text(game.description, maxLines = 3, overflow = TextOverflow.Ellipsis)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = vm::selectRandom,
                        enabled = !state.loading && state.visibleResults.isNotEmpty(),
                        modifier = Modifier.weight(1f),
                    ) { Text("ВИПАДКОВА ГРА") }
                    OutlinedButton(onClick = vm::randomFive, enabled = state.visibleResults.isNotEmpty()) { Text("×5") }
                }
                if (state.selectedGame != null) {
                    OutlinedButton(onClick = vm::addSelectedToLibrary, modifier = Modifier.fillMaxWidth()) {
                        Text("ДОДАТИ ДО СПИСКУ")
                    }
                }
            }
        }
        if (state.featuredFive.isNotEmpty()) {
            item { Title("Випадкова п’ятірка", "П’ять різних ігор") }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(state.featuredFive, key = Game::id) { game -> SmallGameCard(game) { vm.selectGame(game) } }
                }
            }
        }
        item { SearchInput(state, vm) }
        item { SourceStatus(state) }
    }
}

@Composable
private fun SearchScreen(state: AppUiState, vm: MainViewModel, padding: PaddingValues) {
    var filtersVisible by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp)) {
        Spacer(Modifier.height(12.dp))
        SearchInput(state, vm)
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = { filtersVisible = !filtersVisible }) { Text(if (filtersVisible) "СХОВАТИ ФІЛЬТРИ" else "ФІЛЬТРИ") }
            Text("${state.visibleResults.size} ігор", color = SaveMuted)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = vm::resetFilters) { Text("СКИНУТИ") }
        }
        if (filtersVisible) Filters(state, vm)
        if (state.loading) {
            Row(Modifier.fillMaxWidth().padding(18.dp), horizontalArrangement = Arrangement.Center) {
                CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 3.dp)
            }
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(bottom = 24.dp)) {
            items(state.visibleResults, key = Game::id) { game ->
                GameRow(
                    game = game,
                    saved = state.library.any { it.game.id == game.id },
                    onOpen = { vm.selectGame(game) },
                    onSave = { vm.addToLibrary(game) },
                )
            }
            if (!state.loading && state.visibleResults.isEmpty()) item { Empty("Нічого не знайдено") }
        }
    }
}

@Composable
private fun SearchInput(state: AppUiState, vm: MainViewModel) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(
            value = state.query,
            onValueChange = vm::setQuery,
            label = { Text("Назва гри") },
            placeholder = { Text("Zelda, Metroid, Koudelka…") },
            singleLine = true,
            modifier = Modifier.weight(1f),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { vm.search() }),
        )
        Button(onClick = vm::search, enabled = !state.loading) { Text("ПОШУК") }
    }
}

@Composable
private fun Filters(state: AppUiState, vm: MainViewModel) {
    Panel {
        Select("Платформа", state.filters.platform ?: "Усі", listOf("Усі") + state.platformOptions) {
            vm.updateFilters { f -> f.copy(platform = it.takeUnless { value -> value == "Усі" }) }
        }
        Select("Жанр", state.filters.genre ?: "Усі", listOf("Усі") + state.genreOptions) {
            vm.updateFilters { f -> f.copy(genre = it.takeUnless { value -> value == "Усі" }) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            YearField("Від", state.filters.yearFrom, Modifier.weight(1f)) { year -> vm.updateFilters { it.copy(yearFrom = year) } }
            YearField("До", state.filters.yearTo, Modifier.weight(1f)) { year -> vm.updateFilters { it.copy(yearTo = year) } }
        }
        Select("Сортування", state.filters.sort.label, SortMode.entries.map { it.label }) { value ->
            SortMode.entries.firstOrNull { it.label == value }?.let { mode -> vm.updateFilters { it.copy(sort = mode) } }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(state.filters.hideSaved, { checked -> vm.updateFilters { it.copy(hideSaved = checked) } })
            Text("Приховати додані")
        }
    }
}

@Composable
private fun LibraryScreen(state: AppUiState, vm: MainViewModel, padding: PaddingValues) {
    val context = LocalContext.current
    var editing by remember { mutableStateOf<LibraryEntry?>(null) }
    val export = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        uri?.let { context.writeText(it, vm.exportLibrary()) }
    }
    val import = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { context.readText(it)?.let { raw -> vm.importLibrary(raw, false) } }
    }

    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item { Title("Мої ігри", "${state.library.size} записів") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton({ export.launch("save-slot-library.json") }, Modifier.weight(1f)) { Text("ЕКСПОРТ") }
                OutlinedButton({ import.launch(arrayOf("application/json", "text/plain")) }, Modifier.weight(1f)) { Text("ІМПОРТ") }
            }
        }
        items(state.library, key = { it.game.id }) { entry ->
            LibraryRow(entry, { editing = entry }, { vm.removeFromLibrary(entry.game.id) })
        }
        if (state.library.isEmpty()) item { Empty("Список порожній") }
    }
    editing?.let { entry ->
        LibraryDialog(entry, { editing = null }) { status, list, priority, rating, notes ->
            vm.updateLibraryEntry(entry.game.id, status, list, priority, rating, notes)
            editing = null
        }
    }
}

@Composable
private fun SettingsScreen(state: AppUiState, vm: MainViewModel, padding: PaddingValues) {
    var settings by remember(state.settings) { mutableStateOf(state.settings) }
    LazyColumn(
        Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Title("Параметри", "Джерела та локальні дані") }
        item {
            Panel {
                Toggle("Wikidata", "Основний каталог без ключа", settings.useWikidata) { settings = settings.copy(useWikidata = it) }
                HorizontalDivider()
                Toggle("Steam-рейтинг", "Довантаження відгуків", settings.useSteamRatings) { settings = settings.copy(useSteamRatings = it) }
                HorizontalDivider()
                OutlinedTextField(
                    value = settings.rawgApiKey,
                    onValueChange = { settings = settings.copy(rawgApiKey = it) },
                    label = { Text("RAWG API key (необов’язково)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                Toggle("Зменшити анімації", "Без польоту картриджа", settings.reducedMotion) { settings = settings.copy(reducedMotion = it) }
            }
        }
        item { Button({ vm.saveSettings(settings) }, Modifier.fillMaxWidth()) { Text("ЗБЕРЕГТИ") } }
        item {
            Panel {
                Text("Кеш: ${state.cacheBytes / 1024} КБ", color = SaveMuted)
                OutlinedButton(vm::clearCache, Modifier.fillMaxWidth()) { Text("ОЧИСТИТИ КЕШ") }
            }
        }
        item { SourceStatus(state) }
    }
}

@Composable
private fun GameRow(game: Game, saved: Boolean, onOpen: () -> Unit, onSave: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onOpen), colors = CardDefaults.cardColors(containerColor = SaveSurface)) {
        Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            RemoteImage(game.coverUrl, game.title, Modifier.size(width = 78.dp, height = 104.dp).clip(RoundedCornerShape(10.dp)))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(game.title, fontWeight = FontWeight.Bold, fontSize = 17.sp, maxLines = 2)
                Text(meta(game), color = SaveMuted, fontSize = 12.sp)
                Text(game.source.label, color = SaveGreen, fontSize = 11.sp)
            }
            TextButton(onSave, enabled = !saved) { Text(if (saved) "✓" else "+") }
        }
    }
}

@Composable
private fun SmallGameCard(game: Game, onClick: () -> Unit) {
    Card(Modifier.width(145.dp).clickable(onClick = onClick), colors = CardDefaults.cardColors(containerColor = SaveSurface)) {
        RemoteImage(game.coverUrl, game.title, Modifier.fillMaxWidth().height(165.dp))
        Text(game.title, Modifier.padding(10.dp), fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun LibraryRow(entry: LibraryEntry, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onEdit), colors = CardDefaults.cardColors(containerColor = SaveSurface)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(entry.game.title, fontWeight = FontWeight.Bold)
                Text("${entry.status.label} · ${entry.collection}", color = SaveMuted, fontSize = 12.sp)
            }
            TextButton(onDelete) { Text("×", color = SaveDanger) }
        }
    }
}

@Composable
private fun LibraryDialog(entry: LibraryEntry, dismiss: () -> Unit, save: (PlayStatus, String, Int, Int?, String) -> Unit) {
    var status by remember { mutableStateOf(entry.status) }
    var list by remember { mutableStateOf(entry.collection) }
    var priority by remember { mutableIntStateOf(entry.priority) }
    var rating by remember { mutableStateOf(entry.personalRating?.toString().orEmpty()) }
    var notes by remember { mutableStateOf(entry.notes) }
    AlertDialog(
        onDismissRequest = dismiss,
        title = { Text(entry.game.title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Select("Статус", status.label, PlayStatus.entries.map { it.label }) { value ->
                    PlayStatus.entries.firstOrNull { it.label == value }?.let { status = it }
                }
                OutlinedTextField(list, { list = it }, label = { Text("Список") })
                Text("Пріоритет $priority/5")
                Slider(priority.toFloat(), { priority = it.toInt() }, valueRange = 1f..5f, steps = 3)
                OutlinedTextField(rating, { rating = it.filter(Char::isDigit).take(2) }, label = { Text("Оцінка 1–10") })
                OutlinedTextField(notes, { notes = it }, label = { Text("Нотатки") }, minLines = 3)
            }
        },
        confirmButton = { Button({ save(status, list, priority, rating.toIntOrNull(), notes) }) { Text("ЗБЕРЕГТИ") } },
        dismissButton = { TextButton(dismiss) { Text("СКАСУВАТИ") } },
    )
}

@Composable
private fun SourceStatus(state: AppUiState) {
    Panel {
        Label("СТАН ДЖЕРЕЛ")
        if (state.sourceHealth.isEmpty()) Text("Ще не перевірено", color = SaveMuted)
        state.sourceHealth.distinctBy { it.name }.forEach { source ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                val color = when (source.state) {
                    HealthState.READY -> SaveGreen
                    HealthState.ERROR -> SaveDanger
                    HealthState.LOADING -> SaveAmber
                    HealthState.IDLE -> SaveMuted
                }
                Box(Modifier.size(8.dp).clip(RoundedCornerShape(50)).background(color))
                Spacer(Modifier.width(8.dp))
                Text(source.name, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                Text(source.message, color = SaveMuted, fontSize = 11.sp, maxLines = 1)
            }
        }
    }
}

@Composable
private fun Panel(content: @Composable ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = SaveSurface), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}

@Composable
private fun Select(label: String, selected: String, options: List<String>, onSelect: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column {
        Label(label.uppercase())
        Box {
            OutlinedButton({ open = true }, Modifier.fillMaxWidth()) {
                Text(selected, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.weight(1f))
                Text("▾")
            }
            DropdownMenu(open, { open = false }) {
                options.distinct().forEach { option ->
                    DropdownMenuItem({ Text(option) }, {
                        open = false
                        onSelect(option)
                    })
                }
            }
        }
    }
}

@Composable
private fun YearField(label: String, value: Int, modifier: Modifier, onChange: (Int) -> Unit) {
    OutlinedTextField(value.toString(), { it.filter(Char::isDigit).take(4).toIntOrNull()?.let(onChange) }, label = { Text(label) }, modifier = modifier)
}

@Composable
private fun Toggle(title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = SaveMuted, fontSize = 12.sp)
        }
        Switch(checked, onChange)
    }
}

@Composable private fun Label(value: String) = Text(value, color = SaveGreen, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
@Composable private fun Title(title: String, subtitle: String) = Column { Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold); Text(subtitle, color = SaveMuted) }
@Composable private fun Empty(value: String) = Box(Modifier.fillMaxWidth().background(SaveSurfaceHigh, RoundedCornerShape(16.dp)).padding(24.dp), contentAlignment = Alignment.Center) { Text(value, color = SaveMuted) }

private fun meta(game: Game): String = listOfNotNull(
    game.year?.toString(),
    game.platforms.firstOrNull(),
    game.ratingPercent?.let { "$it%" },
).joinToString(" · ").ifBlank { "Метадані уточнюються" }

private val AppScreen.title: String get() = when (this) { AppScreen.HOME -> "Слот"; AppScreen.SEARCH -> "Пошук"; AppScreen.LIBRARY -> "Список"; AppScreen.SETTINGS -> "Параметри" }
private val AppScreen.icon: String get() = when (this) { AppScreen.HOME -> "▣"; AppScreen.SEARCH -> ">_"; AppScreen.LIBRARY -> "≡"; AppScreen.SETTINGS -> "⚙" }

private fun Context.writeText(uri: android.net.Uri, value: String) = runCatching { contentResolver.openOutputStream(uri)?.bufferedWriter()?.use { it.write(value) } }
private fun Context.readText(uri: android.net.Uri): String? = runCatching { contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } }.getOrNull()
