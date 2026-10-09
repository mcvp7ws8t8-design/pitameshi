// サーバー(Cloudflare Worker の Durable Object)と WebSocket でつなぐ通信。

import type { ClientMessage, ServerMessage } from "../shared/protocol";
import type { NetFactory } from "./app";

export const wsNet: NetFactory = (code, _create, h) => {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/ws/${code}`);
  ws.onopen = () => h.open();
  ws.onclose = () => h.close();
  ws.onmessage = (ev) => h.message(JSON.parse(ev.data as string) as ServerMessage);
  return {
    send(msg: ClientMessage) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close() {
      ws.onclose = null;
      ws.close();
    },
  };
};
