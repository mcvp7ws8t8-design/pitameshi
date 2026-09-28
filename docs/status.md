# 開発の状況と次にやること

2026-09-28 時点。Claude(claude.ai)で作成した最初の雛形。

## 作ったもの

| 要件ID | 内容 | 状態 |
| --- | --- | --- |
| F-01〜F-05 | 店舗検索・一覧・詳細・予約リンク・エリア×ジャンルページ | 実装済み |
| F-07 | クレジット・PR表記・運営者情報・プライバシーポリシー・免責事項・問い合わせ | 実装済み(文面はひな形) |
| F-08 | 現在地から探す | 実装済み |
| 絞り込み | APIで絞れる全項目(29項目)+サーバー側の条件 | 実装済み |
| S-01 | 目的別プリセット15種(一人飲みは試験中で非表示) | 実装済み |
| S-02 | お酒の「どれか」 | 実装済み |
| S-03 | 喫煙可・分煙・全席禁煙 | 実装済み(判定ルールは実データで要調整) |
| S-04〜S-06 | 条件バッジ・条件チップ・並び替え | 実装済み |
| U-01〜U-05, U-07, U-08 | 段階表示・0件時の提案・件数表示・件数ボタン・URL共有・不明の扱い・用語説明 | 実装済み |
| C-01, C-02 | OSMカフェの取り込み・カフェ検索 | 実装済み(実データ未取り込み) |
| 駅から徒歩○分 | OSMの駅データから計算 | 実装済み(実データ未取り込み) |
| C-03 | カフェの独自属性 | 表示・絞り込みは実装済み。登録はSupabaseの画面から直接(管理画面はなし) |
| C-04, 今営業中, U-06, ログイン | リリース3 | 未着手 |

## 確認できたこと
- 検索ロジック・URL変換・喫煙判定・集計・OSM変換などのテスト 36件がすべて成功(`npm test`)
- ライブラリ部分は TypeScript の strict モードで型エラーなし
- 全画面を仮データでサーバー描画し、例外なく表示されることを確認(検索・0件・現在地・詳細・エリア・カフェ・固定ページ)

## 初回ビルドの確認(2026-09-28、Claude Code)
入ったバージョン:Next.js 16.3.6 / @opennextjs/cloudflare 1.20.6 / wrangler 4.143.0 / Tailwind 4.3.3

- [x] `npm install` → `npm run typecheck` / `npm test`(36件)/ `npm run build` が修正なしで通った(Next.js が `tsconfig.json` の `jsx` などを自動で書き換えたので、それをコミット)
- [x] `open-next.config.ts` の KV キャッシュの import パスは今のままで正しい(`opennextjs-cloudflare build` が成功)
- [x] Worker のサイズ:gzip 後 1,125KiB(上限 3MiB の約37%)。`npx wrangler deploy --dry-run` で確認
- [x] `npm run preview`(Workers の実行環境)で全画面が 200 で表示される。存在しない店は 404、`/go/[id]` は 302
- [x] スマホ幅(390px)・PC幅(1280px)で、トップ・検索結果・0件・詳細・エリア・カフェを表示。Tailwind が当たり、横スクロールもブラウザのエラーもなし
- [x] 直したこと:トップ・サイトマップ・robots.txt・canonical の基準URLはビルド時に静的に作られるため、wrangler の `vars.SITE_URL` が使われず `http://localhost:3000` になっていた。公開ジョブでは GitHub Variables の `SITE_URL` をビルド時に渡し、未設定なら公開を止めるようにした
- [x] `package-lock.json` をコミットし、CI を `npm ci` に戻した

## 確認できていないこと
- [ ] CPU 10ms に収まるか(ローカルの preview では測れない。公開後に Cloudflare のダッシュボードで CPU 時間を見る)
- [ ] スマホ実機での操作(タップ・現在地の許可など)
- [ ] ホットペッパーAPIの実データでの動作(マスタのコード、自由記述の文言、喫煙の表記)

## 次にやること(順番)
1. ~~`npm install` して `npm run build` を通す~~(済み)
2. `.env.local` を作って `npm run dev` で画面を確認(まずは仮データのまま。上の確認で主な画面は表示できている)
3. ホットペッパーAPIキーを入れて実データで確認し、次を調整する
   - `src/lib/hotpepper/masters.ts` の予備の値(ジャンル・予算コード)
   - `src/lib/search/interpret.ts` の「あり/なし」と喫煙の判定ルール
   - `src/components/Credits.tsx` のクレジットを、ご利用案内の指定HTMLに差し替え
   - 誕生日・女子会プリセットのキーワードを、特集マスタAPIのコードに置き換え
4. Cloudflare のアカウントを作り、KV を作成して `wrangler.jsonc` の id と `vars.SITE_URL` を差し替え、GitHub の Variables に `SITE_URL`、Secrets に `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を設定
5. Supabase を作り、`supabase/migrations/0001_init.sql` を実行。GitHub の Secrets を設定して OSM 取り込みを手動実行
6. バリューコマースで提携後、`AFFILIATE_URL_TEMPLATE` を設定
7. `src/lib/landing.ts` に、実データで件数が十分なエリア×ジャンルを追加

## メモ
- ESLint は入れていない(Next.js 16 で `next lint` がなくなったため、必要になったら ESLint の flat config で追加する)
