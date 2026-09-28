import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

// ISR/fetch キャッシュを KV に保存する。
// ホットペッパーAPIの規約で「キャッシュは24時間以内に更新」が必要なため、
// fetch 側で revalidate: 86400(24時間)以下を必ず指定すること(src/lib/hotpepper/client.ts)。
// ※ import パスは @opennextjs/cloudflare のバージョンで変わることがあるので、
//   インストール後に公式ドキュメント(https://opennext.js.org/cloudflare/caching)で確認する。
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
