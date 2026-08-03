# Save Slot — native Android client

A ground-up Kotlin/Compose rewrite of the WebView prototype in `../app`. Same product: a game
research, collection and notes app built around a tactile 3D cartridge-and-slot interface, driven by
public data sources that need no personal API keys.

## Build

```bash
export ANDROID_HOME=/path/to/android-sdk
./gradlew :app:assembleDebug          # development build, test-signed
./gradlew :app:assembleRelease        # R8-minified, ~1.9 MB
./gradlew :app:testDebugUnitTest      # unit tests
```

Requires JDK 17+, compileSdk 37, minSdk 26. The release build is signed with the repository's
bundled development key (`../signing/save-slot-test.keystore`) — it is not a production
release-signing setup.

If you build from WSL against a Windows drive, pass
`--project-cache-dir=$HOME/.cache/save-slot-gradle`; DrvFs cannot provide the file locks Gradle's
project cache needs.

## Architecture

Single Gradle module, layered by package. Dependencies point inward only: `ui` → `domain` ← `data`.

```
core/        text normalisation, title matching, HTTP+JSON plumbing
domain/      models, the discovery session
data/
  local/     Room database, DAOs, JSON payload (de)serialisation
  remote/    Wikidata, Wikipedia, Commons, and the eight artwork providers
  repository/ Game, Library, Taxonomy, Settings
render/      model loading, GLES2 program, slot scene, off-screen card previews
ui/          Compose theme, components, screens, view models, navigation
system/      haptics
di/          AppContainer — the whole dependency graph
```

**Presentation.** MVVM with unidirectional data flow: view models expose immutable state through
`StateFlow`, screens are functions of that state, and events go back as method calls. Type-safe
navigation routes via `kotlinx.serialization`.

**Dependency injection** is a hand-written `AppContainer`. Everything is constructor-injected and
lazily built, so one file describes the wiring and tests substitute fakes directly — a generated
graph would add a build step without buying much for a tree this shallow.

**Persistence** is Room. Game facts are stored as one JSON column per row because they are a
document always read whole, so new upstream fields do not force a migration; the columns that are
queried or sorted on (status, ownership, timestamps) are real columns. Settings live in DataStore.

**Networking** is OkHttp with `kotlinx.serialization`, parsed as `JsonElement` rather than into
strict classes: these are loosely typed MediaWiki and storefront endpoints whose response shapes
vary per entity. Each call takes its own timeout because the artwork providers race each other.

## The parts worth knowing about

**Artwork resolution** is the app's hard problem, and most of the data layer exists to serve it.
Eight sources are grouped into tiers; within a tier they run concurrently and the first acceptable
answer in tier order wins, so the release-accurate sources (the Libretro ROM archive, storefronts)
are consulted before wiki search, without serialising everything. A provider that fails twice in a
row is benched for a while so one dead host cannot cost every later lookup its full timeout.
Candidates are then filtered on aspect ratio — portrait is packaging, landscape is a screenshot —
and on filename heuristics that reject rating badges, logos, and artwork belonging to a *different*
platform release of the same game.

The dominant failure mode is matching the wrong entry in a series, so instalment numbers are
checked before any scoring: Roman numerals are normalised, and release years and hardware model
numbers ("Nintendo 64") are excluded so they do not read as sequels. Two strictnesses exist —
search results must name the game, whereas images embedded in an article need only not *contradict*
it, since the article is already about the right game.

Negative results are cached with a timestamp rather than permanently: an artwork miss is usually a
slow provider, not a genuine absence, so the chain retries after 90 seconds.

**3D rendering** uses GLES2 directly. The slot is a `GLSurfaceView` drawn on demand — it is idle
whenever nothing is animating, which is most of the time. Game cards do *not* each get a GL surface;
a single hidden pbuffer context renders each cover into a cached bitmap once, so a rail of
cartridges costs no more to scroll than a list of photos while still showing real geometry.

**Haptics** address the vibrator directly instead of going through a JavaScript bridge, using
composition primitives where the hardware has them (`CLICK` then `TICK` reads as a mechanical catch
engaging) and stepping down to waveforms and a plain duration on simpler devices.

## Differences from the WebView prototype

Behaviour is preserved, with these deliberate corrections:

- Article-embedded images are no longer required to repeat a numbered game's instalment digit in
  their filename, which had been discarding most valid screenshots for titles like *Silent Hill 2*.
- Libretro filename guesses now use the real No-Intro convention, moving a leading article before
  the subtitle (`Legend of Zelda, The - Ocarina of Time`) rather than appending it to the whole
  string, where it never matched a file.
- Vendor-prefixed platform names ("Sony PlayStation 2", "Microsoft Xbox 360") fold onto the same
  canonical platform, so a game's platform list no longer splits in two.
- Better artwork arriving after a game opens swaps the cartridge label instead of replaying the
  insert animation.

## Tests

`./gradlew :app:testDebugUnitTest` covers the pure logic that is most likely to regress silently:
title and instalment matching, platform canonicalisation, artwork filename heuristics, title repair,
and Libretro archive-name matching.
