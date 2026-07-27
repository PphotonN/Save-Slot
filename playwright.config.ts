import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const appTests = /app\.spec\.ts/;
const offlineTests = /pwa-offline\.spec\.ts/;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      testMatch: appTests,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'smartphone-chromium',
      testMatch: appTests,
      use: {
        ...devices['Pixel 7'],
      },
    },
    {
      name: 'pwa-offline-chromium',
      testMatch: offlineTests,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        serviceWorkers: 'allow',
      },
    },
  ],
  webServer: {
    command: `pnpm --filter @save-slot/web build && pnpm --filter @save-slot/web preview --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      VITE_SAVE_SLOT_API_URL: '',
      SAVE_SLOT_BASE_PATH: '',
    },
  },
});
