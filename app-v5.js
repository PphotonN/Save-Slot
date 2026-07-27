const INITIAL_FALLBACK_TERMS = [
  "Mario", "The Legend of Zelda", "Metroid", "Sonic the Hedgehog", "Final Fantasy",
  "Resident Evil", "Metal Gear", "God of War", "Halo", "Forza", "Doom", "Tomb Raider",
  "Persona", "Dragon Quest", "Castlevania", "Mega Man", "Kirby", "Gran Turismo"
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

const buildGamesV4 = buildGames;
buildGames = async function buildGamesV5(query, records) {
  const games = await buildGamesV4(query, records);
  for (const game of games) platformEntriesFor(game);
  return games;
};

async function fallbackInitialRecords() {
  const settled = await Promise.allSettled(INITIAL_FALLBACK_TERMS.map(term => searchEntities(term, "en")));
  const records = [];
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    records.push(...result.value.slice(0, 4));
  }
  return [...new Map(records.map(item => [item.id, item])).values()].slice(0, 50);
}

loadInitialGames = async function loadInitialGamesV5() {
  const sequence = ++searchSequence;
  const started = performance.now();
  currentQuery = "Початкова добірка";
  setLoading(true, "ЗАВАНТАЖУЮ ПОЧАТКОВИЙ СПИСОК...", "Отримую популярні ігри для різних платформ");
  setSourceState("loading", "WIKIDATA");
  setFeedback("Формую стартову кросплатформну добірку...");

  try {
    let records;
    try {
      const query = `SELECT DISTINCT ?game ?sitelinks WHERE {
        VALUES ?type { wd:Q7889 wd:Q16070115 wd:Q209163 wd:Q1066707 wd:Q865493 }
        ?game wdt:P31 ?type; wdt:P400 ?platform; wikibase:sitelinks ?sitelinks.
        FILTER(?sitelinks > 12)
      } ORDER BY DESC(?sitelinks) LIMIT 48`;
      records = recordsFromSparql(await wikidataSparql(query, 22000));
      if (!records.length) throw new Error("Порожня відповідь");
    } catch {
      elements.loadingDetail.textContent = "Основний каталог не відповів. Використовую резервний пошук Wikidata";
      records = await fallbackInitialRecords();
    }

    if (sequence !== searchSequence) return;
    currentResults = await buildGames("", records);
    if (sequence !== searchSequence) return;
    if (!currentResults.length) throw new Error("Не вдалося сформувати початковий список");

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
  const query = `SELECT DISTINCT ?game ?sitelinks WHERE {
    VALUES ?type { wd:Q7889 wd:Q16070115 wd:Q209163 wd:Q1066707 wd:Q865493 }
    ?game wdt:P31 ?type; wdt:P400 wd:${platformId}; wikibase:sitelinks ?sitelinks.
    FILTER(?sitelinks > 1)
  } ORDER BY DESC(?sitelinks) LIMIT 120`;
  const games = await buildGames("", recordsFromSparql(await wikidataSparql(query, 24000)));
  const label = games.flatMap(platformEntriesFor).find(entry => entry.id === platformId)?.label || platformId;
  return games
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