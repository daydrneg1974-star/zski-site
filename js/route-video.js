/* Один плеер видеомаршрута для главной, контактов и обоих вариантов интро. */
(function () {
  let activeDialog = null;
  const close = () => { if (activeDialog?.open) activeDialog.close(); };

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const card = event.composedPath().find((node) => node instanceof HTMLAnchorElement && node.hasAttribute("data-route-video"));
    if (!card || typeof HTMLDialogElement === "undefined" || !HTMLDialogElement.prototype.showModal) return;
    event.preventDefault();
    event.stopPropagation(); // Ссылка внутри интро открывает плеер, не запускает переход между экранами.
    close();

    const root = card.getRootNode();
    const dialog = document.createElement("dialog");
    dialog.className = "route-dialog";
    dialog.setAttribute("aria-labelledby", "route-dialog-title");
    dialog.innerHTML = `
      <div class="route-dialog-head">
        <h2 class="route-dialog-title" id="route-dialog-title">Как доехать из Яхромы</h2>
        <button class="route-dialog-close" type="button" aria-label="Закрыть видео" autofocus><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
      </div>
      <video class="route-dialog-video" controls playsinline preload="none" width="720" height="1280" poster="img/photos/route-yakhroma.jpg" aria-label="Видеомаршрут до проката ZSKI из Яхромы"></video>
      <p class="route-dialog-error" role="status" hidden>Не удалось загрузить видео. Попробуй открыть или скачать ролик по кнопке ниже.</p>
      <div class="route-save">
        <a class="route-download" download="ZSKI-kak-doehat-iz-Yahromy.mp4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>Скачать ролик · 8,3 МБ</a>
        <p class="route-save-note">Сохрани заранее и смотри без интернета.<br>MP4 · 1:38</p>
      </div>`;
    const video = dialog.querySelector("video");
    const connection = navigator.connection;
    const lite = connection?.saveData || matchMedia("(max-width: 767px)").matches ||
      /(^|-)(2g|3g)$/.test(connection?.effectiveType || "") ||
      (connection?.downlink > 0 && connection.downlink < 2.5);
    video.src = lite ? card.dataset.routeLite : card.dataset.routeSrc;
    dialog.querySelector(".route-download").href = card.dataset.routeLite;
    video.addEventListener("error", () => { dialog.querySelector(".route-dialog-error").hidden = false; });
    video.addEventListener("play", () => {
      new Set([...document.querySelectorAll("video"), ...root.querySelectorAll("video")]).forEach((other) => {
        if (other !== video) other.pause();
      });
    });
    dialog.querySelector("button").addEventListener("click", () => dialog.close());
    // Закрыть по нажатию вне панели; перетаскивание из плеера за край не закрывает её.
    let backdropDown = false;
    const outside = (e) => {
      const bounds = dialog.getBoundingClientRect();
      return e.target === dialog && (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom);
    };
    dialog.addEventListener("pointerdown", (e) => { backdropDown = outside(e); });
    dialog.addEventListener("click", (e) => { if (backdropDown && outside(e)) dialog.close(); });
    const previousOverflow = document.documentElement.style.overflow;
    dialog.addEventListener("close", () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      dialog.remove();
      if (activeDialog === dialog) {
        activeDialog = null;
        document.documentElement.style.overflow = previousOverflow;
        if (card.isConnected) card.focus({ preventScroll: true });
      }
    }, { once: true });
    (root instanceof ShadowRoot ? root : document.body).appendChild(dialog);
    activeDialog = dialog;
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    video.play().catch(() => {}); // При запрете воспроизведения остаётся обычная кнопка Play.
  }, true);

  addEventListener("pagehide", close);
  addEventListener("popstate", close);
})();
