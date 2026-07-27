export const supportedLocales = ['uk', 'en'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

const uk = {
  appName: 'Save Slot',
  search: 'Пошук',
  collection: 'Колекція',
  discovery: 'Добірки',
  settings: 'Налаштування',
  searchPlaceholder: 'Назва гри, серія, розробник…',
  searchAction: 'Знайти',
  filters: 'Фільтри',
  sort: 'Сортування',
  allPlatforms: 'Усі платформи',
  randomSelection: 'Випадкова добірка',
  addToCollection: 'Додати до колекції',
  removeFromCollection: 'Видалити з колекції',
  playerRating: 'Рейтинг гравців',
  personalRating: 'Моя оцінка',
  releaseYear: 'Рік',
  platform: 'Платформа',
  description: 'Опис',
  translate: 'Перекласти',
  original: 'Оригінал',
  screenshots: 'Скриншоти',
  noResults: 'За поточними параметрами нічого не знайдено.',
  loading: 'Завантаження…',
  offline: 'Офлайн-режим',
  listView: 'Список',
  rowView: 'Рядки',
  cartridgeView: 'Картриджі',
  emptyCollection: 'Колекція поки порожня.',
  owned: 'Володію',
  wishlist: 'Бажане',
  backlog: 'Заплановано',
  playing: 'Граю',
  completed: 'Пройдено',
  insertGame: 'Оберіть гру, щоб вставити картридж.',
} as const;

const en: Record<keyof typeof uk, string> = {
  appName: 'Save Slot',
  search: 'Search',
  collection: 'Collection',
  discovery: 'Discover',
  settings: 'Settings',
  searchPlaceholder: 'Game title, series, developer…',
  searchAction: 'Search',
  filters: 'Filters',
  sort: 'Sort',
  allPlatforms: 'All platforms',
  randomSelection: 'Random selection',
  addToCollection: 'Add to collection',
  removeFromCollection: 'Remove from collection',
  playerRating: 'Player rating',
  personalRating: 'My rating',
  releaseYear: 'Year',
  platform: 'Platform',
  description: 'Description',
  translate: 'Translate',
  original: 'Original',
  screenshots: 'Screenshots',
  noResults: 'No games match the current parameters.',
  loading: 'Loading…',
  offline: 'Offline mode',
  listView: 'List',
  rowView: 'Rows',
  cartridgeView: 'Cartridges',
  emptyCollection: 'Your collection is empty.',
  owned: 'Owned',
  wishlist: 'Wishlist',
  backlog: 'Backlog',
  playing: 'Playing',
  completed: 'Completed',
  insertGame: 'Select a game to insert its cartridge.',
};

export type MessageKey = keyof typeof uk;
export type Messages = Record<MessageKey, string>;

export const messages: Record<SupportedLocale, Messages> = { uk, en };

export function normalizeLocale(value?: string | null): SupportedLocale {
  const language = value?.toLocaleLowerCase().split('-')[0];
  return supportedLocales.includes(language as SupportedLocale)
    ? (language as SupportedLocale)
    : 'uk';
}

export function detectLocale(preferred?: string | null): SupportedLocale {
  if (preferred) return normalizeLocale(preferred);
  if (typeof navigator !== 'undefined') return normalizeLocale(navigator.language);
  return 'uk';
}

export function translate(locale: SupportedLocale, key: MessageKey): string {
  return messages[locale][key];
}

export interface DescriptionTranslationRequest {
  text: string;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}

export interface DescriptionTranslator {
  readonly id: string;
  translate(request: DescriptionTranslationRequest, signal?: AbortSignal): Promise<string>;
}
