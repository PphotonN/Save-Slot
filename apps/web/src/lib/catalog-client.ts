import {
  releaseSnapshotSchema,
  searchResultSchema,
  type ReleaseSnapshot,
  type SearchResult,
} from '@save-slot/domain';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { hasVerifiedBoxArt } from '@save-slot/domain/media';
import {
  FixtureProvider,
  sortSearchResults,
  type ProviderStatus,
  type SearchRequest,
  type SearchSort,
  type SearchSortDirection,
} from '@save-slot/providers';
import { z } from 'zod';

const fixtureProvider = new FixtureProvider();
const providerIdSchema = z.enum(['igdb', 'wikidata', 'mobygames', 'rawg', 'steam', 'libretro', 'pcgamingwiki', 'wikipedia', 'official-store', 'manual']);

const providerStatusSchema = z.object({
  id: providerIdSchema,
  available: z.boolean(),
  latencyMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
});

const searchResponseSchema = z.object({
  items: z.array(searchResultSchema),
  nextCursor: z.string().optional(),
  total: z.number().int().nonnegative().optional(),
  providers: z.array(providerStatusSchema).optional().default([]),
});

const providerOverviewSchema = z.object({
  providers: z.array(providerStatusSchema),
  mediaProviders: z.array(providerIdSchema).optional().default([]),
  planned: z.array(providerIdSchema).optional().default([]),
});

const searchSuggestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  platforms: z.array(z.string()),
});

const suggestionResponseSchema = z.object({
  items: z.array(searchSuggestionSchema),
});

const catalogueCacheClearResultSchema = z.object({
  cleared: z.literal(true),
  memoryEntries: z.number().int().nonnegative(),
  cacheApiEntries: z.number().int().nonnegative(),
  kvEntries: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  backends: z.array(z.string()),
  stats: z.object({
    memoryEntries: z.number().int().nonnegative(),
    hits: z.number().int().nonnegative(),
    misses: z.number().int().nonnegative(),
    writes: z.number().int().nonnegative(),
    kvEnabled: z.boolean(),
    cacheApiEnabled: z.boolean(),
  }),
});

const catalogueCacheStatusSchema = z.object({
  schema: z.string(),
  searchTtlSeconds: z.number().int().positive(),
  suggestionTtlSeconds: z.number().int().positive().optional(),
  detailTtlSeconds: z.number().int().positive(),
  searchPoolLimit: z.number().int().positive().optional(),
  backends: z.array(z.string()),
  stats: z.object({
    memoryEntries: z.number().int().nonnegative(),
    hits: z.number().int().nonnegative(),
    misses: z.number().int().nonnegative(),
    writes: z.number().int().nonnegative(),
    kvEnabled: z.boolean(),
    cacheApiEnabled: z.boolean(),
  }),
});

export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;
export type CatalogueCacheClearResult = z.infer<typeof catalogueCacheClearResultSchema>;
export type CatalogueCacheStatus = z.infer<typeof catalogueCacheStatusSchema>;

export interface CatalogSearchPage {
  items: SearchResult[];
  nextCursor?: string;
  total: number;
  providers: ProviderStatus[];
}

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

  async searchPage(
    request: SearchRequest,
    sort: SearchSort,
    direction: SearchSortDirection = 'desc',
    signal?: AbortSignal,
  ): Promise<CatalogSearchPage> {
    if (this.apiUrl) {
      try {
        const url = new URL('/v1/search', this.apiUrl);
        url.searchParams.set('q', request.query);
        url.searchParams.set('locale', request.locale ?? browserLocale());
        url.searchParams.set('sort', sort);
        url.searchParams.set('order', direction);
        url.searchParams.set('limit', String(request.limit ?? 18));
        if (request.platformId) url.searchParams.set('platform', request.platformId);
        if (request.genre) url.searchParams.set('genre', request.genre);
        if (request.yearFrom != null) url.searchParams.set('yearFrom', String(request.yearFrom));
        if (request.yearTo != null) url.searchParams.set('yearTo', String(request.yearTo));
        if (request.cursor) url.searchParams.set('cursor', request.cursor);
        const response = await fetch(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`Search API returned HTTP ${response.status}`);
        const parsed = searchResponseSchema.parse(await response.json());
        const verified = verifiedReleaseResults(parsed.items);
        return {
          items: verified,
          ...(parsed.nextCursor ? { nextCursor: parsed.nextCursor } : {}),
          total: parsed.total ?? verified.length,
          providers: parsed.providers,
        };
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }

    const page = await fixtureProvider.search(request, signal);
    const items = verifiedReleaseResults(sortSearchResults(page.items, sort, direction));
    return {
      items,
      ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
      total: page.total ?? items.length,
      providers: page.providers,
    };
  }

  async search(
    request: SearchRequest,
    sort: SearchSort,
    direction: SearchSortDirection = 'desc',
    signal?: AbortSignal,
  ): Promise<SearchResult[]> {
    return (await this.searchPage(request, sort, direction, signal)).items;
  }

  async suggestions(
    query: string,
    locale = browserLocale(),
    limit = 6,
    signal?: AbortSignal,
  ): Promise<SearchSuggestion[]> {
    const normalized = query.trim();
    if (normalized.length < 2) return [];
    if (this.apiUrl) {
      try {
        const url = new URL('/v1/suggestions', this.apiUrl);
        url.searchParams.set('q', normalized);
        url.searchParams.set('locale', locale);
        url.searchParams.set('limit', String(limit));
        const response = await fetch(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`Suggestions API returned HTTP ${response.status}`);
        return suggestionResponseSchema.parse(await response.json()).items;
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }

    const page = await fixtureProvider.search({ query: normalized, locale, limit }, signal);
    return page.items.slice(0, limit).map((result) => ({
      id: result.game.id,
      title: result.game.title,
      ...(result.game.descriptions[0]?.text
        ? { description: result.game.descriptions[0].text }
        : {}),
      platforms: [...new Set(result.releases.map((release) => release.platform.name))].slice(0, 4),
    }));
  }

  async discovery(limit = 30, signal?: AbortSignal): Promise<SearchResult[]> {
    if (this.apiUrl) {
      try {
        const url = new URL('/v1/discovery', this.apiUrl);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('locale', browserLocale());
        const response = await fetch(url, { signal, cache: 'no-store' });
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

  async game(gameId: string, signal?: AbortSignal): Promise<SearchResult | null> {
    if (this.apiUrl) {
      try {
        const response = await fetch(
          new URL(`/v1/games/${encodeURIComponent(gameId)}`, this.apiUrl),
          { signal, cache: 'no-store' },
        );
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Game detail API returned HTTP ${response.status}`);
        return searchResultSchema.parse(await response.json());
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }
    return fixtureSearchResults.find((result) => result.game.id === gameId) ?? null;
  }

  async release(releaseId: string, signal?: AbortSignal): Promise<ReleaseSnapshot | null> {
    if (this.apiUrl) {
      try {
        const response = await fetch(
          new URL(`/v1/releases/${encodeURIComponent(releaseId)}`, this.apiUrl),
          { signal, cache: 'no-store' },
        );
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Release detail API returned HTTP ${response.status}`);
        return releaseSnapshotSchema.parse(await response.json());
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }
    for (const result of fixtureSearchResults) {
      const release = result.releases.find((candidate) => candidate.id === releaseId);
      if (release) return { game: result.game, release };
    }
    return null;
  }

  async providers(signal?: AbortSignal): Promise<ProviderStatus[]> {
    if (!this.apiUrl) return [{ id: 'manual', available: true, message: 'Local fixture catalogue' }];
    try {
      const response = await fetch(new URL('/v1/providers', this.apiUrl), { signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`Provider API returned HTTP ${response.status}`);
      const overview = providerOverviewSchema.parse(await response.json());
      const statuses = new Map(overview.providers.map((provider) => [provider.id, provider]));
      for (const id of overview.mediaProviders) {
        if (!statuses.has(id)) statuses.set(id, { id, available: true, message: 'Media enrichment source' });
      }
      for (const id of overview.planned) {
        if (!statuses.has(id)) statuses.set(id, { id, available: false, message: 'Provider is planned but not configured yet' });
      }
      return [...statuses.values()];
    } catch (error) {
      if (signal?.aborted) throw error;
      return [{ id: 'manual', available: true, message: 'Offline fixture fallback' }];
    }
  }

  async clearCache(signal?: AbortSignal): Promise<CatalogueCacheClearResult | null> {
    if (!this.apiUrl) return null;
    const response = await fetch(new URL('/v1/cache', this.apiUrl), {
      method: 'DELETE',
      signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Cache clear API returned HTTP ${response.status}`);
    return catalogueCacheClearResultSchema.parse(await response.json());
  }

  async cacheStatus(signal?: AbortSignal): Promise<CatalogueCacheStatus | null> {
    if (!this.apiUrl) return null;
    try {
      const response = await fetch(new URL('/v1/cache', this.apiUrl), {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Cache status API returned HTTP ${response.status}`);
      return catalogueCacheStatusSchema.parse(await response.json());
    } catch (error) {
      if (signal?.aborted) throw error;
      return null;
    }
  }
}
