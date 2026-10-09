import * as THREE from "three";
import { ROOM_CODE, type ClientMessage, type ServerMessage } from "../shared/protocol";
import { type GameSnapshot } from "../shared/game";
import { dishName, drinkName } from "../shared/menu";
import { nearestTarget } from "../shared/layout";
import { step, type PlayerSnapshot, type Role } from "../shared/room";
import { buildAvatar, buildRestaurant } from "./scene";
import { GameView } from "./view";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ROLE_NAME: Record<Role, string> = { hall: "ホール", kitchen: "キッチン" };

const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.prepend(renderer.domElement);
const scene = buildRestaurant();
const view = new GameView(scene);
let game: GameSnapshot | null = null;
let infoTimer = 0;
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 100);
camera.rotation.order = "YXZ";
const EYE = 1.6;

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// ---- 通信 ----
let ws: WebSocket | null = null;
let myId = "";
let myRole: Role | null = null;
let players: PlayerSnapshot[] = [];
const me = { x: 0, z: 0, yaw: 0, pitch: 0 };
const avatars = new Map<string, THREE.Group>();

function send(msg: ClientMessage) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
function say(text: string) {
  $("msg").textContent = text;
}

function connect(code: string) {
  if (!ROOM_CODE.test(code)) return say("部屋コードは英字4文字です");
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws/${code}`);
  ws.onopen = () => {
    $("step1").hidden = true;
    $("step2").hidden = false;
    $("roomcode").textContent = code;
    say("役割を選んでください");
  };
  ws.onclose = () => {
    myRole = null;
    $("ui").classList.remove("hidden");
    for (const id of ["hud", "cross", "top", "side", "center"]) $(id).hidden = true;
    $("prompt").textContent = "";
    game = null;
    $("step1").hidden = false;
    $("step2").hidden = true;
    say("接続が切れました");
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data as string) as ServerMessage;
    if (msg.t === "welcome") myId = msg.id;
    else if (msg.t === "game") onGame(msg.g);
    else if (msg.t === "info") {
      $("info").textContent = msg.text;
      clearTimeout(infoTimer);
      infoTimer = window.setTimeout(() => ($("info").textContent = ""), 2500);
    } else if (msg.t === "error") {
      say({ full: "この部屋は満員です", "role-taken": "その役割は選ばれています", "bad-message": "通信エラー" }[msg.reason]);
    } else onState(msg.players);
  };
}

function onState(list: PlayerSnapshot[]) {
  players = list;
  const mine = list.find((p) => p.id === myId);
  if (mine?.role && myRole !== mine.role) {
    myRole = mine.role;
    Object.assign(me, { x: mine.x, z: mine.z, yaw: mine.yaw, pitch: 0 });
    $("ui").classList.add("hidden");
    $("hud").hidden = $("cross").hidden = $("top").hidden = $("side").hidden = false;
  } else if (mine?.role) {
    // 自分の位置は手元の予測を優先し、ずれが大きいときだけサーバーに合わせる
    const err = Math.hypot(mine.x - me.x, mine.z - me.z);
    if (err > 1) Object.assign(me, { x: mine.x, z: mine.z });
    else {
      me.x += (mine.x - me.x) * 0.1;
      me.z += (mine.z - me.z) * 0.1;
    }
  }
  // 相手のアバター
  const seen = new Set<string>();
  for (const p of list) {
    if (p.id === myId || !p.role) continue;
    seen.add(p.id);
    let a = avatars.get(p.id);
    if (!a) {
      a = buildAvatar(p.role === "hall" ? 0xd9534f : 0xffffff);
      avatars.set(p.id, a);
      scene.add(a);
    }
    a.position.set(p.x, 0, p.z);
    a.rotation.y = p.yaw;
  }
  for (const [id, a] of avatars) {
    if (!seen.has(id)) {
      scene.remove(a);
      avatars.delete(id);
    }
  }
  const other = list.find((p) => p.id !== myId);
  $("hud").textContent = myRole
    ? `あなた: ${ROLE_NAME[myRole]} / 相手: ${other ? (other.role ? ROLE_NAME[other.role] : "役割を選択中") : "待っています…"}`
    : "";
}

// ---- ゲームの表示 ----

function onGame(g: GameSnapshot) {
  const prevPhase = game?.phase;
  game = g;
  view.update(g);
  if (g.phase === "over" && prevPhase !== "over") document.exitPointerLock();
  $("top").textContent = "";
  const top = [`残り ${Math.floor(g.timeLeft / 60)}:${String(g.timeLeft % 60).padStart(2, "0")}`, `さばいた ${g.served}`, `怒って帰った ${g.angry}/${g.maxAngry}`, `行列 ${g.queue}人`];
  $("top").replaceChildren(...top.map((t) => Object.assign(document.createElement("span"), { textContent: t })));
  renderSide(g);
  renderCenter(g);
}

function renderSide(g: GameSnapshot) {
  const lines: string[] = [];
  const mine = g.tickets;
  const name = (t: GameSnapshot["tickets"][number]) => (t.kind === "food" ? dishName(t.item) : drinkName(t.item));
  const list = (kind: "food" | "drink", sel: number | null) => {
    const news = mine.filter((t) => t.kind === kind && t.status === "new");
    lines.push(`<b>${kind === "food" ? "料理" : "ドリンク"}の注文(${news.length})</b>  <span class="dim">[R]で切り替え</span>`);
    for (const t of news.slice(0, 8)) {
      lines.push(`<span class="${t.id === sel ? "sel" : ""}">${t.id === sel ? "▶ " : ""}席${t.seat + 1} ${name(t)}</span>`);
    }
    if (news.length > 8) lines.push(`<span class="dim">…ほか${news.length - 8}件</span>`);
  };
  const slot = (label: string, ids: (number | null)[]) =>
    ids.forEach((id, i) => {
      const t = id === null ? undefined : mine.find((x) => x.id === id);
      lines.push(`${label}${i + 1}: ${t ? `席${t.seat + 1} ${name(t)} ${t.status === "ready" ? "✔できた" : "作成中"}` : "空き"}`);
    });
  if (myRole === "kitchen") {
    list("food", g.selFood);
    slot("コンロ", g.stoves);
    const held = mine.filter((t) => t.status === "kitchen");
    lines.push(`持っている: ${held.map((t) => `席${t.seat + 1} ${name(t)}`).join("、") || "なし"}`);
  } else {
    list("drink", g.selDrink);
    slot("ドリンクバー", g.bars);
    const held = mine.filter((t) => t.status === "hall");
    lines.push(`<b>トレー(${held.length}/4)</b>`);
    for (const t of held) lines.push(`席${t.seat + 1} ${name(t)}`);
    lines.push(`受け渡し台の料理: ${mine.filter((t) => t.status === "pass").length}つ`);
  }
  $("side").innerHTML = lines.join("<br>");
}

function renderCenter(g: GameSnapshot) {
  const c = $("center");
  c.hidden = g.phase === "playing";
  if (g.phase === "waiting") c.textContent = "相手を待っています…";
  else if (g.phase === "countdown") c.textContent = String(g.countdown);
  else if (g.phase === "over") {
    const reason = g.angry >= g.maxAngry ? "お客さんが怒って帰りました" : "閉店です";
    const btn = Object.assign(document.createElement("button"), { textContent: "もう一度 (Enter)", onclick: () => send({ t: "restart" }) });
    c.replaceChildren(`${reason}`, `さばいた数: ${g.served}`, btn);
  }
}

function promptText(): string {
  if (!game || game.phase !== "playing" || !myRole) return "";
  const target = nearestTarget(myRole, me.x, me.z);
  if (!target) return "";
  const tickets = game.tickets;
  const name = (t: GameSnapshot["tickets"][number]) => (t.kind === "food" ? dishName(t.item) : drinkName(t.item));
  if (target.kind === "seat") {
    const s = game.seats[target.i];
    if (!s) return "";
    if (s.s === "waitOrder") return `[E] 席${target.i + 1}の注文を取る`;
    const held = tickets.filter((x) => x.seat === target.i && x.status === "hall");
    if (held.length > 0) return `[E] ${held.map(name).join("・")}を出す`;
    return s.s === "waitFood" ? "料理もドリンクも持っていません" : "食事中";
  }
  if (target.kind === "stove" || target.kind === "bar") {
    const isBar = target.kind === "bar";
    const id = (isBar ? game.bars : game.stoves)[target.i];
    const t = id === null || id === undefined ? undefined : tickets.find((x) => x.id === id);
    if (t) return t.status === "ready" ? `[E] ${name(t)}を取る` : "作成中";
    const sel = tickets.find((x) => x.id === (isBar ? game!.selDrink : game!.selFood));
    return sel ? `[E] 席${sel.seat + 1}の${name(sel)}を作る` : "注文がありません";
  }
  if (myRole === "hall") return tickets.some((t) => t.status === "pass") ? "[E] 受け渡し台から料理を取る" : "";
  return tickets.some((t) => t.status === "kitchen") ? "[E] 料理を受け渡し台に置く" : "";
}

// ---- 操作 ----
const keys = new Set<string>();
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "KeyE") send({ t: "act" });
  else if (e.code === "KeyR") send({ t: "next" });
  else if (e.code === "Enter" && game?.phase === "over") send({ t: "restart" });
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
renderer.domElement.addEventListener("click", () => {
  if (myRole) renderer.domElement.requestPointerLock();
});
addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  me.yaw -= e.movementX * 0.0022;
  me.pitch = Math.max(-1.3, Math.min(1.3, me.pitch - e.movementY * 0.0022));
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

// ---- 画面 ----
let prev = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  if (myRole) {
    const { mx, mz } = axes();
    Object.assign(me, step(me, myRole, mx, mz, me.yaw, dt));
  }
  if (myRole) $("prompt").textContent = promptText();
  camera.position.set(me.x, EYE, me.z);
  camera.rotation.set(me.pitch, me.yaw, 0);
  renderer.render(scene, camera);
});

// ---- 画面の部品 ----
const randomCode = () => Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
$("create").onclick = () => connect(randomCode());
$("join").onclick = () => connect(($<HTMLInputElement>("code")).value.trim().toUpperCase());
$("hall").onclick = () => send({ t: "role", role: "hall" });
$("kitchen").onclick = () => send({ t: "role", role: "kitchen" });
