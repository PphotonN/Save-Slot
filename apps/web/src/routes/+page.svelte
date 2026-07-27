<script lang="ts">
  import { onMount } from 'svelte';
  import {
    createCollectionEntry,
    type CollectionEntry,
    type CollectionView,
    type ReleaseSnapshot,
    type SearchResult,
    type UserList,
  } from '@save-slot/domain';
  import { fixtureSearchResults } from '@save-slot/domain/fixtures';
  import { detectLocale, type SupportedLocale } from '@save-slot/i18n';
  import { sortSearchResults, type SearchSort } from '@save-slot/providers';
  import {
    createCollectionRepository,
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

  const client = new CatalogClient();
  let repository: CollectionRepository;
  let activeRequest: AbortController | null = null;
  let detailRequest: AbortController | null = null;
  let suggestionRequest: AbortController | null = null;
  let suggestionTimer: ReturnType<typeof setTimeout> | undefined;

  let activeTab = $state<Tab>('search');
  let query = $state('');
  let platformId = $state('all');
  let sort = $state<SearchSort>('relevance');
  let filtersOpen = $state(false);
  let loading = $state(false);
  let loadingMore = $state(false);
  let statusText = $state('Підготовка локальної колекції…');
  let results = $state<SearchResult[]>([]);
  let nextCursor = $state<string | null>(null);
  let totalSearchResults = $state(0);
  let suggestions = $state<SearchSuggestion[]>([]);
  let suggestionsOpen = $state(false);
  let selected = $state<SearchResult | null>(null);
  let entries = $state<CollectionEntry[]>([]);
  let lists = $state<UserList[]>([]);
  let snapshots = $state<Map<string, ReleaseSnapshot>>(new Map());
  let collectionView = $state<CollectionView>('rows');
  let locale = $state<SupportedLocale>('uk');
  let libraryCacheState = $state<LibraryCacheState>('loading');
  let libraryCacheMessage = $state('Підключення до локального файлу колекції…');
  let importInput: HTMLInputElement;

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

  let filteredResults = $derived.by(() => {
    const filtered =
      platformId === 'all'
        ? releaseResults
        : releaseResults.filter((result) => result.releases[0]?.platform.id === platformId);
    return sortSearchResults(filtered, sort);
  });

  let selectedEntry = $derived.by(() => {
    const releaseId = selected?.releases[0]?.id;
    return releaseId ? (entries.find((entry) => entry.releaseId === releaseId) ?? null) : null;
  });

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

  async function loadCollection(): Promise<void> {
    const defaultList = await ensureDefaultList(repository);
    lists = await repository.listLists();
    entries = await repository.listEntries();
    collectionView = defaultList.preferredView;
    const pairs = await Promise.all(
      entries.map(async (entry) => [entry.releaseId, await repository.getSnapshot(entry.releaseId)] as const),
    );
    snapshots = new Map(
      pairs.filter((pair): pair is readonly [string, ReleaseSnapshot] => Boolean(pair[1])),
    );
  }

  async function loadDiscovery(): Promise<void> {
    activeRequest?.abort();
    closeSuggestions();
    const request = new AbortController();
    activeRequest = request;
    loading = true;
    nextCursor = null;
    totalSearchResults = 0;
    statusText = 'Формую нову випадкову кросплатформну добірку…';
    selected = null;
    try {
      const items = await client.discovery(36, request.signal);
      await reveal(items, request.signal);
      totalSearchResults = items.length;
      statusText = `Готово: ${items.length} ігор, ${items.flatMap((item) => item.releases).length} релізів.`;
    } catch (error) {
      if (!request.signal.aborted) {
        statusText = error instanceof Error ? error.message : 'Не вдалося сформувати добірку.';
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
    closeSuggestions();
    const request = new AbortController();
    activeRequest = request;
    loading = true;
    nextCursor = null;
    totalSearchResults = 0;
    selected = null;
    statusText = `Шукаю «${query.trim()}»…`;
    try {
      const page = await client.searchPage(
        {
          query: query.trim(),
          locale,
          limit: 18,
          ...(platformId === 'all' ? {} : { platformId }),
        },
        sort,
        request.signal,
      );
      await reveal(page.items, request.signal);
      nextCursor = page.nextCursor ?? null;
      totalSearchResults = page.total;
      const releaseCount = page.items.flatMap((item) => item.releases).length;
      statusText = page.items.length
        ? `Показано ${results.length} із ${page.total} ігор, ${releaseCount} платформних релізів.`
        : 'За поточним запитом нічого не знайдено.';
    } catch (error) {
      if (!request.signal.aborted) {
        statusText = error instanceof Error ? error.message : 'Пошук завершився помилкою.';
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
    statusText = 'Дозавантажую наступні результати…';
    try {
      const page = await client.searchPage(
        {
          query: query.trim(),
          locale,
          cursor: nextCursor,
          limit: 18,
          ...(platformId === 'all' ? {} : { platformId }),
        },
        sort,
        request.signal,
      );
      await appendReveal(page.items, request.signal);
      nextCursor = page.nextCursor ?? null;
      totalSearchResults = Math.max(totalSearchResults, page.total);
      statusText = `Показано ${results.length} із ${totalSearchResults} ігор.`;
    } catch (error) {
      if (!request.signal.aborted) {
        statusText = error instanceof Error ? error.message : 'Не вдалося дозавантажити результати.';
      }
    } finally {
      if (activeRequest === request) loadingMore = false;
    }
  }

  function changePlatform(value: string): void {
    platformId = value;
    if (query.trim()) void runSearch();
  }

  function changeSort(value: SearchSort): void {
    sort = value;
    if (query.trim()) void runSearch();
  }

  function selectResult(result: SearchResult): void {
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
    detailRequest = request;
    selected = resultFromSnapshot(snapshot);

    try {
      const refreshed = await client.game(snapshot.game.id, request.signal);
      if (!refreshed || request.signal.aborted) return;
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

    const base = createCollectionEntry(release.id);
    const physical = release.formats.some((format) => ['physical', 'disc', 'cartridge'].includes(format));
    const entry: CollectionEntry = {
      ...base,
      status: physical ? 'owned' : 'backlog',
      ownership: physical ? 'physical' : 'digital',
      format: release.formats[0] ?? 'unknown',
      updatedAt: new Date().toISOString(),
    };
    await repository.putSnapshot({ game: result.game, release });
    await repository.putEntry(entry);

    const list = lists[0] ?? (await ensureDefaultList(repository));
    const updatedList: UserList = {
      ...list,
      entryIds: [...new Set([...list.entryIds, entry.id])],
      updatedAt: new Date().toISOString(),
    };
    await repository.putList(updatedList);
    lists = [updatedList, ...lists.filter((item) => item.id !== updatedList.id)];
    entries = [...entries, entry];
    snapshots = new Map(snapshots).set(release.id, { game: result.game, release });
    statusText = `${result.game.title} — ${release.platform.name} додано до колекції.`;
  }

  async function removeEntry(entry: CollectionEntry): Promise<void> {
    await repository.deleteEntry(entry.id);
    entries = entries.filter((item) => item.id !== entry.id);
    lists = await repository.listLists();
    statusText = 'Запис видалено з колекції.';
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
    entries = entries.map((item) => (item.id === updated.id ? updated : item));
  }

  async function changeCollectionView(view: CollectionView): Promise<void> {
    collectionView = view;
    const list = lists[0] ?? (await ensureDefaultList(repository));
    const updated = { ...list, preferredView: view, updatedAt: new Date().toISOString() };
    await repository.putList(updated);
    lists = [updated, ...lists.filter((item) => item.id !== updated.id)];
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
      await loadCollection();
      statusText = 'Колекцію відновлено з резервної копії.';
    } catch (error) {
      statusText = error instanceof Error ? error.message : 'Не вдалося імпортувати колекцію.';
    } finally {
      (event.currentTarget as HTMLInputElement).value = '';
    }
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
  <title>Save Slot — пошук і колекція ігор</title>
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

    <nav class="side-navigation" aria-label="Основна навігація">
      <button class:active={activeTab === 'search'} onclick={() => changeTab('search')} type="button">ПОШУК</button>
      <button class:active={activeTab === 'collection'} onclick={() => changeTab('collection')} type="button">КОЛЕКЦІЯ</button>
      <button onclick={() => changeTab('discovery')} type="button">НОВА ДОБІРКА</button>
      <button class:active={activeTab === 'settings'} onclick={() => changeTab('settings')} type="button">ПАРАМЕТРИ</button>
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
                placeholder="Назва гри, серія, розробник…"
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
          <button class="primary-button" disabled={loading} type="submit">ЗНАЙТИ</button>
        </form>

        <div class="toolbar-row">
          <button class="secondary-button" onclick={() => (filtersOpen = !filtersOpen)} type="button">
            ФІЛЬТРИ {filtersOpen ? '▲' : '▼'}
          </button>
          <button class="secondary-button" disabled={loading} onclick={() => void loadDiscovery()} type="button">
            ВИПАДКОВА ДОБІРКА
          </button>
          {#if filtersOpen}
            <label>
              ПЛАТФОРМА
              <select onchange={(event) => changePlatform((event.currentTarget as HTMLSelectElement).value)} value={platformId}>
                <option value="all">Усі платформи</option>
                {#each platformOptions as platform}
                  <option value={platform.id}>{platform.name}</option>
                {/each}
              </select>
            </label>
            <label>
              СОРТУВАННЯ
              <select onchange={(event) => changeSort((event.currentTarget as HTMLSelectElement).value as SearchSort)} value={sort}>
                <option value="relevance">Точність збігу</option>
                <option value="rating">Рейтинг гравців</option>
                <option value="votes">Кількість оцінок</option>
                <option value="year">Рік</option>
                <option value="title">Назва</option>
              </select>
            </label>
          {/if}
        </div>

        <div class:loading={loading || loadingMore} class="search-status" aria-live="polite">
          <span class="dot"></span>
          <span>{statusText}</span>
        </div>
      </header>

      <section>
        <div class="results-heading">
          <div>
            <p>КАТАЛОГ РЕЛІЗІВ</p>
            <h1>{query.trim() ? `Результати: ${query.trim()}` : 'Випадкова добірка'}</h1>
          </div>
          <span>{filteredResults.length} РЕЛІЗІВ</span>
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
          {#if nextCursor && query.trim()}
            <div class="load-more-row">
              <button class="secondary-button" disabled={loadingMore} onclick={() => void loadMore()} type="button">
                {loadingMore ? 'ЗАВАНТАЖЕННЯ…' : 'ПОКАЗАТИ ЩЕ'}
              </button>
              <span>{results.length} / {totalSearchResults} ІГОР</span>
            </div>
          {/if}
        {:else if !loading}
          <div class="empty-results">
            <strong>НІЧОГО НЕ ЗНАЙДЕНО</strong>
            <span>Змініть запит або платформу.</span>
          </div>
        {/if}
      </section>
    {:else if activeTab === 'collection'}
      <CollectionPanel
        {entries}
        onRemove={(entry) => void removeEntry(entry)}
        onSelect={(snapshot) => void selectSnapshot(snapshot)}
        onUpdate={(entry, patch) => void updateEntry(entry, patch)}
        onViewChange={(view) => void changeCollectionView(view)}
        {snapshots}
        view={collectionView}
      />
    {:else}
      <section class="settings-panel">
        <p class="settings-eyebrow">ЗАСТОСУНОК</p>
        <h1>Параметри</h1>
        <div class="settings-grid">
          <label>
            <span>МОВА ІНТЕРФЕЙСУ</span>
            <select
              onchange={(event) => {
                locale = (event.currentTarget as HTMLSelectElement).value as SupportedLocale;
                localStorage.setItem('save-slot-locale', locale);
              }}
              value={locale}
            >
              <option value="uk">Українська</option>
              <option value="en">English</option>
            </select>
          </label>
          <div class="settings-card">
            <span>ЛОКАЛЬНІ ДАНІ</span>
            <p>
              Робоча копія зберігається в IndexedDB, а вся колекція автоматично дублюється у
              <code>.save-slot-data/library.json</code> всередині папки проєкту. Попередня версія файла
              зберігається як <code>library.backup.json</code>.
            </p>
            <div class:problem={libraryCacheState === 'error' || libraryCacheState === 'unavailable'} class="cache-status">
              <span>{libraryCacheState === 'saved' || libraryCacheState === 'ready' ? '●' : '○'}</span>
              <small>{libraryCacheMessage}</small>
            </div>
            <div class="settings-actions">
              <button class="primary-button" onclick={() => void exportCollection()} type="button">ЕКСПОРТ JSON</button>
              <button class="secondary-button" onclick={() => importInput.click()} type="button">ІМПОРТ JSON</button>
              <input bind:this={importInput} accept="application/json,.json" hidden onchange={importCollection} type="file" />
            </div>
          </div>
          <ApiCacheStatus />
        </div>
      </section>
    {/if}
  </main>
</div>

<nav class="mobile-navigation" aria-label="Мобільна навігація">
  <button class:active={activeTab === 'search'} onclick={() => changeTab('search')} type="button">ПОШУК</button>
  <button class:active={activeTab === 'collection'} onclick={() => changeTab('collection')} type="button">КОЛЕКЦІЯ</button>
  <button onclick={() => changeTab('discovery')} type="button">ДОБІРКА</button>
  <button class:active={activeTab === 'settings'} onclick={() => changeTab('settings')} type="button">ПАРАМЕТРИ</button>
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
