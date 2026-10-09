import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, Game, nextFor, spawnInterval } from "./game";
import { BARS, PASS, SEATS, STOVES, TABLES, seatLabel } from "./layout";
import { DISHES, DRINKS, methodOf, type Method } from "./menu";

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
/** その調理法の、空いている調理場の番号 */
const freeStation = (g: Game, m: Method) => STOVES.findIndex((s, i) => s.kind === m && g.stoves[i] === null);

/** 座って待っている人全員の注文を取る。取った人数を返す */
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

/** 最初のお客さん1人が座って、注文を取られるところまで進める。その席を返す */
function firstOrder(g: Game): number {
  run(g, 2);
  const seat = g.snapshot().seats.findIndex((s) => s?.s === "waitOrder");
  assert.ok(seat >= 0, "お客さんが座っている");
  atSeat(g, seat);
  return seat;
}

/** 注文された料理を、合う調理場で作り始める */
function cook(g: Game, ticketId: number): number {
  const t = g.snapshot().tickets.find((x) => x.id === ticketId)!;
  const i = freeStation(g, methodOf(t.item));
  g.selFood = ticketId;
  assert.match(atStove(g, i), /始めた/);
  return i;
}

test("メニューは料理20種・ドリンク20種。料理は焼く8・茹でる7・揚げる5", () => {
  assert.equal(DISHES.length, 20);
  assert.equal(DRINKS.length, 20);
  assert.equal(new Set(DISHES.map((d) => d.name)).size, 20);
  assert.equal(new Set(DRINKS.map((d) => d.name)).size, 20);
  assert.ok(DRINKS.every((d) => d.make > 0 && d.relief > 0 && d.relief <= 1));
  const count = (m: Method) => DISHES.filter((d) => d.method === m).length;
  assert.deepEqual([count("grill"), count("boil"), count("fry")], [8, 7, 5]);
});

test("調理場は焼く5・茹でる4・揚げる2。席は2名掛け8卓・4名掛け4卓", () => {
  const n = (m: Method) => STOVES.filter((s) => s.kind === m).length;
  assert.deepEqual([n("grill"), n("boil"), n("fry")], [5, 4, 2]);
  assert.equal(TABLES.filter((t) => t.seats === 2).length, 8);
  assert.equal(TABLES.filter((t) => t.seats === 4).length, 4);
  assert.equal(SEATS.length, 8 * 2 + 4 * 4);
  assert.equal(seatLabel(0), "1A");
  assert.equal(seatLabel(SEATS.length - 1), "12B");
});

test("椅子や調理場は、同じ位置に重ならない", () => {
  const near = (a: { x: number; z: number }[], d: number) =>
    a.every((p, i) => a.every((q, j) => i === j || Math.hypot(p.x - q.x, p.z - q.z) >= d));
  assert.ok(near(SEATS, 0.7));
  assert.ok(near(STOVES, 1.4));
  assert.ok(near(TABLES, 1.5));
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
  assert.ok(Math.abs(spawnInterval(CONFIG.duration) - CONFIG.spawnEnd) < 1e-9);
  assert.ok(spawnInterval(150) < spawnInterval(10));
});

test("グループは、人数が入る一番小さい卓に、全員そろって座る", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = started(seed);
    for (let step = 0; step < 300; step++) {
      g.tick(0.2);
      const byTable = new Map<number, typeof g.customers>();
      for (const c of g.customers.filter((x) => x.seat >= 0)) {
        const t = SEATS[c.seat]!.table;
        byTable.set(t, [...(byTable.get(t) ?? []), c]);
      }
      for (const [t, list] of byTable) {
        assert.equal(new Set(list.map((c) => c.party)).size, 1, "1つの卓には1グループだけ");
        assert.equal(new Set(list.map((c) => c.seat)).size, list.length, "同じ椅子に2人座らない");
        assert.ok(list.length <= TABLES[t]!.seats);
        if (list.length > 2) assert.equal(TABLES[t]!.seats, 4, "3人以上は4名掛け");
      }
    }
  }
});

test("1〜2人のグループは、4名掛けより2名掛けを先に使う", () => {
  const g = started(1);
  run(g, 1.5);
  const seated = g.customers.filter((c) => c.seat >= 0);
  assert.ok(seated.length >= 1);
  const size = seated.length;
  const table = TABLES[SEATS[seated[0]!.seat]!.table]!;
  if (size <= 2) assert.equal(table.seats, 2);
});

test("注文を取ると、その人の料理とドリンクの注文が1つずつできる", () => {
  const g = started();
  const seat = firstOrder(g);
  assert.equal(tickets(g, "food").length, 1);
  assert.equal(tickets(g, "drink").length, 1);
  assert.ok(g.snapshot().tickets.every((t) => t.seat === seat && t.status === "new"));
  assert.deepEqual([g.snapshot().seats[seat]!.s, g.snapshot().seats[seat]!.d], ["waitFood", 1]);
});

test("料理: 合う調理場で作る → 運ぶ → 出す → 食べて帰る、で1人さばける", () => {
  const g = started();
  const seat = firstOrder(g);
  const t = tickets(g, "food")[0]!;
  const station = cook(g, t.id);
  assert.match(atStove(g, station), /最中です/);
  run(g, DISHES[t.item]!.cook + 0.5);
  assert.equal(tickets(g, "food")[0]!.status, "ready");
  assert.match(atStove(g, station), /取った/);
  assert.match(kitchenPass(g), /台に置いた/);
  assert.match(hallPass(g), /取った/);
  assert.match(atSeat(g, seat), /出した/);
  assert.equal(tickets(g, "food").length, 0);
  run(g, CONFIG.eatTime + 0.5);
  assert.equal(g.served, 1);
  assert.equal(g.snapshot().seats[seat], null);
  assert.equal(tickets(g, "drink").length, 0, "帰ったら、出さなかったドリンクの注文も消える");
});

test("違う調理法の調理場では作れない", () => {
  const g = started();
  firstOrder(g);
  const t = tickets(g, "food")[0]!;
  const wrong = STOVES.findIndex((s) => s.kind !== methodOf(t.item));
  assert.match(atStove(g, wrong), /作る注文がありません/);
  assert.equal(tickets(g, "food")[0]!.status, "new");
});

test("nextFor: 選んだ注文が合えばそれ、合わなければ一番古い合う注文", () => {
  const mk = (id: number, item: number) => ({ id, kind: "food" as const, item, status: "new" as const });
  const grillA = DISHES.findIndex((d) => d.method === "grill");
  const grills = DISHES.map((d, i) => (d.method === "grill" ? i : -1)).filter((i) => i >= 0);
  const grillB = grills[grills.length - 1]!;
  const fry = DISHES.findIndex((d) => d.method === "fry");
  const list = [mk(1, fry), mk(2, grillA), mk(3, grillB)];
  assert.equal(nextFor(list, 3, "grill")?.id, 3);
  assert.equal(nextFor(list, 1, "grill")?.id, 2);
  assert.equal(nextFor(list, null, "fry")?.id, 1);
  assert.equal(nextFor(list, null, "boil"), undefined);
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
  atBar(g, 0);
  run(g, 3.2);
  atBar(g, 0);
  atSeat(g, seat);
  assert.ok(g.snapshot().seats[seat]!.p <= 1);
});

test("料理とドリンクを一緒に持っていけば、1回で両方出せる", () => {
  const g = started();
  const seat = firstOrder(g);
  const station = cook(g, tickets(g, "food")[0]!.id);
  atBar(g, 0);
  run(g, 12);
  atStove(g, station);
  kitchenPass(g);
  atBar(g, 0);
  hallPass(g);
  assert.match(atSeat(g, seat), /ゲージが戻った/);
  assert.equal(g.snapshot().seats[seat]!.s, "eating");
});

test("持っていない席では何も出せない", () => {
  const g = started();
  const seat = firstOrder(g);
  assert.equal(atSeat(g, seat), "その席の料理もドリンクも持っていません");
});

test("キッチンが持てる数には上限がある", () => {
  const g = started();
  for (let i = 0; i < 6; i++) {
    run(g, 6);
    orderAll(g);
  }
  // 合う調理場すべてで、手当たり次第に作り始める
  STOVES.forEach((_, i) => atStove(g, i));
  run(g, 11);
  const ready = STOVES.map((_, i) => i).filter((i) => g.stoves[i] !== null);
  assert.ok(ready.length >= 3, `できあがり ${ready.length}`);
  atStove(g, ready[0]!);
  atStove(g, ready[1]!);
  assert.equal(g.snapshot().tickets.filter((t) => t.status === "kitchen").length, CONFIG.holdKitchen);
  assert.equal(atStove(g, ready[2]!), "手がいっぱいです");
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
  const g = new Game(1, 0); // 使える椅子が0なので全員が行列に並ぶ
  g.update(true);
  g.tick(CONFIG.countdown + 0.1);
  run(g, CONFIG.queuePatience + 15);
  assert.ok(g.angry >= 1);
  assert.ok(g.snapshot().queue >= 1);
});

test("入口の行列は上限を超えない", () => {
  const g = new Game(1, 0);
  g.update(true);
  g.tick(CONFIG.countdown + 0.1);
  run(g, CONFIG.queuePatience * 0.9, 0.5);
  assert.ok(g.snapshot().queue <= CONFIG.queueMax);
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
    run(g, 8);
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
  assert.equal(g.act("hall", 9, 9), "");
});
