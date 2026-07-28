package com.pphotonn.saveslot.ui

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
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
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
import java.text.DecimalFormat

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
        modifier = Modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = { AppHeader(state) },
        bottomBar = {
            NavigationBar(
                modifier = Modifier.navigationBarsPadding(),
                containerColor = SaveSurface,
            ) {
                AppScreen.entries.forEach { screen ->
                    NavigationBarItem(
                        selected = state.screen == screen,
                        onClick = { viewModel.setScreen(screen) },
                        icon = { Text(screen.symbol, fontFamily = FontFamily.Monospace) },
                        label = { Text(screen.label, fontSize = 11.sp) },
                    )
                }
            }
        },
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
private fun AppHeader(state: AppUiState) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(SaveSurface)
            .statusBarsPadding()
            .padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "SAVE SLOT",
            color = SaveGreen,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.5.sp,
        )
        Spacer(Modifier.weight(1f))
        val ready = state.sourceHealth.any { it.state == HealthState.READY }
        val error = state.sourceHealth.any { it.state == HealthState.ERROR }
        Box(
            Modifier
                .size(9.dp)
                .clip(RoundedCornerShape(50))
                .background(if (error && !ready) SaveDanger else if (ready) SaveGreen else SaveMuted)
        )
        Spacer(Modifier.width(7.dp))
        Text(
            when {
                state.loading -> "ОНОВЛЕННЯ"
                ready -> "ДЖЕРЕЛА ГОТОВІ"
                error -> "ПОМИЛКА ДЖЕРЕЛ"
                else -> "ОЧІКУВАННЯ"
            },
            color = SaveMuted,
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace,
        )
    }
}

@Composable
private fun HomeScreen(state: AppUiState, viewModel: MainViewModel, padding: PaddingValues) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
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
            val selected = state.selectedGame
            Card(
                colors = CardDefaults.cardColors(containerColor = SaveSurface),
                shape = RoundedCornerShape(22.dp),
            ) {
                Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Eyebrow(if (selected == null) "СЛОТ ПОРОЖНІЙ" else "ОБРАНА ГРА")
                    Text(
                        selected?.title ?: "Знайди гру для наступного проходження",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    if (selected != null) {
                        Text(gameMeta(selected), color = SaveMuted)
                        if (selected.description.isNotBlank()) {
                            Text(
                                selected.description,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    } else {
                        Text(
                            "Каталог формується з онлайн-джерел. Фільтри впливають лише на вибір, а не на оформлення.",
                            color = SaveMuted,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = viewModel::selectRandom,
                            enabled = !state.loading && state.visibleResults.isNotEmpty(),
                            modifier = Modifier.weight(1f),
                        ) { Text("ВСТАВИТИ ВИПАДКОВУ") }
                        OutlinedButton(
                            onClick = viewModel::randomFive,
                            enabled = state.visibleResults.isNotEmpty(),
                        ) { Text("×5") }
                    }
                    if (selected != null) {
                        FilledTonalButton(
                            onClick = viewModel::addSelectedToLibrary,
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("ДОДАТИ ДО СПИСКУ") }
                    }
                }
            }
        }

        if (state.featuredFive.isNotEmpty()) {
            item { SectionTitle("Випадкова п’ятірка", "Одна добірка без повторів") }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(state.featuredFive, key = Game::id) { game ->
                        CompactGameCard(game, onClick = { viewModel.selectGame(game) })
                    }
                }
            }
        }

        item { SearchBox(state, viewModel) }
        item { SourcePanel(state) }
    }
}

@Composable
private fun SearchScreen(state: AppUiState, viewModel: MainViewModel, padding: PaddingValues) {
    var showFilters by rememberSaveable { mutableStateOf(false) }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .padding(horizontal = 16.dp),
    ) {
        Spacer(Modifier.height(14.dp))
        SearchBox(state, viewModel)
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = { showFilters = !showFilters }) {
                Text(if (showFilters) "СХОВАТИ ФІЛЬТРИ" else "ФІЛЬТРИ")
            }
            Spacer(Modifier.width(10.dp))
            Text("${state.visibleResults.size} результатів", color = SaveMuted)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = viewModel::resetFilters) { Text("СКИНУТИ") }
        }
        if (showFilters) {
            FiltersPanel(state, viewModel)
            Spacer(Modifier.height(10.dp))
        }
        if (state.loading) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 3.dp)
                Spacer(Modifier.width(12.dp))
                Text("Оновлення джерел…")
            }
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(state.visibleResults, key = Game::id) { game ->
                GameResultCard(
                    game = game,
                    saved = state.library.any { it.game.id == game.id },
                    onSelect = { viewModel.selectGame(game) },
                    onSave = { viewModel.addToLibrary(game) },
                )
            }
            if (!state.loading && state.visibleResults.isEmpty()) {
                item { EmptyCard("Нічого не знайдено", "Змініть запит або скиньте фільтри.") }
            }
        }
    }
}

@Composable
private fun SearchBox(state: AppUiState, viewModel: MainViewModel) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::setQuery,
            label = { Text("Назва гри") },
            placeholder = { Text("Metroid Prime, Zelda, Koudelka…") },
            singleLine = true,
            modifier = Modifier.weight(1f),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { viewModel.search() }),
        )
        Button(onClick = viewModel::search, enabled = !state.loading) { Text("ПОШУК") }
    }
}

@Composable
private fun FiltersPanel(state: AppUiState, viewModel: MainViewModel) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SaveSurface),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SelectField(
                label = "Платформа",
                selected = state.filters.platform ?: "Усі платформи",
                options = listOf("Усі платформи") + state.platformOptions,
                onSelect = { selected ->
                    viewModel.updateFilters { it.copy(platform = selected.takeUnless { value -> value == "Усі платформи" }) }
                }
            )
            SelectField(
                label = "Жанр",
                selected = state.filters.genre ?: "Усі жанри",
                options = listOf("Усі жанри") + state.genreOptions,
                onSelect = { selected ->
                    viewModel.updateFilters { it.copy(genre = selected.takeUnless { value -> value == "Усі жанри" }) }
                }
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                NumberField(
                    label = "Рік від",
                    value = state.filters.yearFrom,
                    modifier = Modifier.weight(1f),
                    onValue = { value -> viewModel.updateFilters { it.copy(yearFrom = value.coerceAtMost(it.yearTo)) } },
                )
                NumberField(
                    label = "Рік до",
                    value = state.filters.yearTo,
                    modifier = Modifier.weight(1f),
                    onValue = { value -> viewModel.updateFilters { it.copy(yearTo = value.coerceAtLeast(it.yearFrom)) } },
                )
            }
            SelectField(
                label = "Сортування",
                selected = state.filters.sort.label,
                options = SortMode.entries.map(SortMode::label),
                onSelect = { label ->
                    SortMode.entries.firstOrNull { it.label == label }?.let { mode ->
                        viewModel.updateFilters { it.copy(sort = mode) }
                    }
                },
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = state.filters.hideSaved,
                    onCheckedChange = { checked -> viewModel.updateFilters { it.copy(hideSaved = checked) } },
                )
                Text("Приховати додані до списку")
            }
        }
    }
}

@Composable
private fun LibraryScreen(state: AppUiState, viewModel: MainViewModel, padding: PaddingValues) {
    val context = LocalContext.current
    var editEntry by remember { mutableStateOf<LibraryEntry?>(null) }
    var replaceOnImport by remember { mutableStateOf(false) }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.openOutputStream(uri)?.bufferedWriter()?.use {
                    it.write(viewModel.exportLibrary())
                }
            }
        }
    }
    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            val raw = runCatching {
                context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
            }.getOrNull()
            if (raw != null) viewModel.importLibrary(raw, replaceOnImport)
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { SectionTitle("Мої ігри", "${state.library.size} записів у локальному сховищі") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = { exportLauncher.launch("save-slot-library.json") },
                    modifier = Modifier.weight(1f),
                ) { Text("ЕКСПОРТ JSON") }
                OutlinedButton(
                    onClick = {
                        replaceOnImport = false
                        importLauncher.launch(arrayOf("application/json", "text/plain"))
                    },
                    modifier = Modifier.weight(1f),
                ) { Text("ІМПОРТ") }
            }
        }
        items(state.library, key = { it.game.id }) { entry ->
            LibraryCard(
                entry = entry,
                onEdit = { editEntry = entry },
                onDelete = { viewModel.removeFromLibrary(entry.game.id) },
            )
        }
        if (state.library.isEmpty()) {
            item { EmptyCard("Список порожній", "Додайте гру з результатів пошуку або зі слота.") }
        }
    }

    editEntry?.let { entry ->
        LibraryEditor(
            entry = entry,
            onDismiss = { editEntry = null },
            onSave = { status, collection, priority, rating, notes ->
                viewModel.updateLibraryEntry(entry.game.id, status, collection, priority, rating, notes)
                editEntry = null
            },
        )
    }
}

@Composable
private fun SettingsScreen(state: AppUiState, viewModel: MainViewModel, padding: PaddingValues) {
    var settings by remember(state.settings) { mutableStateOf(state.settings) }
    val formatter = remember { DecimalFormat("#,##0.0") }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item { SectionTitle("Параметри", "Джерела, рух і локальні дані") }
        item {
            SettingsCard("Онлайн-джерела") {
                SettingSwitch(
                    "Wikidata",
                    "Основний каталог без API-ключа",
                    settings.useWikidata,
                ) { settings = settings.copy(useWikidata = it) }
                HorizontalDivider()
                SettingSwitch(
                    "Steam-рейтинг",
                    "Довантажувати відгуки для знайдених Steam ID",
                    settings.useSteamRatings,
                ) { settings = settings.copy(useSteamRatings = it) }
                HorizontalDivider()
                OutlinedTextField(
                    value = settings.rawgApiKey,
                    onValueChange = { settings = settings.copy(rawgApiKey = it) },
                    label = { Text("RAWG API key") },
                    supportingText = { Text("Необов’язково. Зберігається лише на пристрої.") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
        item {
            SettingsCard("Інтерфейс") {
                SettingSwitch(
                    "Зменшити анімації",
                    "Картридж одразу з’являється у слоті",
                    settings.reducedMotion,
                ) { settings = settings.copy(reducedMotion = it) }
            }
        }
        item {
            Button(onClick = { viewModel.saveSettings(settings) }, modifier = Modifier.fillMaxWidth()) {
                Text("ЗБЕРЕГТИ ПАРАМЕТРИ")
            }
        }
        item {
            SettingsCard("Кеш") {
                Text(
                    "Пошукові відповіді: ${formatter.format(state.cacheBytes / 1024.0 / 1024.0)} МБ",
                    color = SaveMuted,
                )
                Spacer(Modifier.height(10.dp))
                OutlinedButton(
                    onClick = viewModel::clearCache,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = SaveDanger),
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("ОЧИСТИТИ КЕШ") }
            }
        }
        item { SourcePanel(state) }
    }
}

@Composable
private fun GameResultCard(game: Game, saved: Boolean, onSelect: () -> Unit, onSave: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onSelect),
        colors = CardDefaults.cardColors(containerColor = SaveSurface),
        shape = RoundedCornerShape(18.dp),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            RemoteImage(
                url = game.coverUrl,
                contentDescription = game.title,
                modifier = Modifier.size(width = 88.dp, height = 118.dp).clip(RoundedCornerShape(12.dp)),
            )
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(game.title, fontWeight = FontWeight.Bold, fontSize = 18.sp, maxLines = 2)
                Text(gameMeta(game), color = SaveMuted, fontSize = 13.sp)
                if (game.genres.isNotEmpty()) {
                    Text(game.genres.take(3).joinToString(" · "), color = MaterialTheme.colorScheme.secondary, fontSize = 12.sp)
                }
                Text(game.source.label, color = SaveMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            }
            TextButton(onClick = onSave, enabled = !saved) { Text(if (saved) "✓" else "+") }
        }
    }
}

@Composable
private fun CompactGameCard(game: Game, onClick: () -> Unit) {
    Card(
        modifier = Modifier.width(150.dp).clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = SaveSurface),
        shape = RoundedCornerShape(16.dp),
    ) {
        RemoteImage(
            url = game.coverUrl,
            contentDescription = game.title,
            modifier = Modifier.fillMaxWidth().height(170.dp),
        )
        Column(Modifier.padding(10.dp)) {
            Text(game.title, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(game.year?.toString() ?: "Рік невідомий", color = SaveMuted, fontSize = 12.sp)
        }
    }
}

@Composable
private fun LibraryCard(entry: LibraryEntry, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onEdit),
        colors = CardDefaults.cardColors(containerColor = SaveSurface),
        shape = RoundedCornerShape(18.dp),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            RemoteImage(
                url = entry.game.coverUrl,
                contentDescription = entry.game.title,
                modifier = Modifier.size(68.dp).clip(RoundedCornerShape(12.dp)),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(entry.game.title, fontWeight = FontWeight.Bold)
                Text("${entry.status.label} · ${entry.collection}", color = SaveMuted, fontSize = 12.sp)
                Text("Пріоритет ${entry.priority}/5" + (entry.personalRating?.let { " · $it/10" } ?: ""), color = SaveAmber, fontSize = 12.sp)
            }
            TextButton(onClick = onDelete, colors = ButtonDefaults.textButtonColors(contentColor = SaveDanger)) {
                Text("×")
            }
        }
    }
}

@Composable
private fun LibraryEditor(
    entry: LibraryEntry,
    onDismiss: () -> Unit,
    onSave: (PlayStatus, String, Int, Int?, String) -> Unit,
) {
    var status by remember { mutableStateOf(entry.status) }
    var collection by remember { mutableStateOf(entry.collection) }
    var priority by remember { mutableIntStateOf(entry.priority) }
    var rating by remember { mutableStateOf(entry.personalRating?.toString().orEmpty()) }
    var notes by remember { mutableStateOf(entry.notes) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(entry.game.title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SelectField(
                    label = "Статус",
                    selected = status.label,
                    options = PlayStatus.entries.map(PlayStatus::label),
                    onSelect = { value -> PlayStatus.entries.firstOrNull { it.label == value }?.let { status = it } },
                )
                OutlinedTextField(
                    value = collection,
                    onValueChange = { collection = it },
                    label = { Text("Список") },
                    singleLine = true,
                )
                Text("Пріоритет: $priority/5", color = SaveMuted)
                Slider(value = priority.toFloat(), onValueChange = { priority = it.toInt().coerceIn(1, 5) }, valueRange = 1f..5f, steps = 3)
                OutlinedTextField(
                    value = rating,
                    onValueChange = { rating = it.filter(Char::isDigit).take(2) },
                    label = { Text("Особиста оцінка 1–10") },
                    keyboardOptions = KeyboardOptions.Default,
                    singleLine = true,
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Нотатки") },
                    minLines = 3,
                )
            }
        },
        confirmButton = {
            Button(onClick = { onSave(status, collection, priority, rating.toIntOrNull(), notes) }) { Text("ЗБЕРЕГТИ") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("СКАСУВАТИ") } },
    )
}

@Composable
private fun SourcePanel(state: AppUiState) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SaveSurface),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Eyebrow("СТАН ДЖЕРЕЛ")
            if (state.sourceHealth.isEmpty()) {
                Text("Дані ще не запитувались", color = SaveMuted)
            } else {
                state.sourceHealth.distinctBy { it.name }.forEach { source ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier.size(8.dp).clip(RoundedCornerShape(50)).background(
                                when (source.state) {
                                    HealthState.READY -> SaveGreen
                                    HealthState.ERROR -> SaveDanger
                                    HealthState.LOADING -> SaveAmber
                                    HealthState.IDLE -> SaveMuted
                                }
                            )
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(source.name, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.weight(1f))
                        Text(source.message, color = SaveMuted, fontSize = 12.sp, maxLines = 1)
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = SaveSurface), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Eyebrow(title.uppercase())
            content()
        }
    }
}

@Composable
private fun SettingSwitch(title: String, description: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Text(description, color = SaveMuted, fontSize = 12.sp)
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
private fun SelectField(label: String, selected: String, options: List<String>, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        Text(label.uppercase(), color = SaveMuted, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
        Box {
            OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
                Text(selected, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.weight(1f))
                Text("▾")
            }
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.distinct().forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            expanded = false
                            onSelect(option)
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun NumberField(label: String, value: Int, modifier: Modifier = Modifier, onValue: (Int) -> Unit) {
    OutlinedTextField(
        value = value.toString(),
        onValueChange = { raw -> raw.filter(Char::isDigit).take(4).toIntOrNull()?.let(onValue) },
        label = { Text(label) },
        modifier = modifier,
        singleLine = true,
    )
}

@Composable
private fun SectionTitle(title: String, subtitle: String) {
    Column {
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(subtitle, color = SaveMuted)
    }
}

@Composable
private fun Eyebrow(text: String) {
    Text(text, color = SaveGreen, fontFamily = FontFamily.Monospace, fontSize = 11.sp, letterSpacing = 1.sp)
}

@Composable
private fun EmptyCard(title: String, message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = SaveSurfaceHigh), shape = RoundedCornerShape(18.dp)) {
        Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, fontWeight = FontWeight.Bold)
            Text(message, color = SaveMuted)
        }
    }
}

private fun gameMeta(game: Game): String = buildList {
    game.year?.let { add(it.toString()) }
    game.platforms.firstOrNull()?.let(::add)
    game.ratingPercent?.let { rating ->
        add("$rating%" + (game.ratingCount?.let { " (${formatCount(it)})" } ?: ""))
    }
}.joinToString(" · ").ifBlank { "Метадані уточнюються" }

private fun formatCount(value: Int): String = when {
    value >= 1_000_000 -> "${value / 1_000_000.0}".take(3) + "млн"
    value >= 1_000 -> "${value / 1_000.0}".take(3) + "тис."
    else -> value.toString()
}

private val AppScreen.label: String
    get() = when (this) {
        AppScreen.HOME -> "Слот"
        AppScreen.SEARCH -> "Пошук"
        AppScreen.LIBRARY -> "Список"
        AppScreen.SETTINGS -> "Параметри"
    }

private val AppScreen.symbol: String
    get() = when (this) {
        AppScreen.HOME -> "▣"
        AppScreen.SEARCH -> ">_"
        AppScreen.LIBRARY -> "≡"
        AppScreen.SETTINGS -> "⚙"
    }
