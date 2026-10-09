import { test } from "node:test";
import assert from "node:assert/strict";
import { BOUNDS, RoomState, SPAWN, step } from "./room";

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
  const straight = step({ x: 0, z: 5 }, "hall", 0, 1, 0, 1);
  const diagonal = step({ x: 0, z: 5 }, "hall", 1, 1, 0, 1);
  const d = (p: { x: number; z: number }) => Math.hypot(p.x, p.z - 5);
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
