import { test } from "node:test";
import assert from "node:assert/strict";
import { BARS, FRIDGE, PASS, RADIUS, SEATS, STOVES, TABLES, TABLE_SIZE } from "./layout";
import { BOUNDS, PLAYER_RADIUS, RoomState, SPAWN, blocked, step } from "./room";

test("3人目は入れない", () => {
  const r = new RoomState();
  assert.equal(r.join("a"), "ok");
  assert.equal(r.join("b"), "ok");
  assert.equal(r.join("c"), "full");
});

test("同じ役割は2人で選べない", () => {
  const r = new RoomState();
  r.join("a");
  r.join("b");
  assert.equal(r.setRole("a", "hall"), "ok");
  assert.equal(r.setRole("b", "hall"), "role-taken");
  assert.equal(r.setRole("b", "kitchen"), "ok");
});

test("抜けた人の役割は空く", () => {
  const r = new RoomState();
  r.join("a");
  r.setRole("a", "hall");
  r.leave("a");
  r.join("b");
  assert.equal(r.setRole("b", "hall"), "ok");
});

test("yaw=0 で前に進むと z が減り、yaw=π では増える", () => {
  assert.ok(step({ x: 0, z: 5 }, "hall", 0, 1, 0, 0.5).z < 5);
  assert.ok(step({ x: 0, z: 5 }, "hall", 0, 1, Math.PI, 0.5).z > 5);
});

test("始まりの向き: ホールはカウンター側、キッチンは奥の壁へ進む(どちらも -z)", () => {
  const hall = step(SPAWN.hall, "hall", 0, 1, SPAWN.hall.yaw, 0.5);
  assert.ok(hall.z < SPAWN.hall.z);
  const kitchen = step(SPAWN.kitchen, "kitchen", 0, 1, SPAWN.kitchen.yaw, 0.5);
  assert.ok(kitchen.z < SPAWN.kitchen.z);
});

test("右に進む: ホール(yaw=0)は x が増える", () => {
  const p = step(SPAWN.hall, "hall", 1, 0, 0, 0.5);
  assert.ok(p.x > SPAWN.hall.x);
});

test("斜め移動は速くならない", () => {
  // 何もない場所(キッチンの真ん中)で比べる
  const o = { x: -4, z: -3 };
  const straight = step(o, "kitchen", 0, 1, 0, 0.5);
  const diagonal = step(o, "kitchen", 1, 1, 0, 0.5);
  const d = (p: { x: number; z: number }) => Math.hypot(p.x - o.x, p.z - o.z);
  assert.ok(Math.abs(d(straight) - d(diagonal)) < 1e-9);
});

test("カウンターの向こうには行けない", () => {
  let p = { ...SPAWN.hall };
  for (let i = 0; i < 100; i++) p = { ...p, ...step(p, "hall", 0, 1, 0, 0.1) };
  assert.equal(p.z, BOUNDS.hall.minZ);
  let k = { ...SPAWN.kitchen };
  for (let i = 0; i < 100; i++) k = { ...k, ...step(k, "kitchen", 0, 1, Math.PI, 0.1) };
  assert.equal(k.z, BOUNDS.kitchen.maxZ);
});

test("通信が途切れても瞬間移動しない", () => {
  const r = new RoomState();
  r.join("a");
  r.setRole("a", "hall");
  r.input("a", 0, 1, 0, 1000);
  const z0 = r.players.get("a")!.z;
  r.input("a", 0, 1, 0, 61000);
  const z1 = r.players.get("a")!.z;
  assert.ok(z0 - z1 <= 0.4 + 1e-9);
});

test("NaN の入力は無視する", () => {
  const r = new RoomState();
  r.join("a");
  r.setRole("a", "hall");
  r.input("a", Number.NaN, 1, 0, 1000);
  assert.equal(r.players.get("a")!.z, SPAWN.hall.z);
});

test("役割を選ぶ前は動かない", () => {
  const r = new RoomState();
  r.join("a");
  r.input("a", 0, 1, 0, 1000);
  assert.equal(r.players.get("a")!.x, 0);
  assert.equal(r.players.get("a")!.z, 0);
});

test("テーブルには、ぶつかって通り抜けられない", () => {
  // 2名掛けテーブル(x=2.8, z=2.8)に向かって、手前から前に進む
  const t = TABLES.find((x) => x.x === 2.8 && x.z === 2.8)!;
  const edge = t.z + TABLE_SIZE[t.seats].d / 2 + PLAYER_RADIUS;
  let p = { x: 2.8, z: 4.0 };
  for (let i = 0; i < 100; i++) p = step(p, "hall", 0, 1, 0, 0.05);
  assert.ok(p.z >= edge - 1e-9, `z=${p.z}`);
  assert.ok(p.z < edge + 0.2);
});

test("ぶつかっても、壁に沿ってすべって進める", () => {
  const t = TABLES.find((x) => x.x === 2.8 && x.z === 2.8)!;
  // テーブルの手前で、斜め(前と右)に進むと、前には進めなくても右には進む
  let p = { x: 2.6, z: t.z + TABLE_SIZE[t.seats].d / 2 + PLAYER_RADIUS + 0.01 };
  const x0 = p.x;
  for (let i = 0; i < 10; i++) p = step(p, "hall", 1, 1, 0, 0.05);
  assert.ok(p.x > x0, "右へ進む");
});

test("設備にもぶつかる: キッチンの鉄板焼き台", () => {
  const g = STOVES[0]!;
  let p = { x: g.x, z: -6 };
  for (let i = 0; i < 100; i++) p = step(p, "kitchen", 0, 1, 0, 0.05); // 前(-z)へ
  assert.ok(p.z > g.z + 0.5, `z=${p.z}`);
  assert.ok(blocked("kitchen", g.x, g.z));
});

test("入ったときの位置は、ぶつかっていない", () => {
  assert.equal(blocked("hall", SPAWN.hall.x, SPAWN.hall.z), false);
  assert.equal(blocked("kitchen", SPAWN.kitchen.x, SPAWN.kitchen.z), false);
});

test("触れるもの(席・ドリンクバー・調理場・冷蔵庫・受け渡し台)は、全部、立って届く場所がある", () => {
  const reachable = (role: "hall" | "kitchen", c: { x: number; z: number }, radius: number) => {
    const b = BOUNDS[role];
    for (let x = b.minX; x <= b.maxX; x += 0.1) {
      for (let z = b.minZ; z <= b.maxZ; z += 0.1) {
        if (Math.hypot(x - c.x, z - c.z) <= radius - 0.05 && !blocked(role, x, z)) return true;
      }
    }
    return false;
  };
  SEATS.forEach((s, i) => assert.ok(reachable("hall", s, RADIUS.seat), `席 ${i}`));
  BARS.forEach((s, i) => assert.ok(reachable("hall", s, RADIUS.bar), `ドリンクバー ${i}`));
  assert.ok(reachable("hall", PASS.hall, RADIUS.pass), "受け渡し台(ホール)");
  STOVES.forEach((s, i) => assert.ok(reachable("kitchen", s, RADIUS.stove), `調理場 ${i}`));
  assert.ok(reachable("kitchen", FRIDGE, RADIUS.fridge), "冷蔵庫");
  assert.ok(reachable("kitchen", PASS.kitchen, RADIUS.pass), "受け渡し台(キッチン)");
});

test("ホールとキッチンの、どの2点の間も、歩いて行ける(通路がふさがれていない)", () => {
  // 格子状に区切って、入ったところから届く場所を広げていく。体の半径ぶんだけ歩ける場所が、全部つながっているか調べる
  for (const role of ["hall", "kitchen"] as const) {
    const b = BOUNDS[role];
    const step = 0.2;
    const key = (i: number, j: number) => `${i},${j}`;
    const free = new Set<string>();
    for (let i = 0; b.minX + i * step <= b.maxX; i++) {
      for (let j = 0; b.minZ + j * step <= b.maxZ; j++) {
        if (!blocked(role, b.minX + i * step, b.minZ + j * step)) free.add(key(i, j));
      }
    }
    const s = SPAWN[role];
    const start = key(Math.round((s.x - b.minX) / step), Math.round((s.z - b.minZ) / step));
    assert.ok(free.has(start), `${role}: 入ったところが歩ける`);
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const [i, j] = queue.pop()!.split(",").map(Number) as [number, number];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = key(i + di, j + dj);
        if (free.has(k) && !seen.has(k)) {
          seen.add(k);
          queue.push(k);
        }
      }
    }
    // 歩ける場所のうち、9割以上はつながっている(隅の小さな行き止まりは許す)
    assert.ok(seen.size / free.size > 0.97, `${role}: つながっている割合 ${(seen.size / free.size).toFixed(3)}`);
  }
});
