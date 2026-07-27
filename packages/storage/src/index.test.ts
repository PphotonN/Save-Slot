import { describe, expect, it } from 'vitest';
import { createCollectionEntry } from '@save-slot/domain';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import {
  MemoryCollectionRepository,
  createDefaultList,
  createUserList,
  normalizeCollectionMembership,
} from './index';

describe('collection repository', () => {
  it('preserves release identity, notes, rating and list membership through export', async () => {
    const repository = new MemoryCollectionRepository();
    const result = fixtureSearchResults[0]!;
    const release = result.releases[0]!;
    const list = createDefaultList();
    const entry = {
      ...createCollectionEntry(release.id),
      listIds: [list.id],
      notes: 'Physical copy with manual',
      personalRating: 92,
      ownership: 'physical' as const,
      format: 'disc' as const,
    };

    await repository.putList(list);
    await repository.putEntry(entry);
    await repository.putSnapshot({ game: result.game, release });

    const exported = await repository.exportData();
    const restored = new MemoryCollectionRepository();
    await restored.importData(JSON.parse(JSON.stringify(exported)));

    expect(await restored.listEntries()).toEqual([entry]);
    expect((await restored.listLists())[0]?.entryIds).toEqual([entry.id]);
    expect((await restored.getSnapshot(release.id))?.release.platform.id).toBe(release.platform.id);
  });

  it('removes deleted entries from every list', async () => {
    const repository = new MemoryCollectionRepository();
    const list = createDefaultList();
    const secondList = createUserList('Favorites');
    const entry = {
      ...createCollectionEntry(fixtureSearchResults[0]!.releases[0]!.id),
      listIds: [list.id, secondList.id],
    };
    await repository.putList(list);
    await repository.putList(secondList);
    await repository.putEntry(entry);
    await repository.deleteEntry(entry.id);

    expect(await repository.listEntries()).toEqual([]);
    expect((await repository.listLists()).every((item) => item.entryIds.length === 0)).toBe(true);
  });

  it('updates both membership directions atomically', async () => {
    const repository = new MemoryCollectionRepository();
    const collection = createDefaultList();
    const favorites = createUserList('Favorites');
    const entry = createCollectionEntry(fixtureSearchResults[0]!.releases[0]!.id);
    await repository.putList(collection);
    await repository.putList(favorites);
    await repository.putEntry(entry);

    await repository.setEntryLists(entry.id, [collection.id, favorites.id]);

    const storedEntry = (await repository.listEntries())[0]!;
    const storedLists = await repository.listLists();
    expect(new Set(storedEntry.listIds)).toEqual(new Set([collection.id, favorites.id]));
    expect(storedLists.every((list) => list.entryIds.includes(entry.id))).toBe(true);
  });

  it('deletes a custom list without deleting its games', async () => {
    const repository = new MemoryCollectionRepository();
    const collection = createDefaultList();
    const custom = createUserList('JRPG');
    const entry = {
      ...createCollectionEntry(fixtureSearchResults[0]!.releases[0]!.id),
      listIds: [collection.id, custom.id],
    };
    await repository.putList(collection);
    await repository.putList(custom);
    await repository.putEntry(entry);

    await repository.deleteList(custom.id);

    expect((await repository.listEntries())[0]?.listIds).toEqual([collection.id]);
    expect((await repository.listLists()).map((list) => list.id)).toEqual([collection.id]);
  });

  it('normalizes legacy one-sided membership without losing entries', () => {
    const collection = createDefaultList();
    const custom = createUserList('Legacy list');
    const first = createCollectionEntry(fixtureSearchResults[0]!.releases[0]!.id);
    const second = createCollectionEntry(fixtureSearchResults[1]!.releases[0]!.id);
    collection.entryIds = [first.id];
    second.listIds = [custom.id];

    const normalized = normalizeCollectionMembership([first, second], [collection, custom]);
    expect(normalized.entries.find((entry) => entry.id === first.id)?.listIds).toContain(collection.id);
    expect(normalized.lists.find((list) => list.id === custom.id)?.entryIds).toContain(second.id);
  });
});
