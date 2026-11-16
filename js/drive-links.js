/* Открываем мобильные приложения, сохраняя обычные ссылки для компьютеров. */
(function () {
  const { userAgent, platform, maxTouchPoints } = navigator;
  const android = /Android/i.test(userAgent);
  const ios = /iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (!android && !ios) return;

  let cancelFallback = () => {};
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.composedPath().find((node) => node instanceof HTMLAnchorElement && node.dataset.routeApp);
    if (!link) return;

    event.preventDefault();
    cancelFallback();
    const app = link.dataset.routeApp;
    const fallback = link.href;

    if (android && /Chrome\//.test(userAgent)) {
      const [scheme, route] = app.split("://");
      const intent = `intent://${route}#Intent;scheme=${scheme};package=${link.dataset.routePackage};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
      location.assign(intent);
      return;
    }

    // На iOS и в других браузерах возвращаемся к обычной ссылке, если вкладка осталась открыта.
    const launch = new AbortController();
    const timer = setTimeout(() => {
      cancelFallback();
      if (!document.hidden) location.assign(fallback);
    }, 1800);
    cancelFallback = () => {
      clearTimeout(timer);
      launch.abort();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelFallback();
    }, { signal: launch.signal });
    window.addEventListener("pagehide", cancelFallback, { once: true, signal: launch.signal });
    location.assign(app);
  }, true);
})();
