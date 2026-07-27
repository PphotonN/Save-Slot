import { createServer } from 'node:http';
import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const cacheDirectory = resolve(process.env.SAVE_SLOT_DATA_DIR || join(projectRoot, '.save-slot-data'));
const libraryPath = join(cacheDirectory, 'library.json');
const backupPath = join(cacheDirectory, 'library.backup.json');
const temporaryPath = join(cacheDirectory, 'library.tmp.json');
const host = process.env.SAVE_SLOT_LIBRARY_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.SAVE_SLOT_LIBRARY_PORT || '8791', 10);
const maximumBodyBytes = 20 * 1024 * 1024;

function corsHeaders(request) {
  const origin = request.headers.origin;
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function sendJson(response, request, status, value) {
  response.writeHead(status, {
    ...corsHeaders(request),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
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
  if (!value || typeof value !== 'object') throw new Error('Library payload must be a JSON object.');
  if (value.format !== 'save-slot-collection') throw new Error('Unsupported library format.');
  if (value.version !== 1) throw new Error('Unsupported library version.');
  for (const key of ['lists', 'entries', 'snapshots']) {
    if (!Array.isArray(value[key])) throw new Error(`Library field "${key}" must be an array.`);
  }
  return value;
}

async function libraryExists() {
  try {
    await stat(libraryPath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function writeLibrary(payload) {
  await mkdir(cacheDirectory, { recursive: true });
  if (await libraryExists()) await copyFile(libraryPath, backupPath);
  await writeFile(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, libraryPath);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);

    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders(request));
      response.end();
      return;
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, request, 200, {
        service: 'save-slot-library-cache',
        status: 'ok',
        projectRoot,
        cacheDirectory,
        libraryPath,
        exists: await libraryExists(),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/library') {
      if (!(await libraryExists())) {
        sendJson(response, request, 404, { error: 'library_not_found', libraryPath });
        return;
      }
      const payload = validateLibraryPayload(JSON.parse(await readFile(libraryPath, 'utf8')));
      sendJson(response, request, 200, payload);
      return;
    }

    if (request.method === 'PUT' && url.pathname === '/library') {
      const body = await readBody(request);
      const payload = validateLibraryPayload(JSON.parse(body));
      await writeLibrary(payload);
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
      error: 'library_cache_error',
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

server.listen(port, host, () => {
  console.log('========================================');
  console.log('  SAVE SLOT PROJECT LIBRARY CACHE');
  console.log('========================================');
  console.log(`[READY] http://${host}:${port}`);
  console.log(`[FILE]  ${libraryPath}`);
  console.log('[INFO]  Collection changes are mirrored to this project folder.');
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
