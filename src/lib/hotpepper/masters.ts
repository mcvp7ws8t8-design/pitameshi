import type { CodeName } from "./types";

/**
 * マスタの初期値。
 * APIキーがあるときは src/lib/hotpepper/index.ts の getMasters() がマスタAPIから取り直すので、
 * ここは「仮データモード」と「API障害時の予備」として使う。
 * ※ 値はAPIキー取得後にジャンルマスタAPI・ディナー予算マスタAPIの結果と照合すること。
 */

export const FALLBACK_GENRES: CodeName[] = [
  { code: "G001", name: "居酒屋" },
  { code: "G002", name: "ダイニングバー・バル" },
  { code: "G003", name: "創作料理" },
  { code: "G004", name: "和食" },
  { code: "G005", name: "洋食" },
  { code: "G006", name: "イタリアン・フレンチ" },
  { code: "G007", name: "中華" },
  { code: "G008", name: "焼肉・ホルモン" },
  { code: "G017", name: "韓国料理" },
  { code: "G009", name: "アジア・エスニック料理" },
  { code: "G010", name: "各国料理" },
  { code: "G011", name: "カラオケ・パーティ" },
  { code: "G012", name: "バー・カクテル" },
  { code: "G013", name: "ラーメン" },
  { code: "G016", name: "お好み焼き・もんじゃ" },
  { code: "G014", name: "カフェ・スイーツ" },
  { code: "G015", name: "その他グルメ" },
];

/** ディナー予算。min/max は並び替え・表示用に円で持つ(APIの絞り込みはコードで行う)。 */
export type BudgetMaster = CodeName & { min: number; max: number };

export const FALLBACK_BUDGETS: BudgetMaster[] = [
  { code: "B009", name: "〜500円", min: 0, max: 500 },
  { code: "B010", name: "501〜1000円", min: 501, max: 1000 },
  { code: "B011", name: "1001〜1500円", min: 1001, max: 1500 },
  { code: "B001", name: "1501〜2000円", min: 1501, max: 2000 },
  { code: "B002", name: "2001〜3000円", min: 2001, max: 3000 },
  { code: "B003", name: "3001〜4000円", min: 3001, max: 4000 },
  { code: "B008", name: "4001〜5000円", min: 4001, max: 5000 },
  { code: "B004", name: "5001〜7000円", min: 5001, max: 7000 },
  { code: "B005", name: "7001〜10000円", min: 7001, max: 10000 },
  { code: "B006", name: "10001〜15000円", min: 10001, max: 15000 },
  { code: "B012", name: "15001〜20000円", min: 15001, max: 20000 },
  { code: "B013", name: "20001〜30000円", min: 20001, max: 30000 },
  { code: "B014", name: "30001円〜", min: 30001, max: Number.POSITIVE_INFINITY },
];

export type AreaMaster = CodeName & { parent?: string; level: "large" | "middle" };

/** 仮データモード用のエリア(コードはAPIリファレンスの例に出てくるもの) */
export const FALLBACK_AREAS: AreaMaster[] = [
  { code: "Z011", name: "東京", level: "large" },
  { code: "Y005", name: "銀座・有楽町・新橋・築地・月島", parent: "Z011", level: "middle" },
  { code: "Y055", name: "新宿", parent: "Z011", level: "middle" },
];

export function budgetRange(codes: string[], budgets: BudgetMaster[] = FALLBACK_BUDGETS) {
  const picked = budgets.filter((b) => codes.includes(b.code));
  if (picked.length === 0) return undefined;
  return {
    min: Math.min(...picked.map((b) => b.min)),
    max: Math.max(...picked.map((b) => b.max)),
  };
}

/**
 * 円の範囲に重なる予算コードをすべて返す。
 * APIに渡せるのは2つまで(API仕様)なので、3つ以上になった場合は
 * 検索エンジン側でAPIには渡さず、取得後にサーバー側で絞り込む(src/lib/search/engine.ts)。
 */
export function budgetCodesFor(minYen: number, maxYen: number, budgets: BudgetMaster[] = FALLBACK_BUDGETS): string[] {
  return budgets.filter((b) => b.max >= minYen && b.min <= maxYen).map((b) => b.code);
}
