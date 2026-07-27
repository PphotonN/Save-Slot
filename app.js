const demoGames = [
  { id: 1, title: "Jeanne d'Arc", platform: "PSP", genres: ["RPG", "Тактика"], rating: 87, mainHours: 34, year: 2006, hiddenGem: true, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg" },
  { id: 2, title: "The Legend of Zelda: Link's Awakening", platform: "Game Boy", genres: ["Пригоди", "Екшен"], rating: 88, mainHours: 14, year: 1993, hiddenGem: false, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co3nzn.jpg" },
  { id: 3, title: "Koudelka", platform: "PlayStation", genres: ["RPG", "Жахи"], rating: 78, mainHours: 12, year: 1999, hiddenGem: true, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1s7h.jpg" },
  { id: 4, title: "Metroid Prime", platform: "GameCube", genres: ["Екшен", "Пригоди"], rating: 91, mainHours: 14, year: 2002, hiddenGem: false, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1oj9.jpg" },
  { id: 5, title: "Gravity Rush", platform: "PS Vita", genres: ["Екшен", "Пригоди"], rating: 82, mainHours: 11, year: 2012, hiddenGem: true, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmt.jpg" },
  { id: 6, title: "Radiant Historia", platform: "Nintendo DS", genres: ["JRPG"], rating: 86, mainHours: 33, year: 2010, hiddenGem: true, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1zfw.jpg" },
  { id: 7, title: "Outer Wilds", platform: "PC", genres: ["Пригоди", "Головоломка"], rating: 92, mainHours: 16, year: 2019, hiddenGem: false, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1xj3.jpg" },
  { id: 8, title: "Vagrant Story", platform: "PlayStation", genres: ["RPG", "Екшен"], rating: 88, mainHours: 30, year: 2000, hiddenGem: true, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1w6k.jpg" },
  { id: 9, title: "Astro Bot", platform: "PlayStation 5", genres: ["Платформер"], rating: 94, mainHours: 12, year: 2024, hiddenGem: false, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co8l8h.jpg" },
  { id: 10, title: "The World Ends with You", platform: "Nintendo DS", genres: ["JRPG", "Екшен"], rating: 89, mainHours: 25, year: 2007, hiddenGem: true, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1xq5.jpg" },
  { id: 11, title: "Pentiment", platform: "PC", genres: ["Пригоди", "Наративна"], rating: 88, mainHours: 15, year: 2022, hiddenGem: true, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co4x2h.jpg" },
  { id: 12, title: "Muramasa Rebirth", platform: "PS Vita", genres: ["Екшен", "RPG"], rating: 84, mainHours: 13, year: 2013, hiddenGem: true, cover: "https://images.igdb.com/igdb/image/upload/t_cover_big/co2f0t.jpg" }
];

const STORAGE_KEY = "save-slot-state-v1";
const state = loadState();

const elements = {
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  platformFilter: document.querySelector("#platformFilter"),
  genreFilter: document.querySelector("#genreFilter"),
  ratingFilter: document.querySelector("#ratingFilter"),
  ratingOutput: document.querySelector("#ratingOutput"),
  lengthFilter: document.querySelector("#lengthFilter"),
  hiddenGemFilter: document.querySelector("#hiddenGemFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  resetFilters: document.querySelector("#resetFilters"),
  gameGrid: document.querySelector("#gameGrid"),
  emptyState: document.querySelector("#emptyState"),
  resultsTitle: document.querySelector("#resultsTitle"),
  template: document.querySelector("#gameCardTemplate"),
  savedCount: document.querySelector("#savedCount"),
  openListButton: document.querySelector("#openListButton"),
  listDialog: document.querySelector("#listDialog"),
  closeListButton: document.querySelector("#closeListButton"),
  savedList: document.querySelector("#savedList"),
  emptyListState: document.querySelector("#emptyListState"),
  clearListButton: document.querySelector("#clearListButton"),
  exportButton: document.querySelector("#exportButton"),
  dialogExportButton: document.querySelector("#dialogExportButton"),
  importButton: document.querySelector("#importButton"),
  importInput: document.querySelector("#importInput"),
  listNameInput: document.querySelector("#listNameInput")
};

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      listName: parsed?.listName || "Мій список ігор",
      savedIds: Array.isArray(parsed?.savedIds) ? parsed.savedIds : []
    };
  } catch {
    return { listName: "Мій список ігор", savedIds: [] };
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function populateFilters() {
  const platforms = [...new Set(demoGames.map(game => game.platform))].sort();
  const genres = [...new Set(demoGames.flatMap(game => game.genres))].sort();

  for (const platform of platforms) {
    elements.platformFilter.add(new Option(platform, platform));
  }
  for (const genre of genres) {
    elements.genreFilter.add(new Option(genre, genre));
  }
}

function getFilteredGames() {
  const query = elements.searchInput.value.trim().toLocaleLowerCase("uk-UA");
  const platform = elements.platformFilter.value;
  const genre = elements.genreFilter.value;
  const minRating = Number(elements.ratingFilter.value);
  const maxHours = elements.lengthFilter.value === "all" ? Infinity : Number(elements.lengthFilter.value);
  const hiddenOnly = elements.hiddenGemFilter.checked;

  const result = demoGames.filter(game => {
    const searchable = `${game.title} ${game.genres.join(" ")} ${game.platform}`.toLocaleLowerCase("uk-UA");
    return (!query || searchable.includes(query))
      && (platform === "all" || game.platform === platform)
      && (genre === "all" || game.genres.includes(genre))
      && game.rating >= minRating
      && game.mainHours <= maxHours
      && (!hiddenOnly || game.hiddenGem);
  });

  const sort = elements.sortSelect.value;
  result.sort((a, b) => {
    if (sort === "length") return a.mainHours - b.mainHours;
    if (sort === "year") return b.year - a.year;
    if (sort === "title") return a.title.localeCompare(b.title, "uk");
    return b.rating - a.rating;
  });
  return result;
}

function renderGames() {
  const games = getFilteredGames();
  elements.gameGrid.replaceChildren();
  elements.emptyState.hidden = games.length > 0;
  elements.resultsTitle.textContent = games.length === demoGames.length ? "Рекомендовані ігри" : `Знайдено: ${games.length}`;

  for (const game of games) {
    const node = elements.template.content.cloneNode(true);
    const card = node.querySelector(".game-card");
    const cover = node.querySelector(".game-cover");
    const saveButton = node.querySelector(".save-button");

    cover.src = game.cover;
    cover.alt = `Обкладинка ${game.title}`;
    cover.addEventListener("error", () => {
      cover.removeAttribute("src");
      cover.alt = "Обкладинка недоступна";
      cover.style.background = "linear-gradient(135deg,#2f3836,#111414)";
    }, { once: true });

    node.querySelector(".platform-chip").textContent = game.platform;
    node.querySelector(".game-title").textContent = game.title;
    node.querySelector(".rating").textContent = `★ ${game.rating}`;
    node.querySelector(".length").textContent = `◷ ${game.mainHours} год`;
    node.querySelector(".year").textContent = game.year;

    const tags = node.querySelector(".game-tags");
    for (const genre of game.genres.slice(0, 3)) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = genre;
      tags.append(tag);
    }

    syncSaveButton(saveButton, game.id);
    saveButton.addEventListener("click", () => toggleSaved(game.id));
    installTilt(card);
    elements.gameGrid.append(node);
  }
}

function installTilt(card) {
  card.addEventListener("pointermove", event => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(800px) rotateX(${-y * 7}deg) rotateY(${x * 9}deg) translateY(-4px)`;
  });
  card.addEventListener("pointerleave", () => {
    card.style.transform = "perspective(800px) rotateX(0) rotateY(0) translateY(0)";
  });
}

function syncSaveButton(button, id) {
  const isSaved = state.savedIds.includes(id);
  button.classList.toggle("saved", isSaved);
  button.textContent = isSaved ? "✓" : "＋";
  button.setAttribute("aria-label", isSaved ? "Видалити зі списку" : "Додати до списку");
}

function toggleSaved(id) {
  const index = state.savedIds.indexOf(id);
  if (index >= 0) state.savedIds.splice(index, 1);
  else state.savedIds.push(id);
  persistState();
  updateSavedUI();
  renderGames();
}

function updateSavedUI() {
  elements.savedCount.textContent = state.savedIds.length;
  elements.listNameInput.value = state.listName;
  elements.savedList.replaceChildren();
  elements.emptyListState.hidden = state.savedIds.length > 0;

  for (const id of state.savedIds) {
    const game = demoGames.find(item => item.id === id);
    if (!game) continue;
    const item = document.createElement("article");
    item.className = "saved-item";
    item.innerHTML = `
      <img src="${game.cover}" alt="" />
      <div><h3>${escapeHtml(game.title)}</h3><p>${escapeHtml(game.platform)} · ${game.rating}/100 · ${game.mainHours} год</p></div>
      <button class="remove-button" type="button" aria-label="Видалити ${escapeHtml(game.title)}">×</button>
    `;
    item.querySelector("button").addEventListener("click", () => toggleSaved(game.id));
    elements.savedList.append(item);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function exportList() {
  const payload = {
    format: "save-slot-list",
    version: 1,
    name: state.listName,
    exportedAt: new Date().toISOString(),
    games: state.savedIds.map(id => demoGames.find(game => game.id === id)).filter(Boolean)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(state.listName || "save-slot")}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return value.toLocaleLowerCase("uk-UA").trim().replace(/[^a-zа-яіїєґ0-9]+/gi, "-").replace(/^-|-$/g, "") || "save-slot";
}

async function importList(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data?.format !== "save-slot-list" || !Array.isArray(data.games)) throw new Error("Невірний формат");
    const importedIds = data.games.map(game => Number(game.id)).filter(id => demoGames.some(item => item.id === id));
    state.savedIds = [...new Set(importedIds)];
    state.listName = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Імпортований список";
    persistState();
    updateSavedUI();
    renderGames();
    elements.listDialog.showModal();
  } catch {
    alert("Не вдалося імпортувати список. Обери JSON-файл, створений Save Slot.");
  } finally {
    elements.importInput.value = "";
  }
}

function resetFilters() {
  elements.searchInput.value = "";
  elements.platformFilter.value = "all";
  elements.genreFilter.value = "all";
  elements.ratingFilter.value = "70";
  elements.ratingOutput.value = "70";
  elements.lengthFilter.value = "all";
  elements.hiddenGemFilter.checked = false;
  elements.sortSelect.value = "rating";
  renderGames();
}

for (const element of [elements.searchInput, elements.platformFilter, elements.genreFilter, elements.ratingFilter, elements.lengthFilter, elements.hiddenGemFilter, elements.sortSelect]) {
  element.addEventListener("input", () => {
    elements.ratingOutput.value = elements.ratingFilter.value;
    renderGames();
  });
}

elements.searchForm.addEventListener("submit", event => { event.preventDefault(); renderGames(); });
elements.resetFilters.addEventListener("click", resetFilters);
elements.openListButton.addEventListener("click", () => elements.listDialog.showModal());
elements.closeListButton.addEventListener("click", () => elements.listDialog.close());
elements.listDialog.addEventListener("click", event => { if (event.target === elements.listDialog) elements.listDialog.close(); });
elements.clearListButton.addEventListener("click", () => { state.savedIds = []; persistState(); updateSavedUI(); renderGames(); });
elements.exportButton.addEventListener("click", exportList);
elements.dialogExportButton.addEventListener("click", exportList);
elements.importButton.addEventListener("click", () => elements.importInput.click());
elements.importInput.addEventListener("change", event => { const [file] = event.target.files; if (file) importList(file); });
elements.listNameInput.addEventListener("input", () => { state.listName = elements.listNameInput.value; persistState(); });

populateFilters();
updateSavedUI();
renderGames();
