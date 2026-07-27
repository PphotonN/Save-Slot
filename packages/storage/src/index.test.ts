import { describe, expect, it } from 'vitest';
import { createCollectionEntry } from '@save-slot/domain';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import {
  MemoryCollectionRepository,
  createDefaultList,
} from './index';

describe('collection repository', () => {
  it('preserves release identity, notes and personal rating through export', async () => {
    const repository = new MemoryCollectionRepository();
    const result = fixtureSearchResults[0]!;
    const release = result.releases[0]!;
    const entry = {
      ...createCollectionEntry(release.id),
      notes: 'Physical copy with manual',
      personalRating: 92,
      ownership: 'physical' as const,
      format: 'disc' as const,
    };
    const list = createDefaultList();
    list.entryIds = [entry.id];

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

  it('removes deleted entries from lists', async () => {
    const repository = new MemoryCollectionRepository();
    const entry = createCollectionEntry(fixtureSearchResults[0]!.releases[0]!.id);
    const list = createDefaultList();
    list.entryIds = [entry.id];
    await repository.putList(list);
    await repository.putEntry(entry);
    await repository.deleteEntry(entry.id);
    expect(await repository.listEntries()).toEqual([]);
    expect((await repository.listLists())[0]?.entryIds).toEqual([]);
  });
});
