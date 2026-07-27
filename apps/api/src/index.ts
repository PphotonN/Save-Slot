import type { SearchResult } from '@save-slot/domain';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { normalizePlatformIdentity } from '@save-slot/domain/platforms';
import {
  FixtureProvider,
  searchWithFallback,
  sortSearchResults,
  type SearchPage,
  type SearchSort,
} from '@save-slot/providers';
import { WikidataProvider } from '@save-slot/providers/wikidata';

interface Env {
  ALLOWED_ORIGIN?: string;
}

const fixtureProvider = new FixtureProvider();
const wikidataProvider = new WikidataProvider();
const validSorts = new Set<SearchSort>(['relevance', 'title', 'year', 'rating', 'votes']);
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

async function searchCatalogue(
  query: string,
  locale: string,
  platformId: string | undefined,
  limit: number,
  signal: AbortSignal,
): Promise<SearchPage> {
  const request = { query, locale, limit };
  const online = filterPageByPlatform(
    normalizePage(await searchWithFallback([wikidataProvider], request, signal)),
    platformId,
  );
  if (online.items.length) return online;
  const fallback = filterPageByPlatform(
    normalizePage(await fixtureProvider.search(request, signal)),
    platformId,
  );
  return mergePages([online, fallback]);
}

async function discoveryCatalogue(
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
  if (online.items.length >= Math.min(limit, 8)) {
    return { ...online, items: shuffled(online.items).slice(0, limit) };
  }
  const fallback = await fixtureProvider.search({ query: '', locale, limit }, signal);
  const merged = mergePages([online, fallback]);
  return { ...merged, items: shuffled(merged.items).slice(0, limit) };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (request.method !== 'GET') {
      return json(request, env, { error: 'method_not_allowed' }, 405);
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json(request, env, {
        service: 'save-slot-api',
        version: '1.0.0-alpha.2',
        status: 'ok',
        time: new Date().toISOString(),
      });
    }

    if (url.pathname === '/v1/providers') {
      const providers = await Promise.all([
        wikidataProvider.health(request.signal),
        fixtureProvider.health(request.signal),
      ]);
      return json(request, env, {
        providers,
        planned: ['igdb', 'mobygames', 'rawg', 'libretro', 'steam'],
      });
    }

    if (url.pathname === '/v1/search') {
      const query = url.searchParams.get('q')?.trim() ?? '';
      const locale = url.searchParams.get('locale')?.trim() || 'uk';
      const platformId = url.searchParams.get('platform')?.trim() || undefined;
      const limit = integerParam(url.searchParams.get('limit'), 30, 1, 100);
      const requestedSort = url.searchParams.get('sort') as SearchSort | null;
      const sort = requestedSort && validSorts.has(requestedSort) ? requestedSort : 'relevance';
      const page = query
        ? await searchCatalogue(query, locale, platformId, limit, request.signal)
        : await discoveryCatalogue(locale, limit, request.signal);
      return json(request, env, {
        ...page,
        items: sortSearchResults(page.items, sort),
        query,
        sort,
      });
    }

    if (url.pathname === '/v1/discovery') {
      const limit = integerParam(url.searchParams.get('limit'), 24, 1, 50);
      const locale = url.searchParams.get('locale')?.trim() || 'uk';
      const page = await discoveryCatalogue(locale, limit, request.signal);
      return json(request, env, {
        ...page,
        session: crypto.randomUUID(),
      });
    }

    const releaseMatch = url.pathname.match(/^\/v1\/releases\/(.+)$/);
    if (releaseMatch?.[1]) {
      const releaseId = decodeURIComponent(releaseMatch[1]);
      const result = fixtureSearchResults.find((item) =>
        item.releases.some((release) => release.id === releaseId),
      );
      const release = result?.releases.find((item) => item.id === releaseId);
      return release && result
        ? json(request, env, { game: result.game, release })
        : json(request, env, { error: 'release_not_found' }, 404);
    }

    const gameMatch = url.pathname.match(/^\/v1\/games\/(.+)$/);
    if (gameMatch?.[1]) {
      const gameId = decodeURIComponent(gameMatch[1]);
      const result = fixtureSearchResults.find((item) => item.game.id === gameId);
      return result
        ? json(request, env, result)
        : json(request, env, { error: 'game_not_found' }, 404);
    }

    return json(request, env, { error: 'not_found' }, 404);
  },
};
