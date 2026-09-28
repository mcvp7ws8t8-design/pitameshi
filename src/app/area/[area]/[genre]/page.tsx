import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrNotice } from "@/components/Credits";
import { JsonLd } from "@/components/JsonLd";
import { ShopCard } from "@/components/ShopCard";
import { engineDeps } from "@/lib/deps";
import { isLandingPage, MIN_SHOPS_FOR_INDEX } from "@/lib/landing";
import { aggregate, percent } from "@/lib/search/aggregate";
import { toView } from "@/lib/search/engine";
import { applyPreset, PRESET_BY_ID } from "@/lib/search/presets";
import { EMPTY_STATE, searchHref, type SearchState } from "@/lib/search/query";
import { breadcrumbLd, shopListLd } from "@/lib/seo";

/**
 * エリア×ジャンルのページ(F-05)。検索エンジンからの入口。
 * 一覧だけでなく、ぴためしで集計した「予算の分布」「喫煙できる店の割合」などを載せて独自の価値を出す。
 */
export const revalidate = 43200; // 12時間(API規約:24時間以内に更新)

type Props = { params: Promise<{ area: string; genre: string }> };

const CODE = /^[A-Z]\d{3,4}$/;

async function load(area: string, genre: string) {
  if (!CODE.test(area) || !CODE.test(genre)) return undefined;
  const deps = await engineDeps();
  const areaName = deps.masters.areas.find((a) => a.code === area)?.name;
  const genreName = deps.masters.genres.find((g) => g.code === genre)?.name;
  if (!areaName || !genreName) return undefined;
  const page = await deps.backend.search({ middle_area: area, genre, count: "100", start: "1" });
  return { deps, areaName, genreName, page };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { area, genre } = await params;
  const data = await load(area, genre).catch(() => undefined);
  if (!data) return { title: "ページが見つかりません" };
  const { areaName, genreName, page } = data;
  const indexable = isLandingPage(area, genre) && page.total >= MIN_SHOPS_FOR_INDEX;
  return {
    title: `${areaName}の${genreName}(${page.total}件)個室・喫煙可・飲み放題で探す`,
    description: `${areaName}の${genreName}${page.total}件を、個室・喫煙可・飲み放題・宴会の人数などの条件で比べて探せます。`,
    alternates: { canonical: `/area/${area}/${genre}` },
    robots: { index: indexable, follow: true },
  };
}

export default async function AreaGenrePage({ params }: Props) {
  const { area, genre } = await params;
  const data = await load(area, genre);
  if (!data || data.page.total === 0) notFound();
  const { deps, areaName, genreName, page } = data;
  const stats = aggregate(page.shops);
  const n = stats.sampled;
  const base: SearchState = { ...EMPTY_STATE, middleAreas: [area], genres: [genre] };
  const views = page.shops.slice(0, 20).map((s) => toView(s, base, undefined, deps.masters.budgets));
  const from = `/area/${area}/${genre}`;
  const maxBudget = Math.max(1, ...stats.budgets.map((b) => b.count));

  const quick: { label: string; state: SearchState }[] = [
    { label: "個室あり", state: { ...base, flags: ["private_room"] } },
    { label: "喫煙できる", state: { ...base, smoking: "ok" } },
    { label: "全席禁煙", state: { ...base, smoking: "none" } },
    { label: "飲み放題あり", state: { ...base, flags: ["free_drink"] } },
    { label: "20名以上の宴会", state: { ...base, partyMin: 20 } },
    { label: "23時以降も営業", state: { ...base, flags: ["midnight"] } },
  ];

  return (
    <div className="space-y-6">
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "トップ", path: "/" },
            { name: areaName, path: `/search?ma=${area}` },
            { name: genreName, path: from },
          ]),
          shopListLd(`${areaName}の${genreName}`, views.map((v) => v.shop)),
        ]}
      />
      <nav className="text-xs text-ink-soft" aria-label="パンくず">
        <Link href="/">トップ</Link> › <Link href={`/search?ma=${area}`}>{areaName}</Link> › {genreName}
      </nav>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold leading-snug">
          {areaName}の{genreName}
        </h1>
        <p className="text-sm text-ink-soft">全{page.total.toLocaleString()}件。条件で絞り込んで、ぴったりのお店を探せます。</p>
      </header>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 font-bold">このエリアの{genreName}の傾向</h2>
        <p className="mb-3 text-xs text-ink-soft">ぴためしが{n}件のお店の情報から集計しました。</p>
        <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <Stat label="個室あり" value={`${percent(stats.privateRoom, n)}%`} />
          <Stat label="飲み放題あり" value={`${percent(stats.freeDrink, n)}%`} />
          <Stat label="喫煙できる" value={`${percent(stats.smoking.ok + stats.smoking.separated, n)}%`} sub={`不明 ${percent(stats.smoking.unknown, n)}%`} />
          <Stat label="20名以上の宴会OK" value={`${percent(stats.party20, n)}%`} />
        </dl>
        {stats.budgets.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold">ディナー予算の分布</h3>
            <ul className="space-y-1">
              {stats.budgets.map((b) => (
                <li key={b.name} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2 text-xs">
                  <span className="text-ink-soft">{b.name}</span>
                  <span className="h-3 rounded-full bg-brand-soft">
                    <span className="block h-3 rounded-full bg-brand" style={{ width: `${(b.count / maxBudget) * 100}%` }} />
                  </span>
                  <span className="text-right">{b.count}件</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">条件で絞る</h2>
        <ul className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <li key={q.label}>
              <Link href={searchHref(q.state)} className="block rounded-full border border-line bg-card px-3 py-1.5 text-sm hover:border-brand">
                {q.label}
              </Link>
            </li>
          ))}
          {["nomikai", "sobetsu", "date"].map((id) => {
            const p = PRESET_BY_ID.get(id)!;
            return (
              <li key={id}>
                <Link href={searchHref(applyPreset({ ...EMPTY_STATE, middleAreas: [area] }, p))} className="block rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-sm">
                  {p.emoji} {p.label}で探す
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">おすすめ順</h2>
        <PrNotice />
        <ul className="space-y-3">
          {views.map((v) => (
            <li key={v.shop.id}>
              <ShopCard view={v} from={from} />
            </li>
          ))}
        </ul>
        <Link href={searchHref(base)} className="block rounded-full border border-brand py-2.5 text-center font-bold text-brand">
          {page.total.toLocaleString()}件すべてを条件で絞り込む
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col-reverse rounded-xl bg-paper p-3">
      {sub && <p className="order-first text-[10px] text-ink-soft">{sub}</p>}
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="text-2xl font-bold text-brand">{value}</dd>
    </div>
  );
}
