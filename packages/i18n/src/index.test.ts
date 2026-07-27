import { describe, expect, it, vi } from 'vitest';
import {
  completenessLabel,
  conditionLabel,
  detectLocale,
  formatLabel,
  groupingLabel,
  messages,
  ownershipLabel,
  presetLabel,
  statusLabel,
  translate,
} from './index';

describe('localization catalogue', () => {
  it('keeps Ukrainian and English message keys identical', () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.uk).sort());
  });

  it('returns domain labels in both languages', () => {
    expect(statusLabel('uk', 'playing')).toBe('Граю');
    expect(statusLabel('en', 'playing')).toBe('Playing');
    expect(ownershipLabel('en', 'physical')).toBe('Physical copy');
    expect(formatLabel('uk', 'cartridge')).toBe('Картридж');
    expect(conditionLabel('en', 'excellent')).toBe('Excellent');
    expect(completenessLabel('uk', 'missing-manual')).toBe('Без інструкції');
    expect(presetLabel('en', 'wishlist')).toBe('Wishlist');
    expect(groupingLabel('uk', 'platform')).toBe('За платформою');
  });

  it('uses Ukrainian when neither stored nor browser locale requests English', () => {
    vi.stubGlobal('navigator', { language: 'uk-UA' });
    expect(detectLocale(null)).toBe('uk');
    expect(translate('uk', 'collection')).toBe('Колекція');
    vi.unstubAllGlobals();
  });
});
