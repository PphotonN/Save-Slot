# Save Slot v1 implementation status

## Current milestone

The repository contains the first functional alpha of the rewritten application. It validates the new architecture, real online search, media enrichment and local collection workflow without publishing a public build.

## Implemented

### Workspace

- pnpm monorepo;
- SvelteKit web application;
- Cloudflare Worker aggregation API;
- shared domain, provider, storage, UI, localization and PS1-scene packages;
- strict TypeScript and Prettier configuration;
- private GitHub Actions verification without deployment;
- separate web and Worker environment examples with secrets excluded from Git.

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
- cards are added progressively from right to left;
- selecting a release inserts a rigid cartridge into the left slot;
- the slot shows year, platform, player rating, personal rating and description;
- available release screenshots appear only after a game is selected;
- collection entries are stored in IndexedDB;
- collection data can be exported and restored as JSON;
- collection views include list, medium rows and cartridges;
- desktop and mobile layouts share one codebase;
- a PWA manifest and offline application-shell service worker are present.

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
- `/v1/search`;
- `/v1/discovery`;
- `/v1/games/:id`;
- `/v1/releases/:id`.

Search and discovery currently use Wikidata as the main catalogue source, Libretro or Steam as release media enrichers, and representative fixtures as a controlled fallback. Detail routes for arbitrary online entities still need a persistent/cache-backed lookup layer.

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
- search finds a game without any sorting interaction;
- every sorting mode preserves the same visible result set;
- platform filtering happens independently of sorting;
- Windows, PlayStation and handheld platform labels normalize consistently;
- Wikidata responses normalize into game/release records without network access;
- Libretro returns only a successfully verified platform box art asset;
- Steam enrichment returns box art, screenshot, official description and sourced player rating;
- cartridge transforms use one uniform scale value;
- cover fitting preserves source aspect ratio.

## Known limitations

- IGDB, MobyGames and RAWG are not connected pending credentials and terms review;
- arbitrary online game/release detail endpoints are not persisted yet;
- Libretro lookup still relies on title matching and needs more canonical external IDs;
- Wikimedia P18 may be general artwork rather than platform box art, so it remains unverified fallback media;
- screenshot galleries currently depend mostly on Steam enrichment;
- translation currently uses available localized descriptions rather than an external translation service;
- the current slot is a rigid CSS prototype; the isolated Three.js renderer is still pending;
- the interface does not yet let users select among several releases of one game;
- collection editing does not yet expose every field from the canonical model;
- cloud sync and accounts remain deferred;
- Capacitor Android/iOS wrappers are not created yet;
- no preview or public deployment is enabled;
- CI results cannot be read through the current GitHub integration, so a successful private Actions run must be confirmed in the repository UI.

## Next implementation milestone

1. Add Worker caching and persistent online detail lookup.
2. Add explicit release selection for multi-platform games.
3. Expand Libretro matching with provider IDs and safer request fallback behavior.
4. Add more screenshot sources for console and retro releases.
5. Replace remaining inline UI strings with localization keys.
6. Add Playwright desktop and smartphone acceptance tests.
7. Implement the actual isolated Three.js PS1 slot scene.
