# ぴためし

条件にぴたっと合うお店が見つかる、飲食店検索サイト。
居酒屋からカフェまで、全国のお店を「個室」「喫煙可」「飲み放題」「宴会の人数」など細かい条件で探せます。

- 店舗データ:ホットペッパーグルメ Webサービス
- カフェ・駅のデータ:© OpenStreetMap contributors(ODbL)
- 収益:予約ボタンからホットペッパーへのアフィリエイト

## はじめかた

```bash
npm install
cp .env.example .env.local   # 値は空のままでも仮データで動く
npm run dev                  # http://localhost:3000
```

APIキーが空のときは、東京の「新宿」「銀座」周辺の架空のお店(仮データ)で動きます。

## よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm test` | テスト |
| `npm run typecheck` | 型チェック |
| `npm run build` | 本番ビルド |
| `npm run preview` | Cloudflare Workers と同じ環境で確認 |
| `npm run deploy` | Cloudflare に公開 |

## 公開までの準備

1. **ホットペッパーAPIキー**:https://webservice.recruit.co.jp/register で取得し、`HOTPEPPER_API_KEY` に設定
2. **Cloudflare**:アカウント作成 → `npx wrangler login` → `npx wrangler kv namespace create NEXT_INC_CACHE_KV` で作った id を `wrangler.jsonc` に設定 → `npx wrangler secret put HOTPEPPER_API_KEY` などで秘密情報を登録
3. **Supabase**:プロジェクトを作り、SQL Editor で `supabase/migrations/0001_init.sql` を実行。`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を設定
4. **OSMの取り込み**:GitHub の Secrets に Supabase の2つを登録し、Actions の「OSM import」を手動実行(以降は毎週自動)
5. **アフィリエイト**:バリューコマースで提携後、`AFFILIATE_URL_TEMPLATE` を設定
6. **公開**:GitHub の Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録すると、main に入れたときに自動で公開

詳しい状況と次の作業は [docs/status.md](docs/status.md)、開発のルールは [CLAUDE.md](CLAUDE.md) にあります。
