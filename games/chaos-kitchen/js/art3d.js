"use strict";
// 立体表示(Three.js): オーバークックのように、少し傾けたカメラからブロック状の厨房を見下ろす。
// WebGL が使えないときは art.js の2D表示に戻る。ゲームの動き(game.js)は一切変えない。
const G3 = { ok: false };
(function initG3() {
  try {
    if (typeof THREE === "undefined" || /[?&]2d\b/.test(location.search) || location.hash === "#2d") return;     // ?2d で2D表示を強制(動作確認用)
    const cvs = document.getElementById("gl");
    const r = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setSize(960, 640, false);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(PAL.plum);
    const camera = new THREE.PerspectiveCamera(30, 960 / 640, 0.1, 200);
    const hemi = new THREE.HemisphereLight(0xffffff, 0xc4b2e6, 0.6); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d6, 0.62); sun.castShadow = true; sun.shadow.mapSize.set(matchMedia("(pointer:coarse)").matches ? 1024 : 2048, matchMedia("(pointer:coarse)").matches ? 1024 : 2048); sun.shadow.bias = -0.0005; sun.shadow.radius = 3;
    scene.add(sun); scene.add(sun.target);
    Object.assign(G3, { ok: true, r, scene, camera, sun, hemi, canvas: cvs, group: null, tiles: new Map(), chefs: new Map(), belts: [], beltTex: {}, base: new THREE.Vector3() });
  } catch (e) { G3.ok = false; }
})();

// 3D用の色(光が当たるので、2Dより少し濃くする)
const P3 = { floorA: "#bfeed9", floorB: "#a8e3c8", hallA: "#ffdcbc", hallB: "#ffcba0", iceA: "#c4ecfb", iceB: "#aedff4", wood: "#d49c5e", woodTop: "#f4d196", wall: "#6a52a0", wall2: "#604896", under: "#79b9a2" };
// 画質: きれい(影あり・高解像度) / 軽い(影なし・解像度を抑える)
function applyQuality(q) {
  if (!G3.ok) return; const hi = q !== "low", dpr = window.devicePixelRatio || 1;
  G3.r.setPixelRatio(hi ? Math.min(dpr, 2) : Math.min(dpr, 1.25)); G3.r.setSize(960, 640, false);
  G3.r.shadowMap.enabled = hi; G3.sun.castShadow = hi;
  matCache.forEach(m => { m.needsUpdate = true; });
  G3.scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { m.needsUpdate = true; }); } });
  G3.quality = q;
}
// ---- 共有の形・材質・絵 ----
const CONEG = G3.ok && new THREE.CylinderGeometry(0, 1, 1, 20), HEMIG = G3.ok && new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), TRIG = G3.ok && new THREE.CylinderGeometry(1, 1, 1, 3);
const BOXG = G3.ok && new THREE.BoxGeometry(1, 1, 1), CYLG = G3.ok && new THREE.CylinderGeometry(1, 1, 1, 28), SPHG = G3.ok && new THREE.SphereGeometry(1, 24, 16), PLANEG = G3.ok && new THREE.PlaneGeometry(1, 1);
const matCache = new Map();
function M(color, o = {}) {
  const k = color + JSON.stringify(o); let m = matCache.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, ...o }); m._key = k; matCache.set(k, m); }
  return m;
}
function mesh(geo, color, x, y, z, sx, sy, sz, parent, o) {
  o = o || {};
  const m = new THREE.Mesh(geo, o.mat || M(color, o.m)); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false; if (parent) parent.add(m); return m;
}
const box = (w, h, d, color, x, y, z, parent, o) => mesh(BOXG, color, x, y, z, w, h, d, parent, o);
const cyl = (r, h, color, x, y, z, parent, o) => mesh(CYLG, color, x, y, z, r, h, r, parent, o);
const sph = (r, color, x, y, z, parent, o, sx = 1, sy = 1, sz = 1) => mesh(SPHG, color, x, y, z, r * sx, r * sy, r * sz, parent, o);
const texCache = new Map();
function cachedTex(key, w, h, draw) {
  let t = texCache.get(key); if (t) return t;
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  t = new THREE.CanvasTexture(c); t.anisotropy = 4; texCache.set(key, t); return t;
}
function spriteOf(tex, size, x, y, z, parent) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1); s.position.set(x, y, z); if (parent) parent.add(s); return s;
}
const emojiTex = ch => cachedTex("e" + ch, 128, 128, (c, w, h) => { c.font = "92px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(ch, w / 2, h / 2 + 6); });
const itemTex = (type, state) => cachedTex(`i${type}:${state}`, 128, 128, (c, w, h) => {
  c.beginPath(); c.arc(64, 64, 52, 0, 7); c.fillStyle = "rgba(255,255,255,.93)"; c.fill(); c.lineWidth = 5; c.strokeStyle = "rgba(58,43,87,.5)"; c.stroke();
  c.font = "66px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(ING[type].emoji, 64, 70);
  if (state !== "raw") {
    const lab = STATE_TAG[state]; c.font = "800 30px sans-serif"; const bw = 46;
    c.beginPath(); c.roundRect(128 - bw - 2, 128 - 40, bw, 36, 14); c.fillStyle = TAG_COL[state]; c.fill(); c.lineWidth = 4; c.strokeStyle = "#fff"; c.stroke();
    c.fillStyle = PAL.ink; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(lab, 128 - bw / 2 - 2, 128 - 21);
  }
});
const faceTex = ch => cachedTex("f" + ch, 128, 128, (c) => {
  c.beginPath(); c.arc(64, 64, 56, 0, 7); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 6; c.strokeStyle = PAL.ink; c.stroke();
  c.font = "74px serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(ch, 64, 70);
});
const beltTexFor = dir => { if (!G3.beltTex[dir]) { const c = document.createElement("canvas"); c.width = c.height = 128; const t = new THREE.CanvasTexture(c); t.anisotropy = 4; G3.beltTex[dir] = { c, t }; } return G3.beltTex[dir]; };
function drawBeltTex(dir, tnow) {
  const { c, t } = beltTexFor(dir), g = c.getContext("2d"), [ax, ay] = ARROW[dir];
  g.fillStyle = "#59527a"; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = PAL.sun; g.lineWidth = 12; g.lineCap = "round"; g.lineJoin = "round";
  const off = (tnow * 60) % 64;
  for (let i = -1; i < 3; i++) {
    const d = i * 64 + off - 32, cx = 64 + ax * d, cy = 64 + ay * d; g.beginPath();
    if (ax) { g.moveTo(cx - ax * 14, cy - 28); g.lineTo(cx + ax * 14, cy); g.lineTo(cx - ax * 14, cy + 28); } else { g.moveTo(cx - 28, cy - ay * 14); g.lineTo(cx, cy + ay * 14); g.lineTo(cx + 28, cy - ay * 14); }
    g.stroke();
  }
  g.strokeStyle = PAL.ink; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122); t.needsUpdate = true;
}

// ---- ステージの組み立て ----
const CTOP = 0.92;                                     // カウンターの天板の高さ
function counter3(g, x, z, top = P3.woodTop) {
  box(0.98, 0.78, 0.98, P3.wood, x, 0.39, z, g);
  box(1.0, 0.14, 1.0, top, x, 0.85, z, g);
}
function buildStatic(c, x, y, g) {
  const px = x + 0.5, pz = y + 0.5, t = c.t, hall = stage.hallX !== null && x >= stage.hallX;
  const floorCol = () => (t === "~" ? ((x + y) & 1 ? P3.iceA : P3.iceB) : hall ? ((x + y) & 1 ? P3.hallA : P3.hallB) : ((x + y) & 1 ? P3.floorA : P3.floorB));
  if (t === "." || t === "~" || t === "B") {
    box(0.985, 0.12, 0.985, floorCol(), px, -0.06, pz, g, { cast: false });
    if (t === "~") box(0.985, 0.02, 0.985, "#ffffff", px, 0.005, pz, g, { m: { transparent: true, opacity: 0.4 }, cast: false });
  }
  if (ARROW[t]) {
    const tx = beltTexFor(t).t, m = new THREE.Mesh(PLANEG, new THREE.MeshLambertMaterial({ map: tx }));
    m.rotation.x = -Math.PI / 2; m.position.set(px, 0.01, pz); m.receiveShadow = true; g.add(m);
    box(1, 0.12, 1, "#403a5c", px, -0.06, pz, g, { cast: false }); G3.belts.push(t);
  }
  if (t === "#") {
    if (c.inner) { box(1, 1.05, 1, (x + y) & 1 ? P3.wall : P3.wall2, px, 0.525, pz, g); box(1, 0.08, 1, "#8a72bd", px, 1.05, pz, g, { cast: false }); }
    else counter3(g, px, pz);
  } else if (t === "K") { counter3(g, px, pz, "#ffe9a8"); box(0.8, 0.02, 0.8, "#e2a93a", px, 0.935, pz, g, { cast: false }); }
  else if (CRATE[t]) {
    counter3(g, px, pz, "#f4cf94");
    box(0.78, 0.34, 0.78, "#d79f5f", px, CTOP + 0.17, pz, g); box(0.84, 0.05, 0.84, PAL.woodLine, px, CTOP + 0.36, pz, g);
    box(0.7, 0.012, 0.7, "#8a5a30", px, CTOP + 0.34, pz, g, { cast: false });
    { const f = foodGroup(CRATE[t], "raw"); f.scale.setScalar(1.45); f.position.set(px, CTOP + 0.33, pz + 0.02); g.add(f); }
  } else if (t === "C") {
    counter3(g, px, pz); box(0.84, 0.07, 0.66, "#fff0c9", px, CTOP + 0.035, pz, g); box(0.84, 0.01, 0.06, "#c9a063", px, CTOP + 0.075, pz - 0.2, g, { cast: false });
    box(0.04, 0.02, 0.26, "#c8d0dd", px + 0.3, CTOP + 0.085, pz + 0.12, g, { cast: false }); box(0.04, 0.03, 0.12, PAL.woodLine, px + 0.3, CTOP + 0.09, pz + 0.3, g, { cast: false });
  } else if (isCooker(t)) {
    counter3(g, px, pz, "#e9eef6");
    if (t === "S") {
      box(0.86, 0.16, 0.86, "#4a4d60", px, CTOP + 0.08, pz, g);
      for (const dx of [-0.2, 0.2]) { cyl(0.17, 0.03, "#2a2c38", px + dx, CTOP + 0.17, pz - 0.08, g); cyl(0.09, 0.035, "#454859", px + dx, CTOP + 0.18, pz - 0.08, g); }
      for (const dx of [-0.25, 0, 0.25]) cyl(0.04, 0.04, "#ffffff", px + dx, CTOP + 0.1, pz + 0.43, g, { cast: false });
    } else if (t === "F") {
      box(0.86, 0.34, 0.86, "#aab6c8", px, CTOP + 0.17, pz, g); box(0.7, 0.03, 0.62, "#ffd84a", px, CTOP + 0.35, pz - 0.04, g, { cast: false });
      box(0.66, 0.05, 0.04, "#5b6070", px, CTOP + 0.4, pz + 0.22, g);
    } else {
      box(0.88, 0.66, 0.8, "#ff8a5c", px, CTOP + 0.33, pz, g);
      box(0.56, 0.32, 0.03, "#3b2b3a", px, CTOP + 0.34, pz + 0.41, g, { cast: false }); box(0.62, 0.05, 0.04, "#fff", px, CTOP + 0.58, pz + 0.43, g, { cast: false });
    }
  } else if (t === "P") {
    counter3(g, px, pz);
  } else if (t === "Z") {
    counter3(g, px, pz, PAL.steel); box(0.78, 0.14, 0.78, PAL.steelLo, px, CTOP + 0.07, pz, g);
    box(0.6, 0.02, 0.5, "#8fd8ff", px, CTOP + 0.145, pz + 0.04, g, { cast: false });
    cyl(0.04, 0.34, "#7d8aa0", px, CTOP + 0.3, pz - 0.28, g); box(0.04, 0.04, 0.22, "#7d8aa0", px, CTOP + 0.46, pz - 0.18, g);
  } else if (t === "X") {
    counter3(g, px, pz, "#bfc6d8");
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.6, 24), M("#9aa3b8")); bin.position.set(px, CTOP + 0.3, pz); bin.castShadow = true; g.add(bin);
    cyl(0.33, 0.07, "#b7bfd1", px, CTOP + 0.64, pz, g);
  } else if (t === "D") {
    counter3(g, px, pz);
    for (let i = 0; i < 4; i++) box(0.25, 0.1, 0.5, i % 2 ? "#ffffff" : PAL.tomato, px - 0.375 + i * 0.25, 1.62, pz + 0.2, g);
    box(0.06, 0.7, 0.06, PAL.woodLine, px - 0.46, 1.25, pz + 0.4, g); box(0.06, 0.7, 0.06, PAL.woodLine, px + 0.46, 1.25, pz + 0.4, g);
    spriteOf(cachedTex("txtD", 256, 96, (c, w, h) => { c.beginPath(); c.roundRect(10, 12, 236, 72, 36); c.fillStyle = PAL.mint; c.fill(); c.lineWidth = 8; c.strokeStyle = PAL.ink; c.stroke(); c.font = "800 52px sans-serif"; c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("提供", 128, 50); }), 0.9, px, CTOP + 0.45, pz + 0.3, g).scale.set(0.9, 0.34, 1);
  } else if (t === "E") {
    counter3(g, px, pz, "#b9763a"); box(0.7, 1.0, 0.1, "#b9763a", px, 0.95, pz, g); box(0.4, 0.3, 0.04, "#bfe9ff", px, 1.2, pz + 0.07, g, { cast: false });
    cyl(0.05, 0.04, PAL.sun, px + 0.24, 0.9, pz + 0.07, g, { cast: false });
  } else if (t === "B") {
    const col = TABLE_COLS[(c.tb.id - 1) % 8];
    cyl(0.07, 0.56, "#8a5a30", px, 0.28, pz, g); cyl(0.46, 0.07, col, px, 0.6, pz, g); cyl(0.33, 0.01, "#ffffff", px, 0.645, pz, g, { m: { transparent: true, opacity: 0.55 }, cast: false });
    for (const sx of [-1, 1]) { box(0.2, 0.34, 0.2, PAL.woodLo, px + sx * 0.5, 0.2, pz + 0.1, g); box(0.2, 0.05, 0.2, "#fff2e0", px + sx * 0.5, 0.4, pz + 0.1, g); }
  }
}

// ---- 食べ物の立体モデル(原点=底の中心、高さは約0.3まで) ----
function seeded(n) { let a = n * 9301 + 49297; return () => { a = (a * 9301 + 49297) % 233280; return a / 233280; }; }
function fpart(g, geo, color, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, shine = false) {
  const m = new THREE.Mesh(geo, M(color, shine ? { emissive: "#442222", emissiveIntensity: 0.15 } : undefined)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
const S_ = (g, c, x, y, z, rx, ry, rz, ...r) => fpart(g, SPHG, c, x, y, z, rx, ry, rz, ...r);
const FOOD = {
  tomato: {
    raw(g) { S_(g, "#e63b34", 0, 0.17, 0, 0.19, 0.165, 0.19); S_(g, "#ffd5d0", -0.07, 0.25, 0.1, 0.035, 0.03, 0.03); for (let i = 0; i < 5; i++) { const a = i * 1.257; fpart(g, SPHG, "#3f9b3a", Math.cos(a) * 0.06, 0.335, Math.sin(a) * 0.06, 0.07, 0.022, 0.03, 0, -a, 0.2); } fpart(g, CYLG, "#3f7f2e", 0, 0.37, 0, 0.014, 0.06, 0.014); },
    chopped(g) { for (let i = 0; i < 4; i++) { fpart(g, CYLG, "#e63b34", -0.15 + i * 0.1, 0.1 + i * 0.012, 0.0, 0.14, 0.032, 0.14, 0, 0, 0.9); fpart(g, CYLG, "#ff9a90", -0.15 + i * 0.1, 0.1 + i * 0.012, 0.0, 0.1, 0.034, 0.1, 0, 0, 0.9); } },
    cooked(g) { fpart(g, CYLG, "#ffffff", 0, 0.06, 0, 0.21, 0.12, 0.21); fpart(g, CYLG, "#e5483b", 0, 0.115, 0, 0.18, 0.02, 0.18); fpart(g, CYLG, "#ffe0c8", 0.04, 0.127, 0, 0.06, 0.01, 0.03); S_(g, "#3f9b3a", -0.06, 0.14, 0.05, 0.025, 0.02, 0.025); },
  },
  lettuce: {
    raw(g) { S_(g, "#8fdc5f", 0, 0.16, 0, 0.17, 0.155, 0.17); for (let i = 0; i < 6; i++) { const a = i * 1.047; fpart(g, SPHG, i % 2 ? "#a8e87a" : "#6fc84a", Math.cos(a) * 0.1, 0.12 + (i % 2) * 0.05, Math.sin(a) * 0.1, 0.14, 0.05, 0.1, 0.5 * Math.sin(a), -a, -0.5 * Math.cos(a)); } },
    chopped(g) { const r = seeded(3); for (let i = 0; i < 12; i++) { const a = r() * 6.28, d = r() * 0.15; fpart(g, BOXG, i % 3 ? "#7fd653" : "#a8e87a", Math.cos(a) * d, 0.025 + r() * 0.1, Math.sin(a) * d, 0.15, 0.022, 0.05, r(), r() * 3, r()); } },
  },
  onion: {
    raw(g) { S_(g, "#e8c478", 0, 0.17, 0, 0.19, 0.17, 0.19); fpart(g, CONEG, "#cfa75a", 0, 0.38, 0, 0.06, 0.14, 0.06); fpart(g, CYLG, "#f4e6c0", 0, 0.015, 0, 0.05, 0.03, 0.05); },
    chopped(g) { const r = seeded(5); for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = r() * 0.14; fpart(g, BOXG, i % 2 ? "#f7edd0" : "#efe0f0", Math.cos(a) * d, 0.04 + r() * 0.06, Math.sin(a) * d, 0.075, 0.075, 0.075, r(), r() * 3, r()); } },
    cooked(g) { const r = seeded(7); fpart(g, CYLG, "#ffffff", 0, 0.05, 0, 0.21, 0.1, 0.21); for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = r() * 0.12; fpart(g, BOXG, i % 2 ? "#c78a3a" : "#e0a64e", Math.cos(a) * d, 0.12 + r() * 0.04, Math.sin(a) * d, 0.07, 0.05, 0.07, r(), r() * 3, r()); } },
  },
  carrot: {
    raw(g) { fpart(g, CONEG, "#ff8c1a", 0.0, 0.1, 0, 0.09, 0.46, 0.09, 0, 0, Math.PI / 2); for (let i = 0; i < 3; i++) fpart(g, CONEG, "#3fa83a", 0.24, 0.12 + (i - 1) * 0.04, (i - 1) * 0.04, 0.03, 0.12, 0.03, 0, 0, -1.3 + (i - 1) * 0.35); },
    chopped(g) { for (let i = 0; i < 5; i++) { fpart(g, CYLG, "#ff9a2e", -0.15 + i * 0.075, 0.1 + (i % 2) * 0.01, 0, 0.1, 0.034, 0.1, 0, 0, 1.0); fpart(g, CYLG, "#ffc26a", -0.15 + i * 0.075, 0.1 + (i % 2) * 0.01, 0, 0.06, 0.036, 0.06, 0, 0, 1.0); } },
    cooked(g) { for (let i = 0; i < 5; i++) fpart(g, CYLG, "#e0701b", -0.14 + i * 0.07, 0.07, ((i % 2) - 0.5) * 0.08, 0.095, 0.045, 0.095, 0.1, 0, 0, shineAngle(i)); S_(g, "#ffd9a0", -0.05, 0.12, 0.02, 0.03, 0.02, 0.02); },
  },
  potato: {
    raw(g) { S_(g, "#c79a5a", 0, 0.15, 0, 0.2, 0.14, 0.17, 0, 0, 0.15); S_(g, "#8a6a3a", 0.08, 0.2, 0.08, 0.025, 0.02, 0.02); S_(g, "#8a6a3a", -0.08, 0.17, 0.1, 0.02, 0.02, 0.02); S_(g, "#8a6a3a", 0.0, 0.26, -0.03, 0.02, 0.018, 0.02); },
    chopped(g) { const r = seeded(11); for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * 0.12; fpart(g, BOXG, "#f3dc8f", Math.cos(a) * d, 0.06 + (i % 3) * 0.045, Math.sin(a) * d, 0.1, 0.1, 0.1, r() * 0.6, r() * 3, r() * 0.6); } },
    cooked(g) { const r = seeded(13); fpart(g, CYLG, "#ffffff", 0, 0.05, 0, 0.21, 0.1, 0.21); for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r() * 0.1; fpart(g, BOXG, "#f7e6a8", Math.cos(a) * d, 0.12 + (i % 2) * 0.04, Math.sin(a) * d, 0.1, 0.09, 0.1, r() * 0.6, r() * 3, r() * 0.6); } },
    fried(g) { const r = seeded(17); for (let i = 0; i < 10; i++) { const a = r() * 3.14; fpart(g, BOXG, i % 3 ? "#f1b92f" : "#e5a31c", (r() - 0.5) * 0.14, 0.06 + (i % 4) * 0.04, (r() - 0.5) * 0.14, 0.05, 0.05, 0.26, 0, a, r() * 0.3); } },
    baked(g) { for (const dz of [-0.12, 0.12]) { fpart(g, HEMIG, "#b98245", 0, 0.03, dz, 0.2, 0.12, 0.1); fpart(g, CYLG, "#fff0c0", 0, 0.045, dz, 0.18, 0.02, 0.09); S_(g, "#ffd84a", 0, 0.065, dz, 0.05, 0.025, 0.04); } },
  },
  meat: {
    raw(g) { fpart(g, BOXG, "#e0606c", 0, 0.045, 0, 0.42, 0.08, 0.3); for (let i = -1; i <= 1; i++) fpart(g, BOXG, "#ffe6e0", 0, 0.047, i * 0.09, 0.4, 0.083, 0.025); fpart(g, SPHG, "#ffc9c4", -0.1, 0.092, -0.04, 0.06, 0.012, 0.04); },
    cooked(g) { fpart(g, BOXG, "#8b4a2b", 0, 0.06, 0, 0.42, 0.11, 0.3); for (let i = 0; i < 3; i++) fpart(g, BOXG, "#4a2412", -0.12 + i * 0.12, 0.118, 0, 0.035, 0.012, 0.34, 0, 0.6); S_(g, "#c47a4a", 0.1, 0.12, 0.06, 0.07, 0.012, 0.045); },
  },
  fish: {
    raw(g) { S_(g, "#8fb7d8", 0, 0.1, 0, 0.26, 0.1, 0.1); S_(g, "#dce9f4", 0, 0.065, 0.02, 0.2, 0.05, 0.08); fpart(g, CONEG, "#6f9bc0", -0.28, 0.1, 0, 0.1, 0.14, 0.03, 0, 0, Math.PI / 2); fpart(g, CONEG, "#6f9bc0", 0, 0.2, 0, 0.07, 0.1, 0.02, 0, 0, 0.2); S_(g, "#ffffff", 0.17, 0.13, 0.08, 0.035, 0.035, 0.03); S_(g, "#222233", 0.19, 0.13, 0.095, 0.018, 0.018, 0.015); },
    cooked(g) { S_(g, "#d28f45", 0, 0.1, 0, 0.26, 0.1, 0.1); for (let i = 0; i < 3; i++) fpart(g, BOXG, "#8a4f22", -0.08 + i * 0.09, 0.19, 0, 0.025, 0.012, 0.15, 0, 0.3, 0); fpart(g, CONEG, "#b97a3a", -0.28, 0.1, 0, 0.1, 0.14, 0.03, 0, 0, Math.PI / 2); S_(g, "#ffffff", 0.17, 0.13, 0.08, 0.03, 0.03, 0.03); },
    fried(g) { S_(g, "#eaa93a", 0, 0.08, 0, 0.27, 0.075, 0.14); const r = seeded(19); for (let i = 0; i < 6; i++) S_(g, i % 2 ? "#f6c25a" : "#d9962a", (r() - 0.5) * 0.3, 0.12, (r() - 0.5) * 0.14, 0.05, 0.035, 0.05); },
    baked(g) { S_(g, "#cf8f4f", 0, 0.09, 0, 0.26, 0.09, 0.1); for (let i = 0; i < 4; i++) S_(g, "#4caf50", -0.1 + i * 0.07, 0.17, 0.02, 0.022, 0.012, 0.015); fpart(g, CONEG, "#b97a3a", -0.28, 0.1, 0, 0.1, 0.14, 0.03, 0, 0, Math.PI / 2); },
  },
  egg: {
    raw(g) { S_(g, "#fff7ea", 0, 0.18, 0, 0.14, 0.18, 0.14); S_(g, "#ffffff", -0.05, 0.25, 0.07, 0.03, 0.04, 0.025); },
    cooked(g) { fpart(g, CYLG, "#ffffff", -0.03, 0.02, 0, 0.2, 0.035, 0.18); fpart(g, CYLG, "#ffffff", 0.08, 0.02, 0.06, 0.12, 0.035, 0.1); S_(g, "#ffb400", 0.0, 0.05, 0, 0.085, 0.06, 0.085); S_(g, "#ffe27a", -0.03, 0.09, 0.03, 0.02, 0.012, 0.015); },
  },
  rice: {
    raw(g) { fpart(g, HEMIG, "#f3ecd6", 0, 0.0, 0, 0.19, 0.12, 0.19); const r = seeded(23); for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = r() * 0.13; S_(g, "#fffaf0", Math.cos(a) * d, 0.04 + (0.12 - d * 0.6), Math.sin(a) * d, 0.04, 0.025, 0.025, 0, r() * 3, 0); } },
    cooked(g) { fpart(g, CYLG, "#ffffff", 0, 0.07, 0, 0.21, 0.14, 0.21); fpart(g, CYLG, "#4a8fd8", 0, 0.06, 0, 0.215, 0.035, 0.215); fpart(g, HEMIG, "#ffffff", 0, 0.14, 0, 0.19, 0.13, 0.19); const r = seeded(29); for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * 0.12; S_(g, "#fffdf6", Math.cos(a) * d, 0.16 + (0.1 - d * 0.5), Math.sin(a) * d, 0.035, 0.022, 0.022, 0, r() * 3, 0); } },
  },
  bread: {
    raw(g) { fpart(g, CYLG, "#e8b565", 0, 0.04, 0, 0.21, 0.08, 0.21); fpart(g, HEMIG, "#e2a04e", 0, 0.08, 0, 0.22, 0.17, 0.22); const r = seeded(31); for (let i = 0; i < 7; i++) { const a = r() * 6.28, d = r() * 0.12; S_(g, "#fff1cc", Math.cos(a) * d, 0.2 - d * 0.5, Math.sin(a) * d, 0.028, 0.012, 0.016, 0, r() * 3, 0); } },
  },
  cheese: {
    raw(g) { fpart(g, TRIG, "#ffd23f", 0, 0.09, 0, 0.24, 0.17, 0.24, 0, Math.PI / 6, 0); for (const [x, z] of [[-0.05, 0.02], [0.06, -0.04], [0.02, 0.08]]) fpart(g, CYLG, "#e8b52a", x, 0.18, z, 0.04, 0.012, 0.04); },
    chopped(g) { for (let i = 0; i < 3; i++) fpart(g, BOXG, i % 2 ? "#ffd84d" : "#ffe27a", 0, 0.03 + i * 0.03, 0, 0.27, 0.026, 0.27, 0, 0.35 * i, 0); },
    baked(g) { fpart(g, CYLG, "#f5b53a", 0, 0.025, 0, 0.23, 0.05, 0.23); const r = seeded(37); for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r() * 0.14; S_(g, i % 2 ? "#ffd36a" : "#e89a2a", Math.cos(a) * d, 0.06, Math.sin(a) * d, 0.045, 0.03, 0.045); } },
  },
  mushroom: {
    raw(g) { fpart(g, CYLG, "#f3e4d0", 0, 0.085, 0, 0.065, 0.17, 0.065); fpart(g, HEMIG, "#c58a5c", 0, 0.15, 0, 0.21, 0.15, 0.21); fpart(g, CYLG, "#e8cfae", 0, 0.15, 0, 0.19, 0.012, 0.19); },
    chopped(g) { for (let i = 0; i < 4; i++) { const x = -0.14 + i * 0.09; fpart(g, BOXG, "#c58a5c", x, 0.1, 0, 0.1, 0.04, 0.08, 0, 0, 0.2); fpart(g, BOXG, "#f3e4d0", x, 0.05, 0, 0.04, 0.09, 0.07, 0, 0, 0.2); } },
    cooked(g) { for (let i = 0; i < 4; i++) { const x = -0.14 + i * 0.09; fpart(g, BOXG, "#8f5b36", x, 0.1, 0, 0.1, 0.04, 0.08, 0, 0, 0.2); fpart(g, BOXG, "#d9bf9a", x, 0.05, 0, 0.04, 0.09, 0.07, 0, 0, 0.2); } },
    baked(g) { for (let i = 0; i < 4; i++) { const x = -0.14 + i * 0.09; fpart(g, BOXG, "#a56a3a", x, 0.1, 0, 0.1, 0.04, 0.08, 0, 0, 0.2); fpart(g, BOXG, "#e0c9a6", x, 0.05, 0, 0.04, 0.09, 0.07, 0, 0, 0.2); S_(g, "#ffd36a", x, 0.13, 0, 0.03, 0.015, 0.03); } },
  },
};
function shineAngle(i) { return 0.15 * (i % 2 ? 1 : -1); }
const foodCache = new Map();
function foodGroup(type, state) {                         // 食べ物の立体(同じ見た目は作った型を使い回す)
  const key = type + ":" + state; let tpl = foodCache.get(key);
  if (!tpl) {
    tpl = new THREE.Group(); const b = FOOD[type] && (FOOD[type][state] || FOOD[type].raw);
    if (b) b(tpl); else S_(tpl, "#cccccc", 0, 0.15, 0, 0.15, 0.15, 0.15);
    foodCache.set(key, tpl);
  }
  return tpl.clone();
}
const tagTex = state => cachedTex("t" + state, 96, 64, (c) => {
  c.beginPath(); c.roundRect(6, 8, 84, 48, 22); c.fillStyle = TAG_COL[state]; c.fill(); c.lineWidth = 6; c.strokeStyle = "#fff"; c.stroke();
  c.font = "800 34px sans-serif"; c.fillStyle = PAL.ink; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(STATE_TAG[state], 48, 34);
});

// 動く部分(アイテム・鍋の中身・お客さん)。状態が変わったときだけ作り直す
function buildItem3(it, g, s = 1) {
  if (!it) return;
  if (it.kind === "dirty") { cyl(0.3 * s, 0.04, "#cdb89a", 0, 0.02, 0, g); cyl(0.2 * s, 0.045, "#b9a283", 0, 0.025, 0, g, { cast: false }); spriteOf(emojiTex("💧"), 0.3 * s, 0.14 * s, 0.22, 0.05, g); return; }
  if (it.kind === "plate") {
    cyl(0.31 * s, 0.04, "#ffffff", 0, 0.02, 0, g); cyl(0.2 * s, 0.045, "#e6eeff", 0, 0.025, 0, g, { cast: false });
    const n = it.contents.length, pos = n === 1 ? [[0, 0]] : n === 2 ? [[-0.12, 0.02], [0.12, 0.02]] : [[-0.14, 0.08], [0.14, 0.08], [0, -0.13]], sc = (n === 1 ? 0.95 : n === 2 ? 0.66 : 0.52) * s;
    it.contents.forEach((c, i) => { const f = foodGroup(c.type, c.state); f.scale.setScalar(sc); f.position.set(pos[i][0] * s, 0.045 * s, pos[i][1] * s); g.add(f); });
    return;
  }
  const sh = new THREE.Mesh(PLANEG, M("#3a2b57", { transparent: true, opacity: 0.22 })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; sh.scale.set(0.4 * s, 0.4 * s, 1); g.add(sh);
  const f = foodGroup(it.type, it.state); f.scale.setScalar(1.15 * s); g.add(f);
  if (it.state !== "raw") spriteOf(tagTex(it.state), 0.3 * s, 0.24 * s, 0.4 * s, 0.1, g);
}
const itemSig = it => !it ? "-" : it.kind === "plate" ? "p" + it.contents.map(x => x.type + x.state).join() : it.kind === "dirty" ? "d" : it.type + it.state;
function dynSig(c) {
  const t = c.t;
  if (isCooker(t)) return `${c.stove}|${c.sitem ? c.sitem.type : ""}|${c.res}`;
  if (t === "B") return `${c.tb.state}|${c.tb.who}`;
  if (t === "P") return String(plates);
  if (t === "Z") return String(c.dirty);
  return itemSig(c.item);
}
function buildDyn(c, g) {
  const t = c.t;
  if (isCooker(t)) {
    const act = c.stove === "cooking" || c.stove === "done", burnt = c.stove === "burnt";
    if (act || burnt) {
      if (t === "S") {
        cyl(0.27, 0.26, burnt ? "#25222d" : "#8d96ad", 0, 0.3, -0.04, g); cyl(0.29, 0.04, burnt ? "#25222d" : "#aab4cc", 0, 0.43, -0.04, g);
        box(0.18, 0.04, 0.05, "#5b6070", -0.36, 0.35, -0.04, g); box(0.18, 0.04, 0.05, "#5b6070", 0.36, 0.35, -0.04, g);
        if (c.stove === "cooking") { const gl = new THREE.Mesh(CYLG, new THREE.MeshBasicMaterial({ color: 0xff9f43 })); gl.position.set(0, 0.26, -0.04); gl.scale.set(0.2, 0.02, 0.2); g.add(gl); }
      } else if (t === "F") { box(0.5, 0.18, 0.04, burnt ? "#25222d" : "#9aa3b8", 0, 0.26, 0.0, g); }
      else if (c.stove === "cooking" || c.stove === "done") { const gl = new THREE.Mesh(BOXG, new THREE.MeshBasicMaterial({ color: 0xffd27a })); gl.position.set(0, 0.34, 0.405); gl.scale.set(0.5, 0.26, 0.02); g.add(gl); }
    }
    if (c.sitem && act) { const f = foodGroup(c.sitem.type, c.stove === "done" ? c.res : c.sitem.state); f.scale.setScalar(0.72); f.position.set(0, t === "S" ? 0.46 : t === "F" ? 0.38 : 0.1, t === "V" ? 0.0 : -0.04); if (t === "V") f.position.y = 0.2; g.add(f); if (t === "V") { /* オーブンの中は見えないので上に出す */ f.position.set(0, 0.74, -0.02); } }
    if (c.stove === "done") spriteOf(emojiTex("✅"), 0.4, 0.3, 1.1, 0.1, g);
    if (burnt) spriteOf(emojiTex("🔥"), 0.7, 0, 0.75, 0, g);
    return;
  }
  if (t === "P") {
    const n = Math.min(plates, 7);
    for (let i = 0; i < n; i++) { cyl(0.32, 0.04, "#ffffff", 0, 0.03 + i * 0.05, 0, g); cyl(0.2, 0.045, "#dfe9ff", 0, 0.035 + i * 0.05, 0, g, { cast: false }); }
    return;
  }
  if (t === "Z") { for (let i = 0; i < Math.min(c.dirty, 6); i++) cyl(0.26, 0.04, "#cdb89a", (i % 2 - 0.5) * 0.08, 0.11 + i * 0.045, 0, g); return; }
  if (t === "B") {
    const tb = c.tb, st = tb.state; g.position.y = 0;
    if (st === "order" || st === "wait" || st === "eat" || st === "pay") spriteOf(faceTex(st === "eat" ? "😋" : tb.who), 0.62, 0, 1.2, -0.08, g);
    if (st === "eat") { const pg = new THREE.Group(); pg.position.set(0, 0.67, 0.05); buildItem3({ kind: "plate", contents: [] }, pg, 0.8); g.add(pg); }
    if (st === "dirty") { const pg = new THREE.Group(); pg.position.set(0, 0.67, 0.05); buildItem3({ kind: "dirty" }, pg, 0.8); g.add(pg); }
    return;
  }
  buildItem3(c.item, g);
}

const sharedGeos = G3.ok ? new Set([BOXG, CYLG, SPHG, PLANEG, CONEG, HEMIG, TRIG]) : null;
function disposeObj(o) {                                    // 共有の形・材質は残し、その場で作ったものだけ捨てる
  o.traverse(n => {
    if (n.isSprite) n.material.dispose();
    else if (n.isMesh) {
      if (!sharedGeos.has(n.geometry)) n.geometry.dispose();
      if (!matCache.has(n.material._key) && !n.material.map) n.material.dispose();
    }
  });
}
function clearGroup(g) { while (g.children.length) { const c = g.children[0]; g.remove(c); disposeObj(c); } }
function disposeGroup(g) { if (!g) return; G3.scene.remove(g); disposeObj(g); }
function build3D() {
  if (!G3.ok) return;
  disposeGroup(G3.group); G3.tiles.clear(); G3.chefs.clear(); G3.belts = [];
  const group = new THREE.Group(); G3.group = group; G3.scene.add(group);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = tiles[y][x]; buildStatic(c, x, y, group);
    const dyn = new THREE.Group(), top = (c.t === "." || c.t === "~" || ARROW[c.t]) ? 0 : (c.t === "B" ? 0 : CTOP);
    dyn.position.set(x + 0.5, top, y + 0.5); group.add(dyn); G3.tiles.set(c, { dyn, sig: null });
  }
  // 床の外側(背景)
  box(W + 40, 0.1, H + 40, PAL.plum, W / 2, -0.2, H / 2, group, { cast: false });
  box(W, 0.1, H, P3.under, W / 2, -0.12, H / 2, group, { cast: false });
  // 光と影の範囲
  const cx = W / 2, cz = H / 2, ext = Math.max(W, H) * 0.75;
  G3.sun.position.set(cx - W * 0.35, 14, cz + H * 0.45); G3.sun.target.position.set(cx, 0, cz);
  const sc = G3.sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 40; sc.updateProjectionMatrix();
  fitCamera();
}
function fitCamera() {
  const cam = G3.camera, pitch = 56 * Math.PI / 180, cx = W / 2, cz = H / 2;
  const pts = []; for (const x of [0, W]) for (const y of [0, 1.1]) for (const z of [0, H]) pts.push(new THREE.Vector3(x, y, z));
  const extent = d => {
    cam.position.set(cx, 0.4 + Math.sin(pitch) * d, cz + Math.cos(pitch) * d); cam.lookAt(cx, 0.4, cz); cam.clearViewOffset(); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let ax = 0, ay = 0, bx = 0, by = 0; ax = ay = 1e9; bx = by = -1e9;
    for (const p of pts) { const v = p.clone().project(cam); ax = Math.min(ax, v.x); bx = Math.max(bx, v.x); ay = Math.min(ay, v.y); by = Math.max(by, v.y); }
    return { w: bx - ax, h: by - ay, cx: (ax + bx) / 2, cy: (ay + by) / 2 };
  };
  let lo = 6, hi = 120;
  for (let i = 0; i < 24; i++) { const d = (lo + hi) / 2, e = extent(d); if (Math.max(e.w, e.h) > 1.9) lo = d; else hi = d; }
  const e = extent(hi); G3.dist = hi;
  cam.setViewOffset(960, 640, e.cx * 480, -e.cy * 320, 960, 640);   // 画面の真ん中に寄せる
  G3.base.copy(cam.position);
}

// ---- キャラクター ----
function makeChef(p) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const col = p.col, skin = "#ffe0c2";
  sph(0.31, col, 0, 0.36, 0, body, null, 1, 0.95, 1);
  sph(0.285, "#fff6e6", 0, 0.22, 0.13, body, null, 0.78, 0.46, 0.66);
  for (const s of [-1, 1]) {
    sph(0.085, "#ffffff", s * 0.115, 0.47, 0.255, body); sph(0.045, PAL.ink, s * 0.115, 0.47, 0.325, body, { cast: false });
    sph(0.05, "#ff9fc0", s * 0.2, 0.37, 0.25, body, { cast: false }, 1, 0.7, 0.4);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12, Math.PI), M(PAL.ink)); mouth.position.set(0, 0.37, 0.305); mouth.rotation.z = Math.PI; body.add(mouth);
  cyl(0.23, 0.11, "#ffffff", 0, 0.78, 0, body); cyl(0.235, 0.05, col, 0, 0.74, 0, body);
  sph(0.17, "#ffffff", 0, 0.95, 0, body); sph(0.13, "#ffffff", -0.13, 0.88, 0, body); sph(0.13, "#ffffff", 0.13, 0.88, 0, body);
  const armL = sph(0.095, skin, -0.35, 0.3, 0.06, body), armR = sph(0.095, skin, 0.35, 0.3, 0.06, body);
  const footL = sph(0.1, PAL.ink, -0.13, 0.06, 0.04, g), footR = sph(0.1, PAL.ink, 0.13, 0.06, 0.04, g);
  const sh = new THREE.Mesh(PLANEG, M("#3a2b57", { transparent: true, opacity: 0.25 })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.012; sh.scale.set(0.8, 0.8, 1); g.add(sh);
  const held = new THREE.Group(); held.position.set(0, 0.62, 0.55); g.add(held);
  g.scale.setScalar(1.2); G3.group.add(g);
  return { g, body, armL, armR, footL, footR, held, yaw: 0, heldSig: null };
}
function syncChef(p, tnow) {
  let ch = G3.chefs.get(p); if (!ch) { ch = makeChef(p); G3.chefs.set(p, ch); }
  const [dx, dy] = p.dir, target = Math.atan2(dx, dy); let d = target - ch.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); ch.yaw += d * 0.35;
  const ph = p.walk || 0, moving = (p.spd || 0) > 0.3, bob = moving ? Math.abs(Math.sin(ph)) * 0.08 : Math.sin(tnow * 3 + p.x) * 0.012, sq = moving ? Math.sin(ph * 2) * 0.05 : 0;
  ch.g.position.set(p.x, 0, p.y); ch.g.rotation.y = ch.yaw;
  ch.body.position.y = bob; ch.body.scale.set(1 + sq, 1 - sq, 1 + sq);
  const sw = moving ? Math.sin(ph) * 0.12 : 0;
  ch.armL.position.z = 0.06 + sw + (p.item ? 0.16 : 0); ch.armR.position.z = 0.06 - sw + (p.item ? 0.16 : 0);
  ch.footL.position.z = 0.04 + (moving ? Math.sin(ph) * 0.12 : 0); ch.footR.position.z = 0.04 - (moving ? Math.sin(ph) * 0.12 : 0);
  ch.footL.position.y = 0.06 + (moving ? Math.max(0, Math.sin(ph)) * 0.06 : 0); ch.footR.position.y = 0.06 + (moving ? Math.max(0, -Math.sin(ph)) * 0.06 : 0);
  const sg = itemSig(p.item);
  if (sg !== ch.heldSig) { ch.heldSig = sg; clearGroup(ch.held); buildItem3(p.item, ch.held, 0.9); }
  ch.held.position.y = 0.62 + bob;
}

// ---- 1フレーム描画 ----
function render3D(tnow) {
  if (!G3.group) return;
  for (const [c, rec] of G3.tiles) {
    const s = dynSig(c);
    if (s !== rec.sig) { rec.sig = s; clearGroup(rec.dyn); buildDyn(c, rec.dyn); }
  }
  for (const p of players) syncChef(p, tnow);
  if (G3.belts.length) for (const d of new Set(G3.belts)) drawBeltTex(d, tnow);
  const cam = G3.camera;
  cam.position.copy(G3.base);
  if (shake > 0) { cam.position.x += (Math.random() - 0.5) * shake * 0.5; cam.position.y += (Math.random() - 0.5) * shake * 0.3; }
  cam.lookAt(W / 2, 0.4, H / 2);
  G3.r.render(G3.scene, cam);
}
const _v = G3.ok ? new THREE.Vector3() : null;
function proj(x, y, z) {                                 // 世界(マス座標, 高さ) → 画面(960x640)
  _v.set(x, z, y).project(G3.camera);
  return { x: (_v.x + 1) / 2 * 960, y: (1 - _v.y) / 2 * 640, d: _v.z };
}
const ppt = (x, y, z) => { const a = proj(x, y, z), b = proj(x + 1, y, z); return Math.abs(b.x - a.x); };   // 1マスの画面上の幅

// ---- 3Dの上に重ねる2D(進行バー・数・吹き出し・名前・エフェクト) ----
function bar3(x, y, f, col, flash, z = 0.95) {
  const p = proj(x + 0.5, y + 1.0, z), k = ppt(x, y, z), w = k * 0.78, h = Math.max(7, k * 0.12);
  rr(p.x - w / 2, p.y - h / 2, w, h, h / 2); paint("rgba(58,43,87,.6)");
  if (f > 0.02) { rr(p.x - w / 2, p.y - h / 2, Math.max(h, w * Math.min(1, f)), h, h / 2); paint(flash && ((performance.now() / 160) | 0) % 2 ? "#fff" : col); }
  rr(p.x - w / 2, p.y - h / 2, w, h, h / 2); ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; ctx.stroke();
}
function pill3(label, x, y, z, fill = "#fff", col = PAL.ink, size = 14) {
  const p = proj(x, y, z), k = Math.max(0.7, Math.min(1.4, ppt(x, y, z) / 64)), s = size * k;
  ctx.font = `800 ${s}px ${FONT_BODY}`; const w = ctx.measureText(label).width + 14 * k;
  rr(p.x - w / 2, p.y - s * 0.8, w, s * 1.6, s * 0.8); paint(fill, PAL.ink, 2.5); txt(label, p.x, p.y + 1, s, "center", col);
}
function bubble3(label, p, k, size = 14) {
  ctx.font = `800 ${size * k}px ${FONT_BODY}`; const w = Math.max(40 * k, ctx.measureText(label).width + 18 * k), h = size * k * 1.7;
  rr(p.x - w / 2, p.y - h, w, h, h / 2); paint("#fff", PAL.ink, 2.5);
  ctx.beginPath(); ctx.moveTo(p.x - 5 * k, p.y - 1); ctx.lineTo(p.x, p.y + 7 * k); ctx.lineTo(p.x + 5 * k, p.y - 1); paint("#fff", PAL.ink, 2.5);
  ctx.beginPath(); ctx.moveTo(p.x - 3.5 * k, p.y - 2); ctx.lineTo(p.x + 3.5 * k, p.y - 2); ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.stroke();
  txt(label, p.x, p.y - h / 2 + 1, size * k, "center", PAL.ink);
}
function drawFx3D() {
  for (const f of fx) {
    const a = Math.max(0, Math.min(1, f.life / f.max)), p = proj(f.x, f.y0, 0.95 + (f.h || 0)), k = Math.max(0.7, Math.min(1.5, ppt(f.x, f.y0, 1) / 64));
    ctx.globalAlpha = f.type === "puff" ? a * 0.7 : a;
    if (f.type === "star") star5(p.x, p.y, f.size * k * (0.6 + a * 0.5), f.col, PAL.ink);
    else if (f.type === "crumb") { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(f.rot); ctx.fillStyle = f.col; ctx.fillRect(-f.size * k / 2, -f.size * k / 2, f.size * k, f.size * k); ctx.restore(); }
    else if (f.type === "puff") circ(p.x, p.y, f.size * k * (1.6 - a * 0.6), f.col);
    else if (f.type === "ring") { ctx.beginPath(); ctx.arc(p.x, p.y, f.size * k, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = f.col; ctx.stroke(); }
    else if (f.type === "emoji") emo(f.ch, p.x, p.y, f.size * k);
    else circ(p.x, p.y, f.size * k * a, f.col);
    ctx.globalAlpha = 1;
  }
}
const dark3 = document.createElement("canvas"); dark3.width = 960; dark3.height = 640;
function drawOverlay3D(tnow) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = tiles[y][x], t = c.t;
    if (isCooker(t)) {
      if (c.stove === "cooking") bar3(x, y, Math.min(1, c.prog / c.need), PAL.mint);
      else if (c.stove === "done") bar3(x, y, Math.min(1, (c.prog - c.need) / (14 / stage.burn)), PAL.sun, true);
    } else if (t === "C" && c.prog > 0 && c.item) bar3(x, y, c.prog / chopTime, PAL.mint);
    else if (t === "Z") { if (c.dirty) pill3(`🍽×${c.dirty}`, x + 0.5, y + 1.0, 0.95, "#fff", PAL.ink, 13); if (c.prog > 0 && c.dirty) bar3(x, y, c.prog / washTime, PAL.sky, false, 0.8); }
    else if (t === "P") pill3(`×${plates}`, x + 0.5, y + 1.0, 0.95, "#fff", plates ? PAL.ink : PAL.tomato, 14);
    else if (CRATE[t] && c.stock !== null) pill3(`×${c.stock}`, x + 0.5, y + 1.0, 0.95, c.stock ? "#fff" : "#ffd9d9", c.stock ? PAL.ink : PAL.tomato, 13);
    else if (t === "B") {
      const tb = c.tb, k = Math.max(0.7, Math.min(1.4, ppt(x, y, 0.7) / 64));
      pill3(String(tb.id), x + 0.12, y + 0.12, 0.7, "#fff", PAL.ink, 12);
      if (tb.state === "order") { bubble3("💬", proj(x + 0.5, y + 0.5, 1.62), k, 16); bar3(x, y, tb.t / tb.max, PAL.sun, false, 0.7); }
      else if (tb.state === "wait") { bubble3(ticketIcons(tb.ticket.r), proj(x + 0.5, y + 0.5, 1.62), k, 13); bar3(x, y, Math.max(0, tb.ticket.t / tb.ticket.max), tb.ticket.t < 15 ? PAL.tomato : PAL.mint, false, 0.7); }
      else if (tb.state === "eat") bar3(x, y, 1 - tb.t / tb.max, PAL.sky, false, 0.7);
      else if (tb.state === "pay") { bubble3("💰", proj(x + 0.5, y + 0.5, 1.62), k, 16); bar3(x, y, tb.t / tb.max, PAL.sun, false, 0.7); }
    }
  }
  drawFx3D();
  for (const p of players) {
    const k = Math.max(0.75, Math.min(1.4, ppt(p.x, p.y, 0.5) / 64));
    if (p.ai) {
      const a = proj(p.x, p.y, 1.28); ctx.font = `800 ${14 * k}px ${FONT_BODY}`; const w = ctx.measureText(p.name).width + 24 * k;
      rr(a.x - w / 2, a.y - 10 * k, w, 20 * k, 10 * k); paint(p.col, "#fff", 2.5); txt("🤖" + p.name, a.x, a.y + 0.5, 14 * k, "center", "#fff", PAL.ink);
      if (p.sayT > 0 && p.say) bubble3(p.say.length > 28 ? p.say.slice(0, 27) + "…" : p.say, proj(p.x, p.y, 1.62), k, 15);
    } else {
      const a = proj(p.x, p.y, 1.3), me = players.indexOf(p) + 1;
      ctx.beginPath(); ctx.moveTo(a.x - 7 * k, a.y - 6 * k); ctx.lineTo(a.x + 7 * k, a.y - 6 * k); ctx.lineTo(a.x, a.y + 3 * k); ctx.closePath(); paint(p.col, "#fff", 2.5);
      txt(me + "P", a.x, a.y - 17 * k, 14 * k, "center", "#fff", PAL.ink);
    }
  }
  if (isEv("blackout")) {
    const dc = dark3.getContext("2d");
    dc.globalCompositeOperation = "source-over"; dc.fillStyle = "rgba(33,22,60,.9)"; dc.fillRect(0, 0, 960, 640);
    dc.globalCompositeOperation = "destination-out";
    for (const p of players) {
      const a = proj(p.x, p.y, 0.5), r = ppt(p.x, p.y, 0.5) * 2.2, g = dc.createRadialGradient(a.x, a.y, r * 0.15, a.x, a.y, r);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); dc.fillStyle = g; dc.fillRect(a.x - r, a.y - r, r * 2, r * 2);
    }
    ctx.drawImage(dark3, 0, 0);
  }
  for (const q of popups) {
    const a = proj(q.x, q.y0 === undefined ? q.y : q.y0, 1.3 + (1.2 - q.life) * 0.7), k = Math.max(0.75, Math.min(1.4, ppt(q.x, q.y, 1) / 64));
    ctx.globalAlpha = Math.min(1, q.life * 2.2); txt(q.txt, a.x, a.y, 22 * k, "center", q.col, PAL.ink, FONT_POP); ctx.globalAlpha = 1;
  }
}

if (G3.ok && typeof getGfx === "function") applyQuality(getGfx());
