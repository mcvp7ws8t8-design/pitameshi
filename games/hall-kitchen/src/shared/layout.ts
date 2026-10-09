// 店の中の「触れるもの」の位置。サーバー(判定)とクライアント(表示)で共有する。
// 座標: z が大きい方がホール、小さい方がキッチン。

import type { Role } from "./room";

export interface Spot {
  x: number;
  z: number;
}

// テーブル4つ × 2席。テーブルは (x, 4)、椅子は z=5.1 と z=2.9。
// yaw は座った人がテーブルを向く向き(three.js は yaw=0 で -z を向く)。
const TABLE_X = [-6, -2, 2, 6];
export const SEATS: (Spot & { yaw: number })[] = TABLE_X.flatMap((x) => [
  { x, z: 5.1, yaw: 0 },
  { x, z: 2.9, yaw: Math.PI },
]);

export const STOVES: Spot[] = [
  { x: -6, z: -8.8 },
  { x: -3, z: -8.8 },
];

// カウンターの受け渡し窓。ホール側とキッチン側で立つ位置が違う。
export const PASS: Record<Role, Spot> = {
  hall: { x: 0, z: 0.3 },
  kitchen: { x: 0, z: -2.2 },
};
/** 受け渡し台に置いた料理を並べる位置(表示用) */
export const PASS_SLOT = (i: number): Spot & { y: number } => ({ x: -1.15 + i * 0.33, z: -0.5, y: 1.1 });

export const RADIUS = { seat: 1.6, stove: 2.0, pass: 1.8 };

export type Target = { kind: "seat" | "stove" | "pass"; i: number };

/** 役割ごとに、いまの位置から触れる一番近いものを返す */
export function nearestTarget(role: Role, x: number, z: number): Target | null {
  const cands: { t: Target; spot: Spot; r: number }[] = [];
  if (role === "hall") {
    SEATS.forEach((s, i) => cands.push({ t: { kind: "seat", i }, spot: s, r: RADIUS.seat }));
  } else {
    STOVES.forEach((s, i) => cands.push({ t: { kind: "stove", i }, spot: s, r: RADIUS.stove }));
  }
  cands.push({ t: { kind: "pass", i: 0 }, spot: PASS[role], r: RADIUS.pass });
  let best: Target | null = null;
  let bestD = Infinity;
  for (const c of cands) {
    const d = Math.hypot(c.spot.x - x, c.spot.z - z);
    if (d <= c.r && d < bestD) {
      best = c.t;
      bestD = d;
    }
  }
  return best;
}

/** 入口の行列。i 番目に並ぶ人の位置 */
export const QUEUE_MAX_SHOWN = 40;
export function queueSpot(i: number): Spot {
  return { x: -8.8 + (i % 20) * 0.9, z: 9.0 - Math.floor(i / 20) * 0.9 };
}
