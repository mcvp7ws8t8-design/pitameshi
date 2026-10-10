import { test } from "node:test";
import assert from "node:assert/strict";
import { Bot } from "./bots";
import { Game } from "./game";
import { RoomState } from "./room";

/** ボット2人に、ゲームを最後まで(または 15 人怒って帰るまで)やらせる */
function play(seed: number, seconds: number) {
  const g = new Game(seed);
  g.update(true);
  const room = new RoomState();
  room.join("h");
  room.join("k");
  room.setRole("h", "hall");
  room.setRole("k", "kitchen");
  const bots = { h: new Bot("hall"), k: new Bot("kitchen") };
  const acts = { h: 0, k: 0 };
  let now = 1000;
  const dt = 0.05;
  for (let t = 0; t < seconds && g.phase !== "over"; t += dt) {
    now += dt * 1000;
    g.tick(dt);
    const snap = g.snapshot();
    for (const [id, role] of [["h", "hall"], ["k", "kitchen"]] as const) {
      const p = room.players.get(id)!;
      const out = bots[id].update(snap, { x: p.x, z: p.z }, dt);
      room.input(id, out.mx, out.mz, out.yaw, now);
      if (out.act) {
        g.act(role, p.x, p.z);
        acts[id]++;
      }
    }
  }
  return { g, acts };
}

// ゲームは、完全にはさばけない量のお客さんが来るように作ってある。ボットは、15人が怒って帰るまでに、1人以上はさばく。
test("ボット: 2人で動くと、止まったり壁に引っかかり続けたりせずに、1人以上さばける", () => {
  for (const seed of [3, 11, 42]) {
    const { g, acts } = play(seed, 320);
    assert.ok(acts.h > 20 && acts.k > 20, `種 ${seed}: ホール ${acts.h}回・キッチン ${acts.k}回 E を押した`);
    assert.ok(g.served >= 1, `種 ${seed}: さばいた ${g.served}人`);
  }
});
