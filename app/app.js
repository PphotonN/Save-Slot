(() => {
  'use strict';

  const KEYS = {
    cache: 'saveSlot.cache.v9',
    taxonomy: 'saveSlot.taxonomy.v1',
    collection: 'saveSlot.collection.v2',
    recent: 'saveSlot.recent.v4',
    settings: 'saveSlot.settings.v2'
  };

  const SEED_TITLES = [
    'The Legend of Zelda: Link\'s Awakening',
    'Vagrant Story',
    'Panzer Dragoon Saga',
    'Jet Set Radio',
    'Silent Hill 2',
    'Gravity Rush',
    'Hotel Dusk: Room 215',
    'The World Ends with You',
    'Ico',
    'Skies of Arcadia',
    'EarthBound',
    'Another World video game',
    'System Shock 2',
    'Klonoa: Door to Phantomile',
    'The Last Guardian',
    'Outer Wilds',
    'Metroid: Zero Mission',
    'Shin Megami Tensei: Strange Journey',
    'Chibi-Robo!',
    'Lost Odyssey',
    'Rule of Rose',
    'Terranigma',
    'Koudelka',
    'A Short Hike',
    'Ghost Trick: Phantom Detective',
    'Beyond the Labyrinth video game',
    'The Legend of Zelda: Majora\'s Mask',
    'Okami video game',
    'Rez video game',
    'Parasite Eve video game',
    'Chrono Trigger',
    'Chrono Cross',
    'Final Fantasy Tactics',
    'Final Fantasy IX',
    'Xenogears',
    'Xenoblade Chronicles',
    'Suikoden II',
    'Persona 4',
    'Persona 5',
    'Digital Devil Saga',
    'Demon’s Souls',
    'Dark Souls',
    'Bloodborne',
    'Sekiro: Shadows Die Twice',
    'Castlevania: Symphony of the Night',
    'Super Metroid',
    'Metroid Prime',
    'The Legend of Zelda: The Wind Waker',
    'The Legend of Zelda: Twilight Princess',
    'The Legend of Zelda: A Link to the Past',
    'The Legend of Zelda: The Minish Cap',
    'Mother 3',
    'Paper Mario: The Thousand-Year Door',
    'Super Mario Galaxy',
    'Super Mario Sunshine',
    'Donkey Kong Country 2',
    'Yoshi’s Island',
    'Kirby: Planet Robobot',
    'F-Zero GX',
    'Wave Race 64',
    'Ridge Racer Type 4',
    'Wipeout 3',
    'Burnout 3: Takedown',
    'Need for Speed: Underground 2',
    'Gran Turismo 4',
    'Forza Horizon',
    'Metal Gear Solid',
    'Metal Gear Solid 2: Sons of Liberty',
    'Metal Gear Solid 3: Snake Eater',
    'Splinter Cell: Chaos Theory',
    'Resident Evil 2',
    'Resident Evil 4',
    'Silent Hill',
    'Fatal Frame II: Crimson Butterfly',
    'Haunting Ground',
    'Clock Tower video game',
    'Dead Space',
    'Alien: Isolation',
    'BioShock',
    'Prey 2017 video game',
    'Deus Ex',
    'Thief II: The Metal Age',
    'Dishonored',
    'Half-Life 2',
    'Portal 2',
    'Mirror’s Edge',
    'Prince of Persia: The Sands of Time',
    'Beyond Good & Evil',
    'Psychonauts',
    'Sly 2: Band of Thieves',
    'Jak and Daxter: The Precursor Legacy',
    'Ratchet & Clank: Up Your Arsenal',
    'Viewtiful Joe',
    'God Hand video game',
    'Okage: Shadow King',
    'Radiata Stories',
    'Baten Kaitos: Eternal Wings and the Lost Ocean',
    'The Last Story',
    'Pandora’s Tower',
    'NieR video game',
    'NieR: Automata',
    '13 Sentinels: Aegis Rim',
    'Odin Sphere',
    'Muramasa: The Demon Blade',
    'Catherine video game',
    'Professor Layton and the Curious Village',
    'Ace Attorney: Phoenix Wright',
    '999: Nine Hours, Nine Persons, Nine Doors',
    'Zero Escape: Virtue’s Last Reward',
    'Danganronpa: Trigger Happy Havoc',
    'AI: The Somnium Files',
    'Return of the Obra Dinn',
    'Disco Elysium',
    'Pentiment',
    'Tunic video game',
    'Cocoon video game',
    'Inside video game',
    'Limbo video game',
    'Journey video game',
    'Abzû',
    'Gris video game',
    'Hollow Knight',
    'Celeste video game',
    'Fez video game',
    'Hyper Light Drifter',
    'Katana Zero',
    'Hotline Miami',
    'Transistor video game',
    'Bastion video game',
    'Hades video game',
    'Into the Breach',
    'FTL: Faster Than Light',
    'Slay the Spire',
    'Inscryption',
    'Balatro video game'
  ];

  const LIBRETRO_SYSTEMS = {
    'nintendo entertainment system': 'Nintendo - Nintendo Entertainment System',
    'nes': 'Nintendo - Nintendo Entertainment System',
    'super nintendo entertainment system': 'Nintendo - Super Nintendo Entertainment System',
    'super nintendo': 'Nintendo - Super Nintendo Entertainment System',
    'snes': 'Nintendo - Super Nintendo Entertainment System',
    'nintendo 64': 'Nintendo - Nintendo 64',
    'game boy': 'Nintendo - Game Boy',
    'game boy color': 'Nintendo - Game Boy Color',
    'game boy advance': 'Nintendo - Game Boy Advance',
    'nintendo ds': 'Nintendo - Nintendo DS',
    'nintendo dsi': 'Nintendo - Nintendo DS',
    'nintendo 3ds': 'Nintendo - Nintendo 3DS',
    'gamecube': 'Nintendo - GameCube',
    'nintendo gamecube': 'Nintendo - GameCube',
    'wii': 'Nintendo - Wii',
    'wii u': 'Nintendo - Wii U',
    'nintendo switch': 'Nintendo - Nintendo Switch',
    'playstation': 'Sony - PlayStation',
    'playstation 2': 'Sony - PlayStation 2',
    'playstation 3': 'Sony - PlayStation 3',
    'playstation 4': 'Sony - PlayStation 4',
    'playstation 5': 'Sony - PlayStation 5',
    'playstation portable': 'Sony - PlayStation Portable',
    'psp': 'Sony - PlayStation Portable',
    'playstation vita': 'Sony - PlayStation Vita',
    'xbox': 'Microsoft - Xbox',
    'xbox 360': 'Microsoft - Xbox 360',
    'xbox one': 'Microsoft - Xbox One',
    'mega drive': 'Sega - Mega Drive - Genesis',
    'sega genesis': 'Sega - Mega Drive - Genesis',
    'genesis': 'Sega - Mega Drive - Genesis',
    'sega saturn': 'Sega - Saturn',
    'saturn': 'Sega - Saturn',
    'dreamcast': 'Sega - Dreamcast',
    'game gear': 'Sega - Game Gear',
    'master system': 'Sega - Master System - Mark III',
    'pc engine': 'NEC - PC Engine - TurboGrafx 16',
    'turbografx-16': 'NEC - PC Engine - TurboGrafx 16',
    'neo geo': 'SNK - Neo Geo',
    'neo geo pocket': 'SNK - Neo Geo Pocket',
    'neo geo pocket color': 'SNK - Neo Geo Pocket Color',
    'atari 2600': 'Atari - 2600',
    'atari 7800': 'Atari - 7800',
    'atari lynx': 'Atari - Lynx',
    'atari jaguar': 'Atari - Jaguar',
    'jaguar': 'Atari - Jaguar',
    'virtual boy': 'Nintendo - Virtual Boy',
    'commodore 64': 'Commodore - 64',
    'amiga': 'Commodore - Amiga',
    'msx': 'Microsoft - MSX',
    'msx2': 'Microsoft - MSX2',
    'zx spectrum': 'Sinclair - ZX Spectrum',
    'dos': 'DOS',
    'arcade': 'MAME'
  };

  const PC_PLATFORM_TOKENS = ['windows','linux','macos','mac os','pc','steam deck'];
  const REGION_SUFFIXES = ['(USA)','(Europe)','(World)','(Japan)','(USA, Europe)'];

  const DEFAULT_PLATFORMS = [
    'Nintendo Entertainment System','Super Nintendo Entertainment System','Nintendo 64','Nintendo GameCube','Wii','Wii U','Nintendo Switch',
    'Game Boy','Game Boy Color','Game Boy Advance','Nintendo DS','Nintendo 3DS','Virtual Boy',
    'PlayStation','PlayStation 2','PlayStation 3','PlayStation 4','PlayStation 5','PlayStation Portable','PlayStation Vita',
    'Xbox','Xbox 360','Xbox One','Xbox Series X/S',
    'Sega Master System','Mega Drive','Sega Genesis','Sega Saturn','Dreamcast','Game Gear',
    'PC Engine','TurboGrafx-16','Neo Geo','Neo Geo Pocket Color','Atari 2600','Atari 7800','Atari Lynx','Jaguar',
    'Windows','Linux','macOS','DOS','Amiga','Commodore 64','ZX Spectrum','MSX','Arcade'
  ];

  const DEFAULT_GENRES = [
    'пригодницький бойовик','рольова відеогра','японська рольова гра','екшн','пригодницька гра','платформер','метроїдванія',
    'шутер від першої особи','шутер від третьої особи','тактичний шутер','стелс','виживання','survival horror','психологічний хорор',
    'головоломка','стратегія','стратегія в реальному часі','покрокова стратегія','тактична рольова гра','симулятор','автосимулятор',
    'перегони','файтинг','beat ’em up','hack and slash','ритм-гра','візуальна новела','інтерактивне кіно','пісочниця','відкритий світ',
    'roguelike','roguelite','карткова гра','настільна гра','спортивна гра','MMORPG','MOBA'
  ];

  const NEGATIVE_MEDIA_RETRY_MS = 90 * 1000;
  const PROVIDER_COOLDOWN_BASE_MS = 12000;
  const MEDIA_PREFETCH_CONCURRENCY = 3;

  const state = {
    activeScreen: 'discover',
    previousScreen: 'discover',
    rootScreen: 'discover',
    selectedGame: null,
    discoverGames: [],
    searchGames: [],
    query: '',
    collectionFilter: '',
    sources: { wikidata: 'idle', wikipedia: 'idle', libretro: 'idle', steam: 'idle', gog: 'idle', vndb: 'idle', pcgamingwiki: 'idle', wikimedia: 'idle' },
    galleryLoading: new Set(),
    searchAbort: 0,
    cache: readJson(KEYS.cache, { queries: {}, games: {}, lastUpdate: 0 }),
    taxonomy: readJson(KEYS.taxonomy, { platforms: DEFAULT_PLATFORMS, genres: DEFAULT_GENRES, updatedAt: 0 }),
    collection: readJson(KEYS.collection, {}),
    recent: readJson(KEYS.recent, []),
    settings: readJson(KEYS.settings, { haptics: true, reducedMotion: false }),
    transitionLock: false,
    discoverSeed: 0,
    discoverCycle: 0,
    discoverCursor: 0,
    discoverOrder: [],
    discoverLoading: false,
    discoverLoadingToken: null,
    discoverToken: 0,
    discoverSeenIds: new Set()
  };

  const $ = (id) => document.getElementById(id);
  const els = {};
  let renderer = null;
  let slotOperationQueue = Promise.resolve();
  let slotRecoveryPromise = null;
  const railRenderers = new Map();
  const railMotionCleanup = new WeakMap();
  let toastTimer = null;
  let searchTimer = null;
  let filterSearchTimer = null;
  const filterEntityCache = new Map();
  const vndbMediaCache = new Map();
  const gogCatalogCache = new Map();
  const providerHealth = new Map();
  const libretroTreeCache = new Map();
  const wikipediaLookupCache = new Map();
  const mediaPrefetchQueue = [];
  const mediaPrefetchQueued = new Set();
  const mediaPrefetchWaiters = new Map();
  const cardGameMap = new WeakMap();
  const titleRepairPromises = new Map();
  let mediaPrefetchActive = 0;
  let mediaObserver = null;
  let railVisibilityObserver = null;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    [
      'searchInput','clearSearch','searchHint','discoverRail','recentRail','discoverStatus','refreshDiscover','randomButton',
      'searchGrid','searchStatus','searchTitle','filterToggle','filters','platformFilter','yearFrom','yearTo','genreFilter','sortFilter','resetFilters',
      'detailContent','detailBack','collectionGrid','collectionEmpty','collectionFilters','notesList','notesEmpty',
      'wikidataState','wikipediaState','libretroState','steamState','gogState','vndbState','pcgamingwikiState','wikimediaState','lastUpdate','hapticsToggle','motionToggle','cacheSize',
      'clearCacheButton','clearPersonalButton','testHapticsButton','activeGameTitle','slotCanvas','slotStage'
    ].forEach(id => els[id] = $(id));

    normalizePersistedState();
    applySettingsToUi();
    repairStoredGameTitlesLocal();
    hydrateTaxonomyFromLocalData();
    populateFiltersFromTaxonomy();
    bindUi();
    replaceHistoryState({ screen: 'discover' });
    pushHistoryState({ screen: 'discover' });
    renderRecent();
    renderCollection();
    renderNotes();
    updateSettingsScreen();

    try {
      renderer = await SlotRenderer.create(els.slotCanvas, 'assets/model.json', makeFallbackCover());
      els.slotStage.classList.add('renderer-ready');
      setSlotEmptyState();
    } catch (error) {
      console.error('3D renderer failed', error);
      els.slotStage.classList.add('renderer-failed');
    }

    renderDiscover([]);
    startDiscover(false);
    repairStoredGameTitlesRemote();
  }

  function queueSlotOperation(operation) {
    const run = slotOperationQueue.catch(() => {}).then(operation);
    slotOperationQueue = run.catch(error => console.warn('slot operation', error));
    return run;
  }

  function slotRendererIsHealthy() {
    try {
      return !!(renderer && renderer.gl && !renderer.contextLost && !renderer.gl.isContextLost());
    } catch (_) {
      return false;
    }
  }

  async function recreateSlotRenderer() {
    const oldCanvas = els.slotCanvas;
    try { renderer?.destroy?.(); } catch (_) {}
    const canvas = document.createElement('canvas');
    canvas.id = 'slotCanvas';
    canvas.setAttribute('aria-label', 'Тривимірний картридж у слоті');
    oldCanvas?.replaceWith(canvas);
    els.slotCanvas = canvas;
    renderer = await SlotRenderer.create(canvas, 'assets/model.json', makeFallbackCover());
    els.slotStage?.classList.remove('render-lost', 'renderer-failed');
    els.slotStage?.classList.add('renderer-ready');
    return renderer;
  }

  async function ensureSlotRendererHealthy() {
    if (slotRendererIsHealthy()) return renderer;
    return recreateSlotRenderer();
  }

  function recoverSlotRendererAfterLoss(sourceRenderer) {
    if (sourceRenderer && renderer !== sourceRenderer) return Promise.resolve();
    if (slotRecoveryPromise) return slotRecoveryPromise;
    slotRecoveryPromise = queueSlotOperation(async () => {
      const active = await recreateSlotRenderer();
      if (state.activeScreen === 'detail' && state.selectedGame) {
        const game = state.selectedGame;
        const platform = getActivePlatform(game);
        const media = getMediaRecord(game, platform);
        const cover = media.boxart || game.boxart || game.cover || makeFallbackCover();
        setSlotFilledState(game.title);
        await active.insertGame(cover, true);
      } else {
        setSlotEmptyState();
      }
    }).finally(() => { slotRecoveryPromise = null; });
    return slotRecoveryPromise;
  }

  function bindUi() {
    document.querySelectorAll('[data-nav]').forEach(button => {
      button.addEventListener('click', () => showScreen(button.dataset.nav));
    });

    els.searchInput.addEventListener('input', () => {
      const value = els.searchInput.value.trim();
      els.clearSearch.style.visibility = value ? 'visible' : 'hidden';
      clearTimeout(searchTimer);
      if (!value) {
        els.searchHint.textContent = '';
        return;
      }
      els.searchHint.textContent = 'Пошук за назвами, альтернативними назвами та описами…';
      searchTimer = setTimeout(() => runSearch(value), 520);
    });
    els.searchInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        clearTimeout(searchTimer);
        const q = els.searchInput.value.trim();
        if (q) submitSearchFromKeyboard(q);
      }
    });
    els.clearSearch.addEventListener('click', () => {
      els.searchInput.value = '';
      els.searchHint.textContent = '';
      els.clearSearch.style.visibility = 'hidden';
      els.searchInput.focus();
    });

    els.refreshDiscover.addEventListener('click', () => startDiscover(true));
    els.randomButton.addEventListener('click', () => startDiscover(true));
    els.filterToggle.addEventListener('click', () => {
      els.filters.hidden = !els.filters.hidden;
      els.filterToggle.setAttribute('aria-expanded', String(!els.filters.hidden));
    });
    [els.platformFilter, els.yearFrom, els.yearTo, els.genreFilter].forEach(el => {
      el.addEventListener('input', scheduleSearchFromFilters);
      el.addEventListener('change', scheduleSearchFromFilters);
    });
    els.sortFilter.addEventListener('input', renderSearchResults);
    els.sortFilter.addEventListener('change', renderSearchResults);
    els.discoverRail.addEventListener('scroll', () => {
      const remaining = els.discoverRail.scrollWidth - els.discoverRail.scrollLeft - els.discoverRail.clientWidth;
      if (remaining < Math.max(180, els.discoverRail.clientWidth * 0.55)) loadMoreDiscover();
    }, { passive: true });
    els.resetFilters.addEventListener('click', () => {
      els.platformFilter.value = '';
      els.yearFrom.value = '';
      els.yearTo.value = '';
      els.genreFilter.value = '';
      els.sortFilter.value = 'relevance';
      scheduleSearchFromFilters();
    });
    els.detailBack.addEventListener('click', () => navigateBackInsideApp());

    els.slotStage.addEventListener('click', async () => {
      if (state.activeScreen !== 'detail' || !renderer?.hasCartridge) return;
      await ejectCurrentCartridge();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        railRenderers.forEach(rail => rail.pause());
        renderer?.pause?.();
      } else {
        railRenderers.forEach(rail => rail.resume());
        renderer?.resume?.();
        requestAnimationFrame(() => railRenderers.forEach(rail => rail.scheduleRender()));
      }
    });
    window.addEventListener('pageshow', () => {
      railRenderers.forEach(rail => rail.resume());
      renderer?.resume?.();
    });
    window.addEventListener('pagehide', () => {
      railRenderers.forEach(rail => rail.pause());
      renderer?.pause?.();
    });

    window.addEventListener('popstate', event => {
      const appState = event.state?.saveSlotState;
      if (!appState) return;
      applyHistoryState(appState);
    });

    els.collectionFilters.addEventListener('click', event => {
      const button = event.target.closest('button[data-status]');
      if (!button) return;
      state.collectionFilter = button.dataset.status;
      els.collectionFilters.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === button));
      renderCollection();
    });

    els.hapticsToggle.addEventListener('change', saveSettingsFromUi);
    els.motionToggle.addEventListener('change', saveSettingsFromUi);
    els.testHapticsButton?.addEventListener('click', () => {
      hapticInsertFeedback();
      toast(state.settings.haptics ? 'Хаптік-тест запущено' : 'Увімкни тактильний відгук вище');
    });
    els.clearCacheButton.addEventListener('click', () => {
      state.cache = { queries: {}, games: {}, lastUpdate: 0 };
      writeJson(KEYS.cache, state.cache);
      updateSettingsScreen();
      toast('Кеш метаданих очищено');
    });
    els.clearPersonalButton.addEventListener('click', () => {
      if (!confirm('Видалити всю колекцію та всі нотатки? Цю дію неможливо скасувати.')) return;
      state.collection = {};
      writeJson(KEYS.collection, state.collection);
      renderCollection();
      renderNotes();
      toast('Особисті дані видалено');
    });
  }

  function normalizePersistedState() {
    if (!state.cache || typeof state.cache !== 'object') state.cache = { queries:{}, games:{}, lastUpdate:0 };
    if (!state.cache.queries || typeof state.cache.queries !== 'object') state.cache.queries = {};
    if (!state.cache.games || typeof state.cache.games !== 'object') state.cache.games = {};
    if (!Number.isFinite(Number(state.cache.lastUpdate))) state.cache.lastUpdate = 0;
    if (!state.taxonomy || typeof state.taxonomy !== 'object') state.taxonomy = { platforms:[], genres:[], updatedAt:0 };
    if (!Array.isArray(state.taxonomy.platforms)) state.taxonomy.platforms = [];
    if (!Array.isArray(state.taxonomy.genres)) state.taxonomy.genres = [];
    if (!state.collection || typeof state.collection !== 'object' || Array.isArray(state.collection)) state.collection = {};
    for (const [id, entry] of Object.entries(state.collection)) {
      if (!entry || typeof entry !== 'object' || !entry.game || typeof entry.game !== 'object') { delete state.collection[id]; continue; }
      hydrateGameRecord(entry.game);
      if (!Array.isArray(entry.notes)) entry.notes = [];
      entry.notes = entry.notes.filter(note => note && typeof note === 'object' && String(note.body || '').trim()).slice(0, 200);
      entry.rating = entry.rating === null || entry.rating === '' || !Number.isFinite(Number(entry.rating)) ? null : Math.max(0, Math.min(10, Number(entry.rating)));
    }
    if (!Array.isArray(state.recent)) state.recent = [];
    state.recent = uniqueById(state.recent.filter(item => item && typeof item === 'object' && item.id)).slice(0, 24);
    state.recent.forEach(hydrateGameRecord);
    if (!state.settings || typeof state.settings !== 'object') state.settings = {};
    state.settings = {
      haptics: state.settings.haptics !== false,
      reducedMotion: !!state.settings.reducedMotion
    };
    for (const [id, game] of Object.entries(state.cache.games)) {
      if (!game || typeof game !== 'object') { delete state.cache.games[id]; continue; }
      hydrateGameRecord(game);
    }
    trimCache();
    writeJson(KEYS.cache, state.cache);
    writeJson(KEYS.recent, state.recent);
    writeJson(KEYS.collection, state.collection);
    writeJson(KEYS.taxonomy, state.taxonomy);
    writeJson(KEYS.settings, state.settings);
  }

  function getRailVisibilityObserver() {
    if (railVisibilityObserver || typeof IntersectionObserver === 'undefined') return railVisibilityObserver;
    railVisibilityObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const rail = railRenderers.get(entry.target);
        if (!rail) continue;
        rail.setViewportVisible(entry.isIntersecting && entry.intersectionRatio > 0.01);
      }
    }, { root:null, rootMargin:'140px 0px', threshold:[0,0.01,0.15] });
    return railVisibilityObserver;
  }

  function observeRailVisibility(rail) {
    if (!rail?.container) return;
    const observer = getRailVisibilityObserver();
    if (observer) observer.observe(rail.container);
    else rail.setViewportVisible(true);
  }

  function applySettingsToUi() {
    if (!els.hapticsToggle) return;
    els.hapticsToggle.checked = state.settings.haptics !== false;
    els.motionToggle.checked = !!state.settings.reducedMotion;
  }

  function saveSettingsFromUi() {
    state.settings = {
      haptics: els.hapticsToggle.checked,
      reducedMotion: els.motionToggle.checked
    };
    writeJson(KEYS.settings, state.settings);
  }

  function buildHistoryState(screen = state.activeScreen, game = state.selectedGame) {
    const root = screen === 'detail' ? (state.rootScreen || state.previousScreen || 'discover') : screen;
    const payload = { screen, root };
    if (screen === 'detail' && game?.id) payload.gameId = game.id;
    return payload;
  }

  function replaceHistoryState(payload) {
    try { history.replaceState({ saveSlotState: payload }, '', `#${payload.screen}`); } catch (_) {}
  }

  function pushHistoryState(payload) {
    try { history.pushState({ saveSlotState: payload }, '', `#${payload.screen}`); } catch (_) {}
  }

  function applyHistoryState(payload) {
    if (!payload) return;
    if (payload.screen === 'detail') {
      const game = state.cache.games[payload.gameId]
        || state.discoverGames.find(g => g.id === payload.gameId)
        || state.searchGames.find(g => g.id === payload.gameId)
        || state.selectedGame;
      if (game) showDetail(game, payload.root || state.rootScreen || 'discover', false);
      return;
    }
    state.rootScreen = payload.root || payload.screen || 'discover';
    showScreen(state.rootScreen, false);
  }

  function navigateBackInsideApp() {
    if (state.activeScreen === 'detail') {
      if (history.state?.saveSlotState?.screen === 'detail' && history.length > 1) history.back();
      else returnToRootScreen();
      return;
    }
    showScreen(state.rootScreen || 'discover', false);
  }

  function returnToRootScreen() {
    const root = state.rootScreen || state.previousScreen || 'discover';
    showScreen(root, false);
    replaceHistoryState(buildHistoryState(root));
  }

  async function ejectCurrentCartridge() {
    await queueSlotOperation(async () => {
      if (renderer?.hasCartridge) await ejectRendererWithFeedback();
      setSlotEmptyState();
    });
    if (state.activeScreen === 'detail' && history.state?.saveSlotState?.screen === 'detail' && history.length > 1) history.back();
    else returnToRootScreen();
  }

  function setSlotEmptyState() {
    els.slotStage?.classList.add('empty');
    if (els.activeGameTitle) els.activeGameTitle.textContent = 'NO GAME';
  }

  function setSlotFilledState(title) {
    els.slotStage?.classList.remove('empty');
    if (els.activeGameTitle) els.activeGameTitle.textContent = title || 'NO GAME';
  }

  async function launchGameFromCard(game, from, card) {
    if (!game || state.transitionLock) return;
    state.transitionLock = true;
    try {
      hydrateGameRecord(game);
      await ensureGameTitle(game);
      const platform = getActivePlatform(game);
      const media = getMediaRecord(game, platform);
      const currentCover = card?.dataset.cover || media.boxart || game.boxart || game.cover || makeFallbackCover();
      const flew = card && !state.settings.reducedMotion ? await animateCardToSlot(card, currentCover) : false;
      await showDetail(game, from, true, currentCover, flew);
    } finally {
      state.transitionLock = false;
    }
  }

  async function animateCardToSlot(card, coverUrl) {
    const source = card.querySelector('.card-viewport');
    const stage = els.slotStage;
    if (!source || !stage) return false;
    const start = source.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    if (!start.width || !start.height) return false;

    const parent = card.closest('.game-rail');
    const rail = parent ? railRenderers.get(parent) : null;
    const snapshot = rail?.captureItem?.(card.dataset.id) || null;
    if (!snapshot) return false;

    rail?.setHidden(card.dataset.id, true);
    stage.classList.add('receiving');
    const flyer = document.createElement('img');
    flyer.className = 'flight-snapshot';
    flyer.alt = '';
    flyer.src = snapshot;
    flyer.style.left = `${start.left}px`;
    flyer.style.top = `${start.top}px`;
    flyer.style.width = `${start.width}px`;
    flyer.style.height = `${start.height}px`;
    document.body.appendChild(flyer);

    try {
      const targetWidth = Math.min(stageRect.width * .34, start.width * 1.58);
      const targetHeight = targetWidth / .70;
      const dx = stageRect.left + stageRect.width * .5 - targetWidth * .5 - start.left;
      const dy = stageRect.top + stageRect.height * .15 - start.top;
      const sx = targetWidth / start.width;
      const sy = targetHeight / start.height;
      const animation = flyer.animate([
        { transform:'translate3d(0,0,0) scale(1) rotate(0deg)', opacity:1, filter:'drop-shadow(0 12px 16px rgba(0,0,0,.30))' },
        { transform:`translate3d(${dx*.48}px,${dy*.18-92}px,0) scale(${1+(sx-1)*.45},${1+(sy-1)*.45}) rotate(-6deg)`, opacity:1, offset:.56, filter:'drop-shadow(0 24px 24px rgba(0,0,0,.34))' },
        { transform:`translate3d(${dx}px,${dy}px,0) scale(${sx},${sy}) rotate(0deg)`, opacity:1, filter:'drop-shadow(0 8px 10px rgba(0,0,0,.22))' }
      ], { duration:680, easing:'cubic-bezier(.18,.82,.22,1)', fill:'forwards' });
      await animation.finished;
      return true;
    } catch (error) {
      console.warn('3D snapshot flight failed', error);
      return false;
    } finally {
      flyer.remove();
      stage.classList.remove('receiving');
      rail?.setHidden(card.dataset.id, false);
    }
  }

  function showScreen(name, updateHistory = true) {
    if (name === 'detail') return;
    const root = name || 'discover';
    const leavingDetail = state.activeScreen === 'detail';
    state.rootScreen = root;
    state.previousScreen = root;
    state.activeScreen = root;
    document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('active', screen.dataset.screen === root));
    document.querySelectorAll('[data-nav]').forEach(button => button.classList.toggle('active', button.dataset.nav === root));
    if (root === 'collection') renderCollection();
    if (root === 'notes') renderNotes();
    if (root === 'settings') updateSettingsScreen();
    if (leavingDetail) {
      queueSlotOperation(async () => {
        if (renderer?.hasCartridge) await ejectRendererWithFeedback();
        if (state.activeScreen !== 'detail') setSlotEmptyState();
      });
    }
    requestAnimationFrame(() => railRenderers.forEach(rail => rail.scheduleRender()));
    if (updateHistory) replaceHistoryState(buildHistoryState(root));
    window.scrollTo({ top: 0, behavior: state.settings.reducedMotion ? 'auto' : 'smooth' });
  }

  async function showDetail(game, from = state.activeScreen, pushState = true, preparedCover = null, fromFlight = false) {
    if (!game) return;
    const origin = from === 'detail' ? (state.rootScreen || state.previousScreen || 'discover') : (from || state.rootScreen || 'discover');
    const platform = getActivePlatform(game);
    const initialMedia = getMediaRecord(game, platform);
    const cover = preparedCover || initialMedia.boxart || game.boxart || game.cover || makeFallbackCover();

    state.rootScreen = origin;
    state.previousScreen = origin;
    state.activeScreen = 'detail';
    state.selectedGame = game;
    document.querySelectorAll('.screen').forEach(screen => screen.classList.toggle('active', screen.dataset.screen === 'detail'));
    document.querySelectorAll('[data-nav]').forEach(button => button.classList.remove('active'));
    rememberRecent(game);
    renderDetail(game);
    if (pushState) {
      const payload = buildHistoryState('detail', game);
      if (history.state?.saveSlotState?.screen === 'detail') replaceHistoryState(payload);
      else pushHistoryState(payload);
    }
    window.scrollTo({ top: 0, behavior: state.settings.reducedMotion ? 'auto' : 'smooth' });

    await queueSlotOperation(async () => {
      if (state.selectedGame?.id !== game.id || state.activeScreen !== 'detail') return;
      const activeRenderer = await ensureSlotRendererHealthy();
      if (activeRenderer?.hasCartridge) await ejectRendererWithFeedback();
      if (state.selectedGame?.id !== game.id || state.activeScreen !== 'detail') return;
      setSlotFilledState(game.title);
      if (fromFlight) await activeRenderer.insertFromFlight(cover, state.settings.reducedMotion);
      else await activeRenderer.insertGame(cover, state.settings.reducedMotion);
      if (state.selectedGame?.id !== game.id || state.activeScreen !== 'detail') return;
      hapticInsertFeedback();
      els.slotStage.classList.add('impact');
      setTimeout(() => els.slotStage.classList.remove('impact'), 260);
    }).catch(error => {
      console.error('slot insertion failed', error);
      recoverSlotRendererAfterLoss(renderer);
    });

    ensurePlatformMedia(game, platform, false).then(async media => {
      if (!media || state.selectedGame?.id !== game.id || getActivePlatform(game) !== platform) return;
      if (media.boxart && media.boxart !== cover && renderer?.hasCartridge && slotRendererIsHealthy()) await renderer.setCover(media.boxart);
      renderDetail(game);
    }).catch(error => console.warn('media update', error));
    loadGalleryForGame(game, platform);
  }

  async function switchGamePlatform(game, platform) {
    if (!game || !platform || platform === getActivePlatform(game)) return;
    game.selectedPlatform = platform;
    applyMediaRecord(game, platform);
    renderDetail(game);
    const media = await ensurePlatformMedia(game, platform, true);
    if (state.selectedGame?.id !== game.id || getActivePlatform(game) !== platform) return;
    if (renderer?.hasCartridge) await renderer.setCover(media?.boxart || makeFallbackCover());
    const entry = state.collection[game.id];
    if (entry && !entry.playedOn) entry.playedOn = platform;
    cacheGame(game);
    writeJson(KEYS.cache,state.cache);
    renderDetail(game);
  }

  function hapticInsertFeedback() {
    if (!state.settings.haptics) return;
    try {
      if (window.SaveSlotNative?.insert) {
        window.SaveSlotNative.insert();
        return;
      }
    } catch (_) {}
    if (!navigator.vibrate) return;
    try { navigator.vibrate(state.settings.reducedMotion ? [0, 10, 24, 15] : [0, 11, 38, 18]); } catch (_) {}
  }

  function hapticEjectFeedback() {
    if (!state.settings.haptics) return;
    try {
      if (window.SaveSlotNative?.eject) {
        window.SaveSlotNative.eject();
        return;
      }
    } catch (_) {}
    if (!navigator.vibrate) return;
    try { navigator.vibrate(13); } catch (_) {}
  }

  async function ejectRendererWithFeedback() {
    if (!renderer?.hasCartridge) return false;
    if (!slotRendererIsHealthy()) { renderer.hasCartridge = false; return false; }
    await renderer.ejectGame(state.settings.reducedMotion);
    hapticEjectFeedback();
    return true;
  }

  function randomSessionSeed() {
    try {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] || Date.now();
    } catch (_) {
      return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    }
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(values, seed) {
    const output = [...values];
    const random = seededRandom(seed);
    for (let index = output.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1));
      [output[index], output[swap]] = [output[swap], output[index]];
    }
    return output;
  }

  function resetDiscoverSession() {
    state.discoverSeed = randomSessionSeed();
    state.discoverLoading = false;
    state.discoverLoadingToken = null;
    state.discoverCycle = 0;
    state.discoverCursor = 0;
    state.discoverOrder = seededShuffle(SEED_TITLES, state.discoverSeed);
    state.discoverSeenIds = new Set((state.recent || []).map(game => game.id).filter(Boolean));
    state.discoverGames = [];
    state.discoverToken++;
    renderDiscover([]);
  }

  async function startDiscover(force) {
    if (force || !state.discoverOrder.length) resetDiscoverSession();
    els.discoverStatus.textContent = 'Завантаження випадкових ігор з різних поколінь…';
    await loadMoreDiscover(true);
  }

  async function loadMoreDiscover(initial = false) {
    const token = state.discoverToken;
    if (state.discoverLoading && state.discoverLoadingToken === token) return;
    state.discoverLoading = true;
    state.discoverLoadingToken = token;
    setDiscoverLoader(true);
    try {
      const targetCount = initial ? 8 : 6;
      let added = 0;
      let attempts = 0;
      const maxAttempts = initial ? 48 : 32;
      while (added < targetCount && attempts < maxAttempts) {
        if (token !== state.discoverToken) return;
        if (state.discoverCursor >= state.discoverOrder.length) {
          state.discoverCycle++;
          state.discoverCursor = 0;
          state.discoverOrder = seededShuffle(SEED_TITLES, (state.discoverSeed + state.discoverCycle * 2654435761) >>> 0);
        }
        const batchSize = initial ? 4 : 3;
        const batchTitles = state.discoverOrder.slice(state.discoverCursor, state.discoverCursor + batchSize);
        state.discoverCursor += batchTitles.length;
        attempts += batchTitles.length;
        const batches = await Promise.all(batchTitles.map(title => searchGames(title, { limit: 3, cache: true, lightweight: true }).catch(() => [])));
        for (const list of batches) {
          const game = list.find(item => item && !state.discoverSeenIds.has(item.id));
          if (!game) continue;
          state.discoverSeenIds.add(game.id);
          state.discoverGames.push(game);
          added++;
        }
        if (added) {
          updateTaxonomyFromGames(state.discoverGames);
          renderDiscover(state.discoverGames);
          els.discoverStatus.textContent = `${state.discoverGames.length} реальних ігор у добірці`;
        }
      }
      if (added < targetCount) {
        const cachedPool = seededShuffle(Object.values(state.cache.games || {}).filter(game => game && game.id && !state.discoverSeenIds.has(game.id)), (state.discoverSeed ^ state.discoverCursor ^ Date.now()) >>> 0);
        for (const game of cachedPool) {
          if (added >= targetCount) break;
          hydrateGameRecord(game);
          state.discoverSeenIds.add(game.id);
          state.discoverGames.push(game);
          added++;
        }
        if (cachedPool.length) renderDiscover(state.discoverGames);
      }
      if (!state.discoverGames.length) {
        els.discoverStatus.textContent = 'Не вдалося завантажити добірку. Перевір підключення або повтори спробу.';
      } else {
        els.discoverStatus.textContent = `${state.discoverGames.length} ігор у добірці`;
      }
      updateSettingsScreen();
      requestAnimationFrame(() => {
        const remaining = els.discoverRail.scrollWidth - els.discoverRail.scrollLeft - els.discoverRail.clientWidth;
        if (remaining < 120 && state.discoverGames.length && !state.discoverLoading) loadMoreDiscover();
      });
    } finally {
      if (state.discoverLoadingToken === token) {
        state.discoverLoading = false;
        state.discoverLoadingToken = null;
        setDiscoverLoader(false);
      }
    }
  }

  function currentSearchFilters() {
    let yearFrom = Math.max(0, Math.min(2100, Number(els.yearFrom?.value) || 0));
    let yearTo = Math.max(0, Math.min(2100, Number(els.yearTo?.value) || 0));
    if (yearFrom && yearTo && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
    return {
      platform: els.platformFilter?.value || '',
      genre: els.genreFilter?.value || '',
      yearFrom,
      yearTo
    };
  }

  function hasSearchFilters(filters = currentSearchFilters()) {
    return !!(filters.platform || filters.genre || filters.yearFrom || filters.yearTo);
  }

  function scheduleSearchFromFilters() {
    clearTimeout(filterSearchTimer);
    renderSearchResults();
    filterSearchTimer = setTimeout(() => {
      const query = els.searchInput.value.trim();
      const filters = currentSearchFilters();
      if (!query && !hasSearchFilters(filters)) {
        state.searchGames = [];
        els.searchStatus.textContent = 'Введи назву гри або обери фільтри.';
        els.searchGrid.innerHTML = '';
        return;
      }
      runSearch(query, { filtersChanged: true, scrollToResults: false });
    }, 420);
  }

  async function runSearch(query = '', options = {}) {
    state.query = query.trim();
    const filters = currentSearchFilters();
    showScreen('search');
    if (options.scrollToResults) scrollToSearchResults();
    const filterLabel = [filters.platform, filters.genre].filter(Boolean).join(' · ');
    els.searchTitle.textContent = state.query ? `«${state.query}»${filterLabel ? ` · ${filterLabel}` : ''}` : (filterLabel || 'Пошук за фільтрами');
    els.searchStatus.textContent = 'Шукаю ігри за запитом і вибраними фільтрами…';
    els.searchGrid.innerHTML = skeletonCards(6);
    const token = ++state.searchAbort;
    try {
      const games = await searchGamesWithFilters(state.query, filters, 28);
      if (token !== state.searchAbort) return;
      state.searchGames = games;
      updateTaxonomyFromGames(games);
      populateFiltersFromTaxonomy();
      renderSearchResults();
      els.searchHint.textContent = games.length ? `Знайдено: ${games.length}` : 'Точних результатів не знайдено';
    } catch (error) {
      if (token !== state.searchAbort) return;
      console.error(error);
      state.searchGames = [];
      els.searchGrid.innerHTML = '';
      els.searchStatus.textContent = 'Не вдалося отримати дані. Перевір підключення та спробуй ще раз.';
      setSourceState('wikidata','error');
      setSourceState('wikipedia','error');
    }
  }

  async function searchGamesWithFilters(query, filters, limit = 28) {
    const pools = [];
    if (query) {
      pools.push(await searchGames(query, { limit, cache: true }));
      const supplements = [];
      if (filters.platform) supplements.push(`${query} ${filters.platform}`);
      if (filters.genre) supplements.push(`${query} ${filters.genre}`);
      if (filters.platform && filters.genre) supplements.push(`${query} ${filters.platform} ${filters.genre}`);
      const extra = await Promise.all(unique(supplements).slice(0, 3).map(value => searchGames(value, { limit: 12, cache: true, lightweight: true }).catch(() => [])));
      pools.push(...extra);
    } else if (hasSearchFilters(filters)) {
      pools.push(await searchGamesByFilters(filters, limit));
    }
    const merged = rankAndDedupeGames(pools.flat(), query || [filters.platform, filters.genre].filter(Boolean).join(' '));
    return merged.slice(0, limit);
  }

  async function resolveFilterEntityId(label, kind) {
    if (!label) return null;
    const cacheKey = `${kind}|${normalizeLoose(label)}`;
    if (filterEntityCache.has(cacheKey)) return filterEntityCache.get(cacheKey);
    const promise = (async () => {
      const results = [];
      for (const language of ['uk','en']) {
        try { results.push(...await wikidataSearch(label, language, 10)); } catch (_) {}
      }
      const target = normalizeLoose(label);
      const ranked = uniqueById(results).map(item => {
        const name = normalizeLoose(item.label || '');
        const description = normalizeLoose(item.description || '');
        let score = name === target ? 100 : 0;
        if (name.includes(target) || target.includes(name)) score += 40;
        if (kind === 'platform' && /(video game console|gaming platform|home video game console|handheld game console|ігрова консоль|платформа)/i.test(description)) score += 35;
        if (kind === 'genre' && /(video game genre|genre of video game|жанр відеоігор|жанр відеогри)/i.test(description)) score += 35;
        return { item, score };
      }).sort((a,b) => b.score - a.score);
      return ranked[0]?.score >= 35 ? ranked[0].item.id : null;
    })();
    filterEntityCache.set(cacheKey, promise);
    return promise;
  }

  async function searchGamesByFilters(filters, limit = 28) {
    const [platformId, genreId] = await Promise.all([
      resolveFilterEntityId(filters.platform, 'platform'),
      resolveFilterEntityId(filters.genre, 'genre')
    ]);
    const clauses = ['?game wdt:P31/wdt:P279* wd:Q7889 .'];
    if (platformId) clauses.push(`?game wdt:P400 wd:${platformId} .`);
    if (genreId) clauses.push(`?game wdt:P136/wdt:P279* wd:${genreId} .`);
    if (filters.yearFrom || filters.yearTo) {
      clauses.push('?game wdt:P577 ?releaseDate .');
      if (filters.yearFrom) clauses.push(`FILTER(YEAR(?releaseDate) >= ${filters.yearFrom})`);
      if (filters.yearTo) clauses.push(`FILTER(YEAR(?releaseDate) <= ${filters.yearTo})`);
    }
    const query = `SELECT DISTINCT ?game WHERE { ${clauses.join(' ')} } LIMIT ${Math.min(50, limit + 12)}`;
    setSourceState('wikidata','loading');
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    const data = await fetchJson(url, 10000);
    const ids = unique((data.results?.bindings || []).map(row => row.game?.value?.match(/Q\d+$/)?.[0]).filter(Boolean)).slice(0, 50);
    if (!ids.length) {
      const fallbackQuery = [filters.platform, filters.genre, 'video game'].filter(Boolean).join(' ');
      return fallbackQuery ? searchGames(fallbackQuery, { limit, cache: true, lightweight: true }) : [];
    }
    setSourceState('wikidata','online');
    const entities = await getEntities(ids);
    const gameEntities = Object.values(entities).filter(entity => isLikelyGame(entity, null));
    const dependencyIds = unique(gameEntities.flatMap(entity => ['P400','P136','P178','P123','P179'].flatMap(prop => claimEntityIds(entity,prop))));
    const labels = dependencyIds.length ? await getLabels(dependencyIds) : {};
    let games = gameEntities.map(entity => entityToGame(entity, labels, null)).filter(Boolean);
    games = await mapLimit(games.slice(0, limit), 4, async game => enrichFromWikipedia(game, true));
    games = await mapLimit(games.filter(Boolean), 4, finalizeArtFields);
    games.forEach(cacheGame);
    state.cache.lastUpdate = Date.now();
    trimCache();
    writeJson(KEYS.cache, state.cache);
    return games;
  }

  function setDiscoverLoader(visible) {
    if (!els.discoverRail) return;
    let loader = els.discoverRail.querySelector('.discover-load-card');
    if (!visible) {
      loader?.remove();
      refreshRailRenderer(els.discoverRail, false);
      return;
    }
    if (loader) {
      els.discoverRail.appendChild(loader);
      refreshRailRenderer(els.discoverRail, false);
      return;
    }
    loader = document.createElement('div');
    loader.className = 'discover-load-card';
    loader.setAttribute('aria-label', 'Завантаження наступних ігор');
    loader.innerHTML = `
      <span class="discover-loader-viewport">
        <span class="rail-placeholder loader-placeholder" aria-hidden="true"><i></i></span>
      </span>
      <strong>Ще ігри</strong>
      <small>Завантаження…</small>`;
    els.discoverRail.appendChild(loader);
    refreshRailRenderer(els.discoverRail, false);
  }

  function renderDiscover(games) {
    const existingIds = Array.from(els.discoverRail.querySelectorAll('.game-card')).map(card => card.dataset.id);
    const nextIds = games.map(game => game.id);
    const canAppend = existingIds.length > 0 && existingIds.length < nextIds.length && existingIds.every((id, index) => id === nextIds[index]);
    state.discoverGames = games;
    if (canAppend) appendCardsInto(els.discoverRail, games.slice(existingIds.length), 'discover');
    else renderCardsInto(els.discoverRail, games, 'discover');
    if (state.discoverLoading) setDiscoverLoader(true);
  }

  function renderSearchResults() {
    let games = [...state.searchGames];
    const platform = els.platformFilter.value;
    const genre = els.genreFilter.value;
    const from = Number(els.yearFrom.value) || 0;
    const to = Number(els.yearTo.value) || 9999;
    if (platform) games = games.filter(g => platformListsMatch(g.platforms, platform));
    if (genre) games = games.filter(g => (g.genres || []).some(value => normalizeLoose(value) === normalizeLoose(genre)));
    games = games.filter(g => !g.year || (g.year >= from && g.year <= to));
    switch (els.sortFilter.value) {
      case 'yearDesc': games.sort((a,b) => (b.year||0)-(a.year||0)); break;
      case 'yearAsc': games.sort((a,b) => (a.year||9999)-(b.year||9999)); break;
      case 'title': games.sort((a,b) => a.title.localeCompare(b.title,'uk')); break;
    }
    els.searchStatus.textContent = games.length ? `${games.length} результатів` : 'Немає результатів для обраних фільтрів.';
    renderCardsInto(els.searchGrid, games, 'search');
  }

  function submitSearchFromKeyboard(query) {
    hideSoftKeyboard();
    runSearch(query, { scrollToResults: true });
  }

  function hideSoftKeyboard() {
    try {
      els.searchInput.blur();
      if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
    } catch (_) {}
  }

  function scrollToSearchResults() {
    requestAnimationFrame(() => {
      const screen = document.getElementById('searchScreen');
      if (!screen) return;
      const top = Math.max(0, screen.getBoundingClientRect().top + window.scrollY - 8);
      window.scrollTo({ top, behavior: state.settings.reducedMotion ? 'auto' : 'smooth' });
    });
  }

  function hydrateTaxonomyFromLocalData() {
    const cachedGames = Object.values(state.cache.games || {});
    const collectionGames = Object.values(state.collection || {}).map(entry => entry.game).filter(Boolean);
    updateTaxonomyFromGames([...cachedGames, ...collectionGames], false);
  }

  function updateTaxonomyFromGames(games, persist = true) {
    const currentPlatforms = Array.isArray(state.taxonomy?.platforms) ? state.taxonomy.platforms : [];
    const currentGenres = Array.isArray(state.taxonomy?.genres) ? state.taxonomy.genres : [];
    const platforms = unique([...DEFAULT_PLATFORMS, ...currentPlatforms, ...(games || []).flatMap(game => sanitizeNamedList(game?.platforms || [], 'platform'))]).sort(localeSort);
    const genres = unique([...DEFAULT_GENRES, ...currentGenres, ...(games || []).flatMap(game => sanitizeNamedList(game?.genres || []))]).sort(localeSort);
    state.taxonomy = { platforms, genres, updatedAt: Date.now() };
    if (persist) writeJson(KEYS.taxonomy, state.taxonomy);
  }

  function populateFiltersFromTaxonomy() {
    if (!els.platformFilter || !els.genreFilter) return;
    const selectedPlatform = els.platformFilter.value;
    const selectedGenre = els.genreFilter.value;
    const platforms = unique([...(state.taxonomy?.platforms || []), ...DEFAULT_PLATFORMS]).sort(localeSort);
    const genres = unique([...(state.taxonomy?.genres || []), ...DEFAULT_GENRES]).sort(localeSort);
    els.platformFilter.innerHTML = '<option value="">Усі</option>' + platforms.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join('');
    els.genreFilter.innerHTML = '<option value="">Усі</option>' + genres.map(value => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join('');
    if (platforms.includes(selectedPlatform)) els.platformFilter.value = selectedPlatform;
    if (genres.includes(selectedGenre)) els.genreFilter.value = selectedGenre;
  }

  function buildGameCard(game, from, small=false, index=0, live=false) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `game-card${small ? ' small-card' : ''}${live ? ' live-3d-card' : ' static-card'}`;
    card.dataset.id = game.id;
    hydrateGameRecord(game);
    const platform = getActivePlatform(game);
    const media = getMediaRecord(game, platform);
    const verifiedCover = media.boxart || game.boxart || null;
    const provisionalCover = verifiedCover ? null : (game.cover || null);
    const cover = verifiedCover || provisionalCover || makeFallbackCover();
    card.dataset.cover = cover;
    card.dataset.hasCover = verifiedCover ? '1' : '0';
    if (provisionalCover) card.classList.add('media-provisional');
    card.style.setProperty('--float-delay', `${(index % 5) * -0.45}s`);
    const visual = live
      ? `<span class="rail-placeholder" aria-hidden="true"><i></i></span>`
      : `<img class="card-render-img" alt="Обкладинка ${escapeHtml(game.title)}" loading="lazy">`;
    card.innerHTML = `
      <span class="cover-shell live-cartridge-shell">
        <span class="card-viewport" aria-hidden="true">
          ${visual}
          <span class="media-search-label"><i></i><b>${provisionalCover ? 'Уточнюю обкладинку' : 'Шукаю обкладинку'}</b></span>
        </span>
        ${platform ? `<span class="platform-badge">${escapeHtml(platform)}</span>` : ''}
      </span>
      <span class="card-title">${escapeHtml(game.title)}</span>
      <span class="card-meta">${game.year || 'Рік невідомий'}${game.genres?.[0] ? ' · ' + escapeHtml(game.genres[0]) : ''}</span>`;
    const img = card.querySelector('.card-render-img');
    if (img) {
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        if (img.dataset.fallbacking === '1') return;
        img.dataset.fallbacking = '1';
        img.src = makeFallbackCover();
      };
      loadCardPreview(img, cover, game.title);
    }
    card.addEventListener('click', () => launchGameFromCard(game, from, card));
    cardGameMap.set(card, { game, platform });
    observeCardMedia(card);
    return card;
  }

  function isLiveRailContainer(container) {
    return !!container?.classList?.contains('game-rail');
  }

  function renderStaticCardPreview(card) {
    if (!card?.isConnected) return;
    const img = card.querySelector('.card-render-img');
    if (!img) return;
    const cover = card.dataset.cover || makeFallbackCover();
    if (img.dataset.coverApplied === cover) return;
    img.dataset.coverApplied = cover;
    img.dataset.fallbacking = '0';
    img.src = cover;
    card.dataset.mediaReady = '1';
  }

  function hydrateStaticCardPreviews(container) {
    if (!container || isLiveRailContainer(container)) return;
    container.querySelectorAll('.game-card').forEach(renderStaticCardPreview);
  }

  function collectRailRendererItems(container) {
    const items = Array.from(container.querySelectorAll('.game-card')).map(card => ({
      id: card.dataset.id,
      viewport: card.querySelector('.card-viewport'),
      cover: card.dataset.cover || makeFallbackCover(),
      isLoader: false
    })).filter(item => item.id && item.viewport);
    const loader = container.querySelector('.discover-load-card');
    if (loader) {
      items.push({
        id: '__discover_loader__',
        viewport: loader.querySelector('.discover-loader-viewport'),
        cover: makeFallbackCover(),
        isLoader: true
      });
    }
    return items;
  }

  function refreshRailRenderer(container, recreate = false) {
    if (!container) return;
    if (!isLiveRailContainer(container)) {
      const stale = railRenderers.get(container);
      if (stale) {
        stale.destroy();
        railRenderers.delete(container);
      }
      container.classList.remove('rail-live-ready');
      hydrateStaticCardPreviews(container);
      return;
    }
    let rail = railRenderers.get(container);
    if (recreate && rail?.contextLost) {
      rail.destroy();
      railRenderers.delete(container);
      rail = null;
    }
    if (!rail) {
      rail = new CartridgeRailRenderer(container, 'assets/model.json');
      railRenderers.set(container, rail);
      observeRailVisibility(rail);
    }
    rail.setItems(collectRailRendererItems(container));
  }

  function renderCardsInto(container, games, from, small=false) {
    railMotionCleanup.get(container)?.();
    railMotionCleanup.delete(container);
    const rail = isLiveRailContainer(container) ? railRenderers.get(container) : null;
    for (const child of Array.from(container.children)) {
      if (rail && child === rail.canvas) continue;
      child.remove();
    }
    if (!games.length) {
      rail?.setItems([]);
      container.classList.remove('rail-live-ready');
      return;
    }
    const fragment = document.createDocumentFragment();
    games.forEach((game, index) => fragment.appendChild(buildGameCard(game, from, small, index, isLiveRailContainer(container))));
    container.appendChild(fragment);
    if (isLiveRailContainer(container)) refreshRailRenderer(container, false);
    else {
      bindRailMotion(container);
      hydrateStaticCardPreviews(container);
    }
  }

  function appendCardsInto(container, games, from, small=false) {
    if (!games.length) return;
    const startIndex = container.querySelectorAll('.game-card').length;
    const fragment = document.createDocumentFragment();
    games.forEach((game, index) => fragment.appendChild(buildGameCard(game, from, small, startIndex + index, isLiveRailContainer(container))));
    container.appendChild(fragment);
    railMotionCleanup.get(container)?.();
    railMotionCleanup.delete(container);
    if (isLiveRailContainer(container)) refreshRailRenderer(container, false);
    else {
      bindRailMotion(container);
      hydrateStaticCardPreviews(container);
    }
  }

  function loadCardPreview(img, coverUrl, title) {
    if (!img) return;
    img.dataset.fallbacking = '0';
    img.src = makeFallbackCover(title);
    img.dataset.cover = coverUrl || '';
  }

  function bindRailMotion(container) {
    const cards = Array.from(container.querySelectorAll('.game-card'));
    if (!cards.length || !container.classList.contains('game-rail')) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = container.getBoundingClientRect();
      const center = rect.left + rect.width * 0.5;
      cards.forEach(card => {
        const shell = card.querySelector('.card-viewport');
        if (!shell) return;
        const box = shell.getBoundingClientRect();
        const cardCenter = box.left + box.width * 0.5;
        const offset = Math.max(-1, Math.min(1, (cardCenter - center) / Math.max(140, rect.width * 0.56)));
        const tilt = offset * -7.5;
        const lift = Math.abs(offset) * -2.2;
        shell.style.setProperty('--card-tilt', `${tilt.toFixed(2)}deg`);
        shell.style.setProperty('--card-lift', `${lift.toFixed(2)}px`);
      });
      container.classList.remove('is-swiping');
    };
    const queue = () => {
      container.classList.add('is-swiping');
      if (!raf) raf = requestAnimationFrame(update);
    };
    queue();
    container.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    railMotionCleanup.set(container, () => {
      container.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      if (raf) cancelAnimationFrame(raf);
    });
  }

  function getMediaObserver() {
    if (mediaObserver) return mediaObserver;
    mediaObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        mediaObserver.unobserve(card);
        const payload = cardGameMap.get(card);
        if (payload) queueMediaPrefetch(payload.game, payload.platform, card);
      });
    }, { rootMargin: '280px 160px', threshold: 0.01 });
    return mediaObserver;
  }

  function observeCardMedia(card) {
    if (!card) return;
    if (card.dataset.hasCover !== '1') card.classList.add('media-loading');
    try { getMediaObserver().observe(card); }
    catch (_) {
      const payload = cardGameMap.get(card);
      if (payload) queueMediaPrefetch(payload.game, payload.platform, card);
    }
  }

  function queueMediaPrefetch(game, platform, card) {
    if (!game || !card?.isConnected) return;
    const key = `${game.id}|${platform || '_generic'}`;
    const waiters = mediaPrefetchWaiters.get(key) || new Set();
    waiters.add(card);
    mediaPrefetchWaiters.set(key, waiters);
    const current = getMediaRecord(game, platform);
    if (current.boxart) {
      updateCardMedia(card, game, platform, current.boxart);
      waiters.delete(card);
      if (!waiters.size) mediaPrefetchWaiters.delete(key);
      return;
    }
    if (mediaPrefetchQueued.has(key)) return;
    mediaPrefetchQueued.add(key);
    mediaPrefetchQueue.push({ key, game, platform });
    pumpMediaPrefetch();
  }

  function pumpMediaPrefetch() {
    while (mediaPrefetchActive < MEDIA_PREFETCH_CONCURRENCY && mediaPrefetchQueue.length) {
      const task = mediaPrefetchQueue.shift();
      mediaPrefetchActive++;
      Promise.resolve()
        .then(() => ensurePlatformMedia(task.game, task.platform, false))
        .then(media => {
          const waiters = mediaPrefetchWaiters.get(task.key) || [];
          for (const card of waiters) {
            if (card?.isConnected) updateCardMedia(card, task.game, task.platform, media?.boxart || null);
          }
        })
        .catch(error => console.warn('media prefetch', error))
        .finally(() => {
          mediaPrefetchQueued.delete(task.key);
          mediaPrefetchWaiters.delete(task.key);
          mediaPrefetchActive--;
          pumpMediaPrefetch();
        });
    }
  }

  function updateCardMedia(card, game, platform, coverUrl) {
    if (!card?.isConnected) return;
    card.classList.remove('media-loading');
    const statusLabel = card.querySelector('.media-search-label b');
    if (!coverUrl) {
      if (card.dataset.hasCover === '1') {
        card.classList.remove('media-missing');
        if (statusLabel) statusLabel.textContent = '';
        return;
      }
      card.classList.add('media-missing');
      if (statusLabel) statusLabel.textContent = card.classList.contains('media-provisional') ? 'Резервне зображення' : 'Немає обкладинки';
      return;
    }
    card.dataset.hasCover = '1';
    card.classList.remove('media-missing','media-provisional');
    if (statusLabel) statusLabel.textContent = '';
    if (card.dataset.cover === coverUrl && card.dataset.mediaReady === '1') return;
    card.dataset.cover = coverUrl;
    const parent = card.closest('.game-rail,.game-grid');
    const rail = parent ? railRenderers.get(parent) : null;
    if (rail && isLiveRailContainer(parent)) rail.updateItemCover(card.dataset.id, coverUrl);
    card.dataset.mediaReady = '1';
    const img = card.querySelector('.card-render-img');
    if (img) {
      img.dataset.cover = coverUrl;
      img.dataset.previewReady = '0';
      img.dataset.previewLoading = '0';
      if (!isLiveRailContainer(parent)) renderStaticCardPreview(card);
    }
  }

  function makeFallbackCover() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="640"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#454f5a"/><stop offset="1" stop-color="#1a2027"/></linearGradient><linearGradient id="a" y2="1"><stop stop-color="#f1b16d"/><stop offset="1" stop-color="#bf7e3c"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="26" y="26" width="428" height="588" rx="26" fill="none" stroke="#75818d" stroke-width="3"/><rect x="80" y="96" width="320" height="360" rx="18" fill="#14191f" stroke="#606a76" stroke-width="2"/><rect x="148" y="168" width="184" height="210" rx="18" fill="#202730" stroke="#7b8793" stroke-width="3"/><rect x="175" y="195" width="130" height="156" rx="12" fill="none" stroke="url(#a)" stroke-width="8"/><rect x="194" y="374" width="92" height="12" rx="6" fill="#6f7a86"/><text x="50%" y="490" text-anchor="middle" fill="#f1b16d" font-family="sans-serif" font-size="36" font-weight="800" letter-spacing="8">SAVE SLOT</text><text x="50%" y="528" text-anchor="middle" fill="#9ca7b2" font-family="monospace" font-size="18" letter-spacing="3">NO BOX ART</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function skeletonCards(count) {
    return Array.from({length:count}, () => `<div class="game-card"><div class="cover-shell loading-skeleton"></div><span class="card-title loading-skeleton" style="height:32px;border-radius:4px"></span></div>`).join('');
  }

  function renderDetail(game) {
    hydrateGameRecord(game);
    const platform = getActivePlatform(game);
    const media = getMediaRecord(game, platform);
    const entry = state.collection[game.id] || defaultCollectionEntry(game);
    const related = uniqueById([...state.searchGames, ...state.discoverGames]).filter(g => g.id !== game.id).slice(0,10);
    const verifiedCover = media.boxart || game.boxart || null;
    const provisionalCover = verifiedCover ? null : (game.cover || null);
    const cover = verifiedCover || provisionalCover || makeFallbackCover();
    const coverState = verifiedCover ? 'media-ready' : provisionalCover ? 'media-provisional' : media.boxartLoaded ? 'media-missing' : 'media-loading';
    const coverStatus = verifiedCover ? '' : provisionalCover ? (media.boxartLoaded ? 'Показано резервне зображення' : 'Уточнюю обкладинку…') : media.boxartLoaded ? 'Обкладинку не знайдено' : 'Шукаю обкладинку…';
    els.detailContent.innerHTML = `
      <div class="detail-hero">
        <div class="detail-cover-wrap ${coverState}">
          <img class="detail-cover" src="${escapeAttr(cover)}" alt="Обкладинка ${escapeHtml(game.title)}">
          <span class="detail-cover-status"><i></i>${coverStatus}</span>
        </div>
        <div class="detail-main">
          <span class="eyebrow">${escapeHtml(platform || 'VIDEO GAME')}</span>
          <h1>${escapeHtml(game.title)}</h1>
          ${game.originalTitle && game.originalTitle !== game.title ? `<div class="original-title">${escapeHtml(game.originalTitle)}</div>` : ''}
          <div class="chips">
            ${game.year ? `<span class="chip accent">${game.year}</span>` : ''}
            ${(game.genres||[]).slice(0,3).map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join('')}
          </div>
          ${(game.platforms||[]).length > 1 ? `<div class="release-selector"><small>ВЕРСІЯ ГРИ</small><div class="release-pills">${game.platforms.map(x=>`<button type="button" data-release-platform="${escapeAttr(x)}" class="release-pill ${x===platform?'active':''}">${escapeHtml(x)}</button>`).join('')}</div></div>` : ''}
          <div class="detail-actions">
            <button class="primary-button" id="toggleCollection" type="button">${state.collection[game.id] ? 'У колекції ✓' : 'Додати до колекції'}</button>
            <button class="secondary-button" id="favoriteButton" type="button">${entry.favorite ? '★ Улюблена' : '☆ Улюблене'}</button>
          </div>
        </div>
      </div>

      <section class="detail-section">
        <h2>ПРО ГРУ</h2>
        <p class="description">${escapeHtml(game.description || 'Докладний опис поки відсутній. Гру все одно можна додати до колекції та доповнити власними нотатками.')}</p>
      </section>

      <section class="detail-section">
        <h2>ДОСЬЄ</h2>
        <div class="fact-grid">
          <div class="fact"><small>Розробник</small><strong>${escapeHtml(joinOrUnknown(game.developers))}</strong></div>
          <div class="fact"><small>Видавець</small><strong>${escapeHtml(joinOrUnknown(game.publishers))}</strong></div>
          <div class="fact"><small>Серія</small><strong>${escapeHtml(joinOrUnknown(game.series))}</strong></div>
          <div class="fact"><small>Платформи</small><strong>${escapeHtml(joinOrUnknown(game.platforms))}</strong></div>
        </div>
      </section>

      <section class="detail-section">
        <h2>ЯК ГРА ВИГЛЯДАЄ</h2>
        <div class="gallery" id="detailGallery">
          ${(media.screenshots?.length ? media.screenshots : []).map(url=>`<img loading="lazy" src="${escapeAttr(url)}" alt="Скріншот з ${escapeHtml(game.title)} на ${escapeHtml(platform)}">`).join('') || '<div class="gallery-empty">Скріншоти для цієї версії гри поки не знайдено.</div>'}
        </div>
        <div id="galleryStatus" class="inline-status">${media.screenshotsLoaded ? (media.screenshots?.length ? '' : 'Для цієї платформи скріншотів не знайдено.') : `Завантажую скріншоти версії для ${escapeHtml(platform || 'обраної платформи')}…`}</div>
      </section>

      <section class="detail-section">
        <h2>МОЯ КОПІЯ ТА ПРОХОДЖЕННЯ</h2>
        <div class="collection-editor">
          <div class="editor-grid">
            <label>Статус
              <select id="entryStatus">
                ${statusOptions(entry.status)}
              </select>
            </label>
            <label>Формат
              <select id="entryFormat">
                ${formatOptions(entry.format)}
              </select>
            </label>
            <label>Платформа, на якій граю
              <input id="entryPlatform" value="${escapeAttr(entry.playedOn || platform || '')}" placeholder="Наприклад, Wii">
            </label>
            <label>Особиста оцінка
              <input id="entryRating" type="number" min="0" max="10" step="0.5" value="${entry.rating ?? ''}" placeholder="0–10">
            </label>
          </div>
          <label class="switch-row"><span><strong>Маю цю гру</strong><small>Фізична або цифрова копія</small></span><input id="entryOwned" type="checkbox" ${entry.owned ? 'checked' : ''}></label>
          <button class="secondary-button wide" id="saveEntry" type="button">Зберегти дані колекції</button>
        </div>
      </section>

      <section class="detail-section">
        <h2>НОВА НОТАТКА</h2>
        <div class="note-editor">
          <div class="editor-grid">
            <label>Тип<select id="noteType"><option value="impression">Враження</option><option value="walkthrough">Проходження</option><option value="technical">Технічна</option><option value="translation">Переклад або мод</option><option value="collection">Стан копії</option></select></label>
            <label>Назва<input id="noteTitle" value="Враження" maxlength="80"></label>
          </div>
          <label>Текст<textarea id="noteBody" placeholder="Що варто запам’ятати про цю гру?"></textarea></label>
          <button class="primary-button" id="saveNote" type="button">Зберегти нотатку</button>
        </div>
      </section>

      ${related.length ? `<section class="detail-section"><h2>ПРОДОВЖИТИ ДОСЛІДЖЕННЯ</h2><div class="game-rail small" id="relatedRail"></div></section>` : ''}
    `;

    const detailCover = els.detailContent.querySelector('.detail-cover');
    detailCover.onerror = () => {
      detailCover.onerror = null;
      detailCover.src = makeFallbackCover(game.title);
      const wrap = detailCover.closest('.detail-cover-wrap');
      const status = wrap?.querySelector('.detail-cover-status');
      wrap?.classList.remove('media-ready','media-loading');
      wrap?.classList.add('media-missing');
      if (status) status.innerHTML = 'Обкладинку не вдалося завантажити';
    };
    const galleryImages = Array.from(els.detailContent.querySelectorAll('.gallery img'));
    galleryImages.forEach(img => img.onerror = () => {
      img.remove();
      const remaining = els.detailContent.querySelectorAll('.gallery img').length;
      const status = $('galleryStatus');
      if (!remaining && status) status.textContent = 'Знайдені кадри не вдалося завантажити. Джерела буде перевірено повторно.';
    });

    els.detailContent.querySelectorAll('[data-release-platform]').forEach(button => {
      button.addEventListener('click', () => switchGamePlatform(game, button.dataset.releasePlatform));
    });

    $('toggleCollection').addEventListener('click', () => {
      if (state.collection[game.id]) {
        delete state.collection[game.id];
        writeJson(KEYS.collection, state.collection);
        renderDetail(game);
        toast('Видалено з колекції');
      } else {
        state.collection[game.id] = defaultCollectionEntry(game);
        state.collection[game.id].game = snapshotGame(game);
        writeJson(KEYS.collection, state.collection);
        renderDetail(game);
        toast('Додано до колекції');
      }
      renderCollection(); renderNotes();
    });

    $('favoriteButton').addEventListener('click', () => {
      const item = ensureCollectionEntry(game);
      item.favorite = !item.favorite;
      persistCollection();
      renderDetail(game); renderCollection();
    });

    $('saveEntry').addEventListener('click', () => {
      const item = ensureCollectionEntry(game);
      item.status = $('entryStatus').value;
      item.format = $('entryFormat').value;
      item.playedOn = $('entryPlatform').value.trim();
      const ratingValue = $('entryRating').value === '' ? null : Number($('entryRating').value);
      item.rating = ratingValue === null || !Number.isFinite(ratingValue) ? null : Math.max(0, Math.min(10, Math.round(ratingValue * 2) / 2));
      item.owned = $('entryOwned').checked;
      item.updatedAt = Date.now();
      persistCollection();
      toast('Дані колекції збережено');
      renderCollection();
    });

    $('saveNote').addEventListener('click', () => {
      const body = $('noteBody').value.trim();
      if (!body) { toast('Нотатка порожня'); return; }
      const item = ensureCollectionEntry(game);
      item.notes ||= [];
      item.notes.unshift({
        id: `n${Date.now()}${Math.random().toString(36).slice(2,6)}`,
        type: $('noteType').value,
        title: $('noteTitle').value.trim() || 'Нотатка',
        body,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      persistCollection();
      $('noteBody').value = '';
      toast('Нотатку збережено');
      renderNotes();
    });

    if (related.length) renderCardsInto($('relatedRail'), related, 'detail', true);
  }

  function statusOptions(selected) {
    const options = [
      ['planned','Планую'],['playing','Граю'],['completed','Пройдено'],['completed100','Завершено на 100%'],['paused','Відкладено'],['dropped','Покинуто'],['replaying','Перепроходжу']
    ];
    return options.map(([v,l])=>`<option value="${v}" ${selected===v?'selected':''}>${l}</option>`).join('');
  }
  function formatOptions(selected) {
    const options = [['unknown','Не вказано'],['physical','Фізична копія'],['digital','Цифрова копія'],['cartridge','Картридж'],['disc','Диск'],['collector','Колекційне видання'],['backup','Резервна копія']];
    return options.map(([v,l])=>`<option value="${v}" ${selected===v?'selected':''}>${l}</option>`).join('');
  }

  function defaultCollectionEntry(game) {
    return {
      game: snapshotGame(game),
      status: 'planned',
      format: 'unknown',
      owned: false,
      favorite: false,
      playedOn: getActivePlatform(game) || '',
      rating: null,
      notes: [],
      addedAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function ensureCollectionEntry(game) {
    if (!state.collection[game.id]) state.collection[game.id] = defaultCollectionEntry(game);
    return state.collection[game.id];
  }
  function persistCollection() { writeJson(KEYS.collection, state.collection); renderCollection(); renderNotes(); }

  function renderCollection() {
    if (!els.collectionGrid) return;
    let items = Object.values(state.collection);
    if (state.collectionFilter === 'owned') items = items.filter(x => x.owned);
    else if (state.collectionFilter) items = items.filter(x => x.status === state.collectionFilter);
    items.sort((a,b) => (b.updatedAt||b.addedAt||0)-(a.updatedAt||a.addedAt||0));
    const games = items.map(x => ({...x.game, collectionEntry:x}));
    els.collectionEmpty.hidden = games.length > 0;
    renderCardsInto(els.collectionGrid, games, 'collection');
  }

  function renderNotes() {
    if (!els.notesList) return;
    const notes = [];
    Object.values(state.collection).forEach(entry => (entry.notes||[]).forEach(note => notes.push({note, game:entry.game})));
    notes.sort((a,b) => b.note.updatedAt-a.note.updatedAt);
    els.notesEmpty.hidden = notes.length > 0;
    els.notesList.innerHTML = '';
    notes.forEach(({note,game}) => {
      const button = document.createElement('button');
      button.className = 'note-card'; button.type = 'button';
      button.innerHTML = `<header><small>${escapeHtml(noteTypeName(note.type))}</small><time>${formatDate(note.updatedAt)}</time></header><h3>${escapeHtml(note.title)}</h3><p>${escapeHtml(note.body)}</p><footer>${escapeHtml(game.title)}</footer>`;
      button.addEventListener('click', () => launchGameFromCard(game,'notes', button));
      els.notesList.appendChild(button);
    });
  }

  function noteTypeName(type) {
    return ({ impression:'ВРАЖЕННЯ', walkthrough:'ПРОХОДЖЕННЯ', technical:'ТЕХНІЧНА', translation:'ПЕРЕКЛАД / МОД', collection:'СТАН КОПІЇ' })[type] || 'НОТАТКА';
  }

  function rememberRecent(game) {
    state.recent = [snapshotGame(game), ...state.recent.filter(x=>x.id!==game.id)].slice(0,12);
    writeJson(KEYS.recent,state.recent);
    renderRecent();
  }
  function renderRecent() {
    if (!els.recentRail) return;
    const games = state.recent.length ? state.recent : [];
    renderCardsInto(els.recentRail,games,'discover',true);
  }

  async function loadGalleryForGame(game, platform = getActivePlatform(game)) {
    const key = `${game.id}|${platform}`;
    const media = getMediaRecord(game, platform);
    if (media.screenshotsLoaded || state.galleryLoading.has(key)) return;
    state.galleryLoading.add(key);
    try {
      await ensurePlatformMedia(game, platform, true);
      if (state.selectedGame?.id === game.id && state.activeScreen === 'detail' && getActivePlatform(game) === platform) {
        renderDetail(game);
      }
    } catch (error) {
      console.warn('gallery', error);
      media.screenshotsLoaded = true;
      const status = $('galleryStatus'); if (status) status.textContent = 'Скріншоти не завантажились.';
    } finally {
      state.galleryLoading.delete(key);
    }
  }

  async function resolveWikimediaScreenshots(game, platform = getActivePlatform(game)) {
    let screenshots = await searchCommonsScreenshots(game, platform);
    if (screenshots.length) {
      setSourceState('wikimedia','online');
      return screenshots;
    }
    const link = game.sitelinks?.ukwiki || game.sitelinks?.enwiki;
    if (!link) return [];
    try {
      const language = game.sitelinks.ukwiki ? 'uk' : 'en';
      const title = game.sitelinks[`${language}wiki`];
      const api = `https://${language}.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=images&imlimit=40&titles=${encodeURIComponent(title)}`;
      const data = await fetchJson(api, 10000);
      setSourceState('wikipedia','online');
      const names = (data.query?.pages?.[0]?.images || [])
        .map(x => x.title)
        .filter(name => isLikelyArticleScreenshotName(name, game, platform))
        .slice(0,12);
      if (!names.length) return [];
      const infoUrl = `https://${language}.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1200&titles=${encodeURIComponent(names.join('|'))}`;
      const info = await fetchJson(infoUrl, 2100);
      screenshots = (info.query?.pages || [])
        .map(p => p.imageinfo?.[0])
        .filter(Boolean)
        .filter(ii => (ii.width || 0) > 500 && (ii.width || 0) > (ii.height || 0) * 1.18 && (ii.mime || '').startsWith('image/'))
        .map(ii => ii.thumburl || ii.url);
      if (screenshots.length) setSourceState('wikimedia','online');
      return screenshots;
    } catch (_) {
      return [];
    }
  }

  async function resolveWikipediaArticleScreenshots(game, platform, language) {
    const title=await ensureWikipediaArticleTitle(game, language, platform);
    if(!title)return [];
    try{
      const api=`https://${language}.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=images&imlimit=35&titles=${encodeURIComponent(title)}`;
      const data=await fetchJson(api,1900);
      const names=(data.query?.pages?.[0]?.images||[]).map(x=>x.title).filter(name=>isLikelyArticleScreenshotName(name,game,platform)).slice(0,14);
      if(!names.length)return [];
      const infoUrl=`https://${language}.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1200&titles=${encodeURIComponent(names.join('|'))}`;
      const info=await fetchJson(infoUrl,1900);
      return (info.query?.pages||[]).map(p=>p.imageinfo?.[0]).filter(Boolean).filter(ii=>(ii.width||0)>500&&(ii.width||0)>(ii.height||0)*1.12&&(ii.mime||'').startsWith('image/')).map(ii=>ii.thumburl||ii.url);
    }catch(_){return [];}
  }

  async function searchCommonsScreenshots(game, platform = getActivePlatform(game)) {
    const titleCandidates = unique([game.originalTitle, game.title, ...(game.aliases || [])].filter(Boolean).map(cleanGameTitleForMedia)).slice(0, 4);
    const queries = [];
    for (const title of titleCandidates) {
      if (platform) {
        queries.push(`${title} ${platform} screenshot`);
        queries.push(`${title} ${platform} gameplay`);
      }
      queries.push(`${title} screenshot`);
      queries.push(`${title} gameplay`);
      queries.push(`${title} video game screenshot`);
      if (game.year) queries.push(`${title} ${game.year} screenshot`);
    }
    const titles = [];
    for (const query of unique(queries)) {
      try { titles.push(...await commonsFileSearch(query, 10)); } catch (_) {}
      if (titles.length >= 14) break;
    }
    const filtered = unique(titles).filter(name => isLikelyScreenshotName(name, game, platform)).slice(0, 12);
    if (!filtered.length) return [];
    const infoUrl = `https://commons.wikimedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1200&titles=${encodeURIComponent(filtered.join('|'))}`;
    const info = await fetchJson(infoUrl, 2100);
    return (info.query?.pages || [])
      .map(p => p.imageinfo?.[0])
      .filter(Boolean)
      .filter(ii => (ii.width || 0) > 500 && (ii.width || 0) > (ii.height || 0) * 1.18 && (ii.mime || '').startsWith('image/'))
      .map(ii => ii.thumburl || ii.url);
  }

  function isLikelyArticleScreenshotName(name, game, platform = getActivePlatform(game)) {
    if (!/\.(jpe?g|png|webp)$/i.test(name)) return false;
    if (/(icon|logo|symbol|flag|commons-logo|wikidata|question_book|ambox|crystal|padlock|stub|fairuse|rating|esrb|pegi|cover|box.?art|packshot|poster|title[-_ ]?screen|boxart)/i.test(name)) return false;
    if (titleInstallmentMismatch(name, game)) return false;
    const low = normalizeLoose(name);
    const selectedHit = platformAliases(platform).some(token => token && low.includes(token));
    const otherHit = (game.platforms || []).filter(item => item !== platform).flatMap(platformAliases).some(token => token && low.includes(token));
    if (otherHit && !selectedHit) return false;
    return /(screen|screenshot|gameplay|ingame|in game|battle|scene|shot|gameplay image)/i.test(name);
  }

  function isLikelyScreenshotName(name, game, platform = getActivePlatform(game)) {
    if (!/\.(jpe?g|png|webp)$/i.test(name)) return false;
    if (/(icon|logo|symbol|flag|commons-logo|wikidata|question_book|ambox|crystal|padlock|stub|fairuse|rating|esrb|pegi|cover|box.?art|packshot|poster|logo|title[-_ ]?screen|boxart)/i.test(name)) return false;
    const low=normalizeLoose(name);
    const match=filenameMatchesTitleAndPlatform(name,game,false,platform);
    if(!match.titleHits)return false;
    const selectedHit=platformAliases(platform).some(token=>token&&low.includes(token));
    const otherHit=(game.platforms||[]).filter(p=>p!==platform).flatMap(platformAliases).some(token=>token&&low.includes(token));
    return !otherHit && (selectedHit || !platformTerms(game).some(token=>token&&low.includes(token))) && /(screen|screenshot|gameplay|ingame|in game|battle|scene|shot)/i.test(name);
  }

  function updateSettingsScreen() {
    if (!els.wikidataState) return;
    updateSourceIndicator('wikidata',els.wikidataState);
    updateSourceIndicator('wikipedia',els.wikipediaState);
    updateSourceIndicator('libretro',els.libretroState);
    updateSourceIndicator('steam',els.steamState);
    updateSourceIndicator('gog',els.gogState);
    updateSourceIndicator('vndb',els.vndbState);
    updateSourceIndicator('pcgamingwiki',els.pcgamingwikiState);
    updateSourceIndicator('wikimedia',els.wikimediaState);
    els.lastUpdate.textContent = state.cache.lastUpdate ? formatDateTime(state.cache.lastUpdate) : 'Ще не виконувалось';
    let cacheRaw=''; try { cacheRaw=localStorage.getItem(KEYS.cache)||''; } catch (_) {} const bytes = new Blob([cacheRaw]).size;
    els.cacheSize.textContent = bytes < 1024 ? `${bytes} Б` : `${(bytes/1024).toFixed(bytes>1024*100?0:1)} КБ`;
  }
  function updateSourceIndicator(key,el) {
    const status=state.sources[key];
    const map={idle:'—',loading:'ПЕРЕВІРКА',online:'ПРАЦЮЄ',error:'ПОМИЛКА'};
    el.textContent=map[status]; el.className=status==='online'?'online':status==='error'?'error':'';
  }
  function setSourceState(key,status) { state.sources[key]=status; updateSettingsScreen(); }

  function hydrateGameRecord(game) {
    if (!game) return game;
    repairGameTitleLocally(game);
    game.mediaByPlatform ||= {};
    const normalizedMedia = {};
    for (const [key, value] of Object.entries(game.mediaByPlatform)) {
      const normalizedKey = key === '_generic' ? key : (canonicalPlatformName(key) || '_generic');
      normalizedMedia[normalizedKey] = { ...(normalizedMedia[normalizedKey] || {}), ...(value || {}), platform:normalizedKey === '_generic' ? '' : normalizedKey };
    }
    game.mediaByPlatform = normalizedMedia;
    game.platforms = sanitizeNamedList(game.platforms || [], 'platform');
    game.genres = sanitizeNamedList(game.genres || []);
    const selectedPlatform = canonicalPlatformName(game.selectedPlatform || '');
    game.selectedPlatform = selectedPlatform && game.platforms.includes(selectedPlatform) ? selectedPlatform : (game.platforms[0] || '');
    const media = getMediaRecord(game, game.selectedPlatform);
    if (!media.boxart && game.boxart) {
      media.boxart = game.boxart;
      media.boxartLoaded = true;
      media.boxartSource = game.mediaSource || null;
    }
    if ((!media.screenshots || !media.screenshots.length) && game.screenshots?.length) {
      media.screenshots = game.screenshots;
      media.screenshotsLoaded = !!game.screenshotsLoaded;
    }
    applyMediaRecord(game, game.selectedPlatform);
    return game;
  }

  function gameRelevanceScore(game, query) {
    const q = normalizeLoose(cleanGameTitleForMedia(query));
    const title = normalizeLoose(cleanGameTitleForMedia(game.title));
    const original = normalizeLoose(cleanGameTitleForMedia(game.originalTitle));
    let score = 0;
    if (title === q) score += 120;
    if (original === q) score += 115;
    if (title.startsWith(q) || original.startsWith(q)) score += 60;
    if (title.includes(q) || original.includes(q)) score += 35;
    const tokens = q.split(' ').filter(x => x.length > 2);
    const haystack = `${title} ${original}`;
    score += tokens.filter(token => haystack.includes(token)).length * 12;
    if (game.platforms?.length) score += 4;
    if (game.year) score += 2;
    if (game.boxart) score += 3;
    return score;
  }

  function rankAndDedupeGames(games, query) {
    const seen = new Map();
    for (const game of games.filter(Boolean).map(hydrateGameRecord)) {
      const key = `${normalizeLoose(cleanGameTitleForMedia(game.originalTitle || game.title))}|${game.year || ''}`;
      const current = seen.get(key);
      if (!current || gameRelevanceScore(game, query) > gameRelevanceScore(current, query)) seen.set(key, game);
    }
    return [...seen.values()].sort((a,b) => gameRelevanceScore(b,query)-gameRelevanceScore(a,query));
  }

  async function searchGames(query, options={}) {
    const normalized = query.trim().toLowerCase();
    const limit = options.limit || 18;
    const cachedIds = state.cache.queries[normalized];
    if (options.cache !== false && cachedIds?.time > Date.now()-1000*60*60*24*14) {
      const cached = cachedIds.ids.map(id=>state.cache.games[id]).filter(Boolean).map(hydrateGameRecord);
      if (cached.length) return rankAndDedupeGames(cached, query).slice(0,limit);
    }

    setSourceState('wikidata','loading');
    let candidates = [];
    try {
      const [uk, en] = await Promise.all([
        wikidataSearch(query,'uk',Math.min(limit+6,30)),
        wikidataSearch(query,'en',Math.min(limit+6,30))
      ]);
      candidates = uniqueById([...uk,...en]);
      setSourceState('wikidata','online');
    } catch (error) {
      setSourceState('wikidata','error');
      throw error;
    }

    if (candidates.length < 4) {
      try {
        const [ukPages,enPages] = await Promise.all([wikipediaSearch(query,'uk'),wikipediaSearch(query,'en')]);
        candidates = uniqueById([...candidates,...ukPages,...enPages]);
      } catch (_) {}
    }

    const ids = candidates.map(x=>x.id).filter(id=>/^Q\d+$/.test(id)).slice(0,50);
    if (!ids.length) return [];
    const entities = await getEntities(ids);
    const gameEntities = Object.values(entities).filter(entity=>isLikelyGame(entity,candidates.find(x=>x.id===entity.id)));

    const dependencyIds = unique(gameEntities.flatMap(entity => ['P400','P136','P178','P123','P179'].flatMap(prop => claimEntityIds(entity,prop))));
    const labels = dependencyIds.length ? await getLabels(dependencyIds) : {};

    let games = gameEntities.map(entity => entityToGame(entity,labels,candidates.find(x=>x.id===entity.id))).filter(Boolean).slice(0,limit);
    if (!options.lightweight) {
      games = await mapLimit(games,4,async game => enrichFromWikipedia(game));
    } else {
      games = await mapLimit(games,3,async game => enrichFromWikipedia(game,true));
    }
    games = await mapLimit(games.filter(Boolean),4,finalizeArtFields);
    games = rankAndDedupeGames(games, query).slice(0,limit);
    games.forEach(cacheGame);
    state.cache.queries[normalized] = { ids:games.map(g=>g.id), time:Date.now() };
    state.cache.lastUpdate=Date.now();
    trimCache();
    writeJson(KEYS.cache,state.cache);
    return games;
  }

  async function wikidataSearch(query,language,limit) {
    const url=`https://www.wikidata.org/w/api.php?origin=*&action=wbsearchentities&format=json&language=${language}&uselang=${language}&type=item&limit=${limit}&search=${encodeURIComponent(query)}`;
    const data=await fetchJson(url,9000);
    return (data.search||[]).map(x=>({id:x.id,label:x.label,description:x.description||'',match:x.match}));
  }

  async function wikipediaSearch(query,language) {
    setSourceState('wikipedia','loading');
    const url=`https://${language}.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&generator=search&gsrsearch=${encodeURIComponent(query+' video game')}&gsrnamespace=0&gsrlimit=10&prop=pageprops|description`;
    const data=await fetchJson(url,9000);
    setSourceState('wikipedia','online');
    return (data.query?.pages||[]).filter(p=>p.pageprops?.wikibase_item).map(p=>({id:p.pageprops.wikibase_item,label:p.title,description:p.description||'',wiki:{language,title:p.title}}));
  }

  async function ensureWikipediaArticleTitle(game, language, platform = getActivePlatform(game)) {
    const field = `${language}wiki`;
    if (game.sitelinks?.[field]) return game.sitelinks[field];
    const key = `${language}|${normalizeLoose(game.originalTitle || game.title)}|${normalizeLoose(platform)}`;
    if (wikipediaLookupCache.has(key)) return wikipediaLookupCache.get(key);
    const promise = (async () => {
      const title = cleanGameTitleForMedia(game.originalTitle || game.title);
      const queries = unique([
        `${title} video game`,
        `${title} game`,
        title,
        platform ? `${title} ${platform}` : null,
        game.year ? `${title} ${game.year} video game` : null
      ].filter(Boolean));
      for (const query of queries) {
        try {
          const url = `https://${language}.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=0&gsrlimit=6&prop=pageprops|description`;
          const data = await fetchJson(url, 3400);
          const pages = data.query?.pages || [];
          const target = normalizeLoose(title);
          const ranked = pages.map(page => {
            const pageTitle = normalizeLoose(cleanDisplayTitle(page.title || ''));
            const description = normalizeLoose(page.description || '');
            let score = pageTitle === target ? 120 : 0;
            if (titleInstallmentMismatch(pageTitle, game)) score -= 160;
            if (pageTitle.includes(target) || target.includes(pageTitle)) score += 55;
            score += titleKeywords(game).filter(token => pageTitle.includes(token)).length * 9;
            if (/(video game|computer game|arcade game|відеогра)/i.test(description)) score += 25;
            if (platformAliases(platform).some(token => description.includes(token) || pageTitle.includes(token))) score += 18;
            return { page, score };
          }).sort((a,b) => b.score - a.score);
          const page = ranked[0]?.score >= 42 ? ranked[0].page : null;
          if (page?.title) {
            game.sitelinks ||= {};
            game.sitelinks[field] = page.title;
            return page.title;
          }
        } catch (_) {}
      }
      return null;
    })();
    const safePromise = promise.then(value => {
      if (!value) wikipediaLookupCache.delete(key);
      return value;
    }, error => {
      wikipediaLookupCache.delete(key);
      throw error;
    });
    wikipediaLookupCache.set(key, safePromise);
    return safePromise;
  }

  async function getEntities(ids) {
    const url=`https://www.wikidata.org/w/api.php?origin=*&action=wbgetentities&format=json&props=labels|aliases|descriptions|claims|sitelinks&languages=uk|en&sitefilter=ukwiki|enwiki&ids=${ids.join('|')}`;
    const data=await fetchJson(url,12000);
    return data.entities||{};
  }

  async function getLabels(ids) {
    const output={};
    for (let i=0;i<ids.length;i+=50) {
      const url=`https://www.wikidata.org/w/api.php?origin=*&action=wbgetentities&format=json&props=labels&languages=uk|en&ids=${ids.slice(i,i+50).join('|')}`;
      const data=await fetchJson(url,10000);
      Object.values(data.entities||{}).forEach(e=>output[e.id]=pickLabel(e,e.id));
    }
    return output;
  }

  function isLikelyGame(entity,searchHit) {
    const desc=(pickDescription(entity)||searchHit?.description||'').toLowerCase();
    if (/(video game|computer game|arcade game|відеогра|комп'ютерна гра|комп’ютерна гра|гра для|visual novel)/i.test(desc)) return true;
    const instances=claimEntityIds(entity,'P31');
    return instances.some(id=>['Q7889','Q7058673','Q115123401','Q1066707'].includes(id));
  }

  function isInvalidGameTitle(value) {
    const title = String(value || '').trim();
    return !title || /^(?:Q|P|L)\d+$/i.test(title) || /^(?:unknown|undefined|null|невідома гра|назва уточнюється)$/i.test(title);
  }

  function cleanDisplayTitle(value) {
    let title = String(value || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (!title) return '';
    title = title.replace(/\s*\((?:19|20)\d{2}\s+video game\)$/i, '');
    title = title.replace(/\s*\((?:video game|computer game|arcade game)\)$/i, '');
    return title.trim();
  }

  function inferTitleFromDescription(description) {
    const text = String(description || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const patterns = [
      /^(.{2,90}?)\s+(?:is|was)\s+(?:an?|the)\s+\d{4}\b/i,
      /^(.{2,90}?)\s+(?:is|was)\s+(?:an?|the)\s+(?:video|computer|arcade|action|role-playing|adventure|platform|strategy|simulation|racing|fighting|shooter|puzzle)\b/i,
      /^(.{2,90}?)\s+[—–-]\s+(?:це\s+)?(?:відеогра|гра)\b/i,
      /^(.{2,90}?)\s+—\s+відеогра\b/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const candidate = cleanDisplayTitle(match?.[1]);
      if (candidate && !isInvalidGameTitle(candidate) && candidate.length <= 90) return candidate;
    }
    return '';
  }

  function chooseBestGameTitle(candidates) {
    for (const raw of candidates || []) {
      const candidate = cleanDisplayTitle(raw);
      if (!candidate || isInvalidGameTitle(candidate)) continue;
      if (/^(?:video game|computer game|arcade game)$/i.test(candidate)) continue;
      return candidate;
    }
    return '';
  }

  function resolveEntityGameTitle(entity, searchHit) {
    const aliases = [
      ...(entity.aliases?.uk || []).map(item => item.value),
      ...(entity.aliases?.en || []).map(item => item.value)
    ];
    return chooseBestGameTitle([
      entity.labels?.uk?.value,
      entity.labels?.en?.value,
      searchHit?.label,
      entity.sitelinks?.ukwiki?.title,
      entity.sitelinks?.enwiki?.title,
      ...aliases,
      inferTitleFromDescription(pickDescription(entity) || searchHit?.description)
    ]);
  }

  function repairGameTitleLocally(game) {
    if (!game) return false;
    const previousTitle = game.title;
    const resolved = chooseBestGameTitle([
      game.title,
      game.originalTitle,
      game.sitelinks?.ukwiki,
      game.sitelinks?.enwiki,
      ...(game.aliases || []),
      inferTitleFromDescription(game.description)
    ]);
    if (resolved) {
      game.title = resolved;
      if (isInvalidGameTitle(game.originalTitle)) game.originalTitle = resolved;
    } else if (isInvalidGameTitle(game.title)) {
      game.title = 'Назва уточнюється';
    }
    return previousTitle !== game.title;
  }

  function allStoredGameSnapshots() {
    const snapshots = [
      ...Object.values(state.cache.games || {}),
      ...(state.recent || []),
      ...Object.values(state.collection || {}).map(entry => entry?.game).filter(Boolean)
    ];
    return uniqueById(snapshots.filter(Boolean));
  }

  function repairStoredGameTitlesLocal() {
    let changed = false;
    for (const game of allStoredGameSnapshots()) changed = repairGameTitleLocally(game) || changed;
    if (!changed) return;
    writeJson(KEYS.cache, state.cache);
    writeJson(KEYS.recent, state.recent);
    writeJson(KEYS.collection, state.collection);
  }

  async function repairStoredGameTitlesRemote() {
    const unresolved = allStoredGameSnapshots().filter(game => isInvalidGameTitle(game.title) || game.title === 'Назва уточнюється');
    const ids = unique(unresolved.map(game => game.id).filter(id => /^Q\d+$/i.test(id)));
    if (!ids.length) return;
    try {
      const entities = await getEntities(ids.slice(0, 50));
      let changed = false;
      for (const game of unresolved) {
        const entity = entities[game.id];
        if (!entity) continue;
        const title = resolveEntityGameTitle(entity, null);
        if (!title) continue;
        game.title = title;
        if (isInvalidGameTitle(game.originalTitle)) game.originalTitle = entity.labels?.en?.value || title;
        changed = true;
      }
      if (!changed) return;
      writeJson(KEYS.cache, state.cache);
      writeJson(KEYS.recent, state.recent);
      writeJson(KEYS.collection, state.collection);
      renderRecent();
      renderCollection();
      renderNotes();
      if (state.selectedGame) renderDetail(state.selectedGame);
    } catch (error) {
      console.warn('title repair', error);
    }
  }

  async function ensureGameTitle(game) {
    repairGameTitleLocally(game);
    if (!isInvalidGameTitle(game.title) && game.title !== 'Назва уточнюється') return game.title;
    if (!/^Q\d+$/i.test(game.id || '')) return game.title;
    if (titleRepairPromises.has(game.id)) return titleRepairPromises.get(game.id);
    const promise = (async () => {
      try {
        const entities = await getEntities([game.id]);
        const entity = entities[game.id];
        const title = entity ? resolveEntityGameTitle(entity, null) : '';
        if (title) {
          game.title = title;
          if (isInvalidGameTitle(game.originalTitle)) game.originalTitle = entity.labels?.en?.value || title;
          cacheGame(game);
          writeJson(KEYS.cache, state.cache);
        }
      } catch (_) {}
      return game.title;
    })().finally(() => titleRepairPromises.delete(game.id));
    titleRepairPromises.set(game.id, promise);
    return promise;
  }

  function canonicalPlatformName(value = '') {
    const raw = String(value || '').trim();
    const key = normalizeLoose(raw);
    const aliases = {
      'microsoft windows':'Windows','windows':'Windows','windows pc':'Windows','pc':'Windows',
      'macos':'macOS','mac os':'macOS','macintosh operating systems':'macOS','classic mac os':'macOS',
      'linux':'Linux','dos':'DOS','ms dos':'DOS','arcade game':'Arcade','arcade':'Arcade',
      'sony playstation':'PlayStation','playstation':'PlayStation','ps1':'PlayStation',
      'playstation 2':'PlayStation 2','ps2':'PlayStation 2','playstation 3':'PlayStation 3','ps3':'PlayStation 3',
      'playstation 4':'PlayStation 4','ps4':'PlayStation 4','playstation 5':'PlayStation 5','ps5':'PlayStation 5',
      'playstation portable':'PlayStation Portable','psp':'PlayStation Portable','playstation vita':'PlayStation Vita','ps vita':'PlayStation Vita',
      'nintendo gamecube':'Nintendo GameCube','gamecube':'Nintendo GameCube',
      'nintendo entertainment system':'Nintendo Entertainment System','nes':'Nintendo Entertainment System',
      'super nintendo entertainment system':'Super Nintendo Entertainment System','super nintendo':'Super Nintendo Entertainment System','snes':'Super Nintendo Entertainment System',
      'nintendo 64':'Nintendo 64','n64':'Nintendo 64','nintendo ds':'Nintendo DS','nintendo dsi':'Nintendo DS','nintendo 3ds':'Nintendo 3DS',
      'game boy':'Game Boy','game boy color':'Game Boy Color','game boy advance':'Game Boy Advance',
      'wii':'Wii','wii u':'Wii U','nintendo switch':'Nintendo Switch','virtual boy':'Virtual Boy',
      'microsoft xbox':'Xbox','xbox':'Xbox','xbox 360':'Xbox 360','xbox one':'Xbox One','xbox series x s':'Xbox Series X/S','xbox series x/s':'Xbox Series X/S',
      'sega dreamcast':'Dreamcast','dreamcast':'Dreamcast','sega saturn':'Sega Saturn','saturn':'Sega Saturn',
      'sega genesis':'Sega Genesis','genesis':'Sega Genesis','mega drive':'Mega Drive','sega mega drive':'Mega Drive',
      'sega master system':'Sega Master System','master system':'Sega Master System','game gear':'Game Gear','sega game gear':'Game Gear',
      'pc engine':'PC Engine','turbografx 16':'TurboGrafx-16','turbografx-16':'TurboGrafx-16',
      'neo geo':'Neo Geo','neo geo pocket color':'Neo Geo Pocket Color','atari 2600':'Atari 2600','atari 7800':'Atari 7800',
      'atari lynx':'Atari Lynx','atari jaguar':'Jaguar','jaguar':'Jaguar','commodore 64':'Commodore 64','amiga':'Amiga',
      'zx spectrum':'ZX Spectrum','msx':'MSX','msx2':'MSX'
    };
    return aliases[key] || raw;
  }

  function platformListsMatch(platforms, selected) {
    if (!selected) return true;
    const selectedTokens = new Set(platformAliases(canonicalPlatformName(selected)));
    return (platforms || []).some(platform => platformAliases(canonicalPlatformName(platform)).some(token => selectedTokens.has(token)));
  }

  function sanitizeNamedList(values, kind = 'generic') {
    const cleaned = [];
    for (const raw of values || []) {
      let value = String(raw || '').trim();
      if (!value || /^Q\d+$/i.test(value)) continue;
      if (kind === 'platform') value = canonicalPlatformName(value);
      if (/^(wikimedia|wikipedia|video game)$/i.test(value)) continue;
      if (kind === 'platform' && /^(console|home computer|personal computer)$/i.test(value)) continue;
      if (!cleaned.includes(value)) cleaned.push(value);
    }
    return cleaned;
  }

  function normalizeLoose(value = '') {
    return String(value).toLowerCase().replace(/[_:()\[\],.-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizedTitleVariants(game) {
    return unique([game?.originalTitle, game?.title, ...(game?.aliases || [])]
      .filter(Boolean)
      .map(cleanGameTitleForMedia)
      .map(value => normalizeLoose(value))
      .filter(Boolean));
  }

  function titleNumberTokens(value = '') {
    const romanMap = { ii:'2', iii:'3', iv:'4', v:'5', vi:'6', vii:'7', viii:'8', ix:'9', x:'10' };
    return normalizeLoose(value).split(' ').map(token => romanMap[token] || token)
      .filter(token => /^\d+$/.test(token))
      .filter(token => {
        const number = Number(token);
        return number > 0 && number < 100 && !(number >= 70 && number <= 99);
      });
  }

  function titleInstallmentMismatch(candidate, game) {
    const candidateNumbers = new Set(titleNumberTokens(candidate));
    const expectedNumbers = new Set(normalizedTitleVariants(game).flatMap(titleNumberTokens));
    const ignored = new Set([
      String(game?.year || ''),
      ...platformAliases(getActivePlatform(game)).flatMap(titleNumberTokens)
    ].filter(Boolean));
    for (const token of expectedNumbers) {
      if (!candidateNumbers.has(token)) return true;
    }
    for (const token of candidateNumbers) {
      if (!expectedNumbers.has(token) && !ignored.has(token) && Number(token) >= 2) return true;
    }
    return false;
  }

  function titleMatchScore(candidate, game) {
    const normalized = normalizeLoose(candidate);
    if (!normalized || titleInstallmentMismatch(normalized, game)) return 0;
    let best = 0;
    for (const title of normalizedTitleVariants(game)) {
      if (normalized === title) best = Math.max(best, 180);
      else if (` ${normalized} `.includes(` ${title} `)) best = Math.max(best, 130);
      else {
        const titleTokens = title.split(' ').filter(token => token.length > 1);
        const candidateTokens = normalized.split(' ').filter(token => token.length > 1);
        const shared = titleTokens.filter(token => candidateTokens.includes(token)).length;
        const coverage = titleTokens.length ? shared / titleTokens.length : 0;
        const precision = candidateTokens.length ? shared / candidateTokens.length : 0;
        best = Math.max(best, coverage * 80 + precision * 40);
      }
    }
    return best;
  }

  function inferPrimaryPlatform(platforms = [], description = '') {
    if (!platforms.length) return '';
    const text = normalizeLoose(description);
    let best = { platform: platforms[0], score: 0 };
    platforms.forEach((platform, index) => {
      const aliases = platformAliases(platform).filter(alias => alias.length > 2);
      let score = aliases.reduce((sum, alias) => sum + (text.includes(alias) ? 18 : 0), 0);
      if (/(only|exclusively|originally|спочатку|лише|ексклюзивно)/i.test(text) && aliases.some(alias => text.includes(alias))) score += 36;
      score -= index * 0.35;
      if (score > best.score) best = { platform, score };
    });
    return best.score > 0 ? best.platform : platforms[0];
  }

  function titleKeywords(game) {
    return unique([game.title, game.originalTitle, ...(game.aliases || [])].filter(Boolean)
      .flatMap(v => normalizeLoose(v).split(' '))
      .filter(token => token.length >= 4 && !['the','and','from','with','game','video'].includes(token)));
  }

  function platformAliases(platform = '') {
    const p = normalizeLoose(platform);
    const map = {
      'playstation 2': ['playstation 2','sony playstation 2','ps2','ps 2'],
      'playstation 3': ['playstation 3','sony playstation 3','ps3','ps 3'],
      'playstation': ['playstation','sony playstation','ps1','psx'],
      'playstation portable': ['playstation portable','psp'],
      'playstation vita': ['playstation vita','ps vita','vita'],
      'nintendo ds': ['nintendo ds','nintendo dsi','ds','nds'],
      'nintendo 3ds': ['nintendo 3ds','3ds'],
      'wii': ['wii'],
      'wii u': ['wii u'],
      'gamecube': ['gamecube','nintendo gamecube','game cube','gc'],
      'nintendo gamecube': ['gamecube','nintendo gamecube','game cube','gc'],
      'nintendo switch': ['nintendo switch','switch'],
      'game boy': ['game boy','gb'],
      'game boy color': ['game boy color','gbc'],
      'game boy advance': ['game boy advance','gba'],
      'nintendo 64': ['nintendo 64','n64'],
      'super nintendo entertainment system': ['super nintendo entertainment system','super nintendo','snes'],
      'nintendo entertainment system': ['nintendo entertainment system','nes'],
      'windows': ['windows','pc'],
      'xbox 360': ['xbox 360'],
      'xbox one': ['xbox one'],
      'dreamcast': ['dreamcast'],
      'saturn': ['saturn','sega saturn'],
      'mega drive': ['mega drive','genesis','sega genesis'],
      'arcade game': ['arcade','arcade game']
    };
    return unique([p, ...(map[p] || [])].filter(Boolean));
  }

  function platformTerms(game) {
    return unique((game.platforms || []).slice(0, 3).flatMap(platformAliases));
  }

  function filenameMatchesTitleAndPlatform(name, game, requirePlatform = true, platform = getActivePlatform(game)) {
    const low = normalizeLoose(decodeURIComponent(String(name || '')));
    const score = titleMatchScore(low, game);
    const platformHit = platformAliases(platform).some(token => token && low.includes(token));
    return { titleHits: score >= 72 ? 1 : 0, titleScore: score, platformHit, ok: score >= 72 && (!requirePlatform || platformHit) };
  }

  async function commonsFileSearch(query, limit = 10) {
    const url = `https://commons.wikimedia.org/w/api.php?origin=*&action=query&format=json&list=search&srnamespace=6&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`;
    const data = await fetchJson(url, 3200);
    return (data.query?.search || []).map(x => x.title).filter(Boolean);
  }

  function getActivePlatform(game) {
    const platforms = game?.platforms || [];
    if (game?.selectedPlatform && platforms.includes(game.selectedPlatform)) return game.selectedPlatform;
    return platforms[0] || '';
  }

  function getMediaRecord(game, platform = getActivePlatform(game)) {
    game.mediaByPlatform ||= {};
    const key = platform || '_generic';
    game.mediaByPlatform[key] ||= { platform, boxart:null, screenshots:[], boxartSource:null, screenshotSource:null, boxartLoaded:false, screenshotsLoaded:false, boxartCheckedAt:0, screenshotsCheckedAt:0 };
    return game.mediaByPlatform[key];
  }

  function applyMediaRecord(game, platform = getActivePlatform(game)) {
    const media = getMediaRecord(game, platform);
    game.selectedPlatform = platform;
    game.boxart = media.boxart || null;
    game.screenshots = media.screenshots || [];
    game.screenshotsLoaded = !!media.screenshotsLoaded;
    game.mediaSource = media.boxartSource || null;
    return media;
  }

  function normalizePlatformKey(platform = '') {
    return normalizeLoose(platform)
      .replace(/^sony /,'')
      .replace(/^microsoft /,'')
      .replace(/^nintendo /,'nintendo ')
      .trim();
  }

  function libretroSystemFor(platform = '') {
    const p = normalizePlatformKey(platform);
    if (LIBRETRO_SYSTEMS[p]) return LIBRETRO_SYSTEMS[p];
    if (p === 'nintendo gamecube') return LIBRETRO_SYSTEMS['nintendo gamecube'];
    if (p === 'sony playstation') return LIBRETRO_SYSTEMS['playstation'];
    if (p === 'sony playstation 2') return LIBRETRO_SYSTEMS['playstation 2'];
    return null;
  }

  function isPcPlatform(platform = '') {
    const p = normalizeLoose(platform);
    return PC_PLATFORM_TOKENS.some(token => p === token || p.includes(token));
  }

  function cleanGameTitleForMedia(value = '') {
    return String(value)
      .replace(/\s*\(video game\)\s*$/i,'')
      .replace(/\s+/g,' ')
      .trim();
  }

  function thumbnailSafeName(value = '') {
    return String(value)
      .replace(/[\\/*:?"<>|]/g,'_')
      .replace(/\s+/g,' ')
      .trim();
  }

  function libretroTitleCandidates(game) {
    const bases = unique([game.originalTitle, game.title, ...(game.aliases || [])]
      .filter(Boolean)
      .map(cleanGameTitleForMedia)
      .flatMap(value => [
        value,
        value.replace(/[™®©]/g, '').trim(),
        value.replace(/[’‘]/g, "'"),
        value.replace(/\s*&\s*/g, ' and '),
        value.replace(/\s+and\s+/gi, ' & ')
      ]));
    const variants = [];
    for (const base of bases) {
      const article = base.match(/^(The|A|An)\s+(.+)$/i);
      const articleMoved = article ? `${article[2]}, ${article[1]}` : null;
      const punctuationVariants = unique([
        base,
        base.replace(/:\s*/g,' - '),
        base.replace(/\s+-\s+/g,': '),
        base.replace(/[.:]/g, ''),
        articleMoved,
        articleMoved?.replace(/:\s*/g,' - ')
      ]);
      for (const variant of punctuationVariants) {
        if (!variant) continue;
        variants.push(variant);
        for (const region of REGION_SUFFIXES) variants.push(`${variant} ${region}`);
      }
    }
    return unique(variants.map(thumbnailSafeName).filter(Boolean)).slice(0, 48);
  }

  function libretroRepoSlug(system) {
    return String(system).replace(/ /g, '_');
  }

  function libretroThumbnailUrls(system, folder, title) {
    const encodedTitle = encodeURIComponent(title);
    const encodedSystem = encodeURIComponent(system);
    const repo = libretroRepoSlug(system);
    return [
      `https://thumbnails.libretro.com/${encodedSystem}/${folder}/${encodedTitle}.png`,
      `https://raw.githubusercontent.com/libretro-thumbnails/${repo}/master/${folder}/${encodedTitle}.png`
    ];
  }

  function normalizeThumbnailMatchName(value = '') {
    return normalizeLoose(
      decodeURIComponent(String(value))
        .replace(/^.*\//, '')
        .replace(/\.png$/i, '')
        .replace(/\s*\((usa|europe|world|japan|asia|australia|korea|brazil|canada|france|germany|italy|spain|rev[^)]*|disc[^)]*|disk[^)]*|beta|proto|sample|demo|unl)[^)]*\)\s*/gi, ' ')
        .replace(/,\s*(the|a|an)$/i, ' $1')
        .replace(/[_]/g, ' ')
        .replace(/[^a-z0-9\u0400-\u04ff]+/gi, ' ')
    );
  }

  function libretroMatchScore(filename, game) {
    const candidate = normalizeThumbnailMatchName(filename);
    if (!candidate || titleInstallmentMismatch(candidate, game)) return 0;
    const titles = unique([game.originalTitle, game.title, ...(game.aliases || [])]
      .filter(Boolean)
      .map(cleanGameTitleForMedia)
      .flatMap(title => {
        const article = title.match(/^(The|A|An)\s+(.+)$/i);
        return [title, article ? `${article[2]}, ${article[1]}` : null];
      })
      .filter(Boolean)
      .map(normalizeThumbnailMatchName));
    let best = 0;
    for (const title of titles) {
      if (!title) continue;
      if (candidate === title) best = Math.max(best, 200);
      if (candidate.startsWith(`${title} `) || title.startsWith(`${candidate} `)) best = Math.max(best, 135);
      const titleTokens = title.split(' ').filter(token => token.length > 1);
      const candidateTokens = candidate.split(' ').filter(token => token.length > 1);
      if (!titleTokens.length || !candidateTokens.length) continue;
      const shared = titleTokens.filter(token => candidateTokens.includes(token)).length;
      const coverage = shared / titleTokens.length;
      const precision = shared / candidateTokens.length;
      const numberTokens = titleTokens.filter(token => /^\d+$/.test(token));
      const numberMismatch = numberTokens.some(token => !candidateTokens.includes(token));
      let score = coverage * 85 + precision * 45;
      if (` ${candidate} `.includes(` ${title} `) || ` ${title} `.includes(` ${candidate} `)) score += 28;
      if (numberMismatch) score -= 55;
      best = Math.max(best, score);
    }
    return best;
  }

  async function getLibretroTree(system) {
    if (!system) return null;
    if (libretroTreeCache.has(system)) return libretroTreeCache.get(system);
    const promise = (async () => {
      const repo = libretroRepoSlug(system);
      const url = `https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/master?recursive=1`;
      try {
        const data = await fetchJson(url, 5200);
        const paths = (data?.tree || [])
          .filter(item => item.type === 'blob' && /^(Named_Boxarts|Named_Snaps|Named_Titles)\/.+\.png$/i.test(item.path))
          .map(item => item.path);
        if (!paths.length) return null;
        return {
          repo,
          boxarts: paths.filter(path => path.startsWith('Named_Boxarts/')),
          snaps: paths.filter(path => path.startsWith('Named_Snaps/')),
          titles: paths.filter(path => path.startsWith('Named_Titles/'))
        };
      } catch (error) {
        console.warn('Libretro index failed', system, error);
        return null;
      }
    })();
    const safePromise = promise.then(value => {
      if (!value) libretroTreeCache.delete(system);
      return value;
    }, error => {
      libretroTreeCache.delete(system);
      throw error;
    });
    libretroTreeCache.set(system, safePromise);
    return safePromise;
  }

  function rawGithubThumbnailUrl(repo, path) {
    const encodedPath = String(path).split('/').map(part => encodeURIComponent(part)).join('/');
    return `https://raw.githubusercontent.com/libretro-thumbnails/${repo}/master/${encodedPath}`;
  }

  async function resolveLibretroIndexedImage(game, platform, type = 'boxart') {
    const system = libretroSystemFor(platform);
    if (!system) return null;
    const tree = await getLibretroTree(system);
    if (!tree) return null;
    const list = type === 'boxart' ? tree.boxarts : type === 'snap' ? tree.snaps : tree.titles;
    const ranked = list
      .map(path => ({ path, score:libretroMatchScore(path, game) }))
      .filter(item => item.score >= 82)
      .sort((a,b) => b.score - a.score)
      .slice(0,6);
    for (const item of ranked) {
      const url = rawGithubThumbnailUrl(tree.repo, item.path);
      const meta = await getImageMeta(url, 1700);
      if (!meta.ok) continue;
      if (type === 'boxart' && meta.height <= meta.width * 1.04) continue;
      if (type !== 'boxart' && meta.width < meta.height * .96) continue;
      return url;
    }
    return null;
  }

  async function firstWorkingImage(urls, validator = null, timeout = 1500, batchSize = 4) {
    const list = unique(urls);
    for (let i=0;i<list.length;i+=batchSize) {
      const batch=list.slice(i,i+batchSize);
      const checked=await Promise.all(batch.map(async url=>{
        const meta=await getImageMeta(url,timeout);
        return meta.ok && (!validator || validator(meta)) ? url : null;
      }));
      const found=checked.find(Boolean);
      if(found)return found;
    }
    return null;
  }

  async function withCooldown(promiseFactory, timeout, fallback) {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(promiseFactory),
        new Promise(resolve=>{timer=setTimeout(()=>resolve(fallback),timeout);})
      ]);
    } catch (_) {
      return fallback;
    } finally {
      clearTimeout(timer);
    }
  }

  function providerState(source) {
    if (!providerHealth.has(source)) providerHealth.set(source, { successes:0, failures:0, consecutiveFailures:0, latency:900, cooldownUntil:0 });
    return providerHealth.get(source);
  }

  function providerAvailable(provider) {
    return providerState(provider.source).cooldownUntil <= Date.now();
  }

  function providerRank(provider) {
    const health = providerState(provider.source);
    const successRate = health.successes / Math.max(1, health.successes + health.failures);
    return successRate * 100 - health.latency / 120 - health.consecutiveFailures * 18;
  }

  function recordProviderResult(provider, status, elapsed) {
    const health = providerState(provider.source);
    health.latency = health.latency * .72 + elapsed * .28;
    if (status === 'success') {
      health.successes++;
      health.consecutiveFailures = 0;
      health.cooldownUntil = 0;
      return;
    }
    if (status === 'miss') return;
    health.failures++;
    health.consecutiveFailures++;
    if (health.consecutiveFailures >= 2) {
      const multiplier = Math.min(4, health.consecutiveFailures - 1);
      health.cooldownUntil = Date.now() + PROVIDER_COOLDOWN_BASE_MS * multiplier;
    }
  }

  async function executeProvider(provider, accept) {
    if (!providerAvailable(provider)) return provider.fallback;
    const started = performance.now();
    let timer;
    let status = 'miss';
    try {
      const result = await Promise.race([
        Promise.resolve().then(provider.run).then(value => ({ type:'value', value })),
        new Promise(resolve => { timer = setTimeout(() => resolve({ type:'timeout', value:provider.fallback }), provider.timeout); })
      ]);
      if (result.type === 'timeout') status = 'timeout';
      else status = accept(result.value) ? 'success' : 'miss';
      recordProviderResult(provider, status, performance.now() - started);
      return result.value;
    } catch (_) {
      recordProviderResult(provider, 'error', performance.now() - started);
      return provider.fallback;
    } finally {
      clearTimeout(timer);
    }
  }

  async function runProviderChain(providers, accept) {
    for (const provider of providers) {
      const value = await executeProvider(provider, accept);
      if (accept(value)) return { value, source: provider.source };
    }
    return { value:null, source:null };
  }

  async function runProviderTiers(tiers, accept) {
    for (const tier of tiers) {
      const available = tier.filter(providerAvailable);
      const batch = available.length ? available : tier.slice(0,1);
      const values = await Promise.all(batch.map(provider => executeProvider(provider, accept)));
      for (let index = 0; index < batch.length; index++) {
        if (accept(values[index])) return { value: values[index], source: batch[index].source };
      }
    }
    return { value:null, source:null };
  }

  async function collectProviderResults(providers, maxItems = 8) {
    const values = [];
    const sources = [];
    for (let index = 0; index < providers.length; index += 2) {
      const batch = providers.slice(index, index + 2).filter(providerAvailable);
      if (!batch.length) continue;
      const results = await Promise.all(batch.map(provider => executeProvider(provider, result => Array.isArray(result) && result.some(Boolean))));
      results.forEach((result, batchIndex) => {
        const items = Array.isArray(result) ? result.filter(Boolean) : [];
        if (items.length) {
          values.push(...items);
          sources.push(batch[batchIndex].source);
        }
      });
      if (unique(values).length >= maxItems) break;
    }
    return { value:unique(values).slice(0,maxItems), source:unique(sources).join('+') || null };
  }

  async function resolveLibretroBoxArt(game, platform) {
    const system = libretroSystemFor(platform);
    if (!system) return null;
    setSourceState('libretro','loading');
    const urls = libretroTitleCandidates(game).slice(0,34).flatMap(title => libretroThumbnailUrls(system,'Named_Boxarts',title));
    const found = await firstWorkingImage(urls, meta => meta.height > meta.width * 1.05, 1250, 6);
    if (found) setSourceState('libretro','online');
    else if (state.sources.libretro === 'loading') setSourceState('libretro','idle');
    return found;
  }

  async function resolveLibretroIndexedBoxArt(game, platform) {
    setSourceState('libretro','loading');
    const found = await resolveLibretroIndexedImage(game, platform, 'boxart');
    if (found) setSourceState('libretro','online');
    else if (state.sources.libretro === 'loading') setSourceState('libretro','idle');
    return found;
  }

  async function resolveLibretroScreenshot(game, platform) {
    const system = libretroSystemFor(platform);
    if (!system) return [];
    setSourceState('libretro','loading');
    const titleCandidates = libretroTitleCandidates(game).slice(0,30);
    const snapUrls = titleCandidates.flatMap(title => libretroThumbnailUrls(system,'Named_Snaps',title));
    let found = await firstWorkingImage(snapUrls, meta => meta.width >= meta.height * .96, 1150, 6);
    if (!found) {
      const titleUrls = titleCandidates.flatMap(title => libretroThumbnailUrls(system,'Named_Titles',title));
      found = await firstWorkingImage(titleUrls, meta => meta.width >= meta.height * .96, 1050, 6);
    }
    if (found) {
      setSourceState('libretro','online');
      return [found];
    }
    if (state.sources.libretro === 'loading') setSourceState('libretro','idle');
    return [];
  }

  async function resolveLibretroIndexedScreenshots(game, platform) {
    setSourceState('libretro','loading');
    let found = await resolveLibretroIndexedImage(game, platform, 'snap');
    if (!found) found = await resolveLibretroIndexedImage(game, platform, 'title');
    if (found) {
      setSourceState('libretro','online');
      return [found];
    }
    if (state.sources.libretro === 'loading') setSourceState('libretro','idle');
    return [];
  }

  const steamTitleSearchCache = new Map();

  async function resolveSteamAppIdByTitle(game, platform) {
    if (!isPcPlatform(platform)) return null;
    if (game.steamAppId) return String(game.steamAppId);
    const key = normalizeLoose(game.originalTitle || game.title);
    if (steamTitleSearchCache.has(key)) return steamTitleSearchCache.get(key);
    const promise = (async () => {
      try {
        setSourceState('steam','loading');
        const query = encodeURIComponent(cleanGameTitleForMedia(game.originalTitle || game.title));
        const data = await fetchJson(`https://store.steampowered.com/api/storesearch/?term=${query}&l=english&cc=us`, 1900);
        const items = (data?.items || []).filter(item => item?.id && item?.name);
        const target = normalizeLoose(game.originalTitle || game.title);
        const ranked = items.map(item => {
          const name = normalizeLoose(item.name);
          let score = name === target ? 100 : 0;
          if (titleInstallmentMismatch(name, game)) score -= 160;
          if (name.includes(target) || target.includes(name)) score += 45;
          score += titleKeywords(game).filter(token => name.includes(token)).length * 8;
          return { item, score };
        }).sort((a,b) => b.score - a.score);
        const id = ranked[0]?.score >= 16 ? String(ranked[0].item.id) : null;
        if (id) {
          game.steamAppId = id;
          setSourceState('steam','online');
        } else if (state.sources.steam === 'loading') setSourceState('steam','idle');
        return id;
      } catch (_) {
        if (state.sources.steam === 'loading') setSourceState('steam','idle');
        return null;
      }
    })();
    steamTitleSearchCache.set(key, promise);
    return promise;
  }

  async function resolveSteamBoxArt(game, platform) {
    if (!isPcPlatform(platform)) return null;
    const resolvedId = await resolveSteamAppIdByTitle(game, platform);
    if (!resolvedId) return null;
    setSourceState('steam','loading');
    const id = encodeURIComponent(resolvedId);
    const candidates = [
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900_2x.jpg`,
      `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
      `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900_2x.jpg`
    ];
    const found = await firstWorkingImage(candidates, meta => meta.height > meta.width * 1.2, 1500, 2);
    if (found) setSourceState('steam','online');
    else if (state.sources.steam === 'loading') setSourceState('steam','idle');
    return found;
  }

  async function resolveSteamScreenshots(game, platform) {
    if (!isPcPlatform(platform)) return [];
    const resolvedId = await resolveSteamAppIdByTitle(game, platform);
    if (!resolvedId) return [];
    setSourceState('steam','loading');
    try {
      const id = encodeURIComponent(resolvedId);
      const data = await fetchJson(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=us`, 2300);
      const payload = data?.[resolvedId]?.data;
      const urls = (payload?.screenshots || []).map(item => item.path_full || item.path_thumbnail).filter(Boolean).slice(0,8);
      if (urls.length) setSourceState('steam','online');
      else setSourceState('steam','idle');
      return urls;
    } catch (_) {
      setSourceState('steam','error');
      return [];
    }
  }

  function isVisualNovelGame(game) {
    const haystack = normalizeLoose(`${(game.genres || []).join(' ')} ${game.description || ''}`);
    return /(visual novel|візуальна новела|interactive fiction|kinetic novel)/i.test(haystack);
  }

  function vndbPlatformCode(platform = '') {
    const value = normalizeLoose(platform);
    const map = {
      'windows':'win','linux':'lin','macos':'mac','mac os':'mac','dos':'dos',
      'playstation':'ps1','playstation 2':'ps2','playstation 3':'ps3','playstation 4':'ps4','playstation 5':'ps5',
      'playstation portable':'psp','playstation vita':'psv','nintendo ds':'nds','nintendo 3ds':'3ds','nintendo switch':'swi',
      'wii':'wii','wii u':'wiu','game boy':'gb','game boy color':'gbc','game boy advance':'gba',
      'xbox':'xbx','xbox 360':'x360','xbox one':'xone','xbox series x/s':'xsx','dreamcast':'dc','sega saturn':'sat'
    };
    return map[value] || null;
  }

  async function resolveVndbMedia(game, platform) {
    if (!isVisualNovelGame(game)) return { boxart:null, screenshots:[] };
    const key = `${normalizeLoose(game.originalTitle || game.title)}|${normalizeLoose(platform)}`;
    if (vndbMediaCache.has(key)) return vndbMediaCache.get(key);
    const promise = (async () => {
      setSourceState('vndb','loading');
      try {
        const data = await fetchJsonPost('https://api.vndb.org/kana/vn', {
          filters: ['search', '=', cleanGameTitleForMedia(game.originalTitle || game.title)],
          fields: 'title,alttitle,aliases,platforms,image.url,image.thumbnail,image.dims,image.sexual,image.violence,screenshots.url,screenshots.thumbnail,screenshots.dims,screenshots.sexual,screenshots.violence',
          sort: 'searchrank',
          results: 8
        }, 2600);
        const target = normalizeLoose(game.originalTitle || game.title);
        const platformCode = vndbPlatformCode(platform);
        const ranked = (data?.results || []).map(item => {
          const titles = [item.title, item.alttitle, ...(item.aliases || [])].filter(Boolean).map(normalizeLoose);
          let score = titles.some(title => title === target) ? 120 : 0;
          if (titles.every(title => titleInstallmentMismatch(title, game))) score -= 180;
          if (titles.some(title => title.includes(target) || target.includes(title))) score += 55;
          score += titleKeywords(game).filter(token => titles.some(title => title.includes(token))).length * 8;
          if (platformCode && item.platforms?.includes(platformCode)) score += 30;
          return { item, score };
        }).sort((a,b) => b.score - a.score);
        const item = ranked[0]?.score >= 28 ? ranked[0].item : null;
        if (!item) {
          setSourceState('vndb','idle');
          return { boxart:null, screenshots:[] };
        }
        const imageSafe = !item.image || ((item.image.sexual || 0) <= 1 && (item.image.violence || 0) <= 1.5);
        const boxart = imageSafe ? (item.image?.url || item.image?.thumbnail || null) : null;
        const screenshots = (item.screenshots || [])
          .filter(image => (image.sexual || 0) <= 1 && (image.violence || 0) <= 1.5)
          .map(image => image.url || image.thumbnail)
          .filter(Boolean)
          .slice(0, 8);
        if (boxart || screenshots.length) setSourceState('vndb','online');
        else setSourceState('vndb','idle');
        return { boxart, screenshots };
      } catch (_) {
        setSourceState('vndb','error');
        return { boxart:null, screenshots:[] };
      }
    })();
    const safePromise = promise.then(value => {
      if (!value?.boxart && !(value?.screenshots || []).length) vndbMediaCache.delete(key);
      return value;
    }, error => {
      vndbMediaCache.delete(key);
      throw error;
    });
    vndbMediaCache.set(key, safePromise);
    return safePromise;
  }

  async function resolveVndbBoxArt(game, platform) {
    const media = await resolveVndbMedia(game, platform);
    if (!media.boxart) return null;
    const meta = await getImageMeta(media.boxart, 1300);
    return meta.ok && meta.height > meta.width * 1.08 ? media.boxart : null;
  }

  async function resolveVndbScreenshots(game, platform) {
    const media = await resolveVndbMedia(game, platform);
    return media.screenshots || [];
  }

  function normalizeExternalImageUrl(url) {
    if (!url) return null;
    let value = String(url).trim();
    if (value.startsWith('//')) value = `https:${value}`;
    value = value.replace('{formatter}', 'product_card_v2_mobile_slider_639');
    return /^https?:/i.test(value) ? value : null;
  }

  async function resolveGogCatalogRecord(game, platform) {
    if (!isPcPlatform(platform)) return null;
    const key = normalizeLoose(game.originalTitle || game.title);
    if (gogCatalogCache.has(key)) return gogCatalogCache.get(key);
    const promise = (async () => {
      setSourceState('gog','loading');
      try {
        const title = cleanGameTitleForMedia(game.originalTitle || game.title);
        const url = `https://catalog.gog.com/v1/catalog?query=like:${encodeURIComponent(title)}&limit=12&countryCode=US&locale=en-US&currencyCode=USD`;
        const data = await fetchJson(url, 2400);
        const products = data?.products || data?.items || data?.results || [];
        const target = normalizeLoose(title);
        const ranked = products.map(product => {
          const productTitle = normalizeLoose(product.title || product.name || product.productTitle || '');
          let score = productTitle === target ? 120 : 0;
          if (titleInstallmentMismatch(productTitle, game)) score -= 180;
          if (productTitle.includes(target) || target.includes(productTitle)) score += 50;
          score += titleKeywords(game).filter(token => productTitle.includes(token)).length * 7;
          return { product, score };
        }).sort((a,b) => b.score - a.score);
        const product = ranked[0]?.score >= 24 ? ranked[0].product : null;
        if (product) setSourceState('gog','online');
        else setSourceState('gog','idle');
        return product;
      } catch (_) {
        setSourceState('gog','error');
        return null;
      }
    })();
    const safePromise = promise.then(value => {
      if (!value) gogCatalogCache.delete(key);
      return value;
    }, error => {
      gogCatalogCache.delete(key);
      throw error;
    });
    gogCatalogCache.set(key, safePromise);
    return safePromise;
  }

  async function resolveGogBoxArt(game, platform) {
    const product = await resolveGogCatalogRecord(game, platform);
    if (!product) return null;
    const candidates = unique([
      product.coverVertical,
      product.cover_vertical,
      product.images?.vertical,
      product.images?.coverVertical,
      product.image,
      product.cover
    ].map(normalizeExternalImageUrl));
    return firstWorkingImage(candidates, meta => meta.height > meta.width * 1.14, 1500, 2);
  }

  function extractExternalMediaUrls(value, depth = 0) {
    if (depth > 3 || value == null) return [];
    if (typeof value === 'string') {
      const url = normalizeExternalImageUrl(value);
      return url ? [url] : [];
    }
    if (Array.isArray(value)) return value.flatMap(item => extractExternalMediaUrls(item, depth + 1));
    if (typeof value === 'object') {
      return Object.entries(value)
        .filter(([key]) => /(screen|gallery|background|hero|image|media)/i.test(key))
        .flatMap(([, item]) => extractExternalMediaUrls(item, depth + 1));
    }
    return [];
  }

  async function resolveGogScreenshots(game, platform) {
    if (!isPcPlatform(platform)) return [];
    const product = await resolveGogCatalogRecord(game, platform);
    if (!product) return [];
    const candidates = unique([
      ...extractExternalMediaUrls(product.screenshots),
      ...extractExternalMediaUrls(product.gallery),
      ...extractExternalMediaUrls(product.media),
      ...extractExternalMediaUrls(product.images)
    ]).filter(url => !/(cover|logo|icon|product_card|vertical)/i.test(url)).slice(0,24);
    const found = [];
    for (let index = 0; index < candidates.length && found.length < 6; index += 4) {
      const batch = candidates.slice(index, index + 4);
      const results = await Promise.all(batch.map(async url => {
        const meta = await getImageMeta(url, 1400);
        return meta.ok && meta.width >= meta.height * 1.10 ? url : null;
      }));
      found.push(...results.filter(Boolean));
    }
    if (found.length) setSourceState('gog','online');
    return unique(found).slice(0,6);
  }

  async function resolvePcGamingWikiBoxArt(game, platform) {
    if (!isPcPlatform(platform)) return null;
    setSourceState('pcgamingwiki','loading');
    try {
      const title = cleanGameTitleForMedia(game.originalTitle || game.title);
      const search = `intitle:"${title.replace(/"/g, '')}"`;
      const url = `https://www.pcgamingwiki.com/w/api.php?origin=*&action=query&format=json&formatversion=2&generator=search&gsrnamespace=0&gsrlimit=4&gsrsearch=${encodeURIComponent(search)}&prop=pageimages&piprop=thumbnail&pithumbsize=1000`;
      const data = await fetchJson(url, 2300);
      const candidates = (data.query?.pages || [])
        .filter(page => titleMatchScore(page.title || '', game) >= 72 && !titleInstallmentMismatch(page.title || '', game))
        .map(page => page.thumbnail?.source)
        .filter(Boolean);
      const found = await firstWorkingImage(candidates, meta => meta.height > meta.width * 1.08, 1500, 2);
      if (found) setSourceState('pcgamingwiki','online');
      else setSourceState('pcgamingwiki','idle');
      return found;
    } catch (_) {
      setSourceState('pcgamingwiki','error');
      return null;
    }
  }

  async function getCommonsCategoryFiles(game) {
    const category = String(game.commonsCategory || '').trim();
    if (!category) return [];
    const title = category.startsWith('Category:') ? category : `Category:${category}`;
    try {
      const url = `https://commons.wikimedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&list=categorymembers&cmnamespace=6&cmtype=file&cmlimit=80&cmtitle=${encodeURIComponent(title)}`;
      const data = await fetchJson(url, 2300);
      return (data.query?.categorymembers || []).map(item => item.title).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  async function commonsImageInfo(fileTitles, width = 1200) {
    if (!fileTitles?.length) return [];
    try {
      const url = `https://commons.wikimedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=${width}&titles=${encodeURIComponent(fileTitles.slice(0,25).join('|'))}`;
      const data = await fetchJson(url, 2400);
      return (data.query?.pages || []).map(page => ({ title:page.title || '', info:page.imageinfo?.[0] })).filter(item => item.info);
    } catch (_) {
      return [];
    }
  }

  function filenameMentionsOtherPlatform(filename, game, platform) {
    const low = normalizeLoose(filename);
    const selected = platformAliases(platform);
    if (selected.some(token => token && low.includes(token))) return false;
    return (game.platforms || [])
      .filter(item => item !== platform)
      .flatMap(platformAliases)
      .some(token => token && low.includes(token));
  }

  async function resolveCommonsCategoryBoxArt(game, platform) {
    const files = await getCommonsCategoryFiles(game);
    const likely = files
      .filter(name => /\.(jpe?g|png|webp)$/i.test(name))
      .filter(name => /(cover|box.?art|packshot|jacket|front cover|game cover|case)/i.test(name))
      .filter(name => !filenameMentionsOtherPlatform(name, game, platform))
      .slice(0,20);
    if (!likely.length) return null;
    const infos = await commonsImageInfo(likely, 1000);
    const ranked = infos
      .filter(item => (item.info.mime || '').startsWith('image/'))
      .filter(item => (item.info.height || 0) > (item.info.width || 0) * 1.04)
      .map(item => {
        const low = normalizeLoose(item.title);
        let score = 30;
        if (platformAliases(platform).some(token => token && low.includes(token))) score += 45;
        if (titleKeywords(game).some(token => low.includes(token))) score += 25;
        if (/box.?art|cover/i.test(item.title)) score += 20;
        return { url:item.info.thumburl || item.info.url, score };
      })
      .sort((a,b) => b.score - a.score);
    if (ranked[0]?.url) setSourceState('wikimedia','online');
    return ranked[0]?.url || null;
  }

  async function resolveCommonsCategoryScreenshots(game, platform) {
    const files = await getCommonsCategoryFiles(game);
    const candidates = files
      .filter(name => /\.(jpe?g|png|webp)$/i.test(name))
      .filter(name => !/(logo|icon|cover|box.?art|poster|packshot|jacket|rating|esrb|pegi|promotional art)/i.test(name))
      .filter(name => !filenameMentionsOtherPlatform(name, game, platform))
      .slice(0,25);
    if (!candidates.length) return [];
    const infos = await commonsImageInfo(candidates, 1200);
    const ranked = infos
      .filter(item => (item.info.mime || '').startsWith('image/'))
      .filter(item => (item.info.width || 0) >= (item.info.height || 0) * .98)
      .map(item => {
        const low = normalizeLoose(item.title);
        let score = 10;
        if (/(screen|screenshot|gameplay|in game|ingame|battle|scene)/i.test(item.title)) score += 45;
        if (platformAliases(platform).some(token => token && low.includes(token))) score += 25;
        if (titleKeywords(game).some(token => low.includes(token))) score += 18;
        return { url:item.info.thumburl || item.info.url, score };
      })
      .filter(item => item.score >= 20)
      .sort((a,b) => b.score - a.score)
      .map(item => item.url);
    if (ranked.length) setSourceState('wikimedia','online');
    return unique(ranked).slice(0,6);
  }

  async function ensurePlatformMedia(game, platform = getActivePlatform(game), includeScreenshots = false) {
    if (!game) return null;
    const media = getMediaRecord(game, platform);
    const now = Date.now();
    const retryBoxArt = !media.boxart && (!media.boxartCheckedAt || now - media.boxartCheckedAt > NEGATIVE_MEDIA_RETRY_MS);
    if (!media.boxartLoaded || retryBoxArt) {
      const resolved = await resolveBestBoxArt(game, platform);
      media.boxart = resolved?.url || null;
      media.boxartSource = resolved?.source || null;
      media.boxartLoaded = true;
      media.boxartCheckedAt = now;
    }
    const retryScreens = (!media.screenshots || !media.screenshots.length) && (!media.screenshotsCheckedAt || now - media.screenshotsCheckedAt > NEGATIVE_MEDIA_RETRY_MS);
    if (includeScreenshots && (!media.screenshotsLoaded || retryScreens)) {
      const result = await resolveBestScreenshots(game, platform, 8);
      media.screenshots = unique(result.value || []).slice(0,8);
      media.screenshotSource = result.source;
      media.screenshotsLoaded = true;
      media.screenshotsCheckedAt = now;
    }
    applyMediaRecord(game, platform);
    cacheGame(game);
    return media;
  }

  function entityToGame(entity,labels,searchHit) {
    const title=resolveEntityGameTitle(entity,searchHit) || 'Назва уточнюється';
    const enTitle=entity.labels?.en?.value;
    const dates=claimTimes(entity,'P577');
    const year=dates.map(t=>Number((t.match(/[+-](\d{4})/)||[])[1])).filter(Boolean).sort()[0]||null;
    const image=claimStrings(entity,'P18')[0];
    const cover=image?commonsImageUrl(image,900):null;
    const platforms = sanitizeNamedList(claimEntityIds(entity,'P400').map(id=>labels[id]||id), 'platform');
    const genres = sanitizeNamedList(claimEntityIds(entity,'P136').map(id=>labels[id]||id));
    const developers = sanitizeNamedList(claimEntityIds(entity,'P178').map(id=>labels[id]||id));
    const publishers = sanitizeNamedList(claimEntityIds(entity,'P123').map(id=>labels[id]||id));
    const series = sanitizeNamedList(claimEntityIds(entity,'P179').map(id=>labels[id]||id));
    const steamAppId = claimStrings(entity,'P1733')[0] || null;
    const aliases = unique([...(entity.aliases?.uk || []), ...(entity.aliases?.en || [])].map(item => item.value).filter(Boolean)).slice(0, 16);
    return {
      id:entity.id,
      title,
      originalTitle:enTitle||title,
      aliases,
      description:pickDescription(entity)||searchHit?.description||'',
      year,
      platforms,
      genres,
      developers,
      publishers,
      series,
      steamAppId,
      commonsCategory: claimStrings(entity,'P373')[0] || null,
      cover,
      coverFilename: image || null,
      mediaByPlatform:{},
      selectedPlatform: inferPrimaryPlatform(platforms, pickDescription(entity) || searchHit?.description || ''),
      source:'wikidata',
      sitelinks:{
        ukwiki:entity.sitelinks?.ukwiki?.title,
        enwiki:entity.sitelinks?.enwiki?.title
      }
    };
  }

  async function enrichFromWikipedia(game,lightweight=false) {
    const language=game.sitelinks.ukwiki?'uk':game.sitelinks.enwiki?'en':null;
    if (!language) return game;
    const title=game.sitelinks[`${language}wiki`];
    try {
      setSourceState('wikipedia','loading');
      const url=`https://${language}.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=extracts|pageimages&exintro=1&explaintext=1&exchars=${lightweight?700:1800}&piprop=thumbnail&pithumbsize=900&titles=${encodeURIComponent(title)}`;
      const data=await fetchJson(url,10000);
      const page=data.query?.pages?.[0];
      if (page?.extract && page.extract.length>game.description.length) game.description=cleanExtract(page.extract);
      if (!game.cover && page?.thumbnail?.source) { game.cover = page.thumbnail.source; game.coverFilename = extractFilenameFromUrl(page.thumbnail.source); }
      setSourceState('wikipedia','online');
      if (game.cover) setSourceState('wikimedia','online');
    } catch (error) {
      console.warn('Wikipedia enrichment failed',game.title,error);
      setSourceState('wikipedia','error');
    }
    return game;
  }

  function cleanExtract(text) {
    return text.replace(/\s+/g,' ').replace(/\[\d+\]/g,' ').trim();
  }

  const imageAspectCache = new Map();
  const boxArtSearchCache = new Map();

  async function finalizeArtFields(game) {
    const platform = getActivePlatform(game);
    await ensurePlatformMedia(game, platform, false);
    game.screenshots ||= [];
    return game;
  }

  function mediaPlatformCandidates(game, platform = getActivePlatform(game)) {
    const primary = inferPrimaryPlatform(game.platforms || [], game.description || '');
    return unique([
      platform,
      primary,
      ...(game.platforms || []),
      game.originalPlatform || null
    ].filter(Boolean));
  }

  async function resolveBestBoxArtForPlatform(game, platform = getActivePlatform(game)) {
    const result = await runProviderTiers([
      [
        {source:'libretro',timeout:3400,fallback:null,run:()=>resolveLibretroBoxArt(game,platform)},
        ...(isPcPlatform(platform) ? [{source:'steam',timeout:2700,fallback:null,run:()=>resolveSteamBoxArt(game,platform)}] : []),
        {source:'wikidata',timeout:1400,fallback:null,run:()=>resolveDirectEntityBoxArt(game,platform)}
      ],
      [
        {source:'libretro-index',timeout:7600,fallback:null,run:()=>resolveLibretroIndexedBoxArt(game,platform)},
        ...(isPcPlatform(platform) ? [
          {source:'gog',timeout:3600,fallback:null,run:()=>resolveGogBoxArt(game,platform)},
          {source:'pcgamingwiki',timeout:3400,fallback:null,run:()=>resolvePcGamingWikiBoxArt(game,platform)}
        ] : []),
        ...(isVisualNovelGame(game) ? [{source:'vndb',timeout:3800,fallback:null,run:()=>resolveVndbBoxArt(game,platform)}] : [])
      ],
      [
        {source:'wikipedia-uk',timeout:3400,fallback:null,run:()=>resolveWikipediaPageImage(game,platform,'uk')},
        {source:'wikipedia-en',timeout:3400,fallback:null,run:()=>resolveWikipediaPageImage(game,platform,'en')}
      ],
      [
        ...(game.commonsCategory ? [{source:'wikimedia-category',timeout:3800,fallback:null,run:()=>resolveCommonsCategoryBoxArt(game,platform)}] : []),
        {source:'wikimedia',timeout:3800,fallback:null,run:()=>searchCommonsBoxArt(game,platform)},
        {source:'wikipedia',timeout:3400,fallback:null,run:()=>searchBoxArtFromArticle(game,platform)}
      ]
    ], value=>typeof value==='string'&&value.length>0);
    return result.value ? {url:result.value,source:result.source,platform} : null;
  }

  async function resolveBestBoxArt(game, platform = getActivePlatform(game)) {
    for (const candidatePlatform of mediaPlatformCandidates(game, platform)) {
      const result = await resolveBestBoxArtForPlatform(game, candidatePlatform);
      if (result?.url) {
        if (candidatePlatform !== platform) result.source = `${result.source}@${candidatePlatform}`;
        return result;
      }
    }
    return null;
  }

  async function resolveBestScreenshots(game, platform = getActivePlatform(game), maxItems = 8) {
    for (const candidatePlatform of mediaPlatformCandidates(game, platform)) {
      const screenshotProviders = [
        {source:'libretro',timeout:3200,fallback:[],run:()=>resolveLibretroScreenshot(game,candidatePlatform)},
        ...(isPcPlatform(candidatePlatform) ? [
          {source:'steam',timeout:3000,fallback:[],run:()=>resolveSteamScreenshots(game,candidatePlatform)},
          {source:'gog',timeout:3600,fallback:[],run:()=>resolveGogScreenshots(game,candidatePlatform)}
        ] : []),
        ...(isVisualNovelGame(game) ? [{source:'vndb',timeout:3800,fallback:[],run:()=>resolveVndbScreenshots(game,candidatePlatform)}] : []),
        ...(game.commonsCategory ? [{source:'wikimedia-category',timeout:3600,fallback:[],run:()=>resolveCommonsCategoryScreenshots(game,candidatePlatform)}] : []),
        {source:'wikimedia',timeout:3600,fallback:[],run:()=>searchCommonsScreenshots(game,candidatePlatform)},
        {source:'wikipedia-uk',timeout:3400,fallback:[],run:()=>resolveWikipediaArticleScreenshots(game,candidatePlatform,'uk')},
        {source:'wikipedia-en',timeout:3400,fallback:[],run:()=>resolveWikipediaArticleScreenshots(game,candidatePlatform,'en')},
        {source:'libretro-index',timeout:7600,fallback:[],run:()=>resolveLibretroIndexedScreenshots(game,candidatePlatform)}
      ];
      const result = await collectProviderResults(screenshotProviders, maxItems);
      const value = unique(result.value || []).slice(0, maxItems);
      if (value.length) {
        return {
          value,
          source: candidatePlatform !== platform ? `${result.source}@${candidatePlatform}` : result.source,
          platform: candidatePlatform
        };
      }
    }
    return { value:[], source:null, platform };
  }

  async function resolveDirectEntityBoxArt(game, platform) {
    const url=game.cover;
    if(!url)return null;
    const meta=await getImageMeta(url,2400);
    if(!meta.ok || meta.height<=meta.width*1.10)return null;
    const low=decodeURIComponent(String(game.coverFilename||extractFilenameFromUrl(url))).toLowerCase();
    if(/(logo|wordmark|icon|symbol|screenshot|gameplay|title[-_ ]?screen|map)/i.test(low) || titleInstallmentMismatch(low, game))return null;
    const normalized=normalizeLoose(low);
    const otherPlatformHit=(game.platforms||[]).filter(p=>p!==platform).flatMap(platformAliases).some(token=>token&&normalized.includes(token));
    if(otherPlatformHit)return null;
    return url;
  }

  async function resolveWikipediaPageImage(game, platform, language) {
    const title=await ensureWikipediaArticleTitle(game, language, platform);
    if(!title)return null;
    try{
      const url=`https://${language}.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=pageimages&piprop=thumbnail&pithumbsize=1000&titles=${encodeURIComponent(title)}`;
      const data=await fetchJson(url,3200);
      const candidate=data.query?.pages?.[0]?.thumbnail?.source;
      if(!candidate)return null;
      const meta=await getImageMeta(candidate,2200);
      if(!meta.ok||meta.height<=meta.width*1.08)return null;
      const filename = extractFilenameFromUrl(candidate);
      if (filenameMentionsOtherPlatform(filename, game, platform) || titleInstallmentMismatch(filename, game)) return null;
      return candidate;
    }catch(_){return null;}
  }

  async function searchCommonsBoxArt(game, platform = getActivePlatform(game)) {
    const titleCandidates = unique([game.originalTitle, game.title, ...(game.aliases || [])].filter(Boolean).map(cleanGameTitleForMedia)).slice(0, 4);
    const queries = [];
    for (const title of titleCandidates) {
      if (platform) {
        queries.push(`${title} ${platform} cover`);
        queries.push(`${title} ${platform} box art`);
        queries.push(`${title} ${platform} front cover`);
      }
      queries.push(`${title} cover`);
      queries.push(`${title} box art`);
      queries.push(`${title} video game cover`);
      if (game.year) queries.push(`${title} ${game.year} cover`);
    }
    const fileTitles = [];
    for (const query of unique(queries)) {
      try { fileTitles.push(...await commonsFileSearch(query, 8)); } catch (_) {}
      if (fileTitles.length >= 10) break;
    }
    const filtered = unique(fileTitles).filter(name => isLikelyCoverName(name, game, platform)).slice(0, 10);
    if (!filtered.length) return null;
    const infoUrl = `https://commons.wikimedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1000&titles=${encodeURIComponent(filtered.join('|'))}`;
    const info = await fetchJson(infoUrl, 2100);
    const candidates = (info.query?.pages || []).map(p => p.imageinfo?.[0]).filter(Boolean).map(ii => ({ url: ii.thumburl || ii.url, filename: extractFilenameFromUrl(ii.thumburl || ii.url) }));
    for (const candidate of candidates) {
      if (await isLikelyBoxArt(candidate.url, candidate.filename, game, true, platform)) return candidate.url;
    }
    return null;
  }

  async function searchBoxArtFromArticle(game, platform = getActivePlatform(game)) {
    const key = `${game.id}|${platform}`;
    if (boxArtSearchCache.has(key)) return boxArtSearchCache.get(key);
    const promise = (async () => {
      let language = game.sitelinks?.ukwiki ? 'uk' : game.sitelinks?.enwiki ? 'en' : 'en';
      let title = await ensureWikipediaArticleTitle(game, language, platform);
      if (!title && language !== 'uk') {
        language = 'uk';
        title = await ensureWikipediaArticleTitle(game, language, platform);
      }
      if (!title) return null;
      try {
        const api = `https://${language}.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=images&imlimit=40&titles=${encodeURIComponent(title)}`;
        const data = await fetchJson(api, 1900);
        const names = (data.query?.pages?.[0]?.images || []).map(x => x.title).filter(name => isLikelyArticleCoverName(name, game, platform)).slice(0, 12);
        if (!names.length) return null;
        const infoUrl = `https://${language}.wikipedia.org/w/api.php?origin=*&action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1000&titles=${encodeURIComponent(names.join('|'))}`;
        const info = await fetchJson(infoUrl, 2100);
        const candidates = (info.query?.pages || []).map(p => p.imageinfo?.[0]).filter(Boolean).map(ii => ({ url: ii.thumburl || ii.url, filename: extractFilenameFromUrl(ii.thumburl || ii.url) }));
        for (const candidate of candidates) {
          if (await isLikelyBoxArt(candidate.url, candidate.filename, game, true, platform)) return candidate.url;
        }
      } catch (_) {}
      return null;
    })();
    boxArtSearchCache.set(key, promise);
    return promise;
  }

  function isLikelyArticleCoverName(name = '', game, platform = getActivePlatform(game)) {
    const low = decodeURIComponent(String(name)).toLowerCase();
    if (!/\.(jpe?g|png|webp)$/i.test(low)) return false;
    if (/(logo|wordmark|icon|symbol|sprite|screenshot|gameplay|title[-_ ]?screen|titlecard|map|artwork|concept)/i.test(low)) return false;
    if (titleInstallmentMismatch(low, game) || filenameMentionsOtherPlatform(low, game, platform)) return false;
    return /(cover|box.?art|packshot|front|case|jacket|box|poster)/i.test(low);
  }

  function isLikelyCoverName(name = '', game, platform = getActivePlatform(game)) {
    const low = decodeURIComponent(String(name)).toLowerCase();
    if (!/\.(jpe?g|png|webp)$/i.test(low)) return false;
    if (/(logo|wordmark|icon|symbol|sprite|screenshot|gameplay|title[-_ ]?screen|titlecard|map|artwork|concept)/i.test(low) || titleInstallmentMismatch(low, game)) return false;
    const hasCoverHint = /(cover|box.?art|packshot|front|case|jacket|box|poster)/i.test(low);
    const match=filenameMatchesTitleAndPlatform(low,game,false,platform);
    if(!hasCoverHint||!match.titleHits)return false;
    const normalized=normalizeLoose(low);
    const selectedHit=platformAliases(platform).some(token=>token&&normalized.includes(token));
    const otherHit=(game.platforms||[]).filter(p=>p!==platform).flatMap(platformAliases).some(token=>token&&normalized.includes(token));
    return !otherHit && (selectedHit || !platformTerms(game).some(token=>token&&normalized.includes(token)));
  }

  async function isLikelyBoxArt(url, filename = '', game, requireCoverHint = false, platform = getActivePlatform(game)) {
    const meta = await getImageMeta(url);
    if (!meta.ok) return false;
    const portrait = meta.height > meta.width * 1.08 && meta.width / meta.height < 0.90;
    if (!portrait) return false;
    const low = decodeURIComponent(String(filename || extractFilenameFromUrl(url))).toLowerCase();
    if (/(logo|wordmark|icon|symbol|screenshot|gameplay|title[-_ ]?screen|titlecard|map)/i.test(low) || titleInstallmentMismatch(low, game)) return false;
    const hasPositive = /(cover|box.?art|packshot|front|case|jacket|poster)/i.test(low);
    const match = filenameMatchesTitleAndPlatform(low, game, false, platform);
    if (!match.titleHits) return false;
    const normalized = normalizeLoose(low);
    const selectedHit = platformAliases(platform).some(token => token && normalized.includes(token));
    const otherHit = (game.platforms || []).filter(item => item !== platform).flatMap(platformAliases).some(token => token && normalized.includes(token));
    if (otherHit && !selectedHit) return false;
    if (requireCoverHint) return hasPositive;
    return hasPositive || (!/wikipedia|wikimedia|commons/i.test(url));
  }

  function extractFilenameFromUrl(url = '') {
    const match = String(url).match(/([^/?#]+)(?:\?|#|$)/);
    return match ? match[1] : '';
  }

  function getImageMeta(url, timeout=2600) {
    if (!url) return Promise.resolve({ ok:false, width:0, height:0 });
    const key=`${url}|${timeout}`;
    if (imageAspectCache.has(key)) return imageAspectCache.get(key);
    const promise = new Promise(resolve => {
      const img = new Image();
      let settled=false;
      const done = payload => {
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        if (!payload.ok) imageAspectCache.delete(key);
        resolve(payload);
      };
      const timer=setTimeout(()=>{img.src='';done({ok:false,width:0,height:0,timeout:true});},timeout);
      img.onload = () => done({ ok:true, width:img.naturalWidth || img.width, height:img.naturalHeight || img.height });
      img.onerror = () => done({ ok:false, width:0, height:0 });
      img.src = url;
    });
    imageAspectCache.set(key, promise);
    return promise;
  }
  function commonsImageUrl(filename,width=900) {
    return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename.replace(/ /g,'_'))}?width=${width}`;
  }

  function claimEntityIds(entity,prop) {
    return (entity.claims?.[prop]||[]).map(c=>c.mainsnak?.datavalue?.value?.id).filter(Boolean);
  }
  function claimStrings(entity,prop) {
    return (entity.claims?.[prop]||[]).map(c=>c.mainsnak?.datavalue?.value).filter(x=>typeof x==='string');
  }
  function claimTimes(entity,prop) {
    return (entity.claims?.[prop]||[]).map(c=>c.mainsnak?.datavalue?.value?.time).filter(Boolean);
  }
  function pickLabel(entity,fallback) { return chooseBestGameTitle([entity.labels?.uk?.value,entity.labels?.en?.value,entity.sitelinks?.ukwiki?.title,entity.sitelinks?.enwiki?.title,fallback]) || ''; }
  function pickDescription(entity) { return entity.descriptions?.uk?.value||entity.descriptions?.en?.value||''; }

  function cacheGame(game) {
    state.cache.games[game.id]=snapshotGame(game);
  }
  function trimCache() {
    const entries=Object.entries(state.cache.games);
    if (entries.length>180) {
      const keep=new Set([...Object.keys(state.collection),...state.recent.map(x=>x.id)]);
      for (const [id] of entries) {
        if (Object.keys(state.cache.games).length<=180) break;
        if (!keep.has(id)) delete state.cache.games[id];
      }
    }
    const queryEntries=Object.entries(state.cache.queries).sort((a,b)=>b[1].time-a[1].time);
    state.cache.queries=Object.fromEntries(queryEntries.slice(0,50));
  }

  function snapshotGame(game) {
    return JSON.parse(JSON.stringify({
      id:game.id,title:game.title,originalTitle:game.originalTitle,aliases:game.aliases||[],description:game.description,year:game.year,
      platforms:game.platforms||[],genres:game.genres||[],developers:game.developers||[],publishers:game.publishers||[],series:game.series||[],
      steamAppId:game.steamAppId||null,commonsCategory:game.commonsCategory||null,selectedPlatform:getActivePlatform(game),mediaByPlatform:game.mediaByPlatform||{},
      cover:game.cover,boxart:game.boxart||null,coverFilename:game.coverFilename||null,screenshots:game.screenshots||[],screenshotsLoaded:game.screenshotsLoaded||false,source:game.source,sitelinks:game.sitelinks||{}
    }));
  }

  async function fetchJson(url,timeout=10000) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try {
      const response=await fetch(url,{signal:controller.signal,headers:{'Accept':'application/json'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function fetchJsonPost(url, body, timeout=3000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }

  async function loadImageWithTimeout(url, timeout=4600) {
    let src = url;
    let objectUrl = null;
    if (/^https?:/i.test(src)) {
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), Math.max(1500, timeout - 700));
      try {
        const response = await fetch(src, { signal: controller.signal, mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        src = objectUrl;
      } catch (error) {
        src = url;
      } finally {
        clearTimeout(fetchTimer);
      }
    }
    return await new Promise((resolve,reject)=>{
      const img = new Image();
      if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
      const timer = setTimeout(()=>{
        img.src = '';
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error('image timeout'));
      }, timeout);
      img.onload = ()=>{
        clearTimeout(timer);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = ()=>{
        clearTimeout(timer);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(new Error('image failed'));
      };
      img.src = src;
    });
  }

  function readJson(key,fallback) { try { const value=localStorage.getItem(key); return value?JSON.parse(value):fallback; } catch (_) { return fallback; } }
  function writeJson(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch (error) { console.warn('storage',error); } }
  function unique(arr) { return [...new Set(arr.filter(Boolean))]; }
  function uniqueById(arr) { const m=new Map(); arr.filter(Boolean).forEach(x=>{ if(!m.has(x.id))m.set(x.id,x); }); return [...m.values()]; }
  function shuffle(arr) { for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
  function localeSort(a,b) { return a.localeCompare(b,'uk'); }
  function joinOrUnknown(arr) { return arr?.length?arr.join(', '):'Немає даних'; }
  function formatDate(time) { return new Intl.DateTimeFormat('uk-UA',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(time)); }
  function formatDateTime(time) { return new Intl.DateTimeFormat('uk-UA',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(time)); }
  async function mapLimit(items,limit,mapper) {
    const result=new Array(items.length); let index=0;
    const workers=Array.from({length:Math.min(limit,items.length)},async()=>{ while(true){ const i=index++; if(i>=items.length)return; result[i]=await mapper(items[i],i); }});
    await Promise.all(workers); return result;
  }
  function escapeHtml(value='') { return String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function escapeAttr(value='') { return escapeHtml(value).replace(/'/g,'&#39;'); }
  function escapeXml(value='') { return escapeHtml(value).replace(/'/g,'&apos;'); }
  function toast(message) {
    let node=document.querySelector('.toast');
    if(!node){node=document.createElement('div');node.className='toast';document.body.appendChild(node);}
    node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),2200);
  }

  const PREMIUM_VS = `attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUv;uniform mat4 uModel;uniform mat4 uViewProj;varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUv;void main(){vec4 w=uModel*vec4(aPosition,1.0);vWorld=w.xyz;vNormal=normalize(mat3(uModel)*aNormal);vUv=aUv;gl_Position=uViewProj*w;}`;
  const PREMIUM_FS = `precision mediump float;varying vec3 vNormal;varying vec3 vWorld;varying vec2 vUv;uniform vec3 uColor;uniform float uMetal;uniform float uRough;uniform bool uTextured;uniform sampler2D uTexture;uniform vec3 uCamera;void main(){vec3 base=uTextured?texture2D(uTexture,vUv).rgb:uColor;vec3 n=normalize(vNormal);vec3 v=normalize(uCamera-vWorld);float nv=abs(dot(n,v));vec3 keyDir=normalize(vec3(0.34,0.58,0.74));vec3 fillDir=normalize(vec3(-0.44,0.30,0.84));float key=abs(dot(n,keyDir));float fill=abs(dot(n,fillDir));float top=abs(n.y);float side=abs(n.x);vec3 h=normalize(keyDir+v);float spec=pow(abs(dot(n,h)),mix(68.0,18.0,uRough))*mix(0.04,0.16,uMetal);float rim=pow(1.0-nv,2.0)*(0.035+side*0.035);vec3 col;if(uTextured){float light=0.86+key*0.11+fill*0.06+nv*0.05;col=base*light;}else{float light=0.62+key*0.22+fill*0.13+nv*0.08+top*0.05;col=base*light+vec3(1.0,0.92,0.82)*spec+vec3(0.20,0.32,0.54)*rim;}col=max(col,base*0.42);col=clamp(col,0.0,1.0);gl_FragColor=vec4(pow(col,vec3(0.94)),1.0);}`;

  function premiumMaterialColor(role, material, fallback) {
    if (material === 'gold pin') return [0.88, 0.75, 0.32];
    if (material === 'cartridge mat') return [0.52, 0.56, 0.63];
    if (material === 'slot mat') return [0.46, 0.50, 0.57];
    return fallback;
  }

  function meshBounds(model, role) {
    const bounds = { minX:Infinity,minY:Infinity,minZ:Infinity,maxX:-Infinity,maxY:-Infinity,maxZ:-Infinity };
    for (const mesh of model.meshes || []) {
      if (mesh.role !== role) continue;
      for (const group of mesh.groups || []) {
        const vertices = group.vertices || [];
        for (let i=0;i<vertices.length;i+=8) {
          const x=vertices[i],y=vertices[i+1],z=vertices[i+2];
          bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);
          bounds.minY=Math.min(bounds.minY,y);bounds.maxY=Math.max(bounds.maxY,y);
          bounds.minZ=Math.min(bounds.minZ,z);bounds.maxZ=Math.max(bounds.maxZ,z);
        }
      }
    }
    if (!Number.isFinite(bounds.minY)) return { center:[0,0,0] };
    return { ...bounds, center:[(bounds.minX+bounds.maxX)/2,(bounds.minY+bounds.maxY)/2,(bounds.minZ+bounds.maxZ)/2] };
  }

  function centeredCartridgeModel(center, translateY, rx, ry, scale=1) {
    const [cx,cy,cz]=center || [0,0,0];
    const pivotIn=mat4Translate(-cx,-cy,-cz);
    const transform=mat4Mul(mat4RotateX(rx),mat4Mul(mat4RotateY(ry),mat4Scale(scale)));
    const pivotOut=mat4Translate(cx,cy,cz);
    return mat4Mul(mat4Translate(0,translateY,0),mat4Mul(pivotOut,mat4Mul(transform,pivotIn)));
  }


  class SharedCartridgePreview {
    static rendererPromise = null;
    static cache = new Map();
    static maxCache = 24;
    static queue = Promise.resolve();
    static async getRenderer() {
      if (!this.rendererPromise) {
        this.rendererPromise = (window.SAVE_SLOT_MODEL ? Promise.resolve(window.SAVE_SLOT_MODEL) : fetch('assets/model.json').then(r => r.json()).then(model => (window.SAVE_SLOT_MODEL = model)))
          .then(model => {
            const canvas = document.createElement('canvas');
            canvas.width = 300; canvas.height = 392;
            canvas.className = 'preview-render-canvas';
            canvas.style.position = 'fixed';
            canvas.style.left = '-9999px';
            canvas.style.top = '-9999px';
            canvas.style.pointerEvents = 'none';
            document.body.appendChild(canvas);
            return new SharedCartridgePreview(canvas, model);
          }).catch(error => {
            this.rendererPromise = null;
            throw error;
          });
      }
      return this.rendererPromise;
    }
    static render(coverUrl) {
      const key = coverUrl || makeFallbackCover();
      if (this.cache.has(key)) {
        const cached = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, cached);
        return cached;
      }
      const task = this.queue = this.queue.catch(() => null).then(async () => {
        const renderer = await this.getRenderer();
        return renderer.renderToDataUrl(key);
      });
      const safeTask = task.catch(error => {
        this.cache.delete(key);
        throw error;
      });
      this.cache.set(key, safeTask);
      while (this.cache.size > this.maxCache) this.cache.delete(this.cache.keys().next().value);
      return safeTask;
    }
    constructor(canvas, model) {
      this.canvas = canvas;
      this.model = model;
      this.gl = canvas.getContext('webgl', { antialias: true, alpha: true, preserveDrawingBuffer: true });
      if (!this.gl) throw new Error('WebGL unavailable');
      this.groups = [];
      this.coverTexture = null;
      this.cartridgeCenter = meshBounds(model, 'cartridge').center;
      this.initGl();
      this.prepareModel();
    }
    initGl() {
      const gl = this.gl;
      const vs=PREMIUM_VS;
      const fs=PREMIUM_FS;
      this.program = createProgram(gl, vs, fs);
      this.loc = { position:gl.getAttribLocation(this.program,'aPosition'), normal:gl.getAttribLocation(this.program,'aNormal'), uv:gl.getAttribLocation(this.program,'aUv'), model:gl.getUniformLocation(this.program,'uModel'), viewProj:gl.getUniformLocation(this.program,'uViewProj'), color:gl.getUniformLocation(this.program,'uColor'), metal:gl.getUniformLocation(this.program,'uMetal'), rough:gl.getUniformLocation(this.program,'uRough'), textured:gl.getUniformLocation(this.program,'uTextured'), texture:gl.getUniformLocation(this.program,'uTexture'), camera:gl.getUniformLocation(this.program,'uCamera') };
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.clearColor(0,0,0,0);
    }
    prepareModel() {
      const gl = this.gl;
      this.model.meshes.filter(mesh => mesh.role === 'cartridge').forEach(mesh => mesh.groups.forEach(group => {
        const data = new Float32Array(group.vertices);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        const color = premiumMaterialColor('cartridge', group.material, group.color);
        this.groups.push({ material: group.material, color, metalness: group.metalness, roughness: group.roughness, buffer, count: data.length / 8 });
      }));
    }
    async setCover(url) {
      const img = await loadImageWithTimeout(url || makeFallbackCover(), 2500).catch(() => loadImageWithTimeout(makeFallbackCover(), 1200));
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (this.coverTexture) gl.deleteTexture(this.coverTexture);
      this.coverTexture = tex;
    }
    async renderToDataUrl(url) {
      await this.setCover(url);
      this.draw();
      return this.canvas.toDataURL('image/png');
    }
    draw() {
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.program);
      const aspect = this.canvas.width / this.canvas.height;
      const camera = [0, 66, 305];
      const proj = mat4Perspective(27 * Math.PI / 180, aspect, 1, 900);
      const view = mat4LookAt(camera, [0, 60, 0], [0, 1, 0]);
      const viewProj = mat4Mul(proj, view);
      const model = centeredCartridgeModel(this.cartridgeCenter, -1.5, 0.045, -0.08, 0.965);
      gl.uniformMatrix4fv(this.loc.viewProj, false, new Float32Array(viewProj));
      gl.uniform3fv(this.loc.camera, new Float32Array(camera));
      gl.uniform1i(this.loc.texture, 0);
      for (const group of this.groups) {
        gl.uniformMatrix4fv(this.loc.model, false, new Float32Array(model));
        gl.bindBuffer(gl.ARRAY_BUFFER, group.buffer);
        const stride = 8 * 4;
        gl.enableVertexAttribArray(this.loc.position); gl.vertexAttribPointer(this.loc.position, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(this.loc.normal); gl.vertexAttribPointer(this.loc.normal, 3, gl.FLOAT, false, stride, 3 * 4);
        gl.enableVertexAttribArray(this.loc.uv); gl.vertexAttribPointer(this.loc.uv, 2, gl.FLOAT, false, stride, 6 * 4);
        const textured = group.material === 'boxart' && this.coverTexture;
        gl.uniform1i(this.loc.textured, textured ? 1 : 0);
        gl.uniform3fv(this.loc.color, new Float32Array(group.color));
        gl.uniform1f(this.loc.metal, group.metalness || 0);
        gl.uniform1f(this.loc.rough, group.roughness || .5);
        if (textured) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.coverTexture); }
        gl.drawArrays(gl.TRIANGLES, 0, group.count);
      }
    }
  }

  class CartridgeRailRenderer {
    static modelPromise = null;
    constructor(container, modelUrl) {
      this.container = container;
      this.modelUrl = modelUrl;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'rail-3d-canvas';
      this.container.prepend(this.canvas);
      this.gl = this.canvas.getContext('webgl', { antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
      this.contextLost = false;
      this.destroyed = false;
      this.paused = document.hidden;
      this.viewportVisible = true;
      this.recoveryTimer = null;
      this.consecutiveErrors = 0;
      this.canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault();
        if (this.destroyed) return;
        this.contextLost = true;
        this.ready = false;
        this.renderHealthy = false;
        this.canvas.style.opacity = '0';
        this.container.classList.remove('rail-live-ready');
        clearTimeout(this.recoveryTimer);
        this.recoveryTimer = setTimeout(() => {
          if (this.destroyed || !this.contextLost || railRenderers.get(this.container) !== this) return;
          refreshRailRenderer(this.container, true);
        }, 700);
      }, false);
      this.canvas.addEventListener('webglcontextrestored', async () => {
        if (this.destroyed) return;
        clearTimeout(this.recoveryTimer);
        this.recoveryTimer = null;
        this.contextLost = false;
        this.consecutiveErrors = 0;
        this.groups = [];
        this.textureCache.clear();
        this.textureResolved.clear();
        this.fallbackTexture = null;
        this.initGl();
        this.prepareModel();
        this.fallbackTexture = await this.loadTexture(makeFallbackCover()).catch(() => null);
        this.ready = true;
        this.renderHealthy = false;
        this.items = this.items.map(item => ({ ...item, texture:this.fallbackTexture }));
        this.setItems(this.items);
        this.scheduleRender();
      }, false);
      this.items = [];
      this.groups = [];
      this.textureCache = new Map();
      this.textureResolved = new Map();
      this.maxTextures = 12;
      this.hidden = new Set();
      this.ready = false;
      this.renderHealthy = false;
      this.running = true;
      this.lastFrame = 0;
      this.lastScroll = container.scrollLeft || 0;
      this.scrollMomentum = 0;
      this.cartridgeCenter = [0,0,0];
      this.dpr = Math.min(devicePixelRatio || 1, 1.25);
      this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
      this.resizeObserver.observe(container);
      this.onScroll = () => {
        const delta = (this.container.scrollLeft || 0) - this.lastScroll;
        this.lastScroll = this.container.scrollLeft || 0;
        this.scrollMomentum = Math.max(-0.10, Math.min(0.10, this.scrollMomentum + delta * 0.0032));
        this.scheduleRender();
      };
      this.container.addEventListener('scroll', this.onScroll, { passive: true });
      this.init();
    }
    async init() {
      if (!this.gl) return;
      if (!CartridgeRailRenderer.modelPromise) {
        CartridgeRailRenderer.modelPromise = (window.SAVE_SLOT_MODEL ? Promise.resolve(window.SAVE_SLOT_MODEL) : fetch(this.modelUrl).then(r => r.json()))
          .then(model => (window.SAVE_SLOT_MODEL = model));
      }
      this.model = await CartridgeRailRenderer.modelPromise;
      this.cartridgeCenter = meshBounds(this.model, 'cartridge').center;
      this.initGl();
      this.prepareModel();
      this.fallbackTexture = await this.loadTexture(makeFallbackCover()).catch(() => null);
      this.ready = true;
      this.setItems(this.items);
      this.startLoop();
    }
    initGl() {
      const gl = this.gl;
      const vs=PREMIUM_VS;
      const fs=PREMIUM_FS;
      this.program = createProgram(gl, vs, fs);
      this.loc = {
        position:gl.getAttribLocation(this.program,'aPosition'), normal:gl.getAttribLocation(this.program,'aNormal'), uv:gl.getAttribLocation(this.program,'aUv'),
        model:gl.getUniformLocation(this.program,'uModel'), viewProj:gl.getUniformLocation(this.program,'uViewProj'), color:gl.getUniformLocation(this.program,'uColor'),
        metal:gl.getUniformLocation(this.program,'uMetal'), rough:gl.getUniformLocation(this.program,'uRough'), textured:gl.getUniformLocation(this.program,'uTextured'), texture:gl.getUniformLocation(this.program,'uTexture'), camera:gl.getUniformLocation(this.program,'uCamera')
      };
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.enable(gl.SCISSOR_TEST); gl.clearColor(0,0,0,0);
    }
    prepareModel() {
      const gl = this.gl;
      this.model.meshes.filter(mesh => mesh.role === 'cartridge').forEach(mesh => mesh.groups.forEach(group => {
        const data = new Float32Array(group.vertices);
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        const color = premiumMaterialColor('cartridge', group.material, group.color);
        this.groups.push({ material:group.material, color, metalness:group.metalness, roughness:group.roughness, buffer, count:data.length/8 });
      }));
    }
    setItems(items) {
      const previous = new Map((this.items || []).map(item => [item.id, item]));
      this.items = (items || []).map(item => {
        const old = previous.get(item.id);
        const resolved = this.textureResolved.get(item.cover);
        return {
          ...item,
          texture: resolved || (old?.cover === item.cover ? old.texture : this.fallbackTexture),
          textureLoading: false,
          visibleThisFrame: false
        };
      });
      if (!this.ready) return;
      requestAnimationFrame(() => this.scheduleRender());
    }
    updateItemCover(id, cover) {
      const item = this.items.find(entry => entry.id === id);
      if (!item) return;
      item.cover = cover || makeFallbackCover();
      item.texture = this.textureResolved.get(item.cover) || this.fallbackTexture;
      item.textureLoading = false;
      this.scheduleRender();
    }
    setHidden(id, hidden) {
      if (hidden) this.hidden.add(id); else this.hidden.delete(id);
      this.scheduleRender();
    }
    getTexture(url) {
      const key = url || 'fallback';
      if (this.textureResolved.has(key)) {
        const texture = this.textureResolved.get(key);
        this.textureResolved.delete(key);
        this.textureResolved.set(key, texture);
        return Promise.resolve(texture);
      }
      if (this.textureCache.has(key)) return this.textureCache.get(key);
      const promise = this.loadTexture(url || makeFallbackCover()).then(texture => {
        this.textureCache.delete(key);
        this.textureResolved.set(key, texture);
        this.trimTextureCache();
        return texture;
      }).catch(error => {
        this.textureCache.delete(key);
        console.warn('rail texture retryable failure', error);
        return this.fallbackTexture;
      });
      this.textureCache.set(key, promise);
      return promise;
    }
    ensureItemTexture(item) {
      if (!item || item.textureLoading || !item.cover) return;
      const resolved = this.textureResolved.get(item.cover);
      if (resolved) {
        item.texture = resolved;
        return;
      }
      item.textureLoading = true;
      const expectedCover = item.cover;
      this.getTexture(expectedCover).then(texture => {
        if (item.cover === expectedCover && texture) item.texture = texture;
      }).finally(() => {
        item.textureLoading = false;
        this.scheduleRender();
      });
    }
    trimTextureCache() {
      if (this.textureResolved.size <= this.maxTextures) return;
      const protectedKeys = new Set(this.items.filter(item => item.visibleThisFrame).map(item => item.cover));
      for (const [key, texture] of this.textureResolved) {
        if (this.textureResolved.size <= this.maxTextures) break;
        if (protectedKeys.has(key)) continue;
        this.textureResolved.delete(key);
        try { if (texture && texture !== this.fallbackTexture) this.gl.deleteTexture(texture); } catch (_) {}
        for (const item of this.items) if (item.cover === key) item.texture = this.fallbackTexture;
      }
    }
    async loadTexture(url) {
      const img = await loadImageWithTimeout(url, 4800);
      const gl=this.gl, tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      return tex;
    }
    isActiveScreen() {
      const screen = this.container?.closest?.('.screen');
      return !this.paused && !document.hidden && this.viewportVisible && (!screen || screen.classList.contains('active'));
    }
    setViewportVisible(visible) {
      this.viewportVisible = !!visible;
      if (this.viewportVisible) {
        this.canvas.style.opacity = this.renderHealthy ? '1' : '0';
        this.scheduleRender();
      }
    }
    pause() {
      this.paused = true;
    }
    resume() {
      this.paused = false;
      this.scheduleRender();
    }
    scheduleRender() {
      if (this.renderQueued || !this.ready || this.contextLost || !this.gl || !this.isActiveScreen()) return;
      this.renderQueued = true;
      requestAnimationFrame(time => { this.renderQueued = false; this.render(time); });
    }
    startLoop() {
      const tick = time => {
        if (!this.running) return;
        if (this.isActiveScreen() && time - this.lastFrame >= 42) {
          this.lastFrame = time;
          this.render(time);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    resizeCanvas() {
      const width = Math.max(1, this.container.clientWidth);
      const height = Math.max(1, this.container.clientHeight);
      const maxViewport = this.gl?.getParameter(this.gl.MAX_VIEWPORT_DIMS) || [4096,4096];
      const targetDpr = Math.min(this.dpr, maxViewport[0] / width, maxViewport[1] / height);
      const w = Math.max(1, Math.floor(width * targetDpr));
      const h = Math.max(1, Math.floor(height * targetDpr));
      this.activeDpr = targetDpr;
      this.canvas.style.left = `${this.container.scrollLeft || 0}px`;
      this.canvas.style.top = `${this.container.scrollTop || 0}px`;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
    }
    render(time = performance.now()) {
      if (!this.ready || this.contextLost || !this.gl) return;
      if (!this.isActiveScreen()) { this.canvas.style.opacity = '0'; return; }
      const gl=this.gl; this.resizeCanvas();
      gl.viewport(0,0,this.canvas.width,this.canvas.height); gl.scissor(0,0,this.canvas.width,this.canvas.height); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); gl.useProgram(this.program);
      if (!this.items.length) {
        this.renderHealthy = false;
        this.container.classList.remove('rail-live-ready');
        this.canvas.style.opacity = '0';
        return;
      }
      const containerRect=this.container.getBoundingClientRect();
      const visibleCenter = containerRect.left + containerRect.width * 0.5;
      this.scrollMomentum *= 0.78;
      let drewItems = 0;
      for (const entry of this.items) entry.visibleThisFrame = false;
      for (let index = 0; index < this.items.length; index++) {
        const item = this.items[index];
        if (this.hidden.has(item.id) || !item.viewport?.isConnected) continue;
        const rect=item.viewport.getBoundingClientRect();
        if (rect.right < containerRect.left - 8 || rect.left > containerRect.right + 8 || rect.bottom < containerRect.top - 8 || rect.top > containerRect.bottom + 8) continue;
        const dpr = this.activeDpr || this.dpr;
        const x=(rect.left-containerRect.left)*dpr;
        const y=(rect.top-containerRect.top)*dpr;
        const w=rect.width*dpr, h=rect.height*dpr;
        if (w<2||h<2) continue;
        const vy=this.canvas.height-y-h;
        const viewportX=Math.round(x), viewportY=Math.round(vy), viewportW=Math.max(1,Math.round(w)), viewportH=Math.max(1,Math.round(h));
        const scissorX=Math.max(0,viewportX), scissorY=Math.max(0,viewportY);
        const scissorRight=Math.min(this.canvas.width,viewportX+viewportW), scissorTop=Math.min(this.canvas.height,viewportY+viewportH);
        const scissorW=Math.max(0,scissorRight-scissorX), scissorH=Math.max(0,scissorTop-scissorY);
        if (scissorW <= 1 || scissorH <= 1) continue;
        gl.viewport(viewportX,viewportY,viewportW,viewportH);
        gl.scissor(scissorX,scissorY,scissorW,scissorH);
        item.visibleThisFrame = true;
        this.ensureItemTexture(item);
        const aspect=rect.width/rect.height;
        const camera=[0,64,308];
        const proj=mat4Perspective(26*Math.PI/180,aspect,1,900);
        const view=mat4LookAt(camera,[0,58,0],[0,1,0]);
        const viewProj=mat4Mul(proj,view);
        gl.uniformMatrix4fv(this.loc.viewProj,false,new Float32Array(viewProj)); gl.uniform3fv(this.loc.camera,new Float32Array(camera)); gl.uniform1i(this.loc.texture,0);
        const center = rect.left + rect.width * 0.5;
        const relative = Math.max(-1, Math.min(1, (center - visibleCenter) / Math.max(160, containerRect.width * 0.58)));
        const idleSway = Math.sin(time * 0.00105 + index * 0.83) * 0.0055;
        const loaderSwing = item.isLoader ? Math.sin(time * 0.00175) * 0.26 : 0;
        const ry = item.isLoader ? loaderSwing : (-relative * 0.006 + this.scrollMomentum * 0.050 + idleSway);
        const rx = item.isLoader ? 0.060 + Math.sin(time * 0.0018) * 0.010 : 0.028 + Math.abs(relative) * 0.004;
        const bob = item.isLoader ? Math.sin(time * 0.0024) * 1.2 : Math.sin(time * 0.00115 + index) * 0.35;
        const scale = item.isLoader ? 0.84 : 0.90;
        const model=centeredCartridgeModel(this.cartridgeCenter,-1.5+bob,rx,ry,scale);
        for (const group of this.groups) this.drawGroup(group, model, item.texture);
        drewItems++;
      }
      const glError = gl.getError();
      if (drewItems > 0 && glError === gl.NO_ERROR) {
        this.consecutiveErrors = 0;
        if (!this.renderHealthy) {
          this.renderHealthy = true;
          this.container.classList.add('rail-live-ready');
        }
        this.canvas.style.opacity = '1';
      } else if (glError !== gl.NO_ERROR) {
        this.consecutiveErrors++;
        console.warn('rail render error', glError, this.consecutiveErrors);
        if (this.consecutiveErrors >= 3 && !this.destroyed) {
          this.contextLost = true;
          this.ready = false;
          this.renderHealthy = false;
          this.canvas.style.opacity = '0';
          this.container.classList.remove('rail-live-ready');
          clearTimeout(this.recoveryTimer);
          this.recoveryTimer = setTimeout(() => {
            if (!this.destroyed && railRenderers.get(this.container) === this) refreshRailRenderer(this.container, true);
          }, 240);
        }
      }
    }
    captureItem(id) {
      if (!this.ready || this.contextLost || !this.gl) return null;
      const item = this.items.find(entry => entry.id === id);
      if (!item?.viewport?.isConnected) return null;
      this.render(performance.now());
      const rect = item.viewport.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();
      const dpr = this.activeDpr || this.dpr;
      const sx = Math.max(0, Math.round((rect.left-containerRect.left)*dpr));
      const top = Math.max(0, Math.round((rect.top-containerRect.top)*dpr));
      const sw = Math.min(this.canvas.width-sx, Math.round(rect.width*dpr));
      const sh = Math.min(this.canvas.height-top, Math.round(rect.height*dpr));
      if (sw < 2 || sh < 2) return null;
      const readY = Math.max(0, this.canvas.height - top - sh);
      const pixels = new Uint8Array(sw * sh * 4);
      const out = document.createElement('canvas');
      out.width = sw; out.height = sh;
      const ctx = out.getContext('2d');
      if (!ctx) return null;
      try {
        this.gl.readPixels(sx, readY, sw, sh, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
        const image = ctx.createImageData(sw, sh);
        for (let y = 0; y < sh; y++) {
          const src = (sh - 1 - y) * sw * 4;
          const dst = y * sw * 4;
          image.data.set(pixels.subarray(src, src + sw * 4), dst);
        }
        ctx.putImageData(image, 0, 0);
        return out.toDataURL('image/png');
      } catch (_) { return null; }
    }
    drawGroup(group, model, texture) {
      const gl=this.gl;
      gl.uniformMatrix4fv(this.loc.model,false,new Float32Array(model)); gl.bindBuffer(gl.ARRAY_BUFFER,group.buffer);
      const stride=8*4;
      gl.enableVertexAttribArray(this.loc.position); gl.vertexAttribPointer(this.loc.position,3,gl.FLOAT,false,stride,0);
      gl.enableVertexAttribArray(this.loc.normal); gl.vertexAttribPointer(this.loc.normal,3,gl.FLOAT,false,stride,3*4);
      gl.enableVertexAttribArray(this.loc.uv); gl.vertexAttribPointer(this.loc.uv,2,gl.FLOAT,false,stride,6*4);
      const textured=group.material==='boxart'&&texture;
      gl.uniform1i(this.loc.textured,textured?1:0); gl.uniform3fv(this.loc.color,new Float32Array(group.color)); gl.uniform1f(this.loc.metal,group.metalness||0); gl.uniform1f(this.loc.rough,group.roughness||.5);
      if(textured){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);} gl.drawArrays(gl.TRIANGLES,0,group.count);
    }
    destroy() {
      this.destroyed = true;
      this.running = false;
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
      railVisibilityObserver?.unobserve?.(this.container);
      this.resizeObserver?.disconnect();
      this.container?.removeEventListener('scroll', this.onScroll);
      this.container?.classList.remove('rail-live-ready');
      try {
        for (const group of this.groups || []) this.gl?.deleteBuffer(group.buffer);
        for (const promise of this.textureCache?.values?.() || []) Promise.resolve(promise).then(texture => texture && this.gl?.deleteTexture(texture)).catch(() => {});
        for (const texture of this.textureResolved?.values?.() || []) if (texture && texture !== this.fallbackTexture) this.gl?.deleteTexture(texture);
        if (this.fallbackTexture) this.gl?.deleteTexture(this.fallbackTexture);
        if (this.program) this.gl?.deleteProgram(this.program);
        this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch (_) {}
      this.canvas?.remove();
    }
  }

  class SlotRenderer {
    static async create(canvas,modelUrl,coverUrl) {
      const model=window.SAVE_SLOT_MODEL || await (await fetch(modelUrl)).json();
      const instance=new SlotRenderer(canvas,model);
      await instance.setCover(coverUrl);
      instance.start();
      return instance;
    }
    constructor(canvas,model) {
      this.canvas=canvas;
      this.gl=canvas.getContext('webgl',{antialias:true,alpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
      if(!this.gl) throw new Error('WebGL unavailable');
      this.stage=canvas.parentElement;
      this.contextLost=false;
      this.destroyed=false;
      this.paused=document.hidden;
      this.running=true;
      this.dirty=true;
      this.consecutiveErrors=0;
      this.coverRequestId=0;
      this.coverUrl=makeFallbackCover();
      canvas.addEventListener('webglcontextlost',event=>{
        event.preventDefault();
        if(this.destroyed)return;
        this.contextLost=true;
        this.stage?.classList.add('render-lost');
        if(this.anim){const done=this.anim.resolve;this.anim=null;done?.();}
        setTimeout(() => { if (this.contextLost) recoverSlotRendererAfterLoss(this); }, 180);
      },false);
      canvas.addEventListener('webglcontextrestored',async()=>{
        if(this.destroyed)return;
        this.contextLost=false;
        this.consecutiveErrors=0;
        this.groups=[];
        this.initGl();
        this.prepareModel();
        try{await this.setCover(this.coverUrl);}catch(_){}
        this.stage?.classList.remove('render-lost');
        this.dirty=true;
        this.resize();
      },false);
      this.model=model;
      this.groups=[];
      this.cartridge={y:0,z:0,rx:0,ry:0,scale:1};
      this.sceneTilt={x:0,y:0,targetX:0,targetY:0};
      this.anim=null;
      this.coverTexture=null;
      this.fallbackTexture=null;
      this.hasCartridge=false;
      this.initGl();
      this.prepareModel();
      this.bindPointer();
      this.resizeObserver=new ResizeObserver(()=>this.resize());
      this.resizeObserver.observe(canvas);
      this.resize();
    }
    initGl() {
      const gl=this.gl;
      const vs=PREMIUM_VS;
      const fs=PREMIUM_FS;
      this.program=createProgram(gl,vs,fs);
      this.loc={
        position:gl.getAttribLocation(this.program,'aPosition'),normal:gl.getAttribLocation(this.program,'aNormal'),uv:gl.getAttribLocation(this.program,'aUv'),
        model:gl.getUniformLocation(this.program,'uModel'),viewProj:gl.getUniformLocation(this.program,'uViewProj'),color:gl.getUniformLocation(this.program,'uColor'),
        metal:gl.getUniformLocation(this.program,'uMetal'),rough:gl.getUniformLocation(this.program,'uRough'),textured:gl.getUniformLocation(this.program,'uTextured'),texture:gl.getUniformLocation(this.program,'uTexture'),camera:gl.getUniformLocation(this.program,'uCamera')
      };
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
    }
    prepareModel() {
      const gl=this.gl;
      this.model.meshes.forEach(mesh=>mesh.groups.forEach(group=>{
        const data=new Float32Array(group.vertices);
        const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
        const color = premiumMaterialColor(mesh.role, group.material, group.color);
        this.groups.push({role:mesh.role,material:group.material,color,metalness:group.metalness,roughness:group.roughness,buffer,count:data.length/8});
      }));
    }
    async setCover(url) {
      this.coverUrl=url||makeFallbackCover();
      const requestId=++this.coverRequestId;
      if(this.contextLost||this.destroyed)return;
      const texture=await this.loadTexture(this.coverUrl).catch(()=>this.loadTexture(makeFallbackCover()));
      if(this.destroyed||this.contextLost||requestId!==this.coverRequestId){
        try{if(texture)this.gl.deleteTexture(texture);}catch(_){}
        return;
      }
      if(this.coverTexture)this.gl.deleteTexture(this.coverTexture);
      this.coverTexture=texture;
      this.dirty=true;
    }
    async loadTexture(url) {
      let src = url || makeFallbackCover();
      let objectUrl = null;
      if (/^https?:/i.test(src)) {
        try {
          const response = await fetch(src, { mode: 'cors' });
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          src = objectUrl;
        } catch (_) {}
      }
      return await new Promise((resolve,reject)=>{
        const img=new Image();
        const timer=setTimeout(()=>{img.src=''; if (objectUrl) URL.revokeObjectURL(objectUrl); reject(new Error('texture timeout'));},9000);
        img.onload=()=>{
          clearTimeout(timer);
          try{
            const gl=this.gl,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            resolve(tex);
          }catch(e){ if (objectUrl) URL.revokeObjectURL(objectUrl); reject(e); }
        };
        img.onerror=()=>{clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); reject(new Error('texture load failed'));};
        img.src=src;
      });
    }
    async insertGame(cover,reduced) {
      const duration=reduced?260:900;
      this.hasCartridge = true;
      this.dirty=true;
      if(!reduced) await this.animateTo({y:27,z:10,rx:-.05,ry:.02,scale:1},250);
      await this.setCover(cover||makeFallbackCover());
      this.cartridge={y:reduced?12:48,z:reduced?5:23,rx:reduced?-.03:-.15,ry:reduced?.02:-.17,scale:reduced?.99:.94};
      await this.animateTo({y:0,z:0,rx:0,ry:0,scale:1},duration,easeOutBackSoft);
    }
    async insertFromFlight(cover,reduced) {
      await this.setCover(cover||makeFallbackCover());
      this.hasCartridge=true;
      this.dirty=true;
      this.cartridge={y:reduced?10:30,z:reduced?4:14,rx:reduced?-.02:-.07,ry:0,scale:.99};
      await this.animateTo({y:0,z:0,rx:0,ry:0,scale:1},reduced?190:330,easeOutBackSoft);
    }
    async ejectGame(reduced) {
      if (!this.hasCartridge) return;
      this.dirty=true;
      const duration = reduced ? 180 : 420;
      await this.animateTo({y:reduced?14:38,z:reduced?7:20,rx:reduced?-.05:-.12,ry:reduced?.05:.12,scale:.98}, duration, easeInOut);
      this.hasCartridge = false;
      this.cartridge = { y:0, z:0, rx:0, ry:0, scale:1 };
      this.dirty=true;
    }
    animateTo(target,duration,ease=easeInOut) {
      if (this.anim) { const done=this.anim.resolve; this.anim=null; done?.(); }
      this.dirty=true;
      return new Promise(resolve=>{this.anim={from:{...this.cartridge},to:target,start:performance.now(),duration,ease,resolve};});
    }
    bindPointer() {
      let active=false,sx=0,sy=0;
      this.canvas.addEventListener('pointerdown',e=>{active=true;sx=e.clientX;sy=e.clientY;this.dirty=true;this.canvas.setPointerCapture(e.pointerId);});
      this.canvas.addEventListener('pointermove',e=>{if(!active)return;this.sceneTilt.targetY=Math.max(-.23,Math.min(.23,(e.clientX-sx)/380));this.sceneTilt.targetX=Math.max(-.12,Math.min(.12,(e.clientY-sy)/500));this.dirty=true;});
      const end=()=>{active=false;this.sceneTilt.targetX=0;this.sceneTilt.targetY=0;this.dirty=true;};
      this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);
    }
    resize() {
      if(this.contextLost||!this.gl)return;
      const dpr=Math.min(devicePixelRatio||1,1.5),rect=this.canvas.getBoundingClientRect();
      const w=Math.max(1,Math.floor(rect.width*dpr)),h=Math.max(1,Math.floor(rect.height*dpr));
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl.viewport(0,0,w,h);this.dirty=true;}
    }
    pause(){this.paused=true;}
    resume(){this.paused=false;this.dirty=true;}
    start() { const loop=t=>{if(!this.running)return;const moving=!!this.anim||Math.abs(this.sceneTilt.targetX-this.sceneTilt.x)>.0005||Math.abs(this.sceneTilt.targetY-this.sceneTilt.y)>.0005;if(!this.paused&&!document.hidden&&(this.dirty||moving)){this.update(t);if(!this.contextLost)this.render();this.dirty=false;}requestAnimationFrame(loop);};requestAnimationFrame(loop); }
    update(t) {
      if(this.anim){const p=Math.min(1,(t-this.anim.start)/this.anim.duration),q=this.anim.ease(p);for(const k of Object.keys(this.anim.to))this.cartridge[k]=this.anim.from[k]+(this.anim.to[k]-this.anim.from[k])*q;this.dirty=true;if(p>=1){const done=this.anim.resolve;this.anim=null;done();}}
      this.sceneTilt.x+=(this.sceneTilt.targetX-this.sceneTilt.x)*.09;this.sceneTilt.y+=(this.sceneTilt.targetY-this.sceneTilt.y)*.09;
    }
    render() {
      if(this.contextLost||!this.gl)return;
      const gl=this.gl;this.resize();gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      const aspect=this.canvas.width/this.canvas.height;
      const camera=[0,60,286];
      const proj=mat4Perspective(34*Math.PI/180,aspect,1,800);
      const view=mat4LookAt(camera,[0,55,0],[0,1,0]);
      const viewProj=mat4Mul(proj,view);
      gl.uniformMatrix4fv(this.loc.viewProj,false,new Float32Array(viewProj));gl.uniform3fv(this.loc.camera,new Float32Array(camera));gl.uniform1i(this.loc.texture,0);
      const scene=mat4Mul(mat4RotateX(this.sceneTilt.x),mat4RotateY(this.sceneTilt.y));
      this.groups.forEach(group=>{
        if(group.role==='cartridge' && !this.hasCartridge) return;
        let local=mat4Identity();
        if(group.role==='cartridge'){
          local=mat4Mul(mat4Translate(0,this.cartridge.y,this.cartridge.z),mat4Mul(mat4RotateX(this.cartridge.rx),mat4Mul(mat4RotateY(this.cartridge.ry),mat4Scale(this.cartridge.scale))));
        }
        const model=mat4Mul(scene,local);
        gl.uniformMatrix4fv(this.loc.model,false,new Float32Array(model));
        gl.bindBuffer(gl.ARRAY_BUFFER,group.buffer);
        const stride=8*4;
        gl.enableVertexAttribArray(this.loc.position);gl.vertexAttribPointer(this.loc.position,3,gl.FLOAT,false,stride,0);
        gl.enableVertexAttribArray(this.loc.normal);gl.vertexAttribPointer(this.loc.normal,3,gl.FLOAT,false,stride,3*4);
        gl.enableVertexAttribArray(this.loc.uv);gl.vertexAttribPointer(this.loc.uv,2,gl.FLOAT,false,stride,6*4);
        const textured=group.material==='boxart'&&this.coverTexture;
        gl.uniform1i(this.loc.textured,textured?1:0);gl.uniform3fv(this.loc.color,new Float32Array(group.color));gl.uniform1f(this.loc.metal,group.metalness||0);gl.uniform1f(this.loc.rough,group.roughness||.5);
        if(textured){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.coverTexture);}
        gl.drawArrays(gl.TRIANGLES,0,group.count);
      });
      const error=gl.getError();
      if(error===gl.NO_ERROR){this.consecutiveErrors=0;}
      else{
        this.consecutiveErrors++;
        console.warn('slot render error',error,this.consecutiveErrors);
        if(this.consecutiveErrors>=3&&!this.destroyed){
          this.contextLost=true;
          this.stage?.classList.add('render-lost');
          recoverSlotRendererAfterLoss(this);
        }
      }
    }
    destroy() {
      this.destroyed=true;
      this.running=false;
      this.coverRequestId++;
      this.resizeObserver?.disconnect();
      if(this.anim){const done=this.anim.resolve;this.anim=null;done?.();}
      try{
        for(const group of this.groups||[])this.gl?.deleteBuffer(group.buffer);
        if(this.coverTexture)this.gl?.deleteTexture(this.coverTexture);
        if(this.program)this.gl?.deleteProgram(this.program);
      }catch(_){}
    }
  }

  function createProgram(gl,vsSource,fsSource){const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vsSource));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fsSource));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
  function isPowerOf2(v){return (v&(v-1))===0;}
  function easeInOut(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
  function easeOutBackSoft(t){const c=1.15;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);}
  function mat4Identity(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
  function mat4Mul(a,b){const o=new Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
  function mat4Translate(x,y,z){return [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];}
  function mat4Scale(s){return [s,0,0,0,0,s,0,0,0,0,s,0,0,0,0,1];}
  function mat4RotateX(a){const c=Math.cos(a),s=Math.sin(a);return [1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];}
  function mat4RotateY(a){const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];}
  function mat4Ortho(left,right,bottom,top,near,far){const lr=1/(left-right),bt=1/(bottom-top),nf=1/(near-far);return [-2*lr,0,0,0,0,-2*bt,0,0,0,0,2*nf,0,(left+right)*lr,(top+bottom)*bt,(far+near)*nf,1];}
  function mat4Perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0];}
  function mat4LookAt(eye,center,up){let z=normalize3(sub3(eye,center)),x=normalize3(cross3(up,z)),y=cross3(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot3(x,eye),-dot3(y,eye),-dot3(z,eye),1];}
  function sub3(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}function cross3(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}function normalize3(v){const l=Math.hypot(...v)||1;return v.map(x=>x/l);}
})();
