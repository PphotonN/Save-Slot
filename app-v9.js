const SAVE_SLOT_V9 = "0.5.3";
let revealContextV9 = "";
let revealOrderV9 = new Map();
let revealCounterV9 = 0;

const filteredGamesBeforeV9 = filteredGames;
filteredGames = function filteredGamesV9() {
  const games = filteredGamesBeforeV9();
  const context = `${currentQuery}|${elements.sortSelect?.value || "relevance"}`;

  if (context !== revealContextV9) {
    revealContextV9 = context;
    revealOrderV9 = new Map();
    revealCounterV9 = 0;
  }

  for (const game of games) {
    if (game.coverReady && !revealOrderV9.has(game.id)) {
      revealOrderV9.set(game.id, revealCounterV9++);
    }
  }

  const originalPosition = new Map(games.map((game, index) => [game.id, index]));
  return games.sort((a, b) => {
    const aReady = revealOrderV9.has(a.id);
    const bReady = revealOrderV9.has(b.id);
    if (aReady && bReady) return revealOrderV9.get(a.id) - revealOrderV9.get(b.id);
    if (aReady) return -1;
    if (bReady) return 1;
    return originalPosition.get(a.id) - originalPosition.get(b.id);
  });
};
