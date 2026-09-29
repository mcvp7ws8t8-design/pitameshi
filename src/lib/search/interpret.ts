import type { HotpepperShop } from "../hotpepper/types";
import { FALLBACK_BUDGETS, type BudgetMaster } from "../hotpepper/masters";

/**
 * ホットペッパーの店舗データは「あり」「なし」「貸切可」「お子様連れ歓迎」など自由な文言で返ってくるので、
 * ここで はい / いいえ / 不明 に解釈する。判定ルールは実データを見て調整すること(要件定義書の未決事項)。
 */
export type TriState = true | false | undefined;

const NO_WORDS = ["なし", "不可", "ない", "ＮＧ", "NG", "いない", "禁止", "未対応"];
const UNKNOWN_WORDS = ["未確認", "不明", "要問合せ", "要問い合わせ", "お問い合わせ"];
const YES_WORDS = ["あり", "可", "OK", "ＯＫ", "歓迎", "いる", "営業している", "利用可", "できる"];

export function yesNo(value: string | undefined | null): TriState {
  if (!value) return undefined;
  // 実データは「あり ：個室の詳細はお問い合わせください」「貸切可 ：…貸切ができない場合もございます」のように
  // 「判定 ：補足」の形。補足の言葉に引きずられないよう、「：」より前だけで判定する。
  const v = value.split(/[：:]/)[0]!.trim();
  if (!v) return undefined;
  if (UNKNOWN_WORDS.some((w) => v.includes(w))) return undefined;
  // 「貸切不可」は「可」も含むので、否定語を先に見る
  if (NO_WORDS.some((w) => v.includes(w))) return false;
  if (YES_WORDS.some((w) => v.includes(w))) return true;
  return undefined;
}

export type SmokingClass = "ok" | "separated" | "none" | "unknown";

/**
 * 「禁煙席」項目の記載から喫煙の可否を判定する(S-03)。
 * 例: 全面禁煙 → none / 一部禁煙 → separated / 禁煙席なし → ok
 */
export function classifySmoking(value: string | undefined | null): SmokingClass {
  if (!value) return "unknown";
  const v = value.replace(/\s/g, "");
  if (!v || UNKNOWN_WORDS.some((w) => v.includes(w))) return "unknown";
  if (/(全面禁煙|全席禁煙|完全禁煙|店内禁煙)/.test(v)) return "none";
  if (/(一部禁煙|一部喫煙|分煙|喫煙専用室|喫煙室|加熱式|喫煙ブース|時間帯)/.test(v)) return "separated";
  if (/(禁煙席なし|全面喫煙|全席喫煙|喫煙可)/.test(v)) return "ok";
  return "unknown";
}

export const SMOKING_LABEL: Record<SmokingClass, string> = {
  ok: "喫煙可",
  separated: "分煙",
  none: "全席禁煙",
  unknown: "喫煙:不明",
};

/** 喫煙の絞り込み条件に合うか。「喫煙できる」は分煙も含む。 */
export function matchesSmoking(cls: SmokingClass, filter: "ok" | "separated" | "none", includeUnknown: boolean): boolean {
  if (cls === "unknown") return includeUnknown;
  if (filter === "ok") return cls === "ok" || cls === "separated";
  return cls === filter;
}

/** "185" や "185名" や 185 → 185。取れなければ undefined */
export function parseCount(value: number | string | undefined | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  const m = value.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).match(/\d+/);
  if (!m) return undefined;
  const n = Number.parseInt(m[0], 10);
  return n > 0 ? n : undefined;
}

/**
 * 予算の目安(円)。並び替え用。
 * 平均予算の文言(例「3000円」「宴会3500円」)から最初の金額を拾い、なければ予算コードの中間値を使う。
 */
export function estimateBudgetYen(shop: HotpepperShop, budgets: BudgetMaster[] = FALLBACK_BUDGETS): number | undefined {
  const avg = shop.budget?.average;
  if (avg) {
    const normalized = avg.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).replace(/,/g, "");
    // 「3000円」を優先し、なければ「3500」のような円のない数字も拾う
    const m = normalized.match(/(\d{3,6})\s*円/) ?? normalized.match(/^\s*(\d{3,6})\s*$/);
    if (m) return Number.parseInt(m[1]!, 10);
  }
  const master = budgets.find((b) => b.code === shop.budget?.code);
  if (!master) return undefined;
  return Number.isFinite(master.max) ? Math.round((master.min + master.max) / 2) : master.min;
}

export function hasCoupon(shop: HotpepperShop): boolean {
  // ktai_coupon: 0 = あり、1 = なし(API仕様)
  return String(shop.ktai_coupon) === "0" || Boolean(shop.coupon_urls?.sp || shop.coupon_urls?.pc);
}

export function shopLatLng(shop: HotpepperShop): { lat: number; lng: number } | undefined {
  const lat = typeof shop.lat === "number" ? shop.lat : Number.parseFloat(shop.lat);
  const lng = typeof shop.lng === "number" ? shop.lng : Number.parseFloat(shop.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
}
