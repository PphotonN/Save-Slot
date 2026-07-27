const SAVE_SLOT_V12 = "0.6.2";

let resultDatasetV12 = "";
let renderFrameV12 = 0;

function datasetKeyV12() {
  return `${currentQuery}|${currentResults.map(game => game.id).join(",")}`;
}

function sourcePositionV12(game) {
  const explicit = Number(game.sourceOrderV12);
  if (Number.isFinite(explicit)) return explicit;
  const index = currentResults.indexOf(game);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function compareNullableNumberV12(a, b, direction = "desc") {
  const aValid = Number.isFinite(Number(a));
  const bValid = Number.isFinite(Number(b));
  if (aValid && !bValid) return -1;
  if (!aValid && bValid) return 1;
  if (!aValid && !bValid) return 0;
  return direction === "asc" ? Number(a) - Number(b) : Number(b) - Number(a);
}

function filterOnlyV12() {
  const filters = currentFilters();
  const saved = savedGameIds();

  return currentResults.filter(game => {
    const rated = Boolean(game.rating?.total);
    const platformMatches = filters.platform === "all" || game.platforms.includes(filters.platform);
    const genreMatches = filters.genre === "all" || game.genres.includes(filters.genre);
    const yearMatches = !game.year || (game.year >= filters.yearFrom && game.year <= filters.yearTo);
    const ratingMatches = !(filters.rating || filters.reviews)
      || (rated && game.rating.percent >= filters.rating && game.rating.total >= filters.reviews);

    return platformMatches
      && genreMatches
      && yearMatches
      && (!filters.ratedOnly || rated)
      && ratingMatches
      && (!filters.hideSaved || !saved.has(game.id));
  });
}

function sortOnlyV12(games) {
  const sort = elements.sortSelect?.value || "relevance";
  const output = [...games];

  output.sort((a, b) => {
    let result = 0;
    if (sort === "trust") result = compareNullableNumberV12(a.rating?.trust, b.rating?.trust);
    else if (sort === "rating") result = compareNullableNumberV12(a.rating?.percent, b.rating?.percent);
    else if (sort === "reviews") result = compareNullableNumberV12(a.rating?.total, b.rating?.total);
    else if (sort === "year") result = compareNullableNumberV12(a.year, b.year);
    else if (sort === "title") result = a.title.localeCompare(b.title, "uk");
    else result = compareNullableNumberV12(a.relevance, b.relevance);

    return result || sourcePositionV12(a) - sourcePositionV12(b);
  });
  return output;
}

// Сортування визначає тільки порядок. Воно ніколи не бере участі у видимості картки.
filteredGames = function filteredGamesV12() {
  return sortOnlyV12(filterOnlyV12());
};

function requestGridRenderV12() {
  if (renderFrameV12) return;
  renderFrameV12 = requestAnimationFrame(() => {
    renderFrameV12 = 0;
    renderGames();
  });
}

const resolveCoverBeforeV12 = resolveCoverV6;
resolveCoverV6 = async function resolveCoverV12(game, requestedPlatform, generation) {
  const ready = await resolveCoverBeforeV12(game, requestedPlatform, generation);
  if (ready && generation === coverGenerationV6) requestGridRenderV12();
  return ready;
};

const commitProgressiveBeforeV12 = commitProgressiveResultsV6;
commitProgressiveResultsV6 = async function commitProgressiveResultsV12(games, options) {
  games.forEach((game, index) => {
    game.sourceOrderV12 = index;
  });
  resultDatasetV12 = `${options?.label || "results"}|${Date.now()}`;
  revealContextV9 = "";
  revealOrderV9 = new Map();
  revealCounterV9 = 0;
  const result = await commitProgressiveBeforeV12(games, options);
  requestGridRenderV12();
  return result;
};

function ensureVisibleResultsV12() {
  const key = datasetKeyV12();
  if (key !== resultDatasetV12 && currentResults.length) {
    currentResults.forEach((game, index) => {
      if (!Number.isFinite(Number(game.sourceOrderV12))) game.sourceOrderV12 = index;
    });
    resultDatasetV12 = key;
  }
  requestGridRenderV12();
}

// Оцінки та інші асинхронні дані також не повинні чекати зміни select.
const scheduleRenderBeforeV12 = scheduleRender;
scheduleRender = function scheduleRenderV12() {
  scheduleRenderBeforeV12();
  requestGridRenderV12();
};

window.addEventListener("pageshow", ensureVisibleResultsV12);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) ensureVisibleResultsV12();
});
