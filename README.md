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
- IndexedDB collection repository with memory fallback;
- versioned JSON export and import;
- random discovery on every application start;
- search, platform filtering and sorting implemented as separate operations;
- progressive right-to-left card reveal;
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
5. Representative fixtures remain a deterministic offline/provider-failure fallback.

IGDB, MobyGames and RAWG remain deferred until credentials, attribution and current terms are reviewed.

## Workspace

```text
apps/
  web/          SvelteKit PWA
  api/          Cloudflare Worker aggregation API
  mobile/       Capacitor wrapper, added after the PWA is stable
packages/
  domain/       Entities, validation and business rules
  providers/    Catalogue and media provider adapters
  storage/      IndexedDB and export/import
  ui/           Shared UI contracts and stable reveal behavior
  i18n/         Interface languages and translation contracts
  ps1-scene/    Rigid PS1 slot and cartridge scene contracts
```

## Quick launch

### Windows

Double-click:

```text
START_SAVE_SLOT.bat
```

The launcher:

- checks Node.js and pnpm/Corepack;
- creates `apps/web/.env` and `apps/api/.dev.vars` when missing;
- installs dependencies on the first launch;
- opens the Worker and web application in separate terminal windows;
- opens `http://localhost:5173` in the default browser.

Close both terminal windows to stop the local application.

### Linux and macOS

```bash
chmod +x start-save-slot.sh
./start-save-slot.sh
```

Press `Ctrl+C` to stop both processes.

## Local development

Requirements:

- Node.js 20.19 or newer;
- pnpm 10.14.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
```

Run the Worker and web application in separate terminals:

```bash
pnpm dev:api
pnpm dev
```

Without `VITE_SAVE_SLOT_API_URL`, the web app deliberately falls back to the local representative catalogue.

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
- Desktop and mobile layouts are designed together.
