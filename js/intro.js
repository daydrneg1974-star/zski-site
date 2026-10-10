/* ZSKI — видео-интро «спуск к прокату».
   Ролик проигрывается всегда на скорости 1: плавные торможения перед станциями уже смонтированы
   в нём (tools/retime_intro.py). Скрипт только ставит паузу в момент станции, показывает карточку
   раздела и через CFG.hold продолжает спуск. Скорость на спидометре и громкость ветра берутся из
   того же профиля скорости, что и монтаж. */

/* TIMELINE:BEGIN — генерируется tools/retime_intro.py, не править руками */
const TIMELINE = {"duration": 15.8, "cruise": 0.72, "stations": [2.276, 4.132, 5.988, 7.843, 9.699], "segments": [[0.0, 1.0, 0.15, 0.72], [1.0, 1.376, 0.72, 0.72], [1.376, 2.276, 0.72, 0.2], [2.276, 2.976, 0.2, 0.72], [2.976, 3.232, 0.72, 0.72], [3.232, 4.132, 0.72, 0.2], [4.132, 4.832, 0.2, 0.72], [4.832, 5.088, 0.72, 0.72], [5.088, 5.988, 0.72, 0.2], [5.988, 6.688, 0.2, 0.72], [6.688, 6.943, 0.72, 0.72], [6.943, 7.843, 0.72, 0.2], [7.843, 8.543, 0.2, 0.72], [8.543, 8.799, 0.72, 0.72], [8.799, 9.699, 0.72, 0.2], [9.699, 10.499, 0.2, 0.55], [10.499, 14.802, 0.55, 0.55], [14.802, 15.802, 0.55, 0.35]]};
/* TIMELINE:END */

const CFG = {
  hold: 1800,      // пауза на станции, мс
  maxSpeed: 68,    // км/ч на спидометре при обычном ходе
  startAlt: 220,   // м, высота на старте
};
const STATIONS = [
  { n: "01", label: "Прокат",     sub: "Лыжи и сноуборды известных брендов",     href: "index.html#prokat", side: "right" },
  { n: "02", label: "Цены",       sub: "От 500 ₽ в день, калькулятор комплекта",  href: "prices.html",       side: "left" },
  { n: "03", label: "SKI-сервис", sub: "Заточка, парафин, ремонт, хранение",      href: "service.html",      side: "right" },
  { n: "04", label: "Склоны",     sub: "Сорочаны, Волен, Степаново, «Яхрома»",    href: "slopes.html",       side: "left" },
  { n: "05", label: "Контакты",   sub: "61-й км Дмитровского шоссе, карта, график", href: "contacts.html",   side: "right" },
];

/* Профиль скорости ролика (доля скорости исходника) в момент t, как при монтаже */
function speedAt(t) {
  for (const [t0, t1, a, b] of TIMELINE.segments) {
    if (t < t1) { const u = t1 > t0 ? Math.max(0, (t - t0) / (t1 - t0)) : 0; return a + (b - a) * u * u * (3 - 2 * u); }
  }
  return TIMELINE.segments[TIMELINE.segments.length - 1][3];
}

/* Плеер. root — document (страница intro.html) или ShadowRoot (слой поверх главной).
   opts.close() — уйти на сайт, opts.replay() — проехать ещё раз.
   Возвращает управление: suspend()/wake() — спрятать/показать слой, progress()/restore() — место спуска. */
function initIntro(root, opts) {
  const $ = (s) => root.querySelector(s);
  const v = $("#v"), fade = $("#fade"), title = $("#title"), center = $("#center"), stage = $(".stage"),
        speedEl = $("#speed"), altEl = $("#alt"), menu = $("#menu"), startScreen = $("#start"), goBtn = $("#go");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const st = { phase: "start", idx: 0, card: null, holdTimer: 0, vfc: 0, raf: 0, shownSpeed: -1, shownAlt: -1, windK: -1, suspended: false };

  /* ---------- Спидометр и высота ---------- */
  function hud(t) {
    const k = st.phase === "run" ? speedAt(t) / TIMELINE.cruise : 0;
    const sp = Math.round(CFG.maxSpeed * Math.min(1, k));
    const alt = Math.max(0, Math.round(CFG.startAlt * (1 - t / TIMELINE.duration)));
    if (sp !== st.shownSpeed) { speedEl.textContent = sp; st.shownSpeed = sp; }
    if (alt !== st.shownAlt) { altEl.textContent = alt; st.shownAlt = alt; }
    if (wind.gain && Math.abs(k - st.windK) > 0.03) {
      st.windK = k; const now = wind.ctx.currentTime;
      wind.gain.gain.setTargetAtTime(0.4 * k, now, 0.2); wind.filter.frequency.setTargetAtTime(160 + 800 * k, now, 0.2);
    }
  }

  /* ---------- Слежение за роликом: по кадрам видео (rVFC), запасной путь — rAF ---------- */
  function watch() {
    unwatch();
    if (st.phase !== "run" || st.suspended) return;
    if (v.requestVideoFrameCallback) st.vfc = v.requestVideoFrameCallback(tick);
    else st.raf = requestAnimationFrame(tick);
  }
  function unwatch() {
    if (st.vfc && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(st.vfc);
    cancelAnimationFrame(st.raf); st.vfc = st.raf = 0;
  }
  function tick() { st.vfc = st.raf = 0; check(); watch(); }
  function check() {
    if (st.phase !== "run") return;
    const t = v.currentTime;
    if (st.idx < STATIONS.length) {
      const at = TIMELINE.stations[st.idx];
      if (t >= at - 0.04) { if (t > at + 0.2) v.currentTime = at; arrive(); return; }
    }
    hud(t);
  }
  v.addEventListener("timeupdate", check); // на случай, если кадры не отрисовываются (вкладка в фоне)

  /* ---------- Станции ---------- */
  function showCard(i) {
    const s = STATIONS[i], a = document.createElement("a");
    a.className = `station ${s.side}`; a.href = s.href;
    a.innerHTML = `<span class="num">${s.n}</span><span class="name">${s.label}</span><span class="sub">${s.sub}</span><span class="go">Перейти <i>→</i></span>`;
    center.appendChild(a); requestAnimationFrame(() => requestAnimationFrame(() => a.classList.add("in")));
    st.card = a;
  }
  function hideCard() {
    const a = st.card; if (!a) return; st.card = null;
    a.classList.remove("in"); a.classList.add("out"); setTimeout(() => a.remove(), 500);
  }
  function arrive() {
    unwatch(); v.pause(); st.phase = "hold";
    title.classList.remove("show"); stage.classList.add("hold"); hud(v.currentTime);
    showCard(st.idx); armHold();
  }
  function armHold() { clearTimeout(st.holdTimer); st.holdTimer = setTimeout(resume, CFG.hold); }
  function resume() {
    if (st.phase !== "hold") return;
    clearTimeout(st.holdTimer); hideCard(); stage.classList.remove("hold");
    st.idx++; st.phase = "run"; play();
  }
  function play() { const p = v.play(); if (p && p.catch) p.catch(() => {}); watch(); }
  function finish() {
    if (st.phase === "end") return;
    unwatch(); clearTimeout(st.holdTimer); hideCard(); stage.classList.remove("hold");
    st.phase = "end"; hud(TIMELINE.duration);
    menu.classList.add("show");
    if (wind.gain) wind.gain.gain.setTargetAtTime(0, wind.ctx.currentTime, 0.4);
  }
  v.addEventListener("ended", () => { if (st.phase === "run") finish(); });
  v.addEventListener("error", () => { if (st.phase === "run") finish(); }, true);
  v.addEventListener("playing", () => v.classList.add("on"), { once: true });

  /* ---------- Старт по кнопке: клик — жест пользователя, поэтому звук ветра включается сразу ---------- */
  goBtn.addEventListener("click", () => {
    startScreen.classList.add("off"); stage.classList.remove("waiting");
    startWind();
    if (reduce) { finish(); return; }
    title.classList.add("show"); setTimeout(() => title.classList.remove("show"), 2200);
    st.phase = "run"; st.idx = 0;
    if (v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) { finish(); return; }
    play();
  });

  /* Клик мимо карточки во время остановки — едем дальше; пробел/Enter — тоже; Esc — на сайт */
  root.addEventListener("click", (e) => { if (e.target.closest("a,button")) return; if (st.phase === "hold") resume(); });
  const onKey = (e) => {
    if (st.suspended) return;
    if (e.key === "Escape") opts.close();
    if ((e.key === " " || e.key === "Enter") && st.phase === "hold") { e.preventDefault(); resume(); }
  };
  addEventListener("keydown", onKey);
  $("#replay").addEventListener("click", () => opts.replay());
  requestAnimationFrame(() => { fade.classList.add("out"); setTimeout(() => fade.remove(), 900); });

  /* ---------- Ветер (Web Audio, шум через фильтр) ---------- */
  const wind = {};
  function startWind() {
    if (wind.ctx || reduce) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 300;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(ctx.destination); src.start();
      wind.ctx = ctx; wind.filter = filter; wind.gain = gain;
      const b = $("#mute"); b.hidden = false;
      const sync = () => { const on = ctx.state === "running" && !wind.muted; b.textContent = on ? "🔊" : "🔇 Включить звук"; b.classList.toggle("attn", !on && !st.suspended); };
      b.addEventListener("click", (e) => { e.stopPropagation(); if (ctx.state !== "running") { wind.muted = false; ctx.resume().then(sync); } else { wind.muted = !wind.muted; ctx[wind.muted ? "suspend" : "resume"]().then(sync); } });
      ctx.addEventListener("statechange", sync);
      if (ctx.state !== "running") ctx.resume().catch(() => {});
      setTimeout(sync, 300);
      wind.wake = () => { if (ctx.state !== "running" && !wind.muted) ctx.resume().then(sync).catch(() => {}); };
    } catch {}
  }
  /* Браузер мог не дать включить звук без жеста — включаем при любом касании после старта */
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => root.addEventListener(ev, () => {
    if (startScreen.classList.contains("off")) { startWind(); wind.wake && wind.wake(); }
  }, { passive: true }));

  return {
    /* Слой спрятан (переход на главную): всё останавливаем, место спуска запоминаем */
    suspend() {
      st.suspended = true; unwatch(); clearTimeout(st.holdTimer);
      try { v.pause(); } catch {}
      if (wind.ctx && wind.ctx.state === "running") wind.ctx.suspend().catch(() => {});
    },
    /* Слой снова показан (кнопка «Назад»): продолжаем с того же места */
    wake() {
      st.suspended = false;
      if (st.phase === "hold") armHold();
      else if (st.phase === "run") play();
      if (st.phase !== "start" && st.phase !== "end" && wind.wake) wind.wake();
    },
    progress() { return { phase: st.phase, idx: st.idx, t: Math.round(v.currentTime * 1000) / 1000 }; },
    /* Возврат «Назад» без кэша страницы: продолжить с сохранённой станции (звук — по касанию) */
    restore(p) {
      if (!p || p.phase === "start") return;
      startScreen.classList.add("off"); stage.classList.remove("waiting");
      if (p.phase === "end") { finish(); return; }
      st.idx = Math.min(p.idx, STATIONS.length);
      const go = () => {
        v.currentTime = p.t || 0; v.classList.add("on");
        if (p.phase === "hold" && st.idx < STATIONS.length) { st.phase = "hold"; stage.classList.add("hold"); showCard(st.idx); armHold(); hud(v.currentTime); }
        else { st.phase = "run"; play(); }
      };
      if (v.readyState >= 1) go(); else v.addEventListener("loadedmetadata", go, { once: true });
    },
    stop() {
      st.suspended = true; st.phase = "end"; unwatch(); clearTimeout(st.holdTimer);
      removeEventListener("keydown", onKey);
      try { v.pause(); v.removeAttribute("src"); v.load(); } catch {}
      if (wind.ctx) wind.ctx.close().catch(() => {});
    },
  };
}

/* ---------- Запуск ----------
   intro.html: плеер на всей странице.
   index.html: разметка интро лежит в <template id="intro-tpl"> и поднимается слоем поверх сайта
   (Shadow DOM — стили интро и сайта не пересекаются). Решение «показывать ли интро» принимает
   маленький скрипт в <head> (src/layout/intro-head.html) ещё до первой отрисовки и ставит
   <html class="intro-open">, пока слой открыт главная скрыта и не нагружает процессор.
   История браузера: открытое интро — отдельная запись. Уход на главную («Открыть сайт»,
   карточка «Прокат», «Пропустить», Esc) добавляет запись, поэтому «Назад» возвращает к спуску
   с того же места. Переход в другой раздел запоминает место спуска в записи истории. */
(function () {
  const tpl = document.getElementById("intro-tpl");
  if (!tpl) {
    initIntro(document, { close: () => { location.href = "index.html"; }, replay: () => location.reload() });
    return;
  }
  const html = document.documentElement;
  const cssHref = document.currentScript ? document.currentScript.src.replace(/js\/intro\.js/, "css/intro.css") : "css/intro.css";
  let host = null, ctl = null, hideTimer = 0;
  const KEY = "zskiIntro";
  const setState = (extra, push, url) => {
    const s = Object.assign({}, history.state || {}, extra);
    try { push ? history.pushState(s, "", url) : history.replaceState(s, "", url); } catch {}
  };
  const samePage = (href) => {
    const u = new URL(href, location.href);
    const strip = (p) => p.replace(/index\.html$/, "");
    return u.origin === location.origin && strip(u.pathname) === strip(location.pathname) ? u : null;
  };

  function mount() {
    if (host) { ctl.stop(); host.remove(); }
    host = document.createElement("div");
    host.className = "intro-host"; host.setAttribute("role", "dialog"); host.setAttribute("aria-label", "Видео-интро: спуск к прокату");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<link rel="stylesheet" href="${cssHref}">` + tpl.innerHTML;
    document.body.appendChild(host);
    root.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]"); if (!a) return;
      const u = samePage(a.getAttribute("href"));
      if (u) { e.preventDefault(); hide(true, u.hash); return; }
      setState({ [KEY]: "open", p: ctl.progress() }); // уходим в другой раздел — запомнить место спуска
    }, true);
    ctl = initIntro(root, { close: () => hide(true, ""), replay: () => { mount(); show(); } });
    return ctl;
  }
  function show() {
    clearTimeout(hideTimer);
    html.classList.add("intro-open");
    host.hidden = false; host.classList.remove("closing");
    ctl.wake();
  }
  function hide(push, hash) {
    if (!host || host.hidden) return;
    ctl.suspend();
    if (push) setState({ [KEY]: "closed", p: null }, true, hash || location.pathname + location.search);
    html.classList.remove("intro-open");          // главная строится под ещё видимым слоем…
    dispatchEvent(new Event("zski:intro-closed"));
    requestAnimationFrame(() => {
      host.classList.add("closing");              // …а слой плавно растворяется
      if (hash) { const el = document.getElementById(hash.slice(1)); if (el) el.scrollIntoView({ block: "start" }); }
      else if (push) scrollTo(0, 0);
      hideTimer = setTimeout(() => { host.hidden = true; }, 400);
    });
  }

  addEventListener("popstate", (e) => {
    const s = e.state || {};
    if (s[KEY] === "open") { if (!host) { mount(); ctl.restore(s.p); } show(); }
    else hide(false, "");
  });
  /* Возврат из кэша страниц (bfcache): слой остался как был — продолжить с того же места */
  addEventListener("pageshow", (e) => { if (e.persisted && host && !host.hidden) ctl.wake(); });

  /* Кнопка «▶ Спуск к прокату» на первом экране: новый спуск, отдельная запись истории */
  document.querySelectorAll("a[data-intro]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault(); mount(); show(); setState({ [KEY]: "open", p: null }, true);
  }));

  const boot = window.__zskiIntro;
  if (boot && boot.show) {
    mount();
    if (boot.restore) ctl.restore(boot.restore);
    show();
    setState({ [KEY]: "open", p: null });
  }
})();
