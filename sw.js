const CACHE_NAME = "save-slot-shell-v5";
const APP_SHELL = ["./", "./index.html", "./styles-v3.css", "./app-v3-core.js", "./app-v3-wikidata.js", "./app-v3-steam.js", "./app-v3-results.js", "./app-v3-manager.js", "./app-v3-init.js", "./app-v4.js", "./manifest.webmanifest", "./assets/icon.svg"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match(request).then(cached => cached || caches.match("./index.html"))));
});
