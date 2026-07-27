const INITIAL_FALLBACK_TERMS = [
  "Mario", "The Legend of Zelda", "Metroid", "Sonic the Hedgehog",
  "Final Fantasy", "Resident Evil", "Metal Gear", "God of War",
  "Halo", "Forza", "Doom", "Tomb Raider", "Persona", "Dragon Quest",
  "Castlevania", "Mega Man", "Kirby", "Gran Turismo"
];

function platformEntriesFor(game) {
  if (Array.isArray(game.platformEntries) && game.platformEntries.length) return game.platformEntries;
  const entries = [];
  const length = Math.max(game.platformIds?.length || 0, game.platforms?.length || 0);
  for (let index = 0; index < length; index += 1) {
    const id = game.platformIds?.[index];
    const label = game.platforms?.[index];
    if (id && label && !entries.some(entry => entry.id === id)) entries.push({ id, label });
  }
  game.platformEntries = entries;
  return entries;
}

function visiblePlatformV5(game) {
  if (game.recommendationPlatform?.label) return game.recommendationPlatform.label;
  const selected = elements.platformFilter?.value;
  if (selected && selected !== "all" && game.platforms.includes(selected)) return selected;
  if (game.platforms.length === 1) return game.platforms[0];
  if (game.platforms.length > 1) return `${game.platforms.length} платформ`;
  return "Платформа не вказана";
}

function sleepV5(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJsonV5(url, { timeout = 30000, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: "omit",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleepV5(450 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  if (lastError?.name === "AbortError") throw new Error("Wikidata не відповіла вчасно");
  throw lastError || new Error("Онлайн-джерело недоступне");
}

async function wikidataApiV5(params, options = {}) {
  const url = new URL(WIKIDATA_API);
  for (const [key, value] of Object.entries({ ...params, format: "json", formatversion: 2, origin: "*" })) {
    url.searchParams.set(key, String(value));
  }
  return fetchJsonV5(url, options);
}

async function searchEntitiesV5(query, language = "en", limit = 5) {
  const data = await wikidataApiV5({
    action: "wbsearchentities",
    search: query,
    language,
    uselang: "uk",
    type: "item",
    limit
  }, { timeout: 18000, retries: 2 });
  return data.search || [];
}

async function fetchEntitiesV5(ids, props = "labels|descriptions|claims|sitelinks") {
  const uniqueIds = unique(ids).slice(0, 60);
  if (!uniqueIds.length) return {};
  const output = {};
  for (let offset = 0; offset < uniqueIds.length; offset += 15) {
    const chunk = uniqueIds.slice(offset, offset + 15);
    const data = await wikidataApiV5({
      action: "wbgetentities",
      ids: chunk.join("|"),
      props,
      languages: "uk|en",
      languagefallback: 1
    }, { timeout: 28000, retries: 2 });
    const entities = Array.isArray(data.entities) ? data.entities : Object.values(data.entities || {});
    for (const entity of entities) output[entity.id] = entity;
  }
  return output;
}

async function fetchWikipediaImagesV5(entities) {
  const result = {};
  const groups = { uk: [], en: [] };
  for (const entity of Object.values(entities)) {
    const uk = entity.sitelinks?.ukwiki?.title;
    const en = entity.sitelinks?.enwiki?.title;
    if (uk) groups.uk.push({ id: entity.id, title: uk });
    else if (en) groups.en.push({ id: entity.id, title: en });
  }

  for (const [language, items] of Object.entries(groups)) {
    for (let offset = 0; offset < items.length; offset += 20) {
      const chunk = items.slice(offset, offset + 20);
      if (!chunk.length) continue;
      const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
      const params = {
        action: "query",
        prop: "pageimages",
        piprop: "thumbnail|original",
        pithumbsize: "700",
        titles: chunk.map(item => item.title).join("|"),
        format: "json",
        formatversion: "2",
        origin: "*"
      };
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      try {
        const data = await fetchJsonV5(url, { timeout: 16000, retries: 1 });
        const titleMap = new Map(chunk.map(item => [normalizeText(item.title), item.id]));
        for (const page of data.query?.pages || []) {
          const id = titleMap.get(normalizeText(page.title));
          if (id) result[id] = page.thumbnail?.source || page.original?.source || "";
        }
      } catch {
        // Обкладинка є необов'язковою: помилка Wikipedia не скасовує каталог.
      }
    }
  }
  return result;
}

buildGames = async function buildGamesV5(query, records) {
  const uniqueRecords = [...new Map((records || []).filter(item => item?.id).map(item => [item.id, item])).values()].slice(0, 48);
  if (!uniqueRecords.length) return [];

  const entities = await fetchEntitiesV5(uniqueRecords.map(item => item.id));
  const filtered = uniqueRecords.filter(item => entities[item.id] && isVideoGameEntity(entities[item.id], item));
  if (!filtered.length) return [];

  const linkedIds = new Set();
  for (const item of filtered) {
    const entity = entities[item.id];
    for (const property of ["P400", "P136", "P178", "P123"]) {
      for (const id of claimEntityIds(entity, property)) linkedIds.add(id);
    }
  }

  const [labels, wikiImages] = await Promise.all([
    fetchEntitiesV5([...linkedIds], "labels"),
    fetchWikipediaImagesV5(Object.fromEntries(filtered.map(item => [item.id, entities[item.id]])))
  ]);

  return filtered.map((record, index) => {
    const entity = entities[record.id];
    const steamId = claimString(entity, "P1733");
    const commons = commonsImage(claimString(entity, "P18"));
    const steam = steamId ? steamCover(steamId) : "";
    const covers = unique([wikiImages[entity.id], commons, steam]);
    const platformIds = unique(claimEntityIds(entity, "P400"));
    const platformEntries = platformIds
      .map(id => ({ id, label: entityLabel(labels[id]) }))
      .filter(entry => entry.label);
    const title = entityLabel(entity) || record.label;

    return {
      id: entity.id,
      title,
      description: entityDescription(entity) || record.description || "",
      year: claimTime(entity, "P577"),
      platforms: platformEntries.map(entry => entry.label),
      platformIds: platformEntries.map(entry => entry.id),
      platformEntries,
      genres: unique(claimEntityIds(entity, "P136").map(id => entityLabel(labels[id]))),
      developers: unique(claimEntityIds(entity, "P178").map(id => entityLabel(labels[id]))),
      publishers: unique(claimEntityIds(entity, "P123").map(id => entityLabel(labels[id]))),
      steamId,
      cover: covers[0] || "",
      fallbackCover: covers[1] || "",
      coverCandidates: covers,
      wikidataUrl: `https://www.wikidata.org/wiki/${entity.id}`,
      steamUrl: steamId ? `https://store.steampowered.com/app/${steamId}/` : "",
      relevance: computeRelevance(query, title, index),
      popularity: Number(record.popularity) || 0,
      rating: null,
      ratingState: steamId && state.settings.steamRatings ? "pending" : "unavailable"
    };
  }).sort((a, b) => b.relevance - a.relevance || b.popularity - a.popularity);
};

async function fallbackInitialRecords(onProgress) {
  const records = [];
  const queue = [...INITIAL_FALLBACK_TERMS];
  let completed = 0;
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const term = queue.shift();
      try {
        const results = await searchEntitiesV5(term, "en", 4);
        records.push(...results.slice(0, 3));
      } catch {
        // Один невдалий термін не зупиняє всю стартову вибірку.
      }
      completed += 1;
      onProgress?.(completed, INITIAL_FALLBACK_TERMS.length);
    }
  });
  await Promise.all(workers);
  return [...new Map(records.map(item => [item.id, item])).values()].slice(0, 42);
}

loadInitialGames = async function loadInitialGamesV5() {
  const sequence = ++searchSequence;
  const started = performance.now();
  currentQuery = "Початкова добірка";
  setLoading(true, "ЗАВАНТАЖУЮ ПОЧАТКОВИЙ СПИСОК...", "Отримую ігри через Wikidata API");
  setSourceState("loading", "WIKIDATA API");
  setFeedback("Формую стартову кросплатформну добірку...");

  try {
    const records = await fallbackInitialRecords((completed, total) => {
      elements.loadingDetail.textContent = `Пошук джерел: ${completed}/${total}`;
    });
    if (sequence !== searchSequence) return;
    if (!records.length) throw new Error("Wikidata не повернула стартових результатів");

    elements.loadingDetail.textContent = `Отримую платформи, жанри та обкладинки для ${records.length} збігів`;
    currentResults = await buildGames("", records);
    if (sequence !== searchSequence) return;
    if (!currentResults.length) throw new Error("Не вдалося підтвердити відеоігри у відповіді Wikidata");

    populateFilters();
    resetFilters();
    renderGames();
    setLoading(false);
    setSourceState("ready", "КАТАЛОГ ГОТОВИЙ");
    setFeedback(`Стартовий список: ${currentResults.length} ігор, завантажено за ${((performance.now() - started) / 1000).toFixed(1)} с.`, "success");
    enrichRatingsV4(currentResults, sequence, started, 12);
  } catch (error) {
    if (sequence !== searchSequence) return;
    currentResults = [];
    renderGames();
    setLoading(false);
    setSourceState("error", "ПОМИЛКА ДЖЕРЕЛА");
    setFeedback(`Не вдалося завантажити стартовий список: ${error.message}`, "error");
  }
};

const renderGameCardV4 = renderGameCard;
renderGameCard = function renderGameCardV5(game) {
  const node = renderGameCardV4(game);
  const card = node.querySelector(".game-card");
  const chip = card.querySelector(".platform-chip");
  const tags = card.querySelector(".game-tags");
  const label = visiblePlatformV5(game);

  chip.textContent = label;
  chip.title = game.platforms.join(", ");
  tags.replaceChildren();
  for (const genre of game.genres.slice(0, 2)) tags.append(makeTag(genre));
  if (game.recommendationPlatform?.label) tags.append(makeTag(game.recommendationPlatform.label, "accent"));
  else if (game.platforms.length === 1) tags.append(makeTag(game.platforms[0]));
  else if (game.platforms.length > 1) tags.append(makeTag(`${game.platforms.length} платформ`));
  return node;
};

choosePlatform = function choosePlatformV5() {
  const selected = elements.platformFilter.value;
  const map = new Map();
  for (const game of currentResults) {
    for (const entry of platformEntriesFor(game)) {
      if (selected !== "all" && entry.label !== selected) continue;
      const option = map.get(entry.id) || { ...entry, count: 0 };
      option.count += 1;
      map.set(entry.id, option);
    }
  }

  const options = [...map.values()].filter(option => option.count >= (selected === "all" ? 2 : 1));
  if (!options.length) return null;
  const recent = new Set(recommendationHistory().platforms.slice(-5));
  const weighted = options.map(option => ({ ...option, weight: option.count * (recent.has(option.id) ? 0.2 : 1) }));
  let roll = Math.random() * weighted.reduce((sum, option) => sum + option.weight, 0);
  for (const option of weighted) {
    roll -= option.weight;
    if (roll <= 0) return option;
  }
  return weighted[0];
};

fetchPlatformGames = async function fetchPlatformGamesV5(platformId) {
  let records = [];
  try {
    const query = `SELECT DISTINCT ?game WHERE { ?game wdt:P400 wd:${platformId}. } LIMIT 100`;
    records = recordsFromSparql(await wikidataSparql(query, 40000));
  } catch {
    // Якщо SPARQL перевантажений, використовуємо вже завантажений онлайн-каталог.
    records = currentResults
      .filter(game => platformEntriesFor(game).some(entry => entry.id === platformId))
      .map(game => ({ id: game.id, label: game.title, description: game.description, popularity: game.popularity || 0 }));
  }

  const games = records.length ? await buildGames("", records) : [];
  const sourceGames = games.length ? games : currentResults.filter(game => platformEntriesFor(game).some(entry => entry.id === platformId));
  const label = sourceGames.flatMap(platformEntriesFor).find(entry => entry.id === platformId)?.label || platformId;
  return sourceGames
    .filter(game => platformEntriesFor(game).some(entry => entry.id === platformId))
    .map(game => ({ ...game, recommendationPlatform: { id: platformId, label } }));
};

async function initV5() {
  patchV4Dom();
  await loadState();
  bindEvents();
  attachV4Events();
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  document.documentElement.classList.toggle("reduce-motion", state.settings.reduceMotion || reduced);
  updateSavedCount();
  renderGames();
  setSourceState("loading", "ЗАВАНТАЖЕННЯ");
  await loadInitialGames();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

initV5().catch(error => {
  console.error(error);
  setLoading(false);
  setSourceState("error", "ПОМИЛКА ЗАПУСКУ");
  setFeedback("Save Slot не вдалося запустити.", "error");
});