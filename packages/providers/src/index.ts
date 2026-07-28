import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import type { ProviderId, SearchResult } from '@save-slot/domain';
import { reconcileSearchResults } from './reconcile';

export { assessIdentity, mergeSearchResults, reconcileSearchResults } from './reconcile';
export type { IdentityAssessment } from './reconcile';

export interface SearchRequest {
  query: string;
  locale?: string;
  platformId?: string;
  genre?: string;
  yearFrom?: number;
  yearTo?: number;
  cursor?: string;
  limit?: number;
}

export interface SearchPage {
  items: SearchResult[];
  nextCursor?: string;
  total?: number;
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
export type SearchSortDirection = 'asc' | 'desc';

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
  request: Pick<SearchRequest, 'query' | 'platformId' | 'genre' | 'yearFrom' | 'yearTo'>,
): SearchResult[] {
  const normalizedGenre = request.genre?.trim().toLocaleLowerCase('en-US');
  return results.filter((result) => {
    const matchingReleases = result.releases.filter(
      (release) =>
        (!request.platformId || release.platform.id === request.platformId) &&
        (request.yearFrom == null || (release.year ?? -Infinity) >= request.yearFrom) &&
        (request.yearTo == null || (release.year ?? Infinity) <= request.yearTo),
    );
    const matchesGenre =
      !normalizedGenre ||
      result.game.genres.some((genre) => genre.toLocaleLowerCase('en-US') === normalizedGenre);
    return matches(result, request.query) && matchesGenre && matchingReleases.length > 0;
  });
}

export function sortSearchResults(
  results: SearchResult[],
  sort: SearchSort,
  direction: SearchSortDirection = 'desc',
): SearchResult[] {
  const copy = [...results];
  const firstRelease = (result: SearchResult) => result.releases[0];
  const firstRating = (result: SearchResult) =>
    firstRelease(result)?.ratings.find((rating) => rating.kind === 'player');

  copy.sort((left, right) => {
    let comparison = 0;
    if (sort === 'title') comparison = left.game.title.localeCompare(right.game.title, 'uk');
    else if (sort === 'year') comparison = (firstRelease(left)?.year ?? 0) - (firstRelease(right)?.year ?? 0);
    else if (sort === 'rating') comparison = (firstRating(left)?.score ?? -1) - (firstRating(right)?.score ?? -1);
    else if (sort === 'votes') comparison = (firstRating(left)?.votes ?? -1) - (firstRating(right)?.votes ?? -1);
    else comparison = left.relevance - right.relevance;
    return direction === 'asc' ? comparison : -comparison;
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
      total: filtered.length,
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
  const candidates: SearchResult[] = [];
  const statuses: ProviderStatus[] = [];
  const cursors: string[] = [];
  const totals: number[] = [];

  settled.forEach((result, index) => {
    const provider = providers[index];
    if (!provider) return;
    if (result.status === 'fulfilled') {
      candidates.push(...result.value.items);
      statuses.push(...result.value.providers);
      if (result.value.nextCursor) cursors.push(result.value.nextCursor);
      if (result.value.total != null) totals.push(result.value.total);
    } else {
      statuses.push({
        id: provider.id,
        available: false,
        message: result.reason instanceof Error ? result.reason.message : 'Provider failed',
      });
    }
  });

  const items = reconcileSearchResults(candidates);
  return {
    items,
    ...(cursors[0] ? { nextCursor: cursors[0] } : {}),
    ...(totals.length ? { total: Math.max(Math.max(...totals), items.length) } : {}),
    providers: statuses,
  };
}
