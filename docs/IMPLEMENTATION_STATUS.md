# Save Slot v1 implementation status

## Current milestone

The repository contains a functional private alpha of the rewritten application. It now covers live search, suggestions, bounded paging, release-specific media, cached detail lookup, project-folder persistence and a multi-list physical/digital collection manager without publishing a public build.

## Implemented

### Workspace

- pnpm monorepo;
- SvelteKit web application;
- Cloudflare Worker aggregation API;
- local project-folder collection cache service;
- shared domain, provider, storage, UI, localization and PS1-scene packages;
- strict TypeScript and Prettier configuration;
- private GitHub Actions verification without deployment;
- automatic Windows portable runtime based on Node.js 24.18.0 LTS.

### Domain and collection model

- games, releases and personal copies are separate entities;
- every collection entry references a concrete release;
- provider media and ratings retain source and platform scope;
- normalized platform IDs are shared across providers;
- collection entries support ownership, format, status, personal rating, notes, tags, priority and quantity;
- physical copies support box condition, media condition and completeness;
- acquisition date, price, currency and personal cover URL are nullable and clearable;
- old version-1 collection files receive safe default values automatically;
- lists support collection, wishlist, backlog and custom presets;
- view mode and platform grouping are stored per list;
- membership is maintained atomically in both `entry.listIds` and `list.entryIds`;
- legacy one-sided membership is normalized on import.

### Web application

- varied discovery loads on startup;
- search uses the aggregation API with fixture fallback;
- debounced suggestions cancel stale requests;
- search loads 18 games per page from a stable normalized pool;
- later pages append without clearing accepted cards;
- platform filtering, sorting and rendering remain independent;
- cards and cartridge rows fill from left to right;
- selected games expose release switching, overview, media, ratings and sources;
- Steam and matched Libretro screenshots appear in a source-labelled gallery;
- personal collection includes list, row and cartridge presentations;
- users can create custom lists and wishlist/backlog presets;
- deleting a list does not delete its games;
- entries can belong to several lists;
- each list remembers its view and grouping preference;
- platform grouping inserts readable group headers across all three presentation modes;
- collection search, status/platform filters and sorting are available;
- the entry editor covers copy condition, completeness, acquisition data, price, tags, notes and custom cover;
- custom cover URLs are validated, previewed and resettable;
- desktop and mobile use one codebase;
- PWA manifest and offline application shell are present.

### Project library cache

- local-only service on `127.0.0.1:8791`;
- `GET /health`, `GET /library` and `PUT /library`;
- atomic formatted JSON writes;
- previous file retained as `library.backup.json`;
- 20 MB payload limit and schema-envelope validation;
- launcher starts and checks the service before the web application;
- `.save-slot-data` is ignored by Git.

### Catalogue cache

- process-local memory cache;
- Cache API when available;
- optional KV-compatible `CATALOG_CACHE` binding;
- six-hour normalized search pools;
- 12-hour suggestion cache;
- 30-day game/release detail cache;
- stable cached game and release routes;
- diagnostics through `/v1/cache` and the settings panel;
- no personal collection data stored in catalogue cache layers.

### Providers

#### Wikidata

- Action API search and entity batches without SPARQL;
- localized titles, descriptions and aliases;
- platforms, genres, dates, developers and publishers;
- Steam App ID linking;
- timeout, abort and fixture fallback behavior.

#### Libretro

- known platform-to-playlist mapping;
- trusted existing source ID/URL priority;
- release title, canonical title and alias candidates;
- punctuation, article, numeral and region variants;
- strict thumbnail host allowlist;
- bounded candidate count and request timeout;
- `HEAD` with ranged `GET` fallback;
- positive and negative probe cache;
- verified `Named_Boxarts`, matching `Named_Snaps` and matching `Named_Titles`.

#### Steam

- PC box art;
- official description;
- screenshots;
- developers and publishers;
- player rating percentage and review count.

### API boundary

- `/health`;
- `/v1/providers`;
- `/v1/cache`;
- `/v1/suggestions`;
- `/v1/search`;
- `/v1/discovery`;
- `/v1/games/:id`;
- `/v1/releases/:id`.

## Tests included

- canonical fixtures validate against runtime schemas;
- old collection entries receive new defaults;
- physical-copy metadata and list grouping survive export validation;
- collection export/import preserves release identity and personal data;
- membership updates both directions atomically;
- deleting a list retains games;
- legacy one-sided membership normalizes without data loss;
- project-file mirroring restores and writes the collection;
- search sorting preserves the visible set;
- fixture paging returns distinct pages and accurate totals;
- provider aggregation preserves cursor and total;
- Wikidata normalization is tested without network access;
- robust Libretro source, fallback, alias and supplementary-media behavior is tested;
- Steam enrichment is tested;
- catalogue memory/KV cache and detail routes are tested;
- rigid cartridge transforms and aspect ratio are tested.

## Known limitations

- CI status cannot be read through the current GitHub integration; the private Actions tab must confirm a clean build;
- search paging is bounded to the current 40-game normalized pool;
- first-time rating sorting can use only ratings available before current-page enrichment;
- IGDB, MobyGames and RAWG are deferred pending terms and credentials review;
- optional KV is not configured in the repository;
- non-Libretro console screenshot coverage remains limited;
- many interface strings are still embedded directly in Ukrainian components;
- external description translation is not implemented yet;
- the slot is still a rigid CSS prototype rather than the final isolated Three.js scene;
- Playwright acceptance tests are not present;
- project-folder persistence is desktop-local and not yet synchronized to smartphones;
- Capacitor Android/iOS wrappers are not created;
- no preview or public deployment is enabled.

## Next implementation milestone

1. Move interface strings into the Ukrainian/English localization catalogue.
2. Add Playwright desktop and smartphone acceptance tests.
3. Implement the isolated Three.js slot with a functional CSS/non-WebGL fallback.
4. Add clean, dither and CRT artwork controls.
5. Prepare the Capacitor Android wrapper.
