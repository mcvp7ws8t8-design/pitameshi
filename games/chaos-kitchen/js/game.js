"use strict";
// てんやわんやキッチン: ゲーム本体(ステージのデータで動く)
const T = 80, MAPW = 960, MAPH = 640;
const { ING, CRATE, RECIPES, RECIPE_BY_NAME, EVENTS, COOKERS, STATE_TAG } = CKData;
const { STAGES, WORLDS, WALK } = CKStages;
const $ = id => document.getElementById(id);
const cv = $("c"), ctx = cv.getContext("2d");

// ---- 調整値 ----
const chopTime = 1.5, washTime = 2.5, eatTime = 8, payWait = 20, tableOrderWait = 35, plateReturn = 4, stockRegen = 7;
const CUSTOMERS = ["🧑", "👩", "👨", "👵", "🧒", "👴"];
const ARROW = { "→": [1, 0], "←": [-1, 0], "↑": [0, -1], "↓": [0, 1] };
const isCounter = c => c.t === "#" || c.t === "K";
const isCooker = ch => ch in COOKERS;
const itemKey = i => i.type + ":" + i.state;
const plateKey = it => it.contents.map(itemKey).sort().join(",");
const needKey = r => [...r.need].sort().join(",");
const dishOf = plate => RECIPES.find(r => needKey(r) === plateKey(plate));
const popup = (txt, x, y, col = "#fff") => popups.push({ txt, x, y, life: 1.2, col });

// ---- 状態 ----
let W = 0, H = 0, tiles = [], stage = null, view = { sc: 1, ox: 0, oy: 0 };
let state = "home", paused = false;               // home / select / play / result
let players = [], orders = [], score = 0, timeLeft = 0, spawnIn = 0, popups = [], introT = 0, goals = [30, 40, 50];
let plates = 0, platePending = [], spawnEvery = 20, selBot = 0, lastResult = null, served = 0;
let ev = null, evNext = 25, banner = { txt: "", t: 0 };
const dark = document.createElement("canvas");

// ---- 進み具合の保存 ----
let prog = { stars: {}, best: {}, mode: 3 };
try { Object.assign(prog, JSON.parse(localStorage.getItem("ck-prog") || "{}")); } catch {}
const saveProg = () => { try { localStorage.setItem("ck-prog", JSON.stringify(prog)); } catch {} };
const UNLOCK_ALL = /[?&]unlock=all/.test(location.search) || location.hash === "#unlock";
const unlocked = id => UNLOCK_ALL || prog.unlockAll || id === 1 || (prog.stars[id - 1] || 0) >= 1;
const totalStars = () => Object.values(prog.stars).reduce((a, b) => a + b, 0);

// ---- 入力 ----
const keys = new Set();
addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Escape" && (state === "play")) { setPause(!paused); return; }
  keys.add(e.code);
  if (state === "play" && !paused) players.forEach(p => { if (p.keys && e.code === p.keys.act && !e.repeat) interact(p); });
  if (state === "result" && e.code === "Enter") $("resNext").click();
  if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
});
addEventListener("keyup", e => keys.delete(e.code));

// ---- ステージ開始 ----
function startStage(id, mode) {
  stage = STAGES[id - 1];
  let tid = 0;
  tiles = stage.map.map((row, y) => [...row].map((t, x) => ({
    t, x, y, item: null, prog: 0, stove: "idle", sitem: null, need: 0, res: "", owner: null, dirty: 0,
    tb: t === "B" ? { id: ++tid, state: "empty", t: 0, max: 1, ticket: null, pts: 0, who: "" } : null,
    stock: CRATE[t] && stage.stock ? stage.stock : null, regen: 0,
  })));
  H = tiles.length; W = tiles[0].length;
  const sc = Math.min(1.25, MAPW / (W * T), MAPH / (H * T));
  view = { sc, ox: (MAPW - W * T * sc) / 2, oy: (MAPH - H * T * sc) / 2 };
  dark.width = W * T; dark.height = H * T;
  plates = stage.plates; platePending = [];
  const humans = mode === 2 ? 2 : 1;
  const nAi = Math.min(3, Math.max(mode >= 3 ? mode - 2 : 0, stage.minPlayers - humans));
  players = [{ x: 0, y: 0, dir: [0, 1], item: null, col: "#e8504a", keys: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", act: "KeyE", chop: "KeyQ" } }];
  if (humans === 2) players.push({ x: 0, y: 0, dir: [0, 1], item: null, col: "#4a8be8", keys: { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", act: "Period", chop: "Comma" } });
  for (let i = 0; i < nAi; i++) players.push(newBot(i));
  players.forEach((p, i) => { [p.x, p.y] = stage.spawns[i]; });
  spawnEvery = Math.max(7, Math.round(stage.spawn * 4.5 / (nAi + 1.5 * humans)));   // 人手が多いほど、お客は早く来る
  const avgNeed = stage.menu.reduce((a, n) => a + RECIPE_BY_NAME[n].need.length, 0) / stage.menu.length;
  const base = (1 + stage.time / spawnEvery) * (22 + 7 * (avgNeed - 1));
  goals = [0.35, 0.65, 0.95].map(f => Math.max(30, Math.round(base * f / 10) * 10));
  goals[1] = Math.max(goals[1], goals[0] + 10); goals[2] = Math.max(goals[2], goals[1] + 10);
  served = 0; orders = []; score = 0; popups = []; timeLeft = stage.time; spawnIn = 0; ev = null; banner.t = 0;
  evNext = stage.events.length ? stage.evGap * 0.8 : 1e9;
  introT = stage.tip ? 5 : 3; paused = false; state = "play";
  prog.mode = mode; saveProg();
  setupAiUi(nAi);
  showScreen(null); $("pauseBtn").style.display = "block";
}

const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !WALK.has(tiles[y][x].t);
const target = p => {
  const tx = Math.floor(p.x + p.dir[0] * 0.8), ty = Math.floor(p.y + p.dir[1] * 0.8);
  return tx < 0 || ty < 0 || tx >= W || ty >= H ? null : tiles[ty][tx];
};

// 切った・調理した材料はお皿に乗せられる。生のままOKなのはパンなど。同じ材料は1つまで、3つまで。
function canAdd(plate, ing) {
  if (ing.kind !== "ing" || plate.contents.length >= 3 || plate.contents.some(c => c.type === ing.type)) return false;
  return ing.state !== "raw" || !!ING[ing.type].rawOk;
}
const cookSpec = (type, station) => ING[type].cook && ING[type].cook[station];

function tableAct(p, c, h) {
  const tb = c.tb;
  if (!h) {
    if (tb.state === "order") {
      const r = RECIPE_BY_NAME[stage.menu[Math.floor(Math.random() * stage.menu.length)]];
      const o = { r, t: stage.patience, max: stage.patience, table: tb.id, tile: c };
      orders.push(o); tb.state = "wait"; tb.ticket = o; popup(`${tb.id}番 ${r.name}`, p.x, p.y, "#ffd66b");
    } else if (tb.state === "pay") { score += tb.pts; popup("+" + tb.pts, p.x, p.y, "#7CFC7C"); tb.state = "dirty"; }
    else if (tb.state === "dirty") { p.item = { kind: "dirty" }; tb.state = "empty"; }
    return;
  }
  if (h.kind === "plate" && tb.state === "wait" && h.contents.length) {
    if (needKey(tb.ticket.r) === plateKey(h)) {
      const o = tb.ticket; tb.pts = ticketPts(o); served++;
      orders.splice(orders.indexOf(o), 1); tb.ticket = null; tb.state = "eat"; tb.t = eatTime; tb.max = eatTime; p.item = null;
      popup("いただきます!", p.x, p.y);
    } else popup("注文と違う!", p.x, p.y, "#ff7777");
  }
}
const ticketPts = o => (20 + 8 * (o.r.need.length - 1) + Math.floor(o.t / 5)) * (isEv("rush") ? 2 : 1);

function interact(p) {
  const c = target(p); if (!c) return;
  const h = p.item, t = c.t;
  if (t === "B") return tableAct(p, c, h);
  if (t === "Z") { if (h && h.kind === "dirty" && c.dirty < 6) { c.dirty++; p.item = null; popup("シンクへ", p.x, p.y); } return; }
  if (t === "P") {
    if (!h) { if (plates > 0) { plates--; p.item = { kind: "plate", contents: [] }; } else popup("お皿がない!", p.x, p.y, "#ff7777"); }
    else if (h.kind === "plate" && !h.contents.length) { plates++; p.item = null; }
    return;
  }
  if (t === "D") {                                           // 提供窓口(厨房モード)
    if (!h || h.kind !== "plate" || !h.contents.length) return;
    const o = orders.filter(o => needKey(o.r) === plateKey(h)).sort((a, b) => a.t - b.t)[0];
    if (o) { const pts = ticketPts(o); served++; score += pts; orders.splice(orders.indexOf(o), 1); popup("+" + pts, p.x, p.y, "#7CFC7C"); }
    else { score -= 5; popup("-5 注文と違う!", p.x, p.y, "#ff7777"); }
    p.item = null; platePending.push(plateReturn); return;
  }
  if (t === "X") {
    if (!h) return;
    if (h.kind === "dirty") popup("洗ってね", p.x, p.y, "#ff7777");
    else if (h.kind === "plate") h.contents = [];
    else p.item = null;
    return;
  }
  if (CRATE[t]) {                                            // 材料の置き場
    const type = CRATE[t];
    if (!h) {
      if (c.stock !== null && c.stock <= 0) { popup("在庫なし!", p.x, p.y, "#ff7777"); return; }
      if (c.stock !== null) c.stock--;
      p.item = { kind: "ing", type, state: "raw" };
    } else if (h.kind === "plate" && ING[type].rawOk && canAdd(h, { kind: "ing", type, state: "raw" })) {
      if (c.stock !== null && c.stock <= 0) { popup("在庫なし!", p.x, p.y, "#ff7777"); return; }
      if (c.stock !== null) c.stock--;
      h.contents.push({ type, state: "raw" });
    }
    return;
  }
  if (isCooker(t)) {                                         // コンロ・フライヤー・オーブン
    if (c.stove === "burnt") { c.stove = "idle"; c.sitem = null; c.prog = 0; popup("片付けた", p.x, p.y); return; }   // 手がふさがっていても片付けられる
    if (!h) {
      if (c.stove === "done") { p.item = { kind: "ing", type: c.sitem.type, state: c.res }; c.stove = "idle"; c.sitem = null; c.prog = 0; }
      return;
    }
    if (h.kind === "ing") {
      const k = cookSpec(h.type, t);
      if (c.stove === "idle" && k && h.state === k.from) {
        c.stove = "cooking"; c.sitem = h; c.need = k.t; c.res = COOKERS[t].res; c.prog = 0; c.owner = p.ai ? p.name : null; p.item = null;
      } else popup(k ? (c.stove === "idle" ? (k.from === "chopped" ? "先に切ろう" : "そのまま入れてね") : "使用中") : "入らない", p.x, p.y, "#ff7777");
    } else if (h.kind === "plate" && c.stove === "done" && canAdd(h, { kind: "ing", type: c.sitem.type, state: c.res })) {
      h.contents.push({ type: c.sitem.type, state: c.res }); c.stove = "idle"; c.sitem = null; c.prog = 0;
    }
    return;
  }
  if (t === "C") {                                           // まな板
    if (!h) { if (c.item) { p.item = c.item; c.item = null; c.prog = 0; } return; }
    if (!c.item && h.kind === "ing") {
      if (h.state === "raw" && !ING[h.type].chop) { popup("切れない", p.x, p.y, "#ff7777"); return; }
      c.item = h; h.owner = p.ai ? p.name : null; c.prog = 0; p.item = null;
    } else if (c.item && c.item.kind === "ing" && c.item.state !== "raw" && h.kind === "plate" && canAdd(h, c.item)) {
      h.contents.push(c.item); c.item = null;
    }
    return;
  }
  if (isCounter(c)) {
    if (!h) { if (c.item) { p.item = c.item; c.item = null; c.prog = 0; } return; }
    if (!c.item) { c.item = h; p.item = null; }
    else if (c.item.kind === "plate" && canAdd(c.item, h)) { c.item.contents.push(h); p.item = null; }
    else if (h.kind === "plate" && canAdd(h, c.item)) { h.contents.push(c.item); c.item = null; }
  }
}

const isEv = n => ev && ev.type === n;
const ordCap = () => Math.min(6, 3 + players.filter(p => p.ai).length) + (isEv("rush") ? 2 : 0);

function update(dt) {
  if (introT > 0) { introT -= dt; return; }
  timeLeft -= dt;
  if (timeLeft <= 0) { finishStage(); return; }
  if (banner.t > 0) banner.t -= dt;
  evNext -= dt;
  if (ev) { ev.t -= dt; if (ev.t <= 0) { ev = null; evNext = stage.evGap * (0.7 + Math.random() * 0.6); } }
  else if (evNext <= 0 && timeLeft > 12) startEvent();
  for (let i = platePending.length - 1; i >= 0; i--) { platePending[i] -= dt; if (platePending[i] <= 0) { platePending.splice(i, 1); plates++; } }
  spawnIn -= dt;
  const tbs = tiles.flat().filter(c => c.t === "B");
  if (spawnIn <= 0) {
    if (stage.mode === "kitchen") {
      if (orders.length < ordCap()) orders.push({ r: RECIPE_BY_NAME[stage.menu[Math.floor(Math.random() * stage.menu.length)]], t: stage.patience, max: stage.patience });
    } else {
      const busy = tbs.filter(c => c.tb.state !== "empty").length, free = tbs.filter(c => c.tb.state === "empty");
      if (free.length && busy < Math.min(tbs.length, ordCap())) {
        const c = free[Math.floor(Math.random() * free.length)];
        Object.assign(c.tb, { state: "order", t: tableOrderWait, max: tableOrderWait, ticket: null, who: CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)] });
      }
    }
    spawnIn = isEv("rush") ? spawnEvery / 2 : spawnEvery;
  }
  for (const o of orders) o.t -= dt;
  for (let i = orders.length - 1; i >= 0; i--) if (orders[i].t <= 0) {
    const o = orders.splice(i, 1)[0]; score -= 10;
    if (o.tile) { popup("-10 待たせすぎ", o.tile.x + 0.5, o.tile.y + 0.5, "#ff7777"); o.tile.tb.state = "empty"; o.tile.tb.ticket = null; }
    else popup("-10 時間切れ", W / 2, 0.6, "#ff7777");
  }
  for (const c of tbs) {
    const tb = c.tb;
    if (tb.state === "order") { tb.t -= dt; if (tb.t <= 0) { tb.state = "empty"; score -= 10; popup("-10 帰っちゃった", c.x + 0.5, c.y + 0.5, "#ff7777"); } }
    else if (tb.state === "eat") { tb.t -= dt; if (tb.t <= 0) { tb.state = "pay"; tb.t = payWait; tb.max = payWait; } }
    else if (tb.state === "pay") { tb.t -= dt; if (tb.t <= 0) { tb.state = "dirty"; popup("お会計されず…", c.x + 0.5, c.y + 0.5, "#ff7777"); } }
  }
  for (const p of players) {
    const on = tiles[Math.floor(p.y)] && tiles[Math.floor(p.y)][Math.floor(p.x)];
    if (on && ARROW[on.t] && !p.ai) moveBy(p, ARROW[on.t][0] * 1.6 * dt, ARROW[on.t][1] * 1.6 * dt);      // ベルトコンベア(AIは流されない)
    if (p.ai) { botUpdate(p, dt); work(p, target(p), p.chopping, dt); continue; }
    let dx = (keys.has(p.keys.right) ? 1 : 0) - (keys.has(p.keys.left) ? 1 : 0);
    let dy = (keys.has(p.keys.down) ? 1 : 0) - (keys.has(p.keys.up) ? 1 : 0);
    if (!dx && !dy && p === players[0] && Math.hypot(joy.x, joy.y) > 0.3) { dx = joy.x; dy = joy.y; }
    let tvx = 0, tvy = 0;
    if (dx || dy) {
      p.dir = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      const l = Math.hypot(dx, dy); tvx = dx / l * 4.2; tvy = dy / l * 4.2;
    }
    if (isEv("slippery") || (on && on.t === "~")) {         // 滑る床(氷・イベント)
      const k = Math.min(1, 2.2 * dt); p.vx = (p.vx || 0) + (tvx - (p.vx || 0)) * k; p.vy = (p.vy || 0) + (tvy - (p.vy || 0)) * k;
    } else { p.vx = tvx; p.vy = tvy; }
    if (p.vx || p.vy) moveBy(p, p.vx * dt, p.vy * dt);
    work(p, target(p), keys.has(p.keys.chop) || (p === players[0] && touchChop), dt);
  }
  for (const row of tiles) for (const c of row) {
    if (isCooker(c.t) && (c.stove === "cooking" || c.stove === "done")) {
      c.prog += dt;
      if (c.stove === "cooking" && c.prog >= c.need) c.stove = "done";
      if (c.prog >= c.need + 14 / stage.burn) { c.stove = "burnt"; c.sitem = null; }
    }
    if (c.stock !== null && CRATE[c.t] && c.stock < stage.stock) { c.regen += dt; if (c.regen >= stockRegen) { c.regen = 0; c.stock++; } }
  }
  popups.forEach(q => { q.life -= dt; q.y -= dt * 0.6; });
  popups = popups.filter(q => q.life > 0);
}

// 長押し作業: まな板で切る / シンクで洗う
function work(p, c, on, dt) {
  if (!c || !on) return;
  if (c.t === "C" && c.item && c.item.kind === "ing" && c.item.state === "raw" && ING[c.item.type].chop) {
    c.prog += dt; if (c.prog >= chopTime) { c.item.state = "chopped"; c.prog = 0; }
  } else if (c.t === "Z" && c.dirty > 0) {
    c.prog += dt;
    if (c.prog >= washTime) { c.prog = 0; c.dirty--; plates++; popup("+お皿", p.x, p.y, "#9cf"); }
  }
}

function startEvent() {
  const type = stage.events[Math.floor(Math.random() * stage.events.length)], d = EVENTS[type];
  banner = { txt: `${d.icon} ${d.msg}`, t: 3.5 };
  if (d.dur) ev = { type, t: d.dur }; else evNext = stage.evGap * (0.7 + Math.random() * 0.6);
  if (type === "rush") spawnIn = 0;
  if (type === "fire") {
    const st = tiles.flat().filter(c => isCooker(c.t));
    if (st.length) { const c = st[Math.floor(Math.random() * st.length)]; c.stove = "burnt"; c.sitem = null; c.prog = 0; }
  }
  if (type === "mouse") {
    const cs = tiles.flat().filter(c => c.item && (isCounter(c) || c.t === "C"));
    if (cs.length) cs[Math.floor(Math.random() * cs.length)].item = null; else banner.txt = "🐭 ネズミは何も盗めなかった";
  }
  const bots = players.filter(p => p.ai);
  if (bots.length) { const b = bots[Math.floor(Math.random() * bots.length)]; b.say = { blackout: "真っ暗〜!", slippery: "うわ、滑る!", rush: "忙しくなるよ!", fire: "あちち!", mouse: "こらー!" }[type]; b.sayT = 2.5; }
}

function moveBy(p, dx, dy) {
  const r = 0.3, free = (x, y) => ![[-r, -r], [r, -r], [-r, r], [r, r]].some(([a, b]) => solid(Math.floor(x + a), Math.floor(y + b)));
  if (free(p.x + dx, p.y)) p.x += dx;
  if (free(p.x, p.y + dy)) p.y += dy;
}

// ---- 結果 ----
function finishStage() {
  state = "result"; $("pauseBtn").style.display = "none";
  const stars = goals.filter(g => score >= g).length;
  const id = stage.id, prev = prog.stars[id] || 0, newBest = score > (prog.best[id] || -1e9);
  if (stars > prev) prog.stars[id] = stars;
  if (newBest) prog.best[id] = score;
  saveProg();
  lastResult = { id, stars, score, newBest, firstClear: prev === 0 && stars > 0 };
  showResult();
}

// ---- 描画 ----
const COL = { "#": "#c9a36b", C: "#d9c08c", P: "#e9e9e9", D: "#7bc47b", X: "#777", ".": "#f1e6c8", B: "#f1e6c8", K: "#e0b36b", Z: "#9fcbe5", E: "#7a5a3a", "~": "#cfeaf7",
  S: "#6b6b6b", F: "#d9b44a", V: "#c9783a" };
function txt(s, x, y, size = 28, align = "center", col = "#fff") {
  ctx.font = `bold ${size}px system-ui,sans-serif`; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function drawItem(it, x, y, s = 1) {
  if (!it) return;
  if (it.kind === "dirty") {
    ctx.fillStyle = "#bfa98a"; ctx.beginPath(); ctx.ellipse(x, y, 26 * s, 20 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#8a7656"; ctx.stroke(); txt("💧", x + 12 * s, y - 8 * s, 16 * s); return;
  }
  if (it.kind === "plate") {
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(x, y, 26 * s, 20 * s, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#999"; ctx.stroke();
    const n = it.contents.length, sp = n > 2 ? 17 : 24;
    it.contents.forEach((c, i) => drawItem({ kind: "ing", ...c }, x + (i - (n - 1) / 2) * sp * s, y, n > 2 ? 0.5 * s : 0.6 * s));
    return;
  }
  ctx.font = `${34 * s}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(ING[it.type].emoji, x, y);
  if (it.state !== "raw") {
    ctx.fillStyle = "#222c"; ctx.beginPath(); ctx.arc(x + 15 * s, y + 13 * s, 10 * s, 0, 7); ctx.fill();
    txt(STATE_TAG[it.state], x + 15 * s, y + 13 * s, 13 * s, "center", "#fff");
  }
}
const ticketIcons = r => r.need.map(k => { const [t, s] = k.split(":"); return ING[t].emoji + (s === "raw" ? "" : STATE_TAG[s]); }).join(" ");

function drawCooker(c, px, py, cx, cy) {
  ctx.fillStyle = c.stove === "burnt" ? "#2a2a2a" : (c.t === "S" ? "#8a8a8a" : c.t === "F" ? "#f0cf6a" : "#e39a5a");
  ctx.beginPath(); ctx.roundRect(px + 8, py + 8, T - 16, T - 16, 10); ctx.fill();
  txt(COOKERS[c.t].emoji, px + 20, py + 18, 16);
  if (c.sitem && (c.stove === "cooking" || c.stove === "done")) {
    drawItem(c.stove === "done" ? { kind: "ing", type: c.sitem.type, state: c.res } : { kind: "ing", type: c.sitem.type, state: "raw" }, cx, cy + 2, 0.95);
  }
  if (c.stove === "done") txt("✔", cx + 22, cy - 22, 22, "center", "#2a8a2a");
  if (c.stove === "burnt") txt("🔥", cx, cy, 34);
  if (c.stove === "cooking") bar(px, py, Math.min(1, c.prog / c.need), "#7CFC7C");
  if (c.stove === "done") bar(px, py, Math.min(1, (c.prog - c.need) / (14 / stage.burn)), "#ff9a3c");
}
function drawTable(c, px, py, cx, cy) {
  const tb = c.tb;
  ctx.fillStyle = "#b07a45"; ctx.fillRect(px + 8, py + 8, T - 16, T - 16);
  ctx.strokeStyle = "#7a4f28"; ctx.strokeRect(px + 8, py + 8, T - 16, T - 16);
  txt(String(tb.id), px + 14, py + 14, 14, "center", "#fff");
  if (tb.state === "order") { txt(tb.who, cx, cy + 2, 38); txt("💬", cx + 22, py + 12, 22); bar(px, py, tb.t / tb.max, "#ffb23c"); }
  else if (tb.state === "wait") {
    txt(tb.who, cx, cy + 8, 32);
    ctx.fillStyle = "#000a"; ctx.fillRect(px + 2, py - 6, T - 4, 20); txt(ticketIcons(tb.ticket.r), cx, py + 4, tb.ticket.r.need.length > 2 ? 12 : 14);
    bar(px, py, Math.max(0, tb.ticket.t / tb.ticket.max), tb.ticket.t < 15 ? "#e8504a" : "#7CFC7C");
  } else if (tb.state === "eat") { txt("😋", cx, cy - 6, 30); txt("🍽", cx, cy + 20, 26); bar(px, py, 1 - tb.t / tb.max, "#9cf"); }
  else if (tb.state === "pay") { txt(tb.who, cx - 10, cy + 6, 30); txt("💰", cx + 16, cy - 8, 30); bar(px, py, tb.t / tb.max, "#ffb23c"); }
  else if (tb.state === "dirty") drawItem({ kind: "dirty" }, cx, cy);
}
function bar(px, py, f, col) {
  ctx.fillStyle = "#0006"; ctx.fillRect(px + 8, py + T - 12, T - 16, 7);
  ctx.fillStyle = col; ctx.fillRect(px + 8, py + T - 12, (T - 16) * Math.max(0, f), 7);
}

function drawWorld() {
  const hallX = stage.hallX;
  const tnow = performance.now() / 1000;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = tiles[y][x], px = x * T, py = y * T, cx = px + T / 2, cy = py + T / 2;
    const hall = hallX !== null && x >= hallX && (c.t === "." || c.t === "B");
    ctx.fillStyle = hall ? "#e8d3b5" : (CRATE[c.t] ? "#a8744a" : (COL[c.t] || "#f1e6c8"));
    ctx.fillRect(px, py, T, T);
    ctx.strokeStyle = "rgba(0,0,0,.08)"; ctx.strokeRect(px, py, T, T);
    if (c.t === "~") { ctx.strokeStyle = "#fff9"; ctx.beginPath(); ctx.moveTo(px + 12, py + 22); ctx.lineTo(px + 34, py + 12); ctx.moveTo(px + 44, py + 62); ctx.lineTo(px + 68, py + 50); ctx.stroke(); }
    if (ARROW[c.t]) {
      ctx.fillStyle = "#5a5a66"; ctx.fillRect(px, py, T, T);
      const [ax, ay] = ARROW[c.t], off = (tnow * 30) % 40;
      for (let i = -1; i < 2; i++) txt(c.t, cx + ax * (i * 40 + off - 20), cy + ay * (i * 40 + off - 20), 34, "center", "#ffd66b");
      ctx.strokeStyle = "rgba(0,0,0,.25)"; ctx.strokeRect(px, py, T, T);
    }
    if (CRATE[c.t]) {
      txt(ING[CRATE[c.t]].emoji, cx, cy - 2, 38);
      if (c.stock !== null) txt(`×${c.stock}`, cx, py + T - 13, 17, "center", c.stock ? "#fff" : "#ff8888");
    }
    if (c.t === "P") { txt("🍽", cx, cy - 6, 34); txt(`×${plates}`, cx, py + T - 14, 18, "center", plates ? "#333" : "#d33"); }
    if (c.t === "K" && !c.item) txt("受渡", cx, cy, 16, "center", "#8a5a1a");
    if (c.t === "D") txt("提供", cx, cy, 22, "center", "#143");
    if (c.t === "E") txt("🚪", cx, cy, 36);
    if (c.t === "Z") {
      txt("🚰", cx, cy - 6, 34); if (c.dirty) txt(`🍽×${c.dirty}`, cx, py + T - 14, 16, "center", "#234");
      if (c.prog > 0 && c.dirty) bar(px, py, c.prog / washTime, "#3a8bd8");
    }
    if (c.t === "B") drawTable(c, px, py, cx, cy);
    if (c.t === "X") txt("🗑", cx, cy, 34);
    if (c.t === "C") txt("🔪", cx, cy + 22, 16);
    if (isCooker(c.t)) drawCooker(c, px, py, cx, cy);
    if (c.item) {
      drawItem(c.item, cx, cy - 4);
      if (c.t === "C" && c.prog > 0) bar(px, py, c.prog / chopTime, "#7CFC7C");
    }
  }
  for (const p of players) {
    const px = p.x * T, py = p.y * T;
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(px, py, 24, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px + p.dir[0] * 12 - 6, py + p.dir[1] * 12 - 4, 5, 0, 7);
    ctx.arc(px + p.dir[0] * 12 + 8, py + p.dir[1] * 12 - 4, 5, 0, 7); ctx.fill();
    if (p.item) drawItem(p.item, px + p.dir[0] * 34, py + p.dir[1] * 34, 0.9);
    if (p.ai) {
      txt("🤖" + p.name, px, py - 38, 16, "center", p.col);
      if (p.sayT > 0 && p.say) {
        ctx.font = "bold 16px system-ui,sans-serif";
        const w = Math.min(ctx.measureText(p.say).width + 16, 440), bx = Math.max(4, Math.min(W * T - w - 4, px - w / 2));
        ctx.fillStyle = "#fffe"; ctx.fillRect(bx, py - 82, w, 30);
        txt(p.say.length > 28 ? p.say.slice(0, 27) + "…" : p.say, bx + w / 2, py - 67, 16, "center", "#222");
      }
    }
  }
  if (isEv("blackout")) {
    const dc = dark.getContext("2d");
    dc.globalCompositeOperation = "source-over"; dc.fillStyle = "rgba(0,0,0,.9)"; dc.fillRect(0, 0, W * T, H * T);
    dc.globalCompositeOperation = "destination-out";
    for (const p of players) {
      const g = dc.createRadialGradient(p.x * T, p.y * T, 20, p.x * T, p.y * T, 130);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      dc.fillStyle = g; dc.fillRect(p.x * T - 130, p.y * T - 130, 260, 260);
    }
    ctx.drawImage(dark, 0, 0);
  }
  for (const q of popups) txt(q.txt, q.x * T, q.y * T, 26, "center", q.col);
}

function draw() {
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "#1d1a17"; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!stage) { txt("🍳 てんやわんやキッチン", 480, 300, 54); return; }
  ctx.save(); ctx.translate(view.ox, view.oy); ctx.scale(view.sc, view.sc);
  ctx.beginPath(); ctx.rect(0, 0, W * T, H * T); ctx.clip();
  drawWorld();
  ctx.restore();
  ctx.fillStyle = "#e8d9b5"; ctx.fillRect(0, MAPH, cv.width, cv.height - MAPH);
  // HUD
  txt(`スコア ${score}`, 100, 668, 30, "center", "#222");
  txt(`のこり ${Math.max(0, Math.ceil(timeLeft))}秒`, 100, 700, 22, "center", timeLeft < 20 ? "#d33" : "#444");
  txt("★".repeat(goals.filter(g => score >= g).length) + "☆".repeat(3 - goals.filter(g => score >= g).length), 250, 668, 28, "center", "#c80");
  txt(`${goals[0]}/${goals[1]}/${goals[2]}`, 250, 700, 18, "center", "#555");
  const on = orders.length, cw = Math.min(138, Math.floor(540 / Math.max(1, on)) - 6);
  orders.forEach((o, i) => {
    const x = 388 + i * (cw + 6);
    ctx.fillStyle = o.t < 12 ? "#a33" : "#2a2a2a"; ctx.fillRect(x, 644, cw, 72);
    txt(`${o.table ? o.table + "番 " : ""}${o.r.name}`, x + cw / 2, 660, cw < 120 ? 12 : 15);
    txt(ticketIcons(o.r), x + cw / 2, 686, o.r.need.length > 2 ? 14 : 18);
    ctx.fillStyle = "#7CFC7C"; ctx.fillRect(x, 708, cw * Math.max(0, o.t / o.max), 8);
  });
  if (ev) {
    const d = EVENTS[ev.type], label = `${d.icon} ${d.name} ${Math.ceil(ev.t)}秒`;
    ctx.fillStyle = "#000a"; ctx.fillRect(330, 4, 300, 34); txt(label, 480, 21, 22, "center", "#ffd66b");
  }
  if (banner.t > 0) { ctx.fillStyle = "#000c"; ctx.fillRect(120, 270, 720, 80); txt(banner.txt, 480, 310, 34, "center", "#ffd66b"); }
  if (state === "play" && introT > 0) {
    ctx.fillStyle = "rgba(0,0,0,.72)"; ctx.fillRect(0, 0, cv.width, MAPH);
    txt(`${stage.emoji} ${stage.world}-${stage.k}  ${stage.name}`, 480, 210, 44);
    txt(`${stage.worldName}　${stage.label}　制限時間 ${stage.time}秒　${stage.mode === "kitchen" ? "厨房モード" : "接客モード"}`, 480, 262, 22, "center", "#ffd66b");
    if (stage.tip) wrapText(stage.tip, 480, 330, 760, 24, 32);
    txt(`メニュー: ${stage.menu.join(" / ")}`, 480, 440, 20, "center", "#ddd");
    txt(stage.gimmicks.join("  "), 480, 480, 20, "center", "#9cf");
  }
  if (paused) { ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(0, 0, cv.width, MAPH); txt("ポーズ中", 480, 300, 54); }
}
function wrapText(s, x, y, maxW, size, lh) {
  ctx.font = `bold ${size}px system-ui,sans-serif`; let line = "", yy = y;
  for (const ch of s) {
    if (ctx.measureText(line + ch).width > maxW) { txt(line, x, yy, size); line = ch; yy += lh; } else line += ch;
  }
  txt(line, x, yy, size);
}

// ---- 画面(ホーム・ステージ選択・結果・ポーズ) ----
const SCREENS = ["home", "select", "result", "pause"];
function showScreen(name) {
  SCREENS.forEach(s => { $("scr-" + s).style.display = s === name ? "flex" : "none"; });
  $("ui").style.display = name ? "flex" : "none";
  if (name === "home" || name === "select") { state = name; $("touch").style.display = "none"; $("aiUi").style.display = "none"; $("pauseBtn").style.display = "none"; }
}
function setPause(v) { paused = v; showScreen(v ? "pause" : null); if (v) $("ui").style.display = "flex"; keys.clear(); }

let selWorld = 1, selStage = 1;
const modeLabels = { 1: "ひとり", 2: "ふたり", 3: "AI1人", 4: "AI2人", 5: "AI3人" };
function renderHome() {
  $("homeStars").textContent = `⭐ ${totalStars()} / 300`;
  const next = STAGES.find(s => unlocked(s.id) && !(prog.stars[s.id] > 0)) || STAGES[STAGES.length - 1];
  $("homeContinue").textContent = `つづきから(${next.world}-${next.k} ${next.name})`;
  $("homeContinue").onclick = () => { selWorld = next.world; selStage = next.id; renderSelect(); showScreen("select"); };
}
function renderSelect() {
  const tabs = $("worldTabs"); tabs.innerHTML = "";
  WORLDS.forEach((w, i) => {
    const wid = i + 1, b = document.createElement("button"), first = STAGES[i * 10].id;
    const stars = STAGES.slice(i * 10, i * 10 + 10).reduce((a, s) => a + (prog.stars[s.id] || 0), 0);
    b.className = (wid === selWorld ? "sel " : "") + (unlocked(first) ? "" : "lock");
    b.innerHTML = `<span>${w.emoji}</span><small>${wid}</small><small>⭐${stars}</small>`;
    b.onclick = () => { selWorld = wid; selStage = STAGES[i * 10].id; renderSelect(); };
    tabs.appendChild(b);
  });
  $("worldName").textContent = `ワールド${selWorld}: ${WORLDS[selWorld - 1].name}`;
  const grid = $("stageGrid"); grid.innerHTML = "";
  STAGES.slice((selWorld - 1) * 10, selWorld * 10).forEach(s => {
    const b = document.createElement("button"), st = prog.stars[s.id] || 0, ok = unlocked(s.id);
    b.className = (s.id === selStage ? "sel " : "") + (ok ? "" : "lock");
    b.innerHTML = `<b>${s.k}</b><small>${ok ? "★".repeat(st) + "☆".repeat(3 - st) : "🔒"}</small>`;
    b.onclick = () => { selStage = s.id; renderSelect(); };
    grid.appendChild(b);
  });
  const s = STAGES[selStage - 1], ok = unlocked(s.id);
  const dishes = s.menu.map(n => RECIPE_BY_NAME[n].need.map(k => ING[k.split(":")[0]].emoji).join("") + n).join("　");
  $("stageInfo").innerHTML = `<h3>${s.emoji} ${s.world}-${s.k} ${s.name} <em>${s.label}</em></h3>
    <p>⏱ ${s.time}秒　${s.gimmicks.join("　")}${s.minPlayers > 1 ? "　👥2人以上" : ""}</p>
    <p>🍽 ${dishes}</p>${s.tip ? `<p class="tip">💡 ${s.tip}</p>` : ""}
    <p>ベスト: ${prog.best[s.id] ?? "-"}</p>`;
  const modes = $("modePick"); modes.innerHTML = "";
  [1, 2, 3, 4, 5].forEach(m => {
    const b = document.createElement("button"); b.textContent = modeLabels[m];
    if (m === 2) b.className = "kbonly";
    if (m === prog.mode) b.classList.add("sel");
    b.onclick = () => { prog.mode = m; saveProg(); renderSelect(); }; modes.appendChild(b);
  });
  const ua = $("unlockAll"); ua.textContent = prog.unlockAll ? "🔓 全ステージ解放中(テスト用)" : "🔒 全ステージを解放する(テスト用)";
  ua.onclick = () => { prog.unlockAll = !prog.unlockAll; saveProg(); renderSelect(); };
  const go = $("stageGo"); go.disabled = !ok; go.textContent = ok ? "スタート" : "🔒 前のステージを★1以上でクリア";
  go.onclick = () => startStage(s.id, prog.mode);
}
function showResult() {
  const r = lastResult, s = STAGES[r.id - 1];
  $("resTitle").textContent = `${s.world}-${s.k} ${s.name}`;
  $("resStars").textContent = "★".repeat(r.stars) + "☆".repeat(3 - r.stars);
  $("resScore").textContent = `スコア ${r.score}${r.newBest ? "  🎉ベスト更新" : ""}`;
  $("resGoals").textContent = `★1: ${goals[0]}　★2: ${goals[1]}　★3: ${goals[2]}`;
  const nextOk = r.id < STAGES.length && unlocked(r.id + 1);
  $("resNext").style.display = nextOk ? "" : "none";
  $("resNext").onclick = () => startStage(r.id + 1, prog.mode);
  $("resRetry").onclick = () => startStage(r.id, prog.mode);
  $("resSelect").onclick = () => { selWorld = s.world; selStage = r.id; renderSelect(); showScreen("select"); };
  $("resMsg").textContent = r.stars === 0 ? "あと少し! もう一度挑戦しよう" : (r.firstClear && r.id < STAGES.length ? `ステージ${r.id + 1}が解放されたよ!` : "");
  showScreen("result");
}
$("homeStart").onclick = () => { renderSelect(); showScreen("select"); };
$("selBack").onclick = () => { renderHome(); showScreen("home"); };
$("pauseBtn").onclick = () => setPause(true);
$("pauseResume").onclick = () => setPause(false);
$("pauseQuit").onclick = () => { paused = false; state = "select"; renderSelect(); showScreen("select"); };

// ---- スマホ操作 ----
let joy = { x: 0, y: 0 }, touchChop = false;
const pad = $("pad"), knob = $("knob");
function padMove(e) {
  const r = pad.getBoundingClientRect(), m = r.width / 2 * 0.8;
  let vx = e.clientX - (r.left + r.width / 2), vy = e.clientY - (r.top + r.height / 2);
  const l = Math.hypot(vx, vy); if (l > m) { vx *= m / l; vy *= m / l; }
  knob.style.transform = `translate(${vx}px,${vy}px)`; joy.x = vx / m; joy.y = vy / m;
}
const padEnd = () => { joy.x = joy.y = 0; knob.style.transform = ""; };
pad.addEventListener("pointerdown", e => { pad.setPointerCapture(e.pointerId); padMove(e); });
pad.addEventListener("pointermove", e => { if (pad.hasPointerCapture(e.pointerId)) padMove(e); });
["pointerup", "pointercancel"].forEach(t => pad.addEventListener(t, padEnd));
$("actBtn").addEventListener("pointerdown", e => { e.preventDefault(); if (state === "play" && !paused && players[0]) interact(players[0]); });
const chopBtn = $("chopBtn");
chopBtn.addEventListener("pointerdown", e => { e.preventDefault(); chopBtn.setPointerCapture(e.pointerId); touchChop = true; });
["pointerup", "pointercancel"].forEach(t => chopBtn.addEventListener(t, () => { touchChop = false; }));
let shownState = "";
function syncUi() {
  const key = state + paused;
  if (shownState === key) return; shownState = key;
  $("touch").style.display = state === "play" && matchMedia("(pointer:coarse)").matches ? "flex" : "none";
  if (state !== "play") { joy.x = joy.y = 0; touchChop = false; }
}
