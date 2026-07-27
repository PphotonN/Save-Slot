const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const STORAGE_KEY = "save-slot-manager-v3";
const LEGACY_DB = "save-slot-db";
const LEGACY_STATE_KEY = "app-state";
const ACCEPTED_TYPES = new Set(["Q7889", "Q16070115", "Q209163", "Q1066707", "Q865493"]);
const EXCLUDED_TYPES = new Set(["Q7058673"]);
const STATUS_LABELS = {
  planned: "Заплановано", playing: "Граю", completed: "Пройдено", mastered: "100%", paused: "Відкладено", dropped: "Покинуто"
};

let state = createState();
let currentResults = [];
let currentQuery = "";
let searchSequence = 0;
let pendingImport = null;
let currentGameId = null;
let renderScheduled = false;

const elements = Object.fromEntries([
  "sourceState","sourceStateText","importButton","exportButton","settingsButton","libraryButton","savedCount","importInput",
  "searchForm","searchInput","searchButton","searchFeedback","platformFilter","genreFilter","yearFromFilter","yearToFilter",
  "ratingFilter","reviewsFilter","ratedOnlyFilter","hideSavedFilter","resetFilters","sortSelect","resultsTitle","resultsNote",
  "loadingPanel","loadingTitle","loadingDetail","gameGrid","emptyState","libraryDialog","listSelect","newListButton",
  "duplicateListButton","deleteListButton","listNameInput","listStats","libraryStatus","librarySort","savedList","emptyLibrary",
  "exportActiveButton","exportAllButton","gameDialog","gameDialogTitle","gameDialogContent","settingsDialog","settingsForm",
  "steamRatingsSetting","reduceMotionSetting","tiltSetting","resetAppButton","importDialog","importSummary","importReplaceButton",
  "importMergeButton","importCancelButton","gameCardTemplate","toastRegion"
].map(id => [id, document.getElementById(id)]));

function createId(prefix = "id") {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

function createList(name = "Мій список") {
  return { id: createId("list"), name, items: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function createState() {
  const list = createList();
  return {
    format: "save-slot-manager", version: 3, activeListId: list.id, lists: [list],
    settings: { steamRatings: true, reduceMotion: false, tiltStrength: 1 }
  };
}

function sanitizeState(input) {
  if (!input || typeof input !== "object") return createState();
  const output = createState();
  output.settings = {
    steamRatings: input.settings?.steamRatings ?? true,
    reduceMotion: Boolean(input.settings?.reduceMotion),
    tiltStrength: clamp(input.settings?.tiltStrength ?? 1, 0, 2)
  };
  if (Array.isArray(input.lists) && input.lists.length) {
    output.lists = input.lists.map(list => ({
      id: String(list.id || createId("list")), name: String(list.name || "Без назви"),
      createdAt: list.createdAt || new Date().toISOString(), updatedAt: list.updatedAt || new Date().toISOString(),
      items: Array.isArray(list.items) ? list.items.map((item, index) => normalizeListItem(item, index)).filter(Boolean) : []
    }));
    output.activeListId = output.lists.some(list => list.id === input.activeListId) ? input.activeListId : output.lists[0].id;
  }
  return output;
}

function normalizeListItem(item, index = 0) {
  const game = item?.game || item?.snapshot;
  if (!game?.id || !game?.title) return null;
  return {
    id: String(item.id || createId("entry")), game: normalizeSavedGame(game), status: STATUS_LABELS[item.status] ? item.status : "planned",
    priority: clamp(item.priority ?? 3, 1, 5), personalRating: nullableNumber(item.personalRating), notes: String(item.notes || ""),
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : index, addedAt: item.addedAt || new Date().toISOString()
  };
}

function normalizeSavedGame(game) {
  return {
    id: String(game.id), title: String(game.title || "Без назви"), description: String(game.description || ""), year: nullableNumber(game.year),
    platforms: unique(game.platforms || []), genres: unique(game.genres || []), developers: unique(game.developers || []),
    publishers: unique(game.publishers || []), steamId: game.steamId ? String(game.steamId) : null,
    cover: String(game.cover || ""), fallbackCover: String(game.fallbackCover || ""), wikidataUrl: String(game.wikidataUrl || ""),
    steamUrl: String(game.steamUrl || ""), rating: game.rating ? { ...game.rating } : null
  };
}

async function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored) { state = sanitizeState(stored); return; }
  } catch { }
  const legacy = await loadLegacyState();
  if (legacy) state = migrateLegacyState(legacy);
  persistState();
}

function loadLegacyState() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise(resolve => {
    const request = indexedDB.open(LEGACY_DB);
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("state")) { resolve(null); return; }
      const tx = db.transaction("state", "readonly");
      const get = tx.objectStore("state").get(LEGACY_STATE_KEY);
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => resolve(null);
    };
  });
}

function migrateLegacyState(old) {
  if (!old?.lists?.length) return createState();
  const output = createState();
  output.settings.reduceMotion = Boolean(old.settings?.reduceMotion);
  output.settings.tiltStrength = clamp(old.settings?.tiltStrength ?? 1, 0, 2);
  output.lists = old.lists.map(list => ({
    id: String(list.id || createId("list")), name: String(list.name || "Без назви"), createdAt: list.createdAt, updatedAt: list.updatedAt,
    items: (list.items || []).map((item, index) => {
      const source = old.catalog?.[item.gameKey];
      if (!source) return null;
      const game = {
        id: source.key || source.id || item.gameKey, title: source.title, description: source.description,
        year: source.year, platforms: source.platforms || [source.platform], genres: source.genres || [], steamId: source.steamId,
        cover: source.cover, wikidataUrl: source.wikidataUrl, steamUrl: source.steamUrl,
        rating: source.aggregate?.score != null ? { percent: source.aggregate.score, total: source.aggregate.votes || 0, positive: null, trust: source.bayesian || source.aggregate.score, source: "Імпорт" } : null
      };
      return normalizeListItem({ ...item, game }, index);
    }).filter(Boolean)
  }));
  output.activeListId = output.lists.some(list => list.id === old.activeListId) ? old.activeListId : output.lists[0].id;
  return output;
}

function persistState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { }
}

function activeList() { return state.lists.find(list => list.id === state.activeListId) || state.lists[0]; }
function savedGameIds() { return new Set(activeList()?.items.map(item => item.game.id) || []); }
function findEntry(gameId) { return activeList()?.items.find(item => item.game.id === gameId) || null; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
function nullableNumber(value) { if (value === "" || value == null) return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
function unique(values) { return [...new Set((values || []).filter(Boolean))]; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function initials(title) { return String(title).split(/\s+/).filter(Boolean).slice(0,3).map(w => w[0]).join("").toUpperCase(); }
function formatNumber(value) { return new Intl.NumberFormat("uk-UA", { notation: Number(value) >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value) || 0); }
function normalizeText(value) { return String(value || "").toLocaleLowerCase("en-US").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9а-яіїєґ]+/gi, " ").trim(); }

function setSourceState(mode, text) {
  elements.sourceState.dataset.state = mode;
  elements.sourceStateText.textContent = text;
}

function setLoading(show, title = "ШУКАЮ У WIKIDATA...", detail = "") {
  elements.loadingPanel.hidden = !show;
  elements.loadingTitle.textContent = title;
  elements.loadingDetail.textContent = detail;
  elements.searchButton.disabled = show;
  elements.searchButton.textContent = show ? "ПОШУК..." : "ШУКАТИ";
}

function setFeedback(text, type = "") {
  elements.searchFeedback.className = `search-feedback ${type}`.trim();
  elements.searchFeedback.textContent = text;
}

function showToast(message, type = "info", duration = 3500) {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  elements.toastRegion.append(node);
  requestAnimationFrame(() => node.classList.add("visible"));
  setTimeout(() => { node.classList.remove("visible"); setTimeout(() => node.remove(), 220); }, duration);
}
