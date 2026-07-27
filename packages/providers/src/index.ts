import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import type { ProviderId, SearchResult } from '@save-slot/domain';

export interface SearchRequest {
  query: string;
  locale?: string;
  platformId?: string;
  cursor?: string;
  limit?: number;
}

export interface SearchPage {
  items: SearchResult[];
  nextCursor?: string;
  providers: ProviderStatus[];
}

export interface ProviderStatus {
  id: ProviderId;
  available: boolean;
  latencyMs?: number;
  message?: string;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  search(request: SearchRequest, signal?: AbortSignal): Promise<SearchPage>;
  health(signal?: AbortSignal): Promise<ProviderStatus>;
}

export type SearchSort = 'relevance' | 'title' | 'year' | 'rating' | 'votes';

function normalized(value: string): string {
  return value
    .toLocaleLowerCase('en-US')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яіїєґ]+/gi, ' ')
    .trim();
}

function matches(result: SearchResult, query: string): boolean {
  if (!query) return true;
  const terms = normalized(query).split(/\s+/).filter(Boolean);
  const haystack = normalized(
    [
      result.game.title,
      ...result.game.aliases,
      ...result.game.genres,
      ...result.game.developers,
      ...result.game.publishers,
      ...result.game.descriptions.map((description) => description.text),
    ].join(' '),
  );
  return terms.every((term) => haystack.includes(term));
}

export function filterSearchResults(
  results: SearchResult[],
  request: Pick<SearchRequest, 'query' | 'platformId'>,
): SearchResult[] {
  return results.filter(
    (result) =>
      matches(result, request.query) &&
      (!request.platformId ||
        result.releases.some((release) => release.platform.id === request.platformId)),
  );
}

export function sortSearchResults(results: SearchResult[], sort: SearchSort): SearchResult[] {
  const copy = [...results];
  const firstRelease = (result: SearchResult) => result.releases[0];
  const firstRating = (result: SearchResult) =>
    firstRelease(result)?.ratings.find((rating) => rating.kind === 'player');

  copy.sort((left, right) => {
    if (sort === 'title') return left.game.title.localeCompare(right.game.title, 'uk');
    if (sort === 'year') {
      return (firstRelease(right)?.year ?? 0) - (firstRelease(left)?.year ?? 0);
    }
    if (sort === 'rating') {
      return (firstRating(right)?.score ?? -1) - (firstRating(left)?.score ?? -1);
    }
    if (sort === 'votes') {
      return (firstRating(right)?.votes ?? -1) - (firstRating(left)?.votes ?? -1);
    }
    return right.relevance - left.relevance;
  });
  return copy;
}

export class FixtureProvider implements ProviderAdapter {
  readonly id = 'manual' as const;

  async search(request: SearchRequest, signal?: AbortSignal): Promise<SearchPage> {
    signal?.throwIfAborted();
    const started = performance.now();
    const limit = Math.max(1, Math.min(request.limit ?? 30, 100));
    const offset = Number.parseInt(request.cursor ?? '0', 10) || 0;
    const filtered = filterSearchResults(fixtureSearchResults, request);
    const items = filtered.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    const nextCursor = nextOffset < filtered.length ? String(nextOffset) : null;

    return {
      items,
      ...(nextCursor ? { nextCursor } : {}),
      providers: [
        {
          id: this.id,
          available: true,
          latencyMs: Math.round(performance.now() - started),
          message: 'Local development fixture catalogue',
        },
      ],
    };
  }

  async health(signal?: AbortSignal): Promise<ProviderStatus> {
    signal?.throwIfAborted();
    return {
      id: this.id,
      available: true,
      latencyMs: 0,
      message: 'Fixture provider ready',
    };
  }
}

export async function searchWithFallback(
  providers: ProviderAdapter[],
  request: SearchRequest,
  signal?: AbortSignal,
): Promise<SearchPage> {
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.search(request, signal)),
  );
  const items = new Map<string, SearchResult>();
  const statuses: ProviderStatus[] = [];
  const cursors: string[] = [];

  settled.forEach((result, index) => {
    const provider = providers[index];
    if (!provider) return;
    if (result.status === 'fulfilled') {
      for (const item of result.value.items) {
        const previous = items.get(item.game.id);
        if (!previous) {
          items.set(item.game.id, item);
          continue;
        }
        const releaseMap = new Map(
          [...previous.releases, ...item.releases].map((release) => [release.id, release]),
        );
        items.set(item.game.id, {
          ...previous,
          releases: [...releaseMap.values()],
          relevance: Math.max(previous.relevance, item.relevance),
          providers: [...new Set([...previous.providers, ...item.providers])],
        });
      }
      statuses.push(...result.value.providers);
      if (result.value.nextCursor) cursors.push(result.value.nextCursor);
    } else {
      statuses.push({
        id: provider.id,
        available: false,
        message: result.reason instanceof Error ? result.reason.message : 'Provider failed',
      });
    }
  });

  return {
    items: [...items.values()],
    ...(cursors[0] ? { nextCursor: cursors[0] } : {}),
    providers: statuses,
  };
}
