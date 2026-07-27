# Save Slot v1 Roadmap

This roadmap describes the order of work, not fixed dates. Each phase must leave the branch in a testable state.

## Phase 0 — Specification and repository reset

**Status:** in progress

- [x] Create private `app-v1` branch.
- [x] Define product goal and boundaries.
- [x] Define architecture and source strategy.
- [x] Define canonical data model.
- [x] Define desktop and mobile UX direction.
- [x] Define security and privacy requirements.
- [ ] Add issue templates and pull-request template.
- [ ] Disable prototype-specific CI for `app-v1` after new workspace exists.
- [ ] Preserve the prototype with a tag.

Exit criteria:

- documentation is internally consistent;
- no new v1 functionality is added to the legacy `app-v*.js` chain;
- all implementation work starts from this branch.

## Phase 1 — Workspace foundation

- [ ] Create pnpm workspace.
- [ ] Scaffold `apps/web` with SvelteKit and TypeScript strict mode.
- [ ] Scaffold `apps/api` with Cloudflare Workers tooling.
- [ ] Create shared packages: `domain`, `providers`, `storage`, `ui`, `i18n`, `ps1-scene`.
- [ ] Configure ESLint, Prettier, Vitest and Playwright.
- [ ] Add GitHub Actions for install, typecheck, lint, unit tests and build.
- [ ] Add environment examples without secrets.
- [ ] Add a private preview deployment only when explicitly approved.

Exit criteria:

- clean install and build from a fresh clone;
- desktop and mobile shell routes render;
- no provider credentials in the client bundle.

## Phase 2 — Domain model and local storage

- [ ] Implement runtime schemas for `Game`, `Release`, `MediaAsset`, `Rating`, `CollectionEntry` and `UserList`.
- [ ] Implement canonical/source IDs.
- [ ] Implement IndexedDB database and migrations.
- [ ] Implement collection CRUD.
- [ ] Implement versioned JSON export/import.
- [ ] Add tests preserving notes, ratings and release identity through migrations.
- [ ] Add offline collection shell.

Exit criteria:

- users can create and manage mock collection entries offline;
- export/restore produces an identical collection;
- collection entries always reference a release.

## Phase 3 — Aggregation Worker

- [ ] Define normalized API schemas.
- [ ] Add provider adapter interface.
- [ ] Implement Wikidata adapter.
- [ ] Implement IGDB adapter after credential and terms review.
- [ ] Implement provider cache, timeouts and error categories.
- [ ] Implement canonical linking and deduplication.
- [ ] Add provider-status endpoint.
- [ ] Add representative fixture tests for PC, modern console, handheld and retro games.

Exit criteria:

- search returns normalized games from at least two providers;
- one provider failure produces partial results instead of a global failure;
- provider IDs remain traceable.

## Phase 4 — Search and discovery

- [ ] Build right-side search workspace.
- [ ] Add search suggestions and submitted search.
- [ ] Add compact filter drawer.
- [ ] Add paging or cursor-based loading.
- [ ] Add random discovery selection per session.
- [ ] Keep filtering, sorting and rendering independent.
- [ ] Implement stable progressive card reconciliation.
- [ ] Add right-to-left visual reveal for newly accepted cards.
- [ ] Add missing/partial/offline states.

Exit criteria:

- search works without remounting existing cards;
- changing sorting never controls whether games appear;
- discovery selection changes between sessions;
- mobile search and filters are usable one-handed.

## Phase 5 — Release-specific media and details

- [ ] Implement release selection.
- [ ] Implement verified cover pipeline.
- [ ] Implement Libretro media adapter.
- [ ] Implement Steam PC enrichment.
- [ ] Add screenshot gallery.
- [ ] Add separate sourced rating panels.
- [ ] Add official/editorial description precedence.
- [ ] Add provider/source diagnostics.
- [ ] Add custom cover override for personal collection entries.

Exit criteria:

- a selected release shows the correct platform and cover;
- screenshots are labelled by platform where necessary;
- no screenshot or banner is used as silent cover art;
- ratings show source and sample size.

## Phase 6 — Collection experience

- [ ] Add ownership, format, progress, priority, tags, notes and personal rating.
- [ ] Add custom lists and wishlist/backlog presets.
- [ ] Add grouping by platform.
- [ ] Add list view.
- [ ] Add medium-row view.
- [ ] Add cartridge-shelf view.
- [ ] Preserve view and sorting per list.
- [ ] Add duplicate-copy and multiple-edition support.

Exit criteria:

- a user can distinguish physical and digital versions;
- multiple releases of the same game can coexist;
- all three views expose the same collection data.

## Phase 7 — PS1 slot scene

- [ ] Create low-poly slot and cartridge geometry.
- [ ] Add low-resolution materials and nearest filtering.
- [ ] Add optional dither/CRT box-art filter.
- [ ] Implement rigid-body insert/eject animation.
- [ ] Add reduced-motion and non-WebGL fallback.
- [ ] Connect selection state without moving domain logic into Three.js.
- [ ] Test aspect-ratio preservation.

Exit criteria:

- cartridge and cover do not deform;
- selection information appears immediately after insertion;
- animation remains usable on a mid-range smartphone.

## Phase 8 — Localization and translation

- [ ] Add Ukrainian and English UI catalogues.
- [ ] Add language detection and manual language selection.
- [ ] Prefer provider-localized descriptions.
- [ ] Add original/translated description toggle.
- [ ] Implement translation adapter and local cache.
- [ ] Add privacy disclosure before external translation.
- [ ] Add stale-translation invalidation by source-text hash.

Exit criteria:

- all UI text is localized through message keys;
- descriptions can be translated into the active UI language;
- original text remains accessible.

## Phase 9 — PWA and smartphone readiness

- [ ] Add installable manifest and service worker.
- [ ] Define cache/update behaviour.
- [ ] Test offline collection access.
- [ ] Test safe areas and mobile navigation.
- [ ] Test low-memory image handling.
- [ ] Add Capacitor wrapper.
- [ ] Add Android build pipeline.
- [ ] Evaluate iOS build requirements.
- [ ] Add native file/share fallbacks where beneficial.

Exit criteria:

- PWA installs and updates cleanly;
- collection remains usable offline;
- Android package uses the same frontend and data model.

## Phase 10 — Private beta and public readiness

- [ ] Review every provider's current terms and attribution.
- [ ] Review image proxy/cache permissions.
- [ ] Run security and import tests.
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
