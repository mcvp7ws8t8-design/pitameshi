// ゲームのルール本体。お客さんが来て、注文し、料理が作られ、運ばれ、食べて帰る。
// ネットワークにも描画にも依存しない。時間は tick(dt) で進める。
// 数字は CONFIG にまとめてある。遊んでみて調整する。

import { nearestTarget } from "./layout";
import type { Role } from "./room";

export type Dish = "salad" | "burger";
export const DISHES: Record<Dish, { name: string; cook: number }> = {
  salad: { name: "サラダ", cook: 3 },
  burger: { name: "ハンバーグ", cook: 7 },
};

export const CONFIG = {
  duration: 300, // 1回のゲームの長さ(秒)
  countdown: 3,
  maxAngry: 15, // 怒って帰った人がこの数になったらゲームオーバー
  queueMax: 40, // 入口に並べる人数。超えたら来た人は帰る(怒った数に入る)
  queuePatience: 40, // 席が空くまで待てる秒数
  orderPatience: 30, // 座ってから注文を取ってもらうまで
  foodPatience: 70, // 注文してから料理が届くまで
  eatTime: 4,
  holdHall: 3, // ホールが一度に運べる数
  holdKitchen: 2,
  passMax: 8, // 受け渡し台に置ける数
  stoves: 2,
  spawnStart: 6, // 来店の間隔(秒)。ゲーム中に spawnEnd まで縮む
  spawnEnd: 1,
  saladRatio: 0.6,
};

export const spawnInterval = (clock: number): number =>
  Math.max(CONFIG.spawnEnd, CONFIG.spawnStart - ((CONFIG.spawnStart - CONFIG.spawnEnd) * clock) / CONFIG.duration);

export type Phase = "waiting" | "countdown" | "playing" | "over";
export type CustomerState = "queue" | "waitOrder" | "waitFood" | "eating";
// new: 調理待ち / cooking: コンロの上 / ready: 焼き上がり(コンロの上) /
// kitchen: キッチンが持っている / pass: 受け渡し台 / hall: ホールが持っている
export type TicketStatus = "new" | "cooking" | "ready" | "kitchen" | "pass" | "hall";

interface Customer {
  id: number;
  state: CustomerState;
  patience: number;
  max: number;
  seat: number;
  dish: Dish;
  eatLeft: number;
}
interface Ticket {
  id: number;
  dish: Dish;
  seat: number;
  customer: number;
  status: TicketStatus;
  stove: number;
  left: number;
}

export interface TicketSnapshot {
  id: number;
  dish: Dish;
  seat: number;
  status: TicketStatus;
  stove: number;
}
export interface SeatSnapshot {
  s: Exclude<CustomerState, "queue">;
  p: number; // 我慢の残り 0〜1
}
export interface GameSnapshot {
  phase: Phase;
  countdown: number;
  timeLeft: number;
  served: number;
  angry: number;
  maxAngry: number;
  queue: number;
  seats: (SeatSnapshot | null)[];
  tickets: TicketSnapshot[];
  selected: number | null;
  stoves: (number | null)[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  phase: Phase = "waiting";
  countdown = 0;
  clock = 0;
  served = 0;
  angry = 0;
  customers: Customer[] = [];
  tickets: Ticket[] = [];
  stoves: (number | null)[] = Array(CONFIG.stoves).fill(null);
  selected: number | null = null;
  seatCount: number;
  private nextId = 1;
  private spawnLeft = 1;
  private rng: () => number;
  private seed: number;

  constructor(seed = 1, seatCount = 8) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.seatCount = seatCount;
  }

  private reset(): void {
    this.phase = "waiting";
    this.countdown = 0;
    this.clock = 0;
    this.served = 0;
    this.angry = 0;
    this.customers = [];
    this.tickets = [];
    this.stoves = Array(CONFIG.stoves).fill(null);
    this.selected = null;
    this.nextId = 1;
    this.spawnLeft = 1;
    this.rng = mulberry32(this.seed);
  }

  /** 2人そろったら始まる。途中で1人でも抜けたら最初から */
  update(bothReady: boolean): void {
    if (this.phase === "waiting" && bothReady) {
      this.phase = "countdown";
      this.countdown = CONFIG.countdown;
    } else if ((this.phase === "countdown" || this.phase === "playing") && !bothReady) {
      this.reset();
    }
  }

  restart(bothReady: boolean): void {
    if (this.phase !== "over") return;
    this.seed += 1;
    this.reset();
    this.update(bothReady);
  }

  tick(dt: number): void {
    if (this.phase === "countdown") {
      this.countdown -= dt;
      if (this.countdown <= 0) this.phase = "playing";
      return;
    }
    if (this.phase !== "playing") return;
    this.clock += dt;

    this.spawnLeft -= dt;
    for (let guard = 0; this.spawnLeft <= 0 && guard < 10; guard++) {
      this.spawn();
      this.spawnLeft += spawnInterval(this.clock);
    }

    for (const t of this.tickets) {
      if (t.status !== "cooking") continue;
      t.left -= dt;
      if (t.left <= 0) t.status = "ready";
    }

    for (const c of [...this.customers]) {
      if (c.state === "eating") {
        c.eatLeft -= dt;
        if (c.eatLeft <= 0) {
          this.served++;
          this.customers = this.customers.filter((x) => x !== c);
        }
      } else {
        c.patience -= dt;
        if (c.patience <= 0) this.leaveAngry(c);
      }
    }
    this.seatQueue();

    if (this.angry >= CONFIG.maxAngry || this.clock >= CONFIG.duration) this.phase = "over";
  }

  private spawn(): void {
    const queued = this.customers.filter((c) => c.state === "queue").length;
    if (queued >= CONFIG.queueMax) {
      this.angry++;
      return;
    }
    this.customers.push({
      id: this.nextId++,
      state: "queue",
      patience: CONFIG.queuePatience,
      max: CONFIG.queuePatience,
      seat: -1,
      dish: this.rng() < CONFIG.saladRatio ? "salad" : "burger",
      eatLeft: 0,
    });
  }

  private seatQueue(): void {
    for (const c of this.customers) {
      if (c.state !== "queue") continue;
      const free: number[] = [];
      for (let i = 0; i < this.seatCount; i++) {
        if (!this.customers.some((x) => x.seat === i)) free.push(i);
      }
      if (free.length === 0) return;
      c.seat = free[Math.floor(this.rng() * free.length)]!;
      c.state = "waitOrder";
      c.max = c.patience = CONFIG.orderPatience;
    }
  }

  private leaveAngry(c: Customer): void {
    this.customers = this.customers.filter((x) => x !== c);
    const t = this.tickets.find((x) => x.customer === c.id);
    if (t) this.dropTicket(t);
    this.angry++;
  }

  private dropTicket(t: Ticket): void {
    this.tickets = this.tickets.filter((x) => x !== t);
    for (let i = 0; i < this.stoves.length; i++) if (this.stoves[i] === t.id) this.stoves[i] = null;
    if (this.selected === t.id) this.selected = null;
  }

  private newTickets(): Ticket[] {
    return this.tickets.filter((t) => t.status === "new").sort((a, b) => a.id - b.id);
  }

  /** 調理に回す注文。選んでいなければ一番古いもの */
  currentSelected(): number | null {
    const list = this.newTickets();
    if (this.selected !== null && list.some((t) => t.id === this.selected)) return this.selected;
    return list[0]?.id ?? null;
  }

  /** 調理に回す注文を次のものに切り替える */
  cycle(): void {
    const list = this.newTickets();
    if (list.length === 0) return;
    const cur = this.currentSelected();
    const idx = list.findIndex((t) => t.id === cur);
    this.selected = list[(idx + 1) % list.length]!.id;
  }

  private count(status: TicketStatus): number {
    return this.tickets.filter((t) => t.status === status).length;
  }

  /** E キー。位置に応じて、注文を取る・料理を出す・調理する・運ぶ。結果の一言を返す */
  act(role: Role, x: number, z: number): string {
    if (this.phase !== "playing") return "";
    const target = nearestTarget(role, x, z);
    if (!target) return "";
    if (role === "hall") return target.kind === "seat" ? this.hallSeat(target.i) : this.hallPass();
    return target.kind === "stove" ? this.kitchenStove(target.i) : this.kitchenPass();
  }

  private hallSeat(seat: number): string {
    const c = this.customers.find((x) => x.seat === seat);
    if (!c) return "";
    if (c.state === "waitOrder") {
      this.tickets.push({ id: this.nextId++, dish: c.dish, seat, customer: c.id, status: "new", stove: -1, left: 0 });
      c.state = "waitFood";
      c.max = c.patience = CONFIG.foodPatience;
      return `席${seat + 1}: ${DISHES[c.dish].name}の注文`;
    }
    if (c.state === "waitFood") {
      const t = this.tickets.find((x) => x.customer === c.id && x.status === "hall");
      if (!t) return "その料理を持っていません";
      this.dropTicket(t);
      c.state = "eating";
      c.eatLeft = CONFIG.eatTime;
      return `席${seat + 1}に${DISHES[t.dish].name}を出した`;
    }
    return "";
  }

  private hallPass(): string {
    const onPass = this.tickets.filter((t) => t.status === "pass").sort((a, b) => a.id - b.id);
    if (onPass.length === 0) return "出ている料理はありません";
    let room = CONFIG.holdHall - this.count("hall");
    if (room <= 0) return "トレーがいっぱいです";
    let n = 0;
    for (const t of onPass) {
      if (room-- <= 0) break;
      t.status = "hall";
      n++;
    }
    return `料理を${n}つ取った`;
  }

  private kitchenStove(i: number): string {
    const id = this.stoves[i];
    const t = id === null || id === undefined ? undefined : this.tickets.find((x) => x.id === id);
    if (t) {
      if (t.status === "cooking") return "調理中です";
      if (this.count("kitchen") >= CONFIG.holdKitchen) return "手がいっぱいです";
      t.status = "kitchen";
      this.stoves[i] = null;
      return `${DISHES[t.dish].name}を取った`;
    }
    const sel = this.currentSelected();
    const next = this.tickets.find((x) => x.id === sel);
    if (!next) return "調理する注文がありません";
    next.status = "cooking";
    next.stove = i;
    next.left = DISHES[next.dish].cook;
    this.stoves[i] = next.id;
    this.selected = null;
    return `席${next.seat + 1}の${DISHES[next.dish].name}を調理開始`;
  }

  private kitchenPass(): string {
    const held = this.tickets.filter((t) => t.status === "kitchen");
    if (held.length === 0) return "持っている料理がありません";
    let room = CONFIG.passMax - this.count("pass");
    if (room <= 0) return "受け渡し台がいっぱいです";
    let n = 0;
    for (const t of held) {
      if (room-- <= 0) break;
      t.status = "pass";
      n++;
    }
    return `料理を${n}つ台に置いた`;
  }

  snapshot(): GameSnapshot {
    const seats: (SeatSnapshot | null)[] = Array(this.seatCount).fill(null);
    for (const c of this.customers) {
      if (c.state === "queue") continue;
      seats[c.seat] = { s: c.state, p: c.state === "eating" ? 1 : Math.round((c.patience / c.max) * 100) / 100 };
    }
    return {
      phase: this.phase,
      countdown: Math.max(0, Math.ceil(this.countdown)),
      timeLeft: Math.max(0, Math.ceil(CONFIG.duration - this.clock)),
      served: this.served,
      angry: this.angry,
      maxAngry: CONFIG.maxAngry,
      queue: this.customers.filter((c) => c.state === "queue").length,
      seats,
      tickets: this.tickets.map(({ id, dish, seat, status, stove }) => ({ id, dish, seat, status, stove })),
      selected: this.currentSelected(),
      stoves: [...this.stoves],
    };
  }
}
