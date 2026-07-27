const SAVE_SLOT_V6 = "0.5.0";
const PAGE_SIZE_KEY_V6 = "save-slot-page-size-v6";

let currentPageV6 = 1;
let pageSizeV6 = Number(localStorage.getItem(PAGE_SIZE_KEY_V6)) || 20;
let coverGenerationV6 = 0;
let coverProgressV6 = { active: false, total: 0, done: 0, ready: 0, failed: 0 };
let selectedGameV6 = null;
let v6StartupRequested = false;
let deckElementsV6 = {};

const LIBRETRO_SYSTEMS_V6 = [
  [/game boy advance/i, "Nintendo_-_Game_Boy_Advance"],
  [/game boy color/i, "Nintendo_-_Game_Boy_Color"],
  [/game boy/i, "Nintendo_-_Game_Boy"],
  [/nintendo 3ds/i, "Nintendo_-_Nintendo_3DS"],
  [/nintendo ds/i, "Nintendo_-_Nintendo_DS"],
  [/nintendo switch/i, "Nintendo_-_Nintendo_Switch"],
  [/wii u/i, "Nintendo_-_Wii_U"],
  [/\bwii\b/i, "Nintendo_-_Wii"],
  [/gamecube/i, "Nintendo_-_GameCube"],
  [/nintendo 64|\bn64\b/i, "Nintendo_-_Nintendo_64"],
  [/super nintendo|\bsnes\b/i, "Nintendo_-_Super_Nintendo_Entertainment_System"],
  [/nintendo entertainment system|\bnes\b|famicom/i, "Nintendo_-_Nintendo_Entertainment_System"],
  [/playstation vita|\bps vita\b/i, "Sony_-_PlayStation_Vita"],
  [/playstation portable|\bpsp\b/i, "Sony_-_PlayStation_Portable"],
  [/playstation 5/i, "Sony_-_PlayStation_5"],
  [/playstation 4/i, "Sony_-_PlayStation_4"],
  [/playstation 3/i, "Sony_-_PlayStation_3"],
  [/playstation 2/i, "Sony_-_PlayStation_2"],
  [/playstation(?!\s*[2345])|\bps1\b/i, "Sony_-_PlayStation"],
  [/xbox series/i, "Microsoft_-_Xbox_Series"],
  [/xbox one/i, "Microsoft_-_Xbox_One"],
  [/xbox 360/i, "Microsoft_-_Xbox_360"],
  [/\bxbox\b/i, "Microsoft_-_Xbox"],
  [/dreamcast/i, "Sega_-_Dreamcast"],
  [/sega saturn|\bsaturn\b/i, "Sega_-_Saturn"],
  [/game gear/i, "Sega_-_Game_Gear"],
  [/master system/i, "Sega_-_Master_System_-_Mark_III"],
  [/mega drive|genesis/i, "Sega_-_Mega_Drive_-_Genesis"],
  [/atari 2600/i, "Atari_-_2600"],
  [/atari 5200/i, "Atari_-_5200"],
  [/atari 7800/i, "Atari_-_7800"],
  [/atari jaguar/i, "Atari_-_Jaguar"],
  [/atari lynx/i, "Atari_-_Lynx"],
  [/neo geo pocket color/i, "SNK_-_Neo_Geo_Pocket_Color"],
  [/neo geo pocket/i, "SNK_-_Neo_Geo_Pocket"],
  [/neo geo/i, "SNK_-_Neo_Geo"],
  [/pc engine|turbografx/i, "NEC_-_PC_Engine_-_TurboGrafx_16"],
  [/wonder ?swan color/i, "Bandai_-_WonderSwan_Color"],
  [/wonder ?swan/i, "Bandai_-_WonderSwan"]
];

function ensureV6Styles() {
  if (document.querySelector('link[data-save-slot-v6]')) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./styles-v6.css?v=1";
    link.dataset.saveSlotV6 = "true";
    link.onload = resolve;
    link.onerror = resolve;
    document.head.append(link);
  });
}

function patchHeaderV6() {
  const header = document.querySelector(".topbar");
  if (!header || header.classList.contains("deck-header-v6")) return;
  header.classList.add("deck-header-v6");

  const sourceState = header.querySelector(".source-state");
  const actions = header.querySelector(".top-actions");
  const panel = document.createElement("div");
  panel.className = "command-deck-v6";
  panel.innerHTML = `
    <div class="slot-column-v6">
      <button class="slot-bay-v6" id="slotBayV6" type="button" aria-label="Повернути картридж Save Slot">
        <span class="slot-mouth-v6" aria-hidden="true"></span>
        <span class="deck-cartridge-v6 home-cartridge-v6" id="deckCartridgeV6">
          <span class="home-label-v6"><b>▣</b><strong>SAVE<br>SLOT</strong><small>GAME MANAGER</small></span>
        </span>
      </button>
    </div>
    <div class="deck-copy-v6">
      <div class="deck-toolbar-v6" id="deckToolbarV6"></div>
      <p class="deck-kicker-v6" id="deckKickerV6">КРОСПЛАТФОРМНИЙ ПОШУКОВИЙ МЕНЕДЖЕР</p>
      <h2 id="deckTitleV6">Знайди гру та збережи її у свій слот.</h2>
      <p class="deck-description-v6" id="deckDescriptionV6">Онлайн-каталог для ПК, консолей, портативних і ретро-систем. Картки з’являються лише після завантаження боксарту відповідної платформи.</p>
      <div class="deck-meta-v6" id="deckMetaV6"><span>WIKIDATA</span><span>LIBRETRO BOXART</span><span>ЛОКАЛЬНІ СПИСКИ</span></div>
      <div class="deck-game-actions-v6" id="deckGameActionsV6" hidden>
        <button class="pixel-button compact" id="deckSaveButtonV6" type="button">ДОДАТИ ДО СПИСКУ</button>
        <button class="pixel-button secondary compact" id="deckDetailsButtonV6" type="button">ДЕТАЛЬНА КАРТКА</button>
        <a class="pixel-link-v6" id="deckSourceLinkV6" target="_blank" rel="noreferrer">ДЖЕРЕЛО ↗</a>
      </div>
    </div>`;

  header.replaceChildren(panel);
  const toolbar = panel.querySelector("#deckToolbarV6");
  if (sourceState) toolbar.append(sourceState);
  if (actions) toolbar.append(actions);

  deckElementsV6 = {
    header,
    slotBay: panel.querySelector("#slotBayV6"),
    cartridge: panel.querySelector("#deckCartridgeV6"),
    kicker: panel.querySelector("#deckKickerV6"),
    title: panel.querySelector("#deckTitleV6"),
    description: panel.querySelector("#deckDescriptionV6"),
    meta: panel.querySelector("#deckMetaV6"),
    actions: panel.querySelector("#deckGameActionsV6"),
    save: panel.querySelector("#deckSaveButtonV6"),
    details: panel.querySelector("#deckDetailsButtonV6"),
    source: panel.querySelector("#deckSourceLinkV6")
  };

  deckElementsV6.slotBay.addEventListener("click", resetDeckV6);
  deckElementsV6.save.addEventListener("click", () => {
    if (!selectedGameV6) return;
    toggleSaved(selectedGameV6);
    updateDeckGameV6(selectedGameV6, false);
  });
}

function patchPaginationV6() {
  const resultsHeader = document.querySelector(".results-header");
  if (!resultsHeader || document.getElementById("pageSizeV6")) return;

  const controls = document.createElement("div");
  controls.className = "result-controls-v6";
  controls.innerHTML = `
    <label class="page-size-v6"><span>НА СТОРІНЦІ</span><select id="pageSizeV6">
      <option value="12">12</option><option value="20">20</option><option value="32">32</option><option value="48">48</option>
    </select></label>`;
  resultsHeader.append(controls);

  const nav = document.createElement("nav");
  nav.className = "pagination-v6";
  nav.id = "paginationV6";
  nav.setAttribute("aria-label", "Сторінки результатів");
  elements.gameGrid.insertAdjacentElement("afterend", nav);

  const select = document.getElementById("pageSizeV6");
  select.value = String([12, 20, 32, 48].includes(pageSizeV6) ? pageSizeV6 : 20);
  pageSizeV6 = Number(select.value);
  select.addEventListener("change", () => {
    pageSizeV6 = Number(select.value);
    currentPageV6 = 1;
    localStorage.setItem(PAGE_SIZE_KEY_V6, String(pageSizeV6));
    renderGames();
  });
}

function resetDeckV6() {
  selectedGameV6 = null;
  deckElementsV6.cartridge.className = "deck-cartridge-v6 home-cartridge-v6";
  deckElementsV6.cartridge.innerHTML = '<span class="home-label-v6"><b>▣</b><strong>SAVE<br>SLOT</strong><small>GAME MANAGER</small></span>';
  deckElementsV6.kicker.textContent = "КРОСПЛАТФОРМНИЙ ПОШУКОВИЙ МЕНЕДЖЕР";
  deckElementsV6.title.textContent = "Знайди гру та збережи її у свій слот.";
  deckElementsV6.description.textContent = "Онлайн-каталог для ПК, консолей, портативних і ретро-систем. Картки з’являються лише після завантаження боксарту відповідної платформи.";
  deckElementsV6.meta.innerHTML = "<span>WIKIDATA</span><span>LIBRETRO BOXART</span><span>ЛОКАЛЬНІ СПИСКИ</span>";
  deckElementsV6.actions.hidden = true;
}

function updateDeckGameV6(game, impact = true) {
  selectedGameV6 = game;
  const platform = game.coverPlatform || game.recommendationPlatform?.label || visiblePlatformV5(game);
  deckElementsV6.cartridge.className = "deck-cartridge-v6 game-cartridge-v6";
  deckElementsV6.cartridge.innerHTML = `<img src="${escapeHtml(game.cover)}" alt="" /><span class="deck-cart-platform-v6">${escapeHtml(platform)}</span>`;
  deckElementsV6.kicker.textContent = "ВСТАВЛЕНО У СЛОТ";
  deckElementsV6.title.textContent = game.title;
  deckElementsV6.description.textContent = game.description || "Опис гри у відкритому каталозі відсутній.";
  const rating = game.rating ? `${game.rating.percent}% · ${formatNumber(game.rating.total)} відгуків` : "оцінка ще не доступна";
  deckElementsV6.meta.innerHTML = [game.year || "рік не вказано", platform, rating, game.genres?.[0]].filter(Boolean).map(value => `<span>${escapeHtml(value)}</span>`).join("");
  deckElementsV6.actions.hidden = false;
  deckElementsV6.save.textContent = findEntry(game.id) ? "ВИДАЛИТИ ЗІ СПИСКУ" : "ДОДАТИ ДО СПИСКУ";
  deckElementsV6.save.classList.toggle("danger", Boolean(findEntry(game.id)));
  deckElementsV6.source.href = game.wikidataUrl || game.steamUrl || "#";
  if (impact) {
    deckElementsV6.slotBay.classList.remove("slot-impact-v6");
    requestAnimationFrame(() => deckElementsV6.slotBay.classList.add("slot-impact-v6"));
  }
}

function animateCardToSlotV6(game) {
  const source = document.querySelector(`.game-card[data-id="${CSS.escape(game.id)}"] .cartridge`);
  const target = deckElementsV6.cartridge;
  if (!source || !target || state.settings.reduceMotion || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    updateDeckGameV6(game);
    return;
  }
  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const clone = source.cloneNode(true);
  clone.className = "flying-cartridge-v6";
  clone.querySelectorAll("button").forEach(button => button.remove());
  Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.append(clone);
  requestAnimationFrame(() => {
    clone.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height}) rotate(-2deg)`;
    clone.style.opacity = "0.72";
  });
  setTimeout(() => {
    clone.remove();
    updateDeckGameV6(game);
  }, 430);
}

const openGameDialogV6 = openGame;
openGame = function openGameInDeckV6(id) {
  const game = findCurrentGame(id);
  if (!game) return;
  animateCardToSlotV6(game);
};

function invalidThumbnailNameV6(value) {
  return String(value || "").replace(/[&*\/:`<>?\\|]/g, "_").replace(/\s+/g, " ").trim();
}

function libretroRepoV6(platformLabel) {
  return LIBRETRO_SYSTEMS_V6.find(([pattern]) => pattern.test(platformLabel || ""))?.[1] || null;
}

function preferredPlatformV6(game, requestedLabel = elements.platformFilter?.value) {
  if (requestedLabel && requestedLabel !== "all") {
    const exact = platformEntriesFor(game).find(entry => entry.label === requestedLabel);
    if (exact) return exact;
  }
  if (game.recommendationPlatform) return game.recommendationPlatform;
  const entries = platformEntriesFor(game);
  const withBoxart = entries.find(entry => libretroRepoV6(entry.label));
  return withBoxart || entries[0] || { id: null, label: game.platforms?.[0] || "Платформа не вказана" };
}

function libretroCandidatesV6(game, platform) {
  const repository = libretroRepoV6(platform?.label);
  if (!repository) return [];
  const rawTitle = String(game.title || "").replace(/[™®©]/g, "").trim();
  const alternate = rawTitle.replace(/:\s*/g, " - ");
  const names = unique([rawTitle, alternate]).flatMap(title => [
    title,
    `${title} (USA)`,
    `${title} (World)`,
    `${title} (Europe)`,
    `${title} (Japan)`,
    `${title} (USA, Europe)`
  ]);
  return names.map(name => ({
    url: `https://raw.githubusercontent.com/libretro-thumbnails/${repository}/master/Named_Boxarts/${encodeURIComponent(invalidThumbnailNameV6(name))}.png`,
    source: "Libretro",
    platform: platform.label
  }));
}

function coverCandidatesForGameV6(game, requestedPlatform) {
  const platform = preferredPlatformV6(game, requestedPlatform);
  const existing = unique([...(game.coverCandidates || []), game.cover, game.fallbackCover]).filter(Boolean);
  const pcLike = /windows|linux|macos|mac os|pc/i.test(platform.label || "");
  const candidates = [
    ...libretroCandidatesV6(game, platform),
    ...(pcLike && game.steamId ? [{ url: steamCover(game.steamId), source: "Steam", platform: platform.label }] : []),
    ...existing.map(url => ({ url, source: /steamstatic/.test(url) ? "Steam" : /wikimedia|wikipedia/.test(url) ? "Wikimedia" : "Відкрите джерело", platform: platform.label })),
    ...(!pcLike && game.steamId ? [{ url: steamCover(game.steamId), source: "Steam (резерв)", platform: platform.label }] : [])
  ];
  return [...new Map(candidates.map(item => [item.url, item])).values()].slice(0, 16);
}

function testImageV6(url, timeout = 9000) {
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
    image.onload = () => finish(image.naturalWidth >= 120 && image.naturalHeight >= 120);
    image.onerror = () => finish(false);
    image.referrerPolicy = "no-referrer";
    image.src = url;
  });
}

async function resolveCoverV6(game, requestedPlatform, generation) {
  game.coverReady = false;
  game.coverFailed = false;
  game.coverLoading = true;
  const candidates = coverCandidatesForGameV6(game, requestedPlatform);
  for (const candidate of candidates) {
    if (generation !== coverGenerationV6) return false;
    if (await testImageV6(candidate.url)) {
      game.cover = candidate.url;
      game.coverCandidates = candidates.map(item => item.url);
      game.coverReady = true;
      game.coverLoading = false;
      game.coverSource = candidate.source;
      game.coverPlatform = candidate.platform;
      return true;
    }
  }
  game.coverLoading = false;
  game.coverFailed = true;
  return false;
}

async function preloadCoversV6(games, requestedPlatform, generation) {
  const queue = [...games];
  coverProgressV6 = { active: true, total: queue.length, done: 0, ready: 0, failed: 0 };
  renderGames();
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length && generation === coverGenerationV6) {
      const game = queue.shift();
      const ready = await resolveCoverV6(game, requestedPlatform, generation);
      if (generation !== coverGenerationV6) return;
      coverProgressV6.done += 1;
      if (ready) coverProgressV6.ready += 1;
      else coverProgressV6.failed += 1;
      elements.loadingDetail.textContent = `Боксарт: ${coverProgressV6.done}/${coverProgressV6.total} · готово ${coverProgressV6.ready}`;
      scheduleRender();
    }
  });
  await Promise.all(workers);
  if (generation === coverGenerationV6) {
    coverProgressV6.active = false;
    renderGames();
  }
}

async function commitProgressiveResultsV6(games, { sequence, started, label, requestedPlatform = "all" }) {
  if (sequence !== searchSequence) return;
  currentResults = games;
  currentPageV6 = 1;
  for (const game of games) {
    game.coverReady = false;
    game.coverLoading = true;
    game.coverFailed = false;
  }
  populateFilters();
  if (requestedPlatform !== "all" && [...elements.platformFilter.options].some(option => option.value === requestedPlatform)) {
    elements.platformFilter.value = requestedPlatform;
  }
  renderGames();

  const generation = ++coverGenerationV6;
  setLoading(true, "ПІДВАНТАЖУЮ БОКСАРТ...", `Боксарт: 0/${games.length}`);
  setSourceState("loading", "БОКСАРТ 0%" );
  enrichRatingsV4(games, sequence, started, Math.min(12, games.length));
  await preloadCoversV6(games, requestedPlatform, generation);
  if (sequence !== searchSequence || generation !== coverGenerationV6) return;

  setLoading(false);
  const ready = games.filter(game => game.coverReady).length;
  setSourceState(ready ? "ready" : "error", ready ? "КАТАЛОГ ГОТОВИЙ" : "НЕМАЄ БОКСАРТУ");
  setFeedback(ready
    ? `${label}: ${ready} ігор із підтвердженим боксартом, завантажено за ${((performance.now() - started) / 1000).toFixed(1)} с.`
    : "Джерела повернули ігри, але не вдалося підтвердити жодного боксарту.", ready ? "success" : "error");
}

loadInitialGames = async function loadInitialGamesV6() {
  if (v6StartupRequested) return;
  v6StartupRequested = true;
  const sequence = ++searchSequence;
  const started = performance.now();
  currentQuery = "Початкова добірка";
  setLoading(true, "ШУКАЮ ІГРИ...", "Отримую стартову кросплатформну вибірку");
  setSourceState("loading", "ПОШУК");
  setFeedback("Пошук стартових ігор виконується...");
  try {
    const records = await fallbackInitialRecords((done, total) => {
      elements.loadingDetail.textContent = `Пошук метаданих: ${done}/${total}`;
    });
    if (sequence !== searchSequence) return;
    const games = await buildGames("", records);
    if (!games.length) throw new Error("Wikidata не повернула підтверджених відеоігор");
    await commitProgressiveResultsV6(games, { sequence, started, label: "Стартовий список" });
  } catch (error) {
    if (sequence !== searchSequence) return;
    setLoading(false);
    setSourceState("error", "ПОМИЛКА ДЖЕРЕЛА");
    setFeedback(`Не вдалося завантажити стартовий список: ${error.message}`, "error");
  }
};

searchGames = async function searchGamesV6(query) {
  const sequence = ++searchSequence;
  const started = performance.now();
  currentQuery = query;
  currentPageV6 = 1;
  coverGenerationV6 += 1;
  setLoading(true, "ШУКАЮ ІГРИ...", `Запит: ${query}`);
  setSourceState("loading", "ПОШУК");
  setFeedback(`Шукаю «${query}»...`);
  try {
    const [uk, en] = await Promise.allSettled([
      searchEntitiesV5(query, "uk", 30),
      searchEntitiesV5(query, "en", 30)
    ]);
    if (sequence !== searchSequence) return;
    const records = [...new Map([...(uk.value || []), ...(en.value || [])].map(item => [item.id, item])).values()];
    if (!records.length) throw new Error("Wikidata не повернула збігів");
    elements.loadingDetail.textContent = `Перевіряю ${Math.min(records.length, 48)} об’єктів`;
    const games = await buildGames(query, records);
    if (!games.length) throw new Error("Не знайдено підтверджених відеоігор");
    await commitProgressiveResultsV6(games, { sequence, started, label: `Пошук «${query}»`, requestedPlatform: elements.platformFilter.value });
  } catch (error) {
    if (sequence !== searchSequence) return;
    currentResults = [];
    renderGames();
    setLoading(false);
    setSourceState("error", "ПОМИЛКА ДЖЕРЕЛА");
    setFeedback(`Не вдалося виконати пошук: ${error.message}`, "error");
  }
};

function updatePaginationV6(total) {
  const nav = document.getElementById("paginationV6");
  if (!nav) return;
  const pages = Math.max(1, Math.ceil(total / pageSizeV6));
  currentPageV6 = clamp(currentPageV6, 1, pages);
  if (total <= pageSizeV6) {
    nav.replaceChildren();
    nav.hidden = true;
    return;
  }
  nav.hidden = false;
  const button = (label, page, disabled = false, current = false) => {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = label;
    node.disabled = disabled;
    node.className = current ? "current" : "";
    node.addEventListener("click", () => {
      currentPageV6 = page;
      renderGames();
      document.querySelector(".results-area")?.scrollIntoView({ behavior: state.settings.reduceMotion ? "auto" : "smooth", block: "start" });
    });
    return node;
  };
  const nodes = [button("←", currentPageV6 - 1, currentPageV6 === 1)];
  const start = Math.max(1, currentPageV6 - 2);
  const end = Math.min(pages, start + 4);
  for (let page = start; page <= end; page += 1) nodes.push(button(String(page), page, false, page === currentPageV6));
  nodes.push(button("→", currentPageV6 + 1, currentPageV6 === pages));
  const status = document.createElement("span");
  status.textContent = `${currentPageV6}/${pages}`;
  nodes.push(status);
  nav.replaceChildren(...nodes);
}

renderGames = function renderGamesV6() {
  const readyGames = filteredGames().filter(game => game.coverReady);
  const total = readyGames.length;
  const pages = Math.max(1, Math.ceil(total / pageSizeV6));
  currentPageV6 = clamp(currentPageV6, 1, pages);
  const start = (currentPageV6 - 1) * pageSizeV6;
  const pageGames = readyGames.slice(start, start + pageSizeV6);

  elements.gameGrid.replaceChildren();
  for (const game of pageGames) elements.gameGrid.append(renderGameCard(game));
  elements.emptyState.hidden = pageGames.length > 0 || coverProgressV6.active;
  if (!pageGames.length && !coverProgressV6.active) {
    elements.emptyState.innerHTML = currentQuery
      ? "<strong>За поточними фільтрами немає ігор із підтвердженим боксартом.</strong><span>Зміни платформу, фільтри або пошуковий запит.</span>"
      : "<strong>Тут з’являться ігри.</strong><span>Виконується завантаження онлайн-каталогу.</span>";
  }

  const metadataTotal = currentResults.length;
  const pending = currentResults.filter(game => game.coverLoading).length;
  const failed = currentResults.filter(game => game.coverFailed).length;
  elements.resultsTitle.textContent = total
    ? `Ігри ${start + 1}–${Math.min(start + pageSizeV6, total)} із ${total}`
    : coverProgressV6.active ? "Підвантажую боксарт" : "Ігор не знайдено";
  elements.resultsNote.textContent = `Метадані: ${metadataTotal} · боксарт готовий: ${total}${pending ? ` · завантажується: ${pending}` : ""}${failed ? ` · без боксарту: ${failed}` : ""}`;
  updatePaginationV6(total);
};

async function reloadPlatformCoversV6() {
  if (!currentResults.length) return;
  currentPageV6 = 1;
  const requested = elements.platformFilter.value;
  if (requested === "all") {
    renderGames();
    return;
  }
  const candidates = currentResults.filter(game => game.platforms.includes(requested));
  const stale = candidates.filter(game => game.coverPlatform !== requested || !game.coverReady);
  if (!stale.length) {
    renderGames();
    return;
  }
  const generation = ++coverGenerationV6;
  for (const game of stale) {
    game.coverReady = false;
    game.coverLoading = true;
    game.coverFailed = false;
  }
  setLoading(true, "ЗМІНЮЮ ПЛАТФОРМУ...", `Шукаю боксарт для ${requested}`);
  setSourceState("loading", "БОКСАРТ");
  await preloadCoversV6(stale, requested, generation);
  if (generation !== coverGenerationV6) return;
  setLoading(false);
  setSourceState("ready", "КАТАЛОГ ГОТОВИЙ");
  setFeedback(`Боксарт оновлено для платформи ${requested}.`, "success");
}

function attachV6Events() {
  const controls = [
    elements.platformFilter, elements.genreFilter, elements.yearFromFilter, elements.yearToFilter,
    elements.ratingFilter, elements.reviewsFilter, elements.ratedOnlyFilter,
    elements.hideSavedFilter, elements.sortSelect
  ];
  for (const control of controls) {
    const resetPage = () => { currentPageV6 = 1; };
    control.addEventListener("input", resetPage, { capture: true });
    control.addEventListener("change", resetPage, { capture: true });
  }
  elements.platformFilter.addEventListener("change", reloadPlatformCoversV6, { capture: true });
  deckElementsV6.details.addEventListener("click", () => {
    if (selectedGameV6) openGameDialogV6(selectedGameV6.id);
  });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && selectedGameV6 && !document.querySelector("dialog[open]")) resetDeckV6();
  });
}

async function initV6Enhancements() {
  await ensureV6Styles();
  patchHeaderV6();
  patchPaginationV6();
  attachV6Events();
  setTimeout(() => {
    if (!v6StartupRequested && !currentResults.length) loadInitialGames();
  }, 150);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

initV6Enhancements().catch(error => {
  console.error(error);
  setSourceState("error", "ПОМИЛКА ІНТЕРФЕЙСУ");
  setFeedback("Не вдалося запустити інтерфейс Save Slot 0.5.", "error");
});