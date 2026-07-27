import { describe, expect, it } from 'vitest';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import {
  FixtureProvider,
  filterSearchResults,
  searchWithFallback,
  sortSearchResults,
  type ProviderAdapter,
} from './index';

describe('provider search behavior', () => {
  it('finds games by title without requiring a sort change', async () => {
    const provider = new FixtureProvider();
    const page = await provider.search({ query: 'Metroid', limit: 20 });
    expect(page.items.map((item) => item.game.title)).toContain('Metroid Prime');
  });

  it('keeps the same visible games for every sort mode', () => {
    const visible = filterSearchResults(fixtureSearchResults, { query: '' });
    const baseline = new Set(visible.map((item) => item.game.id));
    for (const sort of ['relevance', 'rating', 'votes', 'year', 'title'] as const) {
      const sorted = sortSearchResults(visible, sort);
      expect(new Set(sorted.map((item) => item.game.id))).toEqual(baseline);
    }
  });

  it('applies platform filtering before sorting', () => {
    const platformId = fixtureSearchResults[0]!.releases[0]!.platform.id;
    const filtered = filterSearchResults(fixtureSearchResults, { query: '', platformId });
    expect(filtered.length).toBeGreaterThan(0);
    expect(
      filtered.every((result) =>
        result.releases.some((release) => release.platform.id === platformId),
      ),
    ).toBe(true);
  });

  it('returns distinct fixture pages with an accurate total', async () => {
    const provider = new FixtureProvider();
    const first = await provider.search({ query: '', limit: 2 });
    expect(first.total).toBe(fixtureSearchResults.length);
    expect(first.nextCursor).toBe('2');

    const second = await provider.search({ query: '', limit: 2, cursor: first.nextCursor });
    expect(second.total).toBe(fixtureSearchResults.length);
    expect(second.items[0]?.game.id).not.toBe(first.items[0]?.game.id);
    expect(
      new Set([...first.items, ...second.items].map((result) => result.game.id)).size,
    ).toBe(first.items.length + second.items.length);
  });

  it('preserves cursor and total from an aggregated provider page', async () => {
    const provider: ProviderAdapter = {
      id: 'manual',
      async search() {
        return {
          items: fixtureSearchResults.slice(0, 1),
          nextCursor: 'next-page',
          total: 7,
          providers: [{ id: 'manual', available: true }],
        };
      },
      async health() {
        return { id: 'manual', available: true };
      },
    };

    const page = await searchWithFallback([provider], { query: 'test' });
    expect(page.nextCursor).toBe('next-page');
    expect(page.total).toBe(7);
  });
});
