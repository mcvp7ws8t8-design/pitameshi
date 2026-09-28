import type { Metadata } from "next";
import Link from "next/link";
import { ActiveChips } from "@/components/ActiveChips";
import { PrNotice } from "@/components/Credits";
import { FilterPanel } from "@/components/FilterPanel";
import { LocationButton } from "@/components/LocationButton";
import { PresetGrid } from "@/components/PresetGrid";
import { SearchBox } from "@/components/SearchBox";
import { ShareButton } from "@/components/ShareButton";
import { ShopCard } from "@/components/ShopCard";
import { engineDeps } from "@/lib/deps";
import type { Masters } from "@/lib/hotpepper";
import { rangeMeters, runSearch, suggestRelaxations, type RelaxSuggestion, type SearchResult } from "@/lib/search/engine";
import { commonFilterIds, PRESET_BY_ID } from "@/lib/search/presets";
import { parseSearchState, searchHref, withPatch, type SearchState } from "@/lib/search/query";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function placeLabel(state: SearchState, masters: Masters): string {
  if (state.lat !== undefined) return `現在地から${(rangeMeters(state) ?? 1000) >= 1000 ? `${(rangeMeters(state) ?? 1000) / 1000}km` : `${rangeMeters(state)}m`}`;
  const names = [
    ...state.middleAreas.map((c) => masters.areas.find((a) => a.code === c)?.name ?? c),
    ...(state.largeArea ? [masters.areas.find((a) => a.code === state.largeArea)?.name ?? state.largeArea] : []),
  ];
  const place = names.join("・");
  if (place && state.keyword) return `${place}(${state.keyword})`;
  return place || (state.keyword ? `「${state.keyword}」` : "");
}

function heading(state: SearchState, masters: Masters): string {
  const place = placeLabel(state, masters);
  const preset = state.preset ? PRESET_BY_ID.get(state.preset)?.label : undefined;
  if (!place) return preset ? `${preset}のお店` : "お店を探す";
  return preset ? `${place}で${preset}のお店` : `${place}のお店`;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const state = parseSearchState(await searchParams);
  const { masters } = await engineDeps();
  return {
    title: heading(state, masters) || "お店を探す",
    // 条件の組み合わせは無数にあるので、検索結果ページは検索エンジンに登録しない(集客は /area/... のページで行う)
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const state = parseSearchState(await searchParams);
  const deps = await engineDeps();
  const { masters } = deps;

  let result: SearchResult | undefined;
  let failed = false;
  try {
    result = await runSearch(state, deps);
  } catch (e) {
    console.error("[search]", e);
    failed = true;
  }
  let suggestions: RelaxSuggestion[] = [];
  if (result?.status === "ok" && result.total === 0) {
    suggestions = await suggestRelaxations(state, deps).catch(() => []);
  }

  // 場所がまだ決まっていない(プリセットだけ選んだ)とき
  if (result?.status === "need-location") {
    const preset = state.preset ? PRESET_BY_ID.get(state.preset) : undefined;
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">{preset ? `${preset.emoji} ${preset.label}のお店を探す` : "お店を探す"}</h1>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="mb-3 text-sm font-semibold">まず場所を選んでください</p>
          <SearchBox areas={masters.areas} base={state} />
          <LocationButton base={state} className="mt-2" />
        </div>
        <section className="space-y-3">
          <h2 className="font-bold">目的を変える</h2>
          <PresetGrid base={state} current={state.preset} />
        </section>
      </div>
    );
  }

  const title = heading(state, masters);
  const path = searchHref(state);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <FilterPanel
        state={state}
        genres={masters.genres}
        budgets={masters.budgets}
        commonIds={commonFilterIds(state.preset)}
        total={result?.total ?? 0}
        approximate={result?.approximate ?? false}
      />

      <div className="min-w-0 space-y-4">
        {deps.mock && (
          <p className="rounded-xl border border-dashed border-accent bg-accent-soft p-2 text-xs">開発モード:架空の仮データを表示しています。</p>
        )}
        <details className="rounded-2xl border border-line bg-card p-3">
          <summary className="cursor-pointer text-sm font-semibold">場所・キーワードを変える</summary>
          <div className="mt-3 space-y-2">
            <SearchBox areas={masters.areas} base={state} compact />
            <LocationButton base={state} />
          </div>
        </details>

        <div className="space-y-2">
          <h1 className="text-xl font-bold leading-snug">{title}</h1>
          <ActiveChips state={state} />
          {result && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <strong className="text-2xl text-brand">
                  {result.approximate ? "約" : ""}
                  {result.total.toLocaleString()}
                </strong>
                件
              </p>
              <ShareButton path={path} title={`${title}|ぴためし`} />
            </div>
          )}
          {result?.notes.map((n) => (
            <p key={n} className="rounded-lg bg-accent-soft px-3 py-2 text-xs">
              {n}
            </p>
          ))}
        </div>

        {failed && (
          <p className="rounded-xl border border-line bg-card p-4 text-sm">
            ただいまお店の情報を取得できません。時間をおいてもう一度お試しください。
          </p>
        )}

        {result && result.total === 0 && <ZeroResults suggestions={suggestions} />}

        {result && result.items.length > 0 && (
          <>
            <PrNotice />
            <ul className="space-y-3">
              {result.items.map((v) => (
                <li key={v.shop.id}>
                  <ShopCard view={v} from={path} />
                </li>
              ))}
            </ul>
            <Pagination state={state} totalPages={result.totalPages} />
          </>
        )}
      </div>
    </div>
  );
}

/** 0件のとき、外すと見つかる条件を件数つきで出す(U-02) */
function ZeroResults({ suggestions }: { suggestions: RelaxSuggestion[] }) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <p className="font-bold">条件に合うお店が見つかりませんでした</p>
      {suggestions.length > 0 ? (
        <>
          <p className="text-sm text-ink-soft">この条件を外すと見つかります:</p>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.id}>
                <Link href={searchHref(s.state)} className="flex items-center justify-between rounded-xl border border-brand/40 bg-brand-soft px-3 py-2 text-sm hover:border-brand">
                  <span>
                    「{s.label}」を外す
                  </span>
                  <strong className="text-brand-strong">
                    {s.approximate ? "約" : ""}
                    {s.count.toLocaleString()}件
                  </strong>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-ink-soft">場所を広げるか、条件を減らしてみてください。</p>
      )}
    </div>
  );
}

function Pagination({ state, totalPages }: { state: SearchState; totalPages: number }) {
  if (totalPages <= 1) return null;
  const max = Math.min(totalPages, 50);
  return (
    <nav className="flex items-center justify-center gap-3 pt-2 text-sm" aria-label="ページ送り">
      {state.page > 1 ? (
        <Link href={searchHref(withPatch(state, { page: state.page - 1 }))} className="rounded-full border border-line bg-card px-4 py-2">
          前へ
        </Link>
      ) : (
        <span className="px-4 py-2 opacity-40">前へ</span>
      )}
      <span>
        {state.page} / {max}
      </span>
      {state.page < max ? (
        <Link href={searchHref(withPatch(state, { page: state.page + 1 }))} className="rounded-full border border-line bg-card px-4 py-2">
          次へ
        </Link>
      ) : (
        <span className="px-4 py-2 opacity-40">次へ</span>
      )}
    </nav>
  );
}
