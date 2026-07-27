import {
  mediaAssetSchema,
  ratingSchema,
  type Game,
  type LocalizedText,
  type MediaAsset,
  type Rating,
  type Release,
  type SourceRef,
} from '@save-slot/domain';

export interface ReleaseEnrichment {
  media: MediaAsset[];
  ratings: Rating[];
  descriptions: LocalizedText[];
  developers: string[];
  publishers: string[];
  providerMessages: string[];
}

export interface ReleaseEnricher {
  readonly id: string;
  enrich(game: Game, release: Release, locale: string, signal?: AbortSignal): Promise<ReleaseEnrichment>;
}

const emptyEnrichment = (): ReleaseEnrichment => ({
  media: [],
  ratings: [],
  descriptions: [],
  developers: [],
  publishers: [],
  providerMessages: [],
});

function source(provider: 'libretro' | 'steam', id: string, url: string): SourceRef {
  return {
    provider,
    id,
    url,
    retrievedAt: new Date().toISOString(),
  };
}

function cleanTitle(value: string): string {
  return value
    .replace(/[™®©]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function titleVariants(title: string): string[] {
  const clean = cleanTitle(title);
  const values = new Set<string>([
    clean,
    clean.replace(/:\s*/g, ' - '),
    clean.replace(/\s*&\s*/g, ' and '),
    clean.replace(/\s+and\s+/gi, ' & '),
  ]);
  if (/^the\s+/i.test(clean)) values.add(`${clean.replace(/^the\s+/i, '')}, The`);
  if (clean.includes(':')) values.add(clean.split(':')[0]?.trim() ?? clean);
  return [...values].filter(Boolean);
}

function libretroSafeName(value: string): string {
  return value.replace(/[&*/:`<>?\\|]/g, '_').replace(/\s+/g, ' ').trim();
}

interface LibretroPlatform {
  pattern: RegExp;
  playlist: string;
}

const libretroPlatforms: LibretroPlatform[] = [
  { pattern: /^PlayStation$/i, playlist: 'Sony - PlayStation' },
  { pattern: /^PlayStation 2$/i, playlist: 'Sony - PlayStation 2' },
  { pattern: /^PlayStation Portable$|^PSP$/i, playlist: 'Sony - PlayStation Portable' },
  { pattern: /^PlayStation Vita$/i, playlist: 'Sony - PlayStation Vita' },
  { pattern: /^Nintendo Entertainment System$|^NES$/i, playlist: 'Nintendo - Nintendo Entertainment System' },
  { pattern: /^Super Nintendo Entertainment System$|^SNES$/i, playlist: 'Nintendo - Super Nintendo Entertainment System' },
  { pattern: /^Nintendo 64$/i, playlist: 'Nintendo - Nintendo 64' },
  { pattern: /^Nintendo GameCube$|^GameCube$/i, playlist: 'Nintendo - GameCube' },
  { pattern: /^Wii$/i, playlist: 'Nintendo - Wii' },
  { pattern: /^Wii U$/i, playlist: 'Nintendo - Wii U' },
  { pattern: /^Nintendo Switch/i, playlist: 'Nintendo - Nintendo Switch' },
  { pattern: /^Game Boy$/i, playlist: 'Nintendo - Game Boy' },
  { pattern: /^Game Boy Color$/i, playlist: 'Nintendo - Game Boy Color' },
  { pattern: /^Game Boy Advance$/i, playlist: 'Nintendo - Game Boy Advance' },
  { pattern: /^Nintendo DS$/i, playlist: 'Nintendo - Nintendo DS' },
  { pattern: /^Nintendo 3DS$/i, playlist: 'Nintendo - Nintendo 3DS' },
  { pattern: /^Sega Mega Drive$|^Sega Genesis$|^Mega Drive$/i, playlist: 'Sega - Mega Drive - Genesis' },
  { pattern: /^Sega Saturn$|^Saturn$/i, playlist: 'Sega - Saturn' },
  { pattern: /^Dreamcast$|^Sega Dreamcast$/i, playlist: 'Sega - Dreamcast' },
  { pattern: /^Game Gear$|^Sega Game Gear$/i, playlist: 'Sega - Game Gear' },
  { pattern: /^Xbox$/i, playlist: 'Microsoft - Xbox' },
  { pattern: /^Xbox 360$/i, playlist: 'Microsoft - Xbox 360' },
  { pattern: /^Atari 2600$/i, playlist: 'Atari - 2600' },
  { pattern: /^Atari 7800$/i, playlist: 'Atari - 7800' },
  { pattern: /^Atari Lynx$/i, playlist: 'Atari - Lynx' },
  { pattern: /^Neo Geo$/i, playlist: 'SNK - Neo Geo' },
  { pattern: /^Neo Geo Pocket Color$/i, playlist: 'SNK - Neo Geo Pocket Color' },
];

function libretroPlaylist(platformName: string): string | undefined {
  return libretroPlatforms.find((entry) => entry.pattern.test(platformName))?.playlist;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Provider request timed out.')), timeoutMs);
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

async function imageExists(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      fetchImpl,
      url,
      { method: 'HEAD', headers: { Accept: 'image/*' } },
      timeoutMs,
      signal,
    );
    const type = response.headers.get('content-type') ?? '';
    return response.ok && (type.startsWith('image/') || type === 'application/octet-stream');
  } catch {
    return false;
  }
}

export interface LibretroMediaProviderOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxCandidates?: number;
}

export class LibretroMediaProvider implements ReleaseEnricher {
  readonly id = 'libretro';
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxCandidates: number;

  constructor(options: LibretroMediaProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 4_000;
    this.maxCandidates = options.maxCandidates ?? 14;
  }

  async enrich(game: Game, release: Release, _locale: string, signal?: AbortSignal): Promise<ReleaseEnrichment> {
    const playlist = libretroPlaylist(release.platform.name);
    if (!playlist) return emptyEnrichment();
    const regionalSuffixes = ['', ' (USA)', ' (World)', ' (Europe)', ' (Japan)', ' (USA, Europe)'];
    const names = titleVariants(game.title).flatMap((title) =>
      regionalSuffixes.map((suffix) => `${title}${suffix}`),
    );
    const candidates = [...new Set(names)]
      .slice(0, this.maxCandidates)
      .map((name) => {
        const filename = `${encodeURIComponent(libretroSafeName(name))}.png`;
        return {
          name,
          url: `https://thumbnails.libretro.com/${encodeURIComponent(playlist)}/Named_Boxarts/${filename}`,
        };
      });

    for (const candidate of candidates) {
      signal?.throwIfAborted();
      if (!(await imageExists(this.fetchImpl, candidate.url, this.timeoutMs, signal))) continue;
      const media = mediaAssetSchema.parse({
        id: `media:libretro:${release.id}:cover`,
        gameId: game.id,
        releaseId: release.id,
        platformId: release.platform.id,
        kind: 'cover-front',
        url: candidate.url,
        verified: true,
        source: source('libretro', `${playlist}/Named_Boxarts/${candidate.name}`, candidate.url),
        attribution: 'Libretro Thumbnails',
      });
      return {
        ...emptyEnrichment(),
        media: [media],
        providerMessages: [`Verified Libretro box art: ${candidate.name}`],
      };
    }

    return {
      ...emptyEnrichment(),
      providerMessages: [`No Libretro box art matched ${game.title} on ${release.platform.name}.`],
    };
  }
}

interface SteamAppDetailsResponse {
  success?: boolean;
  data?: {
    name?: string;
    short_description?: string;
    developers?: string[];
    publishers?: string[];
    screenshots?: Array<{ id?: number; path_thumbnail?: string; path_full?: string }>;
  };
}

interface SteamReviewsResponse {
  query_summary?: {
    total_positive?: number;
    total_negative?: number;
    total_reviews?: number;
    review_score_desc?: string;
  };
}

function steamId(release: Release): string | undefined {
  return release.sourceRefs.find((entry) => entry.provider === 'steam')?.id;
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SteamMediaProviderOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class SteamMediaProvider implements ReleaseEnricher {
  readonly id = 'steam';
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: SteamMediaProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  private async json<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetchWithTimeout(
      this.fetchImpl,
      url,
      { headers: { Accept: 'application/json' } },
      this.timeoutMs,
      signal,
    );
    if (!response.ok) throw new Error(`Steam returned HTTP ${response.status}.`);
    return (await response.json()) as T;
  }

  async enrich(game: Game, release: Release, locale: string, signal?: AbortSignal): Promise<ReleaseEnrichment> {
    const appId = steamId(release);
    if (!appId || release.platform.kind !== 'desktop') return emptyEnrichment();
    const language = locale.toLocaleLowerCase().startsWith('uk') ? 'ukrainian' : 'english';
    const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&l=${language}&cc=us`;
    const reviewsUrl = `https://store.steampowered.com/appreviews/${encodeURIComponent(appId)}?json=1&language=all&purchase_type=all&num_per_page=0`;
    const [detailsResult, reviewsResult] = await Promise.allSettled([
      this.json<Record<string, SteamAppDetailsResponse>>(detailsUrl, signal),
      this.json<SteamReviewsResponse>(reviewsUrl, signal),
    ]);
    const details = detailsResult.status === 'fulfilled' ? detailsResult.value[appId]?.data : undefined;
    const summary = reviewsResult.status === 'fulfilled' ? reviewsResult.value.query_summary : undefined;
    const media: MediaAsset[] = [];
    const coverUrl = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`;
    if (await imageExists(this.fetchImpl, coverUrl, this.timeoutMs, signal)) {
      media.push(
        mediaAssetSchema.parse({
          id: `media:steam:${appId}:cover`,
          gameId: game.id,
          releaseId: release.id,
          platformId: release.platform.id,
          kind: 'cover-front',
          url: coverUrl,
          verified: true,
          source: source('steam', appId, `https://store.steampowered.com/app/${appId}/`),
          attribution: 'Steam Store',
        }),
      );
    }
    for (const [index, screenshot] of (details?.screenshots ?? []).slice(0, 12).entries()) {
      const url = screenshot.path_full ?? screenshot.path_thumbnail;
      if (!url) continue;
      media.push(
        mediaAssetSchema.parse({
          id: `media:steam:${appId}:screenshot:${screenshot.id ?? index}`,
          gameId: game.id,
          releaseId: release.id,
          platformId: release.platform.id,
          kind: 'screenshot',
          url,
          ...(screenshot.path_thumbnail ? { thumbnailUrl: screenshot.path_thumbnail } : {}),
          verified: true,
          source: source('steam', `${appId}:screenshot:${screenshot.id ?? index}`, url),
          attribution: 'Steam Store',
        }),
      );
    }

    const total = Number(summary?.total_reviews ?? 0);
    const positive = Number(summary?.total_positive ?? 0);
    const ratings = total > 0
      ? [
          ratingSchema.parse({
            id: `rating:steam:${appId}:players`,
            gameId: game.id,
            releaseId: release.id,
            kind: 'player',
            score: Math.round((positive / total) * 1000) / 10,
            votes: total,
            label: summary?.review_score_desc,
            platformScope: release.platform.name,
            source: source('steam', `${appId}:reviews`, reviewsUrl),
          }),
        ]
      : [];
    const description = plainText(details?.short_description ?? '');
    const descriptions = description
      ? [
          {
            locale: locale.toLocaleLowerCase().split('-')[0] || 'en',
            text: description,
            official: true,
            source: source('steam', appId, `https://store.steampowered.com/app/${appId}/`),
          },
        ]
      : [];

    return {
      media,
      ratings,
      descriptions,
      developers: details?.developers ?? [],
      publishers: details?.publishers ?? [],
      providerMessages: [
        detailsResult.status === 'fulfilled' ? 'Steam Store details loaded.' : 'Steam Store details unavailable.',
        reviewsResult.status === 'fulfilled' ? 'Steam reviews loaded.' : 'Steam reviews unavailable.',
      ],
    };
  }
}

export function mergeEnrichment(
  game: Game,
  release: Release,
  enrichments: ReleaseEnrichment[],
): { game: Game; release: Release; messages: string[] } {
  const media = new Map(
    [...enrichments.flatMap((entry) => entry.media), ...release.media].map((asset) => [asset.id, asset]),
  );
  const ratings = new Map(
    [...enrichments.flatMap((entry) => entry.ratings), ...release.ratings].map((rating) => [rating.id, rating]),
  );
  const descriptions = new Map(
    [...enrichments.flatMap((entry) => entry.descriptions), ...game.descriptions].map((entry) => [
      `${entry.locale}:${entry.official}:${entry.source.provider}`,
      entry,
    ]),
  );
  return {
    game: {
      ...game,
      descriptions: [...descriptions.values()],
      developers: [...new Set([...enrichments.flatMap((entry) => entry.developers), ...game.developers])],
      publishers: [...new Set([...enrichments.flatMap((entry) => entry.publishers), ...game.publishers])],
    },
    release: {
      ...release,
      media: [...media.values()],
      ratings: [...ratings.values()],
    },
    messages: enrichments.flatMap((entry) => entry.providerMessages),
  };
}
