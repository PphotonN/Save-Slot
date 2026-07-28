import { describe, expect, it } from 'vitest';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { assessIdentity, reconcileSearchResults } from './reconcile';

function cloneFixture() {
  return structuredClone(fixtureSearchResults[0]!);
}

describe('automatic provider reconciliation', () => {
  it('merges records with a shared external identity and keeps the stronger canonical source', () => {
    const local = cloneFixture();
    local.game.id = 'game:local-copy';
    local.providers = ['manual'];
    local.game.sourceRefs = [{ provider: 'steam', id: '4242', url: 'https://store.steampowered.com/app/4242/' }];
    local.releases = local.releases.map((release) => ({
      ...release,
      id: `${release.id}:local`,
      gameId: local.game.id,
      sourceRefs: [{ provider: 'steam', id: '4242', url: 'https://store.steampowered.com/app/4242/' }],
    }));

    const wikidata = cloneFixture();
    wikidata.game.id = 'game:wikidata:q4242';
    wikidata.providers = ['wikidata'];
    wikidata.game.sourceRefs = [
      { provider: 'wikidata', id: 'Q4242', url: 'https://www.wikidata.org/wiki/Q4242' },
      { provider: 'steam', id: '4242', url: 'https://store.steampowered.com/app/4242/' },
    ];
    wikidata.releases = wikidata.releases.map((release) => ({
      ...release,
      id: `${release.id}:wikidata`,
      gameId: wikidata.game.id,
      sourceRefs: wikidata.game.sourceRefs,
    }));

    expect(assessIdentity(local, wikidata)).toMatchObject({
      confidence: 1,
      reason: 'shared-external-id',
    });
    const merged = reconcileSearchResults([local, wikidata]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.game.id).toBe(wikidata.game.id);
    expect(merged[0]?.providers).toEqual(expect.arrayContaining(['manual', 'wikidata']));
    expect(merged[0]?.game.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'wikidata', id: 'Q4242' }),
        expect.objectContaining({ provider: 'steam', id: '4242' }),
      ]),
    );
  });

  it('merges exact title, year and platform matches without manual intervention', () => {
    const first = cloneFixture();
    first.game.id = 'game:source-a';
    first.providers = ['wikidata'];
    first.game.sourceRefs = [{ provider: 'wikidata', id: 'QA', url: 'https://www.wikidata.org/wiki/QA' }];
    first.releases = first.releases.map((release) => ({
      ...release,
      id: `${release.id}:a`,
      gameId: first.game.id,
      sourceRefs: first.game.sourceRefs,
    }));

    const second = cloneFixture();
    second.game.id = 'game:source-b';
    second.providers = ['wikipedia'];
    second.game.sourceRefs = [{ provider: 'wikipedia', id: 'Example_Game', url: 'https://en.wikipedia.org/wiki/Example_Game' }];
    second.releases = second.releases.map((release) => ({
      ...release,
      id: `${release.id}:b`,
      gameId: second.game.id,
      sourceRefs: second.game.sourceRefs,
    }));

    const assessment = assessIdentity(first, second);
    expect(assessment.confidence).toBeGreaterThanOrEqual(0.95);
    expect(reconcileSearchResults([first, second])).toHaveLength(1);
  });

  it('does not merge same-title games when year and platform evidence conflict', () => {
    const original = cloneFixture();
    original.game.id = 'game:original';
    original.providers = ['wikidata'];
    original.releases = original.releases.map((release) => ({
      ...release,
      gameId: original.game.id,
      year: 1994,
      releaseDate: '1994-01-01',
      platform: {
        ...release.platform,
        id: 'platform:old-console',
        name: 'Old Console',
      },
    }));

    const remake = cloneFixture();
    remake.game.id = 'game:remake';
    remake.providers = ['wikipedia'];
    remake.releases = remake.releases.map((release) => ({
      ...release,
      gameId: remake.game.id,
      year: 2026,
      releaseDate: '2026-01-01',
      platform: {
        ...release.platform,
        id: 'platform:new-console',
        name: 'New Console',
      },
    }));

    expect(assessIdentity(original, remake).reason).toBe('insufficient');
    expect(reconcileSearchResults([original, remake])).toHaveLength(2);
  });
});
