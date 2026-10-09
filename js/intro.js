/* ZSKI — видео-интро. Настройки ниже. */
const CFG = {
  pov: false,                 // true — показывать маску горнолыжных очков (для съёмки от первого лица)
  duration: 15,               // длительность спуска по умолчанию, если видео не сообщило свою
  gatesAt: [0.14, 0.3, 0.46, 0.62, 0.78],   // доли длительности, когда появляются ворота-разделы
  menuAt: 0.93,               // доля длительности, когда появляется меню
  maxSpeed: 68,               // км/ч на счётчике
  startAlt: 220
};
const GATES = [
  { label: "ПРОКАТ",     sub: "лыжи · сноуборды", href: "index.html#prokat", dx: -260 },
  { label: "ЦЕНЫ",       sub: "от 500 ₽ в день",  href: "prices.html",       dx: 240 },
  { label: "SKI-СЕРВИС", sub: "заточка · парафин", href: "service.html",      dx: -220 },
  { label: "СКЛОНЫ",     sub: "Сорочаны · Волен",  href: "slopes.html",       dx: 260 },
  { label: "КОНТАКТЫ",   sub: "61-й км Дмитровки", href: "contacts.html",     dx: 0 },
];

const $ = (s) => document.querySelector(s);
const v = $("#v"), poster = $("#poster"), fade = $("#fade"), title = $("#title"), center = $("#center"),
      speedEl = $("#speed"), altEl = $("#alt"), menu = $("#menu"), hint = $("#hint"), playBtn = $("#play");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (CFG.pov) document.body.classList.add("pov");

const state = { t0: 0, dur: CFG.duration, started: false, done: false, gate: 0, usingVideo: false, fast: false, raf: 0 };

function finish() {
  if (state.done) return; state.done = true;
  hint.style.display = "none"; menu.classList.add("show");
  if (wind.gain) wind.gain.gain.setTargetAtTime(0, wind.ctx.currentTime, 0.4);
}
function spawnGate(i) {
  const g = GATES[i]; const a = document.createElement("a");
  a.className = "gate"; a.href = g.href; a.innerHTML = `${g.label}<small>${g.sub}</small>`;
  a.style.setProperty("--dx", g.dx + "px"); a.style.setProperty("--dur", (state.fast ? 1.4 : 3.4) + "s");
  center.appendChild(a); requestAnimationFrame(() => a.classList.add("fly"));
  a.addEventListener("animationend", () => a.remove());
}
function progress() { return Math.min(1, (state.usingVideo && v.duration ? v.currentTime / v.duration : (performance.now() - state.t0) / 1000 / state.dur) * (state.fast ? 1 : 1)); }
function tick() {
  if (state.done) return;
  let p = progress();
  if (state.fast && !state.usingVideo) p = Math.min(1, p + 0.0 );
  const speedCurve = Math.sin(Math.min(1, p / 0.25) * Math.PI / 2) * (p > 0.88 ? Math.max(0, (1 - p) / 0.12) : 1);
  speedEl.textContent = Math.round(CFG.maxSpeed * speedCurve);
  altEl.textContent = Math.max(0, Math.round(CFG.startAlt * (1 - p)));
  while (state.gate < CFG.gatesAt.length && p >= CFG.gatesAt[state.gate]) { spawnGate(state.gate); state.gate++; }
  if (wind.gain) { wind.gain.gain.setTargetAtTime(0.45 * speedCurve, wind.ctx.currentTime, 0.2); wind.filter.frequency.setTargetAtTime(160 + 900 * speedCurve, wind.ctx.currentTime, 0.2); }
  if (p >= CFG.menuAt) finish(); else state.raf = requestAnimationFrame(tick);
}
function start() {
  if (state.started) return; state.started = true; state.t0 = performance.now();
  setTimeout(() => title.classList.remove("show"), 3600);
  tick();
}

/* Видео: пробуем автозапуск; если браузер запретил — кнопка «Поехали»; если файла нет — спуск по таймеру на фото */
v.addEventListener("playing", () => { state.usingVideo = true; v.classList.add("on"); start(); }, { once: true });
v.addEventListener("ended", finish);
v.addEventListener("error", () => { state.usingVideo = false; start(); }, { once: true });
v.addEventListener("loadedmetadata", () => { if (isFinite(v.duration) && v.duration > 3) state.dur = v.duration; });
function tryPlay() {
  const pr = v.play();
  if (pr && pr.catch) pr.catch(() => { if (!state.started) { playBtn.classList.add("show"); } });
}
playBtn.addEventListener("click", () => { playBtn.classList.remove("show"); startWind(); tryPlay(); setTimeout(() => { if (!state.started) start(); }, 800); });
if (v.networkState !== HTMLMediaElement.NETWORK_NO_SOURCE) tryPlay();
setTimeout(() => { if (!state.started && !playBtn.classList.contains("show")) start(); }, 2500); // источник не загрузился — едем по фото
if (reduce) { setTimeout(finish, 300); }

/* Старт титров */
requestAnimationFrame(() => { fade.classList.add("out"); title.classList.add("show"); setTimeout(() => fade.remove(), 1500); });

/* Клик по кадру — ускорить, Esc — на сайт */
addEventListener("click", (e) => { if (!state.done && state.started && !e.target.closest("a,button")) { state.fast = true; if (state.usingVideo) v.playbackRate = 2.2; else state.t0 -= state.dur * 400; } });
addEventListener("keydown", (e) => { if (e.key === "Escape") location.href = "index.html"; });
$("#replay").addEventListener("click", () => location.reload());

/* Ветер (включается первым кликом) */
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
    const b = $("#mute"); b.hidden = false; b.addEventListener("click", () => { wind.muted = !wind.muted; ctx[wind.muted ? "suspend" : "resume"](); b.textContent = wind.muted ? "🔇" : "🔊"; });
  } catch {}
}
["pointerdown", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, startWind, { once: true, passive: true }));
