import { Buffer } from 'node:buffer';
import { expect, test, type Page } from '@playwright/test';

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

test('sorting changes order without changing the visible card set', async ({ page }) => {
  const cards = page.locator('.game-card');
  const initialCount = await cards.count();
  const initialTitles = await page.locator('.game-card h2').allTextContents();

  await page.locator('.toolbar-row').getByRole('button', { name: /ФІЛЬТРИ/ }).click();
  await page
    .locator('.toolbar-row label')
    .filter({ hasText: 'СОРТУВАННЯ' })
    .locator('select')
    .selectOption('title');

  await expect(cards).toHaveCount(initialCount);
  const sortedTitles = await page.locator('.game-card h2').allTextContents();
  const expected = [...initialTitles].sort(new Intl.Collator('uk').compare);
  expect(sortedTitles).toEqual(expected);
});

test('inserts a selected release and persists its artwork mode', async ({ page }) => {
  await page.locator('.game-card .card-select').first().click();
  await expect(page.locator('.game-header h1')).toBeVisible();
  await expect(page.locator('.fallback-cartridge')).toHaveClass(/inserted/);
  await expect(page.locator('.scene-shell')).toHaveAttribute('data-renderer', /ready|fallback/, {
    timeout: 20_000,
  });

  await page.locator('.mode-controls').getByRole('button', { name: 'CRT', exact: true }).click();
  await expect(page.locator('.scene-shell')).toHaveAttribute('data-artwork-mode', 'crt');
  await expect(page.locator('.mode-controls').getByRole('button', { name: 'CRT' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.reload();
  await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.scene-shell')).toHaveAttribute('data-artwork-mode', 'crt');
  await expect(page.locator('.mode-controls').getByRole('button', { name: 'CRT' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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
