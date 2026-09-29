// 公開時(GitHub Actions)に、Workers に渡す秘密情報を JSON ファイルに書き出す。
// 値が空のものは書かない(Cloudflare 側の既存の値を消さないため)。
// 使い方: node scripts/cf/write-secrets.mjs .secrets.json
import { writeFileSync } from "node:fs";

const NAMES = [
  "HOTPEPPER_API_KEY",
  "AFFILIATE_URL_TEMPLATE",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SITE_URL",
  "OPERATOR_NAME",
  "CONTACT_FORM_URL",
];

const out = process.argv[2];
if (!out) throw new Error("出力先のファイル名を指定してください");

const secrets = Object.fromEntries(NAMES.filter((n) => process.env[n]).map((n) => [n, process.env[n]]));
// APIキーなしで公開すると本番に仮データが出てしまうので止める(CLAUDE.md 守ること5)
if (!secrets.HOTPEPPER_API_KEY) throw new Error("GitHub の Secrets に HOTPEPPER_API_KEY がありません");
writeFileSync(out, JSON.stringify(secrets), { mode: 0o600 });
console.log(`Workers に渡す秘密情報: ${Object.keys(secrets).join(", ")}`);
