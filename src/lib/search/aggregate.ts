import type { HotpepperShop } from "../hotpepper/types";
import { classifySmoking, parseCount, yesNo, type SmokingClass } from "./interpret";

/**
 * エリア×ジャンルページに載せる集計(F-05)。
 * ホットペッパーの一覧をそのまま並べるだけのページにしないよう、ぴためしが計算した情報を出す。
 */
export type AreaStats = {
  sampled: number;
  budgets: { name: string; count: number }[];
  smoking: Record<SmokingClass, number>;
  privateRoom: number;
  freeDrink: number;
  party20: number;
  midnight: number;
};

export function aggregate(shops: HotpepperShop[]): AreaStats {
  const budgetCounts = new Map<string, { name: string; count: number; order: number }>();
  const smoking: Record<SmokingClass, number> = { ok: 0, separated: 0, none: 0, unknown: 0 };
  let privateRoom = 0;
  let freeDrink = 0;
  let party20 = 0;
  let midnight = 0;
  for (const s of shops) {
    if (s.budget?.name) {
      const cur = budgetCounts.get(s.budget.name) ?? { name: s.budget.name, count: 0, order: Number.parseInt(s.budget.name.replace(/,/g, "").match(/\d+/)?.[0] ?? "0", 10) };
      cur.count++;
      budgetCounts.set(s.budget.name, cur);
    }
    smoking[classifySmoking(s.non_smoking)]++;
    if (yesNo(s.private_room) === true) privateRoom++;
    if (yesNo(s.free_drink) === true) freeDrink++;
    if ((parseCount(s.party_capacity) ?? 0) >= 20) party20++;
    if (yesNo(s.midnight) === true) midnight++;
  }
  return {
    sampled: shops.length,
    budgets: [...budgetCounts.values()].sort((a, b) => a.order - b.order).map(({ name, count }) => ({ name, count })),
    smoking,
    privateRoom,
    freeDrink,
    party20,
    midnight,
  };
}

export function percent(n: number, of: number): number {
  return of === 0 ? 0 : Math.round((n / of) * 100);
}
