import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { FixtureProvider, sortSearchResults, type SearchSort } from '@save-slot/providers';

interface Env {
  ALLOWED_ORIGIN?: string;
}

const fixtureProvider = new FixtureProvider();
const validSorts = new Set<SearchSort>(['relevance', 'title', 'year', 'rating', 'votes']);

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
        version: '1.0.0-alpha.1',
        status: 'ok',
        time: new Date().toISOString(),
      });
    }

    if (url.pathname === '/v1/providers') {
      return json(request, env, {
        providers: [await fixtureProvider.health(request.signal)],
        planned: ['wikidata', 'igdb', 'mobygames', 'rawg', 'libretro', 'steam'],
      });
    }

    if (url.pathname === '/v1/search') {
      const query = url.searchParams.get('q')?.trim() ?? '';
      const platformId = url.searchParams.get('platform')?.trim() || undefined;
      const cursor = url.searchParams.get('cursor')?.trim() || undefined;
      const limit = integerParam(url.searchParams.get('limit'), 30, 1, 100);
      const requestedSort = url.searchParams.get('sort') as SearchSort | null;
      const sort = requestedSort && validSorts.has(requestedSort) ? requestedSort : 'relevance';
      const page = await fixtureProvider.search(
        {
          query,
          limit,
          ...(platformId ? { platformId } : {}),
          ...(cursor ? { cursor } : {}),
        },
        request.signal,
      );
      return json(request, env, {
        ...page,
        items: sortSearchResults(page.items, sort),
        query,
        sort,
      });
    }

    if (url.pathname === '/v1/discovery') {
      const limit = integerParam(url.searchParams.get('limit'), 24, 1, 50);
      const platformId = url.searchParams.get('platform')?.trim();
      const pool = platformId
        ? fixtureSearchResults.filter((result) =>
            result.releases.some((release) => release.platform.id === platformId),
          )
        : fixtureSearchResults;
      return json(request, env, {
        items: shuffled(pool).slice(0, limit),
        session: crypto.randomUUID(),
        providers: [await fixtureProvider.health(request.signal)],
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
