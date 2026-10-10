// クライアントとサーバーがやり取りするメッセージ。

import type { GameSnapshot } from "./game";
import type { PlayerSnapshot, Role } from "./room";

export type ClientMessage =
  | { t: "role"; role: Role }
  // mx: 右(+)/左(-)、mz: 前(+)/後(-)。どちらも -1〜1。yaw は向き(ラジアン)
  | { t: "input"; mx: number; mz: number; yaw: number }
  | { t: "act" } // E キー
  | { t: "next" } // 調理する注文の切り替え
  | { t: "restart" }
  // ボットのプレイを眺めるとき(src/client/net-bots.ts)だけ使う。swap: 見る目線を切り替える / fast: 早送り
  | { t: "watch"; cmd: "swap" | "fast" };

export type ServerMessage =
  | { t: "welcome"; id: string; spectate?: boolean } // spectate: 動かせない、眺めるだけ
  | { t: "state"; players: PlayerSnapshot[] }
  | { t: "game"; g: GameSnapshot }
  | { t: "info"; text: string }
  | { t: "error"; reason: "full" | "role-taken" | "bad-message" };

export const ROOM_CODE = /^[A-Z]{4}$/;
