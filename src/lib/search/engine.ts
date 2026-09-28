import { MAX_COUNT_PER_CALL } from "../hotpepper/client";
import { FALLBACK_BUDGETS, type BudgetMaster } from "../hotpepper/masters";
import type { HotpepperBackend, HotpepperQuery, HotpepperShop } from "../hotpepper/types";
import { bboxAround, distanceMeters, RANGE_METERS, type LatLng } from "../geo";
import type { Station, StationProvider } from "../osm/types";
import { shopBadges, type Badge } from "./badges";
import { ALCOHOL_OPTIONS, API_FLAG_BY_ID, METERS_PER_WALK_MINUTE, SMOKING_OPTIONS, type AlcoholId } from "./filters";
import {
  classifySmoking,
  estimateBudgetYen,
  matchesSmoking,
  parseCount,
  shopLatLng,
  type SmokingClass,
} from "./interpret";
import { PRESET_BY_ID } from "./presets";
import { hasLocation, type SearchState } from "./query";

export const PAGE_SIZE = 20;

/**
 * サーバー側で絞り込む場合に、APIから取ってくる最大ページ数(1ページ100件)。
 * Cloudflare Workers 無料プランは1リクエストあたりのサブリクエスト数とCPU時間に上限があるため小さくしている。
 * 増やすときは Workers の上限(サブリクエスト数・CPU 10ms)を確認すること。
 */
export const MAX_API_PAGES = 2;

/** 駅から徒歩の判定で、これより遠い駅しかなければ「不明」扱い */
const MAX_STATION_SEARCH_M = 1500;

export type ShopView = {
  shop: HotpepperShop;
  smoking: SmokingClass;
  partyCapacity?: number;
  seats?: number;
  budgetYen?: number;
  distanceM?: number;
  station?: { name: string; walkMinutes: number };
  badges: Badge[];
};

export type SearchResult = {
  status: "ok" | "need-location";
  items: ShopView[];
  total: number;
  /** サーバー側の絞り込みで、APIの全件を見られていない(件数が目安) */
  approximate: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
  backend: "api" | "mock";
  notes: string[];
};

export type EngineDeps = {
  backend: HotpepperBackend;
  stations?: StationProvider;
  budgets?: BudgetMaster[];
};

// ---------------------------------------------------------------------------
// APIに渡すクエリ
// ---------------------------------------------------------------------------

export function effectiveKeyword(state: SearchState): string | undefined {
  const presetKeyword = PRESET_BY_ID.get(state.preset ?? "")?.apply.keyword;
  const words = [state.keyword, presetKeyword].filter(Boolean) as string[];
  return words.length ? words.join(" ") : undefined;
}

/** 予算コードが3つ以上だとAPIに渡せない(API仕様: 2つまで)ので、サーバー側で絞る */
function budgetOnServer(state: SearchState): boolean {
  return state.budgets.length > 2;
}

export function buildApiQuery(state: SearchState, alcohol?: AlcoholId): HotpepperQuery {
  const q: HotpepperQuery = {};
  if (state.largeArea) q.large_area = state.largeArea;
  if (state.middleAreas.length) q.middle_area = state.middleAreas;
  const kw = effectiveKeyword(state);
  if (kw) q.keyword = kw;
  if (state.lat !== undefined && state.lng !== undefined) {
    q.lat = String(state.lat);
    q.lng = String(state.lng);
    q.range = String(state.range ?? 3);
  }
  if (state.genres.length) q.genre = state.genres;
  if (state.budgets.length && !budgetOnServer(state)) q.budget = state.budgets;
  // API の party_capacity は「指定数より大きい」お店を返すので 1 引く
  if (state.partyMin && state.partyMin > 1) q.party_capacity = String(state.partyMin - 1);
  for (const id of state.flags) {
    const def = API_FLAG_BY_ID.get(id);
    if (def) q[def.id] = def.apiValue ?? "1";
  }
  if (alcohol) q[alcohol] = "1";
  // 位置検索では order を指定しないと距離順になる(API仕様)。おすすめ順にしたいときだけ 4 を渡す。
  const isLocation = state.lat !== undefined && state.lng !== undefined;
  if (isLocation && state.sort !== "distance") q.order = "4";
  return q;
}

/** API以外の処理(サーバー側の絞り込み・並べ替え・「どれか」検索)が必要か */
export function needsServerProcessing(state: SearchState): boolean {
  return (
    budgetOnServer(state) ||
    state.partyMax !== undefined ||
    state.seatsMin !== undefined ||
    state.smoking !== undefined ||
    state.walkMax !== undefined ||
    state.alcohol.length > 1 ||
    state.sort === "budget_asc" ||
    state.sort === "party_desc" ||
    state.sort === "seats_desc"
  );
}

// ---------------------------------------------------------------------------
// 取得
// ---------------------------------------------------------------------------

async function fetchAll(
  backend: HotpepperBackend,
  query: HotpepperQuery,
  maxPages: number,
): Promise<{ shops: HotpepperShop[]; total: number; complete: boolean }> {
  const shops: HotpepperShop[] = [];
  let total = 0;
  for (let page = 0; page < maxPages; page++) {
    const res = await backend.search({ ...query, start: String(page * MAX_COUNT_PER_CALL + 1), count: String(MAX_COUNT_PER_CALL) });
    total = res.total;
    shops.push(...res.shops);
    if (shops.length >= total || res.shops.length < MAX_COUNT_PER_CALL) break;
  }
  return { shops, total, complete: shops.length >= total };
}

/** お酒の「どれか」(S-02):種類ごとにAPIを呼び、結果を重複なしでまとめる */
async function fetchCandidates(state: SearchState, deps: EngineDeps, maxPages: number) {
  const alcoholRuns: (AlcoholId | undefined)[] = state.alcohol.length === 0 ? [undefined] : state.alcohol.length === 1 ? [state.alcohol[0]] : [...state.alcohol];
  const results = await Promise.all(alcoholRuns.map((a) => fetchAll(deps.backend, buildApiQuery(state, a), maxPages)));
  const seen = new Set<string>();
  const merged: HotpepperShop[] = [];
  // おすすめ順をなるべく保つため、各結果から交互に取り出す
  const maxLen = Math.max(...results.map((r) => r.shops.length));
  for (let i = 0; i < maxLen; i++) {
    for (const r of results) {
      const s = r.shops[i];
      if (s && !seen.has(s.id)) {
        seen.add(s.id);
        merged.push(s);
      }
    }
  }
  return { shops: merged, complete: results.every((r) => r.complete) };
}

// ---------------------------------------------------------------------------
// 店舗ごとの解釈
// ---------------------------------------------------------------------------

function nearestStation(point: LatLng, stations: Station[]): { station: Station; meters: number } | undefined {
  let best: { station: Station; meters: number } | undefined;
  for (const st of stations) {
    const m = distanceMeters(point, st);
    if (!best || m < best.meters) best = { station: st, meters: m };
  }
  return best && best.meters <= MAX_STATION_SEARCH_M ? best : undefined;
}

export function toView(shop: HotpepperShop, state: SearchState, stations: Station[] | undefined, budgets: BudgetMaster[]): ShopView {
  const smoking = classifySmoking(shop.non_smoking);
  const pos = shopLatLng(shop);
  const view: ShopView = {
    shop,
    smoking,
    partyCapacity: parseCount(shop.party_capacity),
    seats: parseCount(shop.capacity),
    budgetYen: estimateBudgetYen(shop, budgets),
    badges: [],
  };
  if (pos && state.lat !== undefined && state.lng !== undefined) {
    view.distanceM = Math.round(distanceMeters({ lat: state.lat, lng: state.lng }, pos));
  }
  if (pos && stations && stations.length) {
    const near = nearestStation(pos, stations);
    if (near) view.station = { name: near.station.name, walkMinutes: Math.max(1, Math.ceil(near.meters / METERS_PER_WALK_MINUTE)) };
  }
  const focus = [...state.flags, ...(state.smoking ? ["smoking"] : []), ...(state.partyMin || state.partyMax ? ["party"] : [])];
  view.badges = shopBadges(shop, smoking, focus);
  return view;
}

/** サーバー側の絞り込み。情報がない店は includeUnknown のときだけ残す(U-07)。 */
export function passesServerFilters(v: ShopView, state: SearchState, stationsAvailable: boolean): boolean {
  const unk = state.includeUnknown;
  if (budgetOnServer(state)) {
    const code = v.shop.budget?.code;
    if (!code) {
      if (!unk) return false;
    } else if (!state.budgets.includes(code)) return false;
  }
  if (state.partyMax !== undefined) {
    if (v.partyCapacity === undefined) {
      if (!unk) return false;
    } else if (v.partyCapacity > state.partyMax) return false;
  }
  if (state.seatsMin !== undefined) {
    if (v.seats === undefined) {
      if (!unk) return false;
    } else if (v.seats < state.seatsMin) return false;
  }
  if (state.smoking && !matchesSmoking(v.smoking, state.smoking, unk)) return false;
  if (state.walkMax !== undefined && stationsAvailable) {
    if (!v.station) {
      if (!unk) return false;
    } else if (v.station.walkMinutes > state.walkMax) return false;
  }
  return true;
}

function sortViews(views: ShopView[], state: SearchState): ShopView[] {
  const last = (n: number | undefined, desc: boolean) => (n === undefined ? (desc ? -Infinity : Infinity) : n);
  const sorted = [...views];
  switch (state.sort) {
    case "budget_asc":
      return sorted.sort((a, b) => last(a.budgetYen, false) - last(b.budgetYen, false));
    case "party_desc":
      return sorted.sort((a, b) => last(b.partyCapacity, true) - last(a.partyCapacity, true));
    case "seats_desc":
      return sorted.sort((a, b) => last(b.seats, true) - last(a.seats, true));
    case "distance":
      return sorted.sort((a, b) => last(a.distanceM, false) - last(b.distanceM, false));
    default:
      return sorted;
  }
}

async function loadStations(views: ShopView[], deps: EngineDeps): Promise<Station[] | undefined> {
  if (!deps.stations) return undefined;
  const points = views.map((v) => shopLatLng(v.shop)).filter((p): p is LatLng => Boolean(p));
  const bbox = bboxAround(points, MAX_STATION_SEARCH_M);
  if (!bbox) return [];
  try {
    return await deps.stations.inBBox(bbox);
  } catch {
    return undefined; // 駅データが取れなくても検索自体は続ける
  }
}

// ---------------------------------------------------------------------------
// 検索の本体
// ---------------------------------------------------------------------------

export async function runSearch(state: SearchState, deps: EngineDeps, opts: { maxPages?: number } = {}): Promise<SearchResult> {
  const budgets = deps.budgets ?? FALLBACK_BUDGETS;
  const base = {
    page: state.page,
    pageSize: PAGE_SIZE,
    backend: deps.backend.kind,
    notes: [] as string[],
  };
  if (!hasLocation(state)) {
    return { ...base, status: "need-location", items: [], total: 0, approximate: false, totalPages: 0 };
  }

  const wantsStations = state.walkMax !== undefined;

  // --- APIだけで済む場合:APIのページ送りをそのまま使う ---
  if (!needsServerProcessing(state)) {
    const q = buildApiQuery(state, state.alcohol[0]);
    const res = await deps.backend.search({ ...q, start: String((state.page - 1) * PAGE_SIZE + 1), count: String(PAGE_SIZE) });
    const pre = res.shops.map((s) => toView(s, state, undefined, budgets));
    const stations = await loadStations(pre, deps);
    const items = stations ? res.shops.map((s) => toView(s, state, stations, budgets)) : pre;
    return {
      ...base,
      status: "ok",
      items,
      total: res.total,
      approximate: false,
      totalPages: Math.ceil(res.total / PAGE_SIZE),
    };
  }

  // --- サーバー側の処理が必要な場合:まとめて取ってから絞り込む ---
  const { shops, complete } = await fetchCandidates(state, deps, opts.maxPages ?? MAX_API_PAGES);
  let views = shops.map((s) => toView(s, state, undefined, budgets));
  let stationsAvailable = false;
  if (wantsStations || views.length) {
    const stations = await loadStations(views, deps);
    if (stations) {
      stationsAvailable = true;
      views = shops.map((s) => toView(s, state, stations, budgets));
    }
  }
  if (wantsStations && !stationsAvailable) {
    base.notes.push("駅からの距離のデータを準備中のため、「駅から徒歩」の条件は今は使われていません。");
  }
  const filtered = sortViews(
    views.filter((v) => passesServerFilters(v, state, stationsAvailable)),
    state,
  );
  if (!complete) {
    base.notes.push(`条件に合うお店が多いため、上位${(opts.maxPages ?? MAX_API_PAGES) * MAX_COUNT_PER_CALL}件の中から絞り込んでいます。場所を絞るとより正確になります。`);
  }
  const start = (state.page - 1) * PAGE_SIZE;
  return {
    ...base,
    status: "ok",
    items: filtered.slice(start, start + PAGE_SIZE),
    total: filtered.length,
    approximate: !complete,
    totalPages: Math.ceil(filtered.length / PAGE_SIZE),
  };
}

/** 件数だけを数える(U-02・U-03)。APIだけで済む場合は1件だけ取ってAPIの総件数を使う。 */
export async function countResults(state: SearchState, deps: EngineDeps): Promise<{ total: number; approximate: boolean }> {
  if (!hasLocation(state)) return { total: 0, approximate: false };
  if (!needsServerProcessing(state)) {
    const res = await deps.backend.search({ ...buildApiQuery(state, state.alcohol[0]), start: "1", count: "1" });
    return { total: res.total, approximate: false };
  }
  const r = await runSearch({ ...state, page: 1 }, deps, { maxPages: 1 });
  return { total: r.total, approximate: r.approximate };
}

// ---------------------------------------------------------------------------
// 0件のときの提案(U-02)
// ---------------------------------------------------------------------------

export type RelaxSuggestion = { id: string; label: string; count: number; approximate: boolean; state: SearchState };

/** 外せる条件の一覧(外したときの状態つき)。サーバー側の条件ほど0件の原因になりやすいので先に並べる。 */
export function removableConditions(state: SearchState): { id: string; label: string; state: SearchState }[] {
  const out: { id: string; label: string; state: SearchState }[] = [];
  const s = (patch: Partial<SearchState>) => ({ ...state, ...patch, page: 1 });
  if (state.smoking) {
    const label = SMOKING_OPTIONS.find((o) => o.id === state.smoking)?.label ?? "タバコの条件";
    out.push({ id: "smoking", label, state: s({ smoking: undefined }) });
  }
  if (state.walkMax !== undefined) out.push({ id: "walk", label: `駅から徒歩${state.walkMax}分以内`, state: s({ walkMax: undefined }) });
  if (state.partyMax !== undefined) out.push({ id: "partyMax", label: `宴会${state.partyMax}名以下`, state: s({ partyMax: undefined }) });
  if (state.seatsMin !== undefined) out.push({ id: "seatsMin", label: `席数${state.seatsMin}席以上`, state: s({ seatsMin: undefined }) });
  if (state.partyMin !== undefined) out.push({ id: "partyMin", label: `宴会${state.partyMin}名以上`, state: s({ partyMin: undefined }) });
  for (const f of state.flags) {
    out.push({ id: `flag:${f}`, label: API_FLAG_BY_ID.get(f)?.label ?? f, state: s({ flags: state.flags.filter((x) => x !== f) }) });
  }
  if (state.alcohol.length) {
    const labels = state.alcohol.map((a) => ALCOHOL_OPTIONS.find((o) => o.id === a)?.label ?? a).join("・");
    out.push({ id: "alcohol", label: labels, state: s({ alcohol: [] }) });
  }
  if (state.budgets.length) out.push({ id: "budget", label: "予算", state: s({ budgets: [] }) });
  if (state.genres.length) out.push({ id: "genre", label: "ジャンル", state: s({ genres: [] }) });
  if (!state.includeUnknown && (state.smoking || state.walkMax || state.partyMax || state.seatsMin)) {
    out.push({ id: "includeUnknown", label: "(不明の店も含める)", state: s({ includeUnknown: true }) });
  }
  return out;
}

export async function suggestRelaxations(state: SearchState, deps: EngineDeps, limit = 5): Promise<RelaxSuggestion[]> {
  const all = removableConditions(state);
  const candidates = all.slice(0, limit);
  const counted = await Promise.all(
    candidates.map(async (c) => {
      try {
        const r = await countResults(c.state, deps);
        return { ...c, count: r.total, approximate: r.approximate };
      } catch {
        return { ...c, count: 0, approximate: false };
      }
    }),
  );
  const singles = counted.filter((c) => c.count > 0).sort((a, b) => b.count - a.count).slice(0, 3);
  if (singles.length) return singles;

  // 1つ外すだけでは0件のまま → 上から順に条件を重ねて外し、初めて見つかった組み合わせを提案する
  let current = state;
  const removed: string[] = [];
  for (const c of all.slice(0, limit + 2)) {
    const next = removableConditions(current).find((x) => x.id === c.id);
    if (!next) continue;
    current = next.state;
    removed.push(c.label);
    if (removed.length < 2) continue;
    const r = await countResults(current, deps).catch(() => ({ total: 0, approximate: false }));
    if (r.total > 0) {
      return [{ id: `multi:${removed.length}`, label: removed.join("、"), count: r.total, approximate: r.approximate, state: current }];
    }
  }
  return [];
}

/** 現在地検索の範囲(メートル) */
export function rangeMeters(state: SearchState): number | undefined {
  return state.lat !== undefined ? RANGE_METERS[state.range ?? 3] : undefined;
}
