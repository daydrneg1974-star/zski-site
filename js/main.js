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
  $$("[data-href=route]").forEach((a) => (a.href = D.address.yandexRoute));
  $$("[data-hint]").forEach((el) => (el.textContent = D.address.hint));
  $$("[data-price-season]").forEach((el) => (el.textContent = D.priceSeason));
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
        <table class="price-table service"><thead><tr><th>Услуга</th><th>Лыжи</th><th>Сноуборд</th></tr></thead>
        <tbody>${g.rows.map((r) => `<tr><td>${r.name}</td><td>${r.ski}</td><td>${r.sb}</td></tr>`).join("")}</tbody></table>
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
    m.innerHTML = `<a class="map-ph" href="${D.address.yandexMaps}" target="_blank" rel="noopener"><strong>ZSKI · ${D.address.short}</strong><span>Открыть карту в Яндекс Картах →</span></a>`;
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


  /* ---------- Шапка при скролле + параллакс hero ---------- */
  const top = $(".topbar"), heroImg = $(".hero-media img");
  const onScroll = () => {
    const y = window.scrollY;
    if (top) top.classList.toggle("scrolled", y > 40);
    if (heroImg && y < 1200 && !matchMedia("(prefers-reduced-motion: reduce)").matches) heroImg.style.translate = `0 ${y * 0.18}px`;
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- Появление при скролле ---------- */
  const targets = $$(".section .card, .price-row, .album figure, .gallery figure, .resort, .steps li, details, .section h2, .section .lead, .cta-band, .about .photo, .stat, .hours li, .contact-list li, .video, .map, .banner, .notice, .calc-item, .calc-summary, [data-service] > div");
  targets.forEach((el) => {
    el.classList.add("reveal");
    const sib = Array.from(el.parentElement.children).filter((c) => c.classList.contains("reveal"));
    el.style.setProperty("--d", `${Math.min(sib.indexOf(el), 8) * 70}ms`);
  });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    targets.forEach((el) => io.observe(el));
  } else targets.forEach((el) => el.classList.add("in"));
  setTimeout(() => targets.forEach((el) => el.classList.add("in")), 3500); // страховка: всё видно даже без скролла

  /* ---------- Счётчики ---------- */
  $$("[data-count]").forEach((el) => {
    const end = +el.dataset.count, suffix = el.dataset.suffix || "", dur = 1400;
    const run = () => { const t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / dur); const v = Math.round(end * (1 - Math.pow(1 - k, 3))); el.textContent = new Intl.NumberFormat("ru-RU").format(v) + suffix; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
    if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { run(); io.disconnect(); } }); io.observe(el); } else run();
  });

  /* ---------- Снег в первом экране (лёгкий) ---------- */
  const snow = $(".hero .snow");
  if (snow && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const ctx = snow.getContext("2d"); let W, H, flakes = [];
    const size = () => { W = snow.width = snow.offsetWidth; H = snow.height = snow.offsetHeight; flakes = Array.from({ length: Math.round(W / 22) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2.2, s: 0.25 + Math.random() * 0.7, o: 0.25 + Math.random() * 0.5, w: Math.random() * 6.28 })); };
    size(); addEventListener("resize", size);
    let paused = false; document.addEventListener("visibilitychange", () => (paused = document.hidden));
    (function draw() { if (!paused) { ctx.clearRect(0, 0, W, H); flakes.forEach((f) => { f.y += f.s; f.w += 0.01; f.x += Math.sin(f.w) * 0.3; if (f.y > H) { f.y = -4; f.x = Math.random() * W; } ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${f.o})`; ctx.fill(); }); } requestAnimationFrame(draw); })();
  }

  /* ---------- Лайтбокс для фото ---------- */
  const figs = $$(".album figure, .gallery figure");
  if (figs.length) {
    const lb = document.createElement("div"); lb.className = "lightbox"; lb.hidden = true;
    lb.innerHTML = `<button class="close" aria-label="Закрыть">✕</button><button class="prev" aria-label="Предыдущее">‹</button><img alt=""><button class="next" aria-label="Следующее">›</button><div class="cap"></div>`;
    document.body.appendChild(lb);
    const img = $("img", lb), cap = $(".cap", lb); let i = 0;
    const show = (n) => { i = (n + figs.length) % figs.length; const f = $("img", figs[i]); img.src = f.src; img.alt = f.alt; cap.textContent = f.alt; lb.hidden = false; document.body.style.overflow = "hidden"; };
    const hide = () => { lb.hidden = true; document.body.style.overflow = ""; };
    figs.forEach((f, n) => { f.setAttribute("tabindex", "0"); f.setAttribute("role", "button"); f.addEventListener("click", () => show(n)); f.addEventListener("keydown", (e) => { if (e.key === "Enter") show(n); }); });
    $(".close", lb).addEventListener("click", hide); $(".prev", lb).addEventListener("click", () => show(i - 1)); $(".next", lb).addEventListener("click", () => show(i + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) hide(); });
    document.addEventListener("keydown", (e) => { if (lb.hidden) return; if (e.key === "Escape") hide(); if (e.key === "ArrowLeft") show(i - 1); if (e.key === "ArrowRight") show(i + 1); });
  }

  /* ---------- Год в футере ---------- */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
