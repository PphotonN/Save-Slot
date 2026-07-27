import { expect, test, type Page } from '@playwright/test';

async function stubDesktopLibrary(page: Page): Promise<void> {
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
}

async function waitForServiceWorkerControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state ?? null), {
      timeout: 20_000,
    })
    .toBe('activated');
}

test('restores the application shell and personal collection without network access', async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('save-slot-locale', 'uk');
  });
  await stubDesktopLibrary(page);

  await page.goto('/');
  await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 20_000 });
  await waitForServiceWorkerControl(page);

  const firstCard = page.locator('.game-card').first();
  const selectedTitle = (await firstCard.locator('h2').textContent())?.trim();
  expect(selectedTitle).toBeTruthy();
  await firstCard.locator('.collection-toggle').click();

  await page.locator('.side-navigation').getByRole('button', { name: 'КОЛЕКЦІЯ' }).click();
  await expect(page.locator('.collection-item')).toHaveCount(1);
  await expect(page.locator('.collection-item')).toContainText(selectedTitle!);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 20_000 });
  await page.locator('.side-navigation').getByRole('button', { name: 'КОЛЕКЦІЯ' }).click();
  await expect(page.locator('.collection-item')).toHaveCount(1);
  await expect(page.locator('.collection-item')).toContainText(selectedTitle!);
});
