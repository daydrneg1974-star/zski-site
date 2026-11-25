(function () {
  let notice = document.getElementById("offline-notice");
  function refresh() {
    if (!navigator.onLine && !notice) {
      notice = document.createElement("p");
      notice.id = "offline-notice";
      notice.className = "offline-note";
      notice.setAttribute("role", "status");
      document.body.prepend(notice);
    }
    if (notice) notice.textContent = navigator.onLine
      ? "Соединение восстановлено. Обновите страницу, чтобы проверить актуальные цены и условия."
      : "Нет соединения. Цены и условия в сохранённой версии могли измениться. Уточните наличие по телефону. Форма отправляется только вручную после восстановления сети.";
  }
  addEventListener("online", refresh);
  addEventListener("offline", refresh);
  if (!navigator.onLine || notice) refresh();
})();
