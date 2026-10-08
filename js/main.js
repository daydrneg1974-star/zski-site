/* ZSKI — поведение сайта. Без зависимостей. */
(function () {
  const D = window.ZSKI;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";

  /* ---------- Подстановка контактов ---------- */
  $$("[data-phone]").forEach((el) => { el.textContent = D.phone; if (el.tagName === "A") el.href = D.phoneHref; });
  $$("[data-email]").forEach((el) => { el.textContent = D.email; if (el.tagName === "A") el.href = "mailto:" + D.email; });
  $$("[data-address]").forEach((el) => { el.textContent = D.address[el.dataset.address || "short"]; });
  $$("[data-season]").forEach((el) => { el.textContent = D.season; });
  $$("[data-rating]").forEach((el) => { el.textContent = D.rating.value; });
  $$("[data-rating-count]").forEach((el) => { el.textContent = new Intl.NumberFormat("ru-RU").format(D.rating.count); });
  $$("[data-href=yandex]").forEach((a) => (a.href = D.address.yandexMaps));
  $$("[data-href=gis2]").forEach((a) => (a.href = D.address.gis2));
  $$("[data-messenger]").forEach((a) => {
    const kind = a.dataset.messenger;
    const val = D[kind];
    if (!val) { a.remove(); return; }
    a.href = kind === "whatsapp" ? `https://wa.me/${val}` : `https://t.me/${val}`;
  });

  /* ---------- Меню ---------- */
  const burger = $(".burger"), drawer = $(".drawer");
  if (burger && drawer) {
    burger.addEventListener("click", () => {
      const open = drawer.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
    });
  }
  const here = location.pathname.split("/").pop() || "index.html";
  $$(".menu a, .drawer a").forEach((a) => {
    if ((a.getAttribute("href") || "").split("#")[0] === here) a.setAttribute("aria-current", "page");
  });

  /* ---------- Запасной фон для фото ---------- */
  $$("img[data-fallback]").forEach((img) => {
    const fail = () => { img.classList.add("failed"); (img.closest("[data-ph]") || img.parentElement).classList.add("ph"); };
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener("error", fail);
  });

  /* ---------- График и статус «открыто сейчас» ---------- */
  function mskNow() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 3 * 3600000); // МСК = UTC+3, без перехода на летнее время
  }
  function isOpen() {
    const t = mskNow();
    const dow = (t.getDay() + 6) % 7; // 0 = Пн
    const h = t.getHours() + t.getMinutes() / 60;
    const today = D.hours[dow], prev = D.hours[(dow + 6) % 7];
    if (h >= today.open && h < today.close) return { open: true, until: today.close };
    if (prev.close > 24 && h < prev.close - 24) return { open: true, until: prev.close };
    return { open: false, next: today.open > h ? today.open : D.hours[(dow + 1) % 7].open };
  }
  const hh = (x) => String(x % 24).padStart(2, "0") + ":00";
  $$("[data-hours]").forEach((ul) => {
    const dow = (mskNow().getDay() + 6) % 7;
    ul.innerHTML = D.hours.map((d, i) =>
      `<li class="${i === dow ? "today" : ""}"><span class="d">${d.day}</span><strong>${hh(d.open)} – ${hh(d.close)}</strong></li>`).join("");
  });
  $$("[data-status]").forEach((el) => {
    const s = isOpen();
    el.innerHTML = s.open
      ? `<span class="dot"></span> Открыто · до ${hh(s.until)}`
      : `<span class="dot closed"></span> Сейчас закрыто · откроемся в ${hh(s.next)}`;
  });

  /* ---------- Прайс проката ---------- */
  function renderPriceList(container, group) {
    container.innerHTML = group.items.map((it) => `
      <li class="price-row">
        <div><span class="name">${it.name}${it.popular ? '<span class="pill">хит</span>' : ""}</span>
          ${it.note ? `<span class="note">${it.note}</span>` : ""}</div>
        <div class="price">${fmt(it.price)} <small>/ день</small></div>
      </li>`).join("");
  }
  $$("[data-pricelist]").forEach((ul) => {
    const key = ul.dataset.pricelist;
    if (key === "all") {
      ul.innerHTML = "";
      Object.values(D.rental).forEach((g) => {
        const h = document.createElement("li"); h.innerHTML = `<h3 style="margin:18px 0 6px">${g.title}</h3>`; ul.appendChild(h);
        const sub = document.createElement("ul"); sub.className = "price-list"; renderPriceList(sub, g); ul.appendChild(sub);
      });
    } else renderPriceList(ul, D.rental[key]);
  });
  /* Вкладки */
  $$("[data-tabs]").forEach((box) => {
    const tabs = $$(".tab", box), panels = $$("[data-panel]", box);
    tabs.forEach((t) => t.addEventListener("click", () => {
      tabs.forEach((x) => x.setAttribute("aria-selected", String(x === t)));
      panels.forEach((p) => (p.hidden = p.dataset.panel !== t.dataset.tab));
    }));
  });

  /* ---------- Таблица SKI-сервиса ---------- */
  $$("[data-service]").forEach((box) => {
    box.innerHTML = D.service.map((g) => `
      <div>
        <h3 style="margin-bottom:10px">${g.title}</h3>
        <table class="price-table"><thead><tr><th>Услуга</th><th>Цена, ₽</th></tr></thead>
        <tbody>${g.rows.map((r) => `<tr><td>${r.name}</td><td>${r.price}</td></tr>`).join("")}</tbody></table>
      </div>`).join("");
  });

  /* ---------- Калькулятор ---------- */
  const calc = $("[data-calc]");
  if (calc) {
    const items = Object.values(D.rental).flatMap((g) => g.items);
    const list = $(".calc-items", calc), total = $("[data-total]", calc), lines = $("[data-lines]", calc);
    const range = $("input[type=range]", calc), daysOut = $("[data-days]", calc), book = $("[data-book]", calc);
    const qty = Object.fromEntries(items.map((i) => [i.id, 0]));
    qty["ski-set"] = 1;
    list.innerHTML = items.map((i) => `
      <div class="calc-item" data-id="${i.id}">
        <div><div class="name">${i.name}</div><div class="note muted">${fmt(i.price)} / день</div></div>
        <div class="qty"><button type="button" aria-label="Убрать" data-d="-1">−</button><output>0</output><button type="button" aria-label="Добавить" data-d="1">+</button></div>
      </div>`).join("");
    const plural = (n, a, b, c) => { const m = n % 100, l = n % 10; return n + " " + (m > 10 && m < 20 ? c : l === 1 ? a : l > 1 && l < 5 ? b : c); };
    function update() {
      const days = +range.value;
      daysOut.textContent = plural(days, "день", "дня", "дней");
      let sum = 0; const rows = [];
      items.forEach((i) => {
        const q = qty[i.id];
        $(`[data-id="${i.id}"] output`, calc).textContent = q;
        if (q) { const s = i.price * q * days; sum += s; rows.push(`<li><span>${i.name} × ${q}</span><span>${fmt(s)}</span></li>`); }
      });
      lines.innerHTML = rows.join("") || `<li class="muted">Добавьте инвентарь, чтобы увидеть расчёт</li>`;
      total.textContent = fmt(sum);
      const text = rows.length
        ? `Здравствуйте! Хочу забронировать на ${plural(days, "день", "дня", "дней")}: ` +
          items.filter((i) => qty[i.id]).map((i) => `${i.name} × ${qty[i.id]}`).join(", ") + `. Итого ~${fmt(sum)}.`
        : "Здравствуйте! Хочу забронировать инвентарь.";
      book.href = D.whatsapp ? `https://wa.me/${D.whatsapp}?text=${encodeURIComponent(text)}`
        : `mailto:${D.email}?subject=${encodeURIComponent("Бронирование инвентаря ZSKI")}&body=${encodeURIComponent(text)}`;
    }
    list.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-d]"); if (!b) return;
      const id = b.closest(".calc-item").dataset.id;
      qty[id] = Math.max(0, Math.min(10, qty[id] + +b.dataset.d)); update();
    });
    range.addEventListener("input", update);
    update();
  }

  /* ---------- Видео: ленивая загрузка по клику ---------- */
  $$("[data-video]").forEach((box) => {
    const id = box.dataset.video;
    const thumb = $("img", box);
    if (thumb) thumb.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    $(".play", box).addEventListener("click", () => {
      const f = document.createElement("iframe");
      f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      f.allowFullscreen = true; f.title = box.dataset.title || "Видео";
      box.innerHTML = ""; box.appendChild(f);
    });
  });

  /* ---------- Карта ---------- */
  $$("[data-map]").forEach((m) => {
    const f = document.createElement("iframe");
    f.src = D.address.mapEmbed; f.loading = "lazy"; f.title = "Карта: как добраться до ZSKI";
    f.setAttribute("allowfullscreen", ""); m.appendChild(f);
  });

  /* ---------- Форма: открывает письмо (без бэкенда) ---------- */
  $$("form.cb").forEach((f) => f.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = new FormData(f);
    const body = `Имя: ${d.get("name")}\nТелефон: ${d.get("phone")}\nЧто нужно: ${d.get("need")}\nСообщение: ${d.get("msg") || "-"}`;
    location.href = `mailto:${D.email}?subject=${encodeURIComponent("Заявка с сайта ZSKI")}&body=${encodeURIComponent(body)}`;
  }));

  /* ---------- Год в футере ---------- */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
