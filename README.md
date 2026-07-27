# Save Slot v1

> Private development branch for the complete Save Slot rewrite.

**Save Slot** is a mobile-first, cross-platform game search and personal collection manager. It separates a game from its platform-specific releases and lets users manage physical and digital copies, backlog, progress, notes and personal ratings.

## Branch status

- `main` contains the archived browser prototype.
- `app-v1` is the integration branch for the new application.
- The new version is not publicly deployed.
- New work should use `feature/*` branches created from `app-v1`.

## Product goal

Save Slot must make two tasks simple:

1. **Find trustworthy information about a game or a specific platform release.**
2. **Manage a personal game collection from desktop or smartphone.**

The target catalogue covers PC, PlayStation, Xbox, Nintendo, Sega, handheld, retro and mobile releases. Each release should retain its platform, region, box art, screenshots, descriptions and clearly sourced player ratings.

## Current alpha

The branch contains a functional application foundation:

- pnpm monorepo with strict TypeScript;
- SvelteKit mobile-first PWA shell;
- Cloudflare Worker aggregation API;
- canonical `Game → Release → CollectionEntry` domain model validated with Zod;
- IndexedDB working copy with automatic project-folder mirroring;
- versioned JSON export and import;
- random discovery on every application start;
- debounced search suggestions with platform and description context;
- paged search that appends new cards without clearing existing DOM;
- search, platform filtering and sorting implemented as separate operations;
- progressive left-to-right card reveal and row filling;
- multi-release game selection and sourced detail tabs;
- cached online game/release detail routes;
- searchable and editable personal collection;
- desktop left-side slot and smartphone layout;
- collection views: compact list, medium rows and cartridges;
- rigid cartridge insertion animation that preserves cover aspect ratio;
- Ukrainian and English localization foundation;
- private CI for formatting, type checking, tests and builds.

### Active catalogue pipeline

1. **Wikidata Action API** supplies real search results, localized titles/descriptions, platforms, genres, developers, publishers, release dates and external IDs.
2. Platform labels are normalized into shared Save Slot IDs.
3. **Libretro Named_Boxarts** verifies platform-specific retro/console covers.
4. **Steam Store and Steam Reviews** enrich linked PC releases with vertical box art, official description, screenshots and player rating with vote count.
5. A bounded normalized search pool is cached independently from sorting and page cursor.
6. Suggestions use their own short-result cache.
7. Every discovered game and release receives a stable detail-cache key.
8. Representative fixtures remain a deterministic offline/provider-failure fallback.

The catalogue cache uses Worker memory, Cache API when available and an optional KV-compatible `CATALOG_CACHE` binding. Local development requires no Cloudflare credentials.

Current search paging operates inside a normalized pool of up to 40 games per query. The interface loads 18 at a time and appends later pages while keeping accepted cards mounted.

IGDB, MobyGames and RAWG remain deferred until credentials, attribution and current terms are reviewed.

## Local collection files

While the app is running locally, collection data is stored in two places:

- IndexedDB keeps the responsive browser working copy;
- `.save-slot-data/library.json` inside the repository is the persistent project copy.

Before each file replacement, the previous project copy is preserved as `.save-slot-data/library.backup.json`. The entire `.save-slot-data` directory is ignored by Git so personal collection data is not committed accidentally.

The personal collection file and public catalogue cache are separate systems. Catalogue caching never stores personal ratings, notes, prices or account data.

## Workspace

```text
apps/
  web/          SvelteKit PWA
  api/          Cloudflare Worker aggregation API
  mobile/       Capacitor wrapper, added after the PWA is stable
packages/
  domain/       Entities, validation and business rules
  providers/    Catalogue and media provider adapters
  storage/      IndexedDB, project-file mirroring and export/import
  ui/           Shared UI contracts and stable reveal behavior
  i18n/         Interface languages and translation contracts
  ps1-scene/    Rigid PS1 slot and cartridge scene contracts
scripts/
  library-cache-server.mjs   Local project-folder collection service
```

## Quick launch

### Windows

Double-click:

```text
START_SAVE_SLOT.bat
```

No separate Node.js, npm, pnpm or Corepack installation is required. On the first launch, or after a runtime update, the launcher automatically:

- detects the Windows processor architecture;
- downloads portable Node.js 24.18.0 LTS into the local `.runtime` directory;
- verifies the downloaded archive using the official SHA-256 list;
- installs the required pnpm version into `.runtime`;
- creates `apps/web/.env` and `apps/api/.dev.vars` when missing;
- installs, updates or rebuilds project dependencies for the active runtime;
- starts the project library cache, Worker and web application;
- waits for the local services and opens `http://localhost:5173`.

The setup does not modify the system and does not require administrator rights. The first launch requires Internet access. Subsequent launches reuse the local runtime and package cache.

Close the **Save Slot Library**, **Save Slot API** and **Save Slot Web** terminal windows to stop the local application.

### Linux and macOS

```bash
chmod +x start-save-slot.sh
./start-save-slot.sh
```

This launcher expects Node.js 24 or newer. Press `Ctrl+C` to stop all three processes.

## Local development

Manual development requires:

- Node.js 24 or newer; the pinned local/CI version is 24.18.0 LTS;
- pnpm 10.14.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Run the three services in separate terminals:

```bash
pnpm dev:library
pnpm dev:api
pnpm dev
```

Without `VITE_SAVE_SLOT_API_URL`, the web app deliberately falls back to the local representative catalogue.

Useful local diagnostics:

```text
http://localhost:8787/health
http://localhost:8787/v1/providers
http://localhost:8787/v1/cache
http://127.0.0.1:8791/health
```

Validation:

```bash
pnpm lint
pnpm check
pnpm test
pnpm build
```

No API credentials may be placed in client-side variables. `VITE_SAVE_SLOT_API_URL` is only the public address of the aggregation API. Real provider credentials belong in Worker secrets or local `apps/api/.dev.vars` and must never be committed.

## Repository documentation

- [Product vision](docs/PRODUCT_VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Data-source strategy](docs/DATA_SOURCES.md)
- [Catalogue cache](docs/CATALOG_CACHE.md)
- [UX and visual specification](docs/UX_UI.md)
- [Security and privacy](docs/SECURITY_AND_PRIVACY.md)
- [Technical decisions](docs/DECISIONS.md)
- [Implementation status](docs/IMPLEMENTATION_STATUS.md)
- [Roadmap](ROADMAP.md)
- [Contribution workflow](CONTRIBUTING.md)

## Development rules

- Do not continue the old `app-v*.js` layering in this branch.
- Do not expose API credentials in frontend code.
- Treat a game and a platform release as different entities.
- Never use screenshots or horizontal promotional art as silent box-art replacements.
- Every rating and media item must retain its source and scope.
- Filtering, sorting and rendering must remain independent.
- Cartridge rows fill from left to right on desktop and mobile.
- Personal collection data and public catalogue cache data must remain separated.
- Desktop and mobile layouts are designed together.
