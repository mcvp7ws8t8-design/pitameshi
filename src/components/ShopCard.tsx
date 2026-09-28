import Link from "next/link";
import type { ShopView } from "@/lib/search/engine";
import { FavoriteButton } from "./Favorites";

const TONE: Record<string, string> = {
  good: "bg-brand-soft text-brand-strong",
  neutral: "bg-accent-soft text-ink",
  unknown: "bg-transparent text-unknown border border-dashed border-unknown/50",
};

function formatDistance(m: number): string {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

/** 検索結果の1件。条件バッジ(S-04)で、詳細を開かずに比べられるようにする。 */
export function ShopCard({ view, from }: { view: ShopView; from: string }) {
  const { shop } = view;
  return (
    <article className="flex gap-3 rounded-2xl border border-line bg-card p-3 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
      <Link href={`/shop/${shop.id}`} className="shrink-0">
        {/* 写真はホットペッパーの画像URLをそのまま表示する(加工・保存はしない) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shop.photo.pc.m} alt="" width={112} height={112} loading="lazy" className="h-28 w-28 rounded-lg bg-accent-soft object-cover" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-soft">
          {shop.genre.name}
          {shop.small_area?.name ? ` ・ ${shop.small_area.name}` : ""}
        </p>
        <h3 className="truncate text-base font-bold leading-snug">
          <Link href={`/shop/${shop.id}`} className="hover:text-brand">
            {shop.name}
          </Link>
        </h3>
        <p className="mt-0.5 line-clamp-1 text-sm text-ink-soft">{shop.catch}</p>
        <p className="mt-1 text-sm">
          <span className="font-semibold">{shop.budget?.average || shop.budget?.name || "予算不明"}</span>
          {view.distanceM !== undefined ? (
            <span className="ml-2 text-ink-soft">現在地から{formatDistance(view.distanceM)}</span>
          ) : view.station ? (
            <span className="ml-2 text-ink-soft">
              {view.station.name}駅 徒歩約{view.station.walkMinutes}分
            </span>
          ) : null}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="このお店の条件">
          {view.badges.map((b) => (
            <li key={b.id} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[b.tone]}`}>
              {b.label}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-end gap-2">
          <FavoriteButton shopId={shop.id} />
          <a
            href={`/go/${shop.id}?from=${encodeURIComponent(from)}`}
            rel="nofollow sponsored"
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-white hover:bg-brand-strong"
          >
            予約する
          </a>
        </div>
      </div>
    </article>
  );
}
