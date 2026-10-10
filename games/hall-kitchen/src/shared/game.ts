// ゲームのルール本体。お客さんが来て、注文し、料理が作られ、運ばれ、食べて帰る。
// ネットワークにも描画にも依存しない。時間は tick(dt) で進める。
// 数字は CONFIG にまとめてある。遊んでみて調整する。

import { CHAIR_ORDER, SEATS, STOVES, TABLES, nearestTarget, seatLabel } from "./layout";
import { DISHES, DRINKS, INGREDIENTS, METHOD_NAME, dishName, drinkName, ingredientName, methodOfIngredient, type Method } from "./menu";
import type { Role } from "./room";

export const CONFIG = {
  duration: 300, // 1回のゲームの長さ(秒)
  countdown: 3,
  maxAngry: 15, // 怒って帰った人がこの数になったらゲームオーバー
  queueMax: 40, // 入口に並べる人数。超えたら来たグループは帰る(人数ぶん怒った数に入る)
  queuePatience: 40, // 席が空くまで待てる秒数
  orderPatience: 30, // 座ってから注文を取ってもらうまで
  foodPatience: 70, // 注文してから料理が届くまで
  eatTime: 4,
  holdHall: 4, // ホールが一度に運べる数(料理とドリンクの合計)
  holdKitchen: 4, // キッチンが手に持てる食材の数(生のものも、調理したものも)
  passMax: 8, // 受け渡し台に置ける数
  bars: 2, // ドリンクバーの台数
  spawnStart: 13, // グループが来る間隔(秒)。ゲーム中に spawnEnd まで縮む
  spawnEnd: 2.3,
  partySizes: [1, 1, 2, 2, 2, 2, 3, 4, 4], // グループの人数の出方(平均およそ2.3人)
};

const METHOD_VERB: Record<Method, string> = { grill: "焼き始めた", boil: "茹で始めた", fry: "揚げ始めた" };

/** 調理場に置いた食材の番号。注文の番号 × 8 + 何番目の食材か(料理の食材は3つまで) */
const partId = (ticket: number, idx: number) => ticket * 8 + idx;
export const partTicket = (id: number) => Math.floor(id / 8);
export const partIndex = (id: number) => id % 8;

export const spawnInterval = (clock: number): number =>
  Math.max(CONFIG.spawnEnd, CONFIG.spawnStart - ((CONFIG.spawnStart - CONFIG.spawnEnd) * clock) / CONFIG.duration);

export type Phase = "waiting" | "countdown" | "playing" | "over";
export type CustomerState = "queue" | "waitOrder" | "waitFood" | "eating";
// 注文は料理(food)とドリンク(drink)。
// 料理: new(食材を集めて調理中) → pass(盛り付けが終わって受け渡し台) → hall(ホールが持っている)
// ドリンク: new → cooking(ドリンクバーで作っている) → ready(できあがり) → hall
export type Kind = "food" | "drink";
export type TicketStatus = "new" | "cooking" | "ready" | "pass" | "hall";
// 料理の食材1つ1つの状態
// need: まだ冷蔵庫から取っていない / raw: 取って持っている(生) / cooking: 調理場で調理中 /
// ready: 調理できあがり(調理場の上) / cooked: 取って持っている(調理済み) / plated: 盛り付け台に置いた
export type PartState = "need" | "raw" | "cooking" | "ready" | "cooked" | "plated";

interface Part {
  ing: number;
  st: PartState;
  left: number;
}

interface Customer {
  id: number;
  party: number; // 一緒に来たグループの番号
  state: CustomerState;
  patience: number;
  max: number;
  seat: number;
  dish: number;
  drink: number;
  drinkDone: boolean;
  eatLeft: number;
}
interface Ticket {
  id: number;
  kind: Kind;
  item: number; // DISHES / DRINKS の番号
  seat: number;
  customer: number;
  status: TicketStatus;
  left: number;
  parts: Part[]; // 料理だけ
}

export interface TicketSnapshot {
  id: number;
  kind: Kind;
  item: number;
  seat: number;
  status: TicketStatus;
  parts?: { ing: number; st: PartState }[];
}
export interface SeatSnapshot {
  id: number; // お客さんの番号(見た目を決めるのに使う)
  dish: number;
  drink: number;
  s: Exclude<CustomerState, "queue">;
  p: number; // 我慢の残り 0〜1
  d: 0 | 1 | 2; // ドリンク 0: まだ注文されていない / 1: 待っている / 2: 出した
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
  selFood: number | null;
  selDrink: number | null;
  stoves: (number | null)[];
  bars: (number | null)[];
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
  stoves: (number | null)[] = Array(STOVES.length).fill(null);
  bars: (number | null)[] = Array(CONFIG.bars).fill(null);
  selFood: number | null = null;
  selDrink: number | null = null;
  /** 使える椅子の数(椅子が全部この数より前にある卓だけ使う) */
  seatCount: number;
  private nextId = 1;
  private spawnLeft = 1;
  private rng: () => number;
  private seed: number;

  constructor(seed = 1, seatCount = SEATS.length) {
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
    this.stoves = Array(STOVES.length).fill(null);
    this.bars = Array(CONFIG.bars).fill(null);
    this.selFood = this.selDrink = null;
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
      if (t.kind === "drink") {
        if (t.status !== "cooking") continue;
        t.left -= dt;
        if (t.left <= 0) t.status = "ready";
        continue;
      }
      for (const p of t.parts) {
        if (p.st !== "cooking") continue;
        p.left -= dt;
        if (p.left <= 0) p.st = "ready";
      }
    }

    for (const c of [...this.customers]) {
      if (c.state === "eating") {
        c.eatLeft -= dt;
        if (c.eatLeft <= 0) {
          this.served++;
          this.customers = this.customers.filter((x) => x !== c);
          this.dropTicketsOf(c);
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
    const size = CONFIG.partySizes[Math.floor(this.rng() * CONFIG.partySizes.length)]!;
    const queued = this.customers.filter((c) => c.state === "queue").length;
    if (queued + size > CONFIG.queueMax) {
      this.angry += size;
      return;
    }
    const party = this.nextId++;
    for (let k = 0; k < size; k++) {
      this.customers.push({
        id: this.nextId++,
        party,
        state: "queue",
        patience: CONFIG.queuePatience,
        max: CONFIG.queuePatience,
        seat: -1,
        dish: Math.floor(this.rng() * DISHES.length),
        drink: Math.floor(this.rng() * DRINKS.length),
        drinkDone: false,
        eatLeft: 0,
      });
    }
  }

  /** 並んでいるグループを、人数が入る一番小さい空き卓へ案内する。入れないグループは待つ */
  private seatQueue(): void {
    const parties = new Map<number, Customer[]>();
    for (const c of this.customers) {
      if (c.state !== "queue") continue;
      const list = parties.get(c.party) ?? [];
      list.push(c);
      parties.set(c.party, list);
    }
    for (const members of parties.values()) {
      const fit: number[] = [];
      TABLES.forEach((t, ti) => {
        if (t.seats < members.length) return;
        const chairs = SEATS.map((s, i) => (s.table === ti ? i : -1)).filter((i) => i >= 0);
        if (chairs.some((i) => i >= this.seatCount)) return;
        if (this.customers.some((c) => c.seat >= 0 && SEATS[c.seat]!.table === ti)) return;
        fit.push(ti);
      });
      if (fit.length === 0) continue;
      const smallest = Math.min(...fit.map((ti) => TABLES[ti]!.seats));
      const options = fit.filter((ti) => TABLES[ti]!.seats === smallest);
      const ti = options[Math.floor(this.rng() * options.length)]!;
      const chairs = SEATS.map((s, i) => (s.table === ti ? i : -1)).filter((i) => i >= 0);
      const order = CHAIR_ORDER[TABLES[ti]!.seats];
      members.forEach((c, k) => {
        c.seat = chairs[order[k]!]!;
        c.state = "waitOrder";
        c.max = c.patience = CONFIG.orderPatience;
      });
    }
  }

  private leaveAngry(c: Customer): void {
    this.customers = this.customers.filter((x) => x !== c);
    this.dropTicketsOf(c);
    this.angry++;
  }

  private dropTicketsOf(c: Customer): void {
    for (const t of this.tickets.filter((x) => x.customer === c.id)) this.dropTicket(t);
  }

  private dropTicket(t: Ticket): void {
    this.tickets = this.tickets.filter((x) => x !== t);
    for (let i = 0; i < this.stoves.length; i++) {
      const id = this.stoves[i];
      if (id !== null && id !== undefined && partTicket(id) === t.id) this.stoves[i] = null;
    }
    for (let i = 0; i < this.bars.length; i++) if (this.bars[i] === t.id) this.bars[i] = null;
    if (this.selFood === t.id) this.selFood = null;
    if (this.selDrink === t.id) this.selDrink = null;
  }

  private newTickets(kind: Kind): Ticket[] {
    return this.tickets.filter((t) => t.kind === kind && t.status === "new").sort((a, b) => a.id - b.id);
  }

  /** いま作る対象の注文。選んでいなければ一番古いもの */
  currentSelected(kind: Kind): number | null {
    const list = this.newTickets(kind);
    const sel = kind === "food" ? this.selFood : this.selDrink;
    if (sel !== null && list.some((t) => t.id === sel)) return sel;
    return list[0]?.id ?? null;
  }

  /** 作る対象を次の注文に切り替える。キッチンは料理、ホールはドリンク */
  cycle(role: Role): void {
    const kind: Kind = role === "kitchen" ? "food" : "drink";
    const list = this.newTickets(kind);
    if (list.length === 0) return;
    const cur = this.currentSelected(kind);
    const idx = list.findIndex((t) => t.id === cur);
    const next = list[(idx + 1) % list.length]!.id;
    if (kind === "food") this.selFood = next;
    else this.selDrink = next;
  }

  private count(status: TicketStatus, kind?: Kind): number {
    return this.tickets.filter((t) => t.status === status && (!kind || t.kind === kind)).length;
  }

  private ticketIn(slots: (number | null)[], i: number): Ticket | undefined {
    const id = slots[i];
    return id === null || id === undefined ? undefined : this.tickets.find((x) => x.id === id);
  }

  /** E キー。位置に応じて、注文を取る・作る・運ぶ・出す。結果の一言を返す */
  act(role: Role, x: number, z: number): string {
    if (this.phase !== "playing") return "";
    const target = nearestTarget(role, x, z);
    if (!target) return "";
    if (role === "hall") {
      if (target.kind === "seat") return this.hallSeat(target.i);
      return target.kind === "bar" ? this.hallBar(target.i) : this.hallPass();
    }
    if (target.kind === "stove") return this.kitchenStove(target.i);
    return target.kind === "fridge" ? this.kitchenFridge() : this.kitchenPass();
  }

  private hallSeat(seat: number): string {
    const c = this.customers.find((x) => x.seat === seat);
    if (!c) return "";
    if (c.state === "waitOrder") {
      for (const [kind, item] of [["food", c.dish], ["drink", c.drink]] as const) {
        const parts = kind === "food" ? DISHES[item]!.parts.map((ing) => ({ ing, st: "need" as const, left: 0 })) : [];
        this.tickets.push({ id: this.nextId++, kind, item, seat, customer: c.id, status: "new", left: 0, parts });
      }
      c.state = "waitFood";
      c.max = c.patience = CONFIG.foodPatience;
      return `${seatLabel(seat)}: ${dishName(c.dish)}と${drinkName(c.drink)}`;
    }
    const held = this.tickets.filter((t) => t.customer === c.id && t.status === "hall");
    if (held.length === 0) return c.state === "waitFood" ? "その席の料理もドリンクも持っていません" : "";
    const said: string[] = [];
    // ドリンクを先に出す。我慢ゲージが戻る
    for (const t of held.filter((x) => x.kind === "drink")) {
      this.dropTicket(t);
      c.drinkDone = true;
      if (c.state === "waitFood") {
        c.patience = Math.min(c.max, c.patience + c.max * (DRINKS[t.item]?.relief ?? 0));
        said.push(`${drinkName(t.item)}を出した(ゲージが戻った)`);
      } else {
        said.push(`${drinkName(t.item)}を出した`);
      }
    }
    for (const t of held.filter((x) => x.kind === "food")) {
      if (c.state !== "waitFood") continue;
      this.dropTicket(t);
      c.state = "eating";
      c.eatLeft = CONFIG.eatTime;
      said.push(`${dishName(t.item)}を出した`);
    }
    return said.join("、");
  }

  private hallBar(i: number): string {
    const t = this.ticketIn(this.bars, i);
    if (t) {
      if (t.status === "cooking") return "作っています";
      if (this.count("hall") >= CONFIG.holdHall) return "トレーがいっぱいです";
      t.status = "hall";
      this.bars[i] = null;
      return `${drinkName(t.item)}を取った`;
    }
    const next = this.tickets.find((x) => x.id === this.currentSelected("drink"));
    if (!next) return "ドリンクの注文がありません";
    next.status = "cooking";
    next.left = DRINKS[next.item]?.make ?? 1;
    this.bars[i] = next.id;
    this.selDrink = null;
    return `${seatLabel(next.seat)}の${drinkName(next.item)}を作り始めた`;
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

  /** キッチンが手に持っている食材(生のものと調理済みのもの) */
  private heldParts(): { t: Ticket; p: Part; idx: number }[] {
    const out: { t: Ticket; p: Part; idx: number }[] = [];
    for (const t of this.tickets) {
      t.parts.forEach((p, idx) => {
        if (p.st === "raw" || p.st === "cooked") out.push({ t, p, idx });
      });
    }
    return out;
  }

  /** 冷蔵庫: 選んでいる注文(なければ一番古い注文)の食材を、手に持てるだけ取る */
  private kitchenFridge(): string {
    const room = CONFIG.holdKitchen - this.heldParts().length;
    if (room <= 0) return "手がいっぱいです";
    const list = this.tickets.filter((t) => t.kind === "food" && t.status === "new" && t.parts.some((p) => p.st === "need")).sort((a, b) => a.id - b.id);
    const t = list.find((x) => x.id === this.selFood) ?? list[0];
    if (!t) return "取る食材がありません";
    const names: string[] = [];
    for (const p of t.parts) {
      if (p.st !== "need" || names.length >= room) continue;
      // 生で使うもの(そのまま)は、調理せずにそのまま盛り付けられる
      p.st = methodOfIngredient(p.ing) === "none" ? "cooked" : "raw";
      names.push(ingredientName(p.ing));
    }
    if (!t.parts.some((p) => p.st === "need")) this.selFood = null;
    return `${seatLabel(t.seat)} ${dishName(t.item)}: ${names.join("・")}を取った`;
  }

  /** 調理場: できあがりがあれば取る。空いていれば、持っている生の食材のうち合うものを調理に入れる */
  private kitchenStove(i: number): string {
    const station = STOVES[i]!;
    const id = this.stoves[i];
    if (id !== null && id !== undefined) {
      const t = this.tickets.find((x) => x.id === partTicket(id))!;
      const p = t.parts[partIndex(id)]!;
      if (p.st === "cooking") return `${METHOD_NAME[station.kind]}の最中です`;
      if (this.heldParts().length >= CONFIG.holdKitchen) return "手がいっぱいです";
      p.st = "cooked";
      this.stoves[i] = null;
      return `${ingredientName(p.ing)}を取った`;
    }
    const raws = this.heldParts().filter((h) => h.p.st === "raw");
    const fits = raws.filter((h) => methodOfIngredient(h.p.ing) === station.kind);
    if (fits.length === 0) {
      return raws.length === 0 ? "調理する食材を持っていません" : `${METHOD_NAME[station.kind]}で作れる食材がありません`;
    }
    fits.sort((a, b) => Number(b.t.id === this.selFood) - Number(a.t.id === this.selFood) || a.t.id - b.t.id || a.idx - b.idx);
    const { t, p, idx } = fits[0]!;
    p.st = "cooking";
    p.left = INGREDIENTS[p.ing]?.cook ?? 1;
    this.stoves[i] = partId(t.id, idx);
    return `${ingredientName(p.ing)}を${METHOD_VERB[station.kind]}`;
  }

  /** 盛り付け台: 調理済みの食材を置く。1皿ぶんそろうと完成して、受け渡し台に出る */
  private kitchenPass(): string {
    const cooked = this.heldParts().filter((h) => h.p.st === "cooked");
    if (cooked.length === 0) return "盛り付ける食材を持っていません";
    if (this.count("pass") >= CONFIG.passMax) return "受け渡し台がいっぱいです";
    const done: string[] = [];
    let remaining = 0;
    for (const { t, p } of cooked) {
      p.st = "plated";
      if (t.parts.every((x) => x.st === "plated") && t.status === "new") {
        t.status = "pass";
        done.push(dishName(t.item));
      }
    }
    if (done.length > 0) return `${done.join("・")}が完成`;
    const t = cooked[0]!.t;
    remaining = t.parts.filter((x) => x.st !== "plated").length;
    return `${dishName(t.item)}の食材を置いた(あと${remaining}つ)`;
  }

  snapshot(): GameSnapshot {
    const seats: (SeatSnapshot | null)[] = Array(this.seatCount).fill(null);
    for (const c of this.customers) {
      if (c.state === "queue") continue;
      const d = c.state === "waitOrder" ? 0 : c.drinkDone ? 2 : 1;
      seats[c.seat] = { id: c.id, dish: c.dish, drink: c.drink, s: c.state, p: c.state === "eating" ? 1 : Math.round((c.patience / c.max) * 100) / 100, d };
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
      tickets: this.tickets.map(({ id, kind, item, seat, status, parts }) => ({
        id,
        kind,
        item,
        seat,
        status,
        ...(kind === "food" ? { parts: parts.map((p) => ({ ing: p.ing, st: p.st })) } : {}),
      })),
      selFood: this.currentSelected("food"),
      selDrink: this.currentSelected("drink"),
      stoves: [...this.stoves],
      bars: [...this.bars],
    };
  }
}
