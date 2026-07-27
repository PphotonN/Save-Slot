<script lang="ts">
  import { onMount } from 'svelte';
  import type { CartridgeTextureOptions } from '@save-slot/ps1-scene';
  import type { ThreeSlotSceneController } from '@save-slot/ps1-scene/three';
  import './ThreeSlotScene.css';

  interface Props {
    releaseId: string | null;
    coverUrl: string | null;
    platform: string | null;
    label: string;
    textureOptions?: Partial<CartridgeTextureOptions>;
  }

  type ArtworkMode = 'clean' | 'ps1' | 'crt';

  let { releaseId, coverUrl, platform, label, textureOptions = {} }: Props = $props();
  let target: HTMLDivElement;
  let controller = $state<ThreeSlotSceneController | null>(null);
  let rendererState = $state<'loading' | 'ready' | 'idle' | 'fallback'>('loading');
  let artworkMode = $state<ArtworkMode>('ps1');
  let requestedOperation = 0;
  let synchronizationQueue: Promise<void> = Promise.resolve();

  let effectiveTextureOptions = $derived.by((): CartridgeTextureOptions => ({
    pixelated: artworkMode !== 'clean',
    dither: artworkMode !== 'clean',
    crt: artworkMode === 'crt',
    textureResolution: textureOptions.textureResolution ?? 256,
  }));

  function setArtworkMode(mode: ArtworkMode): void {
    artworkMode = mode;
    localStorage.setItem('save-slot-artwork-mode', mode);
  }

  function fallBack(instance: ThreeSlotSceneController, reason: unknown): void {
    if (controller !== instance) return;
    console.warn('[Save Slot] Three.js slot scene fell back to CSS:', reason);
    requestedOperation += 1;
    controller = null;
    rendererState = 'fallback';
    instance.destroy();
  }

  function scheduleSynchronization(): void {
    const operation = ++requestedOperation;
    rendererState = controller ? 'loading' : rendererState;
    synchronizationQueue = synchronizationQueue
      .catch(() => undefined)
      .then(async () => {
        if (operation !== requestedOperation) return;
        const activeController = controller;
        if (!activeController) return;
        try {
          if (releaseId && coverUrl) {
            await activeController.insert(releaseId, coverUrl);
            if (operation === requestedOperation) rendererState = 'ready';
          } else {
            await activeController.eject();
            if (operation === requestedOperation) rendererState = 'idle';
          }
        } catch (error) {
          if (operation === requestedOperation) fallBack(activeController, error);
        }
      });
  }

  $effect(() => {
    const activeController = controller;
    const options = effectiveTextureOptions;
    if (activeController) activeController.setTextureOptions(options);
  });

  $effect(() => {
    releaseId;
    coverUrl;
    controller;
    if (controller) scheduleSynchronization();
  });

  onMount(() => {
    const storedMode = localStorage.getItem('save-slot-artwork-mode');
    if (storedMode === 'clean' || storedMode === 'ps1' || storedMode === 'crt') {
      artworkMode = storedMode;
    }

    let disposed = false;
    let removeContextListener = () => undefined;
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

        const canvas = target.querySelector('canvas');
        const handleContextLost = (event: Event) => {
          event.preventDefault();
          if (!disposed) fallBack(instance, new Error('WebGL context lost.'));
        };
        canvas?.addEventListener('webglcontextlost', handleContextLost);
        removeContextListener = () =>
          canvas?.removeEventListener('webglcontextlost', handleContextLost);
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
      removeContextListener();
      controller?.destroy();
      controller = null;
    };
  });
</script>

<div
  aria-label={label}
  class:crt={effectiveTextureOptions.crt}
  class:dither={effectiveTextureOptions.dither}
  class:pixelated={effectiveTextureOptions.pixelated}
  class="scene-shell"
  data-artwork-mode={artworkMode}
  data-renderer={rendererState}
  role="group"
>
  <div class="mode-controls" role="group" aria-label={`${label}: CLEAN / PS1 / CRT`}>
    <button aria-pressed={artworkMode === 'clean'} class:active={artworkMode === 'clean'} onclick={() => setArtworkMode('clean')} type="button">CLEAN</button>
    <button aria-pressed={artworkMode === 'ps1'} class:active={artworkMode === 'ps1'} onclick={() => setArtworkMode('ps1')} type="button">PS1</button>
    <button aria-pressed={artworkMode === 'crt'} class:active={artworkMode === 'crt'} onclick={() => setArtworkMode('crt')} type="button">CRT</button>
  </div>

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
