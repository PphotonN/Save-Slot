<script lang="ts">
  import { onMount } from 'svelte';
  import type { CartridgeTextureOptions } from '@save-slot/ps1-scene';
  import type { ThreeSlotSceneController } from '@save-slot/ps1-scene/three';

  interface Props {
    releaseId: string | null;
    coverUrl: string | null;
    platform: string | null;
    label: string;
    textureOptions?: Partial<CartridgeTextureOptions>;
  }

  let {
    releaseId,
    coverUrl,
    platform,
    label,
    textureOptions = {},
  }: Props = $props();
  let target: HTMLDivElement;
  let controller = $state<ThreeSlotSceneController | null>(null);
  let rendererState = $state<'loading' | 'ready' | 'fallback'>('loading');
  let requestedOperation = 0;
  let synchronizationQueue: Promise<void> = Promise.resolve();

  function scheduleSynchronization(): void {
    const operation = ++requestedOperation;
    rendererState = controller ? 'loading' : rendererState;
    synchronizationQueue = synchronizationQueue
      .catch(() => undefined)
      .then(async () => {
        if (operation !== requestedOperation) return;
        const activeController = controller;
        if (!activeController) return;
        activeController.setTextureOptions(textureOptions);
        try {
          if (releaseId && coverUrl) {
            await activeController.insert(releaseId, coverUrl);
          } else {
            await activeController.eject();
          }
          if (operation === requestedOperation) rendererState = 'ready';
        } catch (error) {
          if (operation !== requestedOperation) return;
          console.warn('[Save Slot] Three.js slot scene fell back to CSS:', error);
          rendererState = 'fallback';
          activeController.destroy();
          controller = null;
        }
      });
  }

  $effect(() => {
    releaseId;
    coverUrl;
    textureOptions;
    controller;
    if (controller) scheduleSynchronization();
  });

  onMount(() => {
    let disposed = false;
    void (async () => {
      try {
        const { ThreeSlotSceneController } = await import('@save-slot/ps1-scene/three');
        if (disposed) return;
        const instance = new ThreeSlotSceneController({ lowPower: true, pixelRatioCap: 1.5 });
        await instance.mount(target);
        if (disposed) {
          instance.destroy();
          return;
        }
        controller = instance;
      } catch (error) {
        if (disposed) return;
        console.warn('[Save Slot] WebGL slot renderer unavailable:', error);
        rendererState = 'fallback';
      }
    })();

    return () => {
      disposed = true;
      requestedOperation += 1;
      controller?.destroy();
      controller = null;
    };
  });
</script>

<div
  aria-label={label}
  class:crt={Boolean(textureOptions.crt)}
  class:dither={textureOptions.dither !== false}
  class:pixelated={textureOptions.pixelated !== false}
  class="scene-shell"
  data-renderer={rendererState}
  role="img"
>
  <div aria-hidden={rendererState === 'ready'} class:hidden={rendererState === 'ready'} class="css-fallback">
    <div class="fallback-chassis">
      <div class="fallback-slot"></div>
      <div class:inserted={Boolean(releaseId && coverUrl)} class="fallback-cartridge">
        {#if coverUrl}
          <img src={coverUrl} alt="" />
          {#if platform}<span>{platform}</span>{/if}
        {:else}
          <strong>SAVE<br />SLOT</strong>
        {/if}
      </div>
    </div>
  </div>
  <div aria-hidden="true" bind:this={target} class:visible={rendererState === 'ready'} class="webgl-target"></div>
  {#if rendererState === 'loading'}<span class="renderer-status">THREE…</span>{/if}
</div>

<style>
  .scene-shell {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: inherit;
    overflow: hidden;
    isolation: isolate;
  }

  .webgl-target,
  .css-fallback {
    position: absolute;
    inset: 0;
  }

  .webgl-target {
    z-index: 2;
    opacity: 0;
    transition: opacity 180ms ease;
  }

  .webgl-target.visible {
    opacity: 1;
  }

  .webgl-target :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .css-fallback {
    z-index: 1;
    display: grid;
    place-items: center;
    opacity: 1;
    transition: opacity 180ms ease;
    perspective: 820px;
  }

  .css-fallback.hidden {
    pointer-events: none;
    opacity: 0;
  }

  .fallback-chassis {
    position: relative;
    width: min(280px, 88%);
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

  .fallback-slot {
    position: absolute;
    right: 12%;
    bottom: 17px;
    left: 12%;
    height: 15px;
    background: #020303;
    border: 2px solid #465053;
    box-shadow: inset 0 5px 7px #000;
  }

  .fallback-cartridge {
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

  .fallback-cartridge.inserted {
    animation: rigid-insert 680ms cubic-bezier(0.18, 0.82, 0.2, 1) both;
  }

  .fallback-cartridge img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .fallback-cartridge span {
    position: absolute;
    z-index: 2;
    right: 10px;
    bottom: 10px;
    left: 10px;
    padding: 0.45rem;
    overflow: hidden;
    color: var(--accent-cool);
    font: 0.5rem/1.25 var(--pixel-font);
    text-overflow: ellipsis;
    white-space: nowrap;
    background: rgba(4, 8, 9, 0.9);
    border: 1px solid rgba(109, 214, 177, 0.5);
  }

  .fallback-cartridge strong {
    position: absolute;
    inset: 15px;
    display: grid;
    place-content: center;
    color: #161303;
    font: 1.4rem/1.45 var(--pixel-font);
    text-align: center;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.32), transparent 25%),
      #d8b63c;
    border: 2px solid #74601c;
  }

  .renderer-status {
    position: absolute;
    z-index: 3;
    right: 0.45rem;
    bottom: 0.45rem;
    color: var(--muted);
    font: 0.28rem/1.2 var(--pixel-font);
  }

  .scene-shell::after {
    position: absolute;
    z-index: 4;
    inset: 0;
    pointer-events: none;
    content: '';
  }

  .scene-shell.dither::after {
    background-image: radial-gradient(rgba(255, 255, 255, 0.045) 0.7px, transparent 0.7px);
    background-size: 3px 3px;
    mix-blend-mode: overlay;
  }

  .scene-shell.crt::after {
    background:
      repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 3px),
      radial-gradient(circle at center, transparent 58%, rgba(0, 0, 0, 0.28));
  }

  .scene-shell.pixelated .css-fallback img,
  .scene-shell.pixelated .webgl-target {
    image-rendering: pixelated;
  }

  @keyframes rigid-insert {
    0% {
      opacity: 0;
      transform: translate3d(0, -85px, 40px) rotateX(-5deg) scale(0.96);
    }
    65% {
      opacity: 1;
      transform: translate3d(0, 9px, 0) rotateX(0) scale(1);
    }
    82% {
      transform: translate3d(0, 2px, 0) scale(1);
    }
    100% {
      transform: translate3d(0, 5px, 0) scale(1);
    }
  }

  @media (max-width: 760px) {
    .fallback-chassis {
      width: 125px;
      padding: 11px 13px 17px;
    }

    .fallback-slot {
      bottom: 7px;
      height: 8px;
    }

    .fallback-cartridge strong {
      inset: 7px;
      font-size: 0.65rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .webgl-target,
    .css-fallback {
      transition: none;
    }

    .fallback-cartridge.inserted {
      animation: none;
    }
  }
</style>
