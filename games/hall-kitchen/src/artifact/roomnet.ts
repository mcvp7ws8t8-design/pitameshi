// Claude の画面(Artifact)の中で動く通信。サーバーは使わず、同じページを開いている人どうしを
// `room` 機能でつなぐ。部屋を作った人のページが「サーバー役(ホスト)」になり、ゲームの進行を計算して
// 相手に配る。入った人(ゲスト)は操作を送り、結果を受け取って表示する。
//
// 使う送信は次の4種類(Artifact を公開するときに、この4つを「操作できる人なら送れる」にしておく):
//   hk_cmd  ゲスト → ホスト   入室・役割の選択・E キーなどの操作
//   hk_s    ホスト → 全員     2人の位置と向き(変わったときだけ)
//   hk_g    ホスト → 全員     ゲームの状態(4KB の上限があるので、何通かに分けて送る)
//   hk_i    ホスト → 1人      入室の返事・E キーの結果の一言・エラー
// ゲストの歩く操作は、1秒に何十回も送るので、送信ではなく presence(自分の状態)で伝える。

import { Game, type GameSnapshot, type TicketSnapshot } from "../shared/game";
import type { ClientMessage, ServerMessage } from "../shared/protocol";
import { RoomState } from "../shared/room";
import type { NetFactory, NetHandlers } from "../client/app";

/** room 機能のうち、ここで使う部分 */
interface Peer {
  peer: string;
  isMe: boolean;
  sameTab: boolean;
  presence: Readonly<Record<string, unknown>>;
}
interface Message {
  peer: string;
  isMe: boolean;
  sameTab: boolean;
  data?: unknown;
}
interface NamedRoom {
  emit(topic: string, data?: unknown): Promise<void>;
  on(topic: string, handler: (msg: Message) => void, onError?: (e: { code: string }) => void): () => void;
  presence(patch: Record<string, unknown>): Promise<void>;
  peers(): readonly Peer[];
  onPeers(handler: (change: { peers: readonly Peer[]; left: readonly Peer[] }) => void): () => void;
  leave(): Promise<void>;
}
interface RoomApi {
  join(name: string): Promise<NamedRoom>;
}

export const TOPICS = ["hk_cmd", "hk_s", "hk_g", "hk_i"] as const;

const HOST = "host"; // ホスト自身のプレイヤー番号
/** 1回の送信は 4KiB まで。余裕をみて、これより小さく分ける */
const CHUNK_BYTES = 3300;

type Cmd = { t: "hello" } | Exclude<ClientMessage, { t: "input" }>;
type Info = { to: string; m: ServerMessage };
interface GameChunk {
  q: number; // 何回目の状態か
  i: number; // 何通目か
  n: number; // 全部で何通か
  g?: Omit<GameSnapshot, "tickets">; // 最初の1通
  k?: TicketSnapshot[]; // 注文の一部
}

/** 注文を、1通が CHUNK_BYTES に収まるように分ける */
export function chunkTickets(tickets: TicketSnapshot[]): TicketSnapshot[][] {
  const out: TicketSnapshot[][] = [];
  let cur: TicketSnapshot[] = [];
  let size = 0;
  for (const t of tickets) {
    const n = JSON.stringify(t).length + 1;
    if (cur.length > 0 && size + n > CHUNK_BYTES) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(t);
    size += n;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

export const roomNet: NetFactory = (code, create, h) => {
  const queue: ClientMessage[] = [];
  let impl: { send(m: ClientMessage): void; close(): void } | null = null;
  let closed = false;
  void (async () => {
    const claude = (window as unknown as { claude?: { use(name: string): Promise<unknown> } }).claude;
    const room = (await claude?.use("room")) as RoomApi | null | undefined;
    if (!room) return h.fail("このページでは相手とつながれません。共有された画面で開いてください");
    let r: NamedRoom;
    try {
      r = await room.join(`hk-${code.toLowerCase()}`);
    } catch {
      return h.fail("部屋に入れませんでした。もう一度試してください");
    }
    if (closed) return void r.leave();
    impl = create ? startHost(r, h) : startGuest(r, h);
    for (const m of queue) impl.send(m);
    queue.length = 0;
  })();
  return {
    send(m) {
      if (impl) impl.send(m);
      else queue.push(m);
    },
    close() {
      closed = true;
      impl?.close();
    },
  };
};

// ---- ホスト: ゲームの進行を計算する ----
function startHost(r: NamedRoom, h: NetHandlers) {
  const rs = new RoomState();
  const game = new Game(Date.now());
  rs.join(HOST);
  const remotes = new Set<string>();
  let seq = 0;
  let tick = 0;
  let lastState = "";
  let lastNow = Date.now();

  const toRemote = (to: string, m: ServerMessage) => void r.emit("hk_i", { to, m } satisfies Info).catch(() => {});
  const bothReady = () => {
    const roles = new Set([...rs.players.values()].map((p) => p.role));
    return roles.has("hall") && roles.has("kitchen");
  };
  const sync = () => {
    game.update(bothReady());
    pushGame();
  };

  function pushState() {
    const players = rs.snapshot();
    const json = JSON.stringify(players);
    if (json === lastState) return;
    lastState = json;
    h.message({ t: "state", players });
    if (remotes.size > 0) void r.emit("hk_s", { p: players }).catch(() => {});
  }

  function pushGame() {
    const g = game.snapshot();
    h.message({ t: "game", g });
    if (remotes.size === 0) return;
    const { tickets, ...base } = g;
    const chunks = chunkTickets(tickets);
    const q = ++seq;
    const n = 1 + chunks.length;
    void r.emit("hk_g", { q, i: 0, n, g: base } satisfies GameChunk).catch(() => {});
    chunks.forEach((k, i) => void r.emit("hk_g", { q, i: i + 1, n, k } satisfies GameChunk).catch(() => {}));
  }

  function handle(id: string, msg: Cmd | ClientMessage) {
    const mine = id === HOST;
    const say = (m: ServerMessage) => (mine ? h.message(m) : toRemote(id, m));
    if (msg.t === "hello") {
      if (!rs.players.has(id) && rs.join(id) === "full") return say({ t: "error", reason: "full" });
      remotes.add(id);
      say({ t: "welcome", id });
      pushState();
      return pushGame();
    }
    if (!rs.players.has(id)) return;
    if (msg.t === "role") {
      if (msg.role !== "hall" && msg.role !== "kitchen") return say({ t: "error", reason: "bad-message" });
      if (rs.setRole(id, msg.role) === "role-taken") return say({ t: "error", reason: "role-taken" });
      lastState = "";
      pushState();
      return sync();
    }
    if (msg.t === "input") return void rs.input(id, msg.mx, msg.mz, msg.yaw, Date.now());
    if (msg.t === "act") {
      const p = rs.players.get(id);
      const text = p?.role ? game.act(p.role, p.x, p.z) : "";
      if (text) say({ t: "info", text });
      return pushGame();
    }
    if (msg.t === "next") {
      const p = rs.players.get(id);
      if (p?.role) game.cycle(p.role);
      return pushGame();
    }
    if (msg.t === "restart") {
      game.restart(bothReady());
      return sync();
    }
  }

  function leave(id: string) {
    if (!rs.players.has(id)) return;
    rs.leave(id);
    remotes.delete(id);
    lastState = "";
    pushState();
    sync();
  }

  const offCmd = r.on("hk_cmd", (m) => {
    if (m.isMe) return;
    const d = m.data as Cmd | undefined;
    if (d && typeof d === "object" && typeof d.t === "string") handle(m.peer, d);
  });
  const offPeers = r.onPeers((change) => {
    for (const p of change.left) leave(p.peer);
  });
  void r.presence({ host: 1 }).catch(() => {});

  const timer = setInterval(() => {
    const now = Date.now();
    // ゲストの歩く操作は presence から読む
    for (const p of r.peers()) {
      if (p.isMe || !rs.players.has(p.peer)) continue;
      const { mx, mz, yaw } = p.presence as { mx?: number; mz?: number; yaw?: number };
      if (typeof mx === "number" && typeof mz === "number" && typeof yaw === "number") rs.input(p.peer, mx, mz, yaw, now);
    }
    if (game.phase === "countdown" || game.phase === "playing") game.tick(Math.min(0.5, (now - lastNow) / 1000));
    lastNow = now;
    pushState();
    // ゲームの状態は 3 回に 1 回(1秒に3〜4回)送る
    if (++tick % 3 === 0 && (game.phase === "countdown" || game.phase === "playing")) pushGame();
  }, 100);

  h.open();
  h.message({ t: "welcome", id: HOST });
  pushState();
  pushGame();

  return {
    send(m: ClientMessage) {
      handle(HOST, m);
    },
    close() {
      clearInterval(timer);
      offCmd();
      offPeers();
      void r.leave();
    },
  };
}

// ---- ゲスト: 操作を送り、ホストが計算した結果を表示する ----
function startGuest(r: NamedRoom, h: NetHandlers) {
  let me = "";
  let welcomed = false;
  let buf: { q: number; n: number; base?: GameChunk["g"]; parts: TicketSnapshot[][]; got: number } | null = null;

  const offSelf = r.on("hk_cmd", (m) => {
    if (m.isMe && m.sameTab) me = m.peer;
  });
  const offInfo = r.on("hk_i", (m) => {
    const d = m.data as Info | undefined;
    if (!d || d.to !== me || !d.m) return;
    if (d.m.t === "welcome" && !welcomed) {
      welcomed = true;
      h.open();
    }
    h.message(d.m);
  });
  const offState = r.on("hk_s", (m) => {
    const d = m.data as { p?: unknown } | undefined;
    if (welcomed && d && Array.isArray(d.p)) h.message({ t: "state", players: d.p as never });
  });
  const offGame = r.on("hk_g", (m) => {
    const c = m.data as GameChunk | undefined;
    if (!welcomed || !c || typeof c.q !== "number") return;
    if (!buf || c.q > buf.q) buf = { q: c.q, n: c.n, parts: [], got: 0 };
    if (c.q !== buf.q) return;
    if (c.i === 0) buf.base = c.g;
    else buf.parts[c.i - 1] = c.k ?? [];
    buf.got++;
    if (buf.got >= buf.n && buf.base) {
      h.message({ t: "game", g: { ...buf.base, tickets: buf.parts.flat() } });
      buf = null;
    }
  });
  const offPeers = r.onPeers((change) => {
    // ホストがいなくなったら終わり
    if (welcomed && !change.peers.some((p) => p.presence.host)) h.close();
  });

  // ホストに声をかける。返事がなければ、部屋がないとみなす
  let tries = 0;
  const hello = setInterval(() => {
    if (welcomed) return clearInterval(hello);
    if (++tries > 6) {
      clearInterval(hello);
      return h.fail("部屋が見つかりません。部屋を作った人が先に開いているか、コードを確かめてください");
    }
    void r.emit("hk_cmd", { t: "hello" } satisfies Cmd).catch(() => {});
  }, 1000);
  void r.emit("hk_cmd", { t: "hello" } satisfies Cmd).catch(() => {});

  return {
    send(m: ClientMessage) {
      if (m.t === "input") void r.presence({ mx: m.mx, mz: m.mz, yaw: m.yaw }).catch(() => {});
      else void r.emit("hk_cmd", m satisfies Cmd).catch(() => {});
    },
    close() {
      clearInterval(hello);
      offSelf();
      offInfo();
      offState();
      offGame();
      offPeers();
      void r.leave();
    },
  };
}
