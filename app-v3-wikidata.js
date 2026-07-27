async function fetchJson(url, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

async function wikidataApi(params) {
  const url = new URL(WIKIDATA_API);
  for (const [key, value] of Object.entries({ ...params, format: "json", formatversion: 2, origin: "*" })) url.searchParams.set(key, value);
  return fetchJson(url, 14000);
}

async function searchEntities(query, language) {
  const data = await wikidataApi({ action: "wbsearchentities", search: query, language, uselang: "uk", type: "item", limit: 40 });
  return data.search || [];
}

async function fetchEntities(ids, props = "labels|descriptions|claims|sitelinks") {
  if (!ids.length) return {};
  const data = await wikidataApi({ action: "wbgetentities", ids: ids.slice(0,50).join("|"), props, languages: "uk|en", languagefallback: 1 });
  const entities = Array.isArray(data.entities) ? data.entities : Object.values(data.entities || {});
  return Object.fromEntries(entities.map(entity => [entity.id, entity]));
}

function claimValues(entity, property) {
  return (entity.claims?.[property] || []).map(claim => claim.mainsnak?.datavalue?.value).filter(value => value != null);
}
function claimEntityIds(entity, property) { return claimValues(entity, property).map(value => value?.id).filter(Boolean); }
function claimString(entity, property) { const value = claimValues(entity, property)[0]; return typeof value === "string" ? value : null; }
function claimTime(entity, property) { const value = claimValues(entity, property)[0]?.time; return value ? Number(value.match(/[+-](\d{4})/)?.[1]) || null : null; }
function entityLabel(entity) { return entity?.labels?.uk?.value || entity?.labels?.en?.value || entity?.id || ""; }
function entityDescription(entity) { return entity?.descriptions?.uk?.value || entity?.descriptions?.en?.value || ""; }

function isVideoGameEntity(entity, searchRecord) {
  const types = claimEntityIds(entity, "P31");
  if (types.some(type => EXCLUDED_TYPES.has(type))) return false;
  if (types.some(type => ACCEPTED_TYPES.has(type))) return true;
  const text = `${entityDescription(entity)} ${searchRecord?.description || ""}`.toLocaleLowerCase("en-US");
  return /\b(video|computer|console) game\b|відеогр|комп.?ютерн.*гр/.test(text) && !/series|franchise|сері[яї]/.test(text);
}

function computeRelevance(query, title, index) {
  const q = normalizeText(query);
  const t = normalizeText(title);
  if (!q || !t) return Math.max(0, 50 - index);
  if (t === q) return 1000;
  let score = Math.max(0, 100 - index * 2);
  if (t.startsWith(q)) score += 300;
  else if (t.includes(q)) score += 180;
  const qTokens = q.split(" ").filter(Boolean);
  const tTokens = new Set(t.split(" ").filter(Boolean));
  const hits = qTokens.filter(token => tTokens.has(token)).length;
  score += (hits / Math.max(qTokens.length, 1)) * 180;
  score -= Math.abs(t.length - q.length) * .25;
  return score;
}

function steamCover(appId) { return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`; }
function commonsImage(filename) { return filename ? `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename.replace(/ /g,"_"))}?width=600` : ""; }

async function buildGames(query, mergedSearch) {
  const ids = mergedSearch.slice(0,50).map(item => item.id);
  const entities = await fetchEntities(ids);
  const filtered = mergedSearch.filter(item => entities[item.id] && isVideoGameEntity(entities[item.id], item));
  const linkedIds = new Set();
  for (const item of filtered) {
    const entity = entities[item.id];
    for (const prop of ["P400","P136","P178","P123"]) for (const id of claimEntityIds(entity, prop)) linkedIds.add(id);
  }
  const labels = await fetchEntities([...linkedIds], "labels");
  return filtered.map((record, index) => {
    const entity = entities[record.id];
    const steamId = claimString(entity, "P1733");
    const image = commonsImage(claimString(entity, "P18"));
    const title = entityLabel(entity) || record.label;
    const platforms = claimEntityIds(entity, "P400").map(id => entityLabel(labels[id]));
    const genres = claimEntityIds(entity, "P136").map(id => entityLabel(labels[id]));
    const developers = claimEntityIds(entity, "P178").map(id => entityLabel(labels[id]));
    const publishers = claimEntityIds(entity, "P123").map(id => entityLabel(labels[id]));
    return {
      id: entity.id, title, description: entityDescription(entity) || record.description || "", year: claimTime(entity, "P577"),
      platforms: unique(platforms), genres: unique(genres), developers: unique(developers), publishers: unique(publishers), steamId,
      cover: steamId ? steamCover(steamId) : image, fallbackCover: steamId ? image : "", wikidataUrl: `https://www.wikidata.org/wiki/${entity.id}`,
      steamUrl: steamId ? `https://store.steampowered.com/app/${steamId}/` : "", relevance: computeRelevance(query, title, index),
      rating: null, ratingState: steamId && state.settings.steamRatings ? "pending" : "unavailable"
    };
  }).sort((a,b) => b.relevance - a.relevance);
}

async function searchGames(query) {
  const sequence = ++searchSequence;
  const started = performance.now();
  currentQuery = query;
  setLoading(true);
  setSourceState("loading", "ПОШУК У WIKIDATA");
  setFeedback(`Шукаю «${query}»...`);
  elements.resultsTitle.textContent = "Виконується пошук";
  try {
    const [uk, en] = await Promise.allSettled([searchEntities(query, "uk"), searchEntities(query, "en")]);
    if (sequence !== searchSequence) return;
    const combined = [...(uk.value || []), ...(en.value || [])];
    const uniqueRecords = [...new Map(combined.map(item => [item.id, item])).values()];
    if (!uniqueRecords.length) throw new Error("Wikidata не повернула збігів");
    elements.loadingDetail.textContent = `Перевіряю ${Math.min(uniqueRecords.length,50)} об’єктів та підвантажую платформи`;
    const games = await buildGames(query, uniqueRecords);
    if (sequence !== searchSequence) return;
    currentResults = games;
    populateFilters();
    renderGames();
    setLoading(false);
    if (!games.length) {
      setSourceState("ready", "WIKIDATA ГОТОВА");
      setFeedback(`За запитом «${query}» не знайдено підтверджених відеоігор.`, "error");
      return;
    }
    const steamGames = games.filter(game => game.steamId && state.settings.steamRatings);
    const metadataSeconds = ((performance.now() - started) / 1000).toFixed(1);
    setFeedback(`Знайдено ${games.length}. Метадані за ${metadataSeconds} с. ${steamGames.length ? `Перевіряю Steam-відгуки для ${steamGames.length} ігор...` : "Steam-збігів немає."}`);
    setSourceState(steamGames.length ? "loading" : "ready", steamGames.length ? `STEAM 0/${steamGames.length}` : "WIKIDATA ГОТОВА");
    if (steamGames.length) await enrichSteamRatings(steamGames, sequence, started);
  } catch (error) {
    if (sequence !== searchSequence) return;
    setLoading(false);
    currentResults = [];
    renderGames();
    setSourceState("error", "ПОМИЛКА ДЖЕРЕЛА");
    setFeedback(error.name === "AbortError" ? "Джерело не відповіло вчасно. Повтори пошук." : `Не вдалося виконати пошук: ${error.message}`, "error");
  }
}
