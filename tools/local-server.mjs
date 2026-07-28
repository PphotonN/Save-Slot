import { createServer } from "node:http";
import { access, copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const DATA_DIR = join(ROOT, ".save-slot-data");
const LIBRARY_FILE = join(DATA_DIR, "library.json");
const BACKUP_FILE = join(DATA_DIR, "library.backup.json");
const PORT = Number.parseInt(process.env.PORT || "8080", 10);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY_BYTES = 10 * 1024 * 1024;

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".webp", "image/webp"]
]);

function send(response, statusCode, body = "", headers = {}) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...headers
  });
  response.end(body);
}

function sendJson(response, statusCode, value) {
  send(response, statusCode, `${JSON.stringify(value, null, 2)}\n`, {
    "content-type": "application/json; charset=utf-8"
  });
}

async function ensureDataFiles() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await access(LIBRARY_FILE, constants.F_OK);
  } catch {
    await writeFile(LIBRARY_FILE, "{}\n", "utf8");
  }
}

async function readLibrary() {
  await ensureDataFiles();
  const text = await readFile(LIBRARY_FILE, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`library.json містить некоректний JSON: ${error.message}`);
  }
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function writeLibrary(value) {
  await ensureDataFiles();
  const temporaryFile = `${LIBRARY_FILE}.tmp`;
  try {
    await access(LIBRARY_FILE, constants.F_OK);
    await copyFile(LIBRARY_FILE, BACKUP_FILE);
  } catch {
    // Перший запис ще не має попередньої версії для резервної копії.
  }
  await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryFile, LIBRARY_FILE);
}

async function handleLibraryApi(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, await readLibrary());
    return;
  }

  if (request.method === "PUT" || request.method === "POST") {
    const rawBody = await readRequestBody(request);
    let value;
    try {
      value = JSON.parse(rawBody || "null");
    } catch {
      sendJson(response, 400, { error: "INVALID_JSON" });
      return;
    }
    await writeLibrary(value);
    sendJson(response, 200, { ok: true });
    return;
  }

  send(response, 405, "Method Not Allowed", { allow: "GET, PUT, POST" });
}

function safeStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const normalized = normalize(decoded).replace(/^([.][.][/\\])+/, "");
  const absolute = resolve(ROOT, `.${sep}${normalized}`);
  return absolute === ROOT || absolute.startsWith(`${ROOT}${sep}`) ? absolute : null;
}

async function handleStatic(request, response, pathname) {
  const filePath = safeStaticPath(pathname);
  if (!filePath || filePath.startsWith(`${DATA_DIR}${sep}`)) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const details = await stat(filePath);
    if (!details.isFile()) throw new Error("NOT_FILE");
    const content = await readFile(filePath);
    send(response, 200, content, {
      "cache-control": "no-cache",
      "content-type": MIME_TYPES.get(extname(filePath).toLowerCase()) || "application/octet-stream"
    });
  } catch {
    send(response, 404, "Not Found");
  }
}

await ensureDataFiles();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, node: process.version });
      return;
    }
    if (url.pathname === "/api/library") {
      await handleLibraryApi(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      send(response, 405, "Method Not Allowed", { allow: "GET, HEAD" });
      return;
    }
    await handleStatic(request, response, url.pathname);
  } catch (error) {
    if (error.message === "PAYLOAD_TOO_LARGE") {
      sendJson(response, 413, { error: "PAYLOAD_TOO_LARGE" });
      return;
    }
    console.error(error);
    sendJson(response, 500, { error: "INTERNAL_SERVER_ERROR" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Save Slot: http://${HOST}:${PORT}`);
  console.log(`Library: ${LIBRARY_FILE}`);
});
