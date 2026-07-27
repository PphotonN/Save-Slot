# Save Slot v1

> Private development branch for the complete Save Slot rewrite.

**Save Slot** is a mobile-first, cross-platform game search and personal collection manager. It combines several game databases into one consistent catalogue, keeps platform-specific releases separate, and lets users manage physical and digital copies, backlog, progress, notes and personal ratings.

## Status

- `main` contains the archived browser prototype.
- `app-v1` is the integration branch for the new application.
- The new version is not publicly deployed.
- New work should be created in `feature/*` branches from `app-v1`.

## Product goal

Save Slot must make two tasks simple:

1. **Find trustworthy information about a game or a specific platform release.**
2. **Manage a personal game collection from desktop or smartphone.**

The application should cover PC, PlayStation, Xbox, Nintendo, Sega, handheld, retro and mobile releases. It should provide platform-specific box art, descriptions, screenshots, release information and clearly sourced player ratings.

## Planned stack

- SvelteKit + TypeScript
- PWA as the primary distribution format
- IndexedDB for offline personal data and cache
- Cloudflare Worker for source aggregation, caching and API secrets
- Three.js only for the PS1-style 3D slot and cartridges
- Capacitor later for Android and iOS packages

## Repository documentation

- [Product vision](docs/PRODUCT_VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data model](docs/DATA_MODEL.md)
- [Data-source strategy](docs/DATA_SOURCES.md)
- [UX and visual specification](docs/UX_UI.md)
- [Security and privacy](docs/SECURITY_AND_PRIVACY.md)
- [Technical decisions](docs/DECISIONS.md)
- [Roadmap](ROADMAP.md)
- [Contribution workflow](CONTRIBUTING.md)

## Initial repository layout

```text
apps/
  web/          SvelteKit PWA
  api/          Cloudflare Worker aggregation API
  mobile/       Capacitor wrapper, added after the PWA is stable
packages/
  domain/       Shared entities, validation and business rules
  providers/    External data-source adapters
  storage/      IndexedDB and cache abstractions
  ui/           Reusable interface components
  i18n/         Interface languages and description translation
  ps1-scene/    Isolated Three.js slot and cartridge renderer
docs/
```

## Development rules

- Do not continue the old `app-v*.js` layering in this branch.
- Do not expose API credentials in frontend code.
- Treat a game and a platform release as different entities.
- Never use screenshots or horizontal promotional art as silent box-art replacements.
- Every rating and media item must retain its source and scope.
- Desktop and mobile layouts are designed together, not sequentially.

## Current phase

The branch currently contains the specification and implementation plan. The next step is repository scaffolding and the shared domain model described in [ROADMAP.md](ROADMAP.md).
