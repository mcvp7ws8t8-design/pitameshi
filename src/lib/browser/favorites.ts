/**
 * お気に入り(F-12)。ログインなしでブラウザ(localStorage)に店舗IDだけを保存する。
 * 店名・写真などの店舗データは保存せず、表示のたびにAPIから取り直す(ホットペッパーAPIの規約)。
 */
export const FAVORITES_KEY = "pitameshi:favorites";
/** ホットペッパーAPIの id 指定は1回20件まで */
export const FAVORITES_MAX = 20;

const SHOP_ID = /^J\d{6,12}$/;

export function parseFavorites(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return [...new Set(v.filter((id): id is string => typeof id === "string" && SHOP_ID.test(id)))].slice(0, FAVORITES_MAX);
  } catch {
    return [];
  }
}

/** 追加は先頭に。上限を超えたら古いものから外す */
export function toggleFavorite(list: string[], id: string): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return [id, ...list].slice(0, FAVORITES_MAX);
}

/** URLの ids=J1,J2 を読む(不正な値は捨てる) */
export function parseIdsParam(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((s) => s.trim()).filter((s) => SHOP_ID.test(s)))].slice(0, FAVORITES_MAX);
}
