import { z } from 'zod';

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
  id: z.string().min(1),
  url: z.url().optional(),
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
  id: z.string().min(1),
  name: z.string().min(1),
  family: z.string().min(1),
  kind: platformKindSchema,
  generation: z.number().int().positive().optional(),
  sourceRefs: z.array(sourceRefSchema).default([]),
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
    id: z.string().min(1),
    gameId: z.string().min(1),
    releaseId: z.string().min(1).optional(),
    kind: mediaKindSchema,
    url: z.url(),
    thumbnailUrl: z.url().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    locale: z.string().min(2).optional(),
    region: z.string().min(2).optional(),
    platformId: z.string().min(1).optional(),
    verified: z.boolean().default(false),
    source: sourceRefSchema,
    attribution: z.string().optional(),
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
  id: z.string().min(1),
  gameId: z.string().min(1),
  releaseId: z.string().min(1).optional(),
  kind: ratingKindSchema,
  score: z.number().min(0).max(100),
  votes: z.number().int().nonnegative().optional(),
  label: z.string().optional(),
  platformScope: z.string().optional(),
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
  id: z.string().min(1),
  gameId: z.string().min(1),
  platform: platformSchema,
  title: z.string().min(1),
  region: z.string().default('worldwide'),
  locale: z.string().optional(),
  releaseDate: z.iso.date().optional(),
  year: z.number().int().min(1950).max(2200).optional(),
  edition: z.string().optional(),
  formats: z.array(releaseFormatSchema).default(['unknown']),
  media: z.array(mediaAssetSchema).default([]),
  ratings: z.array(ratingSchema).default([]),
  sourceRefs: z.array(sourceRefSchema).min(1),
});
export type Release = z.infer<typeof releaseSchema>;

export const localizedTextSchema = z.object({
  locale: z.string().min(2),
  text: z.string().min(1),
  source: sourceRefSchema,
  official: z.boolean().default(false),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export const gameSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  descriptions: z.array(localizedTextSchema).default([]),
  genres: z.array(z.string().min(1)).default([]),
  developers: z.array(z.string().min(1)).default([]),
  publishers: z.array(z.string().min(1)).default([]),
  franchises: z.array(z.string().min(1)).default([]),
  releaseIds: z.array(z.string().min(1)).default([]),
  sourceRefs: z.array(sourceRefSchema).min(1),
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
  id: z.string().min(1),
  releaseId: z.string().min(1),
  listIds: z.array(z.string().min(1)).default([]),
  status: collectionStatusSchema.default('backlog'),
  ownership: ownershipSchema.default('none'),
  format: releaseFormatSchema.default('unknown'),
  boxCondition: copyConditionSchema.default('unknown'),
  mediaCondition: copyConditionSchema.default('unknown'),
  completeness: copyCompletenessSchema.default('unknown'),
  priority: z.number().int().min(1).max(5).default(3),
  personalRating: z.number().min(0).max(100).nullable().default(null),
  notes: z.string().default(''),
  tags: z.array(z.string().min(1)).default([]),
  quantity: z.number().int().positive().default(1),
  acquiredAt: z.iso.date().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  customCoverUrl: z.url().nullable().default(null),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CollectionEntry = z.infer<typeof collectionEntrySchema>;

export const collectionViewSchema = z.enum(['list', 'rows', 'cartridges']);
export type CollectionView = z.infer<typeof collectionViewSchema>;

export const collectionGroupingSchema = z.enum(['none', 'platform']);
export type CollectionGrouping = z.infer<typeof collectionGroupingSchema>;

export const userListSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  preset: z.enum(['collection', 'wishlist', 'backlog', 'custom']).default('custom'),
  entryIds: z.array(z.string().min(1)).default([]),
  preferredView: collectionViewSchema.default('rows'),
  groupBy: collectionGroupingSchema.default('none'),
  sort: z.enum(['manual', 'title', 'year', 'platform', 'rating', 'recent']).default('manual'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type UserList = z.infer<typeof userListSchema>;

export const releaseSnapshotSchema = z.object({
  game: gameSchema,
  release: releaseSchema,
});
export type ReleaseSnapshot = z.infer<typeof releaseSnapshotSchema>;

export const collectionExportSchema = z.object({
  format: z.literal('save-slot-collection'),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  lists: z.array(userListSchema),
  entries: z.array(collectionEntrySchema),
  snapshots: z.array(releaseSnapshotSchema),
});
export type CollectionExport = z.infer<typeof collectionExportSchema>;

export const searchResultSchema = z.object({
  game: gameSchema,
  releases: z.array(releaseSchema),
  relevance: z.number().min(0).max(1),
  providers: z.array(providerIdSchema),
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
