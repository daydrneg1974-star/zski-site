/* ZSKI — сервис-воркер. HTML, CSS и JS — всегда из сети (кэш только как запасной вариант офлайн);
   шрифты, фото и видео — из кэша. VERSION подставляется при сборке, старые кэши удаляются. */
const VERSION = "zski-202610100556";
const IMMUTABLE = /\.(woff2|webp|jpg|png|svg|mp4|webm)$/;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (IMMUTABLE.test(url.pathname) && !/\/video\//.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async (c) => { const hit = await c.match(req); if (hit) return hit; const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }));
  } else {
    e.respondWith(fetch(req).then((res) => { if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone())); return res; }).catch(() => caches.match(req, { ignoreSearch: true })));
  }
});
