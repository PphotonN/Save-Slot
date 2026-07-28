# Automatic metadata enrichment

## Product rule

Manual editing is optional. A normal Save Slot user must be able to search for a game, add a concrete release to the backlog or collection and receive useful metadata without correcting provider data by hand.

Manual overrides exist only for:

- genuinely missing information;
- unusual regional or homebrew releases;
- a personal cover preference;
- a provider mistake that has not yet been corrected upstream.

## Automatic pipeline

```text
open provider candidates
        ↓
identity assessment
        ↓
conservative reconciliation
        ↓
field and media enrichment
        ↓
validation and provenance
        ↓
cache and collection snapshot
```

### 1. Candidate discovery

The default no-key pipeline searches open sources and keeps provider identifiers attached:

- Wikidata identities and external IDs;
- exact Wikipedia sitelinks;
- Steam App IDs and official PC data;
- Libretro platform media;
- future PCGamingWiki and VNDB records;
- bundled offline fixtures when the network is unavailable.

### 2. Identity assessment

Records are merged automatically only when the evidence is strong.

Highest confidence:

- identical Save Slot canonical ID;
- shared external provider ID, such as the same Wikidata item or Steam App ID.

High confidence:

- exact title, compatible release year and normalized platform;
- exact title and compatible release year;
- exact title, normalized platform and matching developer when the year is unavailable;
- near-identical title, compatible year and normalized platform.

Insufficient evidence:

- title alone;
- title and platform with no year or developer;
- conflicting years;
- conflicting platforms without an external identity;
- one portrait image that merely looks like a cover.

Insufficient candidates stay separate until another source supplies stronger evidence. Save Slot prefers a duplicate over silently merging unrelated games.

### 3. Canonical field selection

When records are reconciled, the stronger provider supplies the canonical title and base identity. Other sources supplement missing data.

Current precedence for catalogue identity:

1. licensed exact-release sources when explicitly enabled;
2. official store identity;
3. Wikidata;
4. Steam;
5. PCGamingWiki;
6. Wikipedia;
7. Libretro media matching;
8. secondary broad catalogues;
9. bundled/manual fixture data.

User-owned collection fields are not part of this precedence. Personal notes, ratings, price, condition and custom cover always remain local and are never overwritten by providers.

### 4. Release reconciliation

Release candidates are compared using:

- normalized platform identity;
- region;
- release year/date;
- edition;
- shared external IDs.

When equivalent releases merge:

- media and ratings are rebound to the canonical release ID;
- verified box art is preferred;
- screenshots remain separate from covers;
- source references are retained;
- player ratings remain separate by provider;
- formats are combined without duplication.

### 5. Automatic Wikipedia descriptions

The active Wikidata provider performs a no-key batch enrichment:

1. collect exact Wikidata QIDs from normalized game results;
2. request localized Wikipedia sitelinks from Wikidata;
3. request article introductions in batches;
4. verify that each returned Wikipedia page exposes the same `wikibase_item` QID;
5. add the localized extract and source URL only after the identity check succeeds.

A title match alone is never accepted for this enrichment. A verified long Wikipedia introduction is placed before the short Wikidata entity description while both sources remain available.

### 6. Progressive enrichment

Search results appear before every optional media check finishes. Additional data is attached progressively:

- Steam description, cover, screenshots and reviews for a verified Steam release;
- Libretro `Named_Boxarts`, `Named_Snaps` and `Named_Titles` for a matched platform release;
- exact Wikipedia introduction through the Wikidata identity;
- future PCGamingWiki technical data for PC;
- future VNDB rating and play length for visual novels.

Provider failure does not remove an already found game.

### 7. Validation

Every normalized object passes the shared Zod schemas. Automatic imports and provider responses reject:

- non-HTTP media URLs;
- missing release relationships;
- duplicated canonical identifiers;
- malformed ratings;
- covers without release/platform scope;
- collection entries referencing absent releases.

### 8. Cache behavior

Successful normalized search pools are cached independently from personal collection data. Game and release details retain retrieval time and can be reused offline.

Stale cached data is displayed while a refresh is attempted. A refresh may add fields or newer source records, but it never overwrites personal collection metadata.

## User experience

The normal flow is:

1. search for a game;
2. choose the platform release;
3. inspect automatically sourced information;
4. add it to a list;
5. optionally enter personal fields such as condition, price, tags or notes.

The user is not expected to supply title, year, platform, description, cover, screenshots or community rating manually.

## Diagnostics

The details panel exposes source links and rating scope. Provider health and cache status remain visible in settings. Future diagnostics may show identity confidence and unresolved field conflicts, but they must not interrupt the standard workflow unless a destructive merge is genuinely ambiguous.
