# Data Model

## Goals

The data model must distinguish a game concept from a platform-specific release and from the user's owned copy. This prevents the most common catalogue errors: wrong platform labels, generic covers, duplicate games and collection entries that do not identify the actual version.

## Entity graph

```text
Game
 ├─ Release 1
 │   ├─ MediaAsset[]
 │   ├─ Rating[]
 │   └─ SourceRef[]
 ├─ Release 2
 │   └─ ...
 └─ SourceRef[]

CollectionEntry
 └─ points to one Release
```

## Game

A canonical work independent of a specific platform.

```ts
interface Game {
  id: CanonicalId;
  title: LocalizedText;
  alternativeTitles: AlternativeTitle[];
  summary?: LocalizedText;
  genres: TaxonomyRef[];
  franchises: TaxonomyRef[];
  developers: CompanyRef[];
  publishers: CompanyRef[];
  firstReleaseDate?: string;
  releaseIds: CanonicalId[];
  sourceRefs: SourceRef[];
  confidence: Confidence;
  updatedAt: string;
}
```

Rules:

- A game must not use a platform-specific cover as its single canonical image.
- The first release date is informational; release dates belong primarily to `Release`.
- Provider IDs are stored only in `sourceRefs`.

## Release

A game version for a platform, region and edition.

```ts
interface Release {
  id: CanonicalId;
  gameId: CanonicalId;
  platform: PlatformRef;
  region?: RegionCode;
  edition?: string;
  releaseDate?: string;
  distribution: "physical" | "digital" | "both" | "unknown";
  mediaFormat?: string;
  languages: LanguageSupport[];
  ageRatings: AgeRating[];
  coverAssetId?: CanonicalId;
  screenshotAssetIds: CanonicalId[];
  ratingIds: CanonicalId[];
  storeLinks: StoreLink[];
  sourceRefs: SourceRef[];
  confidence: Confidence;
  updatedAt: string;
}
```

A release identity is based on:

1. trusted provider release ID;
2. game + platform + region + edition;
3. normalized fallback key only when trusted IDs are unavailable.

## MediaAsset

```ts
interface MediaAsset {
  id: CanonicalId;
  releaseId?: CanonicalId;
  gameId?: CanonicalId;
  kind: "front-cover" | "back-cover" | "screenshot" | "title-screen" | "logo" | "artwork";
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  language?: string;
  region?: RegionCode;
  platformId?: CanonicalId;
  source: SourceRef;
  license?: string;
  attribution?: string;
  verified: boolean;
  qualityScore: number;
}
```

### Cover acceptance rules

A release cover must satisfy all applicable rules:

- `kind` is `front-cover` or a provider explicitly classifies it as box art;
- platform matches the selected release;
- aspect ratio is plausible for that platform;
- dimensions exceed the minimum quality threshold;
- it is not a screenshot, title screen, logo or horizontal banner;
- source and attribution are retained;
- no non-uniform stretching is used in the UI.

When no verified cover exists, show a designed missing-cover placeholder. Do not silently substitute another platform's cover.

## Rating

```ts
interface Rating {
  id: CanonicalId;
  gameId?: CanonicalId;
  releaseId?: CanonicalId;
  source: SourceRef;
  audience: "players" | "critics" | "store-users";
  score: number;
  scale: number;
  normalizedScore: number;
  votes?: number;
  positiveVotes?: number;
  negativeVotes?: number;
  platformScope?: CanonicalId[];
  regionScope?: RegionCode[];
  label?: string;
  retrievedAt: string;
}
```

Rules:

- Ratings from different sources are displayed separately by default.
- A combined score may be introduced only with a documented formula.
- Vote count and platform scope are visible whenever available.
- Unrated games remain searchable and sortable.
- Sorting by rating never filters out games without a rating.

## CollectionEntry

A user's record for a specific release.

```ts
interface CollectionEntry {
  id: string;
  releaseId: CanonicalId;
  gameSnapshot: CollectionGameSnapshot;
  ownership: "owned" | "wanted" | "borrowed" | "sold" | "none";
  format: "physical" | "digital" | "subscription" | "unknown";
  status: "backlog" | "playing" | "paused" | "completed" | "mastered" | "dropped";
  personalRating?: number;
  priority: number;
  favourite: boolean;
  quantity: number;
  condition?: CopyCondition;
  purchase?: PurchaseInfo;
  notes: string;
  tags: string[];
  addedAt: string;
  updatedAt: string;
}
```

A snapshot is stored so the collection remains useful offline even if providers change or disappear.

## Personal lists

Lists reference collection entries rather than copying games.

```ts
interface UserList {
  id: string;
  name: string;
  kind: "collection" | "wishlist" | "backlog" | "custom";
  entryIds: string[];
  sortMode: string;
  viewMode: "list" | "rows" | "cartridges";
  createdAt: string;
  updatedAt: string;
}
```

## SourceRef

```ts
interface SourceRef {
  provider: string;
  externalId: string;
  url?: string;
  retrievedAt?: string;
}
```

Provider IDs must never be overloaded as Save Slot canonical IDs.

## LocalizedText

```ts
interface LocalizedText {
  defaultLanguage: string;
  values: Record<string, string>;
  sourceLanguage?: string;
}
```

## Translation record

```ts
interface TranslationRecord {
  id: string;
  entityType: "game-summary" | "release-description";
  entityId: CanonicalId;
  sourceTextHash: string;
  sourceLanguage: string;
  targetLanguage: string;
  translatedText: string;
  engine: string;
  createdAt: string;
}
```

A translation becomes stale when `sourceTextHash` changes.

## Confidence

```ts
type Confidence = "verified" | "high" | "medium" | "low";
```

Suggested rules:

- `verified`: trusted provider ID or two independent providers agree;
- `high`: trusted provider with complete platform/release data;
- `medium`: title/year/platform match without a shared ID;
- `low`: fuzzy title-only match.

Low-confidence merges must be visible in developer diagnostics and should not silently replace existing canonical data.

## Deduplication priority

1. Shared external identifiers.
2. Provider cross-references.
3. Exact normalized title + first release year.
4. Exact normalized title + overlapping platforms.
5. Fuzzy title matching only for suggestions, never automatic destructive merging.

## Persistence and migrations

Local storage uses a versioned schema.

```ts
interface LocalDatabaseMeta {
  schemaVersion: number;
  createdAt: string;
  migratedAt: string;
}
```

Every breaking change requires:

- a forward migration;
- a tested export/import path;
- preservation of user notes and personal ratings;
- a rollback-safe backup before migration.
