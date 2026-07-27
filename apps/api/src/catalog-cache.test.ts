import { beforeEach, describe, expect, it } from 'vitest';
import {
  CatalogCache,
  resetCatalogCacheForTests,
  type CacheExecutionContext,
  type CatalogCacheBinding,
} from './catalog-cache';

class FakeBinding implements CatalogCacheBinding {
  readonly values = new Map<string, string>();

  async get(key: string, type: 'json'): Promise<unknown | null> {
    if (type !== 'json') return null;
    const value = this.values.get(key);
    return value == null ? null : JSON.parse(value);
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

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

describe('CatalogCache', () => {
  it('returns an immediate memory hit after writing', async () => {
    const cache = new CatalogCache({});
    await cache.put('game:test', { title: 'Test Game' }, 300);

    await expect(cache.get<{ title: string }>('game:test')).resolves.toEqual({
      title: 'Test Game',
    });
    expect(cache.stats().hits).toBe(1);
    expect(cache.stats().writes).toBe(1);
  });

  it('restores a cached value through an optional KV-compatible binding', async () => {
    const binding = new FakeBinding();
    const context = new TestContext();
    const writer = new CatalogCache({ CATALOG_CACHE: binding }, context);

    await writer.put('release:test', { releaseId: 'release:test' }, 300);
    await context.flush();
    resetCatalogCacheForTests();

    const reader = new CatalogCache({ CATALOG_CACHE: binding });
    await expect(reader.get<{ releaseId: string }>('release:test')).resolves.toEqual({
      releaseId: 'release:test',
    });
    expect(reader.backendSummary()).toContain('kv');
  });

  it('removes invalidated values from all configured layers', async () => {
    const binding = new FakeBinding();
    const context = new TestContext();
    const cache = new CatalogCache({ CATALOG_CACHE: binding }, context);

    await cache.put('game:delete', { id: 1 }, 300);
    await context.flush();
    await cache.delete('game:delete');
    await context.flush();

    resetCatalogCacheForTests();
    await expect(new CatalogCache({ CATALOG_CACHE: binding }).get('game:delete')).resolves.toBeUndefined();
  });
});
