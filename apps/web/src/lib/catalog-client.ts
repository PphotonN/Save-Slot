import { searchResultSchema, type SearchResult } from '@save-slot/domain';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import {
  FixtureProvider,
  sortSearchResults,
  type SearchRequest,
  type SearchSort,
} from '@save-slot/providers';
import { z } from 'zod';

const fixtureProvider = new FixtureProvider();
const searchResponseSchema = z.object({
  items: z.array(searchResultSchema),
  nextCursor: z.string().optional(),
});

export class CatalogClient {
  constructor(private readonly apiUrl = import.meta.env.VITE_SAVE_SLOT_API_URL ?? '') {}

  async search(
    request: SearchRequest,
    sort: SearchSort,
    signal?: AbortSignal,
  ): Promise<SearchResult[]> {
    if (this.apiUrl) {
      try {
        const url = new URL('/v1/search', this.apiUrl);
        url.searchParams.set('q', request.query);
        url.searchParams.set('sort', sort);
        url.searchParams.set('limit', String(request.limit ?? 60));
        if (request.platformId) url.searchParams.set('platform', request.platformId);
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Search API returned HTTP ${response.status}`);
        return searchResponseSchema.parse(await response.json()).items;
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }

    const page = await fixtureProvider.search(request, signal);
    return sortSearchResults(page.items, sort);
  }

  async discovery(limit = 30, signal?: AbortSignal): Promise<SearchResult[]> {
    if (this.apiUrl) {
      try {
        const url = new URL('/v1/discovery', this.apiUrl);
        url.searchParams.set('limit', String(limit));
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Discovery API returned HTTP ${response.status}`);
        return searchResponseSchema.parse(await response.json()).items;
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }

    const items = [...fixtureSearchResults];
    for (let index = items.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [items[index], items[target]] = [items[target] as SearchResult, items[index] as SearchResult];
    }
    return items.slice(0, limit);
  }
}
