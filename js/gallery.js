/* Нативный диалог обеспечивает модальность, Tab и Escape. */
(function () {
  if (!window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal) return;
  const figures = Array.from(document.querySelectorAll(".album figure, .gallery figure"))
    .filter((figure) => figure.querySelector("img") && !figure.querySelector("a, button, input"));
  if (!figures.length) return;
  const dialog = document.createElement("dialog");
  dialog.className = "lightbox";
  dialog.setAttribute("aria-label", "Просмотр фотографий ZSKI");
  dialog.innerHTML = '<button class="close" type="button" aria-label="Закрыть фотографии" autofocus>✕</button>' +
    '<button class="prev" type="button" aria-label="Предыдущее фото">‹</button><img alt="">' +
    '<button class="next" type="button" aria-label="Следующее фото">›</button><p class="cap" aria-live="polite"></p>';
  document.body.appendChild(dialog);
  const image = dialog.querySelector("img"), caption = dialog.querySelector(".cap");
  let index = 0, opener = null, overflow = "";
  function show(next) {
    index = (next + figures.length) % figures.length;
    const figure = figures[index], source = figure.querySelector("img");
    image.src = source.currentSrc || source.src;
    image.alt = source.alt;
    caption.textContent = (figure.querySelector("figcaption")?.textContent || source.alt) +
      " · " + (index + 1) + " из " + figures.length;
  }
  figures.forEach((figure, n) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-open";
    button.setAttribute("aria-label", "Открыть фото: " + figure.querySelector("img").alt);
    button.appendChild(figure.querySelector("picture") || figure.querySelector("img"));
    figure.prepend(button);
    button.addEventListener("click", () => {
      opener = button;
      overflow = document.documentElement.style.overflow;
      show(n);
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
      dialog.querySelector(".close").focus({ preventScroll: true });
    });
  });
  dialog.querySelector(".close").addEventListener("click", () => dialog.close());
  dialog.querySelector(".prev").addEventListener("click", () => show(index - 1));
  dialog.querySelector(".next").addEventListener("click", () => show(index + 1));
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      const buttons = Array.from(dialog.querySelectorAll("button"));
      const current = buttons.indexOf(document.activeElement);
      event.preventDefault();
      buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      return;
    }
    if (event.target.matches("input, textarea, select, [contenteditable]")) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      show(index + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
  let backdropDown = false;
  const outside = (event) => {
    const box = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom);
  };
  dialog.addEventListener("pointerdown", (event) => { backdropDown = outside(event); });
  dialog.addEventListener("click", (event) => { if (backdropDown && outside(event)) dialog.close(); });
  dialog.addEventListener("close", () => {
    document.documentElement.style.overflow = overflow;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
})();
