# Save Slot v1 implementation status

## Current milestone

The repository contains the first vertical alpha slice of the rewritten application. It is designed to validate architecture, interaction and local collection behavior before connecting production catalogue providers.

## Implemented

### Workspace

- pnpm monorepo;
- SvelteKit web application;
- Cloudflare Worker API application;
- shared domain, provider, storage, UI, localization and PS1-scene packages;
- strict TypeScript and Prettier configuration;
- private GitHub Actions verification without deployment.

### Domain model

- games and releases are separate entities;
- every collection entry references a concrete release;
- media assets retain type, platform, release and provider metadata;
- ratings retain source, scope and vote count;
- personal lists retain their display mode and sorting preference;
- versioned collection export schema is available.

### Web application

- random discovery is loaded on every fresh application start;
- search and platform filtering work against the provider interface;
- sorting changes only result order;
- cards are added progressively from right to left;
- selecting a release inserts a rigid cartridge into the left slot;
- the slot shows year, platform, player rating, personal rating and description;
- collection entries are stored in IndexedDB;
- collection data can be exported and restored as JSON;
- collection views include list, medium rows and cartridges;
- desktop and mobile layouts share one codebase;
- a PWA manifest and offline application-shell service worker are present.

### API boundary

- `/health`;
- `/v1/providers`;
- `/v1/search`;
- `/v1/discovery`;
- `/v1/games/:id`;
- `/v1/releases/:id`.

The Worker currently serves normalized fixture data. This is deliberate: provider credentials, licensing and canonical merge behavior must be implemented and tested behind this boundary before production data is enabled.

## Fixture coverage

The alpha catalogue includes representative releases for:

- Windows PC;
- original PlayStation;
- PlayStation Vita;
- Nintendo 64;
- Nintendo GameCube;
- Game Boy Advance;
- Sega Dreamcast.

Fixtures are used to test platform identity, release-specific box art, search, ratings, collection persistence and responsive presentation. They are not the final catalogue.

## Tests included

- representative releases validate against runtime schemas;
- collection export/import preserves release identity, notes and personal ratings;
- deleting an entry removes it from its lists;
- search finds a game without any sorting interaction;
- every sorting mode preserves the same visible result set;
- platform filtering happens independently of sorting;
- cartridge transforms use one uniform scale value;
- cover fitting preserves source aspect ratio.

## Known limitations

- production providers are not connected yet;
- screenshot galleries are not implemented;
- translation currently uses available localized fixture descriptions rather than an external translation adapter;
- the current slot is a CSS-based rigid prototype; the isolated Three.js renderer is still pending;
- collection editing does not yet expose all fields from the canonical model;
- cloud sync and accounts remain deferred;
- Capacitor Android/iOS wrappers are not created yet;
- no preview or public deployment is enabled.

## Next implementation milestone

1. Add a real Wikidata provider behind the Worker.
2. Implement canonical platform normalization and provider ID linking.
3. Add verified cover and screenshot media pipelines.
4. Add provider caching, timeout categories and partial-result diagnostics.
5. Connect the web application to the Worker through environment configuration.
6. Add release selection when one game has several platform releases.
7. Add Playwright mobile and desktop acceptance tests.
