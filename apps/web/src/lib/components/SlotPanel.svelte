<script lang="ts">
  import {
    getDescription,
    getPlayerRating,
    getPrimaryCover,
    type CollectionEntry,
    type MediaAsset,
    type SearchResult,
    type SourceRef,
  } from '@save-slot/domain';
  import type { SupportedLocale } from '@save-slot/i18n';

  interface Props {
    selected: SearchResult | null;
    entry: CollectionEntry | null;
    locale: SupportedLocale;
    onToggleCollection: () => void;
    onRatingChange: (value: number | null) => void;
  }

  type DetailTab = 'overview' | 'media' | 'ratings' | 'sources';

  let { selected, entry, locale, onToggleCollection, onRatingChange }: Props = $props();
  let useLocalizedDescription = $state(true);
  let activeTab = $state<DetailTab>('overview');
  let selectedScreenshot = $state<MediaAsset | null>(null);

  let release = $derived(selected?.releases[0]);
  let cover = $derived(release ? getPrimaryCover(release) : undefined);
  let playerRating = $derived(release ? getPlayerRating(release) : undefined);
  let screenshots = $derived(release?.media.filter((asset) => asset.kind === 'screenshot') ?? []);
  let localizedDescription = $derived(selected ? getDescription(selected.game, locale) : undefined);
  let originalDescription = $derived(selected ? getDescription(selected.game, 'en') : undefined);
  let description = $derived(
    useLocalizedDescription
      ? localizedDescription ?? originalDescription
      : originalDescription ?? localizedDescription,
  );
  let canToggleDescription = $derived(
    Boolean(
      locale !== 'en' &&
        localizedDescription &&
        originalDescription &&
        localizedDescription.text !== originalDescription.text,
    ),
  );

  let sourceRows = $derived.by(() => {
    if (!selected || !release) return [] as SourceRef[];
    const refs = [
      ...selected.game.sourceRefs,
      ...release.sourceRefs,
      ...release.media.map((asset) => asset.source),
      ...release.ratings.map((rating) => rating.source),
    ];
    return [...new Map(refs.map((source) => [`${source.provider}:${source.id}`, source])).values()];
  });

  $effect(() => {
    release?.id;
    useLocalizedDescription = true;
    activeTab = 'overview';
    selectedScreenshot = null;
  });

  function updateRating(event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    onRatingChange(value === '' ? null : Number(value));
  }

  function sourceName(provider: SourceRef['provider']): string {
    const labels: Record<SourceRef['provider'], string> = {
      igdb: 'IGDB',
      wikidata: 'Wikidata',
      mobygames: 'MobyGames',
      rawg: 'RAWG',
      steam: 'Steam',
      libretro: 'Libretro',
      pcgamingwiki: 'PCGamingWiki',
      wikipedia: 'Wikipedia',
      'official-store': 'Офіційний магазин',
      manual: 'Локальні дані',
    };
    return labels[provider];
  }

  function formatVotes(votes?: number): string {
    return votes == null ? 'Кількість голосів невідома' : `${Intl.NumberFormat('uk-UA').format(votes)} голосів`;
  }

  function closeLightbox(): void {
    selectedScreenshot = null;
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && selectedScreenshot) closeLightbox();
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<section class:has-game={Boolean(selected)} class="slot-panel" aria-label="Слот вибраної гри">
  <div class="slot-stage">
    <div class="slot-chassis">
      <div class="slot-mouth"></div>
      {#key release?.id ?? 'save-slot-home'}
        <div class:inserted={Boolean(release)} class="slot-cartridge">
          {#if release && cover}
            <img class="slot-cover" src={cover.url} alt={`Боксарт ${selected?.game.title ?? ''}`} />
            <span class="cartridge-platform">{release.platform.name}</span>
          {:else}
            <div class="save-slot-label">
              <span class="slot-symbol">▣</span>
              <strong>SAVE<br />SLOT</strong>
              <small>COLLECTION SYSTEM</small>
            </div>
          {/if}
        </div>
      {/key}
    </div>
  </div>

  {#if selected && release}
    <div class="game-details">
      <header class="game-header">
        <p>{release.platform.name}</p>
        <h1>{selected.game.title}</h1>
        {#if release.edition}<span>{release.edition}</span>{/if}
      </header>

      <nav class="detail-tabs" aria-label="Розділи інформації про гру">
        <button class:active={activeTab === 'overview'} onclick={() => (activeTab = 'overview')} type="button">ОГЛЯД</button>
        <button class:active={activeTab === 'media'} onclick={() => (activeTab = 'media')} type="button">МЕДІА {screenshots.length || ''}</button>
        <button class:active={activeTab === 'ratings'} onclick={() => (activeTab = 'ratings')} type="button">ОЦІНКИ</button>
        <button class:active={activeTab === 'sources'} onclick={() => (activeTab = 'sources')} type="button">ДЖЕРЕЛА</button>
      </nav>

      {#if activeTab === 'overview'}
        <dl class="game-facts">
          <div><dt>РІК</dt><dd>{release.year ?? '—'}</dd></div>
          <div><dt>ПЛАТФОРМА</dt><dd>{release.platform.name}</dd></div>
          <div><dt>РЕГІОН</dt><dd>{release.region || 'worldwide'}</dd></div>
          <div><dt>ФОРМАТ</dt><dd>{release.formats.join(', ') || '—'}</dd></div>
          <div><dt>РЕЙТИНГ</dt><dd>{playerRating ? `${Math.round(playerRating.score)}%` : '—'}</dd></div>
          <div><dt>МОЯ ОЦІНКА</dt><dd>{entry?.personalRating == null ? '—' : `${entry.personalRating}/100`}</dd></div>
        </dl>

        <div class="description-block">
          <div class="section-heading">
            <span>ОПИС</span>
            {#if canToggleDescription}
              <button type="button" onclick={() => (useLocalizedDescription = !useLocalizedDescription)}>
                {useLocalizedDescription ? 'ОРИГІНАЛ' : `МОВА ${locale.toLocaleUpperCase()}`}
              </button>
            {/if}
          </div>
          <p>{description?.text ?? 'Опис поки відсутній.'}</p>
          {#if description}
            <small>{description.official ? 'Офіційний опис' : 'Редакційний опис'} · {sourceName(description.source.provider)}</small>
          {/if}
        </div>

        {#if selected.game.genres.length || selected.game.developers.length || selected.game.publishers.length}
          <section class="credits-block">
            {#if selected.game.genres.length}<div><span>ЖАНРИ</span><p>{selected.game.genres.join(', ')}</p></div>{/if}
            {#if selected.game.developers.length}<div><span>РОЗРОБНИК</span><p>{selected.game.developers.join(', ')}</p></div>{/if}
            {#if selected.game.publishers.length}<div><span>ВИДАВЕЦЬ</span><p>{selected.game.publishers.join(', ')}</p></div>{/if}
          </section>
        {/if}
      {:else if activeTab === 'media'}
        {#if screenshots.length}
          <section class="screenshot-section" aria-label="Скриншоти гри">
            <div class="section-heading"><span>СКРИНШОТИ</span><small>{screenshots.length}</small></div>
            <div class="screenshot-grid">
              {#each screenshots as screenshot}
                <button onclick={() => (selectedScreenshot = screenshot)} type="button">
                  <img src={screenshot.thumbnailUrl ?? screenshot.url} alt={`Скриншот ${selected.game.title}`} loading="lazy" />
                  <span>{sourceName(screenshot.source.provider)}</span>
                </button>
              {/each}
            </div>
          </section>
        {:else}
          <div class="empty-detail"><strong>СКРИНШОТІВ НЕМАЄ</strong><span>Для цього релізу джерела ще не надали зображень.</span></div>
        {/if}
      {:else if activeTab === 'ratings'}
        <section class="ratings-section">
          {#if release.ratings.length}
            {#each release.ratings as rating}
              <article class="rating-card">
                <div><strong>{Math.round(rating.score)}%</strong><span>{rating.label ?? sourceName(rating.source.provider)}</span></div>
                <p>{formatVotes(rating.votes)}</p>
                <small>{sourceName(rating.source.provider)}{rating.platformScope ? ` · ${rating.platformScope}` : ''}</small>
              </article>
            {/each}
          {:else}
            <div class="empty-detail"><strong>ОЦІНОК НЕМАЄ</strong><span>Рейтинг цього релізу ще не отримано.</span></div>
          {/if}

          <article class="rating-card personal">
            <div><strong>{entry?.personalRating == null ? '—' : `${entry.personalRating}%`}</strong><span>МОЯ ОЦІНКА</span></div>
            {#if entry}
              <label class="rating-input">
                <span>0–100</span>
                <input aria-label="Особиста оцінка" max="100" min="0" oninput={updateRating} placeholder="—" type="number" value={entry.personalRating ?? ''} />
              </label>
            {:else}
              <p>Додайте реліз до колекції, щоб оцінити його.</p>
            {/if}
          </article>
        </section>
      {:else}
        <section class="sources-section">
          {#each sourceRows as source}
            <article>
              <div><strong>{sourceName(source.provider)}</strong><span>{source.id}</span></div>
              {#if source.url}<a href={source.url} target="_blank" rel="noreferrer">ВІДКРИТИ ↗</a>{/if}
            </article>
          {/each}
          {#if !sourceRows.length}<div class="empty-detail"><strong>ДЖЕРЕЛ НЕМАЄ</strong></div>{/if}
        </section>
      {/if}

      <div class="slot-actions">
        <button class:danger={Boolean(entry)} class="primary-action" type="button" onclick={onToggleCollection}>
          {entry ? 'ВИДАЛИТИ З КОЛЕКЦІЇ' : 'ДОДАТИ ДО КОЛЕКЦІЇ'}
        </button>
      </div>
    </div>
  {/if}
</section>

{#if selectedScreenshot}
  <div class="lightbox" onclick={closeLightbox} role="presentation">
    <figure onclick={(event) => event.stopPropagation()}>
      <button onclick={closeLightbox} type="button" aria-label="Закрити">×</button>
      <img src={selectedScreenshot.url} alt={`Скриншот ${selected?.game.title ?? ''}`} />
      <figcaption>{selected?.game.title} · {sourceName(selectedScreenshot.source.provider)}</figcaption>
    </figure>
  </div>
{/if}

<style>
  .slot-panel { min-height: 100%; display: flex; flex-direction: column; gap: 1.05rem; padding: 1rem; background: linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px) 0 0 / 7px 7px, #0b0f11; border-right: 1px solid var(--line); }
  .slot-stage { display: grid; place-items: center; min-height: 265px; perspective: 820px; }
  .slot-chassis { position: relative; width: min(280px, 90%); aspect-ratio: 1/.92; padding: 24px 28px 34px; transform: rotateX(4deg) rotateY(-4deg); background: linear-gradient(145deg, rgba(255,255,255,.11), transparent 24%), linear-gradient(145deg,#30393c,#101719 68%); border: 2px solid #4b575a; clip-path: polygon(7% 0,93% 0,100% 8%,100% 93%,93% 100%,7% 100%,0 93%,0 8%); box-shadow: inset 0 0 0 4px #0a0d0e,15px 20px 0 rgba(0,0,0,.24),0 34px 75px rgba(0,0,0,.42); }
  .slot-mouth { position: absolute; left: 12%; right: 12%; bottom: 17px; height: 15px; background: #020303; border: 2px solid #465053; box-shadow: inset 0 5px 7px #000; }
  .slot-cartridge { position: relative; width: 100%; height: 100%; overflow: hidden; transform: translate3d(0,5px,0) scale(1); transform-origin: 50% 100%; background: linear-gradient(145deg,#3e484b,#171d1f); border: 2px solid #647074; clip-path: polygon(8% 0,92% 0,100% 8%,100% 100%,0 100%,0 8%); box-shadow: inset 0 0 0 5px #111719; }
  .slot-cartridge.inserted { animation: rigid-insert 680ms cubic-bezier(.18,.82,.2,1) both; }
  .slot-cover { display: block; width: 100%; height: 100%; object-fit: cover; filter: saturate(.94) contrast(1.04); }
  .slot-cartridge::after { position: absolute; inset: 0; pointer-events: none; content: ''; background: repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0 1px,transparent 1px 3px),linear-gradient(135deg,rgba(255,255,255,.12),transparent 28%); mix-blend-mode: overlay; }
  .cartridge-platform { position: absolute; z-index: 2; right: 10px; bottom: 10px; left: 10px; padding: .45rem; overflow: hidden; color: var(--accent-cool); font: .5rem/1.25 var(--pixel-font); text-overflow: ellipsis; white-space: nowrap; background: rgba(4,8,9,.9); border: 1px solid rgba(109,214,177,.5); }
  .save-slot-label { position: absolute; inset: 15px; display: grid; place-content: center; text-align: center; color: #161303; background: linear-gradient(135deg,rgba(255,255,255,.32),transparent 25%),#d8b63c; border: 2px solid #74601c; }
  .save-slot-label strong { font: 1.4rem/1.45 var(--pixel-font); }
  .save-slot-label small,.slot-symbol { font: .45rem/1.4 var(--pixel-font); }
  .slot-symbol { margin-bottom: .8rem; font-size: 1.6rem; }

  .game-details { display: grid; gap: .75rem; min-height: 0; }
  .game-header p,.section-heading,dt,.rating-input span,.credits-block span { color: var(--accent-cool); font: .42rem/1.4 var(--pixel-font); }
  .game-header h1 { margin: .28rem 0; font-size: clamp(1.25rem,2.4vw,2rem); line-height: 1.08; }
  .game-header > span { color: var(--muted); font-size: .78rem; }
  .detail-tabs { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 2px; }
  .detail-tabs button { min-width: 0; padding: .58rem .25rem; overflow: hidden; color: var(--muted); font: .34rem/1.25 var(--pixel-font); text-overflow: ellipsis; background: var(--panel); border: 1px solid var(--line); }
  .detail-tabs button.active { color: #171402; background: var(--accent); border-color: var(--accent); }
  .game-facts { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .4rem; margin: 0; }
  .game-facts div { min-width: 0; padding: .62rem; background: rgba(17,24,26,.78); border: 1px solid var(--line); }
  dd { margin: .3rem 0 0; overflow-wrap: anywhere; font-size: .82rem; font-weight: 700; }
  .description-block,.screenshot-section,.credits-block,.ratings-section,.sources-section { padding: .72rem; background: rgba(17,24,26,.56); border: 1px solid var(--line); }
  .section-heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
  .section-heading button { color: var(--accent); font: inherit; background: transparent; border: 0; }
  .section-heading small,.description-block > small { color: var(--muted); }
  .description-block p { margin: .65rem 0 .45rem; color: var(--muted-light); font-size: .86rem; line-height: 1.52; }
  .description-block > small { font-size: .7rem; }
  .credits-block { display: grid; gap: .65rem; }
  .credits-block div { display: grid; gap: .25rem; }
  .credits-block p { margin: 0; color: var(--muted-light); font-size: .8rem; line-height: 1.4; }

  .screenshot-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: .38rem; margin-top: .65rem; }
  .screenshot-grid button { position: relative; overflow: hidden; padding: 0; aspect-ratio: 16/9; background: #080c0d; border: 1px solid var(--line); }
  .screenshot-grid img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .screenshot-grid button span { position: absolute; right: 4px; bottom: 4px; padding: .2rem; color: var(--muted-light); font: .28rem/1.2 var(--pixel-font); background: rgba(3,6,7,.82); }
  .ratings-section { display: grid; gap: .5rem; }
  .rating-card { padding: .7rem; background: #0b1113; border: 1px solid var(--line); }
  .rating-card > div { display: flex; align-items: baseline; justify-content: space-between; gap: .6rem; }
  .rating-card strong { color: var(--accent); font-size: 1.35rem; }
  .rating-card div span { color: var(--accent-cool); font: .36rem/1.3 var(--pixel-font); text-align: right; }
  .rating-card p { margin: .45rem 0; color: var(--muted-light); font-size: .76rem; }
  .rating-card small { color: var(--muted); }
  .rating-card.personal { border-color: rgba(224,185,62,.45); }
  .rating-input { display: grid; grid-template-columns: auto 90px; align-items: center; gap: .5rem; margin-top: .6rem; }
  .rating-input input { width: 100%; min-height: 38px; padding: .4rem; color: var(--text); background: #06090a; border: 1px solid var(--line); }
  .sources-section { display: grid; gap: .4rem; }
  .sources-section article { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: .55rem; background: #0b1113; border: 1px solid var(--line); }
  .sources-section article div { min-width: 0; display: grid; gap: .18rem; }
  .sources-section strong { font-size: .8rem; }
  .sources-section article span { overflow: hidden; color: var(--muted); font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }
  .sources-section a { flex: 0 0 auto; color: var(--accent); font: .32rem/1.3 var(--pixel-font); text-decoration: none; }
  .empty-detail { display: grid; min-height: 150px; place-content: center; gap: .5rem; color: var(--muted); text-align: center; border: 1px dashed var(--line); }
  .empty-detail strong { color: var(--text); font: .46rem/1.4 var(--pixel-font); }

  .slot-actions { display: grid; gap: .55rem; }
  .primary-action { min-height: 45px; padding: .7rem; color: #171402; font: .44rem/1.35 var(--pixel-font); background: var(--accent); border: 1px solid var(--accent); }
  .primary-action.danger { color: var(--danger); background: transparent; border-color: rgba(231,111,101,.6); }

  .lightbox { position: fixed; z-index: 700; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgba(0,0,0,.9); }
  .lightbox figure { position: relative; width: min(1100px,100%); margin: 0; }
  .lightbox img { display: block; width: 100%; max-height: 82vh; object-fit: contain; background: #000; }
  .lightbox button { position: absolute; z-index: 2; top: .5rem; right: .5rem; width: 42px; height: 42px; color: #fff; font-size: 1.5rem; background: rgba(0,0,0,.7); border: 1px solid #777; }
  .lightbox figcaption { padding: .55rem; color: var(--muted-light); text-align: center; background: #080b0d; }

  @keyframes rigid-insert { 0% { opacity: 0; transform: translate3d(0,-85px,40px) rotateX(-5deg) scale(.96); } 65% { opacity: 1; transform: translate3d(0,9px,0) rotateX(0) scale(1); } 82% { transform: translate3d(0,2px,0) scale(1); } 100% { transform: translate3d(0,5px,0) scale(1); } }
  @media (max-width: 760px) {
    .slot-panel { display: grid; grid-template-columns: 135px minmax(0,1fr); min-height: 150px; max-height: none; padding: .65rem; border-right: 0; border-bottom: 1px solid var(--line); }
    .slot-stage { min-height: 135px; }
    .slot-chassis { width: 125px; padding: 11px 13px 17px; }
    .slot-mouth { bottom: 7px; height: 8px; }
    .save-slot-label { inset: 7px; }
    .save-slot-label strong { font-size: .65rem; }
    .slot-symbol { margin-bottom: .25rem; font-size: .8rem; }
    .save-slot-label small { display: none; }
    .game-details { max-height: 310px; overflow-y: auto; padding-right: .15rem; }
    .game-header h1 { font-size: 1rem; }
    .game-facts { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .game-facts div { padding: .42rem; }
    dt { font-size: .3rem; }
    dd { font-size: .68rem; }
    .detail-tabs button { font-size: .27rem; }
    .description-block p { font-size: .78rem; }
    .screenshot-grid { grid-template-columns: repeat(3,minmax(0,1fr)); }
  }
  @media (max-width: 480px) {
    .game-facts { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .detail-tabs { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .screenshot-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  }
  @media (prefers-reduced-motion: reduce) { .slot-cartridge.inserted { animation: none; } }
</style>
