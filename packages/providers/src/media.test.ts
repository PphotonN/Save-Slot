import { describe, expect, it } from 'vitest';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { LibretroMediaProvider, SteamMediaProvider, mergeEnrichment } from './media';

function fixture(title: string) {
  const result = fixtureSearchResults.find((item) => item.game.title === title);
  if (!result?.releases[0]) throw new Error(`Missing fixture: ${title}`);
  return { game: result.game, release: result.releases[0] };
}

describe('LibretroMediaProvider', () => {
  it('returns a verified platform-specific box art asset', async () => {
    const { game, release } = fixture('Metal Gear Solid');
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const found = url.includes('Metal%20Gear%20Solid%20(USA).png');
      return new Response(null, {
        status: found ? 200 : 404,
        headers: found && init?.method === 'HEAD' ? { 'content-type': 'image/png' } : {},
      });
    };
    const provider = new LibretroMediaProvider({ fetchImpl, timeoutMs: 500 });
    const enrichment = await provider.enrich(game, release, 'en');
    expect(enrichment.media[0]).toMatchObject({
      kind: 'cover-front',
      platformId: release.platform.id,
      verified: true,
    });
    expect(enrichment.media[0]?.source.provider).toBe('libretro');
  });
});

describe('SteamMediaProvider', () => {
  it('returns official PC media, description and player rating', async () => {
    const { game, release } = fixture('Half-Life 2');
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      if (init?.method === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-type': 'image/jpeg' } });
      }
      if (url.includes('/api/appdetails')) {
        return Response.json({
          '220': {
            success: true,
            data: {
              short_description: '<b>Official</b> short description.',
              developers: ['Valve'],
              publishers: ['Valve'],
              screenshots: [
                {
                  id: 1,
                  path_thumbnail: 'https://example.com/thumb.jpg',
                  path_full: 'https://example.com/full.jpg',
                },
              ],
            },
          },
        });
      }
      if (url.includes('/appreviews/')) {
        return Response.json({
          query_summary: {
            total_positive: 970,
            total_negative: 30,
            total_reviews: 1000,
            review_score_desc: 'Overwhelmingly Positive',
          },
        });
      }
      return new Response(null, { status: 404 });
    };
    const provider = new SteamMediaProvider({ fetchImpl, timeoutMs: 500 });
    const enrichment = await provider.enrich(game, release, 'en');
    expect(enrichment.media.some((asset) => asset.kind === 'cover-front')).toBe(true);
    expect(enrichment.media.some((asset) => asset.kind === 'screenshot')).toBe(true);
    expect(enrichment.ratings[0]).toMatchObject({ score: 97, votes: 1000 });
    expect(enrichment.descriptions[0]?.text).toBe('Official short description.');

    const merged = mergeEnrichment(game, release, [enrichment]);
    expect(merged.release.media[0]?.source.provider).toBe('steam');
    expect(merged.game.descriptions[0]?.official).toBe(true);
  });
});
