// Claude の画面(Artifact)版の入口。通信は room を使う。
import { startApp } from "../client/app";
import { roomNet } from "./roomnet";

startApp(roomNet);
