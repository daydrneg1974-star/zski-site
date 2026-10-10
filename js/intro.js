/* ZSKI — видео-интро «станции»: лыжник плавно тормозит, кадр замирает, появляется кликабельная карточка раздела. */
const CFG = {
  pov: false,
  duration: 15,            // если видео не сообщило длительность
  stations: [0.14, 0.27, 0.40, 0.53, 0.66],   // доли длительности видео (11 с): последняя остановка ≈7.3 с, дальше ≈3.5 с спуска до финала
  slowBefore: 0.9,         // за сколько секунд до станции начинаем тормозить
  minRate: 0.3,            // минимальная скорость перед остановкой
  hold: 2300,              // пауза на станции, мс
  maxSpeed: 68,
  startAlt: 220,
};
const STATIONS = [
  { n: "01", label: "Прокат",     sub: "Лыжи и сноуборды известных брендов",     href: "index.html#prokat", side: "right" },
  { n: "02", label: "Цены",       sub: "От 500 ₽ в день, калькулятор комплекта",  href: "prices.html",       side: "left" },
  { n: "03", label: "SKI-сервис", sub: "Заточка, парафин, ремонт, хранение",      href: "service.html",      side: "right" },
  { n: "04", label: "Склоны",     sub: "Сорочаны, Волен, Степаново, «Яхрома»",    href: "slopes.html",       side: "left" },
  { n: "05", label: "Контакты",   sub: "61-й км Дмитровского шоссе, карта, график", href: "contacts.html",   side: "right" },
];

const $ = (s) => document.querySelector(s);
const v = $("#v"), fade = $("#fade"), title = $("#title"), center = $("#center"),
      speedEl = $("#speed"), altEl = $("#alt"), menu = $("#menu"), hint = $("#hint"), startScreen = $("#start"), goBtn = $("#go"), stage = $(".stage");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (CFG.pov) document.body.classList.add("pov");

const st = { started: false, done: false, usingVideo: false, rate: 1, target: 1, idx: 0, holding: false, t0: 0, dur: CFG.duration, raf: 0, fakeT: 0, card: null, holdTimer: 0 };

/* ---------- Карточка станции ---------- */
function showCard(i) {
  const s = STATIONS[i];
  const a = document.createElement("a");
  a.className = `station ${s.side}`; a.href = s.href;
  a.innerHTML = `<span class="num">${s.n}</span><span class="name">${s.label}</span><span class="sub">${s.sub}</span><span class="go">Перейти <i>→</i></span>`;
  center.appendChild(a); setTimeout(() => a.classList.add("in"), 120);
  st.card = a; stage.classList.add("hold");
}
function hideCard() {
  const a = st.card; if (!a) return; st.card = null; stage.classList.remove("hold");
  a.classList.remove("in"); a.classList.add("out"); setTimeout(() => a.remove(), 600);
}
function finish() {
  if (st.done) return; st.done = true; hideCard();
  hint.style.display = "none"; menu.classList.add("show");
  if (wind.gain) wind.gain.gain.setTargetAtTime(0, wind.ctx.currentTime, 0.4);
}

/* ---------- Время: видео или таймер на фото ---------- */
const now = () => (st.usingVideo ? v.currentTime : st.fakeT);
const total = () => (st.usingVideo && isFinite(v.duration) && v.duration > 1 ? v.duration : st.dur);

function arrive(i) {
  st.holding = true; st.rate = 0; if (st.usingVideo) v.pause(); title.classList.remove("show");
  showCard(i);
  st.holdTimer = setTimeout(resume, CFG.hold);
}
function resume() {
  if (!st.holding) return; st.holding = false; clearTimeout(st.holdTimer);
  hideCard(); st.idx++; st.target = 1;
  if (st.usingVideo) { v.play().catch(() => {}); }
}

let last = performance.now();
function loop(ts) {
  if (st.done) return;
  const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
  const T = total(), t = now();
  if (!st.holding) {
    /* торможение перед станцией */
    const next = st.idx < STATIONS.length ? CFG.stations[st.idx] * T : Infinity;
    const toNext = next - t;
    if (toNext <= 0.02) { arrive(st.idx); }
    else {
      st.target = toNext < CFG.slowBefore ? Math.max(CFG.minRate, toNext / CFG.slowBefore) : 1;
      st.rate += (st.target - st.rate) * Math.min(1, dt * 6);
      if (st.usingVideo) { try { v.playbackRate = Math.max(0.1, st.rate); } catch {} }
      else st.fakeT += dt * st.rate;
    }
  }
  const p = Math.min(1, t / T);
  speedEl.textContent = Math.round(CFG.maxSpeed * (st.holding ? 0 : Math.min(1, st.rate) * Math.min(1, p / 0.12 + 0.2)));
  altEl.textContent = Math.max(0, Math.round(CFG.startAlt * (1 - p)));
  if (wind.gain) { const k = st.holding ? 0 : st.rate; wind.gain.gain.setTargetAtTime(0.4 * k, wind.ctx.currentTime, 0.25); wind.filter.frequency.setTargetAtTime(160 + 800 * k, wind.ctx.currentTime, 0.25); }
  if (!st.usingVideo && p >= 0.995 && st.idx >= STATIONS.length) finish();
  st.raf = requestAnimationFrame(loop);
}
function start() {
  if (st.started) return; st.started = true; last = performance.now();
  setTimeout(() => title.classList.remove("show"), 2200);
  requestAnimationFrame(loop);
}

/* ---------- Видео ---------- */
v.addEventListener("playing", () => { if (!st.started) { st.usingVideo = true; v.classList.add("on"); start(); } }, { once: true });
v.addEventListener("ended", () => { if (st.idx >= STATIONS.length) finish(); else { arrive(st.idx); st.holdTimer = setTimeout(() => { hideCard(); finish(); }, CFG.hold + 600); } });
v.addEventListener("error", () => { if (!st.started) { st.usingVideo = false; start(); } }, { once: true });
function tryPlay() { const pr = v.play(); if (pr && pr.catch) pr.catch(() => { setTimeout(() => { if (!st.started) start(); }, 300); }); }
/* Старт только по кнопке: клик — это жест пользователя, поэтому и видео, и ветер стартуют сразу со звуком */
goBtn.addEventListener("click", () => {
  startScreen.classList.add("off");
  startWind(); wind.resumeOnGesture && wind.resumeOnGesture();
  if (reduce) { finish(); return; }
  title.classList.add("show");
  if (v.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE) tryPlay(); else start();
  setTimeout(() => { if (!st.started) start(); }, 2500);
});
v.load();
requestAnimationFrame(() => { fade.classList.add("out"); setTimeout(() => fade.remove(), 1500); });

/* Клик мимо карточки во время остановки — едем дальше; Esc — на сайт */
addEventListener("click", (e) => { if (e.target.closest("a,button")) return; if (st.holding) resume(); });
addEventListener("keydown", (e) => { if (e.key === "Escape") location.href = "index.html"; if ((e.key === " " || e.key === "Enter") && st.holding) resume(); });
$("#replay").addEventListener("click", () => location.reload());

/* ---------- Ветер (после первого клика) ---------- */
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
    const sync = () => { const on = ctx.state === "running" && !wind.muted; b.textContent = on ? "🔊" : "🔇 Включить звук"; b.classList.toggle("attn", !on); };
    b.addEventListener("click", (e) => { e.stopPropagation(); if (ctx.state !== "running") { wind.muted = false; ctx.resume().then(sync); } else { wind.muted = !wind.muted; ctx[wind.muted ? "suspend" : "resume"]().then(sync); } });
    ctx.addEventListener("statechange", sync);
    if (ctx.state !== "running") ctx.resume().catch(() => {}); setTimeout(sync, 300);
    wind.resumeOnGesture = () => { if (ctx.state !== "running" && !wind.muted) ctx.resume().then(sync); };
  } catch {}
}
/* Если контекст звука был приостановлен браузером — возобновляем при любом жесте после старта */
["pointerdown", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, () => { if (startScreen.classList.contains("off")) { startWind(); wind.resumeOnGesture && wind.resumeOnGesture(); } }, { passive: true }));
