# ホール&キッチン

2人がオンラインで、1人はホール、1人はキッチンを担当して、お店を回す一人称視点の3Dゲーム。
ぴためし本体とは別のプロジェクト(別の Worker)。ルートの `npm test` / `typecheck` / `build` には含まれない。

## いまできること(最小版)
- 部屋コード(英字4文字)で2人が同じ部屋に入る
- ホール / キッチンを選ぶ(同じ役割は選べない、3人目は入れない)
- 一人称で歩く(WASD + マウス、クリックで視点操作を開始)。ホールとキッチンの間のカウンターは越えられない
- カウンターの窓越しに相手が見える

注文・料理・お客さん・売上はまだない。

## コマンド
```
cd games/hall-kitchen
npm install
npm test            # 動きのルール(src/shared/room.ts)のテスト
npm run typecheck
npm run build && npx wrangler dev   # http://localhost:8787 を2つのタブで開く
npm run deploy      # Cloudflare に公開(Durable Objects を使う)
```

## 構成
- `src/shared/room.ts` 部屋の状態と動きのルール。サーバーとクライアントで共有
- `src/shared/protocol.ts` 通信メッセージ
- `src/server/index.ts` Worker と、1部屋 = 1つの Durable Object(WebSocket)
- `src/client/` Three.js の画面と操作
