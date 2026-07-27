<script lang="ts">
  import { getPlayerRating, getPrimaryCover, type SearchResult } from '@save-slot/domain';

  interface Props {
    result: SearchResult;
    selected: boolean;
    owned: boolean;
    revealIndex: number;
    onSelect: () => void;
    onToggle: () => void;
  }

  let { result, selected, owned, revealIndex, onSelect, onToggle }: Props = $props();
  let imageFailed = $state(false);
  let release = $derived(result.releases[0]);
  let cover = $derived(release ? getPrimaryCover(release) : undefined);
  let rating = $derived(release ? getPlayerRating(release) : undefined);

  $effect(() => {
    release?.id;
    imageFailed = false;
  });

  function activate(event: KeyboardEvent) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onSelect();
  }
</script>

<article
  aria-label={`${result.game.title}, ${release?.platform.name ?? ''}`}
  aria-pressed={selected}
  class:owned
  class:selected
  class="game-card"
  onkeydown={activate}
  onclick={onSelect}
  role="button"
  style={`--reveal-index:${revealIndex}`}
  tabindex="0"
>
  <div class="card-cartridge">
    <div class="cover-frame">
      {#if cover && !imageFailed}
        <img
          alt={`Боксарт ${result.game.title}`}
          loading="lazy"
          onerror={() => (imageFailed = true)}
          src={cover.url}
        />
      {:else}
        <div class="cover-fallback">{result.game.title.slice(0, 2).toLocaleUpperCase()}</div>
      {/if}
      <span class="platform-label">{release?.platform.name ?? 'Невідома платформа'}</span>
      <button
        aria-label={owned ? 'Видалити з колекції' : 'Додати до колекції'}
        class:active={owned}
        class="collection-toggle"
        onclick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        type="button"
      >
        {owned ? '✓' : '+'}
      </button>
    </div>
    <div class="cartridge-foot"></div>
  </div>

  <div class="card-copy">
    <h2>{result.game.title}</h2>
    <div class="card-meta">
      <span>{release?.year ?? '—'}</span>
      <span>{rating ? `${Math.round(rating.score)}%` : '—'}</span>
      {#if rating?.votes}<span>{Intl.NumberFormat('uk-UA', { notation: 'compact' }).format(rating.votes)}</span>{/if}
    </div>
    <div class="card-tags">
      {#each result.game.genres.slice(0, 2) as genre}
        <span>{genre}</span>
      {/each}
    </div>
  </div>
</article>

<style>
  .game-card {
    min-width: 0;
    cursor: pointer;
    direction: ltr;
    outline: none;
    animation: reveal-from-right 380ms cubic-bezier(0.2, 0.78, 0.2, 1) both;
    animation-delay: calc(var(--reveal-index) * 28ms);
  }

  .game-card:focus-visible .card-cartridge,
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

  .game-card:hover .card-cartridge {
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
    z-index: 3;
    top: 7px;
    right: 7px;
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    color: var(--text);
    font-size: 1.1rem;
    background: rgba(7, 12, 13, 0.92);
    border: 1px solid var(--line-strong);
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
