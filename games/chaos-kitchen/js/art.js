"use strict";
// 見た目: かわいいポップ。キャラ・設備・料理・エフェクト・HUD を描く(画像素材なし、すべてCanvasで描画)
const FONT_BODY = "'M PLUS Rounded 1c','Hiragino Maru Gothic ProN','Yu Gothic UI',system-ui,sans-serif";
const FONT_POP = "'Mochiy Pop One','M PLUS Rounded 1c','Hiragino Maru Gothic ProN',system-ui,sans-serif";
const PAL = {
  ink: "#3a2b57", plum: "#2d2250", tomato: "#ff5a5f", sun: "#ffc93c", mint: "#3ddc97", sky: "#4cc9f0", grape: "#9d6bff", pink: "#ff8fb8",
  woodHi: "#f9dca8", wood: "#e8b877", woodLo: "#c98f4f", woodLine: "#8a5a30", steel: "#cfd8e3", steelLo: "#9aa8ba",
  floorA: "#f2fff8", floorB: "#dcf7ea", hallA: "#fff1e3", hallB: "#ffe1c9", iceA: "#e3f7ff", iceB: "#cdeefb",
};
const WORLD_COL = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#38d9a9", "#4dabf7", "#9775fa", "#f783ac", "#a9e34b", "#ff8787"];
const TAG_COL = { chopped: "#5fd068", cooked: "#ff9f43", fried: "#ffc93c", baked: "#ff6b6b" };

function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function paint(fill, stroke, lw = 3) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = "round"; ctx.stroke(); }
}
function circ(x, y, r, fill, stroke, lw = 3) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); paint(fill, stroke, lw); }
function txt(s, x, y, size = 28, align = "center", col = "#fff", outline = null, font = FONT_BODY) {
  ctx.font = `800 ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = "middle";
  if (outline) { ctx.lineWidth = Math.max(3, size * 0.2); ctx.strokeStyle = outline; ctx.lineJoin = "round"; ctx.strokeText(s, x, y); }
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
const emo = (s, x, y, size) => { ctx.font = `${size}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#000"; ctx.fillText(s, x, y); };
function shadow(x, y, w, h, a = 0.18) { ctx.fillStyle = `rgba(58,43,87,${a})`; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, 7); ctx.fill(); }
function star5(x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.48 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath(); paint(fill, stroke, Math.max(2, r * 0.18));
}

// ---- エフェクト(単位はマス) ----
const fx = []; let shake = 0;
function fxAdd(o) { fx.push({ life: 0.8, vx: 0, vy: 0, g: 0, size: 6, col: "#fff", type: "dot", rot: 0, ...o, max: o.life || 0.8 }); }
function fxBurst(x, y, n = 8, cols = [PAL.sun, PAL.pink, PAL.mint, PAL.sky], sp = 2.6) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, v = sp * (0.4 + Math.random() * 0.8);
    fxAdd({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: 4, life: 0.7 + Math.random() * 0.3, size: 7 + Math.random() * 5, col: cols[i % cols.length], type: "star" });
  }
}
const fxChop = c => { for (let i = 0; i < 3; i++) fxAdd({ x: c.x + 0.5, y: c.y + 0.45, vx: (Math.random() - 0.5) * 2.4, vy: -1.5 - Math.random(), g: 6, life: 0.45, size: 6, col: ["#7ed957", "#ff7a7a", "#ffd166"][i], type: "crumb" }); };
const fxSteam = c => fxAdd({ x: c.x + 0.35 + Math.random() * 0.3, y: c.y + 0.3, vx: (Math.random() - 0.5) * 0.3, vy: -0.9, life: 0.9, size: 9, col: "#ffffff", type: "puff" });
const fxSmoke = c => fxAdd({ x: c.x + 0.3 + Math.random() * 0.4, y: c.y + 0.3, vx: (Math.random() - 0.5) * 0.4, vy: -0.8, life: 1.1, size: 12, col: "#5b5470", type: "puff" });
const fxBubble = c => fxAdd({ x: c.x + 0.3 + Math.random() * 0.4, y: c.y + 0.5, vx: 0, vy: -0.8, life: 0.7, size: 5 + Math.random() * 4, col: "#bfeaff", type: "ring" });
const fxCoin = (x, y) => fxAdd({ x, y, vy: -1.4, life: 0.9, size: 30, type: "emoji", ch: "💰" });
function updateFx(dt) {
  for (const f of fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += f.g * dt; f.rot += dt * 6; }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
  if (shake > 0) shake = Math.max(0, shake - dt * 2.5);
}
function drawFx() {
  for (const f of fx) {
    const a = Math.max(0, Math.min(1, f.life / f.max)), x = f.x * T, y = f.y * T;
    ctx.globalAlpha = f.type === "puff" ? a * 0.7 : a;
    if (f.type === "star") star5(x, y, f.size * (0.6 + a * 0.5), f.col, PAL.ink);
    else if (f.type === "crumb") { ctx.save(); ctx.translate(x, y); ctx.rotate(f.rot); ctx.fillStyle = f.col; ctx.fillRect(-f.size / 2, -f.size / 2, f.size, f.size); ctx.restore(); }
    else if (f.type === "puff") circ(x, y, f.size * (1.6 - a * 0.6), f.col);
    else if (f.type === "ring") { ctx.beginPath(); ctx.arc(x, y, f.size, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = f.col; ctx.stroke(); }
    else if (f.type === "emoji") emo(f.ch, x, y, f.size);
    else circ(x, y, f.size * a, f.col);
    ctx.globalAlpha = 1;
  }
}

// ---- 料理・食材 ----
function badge(x, y, label, col, s = 1) {
  ctx.font = `800 ${13 * s}px ${FONT_BODY}`;
  const w = ctx.measureText(label).width + 8 * s;
  rr(x - w / 2, y - 9 * s, w, 18 * s, 9 * s); paint(col, "#fff", 2 * s);
  txt(label, x, y + 0.5, 13 * s, "center", PAL.ink);
}
function drawItem(it, x, y, s = 1) {
  if (!it) return;
  if (it.kind === "dirty") {
    shadow(x, y + 14 * s, 24 * s, 7 * s);
    ctx.beginPath(); ctx.ellipse(x, y, 27 * s, 19 * s, 0, 0, 7); paint("#cdb89a", "#8a7656", 2.5);
    ctx.beginPath(); ctx.ellipse(x, y, 17 * s, 11 * s, 0, 0, 7); paint("#b9a283");
    emo("💧", x + 14 * s, y - 10 * s, 16 * s); return;
  }
  if (it.kind === "plate") {
    shadow(x, y + 15 * s, 25 * s, 7 * s);
    ctx.beginPath(); ctx.ellipse(x, y, 27 * s, 19 * s, 0, 0, 7); paint("#fff", PAL.ink, 2.5);
    ctx.beginPath(); ctx.ellipse(x, y, 19 * s, 12 * s, 0, 0, 7); paint("#eaf1ff");
    const n = it.contents.length, sp = n > 2 ? 17 : 22;
    it.contents.forEach((c, i) => drawItem({ kind: "ing", ...c }, x + (i - (n - 1) / 2) * sp * s, y - 2 * s, (n > 2 ? 0.46 : 0.56) * s));
    return;
  }
  shadow(x, y + 17 * s, 15 * s, 5 * s);
  circ(x, y, 21 * s, "rgba(255,255,255,.9)", "rgba(58,43,87,.35)", 2);
  emo(ING[it.type].emoji, x, y + 1 * s, 29 * s);
  if (it.state !== "raw") badge(x + 12 * s, y + 15 * s, STATE_TAG[it.state], TAG_COL[it.state], s * 0.85);
}
const ticketIcons = r => r.need.map(k => { const [t, s] = k.split(":"); return ING[t].emoji + (s === "raw" ? "" : STATE_TAG[s]); }).join(" ");

// ---- 床・壁・カウンター ----
function drawFloor(c, x, y, hall) {
  const px = x * T, py = y * T, chk = (x + y) & 1;
  let a, b;
  if (c.t === "~") { a = PAL.iceA; b = PAL.iceB; } else if (hall) { a = PAL.hallA; b = PAL.hallB; } else { a = PAL.floorA; b = PAL.floorB; }
  ctx.fillStyle = chk ? a : b; ctx.fillRect(px, py, T, T);
  if (c.t === "~") { ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(px + 14, py + 24); ctx.lineTo(px + 30, py + 14); ctx.moveTo(px + 46, py + 62); ctx.lineTo(px + 66, py + 50); ctx.stroke(); ctx.lineCap = "butt"; }
}
function drawBelt(c, px, py, tnow) {
  ctx.fillStyle = "#59527a"; ctx.fillRect(px, py, T, T);
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, T, T); ctx.clip();
  const [ax, ay] = ARROW[c.t], off = (tnow * 36) % 32;
  ctx.strokeStyle = PAL.sun; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let i = -1; i < 3; i++) {
    const d = i * 32 + off - 16, cx = px + T / 2 + ax * d, cy = py + T / 2 + ay * d;
    ctx.beginPath();
    if (ax) { ctx.moveTo(cx - ax * 7, cy - 14); ctx.lineTo(cx + ax * 7, cy); ctx.lineTo(cx - ax * 7, cy + 14); } else { ctx.moveTo(cx - 14, cy - ay * 7); ctx.lineTo(cx, cy + ay * 7); ctx.lineTo(cx + 14, cy - ay * 7); }
    ctx.stroke();
  }
  ctx.restore(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2; ctx.strokeRect(px + 1, py + 1, T - 2, T - 2);
}
function drawWall(x, y) {
  const px = x * T, py = y * T;
  ctx.fillStyle = (x + y) & 1 ? "#5a4585" : "#52407d"; ctx.fillRect(px, py, T, T);
  ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fillRect(px, py, T, 8);
  circ(px + 20, py + 40, 3, "rgba(255,255,255,.1)"); circ(px + 56, py + 24, 3, "rgba(255,255,255,.1)");
}
function drawCounterBase(px, py, top = PAL.woodHi) {
  ctx.fillStyle = PAL.woodLo; ctx.fillRect(px, py, T, T);
  rr(px + 4, py + 4, T - 8, T - 15, 11); paint(top, PAL.woodLine, 3);
  rr(px + 8, py + T - 14, T - 16, 6, 3); paint("rgba(0,0,0,.12)");
}

// ---- 設備 ----
function drawCrate(c, px, py, cx, cy) {
  drawCounterBase(px, py, "#f4cf94");
  rr(px + 12, py + 14, T - 24, T - 32, 8); paint("#d79f5f", PAL.woodLine, 3);
  ctx.strokeStyle = "rgba(122,74,34,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 14, py + 32); ctx.lineTo(px + T - 14, py + 32); ctx.moveTo(px + 14, py + 46); ctx.lineTo(px + T - 14, py + 46); ctx.stroke();
  shadow(cx, cy - 6, 18, 5);
  emo(ING[CRATE[c.t]].emoji, cx, cy - 12, 38);
  if (c.stock !== null) { rr(cx - 20, py + T - 24, 40, 18, 9); paint(c.stock ? "#fff" : "#ffd9d9", PAL.ink, 2); txt(`×${c.stock}`, cx, py + T - 15, 14, "center", c.stock ? PAL.ink : PAL.tomato); }
}
function drawBoard(c, px, py, cx, cy) {
  drawCounterBase(px, py);
  rr(px + 10, py + 12, T - 20, T - 30, 9); paint("#fff0c9", PAL.woodLine, 3);
  ctx.strokeStyle = "rgba(138,90,48,.25)"; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + 18, py + 24 + i * 11); ctx.lineTo(px + T - 18, py + 24 + i * 11); ctx.stroke(); }
  emo("🔪", px + T - 18, py + 18, 18);
}
function drawCooker(c, px, py, cx, cy, tnow) {
  drawCounterBase(px, py, "#e9eef6");
  const burnt = c.stove === "burnt", active = c.stove === "cooking" || c.stove === "done";
  const body = burnt ? "#2e2a3a" : c.t === "S" ? "#5b5f73" : c.t === "F" ? "#aab6c8" : "#ff8a5c";
  rr(px + 8, py + 9, T - 16, T - 24, 12); paint(body, PAL.ink, 3);
  if (c.t === "S") {
    for (const dx of [-14, 14]) { circ(cx + dx, cy - 8, 12, "#2f3140", PAL.ink, 2); circ(cx + dx, cy - 8, 7, active && c.stove === "cooking" ? "#ff9f43" : "#444759"); }
  } else if (c.t === "F") {
    rr(px + 16, py + 16, T - 32, 26, 8); paint(burnt ? "#3a342a" : "#ffe27a", PAL.ink, 2);
    ctx.strokeStyle = "rgba(58,43,87,.35)"; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(px + 24 + i * 14, py + 20); ctx.lineTo(px + 24 + i * 14, py + 38); ctx.stroke(); }
  } else {
    rr(px + 16, py + 18, T - 32, 26, 8); paint(active ? "#ffd27a" : "#5a3a3a", PAL.ink, 2);
    rr(px + 20, py + 12, T - 40, 4, 2); paint("#fff");
  }
  for (const dx of [-16, 0, 16]) circ(cx + dx, py + T - 20, 3, "#fff", PAL.ink, 1.5);
  if (c.sitem && active) drawItem(c.stove === "done" ? { kind: "ing", type: c.sitem.type, state: c.res } : { kind: "ing", type: c.sitem.type, state: "raw" }, cx, cy - 6, 0.82);
  if (c.stove === "done") { circ(px + T - 14, py + 14, 11, PAL.mint, "#fff", 2.5); txt("✔", px + T - 14, py + 14.5, 14, "center", "#fff"); }
  if (burnt) emo("🔥", cx, cy - 6, 34);
  if (c.stove === "cooking") bar(px, py, Math.min(1, c.prog / c.need), PAL.mint);
  if (c.stove === "done") bar(px, py, Math.min(1, (c.prog - c.need) / (14 / stage.burn)), PAL.sun, true);
}
function drawStation(c, x, y, tnow) {
  const px = x * T, py = y * T, cx = px + T / 2, cy = py + T / 2, t = c.t;
  if (t === "#") { if (c.inner) drawWall(x, y); else drawCounterBase(px, py); return; }
  if (CRATE[t]) return drawCrate(c, px, py, cx, cy);
  if (t === "C") return drawBoard(c, px, py, cx, cy);
  if (isCooker(t)) return drawCooker(c, px, py, cx, cy, tnow);
  drawCounterBase(px, py, t === "K" ? "#ffe9a8" : PAL.woodHi);
  if (t === "P") {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(cx, cy + 4 - i * 6, 24, 11, 0, 0, 7); paint("#fff", PAL.ink, 2); ctx.beginPath(); ctx.ellipse(cx, cy + 4 - i * 6, 15, 6, 0, 0, 7); paint("#dfe9ff"); }
    rr(cx - 20, py + T - 24, 40, 18, 9); paint("#fff", PAL.ink, 2); txt(`×${plates}`, cx, py + T - 15, 14, "center", plates ? PAL.ink : PAL.tomato);
  } else if (t === "Z") {
    rr(px + 8, py + 10, T - 16, T - 26, 12); paint(PAL.steel, PAL.ink, 3);
    rr(px + 15, py + 22, T - 30, T - 44, 10); paint("#8fd8ff", PAL.ink, 2);
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx, py + 22); ctx.lineTo(cx, py + 13); ctx.lineTo(cx + 9, py + 13); ctx.stroke(); ctx.lineCap = "butt";
    if (c.dirty) { rr(cx - 22, py + T - 24, 44, 18, 9); paint("#fff", PAL.ink, 2); txt(`🍽×${c.dirty}`, cx, py + T - 15, 13, "center", PAL.ink); }
    if (c.prog > 0 && c.dirty) bar(px, py, c.prog / washTime, PAL.sky);
  } else if (t === "X") {
    rr(px + 14, py + 22, T - 28, T - 36, 8); paint("#9aa3b8", PAL.ink, 3);
    rr(px + 10, py + 14, T - 20, 12, 6); paint("#b7bfd1", PAL.ink, 3);
    ctx.strokeStyle = "rgba(58,43,87,.35)"; ctx.lineWidth = 2; for (const dx of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(cx + dx, py + 32); ctx.lineTo(cx + dx, py + T - 20); ctx.stroke(); }
  } else if (t === "D") {
    rr(px + 4, py + 6, T - 8, 22, 6); paint("#fff", PAL.ink, 3);
    ctx.save(); rr(px + 4, py + 6, T - 8, 22, 6); ctx.clip(); ctx.fillStyle = PAL.tomato; for (let i = 0; i < 4; i++) ctx.fillRect(px + 4 + i * 20, py + 6, 10, 22); ctx.restore();
    rr(px + 4, py + 6, T - 8, 22, 6); ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.stroke();
    rr(cx - 26, py + 36, 52, 26, 13); paint(PAL.mint, PAL.ink, 3); txt("提供", cx, py + 49.5, 18, "center", "#fff", PAL.ink);
  } else if (t === "K") {
    if (!c.item) txt("⇄", cx, cy, 30, "center", "#c8923d");
    ctx.strokeStyle = "#e2a93a"; ctx.lineWidth = 3; rr(px + 8, py + 8, T - 16, T - 24, 9); ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
  } else if (t === "E") {
    rr(px + 10, py + 6, T - 20, T - 12, 10); paint("#b9763a", PAL.ink, 3);
    rr(px + 18, py + 14, T - 36, 22, 6); paint("#bfe9ff", PAL.ink, 2); circ(px + T - 20, cy + 10, 4, PAL.sun, PAL.ink, 1.5);
    rr(cx - 22, py + 44, 44, 18, 6); paint("#fff", PAL.ink, 2); txt("OPEN", cx, py + 53.5, 12, "center", PAL.tomato);
  }
}
const TABLE_COLS = ["#ff9fb8", "#9fd8ff", "#ffe27a", "#b9f0c4", "#d6bfff", "#ffc29f", "#a8f0f0", "#ffb3c1"];
function drawTable(c, x, y, who) {
  const px = x * T, py = y * T, cx = px + T / 2, cy = py + T / 2, tb = c.tb, col = TABLE_COLS[(tb.id - 1) % 8];
  shadow(cx, cy + 22, 28, 8);
  rr(px + 4, cy - 5, 8, 22, 4); paint(PAL.woodLo, PAL.woodLine, 2); rr(px + T - 12, cy - 5, 8, 22, 4); paint(PAL.woodLo, PAL.woodLine, 2);
  circ(cx, cy + 4, 28, col, PAL.ink, 3); circ(cx, cy + 4, 20, "rgba(255,255,255,.55)");
  txt(String(tb.id), px + 13, py + 13, 14, "center", PAL.ink, "#fff");
  const face = (e, fx, fy, s) => { circ(fx, fy, s * 0.62, "#fff", PAL.ink, 2.5); emo(e, fx, fy + 1, s); };
  if (tb.state === "order") {
    face(tb.who, cx, cy - 8, 32); circ(cx + 26, py + 8, 13, "#fff", PAL.ink, 2.5); emo("💬", cx + 26, py + 9, 17); bar(px, py, tb.t / tb.max, PAL.sun);
  } else if (tb.state === "wait") {
    face(tb.who, cx, cy - 4, 30);
    const s = ticketIcons(tb.ticket.r); ctx.font = `800 13px ${FONT_BODY}`; const w = Math.max(40, ctx.measureText(s).width + 16);
    rr(cx - w / 2, py - 14, w, 22, 11); paint("#fff", PAL.ink, 2.5);
    ctx.beginPath(); ctx.moveTo(cx - 5, py + 8); ctx.lineTo(cx, py + 14); ctx.lineTo(cx + 5, py + 8); paint("#fff", PAL.ink, 2.5);
    txt(s, cx, py - 2.5, 13, "center", PAL.ink);
    bar(px, py, Math.max(0, tb.ticket.t / tb.ticket.max), tb.ticket.t < 15 ? PAL.tomato : PAL.mint);
  } else if (tb.state === "eat") { face("😋", cx, cy - 8, 32); emo("🍽", cx, cy + 20, 24); bar(px, py, 1 - tb.t / tb.max, PAL.sky); }
  else if (tb.state === "pay") { face(tb.who, cx - 10, cy - 6, 28); emo("💰", cx + 18, cy - 12, 28); bar(px, py, tb.t / tb.max, PAL.sun); }
  else if (tb.state === "dirty") drawItem({ kind: "dirty" }, cx, cy + 2, 1);
}
function bar(px, py, f, col, flash) {
  rr(px + 8, py + T - 13, T - 16, 9, 4.5); paint("rgba(58,43,87,.55)");
  if (f > 0.02) { rr(px + 8, py + T - 13, Math.max(9, (T - 16) * Math.min(1, f)), 9, 4.5); paint(flash && ((performance.now() / 160) | 0) % 2 ? "#fff" : col); }
  rr(px + 8, py + T - 13, T - 16, 9, 4.5); ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; ctx.stroke();
}

// ---- キャラクター(丸いシェフ) ----
function drawChef(p, tnow) {
  const x = p.x * T, y = p.y * T, ph = p.walk || 0, moving = (p.spd || 0) > 0.3;
  const bob = moving ? Math.abs(Math.sin(ph)) * 5 : Math.sin(tnow * 3 + x) * 1.2, sq = moving ? Math.sin(ph * 2) * 0.05 : 0;
  const [dx, dy] = p.dir;
  shadow(x, y + 22, 21, 7, 0.25);
  ctx.save(); ctx.translate(x, y - bob); ctx.scale(1 + sq, 1 - sq);
  // 手(前の方向)
  circ(-23 + dx * 4, 4 + dy * 4, 7, "#ffe0c2", PAL.ink, 2.5); circ(23 + dx * 4, 4 + dy * 4, 7, "#ffe0c2", PAL.ink, 2.5);
  // 体
  ctx.beginPath(); ctx.ellipse(0, 4, 24, 22, 0, 0, 7); paint(p.col, PAL.ink, 3.5);
  ctx.beginPath(); ctx.ellipse(0, 14, 17, 9, 0, 0, 7); paint("rgba(255,255,255,.88)");           // エプロン
  // 顔
  const ex = dx * 6, ey = dy * 3 - 3;
  circ(-8 + ex, ey, 5.5, "#fff", PAL.ink, 1.8); circ(8 + ex, ey, 5.5, "#fff", PAL.ink, 1.8);
  circ(-8 + ex + dx * 1.8, ey + dy * 1.5, 2.8, PAL.ink); circ(8 + ex + dx * 1.8, ey + dy * 1.5, 2.8, PAL.ink);
  circ(-15 + ex * 0.5, ey + 8, 3.2, "rgba(255,143,184,.8)"); circ(15 + ex * 0.5, ey + 8, 3.2, "rgba(255,143,184,.8)");
  ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(ex * 0.6, ey + 8, 4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.lineCap = "butt";
  // コック帽
  if (dy <= 0) { rr(-14, -34, 28, 12, 4); paint("#fff", PAL.ink, 2.5); }
  circ(-9, -35, 9, "#fff", PAL.ink, 2.5); circ(9, -35, 9, "#fff", PAL.ink, 2.5); circ(0, -40, 10, "#fff", PAL.ink, 2.5);
  if (dy > 0) { rr(-14, -32, 28, 10, 4); paint("#fff", PAL.ink, 2.5); }
  rr(-14, -26, 28, 6, 3); paint(p.col, PAL.ink, 2);
  ctx.restore();
  if (p.item) drawItem(p.item, x + dx * 34, y + dy * 30 - 4 - bob * 0.6, 0.92);
  if (p.ai) {
    ctx.font = `800 15px ${FONT_BODY}`; const w = ctx.measureText(p.name).width + 22;
    rr(x - w / 2, y - 66, w, 20, 10); paint(p.col, "#fff", 2.5); txt("🤖" + p.name, x, y - 55.5, 14, "center", "#fff", PAL.ink);
    if (p.sayT > 0 && p.say) {
      ctx.font = `800 16px ${FONT_BODY}`;
      const bw = Math.min(ctx.measureText(p.say).width + 24, 440), bx = Math.max(4, Math.min(W * T - bw - 4, x - bw / 2)), by = y - 108;
      rr(bx, by, bw, 32, 16); paint("#fff", PAL.ink, 3);
      ctx.beginPath(); ctx.moveTo(x - 6, by + 31); ctx.lineTo(x, by + 40); ctx.lineTo(x + 6, by + 31); paint("#fff", PAL.ink, 3);
      ctx.beginPath(); ctx.moveTo(x - 4, by + 30); ctx.lineTo(x + 4, by + 30); ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.stroke();
      txt(p.say.length > 28 ? p.say.slice(0, 27) + "…" : p.say, bx + bw / 2, by + 17, 16, "center", PAL.ink);
    }
  } else {
    const me = players.indexOf(p) + 1; ctx.beginPath(); ctx.moveTo(x - 7, y - 62); ctx.lineTo(x + 7, y - 62); ctx.lineTo(x, y - 53); ctx.closePath(); paint(p.col, "#fff", 2.5);
    txt(me + "P", x, y - 72, 14, "center", "#fff", PAL.ink);
  }
}

// ---- 画面全体 ----
function drawWorld(tnow) {
  const hallX = stage.hallX;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = tiles[y][x], hall = hallX !== null && x >= hallX;
    if (c.t === "." || c.t === "~" || c.t === "B") drawFloor(c.t === "B" ? { t: "." } : c, x, y, hall);
    else if (ARROW[c.t]) drawBelt(c, x * T, y * T, tnow);
    else if (c.t !== "B") drawStation(c, x, y, tnow);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = tiles[y][x];
    if (c.t === "B") drawTable(c, x, y);
    if (c.item) {
      const cx = x * T + T / 2, cy = y * T + T / 2;
      drawItem(c.item, cx, cy - 8, 0.95);
      if (c.t === "C" && c.prog > 0) bar(x * T, y * T, c.prog / chopTime, PAL.mint);
    }
  }
  [...players].sort((a, b) => a.y - b.y).forEach(p => drawChef(p, tnow));
  drawFx();
  if (isEv("blackout")) {
    const dc = dark.getContext("2d");
    dc.globalCompositeOperation = "source-over"; dc.fillStyle = "rgba(33,22,60,.92)"; dc.fillRect(0, 0, W * T, H * T);
    dc.globalCompositeOperation = "destination-out";
    for (const p of players) {
      const g = dc.createRadialGradient(p.x * T, p.y * T, 20, p.x * T, p.y * T, 140);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      dc.fillStyle = g; dc.fillRect(p.x * T - 140, p.y * T - 140, 280, 280);
    }
    ctx.drawImage(dark, 0, 0);
  }
  for (const q of popups) { const a = Math.min(1, q.life * 2.2); ctx.globalAlpha = a; txt(q.txt, q.x * T, q.y * T, 28, "center", q.col, PAL.ink, FONT_POP); ctx.globalAlpha = 1; }
}

function panel(x, y, w, h, fill = "#fff", r = 22) {
  rr(x + 0, y + 6, w, h, r); ctx.fillStyle = "rgba(20,12,40,.45)"; ctx.fill();
  rr(x, y, w, h, r); paint(fill, PAL.ink, 4);
}
function chip(x, y, label, fill, col = "#fff", size = 18) {
  ctx.font = `800 ${size}px ${FONT_BODY}`; const w = ctx.measureText(label).width + 24;
  rr(x - w / 2, y - size * 0.85, w, size * 1.7, size * 0.85); paint(fill, PAL.ink, 3); txt(label, x, y + 1, size, "center", col);
  return w;
}
function wrapText(s, x, y, maxW, size, lh, col = PAL.ink) {
  ctx.font = `800 ${size}px ${FONT_BODY}`; const lines = []; let line = "";
  for (const ch of s) { if (ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; } else line += ch; }
  lines.push(line);
  lines.forEach((l, i) => txt(l, x, y + i * lh, size, "center", col));
  return lines.length;
}

function drawHud(tnow) {
  // 下のバー
  ctx.fillStyle = PAL.ink; ctx.fillRect(0, MAPH, cv.width, cv.height - MAPH);
  ctx.fillStyle = PAL.sun; ctx.fillRect(0, MAPH, cv.width, 4);
  ctx.fillStyle = "rgba(255,255,255,.05)"; for (let i = 0; i < 24; i++) ctx.fillRect(i * 44, MAPH + 4, 22, cv.height);
  // 残り時間(リング)
  const f = Math.max(0, timeLeft) / stage.time, low = timeLeft < 20, pulse = low ? 1 + Math.sin(tnow * 10) * 0.05 : 1;
  ctx.save(); ctx.translate(46, 680); ctx.scale(pulse, pulse);
  circ(0, 0, 30, "#fff", PAL.ink, 3);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.closePath(); ctx.fillStyle = low ? PAL.tomato : PAL.mint; ctx.fill();
  circ(0, 0, 17, "#fff", PAL.ink, 2.5); txt(String(Math.max(0, Math.ceil(timeLeft))), 0, 1, 20, "center", low ? PAL.tomato : PAL.ink, null, FONT_POP);
  ctx.restore();
  // スコアと星の進み具合
  txt("SCORE", 96, 659, 12, "left", "#b9a8e6");
  txt(String(score), 96, 681, 30, "left", "#fff", PAL.plum, FONT_POP);
  const bx = 96, bw = 270, by = 697, mx = goals[2] * 1.08;
  rr(bx, by - 6, bw, 12, 6); paint("rgba(255,255,255,.18)");
  const fr = Math.max(0, Math.min(1, score / mx)); if (fr > 0.01) { rr(bx, by - 6, Math.max(12, bw * fr), 12, 6); paint(PAL.sun); }
  goals.forEach((g, i) => { const gx = bx + bw * (g / mx), got = score >= g; star5(gx, by - 15, 10, got ? PAL.sun : "#6d5b94", got ? PAL.ink : "#443668"); txt(String(g), gx, by + 14, 11, "center", "#b9a8e6"); });
  // 注文票
  const on = orders.length, cw = Math.min(140, Math.floor(548 / Math.max(1, on)) - 6);
  orders.forEach((o, i) => {
    const x = 392 + i * (cw + 6), low2 = o.t < 12, wob = low2 ? Math.sin(tnow * 14 + i) * 1.5 : 0, y = 648;
    ctx.save(); ctx.translate(wob, 0);
    rr(x, y, cw, 68, 10); paint("#fffbe9", PAL.ink, 3);
    rr(x, y, cw, 22, 10); paint(low2 ? PAL.tomato : PAL.pink, PAL.ink, 3);
    ctx.fillStyle = low2 ? PAL.tomato : PAL.pink; ctx.fillRect(x + 3, y + 12, cw - 6, 8);
    txt(`${o.table ? o.table + "番 " : ""}${o.r.name}`, x + cw / 2, y + 12, cw < 120 ? 12 : 14, "center", "#fff", PAL.ink);
    txt(ticketIcons(o.r), x + cw / 2, y + 43, o.r.need.length > 2 ? 14 : 18, "center", PAL.ink);
    rr(x + 6, y + 56, cw - 12, 7, 3.5); paint("rgba(58,43,87,.18)");
    const fr2 = Math.max(0, o.t / o.max); if (fr2 > 0.02) { rr(x + 6, y + 56, Math.max(7, (cw - 12) * fr2), 7, 3.5); paint(low2 ? PAL.tomato : PAL.mint); }
    ctx.restore();
  });
}

function draw() {
  const tnow = performance.now() / 1000;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = PAL.plum; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!stage) { txt("てんやわんやキッチン", 480, 300, 54, "center", "#fff", PAL.ink, FONT_POP); return; }
  ctx.save();
  const sx = shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * 14 : 0;
  ctx.translate(view.ox + sx, view.oy + sy); ctx.scale(view.sc, view.sc);
  ctx.beginPath(); ctx.rect(-20, -20, W * T + 40, H * T + 40); ctx.clip();
  drawWorld(tnow);
  ctx.restore();
  drawHud(tnow);
  if (ev) {
    const d = EVENTS[ev.type], label = `${d.icon} ${d.name}  ${Math.ceil(ev.t)}秒`;
    ctx.font = `800 22px ${FONT_BODY}`; const w = ctx.measureText(label).width + 36;
    rr(480 - w / 2, 8, w, 36, 18); paint(PAL.sun, PAL.ink, 3.5); txt(label, 480, 27, 22, "center", PAL.ink);
  }
  if (banner.t > 0) {
    const k = Math.min(1, (3.5 - banner.t) * 6), sc = 0.6 + 0.4 * (1 - Math.pow(1 - k, 3));
    ctx.save(); ctx.translate(480, 300); ctx.scale(sc, sc);
    rr(-370, -44, 740, 88, 30); paint("#fff", PAL.ink, 5); txt(banner.txt, 0, 2, 34, "center", PAL.tomato, null, FONT_POP);
    ctx.restore();
  }
  if (state === "play" && introT > 0) {
    ctx.fillStyle = "rgba(45,34,80,.78)"; ctx.fillRect(0, 0, cv.width, MAPH);
    const col = WORLD_COL[stage.world - 1], h = stage.tip ? 300 : 232;
    panel(120, 320 - h / 2 - 30, 720, h);
    rr(120, 320 - h / 2 - 30, 720, 56, 22); paint(col, PAL.ink, 4); ctx.fillStyle = col; ctx.fillRect(124, 320 - h / 2 + 8, 712, 20);
    txt(`${stage.emoji} ${stage.world}-${stage.k}  ${stage.name}`, 480, 320 - h / 2 - 2, 30, "center", "#fff", PAL.ink, FONT_POP);
    let y = 320 - h / 2 + 52;
    txt(`${stage.worldName}  ${stage.label}  ⏱ ${stage.time}秒  ${stage.mode === "kitchen" ? "🍳 厨房モード" : "🛎 接客モード"}`, 480, y, 18, "center", "#6b5a8c");
    y += 34; txt("メニュー: " + stage.menu.join(" / "), 480, y, 18, "center", PAL.ink);
    y += 30; txt(stage.gimmicks.join("   "), 480, y, 17, "center", "#4a8fc8");
    if (stage.tip) { y += 52; rr(150, y - 28, 660, 70, 16); paint("#fff4c9", "#e2b94a", 3); wrapText("💡 " + stage.tip, 480, y - 6, 620, 20, 28); }
    if (introT < 1.6) txt("スタート!", 480, 560, 60, "center", PAL.sun, PAL.ink, FONT_POP);
  }
  if (paused) { ctx.fillStyle = "rgba(45,34,80,.7)"; ctx.fillRect(0, 0, cv.width, MAPH); txt("ポーズ中", 480, 300, 56, "center", "#fff", PAL.ink, FONT_POP); }
}
