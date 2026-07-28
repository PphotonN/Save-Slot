<script lang="ts">
  import {
    getDescription,
    getPlayerRating,
    getPrimaryCover,
    type CollectionEntry,
    type LocalizedText,
    type MediaAsset,
    type SearchResult,
    type SourceRef,
  } from '@save-slot/domain';
  import { formatLabel, translate, type SupportedLocale } from '@save-slot/i18n';
  import ThreeSlotScene from './ThreeSlotScene.svelte';

  interface Props {
    selected: SearchResult | null;
    entry: CollectionEntry | null;
    locale: SupportedLocale;
    onToggleCollection: () => void;
    onRatingChange: (value: number | null) => void;
    onReleaseChange: (releaseId: string) => void;
  }

  type DetailTab = 'overview' | 'media' | 'ratings' | 'sources';

  const sceneTextureOptions = {
    pixelated: false,
    dither: false,
    crt: false,
    textureResolution: 512,
  } as const;

  let { selected, entry, locale, onToggleCollection, onRatingChange, onReleaseChange }: Props = $props();
  let useLocalizedDescription = $state(true);
  let activeTab = $state<DetailTab>('overview');
  let selectedMedia = $state<MediaAsset | null>(null);

  const copy = {
    uk: {
      slot: 'Слот вибраної гри',
      releases: 'Доступні платформні релізи',
      sections: 'Розділи інформації про гру',
      media: 'Медіа',
      region: 'Регіон',
      worldwide: 'Увесь світ',
      rating: 'Рейтинг',
      language: 'Мова',
      noDescription: 'Опис поки відсутній.',
      officialDescription: 'Офіційний опис',
      editorialDescription: 'Редакційний опис',
      genres: 'Жанри',
      developer: 'Розробник',
      publisher: 'Видавець',
      gameMedia: 'Медіа гри',
      screenshot: 'Скриншот',
      titleScreen: 'Титульний екран',
      noMedia: 'Медіа немає',
      noMediaDescription: 'Для цього релізу джерела ще не надали скриншотів або титульних екранів.',
      noRatings: 'Оцінок немає',
      noRatingsDescription: 'Рейтинг цього релізу ще не отримано.',
      votesUnknown: 'Кількість голосів невідома',
      votes: '{count} голосів',
      addToRate: 'Додайте реліз до колекції, щоб оцінити його.',
      open: 'Відкрити ↗',
      noSources: 'Джерел немає',
      close: 'Закрити',
      officialStore: 'Офіційний магазин',
      localData: 'Локальні дані',
      catalogueSource: 'Джерело каталогу',
    },
    en: {
      slot: 'Selected game slot',
      releases: 'Available platform releases',
      sections: 'Game information sections',
      media: 'Media',
      region: 'Region',
      worldwide: 'Worldwide',
      rating: 'Rating',
      language: 'Language',
      noDescription: 'No description is available yet.',
      officialDescription: 'Official description',
      editorialDescription: 'Editorial description',
      genres: 'Genres',
      developer: 'Developer',
      publisher: 'Publisher',
      gameMedia: 'Game media',
      screenshot: 'Screenshot',
      titleScreen: 'Title screen',
      noMedia: 'No media',
      noMediaDescription: 'Sources have not provided screenshots or title screens for this release yet.',
      noRatings: 'No ratings',
      noRatingsDescription: 'A rating for this release has not been retrieved yet.',
      votesUnknown: 'Vote count is unknown',
      votes: '{count} votes',
      addToRate: 'Add the release to your collection to rate it.',
      open: 'Open ↗',
      noSources: 'No sources',
      close: 'Close',
      officialStore: 'Official store',
      localData: 'Local data',
      catalogueSource: 'Catalogue source',
    },
  } as const;

  let text = $derived(copy[locale]);
  let release = $derived(selected?.releases[0]);
  let cover = $derived(release ? getPrimaryCover(release) : undefined);
  let playerRating = $derived(release ? getPlayerRating(release) : undefined);
  let mediaItems = $derived(
    release?.media.filter(
      (asset) => asset.kind === 'screenshot' || asset.kind === 'title-screen',
    ) ?? [],
  );
  let localizedDescription = $derived.by(() => {
    if (!selected) return undefined;
    return (
      selected.game.descriptions.find((description) =>
        description.locale.toLocaleLowerCase().startsWith(locale),
      ) ?? getDescription(selected.game, locale)
    );
  });
  let originalDescription = $derived.by(() =>
    selected?.game.descriptions.find((description) =>
      description.locale.toLocaleLowerCase().startsWith('en'),
    ),
  );
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
      ...selected.game.descriptions.map((item) => item.source),
      ...release.sourceRefs,
      ...release.media.map((asset) => asset.source),
      ...release.ratings.map((rating) => rating.source),
    ];
    return [...new Map(refs.map((source) => [`${source.provider}:${source.id}`, source])).values()]
      .sort((left, right) => sourceName(left.provider).localeCompare(sourceName(right.provider), locale));
  });

  let providerOnlyRows = $derived.by(() => {
    const referenced = new Set(sourceRows.map((source) => source.provider));
    return (selected?.providers ?? []).filter((provider) => !referenced.has(provider));
  });

  $effect(() => {
    release?.id;
    locale;
    useLocalizedDescription = true;
    activeTab = 'overview';
    selectedMedia = null;
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
      'official-store': text.officialStore,
      manual: text.localData,
    };
    return labels[provider];
  }

  function formatVotes(votes?: number): string {
    if (votes == null) return text.votesUnknown;
    return text.votes.replace('{count}', Intl.NumberFormat(locale).format(votes));
  }

  function descriptionKind(item: LocalizedText): string {
    return item.official ? text.officialDescription : text.editorialDescription;
  }

  function mediaKind(item: MediaAsset): string {
    return item.kind === 'title-screen' ? text.titleScreen : text.screenshot;
  }

  function closeLightbox(): void {
    selectedMedia = null;
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && selectedMedia) closeLightbox();
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<section class:has-game={Boolean(selected)} class="slot-panel" aria-label={text.slot}>
  <div class="slot-stage">
    <ThreeSlotScene
      coverUrl={cover?.url ?? null}
      label={text.slot}
      platform={release?.platform.name ?? null}
      releaseId={release?.id ?? null}
      textureOptions={sceneTextureOptions}
    />
  </div>

  {#if selected && release}
    <div class="game-details">
      <header class="game-header">
        <p>{release.platform.name}</p>
        <h1>{selected.game.title}</h1>
        {#if release.edition}<span>{release.edition}</span>{/if}
      </header>

      {#if selected.releases.length > 1}
        <div class="release-selector" aria-label={text.releases}>
          {#each selected.releases as option (option.id)}
            <button
              class:active={option.id === release.id}
              onclick={() => onReleaseChange(option.id)}
              type="button"
            >
              <span>{option.platform.name}</span>
              <small>{option.year ?? '—'}{option.edition ? ` · ${option.edition}` : ''}</small>
            </button>
          {/each}
        </div>
      {/if}

      <nav class="detail-tabs" aria-label={text.sections}>
        <button class:active={activeTab === 'overview'} onclick={() => (activeTab = 'overview')} type="button">{translate(locale, 'overview').toLocaleUpperCase(locale)}</button>
        <button class:active={activeTab === 'media'} onclick={() => (activeTab = 'media')} type="button">{text.media.toLocaleUpperCase(locale)} {mediaItems.length || ''}</button>
        <button class:active={activeTab === 'ratings'} onclick={() => (activeTab = 'ratings')} type="button">{translate(locale, 'ratings').toLocaleUpperCase(locale)}</button>
        <button class:active={activeTab === 'sources'} onclick={() => (activeTab = 'sources')} type="button">{translate(locale, 'sources').toLocaleUpperCase(locale)}</button>
      </nav>

      {#if activeTab === 'overview'}
        <dl class="game-facts">
          <div><dt>{translate(locale, 'releaseYear').toLocaleUpperCase(locale)}</dt><dd>{release.year ?? '—'}</dd></div>
          <div><dt>{translate(locale, 'platform').toLocaleUpperCase(locale)}</dt><dd>{release.platform.name}</dd></div>
          <div><dt>{text.region.toLocaleUpperCase(locale)}</dt><dd>{release.region === 'worldwide' ? text.worldwide : release.region}</dd></div>
          <div><dt>{translate(locale, 'format').toLocaleUpperCase(locale)}</dt><dd>{release.formats.map((item) => formatLabel(locale, item)).join(', ') || '—'}</dd></div>
          <div><dt>{text.rating.toLocaleUpperCase(locale)}</dt><dd>{playerRating ? `${Math.round(playerRating.score)}%` : '—'}</dd></div>
          <div><dt>{translate(locale, 'personalRating').toLocaleUpperCase(locale)}</dt><dd>{entry?.personalRating == null ? '—' : `${entry.personalRating}/100`}</dd></div>
        </dl>

        <div class="description-block">
          <div class="section-heading">
            <span>{translate(locale, 'description').toLocaleUpperCase(locale)}</span>
            {#if canToggleDescription}
              <button type="button" onclick={() => (useLocalizedDescription = !useLocalizedDescription)}>
                {useLocalizedDescription ? translate(locale, 'original').toLocaleUpperCase(locale) : `${text.language.toLocaleUpperCase(locale)} ${locale.toLocaleUpperCase()}`}
              </button>
            {/if}
          </div>
          <p>{description?.text ?? text.noDescription}</p>
          {#if description}
            <small>{descriptionKind(description)} · {sourceName(description.source.provider)}</small>
          {/if}
        </div>

        {#if selected.game.genres.length || selected.game.developers.length || selected.game.publishers.length}
          <section class="credits-block">
            {#if selected.game.genres.length}<div><span>{text.genres.toLocaleUpperCase(locale)}</span><p>{selected.game.genres.join(', ')}</p></div>{/if}
            {#if selected.game.developers.length}<div><span>{text.developer.toLocaleUpperCase(locale)}</span><p>{selected.game.developers.join(', ')}</p></div>{/if}
            {#if selected.game.publishers.length}<div><span>{text.publisher.toLocaleUpperCase(locale)}</span><p>{selected.game.publishers.join(', ')}</p></div>{/if}
          </section>
        {/if}
      {:else if activeTab === 'media'}
        {#if mediaItems.length}
          <section class="screenshot-section" aria-label={text.gameMedia}>
            <div class="section-heading"><span>{text.media.toLocaleUpperCase(locale)}</span><small>{mediaItems.length}</small></div>
            <div class="screenshot-grid">
              {#each mediaItems as item}
                <button onclick={() => (selectedMedia = item)} type="button">
                  <img src={item.thumbnailUrl ?? item.url} alt={`${mediaKind(item)}: ${selected.game.title}`} loading="lazy" />
                  <span>{mediaKind(item)} · {sourceName(item.source.provider)}</span>
                </button>
              {/each}
            </div>
          </section>
        {:else}
          <div class="empty-detail"><strong>{text.noMedia.toLocaleUpperCase(locale)}</strong><span>{text.noMediaDescription}</span></div>
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
            <div class="empty-detail"><strong>{text.noRatings.toLocaleUpperCase(locale)}</strong><span>{text.noRatingsDescription}</span></div>
          {/if}

          <article class="rating-card personal">
            <div><strong>{entry?.personalRating == null ? '—' : `${entry.personalRating}%`}</strong><span>{translate(locale, 'personalRating').toLocaleUpperCase(locale)}</span></div>
            {#if entry}
              <label class="rating-input">
                <span>0–100</span>
                <input aria-label={translate(locale, 'personalRating')} max="100" min="0" onchange={updateRating} placeholder="—" type="number" value={entry.personalRating ?? ''} />
              </label>
            {:else}
              <p>{text.addToRate}</p>
            {/if}
          </article>
        </section>
      {:else}
        <section class="sources-section">
          {#each sourceRows as source}
            <article>
              <div><strong>{sourceName(source.provider)}</strong><span>{source.id}</span></div>
              {#if source.url}<a href={source.url} target="_blank" rel="noreferrer">{text.open.toLocaleUpperCase(locale)}</a>{/if}
            </article>
          {/each}
          {#each providerOnlyRows as provider}
            <article>
              <div><strong>{sourceName(provider)}</strong><span>{text.catalogueSource}</span></div>
            </article>
          {/each}
          {#if !sourceRows.length && !providerOnlyRows.length}<div class="empty-detail"><strong>{text.noSources.toLocaleUpperCase(locale)}</strong></div>{/if}
        </section>
      {/if}

      <div class="slot-actions">
        <button class:danger={Boolean(entry)} class="primary-action" type="button" onclick={onToggleCollection}>
          {translate(locale, entry ? 'removeFromCollection' : 'addToCollection').toLocaleUpperCase(locale)}
        </button>
      </div>
    </div>
  {/if}
</section>

{#if selectedMedia}
  <div class="lightbox" onclick={closeLightbox} role="presentation">
    <figure aria-label={mediaKind(selectedMedia)} onclick={(event) => event.stopPropagation()} role="dialog">
      <button onclick={closeLightbox} type="button" aria-label={text.close}>×</button>
      <img src={selectedMedia.url} alt={`${mediaKind(selectedMedia)}: ${selected?.game.title ?? ''}`} />
      <figcaption>{selected?.game.title} · {mediaKind(selectedMedia)} · {sourceName(selectedMedia.source.provider)}</figcaption>
    </figure>
  </div>
{/if}

<style>
  .slot-panel { min-height: 100%; display: flex; flex-direction: column; gap: 1.05rem; padding: 1rem; background: linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px) 0 0 / 7px 7px, #0b0f11; border-right: 1px solid var(--line); }
  .slot-stage { display: grid; min-height: 265px; }

  .game-details { display: grid; gap: .75rem; min-height: 0; }
  .game-header p,.section-heading,dt,.rating-input span,.credits-block span { color: var(--accent-cool); font: 600 .68rem/1.35 Inter, system-ui, sans-serif; }
  .game-header h1 { margin: .28rem 0; font-size: clamp(1.25rem,2.4vw,2rem); line-height: 1.08; }
  .game-header > span { color: var(--muted); font-size: .78rem; }
  .release-selector { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(125px,1fr); gap: .35rem; overflow-x: auto; padding-bottom: .15rem; }
  .release-selector button { display: grid; gap: .2rem; min-width: 0; padding: .55rem; color: var(--muted-light); text-align: left; background: #0c1214; border: 1px solid var(--line); }
  .release-selector button.active { color: #171402; background: var(--accent); border-color: var(--accent); }
  .release-selector span { overflow: hidden; font: 600 .68rem/1.3 Inter, system-ui, sans-serif; text-overflow: ellipsis; white-space: nowrap; }
  .release-selector small { overflow: hidden; opacity: .78; text-overflow: ellipsis; white-space: nowrap; }
  .detail-tabs { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 2px; }
  .detail-tabs button { min-width: 0; padding: .58rem .25rem; overflow: hidden; color: var(--muted); font: 700 .64rem/1.25 Inter, system-ui, sans-serif; text-overflow: ellipsis; background: var(--panel); border: 1px solid var(--line); }
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
  .screenshot-grid button span { position: absolute; right: 4px; bottom: 4px; max-width: calc(100% - 8px); padding: .2rem; overflow: hidden; color: var(--muted-light); font: .28rem/1.2 var(--pixel-font); text-overflow: ellipsis; white-space: nowrap; background: rgba(3,6,7,.82); }
  .ratings-section { display: grid; gap: .5rem; }
  .rating-card { padding: .7rem; background: #0b1113; border: 1px solid var(--line); }
  .rating-card > div { display: flex; align-items: baseline; justify-content: space-between; gap: .6rem; }
  .rating-card strong { color: var(--accent); font-size: 1.35rem; }
  .rating-card div span { color: var(--accent-cool); font: 700 .66rem/1.3 Inter, system-ui, sans-serif; text-align: right; }
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
  .sources-section a { flex: 0 0 auto; color: var(--accent); font: 700 .66rem/1.3 Inter, system-ui, sans-serif; text-decoration: none; }
  .empty-detail { display: grid; min-height: 150px; place-content: center; gap: .5rem; color: var(--muted); text-align: center; border: 1px dashed var(--line); }
  .empty-detail strong { color: var(--text); font: 700 .72rem/1.4 Inter, system-ui, sans-serif; }

  .slot-actions { display: grid; gap: .55rem; }
  .primary-action { min-height: 45px; padding: .7rem; color: #171402; font: 700 .74rem/1.35 Inter, system-ui, sans-serif; background: var(--accent); border: 1px solid var(--accent); }
  .primary-action.danger { color: var(--danger); background: transparent; border-color: rgba(231,111,101,.6); }

  .lightbox { position: fixed; z-index: 700; inset: 0; display: grid; place-items: center; padding: 1rem; background: rgba(0,0,0,.9); }
  .lightbox figure { position: relative; width: min(1100px,100%); margin: 0; }
  .lightbox img { display: block; width: 100%; max-height: 82vh; object-fit: contain; background: #000; }
  .lightbox button { position: absolute; z-index: 2; top: .5rem; right: .5rem; width: 42px; height: 42px; color: #fff; font-size: 1.5rem; background: rgba(0,0,0,.7); border: 1px solid #777; }
  .lightbox figcaption { padding: .55rem; color: var(--muted-light); text-align: center; background: #080b0d; }

  @media (max-width: 760px) {
    .slot-panel { display: grid; grid-template-columns: 135px minmax(0,1fr); min-height: 150px; max-height: none; padding: .65rem; border-right: 0; border-bottom: 1px solid var(--line); }
    .slot-stage { min-height: 135px; }
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
</style>
