# CLAUDE.md — ぴためし

全国の飲食店を、ホットペッパーより細かい条件で探せる検索サイト。気に入った店が見つかったら、ホットペッパーの予約ページへアフィリエイトリンクで送る。
要件定義書(Claude Docs):https://claude.ai/code/artifact/5f98cc37-5aff-479c-bfa1-cde40ce66e78

## 技術構成
- Next.js(App Router, TypeScript)+ Tailwind CSS v4
- Cloudflare Workers 無料プラン(OpenNext アダプタ `@opennextjs/cloudflare`)
- Supabase(PostgreSQL + PostGIS)… OSMのカフェ・駅、カフェの独自属性、クリック記録
- テストは Node 標準の `node:test` を `tsx --test` で実行

## コマンド
- `npm run dev` 開発サーバー(APIキー未設定なら仮データで動く)
- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build`
- `npm run preview` Workers の実行環境で確認 / `npm run deploy` 公開

## 守ること(規約・要件。変更するときはユーザーに確認)
1. **ホットペッパーAPI**:全ページにクレジット表示(`src/components/Credits.tsx`)。キャッシュは24時間以内(`CACHE_SECONDS`)。店舗データをDBに保存しない。APIキーはサーバー側だけで使う(`src/lib/hotpepper/index.ts` は `server-only`)。
2. **OpenStreetMap(ODbL)**:出典表示必須。OSMデータ(`osm_*` テーブル)は書き換えない。独自データは `cafe_attributes` に分けて OSM ID で参照するだけ。ホットペッパーの店と OSM のカフェを重複排除して1つにまとめない。公開 Overpass API を定期利用しない(取り込みは `scripts/osm/import.ts` + Geofabrik の国別データ)。
3. **アフィリエイト**:予約ボタンの近くに PR 表記(`PrNotice`)。送り先はホットペッパーのURLだけ(`src/lib/affiliate.ts`)。`/go/[id]` は URL をクエリで受け取らない。
4. **Cloudflare 無料プランの制限**:1リクエストのCPU 10ms、Worker 3MiB、サブリクエスト数に上限。重いライブラリ(supabase-js など)を入れない。サーバー側絞り込みでAPIを呼ぶページ数は `MAX_API_PAGES`(engine.ts)。
5. **仮データは開発時だけ**:`HOTPEPPER_API_KEY` があるときは架空の店・カフェ・駅を絶対に出さない(`devMockAllowed`)。
6. 喫煙の表示には「来店前に確認」「20歳未満は喫煙できる席に入れない」を添える。

## コードの地図
- `src/lib/search/filters.ts` 絞り込み項目の定義(カテゴリ・リリース・説明)
- `src/lib/search/presets.ts` 目的別プリセット15種(`CURRENT_RELEASE` 以下を表示)
- `src/lib/search/query.ts` 検索条件 ⇔ URL(共有URL、U-05)
- `src/lib/search/engine.ts` 検索の本体。APIだけで済む場合と、サーバー側で絞る場合(予算3帯以上・人数上限・席数・喫煙・駅徒歩・お酒の「どれか」・独自の並び順)を分けている。0件時の提案(U-02)もここ
- `src/lib/search/interpret.ts` 店舗データの自由記述(「あり」「貸切不可」など)の解釈、喫煙判定
- `src/lib/search/hours.ts` 営業時間の解析と「今営業中」の判定(日本時間)
- `src/lib/browser/` ブラウザ(localStorage)に保存するもの:最近使った条件(U-06)、お気に入り(F-12、店舗IDだけ)
- `src/lib/seo.ts` 構造化データ(JSON-LD)
- `src/lib/hotpepper/` APIクライアント・型・マスタ・仮データ(`fixtures.ts`, `mock.ts`)
- `src/lib/osm/` カフェ・駅(`providers.ts` が Supabase、`cafes.ts` が仮データと絞り込み)
- `src/app/` 画面。`/search` 検索結果、`/shop/[id]` 詳細、`/area/[area]/[genre]` 集客用ページ、`/cafes` カフェ、`/go/[id]` 送客、`/favorites` お気に入り、`/api/count` 件数
- `supabase/migrations/` テーブルとRPC関数(0002 は閉店チェック C-04)
- `scripts/osm/` OSM取り込み(`import.ts`)と閉店チェック(`check-closed.ts`)
- `.github/workflows/` CI・公開、OSM週次取り込み

## 要件定義書のID
F-xx 機能 / S-xx 絞り込み強化 / C-xx カフェ / U-xx 使いやすさ。コメントにIDを書いてあるので、要件との対応はIDで検索できる。

## まだ確認できていないこと(最初にやる)
`docs/status.md` を参照。コードだけで作れる機能はリリース3まで実装済み。次はホットペッパーAPIの実データでの確認と、Cloudflare・Supabase の準備。「決めてほしいこと」はユーザーに確認する。
