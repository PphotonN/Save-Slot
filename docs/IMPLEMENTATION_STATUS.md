# Save Slot v1 implementation status

## Current milestone

The repository contains a functional private alpha of the rewritten application. It covers cross-platform search, suggestions, bounded paging, release-specific media, cached detail lookup, local-first collection management, a production PWA shell, an isolated Three.js slot scene and a prepared Capacitor Android wrapper. No public deployment or signed mobile build is enabled.

## Implemented

### Workspace

- pnpm monorepo;
- SvelteKit 5 web application;
- Cloudflare Worker aggregation API;
- local project-folder collection cache service;
- Capacitor Android wrapper package;
- shared domain, provider, storage, UI, localization and PS1-scene packages;
- strict TypeScript, Vitest, Svelte Check, Prettier and Playwright configuration;
- one private GitHub Actions workflow with quality and acceptance jobs;
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
- legacy one-sided membership is normalized on import;
- imported URLs accept only HTTP/HTTPS;
- duplicate IDs, broken list references, missing releases and mismatched snapshots are rejected before storage changes;
- imported arrays, text fields and numeric values have explicit upper bounds.

### Web application

- varied discovery loads on startup;
- search uses the aggregation API with fixture fallback;
- debounced suggestions cancel stale requests;
- search loads 18 games per page from a stable normalized pool;
- later pages append without clearing accepted cards;
- platform filtering, sorting and rendering remain independent;
- cards and cartridge rows fill from left to right;
- selected games expose release switching, overview, media, ratings and sources;
- Steam and matched Libretro screenshots/title screens appear in a source-labelled gallery;
- personal collection includes list, row and cartridge presentations;
- users can create custom lists and wishlist/backlog presets;
- deleting a list does not delete its games;
- entries can belong to several lists;
- each list remembers its view and grouping preference;
- platform grouping inserts readable group headers across all three presentation modes;
- collection search, status/platform filters and sorting are available;
- the entry editor covers copy condition, completeness, acquisition data, price, tags, notes and custom cover;
- custom cover URLs are validated, previewed and resettable;
- collection imports reject unsupported file types and files above 8 MiB before reading/parsing;
- Ukrainian and English interface language switching persists locally;
- desktop and mobile use one responsive codebase.

### PWA and offline behavior

- production manifest and service worker;
- deployment-base-aware manifest, icon and shell fallback;
- production-preview Playwright project with service workers enabled;
- offline reload restores the application shell;
- IndexedDB collection entries survive offline reload;
- ordinary desktop/mobile acceptance tests block service workers for isolation;
- PWA and Capacitor use the same static SvelteKit build.

### PS1 slot scene

- lazy-loaded isolated Three.js controller;
- low-poly chassis and rigid cartridge geometry;
- position/rotation/uniform-scale insertion and ejection;
- aspect-safe cover UV crop without stretching;
- event-driven rendering instead of a permanent frame loop;
- low-power renderer and device-pixel-ratio cap;
- stale transition cancellation and GPU resource disposal;
- WebGL context-loss handling with immediate CSS fallback;
- reduced-motion behavior;
- persistent `CLEAN`, `PS1` and `CRT` artwork modes;
- CSS fallback remains visible during renderer loading and on unsupported devices.

### Android wrapper

- provisional application ID `com.pphotonn.saveslot`;
- automated web build, `cap add android` and `cap sync android` workflow;
- root commands to prepare, open and run Android;
- HTTPS local WebView scheme and mixed-content blocking;
- application-owned service-worker handling;
- IndexedDB-only native storage without desktop `127.0.0.1:8791` requests;
- documentation for Android Studio and online Worker configuration.

### Project library cache

- local-only service on `127.0.0.1:8791`;
- `GET /health`, `GET /library` and `PUT /library`;
- atomic formatted JSON writes;
- previous file retained as `library.backup.json`;
- 20 MB payload limit and schema-envelope validation;
- launcher starts and checks the service before the web application;
- `.save-slot-data` is ignored by Git;
- automatically disabled inside a native Capacitor runtime.

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
- executable URL schemes, duplicate IDs and broken references are rejected;
- membership updates both directions atomically;
- deleting a list retains games;
- legacy one-sided membership normalizes without data loss;
- desktop project-file mirroring restores and writes the collection;
- native Capacitor storage performs no localhost file-cache requests;
- search sorting preserves the visible set;
- fixture paging returns distinct pages and accurate totals;
- provider aggregation preserves cursor and total;
- Wikidata normalization is tested without network access;
- robust Libretro source, fallback, alias and supplementary-media behavior is tested;
- Steam enrichment is tested;
- catalogue memory/KV cache and detail routes are tested;
- rigid cartridge transforms and aspect-safe UV cropping are tested;
- Playwright covers desktop and smartphone startup, localization, sorting, lists, slot modes and responsive navigation;
- Playwright blocks invalid/oversized imports;
- production PWA acceptance covers service-worker activation and offline IndexedDB recovery.

## Known limitations

- CI status cannot be read through the current GitHub integration; the private Actions tab must confirm a clean build;
- the active runtime cannot clone GitHub because DNS resolution is unavailable, so local `pnpm install`, typecheck and build have not been executed here;
- the shared pnpm lockfile has not yet been regenerated after the newest dependency additions;
- search paging is bounded to the current 40-game normalized pool;
- first-time rating sorting can use only ratings available before current-page enrichment;
- IGDB, MobyGames and RAWG are deferred pending terms and credentials review;
- optional KV is not configured in the repository;
- non-Libretro console screenshot coverage remains limited;
- some specialized component copy remains outside the central localization catalogue;
- external description translation is not implemented yet;
- Three.js performance has not been profiled on physical Android hardware;
- the native Android project directory has not yet been generated or reviewed;
- Android signing and store distribution are not configured;
- project-folder persistence remains desktop-local; smartphones currently use device-local IndexedDB only;
- no preview or public deployment is enabled.

## Next implementation milestone

1. Confirm the first clean GitHub Actions run and regenerate `pnpm-lock.yaml`.
2. Generate `apps/mobile/android` on a workstation with Android Studio.
3. Run the PWA and Capacitor wrapper on physical Android hardware.
4. Profile WebGL memory/GPU use and low-memory recovery.
5. Finish central localization and design the optional translation boundary.
