# Data-Source Strategy

## Product requirement

Save Slot must be useful immediately after installation without accounts, registrations or API keys.

The default application must provide:

- game search and random discovery;
- platform-specific releases;
- descriptions and release dates;
- verified covers where available;
- screenshots and title screens;
- clearly sourced player/community signals;
- personal backlog and collection management;
- local recommendations;
- offline access to previously loaded data.

Providers requiring credentials may exist only as optional expert extensions. They must never block startup, hide the catalogue or produce a missing-key error during normal use.

Authentication requirements are not bypassed. Save Slot instead prefers open interfaces, public datasets, local caching and community-maintained corrections.

## Default no-key provider set

| Provider | Default role | Data used | Limits and policy | Status |
|---|---|---|---|---|
| Wikidata / Wikibase | primary broad identity and search | titles, aliases, dates, platforms, genres, developers, publishers and external IDs | incomplete release and media coverage; community data must be validated | enabled |
| Wikipedia / Wikimedia Commons | descriptions and open supplementary media | localized summaries, article links and explicitly classified media | article images are not automatically box art | planned enrichment |
| Steam Store | PC release enrichment | official description, developers, publishers, screenshots and library/store cover | PC/Steam scope only; responses are cached | enabled |
| Steam User Reviews | PC community rating | positive percentage, review count and review scope | Steam release only; never presented as a universal game score | enabled |
| Libretro Thumbnails | console, handheld and retro media | `Named_Boxarts`, `Named_Snaps` and `Named_Titles` | exact platform/title matching; incomplete modern coverage | enabled |
| PCGamingWiki | PC technical enrichment | PC page identity, release data, compatibility and display capabilities | 30 requests/minute; requires a descriptive User-Agent and caching | next provider |
| VNDB Kana API | visual-novel catalogue enrichment | titles, aliases, releases, developers, platforms, images, ratings and play length | most catalogue endpoints require no authentication; non-commercial and rate-limited | next provider |
| SteamSpy | optional approximate PC popularity | estimated owners, concurrent users and approximate playtime | estimates are explicitly approximate and unreliable for recent releases | optional no-key signal |
| Local community catalogue | gap filling and corrections | aliases, release links, platform mapping, source URLs and user-approved overrides | stores metadata and source links, not redistributed copyrighted media | planned |
| Manual user override | private collection correction | cover URL, notes, edition, region and personal metadata | affects only the user’s local collection | enabled |

## Providers that are not part of the default experience

| Provider | Reason |
|---|---|
| IGDB | requires Twitch application credentials and OAuth; optional only |
| MobyGames | requires API subscription and media/licensing review |
| RAWG | requires an API key and attribution |
| Giant Bomb and similar catalogues | require credentials or have unsuitable current terms |

The application may expose these under **Advanced → Optional providers**, but the standard launcher and mobile build must not request or generate credentials.

## Backloggd policy

Backloggd is valuable as a product reference and community signal, but it is not suitable as the foundation of the Save Slot catalogue:

- Backloggd states that its game, platform and company metadata comes from IGDB;
- therefore querying Backloggd for the same metadata would only add an indirect dependency on IGDB;
- Backloggd does not publish a documented public API for third-party catalogue access;
- its terms require users to access the site through the interface it provides.

Save Slot must not build a hidden mass scraper or attempt to bypass protections.

Allowed Backloggd integration:

- direct **Open in Backloggd** link when a reliable match is known;
- clearly labelled user-triggered lookup only if a permitted stable interface becomes available;
- import from an official Backloggd export if the service adds one;
- never copy reviews or user content without permission;
- never blend a Backloggd score with Steam or other ratings.

Until an official interface or permission exists, Save Slot reproduces the useful backlog workflow locally instead of depending on Backloggd’s private implementation.

## Local-first backlog experience

The personal tool must provide Backloggd-style functionality using local data:

- collection, wishlist, backlog, playing, completed, mastered, paused and dropped states;
- multiple playthroughs and ownership copies in the future;
- platform and edition selection;
- personal score, notes, tags and acquisition information;
- local statistics by platform, genre, year, ownership and completion status;
- recommendations calculated from the user’s ratings, completed games, preferred platforms and hidden/dropped titles;
- JSON export with no account requirement.

These features do not require any remote service.

## Recommended zero-configuration pipeline

### Search and identity

1. Search Wikidata using `wbsearchentities`.
2. Fetch entity batches using `wbgetentities`.
3. Normalize platform names and external IDs.
4. Merge matching VNDB records for visual novels.
5. Apply local community aliases and corrections.
6. Fall back to the bundled representative catalogue when all network sources fail.

### Release and media enrichment

1. Use Steam when a verified Steam App ID exists.
2. Use Libretro for supported platform-specific retro media.
3. Use explicitly classified Wikimedia media only when it represents the exact game/release.
4. Use PCGamingWiki for PC release identity and technical data.
5. Apply the user’s private cover override last.

### Community and popularity signals

Community signals remain separate:

- Steam review percentage and count;
- VNDB rating and vote count for visual novels;
- SteamSpy approximate owners/playtime for PC, clearly marked as estimates;
- personal rating;
- future permitted Backloggd statistics, if an official interface appears.

No silent universal average is created.

## Offline and local caching

Desktop cache layout:

```text
.save-slot-data/
  library.json
  library.backup.json
  catalogue/
    entities/
    searches/
    media-index/
    provider-status.json
  overrides/
    local-catalogue.json
```

Mobile uses the same logical stores through IndexedDB/native app storage.

Rules:

- cached catalogue data is separate from personal collection data;
- previously opened games remain available offline;
- stale data is shown with retrieval time rather than discarded;
- provider failures do not remove cached releases;
- negative lookups use short TTLs;
- large media files are not duplicated indefinitely;
- the user can clear catalogue cache without deleting the library.

## Source documentation

- Wikibase API: https://www.mediawiki.org/wiki/Wikibase/API/en
- MediaWiki REST/Action API: https://www.mediawiki.org/wiki/API/en
- Steam user reviews: https://partner.steamgames.com/doc/store/getreviews
- Libretro thumbnails: https://docs.libretro.com/guides/roms-playlists-thumbnails/
- PCGamingWiki API: https://www.pcgamingwiki.com/wiki/PCGamingWiki:API
- VNDB Kana API: https://api.vndb.org/kana
- SteamSpy API information: https://steamspy.com/about
- Backloggd game-data explanation: https://backloggd.com/about/game-data/
- Backloggd terms: https://backloggd.com/about/terms-of-service/
- IGDB API authentication: https://api-docs.igdb.com/

Provider terms and limits must be reviewed again before public distribution.

## Provider policy

### No hidden source mixing

Every field and media item retains provenance. When providers disagree, Save Slot keeps candidates and selects a display value according to explicit confidence rules.

### Provider independence

- search works when one or more providers are unavailable;
- Steam never limits console visibility;
- VNDB enriches visual novels without replacing general catalogue identity blindly;
- missing ratings never remove a game;
- missing covers never change title identity;
- a provider timeout does not cancel successful results from other providers;
- no credential prompt appears in the default flow.

### Rate-limit handling

Each adapter defines:

- request timeout;
- concurrency limit;
- cache TTL;
- negative-cache TTL;
- rate-limit response handling;
- provider health state;
- descriptive User-Agent where required.

The frontend receives provider state but does not retry every source itself.

## Box-art policy

A candidate may be displayed as box art only when it is:

- classified as a cover by the source;
- linked to the exact game or release;
- compatible with the selected platform;
- sufficiently large and usable;
- not a screenshot, banner, title screen or unrelated article image.

Source order:

### Retro release

1. exact platform-specific Libretro `Named_Boxarts`;
2. explicitly classified Wikimedia release cover;
3. local community source link;
4. private user override;
5. missing-cover placeholder.

### Steam PC release

1. verified Steam library/store cover;
2. PCGamingWiki cover when source and identity match;
3. explicitly classified Wikimedia cover;
4. private user override;
5. placeholder.

### Modern console release

1. exact open-source/provider cover with verified platform identity;
2. explicitly classified Wikimedia release cover;
3. local community source link;
4. private user override;
5. placeholder.

Modern console coverage will be less complete without credentialed catalogues, so local corrections and transparent placeholders are preferable to wrong promotional images.

## Provider acceptance test

A no-key provider is ready only when it passes:

- schema validation;
- no-auth fresh-install test;
- timeout and rate-limit tests;
- empty and malformed response handling;
- source attribution checks;
- cache/offline restoration tests;
- representative PC, console, handheld and retro cases;
- proof that no secret is bundled into frontend or mobile output.
