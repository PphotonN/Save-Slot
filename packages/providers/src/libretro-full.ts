import {
  mediaAssetSchema,
  type Game,
  type MediaAsset,
  type Release,
  type SourceRef,
} from '@save-slot/domain';
import {
  RobustLibretroMediaProvider,
  type RobustLibretroMediaProviderOptions,
} from './libretro';
import type { ReleaseEnricher, ReleaseEnrichment } from './media';

export interface LibretroFullMediaProviderOptions extends RobustLibretroMediaProviderOptions {
  includeTitleScreens?: boolean;
}

interface MatchedBoxArtIdentity {
  playlist: string;
  name: string;
}

const THUMBNAIL_ORIGIN = 'https://thumbnails.libretro.com';

function safeFilename(value: string): string {
  return value.replace(/[&*/:`<>?\\|]/g, '_').replace(/\s+/g, ' ').trim();
}

function mediaUrl(playlist: string, directory: 'Named_Snaps' | 'Named_Titles', name: string): string {
  return `${THUMBNAIL_ORIGIN}/${encodeURIComponent(playlist)}/${directory}/${encodeURIComponent(safeFilename(name))}.png`;
}

function matchedIdentity(enrichment: ReleaseEnrichment): MatchedBoxArtIdentity | undefined {
  const cover = enrichment.media.find(
    (asset) => asset.kind === 'cover-front' && asset.source.provider === 'libretro',
  );
  const marker = '/Named_Boxarts/';
  const index = cover?.source.id.indexOf(marker) ?? -1;
  if (!cover || index <= 0) return undefined;
  const playlist = cover.source.id.slice(0, index);
  const name = cover.source.id.slice(index + marker.length);
  return playlist && name ? { playlist, name } : undefined;
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('Libretro supplementary media request timed out.')),
    timeoutMs,
  );
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

function imageResponse(response: Response): boolean {
  const type = response.headers.get('content-type')?.toLocaleLowerCase() ?? '';
  return response.ok && (type.startsWith('image/') || type === 'application/octet-stream');
}

async function probeImage(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const head = await fetchWithTimeout(
      fetchImpl,
      url,
      { method: 'HEAD', headers: { Accept: 'image/png,image/*;q=0.8' } },
      timeoutMs,
      signal,
    );
    if (imageResponse(head)) return true;
    if (head.status === 404) return false;
    if (head.status >= 400 && ![403, 405, 501].includes(head.status)) return false;

    const ranged = await fetchWithTimeout(
      fetchImpl,
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'image/png,image/*;q=0.8',
          Range: 'bytes=0-1023',
        },
      },
      timeoutMs,
      signal,
    );
    const exists = imageResponse(ranged);
    await ranged.body?.cancel().catch(() => undefined);
    return exists;
  } catch (error) {
    if (signal?.aborted) throw error;
    return false;
  }
}

function source(
  directory: 'Named_Snaps' | 'Named_Titles',
  identity: MatchedBoxArtIdentity,
  url: string,
): SourceRef {
  return {
    provider: 'libretro',
    id: `${identity.playlist}/${directory}/${identity.name}`,
    url,
    retrievedAt: new Date().toISOString(),
  };
}

export class LibretroFullMediaProvider implements ReleaseEnricher {
  readonly id = 'libretro';
  private readonly base: RobustLibretroMediaProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly includeTitleScreens: boolean;

  constructor(options: LibretroFullMediaProviderOptions = {}) {
    this.base = new RobustLibretroMediaProvider(options);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 4_000;
    this.includeTitleScreens = options.includeTitleScreens ?? true;
  }

  async enrich(
    game: Game,
    release: Release,
    locale: string,
    signal?: AbortSignal,
  ): Promise<ReleaseEnrichment> {
    const base = await this.base.enrich(game, release, locale, signal);
    const identity = matchedIdentity(base);
    if (!identity) return base;

    const snapUrl = mediaUrl(identity.playlist, 'Named_Snaps', identity.name);
    const titleUrl = mediaUrl(identity.playlist, 'Named_Titles', identity.name);
    const [hasSnap, hasTitle] = await Promise.all([
      probeImage(this.fetchImpl, snapUrl, this.timeoutMs, signal),
      this.includeTitleScreens
        ? probeImage(this.fetchImpl, titleUrl, this.timeoutMs, signal)
        : Promise.resolve(false),
    ]);

    const media: MediaAsset[] = [...base.media];
    if (hasSnap) {
      media.push(
        mediaAssetSchema.parse({
          id: `media:libretro:${release.id}:snap`,
          gameId: game.id,
          releaseId: release.id,
          platformId: release.platform.id,
          kind: 'screenshot',
          url: snapUrl,
          verified: true,
          source: source('Named_Snaps', identity, snapUrl),
          attribution: 'Libretro Thumbnails',
        }),
      );
    }
    if (hasTitle) {
      media.push(
        mediaAssetSchema.parse({
          id: `media:libretro:${release.id}:title`,
          gameId: game.id,
          releaseId: release.id,
          platformId: release.platform.id,
          kind: 'title-screen',
          url: titleUrl,
          verified: true,
          source: source('Named_Titles', identity, titleUrl),
          attribution: 'Libretro Thumbnails',
        }),
      );
    }

    return {
      ...base,
      media,
      providerMessages: [
        ...base.providerMessages,
        hasSnap ? 'Verified matching Libretro snapshot.' : 'Matching Libretro snapshot unavailable.',
        ...(this.includeTitleScreens
          ? [hasTitle ? 'Verified matching Libretro title screen.' : 'Matching Libretro title screen unavailable.']
          : []),
      ],
    };
  }
}
