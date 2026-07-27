import { describe, expect, it } from 'vitest';
import { fixtureSearchResults } from '@save-slot/domain/fixtures';
import { LibretroFullMediaProvider } from './libretro-full';

function fixture(title: string) {
  const result = fixtureSearchResults.find((item) => item.game.title === title);
  if (!result?.releases[0]) throw new Error(`Missing fixture: ${title}`);
  return { game: result.game, release: result.releases[0] };
}

describe('LibretroFullMediaProvider', () => {
  it('adds only matching snapshot and title-screen media after a verified cover match', async () => {
    const { game, release } = fixture('Metal Gear Solid');
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      const isTarget = url.includes('Metal%20Gear%20Solid.png');
      const exists =
        isTarget &&
        (url.includes('/Named_Boxarts/') || url.includes('/Named_Snaps/'));
      return new Response(null, {
        status: exists ? 200 : 404,
        headers: exists ? { 'content-type': 'image/png' } : {},
      });
    };
    const provider = new LibretroFullMediaProvider({ fetchImpl, timeoutMs: 500 });
    const enrichment = await provider.enrich(game, release, 'en');

    expect(enrichment.media.map((asset) => asset.kind)).toContain('cover-front');
    expect(enrichment.media.map((asset) => asset.kind)).toContain('screenshot');
    expect(enrichment.media.map((asset) => asset.kind)).not.toContain('title-screen');
    const screenshot = enrichment.media.find((asset) => asset.kind === 'screenshot');
    expect(screenshot).toMatchObject({
      releaseId: release.id,
      platformId: release.platform.id,
      verified: true,
    });
    expect(screenshot?.source.id).toContain('/Named_Snaps/');
  });

  it('can disable title-screen probing while retaining box art and snapshots', async () => {
    const { game, release } = fixture('Metal Gear Solid');
    const requested: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      requested.push(url);
      const exists =
        url.includes('Metal%20Gear%20Solid.png') &&
        (url.includes('/Named_Boxarts/') || url.includes('/Named_Snaps/'));
      return new Response(null, {
        status: exists ? 200 : 404,
        headers: exists ? { 'content-type': 'image/png' } : {},
      });
    };
    const provider = new LibretroFullMediaProvider({
      fetchImpl,
      timeoutMs: 500,
      includeTitleScreens: false,
    });
    const enrichment = await provider.enrich(game, release, 'en');

    expect(enrichment.media.some((asset) => asset.kind === 'screenshot')).toBe(true);
    expect(requested.some((url) => url.includes('/Named_Titles/'))).toBe(false);
  });
});
