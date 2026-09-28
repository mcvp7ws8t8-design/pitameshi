/**
 * OSMのカフェ・駅を Supabase に取り込む(C-01)。GitHub Actions から週1回実行する(.github/workflows/osm-import.yml)。
 *
 * 事前に osmium で日本の国別データから必要な部分だけを GeoJSON Lines にしておく:
 *   osmium tags-filter japan-latest.osm.pbf nwr/amenity=cafe -o cafes.osm.pbf
 *   osmium export cafes.osm.pbf --add-unique-id=type_id -f geojsonseq -o data/cafes.geojsonseq
 *   (駅も同様に nwr/railway=station,halt → data/stations.geojsonseq)
 *
 * 使い方:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/osm/import.ts data/cafes.geojsonseq data/stations.geojsonseq
 *
 * データの出典表示(© OpenStreetMap contributors)はサイトのフッターに出している(src/components/Credits.tsx)。
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { toCafeRow, toStationRow, type OsmFeature } from "./transform";

const BATCH = 1000;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

async function call(path: string, body: unknown, prefer?: string) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers: prefer ? { ...headers, Prefer: prefer } : headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
}

async function importFile<T extends { osm_id: string }>(file: string, table: string, toRow: (f: OsmFeature) => T | undefined) {
  const rl = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
  const seen = new Set<string>();
  let batch: T[] = [];
  let total = 0;
  let skipped = 0;
  for await (const rawLine of rl) {
    // geojsonseq は各行の先頭に RS(0x1E)が付くことがある
    const line = rawLine.replace(/^\x1e/, "").trim();
    if (!line) continue;
    const row = toRow(JSON.parse(line) as OsmFeature);
    if (!row || seen.has(row.osm_id)) {
      skipped++;
      continue;
    }
    seen.add(row.osm_id);
    batch.push(row);
    if (batch.length >= BATCH) {
      await call(table, batch, "return=minimal");
      total += batch.length;
      batch = [];
    }
  }
  if (batch.length) {
    await call(table, batch, "return=minimal");
    total += batch.length;
  }
  console.log(`${table}: ${total}件を入れました(除外 ${skipped}件)`);
  return total;
}

async function main() {
  const [cafesFile, stationsFile] = process.argv.slice(2);
  if (!cafesFile) {
    console.error("使い方: tsx scripts/osm/import.ts <cafes.geojsonseq> [stations.geojsonseq]");
    process.exit(1);
  }
  await call("rpc/begin_osm_import", {});
  const cafes = await importFile(cafesFile, "osm_cafes_staging", toCafeRow);
  // 取り込みが極端に少ないときは、元データの異常とみなして本番テーブルを入れ替えない
  if (cafes < 1000) throw new Error(`カフェが${cafes}件しかありません。元データを確認してください(入れ替えは中止)`);
  await call("rpc/replace_osm_cafes", {});
  if (stationsFile) {
    const stations = await importFile(stationsFile, "osm_stations_staging", toStationRow);
    if (stations < 1000) throw new Error(`駅が${stations}件しかありません(入れ替えは中止)`);
    await call("rpc/replace_osm_stations", {});
  }
  console.log("完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
