import { describe, expect, it } from 'vitest';
import { fixtureSearchResults } from './fixtures';
import { getFallbackArtwork, getVerifiedCover, hasVerifiedBoxArt } from './media';

describe('verified box art policy', () => {
  it('accepts verified release covers', () => {
    const release = fixtureSearchResults[0]!.releases[0]!;
    expect(hasVerifiedBoxArt(release)).toBe(true);
    expect(getVerifiedCover(release)?.verified).toBe(true);
  });

  it('does not silently treat unverified artwork as box art', () => {
    const base = fixtureSearchResults[0]!.releases[0]!;
    const release = {
      ...base,
      media: base.media.map((asset) => ({ ...asset, verified: false })),
    };
    expect(getFallbackArtwork(release)).toBeTruthy();
    expect(getVerifiedCover(release)).toBeUndefined();
    expect(hasVerifiedBoxArt(release)).toBe(false);
  });
});
