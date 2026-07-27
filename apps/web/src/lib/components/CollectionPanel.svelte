<script lang="ts">
  import {
    getPlayerRating,
    getPrimaryCover,
    type CollectionEntry,
    type CollectionStatus,
    type CollectionView,
    type Ownership,
    type ReleaseFormat,
    type ReleaseSnapshot,
  } from '@save-slot/domain';
  import { collectionViews } from '@save-slot/ui';

  interface Props {
    entries: CollectionEntry[];
    snapshots: Map<string, ReleaseSnapshot>;
    view: CollectionView;
    onViewChange: (view: CollectionView) => void;
    onSelect: (snapshot: ReleaseSnapshot) => void;
    onRemove: (entry: CollectionEntry) => void;
    onUpdate: (entry: CollectionEntry, patch: Partial<CollectionEntry>) => void;
  }

  type CollectionSort = 'recent' | 'title' | 'platform' | 'year' | 'rating' | 'priority';

  let { entries, snapshots, view, onViewChange, onSelect, onRemove, onUpdate }: Props = $props();

  let query = $state('');
  let statusFilter = $state<'all' | CollectionStatus>('all');
  let platformFilter = $state('all');
  let sort = $state<CollectionSort>('recent');
  let editingId = $state<string | null>(null);

  let draftStatus = $state<CollectionStatus>('backlog');
  let draftOwnership = $state<Ownership>('none');
  let draftFormat = $state<ReleaseFormat>('unknown');
  let draftRating = $state('');
  let draftPriority = $state(3);
  let draftQuantity = $state(1);
  let draftAcquiredAt = $state('');
  let draftPrice = $state('');
  let draftCurrency = $state('UAH');
  let draftTags = $state('');
  let draftNotes = $state('');

  const statusLabels: Record<CollectionStatus, string> = {
    owned: 'Володію',
    wishlist: 'Бажане',
    backlog: 'Заплановано',
    playing: 'Граю',
    completed: 'Пройдено',
    mastered: '100%',
    paused: 'Відкладено',
    dropped: 'Покинуто',
  };

  const ownershipLabels: Record<Ownership, string> = {
    physical: 'Фізична копія',
    digital: 'Цифрова копія',
    subscription: 'Підписка',
    borrowed: 'Позичено',
    none: 'Не вказано',
  };

  const formatLabels: Record<ReleaseFormat, string> = {
    physical: 'Фізичне видання',
    digital: 'Цифрове видання',
    cartridge: 'Картридж',
    disc: 'Диск',
    download: 'Завантаження',
    streaming: 'Стримінг',
    unknown: 'Не вказано',
  };

  let allItems = $derived(
    entries
      .map((entry) => ({ entry, snapshot: snapshots.get(entry.releaseId) }))
      .filter(
        (item): item is { entry: CollectionEntry; snapshot: ReleaseSnapshot } =>
          Boolean(item.snapshot),
      ),
  );

  let platformOptions = $derived.by(() =>
    [...new Map(allItems.map(({ snapshot }) => [snapshot.release.platform.id, snapshot.release.platform])).values()]
      .sort((left, right) => left.name.localeCompare(right.name, 'uk-UA')),
  );

  let items = $derived.by(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('uk-UA');
    const filtered = allItems.filter(({ entry, snapshot }) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (platformFilter !== 'all' && snapshot.release.platform.id !== platformFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        snapshot.game.title,
        snapshot.release.title,
        snapshot.release.platform.name,
        snapshot.release.edition ?? '',
        entry.notes,
        ...entry.tags,
      ]
        .join(' ')
        .toLocaleLowerCase('uk-UA');
      return haystack.includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) => {
      const leftRating = left.entry.personalRating ?? getPlayerRating(left.snapshot.release)?.score ?? -1;
      const rightRating = right.entry.personalRating ?? getPlayerRating(right.snapshot.release)?.score ?? -1;
      switch (sort) {
        case 'title':
          return left.snapshot.game.title.localeCompare(right.snapshot.game.title, 'uk-UA');
        case 'platform':
          return (
            left.snapshot.release.platform.name.localeCompare(right.snapshot.release.platform.name, 'uk-UA') ||
            left.snapshot.game.title.localeCompare(right.snapshot.game.title, 'uk-UA')
          );
        case 'year':
          return (right.snapshot.release.year ?? 0) - (left.snapshot.release.year ?? 0);
        case 'rating':
          return rightRating - leftRating;
        case 'priority':
          return right.entry.priority - left.entry.priority;
        case 'recent':
        default:
          return right.entry.updatedAt.localeCompare(left.entry.updatedAt);
      }
    });
  });

  let editingItem = $derived(
    editingId ? (allItems.find(({ entry }) => entry.id === editingId) ?? null) : null,
  );

  function openEditor(entry: CollectionEntry): void {
    editingId = entry.id;
    draftStatus = entry.status;
    draftOwnership = entry.ownership;
    draftFormat = entry.format;
    draftRating = entry.personalRating == null ? '' : String(entry.personalRating);
    draftPriority = entry.priority;
    draftQuantity = entry.quantity;
    draftAcquiredAt = entry.acquiredAt ?? '';
    draftPrice = entry.purchasePrice == null ? '' : String(entry.purchasePrice);
    draftCurrency = entry.currency ?? 'UAH';
    draftTags = entry.tags.join(', ');
    draftNotes = entry.notes;
  }

  function closeEditor(): void {
    editingId = null;
  }

  function saveEditor(): void {
    if (!editingItem) return;
    const tags = [...new Set(
      draftTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    )];
    const patch: Partial<CollectionEntry> = {
      status: draftStatus,
      ownership: draftOwnership,
      format: draftFormat,
      personalRating: draftRating === '' ? null : Math.min(100, Math.max(0, Number(draftRating))),
      priority: Math.min(5, Math.max(1, Math.round(draftPriority))),
      quantity: Math.max(1, Math.round(draftQuantity)),
      tags,
      notes: draftNotes.trim(),
    };
    if (draftAcquiredAt) patch.acquiredAt = draftAcquiredAt;
    if (draftPrice !== '') {
      patch.purchasePrice = Math.max(0, Number(draftPrice));
      patch.currency = draftCurrency.trim().toLocaleUpperCase('en-US').slice(0, 3) || 'UAH';
    }
    onUpdate(editingItem.entry, patch);
    closeEditor();
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && editingId) closeEditor();
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<section class="collection-panel">
  <header class="collection-header">
    <div>
      <p>ВЛАСНА БІБЛІОТЕКА</p>
      <h1>Колекція <span>{entries.length}</span></h1>
    </div>
    <div class="view-switcher" aria-label="Режим відображення">
      {#each collectionViews as option}
        <button
          aria-label={option.id === 'list' ? 'Список' : option.id === 'rows' ? 'Середні рядки' : 'Картриджі'}
          aria-pressed={view === option.id}
          class:active={view === option.id}
          onclick={() => onViewChange(option.id)}
          type="button"
        >
          {option.id === 'list' ? '☷' : option.id === 'rows' ? '▤' : '▦'}
        </button>
      {/each}
    </div>
  </header>

  <div class="collection-toolbar">
    <label class="library-search">
      <span>&gt;</span>
      <input bind:value={query} placeholder="Пошук у колекції…" type="search" />
    </label>
    <label>
      <span>СТАТУС</span>
      <select bind:value={statusFilter}>
        <option value="all">Усі статуси</option>
        {#each Object.entries(statusLabels) as [status, label]}
          <option value={status}>{label}</option>
        {/each}
      </select>
    </label>
    <label>
      <span>ПЛАТФОРМА</span>
      <select bind:value={platformFilter}>
        <option value="all">Усі платформи</option>
        {#each platformOptions as platform}
          <option value={platform.id}>{platform.name}</option>
        {/each}
      </select>
    </label>
    <label>
      <span>СОРТУВАННЯ</span>
      <select bind:value={sort}>
        <option value="recent">Останні зміни</option>
        <option value="title">Назва</option>
        <option value="platform">Платформа</option>
        <option value="year">Рік</option>
        <option value="rating">Оцінка</option>
        <option value="priority">Пріоритет</option>
      </select>
    </label>
  </div>

  <div class="collection-summary" aria-live="polite">
    <span>{items.length} З {entries.length}</span>
    {#if query || statusFilter !== 'all' || platformFilter !== 'all'}
      <button
        onclick={() => {
          query = '';
          statusFilter = 'all';
          platformFilter = 'all';
        }}
        type="button"
      >
        СКИНУТИ ФІЛЬТРИ
      </button>
    {/if}
  </div>

  {#if entries.length === 0}
    <div class="empty-collection">
      <strong>КОЛЕКЦІЯ ПОРОЖНЯ</strong>
      <span>Додайте конкретний реліз кнопкою на картці або у слоті.</span>
    </div>
  {:else if items.length === 0}
    <div class="empty-collection">
      <strong>НЕМАЄ ЗБІГІВ</strong>
      <span>Змініть пошук або фільтри колекції.</span>
    </div>
  {:else}
    <div class:cartridges={view === 'cartridges'} class:list={view === 'list'} class:rows={view === 'rows'} class="collection-items">
      {#each items as { entry, snapshot } (entry.id)}
        {@const cover = getPrimaryCover(snapshot.release)}
        {@const rating = getPlayerRating(snapshot.release)}
        <article class="collection-item">
          <button class="collection-cover" onclick={() => onSelect(snapshot)} type="button">
            {#if cover}
              <img src={entry.customCoverUrl || cover.url} alt={`Боксарт ${snapshot.game.title}`} loading="lazy" />
            {:else}
              <span>{snapshot.game.title.slice(0, 2).toLocaleUpperCase()}</span>
            {/if}
          </button>

          <div class="collection-copy">
            <button class="title-button" onclick={() => onSelect(snapshot)} type="button">
              {snapshot.game.title}
            </button>
            <p>{snapshot.release.platform.name} · {snapshot.release.year ?? '—'}</p>
            <div class="collection-ratings">
              <span>ГРАВЦІ {rating ? `${Math.round(rating.score)}%` : '—'}</span>
              <span>МОЯ {entry.personalRating == null ? '—' : `${entry.personalRating}/100`}</span>
              <span>ПРІОРИТЕТ {entry.priority}/5</span>
            </div>
            {#if entry.tags.length}
              <div class="entry-tags">
                {#each entry.tags.slice(0, 3) as tag}<span>{tag}</span>{/each}
              </div>
            {/if}
          </div>

          <label class="mini-field status-field">
            <span>СТАТУС</span>
            <select
              aria-label="Статус у колекції"
              onchange={(event) =>
                onUpdate(entry, {
                  status: (event.currentTarget as HTMLSelectElement).value as CollectionStatus,
                })}
              value={entry.status}
            >
              {#each Object.entries(statusLabels) as [status, label]}
                <option value={status}>{label}</option>
              {/each}
            </select>
          </label>

          <label class="mini-field rating-field">
            <span>МОЯ ОЦІНКА</span>
            <input
              aria-label="Особиста оцінка"
              max="100"
              min="0"
              onchange={(event) => {
                const value = (event.currentTarget as HTMLInputElement).value;
                onUpdate(entry, { personalRating: value === '' ? null : Number(value) });
              }}
              placeholder="—"
              type="number"
              value={entry.personalRating ?? ''}
            />
          </label>

          <div class="entry-actions">
            <button class="edit-entry" onclick={() => openEditor(entry)} type="button" aria-label="Редагувати запис">✎</button>
            <button class="remove-entry" onclick={() => onRemove(entry)} type="button" aria-label="Видалити">×</button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</section>

{#if editingItem}
  <div class="editor-backdrop" onclick={closeEditor} role="presentation">
    <section class="entry-editor" onclick={(event) => event.stopPropagation()} aria-label="Редактор запису колекції">
      <header>
        <div>
          <p>РЕДАГУВАННЯ КОПІЇ</p>
          <h2>{editingItem.snapshot.game.title}</h2>
          <span>{editingItem.snapshot.release.platform.name} · {editingItem.snapshot.release.year ?? '—'}</span>
        </div>
        <button class="close-editor" onclick={closeEditor} type="button" aria-label="Закрити">×</button>
      </header>

      <div class="editor-grid">
        <label><span>СТАТУС</span><select bind:value={draftStatus}>{#each Object.entries(statusLabels) as [value, label]}<option {value}>{label}</option>{/each}</select></label>
        <label><span>ВОЛОДІННЯ</span><select bind:value={draftOwnership}>{#each Object.entries(ownershipLabels) as [value, label]}<option {value}>{label}</option>{/each}</select></label>
        <label><span>ФОРМАТ</span><select bind:value={draftFormat}>{#each Object.entries(formatLabels) as [value, label]}<option {value}>{label}</option>{/each}</select></label>
        <label><span>МОЯ ОЦІНКА</span><input bind:value={draftRating} min="0" max="100" placeholder="—" type="number" /></label>
        <label><span>ПРІОРИТЕТ 1–5</span><input bind:value={draftPriority} min="1" max="5" type="number" /></label>
        <label><span>КІЛЬКІСТЬ</span><input bind:value={draftQuantity} min="1" type="number" /></label>
        <label><span>ДАТА ПРИДБАННЯ</span><input bind:value={draftAcquiredAt} type="date" /></label>
        <label><span>ЦІНА</span><input bind:value={draftPrice} min="0" step="0.01" placeholder="—" type="number" /></label>
        <label><span>ВАЛЮТА</span><input bind:value={draftCurrency} maxlength="3" placeholder="UAH" /></label>
        <label class="wide-field"><span>ТЕГИ ЧЕРЕЗ КОМУ</span><input bind:value={draftTags} placeholder="ретро, улюблене, запечатане" /></label>
        <label class="wide-field"><span>НОТАТКИ</span><textarea bind:value={draftNotes} rows="5" placeholder="Стан копії, комплектація, прогрес або інші примітки…"></textarea></label>
      </div>

      <footer>
        <button class="secondary-action" onclick={closeEditor} type="button">СКАСУВАТИ</button>
        <button class="primary-action" onclick={saveEditor} type="button">ЗБЕРЕГТИ</button>
      </footer>
    </section>
  </div>
{/if}

<style>
  .collection-panel { min-width: 0; }
  .collection-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
  .collection-header p, .mini-field span, .collection-toolbar label > span, .entry-editor label > span, .entry-editor header p { color: var(--accent-cool); font: 0.42rem/1.35 var(--pixel-font); }
  .collection-header h1 { margin: 0.35rem 0 0; font-size: clamp(1.45rem, 3vw, 2.35rem); }
  .collection-header h1 span { color: var(--muted); }
  .view-switcher { display: flex; gap: 0.35rem; }
  .view-switcher button { width: 42px; height: 42px; color: var(--muted-light); background: var(--panel); border: 1px solid var(--line); }
  .view-switcher button.active { color: #161303; background: var(--accent); border-color: var(--accent); }

  .collection-toolbar { display: grid; grid-template-columns: minmax(210px, 1.5fr) repeat(3, minmax(145px, 0.75fr)); gap: 0.55rem; margin-bottom: 0.65rem; }
  .collection-toolbar label { display: grid; gap: 0.3rem; }
  .collection-toolbar select, .collection-toolbar input, .entry-editor select, .entry-editor input, .entry-editor textarea { width: 100%; min-width: 0; min-height: 42px; padding: 0.55rem; color: var(--text); background: #090d0e; border: 1px solid var(--line); }
  .library-search { position: relative; align-content: end; }
  .library-search > span { position: absolute; z-index: 2; left: 0.7rem; bottom: 0.85rem; }
  .library-search input { padding-left: 1.8rem; }
  .collection-summary { display: flex; align-items: center; justify-content: space-between; min-height: 28px; margin-bottom: 0.7rem; color: var(--muted); font: 0.38rem/1.3 var(--pixel-font); }
  .collection-summary button { color: var(--accent); font: inherit; background: transparent; border: 0; }

  .empty-collection { display: grid; min-height: 280px; place-content: center; gap: 0.75rem; color: var(--muted); text-align: center; border: 1px dashed var(--line); }
  .empty-collection strong { color: var(--text); font: 0.62rem/1.4 var(--pixel-font); }
  .collection-items { display: grid; gap: 0.65rem; }
  .collection-item { position: relative; min-width: 0; background: rgba(15, 21, 23, 0.86); border: 1px solid var(--line); }
  .collection-cover, .title-button, .remove-entry, .edit-entry { color: inherit; background: transparent; border: 0; }
  .collection-cover { overflow: hidden; padding: 0; background: #090d0e; }
  .collection-cover img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .collection-cover > span { display: grid; width: 100%; height: 100%; place-items: center; color: var(--accent); font: 1rem/1 var(--pixel-font); }
  .title-button { padding: 0; font: inherit; font-weight: 700; text-align: left; }
  .collection-copy p { margin: 0.32rem 0 0; color: var(--muted); font-size: 0.78rem; }
  .collection-ratings, .entry-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.55rem; }
  .collection-ratings span, .entry-tags span { padding: 0.3rem; color: var(--muted-light); font: 0.36rem/1.2 var(--pixel-font); border: 1px solid var(--line); }
  .entry-tags span { color: var(--accent-cool); }
  .mini-field { display: grid; gap: 0.38rem; }
  .mini-field select, .mini-field input { width: 100%; min-width: 0; min-height: 38px; padding: 0.45rem; color: var(--text); background: #090d0e; border: 1px solid var(--line); }
  .entry-actions { display: flex; align-items: center; justify-content: flex-end; gap: 0.2rem; }
  .remove-entry, .edit-entry { display: grid; width: 34px; height: 34px; place-items: center; font-size: 1.05rem; }
  .remove-entry { color: var(--danger); }
  .edit-entry { color: var(--accent-cool); }

  .collection-items.list .collection-item { display: grid; grid-template-columns: 46px minmax(180px, 1fr) 150px 105px 76px; align-items: center; gap: 0.75rem; padding: 0.55rem; }
  .collection-items.list .collection-cover { width: 42px; height: 54px; }
  .collection-items.rows .collection-item { display: grid; grid-template-columns: 86px minmax(160px, 1fr) 145px 105px 76px; align-items: center; gap: 0.85rem; padding: 0.7rem; }
  .collection-items.rows .collection-cover { width: 78px; height: 104px; }
  .collection-items.cartridges { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); direction: ltr; }
  .collection-items.cartridges .collection-item { display: grid; direction: ltr; padding: 0.6rem; }
  .collection-items.cartridges .collection-cover { width: 100%; aspect-ratio: 0.76; padding: 8px; background: linear-gradient(145deg, #3a4447, #111719); border: 1px solid #566367; clip-path: polygon(7% 0, 93% 0, 100% 6%, 100% 100%, 0 100%, 0 6%); }
  .collection-items.cartridges .collection-cover img { border: 1px solid #596568; }
  .collection-items.cartridges .collection-copy { padding: 0.75rem 0.15rem; }
  .collection-items.cartridges .mini-field { margin-top: 0.55rem; }
  .collection-items.cartridges .entry-actions { position: absolute; top: 0.8rem; right: 0.8rem; background: rgba(5, 8, 9, 0.9); border: 1px solid var(--line); }

  .editor-backdrop { position: fixed; z-index: 500; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgba(2, 4, 5, 0.82); backdrop-filter: blur(5px); }
  .entry-editor { width: min(760px, 100%); max-height: min(90vh, 850px); overflow-y: auto; padding: 1rem; background: #0d1315; border: 1px solid var(--line-strong); box-shadow: 0 30px 100px rgba(0, 0, 0, 0.65); }
  .entry-editor header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
  .entry-editor h2 { margin: 0.3rem 0; font-size: clamp(1.2rem, 3vw, 1.8rem); }
  .entry-editor header span { color: var(--muted); }
  .close-editor { width: 40px; height: 40px; color: var(--danger); font-size: 1.4rem; background: var(--panel); border: 1px solid var(--line); }
  .editor-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.65rem; }
  .entry-editor label { display: grid; align-content: start; gap: 0.35rem; }
  .entry-editor textarea { resize: vertical; line-height: 1.45; }
  .wide-field { grid-column: 1 / -1; }
  .entry-editor footer { display: flex; justify-content: flex-end; gap: 0.55rem; margin-top: 1rem; }
  .primary-action, .secondary-action { min-height: 44px; padding: 0.65rem 0.9rem; font: 0.46rem/1.3 var(--pixel-font); }
  .primary-action { color: #161303; background: var(--accent); border: 1px solid var(--accent); }
  .secondary-action { color: var(--muted-light); background: var(--panel); border: 1px solid var(--line); }

  @media (max-width: 1050px) {
    .collection-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 900px) {
    .collection-items.list .collection-item, .collection-items.rows .collection-item { grid-template-columns: 64px minmax(0, 1fr) 72px; }
    .collection-items.list .collection-cover, .collection-items.rows .collection-cover { width: 58px; height: 76px; }
    .collection-items.list .status-field, .collection-items.list .rating-field, .collection-items.rows .status-field, .collection-items.rows .rating-field { display: none; }
    .editor-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 560px) {
    .collection-header { align-items: flex-start; }
    .collection-toolbar { grid-template-columns: 1fr; }
    .editor-backdrop { align-items: end; padding: 0; }
    .entry-editor { width: 100%; max-height: 92vh; border-right: 0; border-bottom: 0; border-left: 0; }
    .editor-grid { grid-template-columns: 1fr; }
    .wide-field { grid-column: auto; }
  }
</style>
