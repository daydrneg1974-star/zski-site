/* ZSKI — сервис-воркер: статика из кэша (мгновенные повторные переходы), HTML — сначала сеть. */
const VERSION = "zski-v3";
const STATIC = /\.(css|js|woff2|webp|jpg|png|svg|mp4|webm)$/;
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (STATIC.test(url.pathname) && !/\/video\//.test(url.pathname)) {
    e.respondWith(caches.open(VERSION).then(async (c) => { const hit = await c.match(req); if (hit) return hit; const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }));
  } else if (req.headers.get("accept")?.includes("text/html")) {
    e.respondWith(fetch(req).then((res) => { caches.open(VERSION).then((c) => c.put(req, res.clone())); return res; }).catch(() => caches.match(req)));
  }
});
