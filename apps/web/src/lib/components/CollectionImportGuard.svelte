<script lang="ts">
  import { onMount } from 'svelte';
  import { detectLocale, type SupportedLocale } from '@save-slot/i18n';

  const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
  const acceptedMimeTypes = new Set(['application/json', 'text/json']);

  let message = $state('');
  let locale = $state<SupportedLocale>('uk');
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  function copy(key: 'large' | 'type'): string {
    const messages = {
      uk: {
        large: 'Файл резервної копії завеликий. Максимальний розмір — 8 МіБ.',
        type: 'Оберіть резервну копію Save Slot у форматі JSON.',
      },
      en: {
        large: 'The backup file is too large. The maximum size is 8 MiB.',
        type: 'Choose a Save Slot backup in JSON format.',
      },
    } as const;
    return messages[locale][key];
  }

  function showMessage(value: string): void {
    message = value;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      message = '';
      hideTimer = undefined;
    }, 6_000);
  }

  function isCollectionImport(input: HTMLInputElement): boolean {
    if (input.type !== 'file') return false;
    const accept = input.accept.toLocaleLowerCase('en-US');
    return accept.includes('json') || input.dataset.saveSlotImport === 'collection';
  }

  function isJsonFile(file: File): boolean {
    const type = file.type.toLocaleLowerCase('en-US');
    if (acceptedMimeTypes.has(type)) return true;
    return type === '' && file.name.toLocaleLowerCase('en-US').endsWith('.json');
  }

  function rejectImport(event: Event, input: HTMLInputElement, reason: 'large' | 'type'): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    input.value = '';
    showMessage(copy(reason));
  }

  onMount(() => {
    const synchronizeLocale = () => {
      locale = detectLocale(document.documentElement.lang);
    };
    synchronizeLocale();

    const languageObserver = new MutationObserver(synchronizeLocale);
    languageObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });

    const handleChange = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !isCollectionImport(input)) return;
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        rejectImport(event, input, 'large');
        return;
      }
      if (!isJsonFile(file)) rejectImport(event, input, 'type');
    };

    window.addEventListener('change', handleChange, { capture: true });
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      languageObserver.disconnect();
      window.removeEventListener('change', handleChange, { capture: true });
    };
  });
</script>

{#if message}
  <div class="import-warning" role="alert" aria-live="assertive">{message}</div>
{/if}

<style>
  .import-warning {
    position: fixed;
    z-index: 900;
    right: max(0.8rem, env(safe-area-inset-right));
    bottom: max(4.6rem, calc(env(safe-area-inset-bottom) + 4.6rem));
    width: min(430px, calc(100vw - 1.6rem));
    padding: 0.85rem 1rem;
    color: #ffe5e1;
    line-height: 1.45;
    background: rgba(45, 12, 10, 0.97);
    border: 1px solid var(--danger);
    box-shadow: 0 18px 55px rgba(0, 0, 0, 0.5);
  }

  @media (min-width: 761px) {
    .import-warning {
      bottom: 1rem;
    }
  }
</style>
