import type {
  CollectionGrouping,
  CollectionStatus,
  CopyCompleteness,
  CopyCondition,
  Ownership,
  ReleaseFormat,
  UserList,
} from '@save-slot/domain';

export const supportedLocales = ['uk', 'en'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

const uk = {
  appName: 'Save Slot',
  search: 'Пошук',
  collection: 'Колекція',
  discovery: 'Добірка',
  settings: 'Параметри',
  searchPlaceholder: 'Назва гри, серія, розробник…',
  searchAction: 'Знайти',
  filters: 'Фільтри',
  filtersOpen: 'Фільтри ▲',
  filtersClosed: 'Фільтри ▼',
  sort: 'Сортування',
  allPlatforms: 'Усі платформи',
  randomSelection: 'Випадкова добірка',
  newSelection: 'Нова добірка',
  platform: 'Платформа',
  relevance: 'Точність збігу',
  playerRating: 'Рейтинг гравців',
  ratingCount: 'Кількість оцінок',
  releaseYear: 'Рік',
  title: 'Назва',
  releaseCatalogue: 'Каталог релізів',
  searchResults: 'Результати: {query}',
  showMore: 'Показати ще',
  loading: 'Завантаження…',
  noResultsTitle: 'Нічого не знайдено',
  changeSearchOrPlatform: 'Змініть запит або платформу.',
  preparingCollection: 'Підготовка локальної колекції…',
  buildingDiscovery: 'Формую нову випадкову кросплатформну добірку…',
  discoveryReady: 'Готово: {games} ігор, {releases} релізів.',
  discoveryError: 'Не вдалося сформувати добірку.',
  searchingFor: 'Шукаю «{query}»…',
  searchShown: 'Показано {shown} із {total} ігор, {releases} платформних релізів.',
  noSearchResults: 'За поточним запитом нічого не знайдено.',
  searchError: 'Пошук завершився помилкою.',
  loadingMore: 'Дозавантажую наступні результати…',
  gamesShown: 'Показано {shown} із {total} ігор.',
  loadMoreError: 'Не вдалося дозавантажити результати.',
  gamesCounter: '{shown} / {total} ігор',
  addToCollection: 'Додати до колекції',
  removeFromCollection: 'Видалити з колекції',
  addedToCollection: '{title} — {platform} додано до колекції.',
  entryRemoved: 'Запис видалено з колекції.',
  entrySaved: 'Запис збережено.',
  listMembershipUpdated: 'Належність до списків оновлено.',
  listAlreadyExists: 'Такий системний список уже існує.',
  listDeleted: 'Список видалено. Ігри залишились у колекції.',
  collectionRestored: 'Колекцію відновлено з резервної копії.',
  collectionImportError: 'Не вдалося імпортувати колекцію.',
  personalRating: 'Моя оцінка',
  description: 'Опис',
  translate: 'Перекласти',
  original: 'Оригінал',
  screenshots: 'Скриншоти',
  ratings: 'Оцінки',
  sources: 'Джерела',
  overview: 'Огляд',
  offline: 'Офлайн-режим',
  listView: 'Список',
  rowView: 'Середні рядки',
  cartridgeView: 'Картриджі',
  personalLibrary: 'Власна бібліотека',
  createList: 'Створити',
  addList: '+ Список',
  deleteList: 'Видалити список',
  listType: 'Тип',
  listName: 'Назва',
  newList: 'Новий список',
  searchCollection: 'Пошук у списку…',
  status: 'Статус',
  allStatuses: 'Усі статуси',
  grouping: 'Групування',
  noGrouping: 'Без групування',
  groupByPlatform: 'За платформою',
  shown: '{shown} з {total}',
  resetFilters: 'Скинути фільтри',
  emptyList: 'Список порожній',
  addThroughEditor: 'Додайте гру до цього списку через редактор запису.',
  noMatches: 'Немає збігів',
  changeCollectionFilters: 'Змініть пошук або фільтри колекції.',
  priority: 'Пріоритет',
  playersShort: 'Гравці',
  myRatingShort: 'Моя',
  editEntry: 'Редагувати запис',
  removeEntry: 'Видалити',
  editCopy: 'Редагування копії',
  ownership: 'Володіння',
  format: 'Формат',
  boxCondition: 'Стан коробки',
  mediaCondition: 'Стан носія',
  completeness: 'Комплектність',
  quantity: 'Кількість',
  acquiredAt: 'Дата придбання',
  price: 'Ціна',
  currency: 'Валюта',
  lists: 'Списки',
  customCover: 'Власна обкладинка',
  customCoverPlaceholder: 'https://example.com/cover.jpg',
  reset: 'Скинути',
  tagsCommaSeparated: 'Теги через кому',
  tagsPlaceholder: 'ретро, улюблене, запечатане',
  notes: 'Нотатки',
  notesPlaceholder: 'Стан копії, комплектація, прогрес або інші примітки…',
  cancel: 'Скасувати',
  save: 'Зберегти',
  invalidCoverUrl: 'Власна обкладинка повинна мати коректну адресу HTTP або HTTPS.',
  application: 'Застосунок',
  interfaceLanguage: 'Мова інтерфейсу',
  localData: 'Локальні дані',
  localDataDescription: 'Робоча копія зберігається в IndexedDB, а вся колекція автоматично дублюється у .save-slot-data/library.json всередині папки проєкту. Попередня версія файла зберігається як library.backup.json.',
  exportJson: 'Експорт JSON',
  importJson: 'Імпорт JSON',
  languageUkrainian: 'Українська',
  languageEnglish: 'English',
  statusOwned: 'Володію',
  statusWishlist: 'Бажане',
  statusBacklog: 'Заплановано',
  statusPlaying: 'Граю',
  statusCompleted: 'Пройдено',
  statusMastered: '100%',
  statusPaused: 'Відкладено',
  statusDropped: 'Покинуто',
  ownershipPhysical: 'Фізична копія',
  ownershipDigital: 'Цифрова копія',
  ownershipSubscription: 'Підписка',
  ownershipBorrowed: 'Позичено',
  ownershipNone: 'Не вказано',
  formatPhysical: 'Фізичне видання',
  formatDigital: 'Цифрове видання',
  formatCartridge: 'Картридж',
  formatDisc: 'Диск',
  formatDownload: 'Завантаження',
  formatStreaming: 'Стримінг',
  unknown: 'Не вказано',
  conditionMint: 'Як нова',
  conditionExcellent: 'Відмінний',
  conditionGood: 'Добрий',
  conditionFair: 'Задовільний',
  conditionPoor: 'Поганий',
  conditionDamaged: 'Пошкоджений',
  completenessSealed: 'Запечатана',
  completenessComplete: 'Повний комплект',
  completenessMissingManual: 'Без інструкції',
  completenessMissingInserts: 'Без вкладень',
  completenessBoxOnly: 'Лише коробка',
  completenessMediaOnly: 'Лише носій',
  completenessLoose: 'Без коробки',
  presetCollection: 'Колекція',
  presetWishlist: 'Бажане',
  presetBacklog: 'Заплановано',
  presetCustom: 'Власний список',
} as const;

const en: Record<keyof typeof uk, string> = {
  appName: 'Save Slot',
  search: 'Search',
  collection: 'Collection',
  discovery: 'Discover',
  settings: 'Settings',
  searchPlaceholder: 'Game title, series, developer…',
  searchAction: 'Find',
  filters: 'Filters',
  filtersOpen: 'Filters ▲',
  filtersClosed: 'Filters ▼',
  sort: 'Sorting',
  allPlatforms: 'All platforms',
  randomSelection: 'Random selection',
  newSelection: 'New selection',
  platform: 'Platform',
  relevance: 'Relevance',
  playerRating: 'Player rating',
  ratingCount: 'Rating count',
  releaseYear: 'Year',
  title: 'Title',
  releaseCatalogue: 'Release catalogue',
  searchResults: 'Results: {query}',
  showMore: 'Show more',
  loading: 'Loading…',
  noResultsTitle: 'Nothing found',
  changeSearchOrPlatform: 'Change the query or platform.',
  preparingCollection: 'Preparing the local collection…',
  buildingDiscovery: 'Building a new random cross-platform selection…',
  discoveryReady: 'Ready: {games} games, {releases} releases.',
  discoveryError: 'Could not build the selection.',
  searchingFor: 'Searching for “{query}”…',
  searchShown: 'Showing {shown} of {total} games and {releases} platform releases.',
  noSearchResults: 'Nothing was found for the current query.',
  searchError: 'Search failed.',
  loadingMore: 'Loading more results…',
  gamesShown: 'Showing {shown} of {total} games.',
  loadMoreError: 'Could not load more results.',
  gamesCounter: '{shown} / {total} games',
  addToCollection: 'Add to collection',
  removeFromCollection: 'Remove from collection',
  addedToCollection: '{title} — {platform} added to the collection.',
  entryRemoved: 'Entry removed from the collection.',
  entrySaved: 'Entry saved.',
  listMembershipUpdated: 'List membership updated.',
  listAlreadyExists: 'That system list already exists.',
  listDeleted: 'List deleted. Games remain in the collection.',
  collectionRestored: 'Collection restored from backup.',
  collectionImportError: 'Could not import the collection.',
  personalRating: 'My rating',
  description: 'Description',
  translate: 'Translate',
  original: 'Original',
  screenshots: 'Screenshots',
  ratings: 'Ratings',
  sources: 'Sources',
  overview: 'Overview',
  offline: 'Offline mode',
  listView: 'List',
  rowView: 'Medium rows',
  cartridgeView: 'Cartridges',
  personalLibrary: 'Personal library',
  createList: 'Create',
  addList: '+ List',
  deleteList: 'Delete list',
  listType: 'Type',
  listName: 'Name',
  newList: 'New list',
  searchCollection: 'Search this list…',
  status: 'Status',
  allStatuses: 'All statuses',
  grouping: 'Grouping',
  noGrouping: 'No grouping',
  groupByPlatform: 'By platform',
  shown: '{shown} of {total}',
  resetFilters: 'Reset filters',
  emptyList: 'List is empty',
  addThroughEditor: 'Add a game to this list through the entry editor.',
  noMatches: 'No matches',
  changeCollectionFilters: 'Change collection search or filters.',
  priority: 'Priority',
  playersShort: 'Players',
  myRatingShort: 'Mine',
  editEntry: 'Edit entry',
  removeEntry: 'Remove',
  editCopy: 'Edit copy',
  ownership: 'Ownership',
  format: 'Format',
  boxCondition: 'Box condition',
  mediaCondition: 'Media condition',
  completeness: 'Completeness',
  quantity: 'Quantity',
  acquiredAt: 'Acquired date',
  price: 'Price',
  currency: 'Currency',
  lists: 'Lists',
  customCover: 'Custom cover',
  customCoverPlaceholder: 'https://example.com/cover.jpg',
  reset: 'Reset',
  tagsCommaSeparated: 'Comma-separated tags',
  tagsPlaceholder: 'retro, favourite, sealed',
  notes: 'Notes',
  notesPlaceholder: 'Copy condition, contents, progress or other notes…',
  cancel: 'Cancel',
  save: 'Save',
  invalidCoverUrl: 'The custom cover must be a valid HTTP or HTTPS address.',
  application: 'Application',
  interfaceLanguage: 'Interface language',
  localData: 'Local data',
  localDataDescription: 'The working copy is stored in IndexedDB, while the full collection is mirrored automatically to .save-slot-data/library.json inside the project directory. The previous file is kept as library.backup.json.',
  exportJson: 'Export JSON',
  importJson: 'Import JSON',
  languageUkrainian: 'Українська',
  languageEnglish: 'English',
  statusOwned: 'Owned',
  statusWishlist: 'Wishlist',
  statusBacklog: 'Backlog',
  statusPlaying: 'Playing',
  statusCompleted: 'Completed',
  statusMastered: '100%',
  statusPaused: 'Paused',
  statusDropped: 'Dropped',
  ownershipPhysical: 'Physical copy',
  ownershipDigital: 'Digital copy',
  ownershipSubscription: 'Subscription',
  ownershipBorrowed: 'Borrowed',
  ownershipNone: 'Not specified',
  formatPhysical: 'Physical edition',
  formatDigital: 'Digital edition',
  formatCartridge: 'Cartridge',
  formatDisc: 'Disc',
  formatDownload: 'Download',
  formatStreaming: 'Streaming',
  unknown: 'Not specified',
  conditionMint: 'Mint',
  conditionExcellent: 'Excellent',
  conditionGood: 'Good',
  conditionFair: 'Fair',
  conditionPoor: 'Poor',
  conditionDamaged: 'Damaged',
  completenessSealed: 'Sealed',
  completenessComplete: 'Complete',
  completenessMissingManual: 'Missing manual',
  completenessMissingInserts: 'Missing inserts',
  completenessBoxOnly: 'Box only',
  completenessMediaOnly: 'Media only',
  completenessLoose: 'Loose',
  presetCollection: 'Collection',
  presetWishlist: 'Wishlist',
  presetBacklog: 'Backlog',
  presetCustom: 'Custom list',
};

export type MessageKey = keyof typeof uk;
export type Messages = Record<MessageKey, string>;
export type MessageValues = Record<string, string | number>;

export const messages: Record<SupportedLocale, Messages> = { uk, en };

const statusKeys: Record<CollectionStatus, MessageKey> = {
  owned: 'statusOwned',
  wishlist: 'statusWishlist',
  backlog: 'statusBacklog',
  playing: 'statusPlaying',
  completed: 'statusCompleted',
  mastered: 'statusMastered',
  paused: 'statusPaused',
  dropped: 'statusDropped',
};

const ownershipKeys: Record<Ownership, MessageKey> = {
  physical: 'ownershipPhysical',
  digital: 'ownershipDigital',
  subscription: 'ownershipSubscription',
  borrowed: 'ownershipBorrowed',
  none: 'ownershipNone',
};

const formatKeys: Record<ReleaseFormat, MessageKey> = {
  physical: 'formatPhysical',
  digital: 'formatDigital',
  cartridge: 'formatCartridge',
  disc: 'formatDisc',
  download: 'formatDownload',
  streaming: 'formatStreaming',
  unknown: 'unknown',
};

const conditionKeys: Record<CopyCondition, MessageKey> = {
  mint: 'conditionMint',
  excellent: 'conditionExcellent',
  good: 'conditionGood',
  fair: 'conditionFair',
  poor: 'conditionPoor',
  damaged: 'conditionDamaged',
  unknown: 'unknown',
};

const completenessKeys: Record<CopyCompleteness, MessageKey> = {
  sealed: 'completenessSealed',
  complete: 'completenessComplete',
  'missing-manual': 'completenessMissingManual',
  'missing-inserts': 'completenessMissingInserts',
  'box-only': 'completenessBoxOnly',
  'media-only': 'completenessMediaOnly',
  loose: 'completenessLoose',
  unknown: 'unknown',
};

const presetKeys: Record<UserList['preset'], MessageKey> = {
  collection: 'presetCollection',
  wishlist: 'presetWishlist',
  backlog: 'presetBacklog',
  custom: 'presetCustom',
};

const groupingKeys: Record<CollectionGrouping, MessageKey> = {
  none: 'noGrouping',
  platform: 'groupByPlatform',
};

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

export function formatMessage(
  locale: SupportedLocale,
  key: MessageKey,
  values: MessageValues = {},
): string {
  return translate(locale, key).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

export function statusLabel(locale: SupportedLocale, value: CollectionStatus): string {
  return translate(locale, statusKeys[value]);
}

export function ownershipLabel(locale: SupportedLocale, value: Ownership): string {
  return translate(locale, ownershipKeys[value]);
}

export function formatLabel(locale: SupportedLocale, value: ReleaseFormat): string {
  return translate(locale, formatKeys[value]);
}

export function conditionLabel(locale: SupportedLocale, value: CopyCondition): string {
  return translate(locale, conditionKeys[value]);
}

export function completenessLabel(locale: SupportedLocale, value: CopyCompleteness): string {
  return translate(locale, completenessKeys[value]);
}

export function presetLabel(locale: SupportedLocale, value: UserList['preset']): string {
  return translate(locale, presetKeys[value]);
}

export function groupingLabel(locale: SupportedLocale, value: CollectionGrouping): string {
  return translate(locale, groupingKeys[value]);
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
