import type { Metadata } from "next";
import { PrNotice } from "@/components/Credits";
import { FavoritesLoader } from "@/components/Favorites";
import { ShareButton } from "@/components/ShareButton";
import { ShopCard } from "@/components/ShopCard";
import { parseIdsParam } from "@/lib/browser/favorites";
import { getMasters, getShops } from "@/lib/hotpepper";
import { toView } from "@/lib/search/engine";
import { EMPTY_STATE } from "@/lib/search/query";

export const metadata: Metadata = { title: "お気に入り", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * お気に入り(F-12)。ブラウザに保存した店舗IDを ?ids= で受け取り、店舗情報はAPIから取り直して表示する。
 * URLを送れば、同じお気に入りの一覧を共有できる。
 */
export default async function FavoritesPage({ searchParams }: Props) {
  const raw = (await searchParams).ids;
  const ids = parseIdsParam(Array.isArray(raw) ? raw[0] : raw);

  if (ids.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">お気に入り</h1>
        <FavoritesLoader />
      </div>
    );
  }

  const { budgets } = await getMasters();
  const shops = await getShops(ids).catch((e: unknown) => {
    console.error("[favorites]", e);
    return undefined;
  });
  const failed = shops === undefined;
  const list = shops ?? [];
  const path = `/favorites?ids=${ids.join(",")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">お気に入り({list.length}件)</h1>
        {list.length > 0 && <ShareButton path={path} title="お気に入りのお店|ぴためし" label="この一覧を共有" />}
      </div>
      {failed && <p className="rounded-xl border border-line bg-card p-4 text-sm">ただいまお店の情報を取得できません。時間をおいてもう一度お試しください。</p>}
      {!failed && list.length < ids.length && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs">掲載が終わったお店は表示されません。</p>
      )}
      {list.length > 0 && (
        <>
          <PrNotice />
          <ul className="space-y-3">
            {list.map((s) => (
              <li key={s.id}>
                <ShopCard view={toView(s, EMPTY_STATE, undefined, budgets)} from="/favorites" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
