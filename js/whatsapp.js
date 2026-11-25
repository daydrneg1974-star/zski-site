/* Прямой выбор приложения или WhatsApp Web, без автоматических редиректов. */
(function () {
  if (!window.HTMLDialogElement || !HTMLDialogElement.prototype.showModal) return;
  const links = document.querySelectorAll('[data-messenger="whatsapp"]');
  if (!links.length) return;
  const dialog = document.createElement("dialog");
  dialog.className = "whatsapp-dialog";
  dialog.setAttribute("aria-labelledby", "wa-title");
  dialog.setAttribute("aria-describedby", "wa-recipient");
  dialog.innerHTML = '<button class="wa-close" type="button" aria-label="Закрыть WhatsApp" autofocus>✕</button>' +
    '<h2 id="wa-title">Написать в WhatsApp</h2><p id="wa-recipient">Прокат ZSKI · <strong data-wa-number></strong></p>' +
    '<div class="wa-actions"><a class="btn btn-primary" data-wa-app>Открыть приложение</a>' +
    '<a class="btn btn-ghost" data-wa-web>Открыть WhatsApp Web</a></div>' +
    '<p class="wa-help">Если приложение не установлено, выберите WhatsApp Web и войдите в свой аккаунт.</p>' +
    '<div data-wa-message-box hidden><label for="wa-message">Ваше сообщение</label><textarea id="wa-message" readonly></textarea>' +
    '<button class="btn btn-ghost btn-sm" type="button" data-wa-copy-message>Скопировать сообщение</button></div>' +
    '<label for="wa-number">Номер проката</label><div class="wa-copy-row"><input id="wa-number" readonly inputmode="tel">' +
    '<button class="btn btn-ghost btn-sm" type="button" data-wa-copy-number>Скопировать номер</button></div>' +
    '<p class="wa-status" role="status" aria-live="polite"></p>' +
    '<p class="wa-help">Не удаётся подключиться к WhatsApp? <a data-wa-phone>Позвоните в прокат</a> или <a href="mailto:z_ski@mail.ru">напишите на z_ski@mail.ru</a>.</p>';
  document.body.appendChild(dialog);
  const number = dialog.querySelector("#wa-number"), message = dialog.querySelector("#wa-message");
  const status = dialog.querySelector(".wa-status");
  let opener = null, overflow = "";
  links.forEach((link) => {
    link.setAttribute("aria-haspopup", "dialog");
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const source = new URL(link.href);
      const phone = source.hostname === "wa.me" ? source.pathname.replace(/\//g, "") : source.searchParams.get("phone");
      if (!/^[1-9][0-9]{6,14}$/.test(phone || "")) return;
      const params = new URLSearchParams({ phone });
      const text = source.searchParams.get("text") || "";
      if (text) params.set("text", text);
      dialog.querySelector("[data-wa-app]").href = "whatsapp://send?" + params;
      dialog.querySelector("[data-wa-web]").href = "https://web.whatsapp.com/send?" + params;
      dialog.querySelector("[data-wa-phone]").href = "tel:+" + phone;
      number.value = "+" + phone;
      dialog.querySelector("[data-wa-number]").textContent = phone.length === 11 && phone[0] === "7"
        ? phone.replace(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/, "+7 ($1) $2-$3-$4") : number.value;
      message.value = text;
      dialog.querySelector("[data-wa-message-box]").hidden = !text;
      status.textContent = "";
      opener = link;
      overflow = document.documentElement.style.overflow;
      dialog.showModal();
      event.preventDefault();
      document.documentElement.style.overflow = "hidden";
      dialog.querySelector(".wa-close").focus({ preventScroll: true });
    });
  });
  dialog.querySelector(".wa-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => {
    document.documentElement.style.overflow = overflow;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialog.querySelectorAll("a[href], button, input, textarea"))
      .filter((element) => !element.closest("[hidden]"));
    const current = controls.indexOf(document.activeElement);
    event.preventDefault();
    controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
  });
  async function copy(field, label) {
    field.focus();
    field.select();
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = label + " скопирован.";
    } catch {
      status.textContent = "Выделенный текст можно скопировать вручную.";
    }
  }
  dialog.querySelector("[data-wa-copy-number]").addEventListener("click", () => copy(number, "Номер"));
  dialog.querySelector("[data-wa-copy-message]").addEventListener("click", () => copy(message, "Текст"));
})();
