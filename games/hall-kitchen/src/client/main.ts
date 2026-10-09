import * as THREE from "three";
import { ROOM_CODE, type ClientMessage, type ServerMessage } from "../shared/protocol";
import { step, type PlayerSnapshot, type Role } from "../shared/room";
import { buildAvatar, buildRestaurant } from "./scene";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ROLE_NAME: Record<Role, string> = { hall: "ホール", kitchen: "キッチン" };

const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.prepend(renderer.domElement);
const scene = buildRestaurant();
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
    $("hud").hidden = $("cross").hidden = true;
    $("step1").hidden = false;
    $("step2").hidden = true;
    say("接続が切れました");
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data as string) as ServerMessage;
    if (msg.t === "welcome") myId = msg.id;
    else if (msg.t === "error") {
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
    $("hud").hidden = $("cross").hidden = false;
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

// ---- 操作 ----
const keys = new Set<string>();
addEventListener("keydown", (e) => keys.add(e.code));
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
