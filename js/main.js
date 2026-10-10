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
    const fail = () => { img.classList.add("failed"); (img.closest("[data-ph]") || img.closest("figure") || img.parentElement).classList.add("ph"); };
    const ok = () => img.classList.add("ok");
    if (img.complete) { if (img.naturalWidth === 0) fail(); else ok(); }
    img.addEventListener("error", fail); img.addEventListener("load", ok);
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
    m.innerHTML = `
      <div class="map-card">
        <svg viewBox="0 0 640 480" aria-hidden="true">
          <defs><linearGradient id="road" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a6fc4"/><stop offset="1" stop-color="#7cc8ff"/></linearGradient></defs>
          <rect width="640" height="480" fill="none"/>
          <path d="M60 440 C 180 380, 230 300, 330 240 S 520 120, 600 50" fill="none" stroke="url(#road)" stroke-width="12" stroke-linecap="round" opacity=".85"/>
          <path d="M60 440 C 180 380, 230 300, 330 240 S 520 120, 600 50" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 12" opacity=".7"/>
          <g font-family="Manrope, sans-serif" font-weight="700" font-size="16" fill="currentColor">
            <circle cx="60" cy="440" r="9" fill="#0f1b2d" stroke="#fff" stroke-width="3"/><text x="80" y="446">МКАД · Дмитровское шоссе</text>
            <circle cx="260" cy="302" r="7" fill="#0f1b2d" stroke="#fff" stroke-width="3"/><text x="278" y="296">Икша · 30 км</text>
            <circle cx="600" cy="50" r="7" fill="#0f1b2d" stroke="#fff" stroke-width="3"/><text x="470" y="34">Сорочаны · Волен</text>
          </g>
          <g transform="translate(400 190)">
            <circle r="34" fill="#e3241b" opacity=".18"><animate attributeName="r" values="26;40;26" dur="2.4s" repeatCount="indefinite"/></circle>
            <path d="M0 -26 C -14 -26 -22 -16 -22 -6 C -22 10 0 28 0 28 C 0 28 22 10 22 -6 C 22 -16 14 -26 0 -26 Z" fill="#e3241b" stroke="#fff" stroke-width="3"/><circle cy="-6" r="7" fill="#fff"/>
            <text x="34" y="-2" font-family="Unbounded, Manrope, sans-serif" font-weight="800" font-size="18" fill="currentColor">ZSKI · 61-й км</text>
            <text x="34" y="20" font-family="Manrope, sans-serif" font-weight="700" font-size="14" fill="currentColor" opacity=".75">Яхрома, Левобережье</text>
          </g>
        </svg>
        <button type="button" class="btn btn-ghost btn-sm map-load">Открыть карту</button>
      </div>`;
    $(".map-load", m).addEventListener("click", () => {
      const f = document.createElement("iframe"); f.src = D.address.mapEmbed; f.title = "Карта: как добраться до ZSKI"; f.setAttribute("allowfullscreen", ""); m.appendChild(f); $(".map-card", m).remove();
    });
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
  const countUp = (el) => {
    const end = +el.dataset.count, suffix = el.dataset.suffix || "", dur = 1400;
    const run = () => { const t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / dur); const v = Math.round(end * (1 - Math.pow(1 - k, 3))); el.textContent = new Intl.NumberFormat("ru-RU").format(v) + suffix; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
    if ("IntersectionObserver" in window) { const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { run(); io.disconnect(); } }); io.observe(el); } else run();
  };
  setTimeout(() => $$("[data-count]").forEach(countUp), 0);

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


  /* ---------- Погода и снег на склоне (Open-Meteo, без ключа; кэш 1 час) ---------- */
  (async () => {
    const el = $("[data-weather]"); if (!el || !D.address.lat) return;
    try {
      const key = "zski-weather", cached = JSON.parse(localStorage.getItem(key) || "null");
      let w = cached && Date.now() - cached.t < 3600e3 ? cached.v : null;
      if (!w) {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${D.address.lat}&longitude=${D.address.lng}&current=temperature_2m,snowfall,weather_code&daily=snowfall_sum&timezone=Europe%2FMoscow&forecast_days=1`, { signal: AbortSignal.timeout(4000) });
        if (!r.ok) return; const j = await r.json();
        w = { t: Math.round(j.current.temperature_2m), code: j.current.weather_code, snow: j.daily && j.daily.snowfall_sum ? j.daily.snowfall_sum[0] : 0 };
        localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: w }));
      }
      const icon = w.code >= 71 && w.code <= 77 ? "🌨" : w.code >= 61 ? "🌧" : w.code >= 45 ? "🌫" : w.code >= 2 ? "⛅" : "☀";
      el.innerHTML = `${icon} Яхрома сейчас: ${w.t > 0 ? "+" : ""}${w.t}°${w.snow > 0 ? ` · снег ${w.snow} см за день` : ""}`;
      el.hidden = false;
    } catch {}
  })();

  /* ---------- Обратный отсчёт до сезона ---------- */
  (() => {
    const box = $("[data-season-stat]"); if (!box || !D.seasonStart) return;
    const now = mskNow(), start = new Date(D.seasonStart + "T00:00:00+03:00"), end = D.seasonEnd ? new Date(D.seasonEnd + "T23:59:59+03:00") : null;
    if (now < start) { const days = Math.ceil((start - now) / 864e5), m = days % 100, l = days % 10, w = m > 10 && m < 20 ? "дней" : l === 1 ? "день" : l > 1 && l < 5 ? "дня" : "дней"; box.innerHTML = `<b><span data-count="${days}">0</span></b><span>${w} до открытия сезона · ориентировочно</span>`; }
    else if (!end || now <= end) box.innerHTML = `<b>Сезон открыт</b><span>катаемся — приезжайте за инвентарём</span>`;
  })();

  /* ---------- Квиз «Какой комплект вам нужен» ---------- */
  $$("[data-quiz]").forEach((q) => {
    const ans = {}, steps = $$(".quiz-step", q), res = $(".quiz-result", q), bar = $(".quiz-progress i", q);
    const show = (n) => { steps.forEach((s) => (s.hidden = +s.dataset.step !== n)); res.hidden = n !== 4; bar.style.width = `${Math.min(100, (n - 1) / 3 * 100)}%`; };
    const build = () => {
      const g = ans.type === "snowboard" ? D.rental.snowboard : D.rental.ski;
      const set = g.items.find((i) => i.popular) || g.items[0];
      const items = [set, D.rental.extras.items[0]]; if (ans.level === "new") items.push(D.rental.extras.items[1]); if (ans.level !== "pro") items.push(D.rental.extras.items[2]);
      const days = +ans.days, perDay = items.reduce((a, i) => a + i.price, 0);
      const tips = { new: "Для первого раза берите шлем и маску: падать будет мягче, а солнце не помешает. Попросите мастера выставить мягкие настройки креплений.", mid: "Подберём ростовку под уверенное катание и настроим крепления под ваш вес.", pro: "Есть модели для жёстких трасс и свежего снега — скажите, где катаетесь, подберём под склон." };
      $(".res-title", q).textContent = `${set.name} + защита · ${ans.level === "new" ? "новичок" : ans.level === "mid" ? "уверенный" : "опытный"}`;
      $(".res-list", q).innerHTML = items.map((i) => `<li><span>${i.name}</span><b>${new Intl.NumberFormat("ru-RU").format(i.price)} ₽</b></li>`).join("") + `<li class="tip">${tips[ans.level]}</li>`;
      $(".res-total", q).innerHTML = `<small>${plural(days, "день", "дня", "дней")}${days >= 3 ? " и больше" : ""}</small> ${new Intl.NumberFormat("ru-RU").format(perDay * days)} ₽${days >= 3 ? " <small>от</small>" : ""}`;
    };
    const plural = (n, a, b, c) => { const m = n % 100, l = n % 10; return n + " " + (m > 10 && m < 20 ? c : l === 1 ? a : l > 1 && l < 5 ? b : c); };
    q.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]"); if (b) { ans[b.dataset.k] = b.dataset.v; const n = +b.closest(".quiz-step").dataset.step + 1; if (n === 4) build(); show(n); return; }
      if (e.target.closest(".quiz-again")) { Object.keys(ans).forEach((k) => delete ans[k]); show(1); }
    });
    show(1);
  });

  /* ---------- Магнитные кнопки и блик (только с мышью) ---------- */
  if (matchMedia("(hover:hover) and (pointer:fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    $$(".btn-primary").forEach((b) => {
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; b.style.transform = `translate(${x * 6}px, ${y * 6}px)`; b.style.setProperty("--mx", `${(x + 0.5) * 100}%`); });
      b.addEventListener("pointerleave", () => (b.style.transform = ""));
    });
  }

  /* ---------- Год в футере ---------- */
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
