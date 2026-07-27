import { searchResultSchema, type SearchResult } from '@save-slot/domain';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { hasVerifiedBoxArt } from '@save-slot/domain/media';
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

function browserLocale(): string {
  return typeof navigator === 'undefined' ? 'uk' : navigator.language || 'uk';
}

function verifiedReleaseResults(items: SearchResult[]): SearchResult[] {
  return items
    .map((result) => {
      const releases = result.releases.filter(hasVerifiedBoxArt);
      return {
        ...result,
        game: { ...result.game, releaseIds: releases.map((release) => release.id) },
        releases,
      };
    })
    .filter((result) => result.releases.length > 0);
}

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
        url.searchParams.set('locale', request.locale ?? browserLocale());
        url.searchParams.set('sort', sort);
        url.searchParams.set('limit', String(request.limit ?? 60));
        if (request.platformId) url.searchParams.set('platform', request.platformId);
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Search API returned HTTP ${response.status}`);
        const verified = verifiedReleaseResults(searchResponseSchema.parse(await response.json()).items);
        if (verified.length) return verified;
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }

    const page = await fixtureProvider.search(request, signal);
    return verifiedReleaseResults(sortSearchResults(page.items, sort));
  }

  async discovery(limit = 30, signal?: AbortSignal): Promise<SearchResult[]> {
    if (this.apiUrl) {
      try {
        const url = new URL('/v1/discovery', this.apiUrl);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('locale', browserLocale());
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`Discovery API returned HTTP ${response.status}`);
        const verified = verifiedReleaseResults(searchResponseSchema.parse(await response.json()).items);
        if (verified.length) return verified;
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }

    const items = [...fixtureSearchResults];
    for (let index = items.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [items[index], items[target]] = [items[target] as SearchResult, items[index] as SearchResult];
    }
    return verifiedReleaseResults(items.slice(0, limit));
  }
}
