# Save Slot v1 implementation status

## Current milestone

The repository contains a functional private alpha of the rewritten application. It now validates the new architecture, live online search, release-specific media, cached detail lookup, project-folder collection persistence and an editable personal library without publishing a public build.

## Implemented

### Workspace

- pnpm monorepo;
- SvelteKit web application;
- Cloudflare Worker aggregation API;
- local project-folder collection cache service;
- shared domain, provider, storage, UI, localization and PS1-scene packages;
- strict TypeScript and Prettier configuration;
- private GitHub Actions verification without deployment;
- separate web and Worker environment examples with secrets excluded from Git;
- automatic Windows portable runtime based on Node.js 24.18.0 LTS.

### Domain model

- games and releases are separate entities;
- every collection entry references a concrete release;
- media assets retain type, platform, release and provider metadata;
- ratings retain source, platform scope and vote count;
- personal lists retain their display mode and sorting preference;
- platform names from different providers are normalized into common IDs;
- versioned collection export schema is available.

### Web application

- random discovery loads on every fresh application start;
- submitted search uses the aggregation API when configured and an offline fixture fallback otherwise;
- platform filtering and sorting are independent;
- sorting changes only result order;
- cards and cartridge rows fill progressively from left to right;
- selecting a release inserts a rigid cartridge into the left slot;
- multi-release games expose a platform/release selector in the slot;
- overview, media, rating and source tabs are available for the active release;
- screenshots open in a source-labelled lightbox;
- opening a collection entry refreshes its game group through the cached game detail route;
- IndexedDB keeps the active browser working copy;
- collection changes are mirrored automatically to `.save-slot-data/library.json` in the project folder;
- the previous project file is retained as `.save-slot-data/library.backup.json`;
- collection data can be exported and restored as JSON;
- collection views include list, medium rows and cartridges;
- collection search, status/platform filters and sorting are implemented;
- collection entries can edit status, ownership, format, rating, priority, quantity, acquisition date, price, tags and notes;
- desktop and mobile layouts share one codebase;
- a PWA manifest and offline application-shell service worker are present.

### Project library cache

- local-only HTTP service bound to `127.0.0.1:8791`;
- `GET /health` reports the active project and cache path;
- `GET /library` restores the project collection;
- `PUT /library` writes an atomic formatted JSON file;
- payload size is limited to 20 MB;
- the service validates collection format and schema version before writing;
- personal cache files are ignored by Git;
- launcher starts and health-checks the cache before the web application.

### Catalogue cache

- module-local memory cache is always available;
- Cache API is used when the Worker environment provides it;
- an optional `CATALOG_CACHE` KV-compatible binding can provide durable production storage;
- normalized search pages are cached for six hours;
- sorting is not part of the cache key and remains independent;
- game and release details are cached for 30 days;
- discovery pages remain varied but their individual game/release details are retained;
- cached detail values are validated through canonical Zod schemas;
- invalid cached detail values are removed;
- `/v1/cache` exposes non-sensitive cache diagnostics;
- application settings display active cache layers and process-local hit/miss/write counters.

### Catalogue providers

#### Wikidata

- real search through `wbsearchentities`;
- entity batches through `wbgetentities` without SPARQL;
- localized titles, aliases and descriptions;
- platforms, genres, developers and publishers;
- release date and year;
- Wikimedia image reference;
- Steam App ID linking when present;
- provider health check, abort propagation and request timeout;
- fixture fallback when the online provider is unavailable or returns no confirmed games.

#### Libretro

- platform-to-playlist mapping for major retro, console and handheld systems;
- title and regional filename variants;
- verified `Named_Boxarts` lookup;
- release/platform metadata retained on the resulting cover asset.

#### Steam

- PC library box art;
- official short store description;
- screenshots;
- developers and publishers;
- player rating percentage and total review count;
- enrichment only when the release carries a Steam source ID.

### API boundary

- `/health`;
- `/v1/providers`;
- `/v1/cache`;
- `/v1/search`;
- `/v1/discovery`;
- `/v1/games/:id`;
- `/v1/releases/:id`.

Search and discovery use Wikidata as the main catalogue source, Libretro or Steam as release media enrichers, and representative fixtures as a controlled fallback. Previously discovered online games and releases can now be reopened through stable cached detail routes.

## Fixture coverage

The fallback catalogue includes representative releases for:

- Windows PC;
- original PlayStation;
- PlayStation Vita;
- Nintendo 64;
- Nintendo GameCube;
- Game Boy Advance;
- Sega Dreamcast.

Fixtures remain useful for deterministic testing, offline development and provider failure scenarios. They are not treated as the production catalogue.

## Tests included

- representative releases validate against runtime schemas;
- collection export/import preserves release identity, notes and personal ratings;
- deleting an entry removes it from its lists;
- project-file mirroring restores and writes the collection export;
- search finds a game without any sorting interaction;
- every sorting mode preserves the same visible result set;
- platform filtering happens independently of sorting;
- Windows, PlayStation and handheld platform labels normalize consistently;
- Wikidata responses normalize into game/release records without network access;
- Libretro returns only a successfully verified platform box art asset;
- Steam enrichment returns box art, screenshot, official description and sourced player rating;
- layered catalogue cache restores values through a KV-compatible binding;
- fixture game and release routes populate and reuse the shared detail cache;
- cartridge transforms use one uniform scale value;
- cover fitting preserves source aspect ratio;
- the project cache server script is included in the workspace syntax check.

## Known limitations

- IGDB, MobyGames and RAWG are not connected pending credentials and terms review;
- optional KV is not configured in the repository and must remain environment-specific;
- Libretro lookup still relies on title matching and needs more canonical external IDs;
- Wikimedia P18 may be general artwork rather than platform box art, so it remains unverified fallback media;
- screenshot galleries currently depend mostly on Steam enrichment;
- translation currently uses available localized descriptions rather than an external translation service;
- the current slot is a rigid CSS prototype; the isolated Three.js renderer is still pending;
- custom lists and platform grouping are not exposed in the collection interface yet;
- physical copy condition fields are not part of the canonical model yet;
- the project-folder personal library file is currently intended for the local desktop launcher, not direct smartphone access;
- cloud sync and accounts remain deferred;
- Capacitor Android/iOS wrappers are not created yet;
- no preview or public deployment is enabled;
- CI results cannot be read through the current GitHub integration, so a successful private Actions run must be confirmed in the repository UI.

## Next implementation milestone

1. Add search suggestions and cursor/page loading without remounting existing cards.
2. Expand Libretro matching with provider IDs and safer request fallback behavior.
3. Add more screenshot sources for console and retro releases.
4. Add custom lists, wishlist/backlog presets and platform grouping.
5. Replace remaining inline UI strings with localization keys.
6. Add Playwright desktop and smartphone acceptance tests.
7. Implement the actual isolated Three.js PS1 slot scene.
8. Define optional encrypted or account-based synchronization for smartphone use.
