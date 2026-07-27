# Save Slot v1 Roadmap

This roadmap describes the order of work, not fixed dates. Each phase must leave the branch in a testable state.

## Phase 0 — Specification and repository reset

**Status:** substantially complete

- [x] Create private `app-v1` branch.
- [x] Define product goal and boundaries.
- [x] Define architecture and source strategy.
- [x] Define canonical data model.
- [x] Define desktop and mobile UX direction.
- [x] Define security and privacy requirements.
- [x] Add issue templates and pull-request template.
- [x] Add v1-specific CI without public deployment.
- [ ] Preserve the prototype with a tag.

Exit criteria:

- [x] documentation is internally consistent;
- [x] no new v1 functionality is added to the legacy `app-v*.js` chain;
- [x] all implementation work starts from this branch.

## Phase 1 — Workspace foundation

**Status:** alpha foundation implemented

- [x] Create pnpm workspace.
- [x] Scaffold `apps/web` with SvelteKit and TypeScript strict mode.
- [x] Scaffold `apps/api` with Cloudflare Workers tooling.
- [x] Create shared packages: `domain`, `providers`, `storage`, `ui`, `i18n`, `ps1-scene`.
- [x] Configure Prettier and Vitest.
- [x] Add GitHub Actions for install, typecheck, formatting, unit tests and build.
- [x] Add environment examples without secrets.
- [ ] Add ESLint rules where they provide value beyond TypeScript and Svelte checks.
- [ ] Add Playwright.
- [ ] Add a private preview deployment only when explicitly approved.

Exit criteria:

- [ ] CI confirms clean install and build from a fresh clone;
- [x] desktop and mobile shell routes render in the codebase;
- [x] no provider credentials are present in the client bundle.

## Phase 2 — Domain model and local storage

**Status:** first implementation complete

- [x] Implement runtime schemas for `Game`, `Release`, `MediaAsset`, `Rating`, `CollectionEntry` and `UserList`.
- [x] Implement canonical/source IDs.
- [x] Implement IndexedDB database and version boundary.
- [x] Implement collection CRUD.
- [x] Implement versioned JSON export/import.
- [x] Add tests preserving notes, ratings and release identity through export/import.
- [x] Add offline application and collection shell.
- [ ] Add explicit IndexedDB migration fixtures for schema version 2 and later.

Exit criteria:

- [x] users can create and manage fixture collection entries offline;
- [x] export/restore produces an equivalent collection;
- [x] collection entries always reference a release.

## Phase 3 — Aggregation Worker

**Status:** contracts and fixture implementation available

- [x] Define normalized API routes and schemas.
- [x] Add provider adapter interface.
- [ ] Implement Wikidata adapter.
- [ ] Implement IGDB adapter after credential and terms review.
- [ ] Implement MobyGames/RAWG adapters only after licensing review.
- [ ] Implement provider cache, timeouts and error categories.
- [x] Implement baseline canonical merge and deduplication contracts.
- [x] Add provider-status endpoint.
- [x] Add representative fixture coverage for PC, console, handheld and retro games.

Exit criteria:

- [ ] search returns normalized production data from at least two providers;
- [x] provider interfaces support partial results instead of a global failure;
- [x] provider IDs remain traceable in the canonical model.

## Phase 4 — Search and discovery

**Status:** fixture-backed vertical slice implemented

- [x] Build right-side search workspace.
- [ ] Add search suggestions.
- [x] Add submitted search.
- [x] Add compact filter drawer.
- [ ] Add paging or cursor-based loading in the web interface.
- [x] Add random discovery selection per session/startup.
- [x] Keep filtering, sorting and rendering independent.
- [x] Implement stable keyed cards and progressive reveal.
- [x] Add right-to-left visual reveal for newly accepted cards.
- [x] Add empty, loading and fallback states.

Exit criteria:

- [x] search works without requiring a sort interaction;
- [x] changing sorting never controls whether games appear;
- [x] discovery selection changes between application starts;
- [x] mobile search and filters are designed for one-handed use.

## Phase 5 — Release-specific media and details

**Status:** basic fixture presentation implemented; production media pipeline pending

- [x] Keep selected information attached to a concrete release.
- [x] Show release-specific fixture cover, platform, year and player rating.
- [ ] Implement release selection for multi-release games.
- [ ] Implement verified production cover pipeline.
- [ ] Implement Libretro media adapter behind the Worker.
- [ ] Implement Steam PC enrichment behind the Worker.
- [ ] Add screenshot gallery.
- [ ] Add separate sourced rating panels.
- [x] Add description precedence contracts.
- [ ] Add provider/source diagnostics to the interface.
- [ ] Add custom cover override editor for personal collection entries.

Exit criteria:

- [x] a selected fixture release shows the correct platform and cover;
- [ ] screenshots are labelled by platform where necessary;
- [x] the media model does not treat screenshots or banners as covers;
- [x] ratings retain source and sample size in the domain model.

## Phase 6 — Collection experience

**Status:** first local collection workflow implemented

- [x] Add ownership, format, progress, priority, tags, notes and personal rating to the model.
- [x] Add default local collection list.
- [ ] Add custom lists and wishlist/backlog presets in the interface.
- [ ] Add grouping by platform.
- [x] Add list view.
- [x] Add medium-row view.
- [x] Add cartridge-shelf view.
- [x] Preserve preferred view per list.
- [x] Permit multiple releases of the same game through release-based entries.
- [ ] Add editing UI for all ownership and copy-condition fields.

Exit criteria:

- [x] the model distinguishes physical and digital versions;
- [x] multiple releases of the same game can coexist;
- [x] all three views use the same collection entries.

## Phase 7 — PS1 slot scene

**Status:** rigid CSS prototype and scene contracts implemented

- [ ] Create final low-poly Three.js slot and cartridge geometry.
- [x] Add low-resolution visual direction and pixel-style materials to the CSS prototype.
- [ ] Add optional dither/CRT box-art controls.
- [x] Implement rigid insert animation using position, rotation and uniform scale.
- [x] Add reduced-motion behavior.
- [ ] Add final non-WebGL fallback after the Three.js scene exists.
- [x] Keep domain logic outside the scene package.
- [x] Add aspect-ratio preservation tests.

Exit criteria:

- [x] cartridge and cover do not deform in the prototype;
- [x] selection information appears immediately after insertion;
- [ ] final Three.js scene remains usable on a mid-range smartphone.

## Phase 8 — Localization and translation

**Status:** localization contracts implemented

- [x] Add Ukrainian and English UI catalogues.
- [x] Add locale detection and manual language selection foundation.
- [x] Prefer localized descriptions through the domain helper.
- [x] Add original/localized description toggle for available fixture text.
- [ ] Implement external translation adapter and local cache.
- [ ] Add privacy disclosure before external translation.
- [ ] Add stale-translation invalidation by source-text hash.
- [ ] Replace remaining inline Ukrainian strings with message keys.

Exit criteria:

- [ ] all UI text is localized through message keys;
- [ ] descriptions can be translated into the active UI language through a provider;
- [x] original text remains accessible when available.

## Phase 9 — PWA and smartphone readiness

**Status:** installable shell implemented

- [x] Add installable manifest and service worker.
- [x] Define initial application-shell cache/update behavior.
- [x] Keep collection data local and independent from the catalogue cache.
- [x] Add safe-area-aware mobile navigation.
- [ ] Test offline collection access in browsers and installed mode.
- [ ] Test low-memory image handling.
- [ ] Add Capacitor wrapper.
- [ ] Add Android build pipeline.
- [ ] Evaluate iOS build requirements.
- [ ] Add native file/share fallbacks where beneficial.

Exit criteria:

- [ ] PWA installation and updates are verified on target browsers;
- [ ] collection remains usable offline in acceptance tests;
- [ ] Android package uses the same frontend and data model.

## Phase 10 — Private beta and public readiness

- [ ] Review every provider's current terms and attribution.
- [ ] Review image proxy/cache permissions.
- [ ] Run security and malicious-import tests.
- [ ] Validate major platforms and representative edge cases.
- [ ] Add privacy policy and source attribution page.
- [ ] Add telemetry only if privacy-safe and necessary.
- [ ] Conduct desktop and smartphone usability pass.
- [ ] Decide public repository and hosting strategy.
- [ ] Enable production deployment explicitly.

Exit criteria:

- no known data-loss issue;
- no credentials in frontend or Git history;
- provider licensing is documented;
- core workflows pass mobile and desktop acceptance tests.

## Deferred ideas

These are not part of the initial release:

- user accounts and cloud synchronization;
- barcode scanning;
- import from Steam/PlayStation/Xbox/Nintendo accounts;
- emulator and launcher integration;
- collection value tracking;
- social profiles and public lists;
- review writing;
- desktop filesystem scanning through Tauri.
