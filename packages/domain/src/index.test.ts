import { describe, expect, it } from 'vitest';
import { fixtureSearchResults } from './fixtures';
import {
  collectionExportSchema,
  createCollectionEntry,
  getPrimaryCover,
  searchResultSchema,
  userListSchema,
} from './index';

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
    const result = fixtureSearchResults[0]!;
    const entry = createCollectionEntry(result.releases[0]!.id);
    const now = new Date().toISOString();
    const list = userListSchema.parse({
      id: 'list:test',
      name: 'Test',
      entryIds: [entry.id],
      createdAt: now,
      updatedAt: now,
    });
    const payload = collectionExportSchema.parse({
      format: 'save-slot-collection',
      version: 1,
      exportedAt: now,
      lists: [list],
      entries: [entry],
      snapshots: [{ game: result.game, release: result.releases[0] }],
    });
    expect(collectionExportSchema.parse(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });
});
