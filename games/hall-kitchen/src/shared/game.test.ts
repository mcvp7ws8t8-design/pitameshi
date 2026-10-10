import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIG, Game, partIndex, partTicket, spawnInterval } from "./game";
import { BARS, FRIDGE, PASS, SEATS, STOVES, TABLES, seatLabel } from "./layout";
import { DISHES, DRINKS, INGREDIENTS, methodOfIngredient, type Method } from "./menu";

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
const atFridge = (g: Game) => g.act("kitchen", FRIDGE.x, FRIDGE.z);
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

/**
 * 注文された料理を、冷蔵庫から食材を取り、合う調理場で調理し、盛り付け台に置くところまでやる。
 * 手が空いている前提。食材が手に持てる数に収まる料理(3つまで)を対象にする。
 */
function makeDishFor(g: Game, ticketId: number): void {
  g.selFood = ticketId;
  assert.match(atFridge(g), /取った/);
  const t = g.snapshot().tickets.find((x) => x.id === ticketId)!;
  const stations: number[] = [];
  for (const part of t.parts!) {
    const i = freeStation(g, methodOfIngredient(part.ing));
    assert.ok(i >= 0, "空いている調理場がある");
    assert.match(atStove(g, i), /始めた/);
    stations.push(i);
  }
  run(g, 8);
  for (const i of stations) assert.match(atStove(g, i), /取った/);
  assert.match(kitchenPass(g), /完成/);
}

test("メニューは料理20種・ドリンク20種・食材40種", () => {
  assert.equal(DISHES.length, 20);
  assert.equal(DRINKS.length, 20);
  assert.equal(INGREDIENTS.length, 40);
  assert.equal(new Set(DISHES.map((d) => d.name)).size, 20);
  assert.equal(new Set(DRINKS.map((d) => d.name)).size, 20);
  assert.equal(new Set(INGREDIENTS.map((d) => d.name)).size, 40);
  assert.ok(DRINKS.every((d) => d.make > 0 && d.relief > 0 && d.relief <= 1));
  assert.ok(INGREDIENTS.every((d) => d.cook > 0));
});

test("食材は焼く15・茹でる15・揚げる10", () => {
  const count = (m: Method) => INGREDIENTS.filter((d) => d.method === m).length;
  assert.deepEqual([count("grill"), count("boil"), count("fry")], [15, 15, 10]);
});

test("料理は食材が1〜3個で、同じ食材を2回使わず、どの食材もどれかの料理で使う", () => {
  for (const d of DISHES) {
    assert.ok(d.parts.length >= 1 && d.parts.length <= 3, d.name);
    assert.equal(new Set(d.parts).size, d.parts.length, d.name);
  }
  const used = new Set(DISHES.flatMap((d) => d.parts));
  const unused = INGREDIENTS.filter((_, i) => !used.has(i)).map((x) => x.name);
  assert.deepEqual(unused, []);
});

test("食材の番号と調理場の番号の組み合わせは、1回ずつ区別できる", () => {
  assert.equal(partTicket(37 * 8 + 2), 37);
  assert.equal(partIndex(37 * 8 + 2), 2);
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

test("冷蔵庫: 注文の食材を取る", () => {
  const g = started();
  firstOrder(g);
  const t = tickets(g, "food")[0]!;
  assert.ok(t.parts!.every((p) => p.st === "need"));
  assert.match(atFridge(g), /取った/);
  assert.ok(g.snapshot().tickets.find((x) => x.id === t.id)!.parts!.every((p) => p.st === "raw"));
  assert.equal(atFridge(g), "取る食材がありません");
});

test("冷蔵庫: 手に持てるのは4つまで。入りきらない分は取らない", () => {
  const g = started();
  for (let i = 0; i < 3; i++) {
    run(g, 8);
    orderAll(g);
  }
  const raw = () => g.snapshot().tickets.flatMap((x) => x.parts ?? []).filter((p) => p.st === "raw").length;
  for (let i = 0; i < 6; i++) atFridge(g);
  assert.equal(raw(), CONFIG.holdKitchen);
});

test("冷蔵庫: 手がいっぱいなら取れない", () => {
  const g = started();
  for (let i = 0; i < 4; i++) {
    run(g, 8);
    orderAll(g);
  }
  for (let i = 0; i < 10; i++) atFridge(g);
  assert.equal(atFridge(g), "手がいっぱいです");
});

test("調理場: 合う調理法の食材だけ入れられる", () => {
  const g = started();
  firstOrder(g);
  const t = tickets(g, "food")[0]!;
  atFridge(g);
  const first = t.parts![0]!.ing;
  const wrong = STOVES.findIndex((s) => s.kind !== methodOfIngredient(first));
  // 持っている食材に、その調理場で作れるものがなければ作れない
  const methods = new Set(t.parts!.map((p) => methodOfIngredient(p.ing)));
  const none = STOVES.findIndex((s) => !methods.has(s.kind));
  if (none >= 0) assert.match(atStove(g, none), /作れる食材がありません/);
  void wrong;
  const ok = freeStation(g, methodOfIngredient(first));
  assert.match(atStove(g, ok), /始めた/);
  assert.match(atStove(g, ok), /最中です/);
});

test("調理場: 食材を持っていないと何もできない", () => {
  const g = started();
  firstOrder(g);
  assert.equal(atStove(g, 0), "調理する食材を持っていません");
});

test("料理: 冷蔵庫 → 調理 → 盛り付け → 運ぶ → 出す → 食べて帰る、で1人さばける", () => {
  const g = started();
  const seat = firstOrder(g);
  const t = tickets(g, "food")[0]!;
  makeDishFor(g, t.id);
  assert.equal(tickets(g, "food")[0]!.status, "pass");
  assert.match(hallPass(g), /取った/);
  assert.match(atSeat(g, seat), /出した/);
  assert.equal(tickets(g, "food").length, 0);
  run(g, CONFIG.eatTime + 0.5);
  assert.equal(g.served, 1);
  assert.equal(g.snapshot().seats[seat], null);
  assert.equal(tickets(g, "drink").length, 0, "帰ったら、出さなかったドリンクの注文も消える");
});

test("盛り付け: 食材が全部そろうまで完成しない", () => {
  const g = started();
  firstOrder(g);
  const t = tickets(g, "food")[0]!;
  atFridge(g);
  // 1つだけ調理して盛り付ける
  const part = t.parts![0]!;
  const i = freeStation(g, methodOfIngredient(part.ing));
  atStove(g, i);
  run(g, 8);
  atStove(g, i);
  const msg = kitchenPass(g);
  if (t.parts!.length > 1) {
    assert.match(msg, /あと\d+つ/);
    assert.equal(tickets(g, "food")[0]!.status, "new");
  }
});

test("盛り付ける食材がなければ何も置けない", () => {
  const g = started();
  assert.equal(kitchenPass(g), "盛り付ける食材を持っていません");
});

test("お客さんが怒って帰ると、食材も調理中のものも消える", () => {
  const g = started();
  firstOrder(g);
  atFridge(g);
  const t = tickets(g, "food")[0]!;
  atStove(g, freeStation(g, methodOfIngredient(t.parts![0]!.ing)));
  assert.ok(g.stoves.some((x) => x !== null));
  run(g, CONFIG.foodPatience + 1);
  assert.equal(g.stoves.every((x) => x === null), true);
  assert.equal(tickets(g, "food").length, 0);
  // 手の食材も消えているので、また冷蔵庫から取れる
  assert.match(atFridge(g) + "取る食材がありません", /取る食材がありません|取った/);
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
  atBar(g, 0);
  makeDishFor(g, tickets(g, "food")[0]!.id);
  run(g, 4);
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
