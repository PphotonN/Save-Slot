const SAVE_SLOT_V8 = "0.5.2";
let gridContextV8 = "";
let deckFactsV8 = null;

function ensureV8Styles() {
  if (document.querySelector('link[data-save-slot-v8]')) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./styles-v8.css?v=10";
    link.dataset.saveSlotV8 = "true";
    link.onload = resolve;
    link.onerror = resolve;
    document.head.append(link);
  });
}

function currentGridContextV8() {
  return [
    currentQuery,
    currentPageV6,
    pageSizeV6,
    elements.platformFilter?.value,
    elements.genreFilter?.value,
    elements.yearFromFilter?.value,
    elements.yearToFilter?.value,
    elements.ratingFilter?.value,
    elements.reviewsFilter?.value,
    elements.ratedOnlyFilter?.checked,
    elements.hideSavedFilter?.checked,
    elements.sortSelect?.value
  ].join("|");
}

function gameCardSignatureV8(game) {
  return JSON.stringify([
    game.cover,
    game.coverPlatform,
    game.coverSource,
    game.rating?.percent,
    game.rating?.total,
    game.ratingState,
    game.year,
    game.platforms,
    game.genres,
    Boolean(findEntry(game.id))
  ]);
}

function patchGameCardV8(card, game) {
  const signature = gameCardSignatureV8(game);
  if (card.dataset.signatureV8 === signature && card.__gameRefV8 === game) return;

  card.dataset.signatureV8 = signature;
  card.__gameRefV8 = game;
  card.dataset.id = game.id;

  const cover = card.querySelector(".game-cover");
  const fallback = card.querySelector(".cover-fallback");
  if (cover && cover.getAttribute("src") !== game.cover) {
    cover.src = game.cover;
    cover.hidden = !game.cover;
    cover.alt = `Боксарт ${game.title}`;
  }
  if (fallback) fallback.textContent = initials(game.title);

  const platformLabel = game.coverPlatform || game.recommendationPlatform?.label || visiblePlatformV5(game);
  const chip = card.querySelector(".platform-chip");
  if (chip) {
    chip.textContent = platformLabel;
    chip.title = game.platforms.join(", ");
  }

  const title = card.querySelector(".game-title");
  if (title) title.textContent = game.title;

  const rating = card.querySelector(".rating");
  const reviews = card.querySelector(".reviews");
  const ratingState = card.querySelector(".rating-state");
  if (game.rating) {
    if (rating) {
      rating.textContent = `★ ${game.rating.percent}%`;
      rating.title = `Джерело: ${game.rating.source || "оцінки гравців"}`;
    }
    if (reviews) reviews.textContent = `${formatNumber(game.rating.total)} відгуків`;
    if (ratingState) ratingState.textContent = `${game.rating.source || "Оцінки гравців"} · ${game.rating.platformScope || "додаткове джерело"} · достовірність: ${ratingConfidence(game.rating.total)}`;
  } else {
    if (rating) rating.textContent = "★ —";
    if (reviews) reviews.textContent = game.ratingState === "pending" ? "шукаю оцінку" : "без доступної оцінки";
    if (ratingState) ratingState.textContent = game.ratingState === "pending" ? "Догружаю оцінку гравців..." : `Боксарт: ${game.coverSource || "підтверджено"}`;
  }

  const year = card.querySelector(".year");
  if (year) year.textContent = game.year || "—";

  const tags = card.querySelector(".game-tags");
  if (tags) {
    tags.replaceChildren();
    for (const genre of game.genres.slice(0, 2)) tags.append(makeTag(genre));
    tags.append(makeTag(platformLabel, "accent"));
  }

  const oldSave = card.querySelector(".save-button");
  if (oldSave) {
    const saved = Boolean(findEntry(game.id));
    const replacement = oldSave.cloneNode(true);
    replacement.classList.toggle("saved", saved);
    replacement.textContent = saved ? "✓" : "＋";
    replacement.setAttribute("aria-label", saved ? "Видалити зі списку" : "Додати до списку");
    replacement.addEventListener("click", event => {
      event.stopPropagation();
      toggleSaved(game);
    });
    oldSave.replaceWith(replacement);
  }
}

function createStableCardV8(game) {
  const fragment = renderGameCard(game);
  const card = fragment.querySelector(".game-card");
  card.__gameRefV8 = game;
  card.dataset.signatureV8 = gameCardSignatureV8(game);
  card.classList.add("card-enter-v8");
  card.addEventListener("animationend", () => card.classList.remove("card-enter-v8"), { once: true });
  return card;
}

function reconcileGridV8(pageGames) {
  const grid = elements.gameGrid;
  const existing = new Map([...grid.querySelectorAll(":scope > .game-card[data-id]")].map(card => [card.dataset.id, card]));
  const desiredIds = new Set(pageGames.map(game => game.id));

  for (const [id, card] of existing) {
    if (!desiredIds.has(id)) card.remove();
  }

  pageGames.forEach((game, index) => {
    let card = existing.get(game.id);
    if (!card || card.__gameRefV8 !== game) {
      const fresh = createStableCardV8(game);
      if (card?.isConnected) card.replaceWith(fresh);
      card = fresh;
    } else {
      patchGameCardV8(card, game);
    }
    const position = grid.children[index];
    if (position !== card) grid.insertBefore(card, position || null);
  });
}

renderGames = function renderGamesV8() {
  const readyGames = filteredGames().filter(game => game.coverReady);
  const total = readyGames.length;
  const pages = Math.max(1, Math.ceil(total / pageSizeV6));
  currentPageV6 = clamp(currentPageV6, 1, pages);
  const start = (currentPageV6 - 1) * pageSizeV6;
  const pageGames = readyGames.slice(start, start + pageSizeV6);
  const context = currentGridContextV8();

  reconcileGridV8(pageGames);
  gridContextV8 = context;

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

function titleVariantsV8(title) {
  const clean = String(title || "").replace(/[™®©]/g, "").replace(/[’‘]/g, "'").trim();
  const variants = [clean];
  variants.push(clean.replace(/:\s*/g, " - "));
  variants.push(clean.replace(/\s*&\s*/g, " and "));
  variants.push(clean.replace(/\s+and\s+/gi, " & "));
  if (/^the\s+/i.test(clean)) variants.push(`${clean.replace(/^the\s+/i, "")}, The`);
  if (clean.includes(":")) variants.push(clean.split(":")[0].trim());
  return unique(variants.filter(Boolean));
}

const libretroCandidatesBeforeV8 = libretroCandidatesV6;
libretroCandidatesV6 = function libretroCandidatesV8(game, platform) {
  const candidates = titleVariantsV8(game.title).flatMap(title => libretroCandidatesBeforeV8({ ...game, title }, platform));
  return [...new Map(candidates.map(candidate => [candidate.url, candidate])).values()];
};

const coverCandidatesBeforeV8 = coverCandidatesForGameV6;
coverCandidatesForGameV6 = function coverCandidatesV8(game, requestedPlatform) {
  const base = coverCandidatesBeforeV8(game, requestedPlatform);
  const platform = preferredPlatformV6(game, requestedPlatform);
  const pcLike = /windows|linux|macos|mac os|\bpc\b/i.test(platform.label || "");
  const steamVariants = pcLike && game.steamId ? [
    `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.steamId}/library_600x900_2x.jpg`,
    `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.steamId}/library_600x900.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamId}/library_600x900_2x.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamId}/library_600x900.jpg`
  ].map(url => ({ url, source: "Steam Box Art", platform: platform.label, platformSpecific: true })) : [];
  return [...new Map([...base, ...steamVariants].map(candidate => [candidate.url, candidate])).values()].slice(0, 60);
};

function inspectImageV8(url, timeout = 9000) {
  return new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), timeout);
    image.onload = () => finish({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => finish(null);
    image.referrerPolicy = "no-referrer";
    image.src = url;
  });
}

resolveCoverV6 = async function resolveCoverV8(game, requestedPlatform, generation) {
  game.coverReady = false;
  game.coverFailed = false;
  game.coverLoading = true;
  const candidates = coverCandidatesForGameV6(game, requestedPlatform);
  for (const candidate of candidates) {
    if (generation !== coverGenerationV6) return false;
    const dimensions = await inspectImageV8(candidate.url);
    if (!dimensions) continue;
    const ratio = dimensions.height / Math.max(1, dimensions.width);
    const explicitBoxart = /libretro|box art|steam/i.test(candidate.source || "");
    const portraitFallback = ratio >= 1.15 && dimensions.width >= 120 && dimensions.height >= 180;
    if (!explicitBoxart && !portraitFallback) continue;
    if (explicitBoxart && (dimensions.width < 120 || dimensions.height < 150 || ratio < 0.92)) continue;

    game.cover = candidate.url;
    game.coverCandidates = candidates.map(item => item.url);
    game.coverReady = true;
    game.coverLoading = false;
    game.coverSource = candidate.source;
    game.coverPlatform = candidate.platform;
    game.coverVerified = true;
    return true;
  }
  game.coverLoading = false;
  game.coverFailed = true;
  return false;
};

function patchCompactSearchV8() {
  const hero = document.querySelector(".hero");
  if (!hero || hero.classList.contains("compact-search-v8")) return;
  hero.classList.add("compact-search-v8");
  hero.querySelector(":scope > .eyebrow")?.remove();
  hero.querySelector(":scope > h1")?.remove();
  hero.querySelector(":scope > .hero-copy")?.remove();
}

function addDeckFactsV8() {
  if (!deckElementsV6?.header || document.getElementById("deckFactsV8")) return;
  deckElementsV6.header.classList.add("deck-header-v8");
  deckFactsV8 = document.createElement("div");
  deckFactsV8.id = "deckFactsV8";
  deckFactsV8.className = "deck-facts-v8";
  deckElementsV6.meta.insertAdjacentElement("afterend", deckFactsV8);
}

const resetDeckBeforeV8 = resetDeckV6;
resetDeckV6 = function resetDeckV8() {
  resetDeckBeforeV8();
  addDeckFactsV8();
  if (deckFactsV8) {
    deckFactsV8.hidden = false;
    deckFactsV8.innerHTML = `
      <div><span>КАТАЛОГ</span><strong>ПК · КОНСОЛІ · ПОРТАТИВНІ · РЕТРО</strong></div>
      <div><span>БОКСАРТ</span><strong>LIBRETRO · STEAM · WIKIMEDIA</strong></div>
      <div><span>МЕНЕДЖЕР</span><strong>СПИСКИ · СТАТУСИ · НОТАТКИ</strong></div>`;
  }
};

const updateDeckBeforeV8 = updateDeckGameV6;
updateDeckGameV6 = function updateDeckGameV8(game, impact = true) {
  updateDeckBeforeV8(game, false);
  addDeckFactsV8();
  const platforms = game.platforms?.join(", ") || "не вказано";
  const developers = game.developers?.join(", ") || "не вказано";
  const publishers = game.publishers?.join(", ") || "не вказано";
  const genres = game.genres?.join(", ") || "не вказано";
  const rating = game.rating ? `${game.rating.percent}% · ${formatNumber(game.rating.total)} відгуків` : "оцінка не доступна";
  deckElementsV6.description.textContent = game.description || "Опис гри у відкритому каталозі відсутній.";
  deckFactsV8.hidden = false;
  deckFactsV8.innerHTML = `
    <div><span>РОЗРОБНИК</span><strong>${escapeHtml(developers)}</strong></div>
    <div><span>ВИДАВЕЦЬ</span><strong>${escapeHtml(publishers)}</strong></div>
    <div><span>ПЛАТФОРМИ</span><strong>${escapeHtml(platforms)}</strong></div>
    <div><span>ЖАНРИ</span><strong>${escapeHtml(genres)}</strong></div>
    <div><span>ОЦІНКА ГРАВЦІВ</span><strong>${escapeHtml(rating)}</strong></div>
    <div><span>БОКСАРТ</span><strong>${escapeHtml(game.coverSource || "підтверджено")}</strong></div>`;
  if (impact) {
    deckElementsV6.slotBay.classList.remove("slot-impact-strong-v8");
    requestAnimationFrame(() => deckElementsV6.slotBay.classList.add("slot-impact-strong-v8"));
  }
};

animateCardToSlotV6 = function animateCardToSlotV8(game) {
  const source = document.querySelector(`.game-card[data-id="${CSS.escape(game.id)}"] .cartridge`);
  const target = deckElementsV6.cartridge;
  if (!source || !target || state.settings.reduceMotion || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    updateDeckGameV6(game);
    return;
  }

  const from = source.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const clone = source.cloneNode(true);
  clone.className = "flying-cartridge-v6 flying-cartridge-v8";
  clone.querySelectorAll("button").forEach(button => button.remove());
  Object.assign(clone.style, {
    left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px`
  });
  document.body.append(clone);
  deckElementsV6.slotBay.classList.add("slot-arming-v8");

  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const animation = clone.animate([
    { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
    { transform: `translate(${dx * .42}px,${dy * .30 - 90}px) scale(.92) rotate(8deg)`, opacity: 1, offset: .42 },
    { transform: `translate(${dx * .88}px,${dy * .83 - 24}px) scale(${sx * 1.08},${sy * 1.08}) rotate(-4deg)`, opacity: .96, offset: .82 },
    { transform: `translate(${dx}px,${dy}px) scale(${sx},${sy}) rotate(0deg)`, opacity: .78, offset: 1 }
  ], { duration: 760, easing: "cubic-bezier(.18,.82,.2,1)", fill: "forwards" });

  animation.finished.finally(() => {
    clone.remove();
    deckElementsV6.slotBay.classList.remove("slot-arming-v8");
    updateDeckGameV6(game, true);
  });
};

async function initV8Enhancements() {
  await ensureV8Styles();
  patchCompactSearchV8();
  const waitUntilDeck = () => {
    if (deckElementsV6?.header && deckElementsV6?.meta) {
      addDeckFactsV8();
      resetDeckV6();
      return;
    }
    setTimeout(waitUntilDeck, 40);
  };
  waitUntilDeck();
}

initV8Enhancements().catch(error => console.error("Save Slot 0.5.2:", error));