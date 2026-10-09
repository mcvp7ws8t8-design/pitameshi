// クライアントとサーバーがやり取りするメッセージ。

import type { PlayerSnapshot, Role } from "./room";

export type ClientMessage =
  | { t: "role"; role: Role }
  // mx: 右(+)/左(-)、mz: 前(+)/後(-)。どちらも -1〜1。yaw は向き(ラジアン)
  | { t: "input"; mx: number; mz: number; yaw: number };

export type ServerMessage =
  | { t: "welcome"; id: string }
  | { t: "state"; players: PlayerSnapshot[] }
  | { t: "error"; reason: "full" | "role-taken" | "bad-message" };

export const ROOM_CODE = /^[A-Z]{4}$/;
