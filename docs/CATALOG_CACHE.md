# Catalogue cache

Save Slot caches normalized catalogue data after provider enrichment. The cache is separate from the personal collection file in `.save-slot-data`.

## Goals

- avoid repeating the same Wikidata, Steam and Libretro requests;
- keep sorting independent from provider requests;
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
catalog:v2:search:<locale>:<platform>:<limit>:<query>
catalog:v2:game:<game-id>
catalog:v2:release:<release-id>
```

Sorting is not part of the search key. A normalized page is cached once and sorted independently for each response.

## Lifetime

Current defaults:

- normalized search pages: 6 hours;
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
- configured search/detail lifetimes;
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
