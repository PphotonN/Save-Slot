import { describe, expect, it, vi } from 'vitest';
import {
  completenessLabel,
  conditionLabel,
  detectLocale,
  formatLabel,
  formatMessage,
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

  it('formats dynamic values without losing unknown placeholders', () => {
    expect(
      formatMessage('uk', 'searchShown', { shown: 18, total: 40, releases: 24 }),
    ).toBe('Показано 18 із 40 ігор, 24 платформних релізів.');
    expect(formatMessage('en', 'addedToCollection', { title: 'Rez', platform: 'Dreamcast' })).toBe(
      'Rez — Dreamcast added to the collection.',
    );
    expect(formatMessage('en', 'searchResults')).toBe('Results: {query}');
  });

  it('uses Ukrainian when neither stored nor browser locale requests English', () => {
    vi.stubGlobal('navigator', { language: 'uk-UA' });
    expect(detectLocale(null)).toBe('uk');
    expect(translate('uk', 'collection')).toBe('Колекція');
    vi.unstubAllGlobals();
  });
});
