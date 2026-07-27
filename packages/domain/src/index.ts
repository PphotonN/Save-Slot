import { z } from 'zod';

const MAX_IDENTIFIER_LENGTH = 2048;
const MAX_SHORT_TEXT_LENGTH = 2048;
const MAX_LONG_TEXT_LENGTH = 100_000;
const MAX_COLLECTION_ITEMS = 100_000;

const identifierSchema = z.string().min(1).max(MAX_IDENTIFIER_LENGTH);
const shortTextSchema = z.string().min(1).max(MAX_SHORT_TEXT_LENGTH);
const httpUrlSchema = z.url().refine(
  (value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  },
  { message: 'Only HTTP and HTTPS URLs are accepted.' },
);

function addDuplicateIssues(
  values: string[],
  path: (string | number)[],
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      context.addIssue({
        code: 'custom',
        path: [...path, index],
        message: `Duplicate identifier: ${value}`,
      });
    }
    seen.add(value);
  }
}

export const providerIdSchema = z.enum([
  'igdb',
  'wikidata',
  'mobygames',
  'rawg',
  'steam',
  'libretro',
  'pcgamingwiki',
  'wikipedia',
  'official-store',
  'manual',
]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const sourceRefSchema = z.object({
  provider: providerIdSchema,
  id: identifierSchema,
  url: httpUrlSchema.optional(),
  retrievedAt: z.iso.datetime().optional(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const platformKindSchema = z.enum([
  'desktop',
  'console',
  'handheld',
  'mobile',
  'arcade',
  'other',
]);
export type PlatformKind = z.infer<typeof platformKindSchema>;

export const platformSchema = z.object({
  id: identifierSchema,
  name: shortTextSchema,
  family: shortTextSchema,
  kind: platformKindSchema,
  generation: z.number().int().positive().optional(),
  sourceRefs: z.array(sourceRefSchema).max(128).default([]),
});
export type Platform = z.infer<typeof platformSchema>;

export const mediaKindSchema = z.enum([
  'cover-front',
  'cover-back',
  'screenshot',
  'title-screen',
  'logo',
  'banner',
]);
export type MediaKind = z.infer<typeof mediaKindSchema>;

export const mediaAssetSchema = z
  .object({
    id: identifierSchema,
    gameId: identifierSchema,
    releaseId: identifierSchema.optional(),
    kind: mediaKindSchema,
    url: httpUrlSchema,
    thumbnailUrl: httpUrlSchema.optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    locale: z.string().min(2).max(64).optional(),
    region: z.string().min(2).max(128).optional(),
    platformId: identifierSchema.optional(),
    verified: z.boolean().default(false),
    source: sourceRefSchema,
    attribution: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  })
  .superRefine((asset, context) => {
    if (asset.kind === 'cover-front' && !asset.releaseId && !asset.platformId) {
      context.addIssue({
        code: 'custom',
        path: ['releaseId'],
        message: 'Platform-specific cover art must reference a release or platform.',
      });
    }
  });
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

export const ratingKindSchema = z.enum(['player', 'editorial', 'personal']);
export type RatingKind = z.infer<typeof ratingKindSchema>;

export const ratingSchema = z.object({
  id: identifierSchema,
  gameId: identifierSchema,
  releaseId: identifierSchema.optional(),
  kind: ratingKindSchema,
  score: z.number().min(0).max(100),
  votes: z.number().int().nonnegative().optional(),
  label: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  platformScope: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  source: sourceRefSchema,
});
export type Rating = z.infer<typeof ratingSchema>;

export const releaseFormatSchema = z.enum([
  'physical',
  'digital',
  'cartridge',
  'disc',
  'download',
  'streaming',
  'unknown',
]);
export type ReleaseFormat = z.infer<typeof releaseFormatSchema>;

export const releaseSchema = z.object({
  id: identifierSchema,
  gameId: identifierSchema,
  platform: platformSchema,
  title: shortTextSchema,
  region: z.string().max(128).default('worldwide'),
  locale: z.string().max(64).optional(),
  releaseDate: z.iso.date().optional(),
  year: z.number().int().min(1950).max(2200).optional(),
  edition: z.string().max(MAX_SHORT_TEXT_LENGTH).optional(),
  formats: z.array(releaseFormatSchema).max(16).default(['unknown']),
  media: z.array(mediaAssetSchema).max(512).default([]),
  ratings: z.array(ratingSchema).max(128).default([]),
  sourceRefs: z.array(sourceRefSchema).min(1).max(128),
});
export type Release = z.infer<typeof releaseSchema>;

export const localizedTextSchema = z.object({
  locale: z.string().min(2).max(64),
  text: z.string().min(1).max(MAX_LONG_TEXT_LENGTH),
  source: sourceRefSchema,
  official: z.boolean().default(false),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export const gameSchema = z.object({
  id: identifierSchema,
  title: shortTextSchema,
  aliases: z.array(shortTextSchema).max(256).default([]),
  descriptions: z.array(localizedTextSchema).max(64).default([]),
  genres: z.array(shortTextSchema).max(128).default([]),
  developers: z.array(shortTextSchema).max(128).default([]),
  publishers: z.array(shortTextSchema).max(128).default([]),
  franchises: z.array(shortTextSchema).max(128).default([]),
  releaseIds: z.array(identifierSchema).max(2048).default([]),
  sourceRefs: z.array(sourceRefSchema).min(1).max(128),
});
export type Game = z.infer<typeof gameSchema>;

export const collectionStatusSchema = z.enum([
  'owned',
  'wishlist',
  'backlog',
  'playing',
  'completed',
  'mastered',
  'paused',
  'dropped',
]);
export type CollectionStatus = z.infer<typeof collectionStatusSchema>;

export const ownershipSchema = z.enum(['physical', 'digital', 'subscription', 'borrowed', 'none']);
export type Ownership = z.infer<typeof ownershipSchema>;

export const copyConditionSchema = z.enum([
  'mint',
  'excellent',
  'good',
  'fair',
  'poor',
  'damaged',
  'unknown',
]);
export type CopyCondition = z.infer<typeof copyConditionSchema>;

export const copyCompletenessSchema = z.enum([
  'sealed',
  'complete',
  'missing-manual',
  'missing-inserts',
  'box-only',
  'media-only',
  'loose',
  'unknown',
]);
export type CopyCompleteness = z.infer<typeof copyCompletenessSchema>;

export const collectionEntrySchema = z.object({
  id: identifierSchema,
  releaseId: identifierSchema,
  listIds: z.array(identifierSchema).max(10_000).default([]),
  status: collectionStatusSchema.default('backlog'),
  ownership: ownershipSchema.default('none'),
  format: releaseFormatSchema.default('unknown'),
  boxCondition: copyConditionSchema.default('unknown'),
  mediaCondition: copyConditionSchema.default('unknown'),
  completeness: copyCompletenessSchema.default('unknown'),
  priority: z.number().int().min(1).max(5).default(3),
  personalRating: z.number().min(0).max(100).nullable().default(null),
  notes: z.string().max(MAX_LONG_TEXT_LENGTH).default(''),
  tags: z.array(z.string().min(1).max(256)).max(256).default([]),
  quantity: z.number().int().positive().max(1_000_000).default(1),
  acquiredAt: z.iso.date().nullable().default(null),
  purchasePrice: z.number().nonnegative().max(1_000_000_000_000).nullable().default(null),
  currency: z.string().length(3).nullable().default(null),
  customCoverUrl: httpUrlSchema.nullable().default(null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CollectionEntry = z.infer<typeof collectionEntrySchema>;

export const collectionViewSchema = z.enum(['list', 'rows', 'cartridges']);
export type CollectionView = z.infer<typeof collectionViewSchema>;

export const collectionGroupingSchema = z.enum(['none', 'platform']);
export type CollectionGrouping = z.infer<typeof collectionGroupingSchema>;

export const userListSchema = z.object({
  id: identifierSchema,
  name: shortTextSchema,
  preset: z.enum(['collection', 'wishlist', 'backlog', 'custom']).default('custom'),
  entryIds: z.array(identifierSchema).max(MAX_COLLECTION_ITEMS).default([]),
  preferredView: collectionViewSchema.default('rows'),
  groupBy: collectionGroupingSchema.default('none'),
  sort: z.enum(['manual', 'title', 'year', 'platform', 'rating', 'recent']).default('manual'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type UserList = z.infer<typeof userListSchema>;

export const releaseSnapshotSchema = z
  .object({
    game: gameSchema,
    release: releaseSchema,
  })
  .superRefine((snapshot, context) => {
    if (snapshot.release.gameId !== snapshot.game.id) {
      context.addIssue({
        code: 'custom',
        path: ['release', 'gameId'],
        message: 'Snapshot release must reference the enclosed game.',
      });
    }
  });
export type ReleaseSnapshot = z.infer<typeof releaseSnapshotSchema>;

export const collectionExportSchema = z
  .object({
    format: z.literal('save-slot-collection'),
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    lists: z.array(userListSchema).max(10_000),
    entries: z.array(collectionEntrySchema).max(MAX_COLLECTION_ITEMS),
    snapshots: z.array(releaseSnapshotSchema).max(MAX_COLLECTION_ITEMS),
  })
  .superRefine((data, context) => {
    const listIds = data.lists.map((list) => list.id);
    const entryIds = data.entries.map((entry) => entry.id);
    const releaseIds = data.snapshots.map((snapshot) => snapshot.release.id);
    addDuplicateIssues(listIds, ['lists'], context);
    addDuplicateIssues(entryIds, ['entries'], context);
    addDuplicateIssues(releaseIds, ['snapshots'], context);

    const validListIds = new Set(listIds);
    const validEntryIds = new Set(entryIds);
    const validReleaseIds = new Set(releaseIds);

    for (const [entryIndex, entry] of data.entries.entries()) {
      if (!validReleaseIds.has(entry.releaseId)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', entryIndex, 'releaseId'],
          message: `Collection entry references a missing release: ${entry.releaseId}`,
        });
      }
      for (const [listIndex, listId] of entry.listIds.entries()) {
        if (!validListIds.has(listId)) {
          context.addIssue({
            code: 'custom',
            path: ['entries', entryIndex, 'listIds', listIndex],
            message: `Collection entry references a missing list: ${listId}`,
          });
        }
      }
    }

    for (const [listIndex, list] of data.lists.entries()) {
      for (const [entryIndex, entryId] of list.entryIds.entries()) {
        if (!validEntryIds.has(entryId)) {
          context.addIssue({
            code: 'custom',
            path: ['lists', listIndex, 'entryIds', entryIndex],
            message: `List references a missing collection entry: ${entryId}`,
          });
        }
      }
    }
  });
export type CollectionExport = z.infer<typeof collectionExportSchema>;

export const searchResultSchema = z.object({
  game: gameSchema,
  releases: z.array(releaseSchema).max(2048),
  relevance: z.number().min(0).max(1),
  providers: z.array(providerIdSchema).max(32),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export function canonicalId(namespace: string, value: string): string {
  return `${namespace}:${value.trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-')}`.replace(
    /-+$/,
    '',
  );
}

export function makeLocalId(prefix: string): string {
  return `${prefix}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

export function getDescription(game: Game, locale: string): LocalizedText | undefined {
  return (
    game.descriptions.find((description) => description.locale === locale && description.official) ??
    game.descriptions.find((description) => description.locale === locale) ??
    game.descriptions.find((description) => description.official) ??
    game.descriptions[0]
  );
}

export function getPrimaryCover(release: Release): MediaAsset | undefined {
  return (
    release.media.find((asset) => asset.kind === 'cover-front' && asset.verified) ??
    release.media.find((asset) => asset.kind === 'cover-front')
  );
}

export function getPlayerRating(release: Release): Rating | undefined {
  return release.ratings
    .filter((rating) => rating.kind === 'player')
    .sort((left, right) => (right.votes ?? 0) - (left.votes ?? 0))[0];
}

export function createCollectionEntry(releaseId: string): CollectionEntry {
  const now = new Date().toISOString();
  return collectionEntrySchema.parse({
    id: makeLocalId('entry'),
    releaseId,
    createdAt: now,
    updatedAt: now,
  });
}
