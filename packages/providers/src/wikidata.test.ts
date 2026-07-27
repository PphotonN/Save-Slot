import { describe, expect, it } from 'vitest';
import { WikidataProvider } from './wikidata';

function claimEntity(id: string) {
  return { mainsnak: { datavalue: { value: { id } } } };
}

function claimString(value: string) {
  return { mainsnak: { datavalue: { value } } };
}

const fakeFetch: typeof fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
  const action = url.searchParams.get('action');

  if (action === 'wbsearchentities') {
    return Response.json({
      search: [{ id: 'QTEST', label: 'Test Game', description: 'video game' }],
    });
  }

  if (action === 'wbgetentities') {
    const ids = url.searchParams.get('ids')?.split('|') ?? [];
    if (ids.includes('QTEST')) {
      return Response.json({
        entities: {
          QTEST: {
            id: 'QTEST',
            labels: { en: { language: 'en', value: 'Test Game' } },
            descriptions: {
              en: { language: 'en', value: 'A test action game.' },
            },
            aliases: { en: [{ language: 'en', value: 'Test Alias' }] },
            claims: {
              P31: [claimEntity('Q7889')],
              P400: [claimEntity('Q10677')],
              P136: [claimEntity('Q270948')],
              P178: [claimEntity('QDEV')],
              P123: [claimEntity('QPUB')],
              P577: [
                {
                  mainsnak: {
                    datavalue: { value: { time: '+1998-09-03T00:00:00Z' } },
                  },
                },
              ],
              P18: [claimString('Test Game cover.jpg')],
              P1733: [claimString('12345')],
            },
          },
        },
      });
    }

    const entities = Object.fromEntries(
      ids.map((id) => [
        id,
        {
          id,
          labels: {
            en: {
              language: 'en',
              value:
                id === 'Q10677'
                  ? 'PlayStation'
                  : id === 'Q270948'
                    ? 'Action game'
                    : id === 'QDEV'
                      ? 'Test Developer'
                      : 'Test Publisher',
            },
          },
        },
      ]),
    );
    return Response.json({ entities });
  }

  return new Response(null, { status: 404 });
};

describe('WikidataProvider', () => {
  it('normalizes a Wikidata entity into game and release records', async () => {
    const provider = new WikidataProvider({ fetchImpl: fakeFetch, timeoutMs: 1_000 });
    const page = await provider.search({ query: 'Test Game', locale: 'en', limit: 10 });
    const result = page.items[0];
    const release = result?.releases[0];

    expect(result?.game.title).toBe('Test Game');
    expect(result?.game.aliases).toContain('Test Alias');
    expect(result?.game.developers).toContain('Test Developer');
    expect(result?.game.publishers).toContain('Test Publisher');
    expect(release?.platform.name).toBe('PlayStation');
    expect(release?.year).toBe(1998);
    expect(release?.media[0]?.kind).toBe('cover-front');
    expect(release?.sourceRefs.some((source) => source.provider === 'steam')).toBe(true);
  });

  it('returns an empty successful page for an empty query', async () => {
    const provider = new WikidataProvider({ fetchImpl: fakeFetch });
    const page = await provider.search({ query: '' });
    expect(page.items).toEqual([]);
    expect(page.providers[0]?.available).toBe(true);
  });
});
