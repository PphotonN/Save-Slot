export const APP_FORMAT = "save-slot-backup";
export const APP_VERSION = 2;

export const STATUS_OPTIONS = [
  ["planned", "Заплановано"],
  ["playing", "Граю"],
  ["completed", "Пройдено"],
  ["mastered", "100%"],
  ["paused", "Відкладено"],
  ["dropped", "Покинуто"]
];

export const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS);

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function slugify(value) {
  return String(value || "save-slot")
    .toLocaleLowerCase("uk-UA")
    .trim()
    .replace(/[^a-zа-яіїєґ0-9]+/gi, "-")
    .replace(/^-|-$/g, "") || "save-slot";
}

export function makeId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeScore(value, scale = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (scale === 5) return clamp(number * 20, 0, 100);
  if (scale === 10) return clamp(number * 10, 0, 100);
  return clamp(number, 0, 100);
}

export function computeAggregateRating(sources = []) {
  const usable = sources
    .map(source => ({
      ...source,
      score: normalizeScore(source.score, source.scale || 100),
      votes: Math.max(0, Number(source.votes) || 0)
    }))
    .filter(source => Number.isFinite(source.score));

  if (!usable.length) {
    return { score: null, votes: 0, sourceCount: 0, confidence: "none", disagreement: null };
  }

  let weighted = 0;
  let totalWeight = 0;
  let totalVotes = 0;

  for (const source of usable) {
    const reliability = clamp(source.reliability ?? 1, 0.2, 2);
    const voteWeight = 1 + Math.log10(source.votes + 1);
    const weight = reliability * voteWeight;
    weighted += source.score * weight;
    totalWeight += weight;
    totalVotes += source.votes;
  }

  const score = weighted / totalWeight;
  const mean = usable.reduce((sum, item) => sum + item.score, 0) / usable.length;
  const variance = usable.reduce((sum, item) => sum + ((item.score - mean) ** 2), 0) / usable.length;
  const disagreement = Math.sqrt(variance);

  let confidence = "low";
  if ((totalVotes >= 1000 && usable.length >= 2) || totalVotes >= 5000) confidence = "high";
  else if (totalVotes >= 100 || usable.length >= 2) confidence = "medium";

  return {
    score: Math.round(score),
    votes: totalVotes,
    sourceCount: usable.length,
    confidence,
    disagreement: Math.round(disagreement * 10) / 10
  };
}

export function bayesianScore(score, votes, globalMean = 70, minimumVotes = 120) {
  if (!Number.isFinite(Number(score))) return null;
  const rating = clamp(score, 0, 100);
  const count = Math.max(0, Number(votes) || 0);
  return Math.round((((count / (count + minimumVotes)) * rating) + ((minimumVotes / (count + minimumVotes)) * globalMean)) * 10) / 10;
}

export function isHiddenGem(game) {
  const rating = Number(game.aggregate?.score ?? game.rating ?? 0);
  const votes = Number(game.aggregate?.votes ?? game.ratingsCount ?? 0);
  const explicit = game.hiddenGem === true;
  return explicit || (rating >= 76 && votes > 0 && votes <= 2500);
}

export function normalizeGame(raw, source = "local") {
  const rawgRating = normalizeScore(raw.rating, raw.ratingScale || (source === "rawg" ? 5 : 100));
  const ratingSources = Array.isArray(raw.ratingSources)
    ? raw.ratingSources
    : rawgRating == null ? [] : [{
      id: source === "rawg" ? "rawg" : "local",
      name: source === "rawg" ? "RAWG" : "Каталог",
      score: rawgRating,
      scale: 100,
      votes: Number(raw.ratings_count ?? raw.ratingsCount ?? raw.votes) || 0,
      reliability: 1
    }];

  const aggregate = computeAggregateRating(ratingSources);
  const rawPlaytime = raw.playtime && typeof raw.playtime === "object" ? raw.playtime : {};
  const platforms = unique((raw.platforms || []).map(item => item?.platform?.name || item?.name || item).filter(Boolean));
  const genres = unique((raw.genres || []).map(item => item?.name || item).filter(Boolean));
  const tags = unique((raw.tags || []).map(item => item?.name || item).filter(Boolean));
  const released = raw.released || raw.releaseDate || null;
  const year = Number(raw.year) || (released ? Number(String(released).slice(0, 4)) : null);
  const idValue = raw.id ?? raw.rawgId ?? makeId("game");

  return {
    key: String(raw.key || `${source}:${idValue}`),
    id: idValue,
    source,
    rawgId: source === "rawg" ? Number(idValue) : Number(raw.rawgId) || null,
    title: String(raw.title || raw.name || "Без назви"),
    slug: raw.slug || null,
    description: raw.description_raw || raw.description || "",
    released,
    year: Number.isFinite(year) ? year : null,
    platforms,
    platform: raw.platform || platforms[0] || "Невідома платформа",
    genres,
    tags,
    cover: raw.cover || raw.background_image || raw.backgroundImage || "",
    website: raw.website || "",
    rawgUrl: raw.rawgUrl || (raw.slug ? `https://rawg.io/games/${raw.slug}` : ""),
    stores: raw.stores || [],
    ratingSources,
    aggregate,
    bayesian: bayesianScore(aggregate.score, aggregate.votes),
    ratingsCount: aggregate.votes,
    playtime: {
      rawgAverage: nullableNumber(rawPlaytime.rawgAverage ?? (typeof raw.playtime === "number" ? raw.playtime : raw.rawgAverageHours)),
      main: nullableNumber(raw.hltb?.main ?? rawPlaytime.main ?? raw.mainHours),
      mainPlus: nullableNumber(raw.hltb?.mainPlus ?? rawPlaytime.mainPlus ?? raw.mainPlusHours),
      completionist: nullableNumber(raw.hltb?.completionist ?? rawPlaytime.completionist ?? raw.completionistHours),
      source: raw.hltb?.source || rawPlaytime.source || raw.playtimeSource || null,
      updatedAt: raw.hltb?.updatedAt || rawPlaytime.updatedAt || raw.playtimeUpdatedAt || null
    },
    hiddenGem: Boolean(raw.hiddenGem),
    screenshots: raw.short_screenshots || raw.screenshots || [],
    cachedAt: raw.cachedAt || new Date().toISOString()
  };
}

function nullableNumber(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function mergeGame(existing, incoming) {
  const left = normalizeGame(existing, existing.source || "local");
  const right = normalizeGame(incoming, incoming.source || left.source || "local");
  const ratingSources = mergeRatingSources(left.ratingSources, right.ratingSources);

  const aggregate = computeAggregateRating(ratingSources);
  return {
    ...left,
    ...right,
    title: right.title || left.title,
    description: right.description || left.description,
    cover: right.cover || left.cover,
    website: right.website || left.website,
    rawgUrl: right.rawgUrl || left.rawgUrl,
    platforms: unique([...left.platforms, ...right.platforms]),
    genres: unique([...left.genres, ...right.genres]),
    tags: unique([...left.tags, ...right.tags]),
    ratingSources,
    aggregate,
    bayesian: bayesianScore(aggregate.score, aggregate.votes),
    ratingsCount: aggregate.votes,
    playtime: {
      rawgAverage: right.playtime.rawgAverage ?? left.playtime.rawgAverage,
      main: right.playtime.main ?? left.playtime.main,
      mainPlus: right.playtime.mainPlus ?? left.playtime.mainPlus,
      completionist: right.playtime.completionist ?? left.playtime.completionist,
      source: right.playtime.source || left.playtime.source,
      updatedAt: right.playtime.updatedAt || left.playtime.updatedAt
    }
  };
}

export function mergeRatingSources(a = [], b = []) {
  const map = new Map();
  for (const source of [...a, ...b]) {
    const id = String(source.id || source.name || makeId("rating")).toLocaleLowerCase();
    map.set(id, { ...source, id });
  }
  return [...map.values()];
}

export function gameDuration(game, mode = "main") {
  const map = {
    main: game.playtime?.main,
    mainPlus: game.playtime?.mainPlus,
    completionist: game.playtime?.completionist,
    rawgAverage: game.playtime?.rawgAverage
  };
  return nullableNumber(map[mode]);
}

export function filterAndSortGames(games, filters = {}, savedKeys = new Set()) {
  const query = String(filters.query || "").trim().toLocaleLowerCase("uk-UA");
  const platform = filters.platform || "all";
  const genre = filters.genre || "all";
  const minRating = Number(filters.minRating ?? 0);
  const minVotes = Number(filters.minVotes ?? 0);
  const maxHours = filters.maxHours === "all" || filters.maxHours == null ? Infinity : Number(filters.maxHours);
  const durationMode = filters.durationMode || "main";
  const yearFrom = Number(filters.yearFrom) || 0;
  const yearTo = Number(filters.yearTo) || 9999;

  const result = games.filter(game => {
    const searchable = [game.title, ...game.genres, ...game.tags, ...game.platforms].join(" ").toLocaleLowerCase("uk-UA");
    const duration = gameDuration(game, durationMode);
    return (!query || searchable.includes(query))
      && (platform === "all" || game.platforms.includes(platform) || game.platform === platform)
      && (genre === "all" || game.genres.includes(genre))
      && (game.aggregate?.score ?? 0) >= minRating
      && (game.aggregate?.votes ?? 0) >= minVotes
      && (duration == null ? Boolean(filters.includeUnknownDuration) : duration <= maxHours)
      && (!filters.hiddenOnly || isHiddenGem(game))
      && (!filters.hideSaved || !savedKeys.has(game.key))
      && (!game.year || (game.year >= yearFrom && game.year <= yearTo));
  });

  const sort = filters.sort || "rating";
  result.sort((a, b) => {
    if (sort === "length") return (gameDuration(a, durationMode) ?? Infinity) - (gameDuration(b, durationMode) ?? Infinity);
    if (sort === "votes") return (b.aggregate?.votes ?? 0) - (a.aggregate?.votes ?? 0);
    if (sort === "year") return (b.year ?? 0) - (a.year ?? 0);
    if (sort === "title") return a.title.localeCompare(b.title, "uk");
    if (sort === "random") return stableRandom(a.key) - stableRandom(b.key);
    if (sort === "bayesian") return (b.bayesian ?? 0) - (a.bayesian ?? 0);
    return (b.aggregate?.score ?? 0) - (a.aggregate?.score ?? 0);
  });

  return result;
}

function stableRandom(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function createList(name = "Мій список ігор") {
  const now = new Date().toISOString();
  return { id: makeId("list"), name, createdAt: now, updatedAt: now, items: [] };
}

export function createLibraryState() {
  const list = createList();
  return {
    version: APP_VERSION,
    activeListId: list.id,
    lists: [list],
    catalog: {},
    settings: {
      provider: "demo",
      rawgApiKey: "",
      reduceMotion: false,
      tiltStrength: 1,
      pageSize: 24,
      cacheDays: 7
    },
    ui: { filters: {} }
  };
}

export function migrateState(input) {
  if (!input || typeof input !== "object") return createLibraryState();

  if (input.format === "save-slot-list" && Array.isArray(input.games)) {
    const state = createLibraryState();
    const list = state.lists[0];
    list.name = input.name || "Імпортований список";
    for (const raw of input.games) {
      const game = normalizeGame(raw, raw.source || "local");
      state.catalog[game.key] = game;
      list.items.push(createListItem(game.key));
    }
    return state;
  }

  if (input.format === APP_FORMAT && input.data) return migrateState(input.data);

  const state = createLibraryState();
  state.version = APP_VERSION;
  state.settings = { ...state.settings, ...(input.settings || {}) };
  state.ui = { ...state.ui, ...(input.ui || {}) };
  state.catalog = {};
  for (const [key, raw] of Object.entries(input.catalog || {})) {
    const game = normalizeGame({ ...raw, key }, raw.source || "local");
    state.catalog[game.key] = game;
  }
  state.lists = Array.isArray(input.lists) && input.lists.length
    ? input.lists.map(list => ({
      id: String(list.id || makeId("list")),
      name: String(list.name || "Без назви"),
      createdAt: list.createdAt || new Date().toISOString(),
      updatedAt: list.updatedAt || new Date().toISOString(),
      items: Array.isArray(list.items) ? list.items.map(normalizeListItem) : []
    }))
    : state.lists;
  state.activeListId = state.lists.some(list => list.id === input.activeListId) ? input.activeListId : state.lists[0].id;
  return state;
}

export function createListItem(gameKey) {
  return normalizeListItem({ gameKey });
}

export function normalizeListItem(item) {
  const now = new Date().toISOString();
  return {
    gameKey: String(item.gameKey || item.key || ""),
    status: STATUS_LABELS[item.status] ? item.status : "planned",
    priority: clamp(item.priority ?? 3, 1, 5),
    personalRating: item.personalRating == null ? null : clamp(item.personalRating, 0, 100),
    notes: String(item.notes || ""),
    addedAt: item.addedAt || now,
    startedAt: item.startedAt || null,
    completedAt: item.completedAt || null,
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : Date.now()
  };
}

export function exportBackup(state, scope = "all") {
  const safeState = migrateState(state);
  if (scope === "active") {
    const list = safeState.lists.find(item => item.id === safeState.activeListId) || safeState.lists[0];
    const catalog = {};
    for (const item of list.items) if (safeState.catalog[item.gameKey]) catalog[item.gameKey] = safeState.catalog[item.gameKey];
    return {
      format: APP_FORMAT,
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      scope: "active-list",
      data: { ...safeState, lists: [list], activeListId: list.id, catalog }
    };
  }
  return { format: APP_FORMAT, version: APP_VERSION, exportedAt: new Date().toISOString(), scope: "all", data: safeState };
}

export function mergeStates(currentInput, importedInput) {
  const current = migrateState(currentInput);
  const imported = migrateState(importedInput);
  const output = migrateState(current);

  for (const [key, game] of Object.entries(imported.catalog)) {
    output.catalog[key] = output.catalog[key] ? mergeGame(output.catalog[key], game) : game;
  }

  for (const importedList of imported.lists) {
    const existing = output.lists.find(list => list.id === importedList.id);
    if (!existing) {
      output.lists.push(importedList);
      continue;
    }
    const byGame = new Map(existing.items.map(item => [item.gameKey, item]));
    for (const item of importedList.items) byGame.set(item.gameKey, { ...(byGame.get(item.gameKey) || {}), ...item });
    existing.items = [...byGame.values()];
    existing.name = importedList.name || existing.name;
    existing.updatedAt = new Date().toISOString();
  }

  return output;
}

export function listStats(list, catalog) {
  const stats = {
    total: list?.items?.length || 0,
    completed: 0,
    playing: 0,
    planned: 0,
    mainHours: 0,
    knownDuration: 0,
    averagePersonalRating: null
  };
  const personal = [];
  for (const item of list?.items || []) {
    if (item.status === "completed" || item.status === "mastered") stats.completed += 1;
    if (item.status === "playing") stats.playing += 1;
    if (item.status === "planned") stats.planned += 1;
    const game = catalog[item.gameKey];
    const hours = game?.playtime?.main ?? game?.playtime?.rawgAverage;
    if (Number.isFinite(hours)) {
      stats.mainHours += hours;
      stats.knownDuration += 1;
    }
    if (Number.isFinite(item.personalRating)) personal.push(item.personalRating);
  }
  if (personal.length) stats.averagePersonalRating = Math.round(personal.reduce((a, b) => a + b, 0) / personal.length);
  stats.mainHours = Math.round(stats.mainHours * 10) / 10;
  return stats;
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function exportListCsv(list, catalog) {
  const rows = [[
    "Назва", "Платформа", "Статус", "Пріоритет", "Особиста оцінка", "Рейтинг гравців",
    "Голосів", "HLTB сюжет", "HLTB сюжет+", "HLTB 100%", "RAWG середнє", "Нотатки"
  ]];
  for (const item of list.items) {
    const game = catalog[item.gameKey];
    if (!game) continue;
    rows.push([
      game.title,
      game.platform,
      STATUS_LABELS[item.status] || item.status,
      item.priority,
      item.personalRating ?? "",
      game.aggregate?.score ?? "",
      game.aggregate?.votes ?? "",
      game.playtime?.main ?? "",
      game.playtime?.mainPlus ?? "",
      game.playtime?.completionist ?? "",
      game.playtime?.rawgAverage ?? "",
      item.notes
    ]);
  }
  return rows.map(row => row.map(csvEscape).join(",")).join("\n");
}
