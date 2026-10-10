// ボットのプレイを眺める通信。サーバーのかわりに、この画面の中で、ゲームとボット2人を動かす。
// 見る人は、ホールかキッチンのボットの目線になる(Tab で切り替え、F で早送り)。

import type { ClientMessage, ServerMessage } from "../shared/protocol";
import { Bot } from "../shared/bots";
import { Game } from "../shared/game";
import { RoomState, type Role } from "../shared/room";
import type { NetFactory } from "./app";

const ID: Record<Role, string> = { hall: "bot-hall", kitchen: "bot-kitchen" };
const STEP = 0.05; // 1回に進める時間(秒)
const SPEEDS = [1, 3, 8];

export const botNet: NetFactory = (_code, _create, h) => {
  let game = new Game(Math.floor(Math.random() * 1e6));
  const room = new RoomState();
  let bots: Record<Role, Bot>;
  let watching: Role = "hall";
  let speed = 0;
  let now = 1000;
  let timer = 0;
  const emit = (m: ServerMessage) => h.message(m);

  function reset() {
    game = new Game(Math.floor(Math.random() * 1e6));
    room.players.clear();
    for (const role of ["hall", "kitchen"] as const) {
      room.join(ID[role]);
      room.setRole(ID[role], role);
    }
    bots = { hall: new Bot("hall"), kitchen: new Bot("kitchen") };
    game.update(true);
  }

  function advance(dt: number) {
    now += dt * 1000;
    game.tick(dt);
    const snap = game.snapshot();
    for (const role of ["hall", "kitchen"] as const) {
      const p = room.players.get(ID[role])!;
      const out = bots[role].update(snap, { x: p.x, z: p.z }, dt);
      room.input(ID[role], out.mx, out.mz, out.yaw, now);
      if (out.act) {
        const text = game.act(role, p.x, p.z);
        if (text && role === watching) emit({ t: "info", text });
      }
    }
  }

  function welcome() {
    emit({ t: "welcome", id: ID[watching], spectate: true });
    emit({ t: "state", players: room.snapshot() });
  }

  reset();
  setTimeout(() => {
    h.open();
    welcome();
    emit({ t: "game", g: game.snapshot() });
  }, 0);
  timer = window.setInterval(() => {
    const n = Math.max(1, SPEEDS[speed]!);
    for (let k = 0; k < n; k++) advance(STEP);
    emit({ t: "state", players: room.snapshot() });
    emit({ t: "game", g: game.snapshot() });
  }, STEP * 1000);

  return {
    send(msg: ClientMessage) {
      if (msg.t === "watch") {
        if (msg.cmd === "swap") {
          watching = watching === "hall" ? "kitchen" : "hall";
          welcome();
        } else {
          speed = (speed + 1) % SPEEDS.length;
          emit({ t: "info", text: `早送り ×${SPEEDS[speed]}` });
        }
      } else if (msg.t === "restart" && game.phase === "over") {
        reset();
        welcome();
      }
    },
    close() {
      clearInterval(timer);
    },
  };
};
