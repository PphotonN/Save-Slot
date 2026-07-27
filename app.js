import {
  APP_FORMAT,
  STATUS_OPTIONS,
  STATUS_LABELS,
  clamp,
  computeAggregateRating,
  bayesianScore,
  createLibraryState,
  createList,
  createListItem,
  exportBackup,
  exportListCsv,
  filterAndSortGames,
  gameDuration,
  isHiddenGem,
  listStats,
  makeId,
  mergeGame,
  mergeStates,
  migrateState,
  normalizeGame,
  slugify
} from "./core.js";
import { demoGames } from "./data/demo-games.js";

const DB_NAME = "save-slot-db";
const DB_VERSION = 1;
const STATE_KEY = "app-state";
const FALLBACK_KEY = "save-slot-state-v2";
const RAWG_BASE = "https://api.rawg.io/api";

const demoCatalog = demoGames.map(game => normalizeGame(game, "demo"));
let state = createLibraryState();
let currentResults = [...demoCatalog];
let rawgPage = 1;
let rawgHasNext = false;
let rawgMetadata = { platformIds: {}, genreSlugs: {} };
let pendingImport = null;
let currentGameKey = null;
let saveTimer = null;
let dbPromise = null;

const elements = Object.fromEntries([
  "dataStatus", "dataStatusText", "importButton", "exportButton", "settingsButton", "openLibraryButton", "savedCount", "importInput",
  "searchForm", "searchInput", "randomPickButton", "platformFilter", "genreFilter", "ratingFilter", "ratingOutput", "votesFilter",
  "durationModeFilter", "lengthFilter", "yearFromFilter", "yearToFilter", "unknownDurationFilter", "hiddenGemFilter", "hideSavedFilter",
  "resetFilters", "resultsTitle", "resultsNote", "sortSelect", "loadingPanel", "gameGrid", "emptyState", "loadMoreButton",
  "libraryDialog", "listSelect", "newListButton", "duplicateListButton", "deleteListButton", "listNameInput", "listStats", "libraryStatusFilter",
  "librarySort", "savedList", "emptyListState", "exportCsvButton", "exportActiveButton", "exportAllButton",
  "gameDialog", "gameDialogTitle", "gameDialogContent", "settingsDialog", "settingsForm", "providerSetting", "rawgKeySetting", "testRawgButton",
  "importHltbButton", "hltbImportInput", "pageSizeSetting", "cacheDaysSetting", "reduceMotionSetting", "tiltSetting", "clearCacheButton",
  "resetAppButton", "saveSettingsButton", "importDialog", "importSummary", "importReplaceButton", "importMergeButton", "importCancelButton",
  "gameCardTemplate", "toastRegion"
].map(id => [id, document.getElementById(id)]));

function openDb() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch(() => null);
  return dbPromise;
}

async function idbGet(storeName, key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
  });
}

async function idbSet(storeName, key, value) {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

async function idbClear(storeName) {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

async function loadState() {
  let stored = await idbGet("state", STATE_KEY);
  if (!stored) {
    try { stored = JSON.parse(localStorage.getItem(FALLBACK_KEY)); } catch { stored = null; }
  }
  state = migrateState(stored);
  for (const game of demoCatalog) {
    state.catalog[game.key] = state.catalog[game.key] ? mergeGame(state.catalog[game.key], game) : game;
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistState, 120);
}

async function persistState() {
  const snapshot = structuredClone(state);
  await idbSet("state", STATE_KEY, snapshot);
  try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(snapshot)); } catch { }
}

function activeList() {
  return state.lists.find(list => list.id === state.activeListId) || state.lists[0];
}

function activeSavedKeys() {
  return new Set(activeList()?.items.map(item => item.gameKey) || []);
}

function findListItem(gameKey) {
  return activeList()?.items.find(item => item.gameKey === gameKey) || null;
}

function upsertCatalogGame(game) {
  const normalized = normalizeGame(game, game.source || "local");
  state.catalog[normalized.key] = state.catalog[normalized.key]
    ? mergeGame(state.catalog[normalized.key], normalized)
    : normalized;
  return state.catalog[normalized.key];
}

function setLoading(isLoading, text = "ЗАВАНТАЖЕННЯ КАТАЛОГУ...") {
  elements.loadingPanel.hidden = !isLoading;
  const label = elements.loadingPanel.querySelector("span:last-child");
  if (label) label.textContent = text;
  elements.searchForm.querySelector("button").disabled = isLoading;
  elements.loadMoreButton.disabled = isLoading;
}

function setDataStatus(mode, message = "") {
  elements.dataStatus.dataset.mode = mode;
  elements.dataStatusText.textContent = message || (mode === "rawg" ? "RAWG" : mode === "offline" ? "ОФЛАЙН" : "ДЕМО");
}

function showToast(message, type = "info", timeout = 3200) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastRegion.append(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 220);
  }, timeout);
}

function formatVotes(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("uk-UA", { notation: number >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(number);
}

function formatHours(value) {
  if (!Number.isFinite(Number(value))) return "—";
  const number = Number(value);
  return `${Number.isInteger(number) ? number : number.toFixed(1)} год`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function populateFilters(games = Object.values(state.catalog)) {
  const currentPlatform = elements.platformFilter.value || "all";
  const currentGenre = elements.genreFilter.value || "all";
  const platforms = [...new Set(games.flatMap(game => game.platforms || [game.platform]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk"));
  const genres = [...new Set(games.flatMap(game => game.genres || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk"));

  elements.platformFilter.replaceChildren(new Option("Усі платформи", "all"), ...platforms.map(value => new Option(value, value)));
  elements.genreFilter.replaceChildren(new Option("Усі жанри", "all"), ...genres.map(value => new Option(value, value)));
  if (platforms.includes(currentPlatform)) elements.platformFilter.value = currentPlatform;
  if (genres.includes(currentGenre)) elements.genreFilter.value = currentGenre;
}

function currentFilters() {
  return {
    query: elements.searchInput.value,
    platform: elements.platformFilter.value,
    genre: elements.genreFilter.value,
    minRating: Number(elements.ratingFilter.value),
    minVotes: Number(elements.votesFilter.value),
    durationMode: elements.durationModeFilter.value,
    maxHours: elements.lengthFilter.value,
    includeUnknownDuration: elements.unknownDurationFilter.checked,
    hiddenOnly: elements.hiddenGemFilter.checked,
    hideSaved: elements.hideSavedFilter.checked,
    yearFrom: elements.yearFromFilter.value,
    yearTo: elements.yearToFilter.value,
    sort: elements.sortSelect.value
  };
}

function applyUiFiltersFromState() {
  const filters = state.ui?.filters || {};
  const assignments = {
    searchInput: filters.query ?? "",
    ratingFilter: filters.minRating ?? 70,
    votesFilter: filters.minVotes ?? 0,
    durationModeFilter: filters.durationMode ?? "main",
    lengthFilter: filters.maxHours ?? "all",
    yearFromFilter: filters.yearFrom ?? "",
    yearToFilter: filters.yearTo ?? "",
    sortSelect: filters.sort ?? "bayesian"
  };
  for (const [id, value] of Object.entries(assignments)) if (elements[id]) elements[id].value = String(value);
  elements.unknownDurationFilter.checked = filters.includeUnknownDuration ?? true;
  elements.hiddenGemFilter.checked = filters.hiddenOnly ?? false;
  elements.hideSavedFilter.checked = filters.hideSaved ?? false;
  elements.ratingOutput.value = elements.ratingFilter.value;
}

function rememberFilters() {
  state.ui.filters = currentFilters();
  scheduleSave();
}

function renderGames() {
  rememberFilters();
  const games = filterAndSortGames(currentResults, currentFilters(), activeSavedKeys());
  elements.gameGrid.replaceChildren();
  elements.emptyState.hidden = games.length > 0;
  elements.resultsTitle.textContent = `Знайдено: ${games.length}`;
  const sourceText = state.settings.provider === "rawg" ? "Онлайн-каталог RAWG" : "Демонстраційний офлайн-каталог";
  elements.resultsNote.textContent = `${sourceText}. Рейтинг критиків не використовується.`;
  const durationMode = elements.durationModeFilter.value;

  for (const game of games) {
    const node = elements.gameCardTemplate.content.cloneNode(true);
    const card = node.querySelector(".game-card");
    const cover = node.querySelector(".game-cover");
    const fallback = node.querySelector(".cover-fallback");
    const saveButton = node.querySelector(".save-button");
    const duration = gameDuration(game, durationMode);

    card.dataset.gameKey = game.key;
    cover.src = game.cover || "";
    cover.alt = game.cover ? `Обкладинка ${game.title}` : "";
    fallback.textContent = initials(game.title);
    if (!game.cover) cover.hidden = true;
    cover.addEventListener("error", () => { cover.hidden = true; }, { once: true });

    node.querySelector(".platform-chip").textContent = game.platform || game.platforms[0] || "Невідомо";
    node.querySelector(".game-title").textContent = game.title;
    node.querySelector(".rating").textContent = game.aggregate?.score == null ? "★ —" : `★ ${game.aggregate.score}`;
    node.querySelector(".rating").title = `${confidenceText(game.aggregate?.confidence)} · джерел: ${game.aggregate?.sourceCount || 0}`;
    node.querySelector(".votes").textContent = game.aggregate?.votes ? `${formatVotes(game.aggregate.votes)} голосів` : "без голосів";
    node.querySelector(".length").textContent = `◷ ${formatHours(duration)}`;
    node.querySelector(".year").textContent = game.year || "—";

    const tags = node.querySelector(".game-tags");
    if (isHiddenGem(game)) tags.append(makeTag("ПЕРЛИНА", "accent"));
    for (const genre of game.genres.slice(0, 2)) tags.append(makeTag(genre));

    syncSaveButton(saveButton, game.key);
    saveButton.addEventListener("click", event => { event.stopPropagation(); toggleSaved(game.key); });
    card.addEventListener("click", () => openGame(game.key));
    card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openGame(game.key); } });
    installTilt(card);
    elements.gameGrid.append(node);
  }

  elements.loadMoreButton.hidden = !(state.settings.provider === "rawg" && rawgHasNext);
}

function initials(title) {
  return String(title).split(/\s+/).slice(0, 3).map(word => word[0]).join("").toUpperCase();
}

function makeTag(text, className = "") {
  const tag = document.createElement("span");
  tag.className = `tag ${className}`.trim();
  tag.textContent = text;
  return tag;
}

function confidenceText(confidence) {
  return ({ high: "Висока достовірність", medium: "Середня достовірність", low: "Низька достовірність", none: "Немає рейтингу" })[confidence] || "Невідомо";
}

function installTilt(card) {
  card.addEventListener("pointermove", event => {
    if (state.settings.reduceMotion || window.matchMedia("(pointer: coarse)").matches) return;
    const strength = Number(state.settings.tiltStrength) || 0;
    if (!strength) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--rx", `${-y * 7 * strength}deg`);
    card.style.setProperty("--ry", `${x * 9 * strength}deg`);
    card.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
    card.style.setProperty("--my", `${(y + 0.5) * 100}%`);
  });
  card.addEventListener("pointerleave", () => {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
}

function syncSaveButton(button, gameKey) {
  const saved = Boolean(findListItem(gameKey));
  button.classList.toggle("saved", saved);
  button.textContent = saved ? "✓" : "＋";
  button.setAttribute("aria-label", saved ? "Видалити з активного списку" : "Додати до активного списку");
}

function toggleSaved(gameKey) {
  const list = activeList();
  if (!list) return;
  const index = list.items.findIndex(item => item.gameKey === gameKey);
  if (index >= 0) {
    list.items.splice(index, 1);
    showToast("Гру видалено зі списку");
  } else {
    list.items.push(createListItem(gameKey));
    showToast("Гру додано до списку", "success");
  }
  list.updatedAt = new Date().toISOString();
  scheduleSave();
  updateSavedCount();
  renderGames();
  if (elements.libraryDialog.open) renderLibrary();
  if (elements.gameDialog.open && currentGameKey === gameKey) renderGameDialog(gameKey);
}

function updateSavedCount() {
  elements.savedCount.textContent = activeList()?.items.length || 0;
}

async function rawgFetch(path, params = {}, options = {}) {
  const key = state.settings.rawgApiKey.trim();
  if (!key) throw new Error("Спочатку введи RAWG API key у налаштуваннях.");
  const url = new URL(`${RAWG_BASE}${path}`);
  for (const [name, value] of Object.entries({ ...params, key })) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(name, value);
  }

  const cacheKey = url.toString().replace(key, "__KEY__");
  const cached = await idbGet("cache", cacheKey);
  const ttl = Number(state.settings.cacheDays || 7) * 86400000;
  if (!options.fresh && cached && Date.now() - cached.time < ttl) return cached.data;

  const response = await fetch(url, { headers: { Accept: "application/json" }, credentials: "omit" });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("RAWG відхилив API key.");
    if (response.status === 429) throw new Error("Вичерпано ліміт запитів RAWG.");
    throw new Error(`RAWG: помилка ${response.status}`);
  }
  const data = await response.json();
  await idbSet("cache", cacheKey, { time: Date.now(), data });
  return data;
}

async function loadRawgMetadata() {
  try {
    const [platformData, genreData] = await Promise.all([
      rawgFetch("/platforms", { page_size: 80, ordering: "name" }),
      rawgFetch("/genres", { page_size: 80, ordering: "name" })
    ]);
    rawgMetadata.platformIds = Object.fromEntries((platformData.results || []).map(item => [item.name, item.id]));
    rawgMetadata.genreSlugs = Object.fromEntries((genreData.results || []).map(item => [item.name, item.slug]));
    populateFilters([
      ...currentResults,
      ...(platformData.results || []).map(item => ({ platforms: [item.name], genres: [] })),
      ...(genreData.results || []).map(item => ({ platforms: [], genres: [item.name] }))
    ]);
  } catch (error) {
    console.warn(error);
  }
}

function rawgOrdering(sort) {
  return ({ rating: "-rating", bayesian: "-rating", votes: "-ratings_count", year: "-released", title: "name" })[sort] || "-rating";
}

async function searchRawg({ append = false, fresh = false } = {}) {
  if (state.settings.provider !== "rawg") return;
  setLoading(true, append ? "ЗАВАНТАЖЕННЯ НАСТУПНОЇ СТОРІНКИ..." : "ПОШУК У RAWG...");
  try {
    if (!append) rawgPage = 1;
    const filters = currentFilters();
    const params = {
      page: rawgPage,
      page_size: Number(state.settings.pageSize) || 24,
      search: filters.query || undefined,
      search_precise: filters.query ? "true" : undefined,
      platforms: rawgMetadata.platformIds[filters.platform] || undefined,
      genres: rawgMetadata.genreSlugs[filters.genre] || undefined,
      dates: filters.yearFrom || filters.yearTo ? `${filters.yearFrom || 1970}-01-01,${filters.yearTo || new Date().getFullYear()}-12-31` : undefined,
      ordering: rawgOrdering(filters.sort),
      exclude_additions: "true"
    };
    const data = await rawgFetch("/games", params, { fresh });
    const games = (data.results || []).map(raw => upsertCatalogGame(normalizeGame(raw, "rawg")));
    currentResults = append ? dedupeGames([...currentResults, ...games]) : games;
    rawgHasNext = Boolean(data.next);
    if (append) rawgPage += 1;
    else rawgPage = 2;
    setDataStatus("rawg");
    populateFilters([...Object.values(state.catalog), ...games]);
    scheduleSave();
    renderGames();
  } catch (error) {
    setDataStatus("offline", "ПОМИЛКА API");
    showToast(error.message || "Не вдалося завантажити RAWG", "error", 5000);
    if (!currentResults.length) {
      currentResults = [...demoCatalog];
      populateFilters(currentResults);
      renderGames();
    }
  } finally {
    setLoading(false);
  }
}

function dedupeGames(games) {
  return [...new Map(games.map(game => [game.key, game])).values()];
}

async function loadRawgGameDetails(gameKey) {
  const game = state.catalog[gameKey];
  if (!game?.rawgId) return game;
  try {
    const detail = await rawgFetch(`/games/${game.rawgId}`);
    const merged = upsertCatalogGame(normalizeGame({ ...detail, key: game.key, hltb: game.playtime, ratingSources: game.ratingSources }, "rawg"));
    currentResults = currentResults.map(item => item.key === merged.key ? merged : item);
    scheduleSave();
    return merged;
  } catch (error) {
    showToast(error.message, "error");
    return game;
  }
}

async function fetchSteamRating(gameKey) {
  const game = state.catalog[gameKey];
  if (!game?.rawgId) throw new Error("Steam можна перевірити лише для гри з RAWG.");
  const stores = await rawgFetch(`/games/${game.rawgId}/stores`);
  const steamStore = (stores.results || []).find(item => item.store_id === 1 || /steampowered\.com/i.test(item.url || ""));
  const match = String(steamStore?.url || "").match(/\/app\/(\d+)/i);
  if (!match) throw new Error("Для цієї версії не знайдено Steam App ID.");
  const appId = match[1];
  const url = `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`;
  let response;
  try {
    response = await fetch(url, { credentials: "omit" });
  } catch {
    throw new Error("Браузер заблокував прямий запит до Steam через CORS.");
  }
  if (!response.ok) throw new Error(`Steam: помилка ${response.status}`);
  const data = await response.json();
  const summary = data.query_summary;
  if (!summary?.total_reviews) throw new Error("Steam не повернув достатньо відгуків.");
  const source = {
    id: "steam",
    name: "Steam",
    score: (summary.total_positive / summary.total_reviews) * 100,
    scale: 100,
    votes: summary.total_reviews,
    reliability: 1,
    url: `https://store.steampowered.com/app/${appId}`
  };
  game.ratingSources = [...game.ratingSources.filter(item => item.id !== "steam"), source];
  game.aggregate = computeAggregateRating(game.ratingSources);
  game.bayesian = bayesianScore(game.aggregate.score, game.aggregate.votes);
  game.ratingsCount = game.aggregate.votes;
  scheduleSave();
  return source;
}

async function openGame(gameKey) {
  currentGameKey = gameKey;
  elements.gameDialog.showModal();
  renderGameDialog(gameKey);
  const game = state.catalog[gameKey];
  if (state.settings.provider === "rawg" && game?.rawgId && !game.description) {
    await loadRawgGameDetails(gameKey);
    if (elements.gameDialog.open && currentGameKey === gameKey) renderGameDialog(gameKey);
  }
}

function renderGameDialog(gameKey) {
  const game = state.catalog[gameKey];
  if (!game) return;
  const item = findListItem(gameKey);
  elements.gameDialogTitle.textContent = game.title;
  elements.gameDialogContent.innerHTML = `
    <div class="game-detail-grid">
      <div class="detail-cover cartridge mini-cartridge">
        ${game.cover ? `<img src="${escapeHtml(game.cover)}" alt="Обкладинка ${escapeHtml(game.title)}" />` : `<div class="detail-fallback">${escapeHtml(initials(game.title))}</div>`}
      </div>
      <div class="detail-main">
        <div class="detail-badges">
          <span class="tag accent">${escapeHtml(game.platform || game.platforms[0] || "Невідомо")}</span>
          ${game.year ? `<span class="tag">${game.year}</span>` : ""}
          ${isHiddenGem(game) ? `<span class="tag accent">ПРИХОВАНА ПЕРЛИНА</span>` : ""}
        </div>
        <div class="score-panel">
          <strong>${game.aggregate?.score ?? "—"}</strong>
          <div><span>РЕЙТИНГ ГРАВЦІВ</span><small>${confidenceText(game.aggregate?.confidence)} · ${formatVotes(game.aggregate?.votes || 0)} голосів</small></div>
        </div>
        <p class="detail-description">${escapeHtml(game.description || "Опис ще не завантажено.")}</p>
        <div class="detail-links">
          ${game.rawgUrl ? `<a class="text-link" href="${escapeHtml(game.rawgUrl)}" target="_blank" rel="noreferrer">RAWG ↗</a>` : ""}
          ${game.website ? `<a class="text-link" href="${escapeHtml(game.website)}" target="_blank" rel="noreferrer">Офіційний сайт ↗</a>` : ""}
          <a class="text-link" href="https://howlongtobeat.com/?q=${encodeURIComponent(game.title)}" target="_blank" rel="noreferrer">Знайти на HLTB ↗</a>
        </div>
      </div>
    </div>

    <section class="detail-section">
      <div class="section-heading"><h3>Тривалість</h3><span>HLTB вводиться вручну або імпортується</span></div>
      <div class="duration-editor">
        ${durationField("main", "Сюжет", game.playtime.main)}
        ${durationField("mainPlus", "Сюжет + додаткове", game.playtime.mainPlus)}
        ${durationField("completionist", "100%", game.playtime.completionist)}
        ${durationField("rawgAverage", "RAWG середнє", game.playtime.rawgAverage, true)}
      </div>
      <button class="pixel-button secondary compact" id="saveDurationButton" type="button">ЗБЕРЕГТИ ЧАС</button>
    </section>

    <section class="detail-section">
      <div class="section-heading"><h3>Джерела рейтингу</h3><span>Критики не враховуються</span></div>
      <div class="rating-sources" id="ratingSourcesList">
        ${game.ratingSources.length ? game.ratingSources.map(source => `
          <div class="rating-source-row">
            <div><strong>${escapeHtml(source.name)}</strong><small>${formatVotes(source.votes || 0)} голосів</small></div>
            <span>${Math.round(Number(source.score) || 0)}/100</span>
            ${["rawg", "steam"].includes(source.id) ? "" : `<button class="remove-rating-source" type="button" data-source-id="${escapeHtml(source.id)}">×</button>`}
          </div>`).join("") : `<p class="helper">Немає джерел рейтингу.</p>`}
      </div>
      <form class="inline-rating-form" id="ratingSourceForm">
        <input name="name" required placeholder="Джерело" maxlength="40" />
        <input name="score" required type="number" min="0" max="100" placeholder="0–100" />
        <input name="votes" type="number" min="0" placeholder="Голосів" />
        <button class="pixel-button secondary compact" type="submit">ДОДАТИ</button>
      </form>
      ${game.rawgId ? `<button class="text-button left" id="steamRatingButton" type="button">СПРОБУВАТИ ОТРИМАТИ STEAM-РЕЙТИНГ</button>` : ""}
    </section>

    <section class="detail-section">
      <div class="section-heading"><h3>Мій запис</h3><span>${escapeHtml(activeList().name)}</span></div>
      <div class="entry-editor">
        <label class="control-group"><span>СТАТУС</span><select id="entryStatus">${statusOptionsHtml(item?.status || "planned")}</select></label>
        <label class="control-group"><span>ПРІОРИТЕТ</span><select id="entryPriority">${[1,2,3,4,5].map(value => `<option value="${value}" ${(item?.priority || 3) === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
        <label class="control-group"><span>МОЯ ОЦІНКА</span><input id="entryPersonalRating" type="number" min="0" max="100" value="${item?.personalRating ?? ""}" placeholder="0–100" /></label>
        <label class="control-group full"><span>НОТАТКИ</span><textarea id="entryNotes" rows="4" placeholder="Версія, переклад, що перевірити...">${escapeHtml(item?.notes || "")}</textarea></label>
      </div>
      <div class="inline-actions wrap">
        <button class="pixel-button ${item ? "danger" : ""}" id="toggleDetailSaved" type="button">${item ? "ВИДАЛИТИ ЗІ СПИСКУ" : "ДОДАТИ ДО СПИСКУ"}</button>
        ${item ? `<button class="pixel-button secondary" id="saveEntryButton" type="button">ЗБЕРЕГТИ ЗАПИС</button>` : ""}
      </div>
    </section>
  `;

  bindGameDialogActions(gameKey);
}

function durationField(key, label, value, readonly = false) {
  return `<label class="control-group"><span>${label}</span><div class="input-suffix"><input data-duration="${key}" type="number" min="0" step="0.5" value="${value ?? ""}" ${readonly ? "readonly" : ""} placeholder="—" /><span>ГОД</span></div></label>`;
}

function statusOptionsHtml(selected) {
  return STATUS_OPTIONS.map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");
}

function bindGameDialogActions(gameKey) {
  const game = state.catalog[gameKey];
  document.getElementById("toggleDetailSaved")?.addEventListener("click", () => toggleSaved(gameKey));
  document.getElementById("saveDurationButton")?.addEventListener("click", () => {
    for (const input of elements.gameDialogContent.querySelectorAll("[data-duration]")) {
      if (input.readOnly) continue;
      game.playtime[input.dataset.duration] = input.value === "" ? null : Math.max(0, Number(input.value));
    }
    game.playtime.source = "HLTB/manual";
    game.playtime.updatedAt = new Date().toISOString();
    scheduleSave();
    renderGames();
    showToast("Тривалість збережено", "success");
  });

  document.getElementById("ratingSourceForm")?.addEventListener("submit", event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const source = {
      id: makeId("rating"),
      name: String(data.get("name") || "Інше").trim(),
      score: clamp(data.get("score"), 0, 100),
      votes: Math.max(0, Number(data.get("votes")) || 0),
      scale: 100,
      reliability: 1
    };
    game.ratingSources.push(source);
    game.aggregate = computeAggregateRating(game.ratingSources);
    game.bayesian = bayesianScore(game.aggregate.score, game.aggregate.votes);
    game.ratingsCount = game.aggregate.votes;
    scheduleSave();
    renderGames();
    renderGameDialog(gameKey);
  });

  for (const button of elements.gameDialogContent.querySelectorAll(".remove-rating-source")) {
    button.addEventListener("click", () => {
      game.ratingSources = game.ratingSources.filter(source => source.id !== button.dataset.sourceId);
      game.aggregate = computeAggregateRating(game.ratingSources);
      game.bayesian = bayesianScore(game.aggregate.score, game.aggregate.votes);
      game.ratingsCount = game.aggregate.votes;
      scheduleSave();
      renderGames();
      renderGameDialog(gameKey);
    });
  }

  document.getElementById("steamRatingButton")?.addEventListener("click", async event => {
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = "ПЕРЕВІРКА STEAM...";
    try {
      await fetchSteamRating(gameKey);
      showToast("Steam-рейтинг додано", "success");
      renderGames();
      renderGameDialog(gameKey);
    } catch (error) {
      showToast(error.message, "error", 5000);
      event.currentTarget.disabled = false;
      event.currentTarget.textContent = "СПРОБУВАТИ ОТРИМАТИ STEAM-РЕЙТИНГ";
    }
  });

  document.getElementById("saveEntryButton")?.addEventListener("click", () => {
    const item = findListItem(gameKey);
    if (!item) return;
    item.status = document.getElementById("entryStatus").value;
    item.priority = Number(document.getElementById("entryPriority").value);
    const personal = document.getElementById("entryPersonalRating").value;
    item.personalRating = personal === "" ? null : clamp(personal, 0, 100);
    item.notes = document.getElementById("entryNotes").value;
    if (item.status === "playing" && !item.startedAt) item.startedAt = new Date().toISOString();
    if (["completed", "mastered"].includes(item.status) && !item.completedAt) item.completedAt = new Date().toISOString();
    activeList().updatedAt = new Date().toISOString();
    scheduleSave();
    showToast("Запис оновлено", "success");
    if (elements.libraryDialog.open) renderLibrary();
  });
}

function renderLibrary() {
  const list = activeList();
  if (!list) return;
  elements.listSelect.replaceChildren(...state.lists.map(item => new Option(item.name, item.id, false, item.id === list.id)));
  elements.listNameInput.value = list.name;
  const stats = listStats(list, state.catalog);
  elements.listStats.innerHTML = [
    [stats.total, "ІГОР"],
    [stats.playing, "ГРАЮ"],
    [stats.completed, "ЗАВЕРШЕНО"],
    [stats.knownDuration ? `${stats.mainHours} год` : "—", "СЮЖЕТНИЙ ЧАС"]
  ].map(([value, label]) => `<div class="stat-card"><strong>${value}</strong><span>${label}</span></div>`).join("");

  let items = [...list.items];
  const status = elements.libraryStatusFilter.value;
  if (status !== "all") items = items.filter(item => item.status === status);
  const sort = elements.librarySort.value;
  items.sort((a, b) => {
    const gameA = state.catalog[a.gameKey];
    const gameB = state.catalog[b.gameKey];
    if (sort === "priority") return b.priority - a.priority;
    if (sort === "status") return a.status.localeCompare(b.status);
    if (sort === "rating") return (b.personalRating ?? gameB?.aggregate?.score ?? 0) - (a.personalRating ?? gameA?.aggregate?.score ?? 0);
    if (sort === "title") return (gameA?.title || "").localeCompare(gameB?.title || "", "uk");
    return (a.order || 0) - (b.order || 0);
  });

  elements.savedList.replaceChildren();
  elements.emptyListState.hidden = items.length > 0;
  for (const item of items) {
    const game = state.catalog[item.gameKey];
    if (!game) continue;
    const row = document.createElement("article");
    row.className = "saved-item";
    row.dataset.gameKey = game.key;
    row.innerHTML = `
      <button class="saved-cover" type="button" aria-label="Відкрити ${escapeHtml(game.title)}">
        ${game.cover ? `<img src="${escapeHtml(game.cover)}" alt="" />` : `<span>${escapeHtml(initials(game.title))}</span>`}
      </button>
      <div class="saved-copy">
        <h3>${escapeHtml(game.title)}</h3>
        <p>${escapeHtml(game.platform)} · ${game.aggregate?.score ?? "—"}/100 · ${formatHours(game.playtime.main ?? game.playtime.rawgAverage)}</p>
        <textarea class="inline-notes" rows="2" placeholder="Нотатка...">${escapeHtml(item.notes)}</textarea>
      </div>
      <label class="mini-control"><span>СТАТУС</span><select class="inline-status">${statusOptionsHtml(item.status)}</select></label>
      <label class="mini-control"><span>ПРІОРИТЕТ</span><select class="inline-priority">${[1,2,3,4,5].map(value => `<option value="${value}" ${item.priority === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
      <div class="row-actions">
        <button class="move-up" type="button" title="Вище">↑</button>
        <button class="move-down" type="button" title="Нижче">↓</button>
        <button class="remove-button" type="button" title="Видалити">×</button>
      </div>
    `;
    row.querySelector(".saved-cover").addEventListener("click", () => openGame(game.key));
    row.querySelector(".inline-status").addEventListener("change", event => { item.status = event.target.value; scheduleSave(); renderLibrary(); });
    row.querySelector(".inline-priority").addEventListener("change", event => { item.priority = Number(event.target.value); scheduleSave(); renderLibrary(); });
    row.querySelector(".inline-notes").addEventListener("change", event => { item.notes = event.target.value; scheduleSave(); });
    row.querySelector(".remove-button").addEventListener("click", () => toggleSaved(game.key));
    row.querySelector(".move-up").addEventListener("click", () => moveListItem(game.key, -1));
    row.querySelector(".move-down").addEventListener("click", () => moveListItem(game.key, 1));
    elements.savedList.append(row);
  }
  updateSavedCount();
}

function moveListItem(gameKey, delta) {
  const list = activeList();
  const index = list.items.findIndex(item => item.gameKey === gameKey);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= list.items.length) return;
  [list.items[index], list.items[target]] = [list.items[target], list.items[index]];
  list.items.forEach((item, order) => { item.order = order; });
  scheduleSave();
  renderLibrary();
}

function createNewList() {
  const name = prompt("Назва нового списку:", "Новий список");
  if (!name?.trim()) return;
  const list = createList(name.trim());
  state.lists.push(list);
  state.activeListId = list.id;
  scheduleSave();
  renderLibrary();
  renderGames();
}

function duplicateActiveList() {
  const source = activeList();
  const copy = createList(`${source.name} — копія`);
  copy.items = source.items.map(item => ({ ...item, addedAt: new Date().toISOString() }));
  state.lists.push(copy);
  state.activeListId = copy.id;
  scheduleSave();
  renderLibrary();
  renderGames();
}

function deleteActiveList() {
  if (state.lists.length <= 1) return showToast("Має залишитися хоча б один список", "error");
  const list = activeList();
  if (!confirm(`Видалити список «${list.name}»?`)) return;
  state.lists = state.lists.filter(item => item.id !== list.id);
  state.activeListId = state.lists[0].id;
  scheduleSave();
  renderLibrary();
  renderGames();
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJson(scope = "all") {
  const backup = exportBackup(state, scope);
  if (backup.data?.settings) backup.data.settings.rawgApiKey = "";
  const name = scope === "active" ? activeList().name : "save-slot-backup";
  downloadText(`${slugify(name)}.json`, JSON.stringify(backup, null, 2), "application/json");
}

function exportCsv() {
  const list = activeList();
  const csv = `\uFEFF${exportListCsv(list, state.catalog)}`;
  downloadText(`${slugify(list.name)}.csv`, csv, "text/csv;charset=utf-8");
}

async function readImportFile(file) {
  const text = await file.text();
  if (file.name.toLocaleLowerCase().endsWith(".csv")) return { kind: "csv", data: parseCsv(text) };
  return { kind: "json", data: JSON.parse(text) };
}

async function prepareGeneralImport(file) {
  try {
    const parsed = await readImportFile(file);
    let imported;
    if (parsed.kind === "csv") imported = stateFromListCsv(parsed.data, file.name);
    else imported = migrateState(parsed.data);
    pendingImport = imported;
    const count = imported.lists.reduce((sum, list) => sum + list.items.length, 0);
    elements.importSummary.textContent = `Знайдено списків: ${imported.lists.length}. Записів ігор: ${count}.`;
    elements.importDialog.showModal();
  } catch (error) {
    showToast(`Не вдалося імпортувати: ${error.message}`, "error", 5000);
  } finally {
    elements.importInput.value = "";
  }
}

function applyPendingImport(mode) {
  if (!pendingImport) return;
  const rawgKey = state.settings.rawgApiKey;
  state = mode === "merge" ? mergeStates(state, pendingImport) : migrateState(pendingImport);
  if (!state.settings.rawgApiKey) state.settings.rawgApiKey = rawgKey;
  pendingImport = null;
  scheduleSave();
  currentResults = state.settings.provider === "demo" ? [...demoCatalog] : Object.values(state.catalog).filter(game => game.source === "rawg");
  if (!currentResults.length) currentResults = [...demoCatalog];
  populateFilters(Object.values(state.catalog));
  applyUiFiltersFromState();
  refreshAll();
  elements.importDialog.close();
  showToast(mode === "merge" ? "Дані об’єднано" : "Дані замінено", "success");
}

function stateFromListCsv(rows, filename) {
  if (rows.length < 2) throw new Error("CSV порожній");
  const header = rows[0].map(normalizeHeader);
  const output = createLibraryState();
  const list = output.lists[0];
  list.name = filename.replace(/\.csv$/i, "") || "Імпортований список";
  for (const row of rows.slice(1)) {
    const record = Object.fromEntries(header.map((name, index) => [name, row[index] ?? ""]));
    const title = record["назва"] || record["title"] || record["name"];
    if (!title) continue;
    const platform = record["платформа"] || record["platform"] || "Невідома платформа";
    const key = `local:${slugify(`${title}-${platform}`)}`;
    const game = normalizeGame({
      key,
      id: key,
      title,
      platform,
      platforms: [platform],
      ratingSources: record["рейтинг гравців"] ? [{ id: "import", name: "Імпорт", score: Number(record["рейтинг гравців"]), votes: Number(record["голосів"]) || 0 }] : [],
      mainHours: parseOptionalNumber(record["hltb сюжет"]),
      mainPlusHours: parseOptionalNumber(record["hltb сюжет+"]),
      completionistHours: parseOptionalNumber(record["hltb 100%"]),
      rawgAverageHours: parseOptionalNumber(record["rawg середнє"])
    }, "local");
    output.catalog[game.key] = game;
    list.items.push({
      ...createListItem(game.key),
      status: statusFromLabel(record["статус"]),
      priority: clamp(record["пріоритет"] || 3, 1, 5),
      personalRating: parseOptionalNumber(record["особиста оцінка"]),
      notes: record["нотатки"] || ""
    });
  }
  return output;
}

function statusFromLabel(label) {
  const normalized = String(label || "").toLocaleLowerCase("uk-UA");
  return STATUS_OPTIONS.find(([, text]) => text.toLocaleLowerCase("uk-UA") === normalized)?.[0] || "planned";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const input = String(text).replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value.trim()); value = ""; }
    else if (char === "\n") { row.push(value.trim()); rows.push(row); row = []; value = ""; }
    else if (char !== "\r") value += char;
  }
  if (value || row.length) { row.push(value.trim()); rows.push(row); }
  return rows.filter(item => item.some(Boolean));
}

function normalizeHeader(value) {
  return String(value || "").trim().toLocaleLowerCase("uk-UA");
}

function parseOptionalNumber(value) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

async function importHltbFile(file) {
  try {
    const parsed = await readImportFile(file);
    const records = parsed.kind === "csv" ? recordsFromHltbCsv(parsed.data) : recordsFromHltbJson(parsed.data);
    let matched = 0;
    let created = 0;
    for (const record of records) {
      let game = findCatalogMatch(record.title, record.platform);
      if (!game) {
        const key = `local:${slugify(`${record.title}-${record.platform || "unknown"}`)}`;
        game = upsertCatalogGame(normalizeGame({ key, id: key, title: record.title, platform: record.platform || "Невідома платформа", platforms: [record.platform || "Невідома платформа"] }, "local"));
        created += 1;
      } else matched += 1;
      game.playtime.main = record.main ?? game.playtime.main;
      game.playtime.mainPlus = record.mainPlus ?? game.playtime.mainPlus;
      game.playtime.completionist = record.completionist ?? game.playtime.completionist;
      game.playtime.source = "HLTB/import";
      game.playtime.updatedAt = new Date().toISOString();
    }
    scheduleSave();
    renderGames();
    if (elements.libraryDialog.open) renderLibrary();
    showToast(`HLTB: оновлено ${matched}, створено ${created}`, "success", 5000);
  } catch (error) {
    showToast(`HLTB-імпорт: ${error.message}`, "error", 5000);
  } finally {
    elements.hltbImportInput.value = "";
  }
}

function recordsFromHltbCsv(rows) {
  if (rows.length < 2) throw new Error("CSV порожній");
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map(row => {
    const data = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
    return {
      title: data.title || data.name || data["назва"],
      platform: data.platform || data["платформа"] || "",
      main: parseOptionalNumber(data.main || data["main story"] || data["сюжет"] || data["hltb сюжет"]),
      mainPlus: parseOptionalNumber(data.mainplus || data.main_plus || data["main + extras"] || data["сюжет+"] || data["hltb сюжет+"]),
      completionist: parseOptionalNumber(data.completionist || data["100%"] || data["hltb 100%"])
    };
  }).filter(item => item.title);
}

function recordsFromHltbJson(data) {
  const array = Array.isArray(data) ? data : Array.isArray(data.games) ? data.games : [];
  if (!array.length) throw new Error("JSON не містить масиву ігор");
  return array.map(item => ({
    title: item.title || item.name,
    platform: item.platform || "",
    main: parseOptionalNumber(item.main ?? item.mainHours ?? item.hltb?.main),
    mainPlus: parseOptionalNumber(item.mainPlus ?? item.mainPlusHours ?? item.hltb?.mainPlus),
    completionist: parseOptionalNumber(item.completionist ?? item.completionistHours ?? item.hltb?.completionist)
  })).filter(item => item.title);
}

function findCatalogMatch(title, platform = "") {
  const normalizedTitle = normalizeMatchText(title);
  const normalizedPlatform = normalizeMatchText(platform);
  let best = null;
  let bestScore = 0;
  for (const game of Object.values(state.catalog)) {
    const gameTitle = normalizeMatchText(game.title);
    let score = gameTitle === normalizedTitle ? 100 : similarity(gameTitle, normalizedTitle);
    if (normalizedPlatform && game.platforms.some(item => normalizeMatchText(item).includes(normalizedPlatform) || normalizedPlatform.includes(normalizeMatchText(item)))) score += 20;
    if (score > bestScore) { best = game; bestScore = score; }
  }
  return bestScore >= 80 ? best : null;
}

function normalizeMatchText(value) {
  return String(value || "").toLocaleLowerCase("en-US").normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function similarity(a, b) {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  const intersection = [...left].filter(item => right.has(item)).length;
  const union = new Set([...left, ...right]).size || 1;
  return (intersection / union) * 100;
}

function renderSettings() {
  elements.providerSetting.value = state.settings.provider;
  elements.rawgKeySetting.value = state.settings.rawgApiKey;
  elements.pageSizeSetting.value = String(state.settings.pageSize || 24);
  elements.cacheDaysSetting.value = String(state.settings.cacheDays || 7);
  elements.reduceMotionSetting.checked = Boolean(state.settings.reduceMotion);
  elements.tiltSetting.value = String(state.settings.tiltStrength ?? 1);
}

async function saveSettings() {
  const previousProvider = state.settings.provider;
  state.settings.provider = elements.providerSetting.value;
  state.settings.rawgApiKey = elements.rawgKeySetting.value.trim();
  state.settings.pageSize = Number(elements.pageSizeSetting.value);
  state.settings.cacheDays = Number(elements.cacheDaysSetting.value);
  state.settings.reduceMotion = elements.reduceMotionSetting.checked;
  state.settings.tiltStrength = Number(elements.tiltSetting.value);
  document.documentElement.classList.toggle("reduce-motion", state.settings.reduceMotion);
  scheduleSave();
  elements.settingsDialog.close();

  if (state.settings.provider === "rawg") {
    setDataStatus("rawg", "RAWG...");
    await loadRawgMetadata();
    if (previousProvider !== "rawg" || !currentResults.some(game => game.source === "rawg")) await searchRawg();
  } else {
    setDataStatus("demo");
    currentResults = [...demoCatalog];
    populateFilters(currentResults);
    renderGames();
  }
}

async function testRawg() {
  const oldKey = state.settings.rawgApiKey;
  state.settings.rawgApiKey = elements.rawgKeySetting.value.trim();
  elements.testRawgButton.disabled = true;
  elements.testRawgButton.textContent = "ПЕРЕВІРКА...";
  try {
    await rawgFetch("/games", { page_size: 1 }, { fresh: true });
    showToast("RAWG API key працює", "success");
  } catch (error) {
    showToast(error.message, "error", 5000);
  } finally {
    state.settings.rawgApiKey = oldKey;
    elements.testRawgButton.disabled = false;
    elements.testRawgButton.textContent = "ПЕРЕВІРИТИ";
  }
}

function resetFilters() {
  elements.searchInput.value = "";
  elements.platformFilter.value = "all";
  elements.genreFilter.value = "all";
  elements.ratingFilter.value = "70";
  elements.ratingOutput.value = "70";
  elements.votesFilter.value = "0";
  elements.durationModeFilter.value = "main";
  elements.lengthFilter.value = "all";
  elements.yearFromFilter.value = "";
  elements.yearToFilter.value = "";
  elements.unknownDurationFilter.checked = true;
  elements.hiddenGemFilter.checked = false;
  elements.hideSavedFilter.checked = false;
  elements.sortSelect.value = "bayesian";
  renderGames();
}

function applyPreset(preset) {
  resetFilters();
  if (preset === "short") elements.lengthFilter.value = "10";
  if (preset === "hidden") elements.hiddenGemFilter.checked = true;
  if (preset === "top") { elements.ratingFilter.value = "85"; elements.ratingOutput.value = "85"; elements.votesFilter.value = "100"; }
  renderGames();
  document.querySelector(".workspace").scrollIntoView({ behavior: state.settings.reduceMotion ? "auto" : "smooth" });
}

function randomPick() {
  const games = filterAndSortGames(currentResults, { ...currentFilters(), sort: "random" }, activeSavedKeys());
  if (!games.length) return showToast("Немає ігор для випадкового вибору", "error");
  const game = games[Math.floor(Math.random() * games.length)];
  openGame(game.key);
}

function refreshAll() {
  document.documentElement.classList.toggle("reduce-motion", state.settings.reduceMotion);
  updateSavedCount();
  renderGames();
  if (elements.libraryDialog.open) renderLibrary();
  renderSettings();
  setDataStatus(state.settings.provider === "rawg" ? "rawg" : "demo");
}

function bindEvents() {
  elements.searchForm.addEventListener("submit", event => {
    event.preventDefault();
    if (state.settings.provider === "rawg") searchRawg();
    else renderGames();
  });

  for (const element of [
    elements.searchInput, elements.platformFilter, elements.genreFilter, elements.ratingFilter, elements.votesFilter,
    elements.durationModeFilter, elements.lengthFilter, elements.yearFromFilter, elements.yearToFilter,
    elements.unknownDurationFilter, elements.hiddenGemFilter, elements.hideSavedFilter, elements.sortSelect
  ]) {
    element.addEventListener("input", () => {
      elements.ratingOutput.value = elements.ratingFilter.value;
      renderGames();
    });
  }

  elements.platformFilter.addEventListener("change", () => { if (state.settings.provider === "rawg") searchRawg(); });
  elements.genreFilter.addEventListener("change", () => { if (state.settings.provider === "rawg") searchRawg(); });
  elements.resetFilters.addEventListener("click", resetFilters);
  elements.randomPickButton.addEventListener("click", randomPick);
  for (const button of document.querySelectorAll("[data-preset]")) button.addEventListener("click", () => applyPreset(button.dataset.preset));
  elements.loadMoreButton.addEventListener("click", () => searchRawg({ append: true }));

  elements.openLibraryButton.addEventListener("click", () => { renderLibrary(); elements.libraryDialog.showModal(); });
  elements.settingsButton.addEventListener("click", () => { renderSettings(); elements.settingsDialog.showModal(); });
  for (const button of document.querySelectorAll(".close-dialog")) button.addEventListener("click", () => button.closest("dialog").close());
  for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

  elements.listSelect.addEventListener("change", () => { state.activeListId = elements.listSelect.value; scheduleSave(); renderLibrary(); renderGames(); });
  elements.listNameInput.addEventListener("change", () => { activeList().name = elements.listNameInput.value.trim() || "Без назви"; activeList().updatedAt = new Date().toISOString(); scheduleSave(); renderLibrary(); });
  elements.newListButton.addEventListener("click", createNewList);
  elements.duplicateListButton.addEventListener("click", duplicateActiveList);
  elements.deleteListButton.addEventListener("click", deleteActiveList);
  elements.libraryStatusFilter.addEventListener("change", renderLibrary);
  elements.librarySort.addEventListener("change", renderLibrary);

  elements.exportButton.addEventListener("click", () => exportJson("all"));
  elements.exportAllButton.addEventListener("click", () => exportJson("all"));
  elements.exportActiveButton.addEventListener("click", () => exportJson("active"));
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.importButton.addEventListener("click", () => elements.importInput.click());
  elements.importInput.addEventListener("change", event => { const file = event.target.files[0]; if (file) prepareGeneralImport(file); });
  elements.importReplaceButton.addEventListener("click", () => applyPendingImport("replace"));
  elements.importMergeButton.addEventListener("click", () => applyPendingImport("merge"));
  elements.importCancelButton.addEventListener("click", () => { pendingImport = null; elements.importDialog.close(); });

  elements.settingsForm.addEventListener("submit", event => { event.preventDefault(); saveSettings(); });
  elements.testRawgButton.addEventListener("click", testRawg);
  elements.importHltbButton.addEventListener("click", () => elements.hltbImportInput.click());
  elements.hltbImportInput.addEventListener("change", event => { const file = event.target.files[0]; if (file) importHltbFile(file); });
  elements.clearCacheButton.addEventListener("click", async () => { await idbClear("cache"); showToast("Кеш очищено", "success"); });
  elements.resetAppButton.addEventListener("click", async () => {
    if (!confirm("Видалити всі локальні списки, нотатки та налаштування Save Slot?")) return;
    state = createLibraryState();
    currentResults = [...demoCatalog];
    await idbClear("state");
    await idbClear("cache");
    localStorage.removeItem(FALLBACK_KEY);
    populateFilters(currentResults);
    applyUiFiltersFromState();
    refreshAll();
    elements.settingsDialog.close();
    showToast("Дані скинуто");
  });

  window.addEventListener("beforeunload", persistState);
}

async function init() {
  await loadState();
  bindEvents();
  applyUiFiltersFromState();
  populateFilters(Object.values(state.catalog));
  for (const [value, label] of STATUS_OPTIONS) elements.libraryStatusFilter.add(new Option(label, value));
  refreshAll();

  if (state.settings.provider === "rawg" && state.settings.rawgApiKey) {
    await loadRawgMetadata();
    await searchRawg();
  } else {
    currentResults = [...demoCatalog];
    populateFilters(currentResults);
    renderGames();
  }

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init().catch(error => {
  console.error(error);
  showToast("Не вдалося запустити Save Slot", "error", 8000);
});
