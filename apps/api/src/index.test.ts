import { beforeEach, describe, expect, it } from 'vitest';
import { releaseSnapshotSchema, searchResultSchema } from '@save-slot/domain';
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

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
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
    const gameResult = searchResultSchema.parse(await gameResponse.json());
    expect(gameResult.game.id).toBe(result.game.id);

    const releaseResponse = await worker.fetch(
      new Request(`http://localhost/v1/releases/${encodeURIComponent(release.id)}`),
      {},
      context,
    );
    expect(releaseResponse.status).toBe(200);
    const snapshot = releaseSnapshotSchema.parse(await releaseResponse.json());
    expect(snapshot.game.id).toBe(result.game.id);
    expect(snapshot.release.id).toBe(release.id);

    const cacheResponse = await worker.fetch(
      new Request('http://localhost/v1/cache'),
      {},
      context,
    );
    expect(cacheResponse.status).toBe(200);
    const cacheStatus = requireRecord(await cacheResponse.json(), 'Cache status');
    const stats = requireRecord(cacheStatus.stats, 'Cache statistics');
    expect(Number(stats.writes)).toBeGreaterThan(0);
    expect(stats.cacheApiEnabled).toBe(false);
    expect(cacheStatus.backends).toEqual(['memory']);
  });

  it('clears catalogue cache entries through the settings endpoint', async () => {
    const context = new TestContext();
    const result = fixtureSearchResults[0]!;

    await worker.fetch(
      new Request(`http://localhost/v1/games/${encodeURIComponent(result.game.id)}`),
      {},
      context,
    );

    const response = await worker.fetch(
      new Request('http://localhost/v1/cache', { method: 'DELETE' }),
      {},
      context,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const payload = requireRecord(await response.json(), 'Cache clear response');
    expect(payload.cleared).toBe(true);
    expect(Number(payload.memoryEntries)).toBeGreaterThan(0);
    expect(payload.cacheApiEntries).toBe(0);
    expect(payload.errors).toBe(0);
    const stats = requireRecord(payload.stats, 'Cache statistics');
    expect(stats.memoryEntries).toBe(0);
    expect(stats.cacheApiEnabled).toBe(false);
  });

  it('allows public read access from Capacitor and browser origins when configured with wildcard CORS', async () => {
    const context = new TestContext();
    for (const origin of ['https://localhost', 'capacitor://localhost', 'https://example.com']) {
      const response = await worker.fetch(
        new Request('https://api.example.test/health', {
          headers: { Origin: origin },
        }),
        { ALLOWED_ORIGIN: '*' },
        context,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Vary')).toBe('Origin');
    }
  });

  it('returns matching CORS headers for cache-clear preflight requests', async () => {
    const response = await worker.fetch(
      new Request('https://api.example.test/v1/cache', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://localhost',
          'Access-Control-Request-Method': 'DELETE',
        },
      }),
      { ALLOWED_ORIGIN: '*' },
      new TestContext(),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('DELETE');
  });
});
