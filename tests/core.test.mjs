import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAggregateRating,
  createLibraryState,
  exportBackup,
  filterAndSortGames,
  mergeStates,
  migrateState,
  normalizeGame
} from "../core.js";

test("normalizes RAWG rating to 100-point scale", () => {
  const game = normalizeGame({ id: 10, name: "Test", rating: 4.5, ratings_count: 100 }, "rawg");
  assert.equal(game.aggregate.score, 90);
  assert.equal(game.aggregate.votes, 100);
});

test("aggregates user sources with vote-aware weighting", () => {
  const aggregate = computeAggregateRating([
    { name: "Small", score: 100, votes: 1 },
    { name: "Large", score: 80, votes: 10000 }
  ]);
  assert.ok(aggregate.score < 90);
  assert.equal(aggregate.sourceCount, 2);
  assert.equal(aggregate.confidence, "high");
});

test("filters by HLTB duration and rating", () => {
  const games = [
    normalizeGame({ id: 1, title: "Short", ratingSources: [{ name: "A", score: 90, votes: 100 }], mainHours: 5 }, "local"),
    normalizeGame({ id: 2, title: "Long", ratingSources: [{ name: "A", score: 95, votes: 100 }], mainHours: 50 }, "local")
  ];
  const result = filterAndSortGames(games, { minRating: 80, maxHours: 10, durationMode: "main", includeUnknownDuration: false });
  assert.deepEqual(result.map(game => game.title), ["Short"]);
});

test("migrates legacy list export", () => {
  const state = migrateState({ format: "save-slot-list", name: "Legacy", games: [{ id: 1, title: "Game", platform: "PSP" }] });
  assert.equal(state.lists[0].name, "Legacy");
  assert.equal(state.lists[0].items.length, 1);
});

test("preserves normalized playtime during migration", () => {
  const game = normalizeGame({ id: 8, title: "Time", hltb: { main: 12, mainPlus: 18, completionist: 30 } }, "local");
  const state = createLibraryState();
  state.catalog[game.key] = game;
  const migrated = migrateState(state);
  assert.equal(migrated.catalog[game.key].playtime.main, 12);
  assert.equal(migrated.catalog[game.key].playtime.completionist, 30);
});

test("merges backups without deleting current lists", () => {
  const a = createLibraryState();
  a.lists[0].name = "A";
  const b = createLibraryState();
  b.lists[0].id = "other";
  b.lists[0].name = "B";
  const merged = mergeStates(a, exportBackup(b));
  assert.equal(merged.lists.length, 2);
});
