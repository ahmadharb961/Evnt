// EVNT service worker. Makes the app installable and shows a friendly page when offline.
// It never caches pages, prices, availability or checkout: those always come live from the server.
const CACHE = "evnt-shell-v1";
const OFFLINE = "/offline.html";
const SHELL = [OFFLINE, "/brand/icon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Only page navigations get the offline fallback; everything else goes straight to the network.
  if (req.mode !== "navigate") return;
  e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
});
