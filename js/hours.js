/* Московское время, график проката и ночные смены. */
(function () {
  const { hours, seasonStart, seasonEnd } = window.ZSKI || {};
  if (!Array.isArray(hours) || hours.length !== 7 || hours.some((day) => !Number.isFinite(day.open) || !Number.isFinite(day.close))) return;
  const minute = 60_000;
  const hour = 60 * minute;
  const start = seasonStart ? Date.parse(`${seasonStart}T00:00:00+03:00`) : -Infinity;
  const end = seasonStart && seasonEnd ? Date.parse(`${seasonEnd}T00:00:00+03:00`) + 24 * hour : Infinity;
  const clock = (value) => new Date(value * hour).toISOString().slice(11, 16);
  const schedules = Array.from(document.querySelectorAll("[data-hours]"));
  schedules.forEach((list) => {
    list.innerHTML = hours.map(({ day, open, close }) =>
      `<li><span class="d">${day}</span><strong>${clock(open)} – ${clock(close)}</strong></li>`).join("");
  });

  function refresh() {
    const now = Date.now();
    const moscow = new Date(now + 3 * hour);
    const weekday = (moscow.getUTCDay() + 6) % 7; // Понедельник — первый день в графике.
    const time = moscow.getUTCHours() + moscow.getUTCMinutes() / 60;
    const today = hours[weekday];
    const yesterday = hours[(weekday + 6) % 7];
    const tomorrow = hours[(weekday + 1) % 7];
    const offSeason = now < start || now >= end;
    const todayOpen = time >= today.open && time < today.close;
    const open = !offSeason && (todayOpen || time < yesterday.close - 24);

    let message = "Межсезонье";
    if (open) {
      message = todayOpen
        ? `Сейчас открыто · сегодня работаем до ${clock(today.close)}`
        : `Сейчас открыто · до ${clock(yesterday.close)}`;
    } else if (!offSeason) {
      message = time < today.open
        ? `Сейчас закрыто · откроемся сегодня в ${clock(today.open)}`
        : `Сейчас закрыто · откроемся завтра в ${clock(tomorrow.open)}`;
    }

    const intro = document.querySelector(".intro-host")?.shadowRoot;
    const badges = [...document.querySelectorAll("[data-status]"), ...(intro?.querySelectorAll("[data-status]") ?? [])];
    badges.forEach((badge) => {
      const label = offSeason && badge.dataset.status !== "compact" ? `${message} · инвентарь принимаем на хранение` : message;
      if (badge.textContent !== label) {
        const dot = document.createElement("span");
        dot.className = open ? "dot" : "dot closed";
        dot.setAttribute("aria-hidden", "true");
        const text = document.createElement("span");
        text.textContent = label;
        badge.replaceChildren(dot, text);
      }
      badge.hidden = false;
    });
    schedules.forEach((list) => {
      Array.from(list.children).forEach((row, index) => row.classList.toggle("today", index === weekday));
    });
  }

  function tick() {
    refresh();
    setTimeout(tick, minute - Date.now() % minute);
  }

  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  addEventListener("pageshow", refresh);
  addEventListener("zski:intro-opened", refresh);
  tick();
})();
