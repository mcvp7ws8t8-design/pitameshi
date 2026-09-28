/**
 * ホットペッパーAPIの実データと、コード内の前提(予備マスタ・自由記述の解釈・プリセット)を突き合わせる確認用スクリプト。
 * 使い方: HOTPEPPER_API_KEY=... npm run hp:check
 *
 * 規約上、店舗データは保存しない。このスクリプトも画面に集計結果を出すだけで、ファイルには書き出さない。
 */
import { createApiBackend, fetchMaster } from "../../src/lib/hotpepper/client";
import { FALLBACK_BUDGETS, FALLBACK_GENRES } from "../../src/lib/hotpepper/masters";
import type { HotpepperShop } from "../../src/lib/hotpepper/types";
import { LANDING_PAGES, MIN_SHOPS_FOR_INDEX } from "../../src/lib/landing";
import { classifySmoking, estimateBudgetYen, yesNo } from "../../src/lib/search/interpret";

const key = process.env.HOTPEPPER_API_KEY;
if (!key) {
  console.error("HOTPEPPER_API_KEY が設定されていません");
  process.exit(1);
}

/** yesNo() で解釈している項目 */
const YES_NO_FIELDS = [
  "wifi", "course", "free_drink", "free_food", "private_room", "horigotatsu", "tatami", "card", "charter",
  "parking", "barrier_free", "sommelier", "open_air", "show", "karaoke", "band", "tv", "english", "pet",
  "child", "lunch", "midnight",
] as const satisfies readonly (keyof HotpepperShop)[];

/** 地域をまたいで集めるための大エリア(名前で大エリアマスタから選ぶ) */
const SAMPLE_AREA_NAMES = ["東京", "大阪", "愛知", "福岡", "北海道", "沖縄"];

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

function compareMaster(label: string, fallback: { code: string; name: string }[], actual: { code: string; name: string }[]) {
  section(`${label}マスタ(予備の値との差)`);
  const byCode = new Map(actual.map((a) => [a.code, a.name]));
  let diff = 0;
  for (const f of fallback) {
    const name = byCode.get(f.code);
    if (name === undefined) { console.log(`  予備にだけある: ${f.code} ${f.name}`); diff++; }
    else if (name !== f.name) { console.log(`  名前が違う: ${f.code} 予備「${f.name}」→ API「${name}」`); diff++; }
  }
  const fallbackCodes = new Set(fallback.map((f) => f.code));
  for (const a of actual) {
    if (!fallbackCodes.has(a.code)) { console.log(`  APIにだけある: ${a.code} ${a.name}`); diff++; }
  }
  console.log(diff === 0 ? "  差はありません" : `  差: ${diff}件`);
}

async function main() {
  const backend = createApiBackend(key!);

  // 1. マスタ
  const [genres, budgets, largeAreas, specials] = await Promise.all([
    fetchMaster(key!, "genre", "genre"),
    fetchMaster(key!, "budget", "budget"),
    fetchMaster(key!, "large_area", "large_area"),
    fetchMaster(key!, "special", "special"),
  ]);
  compareMaster("ジャンル", FALLBACK_GENRES, genres);
  compareMaster("ディナー予算", FALLBACK_BUDGETS, budgets);

  section("大エリア(サンプルに使うもの)");
  const sampleAreas = SAMPLE_AREA_NAMES.flatMap((name) => largeAreas.filter((a) => a.name.startsWith(name)).slice(0, 1));
  console.log(`  ${sampleAreas.map((a) => `${a.code} ${a.name}`).join(" / ")}(大エリアは全${largeAreas.length}件)`);

  section("特集マスタ(誕生日・記念日・女子会プリセット用)");
  const wanted = /誕生|記念|女子|サプライズ|お祝い/;
  for (const s of specials.filter((s) => wanted.test(s.name))) {
    const cat = s.special_category as { code?: string; name?: string } | undefined;
    console.log(`  ${s.code} ${s.name}(カテゴリ: ${cat?.code ?? "-"} ${cat?.name ?? ""})`);
  }

  // 2. 店舗データの自由記述(集計だけ出し、店舗データは保存しない)
  const shops: HotpepperShop[] = [];
  for (const area of sampleAreas) {
    const page = await backend.search({ large_area: area.code, count: "100" });
    shops.push(...page.shops);
  }
  section(`自由記述の解釈(サンプル ${shops.length}店)`);
  for (const field of YES_NO_FIELDS) {
    const counts = new Map<string, number>();
    for (const shop of shops) {
      const v = shop[field];
      if (typeof v === "string") counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const lines = [...counts].sort((a, b) => b[1] - a[1]).map(([v, n]) => {
      const r = yesNo(v);
      return `${r === undefined ? "?" : r ? "○" : "×"} 「${v}」×${n}`;
    });
    console.log(`  ${field}: ${lines.join(" / ")}`);
  }

  section("禁煙席(non_smoking)の判定");
  const smoking = new Map<string, number>();
  for (const shop of shops) if (shop.non_smoking !== undefined) smoking.set(shop.non_smoking, (smoking.get(shop.non_smoking) ?? 0) + 1);
  for (const [v, n] of [...smoking].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${classifySmoking(v).padEnd(9)} 「${v}」×${n}`);
  }

  section("平均予算の文言から金額が取れなかったもの");
  const failed = shops.filter((s) => s.budget?.average && estimateBudgetYen(s, []) === undefined).map((s) => s.budget!.average!);
  console.log(failed.length === 0 ? "  なし" : [...new Set(failed)].slice(0, 30).map((v) => `  「${v}」`).join("\n"));

  // 3. エリア×ジャンルページの件数(F-05)
  section(`エリア×ジャンルページの件数(${MIN_SHOPS_FOR_INDEX}件未満は noindex)`);
  for (const p of LANDING_PAGES) {
    const page = await backend.search({ middle_area: p.area, genre: p.genre, count: "1" });
    console.log(`  ${p.area} × ${p.genre}: ${page.total}件${page.total < MIN_SHOPS_FOR_INDEX ? "(不足)" : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
