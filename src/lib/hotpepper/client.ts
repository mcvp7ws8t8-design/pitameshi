import {
  HotpepperApiError,
  type HotpepperApiErrorBody,
  type HotpepperBackend,
  type HotpepperMasterResponse,
  type HotpepperPage,
  type HotpepperQuery,
  type HotpepperSearchResponse,
} from "./types";

export const HOTPEPPER_BASE_URL = "https://webservice.recruit.co.jp/hotpepper";

/**
 * API規約: キャッシュは24時間以内に更新する(ご利用案内に個別規定がない場合)。
 * 余裕を見て12時間にしている。24時間を超える値にしないこと。
 */
export const CACHE_SECONDS = 60 * 60 * 12;

/** 1回の呼び出しで取得できる最大件数(API仕様) */
export const MAX_COUNT_PER_CALL = 100;

type FetchLike = (input: string, init?: RequestInit & { next?: { revalidate?: number } }) => Promise<Response>;

export function buildQueryString(query: HotpepperQuery, apiKey: string): string {
  const params = new URLSearchParams();
  params.set("key", apiKey);
  params.set("format", "json");
  // キーを並べ替えて、同じ条件なら同じURL(=同じキャッシュ)になるようにする
  for (const key of Object.keys(query).sort()) {
    const value = query[key];
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      // 複数指定は カンマ区切り(API仕様)
      params.set(key, value.join(","));
    } else {
      params.set(key, value);
    }
  }
  return params.toString();
}

function toNumber(value: number | string | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  const n = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * エラー時もHTTPステータスは200で返る(API仕様)ので、中身で判定する。
 * 1000: サーバ障害 / 2000: APIキーまたはIP認証 / 3000: パラメータ不正
 */
function throwIfApiError(error: HotpepperApiErrorBody | undefined) {
  if (!error) return;
  const err = Array.isArray(error) ? error[0] : error;
  throw new HotpepperApiError(err?.message ?? "API error", String(err?.code ?? "unknown"));
}

export function parseSearchResponse(json: HotpepperSearchResponse): HotpepperPage {
  const results = json.results;
  throwIfApiError(results.error);
  return {
    total: toNumber(results.results_available),
    start: toNumber(results.results_start, 1),
    shops: results.shop ?? [],
  };
}

export function createApiBackend(apiKey: string, fetchImpl: FetchLike = fetch): HotpepperBackend {
  return {
    kind: "api",
    async search(query) {
      const url = `${HOTPEPPER_BASE_URL}/gourmet/v1/?${buildQueryString(query, apiKey)}`;
      const res = await fetchImpl(url, { next: { revalidate: CACHE_SECONDS } });
      if (!res.ok) {
        throw new HotpepperApiError(`HTTP ${res.status}`, `http_${res.status}`);
      }
      return parseSearchResponse((await res.json()) as HotpepperSearchResponse);
    },
  };
}

/** マスタAPI(ジャンル・予算・エリアなど)の取得。マスタは頻繁に変わらないが、規約に合わせ24時間以内で更新する。 */
export async function fetchMaster<K extends string>(
  apiKey: string,
  path: string,
  key: K,
  query: HotpepperQuery = {},
  fetchImpl: FetchLike = fetch,
) {
  const url = `${HOTPEPPER_BASE_URL}/${path}/v1/?${buildQueryString(query, apiKey)}`;
  const res = await fetchImpl(url, { next: { revalidate: CACHE_SECONDS } });
  if (!res.ok) throw new HotpepperApiError(`HTTP ${res.status}`, `http_${res.status}`);
  const json = (await res.json()) as HotpepperMasterResponse<K>;
  // エラーもHTTP 200で返る。空の配列にすると画面の選択肢が消えるので、投げて予備の値を使わせる
  throwIfApiError(json.results.error);
  return json.results[key] ?? [];
}
