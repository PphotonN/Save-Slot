function currentFilters() {
  return {
    platform: elements.platformFilter.value, genre: elements.genreFilter.value,
    yearFrom: Number(elements.yearFromFilter.value) || 0, yearTo: Number(elements.yearToFilter.value) || 9999,
    rating: Number(elements.ratingFilter.value) || 0, reviews: Number(elements.reviewsFilter.value) || 0,
    ratedOnly: elements.ratedOnlyFilter.checked, hideSaved: elements.hideSavedFilter.checked, sort: elements.sortSelect.value
  };
}

function filteredGames() {
  const f = currentFilters();
  const saved = savedGameIds();
  const games = currentResults.filter(game => {
    const rated = Boolean(game.rating?.total);
    return (f.platform === "all" || game.platforms.includes(f.platform))
      && (f.genre === "all" || game.genres.includes(f.genre))
      && (!game.year || (game.year >= f.yearFrom && game.year <= f.yearTo))
      && (!f.ratedOnly || rated)
      && (!rated || (game.rating.percent >= f.rating && game.rating.total >= f.reviews))
      && (!(f.rating || f.reviews) || rated)
      && (!f.hideSaved || !saved.has(game.id));
  });
  games.sort((a,b) => {
    if (f.sort === "trust") return (b.rating?.trust ?? -1) - (a.rating?.trust ?? -1) || b.relevance-a.relevance;
    if (f.sort === "rating") return (b.rating?.percent ?? -1) - (a.rating?.percent ?? -1) || (b.rating?.total ?? 0)-(a.rating?.total ?? 0);
    if (f.sort === "reviews") return (b.rating?.total ?? -1) - (a.rating?.total ?? -1);
    if (f.sort === "year") return (b.year || 0) - (a.year || 0);
    if (f.sort === "title") return a.title.localeCompare(b.title,"uk");
    return b.relevance - a.relevance;
  });
  return games;
}

function populateFilters() {
  const p = elements.platformFilter.value, g = elements.genreFilter.value;
  const platforms = unique(currentResults.flatMap(game => game.platforms)).sort((a,b)=>a.localeCompare(b,"uk"));
  const genres = unique(currentResults.flatMap(game => game.genres)).sort((a,b)=>a.localeCompare(b,"uk"));
  elements.platformFilter.replaceChildren(new Option("Усі платформи","all"), ...platforms.map(v=>new Option(v,v)));
  elements.genreFilter.replaceChildren(new Option("Усі жанри","all"), ...genres.map(v=>new Option(v,v)));
  if (platforms.includes(p)) elements.platformFilter.value = p;
  if (genres.includes(g)) elements.genreFilter.value = g;
}

function renderGames() {
  const games = filteredGames();
  elements.gameGrid.replaceChildren();
  const hasSearch = Boolean(currentQuery);
  elements.emptyState.hidden = games.length > 0;
  elements.emptyState.innerHTML = hasSearch
    ? `<strong>За поточними фільтрами нічого немає.</strong><span>Скинь частину фільтрів або уточни назву.</span>`
    : `<strong>Тут з’являться результати.</strong><span>Введи назву гри у полі вище.</span>`;
  elements.resultsTitle.textContent = hasSearch ? `Показано: ${games.length} із ${currentResults.length}` : "Пошук ще не виконано";
  const pending = currentResults.filter(game => game.ratingState === "pending").length;
  const rated = currentResults.filter(game => game.rating?.total).length;
  elements.resultsNote.textContent = hasSearch ? `Wikidata: ${currentResults.length} · Steam-рейтинг: ${rated}${pending ? ` · очікується: ${pending}` : ""}` : "Wikidata → метадані · Steam → оцінка гравців";
  for (const game of games) elements.gameGrid.append(renderGameCard(game));
}

function renderGameCard(game) {
  const node = elements.gameCardTemplate.content.cloneNode(true);
  const card = node.querySelector(".game-card");
  const cover = node.querySelector(".game-cover");
  const fallback = node.querySelector(".cover-fallback");
  const saveButton = node.querySelector(".save-button");
  card.dataset.id = game.id;
  fallback.textContent = initials(game.title);
  loadCover(cover, game);
  node.querySelector(".platform-chip").textContent = game.platforms[0] || "Платформа не вказана";
  node.querySelector(".game-title").textContent = game.title;
  const rating = node.querySelector(".rating");
  const reviews = node.querySelector(".reviews");
  const ratingState = node.querySelector(".rating-state");
  if (game.rating) {
    rating.textContent = `★ ${game.rating.percent}%`;
    reviews.textContent = `${formatNumber(game.rating.total)} відгуків`;
    rating.title = `Надійна нижня межа: ${game.rating.trust}%`;
    ratingState.textContent = `${game.rating.description || "Steam-відгуки"} · достовірність: ${ratingConfidence(game.rating.total)}`;
  } else {
    rating.textContent = "★ —";
    reviews.textContent = game.ratingState === "pending" ? "перевіряю Steam" : "немає Steam-оцінки";
    ratingState.textContent = game.ratingState === "pending" ? "Завантажую реальні відгуки..." : game.steamId ? "Steam не повернув рейтинг" : "У Wikidata немає Steam App ID";
    ratingState.classList.toggle("loading", game.ratingState === "pending");
  }
  node.querySelector(".year").textContent = game.year || "—";
  const tags = node.querySelector(".game-tags");
  for (const tag of [...game.genres.slice(0,2), ...game.platforms.slice(0,1)]) tags.append(makeTag(tag));
  const saved = Boolean(findEntry(game.id));
  saveButton.classList.toggle("saved", saved);
  saveButton.textContent = saved ? "✓" : "＋";
  saveButton.setAttribute("aria-label", saved ? "Видалити зі списку" : "Додати до списку");
  saveButton.addEventListener("click", event => { event.stopPropagation(); toggleSaved(game); });
  card.addEventListener("click", () => openGame(game.id));
  card.addEventListener("keydown", event => { if (["Enter"," "].includes(event.key)) { event.preventDefault(); openGame(game.id); } });
  installTilt(card);
  return node;
}

function loadCover(img, game) {
  const candidates = unique([game.cover, game.fallbackCover]);
  if (!candidates.length) { img.hidden = true; return; }
  let index = 0;
  img.src = candidates[index];
  img.alt = `Обкладинка ${game.title}`;
  img.addEventListener("error", () => { index += 1; if (candidates[index]) img.src = candidates[index]; else img.hidden = true; });
}

function makeTag(text, cls="") { const span=document.createElement("span"); span.className=`tag ${cls}`.trim(); span.textContent=text; return span; }
function ratingConfidence(total) { return total >= 10000 ? "висока" : total >= 500 ? "середня" : "обмежена"; }
function installTilt(card) {
  card.addEventListener("pointermove", event => {
    if (state.settings.reduceMotion || matchMedia("(pointer:coarse)").matches) return;
    const strength = Number(state.settings.tiltStrength) || 0;
    const rect=card.getBoundingClientRect(), x=(event.clientX-rect.left)/rect.width-.5, y=(event.clientY-rect.top)/rect.height-.5;
    card.style.setProperty("--rx",`${-y*7*strength}deg`); card.style.setProperty("--ry",`${x*9*strength}deg`);
  });
  card.addEventListener("pointerleave",()=>{card.style.setProperty("--rx","0deg");card.style.setProperty("--ry","0deg")});
}
