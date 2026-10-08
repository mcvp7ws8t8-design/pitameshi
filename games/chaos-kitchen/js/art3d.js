"use strict";
// 立体表示(Three.js): オーバークックのように、少し傾けたカメラからブロック状の厨房を見下ろす。
// WebGL が使えないときは art.js の2D表示に戻る。ゲームの動き(game.js)は一切変えない。
const G3 = { ok: false };
(function initG3() {
  try {
    if (typeof THREE === "undefined") return;
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
// ---- 共有の形・材質・絵 ----
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
    spriteOf(emojiTex(ING[CRATE[t]].emoji), 0.8, px, CTOP + 0.78, pz + 0.02, g);
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

// 動く部分(アイテム・鍋の中身・お客さん)。状態が変わったときだけ作り直す
function buildItem3(it, g, s = 1) {
  if (!it) return;
  if (it.kind === "dirty") { cyl(0.3 * s, 0.04, "#cdb89a", 0, 0.02, 0, g); cyl(0.2 * s, 0.045, "#b9a283", 0, 0.025, 0, g, { cast: false }); spriteOf(emojiTex("💧"), 0.3 * s, 0.14 * s, 0.22, 0.05, g); return; }
  if (it.kind === "plate") {
    cyl(0.31 * s, 0.04, "#ffffff", 0, 0.02, 0, g); cyl(0.2 * s, 0.045, "#e6eeff", 0, 0.025, 0, g, { cast: false });
    const n = it.contents.length, sp = n > 2 ? 0.24 : 0.3;
    it.contents.forEach((c, i) => spriteOf(itemTex(c.type, c.state), (n > 2 ? 0.36 : 0.44) * s, (i - (n - 1) / 2) * sp * s, 0.3 * s, 0.02, g));
    return;
  }
  const sh = new THREE.Mesh(PLANEG, M("#3a2b57", { transparent: true, opacity: 0.22 })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.01; sh.scale.set(0.38 * s, 0.38 * s, 1); g.add(sh);
  spriteOf(itemTex(it.type, it.state), 0.62 * s, 0, 0.36 * s, 0, g);
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
    if (c.sitem && act) spriteOf(itemTex(c.sitem.type, c.stove === "done" ? c.res : "raw"), 0.6, 0, 0.78, -0.04, g);
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

const sharedGeos = G3.ok ? new Set([BOXG, CYLG, SPHG, PLANEG]) : null;
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
