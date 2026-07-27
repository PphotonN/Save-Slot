import type { CollectionView, SearchResult } from '@save-slot/domain';

export const collectionViews: ReadonlyArray<{
  id: CollectionView;
  labelKey: 'listView' | 'rowView' | 'cartridgeView';
}> = [
  { id: 'list', labelKey: 'listView' },
  { id: 'rows', labelKey: 'rowView' },
  { id: 'cartridges', labelKey: 'cartridgeView' },
];

export const searchSorts = [
  { id: 'relevance', labelUk: 'Точність збігу', labelEn: 'Relevance' },
  { id: 'rating', labelUk: 'Рейтинг гравців', labelEn: 'Player rating' },
  { id: 'votes', labelUk: 'Кількість оцінок', labelEn: 'Rating count' },
  { id: 'year', labelUk: 'Рік', labelEn: 'Year' },
  { id: 'title', labelUk: 'Назва', labelEn: 'Title' },
] as const;

export type SearchSortId = (typeof searchSorts)[number]['id'];

export interface RevealItem {
  id: string;
  order: number;
}

export class StableRevealOrder {
  private readonly order = new Map<string, number>();
  private counter = 0;

  clear(): void {
    this.order.clear();
    this.counter = 0;
  }

  accept(ids: Iterable<string>): void {
    for (const id of ids) {
      if (!this.order.has(id)) this.order.set(id, this.counter++);
    }
  }

  sort<T extends { game: { id: string } }>(items: T[]): T[] {
    this.accept(items.map((item) => item.game.id));
    return [...items].sort(
      (left, right) =>
        (this.order.get(left.game.id) ?? Number.MAX_SAFE_INTEGER) -
        (this.order.get(right.game.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  snapshot(): RevealItem[] {
    return [...this.order.entries()].map(([id, order]) => ({ id, order }));
  }
}

export function releaseKey(result: SearchResult): string {
  return result.releases[0]?.id ?? result.game.id;
}

export const appBreakpoints = {
  compact: 520,
  mobile: 760,
  tablet: 1040,
} as const;

export const ps1Palette = {
  background: '#080b0d',
  panel: '#111719',
  panelRaised: '#182124',
  line: '#2c3a3f',
  text: '#eef2ed',
  muted: '#89979a',
  accent: '#e0b93e',
  accentCool: '#6dd6b1',
  danger: '#e76f65',
} as const;
