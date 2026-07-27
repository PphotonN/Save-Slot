import type { MediaAsset, Release } from './index';

export function getVerifiedCover(release: Release): MediaAsset | undefined {
  return release.media.find((asset) => asset.kind === 'cover-front' && asset.verified);
}

export function getFallbackArtwork(release: Release): MediaAsset | undefined {
  return release.media.find((asset) => asset.kind === 'cover-front');
}

export function getReleaseScreenshots(release: Release): MediaAsset[] {
  return release.media.filter((asset) => asset.kind === 'screenshot');
}

export function hasVerifiedBoxArt(release: Release): boolean {
  return Boolean(getVerifiedCover(release));
}
