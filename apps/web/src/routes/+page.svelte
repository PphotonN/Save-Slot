<script lang="ts">
  import { onMount } from 'svelte';
  import {
    createCollectionEntry,
    type CollectionEntry,
    type CollectionGrouping,
    type CollectionView,
    type ReleaseSnapshot,
    type SearchResult,
    type UserList,
  } from '@save-slot/domain';
  import { fixtureSearchResults } from '@save-slot/domain/fixtures';
  import {
    detectLocale,
    formatMessage,
    translate,
    type MessageKey,
    type MessageValues,
    type SupportedLocale,
  } from '@save-slot/i18n';
  import {
    sortSearchResults,
    type ProviderStatus,
    type SearchSort,
    type SearchSortDirection,
  } from '@save-slot/providers';
  import {
    createCollectionRepository,
    createUserList,
    ensureDefaultList,
    type CollectionRepository,
  } from '@save-slot/storage';
  import ApiCacheStatus from '$lib/components/ApiCacheStatus.svelte';
  import CollectionPanel from '$lib/components/CollectionPanel.svelte';
  import GameCard from '$lib/components/GameCard.svelte';
  import SlotPanel from '$lib/components/SlotPanel.svelte';
  import { CatalogClient, type SearchSuggestion } from '$lib/catalog-client';

  type Tab = 'search' | 'collection' | 'discovery' | 'settings';
  type LibraryCacheState = 'loading' | 'ready' | 'saved' | 'unavailable' | 'error';
  type LocalizedStatus =
    | { key: MessageKey; values: MessageValues }
    | { text: string };

  const client = new CatalogClient();
  let repository: CollectionRepository;
  let activeRequest: AbortController | null = null;
  let detailRequest: AbortController | null = null;
  let suggestionRequest: AbortController | null = null;
  let suggestionTimer: ReturnType<typeof setTimeout> | undefined;

  let activeTab = $state<Tab>('search');
  let query = $state('');
  let platformId = $state('all');
  let genre = $state('all');
  let yearFrom = $state<number | null>(null);
  let yearTo = $state<number | null>(null);
  let sort = $state<SearchSort>('relevance');
  let sortDirection = $state<SearchSortDirection>('desc');
  let filtersOpen = $state(true);
  let loading = $state(false);
  let loadingMore = $state(false);
  let statusMessage = $state<LocalizedStatus>({ key: 'preparingCollection', values: {} });
  let results = $state<SearchResult[]>([]);
  let nextCursor = $state<string | null>(null);
  let totalSearchResults = $state(0);
  let suggestions = $state<SearchSuggestion[]>([]);
  let suggestionsOpen = $state(false);
  let providerStatuses = $state<ProviderStatus[]>([]);
  let selectionVersion = 0;
  let selected = $state<SearchResult | null>(null);
  let entries = $state<CollectionEntry[]>([]);
  let lists = $state<UserList[]>([]);
  let activeListId = $state('');
  let snapshots = $state<Map<string, ReleaseSnapshot>>(new Map());
  let collectionView = $state<CollectionView>('rows');
  let collectionGrouping = $state<CollectionGrouping>('none');
  let locale = $state<SupportedLocale>('uk');
  let libraryCacheState = $state<LibraryCacheState>('loading');
  let libraryCacheMessage = $state('');
  let importInput: HTMLInputElement;

  let statusText = $derived.by(() =>
    'text' in statusMessage
      ? statusMessage.text
      : formatMessage(locale, statusMessage.key, statusMessage.values),
  );

  const searchCopy = {
    uk: {
      filters: 'Фільтри пошуку', genre: 'Жанр', allGenres: 'Усі жанри', yearFrom: 'Рік від', yearTo: 'Рік до',
      anyYear: 'Будь-який', direction: 'Порядок', descending: 'Від більшого до меншого', ascending: 'Від меншого до більшого',
      reset: 'Скинути', sources: 'Джерела даних', catalogueSource: 'Джерело каталогу', unavailable: 'Недоступне',
    },
    en: {
      filters: 'Search filters', genre: 'Genre', allGenres: 'All genres', yearFrom: 'Year from', yearTo: 'Year to',
      anyYear: 'Any', direction: 'Order', descending: 'High to low', ascending: 'Low to high',
      reset: 'Reset', sources: 'Data sources', catalogueSource: 'Catalogue source', unavailable: 'Unavailable',
    },
  } as const;
  let searchText = $derived(searchCopy[locale]);

  let releaseResults = $derived.by(() =>
    results.flatMap((result) =>
      result.releases.map((release) => ({
        ...result,
        game: { ...result.game, releaseIds: [release.id] },
        releases: [release],
      })),
    ),
  );

  let platformOptions = $derived.by(() =>
    [...new Map(
      [...fixtureSearchResults, ...results]
        .flatMap((result) => result.releases)
        .map((release) => [release.platform.id, release.platform]),
    ).values()].sort((left, right) => left.name.localeCompare(right.name, locale)),
  );

  let genreOptions = $derived.by(() =>
    [...new Set([...fixtureSearchResults, ...results].flatMap((result) => result.game.genres).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, locale)),
  );

  let yearOptions = $derived.by(() =>
    [...new Set(
      [...fixtureSearchResults, ...results]
        .flatMap((result) => result.releases)
        .map((release) => release.year)
        .filter((year): year is number => year != null),
    )].sort((left, right) => right - left),
  );

  let visibleProviderStatuses = $derived.by(() =>
    [...new Map(providerStatuses.map((provider) => [provider.id, provider])).values()],
  );

  let filteredResults = $derived.by(() => {
    const filtered = releaseResults.filter((result) => {
      const release = result.releases[0];
      if (!release) return false;
      if (platformId !== 'all' && release.platform.id !== platformId) return false;
      if (genre !== 'all' && !result.game.genres.includes(genre)) return false;
      if (yearFrom != null && (release.year ?? -Infinity) < yearFrom) return false;
      if (yearTo != null && (release.year ?? Infinity) > yearTo) return false;
      return true;
    });
    return sortSearchResults(filtered, sort, sortDirection);
  });

  let selectedEntry = $derived.by(() => {
    const releaseId = selected?.releases[0]?.id;
    return releaseId ? (entries.find((entry) => entry.releaseId === releaseId) ?? null) : null;
  });

  function setStatus(key: MessageKey, values: MessageValues = {}): void {
    statusMessage = { key, values };
  }

  function setRawStatus(text: string): void {
    statusMessage = { text };
  }

  function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, milliseconds);
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  }

  function mergeResultItems(current: SearchResult[], incoming: SearchResult[]): SearchResult[] {
    const order = current.map((result) => result.game.id);
    const map = new Map(current.map((result) => [result.game.id, result]));
    for (const item of incoming) {
      const existing = map.get(item.game.id);
      if (!existing) {
        map.set(item.game.id, item);
        order.push(item.game.id);
        continue;
      }
      const releases = new Map(
        [...existing.releases, ...item.releases].map((release) => [release.id, release]),
      );
      map.set(item.game.id, {
        ...existing,
        game: { ...item.game, releaseIds: [...releases.keys()] },
        releases: [...releases.values()],
        relevance: Math.max(existing.relevance, item.relevance),
        providers: [...new Set([...existing.providers, ...item.providers])],
      });
    }
    return order.map((id) => map.get(id)).filter((item): item is SearchResult => Boolean(item));
  }

  async function reveal(items: SearchResult[], signal: AbortSignal): Promise<void> {
    results = [];
    for (const item of items) {
      signal.throwIfAborted();
      results = mergeResultItems(results, [item]);
      await wait(34, signal);
    }
  }

  async function appendReveal(items: SearchResult[], signal: AbortSignal): Promise<void> {
    for (const item of items) {
      signal.throwIfAborted();
      results = mergeResultItems(results, [item]);
      await wait(34, signal);
    }
  }

  function closeSuggestions(): void {
    suggestionsOpen = false;
    suggestions = [];
    suggestionRequest?.abort();
  }

  function scheduleSuggestions(): void {
    if (suggestionTimer) clearTimeout(suggestionTimer);
    suggestionRequest?.abort();
    const value = query.trim();
    if (value.length < 2) {
      suggestions = [];
      suggestionsOpen = false;
      return;
    }

    suggestionTimer = setTimeout(() => {
      const request = new AbortController();
      suggestionRequest = request;
      void (async () => {
        try {
          suggestions = await client.suggestions(value, locale, 6, request.signal);
          suggestionsOpen = suggestions.length > 0 && query.trim() === value;
        } catch (error) {
          if (!request.signal.aborted) console.warn('[Save Slot] Suggestions failed:', error);
        }
      })();
    }, 260);
  }

  function chooseSuggestion(suggestion: SearchSuggestion): void {
    query = suggestion.title;
    closeSuggestions();
    void runSearch();
  }

  async function refreshCollectionState(): Promise<void> {
    lists = await repository.listLists();
    entries = await repository.listEntries();
  }

  async function loadCollection(): Promise<void> {
    const defaultList = await ensureDefaultList(repository);
    await refreshCollectionState();
    if (!lists.some((list) => list.id === activeListId)) activeListId = defaultList.id;
    const activeList = lists.find((list) => list.id === activeListId) ?? defaultList;
    collectionView = activeList.preferredView;
    collectionGrouping = activeList.groupBy;
    const pairs = await Promise.all(
      entries.map(async (entry) => [entry.releaseId, await repository.getSnapshot(entry.releaseId)] as const),
    );
    snapshots = new Map(
      pairs.filter((pair): pair is readonly [string, ReleaseSnapshot] => Boolean(pair[1])),
    );
  }

  async function loadDiscovery(): Promise<void> {
    activeRequest?.abort();
    loadingMore = false;
    closeSuggestions();
    const request = new AbortController();
    activeRequest = request;
    loading = true;
    nextCursor = null;
    totalSearchResults = 0;
    setStatus('buildingDiscovery');
    detailRequest?.abort();
    selectionVersion += 1;
    selected = null;
    try {
      const [items, providers] = await Promise.all([
        client.discovery(36, request.signal),
        client.providers(request.signal),
      ]);
      providerStatuses = providers;
      await reveal(items, request.signal);
      totalSearchResults = items.length;
      setStatus('discoveryReady', {
        games: items.length,
        releases: items.flatMap((item) => item.releases).length,
      });
    } catch (error) {
      if (!request.signal.aborted) {
        if (error instanceof Error) setRawStatus(error.message);
        else setStatus('discoveryError');
      }
    } finally {
      if (activeRequest === request) loading = false;
    }
  }

  async function runSearch(): Promise<void> {
    if (!query.trim()) {
      await loadDiscovery();
      return;
    }
    activeRequest?.abort();
    loadingMore = false;
    closeSuggestions();
    const request = new AbortController();
    activeRequest = request;
    loading = true;
    nextCursor = null;
    totalSearchResults = 0;
    detailRequest?.abort();
    selectionVersion += 1;
    selected = null;
    setStatus('searchingFor', { query: query.trim() });
    try {
      const page = await client.searchPage(
        {
          query: query.trim(),
          locale,
          limit: 18,
          ...(platformId === 'all' ? {} : { platformId }),
          ...(genre === 'all' ? {} : { genre }),
          ...(yearFrom == null ? {} : { yearFrom }),
          ...(yearTo == null ? {} : { yearTo }),
        },
        sort,
        sortDirection,
        request.signal,
      );
      await reveal(page.items, request.signal);
      nextCursor = page.nextCursor ?? null;
      totalSearchResults = page.total;
      providerStatuses = page.providers;
      const releaseCount = page.items.flatMap((item) => item.releases).length;
      if (page.items.length) {
        setStatus('searchShown', {
          shown: results.length,
          total: page.total,
          releases: releaseCount,
        });
      } else {
        setStatus('noSearchResults');
      }
    } catch (error) {
      if (!request.signal.aborted) {
        if (error instanceof Error) setRawStatus(error.message);
        else setStatus('searchError');
      }
    } finally {
      if (activeRequest === request) loading = false;
    }
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore || !query.trim()) return;
    const request = new AbortController();
    activeRequest?.abort();
    activeRequest = request;
    loadingMore = true;
    setStatus('loadingMore');
    try {
      const page = await client.searchPage(
        {
          query: query.trim(),
          locale,
          cursor: nextCursor,
          limit: 18,
          ...(platformId === 'all' ? {} : { platformId }),
          ...(genre === 'all' ? {} : { genre }),
          ...(yearFrom == null ? {} : { yearFrom }),
          ...(yearTo == null ? {} : { yearTo }),
        },
        sort,
        sortDirection,
        request.signal,
      );
      await appendReveal(page.items, request.signal);
      nextCursor = page.nextCursor ?? null;
      totalSearchResults = Math.max(totalSearchResults, page.total);
      providerStatuses = page.providers;
      setStatus('gamesShown', { shown: results.length, total: totalSearchResults });
    } catch (error) {
      if (!request.signal.aborted) {
        if (error instanceof Error) setRawStatus(error.message);
        else setStatus('loadMoreError');
      }
    } finally {
      loadingMore = false;
    }
  }

  function changePlatform(value: string): void {
    platformId = value;
    if (query.trim()) void runSearch();
  }

  function changeGenre(value: string): void {
    genre = value;
    if (query.trim()) void runSearch();
  }

  function changeYearFrom(value: string): void {
    yearFrom = value ? Number(value) : null;
    if (yearFrom != null && yearTo != null && yearFrom > yearTo) yearTo = yearFrom;
    if (query.trim()) void runSearch();
  }

  function changeYearTo(value: string): void {
    yearTo = value ? Number(value) : null;
    if (yearFrom != null && yearTo != null && yearTo < yearFrom) yearFrom = yearTo;
    if (query.trim()) void runSearch();
  }

  function changeSort(value: SearchSort): void {
    sort = value;
    if (query.trim()) void runSearch();
  }

  function changeSortDirection(value: SearchSortDirection): void {
    sortDirection = value;
    if (query.trim()) void runSearch();
  }

  function resetSearchFilters(): void {
    platformId = 'all';
    genre = 'all';
    yearFrom = null;
    yearTo = null;
    sort = 'relevance';
    sortDirection = 'desc';
    if (query.trim()) void runSearch();
  }

  function providerName(provider: ProviderStatus['id']): string {
    const names: Record<ProviderStatus['id'], string> = {
      igdb: 'IGDB', wikidata: 'Wikidata', mobygames: 'MobyGames', rawg: 'RAWG', steam: 'Steam',
      libretro: 'Libretro', pcgamingwiki: 'PCGamingWiki', wikipedia: 'Wikipedia',
      'official-store': locale === 'uk' ? 'Офіційний магазин' : 'Official store',
      manual: locale === 'uk' ? 'Локальний каталог' : 'Local catalogue',
    };
    return names[provider];
  }

  function selectResult(result: SearchResult): void {
    selectionVersion += 1;
    detailRequest?.abort();
    const activeRelease = result.releases[0];
    const groupedResult = results.find((candidate) => candidate.game.id === result.game.id);
    if (!activeRelease || !groupedResult) {
      selected = result;
      return;
    }
    selected = {
      ...groupedResult,
      releases: [
        activeRelease,
        ...groupedResult.releases.filter((release) => release.id !== activeRelease.id),
      ],
    };
  }

  function selectRelease(releaseId: string): void {
    if (!selected) return;
    detailRequest?.abort();
    selectionVersion += 1;
    const release = selected.releases.find((candidate) => candidate.id === releaseId);
    if (!release) return;
    selected = {
      ...selected,
      releases: [release, ...selected.releases.filter((candidate) => candidate.id !== releaseId)],
    };
  }

  function resultFromSnapshot(snapshot: ReleaseSnapshot): SearchResult {
    return {
      game: snapshot.game,
      releases: [snapshot.release],
      relevance: 1,
      providers: [...new Set(snapshot.release.sourceRefs.map((source) => source.provider))],
    };
  }

  async function selectSnapshot(snapshot: ReleaseSnapshot): Promise<void> {
    detailRequest?.abort();
    const request = new AbortController();
    const version = ++selectionVersion;
    detailRequest = request;
    selected = resultFromSnapshot(snapshot);

    try {
      const refreshed = await client.game(snapshot.game.id, request.signal);
      if (!refreshed || request.signal.aborted || version !== selectionVersion) return;
      const activeRelease = refreshed.releases.find((release) => release.id === snapshot.release.id);
      if (!activeRelease) return;

      selected = {
        ...refreshed,
        releases: [
          activeRelease,
          ...refreshed.releases.filter((release) => release.id !== activeRelease.id),
        ],
      };
      const refreshedSnapshot = { game: refreshed.game, release: activeRelease };
      await repository.putSnapshot(refreshedSnapshot);
      snapshots = new Map(snapshots).set(activeRelease.id, refreshedSnapshot);
    } catch (error) {
      if (!request.signal.aborted) {
        console.warn('[Save Slot] Cached detail refresh failed:', error);
      }
    }
  }

  async function toggleCollection(result: SearchResult): Promise<void> {
    const release = result.releases[0];
    if (!release) return;
    const existing = entries.find((entry) => entry.releaseId === release.id);
    if (existing) {
      await removeEntry(existing);
      return;
    }

    const collectionList =
      lists.find((list) => list.preset === 'collection') ?? (await ensureDefaultList(repository));
    const base = createCollectionEntry(release.id);
    const physical = release.formats.some((format) => ['physical', 'disc', 'cartridge'].includes(format));
    const entry: CollectionEntry = {
      ...base,
      listIds: [collectionList.id],
      status: physical ? 'owned' : 'backlog',
      ownership: physical ? 'physical' : 'digital',
      format: release.formats[0] ?? 'unknown',
      updatedAt: new Date().toISOString(),
    };
    await repository.putSnapshot({ game: result.game, release });
    await repository.putEntry(entry);
    await refreshCollectionState();
    snapshots = new Map(snapshots).set(release.id, { game: result.game, release });
    setStatus('addedToCollection', { title: result.game.title, platform: release.platform.name });
  }

  async function removeEntry(entry: CollectionEntry): Promise<void> {
    await repository.deleteEntry(entry.id);
    await refreshCollectionState();
    setStatus('entryRemoved');
  }

  async function updateEntry(
    entry: CollectionEntry,
    patch: Partial<CollectionEntry>,
  ): Promise<void> {
    const personalRating = Object.prototype.hasOwnProperty.call(patch, 'personalRating')
      ? patch.personalRating == null
        ? null
        : Math.min(100, Math.max(0, patch.personalRating))
      : entry.personalRating;
    const updated: CollectionEntry = {
      ...entry,
      ...patch,
      personalRating,
      updatedAt: new Date().toISOString(),
    };
    await repository.putEntry(updated);
    await refreshCollectionState();
    setStatus('entrySaved');
  }

  async function setEntryLists(entry: CollectionEntry, listIds: string[]): Promise<void> {
    await repository.setEntryLists(entry.id, listIds);
    await refreshCollectionState();
    setStatus('listMembershipUpdated');
  }

  function changeActiveList(listId: string): void {
    const list = lists.find((candidate) => candidate.id === listId);
    if (!list) return;
    activeListId = list.id;
    collectionView = list.preferredView;
    collectionGrouping = list.groupBy;
  }

  async function createList(name: string, preset: UserList['preset']): Promise<void> {
    if (preset === 'collection') {
      const collection = await ensureDefaultList(repository);
      await refreshCollectionState();
      changeActiveList(collection.id);
      return;
    }
    if (preset !== 'custom') {
      const existing = lists.find((list) => list.preset === preset);
      if (existing) {
        changeActiveList(existing.id);
        setStatus('listAlreadyExists');
        return;
      }
    }
    const list = createUserList(name, preset);
    await repository.putList(list);
    await refreshCollectionState();
    activeListId = list.id;
    collectionView = list.preferredView;
    collectionGrouping = list.groupBy;
    setStatus('listMembershipUpdated');
  }

  async function deleteList(list: UserList): Promise<void> {
    if (list.preset === 'collection') return;
    await repository.deleteList(list.id);
    const defaultList = await ensureDefaultList(repository);
    await refreshCollectionState();
    activeListId = defaultList.id;
    collectionView = defaultList.preferredView;
    collectionGrouping = defaultList.groupBy;
    setStatus('listDeleted');
  }

  async function activeCollectionList(): Promise<UserList> {
    return (
      lists.find((candidate) => candidate.id === activeListId) ??
      lists.find((candidate) => candidate.preset === 'collection') ??
      (await ensureDefaultList(repository))
    );
  }

  async function changeCollectionView(view: CollectionView): Promise<void> {
    collectionView = view;
    const list = await activeCollectionList();
    await repository.putList({
      ...list,
      preferredView: view,
      updatedAt: new Date().toISOString(),
    });
    await refreshCollectionState();
  }

  async function changeCollectionGrouping(grouping: CollectionGrouping): Promise<void> {
    collectionGrouping = grouping;
    const list = await activeCollectionList();
    await repository.putList({
      ...list,
      groupBy: grouping,
      updatedAt: new Date().toISOString(),
    });
    await refreshCollectionState();
  }

  async function exportCollection(): Promise<void> {
    const payload = await repository.exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `save-slot-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function importCollection(event: Event): Promise<void> {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await repository.importData(JSON.parse(await file.text()));
      activeListId = '';
      await loadCollection();
      setStatus('collectionRestored');
    } catch (error) {
      if (error instanceof Error) setRawStatus(error.message);
      else setStatus('collectionImportError');
    } finally {
      (event.currentTarget as HTMLInputElement).value = '';
    }
  }

  async function refreshCatalogueAfterCacheClear(): Promise<void> {
    activeRequest?.abort();
    detailRequest?.abort();
    suggestionRequest?.abort();
    closeSuggestions();
    results = [];
    nextCursor = null;
    totalSearchResults = 0;
    providerStatuses = [];
    selected = null;
    selectionVersion += 1;
    if (query.trim()) await runSearch();
    else await loadDiscovery();
  }

  function changeLocale(value: SupportedLocale): void {
    locale = value;
    localStorage.setItem('save-slot-locale', value);
    document.documentElement.lang = value;
    if (query.trim()) scheduleSuggestions();
  }

  function changeTab(tab: Tab): void {
    if (tab === 'discovery') {
      activeTab = 'search';
      void loadDiscovery();
      return;
    }
    activeTab = tab;
  }

  onMount(() => {
    const handleLibraryCacheStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status: LibraryCacheState; message: string }>).detail;
      if (!detail) return;
      libraryCacheState = detail.status;
      libraryCacheMessage = detail.message;
    };

    window.addEventListener('save-slot-library-cache', handleLibraryCacheStatus);

    void (async () => {
      locale = detectLocale(localStorage.getItem('save-slot-locale'));
      document.documentElement.lang = locale;
      repository = createCollectionRepository();
      await loadCollection();
      await loadDiscovery();
    })();

    return () => {
      activeRequest?.abort();
      detailRequest?.abort();
      suggestionRequest?.abort();
      if (suggestionTimer) clearTimeout(suggestionTimer);
      window.removeEventListener('save-slot-library-cache', handleLibraryCacheStatus);
    };
  });
</script>

<svelte:head>
  <title>{translate(locale, 'appName')} — {translate(locale, 'search')} / {translate(locale, 'collection')}</title>
</svelte:head>

<div class="app-shell">
  <aside class="side-column">
    <SlotPanel
      entry={selectedEntry}
      {locale}
      onRatingChange={(value) => {
        if (selectedEntry) void updateEntry(selectedEntry, { personalRating: value });
      }}
      onReleaseChange={selectRelease}
      onToggleCollection={() => {
        if (selected) void toggleCollection(selected);
      }}
      {selected}
    />

    <nav class="side-navigation" aria-label={translate(locale, 'appName')}>
      <button class:active={activeTab === 'search'} onclick={() => changeTab('search')} type="button">{translate(locale, 'search').toLocaleUpperCase(locale)}</button>
      <button class:active={activeTab === 'collection'} onclick={() => changeTab('collection')} type="button">{translate(locale, 'collection').toLocaleUpperCase(locale)}</button>
      <button onclick={() => changeTab('discovery')} type="button">{translate(locale, 'newSelection').toLocaleUpperCase(locale)}</button>
      <button class:active={activeTab === 'settings'} onclick={() => changeTab('settings')} type="button">{translate(locale, 'settings').toLocaleUpperCase(locale)}</button>
    </nav>
  </aside>

  <main class="main-workspace">
    {#if activeTab === 'search'}
      <header class="search-header">
        <form
          class="search-form"
          onsubmit={(event) => {
            event.preventDefault();
            void runSearch();
          }}
        >
          <div class="search-suggest-wrap">
            <label class="search-field">
              <span>&gt;</span>
              <input
                bind:value={query}
                onblur={() => setTimeout(() => (suggestionsOpen = false), 140)}
                onfocus={() => (suggestionsOpen = suggestions.length > 0)}
                oninput={scheduleSuggestions}
                placeholder={translate(locale, 'searchPlaceholder')}
                type="search"
              />
            </label>
            {#if suggestionsOpen && suggestions.length}
              <div class="suggestion-menu">
                {#each suggestions as suggestion (suggestion.id)}
                  <button onmousedown={(event) => event.preventDefault()} onclick={() => chooseSuggestion(suggestion)} type="button">
                    <strong>{suggestion.title}</strong>
                    {#if suggestion.platforms.length}<span>{suggestion.platforms.join(' · ')}</span>{/if}
                    {#if suggestion.description}<small>{suggestion.description}</small>{/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <button class="primary-button" disabled={loading} type="submit">{translate(locale, 'searchAction').toLocaleUpperCase(locale)}</button>
        </form>

        <div class="toolbar-row">
          <button class="secondary-button" onclick={() => (filtersOpen = !filtersOpen)} type="button">
            {searchText.filters.toLocaleUpperCase(locale)}
          </button>
          <button class="secondary-button" disabled={loading} onclick={() => void loadDiscovery()} type="button">
            {translate(locale, 'randomSelection').toLocaleUpperCase(locale)}
          </button>
          {#if filtersOpen}
            <div class="search-filter-grid">
              <label>
                {translate(locale, 'platform').toLocaleUpperCase(locale)}
                <select onchange={(event) => changePlatform((event.currentTarget as HTMLSelectElement).value)} value={platformId}>
                  <option value="all">{translate(locale, 'allPlatforms')}</option>
                  {#each platformOptions as platform}<option value={platform.id}>{platform.name}</option>{/each}
                </select>
              </label>
              <label>
                {searchText.genre.toLocaleUpperCase(locale)}
                <select onchange={(event) => changeGenre((event.currentTarget as HTMLSelectElement).value)} value={genre}>
                  <option value="all">{searchText.allGenres}</option>
                  {#each genreOptions as option}<option value={option}>{option}</option>{/each}
                </select>
              </label>
              <label>
                {searchText.yearFrom.toLocaleUpperCase(locale)}
                <select onchange={(event) => changeYearFrom((event.currentTarget as HTMLSelectElement).value)} value={yearFrom ?? ''}>
                  <option value="">{searchText.anyYear}</option>
                  {#each yearOptions as option}<option value={option}>{option}</option>{/each}
                </select>
              </label>
              <label>
                {searchText.yearTo.toLocaleUpperCase(locale)}
                <select onchange={(event) => changeYearTo((event.currentTarget as HTMLSelectElement).value)} value={yearTo ?? ''}>
                  <option value="">{searchText.anyYear}</option>
                  {#each yearOptions as option}<option value={option}>{option}</option>{/each}
                </select>
              </label>
              <label>
                {translate(locale, 'sort').toLocaleUpperCase(locale)}
                <select onchange={(event) => changeSort((event.currentTarget as HTMLSelectElement).value as SearchSort)} value={sort}>
                  <option value="relevance">{translate(locale, 'relevance')}</option>
                  <option value="rating">{translate(locale, 'playerRating')}</option>
                  <option value="votes">{translate(locale, 'ratingCount')}</option>
                  <option value="year">{translate(locale, 'releaseYear')}</option>
                  <option value="title">{translate(locale, 'title')}</option>
                </select>
              </label>
              <label>
                {searchText.direction.toLocaleUpperCase(locale)}
                <select onchange={(event) => changeSortDirection((event.currentTarget as HTMLSelectElement).value as SearchSortDirection)} value={sortDirection}>
                  <option value="desc">{searchText.descending}</option>
                  <option value="asc">{searchText.ascending}</option>
                </select>
              </label>
              <button class="filter-reset" onclick={resetSearchFilters} type="button">{searchText.reset.toLocaleUpperCase(locale)}</button>
            </div>
          {/if}
        </div>

        {#if visibleProviderStatuses.length}
          <div class="source-status-row" aria-label={searchText.sources}>
            <strong>{searchText.sources.toLocaleUpperCase(locale)}</strong>
            {#each visibleProviderStatuses as provider (provider.id)}
              <span class:unavailable={!provider.available} title={provider.message ?? ''}>
                {providerName(provider.id)}{provider.available ? '' : ' · ' + searchText.unavailable}
              </span>
            {/each}
          </div>
        {/if}

        <div class:loading={loading || loadingMore} class="search-status" aria-live="polite">
          <span class="dot"></span>
          <span>{statusText}</span>
        </div>
      </header>

      <section>
        <div class="results-heading">
          <div>
            <p>{translate(locale, 'releaseCatalogue').toLocaleUpperCase(locale)}</p>
            <h1>{query.trim() ? formatMessage(locale, 'searchResults', { query: query.trim() }) : translate(locale, 'randomSelection')}</h1>
          </div>
          <span>{filteredResults.length} {locale === 'uk' ? 'РЕЛІЗІВ' : 'RELEASES'}</span>
        </div>

        {#if filteredResults.length}
          <div class="game-grid">
            {#each filteredResults as result, index (result.releases[0]?.id ?? result.game.id)}
              {@const releaseId = result.releases[0]?.id}
              <GameCard
                owned={Boolean(releaseId && entries.some((entry) => entry.releaseId === releaseId))}
                onSelect={() => selectResult(result)}
                onToggle={() => void toggleCollection(result)}
                revealIndex={index}
                {result}
                selected={selected?.releases[0]?.id === releaseId}
              />
            {/each}
          </div>
        {:else if !loading && !nextCursor}
          <div class="empty-results">
            <strong>{translate(locale, 'noResultsTitle').toLocaleUpperCase(locale)}</strong>
            <span>{translate(locale, 'changeSearchOrPlatform')}</span>
          </div>
        {/if}

        {#if nextCursor && query.trim()}
          <div class="load-more-row">
            <button class="secondary-button" disabled={loadingMore} onclick={() => void loadMore()} type="button">
              {translate(locale, loadingMore ? 'loading' : 'showMore').toLocaleUpperCase(locale)}
            </button>
            <span>{formatMessage(locale, 'gamesCounter', { shown: results.length, total: totalSearchResults }).toLocaleUpperCase(locale)}</span>
          </div>
        {/if}
      </section>
    {:else if activeTab === 'collection'}
      <CollectionPanel
        {activeListId}
        {entries}
        groupBy={collectionGrouping}
        {lists}
        {locale}
        onCreateList={createList}
        onDeleteList={deleteList}
        onGroupByChange={changeCollectionGrouping}
        onListChange={changeActiveList}
        onRemove={removeEntry}
        onSelect={(snapshot) => void selectSnapshot(snapshot)}
        onSetEntryLists={setEntryLists}
        onUpdate={updateEntry}
        onViewChange={changeCollectionView}
        {snapshots}
        view={collectionView}
      />
    {:else}
      <section class="settings-panel">
        <p class="settings-eyebrow">{translate(locale, 'application').toLocaleUpperCase(locale)}</p>
        <h1>{translate(locale, 'settings')}</h1>
        <div class="settings-grid">
          <label>
            <span>{translate(locale, 'interfaceLanguage').toLocaleUpperCase(locale)}</span>
            <select
              onchange={(event) => changeLocale((event.currentTarget as HTMLSelectElement).value as SupportedLocale)}
              value={locale}
            >
              <option value="uk">{translate(locale, 'languageUkrainian')}</option>
              <option value="en">{translate(locale, 'languageEnglish')}</option>
            </select>
          </label>
          <div class="settings-card">
            <span>{translate(locale, 'localData').toLocaleUpperCase(locale)}</span>
            <p>{translate(locale, 'localDataDescription')}</p>
            <div class:problem={libraryCacheState === 'error' || libraryCacheState === 'unavailable'} class="cache-status">
              <span>{libraryCacheState === 'saved' || libraryCacheState === 'ready' ? '●' : '○'}</span>
              <small>{libraryCacheMessage || translate(locale, 'preparingCollection')}</small>
            </div>
            <div class="settings-actions">
              <button class="primary-button" onclick={() => void exportCollection()} type="button">{translate(locale, 'exportJson').toLocaleUpperCase(locale)}</button>
              <button class="secondary-button" onclick={() => importInput.click()} type="button">{translate(locale, 'importJson').toLocaleUpperCase(locale)}</button>
              <input bind:this={importInput} accept="application/json,.json" hidden onchange={importCollection} type="file" />
            </div>
          </div>
          <ApiCacheStatus {locale} onCleared={refreshCatalogueAfterCacheClear} />
        </div>
      </section>
    {/if}
  </main>
</div>

<nav class="mobile-navigation" aria-label={translate(locale, 'appName')}>
  <button class:active={activeTab === 'search'} onclick={() => changeTab('search')} type="button">{translate(locale, 'search').toLocaleUpperCase(locale)}</button>
  <button class:active={activeTab === 'collection'} onclick={() => changeTab('collection')} type="button">{translate(locale, 'collection').toLocaleUpperCase(locale)}</button>
  <button onclick={() => changeTab('discovery')} type="button">{translate(locale, 'discovery').toLocaleUpperCase(locale)}</button>
  <button class:active={activeTab === 'settings'} onclick={() => changeTab('settings')} type="button">{translate(locale, 'settings').toLocaleUpperCase(locale)}</button>
</nav>

<style>
  .search-suggest-wrap {
    position: relative;
    min-width: 0;
  }

  .suggestion-menu {
    position: absolute;
    z-index: 180;
    top: calc(100% + 5px);
    right: 0;
    left: 0;
    display: grid;
    max-height: min(58vh, 430px);
    overflow-y: auto;
    padding: 5px;
    background: #070b0c;
    border: 1px solid var(--line-strong);
    box-shadow: 0 20px 55px rgba(0, 0, 0, 0.55);
  }

  .suggestion-menu button {
    display: grid;
    gap: 0.3rem;
    padding: 0.72rem;
    color: var(--text);
    text-align: left;
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--line);
  }

  .suggestion-menu button:last-child {
    border-bottom: 0;
  }

  .suggestion-menu button:hover,
  .suggestion-menu button:focus-visible {
    background: var(--panel-raised);
  }

  .suggestion-menu strong {
    font-size: 0.9rem;
  }

  .suggestion-menu span {
    color: var(--accent-cool);
    font: 0.38rem/1.3 var(--pixel-font);
  }

  .suggestion-menu small {
    display: -webkit-box;
    overflow: hidden;
    color: var(--muted);
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .load-more-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;
    margin-top: 1.2rem;
    padding: 1rem;
    border-top: 1px solid var(--line);
  }

  .load-more-row span {
    color: var(--muted);
    font: 0.42rem/1.3 var(--pixel-font);
  }

  .settings-panel {
    max-width: 850px;
  }

  .settings-eyebrow,
  .settings-grid label > span,
  .settings-card > span {
    color: var(--accent-cool);
    font: 0.47rem/1.4 var(--pixel-font);
  }

  .settings-panel h1 {
    margin: 0.4rem 0 1.4rem;
    font-size: clamp(1.6rem, 3vw, 2.5rem);
  }

  .settings-grid {
    display: grid;
    gap: 0.8rem;
  }

  .settings-grid label,
  .settings-card {
    display: grid;
    gap: 0.7rem;
    padding: 1rem;
    background: var(--panel);
    border: 1px solid var(--line);
  }

  .settings-grid select {
    min-height: 44px;
    padding: 0.65rem;
    color: var(--text);
    background: #090d0e;
    border: 1px solid var(--line);
  }

  .settings-card p {
    margin: 0;
    color: var(--muted-light);
    line-height: 1.55;
  }

  .settings-card code {
    color: var(--accent-cool);
  }

  .cache-status {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--accent-cool);
  }

  .cache-status.problem {
    color: var(--danger);
  }

  .cache-status small {
    line-height: 1.45;
  }

  .settings-actions {
    display: flex;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .search-filter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    width: 100%;
    gap: 0.55rem;
    padding: 0.7rem;
    background: rgba(13, 19, 21, 0.92);
    border: 1px solid var(--line);
  }

  .search-filter-grid label { min-width: 0; color: var(--muted-light); font: 600 0.72rem/1.25 Inter, system-ui, sans-serif; }
  .search-filter-grid select { width: 100%; font-size: 0.82rem; }
  .filter-reset { align-self: end; min-height: 42px; padding: 0.65rem; color: var(--muted-light); font: 700 0.72rem/1.2 Inter, system-ui, sans-serif; background: transparent; border: 1px solid var(--line-strong); }
  .source-status-row { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-top: 0.65rem; color: var(--muted-light); }
  .source-status-row strong { color: var(--accent-cool); font-size: 0.72rem; }
  .source-status-row span { padding: 0.3rem 0.48rem; font-size: 0.72rem; background: #101719; border: 1px solid var(--line); }
  .source-status-row span.unavailable { color: var(--danger); border-color: rgba(231,111,101,.45); }
  .suggestion-menu span, .load-more-row span, .settings-eyebrow, .settings-grid label > span, .settings-card > span { font-family: Inter, system-ui, sans-serif; font-size: 0.72rem; font-weight: 600; }

  @media (max-width: 760px) {
    .suggestion-menu {
      position: fixed;
      top: 210px;
      right: 0.75rem;
      left: 0.75rem;
      max-height: 48vh;
    }

    .load-more-row {
      flex-direction: column;
    }
  }
</style>
