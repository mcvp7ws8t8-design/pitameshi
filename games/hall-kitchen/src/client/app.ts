import * as THREE from "three";
import { ROOM_CODE, type ClientMessage, type ServerMessage } from "../shared/protocol";
import { CONFIG, partIndex, partTicket, type GameSnapshot, type PartState, type TicketSnapshot } from "../shared/game";
import { METHOD_NAME, PREP_NAME, dishName, drinkName, ingredientName, methodOfIngredient, type Method } from "../shared/menu";
import { STOVES, nearestTarget, seatLabel } from "../shared/layout";
import { step, type PlayerSnapshot, type Role } from "../shared/room";
import { dishColorCss, drinkColorCss } from "./items";
import { animateWalk, buildPerson, lookFor, type Person } from "./people";
import { preloadFood } from "./food";
import { Sound } from "./audio";
import { loadHdri } from "./hdri";
import { loadModel, placeable } from "./models";
import { buildRestaurant } from "./scene";
import { GameView } from "./view";
import { ViewModel, type Held } from "./viewmodel";

// 通信のしかた。サーバー(WebSocket)でも、同じ部屋にいる人どうし(room)でも、同じ画面で動く。
export interface Net {
  send(msg: ClientMessage): void;
  close(): void;
}
export interface NetHandlers {
  open(): void; // 部屋に入れた
  close(): void; // 部屋から切れた
  message(msg: ServerMessage): void;
  fail(text: string): void; // 入れなかった理由(ロビーに表示する)
}
export type NetFactory = (code: string, create: boolean, handlers: NetHandlers) => Net;

let netFactory: NetFactory | null = null;
let net: Net | null = null;
/** 起動時に、通信のしかたを渡す */
export function startApp(factory: NetFactory) {
  netFactory = factory;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ROLE_NAME: Record<Role, string> = { hall: "ホール", kitchen: "キッチン" };

// ---- 画面 ----
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
document.body.prepend(renderer.domElement);

const { scene, kitchen, tableVases } = buildRestaurant(renderer);
const view = new GameView(scene, kitchen);
const sound = new Sound();
// ブラウザは、画面を操作するまで音を出せない。最初のクリックかキー入力で始める
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, () => sound.start());
const hands = new ViewModel(scene.environment as THREE.Texture | null);
// 反射の背景。金属(ステンレスなど)にだけ、実際の室内の景色を映す。
// 壁や天井まで照らしてしまうと、背景画像の色が部屋全体に移ってしまうので、金属の反射だけに使う
const hdriName = new URLSearchParams(location.search).get("env") ?? "warehouse";
loadHdri(renderer, hdriName)
  .then((env) => {
    const apply = (root: THREE.Object3D, intensity: number) =>
      root.traverse((o) => {
        const mat = (o as THREE.Mesh).material;
        for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
          if (m instanceof THREE.MeshStandardMaterial && m.metalness > 0.5) {
            m.envMap = env;
            m.envMapIntensity = intensity;
            m.needsUpdate = true;
          }
        }
      });
    apply(scene, 0.8);
    apply(hands.scene, 0.6);
  })
  .catch((e) => console.warn("反射用の背景画像を読み込めませんでした", e));
// テーブルの花瓶を、配布されている本物のモデル(CC0)に差し替える
loadModel("models/glass-vase-flowers.glb")
  .then((model) => {
    for (const ph of tableVases) {
      const vase = placeable(model, 0.3);
      vase.position.copy(ph.position);
      scene.add(vase);
      ph.visible = false;
    }
  })
  .catch((e) => console.warn("花瓶のモデルを読み込めませんでした", e));
// 食材のモデル。読み込めたら、すでに作った料理や手元を作り直す
preloadFood().then(() => {
  view.invalidate();
  hands.invalidate();
  if (game) onGame(game);
});
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 100);
camera.rotation.order = "YXZ";
const EYE = 1.6;

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  view.effects.setViewport(innerHeight * renderer.getPixelRatio(), camera.fov);
}
addEventListener("resize", resize);
resize();

// ---- 状態 ----
let myId = "";
let myRole: Role | null = null;
let game: GameSnapshot | null = null;
let infoTimer = 0;
let speed = 0;
let stepDist = 0;
const me = { x: 0, z: 0, yaw: 0, pitch: 0 };

interface Avatar {
  person: Person;
  tx: number;
  tz: number;
  yaw: number;
  speed: number;
  at: number;
}
const avatars = new Map<string, Avatar>();

function send(msg: ClientMessage) {
  net?.send(msg);
}
function say(text: string) {
  $("msg").textContent = text;
}

// ---- 通信 ----
function connect(code: string, create: boolean) {
  if (!ROOM_CODE.test(code)) return say("部屋コードは英字4文字です");
  if (!netFactory) return say("通信の準備ができていません");
  net?.close();
  net = netFactory(code, create, {
    open() {
      $("step1").hidden = true;
      $("step2").hidden = false;
      $("roomcode").textContent = code;
      say("役割を選んでください");
    },
    close() {
      myRole = null;
      $("ui").classList.remove("hidden");
      for (const id of ["hud", "cross", "top", "side", "center"]) $(id).hidden = true;
      $("prompt").replaceChildren();
      game = null;
      $("step1").hidden = false;
      $("step2").hidden = true;
      say("接続が切れました");
    },
    message(msg) {
      if (msg.t === "welcome") myId = msg.id;
      else if (msg.t === "game") onGame(msg.g);
      else if (msg.t === "info") {
        toast(msg.text);
        sound.action();
      }
      else if (msg.t === "error") {
        say({ full: "この部屋は満員です", "role-taken": "その役割は選ばれています", "bad-message": "通信エラー" }[msg.reason]);
      } else onState(msg.players);
    },
    fail: say,
  });
}

function toast(text: string) {
  const el = $("info");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(infoTimer);
  infoTimer = window.setTimeout(() => el.classList.remove("show"), 2200);
}

function onState(list: PlayerSnapshot[]) {
  const mine = list.find((p) => p.id === myId);
  if (mine?.role && myRole !== mine.role) {
    myRole = mine.role;
    sound.setRole(myRole);
    hands.setRole(myRole);
    Object.assign(me, { x: mine.x, z: mine.z, yaw: mine.yaw, pitch: 0 });
    $("ui").classList.add("hidden");
    for (const id of ["hud", "cross", "top", "side"]) $(id).hidden = false;
  } else if (mine?.role) {
    // 自分の位置は手元の予測を優先し、ずれが大きいときだけサーバーに合わせる
    const err = Math.hypot(mine.x - me.x, mine.z - me.z);
    if (err > 1) Object.assign(me, { x: mine.x, z: mine.z });
    else {
      me.x += (mine.x - me.x) * 0.1;
      me.z += (mine.z - me.z) * 0.1;
    }
  }
  // 相手の姿(カメラは -z が yaw=0。人のモデルは +z が正面なので π を足す)
  const seen = new Set<string>();
  const now = performance.now();
  for (const p of list) {
    if (p.id === myId || !p.role) continue;
    seen.add(p.id);
    let a = avatars.get(p.id);
    if (!a) {
      const person = buildPerson(lookFor(p.role === "hall" ? 3 : 8), p.role === "hall" ? "waiter" : "chef");
      person.group.position.set(p.x, 0, p.z);
      scene.add(person.group);
      a = { person, tx: p.x, tz: p.z, yaw: p.yaw, speed: 0, at: now };
      avatars.set(p.id, a);
    }
    const dt = Math.max(0.016, (now - a.at) / 1000);
    a.speed = a.speed * 0.6 + (Math.hypot(p.x - a.tx, p.z - a.tz) / dt) * 0.4;
    Object.assign(a, { tx: p.x, tz: p.z, yaw: p.yaw, at: now });
  }
  for (const [id, a] of avatars) {
    if (!seen.has(id)) {
      scene.remove(a.person.group);
      avatars.delete(id);
    }
  }
  const other = list.find((p) => p.id !== myId);
  partner = other ? (other.role ? `${ROLE_NAME[other.role]}で参加中` : "役割を選んでいます") : "相手を待っています";
  partnerReady = !!other?.role;
  renderHud();
}

let partner = "";
let partnerReady = false;
function renderHud() {
  if (!myRole) return;
  $("hud").innerHTML = `<span class="chip role">${ROLE_NAME[myRole]}</span><span class="chip ${partnerReady ? "ok" : "wait"}">${partner}</span><span class="chip">音 ${sound.on ? "オン" : "オフ"} <kbd>M</kbd></span>`;
}

// ---- ゲームの表示 ----
const itemName = (t: TicketSnapshot) => (t.kind === "food" ? dishName(t.item) : drinkName(t.item));
const itemColor = (t: TicketSnapshot) => (t.kind === "food" ? dishColorCss(t.item) : drinkColorCss(t.item));

/** キッチンが手に持っている食材(生のものと調理済みのもの) */
function heldParts(g: GameSnapshot): { t: TicketSnapshot; ing: number; st: PartState }[] {
  return g.tickets
    .flatMap((t) => (t.parts ?? []).map((p) => ({ t, ing: p.ing, st: p.st })))
    .filter((h) => h.st === "raw" || h.st === "cooked");
}

const STATE_LABEL: Record<PartState, string> = { need: "未", raw: "持", cooking: "調理中", ready: "できた", cooked: "調理済", plated: "済" };
const methodTag = (ing: number) => `<i class="m ${methodOfIngredient(ing)}">${PREP_NAME[methodOfIngredient(ing)]}</i>`;

function onGame(g: GameSnapshot) {
  const prev = game;
  const prevPhase = prev?.phase;
  game = g;
  soundEvents(prev, g);
  view.update(g);
  if (g.phase === "over" && prevPhase !== "over") document.exitPointerLock();
  const time = `${Math.floor(g.timeLeft / 60)}:${String(g.timeLeft % 60).padStart(2, "0")}`;
  const segs = Array.from({ length: g.maxAngry }, (_, i) => `<i class="${i < g.angry ? "on" : ""}"></i>`).join("");
  $("top").innerHTML =
    `<div class="stat"><small>残り</small><b>${time}</b></div>` +
    `<div class="stat main"><small>さばいた</small><b>${g.served}</b></div>` +
    `<div class="stat"><small>怒って帰った ${g.angry}/${g.maxAngry}</small><div class="segs">${segs}</div></div>` +
    `<div class="stat"><small>行列</small><b>${g.queue}<span>人</span></b></div>`;
  renderSide(g);
  renderCenter(g);
  hands.setHeld(myRole === "kitchen" ? heldParts(g).map((h) => ({ kind: "ing" as const, item: h.ing, cooked: h.st === "cooked" })) : g.tickets
    .filter((t) => t.status === "hall")
    .sort((a, b) => a.id - b.id)
    .map((t): Held => ({ kind: t.kind, item: t.item })));
}

/** 状態の変わり目に、音を鳴らす。調理中の数や座っている人の数で、環境音の大きさも決める */
function soundEvents(prev: GameSnapshot | null, g: GameSnapshot) {
  if (prev) {
    if (g.served > prev.served) sound.served();
    if (g.angry > prev.angry) sound.angry();
    if (prev.phase === "countdown" && g.phase === "countdown" && g.countdown !== prev.countdown && g.countdown > 0) sound.beep();
    if (prev.phase === "countdown" && g.phase === "playing") sound.go();
    if (g.phase === "over" && prev.phase !== "over") sound.over();
    if (myRole === "kitchen") {
      const known = new Set(prev.tickets.map((t) => t.id));
      if (g.tickets.some((t) => t.kind === "food" && !known.has(t.id))) sound.order();
    }
  }
  const cooking = { grill: 0, boil: 0, fry: 0 };
  g.stoves.forEach((id, i) => {
    if (id === null) return;
    const part = g.tickets.find((t) => t.id === partTicket(id))?.parts?.[partIndex(id)];
    if (part?.st === "cooking") cooking[STOVES[i]!.kind]++;
  });
  sound.setScene({ ...cooking, seated: g.seats.filter((s) => s !== null).length });
}

function slip(t: TicketSnapshot, selected: boolean): string {
  return `<div class="slip ${selected ? "sel" : ""}"><span class="seat">${seatLabel(t.seat)}</span><span class="dot" style="background:${itemColor(t)}"></span><span class="nm">${itemName(t)}</span></div>`;
}

function renderSide(g: GameSnapshot) {
  const mine = g.tickets;
  if (myRole === "kitchen") return renderKitchenSide(g);
  const news = mine.filter((t) => t.kind === "drink" && t.status === "new");
  const slots = g.bars.map((id, i) => {
    const t = id === null ? undefined : mine.find((x) => x.id === id);
    const state = t ? `${seatLabel(t.seat)} ${itemName(t)} <em class="${t.status === "ready" ? "ready" : "busy"}">${t.status === "ready" ? "できた" : "作成中"}</em>` : `<span class="dim">空き</span>`;
    return `<div class="row"><span>バー${i + 1}</span><span>${state}</span></div>`;
  });
  const held = mine.filter((t) => t.status === "hall");
  let html = `<h3>ドリンクの注文 <span class="count">${news.length}</span><kbd>R</kbd></h3>`;
  html += news.slice(0, 7).map((t) => slip(t, t.id === g.selDrink)).join("");
  if (news.length > 7) html += `<div class="more">ほか ${news.length - 7} 件</div>`;
  html += `<h3 class="sub">ドリンクバー</h3>${slots.join("")}`;
  html += `<h3 class="sub">トレー <span class="count">${held.length}/${CONFIG.holdHall}</span></h3>`;
  html += held.length ? held.map((t) => `<div class="row"><span>${seatLabel(t.seat)}</span><span>${itemName(t)}</span></div>`).join("") : `<div class="dim">なし</div>`;
  html += `<div class="row foot"><span>受け渡し台の料理</span><span>${mine.filter((t) => t.status === "pass").length}</span></div>`;
  $("side").innerHTML = html;
}

function renderKitchenSide(g: GameSnapshot) {
  const orders = g.tickets.filter((t) => t.kind === "food" && t.status === "new").sort((a, b) => a.id - b.id);
  let html = `<h3>料理の注文 <span class="count">${orders.length}</span><kbd>R</kbd></h3>`;
  for (const t of orders.slice(0, 3)) {
    const chips = (t.parts ?? []).map((p) => `<span class="ing ${p.st}" title="${STATE_LABEL[p.st]}">${methodTag(p.ing)}${ingredientName(p.ing)}</span>`).join("");
    html += `<div class="slip order ${t.id === g.selFood ? "sel" : ""}"><div class="top"><span class="seat">${seatLabel(t.seat)}</span><span class="dot" style="background:${dishColorCss(t.item)}"></span><span class="nm">${dishName(t.item)}</span></div><div class="ings">${chips}</div></div>`;
  }
  if (orders.length > 3) html += `<div class="more">ほか ${orders.length - 3} 件</div>`;

  // 調理場: 調理法ごとの集計
  const methods: Method[] = ["grill", "boil", "fry"];
  html += `<h3 class="sub">調理場</h3>`;
  for (const m of methods) {
    const ids = STOVES.map((s, i) => (s.kind === m ? g.stoves[i] : undefined)).filter((x) => x !== undefined);
    const parts = ids.map((id) => (id === null ? undefined : g.tickets.find((x) => x.id === partTicket(id))?.parts?.[partIndex(id)]));
    const busy = parts.filter((p) => p?.st === "cooking").length;
    const ready = parts.filter((p) => p?.st === "ready").length;
    html += `<div class="row"><span>${METHOD_NAME[m]} <span class="dim">${ids.length}台</span></span><span>作成中 ${busy}${ready ? ` <em class="ready">できた ${ready}</em>` : ""} / 空き ${ids.length - busy - ready}</span></div>`;
  }
  const held = heldParts(g);
  html += `<h3 class="sub">手 <span class="count">${held.length}/${CONFIG.holdKitchen}</span></h3>`;
  html += held.length
    ? held.map((h) => `<div class="row"><span>${seatLabel(h.t.seat)} ${ingredientName(h.ing)}</span><span>${methodTag(h.ing)}<em class="${h.st === "cooked" ? "ready" : "busy"}">${h.st === "cooked" ? "調理済" : "生"}</em></span></div>`).join("")
    : `<div class="dim">なし</div>`;
  $("side").innerHTML = html;
}

function renderCenter(g: GameSnapshot) {
  const c = $("center");
  c.hidden = g.phase === "playing";
  if (g.phase === "waiting") c.innerHTML = `<div class="card"><div class="big">相手を待っています</div><p>もう1人が入って役割を選ぶと始まります</p></div>`;
  else if (g.phase === "countdown") c.innerHTML = `<div class="count-num" key="${g.countdown}">${g.countdown || "GO!"}</div>`;
  else if (g.phase === "over") {
    const reason = g.angry >= g.maxAngry ? "お客さんが怒って帰ってしまいました" : "閉店です";
    c.innerHTML = `<div class="card result"><div class="label">${reason}</div><div class="score"><small>さばいた数</small><b>${g.served}</b></div><button id="again">もう一度 <kbd>Enter</kbd></button></div>`;
    $("again").onclick = () => send({ t: "restart" });
  }
}

function promptText(): string {
  if (!game || game.phase !== "playing" || !myRole) return "";
  const target = nearestTarget(myRole, me.x, me.z);
  if (!target) return "";
  const tickets = game.tickets;
  if (target.kind === "seat") {
    const s = game.seats[target.i];
    if (!s) return "";
    if (s.s === "waitOrder") return `E|${seatLabel(target.i)}の注文を取る`;
    const held = tickets.filter((x) => x.seat === target.i && x.status === "hall");
    if (held.length > 0) return `E|${held.map(itemName).join("・")}を出す`;
    return s.s === "waitFood" ? "|料理もドリンクも持っていません" : "|食事中";
  }
  if (target.kind === "bar") {
    const id = game.bars[target.i];
    const t = id === null || id === undefined ? undefined : tickets.find((x) => x.id === id);
    if (t) return t.status === "ready" ? `E|${itemName(t)}を取る` : "|作成中";
    const sel = tickets.find((x) => x.id === game!.selDrink);
    return sel ? `E|${seatLabel(sel.seat)}の${itemName(sel)}を作る` : "|注文がありません";
  }
  if (target.kind === "fridge") {
    const held = heldParts(game).length;
    if (held >= CONFIG.holdKitchen) return "|手がいっぱいです";
    const orders = tickets.filter((t) => t.kind === "food" && t.status === "new" && (t.parts ?? []).some((p) => p.st === "need")).sort((a, b) => a.id - b.id);
    const t = orders.find((x) => x.id === game!.selFood) ?? orders[0];
    return t ? `E|${seatLabel(t.seat)} ${dishName(t.item)}の食材を取る` : "|取る食材がありません";
  }
  if (target.kind === "stove") {
    const station = STOVES[target.i]!;
    const id = game.stoves[target.i];
    const part = id === null || id === undefined ? undefined : tickets.find((x) => x.id === partTicket(id))?.parts?.[partIndex(id)];
    if (part) return part.st === "ready" ? `E|${ingredientName(part.ing)}を取る` : `|${METHOD_NAME[station.kind]}の最中`;
    const raws = heldParts(game).filter((h) => h.st === "raw");
    const fit = raws.find((h) => methodOfIngredient(h.ing) === station.kind);
    if (fit) return `E|${ingredientName(fit.ing)}を${METHOD_NAME[station.kind]}で作る`;
    return raws.length ? `|${METHOD_NAME[station.kind]}で作れる食材がありません` : "|食材を持っていません";
  }
  if (myRole === "hall") return tickets.some((t) => t.status === "pass") ? "E|受け渡し台から料理を取る" : "";
  return heldParts(game).some((h) => h.st === "cooked") ? "E|調理した食材を盛り付ける" : "";
}

let lastPrompt = "";
function showPrompt() {
  const text = promptText();
  if (text === lastPrompt) return;
  lastPrompt = text;
  const el = $("prompt");
  if (!text) return el.replaceChildren();
  const [key, label] = text.split("|") as [string, string];
  el.innerHTML = `${key ? `<kbd>${key}</kbd>` : ""}<span>${label}</span>`;
}

// ---- 操作 ----
const keys = new Set<string>();
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "KeyE") {
    if (myRole === "kitchen" && nearestTarget("kitchen", me.x, me.z)?.kind === "fridge") {
      kitchen.openFridge();
      view.effects.fridgeFog();
      sound.fridge();
    }
    send({ t: "act" });
  }
  else if (e.code === "KeyR") send({ t: "next" });
  else if (e.code === "KeyM") {
    sound.toggle();
    renderHud();
  }
  else if (e.code === "Enter" && game?.phase === "over") send({ t: "restart" });
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
// 視点の操作。画面をクリックするとマウスだけで見回せる(ポインターロック)。
// ロックできない環境(埋め込み画面など)でも、ドラッグか矢印キーで向きを変えられる
let dragging = false;
renderer.domElement.addEventListener("click", () => {
  if (!myRole) return;
  try {
    void Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => {});
  } catch {
    // ロックできない環境
  }
});
renderer.domElement.addEventListener("mousedown", () => (dragging = true));
addEventListener("mouseup", () => (dragging = false));
addEventListener("mousemove", (e) => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (!locked && !dragging) return;
  const k = locked ? 0.0022 : 0.004;
  me.yaw -= e.movementX * k;
  me.pitch = Math.max(-1.3, Math.min(1.3, me.pitch - e.movementY * k));
});

function axes() {
  const k = (c: string) => (keys.has(c) ? 1 : 0);
  return { mx: k("KeyD") - k("KeyA"), mz: k("KeyW") - k("KeyS") };
}

// 入力は 20Hz で送る。止まっているときも送って、サーバー側の時刻を進める
setInterval(() => {
  if (!myRole) return;
  const { mx, mz } = axes();
  send({ t: "input", mx, mz, yaw: me.yaw });
}, 50);

// ---- 描画 ----
let prev = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  if (myRole) {
    const { mx, mz } = axes();
    const key = (c: string) => (keys.has(c) ? 1 : 0);
    me.yaw += (key("ArrowLeft") - key("ArrowRight")) * dt * 2.2;
    me.pitch = Math.max(-1.3, Math.min(1.3, me.pitch + (key("ArrowUp") - key("ArrowDown")) * dt * 1.5));
    const before = { x: me.x, z: me.z };
    Object.assign(me, step(me, myRole, mx, mz, me.yaw, dt));
    const moved = Math.hypot(me.x - before.x, me.z - before.z);
    speed = moved / Math.max(dt, 1e-3);
    stepDist += moved;
    if (stepDist > 0.85) {
      stepDist = 0;
      sound.step(myRole === "kitchen" ? "tile" : "wood");
    }
    showPrompt();
  }
  for (const a of avatars.values()) {
    const g = a.person.group;
    const k = Math.min(1, dt * 12);
    g.position.x += (a.tx - g.position.x) * k;
    g.position.z += (a.tz - g.position.z) * k;
    g.rotation.y = a.yaw + Math.PI;
    animateWalk(a.person, now / 1000, a.speed);
  }
  camera.position.set(me.x, EYE, me.z);
  camera.rotation.set(me.pitch, me.yaw, 0);
  camera.updateMatrixWorld();
  kitchen.update(dt);
  view.tick(dt, now / 1000);
  hands.update(camera, now / 1000, speed);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(hands.scene, camera);
});

// ---- ロビー ----
const randomCode = () => Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
$("create").onclick = () => connect(randomCode(), true);
$("join").onclick = () => connect(($<HTMLInputElement>("code")).value.trim().toUpperCase(), false);
$("hall").onclick = () => send({ t: "role", role: "hall" });
$("kitchen").onclick = () => send({ t: "role", role: "kitchen" });

// 見た目の確認用。URL に ?debug を付けると、サーバーなしで状態を流し込める(通常のプレイには影響しない)
if (new URLSearchParams(location.search).has("debug")) {
  Object.assign(window, {
    __debug: {
      vasesSwapped: () => tableVases.every((v) => !v.visible),
      play(role: Role, x: number, z: number, yaw: number, g: GameSnapshot) {
        myRole = role;
        hands.setRole(role);
        Object.assign(me, { x, z, yaw, pitch: 0 });
        $("ui").classList.add("hidden");
        for (const id of ["hud", "cross", "top", "side"]) $(id).hidden = false;
        onGame(g);
      },
    },
  });
}
