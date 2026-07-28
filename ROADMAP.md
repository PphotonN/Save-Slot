# Save Slot v1 Roadmap

This roadmap describes implementation order rather than fixed release dates. A checkbox means the feature exists in the branch; it does not imply that CI, licensing or real-device acceptance has been confirmed.

## Phase 0 — Specification and repository reset

**Status:** substantially complete

- [x] Create the private `app-v1` integration branch.
- [x] Define product boundaries, architecture, source strategy and data model.
- [x] Define desktop/mobile UX, security and privacy requirements.
- [x] Keep v1 work outside the legacy `app-v*.js` patch chain.
- [x] Make zero-configuration, no-key operation a product requirement.
- [ ] Preserve the final legacy prototype with a dedicated tag.

## Phase 1 — Workspace foundation

**Status:** implemented; clean CI result still unconfirmed

- [x] pnpm workspace with SvelteKit web and Cloudflare Worker API applications.
- [x] Shared domain, provider, storage, UI, localization and PS1-scene packages.
- [x] Strict TypeScript, Vitest and Svelte 5-compatible Prettier configuration.
- [x] Portable Windows launcher and local project-library service.
- [x] GitHub Actions updated to Node.js 24 and pnpm.
- [x] One consolidated workflow with separate quality/build and Playwright acceptance jobs.
- [ ] Confirm a clean workflow run in the repository Actions UI.
- [ ] Add ESLint only where it provides checks not already covered by TypeScript, Svelte and Prettier.

## Phase 2 — Domain model and local storage

**Status:** implemented

- [x] Separate `Game`, `Release` and `CollectionEntry` entities.
- [x] Runtime schemas, canonical/source IDs and platform normalization.
- [x] IndexedDB CRUD and versioned JSON export/import.
- [x] Automatic desktop mirror to `.save-slot-data/library.json` with backup.
- [x] Native Capacitor storage isolation from the desktop localhost mirror.
- [x] Atomic entry/list membership and legacy membership normalization.
- [x] Physical-copy condition, completeness, purchase and custom-cover fields.
- [x] Backward-compatible defaults for older version-1 collection files.
- [x] Import limits, HTTP/HTTPS URL validation, duplicate-ID checks and reference-integrity checks.
- [ ] Add explicit IndexedDB migration fixtures when database version 2 is introduced.

## Phase 3 — Aggregation Worker

**Status:** automatic no-key provider pipeline and cache implemented

- [x] Normalized search, discovery, suggestion, detail and diagnostics routes.
- [x] Wikidata Action API adapter without SPARQL or credentials.
- [x] Conservative cross-provider identity assessment.
- [x] Automatic reconciliation by shared IDs, title, year, normalized platform and developer evidence.
- [x] Canonical release rebinding for merged media and ratings.
- [x] Exact Wikipedia sitelink and `wikibase_item` description verification.
- [x] Request timeout, abort and partial-provider handling.
- [x] Memory, Cache API and optional KV-compatible catalogue cache.
- [x] Stable cached game/release detail keys.
- [x] Representative offline fixture fallback.
- [ ] Add automatic PCGamingWiki enrichment with rate limiting and cache.
- [ ] Add automatic VNDB enrichment for visual novels.
- [ ] Add optional SteamSpy popularity signals with explicit approximation labels.
- [ ] Keep IGDB, MobyGames and RAWG as optional expert providers only.

## Phase 4 — Search and discovery

**Status:** implemented

- [x] Debounced suggestions with stale-request cancellation.
- [x] Submitted search, platform filter and independent sorting.
- [x] Stable normalized search pool with bounded cursor paging.
- [x] Append later pages without clearing accepted cards.
- [x] Random startup discovery.
- [x] Progressive left-to-right reveal.
- [x] Loading, empty, fallback and continuation states.
- [x] Sorting changes order without controlling visibility.
- [x] Manual metadata entry is not required for normal search results.

## Phase 5 — Release-specific media and details

**Status:** implemented with currently available no-key providers

- [x] Concrete platform-release selection.
- [x] Verified release cover contracts.
- [x] Steam cover, description, screenshots and review enrichment.
- [x] Robust Libretro `Named_Boxarts` matching.
- [x] Libretro `Named_Snaps` and `Named_Titles` media.
- [x] Exact localized Wikipedia introduction enrichment through Wikidata identity.
- [x] Source-labelled media lightbox and rating panels.
- [x] Cached detail refresh for collection entries.
- [x] Personal custom-cover override as an optional final fallback.
- [ ] Add automatic metadata-completeness diagnostics per release.
- [ ] Add more non-Libretro console screenshot sources where terms permit.

## Phase 6 — Collection experience

**Status:** implemented

- [x] Base collection plus wishlist, backlog and custom lists.
- [x] Safe list deletion without deleting games.
- [x] Multiple lists per entry and multiple releases per game.
- [x] List, medium-row and cartridge views.
- [x] Search, status/platform filters and sorting.
- [x] Per-list view and platform grouping.
- [x] Editor for ownership, format, progress, rating, priority, quantity, dates, price, tags and notes.
- [x] Box/media condition and completeness.
- [x] Custom cover validation, preview and reset.
- [x] Provider metadata is added automatically before personal fields are requested.

## Phase 7 — PS1 slot scene

**Status:** first integrated Three.js implementation complete; real-device validation pending

- [x] Isolated low-poly Three.js chassis and cartridge renderer.
- [x] Lazy loading so Three.js is not part of initial interaction work.
- [x] Event-driven rendering instead of a permanent animation loop.
- [x] Low-power renderer configuration and pixel-ratio cap.
- [x] Rigid insertion/ejection using position, rotation and one uniform scale.
- [x] Aspect-safe UV crop for source covers.
- [x] Nearest-neighbour texture option.
- [x] Persistent `CLEAN`, `PS1` and `CRT` artwork modes.
- [x] Immediate CSS fallback during loading and when WebGL 2 is unavailable.
- [x] Reduced-motion handling.
- [x] GPU resource disposal, context-loss fallback and stale-transition protection.
- [x] Unit tests for rigid transforms and UV cropping.
- [x] Playwright acceptance that permits either Three.js or fallback in CI.
- [ ] Validate GPU usage, context recovery and interaction on target mid-range Android hardware.
- [ ] Refine final geometry and textures after real-device profiling.

## Phase 8 — Localization and translation

**Status:** core interface language switching implemented

- [x] Typed Ukrainian and English message catalogues.
- [x] Locale detection, persistence and `<html lang>` synchronization.
- [x] Localized navigation, search, collection editor, details and cache diagnostics.
- [x] Typed domain labels for statuses, ownership, formats, copy condition and list presets.
- [x] Parameterized status messages.
- [x] Original/localized description toggle where both texts exist.
- [x] Localized collection-import guard for invalid type and excessive file size.
- [ ] Move the remaining specialized component copy into the central catalogue.
- [ ] Implement an optional external translation adapter and local translation cache.
- [ ] Add privacy disclosure before sending text to an external translator.
- [ ] Invalidate translated text by source-text hash.

## Phase 9 — PWA and smartphone readiness

**Status:** production PWA acceptance and Capacitor wrapper scaffold implemented

- [x] PWA manifest, service worker and offline application shell.
- [x] Deployment-base-aware manifest, icons and service-worker fallback.
- [x] Safe-area-aware mobile navigation.
- [x] Playwright projects for desktop Chromium and Pixel 7 viewport.
- [x] Acceptance tests for startup, language persistence, sorting, lists, slot fallback and responsive navigation.
- [x] Production-preview test for offline shell and IndexedDB collection recovery.
- [x] Capacitor Android wrapper package and automated prepare/open/run commands.
- [x] Application-owned service-worker handling and native IndexedDB-only storage.
- [ ] Confirm Playwright execution in GitHub Actions.
- [ ] Add low-memory image-pressure testing.
- [ ] Generate and review the native `apps/mobile/android` project.
- [ ] Add Android build/signing pipeline.
- [ ] Evaluate iOS build requirements.
- [ ] Define optional private synchronization for smartphones.

## Phase 10 — Private beta and public readiness

- [ ] Confirm no data-loss issue through longer collection usage.
- [ ] Review all provider terms, media caching and attribution.
- [x] Add malicious-import and storage-limit schema tests.
- [x] Add browser acceptance for invalid-type and oversized backup files.
- [ ] Validate major platform families and representative edge cases.
- [ ] Add privacy policy and source-attribution page.
- [ ] Complete desktop and physical-smartphone usability passes.
- [ ] Decide repository visibility and hosting strategy.
- [ ] Enable production deployment explicitly.

## Next implementation milestone

1. Confirm and repair the first complete GitHub Actions run.
2. Add PCGamingWiki as the next automatic no-key provider.
3. Add VNDB automatic identity/rating/play-length enrichment for visual novels.
4. Add per-release completeness/conflict diagnostics without interrupting normal use.
5. Generate the Capacitor Android project and test on a physical phone.
6. Profile Three.js memory, GPU use and context recovery.

## Deferred ideas

- public accounts and social lists;
- barcode scanning;
- imports from platform accounts;
- emulator/launcher integration;
- collection value tracking;
- desktop filesystem scanning through Tauri.
