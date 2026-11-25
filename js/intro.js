/* ZSKI — видео-интро «спуск к прокату».
   Ролик проигрывается всегда на скорости 1: плавные торможения перед станциями уже смонтированы
   в нём. Скрипт управляет остановками, шкалой маршрута и переходом к павильону.
   Спидометр и звук используют тот же профиль скорости, что и монтаж. */

/* TIMELINE:BEGIN — генерируется tools/retime_intro.py, не править руками */
const TIMELINE = {"duration": 18.0, "cruise": 0.6, "stations": [2.542, 4.898, 7.255, 9.612, 11.968], "segments": [[0.0, 1.0, 0.15, 0.6], [1.0, 1.642, 0.6, 0.6], [1.642, 2.542, 0.6, 0.2], [2.542, 3.242, 0.2, 0.6], [3.242, 3.998, 0.6, 0.6], [3.998, 4.898, 0.6, 0.2], [4.898, 5.598, 0.2, 0.6], [5.598, 6.355, 0.6, 0.6], [6.355, 7.255, 0.6, 0.2], [7.255, 7.955, 0.2, 0.6], [7.955, 8.712, 0.6, 0.6], [8.712, 9.612, 0.6, 0.2], [9.612, 10.312, 0.2, 0.6], [10.312, 11.068, 0.6, 0.6], [11.068, 11.968, 0.6, 0.2], [11.968, 12.768, 0.2, 0.42], [12.768, 17.025, 0.42, 0.42], [17.025, 18.025, 0.42, 0.35]]};
/* TIMELINE:END */

const CFG = {
  hold: 2000,      // пауза на станции, мс
  maxSpeed: 68,    // км/ч на спидометре при обычном ходе
  startAlt: 220,   // м, высота на старте
};
const STATIONS = [
  { label: "Прокат",     sub: "Лыжи и сноуборды известных брендов",     href: "index.html#prokat", side: "right" },
  { label: "Цены",       sub: "Комплекты от 2 000 ₽ в день",  href: "prices.html",       side: "left" },
  { label: "SKI-сервис", sub: "Заточка, парафин, ремонт, хранение",      href: "service.html",      side: "right" },
  { label: "Склоны",     sub: "Волен, Степаново и парк Яхрома",    href: "slopes.html",       side: "left" },
  { label: "Контакты",   sub: "Яхрома, рядом с СНТ Каменка · карта и график", href: "contacts.html",   side: "right" },
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
        speedEl = $("#speed"), altEl = $("#alt"), menu = $("#menu"), startScreen = $("#start"), goBtn = $("#go"), hint = $("#hint");
  const route = $("#route"), routeList = $("#route-stations"), arrivalPhoto = $("#arrival-photo");
  const hudPanel = $(".hud");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const st = { phase: "start", idx: 0, card: null, holdTimer: 0, vfc: 0, raf: 0, shownSpeed: -1, shownAlt: -1, soundLevel: -1, routeStep: "", hovered: false, focused: false, pinned: false, suspended: false, buffering: false, loadTimer: 0 };
  const wind = {};
  const recovery = $("#video-recovery"), retry = $("#video-retry"), message = $("#video-message");
  let stallTimer = 0, lastTime = -1, playAttempt = 0;
  const triedSources = new Set();
  goBtn.dataset.ready = "1";
  v.muted = true;
  function clearStall() { clearTimeout(stallTimer); stallTimer = 0; }
  function showFailure(text) {
    if (st.suspended || st.phase === "end") return;
    ++playAttempt; clearStall(); clearTimeout(st.loadTimer); clearTimeout(st.holdTimer);
    unwatch(); v.pause(); st.phase = "error"; st.buffering = false;
    stage.classList.remove("buffering"); hint.classList.remove("show");
    message.textContent = text; recovery.hidden = false; hud(v.currentTime);
  }
  function armStall() {
    clearStall();
    if (st.phase !== "run" || st.suspended) return;
    stallTimer = setTimeout(() => showFailure("Видео не загружается. Повтори запуск или перейди на сайт."), 12000);
  }
  v.addEventListener("timeupdate", () => {
    if (v.currentTime !== lastTime) { lastTime = v.currentTime; armStall(); }
  });
  function recoverSource() {
    if (st.suspended || st.phase === "end" || st.aborted) return;
    const failed = v.currentSrc || v.src;
    if (failed) triedSources.add(failed);
    const next = Array.from(v.querySelectorAll("source")).find((s) =>
      (!s.media || matchMedia(s.media).matches) && !triedSources.has(s.src) && v.canPlayType(s.type));
    if (!next) { st.noVideo = true; showFailure("Не удалось воспроизвести видео. Повтори запуск или открой сайт."); return; }
    triedSources.add(next.src);
    const time = v.currentTime, running = st.phase === "run" || st.phase === "blocked";
    ++playAttempt; v.src = next.src; v.load();
    if (time > 0) v.addEventListener("loadedmetadata", () => { if (!st.suspended) v.currentTime = time; }, { once: true });
    if (running) { st.phase = "run"; play(); }
  }
  retry.addEventListener("click", () => {
    recovery.hidden = true;
    if (st.phase === "blocked") { unblock(); return; }
    st.noVideo = false; st.idx = 0; lastTime = -1; triedSources.clear();
    startScreen.classList.add("off"); stage.classList.remove("waiting");
    hideCard(); stage.classList.remove("hold"); showRoute(true);
    v.load(); st.phase = "run"; play(); startWind();
  });

  const routePoints = STATIONS.map((station, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "route-point";
    button.textContent = station.label;
    button.setAttribute("aria-label", `Перемотать к остановке «${station.label}»`);
    button.disabled = true;
    button.addEventListener("click", () => seekStation(index));
    item.appendChild(button);
    routeList.appendChild(item);
    return button;
  });
  function canSeekTo(index) {
    const time = TIMELINE.stations[index];
    if (v.readyState < HTMLMediaElement.HAVE_METADATA) return false;
    for (let i = 0; i < v.seekable.length; i++) {
      if (v.seekable.start(i) <= time && time <= v.seekable.end(i)) return true;
    }
    return false;
  }
  function setRouteAvailability() {
    routePoints.forEach((button, index) => { button.disabled = !canSeekTo(index); });
  }
  function showRoute(visible) {
    route.hidden = !visible;
    stage.classList.toggle("route-on", visible);
  }
  ["loadedmetadata", "progress", "canplay", "emptied"].forEach((event) => v.addEventListener(event, setRouteAvailability));
  setRouteAvailability();

  function updateRoute(t) {
    if (route.hidden) return;
    const n = STATIONS.length, i = st.idx;
    const start = TIMELINE.stations[i - 1] ?? 0, end = TIMELINE.stations[i] ?? TIMELINE.duration;
    const left = i === 0 ? 0 : (i - 0.5) / n, right = i === n ? 1 : (i + 0.5) / n;
    const fraction = Math.max(0, Math.min(1, (t - start) / (end - start)));
    routeList.style.setProperty("--route-progress", `${((left + (right - left) * fraction) * 100).toFixed(1)}%`);
    const active = st.phase === "hold" ? i : -1, step = `${i}/${active}`;
    if (step === st.routeStep) return;
    st.routeStep = step;
    routePoints.forEach((button, index) => {
      button.classList.toggle("passed", index < i);
      if (index === active) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }

  function loadArrival() {
    if (!arrivalPhoto.hasAttribute("src")) arrivalPhoto.src = arrivalPhoto.dataset.src;
  }
  function updateArrival(t) {
    if (t >= TIMELINE.stations[1]) loadArrival();
    stage.classList.toggle("arrival-on", Boolean(arrivalPhoto.naturalWidth && st.phase === "end"));
  }
  arrivalPhoto.addEventListener("load", () => updateArrival(v.currentTime));

  /* ---------- Спидометр и высота ---------- */
  function hud(t) {
    const k = st.phase === "run" && !st.buffering && !st.suspended ? Math.min(1, speedAt(t) / TIMELINE.cruise) : 0;
    const sp = Math.round(CFG.maxSpeed * k);
    const alt = Math.max(0, Math.round(CFG.startAlt * (1 - t / TIMELINE.duration)));
    if (sp !== st.shownSpeed) { speedEl.textContent = sp; st.shownSpeed = sp; }
    if (alt !== st.shownAlt) { altEl.textContent = alt; st.shownAlt = alt; }
    updateRoute(t);
    updateArrival(t);
    syncSound(k);
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
    const s = STATIONS[i], card = $("#station-template").content.firstElementChild.cloneNode(true);
    card.classList.add(s.side);
    card.setAttribute("aria-label", s.label);
    card.querySelector(".name").textContent = s.label;
    card.querySelector(".sub").textContent = s.sub;
    const link = card.querySelector(".go"), next = card.querySelector(".station-next");
    link.href = s.href;
    link.setAttribute("aria-label", `Перейти в раздел «${s.label}»`);
    let touchPress = false;
    card.addEventListener("pointermove", (e) => {
      // Карточка может сама появиться под неподвижным курсором.
      if (st.card !== card || st.hovered || (e.pointerType !== "mouse" && e.pointerType !== "pen")) return;
      st.hovered = true; armHold();
    });
    card.addEventListener("pointerleave", () => {
      if (st.card !== card || !st.hovered) return;
      st.hovered = false; armHold();
    });
    card.addEventListener("focusin", (e) => {
      if (st.card !== card || !e.target.matches(":focus-visible")) return;
      st.focused = true; armHold();
    });
    card.addEventListener("focusout", (e) => {
      if (st.card !== card || !st.focused || card.contains(e.relatedTarget)) return;
      st.focused = false; armHold();
    });
    card.addEventListener("pointerdown", (e) => {
      touchPress = e.pointerType === "touch";
      if (st.card !== card || !touchPress) return;
      st.pinned = true; next.hidden = false; armHold();
    });
    card.addEventListener("click", (e) => {
      if (st.card !== card || touchPress || e.target.closest("a,button")) return;
      link.click();
    });
    next.addEventListener("click", resume);
    st.card = card;
    card.classList.add("in");
    center.appendChild(card);
  }
  function resetCardHold() {
    st.hovered = st.focused = st.pinned = false;
    if (st.card) st.card.querySelector(".station-next").hidden = true;
  }
  function hideCard() {
    const card = st.card;
    resetCardHold();
    if (!card) return;
    st.card = null;
    card.inert = true;
    card.classList.remove("in"); card.classList.add("out"); setTimeout(() => card.remove(), 200);
  }
  function arrive() {
    clearStall(); unwatch(); v.pause(); st.phase = "hold";
    title.classList.remove("show"); stage.classList.add("hold"); hud(v.currentTime);
    showCard(st.idx); armHold();
  }
  function armHold() {
    clearTimeout(st.holdTimer);
    if (st.phase !== "hold" || st.suspended || st.hovered || st.focused || st.pinned || v.seeking) return;
    st.holdTimer = setTimeout(resume, CFG.hold);
  }
  v.addEventListener("seeked", armHold);
  function seekStation(i) {
    if (route.hidden || st.suspended || !canSeekTo(i)) return;
    if (st.phase === "hold" && st.idx === i) { armHold(); return; }
    clearTimeout(st.loadTimer); recovery.hidden = true;
    hideCard();
    st.idx = i;
    st.buffering = false;
    stage.classList.remove("buffering");
    hint.classList.remove("show");
    v.currentTime = TIMELINE.stations[i];
    arrive();
  }
  function resume() {
    if (st.phase !== "hold") return;
    clearTimeout(st.holdTimer); hideCard(); stage.classList.remove("hold");
    st.idx++; st.phase = "run"; play();
  }
  function play() {
    const attempt = ++playAttempt;
    armStall();
    if (!st.buffering) hint.classList.remove("show");
    hud(v.currentTime);
    const p = v.play();
    if (p && p.catch) p.catch((err) => {
      if (attempt !== playAttempt || st.suspended || st.phase !== "run" || !err) return;
      if (err.name === "AbortError") return;
      if (err.name !== "NotAllowedError") { recoverSource(); return; }
      clearStall(); clearTimeout(st.loadTimer); st.buffering = false; stage.classList.remove("buffering");
      unwatch(); st.phase = "blocked";               // браузер требует касания — просим и ждём
      message.textContent = "Нажми «Повторить запуск», чтобы продолжить спуск."; recovery.hidden = false;
      hint.classList.remove("show");
      hud(v.currentTime);
    });
    watch();
  }
  function unblock() { if (st.phase !== "blocked") return; recovery.hidden = true; st.phase = "run"; play(); }

  /* ---------- Загрузка ролика ----------
     play() вызывается прямо по нажатию «Поехали», без ожидания запаса видео.
     Браузер начинает показ с первых доступных кадров. Подсказка нужна только при
     реальной задержке сети; короткие события waiting не перекрывают картинку. */
  function startPlayback() {
    st.phase = "run";
    title.classList.add("show");
    setTimeout(() => title.classList.remove("show"), 1500);
    play();
  }
  v.addEventListener("waiting", () => {
    if (st.phase !== "run" || st.suspended) return;
    st.buffering = true;
    hud(v.currentTime);
    clearTimeout(st.loadTimer);
    st.loadTimer = setTimeout(() => {
      if (!st.buffering || st.phase !== "run" || st.suspended) return;
      stage.classList.add("buffering");
      hint.textContent = "Подгружаем видео…";
      hint.classList.add("show");
    }, 600);
  });
  v.addEventListener("playing", () => {
    clearTimeout(st.loadTimer);
    st.buffering = false;
    stage.classList.remove("buffering");
    if (st.phase === "run") hint.classList.remove("show");
  });
  function finish() {
    if (st.phase === "end") return;
    // Убираем сам видеослой: мобильный встроенный плеер не должен закрывать меню финиша.
    v.pause(); v.hidden = true;
    clearStall(); recovery.hidden = true;
    unwatch(); clearTimeout(st.holdTimer); clearTimeout(st.loadTimer); hideCard(); stage.classList.remove("hold"); stage.classList.remove("buffering"); st.buffering = false; hint.classList.remove("show");
    showRoute(false);
    loadArrival();
    st.phase = "end"; hud(TIMELINE.duration);
    // Фото и меню появляются в одном кадре, сразу после окончания ролика.
    hudPanel.hidden = true;
    menu.classList.add("show");
  }
  v.addEventListener("ended", () => { if (st.phase === "run") finish(); });
  const lastSource = v.querySelector("source:last-of-type");
  v.addEventListener("error", (e) => {
    if (e.target !== v && e.target !== lastSource) return; // первый источник не подошёл — браузер берёт следующий
    recoverSource();
  }, true);
  /* Страховка: после старта ролик так и не начал грузиться (нет ни одного источника, ошибка) — показать меню */
  const noVideoNow = () => st.noVideo || !!v.error || (v.readyState === 0 && v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE);
  v.addEventListener("playing", () => v.classList.add("on"), { once: true });

  /* ---------- Старт по кнопке: клик — жест пользователя, поэтому звук ветра включается сразу ---------- */
  goBtn.addEventListener("click", () => {
    window.__zskiGo = 0;
    if (st.phase !== "start") return;
    startScreen.classList.add("off"); stage.classList.remove("waiting");
    if (reduce) { finish(); return; }
    if (st.noVideo) { showFailure("Не удалось загрузить видео. Повтори запуск или перейди на сайт."); return; }
    st.idx = 0;
    showRoute(true);
    if (v.preload !== "auto") { v.preload = "auto"; v.load(); }
    startPlayback();
    startWind();
    setTimeout(() => { if (st.phase === "run" && st.idx === 0 && v.currentTime === 0 && noVideoNow()) recoverSource(); }, 2500);
  });

  /* Клик мимо карточки во время остановки — едем дальше; пробел/Enter — тоже; Esc — на сайт */
  root.addEventListener("click", (e) => {
    if (st.phase === "blocked") { if (!e.target.closest("a,#go,#video-retry")) { e.preventDefault(); unblock(); } return; }
    if (e.target.closest("a,button,.station,.descent-route")) return;
    if (st.phase === "hold") resume();
  });
  const onKey = (e) => {
    if (st.suspended) return;
    if (e.composedPath().some((node) => node instanceof Element && node.matches(".route-dialog"))) return;
    if (e.key === "Escape") opts.close();
    const el = e.composedPath ? e.composedPath()[0] : e.target;  // в Shadow DOM настоящая цель — первая в пути
    if (el && el.closest && el.closest("a,button,input,select,textarea")) return;
    if ((e.key === " " || e.key === "Enter") && st.phase === "hold") { e.preventDefault(); resume(); }
    else if ((e.key === " " || e.key === "Enter") && st.phase === "blocked") { e.preventDefault(); unblock(); }
  };
  addEventListener("keydown", onKey);
  $("#replay").addEventListener("click", () => opts.replay());
  setTimeout(() => fade.remove(), 600);

  /* Ролик в разметке с preload="none": заранее загружаем, когда открыт экран интро. */
  if (v.preload !== "auto") { v.preload = "auto"; v.load(); }
  /* Нажали «Поехали» раньше, чем загрузился этот скрипт, — стартуем сейчас */
  if (window.__zskiGo) { window.__zskiGo = 0; setTimeout(() => goBtn.click(), 0); }

  /* ---------- Ветер и шорох кантов (две полосы шума) ---------- */
  function syncSound(speed) {
    if (!wind.gain || speed === st.soundLevel) return;
    if (speed !== 0 && Math.abs(speed - st.soundLevel) < 0.025) return;
    st.soundLevel = speed;
    const now = wind.ctx.currentTime, ramp = speed === 0 ? 0.055 : 0.14;
    wind.gain.gain.setTargetAtTime(0.33 * speed ** 1.4, now, ramp);
    wind.filter.frequency.setTargetAtTime(180 + 1100 * speed, now, ramp);
    wind.edges.gain.setTargetAtTime(0.11 * speed ** 2.2, now, ramp);
    wind.edgeFilter.frequency.setTargetAtTime(750 + 1350 * speed, now, ramp);
  }
  function startWind() {
    if (wind.ctx || reduce) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 300;
      const gain = ctx.createGain(); gain.gain.value = 0;
      const edgeFilter = ctx.createBiquadFilter(); edgeFilter.type = "bandpass"; edgeFilter.Q.value = 0.8;
      const edges = ctx.createGain(); edges.gain.value = 0;
      src.connect(filter).connect(gain).connect(ctx.destination);
      src.connect(edgeFilter).connect(edges).connect(ctx.destination);
      src.start();
      Object.assign(wind, { ctx, filter, gain, edgeFilter, edges });
      const b = $("#mute"); b.hidden = false;
      const sync = () => {
        const on = ctx.state === "running" && !wind.muted;
        b.textContent = on ? "🔊" : "🔇 Включить звук";
        b.setAttribute("aria-label", on ? "Выключить звук" : "Включить звук");
        b.setAttribute("aria-pressed", String(on));
        b.classList.toggle("attn", !on && !st.suspended);
      };
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        wind.muted = ctx.state === "running" && !wind.muted;
        (wind.muted ? ctx.suspend() : ctx.resume()).then(sync).catch(() => {});
      });
      ctx.addEventListener("statechange", sync);
      if (ctx.state !== "running") ctx.resume().catch(() => {});
      sync();
      wind.wake = () => { if (ctx.state !== "running" && !wind.muted && !st.suspended) ctx.resume().then(sync).catch(() => {}); };
      hud(v.currentTime);
    } catch {}
  }
  /* Браузер мог не дать включить звук без жеста — включаем при любом касании после старта */
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => root.addEventListener(ev, () => {
    if (startScreen.classList.contains("off")) { startWind(); wind.wake && wind.wake(); }
  }, { passive: true }));

  return {
    /* Слой спрятан (переход на главную): всё останавливаем, место спуска запоминаем */
    suspend() {
      st.suspended = true; ++playAttempt; clearStall(); unwatch(); clearTimeout(st.holdTimer); clearTimeout(st.loadTimer);
      resetCardHold(); syncSound(0);
      try {
        v.pause();
        /* Слой скрыт — закачку ролика останавливаем, чтобы на слабом канале она не мешала странице.
           Место запоминаем; при возврате («Назад») докачаем с него. */
        const b = v.buffered, whole = b.length && b.end(b.length - 1) >= (v.duration || TIMELINE.duration) - 0.5;
        if (st.phase !== "end" && !whole) {
          st.resumeT = v.currentTime; st.aborted = true;
          st.directSrc = v.getAttribute("src"); v.removeAttribute("src");
          st.sources = Array.from(v.querySelectorAll("source")); st.sources.forEach((el) => el.remove()); v.load(); // без источников закачка прекращается
        }
      } catch {}
      if (wind.ctx && wind.ctx.state === "running") wind.ctx.suspend().catch(() => {});
    },
    /* Слой снова показан (кнопка «Назад»): продолжаем с того же места */
    wake() {
      st.suspended = false;
      resetCardHold();
      const go = () => {
        if (st.phase === "hold") armHold();
        else if (st.phase === "run" || st.phase === "blocked") { st.phase = "run"; play(); }
      };
      if (st.aborted) {                                   // закачку останавливали — продолжаем с того же места
        if (st.directSrc) v.src = st.directSrc;
        st.aborted = false; (st.sources || []).forEach((el) => v.appendChild(el)); v.preload = "auto"; v.load();
        const seek = () => { if (st.suspended) return; try { v.currentTime = st.resumeT || 0; } catch {} go(); };
        if (v.readyState >= 1) seek(); else v.addEventListener("loadedmetadata", seek, { once: true });
      } else go();
      if (st.phase !== "start" && st.phase !== "end" && wind.wake) wind.wake();
    },
    progress() { return { phase: st.phase === "blocked" ? "run" : st.phase, idx: st.idx, t: Math.round(v.currentTime * 1000) / 1000 }; },
    /* Возврат «Назад» без кэша страницы: продолжить с сохранённой станции (звук — по касанию) */
    restore(p) {
      if (!p || p.phase === "start") return;
      startScreen.classList.add("off"); stage.classList.remove("waiting");
      loadArrival();
      if (p.phase === "end") { finish(); return; }
      showRoute(true);
      st.idx = Math.min(p.idx, STATIONS.length);
      const go = () => {
        if (!st.restoring && st.phase === "end") return;
        st.restoring = false;
        v.currentTime = p.t || 0; v.classList.add("on");
        if (p.phase === "hold" && st.idx < STATIONS.length) { st.phase = "hold"; stage.classList.add("hold"); showCard(st.idx); armHold(); hud(v.currentTime); }
        else { st.phase = "run"; play(); }
      };
      if (v.readyState >= 1) go();
      else if (st.noVideo) finish();                       // ролик недоступен — сразу меню
      else { st.restoring = true; v.addEventListener("loadedmetadata", go, { once: true }); }
    },
    stop() {
      st.suspended = true; st.phase = "end"; ++playAttempt; clearStall(); unwatch(); clearTimeout(st.holdTimer); clearTimeout(st.loadTimer);
      removeEventListener("keydown", onKey);
      try { v.pause(); v.removeAttribute("src"); v.querySelectorAll("source").forEach((s) => s.remove()); v.load(); } catch {}
      if (wind.ctx) wind.ctx.close().catch(() => {});
    },
  };
}

/* ---------- Запуск ----------
   intro.html: плеер на всей странице.
   index.html: слой <div class="intro-host" hidden> стоит в начале <body> со своей разметкой и стилями в
   Declarative Shadow DOM (<template shadowrootmode="open">, вставляет src/build.py), поэтому стартовый
   экран рисуется сразу, без ожидания скриптов. Показывать ли интро, решает скрипт в <head>
   (src/layout/intro-head.html) до первой отрисовки: ставит <html class="intro-open">, пока слой открыт
   главная скрыта и не нагружает процессор.
   История браузера: открытое интро — отдельная запись. Уход на главную («Открыть сайт», карточка
   «Прокат», «Пропустить», «Сразу на сайт», Esc) добавляет запись, поэтому «Назад» возвращает к спуску
   с того же места. Переход в другой раздел запоминает место спуска в записи истории. */
(function () {
  let host = document.querySelector(".intro-host");
  if (!host) {
    initIntro(document, { close: () => { location.href = "index.html"; }, replay: () => location.reload() });
    return;
  }
  const html = document.documentElement, KEY = "zskiIntro", boot = window.__zskiIntro || {};
  boot.booted = true;
  /* Браузер без Declarative Shadow DOM: собрать теневое дерево из <template> вручную */
  const rootOf = (h) => {
    if (!h.shadowRoot) {
      const t = h.querySelector("template"), r = h.attachShadow({ mode: "open" });
      if (t) { r.appendChild(t.content.cloneNode(true)); t.remove(); }
    }
    return h.shadowRoot;
  };
  const pristine = rootOf(host).innerHTML; // исходная разметка — для «Проехать ещё раз»
  let ctl = null;
  const setState = (extra, push, url) => {
    const s = Object.assign({}, history.state || {}, extra);
    try { push ? history.pushState(s, "", url) : history.replaceState(s, "", url); } catch {}
  };
  const samePage = (href) => {
    const u = new URL(href, location.href), strip = (p) => p.replace(/index\.html$/, "");
    return u.origin === location.origin && strip(u.pathname) === strip(location.pathname) ? u : null;
  };

  /* Запустить плеер в слое; fresh — заново, с чистой разметкой */
  function mount(fresh) {
    if (ctl) ctl.stop();
    if (fresh && ctl) {
      const h = document.createElement("div");
      h.className = host.className; h.setAttribute("role", "dialog"); h.setAttribute("aria-label", host.getAttribute("aria-label"));
      h.attachShadow({ mode: "open" }).innerHTML = pristine;
      host.replaceWith(h); host = h;
    }
    const root = rootOf(host);
    root.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.target.closest(".route-dialog")) return;
      const a = e.target.closest("a[href]"); if (!a) return;
      const u = samePage(a.getAttribute("href"));
      if (u) { e.preventDefault(); hide(true, u.hash); return; }
      setState({ [KEY]: "open", p: ctl.progress() }); // уходим в другой раздел — запомнить место спуска
    }, true);
    ctl = initIntro(root, { close: () => hide(true, ""), replay: () => { mount(true); show(); } });
    host.dataset.ready = "1";
  }
  function show() {
    html.classList.add("intro-open");
    host.hidden = false;
    ctl.wake();
    dispatchEvent(new Event("zski:intro-opened"));
  }
  function hide(push, hash) {
    if (!ctl || host.hidden) return;
    ctl.suspend();
    if (push) setState({ [KEY]: "closed", p: null }, true, hash || location.pathname + location.search);
    host.hidden = true;
    html.classList.remove("intro-open");
    dispatchEvent(new Event("zski:intro-closed"));
    requestAnimationFrame(() => {
      if (hash) { const el = document.getElementById(hash.slice(1)); if (el) el.scrollIntoView({ block: "start" }); }
      else if (push) scrollTo(0, 0);
    });
  }

  addEventListener("popstate", (e) => {
    const s = e.state || {};
    if (s[KEY] === "open") { if (!ctl) { mount(false); ctl.restore(s.p); } show(); }
    else hide(false, "");
  });
  /* Возврат из кэша страниц (bfcache): слой остался как был — продолжить с того же места */
  addEventListener("pageshow", (e) => { if (e.persisted && ctl && !host.hidden) ctl.wake(); });

  /* Кнопка «▶ Спуск к прокату» на первом экране: новый спуск, отдельная запись истории */
  document.querySelectorAll("a[data-intro]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault(); mount(true); show(); setState({ [KEY]: "open", p: null }, true);
  }));

  try {
    if (boot.show && html.classList.contains("intro-open")) {
      mount(false);
      if (boot.restore) ctl.restore(boot.restore);
      show();
      setState({ [KEY]: "open", p: null });
    } else {
      host.hidden = true;
    }
  } catch (err) {
    if (window.__zskiIntroFail) window.__zskiIntroFail(); // что-то пошло не так — сайт важнее интро
    throw err;
  }
})();
