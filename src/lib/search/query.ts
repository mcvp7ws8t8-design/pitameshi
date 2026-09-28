import {
  ALCOHOL_OPTIONS,
  API_FLAG_BY_ID,
  RANGE_OPTIONS,
  SMOKING_OPTIONS,
  SORT_OPTIONS,
  WALK_OPTIONS,
  type AlcoholId,
  type SmokingFilter,
  type SortId,
} from "./filters";

/**
 * 検索条件。URLのクエリと1対1で対応させ、そのまま共有できるようにする(U-05)。
 */
export type SearchState = {
  largeArea?: string;
  middleAreas: string[];
  keyword?: string;
  lat?: number;
  lng?: number;
  range?: number; // 1〜5
  genres: string[];
  budgets: string[];
  partyMin?: number;
  partyMax?: number;
  seatsMin?: number;
  flags: string[];
  alcohol: AlcoholId[];
  smoking?: SmokingFilter;
  walkMax?: number; // 駅から徒歩○分以内
  openNow: boolean; // 今営業中(リリース3)
  includeUnknown: boolean;
  sort: SortId;
  preset?: string;
  page: number;
};

export const EMPTY_STATE: SearchState = {
  middleAreas: [],
  genres: [],
  budgets: [],
  flags: [],
  alcohol: [],
  openNow: false,
  includeUnknown: false,
  sort: "recommend",
  page: 1,
};

/** URLで使う短いキー */
const K = {
  largeArea: "la",
  middleAreas: "ma",
  keyword: "q",
  lat: "lat",
  lng: "lng",
  range: "r",
  genres: "g",
  budgets: "b",
  partyMin: "pmin",
  partyMax: "pmax",
  seatsMin: "smin",
  flags: "f",
  alcohol: "al",
  smoking: "sm",
  walkMax: "walk",
  openNow: "open",
  includeUnknown: "unk",
  sort: "sort",
  preset: "p",
  page: "page",
} as const;

type ParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

function getParam(params: ParamsLike, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

const CODE_RE = /^[A-Z]{1,3}\d{2,6}$/; // Z011, Y005, G001, B001 など

function list(value: string | undefined, valid: (s: string) => boolean = (s) => CODE_RE.test(s)): string[] {
  if (!value) return [];
  return [...new Set(value.split(",").map((s) => s.trim()).filter((s) => s && valid(s)))];
}

function int(value: string | undefined, min: number, max: number): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

function float(value: string | undefined, min: number, max: number): number | undefined {
  if (!value) return undefined;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return Math.round(n * 1e6) / 1e6;
}

/** URLのクエリ → 検索条件。不正な値は黙って捨てる(共有URLが壊れていても落ちないように)。 */
export function parseSearchState(params: ParamsLike): SearchState {
  const alcoholIds = new Set<string>(ALCOHOL_OPTIONS.map((o) => o.id));
  const smokingIds = new Set<string>(SMOKING_OPTIONS.map((o) => o.id));
  const sortIds = new Set<string>(SORT_OPTIONS.map((o) => o.id));
  const rangeValues = new Set<number>(RANGE_OPTIONS.map((o) => o.value));
  const walkValues = new Set<number>(WALK_OPTIONS);

  const keyword = getParam(params, K.keyword)?.trim().slice(0, 100) || undefined;
  const lat = float(getParam(params, K.lat), 20, 46); // 日本の範囲
  const lng = float(getParam(params, K.lng), 122, 154);
  const range = int(getParam(params, K.range), 1, 5);
  const smoking = getParam(params, K.smoking);
  const sort = getParam(params, K.sort);
  const walk = int(getParam(params, K.walkMax), 1, 60);

  return {
    largeArea: list(getParam(params, K.largeArea))[0],
    middleAreas: list(getParam(params, K.middleAreas)).slice(0, 5), // API仕様: 5個まで
    keyword,
    lat: lat !== undefined && lng !== undefined ? lat : undefined,
    lng: lat !== undefined && lng !== undefined ? lng : undefined,
    range: range !== undefined && rangeValues.has(range) ? range : undefined,
    genres: list(getParam(params, K.genres)),
    budgets: list(getParam(params, K.budgets)),
    partyMin: int(getParam(params, K.partyMin), 1, 1000),
    partyMax: int(getParam(params, K.partyMax), 1, 1000),
    seatsMin: int(getParam(params, K.seatsMin), 1, 2000),
    flags: list(getParam(params, K.flags), (s) => API_FLAG_BY_ID.has(s)),
    alcohol: list(getParam(params, K.alcohol), (s) => alcoholIds.has(s)) as AlcoholId[],
    smoking: smoking && smokingIds.has(smoking) ? (smoking as SmokingFilter) : undefined,
    walkMax: walk !== undefined && walkValues.has(walk) ? walk : undefined,
    openNow: getParam(params, K.openNow) === "1",
    includeUnknown: getParam(params, K.includeUnknown) === "1",
    sort: sort && sortIds.has(sort) ? (sort as SortId) : "recommend",
    preset: getParam(params, K.preset)?.replace(/[^a-z0-9-]/g, "").slice(0, 40) || undefined,
    page: int(getParam(params, K.page), 1, 50) ?? 1,
  };
}

/** 検索条件 → URLのクエリ。空の項目は出さないので、共有URLが短くなる。 */
export function serializeSearchState(state: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.preset) p.set(K.preset, state.preset);
  if (state.largeArea) p.set(K.largeArea, state.largeArea);
  if (state.middleAreas.length) p.set(K.middleAreas, state.middleAreas.join(","));
  if (state.keyword) p.set(K.keyword, state.keyword);
  if (state.lat !== undefined && state.lng !== undefined) {
    p.set(K.lat, String(state.lat));
    p.set(K.lng, String(state.lng));
  }
  if (state.range !== undefined) p.set(K.range, String(state.range));
  if (state.genres.length) p.set(K.genres, state.genres.join(","));
  if (state.budgets.length) p.set(K.budgets, state.budgets.join(","));
  if (state.partyMin !== undefined) p.set(K.partyMin, String(state.partyMin));
  if (state.partyMax !== undefined) p.set(K.partyMax, String(state.partyMax));
  if (state.seatsMin !== undefined) p.set(K.seatsMin, String(state.seatsMin));
  if (state.flags.length) p.set(K.flags, [...state.flags].sort().join(","));
  if (state.alcohol.length) p.set(K.alcohol, [...state.alcohol].sort().join(","));
  if (state.smoking) p.set(K.smoking, state.smoking);
  if (state.walkMax !== undefined) p.set(K.walkMax, String(state.walkMax));
  if (state.openNow) p.set(K.openNow, "1");
  if (state.includeUnknown) p.set(K.includeUnknown, "1");
  if (state.sort !== "recommend") p.set(K.sort, state.sort);
  if (state.page > 1) p.set(K.page, String(state.page));
  return p;
}

export function searchHref(state: SearchState): string {
  const qs = serializeSearchState(state).toString();
  return qs ? `/search?${qs}` : "/search";
}

/** 場所の指定があるか(APIは場所・キーワード・位置などのどれかが必須) */
export function hasLocation(state: SearchState): boolean {
  return Boolean(state.largeArea || state.middleAreas.length || state.keyword || (state.lat !== undefined && state.lng !== undefined));
}

/** 条件を1つ変えた新しい状態を作る(ページは1に戻す) */
export function withPatch(state: SearchState, patch: Partial<SearchState>): SearchState {
  return { ...state, ...patch, page: patch.page ?? 1 };
}

export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
