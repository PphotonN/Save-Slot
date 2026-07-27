# Technical Decisions

This file records decisions that should not be repeatedly reopened without new evidence. Each decision may be revised through a documented replacement.

## D-001 — Rewrite instead of extending the prototype

**Status:** accepted

The prototype proved the concept but accumulated sequential runtime patches such as `app-v4.js` through `app-v12.js`. Save Slot v1 starts with a clean architecture in `app-v1`.

Consequences:

- prototype code remains in `main` for reference;
- v1 does not import or incrementally wrap the old runtime;
- useful interaction ideas are reimplemented with tests;
- no public deployment is enabled during the rewrite.

## D-002 — PWA first

**Status:** accepted

The primary application is a responsive PWA. It is installable from a browser and shares one codebase across desktop and smartphone.

Capacitor is added after the PWA is stable. A separate native UI is not planned.

## D-003 — SvelteKit and TypeScript

**Status:** accepted

SvelteKit provides routing, component structure, code splitting and a practical path to a static PWA. TypeScript strict mode is mandatory.

## D-004 — Thin aggregation backend

**Status:** accepted

A Cloudflare Worker protects provider credentials, handles CORS, caches responses and normalizes provider data.

The client does not call credentialed providers directly.

## D-005 — Local-first personal collection

**Status:** accepted

Personal collection data is stored in IndexedDB and remains functional without an account. JSON export/import is part of the first production-ready release.

Cloud synchronization is deferred.

## D-006 — Game, release and collection entry are separate entities

**Status:** accepted

A game is not a platform release, and a platform release is not a user's owned copy. The data model preserves these distinctions throughout search, details and collection workflows.

## D-007 — Multiple providers with explicit provenance

**Status:** accepted

No provider is treated as universally authoritative. Every imported field, image and rating retains source metadata.

Provider priority depends on data type and platform.

## D-008 — IGDB is the primary broad-catalogue candidate

**Status:** proposed pending credential and terms review

IGDB offers broad game, platform, cover, screenshot and rating coverage. The provider should be tested through the Worker before being declared production-ready.

Wikidata remains an open identity and fallback source.

## D-009 — MobyGames is optional and license-gated

**Status:** accepted

MobyGames is valuable for platform-specific retro releases, covers and screenshots, but it is not enabled until the required API tier, attribution and media-use conditions are approved.

## D-010 — Steam is PC enrichment, not the catalogue

**Status:** accepted

Steam provides PC store details and user-review metrics. It does not determine game visibility, console coverage or global ranking.

## D-011 — Verified box art only

**Status:** accepted

A card requiring box art appears only after an accepted front-cover asset is available. Screenshots, logos, banners and another platform's cover are not silent replacements.

A designed missing-cover state is allowed in collection views where hiding the entry would lose personal data.

## D-012 — Ratings remain separate by source

**Status:** accepted

Save Slot does not initially create an opaque combined rating. Each source shows its score, sample size and platform scope.

Personal rating remains independent.

## D-013 — Three.js only for the slot scene

**Status:** accepted

The catalogue and collection use semantic HTML and CSS. Three.js renders the PS1-style slot and cartridges only.

A functional non-WebGL fallback is required.

## D-014 — Original box art is preserved

**Status:** accepted

The box-art texture keeps its original aspect ratio and is never non-uniformly scaled. PS1, CRT or dither treatment is an optional visual filter.

## D-015 — Stable progressive rendering

**Status:** accepted

Existing cards remain mounted while media and ratings arrive. New cards appear progressively. Sorting changes order; filtering changes visibility; neither acts as a trigger required for media completion.

## D-016 — Desktop left rail, mobile compact slot

**Status:** accepted

Desktop uses a persistent left rail with the slot and selected game information. Mobile converts this into a compact top area and an expandable detail sheet rather than preserving a wide sidebar.

## D-017 — Ukrainian and English first

**Status:** accepted

The UI launches with Ukrainian and English message catalogues. Description language is independent, with explicit translation on demand.

## D-018 — No account in the first release

**Status:** accepted

Authentication and sync are deferred until search, release selection, collection management, backup and mobile behaviour are stable.

## D-019 — Private development until readiness review

**Status:** accepted

The repository and deployments remain private during the rewrite. Public hosting is enabled only after security, licensing, data quality and mobile acceptance checks pass.

## Decision review process

A decision change requires:

1. a short proposal explaining the problem;
2. alternatives considered;
3. impact on data migrations and mobile compatibility;
4. provider/licensing impact where relevant;
5. replacement entry in this document;
6. explicit approval before implementation when it changes scope or architecture.
