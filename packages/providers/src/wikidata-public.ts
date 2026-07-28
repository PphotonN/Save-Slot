import type { LocalizedText, SearchResult, SourceRef } from '@save-slot/domain';
import {
  WikidataProvider as RawWikidataProvider,
  type WikidataProviderOptions,
} from './wikidata';
import type { ProviderAdapter, ProviderStatus, SearchPage, SearchRequest } from './index';

interface WikidataSitelink {
  title?: string;
}

interface WikidataSitelinkEntity {
  id?: string;
  sitelinks?: Record<string, WikidataSitelink>;
}

interface WikidataSitelinkResponse {
  entities?: Record<string, WikidataSitelinkEntity> | WikidataSitelinkEntity[];
}

interface WikipediaPage {
  pageid?: number;
  title?: string;
  extract?: string;
  fullurl?: string;
  missing?: boolean;
  pageprops?: {
    wikibase_item?: string;
  };
}

interface WikipediaResponse {
  query?: {
    pages?: WikipediaPage[];
  };
}

interface SelectedArticle {
  qid: string;
  language: string;
  title: string;
}

const MAX_ARTICLES_PER_REQUEST = 20;

function languageFromLocale(locale: string | undefined): string {
  const language = locale?.toLocaleLowerCase().split('-')[0] || 'uk';
  return /^[a-z]{2,3}$/.test(language) ? language : 'uk';
}

function wikidataId(result: SearchResult): string | undefined {
  return result.game.sourceRefs.find((source) => source.provider === 'wikidata')?.id;
}

function uniqueSources(values: SourceRef[]): SourceRef[] {
  return [
    ...new Map(values.map((source) => [`${source.provider}:${source.id}`, source])).values(),
  ];
}

function uniqueDescriptions(values: LocalizedText[]): LocalizedText[] {
  return [
    ...new Map(
      values.map((description) => [
        `${description.locale}:${description.source.provider}:${description.source.id}`,
        description,
      ]),
    ).values(),
  ];
}

function entityValues(response: WikidataSitelinkResponse): WikidataSitelinkEntity[] {
  return Array.isArray(response.entities)
    ? response.entities
    : Object.values(response.entities ?? {});
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export class WikidataProvider implements ProviderAdapter {
  readonly id = 'wikidata' as const;
  private readonly raw: RawWikidataProvider;
  private readonly apiUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: WikidataProviderOptions = {}) {
    this.raw = new RawWikidataProvider(options);
    this.apiUrl = options.apiUrl ?? 'https://www.wikidata.org/w/api.php';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 12_000;
  }

  private async fetchJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error('Open catalogue enrichment timed out.')),
      this.timeoutMs,
    );
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Api-User-Agent': 'SaveSlot/1.0 (local-first game catalogue)',
        },
      });
      if (!response.ok) throw new Error(`Open catalogue source returned HTTP ${response.status}.`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  private async articlesFor(
    qids: string[],
    locale: string | undefined,
    signal?: AbortSignal,
  ): Promise<SelectedArticle[]> {
    if (!qids.length) return [];
    const language = languageFromLocale(locale);
    const selected: SelectedArticle[] = [];

    for (const batch of chunks(qids, 40)) {
      const url = new URL(this.apiUrl);
      url.search = new URLSearchParams({
        action: 'wbgetentities',
        ids: batch.join('|'),
        props: 'sitelinks',
        format: 'json',
        formatversion: '2',
        origin: '*',
      }).toString();
      const response = await this.fetchJson<WikidataSitelinkResponse>(url, signal);
      for (const entity of entityValues(response)) {
        if (!entity.id) continue;
        const localized = entity.sitelinks?.[`${language}wiki`];
        const english = entity.sitelinks?.enwiki;
        const sitelink = localized?.title ? localized : english;
        if (!sitelink?.title) continue;
        selected.push({
          qid: entity.id,
          language: sitelink === localized ? language : 'en',
          title: sitelink.title,
        });
      }
    }
    return selected;
  }

  private async extractsFor(
    articles: SelectedArticle[],
    signal?: AbortSignal,
  ): Promise<Map<string, { article: SelectedArticle; page: WikipediaPage }>> {
    const byIdentity = new Map<string, { article: SelectedArticle; page: WikipediaPage }>();
    const groups = new Map<string, SelectedArticle[]>();
    for (const article of articles) {
      groups.set(article.language, [...(groups.get(article.language) ?? []), article]);
    }

    for (const [language, languageArticles] of groups) {
      for (const batch of chunks(languageArticles, MAX_ARTICLES_PER_REQUEST)) {
        const byQid = new Map(batch.map((article) => [article.qid, article]));
        const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
        url.search = new URLSearchParams({
          action: 'query',
          titles: batch.map((article) => article.title).join('|'),
          prop: 'extracts|info|pageprops',
          exintro: '1',
          explaintext: '1',
          exchars: '1200',
          inprop: 'url',
          ppprop: 'wikibase_item',
          redirects: '1',
          format: 'json',
          formatversion: '2',
          origin: '*',
        }).toString();
        const response = await this.fetchJson<WikipediaResponse>(url, signal);
        for (const page of response.query?.pages ?? []) {
          const qid = page.pageprops?.wikibase_item;
          if (page.missing || !qid || !page.extract?.trim()) continue;
          const article = byQid.get(qid);
          if (!article) continue;
          byIdentity.set(qid, { article, page });
        }
      }
    }
    return byIdentity;
  }

  private async enrich(
    page: SearchPage,
    locale: string | undefined,
    signal?: AbortSignal,
  ): Promise<SearchPage> {
    const qids = [...new Set(page.items.map(wikidataId).filter((id): id is string => Boolean(id)))];
    if (!qids.length) return page;
    const started = performance.now();
    const articles = await this.articlesFor(qids, locale, signal);
    const extracts = await this.extractsFor(articles, signal);
    let enrichedCount = 0;

    const items = page.items.map((result) => {
      const qid = wikidataId(result);
      const match = qid ? extracts.get(qid) : undefined;
      const text = match?.page.extract?.trim();
      if (!match || !text || text.length < 80) return result;
      enrichedCount += 1;
      const url =
        match.page.fullurl ??
        `https://${match.article.language}.wikipedia.org/wiki/${encodeURIComponent(
          match.article.title.replace(/ /g, '_'),
        )}`;
      const source: SourceRef = {
        provider: 'wikipedia',
        id: `${match.article.language}:${match.article.title}`,
        url,
        retrievedAt: new Date().toISOString(),
      };
      return {
        ...result,
        game: {
          ...result.game,
          descriptions: uniqueDescriptions([
            ...result.game.descriptions,
            {
              locale: match.article.language,
              text,
              source,
              official: false,
            },
          ]),
          sourceRefs: uniqueSources([...result.game.sourceRefs, source]),
        },
        providers: [...new Set([...result.providers, 'wikipedia' as const])],
      };
    });

    const status: ProviderStatus = {
      id: 'wikipedia',
      available: true,
      latencyMs: Math.round(performance.now() - started),
      message: `${enrichedCount} descriptions matched through exact Wikidata identities.`,
    };
    return { ...page, items, providers: [...page.providers, status] };
  }

  async search(request: SearchRequest, signal?: AbortSignal): Promise<SearchPage> {
    const page = await this.raw.search(request, signal);
    try {
      return await this.enrich(page, request.locale, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      return {
        ...page,
        providers: [
          ...page.providers,
          {
            id: 'wikipedia',
            available: false,
            message: error instanceof Error ? error.message : 'Wikipedia enrichment failed.',
          },
        ],
      };
    }
  }

  async health(signal?: AbortSignal): Promise<ProviderStatus> {
    return this.raw.health(signal);
  }
}

export type { WikidataProviderOptions } from './wikidata';
