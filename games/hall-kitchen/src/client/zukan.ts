// @ts-nocheck
// 食材と料理の3Dモデル(コードだけで作る、細かい形のもの)。「食材と料理の3D図鑑」のアーティファクトのコードを、
// ゲームに取り込んだもの。元は three r128 の書き方なので型は見ていない(上の ts-nocheck)。
// 呼び出し側は items.ts。ここは「形を作って、材質ごとに1つのメッシュにまとめる」ところまで。
// 色は r128 の見た目に合わせて、16進の値をそのまま(線形の値として)材質に入れている。

import * as THREE from "three";

const T = THREE, PI = Math.PI;
let seed = 11;
const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const rr = (a, b) => a + R() * (b - a);
const nz = (x, y, z) => Math.sin(x * 1.7 + y * 2.3) * Math.sin(y * 1.9 + z * 2.7) * Math.sin(z * 2.1 + x * 1.3);

/* ---------- materials / mesh helpers ---------- */
const MC = {};
function M(col, rough, metal) {
  const k = col + '|' + rough + '|' + metal;
  if (MC[k]) return MC[k];
  const m = new T.MeshStandardMaterial({ roughness: rough, metalness: metal, side: T.DoubleSide });
  m.color.setHex(col, T.LinearSRGBColorSpace);
  return (MC[k] = m);
}
function A(g, geo, col, p, o) {
  o = o || {};
  const m = new T.Mesh(geo, M(col, o.rough === undefined ? 0.6 : o.rough, o.metal || 0));
  if (p) m.position.set(p[0], p[1], p[2]);
  if (o.r) m.rotation.set(o.r[0], o.r[1], o.r[2]);
  if (o.s !== undefined) { if (typeof o.s === 'number') m.scale.setScalar(o.s); else m.scale.set(o.s[0], o.s[1], o.s[2]); }
  g.add(m); return m;
}
function sub(g, p, r, s) {
  const q = new T.Group();
  if (p) q.position.set(p[0], p[1], p[2]);
  if (r) q.rotation.set(r[0], r[1], r[2]);
  if (s !== undefined && s !== null) { if (typeof s === 'number') q.scale.setScalar(s); else q.scale.set(s[0], s[1], s[2]); }
  g.add(q); return q;
}

/* ---------- geometry helpers ---------- */
const sph = (r, w, h) => new T.SphereGeometry(r, w || 28, h || 18);
const cyl = (rt, rb, h, s, open) => new T.CylinderGeometry(rt, rb, h, s || 28, 1, !!open);
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
function weld(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4);
    let a = map.get(k); if (!a) map.set(k, a = [0, 0, 0, []]);
    a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); a[3].push(i);
  }
  map.forEach(a => { if (a[3].length > 1) { const l = Math.hypot(a[0], a[1], a[2]) || 1; a[3].forEach(i => n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l)); } });
}
function D(geo, fn) {
  const p = geo.attributes.position, v = new T.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, i); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals(); weld(geo); return geo;
}
function flat(geo) { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); return g; }
function rbox(w, h, d, r, n) {
  r = r === undefined ? 0.05 : r; n = n || 5;
  const g = new T.BoxGeometry(w, h, d, n, n, n), p = g.attributes.position, nn = g.attributes.normal;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r, v = new T.Vector3(), c = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    v.sub(c); if (v.lengthSq() < 1e-10) continue;
    v.normalize(); nn.setXYZ(i, v.x, v.y, v.z); p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
  }
  return g;
}
function lathe(pts, seg, smooth) {
  let v = pts.map(p => new T.Vector2(p[0], p[1]));
  if (smooth !== false) v = new T.SplineCurve(v).getPoints(pts.length * 5);
  v.forEach(p => { if (p.x < 0) p.x = 0; });
  return new T.LatheGeometry(v, seg || 36);
}
function tube(pts, r, seg, rs, closed) {
  const c = new T.CatmullRomCurve3(pts.map(p => new T.Vector3(p[0], p[1], p[2])), !!closed);
  return new T.TubeGeometry(c, seg || pts.length * 5, r, rs || 8, !!closed);
}
function capsule(r, len, seg) {
  const pts = [], n = 6;
  for (let i = 0; i <= n; i++) { const a = -PI / 2 + i / n * PI / 2; pts.push([Math.cos(a) * r, -len / 2 + Math.sin(a) * r]); }
  for (let i = 0; i <= n; i++) { const a = i / n * PI / 2; pts.push([Math.cos(a) * r, len / 2 + Math.sin(a) * r]); }
  return lathe(pts, seg || 18, false);
}
function ext(shape, depth, bev) {
  const g = new T.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: !!bev, bevelSize: bev || 0, bevelThickness: bev || 0, bevelSegments: 3, curveSegments: 14, steps: 1 });
  g.translate(0, 0, -depth / 2); return g;
}
function rpoly(pts, r) {
  const s = new T.Shape(), n = pts.length, V = i => new T.Vector2(pts[(i + n) % n][0], pts[(i + n) % n][1]);
  for (let i = 0; i < n; i++) {
    const p = V(i), a = V(i - 1).sub(p).normalize().multiplyScalar(r).add(p), b = V(i + 1).sub(p).normalize().multiplyScalar(r).add(p);
    if (i) s.lineTo(a.x, a.y); else s.moveTo(a.x, a.y);
    s.quadraticCurveTo(p.x, p.y, b.x, b.y);
  }
  s.closePath(); return s;
}
function sector(Rr, a) { const s = new T.Shape(); s.moveTo(0, 0); s.lineTo(Rr, 0); s.absarc(0, 0, Rr, 0, a, false); s.lineTo(0, 0); return s; }
function blob(sx, sy, sz, amp, f, off) {
  amp = amp === undefined ? 0.06 : amp; f = f || 3; off = off || 0;
  return D(sph(1, 28, 18), v => { const n = 1 + amp * nz(v.x * f + off, v.y * f + off * 2, v.z * f - off); v.set(v.x * sx * n, v.y * sy * n, v.z * sz * n); });
}
/* flat slab with soft edge: steaks, patties, puddles */
function outlineK(a, k, off) { return 1 + k * (0.5 * Math.sin(2 * a + off) + 0.3 * Math.sin(3 * a + off * 2) + 0.2 * Math.sin(5 * a + off * 3)); }
function slab(sx, sz, th, k, off) {
  k = k || 0; off = off || 0;
  return D(sph(1, 44, 18), v => {
    const a = Math.atan2(v.z, v.x), n = outlineK(a, k, off), rxy = Math.hypot(v.x, v.z), e = rxy > 1e-6 ? Math.pow(rxy, 0.55) / rxy : 0;
    v.x *= sx * n * e; v.z *= sz * n * e; v.y = Math.sign(v.y) * Math.pow(Math.abs(v.y), 0.35) * th;
  });
}
function rim(g, sx, sz, k, off, a0, a1, y, r, col, o) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24, n = outlineK(a, k, off); pts.push([Math.cos(a) * sx * n, y, Math.sin(a) * sz * n]); }
  return A(g, tube(pts, r, 80, 8), col, null, o);
}
const rc = new T.Raycaster(), dn = new T.Vector3(0, -1, 0);
function dropper(root, targets) {
  root.updateMatrixWorld(true); const arr = [].concat(targets);
  return (x, z) => { rc.set(new T.Vector3(x, 9, z), dn); const h = rc.intersectObjects(arr); return h.length ? h[0].point.y : null; };
}
function zig(g, dy, x0, x1, zf, amp, waves, r, col, rough) {
  const pts = [], N = 130;
  for (let i = 0; i <= N; i++) { const t = i / N, x = x0 + t * (x1 - x0), z = zf(x) + amp * Math.sin(t * PI * waves), y = dy(x, z); if (y !== null) pts.push([x, y + r * 0.3, z]); }
  if (pts.length < 4) return;
  A(g, tube(pts, r, pts.length * 3, 8), col, null, { rough: rough === undefined ? 0.2 : rough });
  [pts[0], pts[pts.length - 1]].forEach(p => A(g, sph(r * 1.25, 10, 8), col, p, { rough: 0.2 }));
}

/* ---------- shared parts ---------- */
function plate(g, Rr, col, s) {
  Rr = Rr || 1.2;
  const m = A(g, lathe([[0, 0], [Rr * .62, 0], [Rr * .75, .02], [Rr * .97, .1], [Rr, .12], [Rr * .99, .14], [Rr * .94, .13], [Rr * .75, .055], [Rr * .62, .036], [0, .032]], 56), col || 0xfaf8f3, null, { rough: 0.22 });
  if (s) m.scale.set(s[0], s[1], s[2]);
  return 0.036;
}
function bowl(g, Rr, H, cOut, cIn, cRim) {
  A(g, lathe([[0, 0], [Rr * .4, 0], [Rr * .43, .04], [Rr * .7, H * .45], [Rr * .95, H * .9], [Rr, H]], 44), cOut, null, { rough: 0.3 });
  A(g, lathe([[Rr, H], [Rr * .93, H * .9], [Rr * .66, H * .45], [Rr * .38, .08], [0, .07]], 44), cIn === undefined ? cOut : cIn, null, { rough: 0.3 });
  A(g, new T.TorusGeometry(Rr * .99, .018, 8, 44), cRim === undefined ? cOut : cRim, [0, H, 0], { r: [PI / 2, 0, 0], rough: 0.3 });
}
function calyx(g, y, s, n, col) {
  s = s || 1; n = n || 5;
  for (let i = 0; i < n; i++) { const q = sub(g, [0, y, 0], [0, i / n * 2 * PI, 0]); A(q, new T.ConeGeometry(.07 * s, .3 * s, 6), col || 0x3d7a22, [.14 * s, 0, 0], { r: [0, 0, -PI / 2 - .2], s: [.3, 1, 1.5] }); }
  A(g, cyl(.025 * s, .035 * s, .16 * s, 8), 0x4f7a2a, [0, y + .07 * s, 0]);
}
function riceGeo() {
  return D(sph(1, 44, 26), v => { const n = 1 + .03 * nz(v.x * 13, v.y * 13, v.z * 13) + .05 * nz(v.x * 3, v.y * 3, v.z * 3); v.multiplyScalar(n); if (v.y < 0) v.y *= .15; });
}
const RICE = 0xf7f5ee;
function noodles(g, col, Rr, H, n, r, y0) {
  r = r || .022; y0 = y0 || 0;
  for (let i = 0; i < n; i++) {
    const pts = [], a0 = rr(0, 6.28), rad = rr(.25, 1) * Rr, k = Math.floor(rr(2, 5)), ph = rr(0, 6.28), m = 26, lift = rr(.8, 1);
    for (let j = 0; j < m; j++) {
      const t = j / m * 2 * PI, r2 = rad * (1 + .25 * Math.sin(k * t + ph)), x = Math.cos(t + a0) * r2, z = Math.sin(t + a0) * r2, d = Math.min(1, Math.hypot(x, z) / Rr);
      pts.push([x, y0 + H * (1 - d * d) * lift + .025 * Math.sin(3 * t + ph) + r, z]);
    }
    A(g, tube(pts, r, 80, 6, true), col, null, { rough: 0.4 });
  }
}
function leafBall(g, Rr, cols, n, ruffle, step, open) {
  for (let i = 0; i < n; i++) {
    let geo = new T.SphereGeometry(Rr * (1 + i * step), 30, 16, 0, rr(2.0, 3.3), rr(.1, .45) * open, rr(1.5, 2.1));
    if (ruffle) geo = D(geo, v => { v.multiplyScalar(1 + ruffle * Math.sin(Math.atan2(v.z, v.x) * 15 + v.y * 12 / Rr)); });
    A(g, geo, cols[i % cols.length], null, { r: [rr(-.45, .45), rr(0, 6.28), rr(-.45, .45)], rough: 0.55 });
  }
}
function broccoli(g, p, s) {
  const q = sub(g, p, [0, rr(0, 6), 0], s || 1);
  A(q, cyl(.05, .06, .16, 8), 0x9cc566, [0, .08, 0]);
  for (let i = 0; i < 11; i++) { const a = rr(0, 6.28), d = rr(0, .11); A(q, flat(sph(rr(.07, .095), 7, 5)), 0x2f7d2a, [Math.cos(a) * d, .2 + .08 * (1 - d / .11) + rr(-.02, .02), Math.sin(a) * d], { rough: 0.8 }); }
}
function cherry(g, p, s) { s = s || 1; const q = sub(g, p); A(q, sph(.11 * s, 20, 14), 0xd4241c, [0, .11 * s, 0], { rough: 0.18 }); calyx(q, .215 * s, .3 * s, 5); }
function lemonSlice(g, p, r, rot) {
  const q = sub(g, p, rot);
  A(q, ext(sector(r, PI), .045), 0xf4d21f, null, { rough: 0.45 });
  A(q, ext(sector(r * .86, PI), .05), 0xf9f0a8, null, { rough: 0.4 });
}
function breadShape(k) {
  const s = new T.Shape(), X = x => x * k, Y = y => (y - .5) * k + .5;
  s.moveTo(X(-.42), Y(0)); s.lineTo(X(.42), Y(0)); s.lineTo(X(.42), Y(.55));
  s.bezierCurveTo(X(.6), Y(.6), X(.58), Y(1), X(.3), Y(1)); s.lineTo(X(-.3), Y(1));
  s.bezierCurveTo(X(-.58), Y(1), X(-.6), Y(.6), X(-.42), Y(.55)); s.closePath(); return s;
}
function breadSlice(q, crumb, crust) {
  A(q, ext(breadShape(1), .2), crust || 0xc48a48, null, { rough: 0.75 });
  A(q, ext(breadShape(.9), .215), crumb || 0xf6e6c2, null, { rough: 0.85 });
}
function baconStrip(q, len, cols, ph) {
  const ws = [.08, .05, .11, .06]; let z = -.15;
  ws.forEach((w, i) => {
    A(q, D(new T.BoxGeometry(len, .025, w, 48, 1, 1), v => { v.y += .04 * Math.sin(v.x * 10 + ph) + .015 * Math.sin(v.x * 23 + ph); v.z += .025 * Math.sin(v.x * 6 + ph * 2); }), cols[i % 2], [0, .06, z + w / 2], { rough: 0.45 });
    z += w;
  });
}
const sf = v => { const u = v.y, k = u < 0 ? 1 - .5 * Math.pow(-u, 1.6) : 1 - .12 * u * u; v.set(v.x * .36 * k, u < 0 ? u * .52 : u * .3, v.z * .36 * k); return v; };
function strawberry(q) {
  A(q, D(sph(1, 28, 20), sf), 0xd81e2c, [0, .52, 0], { rough: 0.28 });
  for (let i = 0; i < 46; i++) { const v = sf(new T.Vector3(rr(-1, 1), rr(-1, .6), rr(-1, 1)).normalize()); A(q, sph(.016, 5, 4), 0xf3d778, [v.x * 1.01, .52 + v.y, v.z * 1.01], { s: [1, 1.5, 1] }); }
  calyx(q, .8, .85, 7);
}
function swirl(g, p, s, col) {
  const q = sub(g, p, null, s);
  for (let i = 0; i < 4; i++) A(q, flat(sph(.17 - .035 * i, 10, 6)), col, [0, .07 + i * .075, 0], { s: [1, .6, 1], r: [0, i * .5, 0], rough: 0.6 });
  A(q, new T.ConeGeometry(.04, .1, 8), col, [0, .38, 0]);
}
function chunks(g, n, f, where) { for (let i = 0; i < n; i++) { const p = where(); const m = f(); m.position.set(p[0], p[1], p[2]); m.rotation.set(rr(-.4, .4), rr(0, 6), rr(-.4, .4)); } }
function shrimpTail(q, p, r, s) {
  const t = sub(q, p, r, s || 1);
  [-.35, .35].forEach(a => A(t, new T.ConeGeometry(.07, .26, 8), 0xe2452f, [.1 * Math.sin(a) * 1.2, .12, 0], { r: [0, 0, -a], s: [1, 1, .3], rough: 0.4 }));
}

/* ---------- registry ---------- */
const ING = [], DISH = [];
const ing = (id, name, en, cat, fn) => ING.push({ id, name, en, cat, fn, kind: 'ingredient', seed: 101 + ING.length * 37 });
const dish = (id, name, en, recipe, fn) => DISH.push({ id, name, en, recipe, fn, kind: 'dish', seed: 5003 + DISH.length * 53 });

/* ================= INGREDIENTS (40) ================= */
ing('tomato', 'トマト', 'Tomato', '野菜', g => {
  A(g, D(sph(.5, 40, 28), v => { const a = Math.atan2(v.z, v.x), u = v.y / .5, k = 1 + .035 * Math.cos(5 * a) * (1 - u * u); v.x *= k; v.z *= k; v.y *= .84; if (u > .6) v.y -= (u - .6) * .22; }), 0xdf2a1b, [0, .42, 0], { rough: 0.2 });
  calyx(g, .765, 1);
});
ing('onion', '玉ねぎ', 'Onion', '野菜', g => {
  A(g, lathe([[0, 0], [.12, .01], [.36, .12], [.5, .38], [.47, .62], [.3, .82], [.12, .95], [.05, 1.08], [.03, 1.2], [0, 1.21]], 36), 0xd49a3e, null, { rough: 0.3 });
  A(g, cyl(.09, .07, .03, 12), 0xe9dcc0, [0, .005, 0]);
  A(g, new T.ConeGeometry(.035, .14, 8), 0x8a5a2a, [0, 1.22, 0]);
  for (let i = 0; i < 9; i++) { const a = i / 9 * 2 * PI; A(g, tube([[Math.cos(a) * .2, .05, Math.sin(a) * .2], [Math.cos(a) * .505, .42, Math.sin(a) * .505], [Math.cos(a) * .31, .82, Math.sin(a) * .31], [Math.cos(a) * .06, 1.05, Math.sin(a) * .06]], .006, 30, 4), 0xb87a26); }
});
ing('carrot', 'にんじん', 'Carrot', '野菜', g => {
  const q = sub(g, [0, .2, 0], [0, .3, -PI / 2]);
  A(q, lathe([[0, 0], [.03, .01], [.08, .3], [.15, .8], [.2, 1.15], [.19, 1.28], [.1, 1.34], [0, 1.35]], 28), 0xe8751a, null, { rough: 0.5 });
  [.35, .6, .82, 1.02].forEach((y, i) => A(q, new T.TorusGeometry(.088 + (y - .3) * .135, .006, 4, 20, 2 + i), 0xc85f10, [0, y, 0], { r: [PI / 2, 0, i * 1.7] }));
  for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI; A(q, new T.ConeGeometry(.035, .4, 6), i % 2 ? 0x4c9a2e : 0x3d8526, [Math.cos(a) * .05, 1.5, Math.sin(a) * .05], { r: [Math.sin(a) * .35, 0, -Math.cos(a) * .35] }); }
});
ing('potato', 'じゃがいも', 'Potato', '野菜', g => {
  const f = v => { const n = 1 + .09 * nz(v.x * 2.1, v.y * 2.1, v.z * 2.1) + .03 * nz(v.x * 5, v.y * 5, v.z * 5); return v.set(v.x * .62 * n, v.y * .4 * n, v.z * .45 * n); };
  A(g, D(sph(1, 36, 24), f), 0xc9a66b, [0, .4, 0], { rough: 0.85 });
  for (let i = 0; i < 9; i++) { const v = f(new T.Vector3(rr(-1, 1), rr(-.2, 1), rr(-1, 1)).normalize()); A(g, sph(.03, 6, 5), 0x8f6d3c, [v.x * .99, .4 + v.y * .99, v.z * .99], { s: [1, .6, 1], rough: 0.9 }); }
});
ing('cabbage', 'キャベツ', 'Cabbage', '野菜', g => {
  const q = sub(g, [0, .5, 0], null, [1, .88, 1]);
  A(q, sph(.55, 32, 22), 0xc5df8a, null, { rough: 0.6 });
  leafBall(q, .56, [0x9ccc5a, 0xb3d974, 0x86bf4c, 0xc8e392], 10, .012, .007, 1);
});
ing('lettuce', 'レタス', 'Lettuce', '野菜', g => {
  const q = sub(g, [0, .5, 0], null, [1, .85, 1]);
  A(q, sph(.4, 24, 16), 0xe4f2a0, null, { rough: 0.6 });
  leafBall(q, .44, [0x8fce4a, 0xa8dc5c, 0xc4ea7a, 0x7cc23e], 13, .05, .022, 1.8);
});
ing('cucumber', 'きゅうり', 'Cucumber', '野菜', g => {
  const q = sub(g, [0, .14, 0], [0, .2, PI / 2]);
  A(q, D(capsule(.13, 1.3, 20), v => { v.z += .13 * v.y * v.y; const k = 1 + .03 * nz(v.x * 30, v.y * 14, v.z * 30); v.x *= k; }), 0x2e6b2c, null, { rough: 0.45 });
  A(q, cyl(.03, .04, .05, 8), 0x6f8f3a, [0, .79, .13 * .62]);
});
ing('eggplant', 'なす', 'Eggplant', '野菜', g => {
  const q = sub(g, [0, .28, 0], [0, .3, PI / 2 - .05]), bend = v => { v.z += .12 * (v.y - .7) * (v.y - .7); };
  A(q, D(lathe([[0, 0], [.12, .02], [.24, .18], [.27, .45], [.22, .8], [.15, 1.1], [.11, 1.3], [.09, 1.36]], 28), bend), 0x3a1a4e, null, { rough: 0.14 });
  A(q, D(lathe([[.17, 1.12], [.145, 1.26], [.1, 1.38], [.04, 1.42], [0, 1.42]], 14), bend), 0x4a6b2a, null, { rough: 0.6 });
  A(q, cyl(.03, .04, .2, 8), 0x55702c, [0, 1.5, .12 * .64], { r: [.25, 0, 0] });
});
ing('green_pepper', 'ピーマン', 'Green pepper', '野菜', g => {
  A(g, D(sph(.42, 40, 28), v => { const a = Math.atan2(v.z, v.x), u = v.y / .42, k = (1 + .15 * Math.cos(3 * a) * (1 - .5 * u * u)) * (.84 + .16 * u); v.x *= k; v.z *= k; v.y *= 1.3; if (u > .7) v.y -= (u - .7) * .5; if (u < 0) v.y -= .06 * Math.cos(3 * a) * u * u; }), 0x1f7a2a, [0, .6, 0], { rough: 0.2 });
  A(g, cyl(.045, .06, .22, 10), 0x3d6b22, [0, 1.07, 0], { r: [0, 0, .15] });
});
ing('negi', '長ねぎ', 'Green onion', '野菜', g => {
  const q = sub(g, [0, .08, 0], [0, .25, PI / 2]);
  A(q, cyl(.075, .075, .9, 16), 0xf4f2e6, [0, .45, 0], { rough: 0.45 });
  A(q, cyl(.07, .075, .25, 16), 0xcfe3a0, [0, 1.02, 0]);
  A(q, cyl(.06, .08, .03, 12), 0xd9c9a0, [0, -.015, 0]);
  [[-.04, .07], [.04, -.07], [0, .0]].forEach((d, i) => { A(q, cyl(.035, .055, .8, 10), i == 2 ? 0x4a973d : 0x3f8a35, [d[0] * 2, 1.52, i == 2 ? .03 : 0], { r: [i == 2 ? .08 : 0, 0, d[1]] }); A(q, new T.ConeGeometry(.035, .12, 10), 0x3f8a35, [d[0] * 2 - d[1] * .42, 1.97, i == 2 ? .065 : 0], { r: [0, 0, d[1]] }); });
});
ing('garlic', 'にんにく', 'Garlic', '野菜', g => {
  A(g, D(lathe([[0, 0], [.2, .02], [.4, .2], [.42, .4], [.28, .62], [.1, .78], [.05, .95], [.045, 1.05], [0, 1.06]], 42), v => { const a = Math.atan2(v.z, v.x), k = 1 + .09 * Math.cos(6 * a) * Math.max(0, 1 - v.y / .75); v.x *= k; v.z *= k; }), 0xf3ecdc, null, { s: .8, rough: 0.5 });
  A(g, cyl(.09, .07, .02, 12), 0xb99b6b, [0, .003, 0]);
});
ing('lemon', 'レモン', 'Lemon', '果物', g => {
  const q = sub(g, [0, .33, 0], [0, .3, PI / 2]);
  A(q, lathe([[0, 0], [.05, .02], [.09, .07], [.26, .25], [.33, .5], [.26, .75], [.09, .93], [.05, .98], [0, 1.0]], 32), 0xf4d21f, [0, -.5, 0], { rough: 0.4 });
  A(q, cyl(.02, .03, .03, 8), 0x6f8f3a, [0, .51, 0]);
});
ing('strawberry', 'いちご', 'Strawberry', '果物', g => { strawberry(g); });
ing('egg', '卵', 'Egg', '肉・魚・卵', g => {
  A(g, D(sph(.36, 32, 24), v => { const t = Math.max(0, v.y / .36); v.y *= v.y > 0 ? 1.35 : 1.05; v.x *= 1 - .2 * t * t; v.z *= 1 - .2 * t * t; }), 0xf1d3b0, [0, .378, 0], { rough: 0.45 });
});
ing('chicken', '鶏肉', 'Chicken', '肉・魚・卵', g => {
  const q = sub(g, [0, .36, 0], [0, .3, PI / 2 + .12]);
  A(q, D(sph(1, 32, 24), v => { const w = (.36 - .13 * v.y) * (1 + .05 * nz(v.x * 4, v.y * 4, v.z * 4)); v.set(v.x * w, v.y * .5, v.z * w); }), 0xf0b3a0, null, { rough: 0.5 });
  A(q, cyl(.05, .06, .5, 12), 0xf4efe2, [0, .7, 0]);
  A(q, sph(.075, 12, 10), 0xf4efe2, [.05, .96, 0]); A(q, sph(.075, 12, 10), 0xf4efe2, [-.05, .96, 0]);
});
ing('beef', '牛肉', 'Beef', '肉・魚・卵', g => {
  A(g, slab(.75, .5, .09, .2, 0), 0xa82428, [0, .09, 0], { rough: 0.45 });
  rim(g, .75, .5, .2, 0, .4, 2.9, .09, .075, 0xf3e6d2, { rough: 0.5 });
  for (let i = 0; i < 7; i++) { const x = rr(-.45, .45), z = rr(-.25, .2); A(g, tube([[x, .182, z], [x + rr(.05, .12), .184, z + rr(-.06, .06)], [x + rr(.15, .25), .182, z + rr(-.1, .1)]], .009, 14, 4), 0xf0d6c8); }
});
ing('pork', '豚肉', 'Pork', '肉・魚・卵', g => {
  [[0, 0, 0, 0], [.18, .07, .12, .5]].forEach((p, i) => {
    const q = sub(g, [p[0], p[1], p[2]], [0, p[3], i * .06]);
    A(q, slab(.7, .42, .035, .15, 1 + i), 0xf2a7a0, [0, .035, 0], { rough: 0.5 });
    rim(q, .7, .42, .15, 1 + i, 3.4, 5.9, .035, .04, 0xfaf0e4, { rough: 0.5 });
  });
});
ing('ground_meat', 'ひき肉', 'Ground meat', '肉・魚・卵', g => {
  A(g, rbox(1.5, .12, 1.1, .05), 0xf4f4f0, [0, .06, 0], { rough: 0.8 });
  const cols = [0xd9534a, 0xe06a5c, 0xcf4840, 0xf0b0a0], cg = capsule(.028, .15, 6);
  for (let i = 0; i < 130; i++) { const x = rr(-.6, .6), z = rr(-.4, .4), d = (x * x) / .36 + (z * z) / .16; if (d > 1) continue; A(g, cg, cols[i % 4], [x, .13 + .16 * (1 - d) * rr(.6, 1), z], { r: [rr(0, 3), rr(0, 3), rr(0, 3)], rough: 0.5 }); }
});
ing('bacon', 'ベーコン', 'Bacon', '肉・魚・卵', g => {
  for (let s = 0; s < 3; s++) baconStrip(sub(g, [0, s == 1 ? .02 : 0, (s - 1) * .36], [0, (s - 1) * .08, 0]), 1.7, [0xb5382e, 0xf3d9c4], s * 1.3);
});
ing('sausage', 'ソーセージ', 'Sausage', '肉・魚・卵', g => {
  [[-.28, 0, .1], [.02, 0, -.05], [-.13, .19, .0]].forEach((p, i) => {
    const q = sub(g, [0, .11 + p[1], p[0]], [0, p[2], PI / 2]);
    A(q, D(capsule(.11, .75, 16), v => { v.z += .25 * v.y * v.y; }), 0xb24a32, null, { rough: 0.22 });
    [-1, 1].forEach(s => A(q, sph(.03, 8, 6), 0x8a3a26, [0, s * .49, .25 * .24]));
  });
});
ing('salmon', '鮭', 'Salmon', '肉・魚・卵', g => {
  A(g, slab(.7, .38, .11, .3, 2), 0xf0764a, [0, .11, 0], { rough: 0.4 });
  rim(g, .7, .38, .3, 2, 3.5, 6.0, .1, .06, 0x9aa3a8, { rough: 0.3, metal: 0.4 });
  const dy = dropper(g, g.children[0]);
  for (let i = 0; i < 7; i++) { const x = -.5 + i * .16, pts = []; for (let j = 0; j <= 6; j++) { const z = -.26 + j * .09, xx = x + .07 * (1 - Math.abs(j - 3) / 3), y = dy(xx, z); if (y !== null) pts.push([xx, y + .002, z]); } if (pts.length > 2) A(g, tube(pts, .011, 20, 4), 0xf9cdb8); }
});
ing('tuna', 'まぐろ', 'Tuna', '肉・魚・卵', g => {
  A(g, rbox(1.3, .32, .5, .04), 0x9e1b2c, [0, .16, 0], { rough: 0.32 });
  for (let i = 0; i < 8; i++) { const x = -.58 + i * .15; A(g, tube([[x, .322, -.24], [x + .1, .323, 0], [x + .12, .322, .24]], .007, 10, 4), 0xc2475a); A(g, tube([[x + .12, .3, .252], [x + .16, .16, .252], [x + .12, .03, .252]], .007, 10, 4), 0xc2475a); }
});
ing('shrimp', 'えび', 'Shrimp', '肉・魚・卵', g => {
  const q = sub(g, [0, .2, 0], [PI / 2, 0, 0]), Rr = .42; let last;
  for (let i = 0; i < 9; i++) { const t = i / 8, a = -.4 + t * 3.7, r = .2 * (1 - .62 * t) + .02; last = [Math.cos(a) * Rr, Math.sin(a) * Rr, a]; A(q, sph(r, 16, 12), i % 2 ? 0xf7b79c : 0xf08c6a, [last[0], last[1], 0], { s: [1, 1, .85], rough: 0.35 }); }
  shrimpTail(q, [last[0], last[1], 0], [0, 0, last[2]], 1);
  [-1, 1].forEach(s => { A(q, sph(.028, 8, 6), 0x111111, [Math.cos(-.75) * Rr + .05, Math.sin(-.75) * Rr - .02, s * .12], { rough: 0.2 }); A(q, tube([[Math.cos(-.6) * Rr, Math.sin(-.6) * Rr, s * .08], [.75, -.5, s * .2], [1.0, -.3, s * .3]], .008, 16, 4), 0xe2452f); });
});
ing('tofu', '豆腐', 'Tofu', '肉・魚・卵', g => {
  A(g, rbox(.9, .5, .65, .03), 0xf7f3e4, [0, .25, 0], { rough: 0.75 });
  A(g, rbox(.3, .3, .3, .02), 0xf7f3e4, [.72, .15, .12], { r: [0, .4, 0], rough: 0.75 });
});
ing('rice', '米', 'Rice', '主食', g => {
  const W = 0xd8b47a;
  A(g, box(1, .06, 1), W, [0, .03, 0], { rough: 0.7 });
  [[0, .465, 1, .07], [0, -.465, 1, .07], [.465, 0, .07, .93], [-.465, 0, .07, .93]].forEach(w => A(g, box(w[2], .6, w[3]), W, [w[0], .3, w[1]], { rough: 0.7 }));
  A(g, D(new T.BoxGeometry(.87, .1, .87, 24, 1, 24), v => { if (v.y > 0) v.y += .03 * nz(v.x * 14, 0, v.z * 14) + .08 * (1 - (v.x * v.x + v.z * v.z) * 3); }), RICE, [0, .55, 0], { rough: 0.85 });
  const gg = sph(.022, 6, 4);
  for (let i = 0; i < 70; i++) { const out = i > 52, x = out ? rr(-.9, .9) : rr(-.38, .38), z = out ? rr(.55, .85) : rr(-.38, .38); A(g, gg, RICE, [x, out ? .012 : .62 + .08 * (1 - (x * x + z * z) * 3), z], { s: [1, .6, 2.2], r: [0, rr(0, 3), 0] }); }
});
ing('bread', '食パン', 'Bread', '主食', g => { breadSlice(sub(g, null, [-.1, .4, 0])); });
ing('pasta', 'パスタ', 'Pasta', '主食', g => {
  const q = sub(g, [0, .15, 0], [0, .25, PI / 2]), cg = cyl(.016, .016, 1.7, 6);
  [[1, 0], [6, .036], [12, .072], [18, .108]].forEach(k => { for (let i = 0; i < k[0]; i++) { const a = i / k[0] * 2 * PI; A(q, cg, i % 3 ? 0xe9cf7a : 0xe2c46a, [Math.cos(a) * k[1], rr(-.03, .03), Math.sin(a) * k[1]], { rough: 0.5 }); } });
  A(q, cyl(.135, .135, .2, 20), 0xfafafa, null, { rough: 0.7 }); A(q, cyl(.138, .138, .05, 20), 0xc8202a, null, { rough: 0.7 });
});
ing('chinese_noodles', '中華麺', 'Ramen noodles', '主食', g => { noodles(g, 0xf2d977, .55, .28, 18, .028, 0); });
ing('flour', '小麦粉', 'Flour', '主食', g => {
  A(g, rbox(.75, 1.0, .45, .07), 0xefe7d2, [0, .5, 0], { rough: 0.85 });
  A(g, box(.72, .14, .08), 0xe3d9bf, [0, 1.04, 0], { r: [.25, 0, 0], rough: 0.85 });
  A(g, rbox(.77, .42, .47, .07), 0x3b6fb0, [0, .48, 0], { rough: 0.7 });
  A(g, sph(.12, 16, 10), 0xf2c744, [0, .48, .236], { s: [1, 1, .08] });
  A(g, D(sph(1, 24, 14), v => { const n = 1 + .08 * nz(v.x * 4, v.y * 4, v.z * 4); v.set(v.x * .3 * n, Math.max(0, v.y) * .13, v.z * .26 * n); }), 0xfbfaf5, [.72, 0, .22], { rough: 0.95 });
});
ing('breadcrumbs', 'パン粉', 'Breadcrumbs', '主食', g => {
  bowl(g, .6, .4, 0xf5f5f0);
  A(g, flat(D(sph(1, 22, 12), v => { const n = 1 + .12 * nz(v.x * 9, v.y * 9, v.z * 9); v.set(v.x * .5 * n, v.y * .2 * n, v.z * .5 * n); })), 0xe8c98a, [0, .32, 0], { rough: 0.9 });
  for (let i = 0; i < 50; i++) { const a = rr(0, 6.28), d = rr(0, .46), s = rr(.02, .045); A(g, box(s, s, s), i % 2 ? 0xf0d9a8 : 0xd9b06a, [Math.cos(a) * d, .34 + .19 * Math.sqrt(1 - d * d / .25), Math.sin(a) * d], { r: [rr(0, 3), rr(0, 3), 0], rough: 0.9 }); }
});
ing('milk', '牛乳', 'Milk', '乳製品', g => {
  A(g, rbox(.6, 1.0, .6, .02), 0xfafafa, [0, .5, 0], { rough: 0.5 });
  A(g, ext(new T.Shape([new T.Vector2(-.3, 0), new T.Vector2(.3, 0), new T.Vector2(0, .26)]), .6), 0xfafafa, [0, 1.0, 0], { rough: 0.5 });
  A(g, box(.03, .1, .6), 0xe6e6e6, [0, 1.3, 0]);
  A(g, rbox(.61, .34, .61, .02), 0x2f74d0, [0, .42, 0], { rough: 0.5 });
  A(g, cyl(.07, .07, .06, 16), 0x2f74d0, [.16, 1.15, .1], { r: [0, 0, -.72] });
});
ing('butter', 'バター', 'Butter', '乳製品', g => {
  A(g, box(1.3, .012, .75), 0xd9dcdf, [.1, .006, 0], { rough: 0.3, metal: 0.6 });
  A(g, rbox(.9, .34, .48, .03), 0xf7dc6f, [-.08, .182, 0], { rough: 0.4 });
  A(g, rbox(.1, .32, .46, .02), 0xf7dc6f, [.55, .065, .02], { r: [0, .15, PI / 2], rough: 0.4 });
});
ing('cheese', 'チーズ', 'Cheese', '乳製品', g => {
  const Rr = .95, ang = .95;
  A(g, ext(sector(Rr, ang), .42), 0xf4b93a, [0, .21, 0], { r: [-PI / 2, 0, 0], rough: 0.45 });
  for (let i = 0; i < 7; i++) { const r = rr(.25, .82) * Rr, t = rr(.12, .83), s = rr(.04, .08); A(g, sph(s, 12, 8), 0xd48f1c, [r * Math.cos(t), .42, -r * Math.sin(t)], { s: [1, .2, 1] }); }
  for (let i = 0; i < 4; i++) { const s = rr(.04, .075); A(g, sph(s, 12, 8), 0xd48f1c, [rr(.2, .82), rr(.1, .32), 0], { s: [1, 1, .2] }); }
});
ing('salt', '塩', 'Salt', '調味料', g => {
  A(g, lathe([[0, 0], [.2, 0], [.22, .03], [.2, .45], [.15, .6], [.13, .62]], 28), 0xf5f7f8, null, { rough: 0.12 });
  A(g, lathe([[.14, .6], [.145, .72], [.1, .8], [0, .82]], 28), 0xc9ccd0, null, { rough: 0.25, metal: 0.9 });
  for (let i = 0; i < 6; i++) { const a = i / 5 * 2 * PI, d = i == 5 ? 0 : .05; A(g, sph(.012, 6, 4), 0x333333, [Math.cos(a) * d, .815 - d * .2, Math.sin(a) * d]); }
  A(g, flat(D(sph(1, 18, 10), v => { const n = 1 + .1 * nz(v.x * 6, v.y * 6, v.z * 6); v.set(v.x * .22 * n, Math.max(0, v.y) * .1, v.z * .2 * n); })), 0xffffff, [.5, 0, .12], { rough: 0.9 });
});
ing('soy_sauce', 'しょうゆ', 'Soy sauce', '調味料', g => {
  A(g, lathe([[0, 0], [.22, 0], [.3, .06], [.32, .2], [.2, .5], [.13, .62], [.12, .7], [.15, .72]], 32), 0x2a120a, null, { rough: 0.1 });
  A(g, lathe([[.15, .7], [.17, .72], [.17, .82], [.1, .9], [0, .91]], 28), 0xc9201c, null, { rough: 0.3 });
  [-1, 1].forEach(s => A(g, new T.ConeGeometry(.035, .1, 8), 0xc9201c, [s * .19, .8, 0], { r: [0, 0, -s * PI / 2] }));
});
ing('miso', '味噌', 'Miso', '調味料', g => {
  A(g, lathe([[0, 0], [.42, 0], [.5, .5], [.52, .5], [.52, .54], [.47, .54], [.4, .06], [0, .06]], 36, false), 0xf1ead8, null, { rough: 0.5 });
  A(g, cyl(.483, .451, .2, 36, true), 0xc8452a, [0, .28, 0], { rough: 0.6 });
  A(g, D(sph(1, 28, 14), v => { const n = .06 * nz(v.x * 5, 1, v.z * 5); v.set(v.x * .46, Math.max(0, v.y) * .1 + n * Math.max(0, v.y), v.z * .46); }), 0xb9813f, [0, .47, 0], { rough: 0.7 });
});
ing('ketchup', 'ケチャップ', 'Ketchup', '調味料', g => {
  A(g, lathe([[0, 0], [.2, 0], [.24, .04], [.25, .5], [.2, .72], [.1, .84], [.09, .88]], 28), 0xc81d14, null, { rough: 0.25 });
  A(g, lathe([[.1, .86], [.11, .88], [.11, .98], [.04, 1.08], [.03, 1.12], [0, 1.12]], 20, false), 0xfafafa, null, { rough: 0.4 });
  A(g, cyl(.252, .25, .24, 28, true), 0xf4f0e6, [0, .3, 0], { rough: 0.6 });
  A(g, sph(.07, 14, 10), 0xdf2a1b, [0, .3, .245], { s: [1, .9, .25] });
});
ing('mayonnaise', 'マヨネーズ', 'Mayonnaise', '調味料', g => {
  A(g, D(lathe([[0, 0], [.18, 0], [.27, .08], [.3, .3], [.24, .62], [.1, .86], [.08, .9]], 28), v => { v.z *= .78; }), 0xf6efc8, null, { rough: 0.35 });
  A(g, cyl(.085, .095, .13, 16), 0xd4241c, [0, .96, 0], { rough: 0.35 });
});
ing('curry_roux', 'カレールー', 'Curry roux', '調味料', g => {
  const C = 0x6b3d16;
  A(g, rbox(1.26, .07, .64, .02), C, [0, .035, 0], { rough: 0.5 });
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) A(g, rbox(.29, .1, .29, .035), C, [(i - 1.5) * .31, .11, (j - .5) * .31], { rough: 0.45 });
  A(g, rbox(.29, .16, .29, .035), C, [.95, .1, .2], { r: [.2, .5, .25], rough: 0.45 });
});
ing('nori', 'のり', 'Nori', '調味料', g => {
  A(g, box(1, .012, .9), 0x1c2a1c, [0, .008, 0], { rough: 0.55 });
  A(g, box(1, .012, .9), 0x22321f, [.03, .022, 0], { r: [0, .12, 0], rough: 0.55 });
  A(g, D(new T.BoxGeometry(1, .012, .9, 14, 1, 14), v => { const d = Math.max(0, v.x + v.z - .45); v.y += .6 * d * d; }), 0x1c2a1c, [0, .036, 0], { r: [0, -.1, 0], rough: 0.5 });
});

/* ================= DISHES (20) ================= */
dish('omurice', 'オムライス', 'Omurice', ['egg', 'rice', 'chicken', 'onion', 'ketchup', 'butter'], g => {
  const y0 = plate(g), geo = sph(1, 64, 40); geo.rotateZ(PI / 2);
  const zc = x => .05 - .13 * x * x;
  const e = A(g, D(geo, v => { const ux = v.x, w = 1 - .46 * ux * ux, up = Math.max(v.y, 0); let x = ux * .88, y = v.y * .36 * w, z = v.z * .5 * w; if (v.y < 0) y *= .3; z -= .13 * x * x; const n = .01 * Math.sin(x * 11 + z * 7) + .007 * Math.sin(z * 22 - x * 6); v.set(x + ux * n, y + n * up, z + v.z * n); }), 0xf4bf2c, [0, y0 + .105, .05], { rough: 0.4 });
  const dy = dropper(g, e);
  zig(g, dy, -.56, .56, zc, .19, 7.5, .03, 0xa3120a, .16);
  for (let i = 0; i < 26; i++) { const x = rr(-.6, .6), z = zc(x) + rr(-.25, .25), y = dy(x, z); if (y !== null) A(g, flat(new T.TetrahedronGeometry(rr(.012, .022))), 0x3f7d22, [x, y + .004, z], { s: [1, .4, 1], r: [0, rr(0, 3), 0] }); }
  broccoli(g, [-.62, y0, -.55], .9); cherry(g, [-.3, y0, -.68], 1);
});
dish('curry_rice', 'カレーライス', 'Curry rice', ['rice', 'curry_roux', 'potato', 'carrot', 'onion', 'pork'], g => {
  const y0 = plate(g, 1.25);
  A(g, slab(.62, .72, .06, .12, 1), 0x8a5a1c, [.3, y0 + .06, 0], { rough: 0.18 });
  A(g, riceGeo(), RICE, [-.38, y0, 0], { s: [.56, .34, .62], rough: 0.85 });
  const at = () => { const a = rr(-1.3, 1.3), d = rr(.05, .45); return [.38 + Math.cos(a) * d, y0 + .13, Math.sin(a) * d * 1.2]; };
  chunks(g, 5, () => A(g, rbox(.14, .12, .14, .035, 3), 0xe8751a, null, { rough: 0.3 }), at);
  chunks(g, 4, () => A(g, rbox(.19, .14, .16, .045, 3), 0xe9d28a, null, { rough: 0.35 }), at);
  chunks(g, 5, () => A(g, blob(.1, .07, .08, .15, 5), 0x6b3a1e, null, { rough: 0.35 }), at);
  for (let i = 0; i < 10; i++) A(g, box(.05, .025, .03), 0xc8202a, [-.3 + rr(-.1, .1), y0 + .03 + rr(0, .03), .78 + rr(-.06, .06)], { r: [0, rr(0, 3), rr(-.3, .3)], rough: 0.3 });
});
dish('hamburg_steak', 'ハンバーグ', 'Hamburg steak', ['ground_meat', 'onion', 'egg', 'breadcrumbs', 'ketchup'], g => {
  const y0 = plate(g);
  A(g, slab(.72, .56, .012, .3, 1), 0x4a2210, [-.12, y0 + .01, .12], { rough: 0.12 });
  A(g, slab(.52, .42, .14, .05, 0), 0x5b3218, [-.12, y0 + .15, .12], { rough: 0.55 });
  A(g, slab(.4, .31, .03, .28, 2), 0x35170a, [-.12, y0 + .285, .12], { rough: 0.1 });
  [[.5, -.5, .3], [.66, -.36, -.4]].forEach(p => A(g, cyl(.08, .065, .24, 14), 0xe8751a, [p[0], y0 + .08, p[1]], { r: [PI / 2, 0, p[2]], rough: 0.25 }));
  broccoli(g, [.12, y0, -.66], 1); broccoli(g, [-.22, y0, -.7], .85);
  [[.72, .05, .2], [.62, .28, 1.2]].forEach(p => A(g, ext(sector(.26, .9), .11, .01), 0xe6c36a, [p[0], y0 + .07, p[1]], { r: [-PI / 2, 0, p[2]], rough: 0.6 }));
});
dish('hamburger', 'ハンバーガー', 'Hamburger', ['bread', 'ground_meat', 'lettuce', 'tomato', 'cheese'], g => {
  A(g, lathe([[0, 0], [.5, 0], [.56, .05], [.57, .14], [.52, .18], [0, .18]], 40), 0xd79a4c, null, { rough: 0.6 });
  A(g, D(new T.CylinderGeometry(.64, .64, .03, 60, 1), v => { const a = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z); if (r > .3) { v.y += .04 * Math.sin(a * 11); const k = 1 + .05 * Math.sin(a * 7); v.x *= k; v.z *= k; } }), 0x7cc242, [0, .2, 0], { rough: 0.5 });
  A(g, slab(.58, .58, .075, 0), 0x4a2a14, [0, .3, 0], { rough: 0.6 });
  A(g, D(new T.BoxGeometry(.92, .02, .92, 12, 1, 12), v => { const d = Math.max(Math.abs(v.x), Math.abs(v.z)); if (d > .3) v.y -= (d - .3) * (d - .3) * 5; }), 0xf6b530, [0, .385, 0], { r: [0, PI / 4, 0], rough: 0.35 });
  A(g, cyl(.5, .5, .06, 36), 0xd9301f, [0, .43, 0], { rough: 0.25 });
  const top = A(g, lathe([[0, 0], [.55, 0], [.6, .06], [.56, .22], [.4, .36], [.2, .42], [0, .43]], 44), 0xc98538, [0, .47, 0], { rough: 0.42 });
  const dy = dropper(g, top), sg = sph(.022, 6, 4);
  for (let i = 0; i < 34; i++) { const a = rr(0, 6.28), d = Math.sqrt(R()) * .45, x = Math.cos(a) * d, z = Math.sin(a) * d, y = dy(x, z); if (y !== null) A(g, sg, 0xf6ecd0, [x, y + .004, z], { s: [1, .5, 1.8], r: [0, rr(0, 3), 0] }); }
});
dish('napolitan', 'ナポリタン', 'Napolitan', ['pasta', 'sausage', 'green_pepper', 'onion', 'ketchup'], g => {
  const y0 = plate(g), Rr = .64, H = .32, on = () => { const a = rr(0, 6.28), d = Math.sqrt(R()) * .5; return [Math.cos(a) * d, y0 + H * (1 - d * d / (Rr * Rr)) + .05, Math.sin(a) * d]; };
  noodles(g, 0xe56a2c, Rr, H, 28, .024, y0);
  A(g, slab(.5, .5, .1, .1), 0xd95a22, [0, y0 + .1, 0], { rough: 0.5 });
  chunks(g, 8, () => A(g, cyl(.075, .075, .03, 14), 0xb24a32, null, { rough: 0.3 }), on);
  chunks(g, 7, () => A(g, new T.TorusGeometry(.09, .017, 6, 12, PI), 0x2f8f2f, null, { rough: 0.3 }), on);
  chunks(g, 5, () => A(g, new T.TorusGeometry(.08, .014, 6, 12, PI * .8), 0xf6e8c0, null, { rough: 0.4 }), on);
  for (let i = 0; i < 20; i++) { const p = on(); A(g, flat(new T.TetrahedronGeometry(.015)), 0x3f7d22, p); }
});
dish('ramen', 'ラーメン', 'Ramen', ['chinese_noodles', 'pork', 'egg', 'negi', 'nori', 'soy_sauce'], g => {
  bowl(g, .95, .62, 0xb3241c, 0xf4efe2, 0xb3241c);
  const ys = .5;
  A(g, cyl(.82, .82, .02, 48), 0xa8641e, [0, ys - .01, 0], { rough: 0.08 });
  noodles(g, 0xf0d67a, .42, .02, 6, .02, ys - .02);
  [[-.38, -.22, .1], [-.12, -.44, -.08]].forEach(p => { const q = sub(g, [p[0], ys + .06, p[1]], [p[2], 0, p[2]]); A(q, cyl(.2, .2, .035, 24), 0xcf9a70, null, { rough: 0.5 }); A(q, new T.TorusGeometry(.2, .02, 6, 24), 0x7a4a2a, null, { r: [PI / 2, 0, 0] }); A(q, new T.TorusGeometry(.09, .012, 6, 18, 4), 0xe8c8a8, [0, .019, 0], { r: [PI / 2, 0, 1] }); });
  A(g, sph(.16, 20, 14), 0xfbf8f0, [.36, ys + .04, -.22], { s: [1, .5, 1.25], rough: 0.4 });
  A(g, sph(.085, 16, 10), 0xf29a1e, [.36, ys + .105, -.22], { s: [1, .3, 1.1], rough: 0.25 });
  A(g, box(.36, .46, .012), 0x1c2a1c, [.6, ys + .2, .28], { r: [-.15, -.95, -.2], rough: 0.5 });
  const ng = cyl(.035, .035, .022, 10);
  for (let i = 0; i < 16; i++) A(g, ng, i % 3 ? 0x6fb84a : 0xcfe3a0, [rr(-.2, .3), ys + .05 + rr(0, .02), rr(.0, .4)], { r: [rr(-.5, .5), 0, rr(-.5, .5)] });
  A(g, cyl(.1, .1, .025, 20), 0xfdfbf5, [-.38, ys + .05, .3], { r: [.1, 0, .1] });
  A(g, new T.TorusGeometry(.045, .012, 6, 16, 5), 0xf08aa0, [-.38, ys + .064, .3], { r: [PI / 2 + .1, .1, 0] });
  for (let i = 0; i < 3; i++) A(g, box(.24, .02, .06), 0xc79a55, [.05 + i * .03, ys + .04 + i * .012, -.5 + i * .05], { r: [0, .3 + i * .2, 0] });
});
dish('sushi', '寿司', 'Sushi', ['rice', 'tuna', 'salmon', 'shrimp', 'nori', 'soy_sauce'], g => {
  A(g, box(2.0, .08, .95), 0xc9a064, [0, .16, 0], { rough: 0.7 });
  [-.7, .7].forEach(x => A(g, box(.12, .12, .95), 0xb98f55, [x, .06, 0], { rough: 0.7 }));
  const top = col => D(new T.BoxGeometry(.6, .06, .27, 14, 2, 4), v => { v.y -= .55 * v.x * v.x; const e = Math.abs(v.x) / .3; v.z *= 1 - .25 * e * e * e; });
  [[-.6, 0xa8202c], [0, 0xf27c4f], [.6, 0xf6b9a0]].forEach((s, i) => {
    const q = sub(g, [s[0], .2, 0], [0, PI / 2 - .5, 0]);
    A(q, D(rbox(.42, .2, .24, .09, 6), v => { const n = 1 + .04 * nz(v.x * 30, v.y * 30, v.z * 30); v.x *= n; v.z *= n; }), RICE, [0, .1, 0], { rough: 0.85 });
    A(q, top(), s[1], [0, .25, 0], { rough: 0.3 });
    if (i == 1) for (let k = 0; k < 5; k++) { const x = -.22 + k * .11; A(q, tube([[x - .03, .283 - .55 * x * x, -.12], [x + .03, .285 - .55 * x * x, 0], [x - .03, .283 - .55 * x * x, .12]], .008, 10, 4), 0xfad6c2); }
    if (i == 2) { for (let k = 0; k < 5; k++) { const x = -.22 + k * .1; A(q, box(.03, .012, .25), 0xe8663c, [x, .281 - .55 * x * x, 0], { r: [0, 0, -1.1 * x] }); } shrimpTail(q, [.3, .2, 0], [0, 0, -PI / 2 - .3], .8); }
  });
  A(g, blob(.16, .08, .13, .25, 6), 0xf3b6b0, [.78, .23, .33], { rough: 0.4 });
  A(g, blob(.07, .06, .07, .15, 5), 0x8fbf4a, [.52, .23, .37], { rough: 0.6 });
});
dish('onigiri', 'おにぎり', 'Onigiri', ['rice', 'nori', 'salmon', 'salt'], g => {
  const y0 = plate(g, 1.05);
  [[-.4, .28, 0], [.4, -.3, 1]].forEach(p => {
    const q = sub(g, [p[0], y0 + .09, 0], [-.12, p[1], 0]);
    A(q, D(ext(rpoly([[-.38, 0], [.38, 0], [0, .64]], .16), .2, .08), v => { const n = 1 + .02 * nz(v.x * 25, v.y * 25, v.z * 25); v.x *= n; v.z *= n; }), RICE, null, { rough: 0.85 });
    A(q, ext(rpoly([[-.2, -.09], [.2, -.09], [.2, .28], [-.2, .28]], .03), .375), 0x1c2a1c, null, { rough: 0.5 });
    if (p[2]) A(q, blob(.08, .045, .07, .2, 6), 0xf08a5e, [0, .6, 0], { rough: 0.5 });
  });
  for (let i = 0; i < 3; i++) A(g, cyl(.11, .11, .03, 18), 0xf2cf3a, [-.1 + i * .12, y0 + .03 + i * .012, .62], { r: [.15, 0, -.25], rough: 0.4 });
});
dish('miso_soup', '味噌汁', 'Miso soup', ['miso', 'tofu', 'negi'], g => {
  bowl(g, .75, .55, 0x1c1412, 0xb3241c, 0x1c1412);
  A(g, cyl(.3, .34, .07, 28), 0x1c1412, [0, .02, 0], { rough: 0.3 });
  const ys = .45;
  A(g, cyl(.64, .64, .02, 44), 0xc7964f, [0, ys - .01, 0], { rough: 0.12 });
  A(g, slab(.36, .3, .004, .35, 1), 0xd8ad6a, [.05, ys + .002, 0], { rough: 0.2 });
  for (let i = 0; i < 7; i++) { const a = i * .9 + rr(0, .4), d = rr(.1, .42); A(g, rbox(.13, .13, .13, .02, 3), 0xf8f5ea, [Math.cos(a) * d, ys + .015, Math.sin(a) * d], { r: [rr(-.2, .2), rr(0, 3), rr(-.2, .2)], rough: 0.7 }); }
  for (let i = 0; i < 10; i++) { const a = rr(0, 6.28), d = rr(0, .5); A(g, new T.TorusGeometry(.035, .012, 6, 12), i % 3 ? 0x7cc24e : 0xdbeeb0, [Math.cos(a) * d, ys + .008, Math.sin(a) * d], { r: [PI / 2, 0, 0] }); }
  for (let i = 0; i < 5; i++) { const a = rr(0, 6.28), d = rr(.2, .5); A(g, slab(.11, .06, .006, .5, i), 0x1f4a2c, [Math.cos(a) * d, ys + .006, Math.sin(a) * d], { r: [0, rr(0, 3), 0], rough: 0.3 }); }
});
dish('tempura', '天ぷら', 'Tempura', ['shrimp', 'eggplant', 'flour', 'egg'], g => {
  const y0 = plate(g), BAT = 0xdfa544;
  A(g, box(1.35, .01, 1.0), 0xfdfdf8, [-.12, y0 + .006, 0], { r: [0, .35, 0], rough: 0.9 });
  const batter = (r, len) => flat(D(capsule(r, len, 14), v => { const n = 1 + .2 * nz(v.x * 22, v.y * 12, v.z * 22) + .1 * nz(v.x * 40, v.y * 30, v.z * 40), t = 1 - .25 * (v.y / len + .5); v.x *= n * t; v.z *= n * t; }));
  [[-.45, .0, .5, .12], [-.2, -.2, .25, .28]].forEach(p => { const q = sub(g, [p[0], y0 + .14, p[1]], [0, p[2], PI / 2 - p[3]]); A(q, batter(.15, .7), BAT, null, { rough: 0.85 }); shrimpTail(q, [0, .4, 0], null, .9); });
  const q2 = sub(g, [.28, y0 + .1, .25], [-.9, -.4, 0]);
  A(q2, flat(D(slab(.36, .22, .05, .1, 1), v => { const n = 1 + .1 * nz(v.x * 20, v.y * 20, v.z * 20); v.x *= n; v.z *= n; })), BAT, null, { rough: 0.85 });
  A(q2, slab(.3, .17, .03, .1, 1), 0x3a1a4e, [0, .04, 0], { rough: 0.2 });
  const q3 = sub(g, [.02, y0 + .12, .52], [-1.1, .3, 0]);
  A(q3, flat(D(slab(.3, .2, .04, .3, 2), v => { const n = 1 + .1 * nz(v.x * 20, v.y * 20, v.z * 20); v.x *= n; v.z *= n; })), BAT, null, { rough: 0.85 });
  A(q3, slab(.25, .16, .02, .3, 2), 0x3f8f3a, [0, .035, 0], { rough: 0.4 });
  const q4 = sub(g, [.68, y0, -.42]); bowl(q4, .27, .16, 0x2a3a5a, 0xf2efe6, 0x2a3a5a); A(q4, cyl(.215, .215, .01, 24), 0x7a4a1c, [0, .12, 0], { rough: 0.1 });
  A(g, D(sph(1, 18, 12), v => { const n = 1 + .1 * nz(v.x * 8, v.y * 8, v.z * 8); v.set(v.x * .11 * n, Math.max(0, v.y) * .12, v.z * .11 * n); }), 0xfafafa, [.75, y0 + .01, .2], { rough: 0.9 });
});
dish('tonkatsu', 'とんかつ', 'Tonkatsu', ['pork', 'breadcrumbs', 'egg', 'flour', 'cabbage', 'lemon'], g => {
  const y0 = plate(g), row = sub(g, [-.05, y0, .32], [0, .18, 0]), crusts = [];
  for (let i = 0; i < 6; i++) {
    const q = sub(row, [-.45 + i * .18, .115, 0], [0, rr(-.04, .04), -.22]);
    crusts.push(A(q, flat(D(rbox(.15, .2, .62, .05, 5), v => { const n = 1 + .06 * nz(v.x * 30, v.y * 30, v.z * 30); v.y *= n; v.z *= n; })), 0xc98a32, null, { rough: 0.85 }));
    A(q, rbox(.154, .13, .53, .02, 3), 0xf1dcc6, null, { rough: 0.6 });
  }
  const dy = dropper(g, crusts);
  zig(g, dy, -.48, .5, x => .32 - .18 * x, .2, 9, .02, 0x35170a, .12);
  const c = sub(g, [.12, y0, -.48], null, [1, 1, .72]);
  A(c, flat(D(sph(1, 22, 12), v => { const n = 1 + .12 * nz(v.x * 8, v.y * 8, v.z * 8); v.set(v.x * .56 * n, Math.max(0, v.y) * .3 * n, v.z * .56 * n); })), 0xdcebb0, null, { rough: 0.8 });
  noodles(c, 0xeaf4c8, .58, .31, 16, .011, .02);
  lemonSlice(g, [-.72, y0 + .09, -.3], .2, [-.9, .6, 0]);
  A(g, blob(.07, .04, .07, .1, 4), 0xe3b21c, [.82, y0 + .06, .1], { rough: 0.4 });
});
dish('steak', 'ステーキ', 'Steak', ['beef', 'garlic', 'butter', 'salt', 'potato'], g => {
  A(g, rbox(2.3, .1, 1.45, .04), 0x9a6a3c, [0, .05, 0], { rough: 0.7 });
  A(g, lathe([[0, 0], [.7, 0], [.8, .06], [.82, .1], [.78, .1], [.68, .04], [0, .04]], 48), 0x1e1e20, [0, .1, 0], { s: [1.22, 1, .76], rough: 0.5, metal: 0.4 });
  A(g, rbox(.3, .06, .12, .02), 0x1e1e20, [1.05, .16, 0], { rough: 0.5, metal: 0.4 }); A(g, rbox(.3, .06, .12, .02), 0x1e1e20, [-1.05, .16, 0], { rough: 0.5, metal: 0.4 });
  const st = A(g, slab(.55, .36, .1, .18, 1), 0x5a2f1a, [-.2, .24, .03], { rough: 0.5 }), dy = dropper(g, st);
  for (let i = 0; i < 6; i++) { const pts = []; for (let j = 0; j <= 8; j++) { const t = j / 8 - .5, x = -.2 + (i - 2.5) * .15 + t * .42, z = .03 + t * .5, y = dy(x, z); if (y !== null && y > .3) pts.push([x, y + .001, z]); } if (pts.length > 2) A(g, tube(pts, .014, 20, 4), 0x1c0d06, null, { rough: 0.7 }); }
  A(g, slab(.13, .11, .006, .3, 1), 0xf3d98a, [-.2, .343, .03], { rough: 0.15 });
  A(g, rbox(.14, .06, .14, .02, 3), 0xf7dc6f, [-.2, .372, .03], { r: [0, .5, 0], rough: 0.35 });
  [[.48, .22, .3], [.62, .05, 1.4], [.5, -.12, 2.3]].forEach(p => A(g, ext(sector(.24, .8), .1, .01), 0xe6c36a, [p[0], .2, p[1]], { r: [-PI / 2, 0, p[2]], rough: 0.6 }));
  broccoli(g, [.42, .14, -.34], .85); broccoli(g, [.68, .14, -.2], .75);
  for (let i = 0; i < 4; i++) { const x = -.42 + i * .13, z = .2 - i * .05, y = dy(x, z); if (y !== null) A(g, cyl(.04, .04, .012, 10), 0xf0dfb0, [x, y + .006, z], { r: [rr(-.2, .2), 0, rr(-.2, .2)] }); }
});
dish('salad', 'サラダ', 'Salad', ['lettuce', 'tomato', 'cucumber', 'mayonnaise'], g => {
  bowl(g, .85, .5, 0xa8743c, 0xb98549);
  const q = sub(g, [0, .38, 0], null, [1, .55, 1]), cy = .38, top = d => cy + .36 * Math.sqrt(Math.max(0, 1 - d * d / .44));
  A(q, sph(.58, 24, 16), 0xa8dc5c, null, { rough: 0.6 });
  leafBall(q, .6, [0x8fce4a, 0xa8dc5c, 0xc4ea7a, 0x7cc23e], 12, .05, .008, 1.5);
  [[.3, .25], [-.38, .12], [.05, -.42], [-.2, .42]].forEach(p => cherry(g, [p[0], top(Math.hypot(p[0], p[1])) - .03, p[1]], 1.1));
  [[.4, -.15], [.18, -.3], [-.32, -.25], [-.08, .2], [.45, .05]].forEach((p, i) => { const s = sub(g, [p[0], top(Math.hypot(p[0], p[1])) + .03, p[1]], [rr(-.5, .5), 0, rr(-.5, .5)]); A(s, cyl(.105, .105, .025, 18), 0xe3f2bc, null, { rough: 0.4 }); A(s, new T.TorusGeometry(.105, .014, 6, 18), 0x2e6b2c, null, { r: [PI / 2, 0, 0] }); });
  [[-.45, -.02], [.2, .02]].forEach(p => { const s = sub(g, [p[0], top(Math.hypot(p[0], p[1])) + .03, p[1]], [.3, 0, p[0]]); A(s, cyl(.1, .1, .025, 18), 0xfbf8f0); A(s, cyl(.055, .055, .03, 14), 0xf4b93a); });
  swirl(g, [0, top(0) - .02, 0], .8, 0xfbf6dc);
});
dish('bacon_eggs', 'ベーコンエッグ', 'Bacon and eggs', ['egg', 'bacon', 'bread'], g => {
  const y0 = plate(g, 1.25);
  [[-.38, .38, 1], [.08, .55, 3]].forEach(p => { A(g, slab(.34, .3, .018, .35, p[2]), 0xfbfaf4, [p[0], y0 + .02, p[1]], { rough: 0.35 }); A(g, sph(.12, 20, 14), 0xf5a623, [p[0] + .02, y0 + .04, p[1]], { s: [1, .55, 1], rough: 0.15 }); });
  [[-.35, -.28, .15], [-.3, -.55, .0]].forEach((p, i) => baconStrip(sub(g, [p[0], y0, p[1]], [0, p[2], 0]), 1.05, [0x8a2e22, 0xe8b98a], i * 2));
  breadSlice(sub(g, [.62, y0 + .1, -.38], [-PI / 2 + .12, 0, .4], .82), 0xd9a55c, 0xa8703a);
});
dish('sandwich', 'サンドイッチ', 'Sandwich', ['bread', 'lettuce', 'tomato', 'cheese', 'egg', 'mayonnaise'], g => {
  const y0 = plate(g), tri = k => new T.Shape([new T.Vector2(0, 0), new T.Vector2(.85 * k, 0), new T.Vector2(0, .85 * k)]);
  const half = q => {
    let y = 0; const L = [[.11, 0xf6ecd2, 1, 1], [.03, 0x7cc242, 1.07, 0], [.05, 0xd9301f, .96, 0], [.025, 0xf6b530, 1.01, 0], [.07, 0xf7e08a, .97, 0], [.03, 0x7cc242, 1.07, 0], [.11, 0xf6ecd2, 1, 1]];
    L.forEach(l => {
      A(q, ext(tri(l[2]), l[0]), l[1], [-(l[2] - 1) * .12, y + l[0] / 2, (l[2] - 1) * .12], { r: [-PI / 2, 0, 0], rough: l[3] ? 0.85 : 0.45 });
      if (l[3]) { A(q, box(.88, l[0], .03), 0xc48a48, [.425, y + l[0] / 2, .015], { rough: 0.75 }); A(q, box(.03, l[0], .88), 0xc48a48, [-.015, y + l[0] / 2, -.425], { rough: 0.75 }); }
      y += l[0];
    });
  };
  half(sub(g, [.28, y0, .52], [0, -3 * PI / 4 + .25, 0]));
  half(sub(g, [.5, y0 + .28, -.2], [-.5, -3 * PI / 4 - .45, 0]));
  cherry(g, [-.7, y0, .35], 1); cherry(g, [-.55, y0, .55], .9);
  A(g, flat(D(sph(1, 14, 8), v => { const n = 1 + .2 * nz(v.x * 9, v.y * 9, v.z * 9); v.set(v.x * .16 * n, Math.max(0, v.y) * .14 * n, v.z * .16 * n); })), 0x3c8a24, [-.78, y0, .0], { rough: 0.7 });
});
dish('pizza', 'ピザ', 'Pizza', ['flour', 'cheese', 'tomato', 'green_pepper', 'sausage'], g => {
  A(g, cyl(1.25, 1.25, .06, 56), 0xb98549, [0, .03, 0], { rough: 0.7 });
  A(g, rbox(.3, .06, .7, .025), 0xb98549, [0, .03, 1.5], { rough: 0.7 });
  A(g, D(lathe([[0, 0], [1.0, 0], [1.1, .04], [1.1, .1], [1.02, .13], [.93, .1], [.9, .06], [0, .05]], 56), v => { const a = Math.atan2(v.z, v.x), r = Math.hypot(v.x, v.z); if (r > .85) { const k = 1 + .02 * Math.sin(a * 9) + .012 * Math.sin(a * 23); v.x *= k; v.z *= k; v.y *= 1 + .12 * Math.sin(a * 13 + 1); } }), 0xd9a55c, [0, .06, 0], { rough: 0.75 });
  A(g, cyl(.93, .93, .02, 48), 0xc8321e, [0, .125, 0], { rough: 0.4 });
  A(g, slab(.86, .86, .012, .05, 1), 0xf6dc8a, [0, .14, 0], { rough: 0.32 });
  for (let i = 0; i < 12; i++) { const a = rr(0, 6.28), d = rr(.1, .75); A(g, slab(rr(.05, .1), rr(.04, .08), .004, .4, i), 0xe0a84a, [Math.cos(a) * d, .151, Math.sin(a) * d], { rough: 0.4 }); }
  for (let i = 0; i < 9; i++) { const a = i / 8 * 2 * PI + .3, d = i == 8 ? 0 : (i % 2 ? .62 : .36); A(g, cyl(.11, .11, .02, 20), 0xa8321e, [Math.cos(a) * d, .16, Math.sin(a) * d], { rough: 0.35 }); }
  for (let i = 0; i < 7; i++) { const a = i / 7 * 2 * PI + 1, d = i % 2 ? .3 : .68; A(g, new T.TorusGeometry(.085, .018, 6, 16), 0x2f8f2f, [Math.cos(a) * d + .08, .168, Math.sin(a) * d], { r: [PI / 2, 0, 0], rough: 0.3 }); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * 2 * PI + .2; A(g, slab(.1, .06, .006, .2, i), 0x2f7d2a, [Math.cos(a) * .52, .166, Math.sin(a) * .52], { r: [0, a, 0], rough: 0.5 }); }
});
dish('gyoza', '餃子', 'Gyoza', ['flour', 'ground_meat', 'cabbage', 'garlic', 'negi'], g => {
  const y0 = plate(g, 1.2, 0xf4f1ea, [1.2, 1, .82]);
  const f = k => v => { const up = Math.max(0, v.y); let x = v.x * .32, y = v.y > 0 ? v.y * .2 * (1 - .45 * v.x * v.x) : v.y * .035, z = v.z * .115 * (1 - .78 * up); z += .014 * Math.sin(v.x * 24) * up; z -= .3 * x * x; v.set(x * k, y * k, z * k - (k - 1) * .3 * x * x); };
  const row = sub(g, [-.15, y0, 0], [0, PI / 2 + .12, 0], 1.45);
  for (let i = 0; i < 6; i++) {
    const q = sub(row, [0, .1, (i - 2.5) * .19], [-1.05, 0, 0]);
    A(q, D(sph(1, 36, 20), f(1)), 0xf1e3c0, null, { rough: 0.5 });
    A(q, D(new T.SphereGeometry(1, 24, 10, .45, 2.25, 1.25, 1.05), f(1.03)), 0xb5651a, null, { rough: 0.55 });
  }
  const d = sub(g, [.92, y0, .42]); bowl(d, .24, .12, 0xf4f1ea); A(d, cyl(.19, .19, .01, 24), 0x3a1a0c, [0, .09, 0], { rough: 0.08 });
  for (let i = 0; i < 5; i++) A(d, sph(.025, 8, 6), 0xd4441c, [rr(-.1, .1), .096, rr(-.1, .1)], { s: [1, .2, 1], rough: 0.1 });
});
dish('grilled_salmon', '焼き鮭', 'Grilled salmon', ['salmon', 'salt', 'lemon'], g => {
  A(g, rbox(1.9, .1, 1.0, .04), 0x3a4a52, [0, .05, 0], { rough: 0.45 });
  A(g, slab(.5, .32, .008, .2, 1), 0x3f8f3a, [-.25, .108, -.05], { r: [0, .3, 0], rough: 0.5 });
  const s = A(g, slab(.62, .3, .09, .3, 2), 0xe98b5c, [-.1, .2, 0], { rough: 0.5 }), dy = dropper(g, s);
  rim(sub(g, [-.1, .2, 0]), .62, .3, .3, 2, 3.5, 6.0, -.01, .055, 0x5a5e60, { rough: 0.35, metal: 0.3 });
  for (let i = 0; i < 6; i++) { const x = -.52 + i * .16, pts = []; for (let j = 0; j <= 6; j++) { const z = -.2 + j * .07, xx = x + .06 * (1 - Math.abs(j - 3) / 3), y = dy(xx, z); if (y !== null) pts.push([xx, y + .002, z]); } if (pts.length > 2) A(g, tube(pts, .009, 18, 4), 0xf6d2bd); }
  for (let i = 0; i < 7; i++) { const x = rr(-.5, .3), z = rr(-.15, .15), y = dy(x, z); if (y !== null) A(g, slab(rr(.05, .09), rr(.03, .06), .004, .4, i), 0xb8602e, [x, y + .002, z], { rough: 0.6 }); }
  lemonSlice(g, [.68, .11, .1], .2, [-1.2, -.4, 0]);
  A(g, cyl(.018, .035, .55, 10), 0xf4a6b4, [.2, .13, .36], { r: [0, .15, PI / 2], rough: 0.4 });
});
dish('cream_stew', 'クリームシチュー', 'Cream stew', ['milk', 'chicken', 'potato', 'carrot', 'onion', 'butter', 'flour'], g => {
  A(g, lathe([[0, 0], [.5, 0], [.55, .03], [.8, .2], [1.05, .3], [1.1, .3], [1.1, .33], [1.02, .34], [.78, .24], [.5, .08], [0, .07]], 52), 0xf6f3ec, null, { rough: 0.22 });
  const ys = .25, at = () => { const a = rr(0, 6.28), d = Math.sqrt(R()) * .62; return [Math.cos(a) * d, ys + .02, Math.sin(a) * d]; };
  A(g, cyl(.8, .8, .02, 48), 0xf0dca8, [0, ys - .01, 0], { rough: 0.18 });
  chunks(g, 6, () => A(g, rbox(.15, .13, .15, .04, 3), 0xe8751a, null, { rough: 0.3 }), at);
  chunks(g, 5, () => A(g, rbox(.2, .15, .17, .05, 3), 0xead894, null, { rough: 0.35 }), at);
  chunks(g, 5, () => A(g, blob(.12, .08, .1, .15, 5), 0xf0d9b8, null, { rough: 0.45 }), at);
  for (let i = 0; i < 3; i++) { const p = at(); broccoli(g, [p[0], ys - .1, p[2]], .8); }
  for (let i = 0; i < 24; i++) { const p = at(); A(g, flat(new T.TetrahedronGeometry(.014)), 0x3f7d22, [p[0], ys + .004, p[2]], { s: [1, .3, 1] }); }
});
dish('pancakes', 'パンケーキ', 'Pancakes', ['flour', 'egg', 'milk', 'butter', 'strawberry'], g => {
  const y0 = plate(g), off = [[0, 0], [.03, -.02], [-.02, .03]]; let top;
  for (let i = 0; i < 3; i++) { const q = sub(g, [off[i][0], y0 + i * .15, off[i][1]]); top = A(q, lathe([[0, 0], [.5, 0], [.56, .03], [.58, .07], [.56, .11], [.5, .14], [0, .14]], 48), 0xc98a3c, null, { rough: 0.6 }); A(q, cyl(.583, .583, .06, 48, true), 0xf2d08a, [0, .07, 0], { rough: 0.7 }); }
  const yt = y0 + .44, cx = -.02, cz = .03;
  A(g, slab(.42, .38, .01, .3, 3), 0xb8651a, [cx, yt + .008, cz], { rough: 0.06 });
  [[.5, 0], [2.2, 1], [3.9, 2], [5.3, 3]].forEach(d => { const a = d[0], c = Math.cos(a), s = Math.sin(a), l = .12 + d[1] * .05, pts = [[cx + c * .3, yt + .012, cz + s * .3], [cx + c * .56, yt + .0, cz + s * .56], [cx + c * .6, yt - .06, cz + s * .6], [cx + c * .6, yt - l, cz + s * .6]]; A(g, tube(pts, .03, 24, 8), 0xb8651a, null, { rough: 0.06 }); A(g, sph(.04, 10, 8), 0xb8651a, pts[3], { rough: 0.06 }); });
  A(g, rbox(.17, .06, .17, .02, 3), 0xf7dc6f, [cx, yt + .045, cz], { r: [0, .5, 0], rough: 0.35 });
  strawberry(sub(g, [-.82, y0, .3], [0, 0, 0], .42)); strawberry(sub(g, [-.66, y0 + .1, .58], [1.2, .5, 0], .38));
  swirl(g, [.8, y0, .38], .75, 0xfffdf5);
  A(g, slab(.09, .05, .006, .2, 1), 0x3f9a3a, [.8, y0 + .3, .38], { r: [.5, .4, .6] });
});


/* ================= 厨房の設備(「3Dキッチン」のアーティファクトから) ================= */
const ST = 0xc5c9cc, DK = 0x232527;
const S = (g, geo, p, o) => A(g, geo, ST, p, Object.assign({ rough: 0.35, metal: 0.85 }, o || {}));
const EQUIP = {};
const prop = (id, _name, _en, _cat, fn) => { EQUIP[id] = fn; };
function cabinet(g, w) {
  S(g, box(w, .78, .65), [0, .47, 0]); A(g, box(w - .04, .08, .55), DK, [0, .04, 0]);
  const n = Math.max(1, Math.round(w / .6)), dw = w / n;
  for (let i = 0; i < n; i++) { const x = -w / 2 + dw * (i + .5); S(g, box(dw - .02, .7, .016), [x, .47, .333], { rough: 0.3 }); S(g, box(dw * .5, .018, .03), [x, .76, .355], { rough: 0.22 }); }
}
prop('counter', '調理台', 'Counter', '設備', g => { cabinet(g, 1.2); S(g, box(1.21, .04, .7), [0, .88, .01], { rough: 0.28 }); });
prop('sink', 'シンク', 'Sink', '設備', g => {
  cabinet(g, 1.2);
  S(g, box(.255, .04, .7), [-.4775, .88, .01]); S(g, box(.355, .04, .7), [.4275, .88, .01]); S(g, box(.6, .04, .14), [-.05, .88, -.27]); S(g, box(.6, .04, .16), [-.05, .88, .28]);
  const o = { rough: 0.5 };
  S(g, box(.6, .01, .4), [-.05, .7, 0], o); S(g, box(.6, .2, .01), [-.05, .8, -.2], o); S(g, box(.6, .2, .01), [-.05, .8, .2], o); S(g, box(.01, .2, .4), [-.35, .8, 0], o); S(g, box(.01, .2, .4), [.25, .8, 0], o);
  A(g, cyl(.025, .025, .006, 16), DK, [-.05, .708, 0]);
  S(g, cyl(.018, .024, .06, 14), [-.05, .93, -.27]);
  S(g, tube([[-.05, .94, -.27], [-.05, 1.2, -.27], [-.05, 1.27, -.2], [-.05, 1.22, -.11], [-.05, 1.15, -.09]], .012, 40, 10));
  [-.16, .06].forEach(x => { S(g, cyl(.014, .018, .04, 12), [x, .92, -.27]); S(g, box(.07, .012, .02), [x, .95, -.25]); });
});
prop('stove', 'コンロ', 'Stove', '設備', g => {
  S(g, box(1.0, .8, .7), [0, .46, 0]); [-1, 1].forEach(x => [-1, 1].forEach(z => A(g, cyl(.025, .025, .06, 10), DK, [x * .44, .03, z * .29])));
  A(g, box(1.0, .03, .7), 0x1c1c1e, [0, .875, 0], { rough: 0.4 });
  [-.25, .25].forEach(x => [-.16, .17].forEach(z => {
    A(g, cyl(.035, .042, .014, 16), 0x3a3a3c, [x, .897, z], { metal: 0.5, rough: 0.4 });
    A(g, new T.TorusGeometry(.09, .008, 6, 24), DK, [x, .908, z], { r: [PI / 2, 0, 0], rough: 0.5 });
    A(g, box(.24, .012, .016), DK, [x, .908, z]); A(g, box(.016, .012, .24), DK, [x, .908, z]);
  }));
  S(g, box(1.0, .1, .02), [0, .8, .355], { rough: 0.3 });
  for (let i = 0; i < 5; i++) A(g, cyl(.024, .028, .03, 14), DK, [-.36 + i * .18, .8, .38], { r: [PI / 2, 0, 0] });
  S(g, box(.9, .52, .02), [0, .42, .355], { rough: 0.3 }); A(g, box(.6, .26, .006), 0x0e0f10, [0, .43, .367], { rough: 0.08 });
  S(g, cyl(.012, .012, .8, 10), [0, .7, .395], { r: [0, 0, PI / 2], rough: 0.2 }); [-.38, .38].forEach(x => S(g, box(.02, .02, .04), [x, .7, .375]));
});
prop('hood', 'レンジフード', 'Range hood', '設備', g => {
  S(g, cyl(.3, .62, .3, 4), [0, .15, 0], { r: [0, PI / 4, 0], s: [1.15, 1, .78] }); S(g, box(.3, .7, .26), [0, .65, 0]);
  A(g, box(.82, .012, .52), DK, [0, .004, 0]);
});
prop('fridge', '冷蔵庫', 'Fridge', '設備', g => {
  S(g, box(.8, 1.86, .7), [0, .97, 0]); A(g, box(.76, .04, .6), DK, [0, .02, 0]);
  S(g, box(.78, 1.18, .02), [0, 1.3, .36], { rough: 0.28 }); S(g, box(.78, .62, .02), [0, .37, .36], { rough: 0.28 });
  S(g, cyl(.012, .012, .5, 10), [-.3, 1.1, .4], { rough: 0.2 }); S(g, cyl(.012, .012, .3, 10), [-.3, .5, .4], { rough: 0.2 });
  [[1.33, .02], [.87, .02], [.62, .02], [.38, .02]].forEach(p => S(g, box(.03, .02, .04), [-.3, p[0], .385]));
});
prop('prep_table', '作業台', 'Prep table', '設備', g => {
  const w = 2.2, d = .8; S(g, box(w, .04, d), [0, .88, 0], { rough: 0.28 }); S(g, box(w - .1, .02, d - .1), [0, .25, 0]);
  [-1, 1].forEach(x => [-1, 1].forEach(z => { S(g, cyl(.022, .022, .86, 12), [x * (w / 2 - .05), .43, z * (d / 2 - .05)]); A(g, cyl(.028, .028, .02, 12), DK, [x * (w / 2 - .05), .01, z * (d / 2 - .05)]); }));
});
prop('hanging_rack', '吊り棚', 'Hanging rack', '設備', g => {
  const w = 2.0; [-1, 1].forEach(x => [-1, 1].forEach(z => S(g, box(.035, .86, .035), [x * (w / 2 - .02), .43, z * .16])));
  S(g, box(w, .03, .4), [0, .875, 0], { rough: 0.3 }); S(g, cyl(.009, .009, w - .08, 8), [0, .78, .19], { r: [0, 0, PI / 2] });
  [-1, 1].forEach(x => S(g, box(.02, .1, .02), [x * (w / 2 - .04), .83, .19]));
  for (let i = 0; i < 7; i++) S(g, new T.TorusGeometry(.016, .003, 6, 12, PI * 1.3), [-.75 + i * .25, .764, .19], { r: [0, PI / 2, -.4] });
});
prop('wall_shelf', '壁棚', 'Wall shelf', '設備', g => {
  S(g, box(1.1, .02, .25), [0, .2, 0], { rough: 0.3 });
  [-.45, .45].forEach(x => { S(g, box(.02, .2, .02), [x, .1, -.115]); S(g, box(.02, .02, .22), [x, .18, 0]); S(g, box(.02, .26, .02), [x, .095, -.02], { r: [.9, 0, 0] }); });
});

/* ---------- bake: 材質ごとに1つのメッシュ、原点は底の中心 ---------- */
function bake(g) {
  g.updateMatrixWorld(true);
  const by = new Map();
  g.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    let e = by.get(o.material);
    if (!e) by.set(o.material, (e = { p: [], n: [] }));
    e.p.push(geo.attributes.position.array);
    e.n.push(geo.attributes.normal.array);
  });
  const out = new T.Group(), bb = new T.Box3();
  by.forEach((e, mat) => {
    const len = e.p.reduce((s, a) => s + a.length, 0), P = new Float32Array(len), N = new Float32Array(len);
    let o = 0;
    e.p.forEach((a, i) => { P.set(a, o); N.set(e.n[i], o); o += a.length; });
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(P, 3));
    geo.setAttribute("normal", new T.BufferAttribute(N, 3));
    geo.computeBoundingBox();
    bb.union(geo.boundingBox);
    const m = new T.Mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    out.add(m);
  });
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  out.children.forEach((m) => { m.geometry.translate(-cx, -bb.min.y, -cz); m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere(); });
  return out;
}

const built = new Map();

/** 図鑑の id(例: "omurice", "tomato")のモデルを作る(同じ id は1度だけ作って使い回す)。原点は底の中心、大きさは図鑑のまま */
export function zukanBuild(kind: "ingredient" | "dish", id: string): THREE.Group | null {
  const key = `${kind}:${id}`;
  let o = built.get(key);
  if (!o) {
    const item = (kind === "dish" ? DISH : ING).find((x) => x.id === id);
    if (!item) return null;
    seed = item.seed;
    const g = new T.Group();
    item.fn(g);
    o = bake(g);
    built.set(key, o);
  }
  return o;
}

const builtEquip = new Map();

/** 設備のモデル(counter / sink / stove / hood / fridge / prep_table / hanging_rack / wall_shelf)。原点は底の中心、単位はm。前(客側)が +z */
export function zukanEquipment(id: string): THREE.Group | null {
  let o = builtEquip.get(id);
  if (!o) {
    const fn = EQUIP[id];
    if (!fn) return null;
    seed = 9001 + Object.keys(EQUIP).indexOf(id) * 31;
    const g = new T.Group();
    fn(g);
    o = bake(g);
    builtEquip.set(id, o);
  }
  return o;
}
