import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, DISHES, Game, spawnInterval } from "./game";
import { PASS, SEATS, STOVES } from "./layout";

function started(seed = 1): Game {
  const g = new Game(seed);
  g.update(true);
  g.tick(CONFIG.countdown + 0.1);
  assert.equal(g.phase, "playing");
  return g;
}
const run = (g: Game, sec: number, dt = 0.2) => {
  for (let t = 0; t < sec; t += dt) g.tick(dt);
};
const atSeat = (g: Game, role: "hall", i: number) => g.act(role, SEATS[i]!.x, SEATS[i]!.z);
const atStove = (g: Game, i: number) => g.act("kitchen", STOVES[i]!.x, STOVES[i]!.z);
const hallPass = (g: Game) => g.act("hall", PASS.hall.x, PASS.hall.z);
const kitchenPass = (g: Game) => g.act("kitchen", PASS.kitchen.x, PASS.kitchen.z);

/** 最初のお客さんが座って注文を取られるところまで進める */
function firstOrder(g: Game): number {
  run(g, 2);
  const seat = g.snapshot().seats.findIndex((s) => s?.s === "waitOrder");
  assert.ok(seat >= 0, "お客さんが座っている");
  atSeat(g, "hall", seat);
  return seat;
}

test("2人そろうとカウントダウンが始まり、抜けると最初に戻る", () => {
  const g = new Game();
  g.update(false);
  assert.equal(g.phase, "waiting");
  g.update(true);
  assert.equal(g.phase, "countdown");
  g.update(false);
  assert.equal(g.phase, "waiting");
});

test("来店の間隔はだんだん短くなる", () => {
  assert.equal(spawnInterval(0), CONFIG.spawnStart);
  assert.equal(spawnInterval(CONFIG.duration), CONFIG.spawnEnd);
  assert.ok(spawnInterval(150) < spawnInterval(10));
});

test("お客さんが来て、空き席に座る", () => {
  const g = started();
  run(g, 2);
  const snap = g.snapshot();
  assert.equal(snap.seats.filter((s) => s?.s === "waitOrder").length, 1);
});

test("注文を取ると、調理待ちの注文ができる", () => {
  const g = started();
  const seat = firstOrder(g);
  const t = g.snapshot().tickets;
  assert.equal(t.length, 1);
  assert.equal(t[0]!.seat, seat);
  assert.equal(t[0]!.status, "new");
  assert.equal(g.snapshot().seats[seat]!.s, "waitFood");
});

test("注文 → 調理 → 運ぶ → 出す → 食べて帰る、で1人さばける", () => {
  const g = started();
  const seat = firstOrder(g);
  const dish = g.snapshot().tickets[0]!.dish;
  assert.match(atStove(g, 0), /調理開始/);
  assert.equal(atStove(g, 0), "調理中です");
  run(g, DISHES[dish].cook + 0.5);
  assert.equal(g.snapshot().tickets[0]!.status, "ready");
  assert.match(atStove(g, 0), /取った/);
  assert.match(kitchenPass(g), /台に置いた/);
  assert.match(hallPass(g), /取った/);
  assert.match(atSeat(g, "hall", seat), /出した/);
  assert.equal(g.snapshot().tickets.length, 0);
  run(g, CONFIG.eatTime + 0.5);
  assert.equal(g.served, 1);
  assert.equal(g.snapshot().seats[seat], null);
});

test("違う席には料理を出せない", () => {
  const g = started();
  firstOrder(g);
  run(g, 8);
  const other = g.snapshot().seats.findIndex((s) => s?.s === "waitOrder");
  assert.ok(other >= 0);
  atSeat(g, "hall", other);
  atStove(g, 0);
  run(g, 8);
  atStove(g, 0);
  kitchenPass(g);
  hallPass(g);
  const mine = g.snapshot().tickets.find((t) => t.status === "hall")!;
  const wrong = g.snapshot().tickets.find((t) => t.seat !== mine.seat)!;
  assert.equal(atSeat(g, "hall", wrong.seat), "その料理を持っていません");
});

test("運べる数には上限がある", () => {
  const g = started();
  g.act("kitchen", STOVES[0]!.x, STOVES[0]!.z);
  // 注文を3つ作ってコンロ2台で焼き、キッチンが持てるのは2つまで
  run(g, 14);
  for (let i = 0; i < 4; i++) {
    const seat = g.snapshot().seats.findIndex((s) => s?.s === "waitOrder");
    if (seat >= 0) atSeat(g, "hall", seat);
    run(g, 0.4);
  }
  atStove(g, 0);
  atStove(g, 1);
  run(g, 8);
  atStove(g, 0);
  atStove(g, 1);
  const held = g.snapshot().tickets.filter((t) => t.status === "kitchen").length;
  assert.ok(held <= CONFIG.holdKitchen);
});

test("待たせすぎると怒って帰り、注文も消える", () => {
  const g = started();
  firstOrder(g);
  assert.equal(g.snapshot().tickets.length, 1);
  run(g, CONFIG.foodPatience + 1);
  assert.ok(g.angry >= 1);
  assert.equal(g.snapshot().tickets.length, 0);
});

test("怒って帰った人が上限に達するとゲームオーバー", () => {
  const g = started();
  run(g, CONFIG.duration);
  assert.equal(g.phase, "over");
  assert.ok(g.angry >= CONFIG.maxAngry || g.clock >= CONFIG.duration);
});

test("席が空かないと、行列で待ちきれず怒って帰る", () => {
  const g = new Game(1, 0); // 席が0なので全員が行列に並ぶ
  g.update(true);
  g.tick(CONFIG.countdown + 0.1);
  run(g, CONFIG.queuePatience + 10);
  assert.ok(g.angry >= 1);
  assert.ok(g.snapshot().queue >= 1);
});

test("もう一度遊べる", () => {
  const g = started();
  run(g, CONFIG.duration);
  assert.equal(g.phase, "over");
  g.restart(true);
  assert.equal(g.phase, "countdown");
  assert.equal(g.served, 0);
  assert.equal(g.angry, 0);
});

test("調理する注文を切り替えられる", () => {
  const g = started();
  run(g, 4);
  for (let i = 0; i < 3; i++) {
    const seat = g.snapshot().seats.findIndex((s) => s?.s === "waitOrder");
    if (seat >= 0) atSeat(g, "hall", seat);
    run(g, 6);
  }
  const ids = g.snapshot().tickets.filter((t) => t.status === "new").map((t) => t.id);
  assert.ok(ids.length >= 2, `注文が2つ以上: ${ids.length}`);
  const first = g.snapshot().selected;
  g.cycle();
  assert.notEqual(g.snapshot().selected, first);
});

test("ゲーム中でないときの操作は無視される", () => {
  const g = new Game();
  assert.equal(g.act("hall", SEATS[0]!.x, SEATS[0]!.z), "");
});

test("遠いところでは何も起きない", () => {
  const g = started();
  firstOrder(g);
  assert.equal(g.act("kitchen", 0, -5), "");
});
