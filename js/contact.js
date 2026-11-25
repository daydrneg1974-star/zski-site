/* Повторы используют тот же идентификатор. Поля уходят только в обработчик этого сайта. */
(function () {
  document.querySelectorAll("form.cb").forEach((form) => {
    const button = form.querySelector('button[type="submit"]');
    const status = form.querySelector("[data-form-status]");
    const request = form.elements.namedItem("request_id");
    let busy = false;
    const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, "0")).join("");
    request.value = newId();
    const announce = (message) => { status.textContent = message; };
    function clearErrors() {
      form.querySelectorAll("[aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
      form.querySelectorAll("[data-field-error]").forEach((error) => { error.textContent = ""; });
    }
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      if (!navigator.onLine) {
        announce("Нет соединения. Данные остались в форме. Отправьте их после восстановления сети.");
        return;
      }
      busy = true;
      button.disabled = true;
      clearErrors();
      announce("Отправляем сообщение…");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const response = await fetch(form.action, {
          method: "POST", body: new URLSearchParams(new FormData(form)),
          headers: { Accept: "application/json" }, cache: "no-store",
          credentials: "same-origin", signal: controller.signal
        });
        const type = response.headers.get("content-type") || "";
        if (!type.includes("application/json")) throw new Error("unavailable");
        const result = await response.json();
        if (!response.ok || result.status !== 200) {
          announce(result.message || "Отправка не подтверждена. Позвоните в прокат.");
          const invalid = [];
          Object.entries(result.errors || {}).forEach(([key, message]) => {
            const field = form.elements.namedItem(key);
            const error = form.querySelector('[data-field-error="' + CSS.escape(key) + '"]');
            if (field instanceof HTMLElement && error) {
              field.setAttribute("aria-invalid", "true");
              error.textContent = message;
              invalid.push(field);
            }
          });
          invalid[0]?.focus();
          if (result.reference) announce(status.textContent + " Номер обращения " + result.reference + ".");
          return;
        }
        form.reset();
        request.value = newId();
        announce(result.message + (result.reference ? " Номер обращения " + result.reference + "." : ""));
      } catch (error) {
        announce(error.message === "unavailable"
          ? "Отправка через форму недоступна в этой версии сайта. Данные сохранены. Позвоните или напишите на почту."
          : "Результат отправки не подтверждён. Данные сохранены. Можно повторить запрос с тем же номером или позвонить в прокат.");
      } finally {
        clearTimeout(timer);
        busy = false;
        button.disabled = false;
      }
    });
  });
})();
