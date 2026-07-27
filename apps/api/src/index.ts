import {
  releaseSnapshotSchema,
  searchResultSchema,
  type SearchResult,
} from '@save-slot/domain';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { normalizePlatformIdentity } from '@save-slot/domain/platforms';
import {
  FixtureProvider,
  searchWithFallback,
  sortSearchResults,
  type SearchPage,
  type SearchSort,
} from '@save-slot/providers';
import {
  LibretroMediaProvider,
  SteamMediaProvider,
  mergeEnrichment,
  type ReleaseEnricher,
} from '@save-slot/providers/media';
import { WikidataProvider } from '@save-slot/providers/wikidata';
import {
  CatalogCache,
  type CacheExecutionContext,
  type CatalogCacheEnvironment,
} from './catalog-cache';

interface Env extends CatalogCacheEnvironment {
  ALLOWED_ORIGIN?: string;
}

type CacheStatus = 'hit' | 'miss' | 'bypass';

const fixtureProvider = new FixtureProvider();
const wikidataProvider = new WikidataProvider();
const libretroProvider = new LibretroMediaProvider({ timeoutMs: 3_000, maxCandidates: 12 });
const steamProvider = new SteamMediaProvider({ timeoutMs: 7_000 });
const validSorts = new Set<SearchSort>(['relevance', 'title', 'year', 'rating', 'votes']);
const SEARCH_CACHE_TTL_SECONDS = 6 * 60 * 60;
const DETAIL_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const CACHE_SCHEMA_VERSION = 'v2';
const discoverySeeds = [
  'Metroid',
  'Metal Gear',
  'The Legend of Zelda',
  'Castlevania',
  'Resident Evil',
  'Final Fantasy',
  'Persona',
  'Sonic the Hedgehog',
  'Mario',
  'Half-Life',
  'Doom',
  'Dragon Quest',
  'Armored Core',
  'Advance Wars',
  'Shin Megami Tensei',
  'Silent Hill',
  'Mega Man',
  'Gran Turismo',
  'Halo',
  'Yakuza',
];

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin');
  const allowed = env.ALLOWED_ORIGIN ?? 'http://localhost:5173';
  return {
    'Access-Control-Allow-Origin': origin === allowed ? origin : allowed,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request: Request, env: Env, value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=60, stale-while-revalidate=300' : 'no-store',
      ...corsHeaders(request, env),
    },
  });
}

function integerParam(value: string | null, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
    const target = random % (index + 1);
    [result[index], result[target]] = [result[target] as T, result[index] as T];
  }
  return result;
}

function normalizedCachePart(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

function searchCacheKey(
  query: string,
  locale: string,
  platformId: string | undefined,
  limit: number,
): string {
  return [
    'catalog',
    CACHE_SCHEMA_VERSION,
    'search',
    normalizedCachePart(locale),
    platformId ? normalizedCachePart(platformId) : 'all',
    String(limit),
    normalizedCachePart(query),
  ].join(':');
}

function gameCacheKey(gameId: string): string {
  return `catalog:${CACHE_SCHEMA_VERSION}:game:${gameId}`;
}

function releaseCacheKey(releaseId: string): string {
  return `catalog:${CACHE_SCHEMA_VERSION}:release:${releaseId}`;
}

function normalizeResultPlatforms(result: SearchResult): SearchResult {
  const releases = result.releases.map((release) => {
    const identity = normalizePlatformIdentity(release.platform.name);
    return {
      ...release,
      platform: {
        ...release.platform,
        id: identity.id,
        family: identity.family,
        kind: identity.kind,
      },
      media: release.media.map((asset) => ({
        ...asset,
        ...(asset.platformId ? { platformId: identity.id } : {}),
      })),
    };
  });
  return {
    ...result,
    game: {
      ...result.game,
      releaseIds: releases.map((release) => release.id),
    },
    releases,
  };
}

function normalizePage(page: SearchPage): SearchPage {
  return {
    ...page,
    items: page.items.map(normalizeResultPlatforms),
  };
}

function filterPageByPlatform(page: SearchPage, platformId?: string): SearchPage {
  if (!platformId) return page;
  const items = page.items
    .map((result) => {
      const releases = result.releases.filter((release) => release.platform.id === platformId);
      return {
        ...result,
        game: { ...result.game, releaseIds: releases.map((release) => release.id) },
        releases,
      };
    })
    .filter((result) => result.releases.length > 0);
  return { ...page, items };
}

function mergePages(pages: SearchPage[]): SearchPage {
  const items = new Map<string, SearchPage['items'][number]>();
  for (const page of pages.map(normalizePage)) {
    for (const item of page.items) {
      const existing = items.get(item.game.id);
      if (!existing) {
        items.set(item.game.id, item);
        continue;
      }
      const releases = new Map(
        [...existing.releases, ...item.releases].map((release) => [release.id, release]),
      );
      items.set(item.game.id, {
        ...existing,
        game: { ...existing.game, releaseIds: [...releases.keys()] },
        releases: [...releases.values()],
        relevance: Math.max(existing.relevance, item.relevance),
        providers: [...new Set([...existing.providers, ...item.providers])],
      });
    }
  }
  return {
    items: [...items.values()],
    providers: pages.flatMap((page) => page.providers),
  };
}

function enrichersFor(result: SearchResult, releaseIndex: number): ReleaseEnricher[] {
  const release = result.releases[releaseIndex];
  if (!release) return [];
  return release.platform.kind === 'desktop' ? [steamProvider] : [libretroProvider];
}

async function enrichPage(
  page: SearchPage,
  locale: string,
  signal: AbortSignal,
  maximumResults = 12,
): Promise<SearchPage> {
  const items = [...page.items];
  const queue = items.slice(0, maximumResults).map((result, index) => ({ result, index }));
  let libretroAttempts = 0;
  let steamAttempts = 0;
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      signal.throwIfAborted();
      const job = queue.shift();
      if (!job) return;
      let game = job.result.game;
      const releases = [];
      for (const [releaseIndex, release] of job.result.releases.entries()) {
        const enrichers = enrichersFor(job.result, releaseIndex);
        if (enrichers.some((provider) => provider.id === 'libretro')) libretroAttempts += 1;
        if (enrichers.some((provider) => provider.id === 'steam')) steamAttempts += 1;
        const settled = await Promise.allSettled(
          enrichers.map((provider) => provider.enrich(game, release, locale, signal)),
        );
        const enrichments = settled.flatMap((result) =>
          result.status === 'fulfilled' ? [result.value] : [],
        );
        const merged = mergeEnrichment(game, release, enrichments);
        game = merged.game;
        releases.push(merged.release);
      }
      items[job.index] = { ...job.result, game, releases };
    }
  });
  await Promise.all(workers);
  const providers = [...page.providers];
  if (libretroAttempts) {
    providers.push({
      id: 'libretro',
      available: true,
      message: `${libretroAttempts} release box-art checks completed.`,
    });
  }
  if (steamAttempts) {
    providers.push({
      id: 'steam',
      available: true,
      message: `${steamAttempts} PC release enrichment checks completed.`,
    });
  }
  return { ...page, items, providers };
}

async function rememberPage(cache: CatalogCache, page: SearchPage): Promise<void> {
  await Promise.all(
    page.items.flatMap((result) => [
      cache.put(gameCacheKey(result.game.id), result, DETAIL_CACHE_TTL_SECONDS),
      ...result.releases.map((release) =>
        cache.put(
          releaseCacheKey(release.id),
          { game: result.game, release },
          DETAIL_CACHE_TTL_SECONDS,
        ),
      ),
    ]),
  );
}

async function cachedGame(cache: CatalogCache, gameId: string): Promise<SearchResult | undefined> {
  const cached = await cache.get<unknown>(gameCacheKey(gameId));
  const parsed = searchResultSchema.safeParse(cached);
  if (parsed.success) return parsed.data;
  if (cached !== undefined) await cache.delete(gameCacheKey(gameId));
  return undefined;
}

async function cachedRelease(
  cache: CatalogCache,
  releaseId: string,
): Promise<ReturnType<typeof releaseSnapshotSchema.parse> | undefined> {
  const cached = await cache.get<unknown>(releaseCacheKey(releaseId));
  const parsed = releaseSnapshotSchema.safeParse(cached);
  if (parsed.success) return parsed.data;
  if (cached !== undefined) await cache.delete(releaseCacheKey(releaseId));
  return undefined;
}

async function searchCatalogue(
  cache: CatalogCache,
  query: string,
  locale: string,
  platformId: string | undefined,
  limit: number,
  signal: AbortSignal,
): Promise<{ page: SearchPage; cacheStatus: CacheStatus }> {
  const key = searchCacheKey(query, locale, platformId, limit);
  const cached = await cache.get<SearchPage>(key);
  if (cached) {
    await rememberPage(cache, cached);
    return { page: cached, cacheStatus: 'hit' };
  }

  const providerRequest = { query, locale, limit };
  const online = filterPageByPlatform(
    normalizePage(await searchWithFallback([wikidataProvider], providerRequest, signal)),
    platformId,
  );
  const basePage = online.items.length
    ? online
    : mergePages([
        online,
        filterPageByPlatform(
          normalizePage(await fixtureProvider.search(providerRequest, signal)),
          platformId,
        ),
      ]);
  const page = await enrichPage(basePage, locale, signal);
  await cache.put(key, page, SEARCH_CACHE_TTL_SECONDS);
  await rememberPage(cache, page);
  return { page, cacheStatus: 'miss' };
}

async function discoveryCatalogue(
  cache: CatalogCache,
  locale: string,
  limit: number,
  signal: AbortSignal,
): Promise<SearchPage> {
  const seeds = shuffled(discoverySeeds).slice(0, 3);
  const settled = await Promise.allSettled(
    seeds.map((seed) =>
      wikidataProvider.search({ query: seed, locale, limit: Math.max(8, Math.ceil(limit / 2)) }, signal),
    ),
  );
  const onlinePages = settled.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  const online = mergePages(onlinePages);
  const basePage = online.items.length >= Math.min(limit, 8)
    ? { ...online, items: shuffled(online.items).slice(0, limit) }
    : (() => {
        const fallback = {
          items: fixtureSearchResults,
          providers: [
            {
              id: 'manual' as const,
              available: true,
              message: 'Fixture discovery fallback.',
            },
          ],
        };
        const merged = mergePages([online, fallback]);
        return { ...merged, items: shuffled(merged.items).slice(0, limit) };
      })();
  const page = await enrichPage(basePage, locale, signal);
  await rememberPage(cache, page);
  return page;
}

export default {
  async fetch(request: Request, env: Env, context: CacheExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (request.method !== 'GET') {
      return json(request, env, { error: 'method_not_allowed' }, 405);
    }

    const url = new URL(request.url);
    const cache = new CatalogCache(env, context);

    if (url.pathname === '/health') {
      return json(request, env, {
        service: 'save-slot-api',
        version: '1.0.0-alpha.4',
        status: 'ok',
        time: new Date().toISOString(),
        cache: {
          backends: cache.backendSummary(),
          stats: cache.stats(),
        },
      });
    }

    if (url.pathname === '/v1/cache') {
      return json(request, env, {
        schema: CACHE_SCHEMA_VERSION,
        searchTtlSeconds: SEARCH_CACHE_TTL_SECONDS,
        detailTtlSeconds: DETAIL_CACHE_TTL_SECONDS,
        backends: cache.backendSummary(),
        stats: cache.stats(),
      });
    }

    if (url.pathname === '/v1/providers') {
      const providers = await Promise.all([
        wikidataProvider.health(request.signal),
        fixtureProvider.health(request.signal),
      ]);
      return json(request, env, {
        providers,
        mediaProviders: ['libretro', 'steam'],
        cacheBackends: cache.backendSummary(),
        planned: ['igdb', 'mobygames', 'rawg'],
      });
    }

    if (url.pathname === '/v1/search') {
      const query = url.searchParams.get('q')?.trim() ?? '';
      const locale = url.searchParams.get('locale')?.trim() || 'uk';
      const platformId = url.searchParams.get('platform')?.trim() || undefined;
      const limit = integerParam(url.searchParams.get('limit'), 30, 1, 100);
      const requestedSort = url.searchParams.get('sort') as SearchSort | null;
      const sort = requestedSort && validSorts.has(requestedSort) ? requestedSort : 'relevance';
      if (query) {
        const { page, cacheStatus } = await searchCatalogue(
          cache,
          query,
          locale,
          platformId,
          limit,
          request.signal,
        );
        return json(request, env, {
          ...page,
          items: sortSearchResults(page.items, sort),
          query,
          sort,
          cache: cacheStatus,
        });
      }
      const page = await discoveryCatalogue(cache, locale, limit, request.signal);
      return json(request, env, {
        ...page,
        items: sortSearchResults(page.items, sort),
        query,
        sort,
        cache: 'bypass' satisfies CacheStatus,
      });
    }

    if (url.pathname === '/v1/discovery') {
      const limit = integerParam(url.searchParams.get('limit'), 24, 1, 50);
      const locale = url.searchParams.get('locale')?.trim() || 'uk';
      const page = await discoveryCatalogue(cache, locale, limit, request.signal);
      return json(request, env, {
        ...page,
        session: crypto.randomUUID(),
        cache: 'bypass' satisfies CacheStatus,
      });
    }

    const releaseMatch = url.pathname.match(/^\/v1\/releases\/(.+)$/);
    if (releaseMatch?.[1]) {
      const releaseId = decodeURIComponent(releaseMatch[1]);
      const online = await cachedRelease(cache, releaseId);
      if (online) return json(request, env, online);

      const result = fixtureSearchResults.find((item) =>
        item.releases.some((release) => release.id === releaseId),
      );
      const release = result?.releases.find((item) => item.id === releaseId);
      if (release && result) {
        const snapshot = { game: result.game, release };
        await cache.put(releaseCacheKey(release.id), snapshot, DETAIL_CACHE_TTL_SECONDS);
        await cache.put(gameCacheKey(result.game.id), result, DETAIL_CACHE_TTL_SECONDS);
        return json(request, env, snapshot);
      }
      return json(request, env, { error: 'release_not_found' }, 404);
    }

    const gameMatch = url.pathname.match(/^\/v1\/games\/(.+)$/);
    if (gameMatch?.[1]) {
      const gameId = decodeURIComponent(gameMatch[1]);
      const online = await cachedGame(cache, gameId);
      if (online) return json(request, env, online);

      const result = fixtureSearchResults.find((item) => item.game.id === gameId);
      if (result) {
        await rememberPage(cache, {
          items: [result],
          providers: [{ id: 'manual', available: true, message: 'Fixture detail fallback.' }],
        });
        return json(request, env, result);
      }
      return json(request, env, { error: 'game_not_found' }, 404);
    }

    return json(request, env, { error: 'not_found' }, 404);
  },
};
