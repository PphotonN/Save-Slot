<script lang="ts">
  import {
    getPlayerRating,
    getPrimaryCover,
    type CollectionEntry,
    type CollectionStatus,
    type CollectionView,
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

  let { entries, snapshots, view, onViewChange, onSelect, onRemove, onUpdate }: Props = $props();

  let items = $derived(
    entries
      .map((entry) => ({ entry, snapshot: snapshots.get(entry.releaseId) }))
      .filter(
        (item): item is { entry: CollectionEntry; snapshot: ReleaseSnapshot } =>
          Boolean(item.snapshot),
      ),
  );

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
</script>

<section class="collection-panel">
  <header class="collection-header">
    <div>
      <p>ВЛАСНА БІБЛІОТЕКА</p>
      <h1>Колекція <span>{entries.length}</span></h1>
    </div>
    <div class="view-switcher" aria-label="Режим відображення">
      {#each collectionViews as option}
        <button
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

  {#if items.length === 0}
    <div class="empty-collection">
      <strong>КОЛЕКЦІЯ ПОРОЖНЯ</strong>
      <span>Додайте конкретний реліз кнопкою на картці або у слоті.</span>
    </div>
  {:else}
    <div class:cartridges={view === 'cartridges'} class:list={view === 'list'} class:rows={view === 'rows'} class="collection-items">
      {#each items as { entry, snapshot } (entry.id)}
        {@const cover = getPrimaryCover(snapshot.release)}
        {@const rating = getPlayerRating(snapshot.release)}
        <article class="collection-item">
          <button class="collection-cover" onclick={() => onSelect(snapshot)} type="button">
            {#if cover}
              <img src={entry.customCoverUrl || cover.url} alt={`Боксарт ${snapshot.game.title}`} />
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
            </div>
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

          <button class="remove-entry" onclick={() => onRemove(entry)} type="button" aria-label="Видалити">
            ×
          </button>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .collection-panel {
    min-width: 0;
  }

  .collection-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.2rem;
  }

  .collection-header p,
  .mini-field span {
    color: var(--accent-cool);
    font: 0.46rem/1.35 var(--pixel-font);
  }

  .collection-header h1 {
    margin: 0.35rem 0 0;
    font-size: clamp(1.45rem, 3vw, 2.35rem);
  }

  .collection-header h1 span {
    color: var(--muted);
  }

  .view-switcher {
    display: flex;
    gap: 0.35rem;
  }

  .view-switcher button {
    width: 42px;
    height: 42px;
    color: var(--muted-light);
    background: var(--panel);
    border: 1px solid var(--line);
  }

  .view-switcher button.active {
    color: #161303;
    background: var(--accent);
    border-color: var(--accent);
  }

  .empty-collection {
    display: grid;
    min-height: 280px;
    place-content: center;
    gap: 0.75rem;
    color: var(--muted);
    text-align: center;
    border: 1px dashed var(--line);
  }

  .empty-collection strong {
    color: var(--text);
    font: 0.62rem/1.4 var(--pixel-font);
  }

  .collection-items {
    display: grid;
    gap: 0.65rem;
  }

  .collection-item {
    position: relative;
    min-width: 0;
    background: rgba(15, 21, 23, 0.86);
    border: 1px solid var(--line);
  }

  .collection-cover,
  .title-button,
  .remove-entry {
    color: inherit;
    background: transparent;
    border: 0;
  }

  .collection-cover {
    overflow: hidden;
    padding: 0;
    background: #090d0e;
  }

  .collection-cover img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .collection-cover > span {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    color: var(--accent);
    font: 1rem/1 var(--pixel-font);
  }

  .title-button {
    padding: 0;
    font: inherit;
    font-weight: 700;
    text-align: left;
  }

  .collection-copy p {
    margin: 0.32rem 0 0;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .collection-ratings {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.55rem;
  }

  .collection-ratings span {
    padding: 0.3rem;
    color: var(--muted-light);
    font: 0.38rem/1.2 var(--pixel-font);
    border: 1px solid var(--line);
  }

  .mini-field {
    display: grid;
    gap: 0.38rem;
  }

  .mini-field select,
  .mini-field input {
    width: 100%;
    min-width: 0;
    min-height: 38px;
    padding: 0.45rem;
    color: var(--text);
    background: #090d0e;
    border: 1px solid var(--line);
  }

  .remove-entry {
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    color: var(--danger);
    font-size: 1.25rem;
  }

  .collection-items.list .collection-item {
    display: grid;
    grid-template-columns: 46px minmax(180px, 1fr) 150px 105px 40px;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem;
  }

  .collection-items.list .collection-cover {
    width: 42px;
    height: 54px;
  }

  .collection-items.rows .collection-item {
    display: grid;
    grid-template-columns: 86px minmax(160px, 1fr) 145px 105px 40px;
    align-items: center;
    gap: 0.85rem;
    padding: 0.7rem;
  }

  .collection-items.rows .collection-cover {
    width: 78px;
    height: 104px;
  }

  .collection-items.cartridges {
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    direction: rtl;
  }

  .collection-items.cartridges .collection-item {
    display: grid;
    direction: ltr;
    padding: 0.6rem;
  }

  .collection-items.cartridges .collection-cover {
    width: 100%;
    aspect-ratio: 0.76;
    padding: 8px;
    background: linear-gradient(145deg, #3a4447, #111719);
    border: 1px solid #566367;
    clip-path: polygon(7% 0, 93% 0, 100% 6%, 100% 100%, 0 100%, 0 6%);
  }

  .collection-items.cartridges .collection-cover img {
    border: 1px solid #596568;
  }

  .collection-items.cartridges .collection-copy {
    padding: 0.75rem 0.15rem;
  }

  .collection-items.cartridges .mini-field {
    margin-top: 0.55rem;
  }

  .collection-items.cartridges .remove-entry {
    position: absolute;
    top: 0.8rem;
    right: 0.8rem;
    background: rgba(5, 8, 9, 0.9);
    border: 1px solid var(--line);
  }

  @media (max-width: 900px) {
    .collection-items.list .collection-item,
    .collection-items.rows .collection-item {
      grid-template-columns: 64px minmax(0, 1fr) 38px;
    }

    .collection-items.list .collection-cover,
    .collection-items.rows .collection-cover {
      width: 58px;
      height: 76px;
    }

    .collection-items.list .status-field,
    .collection-items.list .rating-field,
    .collection-items.rows .status-field,
    .collection-items.rows .rating-field {
      display: none;
    }
  }
</style>
