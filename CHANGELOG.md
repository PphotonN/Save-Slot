# Save Slot v1 Changelog

## Unreleased alpha

### Added

- automatic portable Windows runtime with Node.js 24.18.0 and local pnpm;
- project-local collection mirror in `.save-slot-data/library.json`;
- automatic `library.backup.json` before replacing the active collection file;
- local library cache service started by `START_SAVE_SLOT.bat`;
- left-to-right catalogue and cartridge-shelf row construction;
- collection search, status filter, platform filter and sorting;
- complete collection-entry editor for status, ownership, format, personal rating, priority, quantity, acquisition date, price, currency, tags and notes;
- game-detail tabs for overview, screenshots, ratings and source attribution;
- fullscreen screenshot viewer;
- sourced rating panels with vote counts;
- platform-release switcher for games returned with several releases;
- layered online catalogue cache using memory, Cache API and an optional KV-compatible binding;
- six-hour normalized search cache independent from sorting;
- 30-day game and release detail cache;
- stable cached `/v1/games/:id` and `/v1/releases/:id` routes for previously discovered online entities;
- `/v1/cache` diagnostics endpoint and settings panel;
- cached detail refresh when opening a game from the personal collection;
- unit and integration tests for cache memory, KV-compatible persistence and detail routes.

### Changed

- selected catalogue cards now retain their complete game release group instead of discarding sibling platform releases;
- adding or removing from the collection always targets the currently selected release;
- project-file writes are debounced so a multi-step collection update is saved as one consistent payload;
- `@save-slot/storage` now exports the project-file mirrored browser repository by default;
- Wrangler is pinned to an exact version to prevent unexpected local runtime requirement changes;
- the launcher waits for the library cache, API and web application before opening the browser;
- discovery remains random while each discovered game and release is retained in the detail cache;
- collection snapshots can be refreshed from cached normalized online metadata without blocking local display.

### Fixed

- Windows PowerShell 5 parsing failure caused by UTF-8 without BOM;
- local pnpm validation before portable Node.js was added to `PATH`;
- Wrangler failure under Node.js 20;
- right-to-left cartridge row construction;
- project library cache implementation not being used by the package root export;
- online detail routes being limited to the small fixture catalogue.

### Verification note

The GitHub integration cannot read private Actions status for this repository and returns HTTP 403. A clean CI result must still be confirmed in the repository **Actions** tab before this alpha is treated as build-verified.
