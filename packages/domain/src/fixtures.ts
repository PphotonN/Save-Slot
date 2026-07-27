import {
  gameSchema,
  releaseSchema,
  searchResultSchema,
  type Game,
  type Platform,
  type Release,
  type SearchResult,
} from './index';

const source = (provider: 'wikidata' | 'steam' | 'libretro', id: string, url: string) => ({
  provider,
  id,
  url,
});

const platforms: Record<string, Platform> = {
  ps1: {
    id: 'platform:playstation',
    name: 'PlayStation',
    family: 'PlayStation',
    kind: 'console',
    generation: 5,
    sourceRefs: [source('wikidata', 'Q10677', 'https://www.wikidata.org/wiki/Q10677')],
  },
  n64: {
    id: 'platform:nintendo-64',
    name: 'Nintendo 64',
    family: 'Nintendo',
    kind: 'console',
    generation: 5,
    sourceRefs: [source('wikidata', 'Q184839', 'https://www.wikidata.org/wiki/Q184839')],
  },
  gamecube: {
    id: 'platform:gamecube',
    name: 'Nintendo GameCube',
    family: 'Nintendo',
    kind: 'console',
    generation: 6,
    sourceRefs: [source('wikidata', 'Q182172', 'https://www.wikidata.org/wiki/Q182172')],
  },
  pc: {
    id: 'platform:windows',
    name: 'Windows PC',
    family: 'PC',
    kind: 'desktop',
    sourceRefs: [source('wikidata', 'Q1406', 'https://www.wikidata.org/wiki/Q1406')],
  },
  vita: {
    id: 'platform:playstation-vita',
    name: 'PlayStation Vita',
    family: 'PlayStation',
    kind: 'handheld',
    generation: 8,
    sourceRefs: [source('wikidata', 'Q188808', 'https://www.wikidata.org/wiki/Q188808')],
  },
  gba: {
    id: 'platform:game-boy-advance',
    name: 'Game Boy Advance',
    family: 'Nintendo',
    kind: 'handheld',
    generation: 6,
    sourceRefs: [source('wikidata', 'Q188642', 'https://www.wikidata.org/wiki/Q188642')],
  },
  dreamcast: {
    id: 'platform:dreamcast',
    name: 'Dreamcast',
    family: 'Sega',
    kind: 'console',
    generation: 6,
    sourceRefs: [source('wikidata', 'Q184198', 'https://www.wikidata.org/wiki/Q184198')],
  },
};

function createGame(input: {
  id: string;
  title: string;
  descriptionUk: string;
  descriptionEn: string;
  genres: string[];
  developers: string[];
  publishers: string[];
  wikidataId: string;
  releaseId: string;
}): Game {
  return gameSchema.parse({
    id: input.id,
    title: input.title,
    aliases: [],
    descriptions: [
      {
        locale: 'uk',
        text: input.descriptionUk,
        official: false,
        source: source(
          'wikidata',
          input.wikidataId,
          `https://www.wikidata.org/wiki/${input.wikidataId}`,
        ),
      },
      {
        locale: 'en',
        text: input.descriptionEn,
        official: false,
        source: source(
          'wikidata',
          input.wikidataId,
          `https://www.wikidata.org/wiki/${input.wikidataId}`,
        ),
      },
    ],
    genres: input.genres,
    developers: input.developers,
    publishers: input.publishers,
    franchises: [],
    releaseIds: [input.releaseId],
    sourceRefs: [
      source(
        'wikidata',
        input.wikidataId,
        `https://www.wikidata.org/wiki/${input.wikidataId}`,
      ),
    ],
  });
}

function createRelease(input: {
  id: string;
  gameId: string;
  title: string;
  platform: Platform;
  year: number;
  format: 'disc' | 'cartridge' | 'download';
  cover: string;
  coverProvider: 'steam' | 'libretro';
  coverId: string;
  rating: number;
  votes: number;
}): Release {
  const coverSource = source(input.coverProvider, input.coverId, input.cover);
  return releaseSchema.parse({
    id: input.id,
    gameId: input.gameId,
    platform: input.platform,
    title: input.title,
    year: input.year,
    region: 'worldwide',
    formats: [input.format],
    media: [
      {
        id: `media:${input.id}:cover`,
        gameId: input.gameId,
        releaseId: input.id,
        platformId: input.platform.id,
        kind: 'cover-front',
        url: input.cover,
        verified: true,
        source: coverSource,
      },
    ],
    ratings: [
      {
        id: `rating:${input.id}:players`,
        gameId: input.gameId,
        releaseId: input.id,
        kind: 'player',
        score: input.rating,
        votes: input.votes,
        platformScope: input.platform.name,
        source: coverSource,
      },
    ],
    sourceRefs: [coverSource],
  });
}

const definitions = [
  {
    id: 'game:metal-gear-solid',
    releaseId: 'release:metal-gear-solid:ps1:worldwide',
    title: 'Metal Gear Solid',
    descriptionUk:
      'Тактичний стелс-екшен про проникнення Соліда Снейка на захоплений ядерний об’єкт Шедоу-Мозес.',
    descriptionEn:
      'A tactical stealth action game about Solid Snake infiltrating the captured Shadow Moses nuclear facility.',
    genres: ['Стелс', 'Екшен'],
    developers: ['Konami Computer Entertainment Japan'],
    publishers: ['Konami'],
    wikidataId: 'Q215667',
    platform: platforms.ps1,
    year: 1998,
    format: 'disc' as const,
    cover:
      'https://thumbnails.libretro.com/Sony%20-%20PlayStation/Named_Boxarts/Metal%20Gear%20Solid%20(USA).png',
    coverProvider: 'libretro' as const,
    coverId: 'Sony - PlayStation/Metal Gear Solid (USA)',
    rating: 94,
    votes: 18500,
  },
  {
    id: 'game:ocarina-of-time',
    releaseId: 'release:ocarina-of-time:n64:worldwide',
    title: 'The Legend of Zelda: Ocarina of Time',
    descriptionUk:
      'Пригода Лінка в Гайрулі, де подорожі між дитинством і дорослим віком допомагають протистояти Ґанондорфу.',
    descriptionEn:
      'Link explores Hyrule and travels between childhood and adulthood to oppose Ganondorf.',
    genres: ['Пригодницький екшен'],
    developers: ['Nintendo EAD'],
    publishers: ['Nintendo'],
    wikidataId: 'Q184198',
    platform: platforms.n64,
    year: 1998,
    format: 'cartridge' as const,
    cover:
      'https://thumbnails.libretro.com/Nintendo%20-%20Nintendo%2064/Named_Boxarts/Legend%20of%20Zelda%2C%20The%20-%20Ocarina%20of%20Time%20(USA).png',
    coverProvider: 'libretro' as const,
    coverId: 'Nintendo 64/Ocarina of Time (USA)',
    rating: 96,
    votes: 42000,
  },
  {
    id: 'game:metroid-prime',
    releaseId: 'release:metroid-prime:gamecube:worldwide',
    title: 'Metroid Prime',
    descriptionUk:
      'Самус Аран досліджує планету Таллон IV, сканує залишки цивілізації чозо та протистоїть космічним піратам.',
    descriptionEn:
      'Samus Aran explores Tallon IV, scans Chozo ruins and fights the Space Pirates.',
    genres: ['Пригодницький екшен', 'Шутер від першої особи'],
    developers: ['Retro Studios'],
    publishers: ['Nintendo'],
    wikidataId: 'Q738805',
    platform: platforms.gamecube,
    year: 2002,
    format: 'disc' as const,
    cover:
      'https://thumbnails.libretro.com/Nintendo%20-%20GameCube/Named_Boxarts/Metroid%20Prime%20(USA).png',
    coverProvider: 'libretro' as const,
    coverId: 'Nintendo GameCube/Metroid Prime (USA)',
    rating: 93,
    votes: 22000,
  },
  {
    id: 'game:half-life-2',
    releaseId: 'release:half-life-2:windows:worldwide',
    title: 'Half-Life 2',
    descriptionUk:
      'Ґордон Фрімен повертається до світу, окупованого Альянсом, і приєднується до спротиву в Сіті 17.',
    descriptionEn:
      'Gordon Freeman returns to a world occupied by the Combine and joins the resistance in City 17.',
    genres: ['Шутер від першої особи'],
    developers: ['Valve'],
    publishers: ['Valve'],
    wikidataId: 'Q191808',
    platform: platforms.pc,
    year: 2004,
    format: 'download' as const,
    cover:
      'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/220/library_600x900_2x.jpg',
    coverProvider: 'steam' as const,
    coverId: '220',
    rating: 97,
    votes: 250000,
  },
  {
    id: 'game:castlevania-symphony-of-the-night',
    releaseId: 'release:castlevania-symphony-of-the-night:ps1:worldwide',
    title: 'Castlevania: Symphony of the Night',
    descriptionUk:
      'Алукард досліджує перевернутий замок Дракули у нелінійній пригоді з рольовим розвитком.',
    descriptionEn:
      "Alucard explores Dracula's inverted castle in a nonlinear action role-playing adventure.",
    genres: ['Метроїдванія', 'Рольовий екшен'],
    developers: ['Konami Computer Entertainment Tokyo'],
    publishers: ['Konami'],
    wikidataId: 'Q1047155',
    platform: platforms.ps1,
    year: 1997,
    format: 'disc' as const,
    cover:
      'https://thumbnails.libretro.com/Sony%20-%20PlayStation/Named_Boxarts/Castlevania%20-%20Symphony%20of%20the%20Night%20(USA).png',
    coverProvider: 'libretro' as const,
    coverId: 'Sony - PlayStation/Symphony of the Night (USA)',
    rating: 95,
    votes: 16000,
  },
  {
    id: 'game:persona-4-golden',
    releaseId: 'release:persona-4-golden:vita:worldwide',
    title: 'Persona 4 Golden',
    descriptionUk:
      'Група школярів розслідує серію вбивств у містечку Інаба та відкриває надприродний світ усередині телевізора.',
    descriptionEn:
      'A group of students investigates murders in Inaba and discovers a supernatural world inside televisions.',
    genres: ['JRPG', 'Соціальний симулятор'],
    developers: ['Atlus'],
    publishers: ['Atlus'],
    wikidataId: 'Q7167946',
    platform: platforms.vita,
    year: 2012,
    format: 'cartridge' as const,
    cover:
      'https://thumbnails.libretro.com/Sony%20-%20PlayStation%20Vita/Named_Boxarts/Persona%204%20Golden%20(USA).png',
    coverProvider: 'libretro' as const,
    coverId: 'PlayStation Vita/Persona 4 Golden (USA)',
    rating: 93,
    votes: 33000,
  },
  {
    id: 'game:advance-wars',
    releaseId: 'release:advance-wars:gba:worldwide',
    title: 'Advance Wars',
    descriptionUk:
      'Покрокова стратегія про командування сухопутними, повітряними та морськими силами на компактних картах.',
    descriptionEn:
      'A turn-based strategy game about commanding land, air and naval units on compact battlefields.',
    genres: ['Покрокова стратегія'],
    developers: ['Intelligent Systems'],
    publishers: ['Nintendo'],
    wikidataId: 'Q4685834',
    platform: platforms.gba,
    year: 2001,
    format: 'cartridge' as const,
    cover:
      'https://thumbnails.libretro.com/Nintendo%20-%20Game%20Boy%20Advance/Named_Boxarts/Advance%20Wars%20(USA).png',
    coverProvider: 'libretro' as const,
    coverId: 'Game Boy Advance/Advance Wars (USA)',
    rating: 91,
    votes: 8500,
  },
  {
    id: 'game:sonic-adventure',
    releaseId: 'release:sonic-adventure:dreamcast:worldwide',
    title: 'Sonic Adventure',
    descriptionUk:
      'Шість персонажів із різними стилями проходження протистоять доктору Еґґману та істоті Хаос.',
    descriptionEn:
      'Six playable characters with different styles oppose Doctor Eggman and the creature Chaos.',
    genres: ['Платформер', 'Пригодницький екшен'],
    developers: ['Sonic Team'],
    publishers: ['Sega'],
    wikidataId: 'Q1056905',
    platform: platforms.dreamcast,
    year: 1998,
    format: 'disc' as const,
    cover:
      'https://thumbnails.libretro.com/Sega%20-%20Dreamcast/Named_Boxarts/Sonic%20Adventure%20(USA).png',
    coverProvider: 'libretro' as const,
    coverId: 'Dreamcast/Sonic Adventure (USA)',
    rating: 88,
    votes: 14000,
  },
];

export const fixtureSearchResults: SearchResult[] = definitions.map((definition, index) => {
  const game = createGame(definition);
  const release = createRelease({
    id: definition.releaseId,
    gameId: definition.id,
    title: definition.title,
    platform: definition.platform,
    year: definition.year,
    format: definition.format,
    cover: definition.cover,
    coverProvider: definition.coverProvider,
    coverId: definition.coverId,
    rating: definition.rating,
    votes: definition.votes,
  });

  return searchResultSchema.parse({
    game,
    releases: [release],
    relevance: 1 - index * 0.04,
    providers: ['wikidata', definition.coverProvider],
  });
});

export const fixtureGames = fixtureSearchResults.map((result) => result.game);
export const fixtureReleases = fixtureSearchResults.flatMap((result) => result.releases);
