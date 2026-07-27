(() => {
  "use strict";

  const originalFetch = window.fetch.bind(window);
  const RAWG_HOST = "api.rawg.io";
  const SEARCH_TIMEOUT_MS = 15000;
  let activeSearches = 0;
  let searchStartedAt = 0;
  let searchTimer = null;

  function normalizeText(value) {
    return String(value || "")
      .toLocaleLowerCase("en-US")
      .normalize("NFKD")
      .replace(/[™®©]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function relevanceScore(name, query) {
    const title = normalizeText(name);
    const needle = normalizeText(query);
    if (!needle) return 0;
    if (title === needle) return 10000;
    if (title.startsWith(`${needle} `)) return 8000;
    if (title.startsWith(needle)) return 7000;
    if (title.includes(` ${needle} `)) return 6200;
    if (title.includes(needle)) return 5600;

    const queryTokens = needle.split(" ").filter(Boolean);
    const titleTokens = title.split(" ").filter(Boolean);
    const titleSet = new Set(titleTokens);
    const common = queryTokens.filter(token => titleSet.has(token)).length;
    const coverage = queryTokens.length ? common / queryTokens.length : 0;
    const firstTokenBonus = queryTokens[0] && titleTokens[0] === queryTokens[0] ? 700 : 0;
    const lengthPenalty = Math.abs(titleTokens.length - queryTokens.length) * 12;
    return Math.round(coverage * 4000 + firstTokenBonus - lengthPenalty);
  }

  function makeResponse(response, data) {
    const headers = new Headers(response.headers);
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(data), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  function dispatchSearchEvent(name, detail = {}) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  window.fetch = async function patchedFetch(input, init = {}) {
    let url;
    try {
      url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.href);
    } catch {
      return originalFetch(input, init);
    }

    const isRawgGamesSearch = url.hostname === RAWG_HOST
      && url.pathname.replace(/\/$/, "") === "/api/games"
      && url.searchParams.has("search");

    if (!isRawgGamesSearch) return originalFetch(input, init);

    const query = url.searchParams.get("search") || "";
    // RAWG otherwise sorts a textual search by rating, which can put loose matches first.
    url.searchParams.delete("ordering");
    url.searchParams.set("search_precise", "true");

    const controller = new AbortController();
    const externalSignal = init.signal;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }

    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    dispatchSearchEvent("save-slot-search-start", { query });

    try {
      const response = await originalFetch(url.toString(), { ...init, signal: controller.signal });
      if (!response.ok) return response;

      const data = await response.clone().json();
      if (Array.isArray(data.results) && query.trim()) {
        data.results = data.results
          .map((game, index) => ({ game, index, score: relevanceScore(game.name, query) }))
          .sort((a, b) => b.score - a.score || a.index - b.index)
          .map(item => item.game);
      }
      dispatchSearchEvent("save-slot-search-success", { query, count: data.results?.length || 0 });
      return makeResponse(response, data);
    } catch (error) {
      if (controller.signal.aborted && !externalSignal?.aborted) {
        const timeoutError = new Error("RAWG не відповів за 15 секунд. Перевір з’єднання або повтори пошук.");
        dispatchSearchEvent("save-slot-search-error", { query, message: timeoutError.message });
        throw timeoutError;
      }
      dispatchSearchEvent("save-slot-search-error", { query, message: error?.message || "Помилка пошуку" });
      throw error;
    } finally {
      clearTimeout(timeout);
      dispatchSearchEvent("save-slot-search-end", { query });
    }
  };

  function ensureFeedback() {
    let feedback = document.getElementById("searchFeedback");
    if (feedback) return feedback;
    feedback = document.createElement("div");
    feedback.id = "searchFeedback";
    feedback.className = "search-feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    document.getElementById("searchForm")?.insertAdjacentElement("afterend", feedback);
    return feedback;
  }

  function setFeedback(message, mode = "idle") {
    const feedback = ensureFeedback();
    feedback.dataset.mode = mode;
    feedback.textContent = message;
  }

  function setSearching(searching) {
    document.querySelector(".results-area")?.classList.toggle("is-searching", searching);
    document.getElementById("searchInput")?.toggleAttribute("aria-busy", searching);
  }

  function beginSearch(query) {
    activeSearches += 1;
    if (activeSearches > 1) return;
    searchStartedAt = performance.now();
    setSearching(true);
    clearInterval(searchTimer);
    const update = () => {
      const elapsed = ((performance.now() - searchStartedAt) / 1000).toFixed(1);
      setFeedback(`Шукаю «${query || "ігри"}» · ${elapsed} с`, "loading");
    };
    update();
    searchTimer = setInterval(update, 100);
  }

  function finishSearch(message, mode) {
    activeSearches = Math.max(0, activeSearches - 1);
    if (activeSearches) return;
    clearInterval(searchTimer);
    searchTimer = null;
    setSearching(false);
    const elapsed = searchStartedAt ? ((performance.now() - searchStartedAt) / 1000).toFixed(1) : "0.0";
    setFeedback(`${message} · ${elapsed} с`, mode);
  }

  function decorateArtwork(root = document) {
    for (const image of root.querySelectorAll?.("img.game-cover") || []) {
      if (!/media\.rawg\.io|rawg\.io\/media/i.test(image.src) || image.dataset.rawgDecorated) continue;
      image.dataset.rawgDecorated = "true";
      const card = image.closest(".game-card");
      const wrap = image.closest(".cover-wrap");
      card?.classList.add("rawg-artwork");
      if (wrap) wrap.style.setProperty("--rawg-art", `url(\"${image.src.replace(/\"/g, "%22")}\")`);
      image.alt = image.alt.replace(/^Обкладинка/, "Ілюстрація");
      if (wrap && !wrap.querySelector(".artwork-source")) {
        const badge = document.createElement("span");
        badge.className = "artwork-source";
        badge.textContent = "ART RAWG";
        wrap.append(badge);
      }
    }
  }

  function updateModeHint() {
    const mode = document.getElementById("dataStatusText")?.textContent?.trim();
    if (mode === "ДЕМО") {
      setFeedback("Демонстраційний каталог. Для пошуку по всій базі відкрий Налаштування → RAWG і додай API key.", "demo");
    } else if (mode === "ПОМИЛКА API") {
      setFeedback("Онлайн-пошук недоступний. Перевір RAWG API key та інтернет-з’єднання.", "error");
    } else if (mode === "RAWG" && !searchTimer) {
      setFeedback("Онлайн-пошук RAWG активний.", "ready");
    }
  }

  window.addEventListener("save-slot-search-start", event => beginSearch(event.detail.query));
  window.addEventListener("save-slot-search-success", event => {
    window.__saveSlotLastSearch = { ok: true, count: event.detail.count };
  });
  window.addEventListener("save-slot-search-error", event => {
    window.__saveSlotLastSearch = { ok: false, message: event.detail.message };
  });
  window.addEventListener("save-slot-search-end", () => {
    const result = window.__saveSlotLastSearch;
    if (result?.ok) finishSearch(`Готово: отримано ${result.count} результатів`, "success");
    else finishSearch(result?.message || "Пошук завершено з помилкою", "error");
    window.__saveSlotLastSearch = null;
  });

  document.addEventListener("DOMContentLoaded", () => {
    ensureFeedback();
    updateModeHint();
    decorateArtwork();

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) decorateArtwork(node);
      }
      updateModeHint();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-mode"] });

    document.getElementById("searchForm")?.addEventListener("submit", () => {
      if (document.getElementById("dataStatusText")?.textContent?.trim() === "ДЕМО") {
        setFeedback("Це локальний пошук лише серед демонстраційних ігор. Увімкни RAWG у налаштуваннях для повного каталогу.", "demo");
      }
    }, true);
  });
})();
