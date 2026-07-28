import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXIT_UNAVAILABLE = 1;
const EXIT_MISMATCH = 2;
const EXIT_PORT_OCCUPIED = 3;

function normalizePath(value) {
  const normalized = resolve(value).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? normalized.toLocaleLowerCase('en-US') : normalized;
}

export async function probeService({
  url,
  expectedService,
  expectedProjectRoot,
  timeoutMs = 1_500,
  fetchImpl = fetch,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Service probe timed out.')), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    let payload;
    try {
      payload = await response.json();
    } catch {
      return {
        state: 'mismatch',
        message: `${url} responded, but did not return JSON.`,
      };
    }

    if (!response.ok) {
      return {
        state: 'mismatch',
        message: `${url} responded with HTTP ${response.status}.`,
      };
    }

    if (!payload || typeof payload !== 'object' || payload.service !== expectedService) {
      return {
        state: 'mismatch',
        message: `${url} is occupied by an unexpected service.`,
      };
    }

    if (expectedProjectRoot) {
      if (typeof payload.projectRoot !== 'string') {
        return {
          state: 'mismatch',
          message: `${url} did not identify its project folder.`,
        };
      }
      if (normalizePath(payload.projectRoot) !== normalizePath(expectedProjectRoot)) {
        return {
          state: 'mismatch',
          message: `${url} belongs to another Save Slot project folder: ${payload.projectRoot}`,
        };
      }
    }

    return { state: 'ready', message: `${expectedService} is ready.` };
  } catch (error) {
    return {
      state: 'unavailable',
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function waitForService(options) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 300;
  const deadline = Date.now() + timeoutMs;
  let latest = { state: 'unavailable', message: 'Service is not available.' };

  while (Date.now() < deadline) {
    latest = await probeService({ ...options, timeoutMs: Math.min(2_000, timeoutMs) });
    if (latest.state === 'ready' || latest.state === 'mismatch') return latest;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, intervalMs));
  }

  return {
    state: 'unavailable',
    message: `${options.expectedService} did not become ready within ${timeoutMs} ms. Last error: ${latest.message}`,
  };
}

export async function isPortFree({ host, port }) {
  return await new Promise((resolveResult, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', (error) => {
      if (error?.code === 'EADDRINUSE' || error?.code === 'EACCES') {
        resolveResult(false);
        return;
      }
      reject(error);
    });
    server.listen({ host, port, exclusive: true }, () => {
      server.close((error) => {
        if (error) reject(error);
        else resolveResult(true);
      });
    });
  });
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const values = { command, quiet: false };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--quiet') {
      values.quiet = true;
      continue;
    }
    if (!argument?.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${argument}.`);
    values[key] = value;
    index += 1;
  }
  return values;
}

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing --${name}.`);
  return value;
}

function positiveInteger(value, name, fallback) {
  if (value === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing --${name}.`);
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`Invalid --${name}: ${value}`);
  return parsed;
}

async function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const quiet = options.quiet === true;

  if (options.command === 'port-free') {
    const host = required(options.host, 'host');
    const port = positiveInteger(options.port, 'port');
    const free = await isPortFree({ host, port });
    if (!quiet) console.log(free ? `[FREE] ${host}:${port}` : `[BUSY] ${host}:${port}`);
    process.exitCode = free ? 0 : EXIT_PORT_OCCUPIED;
    return;
  }

  if (options.command !== 'probe' && options.command !== 'wait') {
    throw new Error('Expected command: probe, wait or port-free.');
  }

  const probeOptions = {
    url: required(options.url, 'url'),
    expectedService: required(options.service, 'service'),
    expectedProjectRoot: options.projectRoot,
    timeoutMs: positiveInteger(
      options.timeoutMs,
      'timeout-ms',
      options.command === 'wait' ? 30_000 : 1_500,
    ),
  };
  const result =
    options.command === 'wait'
      ? await waitForService(probeOptions)
      : await probeService(probeOptions);

  if (!quiet) {
    const label = result.state === 'ready' ? 'READY' : result.state === 'mismatch' ? 'ERROR' : 'WAIT';
    const output = result.state === 'ready' ? console.log : console.error;
    output(`[${label}] ${result.message}`);
  }

  process.exitCode =
    result.state === 'ready' ? 0 : result.state === 'mismatch' ? EXIT_MISMATCH : EXIT_UNAVAILABLE;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch((error) => {
    console.error(`[ERROR] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 64;
  });
}
