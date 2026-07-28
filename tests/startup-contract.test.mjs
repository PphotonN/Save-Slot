import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function json(path) {
  return JSON.parse(await text(path));
}

test('startup runtime and package versions stay aligned', async () => {
  const rootPackage = await json('package.json');
  const apiPackage = await json('apps/api/package.json');
  const bootstrap = await text('scripts/bootstrap-windows.ps1');

  assert.equal(rootPackage.packageManager, 'pnpm@10.14.0');
  assert.equal(apiPackage.devDependencies.wrangler, '4.114.0');
  assert.match(bootstrap, /\$NodeVersion = '24\.18\.0'/);
  assert.match(bootstrap, /\$PnpmVersion = '10\.14\.0'/);
  assert.match(bootstrap, /\$WranglerVersion = '4\.114\.0'/);
});

test('all startup endpoints use fixed loopback addresses', async () => {
  const apiPackage = await json('apps/api/package.json');
  const webEnvironment = await text('apps/web/.env.example');
  const viteConfig = await text('apps/web/vite.config.ts');
  const windowsLauncher = await text('scripts/launch-windows.ps1');

  assert.equal(apiPackage.scripts.dev, 'wrangler dev --ip 127.0.0.1 --port 8787');
  assert.match(webEnvironment, /^VITE_SAVE_SLOT_API_URL=http:\/\/127\.0\.0\.1:8787\s*$/);
  assert.match(viteConfig, /host: '127\.0\.0\.1'/);
  assert.match(viteConfig, /port: 5173/);
  assert.match(windowsLauncher, /http:\/\/127\.0\.0\.1:8791\/health/);
  assert.match(windowsLauncher, /http:\/\/127\.0\.0\.1:8787\/health/);
  assert.match(windowsLauncher, /http:\/\/127\.0\.0\.1:5173\/health\.json/);
});

test('startup files, health marker and frozen lockfile are present', async () => {
  const batch = await text('START_SAVE_SLOT.bat');
  const shell = await text('start-save-slot.sh');
  const health = await json('apps/web/static/health.json');
  const lockfile = await text('pnpm-lock.yaml');
  const workspace = await text('pnpm-workspace.yaml');

  for (const file of [
    'bootstrap-windows.ps1',
    'launch-windows.ps1',
    'run-service-windows.cmd',
    'service-probe.mjs',
  ]) {
    assert.match(batch, new RegExp(file.replaceAll('.', '\\.')));
  }
  assert.match(shell, /--frozen-lockfile/);
  assert.match(lockfile, /^lockfileVersion: '9\.0'/);
  assert.deepEqual(health, { service: 'save-slot-web', status: 'ok' });
  assert.match(workspace, /onlyBuiltDependencies:\s+\- esbuild\s+\- workerd/);
});
