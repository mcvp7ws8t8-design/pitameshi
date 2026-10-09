"use strict";
// てんやわんやキッチン: ゲーム本体(ステージのデータで動く)
const T = 80, MAPW = 960, MAPH = 640;
const { ING, CRATE, RECIPES, RECIPE_BY_NAME, EVENTS, COOKERS, STATE_TAG } = CKData;
const { STAGES, WORLDS, WALK, ENDLESS, VS_STAGES } = CKStages;
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
// 対戦(チーム戦)とエンドレス。対戦はチームごとに 注文・お皿・得点 を持ち、操作するチームの分を一時的に orders/plates/score に差し替えて動かす
let vs = null, endless = null, curTeam = 0;
const TEAM_COL = ["#e8504a", "#4a8be8"], TEAM_NAME = ["赤チーム", "青チーム"];
let teamActive = false;
function asTeam(t, fn) {
  if (!vs || t === undefined) return fn();
  if (teamActive && curTeam === t) return fn();             // すでにそのチームとして動いている(入れ子)ときは、そのまま
  const sv = [orders, plates, platePending, score, curTeam, teamActive];
  orders = vs.orders[t]; plates = vs.plates[t]; platePending = vs.pending[t]; score = vs.score[t]; curTeam = t; teamActive = true;
  try { return fn(); } finally { vs.plates[t] = plates; vs.score[t] = score; [orders, plates, platePending, score, curTeam, teamActive] = sv; }
}
const forTeams = fn => { if (!vs) fn(); else { asTeam(0, fn); asTeam(1, fn); } };
const platesOf = c => (vs && c.team !== undefined ? vs.plates[c.team] : plates);
const dark = document.createElement("canvas");

// ---- 進み具合の保存 ----
let prog = { stars: {}, best: {}, setup: { humans: 1, ai: 1 }, vsSetup: { humans: 1, teamSize: 1 }, endless: {}, vsRecord: { w: 0, l: 0, d: 0 } };
try { Object.assign(prog, JSON.parse(localStorage.getItem("ck-prog") || "{}")); } catch {}
if (prog.mode && !(prog.setup && prog.setup.humans)) prog.setup = legacySetup(prog.mode);     // 古い保存データを引き継ぐ
function legacySetup(m) { return m === 2 ? { humans: 2, ai: 0 } : m >= 3 ? { humans: 1, ai: m - 2 } : { humans: 1, ai: 0 }; }
const saveProg = () => { try { localStorage.setItem("ck-prog", JSON.stringify(prog)); } catch {} };
const UNLOCK_ALL = /[?&]unlock=all/.test(location.search) || location.hash === "#unlock";
const unlocked = id => UNLOCK_ALL || prog.unlockAll || id === 1 || (prog.stars[id - 1] || 0) >= 1;
const totalStars = () => Object.values(prog.stars).reduce((a, b) => a + b, 0);

// ---- 入力 ----
const KB1 = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", act: "KeyE", chop: "KeyQ" };
const KB2 = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight", act: "Period", chop: "Comma" };
const HCOL = ["#e8504a", "#4a8be8", "#f2b632", "#27b7b0"];
let PADS = []; const padPrev = {};
const connectedPads = () => [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(g => g && g.connected).map(g => g.index);
function pollPads() {                                  // 毎フレームのコントローラーの状態(押した瞬間 edge も)
  const out = [];
  for (const g of (navigator.getGamepads ? navigator.getGamepads() : [])) {
    if (!g || !g.connected) continue;
    const b = g.buttons.map(x => x.pressed), prev = padPrev[g.index] || [], edge = b.map((v, i) => v && !prev[i]); padPrev[g.index] = b;
    let ax = g.axes[0] || 0, ay = g.axes[1] || 0; if (Math.hypot(ax, ay) < 0.3) ax = ay = 0;
    if (b[14]) ax = -1; if (b[15]) ax = 1; if (b[12]) ay = -1; if (b[13]) ay = 1;
    out.push({ index: g.index, ax, ay, b, edge });
  }
  return out;
}
// 人間のプレイヤーごとに操作方法を割り当てる: コントローラーが先、足りなければキーボード(WASD → 矢印)
function assignInputs(h) {
  const pads = connectedPads(), kb = [KB1, KB2], out = [];
  for (let i = 0; i < h; i++) out.push(pads[i] !== undefined ? { pad: pads[i] } : { keys: kb.shift() });
  if (out[0] && out[0].pad !== undefined && kb[0] === KB1) out[0].keys = KB1;     // 1Pはコントローラーとキーボードどちらでも
  return out;
}
const maxHumans = () => Math.min(4, connectedPads().length + 2);
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
function startStage(id, setup) {
  stage = typeof id === "object" ? id : STAGES[id - 1];
  if (stage.endless) stage.events = [];
  let tid = 0;
  tiles = stage.map.map((row, y) => [...row].map((t, x) => ({
    t, x, y, item: null, prog: 0, stove: "idle", sitem: null, need: 0, res: "", owner: null, dirty: 0,
    tb: t === "B" ? { id: ++tid, state: "empty", t: 0, max: 1, ticket: null, pts: 0, who: "" } : null,
    stock: CRATE[t] && stage.stock ? stage.stock : null, regen: 0, team: stage.versus ? (x < row.length / 2 ? 0 : 1) : undefined,
  })));
  H = tiles.length; W = tiles[0].length;
  tiles.forEach(row => row.forEach(c => { c.inner = c.t === "#" && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tiles[c.y + dy] && tiles[c.y + dy][c.x + dx] && WALK.has(tiles[c.y + dy][c.x + dx].t)); }));
  fx.length = 0; shake = 0; lastSec = -1;
  if (typeof build3D === "function" && G3.ok) build3D();
  const sc = Math.min(1.25, MAPW / (W * T), MAPH / (H * T));
  view = { sc, ox: (MAPW - W * T * sc) / 2, oy: (MAPH - H * T * sc) / 2 };
  dark.width = W * T; dark.height = H * T;
  plates = stage.plates; platePending = [];
  if (typeof setup === "number") setup = legacySetup(setup);
  let humans, nAi;
  vs = null; endless = null;
  if (stage.versus) {                                       // 対戦: 赤と青のチーム(人間は交互に振り分け、足りない分はAI)
    const size = setup.teamSize === 2 ? 2 : 1, total = size * 2;
    humans = Math.max(1, Math.min(maxHumans(), total, setup.humans || 1));
    players = assignInputs(humans).map((inp, i) => ({ x: 0, y: 0, dir: [0, 1], item: null, col: TEAM_COL[i % 2], team: i % 2, keys: inp.keys, pad: inp.pad }));
    const cnt = [0, 0]; players.forEach(p => cnt[p.team]++);
    let bi = 0; for (const t of [0, 1]) while (cnt[t] < size) { const b = newBot(bi++); b.team = t; b.col = TEAM_COL[t]; b.auto = true; b.role = "kitchen"; cnt[t]++; players.push(b); }
    nAi = players.length - humans;
    const used = [0, 0]; players.forEach(p => { [p.x, p.y] = stage.spawns[p.team * 2 + used[p.team]++]; });
    vs = { score: [0, 0], orders: [[], []], plates: [stage.plates, stage.plates], pending: [[], []] };
    prog.vsSetup = { humans, teamSize: size };
    spawnEvery = stage.spawn;
  } else {
    humans = Math.max(1, Math.min(maxHumans(), setup.humans || 1)); nAi = Math.max(0, Math.min(3, setup.ai || 0));
    nAi = Math.min(nAi, 4 - humans); while (humans + nAi < stage.minPlayers && humans + nAi < 4) nAi++;
    players = assignInputs(humans).map((inp, i) => ({ x: 0, y: 0, dir: [0, 1], item: null, col: HCOL[i], keys: inp.keys, pad: inp.pad }));
    for (let i = 0; i < nAi; i++) players.push(newBot(i));
    players.forEach((p, i) => { [p.x, p.y] = stage.spawns[i]; });
    spawnEvery = Math.max(7, Math.round(stage.spawn * 4.5 / (nAi + 1.5 * humans)));   // 人手が多いほど、お客は早く来る
    prog.setup = { humans, ai: nAi };
    if (stage.endless) endless = { lives: 5, t: 0, lvl: -1, n: 0, k: 4.5 / (nAi + 1.5 * humans) };
  }
  const avgNeed = stage.menu.reduce((a, n) => a + RECIPE_BY_NAME[n].need.length, 0) / stage.menu.length;
  const base = (1 + stage.time / spawnEvery) * (22 + 7 * (avgNeed - 1));
  goals = [0.35, 0.65, 0.95].map(f => Math.max(30, Math.round(base * f / 10) * 10));
  goals[1] = Math.max(goals[1], goals[0] + 10); goals[2] = Math.max(goals[2], goals[1] + 10);
  served = 0; orders = []; score = 0; popups = []; timeLeft = endless ? 1e9 : stage.time; spawnIn = 0; ev = null; banner.t = 0;
  evNext = stage.events.length ? stage.evGap * 0.8 : 1e9;
  introT = stage.tip ? 5 : 3; paused = false; state = "play";
  saveProg();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
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
  asTeam(p.team, () => { const before = p.item; interactCore(p); if (p.item !== before) Snd.play(p.item ? "pick" : "put"); });
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
const ordCap = () => vs ? 4 : Math.min(6, 3 + players.filter(p => p.ai).length) + (isEv("rush") ? 2 : 0);
const endlessMenu = () => stage.menu.slice(0, Math.min(stage.menu.length, 2 + Math.floor(endless.t / 45)));
function spawnTicket() {                                      // 注文を出す(対戦は、同じ注文を両チームに同時に出す)
  const pat = endless ? Math.max(40, Math.round(stage.patience - endless.t / 6)) : stage.patience;
  const menu = endless ? endlessMenu() : stage.menu, r = RECIPE_BY_NAME[menu[Math.floor(Math.random() * menu.length)]];
  if (vs) { for (const t of [0, 1]) if (vs.orders[t].length < ordCap()) vs.orders[t].push({ r, t: pat, max: pat }); }
  else if (orders.length < ordCap()) orders.push({ r, t: pat, max: pat });
}
function tickPlates(dt) { for (let i = platePending.length - 1; i >= 0; i--) { platePending[i] -= dt; if (platePending[i] <= 0) { platePending.splice(i, 1); plates++; } } }
function tickOrders(dt) {
  for (const o of orders) o.t -= dt;
  for (let i = orders.length - 1; i >= 0; i--) if (orders[i].t <= 0) {
    const o = orders.splice(i, 1)[0]; score -= 10;
    if (o.tile) { popup("-10 待たせすぎ", o.tile.x + 0.5, o.tile.y + 0.5, "#ff7777"); o.tile.tb.state = "empty"; o.tile.tb.ticket = null; }
    else popup(endless ? "💔 注文を逃した!" : "-10 時間切れ", vs ? W * (curTeam ? 0.75 : 0.25) : W / 2, 0.6, "#ff7777");
    if (endless) { endless.lives--; Snd.play("wrong"); shake = 0.6; }
  }
}
// エンドレス: だんだん注文が速く・多く・難しくなる
function endlessStep(dt) {
  endless.t += dt; const t = endless.t;
  spawnEvery = Math.max(6, Math.round(Math.max(7, stage.spawn - t / 8) * endless.k));
  const n = Math.min(stage.menu.length, 2 + Math.floor(t / 45));
  if (n > endless.n) { if (endless.n) banner = { txt: `🆕 新メニュー: ${stage.menu[n - 1]}`, t: 3.5 }; endless.n = n; }
  const lvl = t < 90 ? 0 : t < 200 ? 1 : 2;
  if (lvl !== endless.lvl) {
    endless.lvl = lvl; stage.events = [[], ["mouse", "fire"], ["mouse", "fire", "rush", "blackout", "slippery"]][lvl];
    if (lvl && evNext > 1e8) evNext = 10;
    if (lvl) banner = { txt: lvl === 1 ? "🔥 ここからが本番!" : "💥 大混乱タイム!", t: 3.5 };
  }
}

function update(dt) {
  PADS = pollPads();
  if (PADS.some(g => g.edge[9])) { setPause(true); return; }                 // Start=ポーズ
  if (introT > 0) { introT -= dt; if (introT <= 0) Snd.play("go"); return; }
  timeLeft -= dt;
  const sec = Math.ceil(timeLeft); if (sec !== lastSec) { if (sec <= 10 && sec > 0) Snd.play("tick"); lastSec = sec; }
  if (timeLeft <= 0) { finishStage(); return; }
  if (banner.t > 0) banner.t -= dt;
  evNext -= dt;
  if (ev) { ev.t -= dt; if (ev.t <= 0) { ev = null; evNext = stage.evGap * (0.7 + Math.random() * 0.6); } }
  else if (evNext <= 0 && timeLeft > 12) startEvent();
  if (endless) endlessStep(dt);
  forTeams(() => tickPlates(dt));
  spawnIn -= dt;
  const tbs = tiles.flat().filter(c => c.t === "B");
  if (spawnIn <= 0) {
    if (stage.mode === "kitchen") spawnTicket();
    else {
      const busy = tbs.filter(c => c.tb.state !== "empty").length, free = tbs.filter(c => c.tb.state === "empty");
      if (free.length && busy < Math.min(tbs.length, ordCap())) {
        const c = free[Math.floor(Math.random() * free.length)];
        Object.assign(c.tb, { state: "order", t: tableOrderWait, max: tableOrderWait, ticket: null, who: CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)] });
      }
    }
    spawnIn = isEv("rush") ? spawnEvery / 2 : spawnEvery;
  }
  forTeams(() => tickOrders(dt));
  if (endless && endless.lives <= 0) { finishStage(); return; }
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
    if (p.ai) { asTeam(p.team, () => { botUpdate(p, dt); work(p, target(p), p.chopping, dt); }); trackMove(p, ox, oy, dt); continue; }
    const K = p.keys, gp = p.pad !== undefined ? PADS.find(g => g.index === p.pad) : null;
    let dx = K ? (keys.has(K.right) ? 1 : 0) - (keys.has(K.left) ? 1 : 0) : 0;
    let dy = K ? (keys.has(K.down) ? 1 : 0) - (keys.has(K.up) ? 1 : 0) : 0;
    if (gp) { if (!dx) dx = gp.ax; if (!dy) dy = gp.ay; if (gp.edge[0] || gp.edge[3]) interact(p); }          // 下ボタン・上ボタン=つかむ/置く
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
    work(p, target(p), (K && keys.has(K.chop)) || (gp && (gp.b[2] || gp.b[1])) || (p === players[0] && touchChop), dt);   // 左・右ボタン長押し=切る/洗う
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
  if (vs) {                                                      // 対戦: 点数の高いチームの勝ち
    const [a, b] = vs.score, winner = a > b ? 0 : b > a ? 1 : -1, mine = players.filter(p => !p.ai).map(p => p.team);
    const humanWon = winner >= 0 && mine.includes(winner) && !mine.includes(1 - winner);
    if (winner < 0) prog.vsRecord.d++; else if (humanWon) prog.vsRecord.w++; else if (!(mine.includes(0) && mine.includes(1))) prog.vsRecord.l++;
    saveProg();
    lastResult = { kind: "vs", id: stage.id, a, b, winner, humanWon };
    Snd.stop(); Snd.play(winner < 0 ? "star" : humanWon || (mine.includes(0) && mine.includes(1)) ? "win" : "lose");
    showResult(); return;
  }
  if (endless) {                                                 // エンドレス: 生き残った時間と点数
    const t = Math.floor(endless.t), prev = prog.endless[stage.id] || { score: -1, time: 0 }, newBest = score > prev.score;
    if (newBest) prog.endless[stage.id] = { score, time: t };
    saveProg();
    lastResult = { kind: "endless", id: stage.id, score, time: t, newBest };
    Snd.stop(); Snd.play(t >= 120 ? "win" : "star");
    showResult(); return;
  }
  const stars = goals.filter(g => score >= g).length;
  const id = stage.id, prev = prog.stars[id] || 0, newBest = score > (prog.best[id] || -1e9);
  if (stars > prev) prog.stars[id] = stars;
  if (newBest) prog.best[id] = score;
  saveProg();
  lastResult = { id, stars, score, newBest, firstClear: prev === 0 && stars > 0 };
  Snd.stop(); Snd.play(stars >= 1 ? (stars === 3 ? "win" : "star") : "lose");
  showResult();
}

// ---- メニューの操作(キーボードの矢印・コントローラーの十字キー/スティック) ----
function navButtons() {
  if ($("ui").style.display === "none") return [];
  const scr = [...document.querySelectorAll("#ui .scr")].find(e => e.style.display !== "none"); if (!scr) return [];
  return [...scr.querySelectorAll("button")].filter(b => !b.disabled && b.offsetParent !== null);
}
function focusDefault() {
  const bs = navButtons(); if (!bs.length) return;
  const b = bs.find(x => x.classList.contains("go")) || bs.find(x => x.classList.contains("sel")) || bs[0]; b.focus({ preventScroll: true });
}
function navMove(dx, dy) {
  document.body.classList.add("padnav");
  const bs = navButtons(); if (!bs.length) return;
  const cur = document.activeElement; if (!bs.includes(cur)) { focusDefault(); return; }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let best = null, bd = 1e9;
  for (const b of bs) {
    if (b === cur) continue; const q = b.getBoundingClientRect(), vx = q.left + q.width / 2 - cx, vy = q.top + q.height / 2 - cy, along = vx * dx + vy * dy;
    if (along <= 4) continue; const score = along + (Math.abs(vx * dy) + Math.abs(vy * dx)) * 2.4; if (score < bd) { bd = score; best = b; }
  }
  if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: "nearest", inline: "nearest" }); Snd.play("click"); }
}
function navBack() {
  if (paused) { setPause(false); return; }
  const scr = [...document.querySelectorAll("#ui .scr")].find(e => e.style.display !== "none"); if (!scr) return;
  if (scr.id === "scr-select") $("selBack").click(); else if (scr.id === "scr-result") $("resSelect").click(); else if (scr.id === "scr-arena") $("arBack").click(); else if (scr.id === "scr-help") $("helpBack").click(); else if (scr.id === "scr-settings") $("setBack").click();
}
let navT = 0, navDir = "";
function padMenu(dt) {                                       // ポーズ中・メニュー中のコントローラー操作
  const pads = pollPads(); PADS = pads;
  if (!pads.length) { navDir = ""; return; }
  if (pads.some(g => g.edge[9]) && paused) { setPause(false); return; }
  if (pads.some(g => g.edge[0])) { document.body.classList.add("padnav"); const f = document.activeElement; if (f && f.tagName === "BUTTON" && navButtons().includes(f)) f.click(); else focusDefault(); return; }
  if (pads.some(g => g.edge[1])) { navBack(); return; }
  const g = pads.find(q => q.ax || q.ay), dir = g ? (Math.abs(g.ax) >= Math.abs(g.ay) ? (g.ax < 0 ? "L" : "R") : (g.ay < 0 ? "U" : "D")) : "";
  navT -= dt;
  if (dir && (dir !== navDir || navT <= 0)) { navMove(dir === "L" ? -1 : dir === "R" ? 1 : 0, dir === "U" ? -1 : dir === "D" ? 1 : 0); navT = dir !== navDir ? 0.35 : 0.14; }
  navDir = dir;
}
addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || (state === "play" && !paused)) return;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.code];
  if (d) { navMove(d[0], d[1]); e.preventDefault(); }
  else if (e.code === "Escape" && state !== "play") navBack();
  else if (e.code === "Enter" && !navButtons().includes(document.activeElement)) { focusDefault(); }
});
["pointerdown", "mousemove"].forEach(ev => addEventListener(ev, () => document.body.classList.remove("padnav")));

// ---- 画面(ホーム・ステージ選択・結果・ポーズ) ----
const SCREENS = ["home", "select", "result", "pause", "help", "settings", "arena"];
function showScreen(name) {
  SCREENS.forEach(s => { $("scr-" + s).style.display = s === name ? "flex" : "none"; });
  $("ui").style.display = name ? "flex" : "none";
  if (name && !matchMedia("(pointer:coarse)").matches) setTimeout(focusDefault, 30);
  if (name === "home" || name === "select" || name === "help" || name === "settings" || name === "arena") { Snd.music({ menu: true, world: selWorld }); state = name; $("touch").style.display = "none"; $("aiUi").style.display = "none"; $("pauseBtn").style.display = "none"; }
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
// 人数: 人間 1〜4(コントローラーの数+キーボード2人まで) + AI 0〜3(合計4人まで)
function renderSetup(s) {
  const mh = maxHumans(); let { humans, ai } = prog.setup;
  humans = Math.max(1, Math.min(mh, humans)); ai = Math.max(0, Math.min(4 - humans, ai));
  while (humans + ai < s.minPlayers && ai < 4 - humans) ai++;
  prog.setup = { humans, ai };
  const mk = (id, vals, cur, disabled, label, set) => {
    const box = $(id); box.innerHTML = "";
    vals.forEach(v => { const b = document.createElement("button"); b.textContent = label(v); b.disabled = disabled(v); if (v === cur) b.classList.add("sel"); b.onclick = () => { set(v); saveProg(); Snd.play("click"); renderSelect(); }; box.appendChild(b); });
  };
  mk("humanPick", [1, 2, 3, 4], humans, v => v > mh || v + Math.max(0, s.minPlayers - v) > 4, v => "👨‍🍳".repeat(v) , v => { prog.setup.humans = v; });
  mk("aiPick", [0, 1, 2, 3], ai, v => humans + v > 4 || humans + v < s.minPlayers, v => v ? "🤖".repeat(v) : "なし", v => { prog.setup.ai = v; });
  const pads = connectedPads().length, dev = assignInputs(humans).map((d, i) => `${i + 1}P ${d.pad !== undefined ? "🎮コントローラー" : (d.keys === KB1 ? "⌨️ WASD" : "⌨️ 矢印")}${i === 0 && d.pad !== undefined && d.keys ? "+⌨️" : ""}`).join("　");
  $("devLine").textContent = `${dev}　(コントローラー ${pads}台)${pads === 0 ? " ボタンを押すと認識します" : ""}`;
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
  renderSetup(s);
  const ua = $("unlockAll"); ua.textContent = prog.unlockAll ? "🔓 全ステージ解放中(テスト用)" : "🔒 全ステージを解放する(テスト用)";
  ua.onclick = () => { prog.unlockAll = !prog.unlockAll; saveProg(); renderSelect(); };
  const go = $("stageGo"); go.disabled = !ok; go.textContent = ok ? "スタート!" : "🔒 前のステージを★1でクリア";
  go.onclick = () => startStage(s.id, prog.setup);
}
function confetti() {
  for (let i = 0; i < 46; i++) {
    const d = document.createElement("div"); d.className = "confetti";
    d.style.left = Math.random() * 100 + "vw"; d.style.background = [PAL.tomato, PAL.sun, PAL.mint, PAL.sky, PAL.pink, PAL.grape][i % 6];
    d.style.animationDuration = 1.8 + Math.random() * 1.6 + "s"; d.style.animationDelay = Math.random() * 0.6 + "s";
    document.body.appendChild(d); setTimeout(() => d.remove(), 4500);
  }
}
const endlessRank = t => t < 60 ? "見習いコック" : t < 150 ? "一人前のコック" : t < 300 ? "名コック" : "伝説のシェフ";
function showResult() {
  const r = lastResult;
  if (r.kind) { showArenaResult(r); return; }
  const s = STAGES[r.id - 1];
  $("scr-result").style.setProperty("--wc", WORLD_COL[s.world - 1]);
  $("resTitle").textContent = `${s.emoji} ${s.world}-${s.k} ${s.name}`;
  $("resStars").innerHTML = [0, 1, 2].map(i => `<span class="${i < r.stars ? "on" : ""}" style="--d:${0.25 + i * 0.35}s">★</span>`).join("");
  $("resScore").textContent = `${r.score}点${r.newBest ? " 🎉ベスト更新!" : ""}`;
  $("resGoals").textContent = `★1: ${goals[0]}　★2: ${goals[1]}　★3: ${goals[2]}`;
  const nextOk = r.id < STAGES.length && unlocked(r.id + 1);
  $("resNext").style.display = nextOk ? "" : "none";
  $("resNext").onclick = () => startStage(r.id + 1, prog.setup);
  $("resRetry").onclick = () => startStage(r.id, prog.setup);
  $("resSelect").onclick = () => { selWorld = s.world; selStage = r.id; renderSelect(); showScreen("select"); };
  $("resMsg").textContent = r.stars === 0 ? "あと少し! もう一度挑戦しよう" : (r.firstClear && r.id < STAGES.length ? `ステージ${r.id + 1}が解放されたよ!` : "");
  showScreen("result");
  if (r.stars === 3) confetti();
}
function showArenaResult(r) {                                    // 対戦・エンドレスの結果
  const st = r.kind === "vs" ? VS_STAGES.find(a => a.id === r.id) : ENDLESS.find(a => a.id === r.id);
  $("scr-result").style.setProperty("--wc", WORLD_COL[st.world - 1]);
  $("resTitle").textContent = `${st.emoji} ${st.name}`;
  $("resNext").style.display = "none";
  if (r.kind === "vs") {
    $("resStars").innerHTML = `<span class="on vsr" style="color:${TEAM_COL[0]};--d:.2s">${r.a}</span><span class="vsr" style="opacity:1;transform:none;font-size:30px;color:#fff">VS</span><span class="on vsr" style="color:${TEAM_COL[1]};--d:.5s">${r.b}</span>`;
    $("resScore").textContent = r.winner < 0 ? "🤝 引き分け!" : `🏆 ${TEAM_NAME[r.winner]}の勝ち!`;
    $("resGoals").textContent = `通算(人間): ${prog.vsRecord.w}勝 ${prog.vsRecord.l}敗 ${prog.vsRecord.d}分`;
    $("resMsg").textContent = "";
    if (r.winner >= 0) confetti();
  } else {
    const m = Math.floor(r.time / 60), sec = r.time % 60;
    $("resStars").innerHTML = `<span class="on vsr" style="--d:.2s;font-size:44px">⏱ ${m}分${sec}秒</span>`;
    $("resScore").textContent = `${r.score}点${r.newBest ? " 🎉ベスト更新!" : ""}`;
    $("resGoals").textContent = `称号: ${endlessRank(r.time)}`;
    $("resMsg").textContent = "";
    if (r.time >= 120) confetti();
  }
  $("resRetry").onclick = () => startStage(st, r.kind === "vs" ? prog.vsSetup : prog.setup);
  $("resSelect").onclick = () => { arenaKind = r.kind; renderArena(); showScreen("arena"); };
  showScreen("result");
}
$("homeStart").onclick = () => { renderSelect(); showScreen("select"); };
$("selBack").onclick = () => { renderHome(); showScreen("home"); };
$("pauseBtn").onclick = () => setPause(true);
$("pauseResume").onclick = () => setPause(false);
$("pauseQuit").onclick = () => { paused = false; if (stage && (stage.versus || stage.endless)) { arenaKind = stage.versus ? "vs" : "endless"; renderArena(); showScreen("arena"); } else { state = "select"; renderSelect(); showScreen("select"); } };

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
$("fsBtn").onclick = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); };
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

// ---- あそびかた・せってい ----
$("homeHelp").onclick = () => showScreen("help");
$("homeSettings").onclick = () => { renderSettings(); showScreen("settings"); };
$("helpBack").onclick = () => { renderHome(); showScreen("home"); };
$("setBack").onclick = () => { renderHome(); showScreen("home"); };
function renderSettings() {
  const seg = (id, opts, cur, set) => { const box = $(id); box.innerHTML = ""; opts.forEach(([v, label]) => { const b = document.createElement("button"); b.textContent = label; if (v === cur) b.classList.add("sel"); b.onclick = () => { set(v); Snd.play("click"); renderSettings(); }; box.appendChild(b); }); };
  seg("setBgm", [[true, "オン"], [false, "オフ"]], Snd.bgm, v => Snd.setBgm(v));
  seg("setSfx", [[true, "オン"], [false, "オフ"]], Snd.sfx, v => Snd.setSfx(v));
  seg("setGfx", [["high", "きれい"], ["low", "軽い"]], getGfx(), v => { setGfx(v); });
  syncSndBtns();
  const r = $("resetData"); r.classList.remove("confirm"); r.textContent = "セーブデータを消す";
  let armed = false;
  r.onclick = () => {
    if (!armed) { armed = true; r.classList.add("confirm"); r.textContent = "本当に消す?(もう一度押す)"; setTimeout(() => { armed = false; r.classList.remove("confirm"); r.textContent = "セーブデータを消す"; }, 4000); return; }
    try { ["ck-prog", "ck-recipes", "ck-snd", "ck-gfx"].forEach(k => localStorage.removeItem(k)); } catch {}
    location.reload();
  };
}
function getGfx() { try { const v = localStorage.getItem("ck-gfx"); if (v) return v; } catch {} return matchMedia("(pointer:coarse)").matches ? "low" : "high"; }
function setGfx(v) { try { localStorage.setItem("ck-gfx", v); } catch {} if (typeof applyQuality === "function") applyQuality(v); }

// ---- 対戦モード・エンドレス ----
let arenaKind = "vs", arenaIdx = 0;
$("homeVs").onclick = () => { arenaKind = "vs"; arenaIdx = 0; renderArena(); showScreen("arena"); };
$("homeEndless").onclick = () => { arenaKind = "endless"; arenaIdx = 0; renderArena(); showScreen("arena"); };
$("arBack").onclick = () => { renderHome(); showScreen("home"); };
function segBox(id, vals, cur, disabled, label, set) {
  const box = $(id); box.innerHTML = "";
  vals.forEach(v => { const b = document.createElement("button"); b.textContent = label(v); b.disabled = disabled(v); if (v === cur) b.classList.add("sel"); b.onclick = () => { set(v); saveProg(); Snd.play("click"); renderArena(); }; box.appendChild(b); });
}
function renderArena() {
  const vsMode = arenaKind === "vs", list = vsMode ? VS_STAGES : ENDLESS, a = list[arenaIdx], mh = maxHumans();
  $("scr-arena").style.setProperty("--wc", WORLD_COL[a.world - 1]);
  $("arTitle").textContent = vsMode ? "⚔ 対戦モード" : "♾ エンドレス";
  const lst = $("arList"); lst.innerHTML = "";
  list.forEach((x, i) => { const b = document.createElement("button"); b.style.setProperty("--wc", WORLD_COL[x.world - 1]); if (i === arenaIdx) b.classList.add("sel"); b.innerHTML = `<span>${x.emoji}</span>${x.name}`; b.onclick = () => { arenaIdx = i; Snd.play("click"); renderArena(); }; lst.appendChild(b); });
  const dishes = a.menu.map(n => `<span class="dish">${RECIPE_BY_NAME[n].need.map(k => ING[k.split(":")[0]].emoji).join("")} ${n}</span>`).join("");
  const best = vsMode ? `通算(人間): ${prog.vsRecord.w}勝 ${prog.vsRecord.l}敗 ${prog.vsRecord.d}分` : (prog.endless[a.id] ? `ベスト: ${prog.endless[a.id].score}点 / ${Math.floor(prog.endless[a.id].time / 60)}分${prog.endless[a.id].time % 60}秒` : "ベスト: -");
  $("arInfo").innerHTML = `<h3>${a.emoji} ${a.name}</h3><div>${a.gimmicks.map(g => `<span class="tag">${g}</span>`).join("")}<span class="tag">${vsMode ? "⏱ 120秒" : "♾ 注文を5回逃すと終わり"}</span></div>
    <div style="margin:4px 0">${a.desc || ""}</div><div>${vsMode ? "同じ注文が両チームに出る。先にさばいたチームの得点!" : "料理は時間とともに増える(" + dishes.length + "→最後は難しい料理も)。"}</div><div style="margin-top:4px">${dishes}</div><div class="goal" style="margin-top:6px;font-weight:800;font-size:13px;color:#6b5a8c">${best}</div>`;
  const pads = connectedPads().length;
  if (vsMode) {
    let { humans, teamSize } = prog.vsSetup; teamSize = teamSize === 2 ? 2 : 1; humans = Math.max(1, Math.min(mh, teamSize * 2, humans)); prog.vsSetup = { humans, teamSize };
    $("arRowSize").style.display = ""; $("arRowAi").style.display = "none";
    segBox("arSize", [1, 2], teamSize, () => false, v => v + "対" + v, v => { prog.vsSetup.teamSize = v; });
    segBox("arHumans", [1, 2, 3, 4], humans, v => v > Math.min(mh, teamSize * 2), v => "👨‍🍳".repeat(v), v => { prog.vsSetup.humans = v; });
    const inputs = assignInputs(humans), teams = [[], []];
    inputs.forEach((d, i) => teams[i % 2].push(`${i + 1}P(${d.pad !== undefined ? "🎮" : d.keys === KB1 ? "WASD" : "矢印"})`));
    for (const t of [0, 1]) while (teams[t].length < teamSize) teams[t].push("🤖AI");
    $("arDev").textContent = `${TEAM_NAME[0]}: ${teams[0].join(" + ")}　VS　${TEAM_NAME[1]}: ${teams[1].join(" + ")}　(コントローラー ${pads}台)`;
  } else {
    let { humans, ai } = prog.setup; humans = Math.max(1, Math.min(mh, humans)); ai = Math.max(0, Math.min(4 - humans, ai)); prog.setup = { humans, ai };
    $("arRowSize").style.display = "none"; $("arRowAi").style.display = "";
    segBox("arHumans", [1, 2, 3, 4], humans, v => v > mh, v => "👨‍🍳".repeat(v), v => { prog.setup.humans = v; });
    segBox("arAi", [0, 1, 2, 3], ai, v => humans + v > 4, v => v ? "🤖".repeat(v) : "なし", v => { prog.setup.ai = v; });
    $("arDev").textContent = assignInputs(humans).map((d, i) => `${i + 1}P ${d.pad !== undefined ? "🎮" : d.keys === KB1 ? "⌨️WASD" : "⌨️矢印"}`).join("　") + `　(コントローラー ${pads}台)　AIは「◯◯作って」「おまかせ」で動かせます`;
  }
  $("arGo").onclick = () => startStage(a, vsMode ? prog.vsSetup : prog.setup);
}
