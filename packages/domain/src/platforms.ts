import { canonicalId, type PlatformKind } from './index';

interface PlatformRule {
  pattern: RegExp;
  id: string;
  family: string;
  kind: PlatformKind;
}

const rules: PlatformRule[] = [
  { pattern: /^microsoft windows$|^windows pc$|^windows$/i, id: 'windows', family: 'PC', kind: 'desktop' },
  { pattern: /^linux$/i, id: 'linux', family: 'PC', kind: 'desktop' },
  { pattern: /^macos$|^mac os$/i, id: 'macos', family: 'PC', kind: 'desktop' },
  { pattern: /^dos$|^ms-dos$/i, id: 'dos', family: 'PC', kind: 'desktop' },
  { pattern: /^playstation$/i, id: 'playstation', family: 'PlayStation', kind: 'console' },
  { pattern: /^playstation 2$/i, id: 'playstation-2', family: 'PlayStation', kind: 'console' },
  { pattern: /^playstation 3$/i, id: 'playstation-3', family: 'PlayStation', kind: 'console' },
  { pattern: /^playstation 4$/i, id: 'playstation-4', family: 'PlayStation', kind: 'console' },
  { pattern: /^playstation 5$/i, id: 'playstation-5', family: 'PlayStation', kind: 'console' },
  { pattern: /^playstation portable$|^psp$/i, id: 'playstation-portable', family: 'PlayStation', kind: 'handheld' },
  { pattern: /^playstation vita$|^ps vita$/i, id: 'playstation-vita', family: 'PlayStation', kind: 'handheld' },
  { pattern: /^xbox$/i, id: 'xbox', family: 'Xbox', kind: 'console' },
  { pattern: /^xbox 360$/i, id: 'xbox-360', family: 'Xbox', kind: 'console' },
  { pattern: /^xbox one$/i, id: 'xbox-one', family: 'Xbox', kind: 'console' },
  { pattern: /^xbox series/i, id: 'xbox-series', family: 'Xbox', kind: 'console' },
  { pattern: /^nintendo entertainment system$|^nes$/i, id: 'nintendo-entertainment-system', family: 'Nintendo', kind: 'console' },
  { pattern: /^super nintendo entertainment system$|^snes$/i, id: 'super-nintendo', family: 'Nintendo', kind: 'console' },
  { pattern: /^nintendo 64$/i, id: 'nintendo-64', family: 'Nintendo', kind: 'console' },
  { pattern: /^nintendo gamecube$|^gamecube$/i, id: 'gamecube', family: 'Nintendo', kind: 'console' },
  { pattern: /^wii$/i, id: 'wii', family: 'Nintendo', kind: 'console' },
  { pattern: /^wii u$/i, id: 'wii-u', family: 'Nintendo', kind: 'console' },
  { pattern: /^nintendo switch/i, id: 'nintendo-switch', family: 'Nintendo', kind: 'console' },
  { pattern: /^game boy$/i, id: 'game-boy', family: 'Nintendo', kind: 'handheld' },
  { pattern: /^game boy color$/i, id: 'game-boy-color', family: 'Nintendo', kind: 'handheld' },
  { pattern: /^game boy advance$/i, id: 'game-boy-advance', family: 'Nintendo', kind: 'handheld' },
  { pattern: /^nintendo ds$/i, id: 'nintendo-ds', family: 'Nintendo', kind: 'handheld' },
  { pattern: /^nintendo 3ds$/i, id: 'nintendo-3ds', family: 'Nintendo', kind: 'handheld' },
  { pattern: /^sega mega drive$|^sega genesis$|^mega drive$/i, id: 'mega-drive', family: 'Sega', kind: 'console' },
  { pattern: /^sega saturn$|^saturn$/i, id: 'sega-saturn', family: 'Sega', kind: 'console' },
  { pattern: /^dreamcast$|^sega dreamcast$/i, id: 'dreamcast', family: 'Sega', kind: 'console' },
  { pattern: /^game gear$|^sega game gear$/i, id: 'game-gear', family: 'Sega', kind: 'handheld' },
  { pattern: /^android$/i, id: 'android', family: 'Mobile', kind: 'mobile' },
  { pattern: /^ios$/i, id: 'ios', family: 'Mobile', kind: 'mobile' },
  { pattern: /arcade/i, id: 'arcade', family: 'Arcade', kind: 'arcade' },
];

export interface CanonicalPlatformIdentity {
  id: string;
  family: string;
  kind: PlatformKind;
}

export function normalizePlatformIdentity(name: string): CanonicalPlatformIdentity {
  const trimmed = name.trim();
  const rule = rules.find((candidate) => candidate.pattern.test(trimmed));
  return rule
    ? { id: `platform:${rule.id}`, family: rule.family, kind: rule.kind }
    : {
        id: canonicalId('platform', trimmed),
        family: trimmed || 'Unknown',
        kind: 'other',
      };
}
