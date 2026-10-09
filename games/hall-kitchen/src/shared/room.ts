// 1部屋ぶんの状態と動きのルール。サーバー(正)とクライアント(予測)で同じ関数を使う。
// ネットワークにも描画にも依存しない。

export type Role = "hall" | "kitchen";

export interface PlayerSnapshot {
  id: string;
  role: Role | null;
  x: number;
  z: number;
  yaw: number;
}

export interface Player extends PlayerSnapshot {
  /** 最後に入力を受けた時刻(ms) */
  last: number;
}

export const MAX_PLAYERS = 2;
export const SPEED = 4; // m/s

// 店の座標: z が大きい方がホール、小さい方がキッチン。間にカウンターがある。
// 歩ける範囲を役割ごとに決めて、カウンターの向こうには行けない。
export const BOUNDS: Record<Role, { minX: number; maxX: number; minZ: number; maxZ: number }> = {
  hall: { minX: -9.5, maxX: 9.5, minZ: 0.8, maxZ: 9.5 },
  kitchen: { minX: -9.5, maxX: 9.5, minZ: -9.5, maxZ: -1.8 },
};

// 入ったときの位置と向き。three.js のカメラは yaw=0 で -z を向く。
export const SPAWN: Record<Role, { x: number; z: number; yaw: number }> = {
  hall: { x: 0, z: 6, yaw: 0 },
  kitchen: { x: 0, z: -5, yaw: Math.PI },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 入力 (mx, mz) と向き yaw から dt 秒ぶん動かした位置を返す */
export function step(
  p: { x: number; z: number },
  role: Role,
  mx: number,
  mz: number,
  yaw: number,
  dt: number,
): { x: number; z: number } {
  let ix = clamp(mx, -1, 1);
  let iz = clamp(mz, -1, 1);
  const len = Math.hypot(ix, iz);
  if (len > 1) {
    ix /= len;
    iz /= len;
  }
  // 前 = (-sin, -cos)、右 = (cos, -sin)
  const vx = ix * Math.cos(yaw) + iz * -Math.sin(yaw);
  const vz = ix * -Math.sin(yaw) + iz * -Math.cos(yaw);
  const b = BOUNDS[role];
  return {
    x: clamp(p.x + vx * SPEED * dt, b.minX, b.maxX),
    z: clamp(p.z + vz * SPEED * dt, b.minZ, b.maxZ),
  };
}

export type JoinResult = "ok" | "full";
export type RoleResult = "ok" | "role-taken";

export class RoomState {
  players = new Map<string, Player>();

  join(id: string): JoinResult {
    if (this.players.size >= MAX_PLAYERS) return "full";
    this.players.set(id, { id, role: null, x: 0, z: 0, yaw: 0, last: 0 });
    return "ok";
  }

  leave(id: string): void {
    this.players.delete(id);
  }

  setRole(id: string, role: Role): RoleResult {
    const me = this.players.get(id);
    if (!me) return "role-taken";
    for (const p of this.players.values()) {
      if (p.id !== id && p.role === role) return "role-taken";
    }
    const s = SPAWN[role];
    Object.assign(me, { role, x: s.x, z: s.z, yaw: s.yaw });
    return "ok";
  }

  input(id: string, mx: number, mz: number, yaw: number, now: number): void {
    const me = this.players.get(id);
    if (!me || !me.role) return;
    if (![mx, mz, yaw].every(Number.isFinite)) return;
    // 通信が途切れたあとに瞬間移動できないよう、経過時間は 0.1 秒までにする
    const dt = me.last === 0 ? 0 : Math.min(0.1, Math.max(0, (now - me.last) / 1000));
    me.last = now;
    me.yaw = yaw;
    Object.assign(me, step(me, me.role, mx, mz, yaw, dt));
  }

  snapshot(): PlayerSnapshot[] {
    return [...this.players.values()].map(({ id, role, x, z, yaw }) => ({ id, role, x, z, yaw }));
  }
}
