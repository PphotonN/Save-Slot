# Contributing to Save Slot v1

Save Slot v1 is currently developed in a private repository. This document defines the branch and review workflow for the rewrite.

## Branches

- `main` — archived prototype and historical reference.
- `app-v1` — integration branch for the rewritten application.
- `feature/<name>` — isolated feature work created from `app-v1`.
- `fix/<name>` — targeted fixes created from `app-v1`.
- `docs/<name>` — documentation-only work.

Do not implement new v1 features directly in `main`.

## Starting work

```bash
git fetch origin
git switch app-v1
git pull --ff-only
git switch -c feature/<short-name>
```

Before coding, identify which roadmap phase and domain boundary the change belongs to.

## Pull requests

Pull requests target `app-v1` until the application reaches public readiness.

A pull request should explain:

- what changed;
- why it changed;
- affected user workflow;
- affected data entities;
- mobile impact;
- provider/licensing impact;
- migrations, if any;
- checks performed.

Large features should be divided by domain boundary rather than by arbitrary file count.

## Commit style

Use short imperative messages:

```text
Add canonical release schema
Implement Wikidata provider adapter
Preserve cards during progressive media loading
Document MobyGames licensing decision
```

Avoid versioned patch chains such as `app-v13.js`. Modify the owning module and cover the behaviour with tests.

## Definition of done

A change is complete when applicable checks pass:

- formatting;
- lint;
- TypeScript typecheck;
- unit tests;
- application build;
- desktop Playwright flow;
- mobile Playwright flow;
- schema migration test;
- provider fixture test;
- accessibility check;
- documentation update.

## Architecture rules

- Domain packages do not import UI or browser code.
- Provider payloads are validated and normalized before entering the application.
- Provider IDs are not canonical Save Slot IDs.
- The client does not contain private API credentials.
- Personal collection data is not sent to catalogue providers.
- Game, release and collection entry remain separate.
- Sorting cannot determine item visibility.
- Existing cards remain mounted during progressive updates.
- Missing ratings do not hide games.
- Missing box art does not change release identity.

## Data-source changes

A new provider requires:

1. official documentation link;
2. authentication and rate-limit notes;
3. licensing and attribution review;
4. provider adapter contract;
5. timeout and cache policy;
6. representative fixtures;
7. malformed-response and rate-limit tests;
8. documentation update in `docs/DATA_SOURCES.md`;
9. decision record when the provider affects core architecture.

Do not make an undocumented public scraper a required provider.

## Data-model changes

Changes to persisted entities require:

- schema version update;
- migration;
- migration test;
- export/import compatibility review;
- confirmation that notes and personal ratings are preserved;
- documentation update in `docs/DATA_MODEL.md`.

## UI changes

Every substantial interface change must be checked at:

- desktop wide viewport;
- desktop narrow viewport;
- common phone width;
- touch interaction;
- keyboard navigation;
- reduced-motion mode;
- offline or partial-provider state where relevant.

The PS1 visual identity must not reduce readability or distort original box art.

## 3D scene rules

- Three.js stays inside `packages/ps1-scene`.
- Application state is passed into the scene through a typed interface.
- The cartridge uses translation, rotation and uniform scale only.
- WebGL failure must not block search or collection functions.
- The scene must support reduced motion.

## Localization

- No new hardcoded user-facing strings in components.
- Ukrainian and English keys are added together.
- Source descriptions remain distinct from machine translations.
- Translation errors must not replace the original text.

## Secrets and environment files

Allowed committed files:

```text
.env.example
.dev.vars.example
```

Forbidden:

```text
.env
.dev.vars
provider access tokens
private API keys
production deployment tokens
```

If a secret is committed accidentally, remove it from use immediately and rotate it. Deleting the file in a later commit is not sufficient.

## Documentation language

Core technical documents may use English to keep code and external terminology consistent. User-facing interface specifications should include Ukrainian terminology where relevant.

## Release policy

No public deployment is created from `app-v1` until the roadmap's private-beta checks are complete and the repository owner explicitly approves publication.
