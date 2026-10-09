/* ZSKI — 3D-интро: спуск от первого лица к прокату. three.js r160 (локально, js/vendor). */
import * as THREE from "./vendor/three.module.min.js";

const $ = (s) => document.querySelector(s);
const canvas = $("#scene"), fade = $("#fade"), title = $("#title"), flash = $("#flash"),
      speedEl = $("#speed"), altEl = $("#alt"), menu = $("#menu"), hint = $("#hint");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = innerWidth < 760;

/* ---------- Без WebGL — сразу на сайт ---------- */
function hasWebGL() { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } }
if (!hasWebGL()) location.replace("index.html");

/* ---------- Разделы (ворота на трассе) ---------- */
const GATES = [
  { z: -110, label: "ПРОКАТ",     sub: "лыжи · сноуборды", href: "index.html#prokat" },
  { z: -230, label: "ЦЕНЫ",       sub: "от 500 ₽ в день",  href: "prices.html" },
  { z: -350, label: "SKI-СЕРВИС", sub: "заточка · парафин", href: "service.html" },
  { z: -470, label: "СКЛОНЫ",     sub: "Сорочаны · Волен",  href: "slopes.html" },
  { z: -590, label: "КОНТАКТЫ",   sub: "61-й км Дмитровки", href: "contacts.html" },
];
const Z_END = -700;

/* ---------- Рендерер и сцена ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1 : 1.25));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3cdb8);
scene.fog = new THREE.Fog(0xf6d6c6, 60, 330);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.05, 700);

scene.add(new THREE.HemisphereLight(0xffe2cc, 0x6d8fc4, 0.95));
const SUN_DIR = new THREE.Vector3(0.55, 0.22, -0.8).normalize();
const fill = new THREE.PointLight(0xffd9c0, 0.9, 4); fill.position.set(0, -0.2, -0.6); camera.add(fill);
const sun = new THREE.DirectionalLight(0xffb070, 2.2); sun.position.copy(SUN_DIR).multiplyScalar(200); scene.add(sun);

/* Небо: большой градиентный купол */
{
  const g = new THREE.SphereGeometry(650, 24, 12);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x27508f) }, mid: { value: new THREE.Color(0xc98fb0) }, bottom: { value: new THREE.Color(0xffc08c) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.5+0.12, 0.0, 1.0); vec3 c = h < 0.35 ? mix(bottom, mid, h/0.35) : mix(mid, top, (h-0.35)/0.65); gl_FragColor = vec4(c, 1.0); }`
  });
  const sky = new THREE.Mesh(g, m); scene.add(sky); scene.userData.sky = sky;
}

/* ---------- Рельеф ---------- */
const SLOPE = 0.27;
function height(x, z) {
  let y = z * SLOPE;
  const piste = Math.exp(-(x * x) / (2 * 20 * 20));
  const n = Math.sin(x * 0.07) * Math.cos(z * 0.045) * 2.6 + Math.sin(x * 0.19 + z * 0.12) * 0.9 + Math.cos(z * 0.33 + x * 0.05) * 0.35;
  y += n * (1 - 0.88 * piste);
  y += Math.sin(x * 1.4) * Math.sin(z * 1.1) * 0.05;
  return y;
}
{
  const W = 520, L = 1500, SX = isMobile ? 90 : 150, SZ = isMobile ? 260 : 420;
  const g = new THREE.PlaneGeometry(W, L, SX, SZ);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const cPiste = new THREE.Color(0xfff3ea), cSnow = new THREE.Color(0xc6d6ee), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i) - 450;
    pos.setZ(i, z); pos.setY(i, height(x, z));
    const piste = Math.exp(-(x * x) / (2 * 20 * 20));
    tmp.copy(cSnow).lerp(cPiste, piste);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })));
}

/* ---------- Ёлки и вешки ---------- */
{
  const N = isMobile ? 260 : 620;
  const tree = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 9, 7), new THREE.MeshStandardMaterial({ color: 0x163a30, roughness: 1 }), N);
  const snowcap = new THREE.InstancedMesh(new THREE.ConeGeometry(1.3, 3.2, 7), new THREE.MeshStandardMaterial({ color: 0xffe9dc, roughness: 1 }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1, x = side * (30 + Math.random() * 180), z = 60 - Math.random() * 1200;
    const k = 0.7 + Math.random() * 0.9;
    p.set(x, height(x, z) + 4 * k, z); s.set(k, k, k); m.compose(p, q, s); tree.setMatrixAt(i, m);
    p.y += 3.4 * k; m.compose(p, q, s); snowcap.setMatrixAt(i, m);
  }
  scene.add(tree, snowcap);
  const NP = 90;
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0xff7a1a }), NP * 2);
  for (let i = 0; i < NP; i++) for (const side of [-1, 1]) {
    const x = side * 21, z = 40 - i * 12; p.set(x, height(x, z) + 1.1, z); s.set(1, 1, 1); m.compose(p, q, s);
    poles.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m);
  }
  scene.add(poles);
}


/* ---------- Кресельный подъёмник справа (инстансы — 6 вызовов отрисовки) ---------- */
{
  const X = 44, steel = new THREE.MeshStandardMaterial({ color: 0x8b95a3, metalness: 0.6, roughness: 0.5 }), chairM = new THREE.MeshStandardMaterial({ color: 0x1c2733 });
  const zs = []; for (let z = 80; z > -820; z -= 70) zs.push(z);
  const pylons = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.5, 16, 8), steel, zs.length), bars = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 0.3, 0.3), steel, zs.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = [], down = [];
  zs.forEach((z, i) => { const y = height(X, z); p.set(X, y + 8, z); m.compose(p, q, one); pylons.setMatrixAt(i, m); p.set(X, y + 15.6, z); m.compose(p, q, one); bars.setMatrixAt(i, m); up.push(new THREE.Vector3(X - 2.6, y + 15.4, z)); down.push(new THREE.Vector3(X + 2.6, y + 15.4, z)); });
  scene.add(pylons, bars);
  for (const line of [up, down]) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), new THREE.LineBasicMaterial({ color: 0x33404f })));
  const NC = (zs.length - 1) * 2 * 2;
  const hangs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), steel, NC), chairs = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.9, 0.6), chairM, NC);
  let k = 0;
  for (const line of [up, down]) for (let i = 0; i < line.length - 1; i++) for (const f of [0.2, 0.6]) {
    const a = line[i], b = line[i + 1]; p.set(a.x, a.y + (b.y - a.y) * f - 1.2, a.z + (b.z - a.z) * f); m.compose(p, q, one); hangs.setMatrixAt(k, m);
    p.y -= 1.4; m.compose(p, q, one); chairs.setMatrixAt(k, m); k++;
  }
  scene.add(hangs, chairs);
}

/* ---------- Ворота-разделы ---------- */
function labelTexture(text, sub, w = 1200, h = 300) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
  const r = 60; x.fillStyle = "rgba(10,16,28,.92)"; x.beginPath(); x.roundRect(8, 8, w - 16, h - 16, r); x.fill();
  x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 6; x.stroke();
  x.fillStyle = "#e3241b"; x.fillRect(60, 70, 14, h - 140);
  const fit = (str, weight, fam, max, px) => { let f = px; do { x.font = `${weight} ${f}px ${fam}`; if (x.measureText(str).width <= max) break; f -= 4; } while (f > 24); };
  x.fillStyle = "#fff"; x.textBaseline = "middle"; fit(text, 800, "Unbounded, Manrope, sans-serif", w - 180, 118); x.fillText(text, 110, h / 2 - 28);
  x.fillStyle = "#ffd3b0"; fit(sub, 700, "Manrope, sans-serif", w - 190, 52); x.fillText(sub, 114, h / 2 + 78);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const gateSprites = [];
{
  const poleG = new THREE.CylinderGeometry(0.09, 0.09, 4.2, 8), red = new THREE.MeshStandardMaterial({ color: 0xe3241b }), blue = new THREE.MeshStandardMaterial({ color: 0x1c7fd1 });
  const flagG = new THREE.PlaneGeometry(1.6, 1.0);
  GATES.forEach((g) => {
    const grp = new THREE.Group(); grp.position.z = g.z;
    for (const side of [-1, 1]) {
      const x = side * 9, y = height(x, g.z);
      const pole = new THREE.Mesh(poleG, side < 0 ? red : blue); pole.position.set(x, y + 2.1, 0); grp.add(pole);
      const flag = new THREE.Mesh(flagG, new THREE.MeshStandardMaterial({ color: side < 0 ? 0xe3241b : 0x1c7fd1, side: THREE.DoubleSide })); flag.position.set(x + side * 0.85, y + 3.6, 0); grp.add(flag);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(g.label, g.sub), transparent: true, depthTest: false }));
    sp.scale.set(18, 4.5, 1); sp.position.set(0, height(0, g.z) + 7.2, 0); sp.userData = g; sp.renderOrder = 5; grp.add(sp); gateSprites.push(sp);
    scene.add(grp);
  });
  /* Финиш: арка и логотип */
  const fy = height(0, Z_END);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(12, 0.5, 10, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe3241b })); arch.position.set(0, fy + 0.5, Z_END - 18); scene.add(arch);
  const banner = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture("ZSKI · ПРОКАТ", "61-й км Дмитровского шоссе · Яхрома"), transparent: true })); banner.scale.set(28, 7, 1); banner.position.set(0, fy + 14, Z_END - 18); scene.add(banner);
  new THREE.TextureLoader().load("img/logo.png", (t) => { t.colorSpace = THREE.SRGBColorSpace; const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true })); l.scale.set(9, 9, 1); l.position.set(0, fy + 22, Z_END - 18); scene.add(l); });
}

/* ---------- Рига от первого лица: лыжи и руки с палками ---------- */
const rig = new THREE.Group(); camera.add(rig); scene.add(camera);
const arms = [];
{
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.4, metalness: 0.1 }), red = new THREE.MeshStandardMaterial({ color: 0xe3241b, roughness: 0.5 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0xd8261c, roughness: 0.8 }), glove = new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.85 }), steel = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.5, metalness: 0.5 });
  const UP = new THREE.Vector3(0, 1, 0);
  const capsuleBetween = (from, to, r, mat) => {
    const dir = new THREE.Vector3().subVectors(to, from), len = dir.length();
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 6, 12), mat);
    m.position.copy(from).add(to).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, dir.normalize()); return m;
  };
  for (const side of [-1, 1]) {
    /* лыжа */
    const ski = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 2.3), white); body.position.z = -0.9; ski.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.024, 0.6), red); stripe.position.z = -1.2; ski.add(stripe);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 0.36), white); tip.position.set(0, 0.045, -2.19); tip.rotation.x = -0.38; ski.add(tip);
    ski.position.set(side * 0.17, -0.66, -0.55); ski.rotation.y = side * 0.03; ski.userData.side = side; rig.add(ski);

    /* рука: локоть за кадром снизу, предплечье в рукаве, кулак на рукоятке */
    const arm = new THREE.Group(); arm.userData.side = side;
    const elbow = new THREE.Vector3(side * 0.36, -0.58, 0.12), fist = new THREE.Vector3(0, 0, 0);
    const sleeve = capsuleBetween(elbow, new THREE.Vector3(side * 0.03, -0.03, 0.06), 0.062, jacket); arm.add(sleeve);
    const cuff = capsuleBetween(new THREE.Vector3(side * 0.07, -0.08, 0.17), new THREE.Vector3(side * 0.02, -0.02, 0.05), 0.064, glove); arm.add(cuff);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), glove); palm.scale.set(1.0, 0.8, 1.3); palm.position.copy(fist); arm.add(palm);
    /* пальцы обхватывают рукоятку спереди-снизу, большой палец сверху */
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.04, 4, 8), glove);
      f.position.set(side * (-0.036 + i * 0.024), -0.028 - i * 0.004, -0.05); f.rotation.z = side * 0.35; f.rotation.x = 0.5; arm.add(f);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.04, 4, 8), glove); thumb.position.set(side * -0.04, 0.025, -0.045); thumb.rotation.z = side * 1.35; thumb.rotation.x = 1.1; arm.add(thumb);
    /* палка: рукоятка в кулаке, древко вперёд-вниз, кольцо на конце */
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.2, 10), steel); grip.position.set(0, 0.0, -0.01); grip.rotation.x = 0.35; arm.add(grip);
    const shaftDir = new THREE.Vector3(side * 0.12, -0.5, -0.86).normalize();
    const shaft = capsuleBetween(new THREE.Vector3(0, -0.08, -0.03), shaftDir.clone().multiplyScalar(1.45).add(new THREE.Vector3(0, -0.08, -0.03)), 0.012, steel); arm.add(shaft);
    const basket = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.011, 6, 14), red); basket.position.copy(shaftDir).multiplyScalar(1.4).add(new THREE.Vector3(0, -0.08, -0.03)); basket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), shaftDir); arm.add(basket);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 16), red); strap.position.set(side * 0.02, -0.02, 0.07); strap.rotation.x = Math.PI / 2; arm.add(strap);
    arm.position.set(side * 0.42, -0.33, -0.78); arm.userData.base = arm.position.clone(); rig.add(arm); arms.push(arm);
  }
}
function fitRig() { const k = Math.min(1, Math.max(0.55, camera.aspect / 1.6)); arms.forEach((a) => { a.position.x = a.userData.base.x * k; a.position.y = a.userData.base.y - (1 - k) * 0.06; }); }

/* ---------- Снег в воздухе ---------- */
const snow = (() => {
  const N = isMobile ? 500 : 1400, a = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { a[i * 3] = (Math.random() - 0.5) * 50; a[i * 3 + 1] = Math.random() * 24 - 6; a[i * 3 + 2] = -Math.random() * 70; }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3));
  const fc = document.createElement("canvas"); fc.width = fc.height = 64; const fx = fc.getContext("2d"); const gr = fx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); fx.fillStyle = gr; fx.fillRect(0, 0, 64, 64);
  const ft = new THREE.CanvasTexture(fc);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: ft, color: 0xffffff, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false, alphaTest: 0.05 }));
  const holder = new THREE.Group(); holder.add(pts); scene.add(holder); return { holder, pts, N };
})();


/* ---------- Солнце и блик ---------- */
const flare = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d");
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, "rgba(255,240,220,1)"); g.addColorStop(0.12, "rgba(255,200,150,.9)"); g.addColorStop(0.4, "rgba(255,160,110,.25)"); g.addColorStop(1, "rgba(255,140,90,0)");
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 }));
  sp.scale.set(140, 140, 1); sp.renderOrder = 9; scene.add(sp); return sp;
})();

/* ---------- Снежная пыль из-под лыж ---------- */
const spray = (() => {
  const N = 320, a = new Float32Array(N * 3), v = new Float32Array(N * 3), life = new Float32Array(N);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3));
  const c = document.createElement("canvas"); c.width = c.height = 32; const x = c.getContext("2d"); const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.5, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const m = new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), color: 0xffffff, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false, depthTest: false });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; camera.add(pts); return { pts, a, v, life, N, next: 0 };
})();

/* ---------- Состояние заезда ---------- */
const state = { t: 0, z: 40, x: 0, speed: 0, phase: "intro", steer: 0, fast: false, gateIdx: 0, done: false };
const clock = new THREE.Clock();
let pointerX = 0;
addEventListener("pointermove", (e) => (pointerX = (e.clientX / innerWidth - 0.5) * 2));
addEventListener("click", (e) => { if (state.phase === "ride" && !e.target.closest("a,button")) state.fast = true; });
addEventListener("keydown", (e) => { if (e.key === "Escape") location.href = "index.html"; if (e.key === " " || e.key === "Enter") state.fast = true; });
$("#replay").addEventListener("click", () => location.reload());


/* ---------- Ветер (WebAudio, включается первым кликом) ---------- */
const wind = {};
function startWind() {
  if (wind.ctx || reduce) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 300; filter.Q.value = 0.7;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(ctx.destination); src.start();
    wind.ctx = ctx; wind.filter = filter; wind.gain = gain;
    const b = document.getElementById("mute"); if (b) { b.hidden = false; b.addEventListener("click", () => { wind.muted = !wind.muted; wind.ctx[wind.muted ? "suspend" : "resume"](); b.textContent = wind.muted ? "🔇" : "🔊"; }); }
  } catch {}
}
["pointerdown", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, startWind, { once: true, passive: true }));

/* Клик по воротам — переход в раздел */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener("click", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(gateSprites, false)[0]; if (hit) location.href = hit.object.userData.href;
});

function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); fitRig(); }
addEventListener("resize", resize); resize();

function showFlash(text, sub) { flash.innerHTML = `${text}<small>${sub || ""}</small>`; flash.classList.add("show"); clearTimeout(showFlash.t); showFlash.t = setTimeout(() => flash.classList.remove("show"), 1100); }
function finish() {
  if (state.done) return; state.done = true; state.phase = "finish";
  hint.style.display = "none"; menu.classList.add("show");
}

/* Старт */
requestAnimationFrame(() => { fade.classList.add("out"); title.classList.add("show"); setTimeout(() => fade.remove(), 1500); });
setTimeout(() => { if (state.phase === "intro") { state.phase = "ride"; } }, reduce ? 0 : 3200);
setTimeout(() => title.classList.remove("show"), 4200);
if (reduce) { state.z = Z_END + 30; state.phase = "ride"; }

/* ---------- Адаптивное качество: если кадры идут медленно, снижаем разрешение ---------- */
const perf = { frames: 0, acc: 0, steps: 0 };
function degrade() {
  perf.steps++;
  const pr = Math.max(0.6, renderer.getPixelRatio() * 0.75); renderer.setPixelRatio(pr); resize();
  if (perf.steps >= 2) { scene.fog.far = 230; snow.pts.geometry.setDrawRange(0, Math.floor(snow.N / 2)); spray.pts.visible = false; }
}

/* ---------- Кадр ---------- */
const look = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
function frame() {
  const dt = Math.min(clock.getDelta(), 0.08); state.t += dt;
  const t = state.t;

  /* скорость и движение */
  if (state.phase === "ride") {
    const target = state.fast ? 110 : 46;
    const remaining = state.z - Z_END;
    const brake = remaining < 80 ? Math.max(0, remaining / 80) : 1;
    const want = Math.max(0, Math.min(target, target * brake + 2 * brake));
    state.speed += (want - state.speed) * Math.min(1, dt * (state.fast ? 2.2 : 0.9));
    if (remaining <= 1.2) { state.speed = 0; finish(); }
  } else if (state.phase === "finish") state.speed = 0;
  state.z -= state.speed * dt;

  /* траектория: карвинг + руление мышью */
  const carve = Math.sin(t * 0.55) * 6.5 + Math.sin(t * 1.45) * 1.6;
  state.steer += (pointerX * 4.5 - state.steer) * Math.min(1, dt * 2);
  const xTarget = state.phase === "finish" ? 0 : carve + state.steer;
  state.x += (xTarget - state.x) * Math.min(1, dt * 2.5);
  const dx = (xTarget - state.x);

  const bob = Math.sin(t * 9.5) * 0.02 * Math.min(1, state.speed / 30) + Math.sin(t * 2.1) * 0.01;
  const y = height(state.x, state.z) + 1.55 + bob;
  camera.position.set(state.x, y, state.z);
  const aheadZ = state.z - 18, aheadX = state.x + dx * 1.4;
  if (state.phase === "finish") look.set(0, height(0, Z_END - 18) + 11, Z_END - 18);
  else if (state.phase === "intro") { const k = Math.min(1, t / 3.2), e = 1 - Math.pow(1 - k, 3), yaw = -0.85 + 0.85 * e; look.set(state.x + Math.sin(yaw) * 20, height(state.x, state.z) + 1.9 - 0.8 * e, state.z - Math.cos(yaw) * 20); }
  else look.set(aheadX, height(aheadX, aheadZ) + 1.2 - state.speed * 0.012, aheadZ);
  camera.up.copy(up); camera.lookAt(look);
  camera.rotation.z += -dx * 0.045 - Math.sin(t * 0.55) * 0.035 * Math.min(1, state.speed / 40);
  camera.fov = 72 + state.speed * 0.16; camera.updateProjectionMatrix();

  /* рига: лыжи дрожат, руки работают палками, в повороте внутренняя рука уходит вперёд */
  const sf = Math.min(1, state.speed / 45);
  rig.children.forEach((o) => {
    const s = o.userData.side;
    if (o.userData.base) { /* рука */
      const plant = Math.max(0, -dx * s) * 0.12;
      o.rotation.x = Math.sin(t * 1.7 + s * 1.5) * 0.08 * sf - plant * 0.6; o.rotation.z = s * 0.05 + dx * 0.02;
      o.position.z = o.userData.base.z - plant - Math.sin(t * 1.7 + s * 1.5) * 0.03 * sf; o.position.y = o.userData.base.y - (1 - Math.min(1, camera.aspect / 1.6)) * 0.06 + Math.sin(t * 9.5 + s) * 0.006 * sf;
    } else { /* лыжа */
      o.rotation.x = Math.sin(t * 11 + s) * 0.012 * sf; o.position.y = -0.66 + Math.sin(t * 13 + s * 2) * 0.006 * sf; o.rotation.z = s * 0.02 + dx * 0.01;
    }
  });

  /* снег: держим у камеры, несём навстречу */
  snow.holder.position.copy(camera.position); snow.holder.quaternion.copy(camera.quaternion);
  const a = snow.pts.geometry.attributes.position.array;
  for (let i = 0; i < snow.N; i++) {
    a[i * 3 + 1] -= dt * 3.2; a[i * 3 + 2] += dt * (3 + state.speed * 0.95);
    if (a[i * 3 + 2] > 2) { a[i * 3 + 2] -= 70; a[i * 3] = (Math.random() - 0.5) * 50; }
    if (a[i * 3 + 1] < -8) a[i * 3 + 1] += 26;
  }
  snow.pts.geometry.attributes.position.needsUpdate = true;
  scene.userData.sky.position.copy(camera.position);

  /* ворота: вспышка названия раздела при проезде */
  if (state.gateIdx < GATES.length && state.z < GATES[state.gateIdx].z + 6) { showFlash(GATES[state.gateIdx].label, GATES[state.gateIdx].sub); state.gateIdx++; }


  /* блик солнца держим на направлении SUN_DIR */
  flare.position.copy(camera.position).addScaledVector(SUN_DIR, 400);

  /* снежная пыль: сильнее в поворотах и на скорости */
  {
    const rate = Math.min(1, state.speed / 40) * (0.35 + Math.min(1.2, Math.abs(dx) * 0.9));
    const emit = Math.round(rate * 7);
    for (let k = 0; k < emit; k++) {
      const i = spray.next; spray.next = (spray.next + 1) % spray.N; const side = k % 2 ? 1 : -1;
      spray.a[i * 3] = side * 0.22 + (Math.random() - 0.5) * 0.06; spray.a[i * 3 + 1] = -0.7; spray.a[i * 3 + 2] = -0.9 - Math.random() * 0.8;
      spray.v[i * 3] = side * (0.5 + Math.random() * 0.9) + dx * 0.35; spray.v[i * 3 + 1] = 0.35 + Math.random() * 0.9; spray.v[i * 3 + 2] = 1.2 + Math.random() * 2.0; spray.life[i] = 0.35 + Math.random() * 0.35;
    }
    for (let i = 0; i < spray.N; i++) {
      if (spray.life[i] <= 0) { spray.a[i * 3 + 1] = -50; continue; }
      spray.life[i] -= dt; spray.v[i * 3 + 1] -= 3.2 * dt;
      spray.a[i * 3] += spray.v[i * 3] * dt; spray.a[i * 3 + 1] += spray.v[i * 3 + 1] * dt; spray.a[i * 3 + 2] += spray.v[i * 3 + 2] * dt;
    }
    spray.pts.geometry.attributes.position.needsUpdate = true;
  }

  /* ветер: громче и выше по тону на скорости */
  if (wind.gain) { wind.gain.gain.setTargetAtTime(Math.min(0.5, state.speed / 110), wind.ctx.currentTime, 0.2); wind.filter.frequency.setTargetAtTime(180 + state.speed * 22, wind.ctx.currentTime, 0.2); }

  if (state.phase === "ride" && perf.steps < 3) { perf.frames++; perf.acc += dt; if (perf.acc > 1.5) { if (perf.frames / perf.acc < 40) degrade(); perf.frames = 0; perf.acc = 0; } }

  /* HUD */
  speedEl.textContent = Math.round(state.speed * 1.35);
  altEl.textContent = Math.max(0, Math.round(220 * (state.z - Z_END) / (40 - Z_END)));

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
