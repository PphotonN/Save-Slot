# Catalogue cache

Save Slot caches normalized catalogue data after provider enrichment. The cache is separate from the personal collection file in `.save-slot-data`.

## Goals

- avoid repeating the same Wikidata, Steam and Libretro requests;
- keep sorting independent from provider requests;
- support search suggestions without repeating identical provider work;
- page through a stable normalized search pool without clearing existing cards;
- make `/v1/games/:id` and `/v1/releases/:id` work for previously discovered online entities;
- preserve useful details when an upstream provider is temporarily unavailable;
- keep local development functional without Cloudflare credentials.

## Layers

The Worker uses the available layers in this order:

1. **Worker memory** — fastest, process-local lookup;
2. **optional Cloudflare KV-compatible binding** — durable detail/search storage when configured;
3. **Cache API** — HTTP cache available in supported Worker environments.

The memory layer is always available. KV is optional; the application does not fail when it is absent.

## Keys

Cache keys include a schema namespace so incompatible data can be invalidated without deleting user collection data.

```text
catalog:v3:search:<locale>:<platform>:<query>
catalog:v3:suggestions:<locale>:<query>
catalog:v3:game:<game-id>
catalog:v3:release:<release-id>
```

Sorting, page size and cursor are not part of the search-pool key. A normalized pool is cached once and then sorted and sliced independently for each response.

## Search paging boundary

The current Worker keeps a normalized pool of at most 40 game results for a query. `/v1/search` returns a numeric continuation cursor into that pool.

```text
GET /v1/search?q=Metroid&limit=18&cursor=0
GET /v1/search?q=Metroid&limit=18&cursor=18
```

The response includes:

- `items` — the current page;
- `nextCursor` — the next offset when more pool entries remain;
- `total` — the number of games currently available in the normalized pool.

This is deliberate bounded paging, not an assertion that every matching record in every upstream database has been exhausted. Existing cards remain mounted while the web client appends a subsequent page.

## Suggestions

```text
GET /v1/suggestions?q=Metal&locale=uk&limit=6
```

Suggestions contain a title, available platform labels and a short description when present. Queries shorter than two characters return an empty result. The web client waits briefly after typing and cancels stale requests.

## Lifetime

Current defaults:

- normalized search pools: 6 hours;
- search suggestions: 12 hours;
- game and release details: 30 days;
- short memory promotion after a persistent hit: 60 seconds.

Discovery responses are intentionally not cached as complete pages because every new session should remain varied. Games and releases found during discovery are still written to detail keys.

## Detail routes

```text
GET /v1/games/:id
GET /v1/releases/:id
```

Lookup order:

1. cached online entity;
2. representative fixture fallback;
3. `404` when neither exists.

Cached values are validated through the canonical Zod schemas before they are returned. Invalid cached detail data is deleted.

## Diagnostics

```text
GET /v1/cache
```

The endpoint reports:

- enabled cache backends;
- memory entry count;
- hit, miss and write counters for the current Worker process;
- configured search, suggestion and detail lifetimes;
- current search-pool limit;
- whether Cache API and KV are available.

The same information appears in the application settings. It contains no provider credentials or personal collection data.

## Optional KV binding

Production deployments may provide a binding named:

```text
CATALOG_CACHE
```

The binding must expose JSON reads and string writes with an expiration TTL. Keep environment-specific namespace identifiers outside shared source files when possible. Local development and the automatic launcher do not require this binding.

## Privacy boundary

The catalogue cache contains public normalized game metadata, release metadata, media URLs and sourced ratings. It must not contain:

- personal collection entries;
- personal ratings or notes;
- purchase prices;
- API secrets;
- account identifiers.

Personal data remains in IndexedDB and `.save-slot-data/library.json`.
