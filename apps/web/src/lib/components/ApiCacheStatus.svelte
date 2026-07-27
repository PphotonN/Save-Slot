<script lang="ts">
  import { onMount } from 'svelte';
  import type { SupportedLocale } from '@save-slot/i18n';
  import { CatalogClient, type CatalogueCacheStatus } from '$lib/catalog-client';

  interface Props {
    locale?: SupportedLocale;
  }

  const client = new CatalogClient();
  let { locale = 'uk' }: Props = $props();
  let status = $state<CatalogueCacheStatus | null>(null);
  let loading = $state(false);
  let messageKind = $state<'idle' | 'checking' | 'active' | 'unavailable' | 'error'>('idle');
  let rawError = $state('');

  const copy = {
    uk: {
      idle: 'Стан кешу ще не перевірено.',
      checking: 'Перевіряю кеш каталогу…',
      active: 'Активні рівні: {backends}.',
      unavailable: 'API кешу недоступний. Застосунок продовжить працювати через локальні fallback-дані.',
      error: 'Не вдалося перевірити кеш каталогу.',
      title: 'Кеш онлайн-каталогу',
      refresh: 'Оновити',
      memory: 'У пам’яті',
      hits: 'Влучання',
      misses: 'Промахи',
      writes: 'Записи',
      search: 'Пошук',
      suggestions: 'Підказки',
      details: 'Деталі',
      pool: 'Пул пошуку',
      games: 'ігор',
      activeState: 'Активний',
      unavailableState: 'Недоступний',
      notConfigured: 'Не налаштований',
      hours: 'год',
      days: 'дн',
    },
    en: {
      idle: 'Cache status has not been checked yet.',
      checking: 'Checking catalogue cache…',
      active: 'Active layers: {backends}.',
      unavailable: 'The cache API is unavailable. The app will continue with local fallback data.',
      error: 'Could not check the catalogue cache.',
      title: 'Online catalogue cache',
      refresh: 'Refresh',
      memory: 'In memory',
      hits: 'Hits',
      misses: 'Misses',
      writes: 'Writes',
      search: 'Search',
      suggestions: 'Suggestions',
      details: 'Details',
      pool: 'Search pool',
      games: 'games',
      activeState: 'Active',
      unavailableState: 'Unavailable',
      notConfigured: 'Not configured',
      hours: 'h',
      days: 'd',
    },
  } as const;

  let text = $derived(copy[locale]);
  let message = $derived.by(() => {
    if (messageKind === 'error' && rawError) return rawError;
    if (messageKind === 'active' && status) {
      return text.active.replace('{backends}', status.backends.join(' → '));
    }
    return text[messageKind];
  });

  function duration(seconds: number): string {
    const hours = Math.max(1, Math.round(seconds / 3600));
    if (hours < 24) return `${hours} ${text.hours}`;
    return `${Math.max(1, Math.round(hours / 24))} ${text.days}`;
  }

  async function refresh(): Promise<void> {
    loading = true;
    rawError = '';
    messageKind = 'checking';
    try {
      status = await client.cacheStatus();
      messageKind = status ? 'active' : 'unavailable';
    } catch (error) {
      status = null;
      rawError = error instanceof Error ? error.message : '';
      messageKind = 'error';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void refresh();
  });
</script>

<section class="cache-card">
  <header>
    <div>
      <span>{text.title.toLocaleUpperCase(locale)}</span>
      <p>{message}</p>
    </div>
    <button disabled={loading} onclick={() => void refresh()} type="button">
      {loading ? '…' : text.refresh.toLocaleUpperCase(locale)}
    </button>
  </header>

  {#if status}
    <div class="metrics">
      <div><span>{text.memory.toLocaleUpperCase(locale)}</span><strong>{status.stats.memoryEntries}</strong></div>
      <div><span>{text.hits.toLocaleUpperCase(locale)}</span><strong>{status.stats.hits}</strong></div>
      <div><span>{text.misses.toLocaleUpperCase(locale)}</span><strong>{status.stats.misses}</strong></div>
      <div><span>{text.writes.toLocaleUpperCase(locale)}</span><strong>{status.stats.writes}</strong></div>
    </div>
    <dl>
      <div><dt>{text.search.toLocaleUpperCase(locale)}</dt><dd>{duration(status.searchTtlSeconds)}</dd></div>
      <div><dt>{text.suggestions.toLocaleUpperCase(locale)}</dt><dd>{status.suggestionTtlSeconds ? duration(status.suggestionTtlSeconds) : '—'}</dd></div>
      <div><dt>{text.details.toLocaleUpperCase(locale)}</dt><dd>{duration(status.detailTtlSeconds)}</dd></div>
      <div><dt>{text.pool.toLocaleUpperCase(locale)}</dt><dd>{status.searchPoolLimit ?? '—'} {text.games}</dd></div>
      <div><dt>CACHE API</dt><dd>{status.stats.cacheApiEnabled ? text.activeState : text.unavailableState}</dd></div>
      <div><dt>KV</dt><dd>{status.stats.kvEnabled ? text.activeState : text.notConfigured}</dd></div>
    </dl>
  {/if}
</section>

<style>
  .cache-card {
    display: grid;
    gap: 0.8rem;
    padding: 1rem;
    background: var(--panel);
    border: 1px solid var(--line);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.8rem;
  }

  header span,
  dt {
    color: var(--accent-cool);
    font: 0.44rem/1.4 var(--pixel-font);
  }

  header p {
    margin: 0.45rem 0 0;
    color: var(--muted-light);
    line-height: 1.45;
  }

  button {
    min-height: 38px;
    padding: 0.55rem 0.7rem;
    color: var(--accent);
    font: 0.4rem/1.2 var(--pixel-font);
    background: #090d0e;
    border: 1px solid var(--line);
  }

  .metrics,
  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.45rem;
    margin: 0;
  }

  .metrics div,
  dl div {
    min-width: 0;
    padding: 0.65rem;
    background: #0b1113;
    border: 1px solid var(--line);
  }

  .metrics span {
    display: block;
    color: var(--muted);
    font: 0.36rem/1.3 var(--pixel-font);
  }

  .metrics strong {
    display: block;
    margin-top: 0.45rem;
    font-size: 1.2rem;
  }

  dd {
    margin: 0.4rem 0 0;
    overflow-wrap: anywhere;
    color: var(--muted-light);
    font-size: 0.76rem;
  }

  @media (max-width: 560px) {
    header {
      display: grid;
    }

    header button {
      justify-self: start;
    }

    .metrics,
    dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
