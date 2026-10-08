"use strict";
// AI相棒: 日本語の指示を聞いて動く。手順を教えて提供まで成功すると、その料理を覚える。

const chatBox = $("chat"), chatIn = $("chatIn"), aiUi = $("aiUi");
function chat(who, text, col) {
  const d = document.createElement("div");
  d.textContent = (who === "ai" ? "🤖 " : "🧑 ") + text;
  d.style.color = who === "ai" ? (col || "#9ff0b0") : "#ddd";
  chatBox.appendChild(d); chatBox.scrollTop = chatBox.scrollHeight;
  while (chatBox.children.length > 60) chatBox.removeChild(chatBox.firstChild);
}
let recipes = {};                                   // 覚えた料理(全ステージ・全AIで共有、保存される)
try { recipes = JSON.parse(localStorage.getItem("ck-recipes") || "{}"); } catch {}
const saveRecipes = () => { try { localStorage.setItem("ck-recipes", JSON.stringify(recipes)); } catch {} };
const ING_JA = Object.fromEntries(Object.entries(ING).map(([k, v]) => [k, v.name]).concat([["plate", "お皿"]]));
const WORD_LIST = Object.entries(ING).flatMap(([k, v]) => v.words.map(w => [w, k])).sort((a, b) => b[0].length - a[0].length);
const detectIng = s => { const m = WORD_LIST.find(([w]) => s.includes(w)); return m ? m[1] : null; };
const RECIPE_NAMES = [...RECIPES].sort((a, b) => b.name.length - a.name.length);
const KIND_NAME = { S: "コンロ", F: "フライヤー", V: "オーブン" };
const hasD = () => tiles.some(row => row.some(c => c.t === "D"));
const hasTables = () => tiles.some(row => row.some(c => c.t === "B"));

function say(b, text) { b.say = text; b.sayT = 3.5; chat("ai", `${b.name}: ${text}`, b.col); }

// 手順1つを日本語にする(作り方のヒント用)
function describeStep(s) {
  switch (s.skill) {
    case "get": return `${ING_JA[s.a]}を取る`;
    case "board": return "まな板に置く";
    case "chop": return "切る(長押し)";
    case "grab": return `切った${ING_JA[s.a]}を持つ`;
    case "cook": return `${KIND_NAME[s.a]}に入れる`;
    case "plateAdd": return `${ING_JA[s.a]}をお皿に`;
    case "deliver": return "提供する";
    default: return s.skill;
  }
}
const howTo = r => CKData.canonicalSteps(r).map(describeStep).join(" → ");

// 人間の言葉 → 手順。skill: get board chop grab cook plateAdd deliver trash drop toK fromK scoop ほか
function parse(raw) {
  const s = raw.replace(/\s/g, "");
  const ing = detectIng(s);
  const st = (skill, a) => ({ skill, a, src: "user" });
  if (/待って|止ま|ストップ|やめ|キャンセル/.test(s)) return { cmd: "stop" };
  const tm = s.match(/([1-8])番/), tid = tm ? +tm[1] : null;
  if (/(ホール|接客)/.test(s) && /(担当|お願い|頼|やって|任せ)/.test(s)) return { cmd: "role", role: "hall" };
  if (/(キッチン|厨房|調理)/.test(s) && /(担当|お願い|頼|やって|任せ)/.test(s)) return { cmd: "role", role: "kitchen" };
  if (/おまかせ|任せ|自由に|自動/.test(s)) return { cmd: "auto" };
  const dish = RECIPE_NAMES.find(r => s.includes(r.name));
  if (dish && /作り方|レシピ|どうやって|教えて/.test(s)) return { cmd: "howto", dish };
  if (/ヒント|どうやる|使い方|何ができる|覚えた/.test(s)) return { cmd: "help" };
  if (dish && /作/.test(s)) return { cmd: "make", dish };
  if (/掃除|消火|焦げ/.test(s)) return { steps: [st("clean")] };
  if (/注文(を)?(取|とって|聞)|オーダー/.test(s)) return { steps: [st("order", tid)] };
  if (/会計|レジ|支払/.test(s)) return { steps: [st("pay", tid)] };
  if (/片付|下げ|さげ/.test(s)) return { steps: [st("clear", tid)] };
  if (/洗/.test(s)) return { steps: [st("sink"), st("wash")] };
  if (/運|届け|サーブ|配膳|持って行|持っていっ/.test(s)) return { steps: [st("fetch"), st("serve", tid)] };
  if (/受け取|もらって|受け渡し台から/.test(s)) return { steps: [st("fromK")] };
  if (/渡して|パスして|向こう|あっち|受け渡し台に/.test(s)) return { steps: [st("toK")] };
  if (/取り出/.test(s)) return { steps: [st("scoop")] };
  if (/提供|出して|だして|パス|受け渡/.test(s)) return { steps: [st("deliver")] };
  if (/捨て|すてて|ごみ/.test(s)) return { steps: [st("trash")] };
  if (/皿に|盛|乗せ|のせ|添え/.test(s)) return { steps: [st("plateAdd", ing)] };
  const station = /揚げ|フライヤー/.test(s) ? "F" : /オーブン|グラタン/.test(s) ? "V" : /コンロ|煮|ゆで|茹|炒|炊|焼|ソテー|加熱/.test(s) ? "S" : null;
  if (/切った|刻んだ|きざんだ/.test(s) && ing) return { steps: station ? [st("grab", ing), st("cook", station)] : [st("grab", ing)] };
  if (station) {
    if (!ing) return { steps: [st("cook", station)] };
    const k = cookSpec(ing, station);
    if (!k) return { steps: [st("cook", station)] };
    return { steps: k.from === "chopped" ? [st("get", ing), st("board"), st("chop", ing), st("grab", ing), st("cook", station)] : [st("get", ing), st("cook", station)] };
  }
  if (/切|刻/.test(s)) return { steps: ing ? [st("get", ing), st("board"), st("chop", ing)] : [st("chop")] };
  if (/まな板/.test(s)) return { steps: [st("board")] };
  if (/置い|おいて/.test(s)) return { steps: [st("drop")] };
  if (/皿|さら/.test(s)) return { steps: [st("get", "plate")] };
  if (ing) return { steps: [st("get", ing)] };
  return null;
}

const STEP_SAY = {
  get: a => `${ING_JA[a]}を取ってくるね`, board: () => "まな板に置くね", chop: () => "切るよ〜",
  grab: a => `切った${ING_JA[a]}を持つね`, clean: () => "焦げを片付けるね", cook: a => `${KIND_NAME[a]}に入れるね`, stove: () => "コンロに入れるね",
  plateAdd: a => `${a ? ING_JA[a] + "を" : ""}お皿に盛るね`, deliver: () => "提供するね",
  trash: () => "捨てるね", drop: () => "ここに置いとくね", toK: () => "向こうに渡すね", fromK: () => "受け取るね", scoop: () => "取り出すね",
  order: () => "ご注文をうかがいます!", pay: () => "お会計しますね", clear: () => "お皿を下げるね", serve: () => "お待たせしました〜!",
  fetch: () => "料理を取ってくるね", sink: () => "シンクに入れるね", wash: () => "洗うよ〜", putback: () => "お皿を戻すね",
};

const BOTS = [{ name: "ポチ", col: "#3fae5a" }, { name: "タマ", col: "#d98a1f" }, { name: "コタ", col: "#9a5ad9" }];
function newBot(i) {
  const d = BOTS[i];
  return { x: 0, y: 0, dir: [0, 1], item: null, col: d.col, name: d.name, ai: true, queue: [], cur: null, wait: 0,
    chopping: false, log: [], auto: false, role: null, fails: 0, say: "", sayT: 0, idleSay: 0, job: null, claim: null };
}

// ---- チャット欄 ----
function buildWho() {
  const w = $("who"); w.innerHTML = "";
  players.filter(p => p.ai).forEach((b, i) => {
    const btn = document.createElement("button"); btn.type = "button"; btn.textContent = "🤖" + b.name;
    btn.style.background = b.col; btn.className = i === selBot ? "sel" : "";
    btn.onclick = () => { selBot = i; buildWho(); }; w.appendChild(btn);
  });
}
function buildChips() {
  const chips = $("chips"); chips.innerHTML = "";
  const base = ["レタスを取って", "まな板に置いて", "切って", "皿を取って", "レタスを皿に", "提供して", "コンロに入れて", "皿に盛って", "洗って", "ホールお願い", "キッチンお願い", "おまかせ", "待って"];
  const menu = stage.menu.flatMap(n => [`${n}作って`, `${n}の作り方`]);
  [...menu, ...base.filter(t => stage.mode === "restaurant" || !/ホール|洗/.test(t))].forEach(t => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = t;
    b.onclick = () => sendCmd(t); chips.appendChild(b);
  });
}
function setupAiUi(nAi) {
  aiUi.style.display = nAi ? "block" : "none";
  if (!nAi) return;
  selBot = 0; buildWho(); buildChips(); chatBox.innerHTML = "";
  const known = Object.keys(recipes);
  players.filter(p => p.ai).forEach(b => chat("ai", `${b.name}: ` + (known.length ? `よろしく! 覚えてる料理: ${known.join("、")}` : "はじめまして、新人です! 手順を教えてね。")));
  chat("ai", "ヒント: 「◯◯の作り方」で手順が見られるよ。名前で指示(例「ポチ、切って」)、「みんな、〜」で全員。");
}
function sendCmd(text) {
  text = text.trim(); if (!text || state !== "play") return;
  chat("you", text);
  const bots = players.filter(p => p.ai);
  if (!bots.length) return;
  let targets = [bots[Math.min(selBot, bots.length - 1)]];
  if (/みんな|全員|ぜんいん/.test(text)) { targets = bots; text = text.replace(/みんな|全員|ぜんいん/g, ""); }
  else {
    const named = bots.filter(b => text.includes(b.name));
    if (named.length) { targets = named; selBot = bots.indexOf(named[0]); buildWho(); named.forEach(b => text = text.split(b.name).join("")); }
  }
  const r = parse(text);
  for (const b of targets) runCmd(b, r);
}
function runCmd(b, r) {
  if (!r) { say(b, "ごめん、よくわからない…「レタスを取って」みたいに教えて!"); return; }
  if (r.cmd === "stop") { b.queue = []; b.cur = null; b.chopping = false; b.auto = false; b.role = null; b.log = []; say(b, "OK、止まるね。"); return; }
  if (r.cmd === "role") {
    b.auto = true; b.fails = 0; b.role = r.role;
    say(b, r.role === "hall" ? "ホール担当するね! 注文・配膳・お会計・片付けをやるよ。" : "キッチン担当するね! 覚えた料理を作るよ。"); return;
  }
  if (r.cmd === "auto") {
    b.auto = true; b.fails = 0; b.role = "any";
    say(b, Object.keys(recipes).length ? "おまかせあれ! 覚えた料理で注文をさばくよ。" : "まだ料理を覚えてないよ…先に教えてね!");
    return;
  }
  if (r.cmd === "howto") { say(b, `${r.dish.name}: ${howTo(r.dish)}`); return; }
  if (r.cmd === "help") {
    const k = Object.keys(recipes);
    say(b, k.length ? `覚えた料理: ${k.join("、")}。「◯◯作って」か「おまかせ」で動くよ。` : "まだ何も覚えてない。手順を教えて提供まで成功すると覚えるよ。");
    return;
  }
  if (r.cmd === "make") {
    const rec = recipes[r.dish.name];
    if (!rec) { say(b, `${r.dish.name}の作り方、まだ知らないの。「${r.dish.name}の作り方」で手順を見て教えてね!`); return; }
    rec.forEach(s => b.queue.push({ ...s, src: "auto" }));
    say(b, `了解、${r.dish.name}作るね!`); return;
  }
  r.steps.forEach(s => b.queue.push({ ...s }));
}

// ---- 経路探索(幅優先) ----
function bfs(sx, sy) {
  const dist = new Map([[sx + "," + sy, { d: 0, from: null }]]);
  const q = [[sx, sy]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i], d = dist.get(x + "," + y).d;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + "," + ny;
      if (solid(nx, ny) || dist.has(k)) continue;
      dist.set(k, { d: d + 1, from: x + "," + y }); q.push([nx, ny]);
    }
  }
  return dist;
}
// 条件に合うマスのうち一番近いもの → { tx, ty, stand:[x,y] }
function nearest(b, pred) {
  const dist = bfs(Math.floor(b.x), Math.floor(b.y));
  let best = null;
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    if (!pred(tiles[ty][tx])) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = dist.get((tx + dx) + "," + (ty + dy));
      if (n && (!best || n.d < best.d)) best = { d: n.d, tx, ty, stand: [tx + dx, ty + dy], dist };
    }
  }
  return best;
}
const pathTo = (dist, stand) => {
  const out = []; let k = stand[0] + "," + stand[1];
  while (k) { const n = dist.get(k); out.unshift(k.split(",").map(Number)); k = n.from; }
  return out.slice(1);
};

// 手順ごとに「どのマスで何をするか」を決める。{fail}=できない {wait}=待つ {skip}=やらなくていい
// 自動の作業で、他の人に先を越されただけの失敗は「静かにやめる」(失敗として数えない)
const SOFT = new Set(["wash", "fetch", "pay", "order", "clear", "serve", "grab", "plateAdd", "chop", "sink", "scoop"]);
function plan(b, s) {
  const r = planRaw(b, s) || { fail: "そこへは行けないよ…" };
  if (r.fail && s.src === "auto" && SOFT.has(s.skill)) return { abort: true };
  return r;
}
function planRaw(b, s) {
  const h = b.item, F = m => ({ fail: m }), go = (pred, act = "interact") => {
    const n = nearest(b, pred); return n ? { n, act } : null;
  };
  const mine = it => !it.owner || it.owner === b.name;
  const mineC = c => !c.owner || c.owner === b.name;
  let r;
  switch (s.skill) {
    case "get": {
      if (h) return F("手がふさがってるよ");
      if (s.a === "plate") return plates <= 0 ? F("お皿がないよ。洗わなきゃ!") : (go(c => c.t === "P") || F("お皿置き場に行けない…"));
      const ch = ING[s.a] && ING[s.a].crate;
      if (!ch) return F("それが見つからない…");
      r = go(c => c.t === ch && (c.stock === null || c.stock > 0));
      if (r) return r;
      return tiles.some(row => row.some(c => c.t === ch)) ? (go(c => c.t === ch) ? { wait: true } : F(`${ING_JA[s.a]}に届かないよ…`)) : F("それが見つからない…");
    }
    case "board":
      if (!h || h.kind !== "ing" || h.state !== "raw" || !ING[h.type].chop) return F("切れる食材を持ってないよ");
      return go(c => c.t === "C" && !c.item) || { wait: true };
    case "chop":
      return go(c => c.t === "C" && c.item && c.item.kind === "ing" && c.item.state === "raw" && ING[c.item.type].chop && mine(c.item) && (!s.a || c.item.type === s.a), "chop") || F("切るものがまな板にないよ");
    case "grab":
      if (h) return F("手がふさがってるよ");
      return go(c => c.t === "C" && c.item && c.item.kind === "ing" && c.item.state === "chopped" && mine(c.item) && c.item.type === s.a) || F(`切った${ING_JA[s.a]}がないよ`);
    case "stove": s = { ...s, skill: "cook", a: "S" };      // 昔に覚えた手順(コンロ)も使えるように
    // falls through
    case "cook": {
      const k = h && h.kind === "ing" ? cookSpec(h.type, s.a) : null;
      if (!h || !k || h.state !== k.from) return F(`${KIND_NAME[s.a] || "調理器具"}に入れられるものを持ってないよ`);
      return go(c => c.t === s.a && c.stove === "idle") || go(c => c.t === s.a && c.stove === "burnt") ||
        (tiles.some(row => row.some(c => c.t === s.a)) ? { wait: true } : F(`${KIND_NAME[s.a]}がないよ`));
    }
    case "clean":
      return go(c => isCooker(c.t) && c.stove === "burnt") || { skip: true };
    case "scoop":
      if (h) return F("手がふさがってるよ");
      return go(c => isCooker(c.t) && c.stove === "done" && mineC(c)) || F("取り出せるものがないよ");
    case "plateAdd": {
      if (!h || h.kind !== "plate") return F("お皿を持ってないよ");
      const ok = c =>
        ((c.t === "C" || isCounter(c)) && c.item && c.item.kind === "ing" && mine(c.item) && canAdd(h, c.item) && (!s.a || c.item.type === s.a)) ||
        (isCooker(c.t) && c.stove === "done" && mineC(c) && canAdd(h, { kind: "ing", type: c.sitem.type, state: c.res }) && (!s.a || c.sitem.type === s.a)) ||
        (CRATE[c.t] && ING[CRATE[c.t]].rawOk && (!s.a || CRATE[c.t] === s.a) && (c.stock === null || c.stock > 0) && canAdd(h, { kind: "ing", type: CRATE[c.t], state: "raw" }));
      r = go(ok);
      if (r) return r;
      if (tiles.some(row => row.some(c => isCooker(c.t) && c.stove === "cooking" && (!s.a || c.sitem.type === s.a)))) return { wait: true };
      return F("盛れるものがないよ");
    }
    case "deliver": {
      if (!h || h.kind !== "plate" || !h.contents.length) return F("出せるお皿がないよ");
      return (hasD() ? go(c => c.t === "D") : go(c => c.t === "K" && !c.item)) || { wait: true };
    }
    case "toK":
      return h ? (go(c => c.t === "K" && !c.item) || { wait: true }) : F("何も持ってないよ");
    case "fromK":
      if (h) return F("手がふさがってるよ");
      return go(c => c.t === "K" && c.item) || F("受け渡し台に何もないよ");
    case "order":
      if (h) return F("手がふさがってるよ");
      return go(c => c.t === "B" && c.tb.state === "order" && (!s.a || c.tb.id === s.a)) || F("注文待ちのお客さんがいないよ");
    case "pay":
      if (h) return F("手がふさがってるよ");
      return go(c => c.t === "B" && c.tb.state === "pay" && (!s.a || c.tb.id === s.a)) || F("お会計待ちのお客さんがいないよ");
    case "clear":
      if (h) return F("手がふさがってるよ");
      return go(c => c.t === "B" && c.tb.state === "dirty" && (!s.a || c.tb.id === s.a)) || F("片付けるテーブルがないよ");
    case "serve":
      if (!h || h.kind !== "plate" || !h.contents.length) return F("運べる料理を持ってないよ");
      return go(c => c.t === "B" && c.tb.state === "wait" && needKey(c.tb.ticket.r) === plateKey(h) && (!s.a || c.tb.id === s.a)) || F("この料理を待ってるお客さんがいないよ");
    case "fetch":
      if (h) return h.kind === "plate" && h.contents.length ? { skip: true } : F("手がふさがってるよ");
      return go(c => isCounter(c) && c.item && c.item.kind === "plate" && c.item.contents.length && (!s.a || plateKey(c.item) === s.a)) || F("出来上がった料理が見つからないよ");
    case "sink":
      if (!h || h.kind !== "dirty") return { skip: true };
      return go(c => c.t === "Z" && c.dirty < 6) || { wait: true };
    case "wash":
      return go(c => c.t === "Z" && c.dirty > 0, "chop") || F("洗うお皿がないよ");
    case "putback":
      return h && h.kind === "plate" && !h.contents.length ? go(c => c.t === "P") : { skip: true };
    case "trash":
      return h ? go(c => c.t === "X") : F("何も持ってないよ");
    case "drop":
      return h ? (go(c => isCounter(c) && !c.item) || F("置き場所がないよ")) : F("何も持ってないよ");
  }
  return F("その作業はできないよ");
}

function abortSteps(b) { b.queue = []; b.cur = null; b.chopping = false; b.log = []; b.wait = 0.6; }
function failStep(b, msg) {
  say(b, msg); b.queue = []; b.cur = null; b.chopping = false; b.log = [];
  if (b.auto && ++b.fails >= 3) { b.auto = false; say(b, "うまくいかないから、おまかせは終わりにするね。"); }
  b.wait = 3;
}

function botUpdate(b, dt) {
  b.sayT -= dt;
  if (b.wait > 0) { b.wait -= dt; return; }
  if (!b.cur) {
    const s = b.queue.shift();
    if (!s) { autoPick(b, dt); return; }
    b.cur = { s, phase: "plan", t: 0 };
    if (s.src === "user" || b.queue.length === 0) b.sayT = 0;
    if (s.src === "user" && STEP_SAY[s.skill]) say(b, STEP_SAY[s.skill](s.a));
  }
  const c = b.cur; c.t += dt;
  if (c.phase === "plan") {
    const r = plan(b, c.s);
    if (r.abort) return abortSteps(b);
    if (r.fail) return failStep(b, r.fail);
    if (r.skip) { b.cur = null; return; }
    if (r.wait) { if (c.t > 14) return failStep(b, "待ってたけど、できなかったよ…"); b.wait = 0.4; return; }
    c.n = r.n; c.act = r.act; c.path = pathTo(r.n.dist, r.n.stand); c.phase = "walk";
  }
  if (c.phase === "walk") {
    const wp = c.path[0];
    if (!wp) { c.phase = "act"; c.t = 0; b.dir = [c.n.tx - Math.floor(b.x), c.n.ty - Math.floor(b.y)]; return; }
    const tx = wp[0] + 0.5, ty = wp[1] + 0.5, ex = tx - b.x, ey = ty - b.y, sp = 4 * dt * (1 + 0.1 * 0);
    if (Math.abs(ex) > 0.04) { b.dir = [Math.sign(ex), 0]; moveBy(b, Math.sign(ex) * Math.min(sp, Math.abs(ex)), 0); }
    else if (Math.abs(ey) > 0.04) { b.dir = [0, Math.sign(ey)]; moveBy(b, 0, Math.sign(ey) * Math.min(sp, Math.abs(ey))); }
    else { b.x = tx; b.y = ty; c.path.shift(); }
    if (c.t > 25) return failStep(b, "道に迷っちゃった…");
    return;
  }
  if (c.phase === "act") {
    if (c.t < 0.25) return;
    const r = plan(b, c.s);                       // 到着までに状況が変わっていないか確認
    if (r.abort) return abortSteps(b);
    if (r.fail) return failStep(b, r.fail);
    if (r.skip) { b.cur = null; return; }
    if (r.wait) { b.wait = 0.4; return; }
    if (r.n.tx !== c.n.tx || r.n.ty !== c.n.ty) { c.phase = "plan"; return; }
    if (c.act === "chop") { b.chopping = true; c.phase = "chop"; c.t = 0; return; }
    const before = b.item;
    let learned = null;
    if (c.s.skill === "deliver") learned = dishOf(before);
    interact(b);
    if (c.s.skill === "cook" && before && b.item === before) {   // 焦げた調理器具を片付けただけ → もう一度入れに行く
      b.queue.unshift({ ...c.s }); b.cur = null; b.wait = 0.25; return;
    }
    if (c.s.skill === "deliver" && b.item === null) {
      b.fails = 0;
      if (learned && !recipes[learned.name] && b.log.length) {
        recipes[learned.name] = b.log.map(x => ({ skill: x.skill, a: x.a })); saveRecipes();
        say(b, `${learned.name}、覚えた! 次からは「${learned.name}作って」でいいよ。`);
      }
      b.log = [];
    } else if (c.s.src === "user") b.log.push(c.s);
    if (c.s.skill === "trash") b.log = [];
    b.cur = null; b.wait = 0.25;
    return;
  }
  if (c.phase === "chop") {
    const tile = tiles[c.n.ty][c.n.tx];
    const finished = tile.t === "Z" ? (tile.dirty === 0 || c.t > 25) : (!tile.item || tile.item.state !== "raw" || c.t > 8);
    if (finished) {
      b.chopping = false; if (c.s.src === "user") b.log.push(c.s);
      b.cur = null; b.wait = 0.25;
    }
  }
}

// ---- おまかせ/担当モード ----
const tableTiles = () => tiles.flat().filter(c => c.t === "B");
const claimedByOther = (b, c) => players.some(q => q.ai && q !== b && q.claim === c);
const auto = (...steps) => steps.map(([skill, a]) => ({ skill, a, src: "auto" }));

// 手に何か持ったままのとき(失敗の後など)は、まず片付ける
function autoHeld(b) {
  const h = b.item; if (!h) return false;
  if (h.kind === "plate" && h.contents.length) {
    const key = plateKey(h);
    const t = tableTiles().find(c => c.tb.state === "wait" && needKey(c.tb.ticket.r) === key && !claimedByOther(b, c));
    if (t && b.role !== "kitchen") { b.claim = t; b.queue.push(...auto(["serve", t.tb.id])); }
    else if (orders.some(o => needKey(o.r) === key)) b.queue.push(...auto(["deliver"]));
    else b.queue.push(...auto(["trash"]));              // どの注文とも合わない皿は空にする
  } else if (h.kind === "plate") b.queue.push(...auto(["putback"]));
  else if (h.kind === "dirty") b.queue.push(...auto(["sink"], ["wash"]));
  else b.queue.push(...auto(["trash"]));
  return true;
}

// ホール担当: お会計 > 配膳 > 注文取り > 片付け・洗い物
function autoHall(b) {
  const tbs = tableTiles().filter(c => !claimedByOther(b, c));
  if (!tbs.length) return false;
  const t1 = tbs.find(c => c.tb.state === "pay");
  if (t1) { b.claim = t1; b.queue.push(...auto(["pay", t1.tb.id])); return true; }
  const ready = tiles.flat().filter(c => isCounter(c) && c.item && c.item.kind === "plate" && c.item.contents.length);
  for (const c of ready) {
    const key = plateKey(c.item);
    const t = tbs.find(x => x.tb.state === "wait" && needKey(x.tb.ticket.r) === key);
    if (t) { b.claim = t; b.queue.push(...auto(["fetch", key], ["serve", t.tb.id])); return true; }
  }
  const t3 = tbs.find(c => c.tb.state === "order");
  if (t3) { b.claim = t3; b.queue.push(...auto(["order", t3.tb.id])); return true; }
  const t4 = tbs.find(c => c.tb.state === "dirty");
  if (t4) { b.claim = t4; b.queue.push(...auto(["clear", t4.tb.id], ["sink"], ["wash"])); return true; }
  const sink = tiles.flat().find(c => c.t === "Z" && c.dirty > 0);
  if (sink && !claimedByOther(b, sink)) { b.claim = sink; b.queue.push(...auto(["wash"])); return true; }
  return false;
}

// 設備の取り合い(デッドロック)を防ぐ: 作り始める前に、まな板と調理器具が足りるか確かめる
function resNeed(r) {
  let chopFinal = 0, cookChop = 0; const cooks = { S: 0, F: 0, V: 0 };
  for (const n of r.need) {
    const [type, state] = n.split(":");
    if (state === "chopped") chopFinal++;
    else if (state !== "raw") { const k = CKData.STATION_OF[state]; cooks[k]++; if (ING[type].cook[k].from === "chopped") cookChop = 1; }
  }
  return { boards: chopFinal + cookChop, cooks };
}
function resFits(b, r) {
  const mine = resNeed(r), others = players.filter(q => q.ai && q !== b && q.res);
  if (!others.length) return true;
  const cap = { boards: 0, S: 0, F: 0, V: 0 };
  tiles.flat().forEach(c => { if (c.t === "C") cap.boards++; else if (isCooker(c.t)) cap[c.t]++; });
  const used = { boards: 0, S: 0, F: 0, V: 0 };
  others.forEach(q => { used.boards += q.res.boards; for (const k of ["S", "F", "V"]) used[k] += q.res.cooks[k]; });
  return used.boards + mine.boards <= cap.boards && ["S", "F", "V"].every(k => used[k] + mine.cooks[k] <= cap[k]);
}
// キッチン担当: 覚えた料理で、まだ作られていない注文を作る
function autoKitchen(b) {
  const prepared = [];
  tiles.flat().forEach(c => { if (isCounter(c) && c.item && c.item.kind === "plate" && c.item.contents.length) prepared.push(plateKey(c.item)); });
  players.forEach(q => { if (q.item && q.item.kind === "plate" && q.item.contents.length) prepared.push(plateKey(q.item)); });
  for (const o of [...orders].sort((x, y) => x.t - y.t)) {
    if (!recipes[o.r.name] || players.some(q => q.ai && q.job === o)) continue;
    const i = prepared.indexOf(needKey(o.r));
    if (i >= 0) { prepared.splice(i, 1); continue; }
    if (!resFits(b, o.r)) continue;
    b.job = o; b.res = resNeed(o.r); say(b, `${o.r.name}、作るね!`);
    recipes[o.r.name].forEach(st => b.queue.push({ ...st, src: "auto" }));
    return true;
  }
  return false;
}

function autoPick(b, dt) {
  if (!b.auto) return;
  b.job = null; b.res = null; b.claim = null;
  if (autoHeld(b)) return;
  const role = b.role || "any";
  if (role !== "hall") {
    const burnt = tiles.flat().find(c => isCooker(c.t) && c.stove === "burnt" && !claimedByOther(b, c));
    if (burnt) { b.claim = burnt; b.queue.push(...auto(["clean"])); return; }
  }
  if (role !== "kitchen" && autoHall(b)) return;
  if (role !== "hall" && autoKitchen(b)) return;
  b.idleSay -= dt;
  if (b.idleSay <= 0) {
    b.idleSay = 15;
    if (role !== "hall" && orders.some(o => !recipes[o.r.name])) say(b, "作り方を知らない注文があるよ…教えて!");
    else say(b, "お客さん待ちだよ。");
  }
}

$("chatForm").onsubmit = e => { e.preventDefault(); sendCmd(chatIn.value); chatIn.value = ""; };
chatIn.addEventListener("focus", () => keys.clear());
