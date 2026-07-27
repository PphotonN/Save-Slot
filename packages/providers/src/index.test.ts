import { describe, expect, it } from 'vitest';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { FixtureProvider, filterSearchResults, sortSearchResults } from './index';

describe('provider search behavior', () => {
  it('finds games by title without requiring a sort change', async () => {
    const provider = new FixtureProvider();
    const page = await provider.search({ query: 'Metroid', limit: 20 });
    expect(page.items.map((item) => item.game.title)).toContain('Metroid Prime');
  });

  it('keeps the same visible games for every sort mode', () => {
    const visible = filterSearchResults(fixtureSearchResults, { query: '', platformId: undefined });
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
});
