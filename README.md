# Save Slot r39 — Stability Audit Build

Save Slot is an Android game research, collection and notes app built around a tactile 3D cartridge-and-slot interface. The current prototype uses a local WebView wrapper and public data sources that do not require personal API keys.

## Current capabilities

- Ukrainian portrait interface for Android.
- Search by title and filters: platform, genre and year range.
- Game details, descriptions, platforms, release year, genres, developers, publishers and series.
- Platform-specific box-art and screenshot lookup with multiple fallbacks.
- Local cache, recent history, personal collection, play status, ratings, ownership data and notes.
- Live 3D cartridge rails, cartridge flight into the slot and 3D insert/eject animation.
- Native Android haptic bridge with a JavaScript vibration fallback.
- Offline fallback to previously cached games.

## r39 changes

- Audited HTML IDs, JavaScript syntax, Python build scripts, CSS syntax and APK input structure.
- Removed obsolete local demo-game data and unused flight-renderer code.
- Added persisted-data repair for malformed cache, collection, notes, recent history, settings and taxonomy records.
- Canonicalized platform names such as Microsoft Windows, GameCube, PSP and PlayStation aliases.
- Fixed a race where refreshing the discovery list during an active load could leave it empty or stop pagination.
- Discovery now falls back to cached real games when network sources are temporarily unavailable and avoids repeating recent games.
- Live 3D rails pause while off-screen, while another tab is active or while the app is in the background.
- Added automatic rail recreation after repeated WebGL errors or context loss.
- Slot rendering is now demand-driven instead of running continuously when nothing moves, reducing GPU load and context-loss risk.
- Added cover-request sequencing so an older image request cannot overwrite a newer selected game or platform.
- Cartridge-flight snapshots now use `readPixels`, avoiding unreliable captures from a non-preserved WebGL buffer.
- Limited the static 3D-preview cache and made failed preview/image lookups retryable.
- Unverified Wikidata/Wikipedia images are displayed as provisional while platform-specific box art is still checked.
- Increased several media-provider and image-validation timeouts moderately, while reducing negative-result retry time to 90 seconds.
- Media cache moved to `saveSlot.cache.v9` so old failed or mismatched results are rechecked.
- Added a haptic test button in Settings.
- Added stricter build validation for required assets, DEX header, duplicate ZIP entries and corrupted APK entries.

## Project structure

- `app/` — HTML, CSS, JavaScript and runtime assets embedded in the APK.
- `app/assets/model.json` — WebGL-ready cartridge and slot geometry.
- `app/assets/model-data.js` — embedded model data for reliable Android asset loading.
- `app/assets/cartridge-slot.glb` — GLB version for future native rendering.
- `native-src/` — source of the Android WebView wrapper and native haptic bridge.
- `android-wrapper/` — prebuilt manifest and DEX used by the stable APK packager.
- `source-assets/` — original FBX and reference renders.
- `tools/` — FBX extraction scripts.
- `build_valid_apk.py` — stable development APK packager and signature verifier.

## Build notes

The stable wrapper deliberately keeps the known-working Android manifest and DEX unchanged. Launcher icon resources and `resources.arsc` are not added because previous experimental resource packaging produced invalid APKs on the test Android 16 device.

Live search requires internet access. Collection, notes, settings and already cached games remain local. The generated APK is development-signed with the bundled test key and is not a production release-signing setup.
