/* ZSKI — поведение сайта. Без зависимостей. */
(function () {
  const D = window.ZSKI || null;
  function init(name, start) {
    try { start(); } catch { console.error("ZSKI: ошибка блока " + name); }
  }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
  const phone = (D?.phoneHref || "").replace(/\D/g, "");
  const messengerLinks = {
    whatsapp: `https://api.whatsapp.com/send?phone=${String(D?.whatsapp || phone).replace(/\D/g, "")}`,
    telegram: `https://t.me/${D?.telegram || `+${phone}`}`,
    max: "https://max.ru/:share"
  };

  /* ---------- Подстановка контактов ---------- */
  init("Подстановка контактов", () => {
    if (!D) return;
  $$("[data-phone]").forEach((el) => {
    if (el.dataset.phone !== "link") el.textContent = D.phone;
    if (el.tagName === "A") el.href = D.phoneHref;
  });
  $$("[data-email]").forEach((el) => { if (el.dataset.email !== "link") el.textContent = D.email; if (el.tagName === "A") el.href = "mailto:" + D.email; });
  $$("[data-address]").forEach((el) => { el.textContent = D.address[el.dataset.address || "short"]; });
  $$("[data-season]").forEach((el) => { el.textContent = D.season; });
  $$("[data-rating]").forEach((el) => { el.textContent = D.rating.value; });
  $$("[data-rating-count]").forEach((el) => { el.textContent = new Intl.NumberFormat("ru-RU").format(D.rating.count); });
  $$("[data-href=yandex]").forEach((a) => (a.href = D.address.yandexMaps));
  $$("[data-price-season]").forEach((el) => (el.textContent = D.priceSeason));
  $$("[data-messenger]").forEach((a) => {
    const kind = a.dataset.messenger;
    if (messengerLinks[kind]) a.href = messengerLinks[kind];
  });
  });

  /* ---------- Меню ---------- */
  init("Меню", () => {
const burger = $(".burger"), drawer = $(".drawer");
  if (burger && drawer) {
    const setMenu = (open) => {
      drawer.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    };
    burger.addEventListener("click", () => setMenu(!drawer.classList.contains("open")));
    drawer.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("click", (e) => {
      if (!drawer.contains(e.target) && !burger.contains(e.target)) setMenu(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("open")) {
        setMenu(false); burger.focus();
      }
    });
  }
  const actionbar = $(".actionbar");
  if (actionbar && "ResizeObserver" in window) {
    new ResizeObserver(() => document.documentElement.style.setProperty("--actionbar-height", actionbar.getBoundingClientRect().height + "px")).observe(actionbar);
  }
  const here = location.pathname.split("/").pop() || "index.html";
  $$(".menu a, .drawer a").forEach((a) => {
    if ((a.getAttribute("href") || "").split("#")[0] === here) a.setAttribute("aria-current", "page");
  });

  /* Назад — только к предыдущему экрану нашего сайта; прямой вход ведёт на главную. */
  const back = $("[data-back]");
  if (back) back.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const ref = document.referrer ? new URL(document.referrer) : null;
    const pages = ["index.html", "intro.html", "prices.html", "service.html", "slopes.html", "contacts.html", "clients.html"];
    const internal = ref && ref.origin === location.origin &&
      new URL("./", ref).pathname === new URL("./", location.href).pathname &&
      pages.includes(ref.pathname.split("/").pop() || "index.html");
    const fromIntro = history.state && history.state.zskiIntro === "closed";
    if (history.length > 1 && (internal || fromIntro)) {
      e.preventDefault();
      history.back();
    }
  });
  });

  /* ---------- Запасной фон для фото ---------- */
  init("Запасной фон для фото", () => {
  $$("img[data-fallback]").forEach((img) => {
    const fail = () => { img.classList.add("failed"); (img.closest("[data-ph]") || img.closest("figure") || img.parentElement).classList.add("ph"); };
    const ok = () => img.classList.add("ok");
    if (img.complete) { if (img.naturalWidth === 0) fail(); else ok(); }
    img.addEventListener("error", fail); img.addEventListener("load", ok);
  });
  });

  /* ---------- Прайс проката ---------- */
  init("Прайс проката", () => {
    if (!D) return;
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
  });

  init("Вкладки прайса", () => {
/* Вкладки */
  $$("[data-tabs]").forEach((box) => {
    const tabs = $$(".tab", box), panels = $$("[data-panel]", box);
    const select = (t) => {
      tabs.forEach((x) => {
        x.setAttribute("aria-selected", String(x === t));
        x.tabIndex = x === t ? 0 : -1;
      });
      panels.forEach((p) => (p.hidden = p.dataset.panel !== t.dataset.tab));
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t));
      t.addEventListener("keydown", (e) => {
        const n = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
        if (n < 0) return;
        e.preventDefault(); select(tabs[n]); tabs[n].focus();
      });
    });
    if (tabs.length) select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]);
  });
  });

  /* ---------- Таблица SKI-сервиса ---------- */
  init("Таблица SKI-сервиса", () => {
    if (!D) return;
  $$("[data-service]").forEach((box) => {
    box.innerHTML = D.service.map((g) => `
      <div>
        <h3 style="margin-bottom:10px">${g.title}</h3>
        <table class="price-table service"><thead><tr><th>Услуга</th><th>Лыжи</th><th>Сноуборд</th></tr></thead>
        <tbody>${g.rows.map((r) => `<tr><td>${r.name}</td><td>${r.ski}</td><td>${r.sb}</td></tr>`).join("")}</tbody></table>
      </div>`).join("");
  });
  });

  /* ---------- Калькулятор ---------- */
  init("Калькулятор", () => {
    if (!D) return;
  const calc = $("[data-calc]");
  if (calc) {
    const items = Object.values(D.rental).flatMap((g) => g.items);
    const list = $(".calc-items", calc), total = $("[data-total]", calc), lines = $("[data-lines]", calc);
    const range = $("input[type=range]", calc), daysOut = $("[data-days]", calc);
    total.setAttribute("aria-live", "polite");
    total.setAttribute("aria-atomic", "true");
    const qty = Object.fromEntries(items.map((i) => [i.id, 0]));
    qty["ski-set"] = 1;
    list.innerHTML = items.map((i) => `
      <div class="calc-item" data-id="${i.id}">
        <div><div class="name">${i.name}</div><div class="note muted">${fmt(i.price)} / день</div></div>
        <div class="qty"><button type="button" aria-label="Убрать: ${i.name}" data-d="-1">−</button><output>0</output><button type="button" aria-label="Добавить: ${i.name}" data-d="1">+</button></div>
      </div>`).join("");
    const plural = (n, a, b, c) => { const m = n % 100, l = n % 10; return n + " " + (m > 10 && m < 20 ? c : l === 1 ? a : l > 1 && l < 5 ? b : c); };
    function update() {
      const days = Math.min(+range.max, Math.max(+range.min, Math.trunc(+range.value) || 1));
      daysOut.textContent = plural(days, "день", "дня", "дней");
      let sum = 0; const rows = [];
      items.forEach((i) => {
        const q = qty[i.id];
        $(`[data-id="${i.id}"] output`, calc).textContent = q;
        if (q) { const s = i.price * q * days; sum += s; rows.push(`<li><span>${i.name} × ${q}</span><span>${fmt(s)}</span></li>`); }
      });
      lines.innerHTML = rows.join("") || `<li class="muted">Добавьте инвентарь, чтобы увидеть расчёт</li>`;
      total.textContent = fmt(sum);
    }
    list.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-d]"); if (!b) return;
      const id = b.closest(".calc-item").dataset.id;
      if (!(id in qty)) return;
      qty[id] = Math.max(0, Math.min(10, qty[id] + +b.dataset.d)); update();
    });
    range.addEventListener("input", update);
    update();
    calc.hidden = false;
  }
  });

  /* ---------- Видео: свои MP4, без внешнего плеера ---------- */
  init("Видео: свои MP4, без внешнего плеера", () => {
  const videos = $$("video[data-video]");
  if (videos.length) {
    const connection = navigator.connection;
    const saveData = !!connection?.saveData;
    const lite = saveData || matchMedia("(max-width: 767px)").matches ||
      /(^|-)(2g|3g)$/.test(connection?.effectiveType ?? "") ||
      (connection?.downlink > 0 && connection.downlink < 2.5);

    videos.forEach((video) => {
      if (lite && video.dataset.videoLite) video.src = video.dataset.videoLite;
      video.addEventListener("play", () => {
        videos.forEach((other) => { if (other !== video) other.pause(); });
      });
    });
  }
  });

  /* ---------- Карта ---------- */
  init("Карта", () => {
    if (!D) return;
  $$("[data-map]").forEach((m) => {
    m.innerHTML = `
      <div class="map-card">
        <svg viewBox="0 0 640 480" aria-hidden="true">
          <defs><linearGradient id="road" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a6fc4"/><stop offset="1" stop-color="#7cc8ff"/></linearGradient></defs>
          <rect width="640" height="480" fill="none"/>
          <path d="M0 400 C 180 380, 200 280, 260 220 S 450 170, 640 55" fill="none" stroke="url(#road)" stroke-width="12" stroke-linecap="round" opacity=".85"/>
          <path d="M0 400 C 180 380, 200 280, 260 220 S 450 170, 640 55" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="10 12" opacity=".7"/>
          <g transform="translate(260 220)">
            <circle r="34" fill="#e3241b" opacity=".18"><animate attributeName="r" values="26;40;26" dur="2.4s" repeatCount="indefinite"/></circle>
            <path d="M0 -26 C -14 -26 -22 -16 -22 -6 C -22 10 0 28 0 28 C 0 28 22 10 22 -6 C 22 -16 14 -26 0 -26 Z" fill="#e3241b" stroke="#fff" stroke-width="3"/><circle cy="-6" r="7" fill="#fff"/>
            <text x="42" y="-2" font-family="Unbounded, Manrope, sans-serif" font-weight="800" font-size="22" fill="currentColor">ZSKI</text>
            <text x="42" y="25" font-family="Manrope, sans-serif" font-weight="700" font-size="20" fill="currentColor">Рядом с СНТ Каменка</text>
          </g>
        </svg>
        <button type="button" class="btn btn-ghost btn-sm map-load">Открыть карту</button>
      </div>`;
    $(".map-load", m).addEventListener("click", () => {
      const f = document.createElement("iframe"); f.src = D.address.mapEmbed; f.title = "Карта: как добраться до ZSKI"; f.setAttribute("allowfullscreen", ""); m.appendChild(f); $(".map-card", m).remove();
    });
  });
  });

  /* ---------- Шапка при скролле + параллакс hero ---------- */
  init("Шапка при скролле + параллакс hero", () => {
  const top = $(".topbar"), heroImg = $(".hero-media img");
  const parallax = heroImg && !matchMedia("(prefers-reduced-motion: reduce)").matches && !matchMedia("(pointer: coarse)").matches;
  let scrolled = null, ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false; const y = window.scrollY, s = y > 40;
      if (top && s !== scrolled) { scrolled = s; top.classList.toggle("scrolled", s); }
      if (parallax && y < 1200) heroImg.style.translate = `0 ${y * 0.18}px`;
    });
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  });

  /* ---------- Снег в первом экране (лёгкий) ---------- */
  init("Снег в первом экране (лёгкий)", () => {
  const snow = $(".hero .snow");
  if (snow && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const ctx = snow.getContext("2d"); if (!ctx) return;
    let W, H, flakes = [];
    let frame = 0, inView = true;
    const visible = () => !document.hidden && inView && !document.documentElement.classList.contains("intro-open");
    const sync = () => {
      if (visible() && W && !frame) frame = requestAnimationFrame(draw);
      else if (!visible()) { cancelAnimationFrame(frame); frame = 0; }
    };
    function draw() {
      frame = 0;
      if (!visible() || !W) return;
      ctx.clearRect(0, 0, W, H);
      flakes.forEach((f) => { f.y += f.s; f.w += 0.01; f.x += Math.sin(f.w) * 0.3; if (f.y > H) { f.y = -4; f.x = Math.random() * W; } ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.28); ctx.fillStyle = `rgba(255,255,255,${f.o})`; ctx.fill(); });
      frame = requestAnimationFrame(draw);
    }
    const size = () => { if (!snow.offsetWidth) return; W = snow.width = snow.offsetWidth; H = snow.height = snow.offsetHeight; flakes = Array.from({ length: Math.round(W / 22) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2.2, s: 0.25 + Math.random() * 0.7, o: 0.25 + Math.random() * 0.5, w: Math.random() * 6.28 })); sync(); };
    size(); addEventListener("zski:intro-closed", () => requestAnimationFrame(size));
    addEventListener("zski:intro-opened", sync);
    addEventListener("resize", () => { if (snow.offsetWidth && snow.offsetWidth !== W) size(); }); // на телефоне высота меняется при прокрутке — не пересоздаём
    document.addEventListener("visibilitychange", sync);
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { inView = es[0].isIntersecting; sync(); }).observe(snow);
  }
  });

  /* ---------- Обратный отсчёт до сезона ---------- */
  init("Обратный отсчёт до сезона", () => {
    if (!D) return;
  (() => {
    const box = $("[data-season-stat]"); if (!box || !D.seasonStart) return;
    const now = new Date(), start = new Date(D.seasonStart + "T00:00:00+03:00"), end = D.seasonEnd ? new Date(D.seasonEnd + "T23:59:59+03:00") : null;
    if (now < start) { const days = Math.ceil((start - now) / 864e5), date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" }).format(start), m = days % 100, l = days % 10, w = m > 10 && m < 20 ? "дней" : l === 1 ? "день" : l > 1 && l < 5 ? "дня" : "дней"; box.innerHTML = `<b><span data-count="${days}">${days}</span></b><span>${w} до открытия сезона · ${date}</span>`; }
    else if (!end || now <= end) box.innerHTML = `<b>Сезон открыт</b><span>катаемся — приезжайте за инвентарём</span>`;
    else box.innerHTML = `<b>Межсезонье</b><span>принимаем инвентарь на хранение</span>`;
  })();
  });

  /* ---------- Показатели без анимации ---------- */
  init("Показатели без анимации", () => {
  // Значения сразу окончательные: не заставляем ждать прокрутки счётчика от нуля.
  $$("[data-count]").forEach((el) => {
    el.textContent = new Intl.NumberFormat("ru-RU").format(+el.dataset.count) + (el.dataset.suffix || "");
  });
  });

  /* ---------- Квиз «Какой комплект вам нужен» ---------- */
  init("Квиз «Какой комплект вам нужен»", () => {
    if (!D) return;
  $$("[data-quiz]").forEach((q) => {
    let message = "";
    const ans = {}, steps = $$(".quiz-step", q), res = $(".quiz-result", q), bar = $(".quiz-progress i", q);
    const show = (n, moveFocus = false) => {
      steps.forEach((s) => (s.hidden = +s.dataset.step !== n));
      res.hidden = n !== 4;
      bar.style.width = Math.min(100, (n - 1) / 3 * 100) + "%";
      if (moveFocus) {
        const target = n === 4 ? $(".res-title", res) : steps.find((s) => +s.dataset.step === n).querySelector("button");
        if (n === 4) target.setAttribute("tabindex", "-1");
        else target.removeAttribute("tabindex");
        target.focus({ preventScroll: true });
      }
    };
    const build = () => {
      const g = ans.type === "snowboard" ? D.rental.snowboard : D.rental.ski;
      const set = g.items.find((i) => i.popular) || g.items[0];
      const items = [set, D.rental.extras.items[0]]; if (ans.level === "new") items.push(D.rental.extras.items[1]); if (ans.level !== "pro") items.push(D.rental.extras.items[2]);
      const days = +ans.days, perDay = items.reduce((a, i) => a + i.price, 0);
      const tips = { new: "Для первого раза берите шлем и маску: падать будет мягче, а солнце не помешает. Попросите мастера выставить мягкие настройки креплений.", mid: "Подберём ростовку под уверенное катание и настроим крепления под ваш вес.", pro: "Есть модели для жёстких трасс и свежего снега — скажите, где катаетесь, подберём под склон." };
      $(".res-title", q).textContent = `${set.name} + защита · ${ans.level === "new" ? "новичок" : ans.level === "mid" ? "уверенный" : "опытный"}`;
      $(".res-list", q).innerHTML = items.map((i) => `<li><span>${i.name}</span><b>${new Intl.NumberFormat("ru-RU").format(i.price)} ₽</b></li>`).join("") + `<li class="tip">${tips[ans.level]}</li>`;
      $(".res-total", q).innerHTML = `<small>${plural(days, "день", "дня", "дней")}${days >= 3 ? " и больше" : ""}</small> ${new Intl.NumberFormat("ru-RU").format(perDay * days)}&nbsp;₽${days >= 3 ? " <small>от</small>" : ""}`;
      message = [
        "Здравствуйте! Подобрал комплект на сайте ZSKI.",
        ...items.map((i) => `• ${i.name}`),
        `Срок — ${plural(days, "день", "дня", "дней")}${days >= 3 ? " и больше" : ""}.`,
        `Предварительная стоимость — ${days >= 3 ? "от " : ""}${fmt(perDay * days)}.`,
        "Подскажите, пожалуйста, что есть в наличии."
      ].join("\n");
      $$("[data-messenger]", res).forEach((a) => {
        const kind = a.dataset.messenger;
        const url = new URL(messengerLinks[kind]);
        if (kind === "whatsapp") url.searchParams.set("text", message);
        a.href = url.href;
      });
      const prepared = $("[data-quiz-message]", res);
      if (prepared) prepared.value = message;
    };
    const plural = (n, a, b, c) => { const m = n % 100, l = n % 10; return n + " " + (m > 10 && m < 20 ? c : l === 1 ? a : l > 1 && l < 5 ? b : c); };
    q.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]"); if (b && !b.closest(".quiz-step").hidden) { ans[b.dataset.k] = b.dataset.v; const n = +b.closest(".quiz-step").dataset.step + 1; if (n === 4) build(); show(n, true); return; }
      if (e.target.closest("[data-copy-quiz]")) {
        const text = $("[data-quiz-message]", q);
        text.hidden = false;
        text.focus(); text.select();
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(message)
          .then(() => { $("[data-copy-status]", q).textContent = "Текст скопирован."; })
          .catch(() => { $("[data-copy-status]", q).textContent = "Выделенный текст можно скопировать."; });
      }
      if (e.target.closest(".quiz-again")) { Object.keys(ans).forEach((k) => delete ans[k]); show(1, true); }
    });
    show(1);
  });
  });

  /* ---------- Магнитные кнопки и блик (только с мышью) ---------- */
  init("Магнитные кнопки и блик (только с мышью)", () => {
  if (matchMedia("(hover:hover) and (pointer:fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    $$(".btn-primary").forEach((b) => {
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; b.style.transform = `translate(${x * 6}px, ${y * 6}px)`; b.style.setProperty("--mx", `${(x + 0.5) * 100}%`); });
      b.addEventListener("pointerleave", () => (b.style.transform = ""));
    });
  }
  });

  /* ---------- Год в футере ---------- */
  init("Год в футере", () => {
  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  });

  init("Предзагрузка ссылок меню", () => {
  const prefetchMenu = () => {
    const connection = navigator.connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
    // Не полагаемся на relList.supports: неподдерживаемую подсказку браузер просто игнорирует.
    const currentPage = new URL(location.href);
    currentPage.hash = "";
    if (currentPage.pathname.endsWith("/")) currentPage.pathname += "index.html";
    const seen = new Set([currentPage.href]);
    $$(".menu a[href]").forEach((a) => {
      const url = new URL(a.href);
      url.hash = "";
      if (url.origin !== location.origin || !url.pathname.endsWith(".html") || seen.has(url.href)) return;
      seen.add(url.href);
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "document";
      link.href = url.href;
      document.head.appendChild(link);
    });
  };
  if (document.readyState === "complete") prefetchMenu();
  else addEventListener("load", prefetchMenu, { once: true });
  });
})();
