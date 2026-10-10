// 店の中の「触れるもの」の位置。サーバー(判定)とクライアント(表示)で共有する。
// 座標: z が大きい方がホール、小さい方がキッチン。

import type { Method } from "./menu";
import type { Role } from "./room";

export interface Spot {
  x: number;
  z: number;
}

// テーブルは2名掛け8卓と4名掛け4卓の計12卓(椅子は32脚)。
// 手前の列(z=2.8)に2名掛け5卓、真ん中の列(z=5.3)に4名掛け4卓、奥の列(z=7.6)に2名掛け3卓。
export interface Table extends Spot {
  seats: 2 | 4;
}
export const TABLES: Table[] = [
  ...[-7.6, -5.2, -2.8, 2.8, 5.2].map((x) => ({ x, z: 2.8, seats: 2 as const })),
  ...[-6.6, -2.2, 2.2, 6.6].map((x) => ({ x, z: 5.3, seats: 4 as const })),
  ...[-4.4, 0, 4.4].map((x) => ({ x, z: 7.6, seats: 2 as const })),
];
/** テーブルの天板の大きさ */
export const TABLE_SIZE = { 2: { w: 0.9, d: 0.9 }, 4: { w: 1.5, d: 0.9 } } as const;

// 椅子。yaw は座った人がテーブルを向く向き(three.js は yaw=0 で -z を向く)。
export interface Seat extends Spot {
  yaw: number;
  table: number;
  chair: number;
}
export const SEATS: Seat[] = TABLES.flatMap((t, table) => {
  const dz = 0.75;
  if (t.seats === 2) {
    return [
      { x: t.x, z: t.z - dz, yaw: Math.PI, table, chair: 0 },
      { x: t.x, z: t.z + dz, yaw: 0, table, chair: 1 },
    ];
  }
  return [
    { x: t.x - 0.4, z: t.z - dz, yaw: Math.PI, table, chair: 0 },
    { x: t.x + 0.4, z: t.z - dz, yaw: Math.PI, table, chair: 1 },
    { x: t.x - 0.4, z: t.z + dz, yaw: 0, table, chair: 2 },
    { x: t.x + 0.4, z: t.z + dz, yaw: 0, table, chair: 3 },
  ];
});
/** グループで座るときの椅子の順番(2人なら向かい合わせになる) */
export const CHAIR_ORDER: Record<2 | 4, number[]> = { 2: [0, 1], 4: [0, 2, 1, 3] };

/** 「5A」のような席の呼び名。卓の番号(1〜12)と、卓の中の椅子の記号 */
export const seatLabel = (i: number): string => {
  const s = SEATS[i];
  return s ? `${s.table + 1}${"ABCD"[s.chair]}` : "?";
};

// 調理場。焼く5・茹でる4・揚げる2。奥の壁に焼く5と揚げる2、左の壁に茹でる4。
export interface Station extends Spot {
  kind: Method;
}
export const STOVES: Station[] = [
  ...[-8, -6, -4, -2, 0].map((x) => ({ x, z: -8.8, kind: "grill" as const })),
  ...[2, 4].map((x) => ({ x, z: -8.8, kind: "fry" as const })),
  ...[-2.8, -4.3, -5.8, -7.3].map((z) => ({ x: -9.0, z, kind: "boil" as const })),
];

// まな板(キッチン側の右の壁の作業台)。3枚で、生の食材を切る。
export const CUTS: Spot[] = [-4.0, -4.8, -5.6].map((z) => ({ x: 8.8, z }));

// バーカウンター(ホールの右奥の角)。手前のカウンター(お客さん側、スツールつき)と、奥の仕切りの壁ぎわのバックバーの間に入って、
// ホールが飲み物を作る(2か所)。入口は、カウンターの左端と隣のテーブルの間。
export const BAR_COUNTER = { x0: 7.0, x1: 9.7, z0: 1.85, z1: 2.55 };
export const BAR_STOOLS: Spot[] = [7.7, 8.35, 9.0].map((x) => ({ x, z: 3.2 }));
export const BARS: Spot[] = [
  { x: 7.9, z: 1.25 },
  { x: 9.0, z: 1.25 },
];

// 冷蔵庫(食材はここから取る)。奥の壁、調理場の右。
export const FRIDGE: Spot = { x: 6.2, z: -8.8 };

// カウンターの受け渡し窓。ホール側とキッチン側で立つ位置が違う。
export const PASS: Record<Role, Spot> = {
  hall: { x: 0, z: 0.3 },
  kitchen: { x: 0, z: -2.2 },
};
/** 受け渡し台に置いた料理を並べる位置(表示用) */
export const PASS_SLOT = (i: number): Spot & { y: number } => ({ x: -1.15 + i * 0.33, z: -0.5, y: 1.1 });

export const RADIUS = { seat: 1.5, stove: 1.7, pass: 1.8, bar: 1.6, fridge: 1.9, board: 1.0 };

export type Target = { kind: "seat" | "stove" | "board" | "bar" | "fridge" | "pass"; i: number };

/** 役割ごとに、いまの位置から触れる一番近いものを返す */
export function nearestTarget(role: Role, x: number, z: number): Target | null {
  const cands: { t: Target; spot: Spot; r: number }[] = [];
  if (role === "hall") {
    SEATS.forEach((s, i) => cands.push({ t: { kind: "seat", i }, spot: s, r: RADIUS.seat }));
    BARS.forEach((s, i) => cands.push({ t: { kind: "bar", i }, spot: s, r: RADIUS.bar }));
  } else {
    STOVES.forEach((s, i) => cands.push({ t: { kind: "stove", i }, spot: s, r: RADIUS.stove }));
    CUTS.forEach((s, i) => cands.push({ t: { kind: "board", i }, spot: s, r: RADIUS.board }));
    cands.push({ t: { kind: "fridge", i: 0 }, spot: FRIDGE, r: RADIUS.fridge });
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
  return { x: -8.8 + (i % 20) * 0.9, z: 9.35 - Math.floor(i / 20) * 0.45 };
}

// ---- 当たり判定(歩けないところ) ----
// 家具や設備は通り抜けられない。見た目の大きさに合わせた四角形で表す。
// 椅子は、お客さんが座っていて近づく必要があるので、ふさがない(テーブルだけ)。
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
const rect = (cx: number, cz: number, w: number, d: number): Rect => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });

export const OBSTACLES: Record<Role, Rect[]> = {
  hall: [
    ...TABLES.map((t) => rect(t.x, t.z, TABLE_SIZE[t.seats].w, TABLE_SIZE[t.seats].d)),
    rect((BAR_COUNTER.x0 + BAR_COUNTER.x1) / 2, (BAR_COUNTER.z0 + BAR_COUNTER.z1) / 2, BAR_COUNTER.x1 - BAR_COUNTER.x0, BAR_COUNTER.z1 - BAR_COUNTER.z0), // バーのカウンター
    ...BAR_STOOLS.map((s) => rect(s.x, s.z, 0.4, 0.4)), // スツール
  ],
  kitchen: [
    ...STOVES.map((s) => (s.kind === "boil" ? rect(s.x, s.z, 1.0, 1.4) : rect(s.x, s.z, 1.8, 1.0))),
    rect(FRIDGE.x, FRIDGE.z, 2.0, 0.85), // 冷蔵庫
    rect(8.5, -8.8, 2.0, 1.0), // シンク
    rect(9.4, -5, 1.0, 4.8), // 右の壁の作業台
  ],
};
