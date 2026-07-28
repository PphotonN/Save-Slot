import {
  getDescription,
  releaseSnapshotSchema,
  searchResultSchema,
  type ReleaseSnapshot,
  type SearchResult,
} from '@save-slot/domain';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { normalizePlatformIdentity } from '@save-slot/domain/platforms';
import {
  FixtureProvider,
  filterSearchResults,
  searchWithFallback,
  sortSearchResults,
  type SearchPage,
  type SearchSort,
  type SearchSortDirection,
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

interface SearchSuggestion {
  id: string;
  title: string;
  description?: string;
  platforms: string[];
}

type CacheStatus = 'hit' | 'miss' | 'bypass';

const fixtureProvider = new FixtureProvider();
const wikidataProvider = new WikidataProvider();
const libretroProvider = new LibretroMediaProvider({ timeoutMs: 3_000, maxCandidates: 12 });
const steamProvider = new SteamMediaProvider({ timeoutMs: 7_000 });
const validSorts = new Set<SearchSort>(['relevance', 'title', 'year', 'rating', 'votes']);
const validSortDirections = new Set<SearchSortDirection>(['asc', 'desc']);
const SEARCH_CACHE_TTL_SECONDS = 6 * 60 * 60;
const SUGGESTION_CACHE_TTL_SECONDS = 12 * 60 * 60;
const DETAIL_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const SEARCH_POOL_LIMIT = 40;
const CACHE_SCHEMA_VERSION = 'v3';
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
    'Access-Control-Allow-Methods': 'GET,DELETE,OPTIONS',
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
      'Cache-Control': 'no-store',
      ...corsHeaders(request, env),
    },
  });
}

function integerParam(value: string | null, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function optionalIntegerParam(value: string | null, minimum: number, maximum: number): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : undefined;
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

function searchCacheKey(query: string, locale: string, platformId: string | undefined): string {
  return [
    'catalog',
    CACHE_SCHEMA_VERSION,
    'search',
    normalizedCachePart(locale),
    platformId ? normalizedCachePart(platformId) : 'all',
    normalizedCachePart(query),
  ].join(':');
}

function suggestionCacheKey(query: string, locale: string): string {
  return [
    'catalog',
    CACHE_SCHEMA_VERSION,
    'suggestions',
    normalizedCachePart(locale),
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
  const nextCursor = pages.find((page) => page.nextCursor)?.nextCursor;
  return {
    items: [...items.values()],
    ...(nextCursor ? { nextCursor } : {}),
    providers: pages.flatMap((page) => page.providers),
  };
}

function releaseAlreadyEnriched(result: SearchResult, releaseIndex: number): boolean {
  const release = result.releases[releaseIndex];
  if (!release) return true;
  const verifiedCover = release.media.some(
    (asset) => asset.kind === 'cover-front' && asset.verified,
  );
  if (!verifiedCover) return false;
  if (release.platform.kind !== 'desktop') return true;
  const steamRating = release.ratings.some((rating) => rating.source.provider === 'steam');
  const steamDescription = result.game.descriptions.some(
    (description) => description.source.provider === 'steam',
  );
  return steamRating || steamDescription;
}

function enrichersFor(result: SearchResult, releaseIndex: number): ReleaseEnricher[] {
  const release = result.releases[releaseIndex];
  if (!release || releaseAlreadyEnriched(result, releaseIndex)) return [];
  return release.platform.kind === 'desktop' ? [steamProvider] : [libretroProvider];
}

async function enrichPage(
  page: SearchPage,
  locale: string,
  signal: AbortSignal,
  maximumResults = page.items.length,
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
): Promise<ReleaseSnapshot | undefined> {
  const cached = await cache.get<unknown>(releaseCacheKey(releaseId));
  const parsed = releaseSnapshotSchema.safeParse(cached);
  if (parsed.success) return parsed.data;
  if (cached !== undefined) await cache.delete(releaseCacheKey(releaseId));
  return undefined;
}

async function rememberPage(cache: CatalogCache, page: SearchPage): Promise<void> {
  for (const result of page.items) {
    const previous = await cachedGame(cache, result.game.id);
    const merged = previous
      ? (mergePages([
          { items: [previous], providers: [] },
          { items: [result], providers: [] },
        ]).items[0] ?? result)
      : result;
    await cache.put(gameCacheKey(merged.game.id), merged, DETAIL_CACHE_TTL_SECONDS);
    await Promise.all(
      merged.releases.map((release) =>
        cache.put(
          releaseCacheKey(release.id),
          { game: merged.game, release },
          DETAIL_CACHE_TTL_SECONDS,
        ),
      ),
    );
  }
}

async function hydratePageFromDetails(cache: CatalogCache, page: SearchPage): Promise<SearchPage> {
  const items = await Promise.all(
    page.items.map(async (result) => {
      const cached = await cachedGame(cache, result.game.id);
      if (!cached) return result;
      return mergePages([
        { items: [result], providers: [] },
        { items: [cached], providers: [] },
      ]).items[0] ?? result;
    }),
  );
  return { ...page, items };
}

async function searchCatalogue(
  cache: CatalogCache,
  query: string,
  locale: string,
  platformId: string | undefined,
  signal: AbortSignal,
): Promise<{ page: SearchPage; cacheStatus: CacheStatus }> {
  const key = searchCacheKey(query, locale, platformId);
  const cached = await cache.get<SearchPage>(key);
  if (cached) {
    return { page: await hydratePageFromDetails(cache, cached), cacheStatus: 'hit' };
  }

  const providerRequest = { query, locale, limit: SEARCH_POOL_LIMIT };
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
  await cache.put(key, basePage, SEARCH_CACHE_TTL_SECONDS);
  return { page: await hydratePageFromDetails(cache, basePage), cacheStatus: 'miss' };
}

async function suggestionsCatalogue(
  cache: CatalogCache,
  query: string,
  locale: string,
  limit: number,
  signal: AbortSignal,
): Promise<{ items: SearchSuggestion[]; cacheStatus: CacheStatus }> {
  const key = suggestionCacheKey(query, locale);
  const cached = await cache.get<SearchSuggestion[]>(key);
  if (cached) return { items: cached.slice(0, limit), cacheStatus: 'hit' };

  const request = { query, locale, limit: Math.max(limit, 8) };
  const online = normalizePage(await searchWithFallback([wikidataProvider], request, signal));
  const page = online.items.length
    ? online
    : normalizePage(await fixtureProvider.search(request, signal));
  const items = page.items.slice(0, limit).map((result) => {
    const description = getDescription(result.game, locale)?.text;
    return {
      id: result.game.id,
      title: result.game.title,
      ...(description ? { description } : {}),
      platforms: [...new Set(result.releases.map((release) => release.platform.name))].slice(0, 4),
    };
  });
  await cache.put(key, items, SUGGESTION_CACHE_TTL_SECONDS);
  return { items, cacheStatus: 'miss' };
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
  const hydrated = await hydratePageFromDetails(cache, basePage);
  const page = await enrichPage(hydrated, locale, signal, limit);
  await rememberPage(cache, page);
  return page;
}

export default {
  async fetch(request: Request, env: Env, context: CacheExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    const url = new URL(request.url);
    const cache = new CatalogCache(env, context);

    if (url.pathname === '/v1/cache' && request.method === 'DELETE') {
      const cleared = await cache.clear(`catalog:${CACHE_SCHEMA_VERSION}:`);
      return json(request, env, {
        cleared: true,
        ...cleared,
        backends: cache.backendSummary(),
        stats: cache.stats(),
      });
    }

    if (request.method !== 'GET') {
      return json(request, env, { error: 'method_not_allowed' }, 405);
    }

    if (url.pathname === '/health') {
      return json(request, env, {
        service: 'save-slot-api',
        version: '1.0.0-alpha.5',
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
        suggestionTtlSeconds: SUGGESTION_CACHE_TTL_SECONDS,
        detailTtlSeconds: DETAIL_CACHE_TTL_SECONDS,
        searchPoolLimit: SEARCH_POOL_LIMIT,
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

    if (url.pathname === '/v1/suggestions') {
      const query = url.searchParams.get('q')?.trim() ?? '';
      const locale = url.searchParams.get('locale')?.trim() || 'uk';
      const limit = integerParam(url.searchParams.get('limit'), 6, 1, 10);
      if (query.length < 2) return json(request, env, { items: [], query, cache: 'bypass' });
      const suggestions = await suggestionsCatalogue(cache, query, locale, limit, request.signal);
      return json(request, env, { ...suggestions, query });
    }

    if (url.pathname === '/v1/search') {
      const query = url.searchParams.get('q')?.trim() ?? '';
      const locale = url.searchParams.get('locale')?.trim() || 'uk';
      const platformId = url.searchParams.get('platform')?.trim() || undefined;
      const limit = integerParam(url.searchParams.get('limit'), 18, 1, 24);
      const offset = integerParam(url.searchParams.get('cursor'), 0, 0, SEARCH_POOL_LIMIT);
      const requestedSort = url.searchParams.get('sort') as SearchSort | null;
      const sort = requestedSort && validSorts.has(requestedSort) ? requestedSort : 'relevance';
      const requestedDirection = url.searchParams.get('order') as SearchSortDirection | null;
      const direction = requestedDirection && validSortDirections.has(requestedDirection) ? requestedDirection : 'desc';
      const genre = url.searchParams.get('genre')?.trim() || undefined;
      const yearFrom = optionalIntegerParam(url.searchParams.get('yearFrom'), 1950, 2100);
      const yearTo = optionalIntegerParam(url.searchParams.get('yearTo'), 1950, 2100);
      if (query) {
        const { page, cacheStatus } = await searchCatalogue(
          cache,
          query,
          locale,
          platformId,
          request.signal,
        );
        const filtered = filterSearchResults(page.items, { query: '', genre, yearFrom, yearTo });
        const sorted = sortSearchResults(filtered, sort, direction);
        const rawItems = sorted.slice(offset, offset + limit);
        const enriched = await enrichPage(
          { items: rawItems, providers: page.providers },
          locale,
          request.signal,
          rawItems.length,
        );
        await rememberPage(cache, enriched);
        const nextOffset = offset + rawItems.length;
        const nextCursor = nextOffset < sorted.length ? String(nextOffset) : undefined;
        return json(request, env, {
          ...enriched,
          ...(nextCursor ? { nextCursor } : {}),
          total: sorted.length,
          query,
          sort,
          order: direction,
          filters: { platformId, genre, yearFrom, yearTo },
          cache: cacheStatus,
        });
      }
      const page = await discoveryCatalogue(cache, locale, limit, request.signal);
      const filtered = filterSearchResults(page.items, { query: '', platformId, genre, yearFrom, yearTo });
      return json(request, env, {
        ...page,
        items: sortSearchResults(filtered, sort, direction),
        total: filtered.length,
        query,
        sort,
        order: direction,
        filters: { platformId, genre, yearFrom, yearTo },
        cache: 'bypass' satisfies CacheStatus,
      });
    }

    if (url.pathname === '/v1/discovery') {
      const limit = integerParam(url.searchParams.get('limit'), 24, 1, 50);
      const locale = url.searchParams.get('locale')?.trim() || 'uk';
      const page = await discoveryCatalogue(cache, locale, limit, request.signal);
      return json(request, env, {
        ...page,
        total: page.items.length,
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
