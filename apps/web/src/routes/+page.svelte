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
  import CollectionPanel from '$lib/components/CollectionPanel.svelte';
  import GameCard from '$lib/components/GameCard.svelte';
  import SlotPanel from '$lib/components/SlotPanel.svelte';
  import { CatalogClient } from '$lib/catalog-client';

  type Tab = 'search' | 'collection' | 'discovery' | 'settings';

  const client = new CatalogClient();
  let repository: CollectionRepository;
  let activeRequest: AbortController | null = null;

  let activeTab = $state<Tab>('search');
  let query = $state('');
  let platformId = $state('all');
  let sort = $state<SearchSort>('relevance');
  let filtersOpen = $state(false);
  let loading = $state(false);
  let statusText = $state('Підготовка локальної колекції…');
  let results = $state<SearchResult[]>([]);
  let selected = $state<SearchResult | null>(null);
  let entries = $state<CollectionEntry[]>([]);
  let lists = $state<UserList[]>([]);
  let snapshots = $state<Map<string, ReleaseSnapshot>>(new Map());
  let collectionView = $state<CollectionView>('rows');
  let locale = $state<SupportedLocale>('uk');
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

  async function reveal(items: SearchResult[], signal: AbortSignal): Promise<void> {
    results = [];
    for (const item of items) {
      signal.throwIfAborted();
      results = [...results, item];
      await wait(34, signal);
    }
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
    const request = new AbortController();
    activeRequest = request;
    loading = true;
    statusText = 'Формую нову випадкову кросплатформну добірку…';
    selected = null;
    try {
      const items = await client.discovery(36, request.signal);
      await reveal(items, request.signal);
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
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    loading = true;
    selected = null;
    statusText = query.trim() ? `Шукаю «${query.trim()}»…` : 'Показую доступні релізи…';
    try {
      const items = await client.search(
        {
          query: query.trim(),
          locale,
          limit: 60,
          ...(platformId === 'all' ? {} : { platformId }),
        },
        sort,
        request.signal,
      );
      await reveal(items, request.signal);
      const releaseCount = items.flatMap((item) => item.releases).length;
      statusText = items.length
        ? `Знайдено ${items.length} ігор і ${releaseCount} платформних релізів. Сортування змінює лише порядок.`
        : 'За поточним запитом нічого не знайдено.';
    } catch (error) {
      if (!request.signal.aborted) {
        statusText = error instanceof Error ? error.message : 'Пошук завершився помилкою.';
      }
    } finally {
      if (activeRequest === request) loading = false;
    }
  }

  function selectResult(result: SearchResult): void {
    selected = result;
  }

  function resultFromSnapshot(snapshot: ReleaseSnapshot): SearchResult {
    return {
      game: snapshot.game,
      releases: [snapshot.release],
      relevance: 1,
      providers: [...new Set(snapshot.release.sourceRefs.map((source) => source.provider))],
    };
  }

  function selectSnapshot(snapshot: ReleaseSnapshot): void {
    selected = resultFromSnapshot(snapshot);
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

  onMount(async () => {
    locale = detectLocale(localStorage.getItem('save-slot-locale'));
    repository = createCollectionRepository();
    await loadCollection();
    await loadDiscovery();
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
          <label class="search-field">
            <span>&gt;</span>
            <input bind:value={query} placeholder="Назва гри, серія, розробник…" type="search" />
          </label>
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
              <select bind:value={platformId}>
                <option value="all">Усі платформи</option>
                {#each platformOptions as platform}
                  <option value={platform.id}>{platform.name}</option>
                {/each}
              </select>
            </label>
            <label>
              СОРТУВАННЯ
              <select bind:value={sort}>
                <option value="relevance">Точність збігу</option>
                <option value="rating">Рейтинг гравців</option>
                <option value="votes">Кількість оцінок</option>
                <option value="year">Рік</option>
                <option value="title">Назва</option>
              </select>
            </label>
          {/if}
        </div>

        <div class:loading class="search-status" aria-live="polite">
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
        onSelect={selectSnapshot}
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
            <p>Колекція зберігається в IndexedDB цього пристрою. Каталог не копіюється повністю.</p>
            <div class="settings-actions">
              <button class="primary-button" onclick={() => void exportCollection()} type="button">ЕКСПОРТ JSON</button>
              <button class="secondary-button" onclick={() => importInput.click()} type="button">ІМПОРТ JSON</button>
              <input bind:this={importInput} accept="application/json,.json" hidden onchange={importCollection} type="file" />
            </div>
          </div>
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

  .settings-actions {
    display: flex;
    gap: 0.55rem;
    flex-wrap: wrap;
  }
</style>
