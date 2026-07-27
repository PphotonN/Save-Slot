import { describe, expect, it } from 'vitest';
import { fixtureSearchResults } from './fixtures';
import {
  collectionEntrySchema,
  collectionExportSchema,
  createCollectionEntry,
  getPrimaryCover,
  searchResultSchema,
  userListSchema,
} from './index';

function validPayload() {
  const result = fixtureSearchResults[0]!;
  const release = result.releases[0]!;
  const entry = createCollectionEntry(release.id);
  const now = new Date().toISOString();
  const list = userListSchema.parse({
    id: 'list:test',
    name: 'Test',
    entryIds: [entry.id],
    createdAt: now,
    updatedAt: now,
  });
  return {
    format: 'save-slot-collection' as const,
    version: 1 as const,
    exportedAt: now,
    lists: [list],
    entries: [entry],
    snapshots: [{ game: result.game, release }],
  };
}

describe('canonical domain model', () => {
  it('validates representative cross-platform search results', () => {
    expect(fixtureSearchResults.length).toBeGreaterThan(5);
    for (const result of fixtureSearchResults) {
      expect(() => searchResultSchema.parse(result)).not.toThrow();
      expect(result.releases[0]?.platform.id).toBeTruthy();
      expect(getPrimaryCover(result.releases[0]!)).toBeTruthy();
    }
  });

  it('keeps collection entries attached to a release', () => {
    const release = fixtureSearchResults[0]!.releases[0]!;
    const entry = createCollectionEntry(release.id);
    expect(entry.releaseId).toBe(release.id);
  });

  it('round-trips a versioned collection payload', () => {
    const payload = collectionExportSchema.parse(validPayload());
    expect(collectionExportSchema.parse(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });

  it('rejects executable URL schemes in imported personal covers', () => {
    const entry = createCollectionEntry(fixtureSearchResults[0]!.releases[0]!.id);
    expect(
      collectionEntrySchema.safeParse({
        ...entry,
        customCoverUrl: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate list and entry identifiers', () => {
    const payload = validPayload();
    expect(
      collectionExportSchema.safeParse({
        ...payload,
        lists: [...payload.lists, { ...payload.lists[0] }],
        entries: [...payload.entries, { ...payload.entries[0] }],
      }).success,
    ).toBe(false);
  });

  it('rejects collection entries that reference missing releases', () => {
    const payload = validPayload();
    expect(
      collectionExportSchema.safeParse({
        ...payload,
        entries: [{ ...payload.entries[0], releaseId: 'release:missing' }],
      }).success,
    ).toBe(false);
  });

  it('rejects lists that reference missing collection entries', () => {
    const payload = validPayload();
    expect(
      collectionExportSchema.safeParse({
        ...payload,
        lists: [{ ...payload.lists[0], entryIds: ['entry:missing'] }],
      }).success,
    ).toBe(false);
  });

  it('rejects snapshots whose release belongs to another game', () => {
    const payload = validPayload();
    expect(
      collectionExportSchema.safeParse({
        ...payload,
        snapshots: [
          {
            ...payload.snapshots[0],
            release: { ...payload.snapshots[0].release, gameId: 'game:other' },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
