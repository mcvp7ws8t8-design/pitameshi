// ボット。ホールとキッチンを、人のかわりに動かす(プレイを眺めるためのもの)。
// 人と同じように、歩いて、触れる位置まで行って、E を押す(Game.act)。ゲームの中身は見ずに、snapshot だけで決める。
// ネットワークにも描画にも依存しない。テストでも使う。

import { CONFIG, partIndex, partTicket, type GameSnapshot, type TicketSnapshot } from "./game";
import { BARS, CUTS, FRIDGE, PASS, SEATS, STOVES, nearestTarget, type Spot, type Target } from "./layout";
import { methodOfIngredient, needsCut } from "./menu";
import { BOUNDS, SPAWN, blocked, type Role } from "./room";

export interface BotInput {
  mx: number;
  mz: number;
  yaw: number;
  /** この更新で E を押す */
  act: boolean;
}

/** 目的地。触れる相手(Target)と、立つ場所の目安 */
interface Goal {
  target: Target;
  spot: Spot;
}

const GRID = 0.2;
const TURN = 7; // 向きを変える速さ(rad/s)
const ACT_WAIT = 0.35; // E を押したあとの間(秒)

const same = (a: Target | null, b: Target): boolean => !!a && a.kind === b.kind && a.i === b.i;
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export class Bot {
  yaw = 0;
  private path: Spot[] = [];
  private goal: Goal | null = null;
  private wait = 0;
  private avoid = new Map<string, number>(); // たどり着けなかった目的地は、しばらく選ばない
  private stuck = 0;
  private last = { x: 0, z: 0 };
  /** いま向かっている先(表示や確認用) */
  get goalText(): string {
    return this.goal ? `${this.goal.target.kind}${this.goal.target.i}` : "";
  }

  constructor(readonly role: Role) {
    this.yaw = SPAWN[role].yaw;
    this.last = { x: SPAWN[role].x, z: SPAWN[role].z };
  }

  /** 20Hz くらいで呼ぶ。位置 pos から、次の入力を返す */
  update(g: GameSnapshot, pos: Spot, dt: number): BotInput {
    const out: BotInput = { mx: 0, mz: 0, yaw: this.yaw, act: false };
    if (g.phase !== "playing") return out;
    for (const [k, t] of this.avoid) {
      if (t - dt <= 0) this.avoid.delete(k);
      else this.avoid.set(k, t - dt);
    }
    this.wait -= dt;

    // 動けなくなったら、目的地をあきらめる
    const moved = Math.hypot(pos.x - this.last.x, pos.z - this.last.z);
    this.last = { x: pos.x, z: pos.z };
    this.stuck = moved < 0.002 && this.path.length > 0 ? this.stuck + dt : 0;
    if (this.stuck > 1.5 && this.goal) {
      this.avoid.set(this.key(this.goal.target), 6);
      this.goal = null;
      this.path = [];
      this.stuck = 0;
    }

    // 目的地を決める(ないとき、または、状況が変わって無効になったとき)
    if (!this.goal || !this.valid(g, this.goal)) {
      this.goal = this.choose(g, pos);
      this.path = this.goal ? this.plan(pos, this.goal) : [];
    }
    const goal = this.goal;
    if (!goal) return this.idle(pos, out, dt);

    // 触れる位置に着いたら、E を押す
    if (same(nearestTarget(this.role, pos.x, pos.z), goal.target) && this.path.length === 0) {
      if (this.wait <= 0) {
        out.act = true;
        this.wait = ACT_WAIT;
        this.goal = null; // 結果が変わるので、次の更新で決め直す
      }
      return out;
    }
    if (this.path.length === 0) {
      // 着いたはずなのに触れる相手が違う(となりの設備が近い)。あきらめる
      this.avoid.set(this.key(goal.target), 4);
      this.goal = null;
      return out;
    }
    return this.walk(pos, out, dt);
  }

  private key(t: Target): string {
    return `${t.kind}${t.i}`;
  }

  /** 次の道の点へ向かう。向きをなめらかに変えて、前へ歩く */
  private walk(pos: Spot, out: BotInput, dt: number): BotInput {
    let w = this.path[0]!;
    while (this.path.length > 1 && Math.hypot(w.x - pos.x, w.z - pos.z) < 0.3) {
      this.path.shift();
      w = this.path[0]!;
    }
    if (this.path.length === 1 && Math.hypot(w.x - pos.x, w.z - pos.z) < 0.25) {
      this.path = [];
      return out;
    }
    const want = Math.atan2(-(w.x - pos.x), -(w.z - pos.z)); // 前 = (-sin, -cos)
    const diff = wrap(want - this.yaw);
    this.yaw = wrap(this.yaw + Math.max(-TURN * dt, Math.min(TURN * dt, diff)));
    out.yaw = this.yaw;
    out.mz = Math.abs(diff) < 0.9 ? 1 : 0;
    return out;
  }

  /** することがないとき。立っている場所で、向きだけ整える */
  private idle(pos: Spot, out: BotInput, dt: number): BotInput {
    const home = this.role === "hall" ? { x: 0, z: 4 } : { x: 0, z: -5 };
    if (Math.hypot(pos.x - home.x, pos.z - home.z) > 1.2 && this.path.length === 0) {
      this.path = this.route(pos, home, 0.6);
    }
    return this.path.length ? this.walk(pos, out, dt) : out;
  }

  // ---- 目的地を決める ----

  private valid(g: GameSnapshot, goal: Goal): boolean {
    return this.options(g).some((o) => same(o.target, goal.target));
  }

  private choose(g: GameSnapshot, pos: Spot): Goal | null {
    const all = this.options(g).filter((o) => !this.avoid.has(this.key(o.target)));
    if (all.length === 0) return null;
    // 先に並べた順が優先。同じ優先の中では、近いもの
    const best = all[0]!;
    const tier = (o: (typeof all)[number]) => o.tier;
    const top = all.filter((o) => tier(o) === tier(best));
    top.sort((a, b) => Math.hypot(a.spot.x - pos.x, a.spot.z - pos.z) - Math.hypot(b.spot.x - pos.x, b.spot.z - pos.z));
    return top[0]!;
  }

  /** いまできること。tier が小さいほど先にやる */
  private options(g: GameSnapshot): (Goal & { tier: number })[] {
    return this.role === "hall" ? this.hallOptions(g) : this.kitchenOptions(g);
  }

  private hallOptions(g: GameSnapshot): (Goal & { tier: number })[] {
    const out: (Goal & { tier: number })[] = [];
    const add = (tier: number, target: Target, spot: Spot) => out.push({ tier, target, spot });
    const held = g.tickets.filter((t) => t.status === "hall");
    const room = CONFIG.holdHall - held.length;
    const seatsOf = (list: TicketSnapshot[]) => [...new Set(list.map((t) => t.seat))];
    // 持っているものを届ける先(我慢ゲージが減っている席から)
    const deliver = seatsOf(held)
      .filter((s) => g.seats[s]?.s === "waitFood")
      .sort((a, b) => (g.seats[a]?.p ?? 1) - (g.seats[b]?.p ?? 1));
    const waiting = g.seats.map((s, i) => (s?.s === "waitOrder" ? i : -1)).filter((i) => i >= 0).sort((a, b) => (g.seats[a]!.p ?? 1) - (g.seats[b]!.p ?? 1));
    const readyBars = g.bars.map((id, i) => (id !== null && g.tickets.find((t) => t.id === id)?.status === "ready" ? i : -1)).filter((i) => i >= 0);
    const freeBars = g.bars.map((id, i) => (id === null ? i : -1)).filter((i) => i >= 0);
    const needDrink = g.tickets.some((t) => t.kind === "drink" && t.status === "new");
    const onPass = g.tickets.some((t) => t.status === "pass");
    const canPick = room > 0 && (readyBars.length > 0 || onPass);

    // いっぱい持っているか、ほかにやることがなければ、届ける
    if (deliver.length > 0 && (room <= 0 || !canPick)) for (const s of deliver) add(0, { kind: "seat", i: s }, SEATS[s]!);
    for (const s of waiting) add(1, { kind: "seat", i: s }, SEATS[s]!);
    if (room > 0) for (const b of readyBars) add(2, { kind: "bar", i: b }, BARS[b]!);
    if (room > 0 && onPass) add(2, { kind: "pass", i: 0 }, PASS.hall);
    if (needDrink) for (const b of freeBars) add(3, { kind: "bar", i: b }, BARS[b]!);
    for (const s of deliver) add(4, { kind: "seat", i: s }, SEATS[s]!);
    return out;
  }

  private kitchenOptions(g: GameSnapshot): (Goal & { tier: number })[] {
    const out: (Goal & { tier: number })[] = [];
    const add = (tier: number, target: Target, spot: Spot) => out.push({ tier, target, spot });
    const parts = g.tickets.filter((t) => t.kind === "food").flatMap((t) => (t.parts ?? []).map((p, idx) => ({ t, p, idx })));
    const held = parts.filter((x) => x.p.st === "raw" || x.p.st === "cooked");
    const room = CONFIG.holdKitchen - held.length;
    const cooked = held.filter((x) => x.p.st === "cooked").length;
    const rawUncut = held.filter((x) => x.p.st === "raw" && !x.p.cut);
    const rawCut = held.filter((x) => x.p.st === "raw" && x.p.cut);
    const stoveState = (i: number) => {
      const id = g.stoves[i];
      return id === null || id === undefined ? "free" : g.tickets.find((t) => t.id === partTicket(id))?.parts?.[partIndex(id)]?.st ?? "free";
    };
    const boardState = (i: number) => {
      const id = g.boards[i];
      return id === null || id === undefined ? "free" : g.tickets.find((t) => t.id === partTicket(id))?.parts?.[partIndex(id)]?.st ?? "free";
    };
    const passFull = g.tickets.filter((t) => t.status === "pass").length >= CONFIG.passMax;

    // 1. 手が埋まりそうなら、先に盛り付けて空ける
    if (cooked > 0 && (room <= 1 || cooked >= 3) && !passFull) add(0, { kind: "pass", i: 0 }, PASS.kitchen);
    // 2. できあがりを取る(場所を空ける)
    if (room > 0) {
      STOVES.forEach((s, i) => stoveState(i) === "ready" && add(1, { kind: "stove", i }, s));
      CUTS.forEach((s, i) => boardState(i) === "chopped" && add(1, { kind: "board", i }, s));
    }
    // 3. 持っている食材を、まな板・調理場に入れる
    if (rawUncut.length > 0) CUTS.forEach((s, i) => boardState(i) === "free" && add(2, { kind: "board", i }, s));
    if (rawCut.length > 0) {
      const kinds = new Set(rawCut.map((x) => methodOfIngredient(x.p.ing)));
      STOVES.forEach((s, i) => kinds.has(s.kind) && stoveState(i) === "free" && add(2, { kind: "stove", i }, s));
    }
    // 4. 盛り付ける
    if (cooked > 0 && !passFull) add(3, { kind: "pass", i: 0 }, PASS.kitchen);
    // 5. 食材を取りにいく(手が空いているときだけ。持ちすぎて詰まらないように)
    const needs = g.tickets.some((t) => t.kind === "food" && t.status === "new" && (t.parts ?? []).some((p) => p.st === "need"));
    if (needs && room >= 2) add(4, { kind: "fridge", i: 0 }, FRIDGE);
    return out;
  }

  // ---- 道を探す ----

  private plan(pos: Spot, goal: Goal): Spot[] {
    if (same(nearestTarget(this.role, pos.x, pos.z), goal.target)) return []; // もう触れる
    // 触れる範囲に入ればよい。まず近くまで、だめなら少し離れたところまで
    for (const stop of [0.5, 0.9, 1.3]) {
      const p = this.route(pos, goal.spot, stop, goal.target);
      if (p.length > 0) return p;
    }
    this.avoid.set(this.key(goal.target), 4);
    return [];
  }

  /** 格子に区切って、いちばん近い道を探す(幅優先)。目的地から stop 以内に着ければよい。target があれば、そこで触れる相手が合うところだけ */
  private route(from: Spot, to: Spot, stop: number, target?: Target): Spot[] {
    const b = BOUNDS[this.role];
    const cell = (x: number, z: number): [number, number] => [Math.round((x - b.minX) / GRID), Math.round((z - b.minZ) / GRID)];
    const world = (i: number, j: number): Spot => ({ x: b.minX + i * GRID, z: b.minZ + j * GRID });
    const key = (i: number, j: number) => i * 1000 + j;
    const [si, sj] = cell(from.x, from.z);
    const prev = new Map<number, number>([[key(si, sj), -1]]);
    const queue: [number, number][] = [[si, sj]];
    let goal: [number, number] | null = null;
    for (let h = 0; h < queue.length; h++) {
      const [i, j] = queue[h]!;
      const w = world(i, j);
      if (Math.hypot(w.x - to.x, w.z - to.z) < stop && (!target || same(nearestTarget(this.role, w.x, w.z), target))) {
        goal = [i, j];
        break;
      }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ni = i + di;
        const nj = j + dj;
        const nw = world(ni, nj);
        if (nw.x < b.minX || nw.x > b.maxX || nw.z < b.minZ || nw.z > b.maxZ) continue;
        if (blocked(this.role, nw.x, nw.z) || prev.has(key(ni, nj))) continue;
        prev.set(key(ni, nj), key(i, j));
        queue.push([ni, nj]);
      }
    }
    if (!goal) return [];
    const path: Spot[] = [];
    for (let k = key(goal[0], goal[1]); k !== -1; k = prev.get(k)!) path.unshift(world(Math.floor(k / 1000), k % 1000));
    path.shift(); // いま立っている点
    return path;
  }
}
