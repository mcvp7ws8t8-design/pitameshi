"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { FAVORITES_KEY, parseFavorites, toggleFavorite } from "@/lib/browser/favorites";
import { readStored, useStoredRaw, writeStored } from "@/lib/browser/useStored";

function useFavorites(): string[] | undefined {
  const raw = useStoredRaw(FAVORITES_KEY);
  return useMemo(() => (raw === null ? undefined : parseFavorites(raw)), [raw]);
}

/** お気に入りに追加・削除するボタン(F-12)。ログインなしでブラウザに店舗IDだけを保存する。 */
export function FavoriteButton({ shopId, className = "" }: { shopId: string; className?: string }) {
  const on = useFavorites()?.includes(shopId) ?? false;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "お気に入りから外す" : "お気に入りに追加"}
      onClick={() => writeStored(FAVORITES_KEY, JSON.stringify(toggleFavorite(parseFavorites(readStored(FAVORITES_KEY)), shopId)))}
      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? "border-accent bg-accent-soft" : "border-line bg-card hover:border-brand"} ${className}`}
    >
      <span aria-hidden>{on ? "★" : "☆"}</span> {on ? "保存済み" : "保存"}
    </button>
  );
}

/** /favorites をURLなしで開いたとき、ブラウザに保存したお気に入りを読み込んでURLに入れる */
export function FavoritesLoader() {
  const router = useRouter();
  const ids = useFavorites();
  useEffect(() => {
    if (ids && ids.length) router.replace(`/favorites?ids=${ids.join(",")}`);
  }, [ids, router]);
  if (!ids || ids.length) return <p className="text-sm text-ink-soft">読み込み中…</p>;
  return (
    <p className="rounded-2xl border border-line bg-card p-4 text-sm">
      まだお気に入りはありません。お店の「☆ 保存」を押すと、ここに表示されます(このブラウザにだけ保存されます)。
    </p>
  );
}
