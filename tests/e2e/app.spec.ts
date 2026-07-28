import { Buffer } from 'node:buffer';
import { expect, test, type Locator, type Page } from '@playwright/test';

async function prepareLocalApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!localStorage.getItem('save-slot-locale')) {
      localStorage.setItem('save-slot-locale', 'uk');
    }
  });

  await page.route('http://127.0.0.1:8791/**', async (route) => {
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:4173',
      'access-control-allow-methods': 'GET, PUT, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'content-type': 'application/json; charset=utf-8',
    };
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers, body: '' });
      return;
    }
    if (method === 'PUT') {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ saved: true }) });
      return;
    }
    await route.fulfill({
      status: 404,
      headers,
      body: JSON.stringify({ error: 'library_not_found' }),
    });
  });

  await page.route('https://**/*', async (route) => {
    if (route.request().resourceType() === 'image') {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 20_000 });
}

async function waitForStableCount(
  page: Page,
  locator: Locator,
  timeoutMs = 20_000,
  stableMs = 1_000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let previous = -1;
  let stableSince = Date.now();

  while (Date.now() < deadline) {
    const current = await locator.count();
    if (current !== previous) {
      previous = current;
      stableSince = Date.now();
    } else if (current > 0 && Date.now() - stableSince >= stableMs) {
      return current;
    }
    await page.waitForTimeout(100);
  }

  throw new Error(`Card count did not stabilize within ${timeoutMs} ms; last count was ${previous}.`);
}

function visibleNavigation(page: Page) {
  return page.locator('.side-navigation:visible, .mobile-navigation:visible').first();
}

test.beforeEach(async ({ page }) => {
  await prepareLocalApp(page);
});

test('starts from the offline-safe fixture catalogue', async ({ page }) => {
  await expect(page.locator('.results-heading')).toContainText('КАТАЛОГ РЕЛІЗІВ');
  await expect(page.locator('.game-card')).not.toHaveCount(0);
  await expect(page.locator('.search-status')).toContainText(/Готово|Ready/);
  await expect(page.locator('.source-status-row')).toBeVisible();
});

test('switches the interface language and keeps it after reload', async ({ page }) => {
  await visibleNavigation(page).getByRole('button', { name: 'ПАРАМЕТРИ', exact: true }).click();
  await page.locator('.settings-grid select').first().selectOption('en');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(visibleNavigation(page).getByRole('button', { name: 'SEARCH', exact: true })).toBeVisible();
  await expect(page.locator('.cache-card')).toContainText('ONLINE CATALOGUE CACHE');

  await visibleNavigation(page).getByRole('button', { name: 'SEARCH', exact: true }).click();
  await expect(page.getByPlaceholder('Game title, series, developer…')).toBeVisible();
  await expect(page.locator('.game-card .collection-toggle').first()).toHaveAttribute(
    'aria-label',
    'Add to collection',
  );

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByPlaceholder('Game title, series, developer…')).toBeVisible();
});

test('keeps search filters available and sorts without changing the card set', async ({ page }) => {
  const cards = page.locator('.game-card');
  const initialCount = await waitForStableCount(page, cards);
  const initialTitles = await page.locator('.game-card h2').allTextContents();
  const filters = page.locator('.search-filter-grid');

  await expect(filters).toBeVisible();
  await expect(filters.locator('select')).toHaveCount(6);
  await expect(filters.locator('.filter-reset')).toBeVisible();
  await filters.locator('select').nth(4).selectOption('title');
  await filters.locator('select').nth(5).selectOption('asc');

  await expect(cards).toHaveCount(initialCount);
  const sortedTitles = await page.locator('.game-card h2').allTextContents();
  const expected = [...initialTitles].sort(new Intl.Collator('uk').compare);
  expect(sortedTitles).toEqual(expected);
});

test('keeps the latest selected release and removes visual filter controls', async ({ page }) => {
  const cards = page.locator('.game-card');
  await expect(cards.nth(1)).toBeVisible({ timeout: 20_000 });
  const latestTitle = (await cards.nth(1).locator('h2').textContent())?.trim();
  expect(latestTitle).toBeTruthy();

  await cards.first().locator('.card-select').click();
  await cards.nth(1).locator('.card-select').click();

  await expect(page.locator('.game-header h1')).toHaveText(latestTitle!);
  await expect(page.locator('.fallback-cartridge')).toHaveClass(/inserted/);
  await expect(page.locator('.scene-shell')).toHaveAttribute('data-renderer', /ready|fallback/, {
    timeout: 20_000,
  });
  await expect(page.locator('.mode-controls')).toHaveCount(0);
  await expect(page.locator('.scene-shell')).not.toHaveAttribute('data-artwork-mode', /.+/);

  await page.waitForTimeout(1_500);
  await expect(page.locator('.game-header h1')).toHaveText(latestTitle!);
});

test('rejects non-JSON and oversized collection backups before import', async ({ page }) => {
  await visibleNavigation(page).getByRole('button', { name: 'ПАРАМЕТРИ', exact: true }).click();
  const importInput = page.locator('input[type="file"]');

  await importInput.setInputFiles({
    name: 'library.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('{"format":"save-slot-collection"}'),
  });
  await expect(page.getByRole('alert')).toContainText('форматі JSON');
  await expect(importInput).toHaveValue('');

  await importInput.setInputFiles({
    name: 'library.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1, 0x20),
  });
  await expect(page.getByRole('alert')).toContainText('8 МіБ');
  await expect(importInput).toHaveValue('');
});

test('creates a custom list and restores it from IndexedDB after reload', async ({ page }) => {
  await visibleNavigation(page).getByRole('button', { name: 'КОЛЕКЦІЯ', exact: true }).click();
  await page.getByRole('button', { name: '+ СПИСОК', exact: true }).click();
  await page.locator('.list-creator input').fill('Ретро полиця');
  await page.getByRole('button', { name: 'СТВОРИТИ', exact: true }).click();
  await expect(page.locator('.list-tabs')).toContainText('Ретро полиця');

  await page.reload();
  await visibleNavigation(page).getByRole('button', { name: 'КОЛЕКЦІЯ', exact: true }).click();
  await expect(page.locator('.list-tabs')).toContainText('Ретро полиця');
});

test('uses the correct navigation shell for the active viewport', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'smartphone-chromium') {
    await expect(page.locator('.mobile-navigation')).toBeVisible();
    await expect(page.locator('.side-navigation')).toBeHidden();
    await page.locator('.mobile-navigation').getByRole('button', { name: 'КОЛЕКЦІЯ' }).click();
    await expect(page.locator('.collection-panel')).toBeVisible();
    return;
  }

  await expect(page.locator('.side-navigation')).toBeVisible();
  await expect(page.locator('.mobile-navigation')).toBeHidden();
});
