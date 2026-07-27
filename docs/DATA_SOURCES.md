# Data-Source Strategy

## Objective

Save Slot must achieve broad platform coverage without presenting one provider as the source of truth. Providers are combined according to their strengths, licensing conditions and platform scope.

The Worker returns a normalized Save Slot model and keeps provider-specific limitations outside the UI.

## Provider roles

| Provider | Primary role | Strengths | Limitations | Planned status |
|---|---|---|---|---|
| IGDB | broad catalogue and discovery | games, platforms, releases, covers, screenshots, ratings and external IDs | requires Twitch application credentials and OAuth; attribution and usage rules must be followed | primary candidate |
| Wikidata | identity linking and open fallback | multilingual labels, dates, platforms and external identifiers | incomplete release/media coverage; community data can be inconsistent | enabled fallback |
| Wikipedia / Wikimedia Commons | summaries and supplementary media | multilingual editorial summaries and open media metadata | article images are not guaranteed to be platform-specific covers | fallback only |
| MobyGames | release-specific retro information and media | detailed platform releases, cover groups and screenshots | API access and media use require subscription/attribution review | optional licensed provider |
| RAWG | secondary broad catalogue | wide catalogue, store links, screenshots and metadata | API key and attribution required; release precision varies | optional fallback |
| Libretro thumbnails | retro box art, title screens and screenshots | strong platform-oriented retro media with explicit `Named_Boxarts`, `Named_Snaps` and `Named_Titles` separation | exact name matching; not a complete modern catalogue | enabled retro media provider |
| Steam | PC store data and player reviews | official PC descriptions, screenshots, store media and review totals | PC scope only; browser access should go through the Worker | enabled PC provider |
| PCGamingWiki | PC technical and supplementary data | PC-specific release and compatibility information | not a universal catalogue; rate limits and content rules apply | optional PC enrichment |
| Official platform stores | official descriptions, release links and images | authoritative for a specific store release | APIs and page structures differ; scraping must not be a core dependency | selective enrichment |

## Source documentation

- IGDB API: https://api-docs.igdb.com/
- Wikibase API: https://www.mediawiki.org/wiki/Wikibase/API/en
- MediaWiki CORS: https://www.mediawiki.org/wiki/API:Cross-site_requests
- MobyGames API: https://www.mobygames.com/info/api/
- RAWG API: https://rawg.io/apidocs
- Libretro thumbnails: https://docs.libretro.com/guides/roms-playlists-thumbnails/
- Steam user reviews: https://partner.steamgames.com/doc/store/getreviews
- PCGamingWiki API: https://www.pcgamingwiki.com/wiki/PCGamingWiki:API

Provider terms must be reviewed again before production deployment.

## Recommended v1 provider set

### Required for the first integrated build

1. **IGDB** — broad search, canonical candidates, platforms, release dates, covers and screenshots.
2. **Wikidata** — external ID linking, multilingual labels and gap filling.
3. **Libretro** — retro platform box art and screenshots.
4. **Steam** — PC release information and player-review metrics.

### Optional after the core pipeline is stable

- MobyGames when API/media licensing is approved;
- RAWG as a secondary search and screenshot provider;
- PCGamingWiki for PC technical details;
- official stores for exact release links and descriptions.

## Provider policy

### No hidden source mixing

Every field has provenance. If two providers disagree, Save Slot does not silently invent a value.

Example:

```json
{
  "releaseDate": {
    "value": "1998-11-21",
    "source": "igdb",
    "confidence": "high"
  }
}
```

The public API may flatten high-confidence fields for convenience, but diagnostics retain all candidates.

### Provider independence

- Search still works when one provider is unavailable.
- Steam never limits console visibility.
- Missing ratings never remove a game.
- Missing covers never change title identity.
- A provider timeout does not cancel successful results from other providers.

### Rate-limit handling

Each adapter defines:

- request timeout;
- retry policy;
- concurrency limit;
- cache TTL;
- negative-cache TTL;
- rate-limit response handling;
- provider health state.

The frontend receives provider warnings but does not retry all providers itself.

## Search aggregation

### Step 1: broad candidate search

Query the enabled broad catalogue providers. Return candidates quickly with minimal data:

- provider ID;
- title;
- year;
- platforms;
- basic image;
- external IDs.

### Step 2: canonical linking

Link candidates using:

1. shared IDs such as Wikidata, Steam, MobyGames or IGDB references;
2. exact title and year;
3. exact title and overlapping platforms;
4. fuzzy title only as a low-confidence suggestion.

### Step 3: release expansion

For the selected game, request platform-specific releases and regions.

### Step 4: media and ratings

Load box art, screenshots and ratings for the selected release. This stage is progressive and must not rebuild already visible search cards.

## Box-art source order

The exact order depends on platform and provider availability.

### Modern console release

1. release-specific cover from a trusted catalogue provider;
2. official store cover for the exact release;
3. licensed MobyGames cover group;
4. platform-specific fallback from another trusted catalogue;
5. custom user cover for the private collection.

### Retro release

1. release-specific provider cover;
2. Libretro `Named_Boxarts` for the exact platform/title;
3. licensed MobyGames cover group;
4. verified Wikimedia image only when it is explicitly a cover for that release;
5. missing-cover placeholder.

### PC release

1. catalogue release cover;
2. official Steam library/store cover when Steam ID matches;
3. GOG or other official store media when integration is approved;
4. PCGamingWiki supplementary media;
5. missing-cover placeholder.

## Box-art validation

A candidate receives a quality score based on:

- provider classification as front cover;
- exact platform match;
- exact region match;
- sufficient dimensions;
- expected aspect ratio range;
- language preference;
- absence of watermarks where possible;
- source reliability.

A screenshot, logo, title screen or banner is rejected as box art even if portrait-shaped.

## Screenshots

Screenshot providers are ranked separately from cover providers.

Requirements:

- screenshot is tied to the game or release;
- source and platform are retained;
- duplicates are removed by perceptual or URL identity where practical;
- the gallery avoids mixing screenshots from materially different ports without a platform label;
- thumbnails load first and full images load on demand.

## Ratings

Ratings are not merged into one number by default.

Possible panels:

- IGDB community rating;
- Steam user reviews for PC;
- MobyGames player score when licensed;
- critic score as secondary information;
- personal rating from the collection.

Every rating displays:

- source;
- score and scale;
- vote count where available;
- platform scope;
- retrieval time in diagnostics.

## Descriptions

Preferred order:

1. localized official description for the selected release;
2. provider editorial summary;
3. Wikipedia summary;
4. translated description;
5. explicit missing-description state.

The original text and source remain available after translation.

## Licensing and attribution checklist

Before enabling a provider in production:

- verify current API terms;
- verify commercial/non-commercial restrictions;
- verify image hotlinking or caching rules;
- verify attribution text and link requirements;
- verify retention limits;
- record the decision in `docs/DECISIONS.md`;
- add automated attribution metadata to normalized responses.

## Provider acceptance test

A provider adapter is ready only when it passes:

- schema validation;
- timeout and retry tests;
- rate-limit simulation;
- empty-result handling;
- malformed-response handling;
- source attribution checks;
- representative tests for PC, modern console, handheld and retro titles.
