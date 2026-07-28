const SAVE_SLOT_V13 = "0.7.0-android-preview";
const ONLINE_CACHE_KEY_V13 = "save-slot-online-games-v13";
const ONLINE_CACHE_LIMIT_V13 = 240;
const STARTUP_TERMS_V13 = [
  "Super Mario", "The Legend of Zelda", "Metroid", "Sonic the Hedgehog",
  "Final Fantasy", "Resident Evil", "Halo", "Gran Turismo"
];

// Stop the older delayed startup. This module starts one controlled online load after all patches are ready.
startupRequestedV10 = true;
v6StartupRequested = true;

function cleanCachedGameV13(game) {
  return {
    id: String(game.id),
    title: String(game.title || "Без назви"),
    description: String(game.officialDescription || game.description || ""),
    year: Number.isFinite(Number(game.year)) ? Number(game.year) : null,
    platforms: unique(game.platforms || []),
    platformIds: unique(game.platformIds || []),
    platformEntries: Array.isArray(game.platformEntries) ? game.platformEntries.map(entry => ({ id: entry.id || null, label: String(entry.label || "") })).filter(entry => entry.label) : [],
    genres: unique(game.genres || []),
    developers: unique(game.developers || []),
    publishers: unique(game.publishers || []),
    steamId: game.steamId ? String(game.steamId) : null,
    cover: String(game.cover || ""),
    fallbackCover: String(game.fallbackCover || ""),
    coverCandidates: unique(game.coverCandidates || []),
    coverSource: String(game.coverSource || ""),
    coverPlatform: String(game.coverPlatform || ""),
    wikidataUrl: String(game.wikidataUrl || ""),
    wikipediaUrl: String(game.wikipediaUrl || ""),
    steamUrl: String(game.steamUrl || ""),
    pcgwUrl: String(game.pcgwUrl || ""),
    officialStoreUrl: String(game.officialStoreUrl || ""),
    officialWebsite: String(game.officialWebsite || ""),
    relevance: Number(game.relevance) || 0,
    popularity: Number(game.popularity) || 0,
    rating: game.rating ? { ...game.rating } : null,
    ratingState: game.rating ? "ready" : "unavailable",
    cachedAtV13: Date.now()
  };
}

function readOnlineCacheV13() {
  try {
    const cache = JSON.parse(localStorage.getItem(ONLINE_CACHE_KEY_V13));
    if (!cache || cache.version !== 1 || !Array.isArray(cache.games)) return null;
    return cache;
  } catch {
    return null;
  }
}

function writeOnlineCacheV13(games, label) {
  if (!Array.isArray(games) || !games.length) return;
  const previous = readOnlineCacheV13()?.games || [];
  const merged = new Map();
  for (const game of [...games, ...previous]) {
    if (!game?.id || !game?.title || merged.has(String(game.id))) continue;
    merged.set(String(game.id), cleanCachedGameV13(game));
  }
  try {
    localStorage.setItem(ONLINE_CACHE_KEY_V13, JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      label: String(label || currentQuery || "Онлайн-каталог"),
      games: [...merged.values()].slice(0, ONLINE_CACHE_LIMIT_V13)
    }));
  } catch (error) {
    console.warn("Save Slot: не вдалося зберегти кеш ігор", error);
  }
}

function restoreOnlineCacheV13(reason = "Онлайн-джерело недоступне") {
  const cache = readOnlineCacheV13();
  if (!cache?.games?.length) return false;
  coverGenerationV6 += 1;
  currentResults = cache.games.map(game => ({
    ...game,
    coverCandidates: unique([...(game.coverCandidates || []), game.cover, game.fallbackCover]),
    coverReady: true,
    coverLoading: false,
    coverFailed: false,
    ratingState: game.rating ? "ready" : "unavailable"
  }));
  currentQuery = `Кеш онлайн-каталогу · ${cache.updatedAt || ""}`;
  currentPageV6 = 1;
  populateFilters();
  if (elements.sortSelect) elements.sortSelect.value = "relevance";
  renderGames();
  setLoading(false);
  setSourceStateBeforeV13("ready", "ОФЛАЙН · КЕШ");
  const date = cache.updatedAt ? new Date(cache.updatedAt).toLocaleString("uk-UA") : "невідомо";
  setFeedback(`${reason}. Показано ${currentResults.length} ігор, раніше завантажених з онлайн-бази. Кеш оновлено: ${date}.`, "error");
  return true;
}

const setSourceStateBeforeV13 = setSourceState;
setSourceState = function setSourceStateV13(mode, text) {
  setSourceStateBeforeV13(mode, text);
  if (mode === "error") {
    setTimeout(() => {
      if (!currentResults.length) restoreOnlineCacheV13("Не вдалося зв’язатися з онлайн-базою");
    }, 0);
  }
};

const commitProgressiveBeforeV13 = commitProgressiveResultsV6;
commitProgressiveResultsV6 = async function commitProgressiveResultsV13(games, options = {}) {
  const result = await commitProgressiveBeforeV13(games, options);
  const ready = (games || []).filter(game => game.coverReady);
  writeOnlineCacheV13(ready.length ? ready : games, options.label);
  return result;
};

async function startupRecordsV13(onProgress) {
  const queue = [...STARTUP_TERMS_V13];
  const records = [];
  let completed = 0;
  const workers = Array.from({ length: 2 }, async () => {
    while (queue.length) {
      const term = queue.shift();
      try {
        const found = await searchEntitiesV5(term, "en", 5);
        records.push(...found.slice(0, 4));
      } catch (error) {
        console.warn(`Save Slot: джерело не відповіло для ${term}`, error);
      }
      completed += 1;
      onProgress?.(completed, STARTUP_TERMS_V13.length);
    }
  });
  await Promise.all(workers);
  return [...new Map(records.filter(item => item?.id).map(item => [item.id, item])).values()];
}

loadInitialGames = async function loadInitialGamesV13() {
  startupRequestedV10 = true;
  v6StartupRequested = true;
  const sequence = ++searchSequence;
  const started = performance.now();
  currentQuery = `Онлайн-добірка ${Date.now()}`;
  currentPageV6 = 1;
  coverGenerationV6 += 1;
  setLoading(true, "ЗАВАНТАЖУЮ ОНЛАЙН-БАЗУ...", "Підключаюся до Wikidata");
  setSourceState("loading", "ОНЛАЙН-БАЗА");
  setFeedback("Ігри завантажуються з мережі. Локально доступні тільки раніше закешовані результати.");
  try {
    const records = await startupRecordsV13((done, total) => {
      elements.loadingDetail.textContent = `Пошук у Wikidata: ${done}/${total}`;
    });
    if (sequence !== searchSequence) return;
    if (!records.length) throw new Error("Wikidata не повернула результатів");
    elements.loadingDetail.textContent = `Отримую метадані для ${records.length} записів`;
    let games = await buildGames("", records);
    if (sequence !== searchSequence) return;
    games = shuffledV10(games).slice(0, 32);
    if (!games.length) throw new Error("Не вдалося підтвердити відеоігри у відповіді бази");
    if (elements.sortSelect) elements.sortSelect.value = "relevance";
    await commitProgressiveResultsV6(games, { sequence, started, label: "Онлайн-добірка" });
  } catch (error) {
    if (sequence !== searchSequence) return;
    currentResults = [];
    renderGames();
    setLoading(false);
    if (!restoreOnlineCacheV13(error.message || "Онлайн-база недоступна")) {
      setSourceStateBeforeV13("error", "ПОМИЛКА ОНЛАЙН-БАЗИ");
      setFeedback(`Не вдалося завантажити онлайн-базу: ${error.message}. Закешованих ігор на пристрої ще немає.`, "error");
    }
  }
};

function clearOnlineCacheV13() {
  localStorage.removeItem(ONLINE_CACHE_KEY_V13);
  showToast("Кеш завантажених ігор очищено", "success");
}

function retryOnlineLoadV13() {
  startupRequestedV10 = false;
  v6StartupRequested = false;
  loadInitialGames();
}

function patchAndroidPreviewV13() {
  document.documentElement.classList.add("save-slot-v13", "android-preview");
  const quickActions = document.querySelector(".quick-actions");
  if (quickActions && !document.getElementById("retryOnlineV13")) {
    const retry = document.createElement("button");
    retry.id = "retryOnlineV13";
    retry.type = "button";
    retry.className = "pixel-button secondary";
    retry.textContent = "ОНОВИТИ ОНЛАЙН-БАЗУ";
    retry.addEventListener("click", retryOnlineLoadV13);
    quickActions.append(retry);
  }
  const danger = document.querySelector("#settingsDialog .danger-zone");
  if (danger && !document.getElementById("clearGameCacheV13")) {
    const clear = document.createElement("button");
    clear.id = "clearGameCacheV13";
    clear.type = "button";
    clear.className = "pixel-button secondary";
    clear.textContent = "ОЧИСТИТИ КЕШ ІГОР";
    clear.addEventListener("click", clearOnlineCacheV13);
    danger.insertBefore(clear, elements.resetAppButton || null);
  }
  window.addEventListener("offline", () => {
    setSourceStateBeforeV13("ready", "ОФЛАЙН");
    if (!currentResults.length) restoreOnlineCacheV13("Немає підключення до мережі");
  });
  window.addEventListener("online", () => {
    setSourceStateBeforeV13("ready", "МЕРЕЖА ДОСТУПНА");
    setFeedback("Мережа доступна. Натисни «Оновити онлайн-базу», щоб отримати свіжу добірку.");
  });
}

patchAndroidPreviewV13();
setTimeout(() => {
  startupRequestedV10 = false;
  v6StartupRequested = false;
  loadInitialGames();
}, 80);
