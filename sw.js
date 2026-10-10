/* ZSKI — сервис-воркер.
   HTML — всегда из сети, копия в кэше только на случай офлайна.
   Шрифты, фото и файлы с версией сборки (?v=…: CSS и JS) неизменны — из кэша, повторный заход не ждёт сети.
   Видео воркер не трогает: браузер грузит его частями (ответы 206), их нельзя класть в кэш.
   Новая версия воркера просто начинает отвечать на следующие запросы — страницу не перезагружаем:
   HTML и так приходит из сети, а у CSS/JS в адресе новая версия сборки.
   VERSION подставляется при сборке, старые кэши удаляются. */
const VERSION = "zski-202610101144";
const IMMUTABLE = /\.(woff2|webp|jpg|png|svg)$/;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const store = (req, res) => {
  if (res.status !== 200 || res.type !== "basic") return;   // 206, редиректы и чужие ответы не кэшируем
  const copy = res.clone();                                   // копию — сразу, пока тело ответа не отдано странице
  caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
};
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  if (/\/video\//.test(url.pathname) || req.headers.has("range")) return;
  if (IMMUTABLE.test(url.pathname) || url.searchParams.has("v")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { store(req, res); return res; })));
  } else {
    e.respondWith(fetch(req).then((res) => { store(req, res); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error())));
  }
});
