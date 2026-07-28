import { describe, expect, it } from 'vitest';
import { WikidataProvider } from './wikidata-public';

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fixtureFetch(wikipediaQid = 'Q100'): typeof fetch {
  return (async (input) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const action = url.searchParams.get('action');
    const props = url.searchParams.get('props');

    if (action === 'wbsearchentities') {
      return json({
        search: [{ id: 'Q100', label: 'Test Game', description: 'video game' }],
      });
    }

    if (action === 'wbgetentities' && props === 'labels|descriptions|aliases|claims') {
      return json({
        entities: {
          Q100: {
            id: 'Q100',
            labels: {
              uk: { language: 'uk', value: 'Тестова гра' },
              en: { language: 'en', value: 'Test Game' },
            },
            descriptions: {
              uk: { language: 'uk', value: 'відеогра' },
              en: { language: 'en', value: 'video game' },
            },
            aliases: {},
            claims: {
              P31: [{ mainsnak: { datavalue: { value: { id: 'Q7889' } } } }],
              P400: [{ mainsnak: { datavalue: { value: { id: 'Q200' } } } }],
              P577: [{ mainsnak: { datavalue: { value: { time: '+2020-01-02T00:00:00Z' } } } }],
            },
          },
        },
      });
    }

    if (action === 'wbgetentities' && props === 'labels') {
      return json({
        entities: {
          Q200: {
            id: 'Q200',
            labels: {
              uk: { language: 'uk', value: 'Тестова консоль' },
              en: { language: 'en', value: 'Test Console' },
            },
          },
        },
      });
    }

    if (action === 'wbgetentities' && props === 'sitelinks') {
      return json({
        entities: {
          Q100: {
            id: 'Q100',
            sitelinks: {
              ukwiki: { title: 'Тестова гра' },
              enwiki: { title: 'Test Game' },
            },
          },
        },
      });
    }

    if (action === 'query' && url.hostname.endsWith('wikipedia.org')) {
      return json({
        query: {
          pages: [
            {
              pageid: 10,
              title: 'Тестова гра',
              extract:
                'Тестова гра — вигадана відеогра, створена для перевірки автоматичного збагачення каталогу без API-ключів.',
              fullurl: 'https://uk.wikipedia.org/wiki/Тестова_гра',
              pageprops: { wikibase_item: wikipediaQid },
            },
          ],
        },
      });
    }

    return new Response('Not found', { status: 404 });
  }) as typeof fetch;
}

describe('no-key Wikidata and Wikipedia provider', () => {
  it('adds a localized long description only through the exact Wikidata identity', async () => {
    const provider = new WikidataProvider({ fetchImpl: fixtureFetch(), timeoutMs: 1_000 });
    const page = await provider.search({ query: 'Test Game', locale: 'uk', limit: 5 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.game.descriptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          locale: 'uk',
          source: expect.objectContaining({ provider: 'wikipedia' }),
          text: expect.stringContaining('автоматичного збагачення'),
        }),
      ]),
    );
    expect(page.items[0]?.providers).toContain('wikipedia');
    expect(page.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wikipedia', available: true }),
      ]),
    );
  });

  it('rejects a Wikipedia page whose wikibase identity belongs to another entity', async () => {
    const provider = new WikidataProvider({
      fetchImpl: fixtureFetch('Q999'),
      timeoutMs: 1_000,
    });
    const page = await provider.search({ query: 'Test Game', locale: 'uk', limit: 5 });

    expect(page.items).toHaveLength(1);
    expect(
      page.items[0]?.game.descriptions.some(
        (description) => description.source.provider === 'wikipedia',
      ),
    ).toBe(false);
    expect(page.items[0]?.providers).not.toContain('wikipedia');
  });
});
