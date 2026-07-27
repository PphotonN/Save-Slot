# Architecture

## Overview

Save Slot v1 is a small web-first application with a thin aggregation backend.

```text
Desktop browser / installed PWA / Capacitor shell
                    │
                    ▼
              SvelteKit client
                    │
          normalized Save Slot API
                    │
                    ▼
            Cloudflare Worker
      ┌─────────────┼─────────────┐
      ▼             ▼             ▼
  catalogue      media         ratings
  providers      providers      providers
```

The frontend never embeds private provider credentials. The Worker normalizes provider responses, applies cache rules and returns a stable internal contract.

## Technology choices

### Frontend

- SvelteKit
- TypeScript with strict mode
- static adapter for the PWA build
- service worker for application-shell and read cache
- IndexedDB for collection data, cached entities and translations
- Three.js only inside the isolated PS1 slot scene
- Capacitor after the PWA interaction model is stable

### Backend

- Cloudflare Worker
- provider adapters with independent timeouts and circuit breakers
- Cache API for public normalized responses
- secrets for provider credentials
- optional KV for provider ID mappings and negative-cache entries
- no user account database in the first milestone

### Tooling

- pnpm workspace
- ESLint and Prettier
- Vitest for unit tests
- Playwright for desktop and mobile interaction tests
- Zod for runtime schema validation
- GitHub Actions for checks only; no public deployment until explicitly enabled

## Proposed workspace

```text
apps/
  web/
    src/
      lib/
        components/
        features/
        routes/
        services/
        stores/
      routes/
      service-worker.ts
  api/
    src/
      routes/
      providers/
      normalization/
      cache/
  mobile/
    capacitor.config.ts
packages/
  domain/
    src/entities/
    src/schemas/
    src/rules/
  providers/
    src/contracts/
    src/shared/
  storage/
    src/indexeddb/
    src/export/
    src/migrations/
  ui/
    src/components/
    src/tokens/
  i18n/
    src/messages/
    src/translation/
  ps1-scene/
    src/scene/
    src/materials/
    src/animation/
```

## Application boundaries

### `domain`

Contains canonical entities and rules. It must not import UI, browser or provider-specific code.

Responsibilities:

- `Game`, `Release`, `MediaAsset`, `Rating`, `CollectionEntry` schemas;
- source provenance;
- deduplication keys;
- collection status rules;
- migrations between persisted versions.

### `providers`

Defines provider-neutral interfaces and adapter helpers.

```ts
interface CatalogueProvider {
  search(query: SearchQuery): Promise<ProviderSearchResult[]>;
  getGame(id: string): Promise<ProviderGame | null>;
  getReleases(id: string): Promise<ProviderRelease[]>;
}

interface MediaProvider {
  getMedia(ref: ProviderRef): Promise<ProviderMedia[]>;
}

interface RatingProvider {
  getRatings(ref: ProviderRef): Promise<ProviderRating[]>;
}
```

Provider output is never stored directly in the collection. It is normalized first.

### `web`

Responsibilities:

- responsive navigation;
- search and filters;
- game and release details;
- collection management;
- offline state;
- translation controls;
- PS1 slot interaction.

### `api`

Responsibilities:

- source authentication;
- rate limiting and retries;
- response caching;
- provider fan-out;
- normalization support;
- safe image proxying only when provider terms permit it;
- health and provider-status reporting.

## API design

Initial endpoints:

```text
GET /v1/search?q=&platform=&page=&language=
GET /v1/games/:canonicalId?language=
GET /v1/games/:canonicalId/releases
GET /v1/releases/:releaseId/media
GET /v1/releases/:releaseId/ratings
POST /v1/translate
GET /v1/providers/status
```

Responses use Save Slot entities rather than exposing provider payloads.

### Search response

```json
{
  "items": [],
  "page": 1,
  "pageSize": 24,
  "hasMore": true,
  "providers": ["igdb", "wikidata"],
  "warnings": []
}
```

## Search pipeline

1. Validate and normalize the query.
2. Query enabled catalogue providers in parallel with separate timeouts.
3. Convert each response into provider-neutral candidates.
4. Link candidates by trusted external IDs first.
5. Use normalized title, year and platform only as a fallback match.
6. Rank candidates without dropping unrated games.
7. Return games immediately.
8. Load release media and ratings progressively.
9. Keep already rendered cards stable as new fields arrive.

Sorting must never control whether an item is visible. Filtering, sorting and rendering are independent stages.

## Cache strategy

### Worker cache

- search responses: short TTL;
- game metadata: medium TTL;
- release and media metadata: longer TTL;
- ratings: short or medium TTL depending on provider;
- missing provider IDs and missing covers: short negative cache;
- provider errors: never cached as permanent absence.

### Client cache

- collection data: persistent;
- last viewed games: persistent with versioned TTL;
- search pages: temporary;
- translations: persistent until source text changes;
- images: browser/PWA cache, respecting provider terms.

## Offline behaviour

Available offline:

- application shell;
- personal collection;
- saved box-art thumbnails already cached;
- notes, status and personal ratings;
- previously opened game summaries;
- export and import.

Unavailable offline:

- new catalogue searches;
- fresh ratings;
- uncached screenshots;
- server translation.

The interface must show these limitations explicitly rather than failing silently.

## 3D scene isolation

The PS1 scene is an enhancement and must not own application state.

Input:

```ts
{
  cartridgeTextureUrl,
  platformStyle,
  animationState,
  reducedMotion
}
```

Output events:

```text
insert-start
insert-complete
eject-start
eject-complete
```

The cartridge uses one rigid transform. Width, height and depth are never independently stretched during insertion.

## Mobile architecture

The initial PWA must work in a narrow viewport without native plugins. Capacitor is added later as a shell around the same build.

Native-only features are accessed through interfaces so the web implementation can use fallbacks:

- barcode scanning;
- file export/import;
- share sheet;
- secure credential storage;
- notifications.

## Error handling

Every provider request returns one of:

- success;
- partial data;
- not found;
- rate limited;
- temporarily unavailable;
- invalid response.

A single provider failure must not cancel the whole game page. The UI shows which sections are partial.

## Observability

The Worker should expose privacy-safe diagnostics:

- provider latency;
- cache hit ratio;
- timeout count;
- rate-limit count;
- normalization failures.

Do not log user collection contents, notes or translation text by default.

## Deployment environments

- `local` — mock or development credentials;
- `preview` — private test deployment;
- `production` — enabled only after v1 readiness review.

No production secrets are committed to Git. Local secrets use ignored environment files; deployed secrets use the Worker secret store.
