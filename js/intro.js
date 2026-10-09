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
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1 : 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa9d3f5);
scene.fog = new THREE.Fog(0xdceeff, 50, 300);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.05, 700);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8fb3d9, 1.15));
const sun = new THREE.DirectionalLight(0xfff1dc, 1.7); sun.position.set(80, 90, -60); scene.add(sun);

/* Небо: большой градиентный купол */
{
  const g = new THREE.SphereGeometry(650, 24, 12);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x3f8fe0) }, bottom: { value: new THREE.Color(0xdceeff) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.15, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.8)), 1.0); }`
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
  const cPiste = new THREE.Color(0xf7fbff), cSnow = new THREE.Color(0xd6e6f7), tmp = new THREE.Color();
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
  const tree = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 9, 7), new THREE.MeshStandardMaterial({ color: 0x1e4a2d, roughness: 1 }), N);
  const snowcap = new THREE.InstancedMesh(new THREE.ConeGeometry(1.3, 3.2, 7), new THREE.MeshStandardMaterial({ color: 0xf2f7ff, roughness: 1 }), N);
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


/* ---------- Кресельный подъёмник справа ---------- */
{
  const X = 44, steel = new THREE.MeshStandardMaterial({ color: 0x8b95a3, metalness: 0.6, roughness: 0.5 }), chairM = new THREE.MeshStandardMaterial({ color: 0x1c2733 });
  const pylonG = new THREE.CylinderGeometry(0.35, 0.5, 16, 8), barG = new THREE.BoxGeometry(6, 0.3, 0.3);
  const pts = [];
  for (let z = 80; z > -820; z -= 70) {
    const y = height(X, z);
    const py = new THREE.Mesh(pylonG, steel); py.position.set(X, y + 8, z); scene.add(py);
    const bar = new THREE.Mesh(barG, steel); bar.position.set(X, y + 15.6, z); scene.add(bar);
    pts.push(new THREE.Vector3(X - 2.6, y + 15.4, z), new THREE.Vector3(X + 2.6, y + 15.4, z));
  }
  const up = [], down = [];
  for (let i = 0; i < pts.length; i += 2) { up.push(pts[i]); down.push(pts[i + 1]); }
  for (const line of [up, down]) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), new THREE.LineBasicMaterial({ color: 0x33404f })));
  const chairG = new THREE.BoxGeometry(1.4, 0.9, 0.6), hangG = new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5);
  for (const line of [up, down]) for (let i = 0; i < line.length - 1; i++) for (let k = 0.2; k < 1; k += 0.4) {
    const a = line[i], b = line[i + 1], px = a.x, py = a.y + (b.y - a.y) * k, pz = a.z + (b.z - a.z) * k;
    const hang = new THREE.Mesh(hangG, steel); hang.position.set(px, py - 1.2, pz); scene.add(hang);
    const chair = new THREE.Mesh(chairG, chairM); chair.position.set(px, py - 2.6, pz); scene.add(chair);
  }
}

/* ---------- Ворота-разделы ---------- */
function labelTexture(text, sub, w = 1024, h = 300) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
  const r = 60; x.fillStyle = "rgba(10,16,28,.92)"; x.beginPath(); x.roundRect(8, 8, w - 16, h - 16, r); x.fill();
  x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 6; x.stroke();
  x.fillStyle = "#e3241b"; x.fillRect(60, 70, 14, h - 140);
  x.fillStyle = "#fff"; x.font = "800 118px Unbounded, Manrope, sans-serif"; x.textBaseline = "middle"; x.fillText(text, 110, h / 2 - 28);
  x.fillStyle = "#9fd4ff"; x.font = "700 52px Manrope, sans-serif"; x.fillText(sub, 114, h / 2 + 78);
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
    sp.scale.set(17, 5, 1); sp.position.set(0, height(0, g.z) + 7.2, 0); sp.userData = g; sp.renderOrder = 5; grp.add(sp); gateSprites.push(sp);
    scene.add(grp);
  });
  /* Финиш: арка и логотип */
  const fy = height(0, Z_END);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(12, 0.5, 10, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe3241b })); arch.position.set(0, fy + 0.5, Z_END - 18); scene.add(arch);
  const banner = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture("ZSKI · ПРОКАТ", "61-й км Дмитровского шоссе · Яхрома"), transparent: true })); banner.scale.set(26, 7.6, 1); banner.position.set(0, fy + 14, Z_END - 18); scene.add(banner);
  new THREE.TextureLoader().load("img/logo.png", (t) => { t.colorSpace = THREE.SRGBColorSpace; const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true })); l.scale.set(9, 9, 1); l.position.set(0, fy + 22, Z_END - 18); scene.add(l); });
}

/* ---------- Рига от первого лица: лыжи, палки, перчатки ---------- */
const rig = new THREE.Group(); camera.add(rig); scene.add(camera);
{
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.4, metalness: 0.1 }), red = new THREE.MeshStandardMaterial({ color: 0xe3241b, roughness: 0.5 }), black = new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const ski = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 2.3), white); body.position.z = -0.9; ski.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.024, 0.6), red); stripe.position.z = -1.2; ski.add(stripe);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 0.36), white); tip.position.set(0, 0.045, -2.19); tip.rotation.x = -0.38; ski.add(tip);
    ski.position.set(side * 0.17, -0.66, -0.55); ski.rotation.y = side * 0.03; ski.userData.side = side; rig.add(ski);
    const pole = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 1.5, 8), black); shaft.position.y = -0.75; pole.add(shaft);
    const basket = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14), red); basket.position.y = -1.42; basket.rotation.x = Math.PI / 2; pole.add(basket);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.18, 8), black); pole.add(grip);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 12), black); glove.scale.set(1.05, 0.72, 1.5); glove.position.set(side * -0.015, -0.02, 0.02); pole.add(glove);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.11, 12), black); cuff.position.set(side * -0.02, -0.01, 0.13); cuff.rotation.x = Math.PI / 2; pole.add(cuff);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16), red); ring.position.set(side * -0.02, -0.01, 0.1); pole.add(ring);
    pole.position.set(side * 0.6, -0.42, -0.74); pole.rotation.set(-1.22, 0, side * -0.16); pole.userData.side = side; rig.add(pole);
  }
}

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

/* ---------- Состояние заезда ---------- */
const state = { t: 0, z: 40, x: 0, speed: 0, phase: "intro", steer: 0, fast: false, gateIdx: 0, done: false };
const clock = new THREE.Clock();
let pointerX = 0;
addEventListener("pointermove", (e) => (pointerX = (e.clientX / innerWidth - 0.5) * 2));
addEventListener("click", (e) => { if (state.phase === "ride" && !e.target.closest("a,button")) state.fast = true; });
addEventListener("keydown", (e) => { if (e.key === "Escape") location.href = "index.html"; if (e.key === " " || e.key === "Enter") state.fast = true; });
$("#replay").addEventListener("click", () => location.reload());

/* Клик по воротам — переход в раздел */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener("click", (e) => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(gateSprites, false)[0]; if (hit) location.href = hit.object.userData.href;
});

function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); }
addEventListener("resize", resize); resize();

function showFlash(text) { flash.textContent = text; flash.classList.add("show"); clearTimeout(showFlash.t); showFlash.t = setTimeout(() => flash.classList.remove("show"), 1100); }
function finish() {
  if (state.done) return; state.done = true; state.phase = "finish";
  hint.style.display = "none"; menu.classList.add("show");
}

/* Старт */
requestAnimationFrame(() => { fade.classList.add("out"); title.classList.add("show"); });
setTimeout(() => { if (state.phase === "intro") { state.phase = "ride"; } }, reduce ? 0 : 1800);
setTimeout(() => title.classList.remove("show"), 4200);
if (reduce) { state.z = Z_END + 30; state.phase = "ride"; }

/* ---------- Кадр ---------- */
const look = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
function frame() {
  const dt = Math.min(clock.getDelta(), 0.08); state.t += dt;
  const t = state.t;

  /* скорость и движение */
  if (state.phase === "ride") {
    const target = state.fast ? 140 : 62;
    const remaining = state.z - Z_END;
    const brake = remaining < 70 ? Math.max(0, remaining / 70) : 1;
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
  else look.set(aheadX, height(aheadX, aheadZ) + 1.2 - state.speed * 0.012, aheadZ);
  camera.up.copy(up); camera.lookAt(look);
  camera.rotation.z += -dx * 0.045 - Math.sin(t * 0.55) * 0.035 * Math.min(1, state.speed / 40);
  camera.fov = 72 + state.speed * 0.16; camera.updateProjectionMatrix();

  /* рига: лыжи дрожат, палки работают */
  const sf = Math.min(1, state.speed / 45);
  rig.children.forEach((o) => {
    const s = o.userData.side;
    if (o.children.length === 3) { /* лыжа */
      o.rotation.x = Math.sin(t * 11 + s) * 0.012 * sf; o.position.y = -0.66 + Math.sin(t * 13 + s * 2) * 0.006 * sf; o.rotation.z = s * 0.02 + dx * 0.01;
    } else { /* палка */
      o.rotation.x = -1.22 + Math.sin(t * 1.6 + s * 1.5) * 0.16 * sf; o.position.y = -0.42 + Math.sin(t * 9.5 + s) * 0.008 * sf;
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
  if (state.gateIdx < GATES.length && state.z < GATES[state.gateIdx].z + 6) { showFlash(GATES[state.gateIdx].label); state.gateIdx++; }

  /* HUD */
  speedEl.textContent = Math.round(state.speed * 1.15);
  altEl.textContent = Math.max(0, Math.round(220 * (state.z - Z_END) / (40 - Z_END)));

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
