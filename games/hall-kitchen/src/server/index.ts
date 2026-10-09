// Worker 本体と、1部屋 = 1つの Durable Object。
// Durable Object は黙っている間にメモリが消える(ハイバネーション)ので、
// 各プレイヤーの状態は WebSocket の attachment に入れておき、起きたときに戻す。

import { DurableObject } from "cloudflare:workers";
import { ROOM_CODE, type ClientMessage, type ServerMessage } from "../shared/protocol";
import { RoomState, type Player } from "../shared/room";

interface Env {
  ROOM: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const m = /^\/ws\/([A-Za-z]{4})$/.exec(url.pathname);
    if (!m) return env.ASSETS.fetch(request);
    const code = m[1]!.toUpperCase();
    if (!ROOM_CODE.test(code)) return new Response("bad room code", { status: 400 });
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class Room extends DurableObject<Env> {
  private state = new RoomState();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    for (const ws of ctx.getWebSockets()) {
      const p = ws.deserializeAttachment() as Player | null;
      if (p) this.state.players.set(p.id, p);
    }
  }

  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    const id = crypto.randomUUID();
    if (this.state.join(id) === "full") {
      server.send(JSON.stringify({ t: "error", reason: "full" } satisfies ServerMessage));
      server.close(1008, "full");
      return new Response(null, { status: 101, webSocket: client });
    }
    this.save(server, id);
    server.send(JSON.stringify({ t: "welcome", id } satisfies ServerMessage));
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    const me = ws.deserializeAttachment() as Player | null;
    if (!me || typeof raw !== "string") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return this.send(ws, { t: "error", reason: "bad-message" });
    }
    if (msg.t === "role") {
      if (msg.role !== "hall" && msg.role !== "kitchen") {
        return this.send(ws, { t: "error", reason: "bad-message" });
      }
      if (this.state.setRole(me.id, msg.role) === "role-taken") {
        return this.send(ws, { t: "error", reason: "role-taken" });
      }
    } else if (msg.t === "input") {
      this.state.input(me.id, msg.mx, msg.mz, msg.yaw, Date.now());
    } else {
      return this.send(ws, { t: "error", reason: "bad-message" });
    }
    this.save(ws, me.id);
    this.broadcast();
  }

  webSocketClose(ws: WebSocket): void {
    const me = ws.deserializeAttachment() as Player | null;
    if (me) this.state.leave(me.id);
    ws.close();
    this.broadcast();
  }

  webSocketError(ws: WebSocket): void {
    this.webSocketClose(ws);
  }

  private save(ws: WebSocket, id: string): void {
    const p = this.state.players.get(id);
    if (p) ws.serializeAttachment(p);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg));
  }

  private broadcast(): void {
    const data = JSON.stringify({ t: "state", players: this.state.snapshot() } satisfies ServerMessage);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // 切れかけの接続は close イベントで片付く
      }
    }
  }
}
