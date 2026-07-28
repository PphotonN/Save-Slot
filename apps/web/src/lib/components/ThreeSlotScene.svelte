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

  let { releaseId, coverUrl, platform, label, textureOptions = {} }: Props = $props();
  let target: HTMLDivElement;
  let controller = $state<ThreeSlotSceneController | null>(null);
  let rendererState = $state<'loading' | 'ready' | 'idle' | 'fallback'>('loading');
  let requestedOperation = 0;

  let effectiveTextureOptions = $derived.by((): CartridgeTextureOptions => ({
    pixelated: textureOptions.pixelated ?? false,
    dither: textureOptions.dither ?? false,
    crt: false,
    textureResolution: textureOptions.textureResolution ?? 512,
  }));

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
    const activeController = controller;
    if (!activeController) return;
    rendererState = 'loading';
    void (async () => {
      try {
        if (releaseId) {
          await activeController.insert(releaseId, coverUrl ?? '');
          if (operation === requestedOperation) rendererState = 'ready';
        } else {
          await activeController.eject();
          if (operation === requestedOperation) rendererState = 'idle';
        }
      } catch (error) {
        if (operation === requestedOperation) fallBack(activeController, error);
      }
    })();
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
    let disposed = false;
    let removeContextListener: () => void = () => {};
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
        removeContextListener = () => {
          canvas?.removeEventListener('webglcontextlost', handleContextLost);
        };
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
  class="scene-shell"
  data-renderer={rendererState}
  role="group"
>
  <div aria-hidden={Boolean(controller) && rendererState !== 'fallback'} class:hidden={Boolean(controller) && rendererState !== 'fallback'} class="css-fallback">
    <div class="fallback-chassis">
      <div class="fallback-slot"></div>
      <div class:inserted={Boolean(releaseId)} class="fallback-cartridge">
        {#if coverUrl}
          <img src={coverUrl} alt="" />
          {#if platform}<span>{platform}</span>{/if}
        {:else}
          <strong>SAVE<br />SLOT</strong>
        {/if}
      </div>
    </div>
  </div>
  <div aria-hidden="true" bind:this={target} class:visible={Boolean(controller) && rendererState !== 'fallback'} class="webgl-target"></div>
  {#if rendererState === 'loading' && !controller}<span class="renderer-status">THREE…</span>{/if}
</div>
