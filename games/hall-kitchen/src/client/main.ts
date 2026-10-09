// サーバー版の入口。通信のしかたを渡して、画面(app.ts)を動かす。
import { startApp } from "./app";
import { wsNet } from "./net-ws";

startApp(wsNet);
