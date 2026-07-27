import { beforeEach, describe, expect, it } from 'vitest';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import worker from './index';
import { resetCatalogCacheForTests, type CacheExecutionContext } from './catalog-cache';

class TestContext implements CacheExecutionContext {
  readonly tasks: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>): void {
    this.tasks.push(promise);
  }

  async flush(): Promise<void> {
    await Promise.all(this.tasks.splice(0));
  }
}

beforeEach(() => resetCatalogCacheForTests());

describe('Save Slot API detail cache', () => {
  it('serves fixture game and release details through the shared cache layer', async () => {
    const context = new TestContext();
    const result = fixtureSearchResults[0]!;
    const release = result.releases[0]!;

    const gameResponse = await worker.fetch(
      new Request(`http://localhost/v1/games/${encodeURIComponent(result.game.id)}`),
      {},
      context,
    );
    expect(gameResponse.status).toBe(200);
    expect((await gameResponse.json()).game.id).toBe(result.game.id);

    const releaseResponse = await worker.fetch(
      new Request(`http://localhost/v1/releases/${encodeURIComponent(release.id)}`),
      {},
      context,
    );
    expect(releaseResponse.status).toBe(200);
    const snapshot = await releaseResponse.json();
    expect(snapshot.game.id).toBe(result.game.id);
    expect(snapshot.release.id).toBe(release.id);

    const cacheResponse = await worker.fetch(
      new Request('http://localhost/v1/cache'),
      {},
      context,
    );
    expect(cacheResponse.status).toBe(200);
    const cacheStatus = await cacheResponse.json();
    expect(cacheStatus.stats.writes).toBeGreaterThan(0);
    expect(cacheStatus.backends).toContain('memory');
  });
});
