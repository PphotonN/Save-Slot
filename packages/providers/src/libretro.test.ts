import { describe, expect, it, vi } from 'vitest';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { RobustLibretroMediaProvider } from './libretro';

function fixture(title: string) {
  const result = fixtureSearchResults.find((item) => item.game.title === title);
  if (!result?.releases[0]) throw new Error(`Missing fixture: ${title}`);
  return { game: result.game, release: result.releases[0] };
}

describe('RobustLibretroMediaProvider', () => {
  it('prioritizes a validated Libretro source URL before generated title candidates', async () => {
    const { game, release } = fixture('Metal Gear Solid');
    const exactUrl =
      'https://thumbnails.libretro.com/Sony%20-%20PlayStation/Named_Boxarts/Metal%20Gear%20Solid%20(USA).png';
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      return new Response(null, {
        status: String(input) === exactUrl ? 200 : 404,
        headers: { 'content-type': 'image/png' },
      });
    });
    const provider = new RobustLibretroMediaProvider({ fetchImpl, timeoutMs: 500 });
    const enrichment = await provider.enrich(
      game,
      {
        ...release,
        sourceRefs: [
          ...release.sourceRefs,
          {
            provider: 'libretro',
            id: 'Sony - PlayStation/Named_Boxarts/Metal Gear Solid (USA)',
            url: exactUrl,
          },
        ],
      },
      'en',
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(exactUrl);
    expect(enrichment.media[0]).toMatchObject({
      url: exactUrl,
      verified: true,
      kind: 'cover-front',
      source: expect.objectContaining({ provider: 'libretro', url: exactUrl }),
    });
    expect(enrichment.providerMessages).toContain(
      'Verified Libretro box art after 1 candidate checks.',
    );
  });

  it('falls back from unsupported HEAD to a bounded ranged GET and caches the positive probe', async () => {
    const { game, release } = fixture('Metal Gear Solid');
    const methods: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      methods.push(init?.method ?? 'GET');
      const target = String(input).includes('Metal%20Gear%20Solid.png');
      if (!target) return new Response(null, { status: 404 });
      if (init?.method === 'HEAD') return new Response(null, { status: 405 });
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 206,
        headers: { 'content-type': 'image/png' },
      });
    });
    const provider = new RobustLibretroMediaProvider({ fetchImpl, timeoutMs: 500 });
    const releaseWithoutKnownCover = {
      ...release,
      sourceRefs: release.sourceRefs.filter((reference) => reference.provider !== 'libretro'),
    };

    const first = await provider.enrich(game, releaseWithoutKnownCover, 'en');
    const callsAfterFirst = fetchImpl.mock.calls.length;
    const second = await provider.enrich(game, releaseWithoutKnownCover, 'en');

    expect(first.media[0]?.verified).toBe(true);
    expect(second.media[0]?.url).toBe(first.media[0]?.url);
    expect(methods.slice(0, 2)).toEqual(['HEAD', 'GET']);
    expect(fetchImpl).toHaveBeenCalledTimes(callsAfterFirst);
  });

  it('uses release titles and aliases without allowing unbounded candidate growth', async () => {
    const { game, release } = fixture('Metal Gear Solid');
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seen.push(url);
      const found = url.includes('Alternative%20Title%20II.png');
      return new Response(null, {
        status: found ? 200 : 404,
        headers: found ? { 'content-type': 'image/png' } : {},
      });
    };
    const provider = new RobustLibretroMediaProvider({
      fetchImpl,
      timeoutMs: 500,
      maxCandidates: 12,
    });
    const enrichment = await provider.enrich(
      { ...game, aliases: ['Alternative Title II'] },
      { ...release, title: 'Release Title: Remastered' },
      'en',
    );

    expect(enrichment.media[0]?.verified).toBe(true);
    expect(seen.length).toBeLessThanOrEqual(12);
    expect(seen.some((url) => url.includes('Alternative%20Title%20II.png'))).toBe(true);
  });
});
