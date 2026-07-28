import { createServer } from 'node:http';
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedLibraryOrigin, libraryCorsHeaders } from './library-cache-policy.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const cacheDirectory = resolve(process.env.SAVE_SLOT_DATA_DIR || join(projectRoot, '.save-slot-data'));
const libraryPath = join(cacheDirectory, 'library.json');
const backupPath = join(cacheDirectory, 'library.backup.json');
const temporaryPath = join(cacheDirectory, 'library.tmp.json');
const host = process.env.SAVE_SLOT_LIBRARY_HOST || '127.0.0.1';
const maximumBodyBytes = 20 * 1024 * 1024;
let writeQueue = Promise.resolve();

function parsePort(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535 || String(parsed) !== value.trim()) {
    throw new Error(`Invalid SAVE_SLOT_LIBRARY_PORT: ${value}`);
  }
  return parsed;
}

if (!['127.0.0.1', '::1', 'localhost'].includes(host.toLocaleLowerCase('en-US'))) {
  throw new Error('SAVE_SLOT_LIBRARY_HOST must remain on a loopback address.');
}
const port = parsePort(process.env.SAVE_SLOT_LIBRARY_PORT || '8791');

function corsHeaders(request) {
  return libraryCorsHeaders(request.headers.origin);
}

function assertAllowedBrowserOrigin(request) {
  const origin = request.headers.origin;
  if (origin === undefined) return;
  if (isAllowedLibraryOrigin(origin)) return;

  const error = new Error('Browser origin is not allowed to access the local Save Slot library.');
  error.statusCode = 403;
  throw error;
}

function sendJson(response, request, status, value) {
  response.writeHead(status, {
    ...corsHeaders(request),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

async function readBody(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > maximumBodyBytes) {
      const error = new Error('Library payload exceeds the 20 MB limit.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

function validateLibraryPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Library payload must be a JSON object.');
  }
  if (value.format !== 'save-slot-collection') throw new Error('Unsupported library format.');
  if (value.version !== 1) throw new Error('Unsupported library version.');
  for (const key of ['lists', 'entries', 'snapshots']) {
    if (!Array.isArray(value[key])) throw new Error(`Library field "${key}" must be an array.`);
  }
  return value;
}

async function fileExists(path) {
  try {
    const details = await stat(path);
    return details.isFile();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function libraryExists() {
  return fileExists(libraryPath);
}

async function readValidatedLibrary(path = libraryPath) {
  return validateLibraryPayload(JSON.parse(await readFile(path, 'utf8')));
}

async function replaceLibraryFile() {
  try {
    await rename(temporaryPath, libraryPath);
  } catch (error) {
    if (!['EEXIST', 'EPERM'].includes(error?.code)) throw error;
    await rm(libraryPath, { force: true });
    await rename(temporaryPath, libraryPath);
  }
}

async function ensureLibraryIntegrity() {
  await mkdir(cacheDirectory, { recursive: true });
  await rm(temporaryPath, { force: true });
  if (!(await libraryExists())) return;

  try {
    await readValidatedLibrary();
    return;
  } catch (libraryError) {
    if (!(await fileExists(backupPath))) {
      throw new Error(`library.json is invalid and no backup is available: ${libraryError.message}`);
    }

    try {
      const backup = await readFile(backupPath, 'utf8');
      validateLibraryPayload(JSON.parse(backup));
      await writeFile(temporaryPath, backup, 'utf8');
      await replaceLibraryFile();
      console.warn('[RECOVERED] Invalid library.json was restored from library.backup.json.');
    } catch (backupError) {
      throw new Error(
        `library.json and library.backup.json are both invalid: ${libraryError.message}; ${backupError.message}`,
      );
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

async function writeLibrary(payload) {
  await mkdir(cacheDirectory, { recursive: true });
  await rm(temporaryPath, { force: true });

  try {
    if (await libraryExists()) await copyFile(libraryPath, backupPath);
    await writeFile(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await replaceLibraryFile();
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

function enqueueLibraryWrite(payload) {
  const operation = writeQueue
    .catch(() => undefined)
    .then(() => writeLibrary(payload));
  writeQueue = operation;
  return operation;
}

const server = createServer(async (request, response) => {
  try {
    assertAllowedBrowserOrigin(request);
    const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);

    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders(request));
      response.end();
      return;
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      const exists = await libraryExists();
      if (exists) await readValidatedLibrary();
      sendJson(response, request, 200, {
        service: 'save-slot-library-cache',
        status: 'ok',
        projectRoot,
        cacheDirectory,
        libraryPath,
        exists,
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/library') {
      if (!(await libraryExists())) {
        sendJson(response, request, 404, { error: 'library_not_found', libraryPath });
        return;
      }
      sendJson(response, request, 200, await readValidatedLibrary());
      return;
    }

    if (request.method === 'PUT' && url.pathname === '/library') {
      const body = await readBody(request);
      const payload = validateLibraryPayload(JSON.parse(body));
      await enqueueLibraryWrite(payload);
      sendJson(response, request, 200, {
        saved: true,
        libraryPath,
        entries: payload.entries.length,
        snapshots: payload.snapshots.length,
      });
      return;
    }

    sendJson(response, request, 404, { error: 'not_found' });
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
    sendJson(response, request, status, {
      error: status === 403 ? 'origin_not_allowed' : 'library_cache_error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[ERROR] Port ${port} is already in use. A Save Slot library cache may already be running.`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});

try {
  await ensureLibraryIntegrity();
  server.listen(port, host, () => {
    console.log('========================================');
    console.log('  SAVE SLOT PROJECT LIBRARY CACHE');
    console.log('========================================');
    console.log(`[READY] http://${host}:${port}`);
    console.log(`[FILE]  ${libraryPath}`);
    console.log('[INFO]  Collection changes are mirrored to this project folder.');
    console.log('[SAFE]  Browser access is restricted to localhost origins.');
  });
} catch (error) {
  console.error(`[ERROR] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
