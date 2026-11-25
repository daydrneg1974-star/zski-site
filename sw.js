/* Версии меняются сборкой. Новый воркер ждёт закрытия старых вкладок.
   HTML и файлы без версии — сначала сеть. Видео, API и POST идут мимо кеша. */
const VERSION = "zski-202611251218";
const OWN_CACHE = /^zski-\d{12}$/;

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((names) => {
    const previous = names.filter((name) => OWN_CACHE.test(name) && name !== VERSION).sort().pop();
    return Promise.all(names.filter((name) => OWN_CACHE.test(name) && name !== VERSION && name !== previous)
      .map((name) => caches.delete(name)));
  }));
});

self.addEventListener("fetch", (event) => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin ||
      /\/(video|api)\//.test(url.pathname) || request.headers.has("range")) return;
  let fresh = false;
  const network = async () => {
    const response = await fetch(request);
    if (response.ok) fresh = response.clone();
    return response;
  };
  const response = (async () => {
    if (request.mode === "navigate") {
      try { return await network(); } catch {
        const saved = await caches.match(request, { ignoreSearch: true });
        if (!saved) return Response.error();
        const text = await saved.text();
        const note = '<p class="offline-note" id="offline-notice" role="status">Сохранённая версия. Цены и условия могли измениться. Уточните наличие по телефону. Форма отправляется только при подключении к сети.</p>';
        return new Response(text.replace(/<body([^>]*)>/i, "<body$1>" + note), {
          status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
        });
      }
    }
    if (url.searchParams.has("v")) {
      const cached = await caches.match(request);
      return cached || network();
    }
    try { return await network(); } catch {
      return (await caches.match(request)) || Response.error();
    }
  })();
  event.respondWith(response);
  event.waitUntil(response.then(async (res) => {
    if (fresh && fresh.status === 200 && fresh.type === "basic" && !/no-store|private/.test(fresh.headers.get("cache-control") || "")) {
      const cache = await caches.open(VERSION);
      await cache.put(request, fresh);
    }
  }).catch(() => {}));
});
