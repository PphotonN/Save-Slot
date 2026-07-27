const SAVE_SLOT_V10 = "0.6.0";
const STARTUP_TERMS_V10 = [
  "Mario", "Zelda", "Metroid", "Kirby", "Donkey Kong", "Pokemon", "Fire Emblem", "Xenoblade",
  "Sonic", "Yakuza", "Persona", "Shin Megami Tensei", "Dragon Quest", "Final Fantasy", "Kingdom Hearts",
  "Resident Evil", "Devil May Cry", "Monster Hunter", "Mega Man", "Street Fighter", "Ace Attorney",
  "Metal Gear", "Silent Hill", "Castlevania", "Contra", "Gran Turismo", "God of War", "Ratchet & Clank",
  "Jak and Daxter", "Sly Cooper", "Uncharted", "The Last of Us", "Halo", "Forza", "Gears of War",
  "Fable", "Doom", "Quake", "Wolfenstein", "Half-Life", "Portal", "BioShock", "System Shock",
  "Tomb Raider", "Prince of Persia", "Rayman", "Psychonauts", "Banjo-Kazooie", "Crash Bandicoot",
  "Spyro", "EarthBound", "Chrono Trigger", "Suikoden", "Breath of Fire", "Armored Core", "Dark Souls",
  "Sekiro", "NieR", "Bayonetta", "Okami", "Viewtiful Joe", "Jet Set Radio", "Panzer Dragoon",
  "Phantasy Star", "Shenmue", "Golden Sun", "Advance Wars", "WarioWare", "Pikmin", "F-Zero"
];

let startupRequestedV10 = false;
let selectedDetailsRequestV10 = 0;

function shuffledV10(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function claimStringsV10(entity, property) {
  return unique((entity?.claims?.[property] || []).map(statement => {
    const value = statement?.mainsnak?.datavalue?.value;
    return typeof value === "string" ? value : null;
  }));
}

function wikipediaRefV10(entity) {
  const uk = entity?.sitelinks?.ukwiki?.title;
  const en = entity?.sitelinks?.enwiki?.title;
  if (uk) return { language: "uk", title: uk };
  if (en) return { language: "en", title: en };
  return null;
}

const buildGamesBeforeV10 = buildGames;
buildGames = async function buildGamesV10(query, records) {
  const games = await buildGamesBeforeV10(query, records);
  if (!games.length) return games;
  try {
    const entities = await fetchEntitiesV5(games.map(game => game.id), "claims|sitelinks");
    for (const game of games) {
      const entity = entities[game.id];
      if (!entity) continue;
      game.wikipediaRef = wikipediaRefV10(entity);
      game.gameTdbIds = claimStringsV10(entity, "P8087");
      game.microsoftStoreId = claimStringsV10(entity, "P5885")[0] || null;
      game.nintendoStoreId = claimStringsV10(entity, "P8084")[0] || null;
      game.playstationConceptId = claimStringsV10(entity, "P12332")[0] || null;
      game.officialWebsite = claimStringsV10(entity, "P856")[0] || null;
      game.officialStoreUrl = game.playstationConceptId
        ? `https://store.playstation.com/en-us/concept/${game.playstationConceptId}`
        : game.microsoftStoreId
          ? `https://apps.microsoft.com/detail/${game.microsoftStoreId}`
          : game.nintendoStoreId
            ? `https://www.nintendo.com/us/store/products/${game.nintendoStoreId}/`
            : null;
    }
  } catch {
    // Additional identifiers are optional and never block search results.
  }
  return games;
};

function sourceUrlsV10(target) {
  return [
    target,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(target)}`
  ];
}

async function fetchFirstJsonV10(urls, timeout = 12000) {
  let lastError;
  for (const url of urls) {
    try {
      return await fetchJsonV5(url, { timeout, retries: 0 });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Джерело не відповіло");
}

async function fetchFirstTextV10(urls, timeout = 12000) {
  let lastError;
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("Сторінка не відповіла");
}

async function fetchOfficialStoreDetailsV10(game) {
  if (!game.officialStoreUrl) return null;
  try {
    const html = await fetchFirstTextV10(sourceUrlsV10(game.officialStoreUrl), 12000);
    const documentNode = new DOMParser().parseFromString(html, "text/html");
    const meta = name => documentNode.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.content || "";
    return {
      description: meta("og:description") || meta("description"),
      cover: meta("og:image") || meta("twitter:image"),
      title: meta("og:title"),
      url: game.officialStoreUrl,
      source: "Офіційний магазин"
    };
  } catch {
    return null;
  }
}

async function fetchWikipediaSummaryV10(game) {
  const ref = game.wikipediaRef;
  if (!ref?.title) return null;
  const target = `https://${ref.language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ref.title)}`;
  try {
    const data = await fetchFirstJsonV10([target], 12000);
    return {
      description: String(data.extract || "").trim(),
      cover: data.originalimage?.source || data.thumbnail?.source || "",
      url: data.content_urls?.desktop?.page || "",
      source: "Wikipedia"
    };
  } catch {
    return null;
  }
}

async function fetchSteamDetailsV10(game) {
  if (!game.steamId) return null;
  const target = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(game.steamId)}&l=ukrainian&cc=ua`;
  try {
    const response = await fetchFirstJsonV10(sourceUrlsV10(target), 12000);
    const item = response?.[game.steamId];
    if (!item?.success || !item.data) return null;
    const data = item.data;
    return {
      description: String(data.short_description || "").trim(),
      cover: data.library_600x900_2x || data.library_600x900 || data.header_image || "",
      developers: unique(data.developers || []),
      publishers: unique(data.publishers || []),
      releaseDate: data.release_date?.date || "",
      source: "Steam Store"
    };
  } catch {
    return null;
  }
}

async function fetchPcGamingWikiV10(game) {
  if (!game.steamId) return null;
  const url = new URL("https://www.pcgamingwiki.com/w/api.php");
  const fields = [
    "Infobox_game._pageName=Page", "Infobox_game.Developers", "Infobox_game.Publishers",
    "Infobox_game.Released", "Infobox_game.Cover_URL"
  ].join(",");
  const params = {
    action: "cargoquery",
    tables: "Infobox_game",
    fields,
    where: `Infobox_game.Steam_AppID HOLDS \"${game.steamId}\"`,
    limit: "1",
    format: "json",
    origin: "*"
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    const data = await fetchFirstJsonV10([url.toString()], 12000);
    const title = data?.cargoquery?.[0]?.title;
    if (!title) return null;
    return {
      page: title.Page || "",
      cover: title.Cover_URL || "",
      developers: title.Developers ? [title.Developers] : [],
      publishers: title.Publishers ? [title.Publishers] : [],
      releaseDate: title.Released || "",
      source: "PCGamingWiki"
    };
  } catch {
    return null;
  }
}

function pcgwGamesFromResponseV10(data) {
  const pages = data?.query?.pages || [];
  return pages.filter(page => page?.title && !/^(category|template|glossary|list of|controller|troubleshooting):?/i.test(page.title)).map((page, index) => ({
    id: `pcgw-${page.pageid}`,
    title: page.title,
    description: String(page.extract || "").trim(),
    year: null,
    platforms: ["Microsoft Windows"],
    platformIds: [],
    platformEntries: [],
    genres: [],
    developers: [],
    publishers: [],
    steamId: null,
    cover: page.thumbnail?.source || "",
    fallbackCover: "",
    coverCandidates: unique([page.thumbnail?.source]),
    coverReady: false,
    coverLoading: true,
    coverFailed: false,
    coverSource: page.thumbnail?.source ? "PCGamingWiki" : "",
    coverPlatform: "Microsoft Windows",
    pcgwPageTitle: page.title,
    pcgwUrl: `https://www.pcgamingwiki.com/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    wikidataUrl: "",
    steamUrl: "",
    relevance: 80 - index,
    popularity: 0,
    rating: null,
    ratingState: "unavailable"
  }));
}

async function searchPcGamingWikiV10(query, limit = 8) {
  const url = new URL("https://www.pcgamingwiki.com/w/api.php");
  const params = {
    action: "query", generator: "search", gsrsearch: query, gsrnamespace: "0", gsrlimit: String(limit),
    prop: "extracts|pageimages", exintro: "1", explaintext: "1", exsentences: "2",
    piprop: "thumbnail", pithumbsize: "700", format: "json", formatversion: "2", origin: "*"
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    return pcgwGamesFromResponseV10(await fetchFirstJsonV10([url.toString()], 12000));
  } catch {
    return [];
  }
}

async function randomPcGamingWikiV10(limit = 8) {
  const url = new URL("https://www.pcgamingwiki.com/w/api.php");
  const params = {
    action: "query", generator: "random", grnnamespace: "0", grnlimit: String(limit),
    prop: "extracts|pageimages", exintro: "1", explaintext: "1", exsentences: "2",
    piprop: "thumbnail", pithumbsize: "700", format: "json", formatversion: "2", origin: "*"
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    return pcgwGamesFromResponseV10(await fetchFirstJsonV10([url.toString()], 12000));
  } catch {
    return [];
  }
}

function mergeGameSourcesV10(primary, secondary) {
  const merged = [...primary];
  const byTitle = new Map(primary.map(game => [normalizeText(game.title), game]));
  for (const candidate of secondary) {
    const key = normalizeText(candidate.title);
    const existing = byTitle.get(key);
    if (existing) {
      existing.coverCandidates = unique([...(existing.coverCandidates || []), ...(candidate.coverCandidates || [])]);
      if (!existing.description && candidate.description) existing.description = candidate.description;
      if (!existing.pcgwUrl && candidate.pcgwUrl) existing.pcgwUrl = candidate.pcgwUrl;
    } else {
      merged.push(candidate);
      byTitle.set(key, candidate);
    }
  }
  return merged;
}

function shortDescriptionV10(game) {
  const text = String(game.officialDescription || game.description || "Опис гри відсутній.").replace(/\s+/g, " ").trim();
  return text.length > 520 ? `${text.slice(0, 517).trimEnd()}…` : text;
}

async function enrichSelectedGameV10(game) {
  if (!game || game.detailsLoadingV10 || game.detailsReadyV10) return;
  game.detailsLoadingV10 = true;
  const request = ++selectedDetailsRequestV10;
  const [officialStore, steam, wikipedia, pcgw] = await Promise.all([
    fetchOfficialStoreDetailsV10(game), fetchSteamDetailsV10(game), fetchWikipediaSummaryV10(game), fetchPcGamingWikiV10(game)
  ]);
  if (officialStore?.description) {
    game.officialDescription = officialStore.description;
    game.descriptionSource = officialStore.source;
  } else if (steam?.description) {
    game.officialDescription = steam.description;
    game.descriptionSource = steam.source;
  } else if (wikipedia?.description) {
    game.officialDescription = wikipedia.description;
    game.descriptionSource = wikipedia.source;
  }
  if (officialStore?.cover || steam?.cover || pcgw?.cover || wikipedia?.cover) {
    game.coverCandidates = unique([officialStore?.cover, steam?.cover, pcgw?.cover, wikipedia?.cover, ...(game.coverCandidates || [])]);
  }
  if (steam?.developers?.length) game.developers = unique([...steam.developers, ...(game.developers || [])]);
  if (steam?.publishers?.length) game.publishers = unique([...steam.publishers, ...(game.publishers || [])]);
  if (pcgw?.developers?.length) game.developers = unique([...(game.developers || []), ...pcgw.developers]);
  if (pcgw?.publishers?.length) game.publishers = unique([...(game.publishers || []), ...pcgw.publishers]);
  if (wikipedia?.url) game.wikipediaUrl = wikipedia.url;
  game.detailsLoadingV10 = false;
  game.detailsReadyV10 = true;
  if (request === selectedDetailsRequestV10 && selectedGameV6?.id === game.id) renderDeckDetailsV10(game, false);
}

function setDeckContentVisibleV10(visible) {
  const nodes = [deckElementsV6.kicker, deckElementsV6.title, deckElementsV6.description, deckElementsV6.meta, deckElementsV6.actions, deckFactsV8];
  for (const node of nodes) if (node) node.hidden = !visible;
  deckElementsV6.header?.classList.toggle("deck-empty-v10", !visible);
}

const resetDeckBeforeV10 = resetDeckV6;
resetDeckV6 = function resetDeckV10() {
  resetDeckBeforeV10();
  selectedDetailsRequestV10 += 1;
  if (deckFactsV8) deckFactsV8.replaceChildren();
  setDeckContentVisibleV10(false);
};

function personalRatingV10(game) {
  const value = findEntry(game.id)?.personalRating;
  return value == null ? "—" : `${value}/100`;
}

function renderDeckDetailsV10(game, impact = true) {
  if (!game || !deckElementsV6?.cartridge) return;
  selectedGameV6 = game;
  const platform = game.coverPlatform || game.recommendationPlatform?.label || visiblePlatformV5(game);
  deckElementsV6.cartridge.className = "deck-cartridge-v6 game-cartridge-v6";
  deckElementsV6.cartridge.innerHTML = `<img src="${escapeHtml(game.cover)}" alt="" /><span class="deck-cart-platform-v6">${escapeHtml(platform)}</span>`;
  deckElementsV6.title.textContent = game.title;
  deckElementsV6.description.textContent = shortDescriptionV10(game);
  deckElementsV6.kicker.hidden = true;
  deckElementsV6.meta.hidden = true;
  deckElementsV6.actions.hidden = false;
  deckElementsV6.save.textContent = findEntry(game.id) ? "ВИДАЛИТИ ЗІ СПИСКУ" : "ДОДАТИ ДО СПИСКУ";
  deckElementsV6.save.classList.toggle("danger", Boolean(findEntry(game.id)));
  deckElementsV6.source.href = game.officialStoreUrl || game.officialWebsite || game.wikipediaUrl || game.pcgwUrl || game.wikidataUrl || game.steamUrl || "#";
  deckFactsV8.hidden = false;
  const playerRating = game.rating ? `${game.rating.percent}% · ${formatNumber(game.rating.total)}` : "—";
  deckFactsV8.innerHTML = `
    <div><span>РІК</span><strong>${escapeHtml(game.year || "—")}</strong></div>
    <div><span>ПЛАТФОРМА</span><strong>${escapeHtml(platform)}</strong></div>
    <div><span>РЕЙТИНГ ГРАВЦІВ</span><strong>${escapeHtml(playerRating)}</strong></div>
    <div><span>МОЯ ОЦІНКА</span><strong>${escapeHtml(personalRatingV10(game))}</strong></div>`;
  setDeckContentVisibleV10(true);
  deckElementsV6.kicker.hidden = true;
  deckElementsV6.meta.hidden = true;
  if (impact) {
    deckElementsV6.slotBay.classList.remove("slot-impact-strong-v8");
    requestAnimationFrame(() => deckElementsV6.slotBay.classList.add("slot-impact-strong-v8"));
  }
  enrichSelectedGameV10(game);
}

updateDeckGameV6 = renderDeckDetailsV10;

async function randomStartupRecordsV10(onProgress) {
  const selectedTerms = shuffledV10(STARTUP_TERMS_V10).slice(0, 14);
  const queue = [...selectedTerms];
  const records = [];
  let completed = 0;
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const term = queue.shift();
      try {
        const result = await searchEntitiesV5(term, "en", 4);
        records.push(...result.slice(0, 3));
      } catch {
        // A failed seed does not cancel the whole random startup list.
      }
      completed += 1;
      onProgress?.(completed, selectedTerms.length);
    }
  });
  const [, pcgw] = await Promise.all([Promise.all(workers), randomPcGamingWikiV10(8)]);
  return {
    records: [...new Map(records.map(item => [item.id, item])).values()],
    pcgw
  };
}

loadInitialGames = async function loadRandomInitialGamesV10() {
  if (startupRequestedV10) return;
  startupRequestedV10 = true;
  v6StartupRequested = true;
  const sequence = ++searchSequence;
  const started = performance.now();
  currentQuery = `Випадкова добірка ${Date.now()}`;
  currentPageV6 = 1;
  revealContextV9 = "";
  revealOrderV9 = new Map();
  revealCounterV9 = 0;
  setLoading(true, "ФОРМУЮ ВИПАДКОВУ ДОБІРКУ...", "Підбираю ігри з онлайн-джерел");
  setSourceState("loading", "ПОШУК");
  setFeedback("Щоразу при відкритті Save Slot формується нова добірка.");
  try {
    const source = await randomStartupRecordsV10((done, total) => {
      elements.loadingDetail.textContent = `Пошук ігор: ${done}/${total}`;
    });
    if (sequence !== searchSequence) return;
    let games = await buildGames("", source.records);
    games = mergeGameSourcesV10(games, source.pcgw);
    games = shuffledV10(games).slice(0, 36);
    if (!games.length) throw new Error("Онлайн-джерела не повернули ігор");
    elements.sortSelect.value = "relevance";
    await commitProgressiveResultsV6(games, { sequence, started, label: "Випадкова стартова добірка" });
  } catch (error) {
    if (sequence !== searchSequence) return;
    setLoading(false);
    setSourceState("error", "ПОМИЛКА ДЖЕРЕЛА");
    setFeedback(`Не вдалося сформувати випадкову добірку: ${error.message}`, "error");
  }
};

searchGames = async function searchGamesV10(query) {
  const sequence = ++searchSequence;
  const started = performance.now();
  currentQuery = query;
  currentPageV6 = 1;
  coverGenerationV6 += 1;
  revealContextV9 = "";
  revealOrderV9 = new Map();
  revealCounterV9 = 0;
  setLoading(true, "ШУКАЮ ІГРИ...", `Запит: ${query}`);
  setSourceState("loading", "ПОШУК");
  setFeedback(`Шукаю «${query}» у кількох джерелах...`);
  try {
    const [uk, en, pcgw] = await Promise.allSettled([
      searchEntitiesV5(query, "uk", 30),
      searchEntitiesV5(query, "en", 30),
      searchPcGamingWikiV10(query, 8)
    ]);
    if (sequence !== searchSequence) return;
    const records = [...new Map([...(uk.value || []), ...(en.value || [])].map(item => [item.id, item])).values()];
    let games = records.length ? await buildGames(query, records) : [];
    games = mergeGameSourcesV10(games, pcgw.value || []);
    if (!games.length) throw new Error("Джерела не повернули підтверджених ігор");
    await commitProgressiveResultsV6(games, {
      sequence, started, label: `Пошук «${query}»`, requestedPlatform: elements.platformFilter.value
    });
  } catch (error) {
    if (sequence !== searchSequence) return;
    currentResults = [];
    renderGames();
    setLoading(false);
    setSourceState("error", "ПОМИЛКА ДЖЕРЕЛА");
    setFeedback(`Не вдалося виконати пошук: ${error.message}`, "error");
  }
};

async function generateRandomFiveV10() {
  let sequence = ++searchSequence;
  const started = performance.now();
  let platform = choosePlatform();
  if (!platform) {
    startupRequestedV10 = false;
    await loadInitialGames();
    platform = choosePlatform();
    sequence = ++searchSequence;
  }
  if (!platform) return showToast("Не вдалося визначити платформу", "error");
  setLoading(true, "ФОРМУЮ ВИПАДКОВУ П’ЯТІРКУ...", `Платформа: ${platform.label}`);
  try {
    let pool = currentResults.filter(game => platformEntriesFor(game).some(entry => entry.id === platform.id));
    if (pool.length < 12) {
      const remote = await fetchPlatformGames(platform.id);
      pool = mergeGameSourcesV10(remote, pool);
    }
    const picked = pickFive(pool);
    if (picked.length < 5) throw new Error("Для цієї платформи знайдено замало ігор із боксартом");
    currentQuery = `Випадкова п’ятірка: ${platform.label} · ${Date.now()}`;
    currentPageV6 = 1;
    revealContextV9 = "";
    revealOrderV9 = new Map();
    revealCounterV9 = 0;
    populateFilters();
    if ([...elements.platformFilter.options].some(option => option.value === platform.label)) {
      elements.platformFilter.value = platform.label;
    }
    await commitProgressiveResultsV6(picked, {
      sequence, started, label: `Випадкова п’ятірка для ${platform.label}`, requestedPlatform: platform.label
    });
    const history = recommendationHistory();
    history.games = [...history.games, ...picked.map(game => game.id)].slice(-100);
    history.platforms = [...history.platforms, platform.id].slice(-16);
    localStorage.setItem("save-slot-rec-v1", JSON.stringify(history));
  } catch (error) {
    if (sequence !== searchSequence) return;
    setLoading(false);
    setFeedback(`Не вдалося сформувати добірку: ${error.message}`, "error");
  }
}

function bindRandomButtonV10() {
  const oldButton = document.getElementById("randomFiveButton");
  if (!oldButton || oldButton.dataset.v10Bound === "true") return Boolean(oldButton);
  const button = oldButton.cloneNode(true);
  button.dataset.v10Bound = "true";
  oldButton.replaceWith(button);
  randomFiveButton = button;
  button.addEventListener("click", generateRandomFiveV10);
  document.querySelector(".quick-actions .helper")?.remove();
  return true;
}

function patchClutterV10() {
  document.documentElement.classList.add("save-slot-v10");
  document.querySelectorAll(".rating-state").forEach(node => node.setAttribute("aria-hidden", "true"));
}

function bindPersonalRatingRefreshV10() {
  elements.gameDialogContent.addEventListener("click", event => {
    if (!event.target.closest("#saveEntryButton, #dialogSaveButton")) return;
    setTimeout(() => {
      if (selectedGameV6) renderDeckDetailsV10(selectedGameV6, false);
    }, 50);
  });
}

async function initV10() {
  patchClutterV10();
  bindPersonalRatingRefreshV10();
  const waitForUi = () => {
    const buttonReady = bindRandomButtonV10();
    const deckReady = Boolean(deckElementsV6?.header && deckFactsV8 && deckElementsV6.slotBay);
    if (deckReady && deckElementsV6.slotBay.dataset.v10Bound !== "true") {
      deckElementsV6.slotBay.dataset.v10Bound = "true";
      deckElementsV6.slotBay.addEventListener("click", () => setTimeout(resetDeckV6, 0));
      resetDeckV6();
    }
    if (!buttonReady || !deckReady) setTimeout(waitForUi, 40);
  };
  waitForUi();
  setTimeout(() => {
    if (!startupRequestedV10) loadInitialGames();
  }, 25);
}

initV10().catch(error => console.error("Save Slot 0.6.0:", error));
