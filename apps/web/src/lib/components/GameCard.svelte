<script lang="ts">
  import { onMount } from 'svelte';
  import { getPlayerRating, getPrimaryCover, type SearchResult } from '@save-slot/domain';
  import { detectLocale, translate, type SupportedLocale } from '@save-slot/i18n';

  interface Props {
    result: SearchResult;
    selected: boolean;
    owned: boolean;
    revealIndex: number;
    locale?: SupportedLocale;
    onSelect: () => void;
    onToggle: () => void;
  }

  let {
    result,
    selected,
    owned,
    revealIndex,
    locale: providedLocale,
    onSelect,
    onToggle,
  }: Props = $props();
  let documentLocale = $state<SupportedLocale>('uk');
  let locale = $derived(providedLocale ?? documentLocale);
  let imageFailed = $state(false);
  let release = $derived(result.releases[0]);
  let cover = $derived(release ? getPrimaryCover(release) : undefined);
  let rating = $derived(release ? getPlayerRating(release) : undefined);

  $effect(() => {
    release?.id;
    imageFailed = false;
  });

  onMount(() => {
    const synchronize = () => {
      documentLocale = detectLocale(document.documentElement.lang);
    };
    synchronize();
    const observer = new MutationObserver(synchronize);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  });
</script>

<article
  class:owned
  class:selected
  class="game-card"
  style={`--reveal-index:${revealIndex}`}
>
  <button
    aria-label={`${result.game.title}, ${release?.platform.name ?? translate(locale, 'unknown')}`}
    aria-pressed={selected}
    class="card-select"
    onclick={onSelect}
    type="button"
  >
    <div class="card-cartridge">
      <div class="cover-frame">
        {#if cover && !imageFailed}
          <img
            alt={`${translate(locale, 'customCover')}: ${result.game.title}`}
            loading="lazy"
            onerror={() => (imageFailed = true)}
            src={cover.url}
          />
        {:else}
          <div class="cover-fallback">{result.game.title.slice(0, 2).toLocaleUpperCase(locale)}</div>
        {/if}
        <span class="platform-label">{release?.platform.name ?? translate(locale, 'unknown')}</span>
      </div>
      <div class="cartridge-foot"></div>
    </div>

    <div class="card-copy">
      <h2>{result.game.title}</h2>
      <div class="card-meta">
        <span>{release?.year ?? '—'}</span>
        <span>{rating ? `${Math.round(rating.score)}%` : '—'}</span>
        {#if rating?.votes}
          <span>{Intl.NumberFormat(locale, { notation: 'compact' }).format(rating.votes)}</span>
        {/if}
      </div>
      <div class="card-tags">
        {#each result.game.genres.slice(0, 2) as genre}
          <span>{genre}</span>
        {/each}
      </div>
    </div>
  </button>

  <button
    aria-label={translate(locale, owned ? 'removeFromCollection' : 'addToCollection')}
    class:active={owned}
    class="collection-toggle"
    onclick={onToggle}
    type="button"
  >
    {owned ? '✓' : '+'}
  </button>
</article>

<style>
  .game-card {
    position: relative;
    min-width: 0;
    direction: ltr;
    animation: reveal-from-right 380ms cubic-bezier(0.2, 0.78, 0.2, 1) both;
    animation-delay: calc(var(--reveal-index) * 28ms);
  }

  .card-select {
    display: block;
    width: 100%;
    padding: 0;
    color: inherit;
    text-align: left;
    cursor: pointer;
    background: transparent;
    border: 0;
    outline: none;
  }

  .card-select:focus-visible .card-cartridge,
  .game-card.selected .card-cartridge {
    border-color: var(--accent);
    box-shadow:
      inset 0 0 0 4px #0b1011,
      0 0 0 2px rgba(224, 185, 62, 0.25),
      0 18px 45px rgba(0, 0, 0, 0.42);
  }

  .card-cartridge {
    position: relative;
    width: 100%;
    aspect-ratio: 0.76;
    padding: 9px 9px 17px;
    transform: perspective(680px) rotateY(-1.4deg) rotateX(0.8deg);
    transition:
      transform 170ms ease,
      border-color 170ms ease;
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.1), transparent 22%),
      linear-gradient(145deg, #394346, #141a1c 68%);
    border: 1px solid #536064;
    clip-path: polygon(7% 0, 93% 0, 100% 6%, 100% 100%, 0 100%, 0 6%);
    box-shadow:
      inset 0 0 0 4px #0b1011,
      0 13px 28px rgba(0, 0, 0, 0.34);
  }

  .card-select:hover .card-cartridge {
    transform: perspective(680px) translateY(-4px) rotateY(1.2deg) rotateX(-0.8deg) scale(1.01);
  }

  .cover-frame {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #090d0e;
    border: 1px solid #566265;
  }

  .cover-frame::after {
    position: absolute;
    inset: 0;
    pointer-events: none;
    content: '';
    background:
      repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 3px),
      linear-gradient(130deg, rgba(255, 255, 255, 0.12), transparent 25%);
    mix-blend-mode: overlay;
  }

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-fallback {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    color: var(--accent);
    font: 2.4rem/1 var(--pixel-font);
    background: linear-gradient(145deg, #202b2e, #0b1113);
  }

  .platform-label {
    position: absolute;
    z-index: 2;
    right: 7px;
    bottom: 7px;
    left: 7px;
    padding: 0.4rem;
    overflow: hidden;
    color: var(--accent-cool);
    font: 0.42rem/1.25 var(--pixel-font);
    text-overflow: ellipsis;
    white-space: nowrap;
    background: rgba(3, 7, 8, 0.9);
    border: 1px solid rgba(109, 214, 177, 0.48);
  }

  .collection-toggle {
    position: absolute;
    z-index: 5;
    top: 7px;
    right: 7px;
    display: grid;
    width: 38px;
    height: 38px;
    place-items: center;
    color: var(--text);
    font-size: 1.1rem;
    background: rgba(7, 12, 13, 0.94);
    border: 1px solid var(--line-strong);
  }

  .collection-toggle:focus-visible {
    outline: 2px solid var(--accent-cool);
    outline-offset: 2px;
  }

  .collection-toggle.active {
    color: #161303;
    background: var(--accent);
    border-color: var(--accent);
  }

  .cartridge-foot {
    position: absolute;
    right: 26%;
    bottom: 5px;
    left: 26%;
    height: 6px;
    background: #080b0c;
    border: 1px solid #485255;
  }

  .card-copy {
    padding: 0.8rem 0.25rem 0;
  }

  h2 {
    min-height: 2.5em;
    margin: 0;
    font-size: 0.98rem;
    line-height: 1.25;
  }

  .card-meta,
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.38rem;
    margin-top: 0.58rem;
  }

  .card-meta span,
  .card-tags span {
    padding: 0.28rem 0.36rem;
    color: var(--muted-light);
    font: 0.4rem/1.2 var(--pixel-font);
    background: #101719;
    border: 1px solid var(--line);
  }

  .game-card.owned .card-tags span:first-child {
    border-color: rgba(224, 185, 62, 0.55);
  }

  @keyframes reveal-from-right {
    from {
      opacity: 0;
      transform: translate3d(38px, 0, 0) scale(0.965);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .game-card {
      animation: none;
    }

    .card-cartridge {
      transition: none;
    }
  }
</style>
