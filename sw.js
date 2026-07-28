const CACHE_NAME = "save-slot-shell-v16";
const DATA_CACHE_NAME = "save-slot-online-v1";
const APP_SHELL = ["./", "./index.html", "./styles-v3.css", "./styles-v6.css", "./styles-v8.css", "./styles-v10.css", "./app-v3-core.js", "./app-v3-wikidata.js", "./app-v3-steam.js", "./app-v3-results.js", "./app-v3-manager.js", "./app-v3-init.js", "./app-v4.js", "./app-v5.js", "./app-v6.js", "./app-v7.js", "./app-v8.js", "./app-v9.js", "./app-v10.js", "./app-v11.js", "./app-v12.js", "./app-v13.js", "./manifest.webmanifest", "./assets/icon.svg"];

self.addEventListener("install", event => event.waitUntil(
  caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
));

self.addEventListener("activate", event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => ![CACHE_NAME, DATA_CACHE_NAME].includes(key)).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const cacheName = sameOrigin ? CACHE_NAME : DATA_CACHE_NAME;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok || response.type === "opaque") {
          caches.open(cacheName).then(cache => cache.put(request, response.clone())).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (sameOrigin) return caches.match("./index.html");
        throw new Error("Ресурс відсутній у кеші");
      })
  );
});