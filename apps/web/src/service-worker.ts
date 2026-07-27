/// <reference no-default-lib="true" />
/// <reference lib="ES2022" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { base, build, files, prerendered, version } from '$service-worker';

const worker = globalThis as unknown as ServiceWorkerGlobalScope;
const cacheName = `save-slot-${version}`;
const applicationFiles = [...new Set([...build, ...files, ...prerendered])];
const shellCandidates = [`${base}/`, `${base}/index.html`];

async function cachedShell(cache: Cache, request?: Request): Promise<Response | undefined> {
  if (request) {
    const exact = await cache.match(request);
    if (exact) return exact;
  }
  for (const path of shellCandidates) {
    const response = await cache.match(path);
    if (response) return response;
  }
  return undefined;
}

worker.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(applicationFiles))
      .then(() => worker.skipWaiting()),
  );
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('save-slot-') && key !== cacheName)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => worker.clients.claim()),
  );
});

worker.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== worker.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);

      if (applicationFiles.includes(url.pathname)) {
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
      }

      if (request.mode === 'navigate') {
        try {
          const response = await fetch(request);
          if (response.ok && !response.headers.get('cache-control')?.includes('no-store')) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch {
          return (await cachedShell(cache, request)) ?? Response.error();
        }
      }

      try {
        const response = await fetch(request);
        if (
          response.ok &&
          applicationFiles.includes(url.pathname) &&
          !response.headers.get('cache-control')?.includes('no-store')
        ) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
