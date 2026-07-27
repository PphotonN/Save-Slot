<script lang="ts">
  import { onMount } from 'svelte';
  import { CatalogClient, type CatalogueCacheStatus } from '$lib/catalog-client';

  const client = new CatalogClient();
  let status = $state<CatalogueCacheStatus | null>(null);
  let loading = $state(false);
  let message = $state('Стан кешу ще не перевірено.');

  function duration(seconds: number): string {
    const hours = Math.round(seconds / 3600);
    if (hours < 24) return `${hours} год`;
    return `${Math.round(hours / 24)} дн`;
  }

  async function refresh(): Promise<void> {
    loading = true;
    message = 'Перевіряю кеш каталогу…';
    try {
      status = await client.cacheStatus();
      message = status
        ? `Активні рівні: ${status.backends.join(' → ')}.`
        : 'API кешу недоступний. Застосунок продовжить працювати через локальні fallback-дані.';
    } catch (error) {
      status = null;
      message = error instanceof Error ? error.message : 'Не вдалося перевірити кеш каталогу.';
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
      <span>КЕШ ОНЛАЙН-КАТАЛОГУ</span>
      <p>{message}</p>
    </div>
    <button disabled={loading} onclick={() => void refresh()} type="button">
      {loading ? '…' : 'ОНОВИТИ'}
    </button>
  </header>

  {#if status}
    <div class="metrics">
      <div><span>У ПАМ’ЯТІ</span><strong>{status.stats.memoryEntries}</strong></div>
      <div><span>ВЛУЧАННЯ</span><strong>{status.stats.hits}</strong></div>
      <div><span>ПРОМАХИ</span><strong>{status.stats.misses}</strong></div>
      <div><span>ЗАПИСИ</span><strong>{status.stats.writes}</strong></div>
    </div>
    <dl>
      <div><dt>ПОШУК</dt><dd>{duration(status.searchTtlSeconds)}</dd></div>
      <div><dt>ДЕТАЛІ</dt><dd>{duration(status.detailTtlSeconds)}</dd></div>
      <div><dt>CACHE API</dt><dd>{status.stats.cacheApiEnabled ? 'АКТИВНИЙ' : 'НЕДОСТУПНИЙ'}</dd></div>
      <div><dt>KV</dt><dd>{status.stats.kvEnabled ? 'АКТИВНИЙ' : 'НЕ НАЛАШТОВАНИЙ'}</dd></div>
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
    grid-template-columns: repeat(4, minmax(0, 1fr));
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

  @media (max-width: 620px) {
    .metrics,
    dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
