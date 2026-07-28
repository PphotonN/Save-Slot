const SAVE_SLOT_V13 = "0.7.1-android-preview";
const ONLINE_CACHE_KEY_V13 = "save-slot-online-games-v13";
const ONLINE_CACHE_LIMIT_V13 = 240;
const STARTUP_TERMS_V13 = [
  "Super Mario", "The Legend of Zelda", "Metroid", "Sonic the Hedgehog",
  "Final Fantasy", "Resident Evil", "Halo", "Gran Turismo"
];

// Older modules contain delayed startup hooks. Keep them blocked until this final module is ready.
startupRequestedV10 = true;
v6StartupRequested = true;

const setSourceStateBeforeV13 = setSourceState;

function cleanCachedGameV13(game) {
  return {
    id: String(game.id),
    title: String(game.title || "Без назви"),
    description: String(game.officialDescription || game.description || ""),
    year: Number.isFinite(Number(game.year)) ? Number(game.year) : null,
    platforms: unique(game.platforms || []),
    platformIds: unique(game.platformIds || []),
    platformEntries: Array.isArray(game.platformEntries)
      ? game.platformEntries.map(entry => ({ id: entry.id || null, label: String(entry.label || "") })).filter(entry => entry.label)
      : [],
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
    coverReady: Boolean(game.cover || game.fallbackCover),
    coverLoading: false,
    coverFailed: !Boolean(game.cover || game.fallbackCover),
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
  setFeedback(`${reason}. Показано ${currentResults.length} ігор, раніше отриманих з онлайн-бази. Кеш оновлено: ${date}.`, "error");
  return true;
}

setSourceState = function setSourceStateV13(mode, text) {
  setSourceStateBeforeV13(mode, text);
  if (mode === "error") {
    setTimeout(() => {
      if (!currentResults.length) restoreOnlineCacheV13("Не вдалося зв’язатися з онлайн-базою");
    }, 0);
  }
};

// Prefer real URLs already returned by Wikidata/Wikipedia/Steam. Libretro guesses are a short fallback,
// not a long blocking queue before cards may appear.
coverCandidatesForGameV6 = function coverCandidatesForGameV13(game, requestedPlatform) {
  const platform = preferredPlatformV6(game, requestedPlatform);
  const existing = unique([game.cover, game.fallbackCover, ...(game.coverCandidates || [])]).filter(Boolean);
  const direct = existing.map(url => ({
    url,
    source: /steamstatic/.test(url) ? "Steam" : /wikimedia|wikipedia/.test(url) ? "Wikimedia" : "Відкрите джерело",
    platform: platform.label
  }));
  const steam = game.steamId
    ? [{ url: steamCover(game.steamId), source: "Steam", platform: platform.label }]
    : [];
  const libretro = libretroCandidatesV6(game, platform).slice(0, 4);
  return [...new Map([...direct, ...steam, ...libretro].map(item => [item.url, item])).values()].slice(0, 8);
};

testImageV6 = function testImageV13(url, timeout = 4500) {
  return new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeout);
    image.onload = () => finish(image.naturalWidth >= 96 && image.naturalHeight >= 96);
    image.onerror = () => finish(false);
    image.referrerPolicy = "no-referrer";
    image.src = url;
  });
};

// Metadata is a valid result. Box art is optional and updates cards progressively.
renderGames = function renderGamesV13() {
  const games = filteredGames();
  const total = games.length;
  const pages = Math.max(1, Math.ceil(total / pageSizeV6));
  currentPageV6 = clamp(currentPageV6, 1, pages);
  const start = (currentPageV6 - 1) * pageSizeV6;
  const pageGames = games.slice(start, start + pageSizeV6);

  elements.gameGrid.replaceChildren();
  for (const game of pageGames) elements.gameGrid.append(renderGameCard(game));
  elements.emptyState.hidden = pageGames.length > 0 || coverProgressV6.active;
  if (!pageGames.length && !coverProgressV6.active) {
    elements.emptyState.innerHTML = currentQuery
      ? "<strong>За поточними фільтрами ігор немає.</strong><span>Зміни платформу, фільтри або пошуковий запит.</span>"
      : "<strong>Тут з’являться ігри.</strong><span>Виконується завантаження онлайн-каталогу.</span>";
  }

  const covered = currentResults.filter(game => game.coverReady).length;
  const pending = currentResults.filter(game => game.coverLoading).length;
  const failed = currentResults.filter(game => game.coverFailed).length;
  elements.resultsTitle.textContent = total
    ? `Ігри ${start + 1}–${Math.min(start + pageSizeV6, total)} із ${total}`
    : coverProgressV6.active ? "Завантажую онлайн-каталог" : "Ігор не знайдено";
  elements.resultsNote.textContent = `Онлайн-метадані: ${currentResults.length} · боксарт: ${covered}${pending ? ` · завантажується: ${pending}` : ""}${failed ? ` · без боксарту: ${failed}` : ""}`;
  updatePaginationV6(total);
};

commitProgressiveResultsV6 = async function commitProgressiveResultsV13(games, options = {}) {
  const { sequence, started = performance.now(), label = "Онлайн-каталог", requestedPlatform = "all" } = options;
  if (sequence !== searchSequence) return;

  games.forEach((game, index) => {
    game.sourceOrderV12 = index;
    game.coverReady = false;
    game.coverLoading = true;
    game.coverFailed = false;
  });
  resultDatasetV12 = `${label}|${Date.now()}`;
  revealContextV9 = "";
  revealOrderV9 = new Map();
  revealCounterV9 = 0;
  currentResults = games;
  currentPageV6 = 1;
  populateFilters();
  if (requestedPlatform !== "all" && [...elements.platformFilter.options].some(option => option.value === requestedPlatform)) {
    elements.platformFilter.value = requestedPlatform;
  }

  // Cache only data that actually came from the online providers, before optional images finish.
  writeOnlineCacheV13(games, label);
  renderGames();
  setLoading(false);
  setSourceState("ready", "БАЗА ЗАВАНТАЖЕНА");
  setFeedback(`${label}: отримано ${games.length} ігор з онлайн-бази за ${((performance.now() - started) / 1000).toFixed(1)} с. Боксарти догружаються окремо.`, "success");

  const generation = ++coverGenerationV6;
  enrichRatingsV4(games, sequence, started, Math.min(12, games.length));
  preloadCoversV6(games, requestedPlatform, generation).then(() => {
    if (sequence !== searchSequence || generation !== coverGenerationV6) return;
    const ready = games.filter(game => game.coverReady).length;
    writeOnlineCacheV13(games, label);
    setLoading(false);
    setSourceState("ready", "КАТАЛОГ ГОТОВИЙ");
    setFeedback(`${label}: ${games.length} ігор з онлайн-бази; боксарт отримано для ${ready}. Ігри без обкладинки залишаються доступними.`, "success");
    renderGames();
  }).catch(error => {
    if (sequence !== searchSequence || generation !== coverGenerationV6) return;
    console.warn("Save Slot: помилка догрузки боксартів", error);
    setLoading(false);
    setSourceState("ready", "БАЗА ЗАВАНТАЖЕНА");
    setFeedback(`${label}: ігри завантажено, але частина боксартів недоступна.`, "error");
    renderGames();
  });

  return games;
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
  setLoading(true, "ОНОВЛЮЮ ОНЛАЙН-БАЗУ...", "Підключаюся до Wikidata");
  setSourceState("loading", "ОНЛАЙН-БАЗА");
  setFeedback("Оновлення онлайн-бази почалося автоматично під час запуску.");
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
  startupRequestedV10 = true;
  v6StartupRequested = true;
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