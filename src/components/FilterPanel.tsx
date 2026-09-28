"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CodeName } from "@/lib/hotpepper/types";
import { budgetCodesFor, budgetRange, type BudgetMaster } from "@/lib/hotpepper/masters";
import {
  ALCOHOL_OPTIONS,
  API_FLAGS,
  CATEGORY_ORDER,
  GLOSSARY,
  SMOKING_OPTIONS,
  SORT_OPTIONS,
  WALK_OPTIONS,
  type FilterCategory,
} from "@/lib/search/filters";
import { searchHref, serializeSearchState, toggleInList, withPatch, type SearchState } from "@/lib/search/query";

type Props = {
  state: SearchState;
  genres: CodeName[];
  budgets: BudgetMaster[];
  commonIds: string[];
  total: number;
  approximate: boolean;
};

const PEOPLE = [2, 4, 6, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];
const SEATS = [10, 20, 30, 50, 80, 100];
const YEN_STEPS = [1000, 2000, 3000, 4000, 5000, 7000, 10000, 15000, 20000];

/** サーバー側で判定する条件がどのカテゴリに入るか */
const SPECIAL_CATEGORY: Record<string, FilterCategory> = {
  genre: "ジャンル・予算",
  budget: "ジャンル・予算",
  partyMin: "人数・席",
  partyMax: "人数・席",
  seatsMin: "人数・席",
  alcohol: "飲む",
  smoking: "タバコ",
  walk: "場所",
};

function Help({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <details className="group inline-block align-middle">
      <summary className="ml-1 inline-flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-line text-xs text-ink-soft" aria-label="説明">
        ?
      </summary>
      <p className="mt-1 rounded-lg bg-accent-soft p-2 text-xs leading-relaxed text-ink">{text}</p>
    </details>
  );
}

function useCounts(draft: SearchState, tryIds: string[], enabled: boolean) {
  const [data, setData] = useState<{ total?: number; approximate?: boolean; tries: Record<string, number | null> }>({ tries: {} });
  const [loading, setLoading] = useState(false);
  const qs = serializeSearchState(draft).toString();
  const tryKey = tryIds.join(",");
  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    // 条件を変えるたびに呼ばないよう、少し待ってから数える
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/count?${qs}${tryKey ? `&try=${tryKey}` : ""}`, { signal: ctrl.signal });
        if (res.ok) setData(await res.json());
      } catch {
        /* 中断・通信失敗時は前の件数のまま */
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [qs, tryKey, enabled]);
  return { ...data, loading };
}

/**
 * 絞り込みパネル。
 * U-01 よく使う条件を先に、残りは「もっと見る」 / U-03 条件ごとの件数 / U-04 常に「○件を見る」
 * U-07 不明の店の扱い / U-08 用語の説明 / S-06 並び替え
 * スマホでは下から出るシート、PCでは左側に常に表示する。
 */
export function FilterPanel({ state, genres, budgets, commonIds, total, approximate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState<SearchState>(state);

  // URLが変わったら(チップで条件を外したときなど)下書きもそろえる。
  // effect で setState すると描画が2回走るので、レンダー中に前回の state と比べてそろえる。
  const [syncedState, setSyncedState] = useState(state);
  if (syncedState !== state) {
    setSyncedState(state);
    setDraft(state);
  }
  useEffect(() => {
    document.body.dataset.sheetOpen = open ? "true" : "false";
    return () => {
      document.body.dataset.sheetOpen = "false";
    };
  }, [open]);

  const dirty = serializeSearchState(draft).toString() !== serializeSearchState(state).toString();
  const visibleFlagIds = useMemo(
    () => (showAll ? API_FLAGS.map((f) => f.id) : commonIds.filter((id) => API_FLAGS.some((f) => f.id === id))),
    [showAll, commonIds],
  );
  const counts = useCounts(draft, visibleFlagIds.filter((id) => !draft.flags.includes(id)).slice(0, 6), open || dirty);

  const shownTotal = dirty ? counts.total : total;
  const shownApprox = dirty ? counts.approximate : approximate;

  const set = (patch: Partial<SearchState>) => setDraft((d) => withPatch(d, patch));
  const apply = () => {
    setOpen(false);
    router.push(searchHref({ ...draft, page: 1 }));
  };
  const reset = () =>
    setDraft({
      ...state,
      genres: [],
      budgets: [],
      flags: [],
      alcohol: [],
      partyMin: undefined,
      partyMax: undefined,
      seatsMin: undefined,
      smoking: undefined,
      walkMax: undefined,
      preset: undefined,
      page: 1,
    });

  const range = budgetRange(draft.budgets, budgets);

  /** 1つの条件の入力部品 */
  function renderSpecial(id: string) {
    switch (id) {
      case "genre":
        return (
          <fieldset key={id} className="space-y-2">
            <legend className="text-sm font-bold">ジャンル</legend>
            <div className="flex flex-wrap gap-1.5">
              {genres.map((g) => {
                const on = draft.genres.includes(g.code);
                return (
                  <button
                    key={g.code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ genres: toggleInList(draft.genres, g.code) })}
                    className={`rounded-full border px-3 py-1 text-sm ${on ? "border-brand bg-brand text-white" : "border-line bg-card"}`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      case "budget":
        return (
          <fieldset key={id} className="space-y-2">
            <legend className="text-sm font-bold">ディナー予算(1人)</legend>
            <div className="flex items-center gap-2 text-sm">
              <select
                className="rounded-lg border border-line bg-card px-2 py-1.5"
                value={range ? String(range.min) : ""}
                onChange={(e) => {
                  const min = e.target.value ? Number(e.target.value) : 0;
                  const max = range?.max ?? Number.POSITIVE_INFINITY;
                  set({ budgets: e.target.value || range ? budgetCodesFor(min, max, budgets) : [] });
                }}
              >
                <option value="">下限なし</option>
                {YEN_STEPS.map((y) => (
                  <option key={y} value={y + 1}>
                    {y.toLocaleString()}円〜
                  </option>
                ))}
              </select>
              <span>から</span>
              <select
                className="rounded-lg border border-line bg-card px-2 py-1.5"
                value={range && Number.isFinite(range.max) ? String(range.max) : ""}
                onChange={(e) => {
                  const min = range?.min ?? 0;
                  const max = e.target.value ? Number(e.target.value) : Number.POSITIVE_INFINITY;
                  set({ budgets: e.target.value || range ? budgetCodesFor(min, max, budgets) : [] });
                }}
              >
                <option value="">上限なし</option>
                {YEN_STEPS.map((y) => (
                  <option key={y} value={y}>
                    〜{y.toLocaleString()}円
                  </option>
                ))}
              </select>
              {draft.budgets.length > 0 && (
                <button type="button" className="text-xs underline" onClick={() => set({ budgets: [] })}>
                  指定なし
                </button>
              )}
            </div>
          </fieldset>
        );
      case "partyMin":
      case "partyMax":
        return (
          <fieldset key={id} className="space-y-2">
            <legend className="text-sm font-bold">
              宴会の人数
              <Help text={GLOSSARY.partyCapacity} />
            </legend>
            <div className="flex items-center gap-2 text-sm">
              <select
                className="rounded-lg border border-line bg-card px-2 py-1.5"
                value={draft.partyMin ?? ""}
                onChange={(e) => set({ partyMin: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">指定なし</option>
                {PEOPLE.map((n) => (
                  <option key={n} value={n}>
                    {n}名以上
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-line bg-card px-2 py-1.5"
                value={draft.partyMax ?? ""}
                onChange={(e) => set({ partyMax: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">上限なし</option>
                {PEOPLE.map((n) => (
                  <option key={n} value={n}>
                    {n}名まで
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        );
      case "seatsMin":
        return (
          <fieldset key={id} className="space-y-2">
            <legend className="text-sm font-bold">
              総席数
              <Help text={GLOSSARY.seats} />
            </legend>
            <select
              className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm"
              value={draft.seatsMin ?? ""}
              onChange={(e) => set({ seatsMin: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">指定なし</option>
              {SEATS.map((n) => (
                <option key={n} value={n}>
                  {n}席以上
                </option>
              ))}
            </select>
          </fieldset>
        );
      case "alcohol":
        return (
          <fieldset key={id} className="space-y-2">
            <legend className="text-sm font-bold">お酒(どれか)</legend>
            <div className="flex flex-wrap gap-1.5">
              {ALCOHOL_OPTIONS.map((o) => {
                const on = draft.alcohol.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ alcohol: toggleInList(draft.alcohol, o.id) })}
                    className={`rounded-full border px-3 py-1 text-sm ${on ? "border-brand bg-brand text-white" : "border-line bg-card"}`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      case "smoking":
        return (
          <fieldset key={id} className="space-y-1.5">
            <legend className="text-sm font-bold">タバコ</legend>
            {[{ id: undefined, label: "指定なし", help: undefined }, ...SMOKING_OPTIONS].map((o) => (
              <label key={o.id ?? "none"} className="flex items-center gap-2 text-sm">
                <input type="radio" name="smoking" checked={draft.smoking === o.id} onChange={() => set({ smoking: o.id })} />
                {o.label}
                <Help text={o.help} />
              </label>
            ))}
          </fieldset>
        );
      case "walk":
        return (
          <fieldset key={id} className="space-y-1.5">
            <legend className="text-sm font-bold">
              駅から徒歩
              <Help text={GLOSSARY.walk} />
            </legend>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" name="walk" checked={draft.walkMax === undefined} onChange={() => set({ walkMax: undefined })} />
                指定なし
              </label>
              {WALK_OPTIONS.map((m) => (
                <label key={m} className="flex items-center gap-1.5">
                  <input type="radio" name="walk" checked={draft.walkMax === m} onChange={() => set({ walkMax: m })} />
                  {m}分以内
                </label>
              ))}
            </div>
          </fieldset>
        );
      default:
        return null;
    }
  }

  function renderFlag(id: string) {
    const f = API_FLAGS.find((x) => x.id === id);
    if (!f) return null;
    const on = draft.flags.includes(id);
    const c = counts.tries[id];
    return (
      <label key={id} className={`flex items-center gap-2 text-sm ${!on && c === 0 ? "opacity-50" : ""}`}>
        <input type="checkbox" checked={on} onChange={() => set({ flags: toggleInList(draft.flags, id) })} />
        <span>{f.label}</span>
        {!on && typeof c === "number" && <span className="text-xs text-ink-soft">({c.toLocaleString()})</span>}
        <Help text={f.help} />
      </label>
    );
  }

  // 宴会の人数は下限・上限を1つの部品で出すので、partyMax は partyMin にまとめる
  const norm = (id: string) => (id === "partyMax" ? "partyMin" : id);
  const commonSpecial = [...new Set(commonIds.filter((id) => SPECIAL_CATEGORY[id]).map(norm))];
  const commonFlags = commonIds.filter((id) => API_FLAGS.some((f) => f.id === id));

  const panel = (
    <div className="space-y-5">
      <section className="space-y-4">
        <h2 className="text-base font-bold">よく使う条件</h2>
        {commonSpecial.map(renderSpecial)}
        {commonFlags.length > 0 && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{commonFlags.map(renderFlag)}</div>}
      </section>

      <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full rounded-lg border border-line bg-card py-2 text-sm font-semibold" aria-expanded={showAll}>
        {showAll ? "条件をたたむ" : "もっと見る(すべての条件)"}
      </button>

      {showAll && (
        <div className="space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const specials = Object.entries(SPECIAL_CATEGORY)
              .filter(([id, c]) => c === cat && id !== "partyMax" && !commonSpecial.includes(id))
              .map(([id]) => id);
            const flags = API_FLAGS.filter((f) => f.category === cat && !commonFlags.includes(f.id));
            if (specials.length === 0 && flags.length === 0) return null;
            return (
              <section key={cat} className="space-y-3 border-t border-line pt-4">
                <h3 className="text-sm font-bold text-brand">{cat}</h3>
                {specials.map(renderSpecial)}
                {flags.length > 0 && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{flags.map((f) => renderFlag(f.id))}</div>}
              </section>
            );
          })}
        </div>
      )}

      <section className="space-y-3 border-t border-line pt-4">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={draft.includeUnknown} onChange={(e) => set({ includeUnknown: e.target.checked })} />
          <span>
            情報が「不明」のお店も含める
            <Help text={GLOSSARY.unknown} />
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          並び順
          <select className="rounded-lg border border-line bg-card px-2 py-1.5" value={draft.sort} onChange={(e) => set({ sort: e.target.value as SearchState["sort"] })}>
            {SORT_OPTIONS.filter((o) => o.id !== "distance" || draft.lat !== undefined).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </section>
    </div>
  );

  const countLabel =
    shownTotal === undefined || (dirty && counts.loading) ? "件数を確認中…" : `${shownApprox ? "約" : ""}${shownTotal.toLocaleString()}件を見る`;

  return (
    <>
      {/* PC:左側に常に表示 */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-line bg-card p-4">
          {panel}
          <div className="sticky bottom-0 mt-4 flex gap-2 bg-card pt-3">
            <button type="button" onClick={reset} className="rounded-lg border border-line px-3 py-2 text-sm">
              クリア
            </button>
            <button type="button" onClick={apply} disabled={!dirty} className="flex-1 rounded-lg bg-brand py-2 text-sm font-bold text-white disabled:opacity-40">
              {dirty ? countLabel : "条件を変えると件数が出ます"}
            </button>
          </div>
        </div>
      </aside>

      {/* スマホ:画面下に固定したボタン → 下から出るシート(U-04) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 p-3 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="w-full rounded-full bg-brand py-3 font-bold text-white">
          条件を変える({(state.flags.length + state.alcohol.length + (state.smoking ? 1 : 0) + state.genres.length + (state.budgets.length ? 1 : 0)).toString()})
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="絞り込み">
          <button type="button" className="absolute inset-0 bg-ink/40" aria-label="閉じる" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl bg-paper">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-bold">絞り込み</p>
              <button type="button" onClick={() => setOpen(false)} className="text-sm underline">
                閉じる
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">{panel}</div>
            <div className="flex gap-2 border-t border-line p-3">
              <button type="button" onClick={reset} className="rounded-full border border-line px-4 py-3 text-sm">
                クリア
              </button>
              <button type="button" onClick={apply} className="flex-1 rounded-full bg-brand py-3 font-bold text-white">
                {dirty ? countLabel : `${approximate ? "約" : ""}${total.toLocaleString()}件を見る`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
