/**
 * 閉店チェック(C-04)。OSM の取り込みのあとに実行し、確認が必要な独自属性の一覧を出す。
 * GitHub Actions ではジョブの概要(GITHUB_STEP_SUMMARY)に表を書く。
 * 自動では closed を書き換えない(閉店・移転の扱いは運営者が確かめてから決める)。
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/osm/check-closed.ts
 */
import { appendFileSync } from "node:fs";
import { closureReport, findClosureIssues, type AttributeCheckRow } from "./closure";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください");
  process.exit(1);
}

async function main() {
  const res = await fetch(`${url}/rest/v1/rpc/cafe_attribute_checks`, {
    method: "POST",
    headers: { apikey: key!, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`cafe_attribute_checks: HTTP ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as AttributeCheckRow[];
  const findings = findClosureIssues(rows, new Date());
  const report = closureReport(findings, rows.length);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  // 消えた・店名が変わったものがあれば、Actions の画面で目立つように警告を出す(失敗にはしない)
  const urgent = findings.filter((f) => !f.reasons.every((r) => r === "stale")).length;
  if (urgent && process.env.GITHUB_ACTIONS) console.log(`::warning::閉店・移転の可能性があるカフェが ${urgent} 件あります`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
