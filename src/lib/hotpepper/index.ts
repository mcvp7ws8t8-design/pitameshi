import "server-only";
import { createApiBackend, fetchMaster } from "./client";
import { FALLBACK_AREAS, FALLBACK_BUDGETS, FALLBACK_GENRES, type AreaMaster, type BudgetMaster } from "./masters";
import { createMockBackend } from "./mock";
import type { CodeName, HotpepperBackend, HotpepperShop } from "./types";

/**
 * サーバー側からだけ使う入口。APIキーはここでしか読まない(ブラウザに出さない)。
 * Cloudflare Workers では OpenNext が vars / secrets を process.env に入れてくれる。
 */

export function getBackend(): HotpepperBackend {
  const key = process.env.HOTPEPPER_API_KEY;
  return key ? createApiBackend(key) : createMockBackend();
}

export function isMockMode(): boolean {
  return !process.env.HOTPEPPER_API_KEY;
}

export type Masters = {
  genres: CodeName[];
  budgets: BudgetMaster[];
  areas: AreaMaster[];
};

/** 予算マスタの名前(例「2001～3000円」)から円の範囲を読む */
function budgetFromName(b: CodeName): BudgetMaster {
  const nums = (b.name.replace(/[,，]/g, "").match(/\d+/g) ?? []).map(Number);
  if (b.name.startsWith("～") || b.name.startsWith("〜")) return { ...b, min: 0, max: nums[0] ?? 0 };
  if (nums.length >= 2) return { ...b, min: nums[0]!, max: nums[1]! };
  return { ...b, min: nums[0] ?? 0, max: Number.POSITIVE_INFINITY };
}

/**
 * ジャンル・予算・エリアのマスタ。APIキーがあればマスタAPIから取得し、失敗したら予備の値を使う。
 * エリアは大エリア(都道府県相当)と中エリアを取得する。
 */
export async function getMasters(): Promise<Masters> {
  const key = process.env.HOTPEPPER_API_KEY;
  if (!key) return { genres: FALLBACK_GENRES, budgets: FALLBACK_BUDGETS, areas: FALLBACK_AREAS };
  try {
    const [genres, budgets, large, middle] = await Promise.all([
      fetchMaster(key, "genre", "genre"),
      fetchMaster(key, "budget", "budget"),
      fetchMaster(key, "large_area", "large_area"),
      fetchMaster(key, "middle_area", "middle_area"),
    ]);
    const areas: AreaMaster[] = [
      ...large.map((a) => ({ code: a.code, name: a.name, level: "large" as const })),
      ...middle.map((a) => ({
        code: a.code,
        name: a.name,
        level: "middle" as const,
        parent: (a.large_area as CodeName | undefined)?.code,
      })),
    ];
    return {
      genres: genres.map((g) => ({ code: g.code, name: g.name })),
      budgets: budgets.map((b) => budgetFromName({ code: b.code, name: b.name })),
      areas,
    };
  } catch (e) {
    console.error("[masters] マスタAPIの取得に失敗したため予備の値を使います", e);
    return { genres: FALLBACK_GENRES, budgets: FALLBACK_BUDGETS, areas: FALLBACK_AREAS };
  }
}

/** 店舗IDの形式(J + 数字)。外部から来た値をそのままAPIやリダイレクトに使わないために確認する。 */
export const SHOP_ID_RE = /^J\d{6,12}$/;

export async function getShop(id: string): Promise<HotpepperShop | undefined> {
  if (!SHOP_ID_RE.test(id)) return undefined;
  const page = await getBackend().search({ id });
  return page.shops[0];
}

/** 複数の店舗をまとめて取得する(お気に入り用。API仕様で20件まで)。渡した順に並べて返す。 */
export async function getShops(ids: string[]): Promise<HotpepperShop[]> {
  const valid = ids.filter((id) => SHOP_ID_RE.test(id)).slice(0, 20);
  if (valid.length === 0) return [];
  const page = await getBackend().search({ id: valid, count: String(valid.length) });
  const byId = new Map(page.shops.map((s) => [s.id, s]));
  return valid.map((id) => byId.get(id)).filter((s): s is HotpepperShop => Boolean(s));
}
