import { describe, expect, it } from 'vitest';
import { normalizePlatformIdentity } from './platforms';

describe('platform normalization', () => {
  it('merges provider labels for the same Windows platform', () => {
    expect(normalizePlatformIdentity('Microsoft Windows').id).toBe('platform:windows');
    expect(normalizePlatformIdentity('Windows PC').id).toBe('platform:windows');
  });

  it('keeps console and handheld families distinct', () => {
    expect(normalizePlatformIdentity('PlayStation')).toMatchObject({
      id: 'platform:playstation',
      family: 'PlayStation',
      kind: 'console',
    });
    expect(normalizePlatformIdentity('PlayStation Vita')).toMatchObject({
      id: 'platform:playstation-vita',
      family: 'PlayStation',
      kind: 'handheld',
    });
  });
});
