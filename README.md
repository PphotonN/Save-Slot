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

## Current alpha slice

The branch now contains a working application foundation rather than only documentation:

- pnpm monorepo with strict TypeScript;
- SvelteKit mobile-first PWA shell;
- Cloudflare Worker API boundary with normalized routes;
- canonical `Game → Release → CollectionEntry` domain model validated with Zod;
- IndexedDB collection repository with memory fallback;
- versioned JSON export and import;
- random discovery on every application start;
- search, platform filtering and sorting implemented as separate operations;
- progressive right-to-left card reveal;
- release-specific box art and ratings in representative fixture data;
- desktop left-side slot and smartphone layout;
- collection views: compact list, medium rows and cartridges;
- rigid cartridge insertion animation that preserves cover aspect ratio;
- Ukrainian and English localization foundation;
- private CI for formatting, type checking, tests and builds.

The catalogue is intentionally using representative fixture data during this phase. Production provider adapters for Wikidata, IGDB, Libretro, Steam and other approved sources are the next implementation step.

## Workspace

```text
apps/
  web/          SvelteKit PWA
  api/          Cloudflare Worker aggregation API
  mobile/       Capacitor wrapper, added after the PWA is stable
packages/
  domain/       Entities, validation and business rules
  providers/    Provider contracts, merging and search rules
  storage/      IndexedDB and export/import
  ui/           Shared UI contracts and stable reveal behavior
  i18n/         Interface languages and translation contracts
  ps1-scene/    Rigid PS1 slot and cartridge scene contracts
```

## Local development

Requirements:

- Node.js 20.19 or newer;
- pnpm 10.14.

```bash
pnpm install
pnpm dev
```

Run the local aggregation Worker in another terminal:

```bash
pnpm dev:api
```

Validation:

```bash
pnpm lint
pnpm check
pnpm test
pnpm build
```

No API credentials should be placed in client-side variables. Copy `.env.example` only for local setup and store Worker secrets through the deployment platform when real providers are enabled.

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
