import type { HotpepperShop } from "../hotpepper/types";
import { hasCoupon, parseCount, yesNo, type SmokingClass, SMOKING_LABEL } from "./interpret";

/** 一覧のカードに出す条件バッジ(S-04)。詳細を開かずに比べられるようにする。 */
export type Badge = { id: string; label: string; tone: "good" | "neutral" | "unknown" };

type FieldBadge = { id: string; field: keyof HotpepperShop; label: string };

const FIELD_BADGES: FieldBadge[] = [
  { id: "private_room", field: "private_room", label: "個室" },
  { id: "free_drink", field: "free_drink", label: "飲み放題" },
  { id: "course", field: "course", label: "コース" },
  { id: "charter", field: "charter", label: "貸切可" },
  { id: "tatami", field: "tatami", label: "座敷" },
  { id: "horigotatsu", field: "horigotatsu", label: "掘りごたつ" },
  { id: "midnight", field: "midnight", label: "23時以降も営業" },
  { id: "card", field: "card", label: "カード可" },
  { id: "wifi", field: "wifi", label: "Wi-Fi" },
  { id: "child", field: "child", label: "子連れOK" },
  { id: "lunch", field: "lunch", label: "ランチ" },
  { id: "parking", field: "parking", label: "駐車場" },
  { id: "pet", field: "pet", label: "ペット可" },
  { id: "english", field: "english", label: "英語メニュー" },
];

/**
 * @param focus 利用者が選んだ条件。選んだ条件のバッジを先頭に出す
 * @param max 表示する最大数(カードが長くなりすぎないように)
 */
export function shopBadges(shop: HotpepperShop, smoking: SmokingClass, focus: string[] = [], max = 6): Badge[] {
  const badges: Badge[] = [];

  const party = parseCount(shop.party_capacity);
  if (party) badges.push({ id: "party", label: `宴会最大${party}名`, tone: "neutral" });

  badges.push({ id: "smoking", label: SMOKING_LABEL[smoking], tone: smoking === "unknown" ? "unknown" : "neutral" });

  for (const b of FIELD_BADGES) {
    const v = shop[b.field];
    if (typeof v === "string" && yesNo(v) === true) {
      badges.push({ id: b.id, label: b.label, tone: "good" });
    }
  }
  if (hasCoupon(shop)) badges.push({ id: "ktai_coupon", label: "クーポン", tone: "good" });

  // 選んだ条件 → 人数・喫煙 → その他 の順
  const rank = (b: Badge) => (focus.includes(b.id) ? 0 : b.id === "party" || b.id === "smoking" ? 1 : 2);
  return badges.sort((a, b) => rank(a) - rank(b)).slice(0, max);
}
