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
const popup = (txt, x, y, col = "#fff") => popups.push({ txt, x, y, y0: y, life: 1.2, col });

// ---- 状態 ----
let W = 0, H = 0, tiles = [], stage = null, view = { sc: 1, ox: 0, oy: 0 };
let state = "home", paused = false;               // home / select / play / result
let players = [], orders = [], score = 0, timeLeft = 0, spawnIn = 0, popups = [], introT = 0, goals = [30, 40, 50];
let plates = 0, platePending = [], spawnEvery = 20, selBot = 0, lastResult = null, served = 0;
let ev = null, evNext = 25, banner = { txt: "", t: 0 }, lastSec = -1;
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
  tiles.forEach(row => row.forEach(c => { c.inner = c.t === "#" && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tiles[c.y + dy] && tiles[c.y + dy][c.x + dx] && WALK.has(tiles[c.y + dy][c.x + dx].t)); }));
  fx.length = 0; shake = 0; lastSec = -1;
  if (typeof build3D === "function" && G3.ok) build3D();
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
  Snd.play("click"); Snd.music({ world: stage.world });
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
      orders.push(o); tb.state = "wait"; tb.ticket = o; popup(`${tb.id}番 ${r.name}`, p.x, p.y, "#ffd66b"); Snd.play("order");
    } else if (tb.state === "pay") { score += tb.pts; popup("+" + tb.pts, p.x, p.y, "#7CFC7C"); tb.state = "dirty"; Snd.play("coin"); fxCoin(c.x + 0.5, c.y + 0.3); }
    else if (tb.state === "dirty") { p.item = { kind: "dirty" }; tb.state = "empty"; }
    return;
  }
  if (h.kind === "plate" && tb.state === "wait" && h.contents.length) {
    if (needKey(tb.ticket.r) === plateKey(h)) {
      const o = tb.ticket; tb.pts = ticketPts(o); served++;
      orders.splice(orders.indexOf(o), 1); tb.ticket = null; tb.state = "eat"; tb.t = eatTime; tb.max = eatTime; p.item = null;
      popup("いただきます!", p.x, p.y); Snd.play("deliver"); fxBurst(c.x + 0.5, c.y + 0.4, 8);
    } else { popup("注文と違う!", p.x, p.y, "#ff7777"); Snd.play("wrong"); }
  }
}
const ticketPts = o => (20 + 8 * (o.r.need.length - 1) + Math.floor(o.t / 5)) * (isEv("rush") ? 2 : 1);

function interact(p) {
  const before = p.item; interactCore(p);
  if (p.item !== before) Snd.play(p.item ? "pick" : "put");
}
function interactCore(p) {
  const c = target(p); if (!c) return;
  const h = p.item, t = c.t;
  if (t === "B") return tableAct(p, c, h);
  if (t === "Z") { if (h && h.kind === "dirty" && c.dirty < 6) { c.dirty++; p.item = null; popup("シンクへ", p.x, p.y); } return; }
  if (t === "P") {
    if (!h) { if (plates > 0) { plates--; p.item = { kind: "plate", contents: [] }; } else { popup("お皿がない!", p.x, p.y, "#ff7777"); Snd.play("wrong"); } }
    else if (h.kind === "plate" && !h.contents.length) { plates++; p.item = null; }
    return;
  }
  if (t === "D") {                                           // 提供窓口(厨房モード)
    if (!h || h.kind !== "plate" || !h.contents.length) return;
    const o = orders.filter(o => needKey(o.r) === plateKey(h)).sort((a, b) => a.t - b.t)[0];
    if (o) { const pts = ticketPts(o); served++; score += pts; orders.splice(orders.indexOf(o), 1); popup("+" + pts, p.x, p.y, "#7CFC7C"); Snd.play("deliver"); Snd.play("coin"); fxBurst(c.x + 0.5, c.y + 0.5, 10); }
    else { score -= 5; popup("-5 注文と違う!", p.x, p.y, "#ff7777"); Snd.play("wrong"); }
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
    if (c.stove === "burnt") { c.stove = "idle"; c.sitem = null; c.prog = 0; popup("片付けた", p.x, p.y); Snd.play("put"); return; }   // 手がふさがっていても片付けられる
    if (!h) {
      if (c.stove === "done") { p.item = { kind: "ing", type: c.sitem.type, state: c.res }; c.stove = "idle"; c.sitem = null; c.prog = 0; }
      return;
    }
    if (h.kind === "ing") {
      const k = cookSpec(h.type, t);
      if (c.stove === "idle" && k && h.state === k.from) {
        c.stove = "cooking"; c.sitem = h; c.need = k.t; c.res = COOKERS[t].res; c.prog = 0; c.owner = p.ai ? p.name : null; p.item = null; Snd.play("sizzle");
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
  if (introT > 0) { introT -= dt; if (introT <= 0) Snd.play("go"); return; }
  timeLeft -= dt;
  const sec = Math.ceil(timeLeft); if (sec !== lastSec) { if (sec <= 10 && sec > 0) Snd.play("tick"); lastSec = sec; }
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
    const ox = p.x, oy = p.y;
    const on = tiles[Math.floor(p.y)] && tiles[Math.floor(p.y)][Math.floor(p.x)];
    if (on && ARROW[on.t] && !p.ai) moveBy(p, ARROW[on.t][0] * 1.6 * dt, ARROW[on.t][1] * 1.6 * dt);      // ベルトコンベア(AIは流されない)
    if (p.ai) { botUpdate(p, dt); work(p, target(p), p.chopping, dt); trackMove(p, ox, oy, dt); continue; }
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
    trackMove(p, ox, oy, dt);
  }
  for (const row of tiles) for (const c of row) {
    if (isCooker(c.t) && (c.stove === "cooking" || c.stove === "done")) {
      c.prog += dt;
      if (c.stove === "cooking" && Math.random() < dt * 5) fxSteam(c);
      if (c.stove === "cooking" && c.prog >= c.need) { c.stove = "done"; Snd.play("done"); fxBurst(c.x + 0.5, c.y + 0.4, 6, [PAL.sun, PAL.mint, "#fff"], 1.8); }
      if (c.prog >= c.need + 14 / stage.burn) { c.stove = "burnt"; c.sitem = null; Snd.play("burn"); for (let i = 0; i < 6; i++) fxSmoke(c); }
    }
    if (isCooker(c.t) && c.stove === "burnt" && Math.random() < dt * 3) fxSmoke(c);
    if (c.stock !== null && CRATE[c.t] && c.stock < stage.stock) { c.regen += dt; if (c.regen >= stockRegen) { c.regen = 0; c.stock++; } }
  }
  updateFx(dt);
  popups.forEach(q => { q.life -= dt; q.y -= dt * 0.6; });
  popups = popups.filter(q => q.life > 0);
}

// 長押し作業: まな板で切る / シンクで洗う
function work(p, c, on, dt) {
  if (!c || !on) return;
  if (c.t === "C" && c.item && c.item.kind === "ing" && c.item.state === "raw" && ING[c.item.type].chop) {
    c.prog += dt; c.fxT = (c.fxT || 0) + dt;
    if (c.fxT > 0.22) { c.fxT = 0; Snd.play("chop"); fxChop(c); }
    if (c.prog >= chopTime) { c.item.state = "chopped"; c.prog = 0; Snd.play("chopDone"); fxBurst(c.x + 0.5, c.y + 0.4, 5, ["#7ed957", PAL.sun, "#fff"], 1.6); }
  } else if (c.t === "Z" && c.dirty > 0) {
    c.prog += dt; c.fxT = (c.fxT || 0) + dt;
    if (c.fxT > 0.25) { c.fxT = 0; Snd.play("wash"); fxBubble(c); fxBubble(c); }
    if (c.prog >= washTime) { c.prog = 0; c.dirty--; plates++; popup("+お皿", p.x, p.y, "#9cf"); Snd.play("chopDone"); }
  }
}

function startEvent() {
  const type = stage.events[Math.floor(Math.random() * stage.events.length)], d = EVENTS[type];
  banner = { txt: `${d.icon} ${d.msg}`, t: 3.5 }; Snd.play(type === "fire" ? "fire" : "event"); if (type === "fire" || type === "blackout") shake = 1;
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

function trackMove(p, ox, oy, dt) {
  p.spd = Math.hypot(p.x - ox, p.y - oy) / Math.max(dt, 1e-3); p.walk = (p.walk || 0) + p.spd * dt * 2.6;
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
  Snd.stop(); Snd.play(stars >= 1 ? (stars === 3 ? "win" : "star") : "lose");
  showResult();
}

// ---- 画面(ホーム・ステージ選択・結果・ポーズ) ----
const SCREENS = ["home", "select", "result", "pause"];
function showScreen(name) {
  SCREENS.forEach(s => { $("scr-" + s).style.display = s === name ? "flex" : "none"; });
  $("ui").style.display = name ? "flex" : "none";
  if (name === "home" || name === "select") { Snd.music({ menu: true, world: selWorld }); state = name; $("touch").style.display = "none"; $("aiUi").style.display = "none"; $("pauseBtn").style.display = "none"; }
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
  const wc = WORLD_COL[selWorld - 1], ui = $("scr-select"); ui.style.setProperty("--wc", wc);
  const tabs = $("worldTabs"); tabs.innerHTML = "";
  WORLDS.forEach((w, i) => {
    const wid = i + 1, b = document.createElement("button"), first = STAGES[i * 10].id;
    const stars = STAGES.slice(i * 10, i * 10 + 10).reduce((a, s) => a + (prog.stars[s.id] || 0), 0);
    b.style.setProperty("--wc", WORLD_COL[i]);
    b.className = (wid === selWorld ? "sel " : "") + (unlocked(first) ? "" : "lock");
    b.innerHTML = `<span>${w.emoji}</span><small>${wid}</small><small>★${stars}</small>`;
    b.onclick = () => { selWorld = wid; selStage = STAGES[i * 10].id; Snd.play("click"); renderSelect(); Snd.music({ menu: true, world: wid }); };
    tabs.appendChild(b);
  });
  $("worldName").textContent = `${WORLDS[selWorld - 1].emoji} ${selWorld}. ${WORLDS[selWorld - 1].name}`;
  const grid = $("stageGrid"); grid.innerHTML = "";
  STAGES.slice((selWorld - 1) * 10, selWorld * 10).forEach(s => {
    const b = document.createElement("button"), st = prog.stars[s.id] || 0, ok = unlocked(s.id);
    b.className = (s.id === selStage ? "sel " : "") + (ok ? "" : "lock");
    b.innerHTML = `${s.k === 10 ? '<span class="crown">👑</span>' : ""}<b>${s.k}</b><span class="st">${ok ? "★".repeat(st) + "☆".repeat(3 - st) : "🔒"}</span>`;
    b.onclick = () => { selStage = s.id; Snd.play("click"); renderSelect(); };
    grid.appendChild(b);
  });
  const s = STAGES[selStage - 1], ok = unlocked(s.id);
  const dishes = s.menu.map(n => `<span class="dish">${RECIPE_BY_NAME[n].need.map(k => ING[k.split(":")[0]].emoji).join("")} ${n}</span>`).join("");
  $("stageInfo").innerHTML = `<h3>${s.emoji} ${s.world}-${s.k} ${s.name}</h3>
    <div><span class="tag">⏱ ${s.time}秒</span>${s.label ? `<span class="tag">${s.label}</span>` : ""}${s.gimmicks.map(g => `<span class="tag">${g}</span>`).join("")}${s.minPlayers > 1 ? '<span class="tag">👥 2人以上</span>' : ""}</div>
    <div style="margin-top:4px">${dishes}</div>${s.tip ? `<div class="tip">💡 ${s.tip}</div>` : ""}
    <div class="goal">ベスト: ${prog.best[s.id] ?? "-"}</div>`;
  const modes = $("modePick"); modes.innerHTML = "";
  [[1, "👨‍🍳 ひとり"], [2, "👥 ふたり"], [3, "🤖 AI1人"], [4, "🤖🤖 AI2人"], [5, "🤖🤖🤖 AI3人"]].forEach(([m, label]) => {
    const b = document.createElement("button"); b.textContent = label;
    if (m === 2) b.classList.add("kbonly");
    if (m === prog.mode) b.classList.add("sel");
    b.onclick = () => { prog.mode = m; saveProg(); Snd.play("click"); renderSelect(); }; modes.appendChild(b);
  });
  const ua = $("unlockAll"); ua.textContent = prog.unlockAll ? "🔓 全ステージ解放中(テスト用)" : "🔒 全ステージを解放する(テスト用)";
  ua.onclick = () => { prog.unlockAll = !prog.unlockAll; saveProg(); renderSelect(); };
  const go = $("stageGo"); go.disabled = !ok; go.textContent = ok ? "スタート!" : "🔒 前のステージを★1でクリア";
  go.onclick = () => startStage(s.id, prog.mode);
}
function confetti() {
  for (let i = 0; i < 46; i++) {
    const d = document.createElement("div"); d.className = "confetti";
    d.style.left = Math.random() * 100 + "vw"; d.style.background = [PAL.tomato, PAL.sun, PAL.mint, PAL.sky, PAL.pink, PAL.grape][i % 6];
    d.style.animationDuration = 1.8 + Math.random() * 1.6 + "s"; d.style.animationDelay = Math.random() * 0.6 + "s";
    document.body.appendChild(d); setTimeout(() => d.remove(), 4500);
  }
}
function showResult() {
  const r = lastResult, s = STAGES[r.id - 1];
  $("scr-result").style.setProperty("--wc", WORLD_COL[s.world - 1]);
  $("resTitle").textContent = `${s.emoji} ${s.world}-${s.k} ${s.name}`;
  $("resStars").innerHTML = [0, 1, 2].map(i => `<span class="${i < r.stars ? "on" : ""}" style="--d:${0.25 + i * 0.35}s">★</span>`).join("");
  $("resScore").textContent = `${r.score}点${r.newBest ? " 🎉ベスト更新!" : ""}`;
  $("resGoals").textContent = `★1: ${goals[0]}　★2: ${goals[1]}　★3: ${goals[2]}`;
  const nextOk = r.id < STAGES.length && unlocked(r.id + 1);
  $("resNext").style.display = nextOk ? "" : "none";
  $("resNext").onclick = () => startStage(r.id + 1, prog.mode);
  $("resRetry").onclick = () => startStage(r.id, prog.mode);
  $("resSelect").onclick = () => { selWorld = s.world; selStage = r.id; renderSelect(); showScreen("select"); };
  $("resMsg").textContent = r.stars === 0 ? "あと少し! もう一度挑戦しよう" : (r.firstClear && r.id < STAGES.length ? `ステージ${r.id + 1}が解放されたよ!` : "");
  showScreen("result");
  if (r.stars === 3) confetti();
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

// ---- 音のオン/オフ ----
function syncSndBtns() { $("sndBgm").classList.toggle("off", !Snd.bgm); $("sndSfx").classList.toggle("off", !Snd.sfx); }
$("sndBgm").onclick = () => { Snd.setBgm(!Snd.bgm); syncSndBtns(); };
$("sndSfx").onclick = () => { Snd.setSfx(!Snd.sfx); syncSndBtns(); Snd.play("click"); };
syncSndBtns();
document.querySelectorAll("#scr-home .big, #scr-result .big, #scr-pause .big, #selBack").forEach(b => b.addEventListener("click", () => Snd.play("click")));
