# Libretro media matching

Save Slot uses Libretro only as a platform-specific media provider. It does not use a thumbnail match to establish game identity.

## Platform boundary

A request is made only when the normalized release platform maps to a known Libretro thumbnail playlist. Unsupported platforms return an empty enrichment result without network requests.

Examples:

```text
PlayStation       → Sony - PlayStation
Nintendo 64       → Nintendo - Nintendo 64
Game Boy Advance  → Nintendo - Game Boy Advance
Dreamcast         → Sega - Dreamcast
```

## Box-art candidate priority

Candidates are bounded and checked in this order:

1. an existing Libretro source URL attached to the release;
2. an existing Libretro source ID in `<playlist>/Named_Boxarts/<name>` form;
3. exact release title;
4. canonical game title;
5. game aliases;
6. safe punctuation, article and numeral variants;
7. region-prioritized filename suffixes.

The provider uses release region to move `(USA)`, `(Europe)`, `(Japan)` or `(World)` near the front of the candidate order. It still checks the suffix-free filename first.

## Safe URL policy

Existing source URLs are accepted only when all conditions are true:

- scheme and host resolve to `https://thumbnails.libretro.com`;
- path contains `/Named_Boxarts/`;
- filename ends in `.png`.

This prevents imported or malformed metadata from turning cover verification into an arbitrary server request.

## Probe strategy

The provider first sends a bounded `HEAD` request. Some static/CDN servers do not support `HEAD`, so status `403`, `405`, `501`, or a successful response without image content type can fall back to:

```text
GET
Range: bytes=0-1023
```

The response body is cancelled after validation. A definite `404` does not trigger a second request.

## Probe cache

Each Worker provider instance remembers recent box-art verification results:

- positive match: 60 minutes;
- negative match: 5 minutes;
- maximum remembered URLs: 512.

The cache avoids repeating identical thumbnail checks during one Worker process lifetime. The Worker catalogue/detail cache remains the longer-lived layer.

## Candidate budget

The API currently constructs the provider with a maximum of 12 box-art candidates per release. The provider itself defaults to 20 when used independently. Candidate generation stops at the configured budget; it never scans a remote directory or performs unbounded fuzzy search.

## Supplementary media

Supplementary media is checked only after a `Named_Boxarts` candidate has been verified. The exact same playlist and filename are then used for:

```text
<playlist>/Named_Snaps/<matched-name>.png
<playlist>/Named_Titles/<matched-name>.png
```

This produces:

- `Named_Snaps` → verified `screenshot` media;
- `Named_Titles` → verified `title-screen` media.

No second fuzzy-title pass is performed. Therefore a screenshot cannot silently come from a different port or similarly named game. Missing supplementary media does not invalidate the verified box art.

## Match output

A successful box-art match produces a verified `cover-front` media asset with:

- game ID;
- exact release ID;
- normalized platform ID;
- Libretro source ID;
- direct thumbnail URL;
- retrieval timestamp;
- attribution label.

Matching snapshots and title screens retain the same game, release, platform, source and attribution boundaries.

A failed box-art match leaves the release visible only when another accepted cover source exists. A Libretro failure never removes the underlying game identity.
