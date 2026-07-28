export interface CatalogCacheListResult {
  keys: Array<{ name: string }>;
  list_complete: boolean;
  cursor?: string;
}

export interface CatalogCacheBinding {
  get(key: string, type: 'json'): Promise<unknown | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete?(key: string): Promise<void>;
  list?(options?: { prefix?: string; cursor?: string }): Promise<CatalogCacheListResult>;
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

export interface CatalogCacheClearResult {
  memoryEntries: number;
  cacheApiEntries: number;
  kvEntries: number;
  errors: number;
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

function cacheKeyFromRequest(request: Request): string | undefined {
  const url = new URL(request.url);
  if (url.hostname !== 'save-slot-cache.invalid') return undefined;
  const encoded = url.pathname.slice(1);
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
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

  async clear(prefix = ''): Promise<CatalogCacheClearResult> {
    let memoryEntries = 0;
    let cacheApiEntries = 0;
    let kvEntries = 0;
    let errors = 0;

    for (const key of [...memory.keys()]) {
      if (!prefix || key.startsWith(prefix)) {
        memory.delete(key);
        memoryEntries += 1;
      }
    }

    const storage = cacheStorage();
    if (storage) {
      try {
        const requests = await storage.keys();
        const targets = requests.filter((request) => {
const key = cacheKeyFromRequest(request);
return key != null && (!prefix || key.startsWith(prefix));
        });
        const results = await Promise.allSettled(targets.map((request) => storage.delete(request)));
        cacheApiEntries += results.filter(
(result) => result.status === 'fulfilled' && result.value,
        ).length;
        errors += results.filter((result) => result.status === 'rejected').length;
      } catch (error) {
        errors += 1;
        console.warn('[Save Slot cache] Cache API clear failed:', error);
      }
    }

    const binding = this.environment.CATALOG_CACHE;
    if (binding?.list && binding.delete) {
      try {
        let cursor: string | undefined;
        do {
const page = await binding.list({
  ...(prefix ? { prefix } : {}),
  ...(cursor ? { cursor } : {}),
});
const results = await Promise.allSettled(
  page.keys.map((key) => binding.delete!(key.name)),
);
kvEntries += results.filter((result) => result.status === 'fulfilled').length;
errors += results.filter((result) => result.status === 'rejected').length;
cursor = page.list_complete ? undefined : page.cursor;
if (!page.list_complete && !cursor) {
  errors += 1;
  break;
}
        } while (cursor);
      } catch (error) {
        errors += 1;
        console.warn('[Save Slot cache] KV clear failed:', error);
      }
    }

    hits = 0;
    misses = 0;
    writes = 0;
    return { memoryEntries, cacheApiEntries, kvEntries, errors };
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
