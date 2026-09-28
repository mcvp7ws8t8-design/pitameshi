/**
 * 最近使った条件(U-06)。ログインなしでブラウザ(localStorage)に保存する。
 * 保存するのは検索URLと見出しだけ(現在地の緯度経度は保存しない)。
 */
export type RecentSearch = { path: string; label: string; detail: string; savedAt: number };

export const RECENT_KEY = "pitameshi:recent-searches";
export const RECENT_MAX = 5;

/** 同じURLは先頭に移し、最大件数を超えたら古いものから消す */
export function addRecent(list: RecentSearch[], item: RecentSearch, max = RECENT_MAX): RecentSearch[] {
  return [item, ...list.filter((r) => r.path !== item.path)].slice(0, max);
}

/** 壊れた値が入っていても落ちないように読む */
export function parseRecent(raw: string | null): RecentSearch[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (r): r is RecentSearch =>
          typeof r === "object" && r !== null && typeof r.path === "string" && r.path.startsWith("/search") && typeof r.label === "string",
      )
      .map((r) => ({ path: r.path, label: r.label, detail: typeof r.detail === "string" ? r.detail : "", savedAt: Number(r.savedAt) || 0 }))
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

/** 現在地の検索は位置情報を含むので保存しない(プライバシーポリシーに合わせる) */
export function isSavable(path: string): boolean {
  return path.startsWith("/search?") && !/[?&]lat=/.test(path);
}
