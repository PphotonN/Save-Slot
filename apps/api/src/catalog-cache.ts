export interface CatalogCacheBinding {
  get(key: string, type: 'json'): Promise<unknown | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete?(key: string): Promise<void>;
}

export interface CatalogCacheEnvironment {
  CATALOG_CACHE?: CatalogCacheBinding;
}

export interface CacheExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface MemoryRecord {
  expiresAt: number;
  value: unknown;
}

export interface CatalogCacheStats {
  memoryEntries: number;
  hits: number;
  misses: number;
  writes: number;
  kvEnabled: boolean;
  cacheApiEnabled: boolean;
}

const memory = new Map<string, MemoryRecord>();
let hits = 0;
let misses = 0;
let writes = 0;

function cacheStorage(): Cache | undefined {
  const storage = (globalThis as unknown as { caches?: CacheStorage & { default?: Cache } }).caches;
  return storage?.default;
}

function cacheRequest(key: string): Request {
  return new Request(`https://save-slot-cache.invalid/${encodeURIComponent(key)}`);
}

function validMemoryRecord(record: MemoryRecord | undefined): record is MemoryRecord {
  if (!record) return false;
  if (record.expiresAt > Date.now()) return true;
  return false;
}

function schedule(context: CacheExecutionContext | undefined, task: Promise<unknown>): void {
  if (context) {
    context.waitUntil(task);
    return;
  }
  void task.catch((error) => console.warn('[Save Slot cache] Background task failed:', error));
}

export class CatalogCache {
  constructor(
    private readonly environment: CatalogCacheEnvironment,
    private readonly context?: CacheExecutionContext,
  ) {}

  backendSummary(): string[] {
    const backends = ['memory'];
    if (cacheStorage()) backends.push('cache-api');
    if (this.environment.CATALOG_CACHE) backends.push('kv');
    return backends;
  }

  stats(): CatalogCacheStats {
    for (const [key, record] of memory) {
      if (!validMemoryRecord(record)) memory.delete(key);
    }
    return {
      memoryEntries: memory.size,
      hits,
      misses,
      writes,
      kvEnabled: Boolean(this.environment.CATALOG_CACHE),
      cacheApiEnabled: Boolean(cacheStorage()),
    };
  }

  async get<T>(key: string): Promise<T | undefined> {
    const memoryRecord = memory.get(key);
    if (validMemoryRecord(memoryRecord)) {
      hits += 1;
      return memoryRecord.value as T;
    }
    if (memoryRecord) memory.delete(key);

    const kv = this.environment.CATALOG_CACHE;
    if (kv) {
      try {
        const value = await kv.get(key, 'json');
        if (value != null) {
          hits += 1;
          memory.set(key, { expiresAt: Date.now() + 60_000, value });
          return value as T;
        }
      } catch (error) {
        console.warn('[Save Slot cache] KV read failed:', error);
      }
    }

    const storage = cacheStorage();
    if (storage) {
      try {
        const response = await storage.match(cacheRequest(key));
        if (response?.ok) {
          const value = (await response.json()) as T;
          hits += 1;
          memory.set(key, { expiresAt: Date.now() + 60_000, value });
          return value;
        }
      } catch (error) {
        console.warn('[Save Slot cache] Cache API read failed:', error);
      }
    }

    misses += 1;
    return undefined;
  }

  async put<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const ttl = Math.max(60, Math.round(ttlSeconds));
    memory.set(key, { expiresAt: Date.now() + ttl * 1_000, value });
    writes += 1;

    const tasks: Promise<unknown>[] = [];
    if (this.environment.CATALOG_CACHE) {
      tasks.push(
        this.environment.CATALOG_CACHE.put(key, JSON.stringify(value), {
          expirationTtl: ttl,
        }),
      );
    }

    const storage = cacheStorage();
    if (storage) {
      tasks.push(
        storage.put(
          cacheRequest(key),
          new Response(JSON.stringify(value), {
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': `public, max-age=${ttl}`,
            },
          }),
        ),
      );
    }

    if (tasks.length) {
      schedule(
        this.context,
        Promise.allSettled(tasks).then((results) => {
          for (const result of results) {
            if (result.status === 'rejected') {
              console.warn('[Save Slot cache] Persistent write failed:', result.reason);
            }
          }
        }),
      );
    }
  }

  async delete(key: string): Promise<void> {
    memory.delete(key);
    const tasks: Promise<unknown>[] = [];
    if (this.environment.CATALOG_CACHE?.delete) {
      tasks.push(this.environment.CATALOG_CACHE.delete(key));
    }
    const storage = cacheStorage();
    if (storage) tasks.push(storage.delete(cacheRequest(key)));
    if (tasks.length) schedule(this.context, Promise.allSettled(tasks));
  }
}

export function resetCatalogCacheForTests(): void {
  memory.clear();
  hits = 0;
  misses = 0;
  writes = 0;
}
