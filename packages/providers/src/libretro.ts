import {
  mediaAssetSchema,
  type Game,
  type MediaAsset,
  type Release,
  type SourceRef,
} from '@save-slot/domain';
import type { ReleaseEnricher, ReleaseEnrichment } from './media';

interface LibretroPlatform {
  pattern: RegExp;
  playlist: string;
}

interface CoverCandidate {
  name: string;
  playlist: string;
  url: string;
  origin: 'source-ref' | 'title';
}

interface ProbeCacheEntry {
  expiresAt: number;
  exists: boolean;
}

export interface RobustLibretroMediaProviderOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxCandidates?: number;
  positiveProbeTtlMs?: number;
  negativeProbeTtlMs?: number;
}

const THUMBNAIL_ORIGIN = 'https://thumbnails.libretro.com';

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

const romanToArabic: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bVIII\b/gi, '8'],
  [/\bVII\b/gi, '7'],
  [/\bVI\b/gi, '6'],
  [/\bV\b/gi, '5'],
  [/\bIV\b/gi, '4'],
  [/\bIII\b/gi, '3'],
  [/\bII\b/gi, '2'],
];

const arabicToRoman: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b8\b/g, 'VIII'],
  [/\b7\b/g, 'VII'],
  [/\b6\b/g, 'VI'],
  [/\b5\b/g, 'V'],
  [/\b4\b/g, 'IV'],
  [/\b3\b/g, 'III'],
  [/\b2\b/g, 'II'],
];

function emptyEnrichment(messages: string[] = []): ReleaseEnrichment {
  return {
    media: [],
    ratings: [],
    descriptions: [],
    developers: [],
    publishers: [],
    providerMessages: messages,
  };
}

function playlistFor(platformName: string): string | undefined {
  return libretroPlatforms.find((entry) => entry.pattern.test(platformName))?.playlist;
}

function cleanTitle(value: string): string {
  return value
    .replace(/[™®©]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function withoutEdition(value: string): string {
  return value
    .replace(
      /\s*[-:]\s*(remaster(?:ed)?|hd(?: remaster)?|definitive edition|complete edition|game of the year edition|goty|anniversary edition|special edition)$/i,
      '',
    )
    .trim();
}

function numeralVariant(value: string, replacements: ReadonlyArray<readonly [RegExp, string]>): string {
  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), value);
}

function variantsForTitle(value: string): string[] {
  const clean = cleanTitle(value);
  if (!clean) return [];
  const base = withoutEdition(clean);
  const values = new Set<string>([
    clean,
    base,
    clean.replace(/:\s*/g, ' - '),
    base.replace(/:\s*/g, ' - '),
    clean.replace(/\s*&\s*/g, ' and '),
    clean.replace(/\s+and\s+/gi, ' & '),
    numeralVariant(clean, romanToArabic),
    numeralVariant(clean, arabicToRoman),
  ]);
  if (/^the\s+/i.test(clean)) values.add(`${clean.replace(/^the\s+/i, '')}, The`);
  if (/^a\s+/i.test(clean)) values.add(`${clean.replace(/^a\s+/i, '')}, A`);
  if (clean.includes(':')) values.add(clean.split(':')[0]?.trim() ?? clean);
  return [...values].map(cleanTitle).filter(Boolean);
}

function titleVariants(game: Game, release: Release): string[] {
  const ordered = [release.title, game.title, ...game.aliases];
  return [...new Set(ordered.flatMap(variantsForTitle))];
}

function regionSuffixes(region: string): string[] {
  const normalized = region.toLocaleLowerCase('en-US');
  const preferred = /japan|jp/.test(normalized)
    ? [' (Japan)']
    : /europe|eu|pal/.test(normalized)
      ? [' (Europe)']
      : /usa|united states|north america|na/.test(normalized)
        ? [' (USA)']
        : /world/.test(normalized)
          ? [' (World)']
          : [];
  return [...new Set(['', ...preferred, ' (USA)', ' (World)', ' (Europe)', ' (Japan)', ' (USA, Europe)'])];
}

function safeFilename(value: string): string {
  return value.replace(/[&*/:`<>?\\|]/g, '_').replace(/\s+/g, ' ').trim();
}

function candidateUrl(playlist: string, name: string): string {
  return `${THUMBNAIL_ORIGIN}/${encodeURIComponent(playlist)}/Named_Boxarts/${encodeURIComponent(safeFilename(name))}.png`;
}

function isAllowedThumbnailUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === THUMBNAIL_ORIGIN &&
      url.pathname.includes('/Named_Boxarts/') &&
      url.pathname.toLocaleLowerCase().endsWith('.png')
    );
  } catch {
    return false;
  }
}

function sourceReferenceCandidates(release: Release, fallbackPlaylist: string): CoverCandidate[] {
  const candidates: CoverCandidate[] = [];
  for (const reference of release.sourceRefs.filter((entry) => entry.provider === 'libretro')) {
    if (reference.url && isAllowedThumbnailUrl(reference.url)) {
      const filename = decodeURIComponent(new URL(reference.url).pathname.split('/').pop() ?? '')
        .replace(/\.png$/i, '');
      candidates.push({
        name: filename || reference.id,
        playlist: fallbackPlaylist,
        url: reference.url,
        origin: 'source-ref',
      });
      continue;
    }

    const match = reference.id.match(/^(.+?)\/Named_Boxarts\/(.+?)(?:\.png)?$/i);
    if (!match?.[1] || !match[2]) continue;
    const playlist = match[1];
    const name = match[2];
    candidates.push({
      name,
      playlist,
      url: candidateUrl(playlist, name),
      origin: 'source-ref',
    });
  }
  return candidates;
}

function titleCandidates(game: Game, release: Release, playlist: string, limit: number): CoverCandidate[] {
  const titles = titleVariants(game, release);
  const suffixes = regionSuffixes(release.region);
  const candidates: CoverCandidate[] = [];

  for (const suffix of suffixes) {
    for (const title of titles) {
      const name = `${title}${suffix}`;
      candidates.push({ name, playlist, url: candidateUrl(playlist, name), origin: 'title' });
      if (candidates.length >= limit) return candidates;
    }
  }
  return candidates;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('Libretro thumbnail request timed out.')),
    timeoutMs,
  );
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

function imageResponse(response: Response): boolean {
  const type = response.headers.get('content-type')?.toLocaleLowerCase() ?? '';
  return response.ok && (type.startsWith('image/') || type === 'application/octet-stream');
}

function libretroSource(release: Release, candidate: CoverCandidate): SourceRef {
  return {
    provider: 'libretro',
    id: `${candidate.playlist}/Named_Boxarts/${candidate.name}`,
    url: candidate.url,
    retrievedAt: new Date().toISOString(),
  };
}

export class RobustLibretroMediaProvider implements ReleaseEnricher {
  readonly id = 'libretro';
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxCandidates: number;
  private readonly positiveProbeTtlMs: number;
  private readonly negativeProbeTtlMs: number;
  private readonly probeCache = new Map<string, ProbeCacheEntry>();

  constructor(options: RobustLibretroMediaProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 4_000;
    this.maxCandidates = options.maxCandidates ?? 20;
    this.positiveProbeTtlMs = options.positiveProbeTtlMs ?? 60 * 60 * 1_000;
    this.negativeProbeTtlMs = options.negativeProbeTtlMs ?? 5 * 60 * 1_000;
  }

  private rememberProbe(url: string, exists: boolean): void {
    if (this.probeCache.size >= 512) {
      const oldest = this.probeCache.keys().next().value as string | undefined;
      if (oldest) this.probeCache.delete(oldest);
    }
    this.probeCache.set(url, {
      exists,
      expiresAt: Date.now() + (exists ? this.positiveProbeTtlMs : this.negativeProbeTtlMs),
    });
  }

  private async probe(url: string, signal?: AbortSignal): Promise<boolean> {
    const cached = this.probeCache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.exists;
    if (cached) this.probeCache.delete(url);

    try {
      const head = await fetchWithTimeout(
        this.fetchImpl,
        url,
        { method: 'HEAD', headers: { Accept: 'image/png,image/*;q=0.8' } },
        this.timeoutMs,
        signal,
      );
      if (imageResponse(head)) {
        this.rememberProbe(url, true);
        return true;
      }

      if (![403, 405, 501].includes(head.status) && head.status >= 400 && head.status !== 404) {
        this.rememberProbe(url, false);
        return false;
      }

      if (head.status === 404) {
        this.rememberProbe(url, false);
        return false;
      }

      const ranged = await fetchWithTimeout(
        this.fetchImpl,
        url,
        {
          method: 'GET',
          headers: {
            Accept: 'image/png,image/*;q=0.8',
            Range: 'bytes=0-1023',
          },
        },
        this.timeoutMs,
        signal,
      );
      const exists = imageResponse(ranged);
      await ranged.body?.cancel().catch(() => undefined);
      this.rememberProbe(url, exists);
      return exists;
    } catch (error) {
      if (signal?.aborted) throw error;
      this.rememberProbe(url, false);
      return false;
    }
  }

  async enrich(
    game: Game,
    release: Release,
    _locale: string,
    signal?: AbortSignal,
  ): Promise<ReleaseEnrichment> {
    const playlist = playlistFor(release.platform.name);
    if (!playlist) return emptyEnrichment([`No Libretro playlist mapping for ${release.platform.name}.`]);

    const candidates = [
      ...sourceReferenceCandidates(release, playlist),
      ...titleCandidates(game, release, playlist, this.maxCandidates),
    ];
    const unique = [...new Map(candidates.map((candidate) => [candidate.url, candidate])).values()].slice(
      0,
      this.maxCandidates,
    );

    for (const [index, candidate] of unique.entries()) {
      signal?.throwIfAborted();
      if (!(await this.probe(candidate.url, signal))) continue;

      const media: MediaAsset = mediaAssetSchema.parse({
        id: `media:libretro:${release.id}:cover`,
        gameId: game.id,
        releaseId: release.id,
        platformId: release.platform.id,
        kind: 'cover-front',
        url: candidate.url,
        verified: true,
        source: libretroSource(release, candidate),
        attribution: 'Libretro Thumbnails',
      });
      return {
        ...emptyEnrichment(),
        media: [media],
        providerMessages: [
          `Verified Libretro box art after ${index + 1} candidate checks.`,
          `Match source: ${candidate.origin}.`,
        ],
      };
    }

    return emptyEnrichment([
      `No Libretro box art matched ${game.title} on ${release.platform.name}.`,
      `${unique.length} bounded candidates checked.`,
    ]);
  }
}
