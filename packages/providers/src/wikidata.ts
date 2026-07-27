import {
  canonicalId,
  gameSchema,
  mediaAssetSchema,
  platformSchema,
  releaseSchema,
  searchResultSchema,
  type Game,
  type Platform,
  type ProviderId,
  type Release,
  type SearchResult,
  type SourceRef,
} from '@save-slot/domain';
import type { ProviderAdapter, ProviderStatus, SearchPage, SearchRequest } from './index';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const ACCEPTED_TYPES = new Set(['Q7889', 'Q16070115', 'Q209163', 'Q1066707', 'Q865493']);

interface WikidataSearchItem {
  id?: string;
  label?: string;
  description?: string;
  aliases?: string[];
}

interface WikidataDataValue {
  value?: unknown;
}

interface WikidataSnak {
  datavalue?: WikidataDataValue;
}

interface WikidataClaim {
  mainsnak?: WikidataSnak;
}

interface WikidataTextValue {
  language?: string;
  value?: string;
}

interface WikidataEntity {
  id?: string;
  labels?: Record<string, WikidataTextValue>;
  descriptions?: Record<string, WikidataTextValue>;
  aliases?: Record<string, WikidataTextValue[]>;
  claims?: Record<string, WikidataClaim[]>;
}

interface WikidataSearchResponse {
  search?: WikidataSearchItem[];
}

interface WikidataEntitiesResponse {
  entities?: Record<string, WikidataEntity> | WikidataEntity[];
}

export interface WikidataProviderOptions {
  apiUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function sourceRef(id: string, retrievedAt: string): SourceRef {
  return {
    provider: 'wikidata',
    id,
    url: `https://www.wikidata.org/wiki/${id}`,
    retrievedAt,
  };
}

function entityIdFromClaim(claim: WikidataClaim): string | undefined {
  const value = claim.mainsnak?.datavalue?.value;
  if (!value || typeof value !== 'object') return undefined;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' ? id : undefined;
}

function entityIds(entity: WikidataEntity, property: string): string[] {
  return [
    ...new Set(
      (entity.claims?.[property] ?? [])
        .map(entityIdFromClaim)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

function stringClaim(entity: WikidataEntity, property: string): string | undefined {
  for (const claim of entity.claims?.[property] ?? []) {
    const value = claim.mainsnak?.datavalue?.value;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function timeClaim(entity: WikidataEntity, property: string): string | undefined {
  for (const claim of entity.claims?.[property] ?? []) {
    const value = claim.mainsnak?.datavalue?.value;
    if (!value || typeof value !== 'object') continue;
    const time = (value as { time?: unknown }).time;
    if (typeof time !== 'string') continue;
    const match = time.match(/[+-](\d{4,})-(\d{2})-(\d{2})/);
    if (!match) continue;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isInteger(year) || year < 1950 || year > 2200) continue;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return `${String(year).padStart(4, '0')}-01-01`;
  }
  return undefined;
}

function localizedValue(
  values: Record<string, WikidataTextValue> | undefined,
  locale: string,
): WikidataTextValue | undefined {
  const language = locale.toLocaleLowerCase().split('-')[0] || 'en';
  return values?.[language] ?? values?.en ?? Object.values(values ?? {})[0];
}

function label(entity: WikidataEntity | undefined, locale: string): string | undefined {
  return localizedValue(entity?.labels, locale)?.value;
}

function description(entity: WikidataEntity, locale: string): WikidataTextValue[] {
  const result: WikidataTextValue[] = [];
  const language = locale.toLocaleLowerCase().split('-')[0] || 'en';
  const preferred = entity.descriptions?.[language];
  const english = entity.descriptions?.en;
  if (preferred?.value) result.push(preferred);
  if (english?.value && english.value !== preferred?.value) result.push(english);
  return result;
}

function aliases(entity: WikidataEntity, locale: string): string[] {
  const language = locale.toLocaleLowerCase().split('-')[0] || 'en';
  const values = [...(entity.aliases?.[language] ?? []), ...(entity.aliases?.en ?? [])];
  return [...new Set(values.map((value) => value.value).filter((value): value is string => Boolean(value)))];
}

function commonsRedirect(filename: string): string {
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename.replace(/ /g, '_'))}`;
}

function platformKind(name: string): Platform['kind'] {
  if (/android|ios|mobile|phone/i.test(name)) return 'mobile';
  if (/game boy|vita|portable|psp|3ds|nintendo ds|game gear|lynx|wonderswan/i.test(name)) {
    return 'handheld';
  }
  if (/windows|linux|macos|mac os|dos|amiga|computer|pc/i.test(name)) return 'desktop';
  if (/arcade/i.test(name)) return 'arcade';
  if (/playstation|xbox|nintendo|wii|gamecube|dreamcast|saturn|sega|atari|neo geo/i.test(name)) {
    return 'console';
  }
  return 'other';
}

function platformFamily(name: string): string {
  if (/playstation|\bpsp\b|vita/i.test(name)) return 'PlayStation';
  if (/xbox|windows/i.test(name)) return /windows/i.test(name) ? 'PC' : 'Xbox';
  if (/nintendo|game boy|wii|gamecube|famicom/i.test(name)) return 'Nintendo';
  if (/sega|dreamcast|saturn|game gear|mega drive|genesis/i.test(name)) return 'Sega';
  if (/windows|linux|mac|dos|amiga|computer|pc/i.test(name)) return 'PC';
  return name;
}

function entityMap(response: WikidataEntitiesResponse): Map<string, WikidataEntity> {
  const values = Array.isArray(response.entities)
    ? response.entities
    : Object.values(response.entities ?? {});
  return new Map(
    values
      .filter((entity): entity is WikidataEntity & { id: string } => Boolean(entity.id))
      .map((entity) => [entity.id, entity]),
  );
}

function isAcceptedGame(entity: WikidataEntity): boolean {
  const types = entityIds(entity, 'P31');
  return entityIds(entity, 'P400').length > 0 && types.some((type) => ACCEPTED_TYPES.has(type));
}

function mergeSearchItems(items: WikidataSearchItem[]): WikidataSearchItem[] {
  return [...new Map(items.filter((item) => item.id).map((item) => [item.id, item])).values()];
}

export class WikidataProvider implements ProviderAdapter {
  readonly id: ProviderId = 'wikidata';
  private readonly apiUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: WikidataProviderOptions = {}) {
    this.apiUrl = options.apiUrl ?? WIKIDATA_API;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 12_000;
  }

  private async fetchJson<T>(parameters: Record<string, string>, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Wikidata request timed out.')), this.timeoutMs);
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    const url = new URL(this.apiUrl);
    for (const [key, value] of Object.entries({
      ...parameters,
      format: 'json',
      formatversion: '2',
      origin: '*',
    })) {
      url.searchParams.set(key, value);
    }

    try {
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'Api-User-Agent': 'SaveSlot/1.0' },
      });
      if (!response.ok) throw new Error(`Wikidata returned HTTP ${response.status}.`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  private async searchEntities(query: string, language: string, signal?: AbortSignal): Promise<WikidataSearchItem[]> {
    const response = await this.fetchJson<WikidataSearchResponse>(
      {
        action: 'wbsearchentities',
        search: query,
        language,
        uselang: language,
        type: 'item',
        limit: '25',
      },
      signal,
    );
    return response.search ?? [];
  }

  private async fetchEntities(
    ids: string[],
    locale: string,
    properties: string,
    signal?: AbortSignal,
  ): Promise<Map<string, WikidataEntity>> {
    const result = new Map<string, WikidataEntity>();
    for (let offset = 0; offset < ids.length; offset += 40) {
      const chunk = ids.slice(offset, offset + 40);
      if (!chunk.length) continue;
      const response = await this.fetchJson<WikidataEntitiesResponse>(
        {
          action: 'wbgetentities',
          ids: chunk.join('|'),
          props: properties,
          languages: `${locale}|en`,
          languagefallback: '1',
        },
        signal,
      );
      for (const [id, entity] of entityMap(response)) result.set(id, entity);
    }
    return result;
  }

  private buildPlatform(
    platformId: string,
    entities: Map<string, WikidataEntity>,
    locale: string,
    retrievedAt: string,
  ): Platform | undefined {
    const name = label(entities.get(platformId), locale);
    if (!name) return undefined;
    return platformSchema.parse({
      id: canonicalId('platform', platformId),
      name,
      family: platformFamily(name),
      kind: platformKind(name),
      sourceRefs: [sourceRef(platformId, retrievedAt)],
    });
  }

  private buildGameResult(
    entity: WikidataEntity & { id: string },
    relatedEntities: Map<string, WikidataEntity>,
    locale: string,
    relevance: number,
    retrievedAt: string,
  ): SearchResult | undefined {
    const title = label(entity, locale);
    if (!title) return undefined;
    const gameId = canonicalId('game:wikidata', entity.id);
    const releaseDate = timeClaim(entity, 'P577');
    const year = releaseDate ? Number(releaseDate.slice(0, 4)) : undefined;
    const image = stringClaim(entity, 'P18');
    const steamId = stringClaim(entity, 'P1733');
    const platforms = entityIds(entity, 'P400')
      .map((id) => ({ wikidataId: id, platform: this.buildPlatform(id, relatedEntities, locale, retrievedAt) }))
      .filter(
        (item): item is { wikidataId: string; platform: Platform } => Boolean(item.platform),
      );
    if (!platforms.length) return undefined;

    const releases: Release[] = platforms.map(({ wikidataId, platform }) => {
      const releaseId = canonicalId('release:wikidata', `${entity.id}:${wikidataId}:worldwide`);
      const media = image
        ? [
            mediaAssetSchema.parse({
              id: canonicalId('media:wikimedia', `${entity.id}:${wikidataId}:cover`),
              gameId,
              releaseId,
              kind: 'cover-front',
              url: commonsRedirect(image),
              platformId: platform.id,
              verified: false,
              source: sourceRef(entity.id, retrievedAt),
              attribution: 'Wikimedia Commons',
            }),
          ]
        : [];
      const refs: SourceRef[] = [sourceRef(entity.id, retrievedAt)];
      if (steamId) {
        refs.push({
          provider: 'steam',
          id: steamId,
          url: `https://store.steampowered.com/app/${steamId}/`,
          retrievedAt,
        });
      }
      return releaseSchema.parse({
        id: releaseId,
        gameId,
        platform,
        title,
        region: 'worldwide',
        ...(releaseDate ? { releaseDate } : {}),
        ...(year ? { year } : {}),
        formats: ['unknown'],
        media,
        ratings: [],
        sourceRefs: refs,
      });
    });

    const descriptions = description(entity, locale).map((value) => ({
      locale: value.language ?? 'en',
      text: value.value ?? '',
      official: false,
      source: sourceRef(entity.id, retrievedAt),
    }));
    const names = (property: string) =>
      entityIds(entity, property)
        .map((id) => label(relatedEntities.get(id), locale))
        .filter((value): value is string => Boolean(value));

    const game: Game = gameSchema.parse({
      id: gameId,
      title,
      aliases: aliases(entity, locale),
      descriptions,
      genres: names('P136'),
      developers: names('P178'),
      publishers: names('P123'),
      franchises: [],
      releaseIds: releases.map((release) => release.id),
      sourceRefs: [sourceRef(entity.id, retrievedAt)],
    });

    return searchResultSchema.parse({
      game,
      releases,
      relevance,
      providers: ['wikidata'],
    });
  }

  async search(request: SearchRequest, signal?: AbortSignal): Promise<SearchPage> {
    const query = request.query.trim();
    if (!query) {
      return {
        items: [],
        providers: [{ id: this.id, available: true, message: 'Query is empty.' }],
      };
    }

    const started = performance.now();
    const locale = request.locale?.toLocaleLowerCase().split('-')[0] || 'en';
    const searches = await Promise.allSettled([
      this.searchEntities(query, locale, signal),
      ...(locale === 'en' ? [] : [this.searchEntities(query, 'en', signal)]),
    ]);
    const records = mergeSearchItems(
      searches.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
    ).slice(0, Math.min(request.limit ?? 25, 40));
    if (!records.length) {
      return {
        items: [],
        providers: [
          {
            id: this.id,
            available: searches.some((result) => result.status === 'fulfilled'),
            latencyMs: Math.round(performance.now() - started),
            message: 'No Wikidata entities matched the query.',
          },
        ],
      };
    }

    const entities = await this.fetchEntities(
      records.map((record) => record.id).filter((id): id is string => Boolean(id)),
      locale,
      'labels|descriptions|aliases|claims',
      signal,
    );
    const accepted = records
      .map((record) => (record.id ? entities.get(record.id) : undefined))
      .filter(
        (entity): entity is WikidataEntity & { id: string } =>
          Boolean(entity?.id) && isAcceptedGame(entity as WikidataEntity),
      );
    const relatedIds = [
      ...new Set(
        accepted.flatMap((entity) =>
          ['P400', 'P136', 'P178', 'P123'].flatMap((property) => entityIds(entity, property)),
        ),
      ),
    ];
    const related = await this.fetchEntities(relatedIds, locale, 'labels', signal);
    const retrievedAt = new Date().toISOString();
    const items = accepted
      .map((entity, index) =>
        this.buildGameResult(
          entity,
          related,
          locale,
          Math.max(0, 1 - index / Math.max(accepted.length, 1)),
          retrievedAt,
        ),
      )
      .filter((item): item is SearchResult => Boolean(item));
    const platformFiltered = request.platformId
      ? items.filter((item) =>
          item.releases.some((release) => release.platform.id === request.platformId),
        )
      : items;

    return {
      items: platformFiltered,
      providers: [
        {
          id: this.id,
          available: true,
          latencyMs: Math.round(performance.now() - started),
          message: `${platformFiltered.length} normalized Wikidata game results.`,
        },
      ],
    };
  }

  async health(signal?: AbortSignal): Promise<ProviderStatus> {
    const started = performance.now();
    try {
      await this.fetchJson<WikidataEntitiesResponse>(
        { action: 'wbgetentities', ids: 'Q7889', props: 'labels', languages: 'en' },
        signal,
      );
      return {
        id: this.id,
        available: true,
        latencyMs: Math.round(performance.now() - started),
        message: 'Wikidata Action API is available.',
      };
    } catch (error) {
      return {
        id: this.id,
        available: false,
        latencyMs: Math.round(performance.now() - started),
        message: error instanceof Error ? error.message : 'Wikidata health check failed.',
      };
    }
  }
}
