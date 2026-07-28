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

function validMemoryRecord(record: MemoryRecord | undefined): record is MemoryRecord {
  return Boolean(record && record.expiresAt > Date.now());
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
      cacheApiEnabled: false,
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

    misses += 1;
    return undefined;
  }

  async put<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const ttl = Math.max(60, Math.round(ttlSeconds));
    memory.set(key, { expiresAt: Date.now() + ttl * 1_000, value });
    writes += 1;

    const kv = this.environment.CATALOG_CACHE;
    if (!kv) return;

    schedule(
      this.context,
      kv
        .put(key, JSON.stringify(value), { expirationTtl: ttl })
        .catch((error) => console.warn('[Save Slot cache] KV write failed:', error)),
    );
  }

  async clear(prefix = ''): Promise<CatalogCacheClearResult> {
    let memoryEntries = 0;
    let kvEntries = 0;
    let errors = 0;

    for (const key of [...memory.keys()]) {
      if (!prefix || key.startsWith(prefix)) {
        memory.delete(key);
        memoryEntries += 1;
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
    } else if (binding) {
      errors += 1;
      console.warn('[Save Slot cache] KV binding does not support prefix clearing.');
    }

    hits = 0;
    misses = 0;
    writes = 0;
    return {
      memoryEntries,
      cacheApiEntries: 0,
      kvEntries,
      errors,
    };
  }

  async delete(key: string): Promise<void> {
    memory.delete(key);
    const task = this.environment.CATALOG_CACHE?.delete?.(key);
    if (task) schedule(this.context, task);
  }
}

export function resetCatalogCacheForTests(): void {
  memory.clear();
  hits = 0;
  misses = 0;
  writes = 0;
}
