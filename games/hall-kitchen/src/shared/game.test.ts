import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, Game, spawnInterval } from "./game";
import { BARS, PASS, SEATS, STOVES } from "./layout";
import { DISHES, DRINKS } from "./menu";

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
const atSeat = (g: Game, i: number) => g.act("hall", SEATS[i]!.x, SEATS[i]!.z);
const atBar = (g: Game, i: number) => g.act("hall", BARS[i]!.x, BARS[i]!.z);
const atStove = (g: Game, i: number) => g.act("kitchen", STOVES[i]!.x, STOVES[i]!.z);
const hallPass = (g: Game) => g.act("hall", PASS.hall.x, PASS.hall.z);
const kitchenPass = (g: Game) => g.act("kitchen", PASS.kitchen.x, PASS.kitchen.z);
const tickets = (g: Game, kind: "food" | "drink") => g.snapshot().tickets.filter((t) => t.kind === kind);

/** 座って待っている人全員の注文を取る。取った席の数を返す */
function orderAll(g: Game): number {
  let n = 0;
  g.snapshot().seats.forEach((s, i) => {
    if (s?.s === "waitOrder") {
      atSeat(g, i);
      n++;
    }
  });
  return n;
}

/** 最初のお客さんが座って注文を取られるところまで進める */
function firstOrder(g: Game): number {
  run(g, 2);
  const seat = g.snapshot().seats.findIndex((s) => s?.s === "waitOrder");
  assert.ok(seat >= 0, "お客さんが座っている");
  atSeat(g, seat);
  return seat;
}

test("メニューは料理20種・ドリンク20種", () => {
  assert.equal(DISHES.length, 20);
  assert.equal(DRINKS.length, 20);
  assert.equal(new Set(DISHES.map((d) => d.name)).size, 20);
  assert.equal(new Set(DRINKS.map((d) => d.name)).size, 20);
  assert.ok(DRINKS.every((d) => d.make > 0 && d.relief > 0 && d.relief <= 1));
});

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
  assert.equal(g.snapshot().seats.filter((s) => s?.s === "waitOrder").length, 1);
});

test("注文を取ると、料理とドリンクの注文が1つずつできる", () => {
  const g = started();
  const seat = firstOrder(g);
  assert.equal(tickets(g, "food").length, 1);
  assert.equal(tickets(g, "drink").length, 1);
  assert.ok(g.snapshot().tickets.every((t) => t.seat === seat && t.status === "new"));
  assert.deepEqual(
    [g.snapshot().seats[seat]!.s, g.snapshot().seats[seat]!.d],
    ["waitFood", 1],
  );
});

test("料理: 調理 → 運ぶ → 出す → 食べて帰る、で1人さばける", () => {
  const g = started();
  const seat = firstOrder(g);
  const item = tickets(g, "food")[0]!.item;
  assert.match(atStove(g, 0), /調理開始/);
  assert.equal(atStove(g, 0), "調理中です");
  run(g, DISHES[item]!.cook + 0.5);
  assert.equal(tickets(g, "food")[0]!.status, "ready");
  assert.match(atStove(g, 0), /取った/);
  assert.match(kitchenPass(g), /台に置いた/);
  assert.match(hallPass(g), /取った/);
  assert.match(atSeat(g, seat), /出した/);
  assert.equal(tickets(g, "food").length, 0);
  run(g, CONFIG.eatTime + 0.5);
  assert.equal(g.served, 1);
  assert.equal(g.snapshot().seats[seat], null);
  assert.equal(tickets(g, "drink").length, 0, "帰ったら、出さなかったドリンクの注文も消える");
});

test("ドリンク: 作って出すと、我慢ゲージが戻る", () => {
  const g = started();
  const seat = firstOrder(g);
  run(g, 25);
  const before = g.snapshot().seats[seat]!.p;
  const drink = tickets(g, "drink")[0]!;
  assert.match(atBar(g, 0), /作り始めた/);
  assert.equal(atBar(g, 0), "作っています");
  run(g, DRINKS[drink.item]!.make + 0.5);
  assert.match(atBar(g, 0), /取った/);
  assert.match(atSeat(g, seat), /ゲージが戻った/);
  const after = g.snapshot().seats[seat]!;
  assert.ok(after.p > before, `${before} -> ${after.p}`);
  assert.equal(after.d, 2);
  assert.equal(tickets(g, "drink").length, 0);
});

test("ドリンクで戻っても、ゲージは満タンを超えない", () => {
  const g = started();
  const seat = firstOrder(g);
  // 注文した直後(満タン)に出しても 1 を超えない
  atBar(g, 0);
  run(g, 3.2);
  atBar(g, 0);
  atSeat(g, seat);
  assert.ok(g.snapshot().seats[seat]!.p <= 1);
});

test("料理とドリンクを一緒に持っていけば、1回で両方出せる", () => {
  const g = started();
  const seat = firstOrder(g);
  atStove(g, 0);
  atBar(g, 0);
  run(g, 12);
  atStove(g, 0);
  kitchenPass(g);
  atBar(g, 0);
  hallPass(g);
  const msg = atSeat(g, seat);
  assert.match(msg, /ゲージが戻った/);
  assert.equal(g.snapshot().seats[seat]!.s, "eating");
});

test("持っていない席では何も出せない", () => {
  const g = started();
  const seat = firstOrder(g);
  assert.equal(atSeat(g, seat), "その席の料理もドリンクも持っていません");
});

test("キッチンが持てる数には上限がある", () => {
  const g = started();
  for (let i = 0; i < 4; i++) {
    run(g, 6);
    orderAll(g);
  }
  assert.ok(tickets(g, "food").length >= 3, "注文が3つ以上");
  atStove(g, 0);
  atStove(g, 1);
  run(g, 11);
  atStove(g, 0);
  atStove(g, 1);
  assert.equal(g.snapshot().tickets.filter((t) => t.status === "kitchen").length, CONFIG.holdKitchen);
  atStove(g, 0); // 3つ目を調理
  run(g, 11);
  assert.equal(atStove(g, 0), "手がいっぱいです");
});

test("待たせすぎると怒って帰り、料理もドリンクの注文も消える", () => {
  const g = started();
  firstOrder(g);
  assert.equal(g.snapshot().tickets.length, 2);
  run(g, CONFIG.foodPatience + 1);
  assert.ok(g.angry >= 1);
  assert.equal(g.snapshot().tickets.length, 0);
});

test("時間いっぱいか、怒って帰った人が上限に達するとゲームオーバー", () => {
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

test("作る注文を切り替えられる(キッチンは料理、ホールはドリンク)", () => {
  const g = started();
  for (let i = 0; i < 3; i++) {
    run(g, 6);
    orderAll(g);
  }
  assert.ok(tickets(g, "food").length >= 2);
  const food = g.snapshot().selFood;
  g.cycle("kitchen");
  assert.notEqual(g.snapshot().selFood, food);
  const drink = g.snapshot().selDrink;
  g.cycle("hall");
  assert.notEqual(g.snapshot().selDrink, drink);
});

test("ゲーム中でないときの操作は無視される", () => {
  const g = new Game();
  assert.equal(g.act("hall", SEATS[0]!.x, SEATS[0]!.z), "");
});

test("遠いところでは何も起きない", () => {
  const g = started();
  firstOrder(g);
  assert.equal(g.act("kitchen", 0, -5), "");
  assert.equal(g.act("hall", 0, 8), "");
});
