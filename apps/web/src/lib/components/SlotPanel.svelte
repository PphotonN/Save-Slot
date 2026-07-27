<script lang="ts">
  import {
    getDescription,
    getPlayerRating,
    getPrimaryCover,
    type CollectionEntry,
    type SearchResult,
  } from '@save-slot/domain';
  import type { SupportedLocale } from '@save-slot/i18n';

  interface Props {
    selected: SearchResult | null;
    entry: CollectionEntry | null;
    locale: SupportedLocale;
    onToggleCollection: () => void;
    onRatingChange: (value: number | null) => void;
  }

  let { selected, entry, locale, onToggleCollection, onRatingChange }: Props = $props();
  let useLocalizedDescription = $state(true);

  let release = $derived(selected?.releases[0]);
  let cover = $derived(release ? getPrimaryCover(release) : undefined);
  let playerRating = $derived(release ? getPlayerRating(release) : undefined);
  let screenshots = $derived(release?.media.filter((asset) => asset.kind === 'screenshot').slice(0, 6) ?? []);
  let description = $derived(
    selected
      ? getDescription(selected.game, useLocalizedDescription ? locale : 'en') ??
          getDescription(selected.game, locale)
      : undefined,
  );

  $effect(() => {
    selected?.game.id;
    useLocalizedDescription = true;
  });

  function updateRating(event: Event) {
    const value = (event.currentTarget as HTMLInputElement).value;
    onRatingChange(value === '' ? null : Number(value));
  }
</script>

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
      <header>
        <p>{release.platform.name}</p>
        <h1>{selected.game.title}</h1>
      </header>

      <dl class="game-facts">
        <div><dt>РІК</dt><dd>{release.year ?? '—'}</dd></div>
        <div><dt>ПЛАТФОРМА</dt><dd>{release.platform.name}</dd></div>
        <div>
          <dt>РЕЙТИНГ</dt>
          <dd>{playerRating ? `${Math.round(playerRating.score)}%` : '—'}</dd>
        </div>
        <div>
          <dt>МОЯ ОЦІНКА</dt>
          <dd>{entry?.personalRating == null ? '—' : `${entry.personalRating}/100`}</dd>
        </div>
      </dl>

      <div class="description-block">
        <div class="section-heading">
          <span>ОПИС</span>
          {#if locale !== 'en' && selected.game.descriptions.some((item) => item.locale === 'en')}
            <button type="button" onclick={() => (useLocalizedDescription = !useLocalizedDescription)}>
              {useLocalizedDescription ? 'ОРИГІНАЛ' : 'ПЕРЕКЛАСТИ'}
            </button>
          {/if}
        </div>
        <p>{description?.text ?? 'Опис поки відсутній.'}</p>
      </div>

      {#if screenshots.length}
        <section class="screenshot-section" aria-label="Скриншоти гри">
          <div class="section-heading">
            <span>СКРИНШОТИ</span>
            <small>{screenshots.length}</small>
          </div>
          <div class="screenshot-grid">
            {#each screenshots as screenshot}
              <a href={screenshot.url} target="_blank" rel="noreferrer">
                <img
                  src={screenshot.thumbnailUrl ?? screenshot.url}
                  alt={`Скриншот ${selected.game.title}`}
                  loading="lazy"
                />
              </a>
            {/each}
          </div>
        </section>
      {/if}

      <div class="slot-actions">
        <button class:danger={Boolean(entry)} class="primary-action" type="button" onclick={onToggleCollection}>
          {entry ? 'ВИДАЛИТИ З КОЛЕКЦІЇ' : 'ДОДАТИ ДО КОЛЕКЦІЇ'}
        </button>
        {#if entry}
          <label class="rating-input">
            <span>ОСОБИСТА ОЦІНКА</span>
            <input
              aria-label="Особиста оцінка"
              max="100"
              min="0"
              oninput={updateRating}
              placeholder="—"
              type="number"
              value={entry.personalRating ?? ''}
            />
          </label>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .slot-panel {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    padding: 1rem;
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px) 0 0 / 7px 7px,
      #0b0f11;
    border-right: 1px solid var(--line);
  }

  .slot-stage {
    display: grid;
    place-items: center;
    min-height: 285px;
    perspective: 820px;
  }

  .slot-chassis {
    position: relative;
    width: min(280px, 90%);
    aspect-ratio: 1 / 0.92;
    padding: 24px 28px 34px;
    transform: rotateX(4deg) rotateY(-4deg);
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.11), transparent 24%),
      linear-gradient(145deg, #30393c, #101719 68%);
    border: 2px solid #4b575a;
    clip-path: polygon(7% 0, 93% 0, 100% 8%, 100% 93%, 93% 100%, 7% 100%, 0 93%, 0 8%);
    box-shadow:
      inset 0 0 0 4px #0a0d0e,
      15px 20px 0 rgba(0, 0, 0, 0.24),
      0 34px 75px rgba(0, 0, 0, 0.42);
  }

  .slot-mouth {
    position: absolute;
    left: 12%;
    right: 12%;
    bottom: 17px;
    height: 15px;
    background: #020303;
    border: 2px solid #465053;
    box-shadow: inset 0 5px 7px #000;
  }

  .slot-cartridge {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    transform: translate3d(0, 5px, 0) scale(1);
    transform-origin: 50% 100%;
    background: linear-gradient(145deg, #3e484b, #171d1f);
    border: 2px solid #647074;
    clip-path: polygon(8% 0, 92% 0, 100% 8%, 100% 100%, 0 100%, 0 8%);
    box-shadow: inset 0 0 0 5px #111719;
  }

  .slot-cartridge.inserted {
    animation: rigid-insert 680ms cubic-bezier(0.18, 0.82, 0.2, 1) both;
  }

  .slot-cover {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: saturate(0.94) contrast(1.04);
  }

  .slot-cartridge::after {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
    background:
      repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 3px),
      linear-gradient(135deg, rgba(255, 255, 255, 0.12), transparent 28%);
    mix-blend-mode: overlay;
  }

  .cartridge-platform {
    position: absolute;
    z-index: 2;
    left: 10px;
    right: 10px;
    bottom: 10px;
    padding: 0.45rem;
    overflow: hidden;
    color: var(--accent-cool);
    font: 0.5rem/1.25 var(--pixel-font);
    text-overflow: ellipsis;
    white-space: nowrap;
    background: rgba(4, 8, 9, 0.9);
    border: 1px solid rgba(109, 214, 177, 0.5);
  }

  .save-slot-label {
    position: absolute;
    inset: 15px;
    display: grid;
    place-content: center;
    text-align: center;
    color: #161303;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.32), transparent 25%),
      #d8b63c;
    border: 2px solid #74601c;
  }

  .save-slot-label strong {
    font: 1.4rem/1.45 var(--pixel-font);
  }

  .save-slot-label small,
  .slot-symbol {
    font: 0.45rem/1.4 var(--pixel-font);
  }

  .slot-symbol {
    margin-bottom: 0.8rem;
    font-size: 1.6rem;
  }

  .game-details {
    display: grid;
    gap: 0.85rem;
    min-height: 0;
  }

  .game-details header p,
  .section-heading,
  dt,
  .rating-input span {
    color: var(--accent-cool);
    font: 0.46rem/1.4 var(--pixel-font);
  }

  .game-details h1 {
    margin: 0.32rem 0 0;
    font-size: clamp(1.35rem, 2.4vw, 2.15rem);
    line-height: 1.05;
  }

  .game-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    margin: 0;
  }

  .game-facts div {
    min-width: 0;
    padding: 0.65rem;
    background: rgba(17, 24, 26, 0.78);
    border: 1px solid var(--line);
  }

  dd {
    margin: 0.32rem 0 0;
    overflow-wrap: anywhere;
    font-weight: 700;
  }

  .description-block,
  .screenshot-section {
    padding: 0.78rem;
    background: rgba(17, 24, 26, 0.56);
    border: 1px solid var(--line);
  }

  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .section-heading button {
    color: var(--accent);
    font: inherit;
    background: transparent;
    border: 0;
  }

  .section-heading small {
    color: var(--muted);
  }

  .description-block p {
    margin: 0.7rem 0 0;
    color: var(--muted-light);
    font-size: 0.88rem;
    line-height: 1.52;
  }

  .screenshot-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.38rem;
    margin-top: 0.65rem;
  }

  .screenshot-grid a {
    display: block;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    background: #080c0d;
    border: 1px solid var(--line);
  }

  .screenshot-grid img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 160ms ease;
  }

  .screenshot-grid a:hover img {
    transform: scale(1.035);
  }

  .slot-actions {
    display: grid;
    gap: 0.6rem;
  }

  .primary-action,
  .rating-input {
    min-height: 44px;
    border: 1px solid var(--line-strong);
  }

  .primary-action {
    padding: 0.75rem;
    color: #151303;
    font: 0.5rem/1.3 var(--pixel-font);
    background: var(--accent);
  }

  .primary-action.danger {
    color: var(--text);
    background: rgba(231, 111, 101, 0.16);
    border-color: var(--danger);
  }

  .rating-input {
    display: grid;
    grid-template-columns: 1fr 70px;
    align-items: center;
    padding-left: 0.7rem;
  }

  .rating-input input {
    height: 100%;
    min-width: 0;
    color: var(--text);
    text-align: center;
    background: #080c0d;
    border: 0;
    border-left: 1px solid var(--line);
  }

  @keyframes rigid-insert {
    0% {
      opacity: 0.35;
      transform: translate3d(0, -95px, 55px) rotateZ(4deg) scale(1);
    }
    68% {
      opacity: 1;
      transform: translate3d(0, 13px, 0) rotateZ(0deg) scale(1);
    }
    82% {
      transform: translate3d(0, 1px, 0) rotateZ(0deg) scale(1);
    }
    100% {
      transform: translate3d(0, 5px, 0) rotateZ(0deg) scale(1);
    }
  }

  @media (max-width: 760px) {
    .slot-panel {
      display: grid;
      grid-template-columns: 132px minmax(0, 1fr);
      min-height: 152px;
      padding: 0.65rem;
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }

    .slot-stage {
      min-height: 132px;
    }

    .slot-chassis {
      width: 124px;
      padding: 11px 12px 18px;
    }

    .slot-mouth {
      bottom: 8px;
      height: 8px;
    }

    .save-slot-label {
      inset: 7px;
    }

    .save-slot-label strong {
      font-size: 0.55rem;
    }

    .save-slot-label small,
    .slot-symbol {
      display: none;
    }

    .game-details {
      align-content: center;
      gap: 0.5rem;
      overflow: hidden;
    }

    .game-details h1 {
      font-size: 1.02rem;
    }

    .game-facts {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.28rem;
    }

    .game-facts div {
      padding: 0.38rem;
    }

    dt {
      font-size: 0.32rem;
    }

    dd {
      font-size: 0.66rem;
    }

    .description-block,
    .screenshot-section,
    .slot-actions,
    .game-details header p {
      display: none;
    }
  }
</style>
