import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const mobileDirectory = resolve(scriptDirectory, '..');
const repositoryRoot = resolve(mobileDirectory, '../..');
const androidDirectory = resolve(mobileDirectory, 'android');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(arguments_, workingDirectory) {
  const result = spawnSync(pnpmCommand, arguments_, {
    cwd: workingDirectory,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Command failed: pnpm ${arguments_.join(' ')}`);
  }
}

console.log('[Save Slot Mobile] Building the shared SvelteKit application…');
run(['--filter', '@save-slot/web', 'build'], repositoryRoot);

if (!existsSync(androidDirectory)) {
  console.log('[Save Slot Mobile] Creating the Android project…');
  run(['exec', 'cap', 'add', 'android'], mobileDirectory);
} else {
  console.log('[Save Slot Mobile] Reusing the existing Android project.');
}

console.log('[Save Slot Mobile] Synchronizing web assets and native dependencies…');
run(['exec', 'cap', 'sync', 'android'], mobileDirectory);
console.log('[Save Slot Mobile] Android project is ready.');
