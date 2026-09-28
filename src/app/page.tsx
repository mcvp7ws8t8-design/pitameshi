import Link from "next/link";
import { LocationButton } from "@/components/LocationButton";
import { PresetGrid } from "@/components/PresetGrid";
import { RecentSearches } from "@/components/RecentSearches";
import { SearchBox } from "@/components/SearchBox";
import { getMasters, isMockMode } from "@/lib/hotpepper";
import { EMPTY_STATE } from "@/lib/search/query";

export default async function HomePage() {
  const masters = await getMasters();
  const popular = masters.areas.filter((a) => a.level === "middle").slice(0, 12);

  return (
    <div className="space-y-8">
      {isMockMode() && <MockBanner />}

      <section className="rounded-3xl bg-brand px-5 py-7 text-white sm:px-8">
        <h1 className="font-round text-3xl font-extrabold leading-tight sm:text-4xl">
          条件に、ぴたっと。
        </h1>
        <p className="mt-2 text-sm text-white/85 sm:text-base">
          個室・喫煙可・飲み放題・宴会の人数まで。居酒屋からカフェまで、細かい条件で全国のお店を探せます。
        </p>
        <div className="mt-5 rounded-2xl bg-paper p-3 text-ink">
          <SearchBox areas={masters.areas} base={EMPTY_STATE} />
          <LocationButton base={EMPTY_STATE} className="mt-2" />
        </div>
      </section>

      <RecentSearches />

      <section className="space-y-3">
        <h2 className="text-lg font-bold">目的から探す</h2>
        <PresetGrid />
      </section>

      {popular.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">エリアから探す</h2>
          <ul className="flex flex-wrap gap-2">
            {popular.map((a) => (
              <li key={a.code}>
                <Link href={`/search?ma=${a.code}`} className="block rounded-full border border-line bg-card px-3 py-1.5 text-sm hover:border-brand">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MockBanner() {
  return (
    <p className="rounded-xl border border-dashed border-accent bg-accent-soft p-3 text-sm">
      <strong>開発モード:</strong>
      ホットペッパーAPIキーが未設定のため、架空の仮データを表示しています(東京の「新宿」「銀座」周辺だけ)。
    </p>
  );
}
