function steamCacheKey(appId) { return `save-slot-steam-${appId}`; }
function readSteamCache(appId) {
  try { const value = JSON.parse(sessionStorage.getItem(steamCacheKey(appId))); return value && Date.now() - value.time < 21600000 ? value.data : null; } catch { return null; }
}
function writeSteamCache(appId, data) { try { sessionStorage.setItem(steamCacheKey(appId), JSON.stringify({time:Date.now(),data})); } catch { } }

async function fetchSteamSummary(appId) {
  const cached = readSteamCache(appId);
  if (cached) return cached;
  const target = `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all&num_per_page=0`;
  const urls = [target, `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`, `https://corsproxy.io/?url=${encodeURIComponent(target)}`];
  let lastError;
  for (const url of urls) {
    try {
      const data = await fetchJson(url, 10000);
      const summary = data?.query_summary;
      if (!summary || !Number.isFinite(Number(summary.total_reviews))) throw new Error("Невірна відповідь Steam");
      const total = Number(summary.total_reviews) || 0;
      const positive = Number(summary.total_positive) || 0;
      if (!total) return null;
      const percent = Math.round((positive / total) * 100);
      const trust = Math.round(wilsonLowerBound(positive, total) * 1000) / 10;
      const result = { source: "Steam", percent, positive, total, trust, description: summary.review_score_desc || "" };
      writeSteamCache(appId, result);
      return result;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error("Steam недоступний");
}

function wilsonLowerBound(positive, total, z = 1.96) {
  if (!total) return 0;
  const p = positive / total;
  const z2 = z*z;
  return (p + z2/(2*total) - z*Math.sqrt((p*(1-p)+z2/(4*total))/total)) / (1+z2/total);
}

async function enrichSteamRatings(games, sequence, started) {
  let completed = 0;
  let successful = 0;
  const queue = [...games];
  const workers = Array.from({length: Math.min(4, queue.length)}, async () => {
    while (queue.length && sequence === searchSequence) {
      const game = queue.shift();
      try {
        game.rating = await fetchSteamSummary(game.steamId);
        game.ratingState = game.rating ? "ready" : "unavailable";
        if (game.rating) successful += 1;
      } catch { game.ratingState = "error"; }
      completed += 1;
      setSourceState("loading", `STEAM ${completed}/${games.length}`);
      setFeedback(`Метадані готові. Steam-відгуки: ${completed}/${games.length} перевірено, ${successful} рейтингів отримано.`);
      scheduleRender();
    }
  });
  await Promise.all(workers);
  if (sequence !== searchSequence) return;
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  setSourceState("ready", "ДЖЕРЕЛА ГОТОВІ");
  setFeedback(`Готово за ${seconds} с. Ігор: ${currentResults.length}; реальних Steam-рейтингів: ${successful}.`, "success");
  renderGames();
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => { renderScheduled = false; renderGames(); });
}
