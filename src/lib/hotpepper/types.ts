/**
 * ホットペッパーグルメ グルメサーチAPI の型定義。
 * 参考: https://webservice.recruit.co.jp/doc/hotpepper/reference.html
 * レスポンスは format=json で取得する。
 */

export type CodeName = { code: string; name: string };

export type HotpepperShop = {
  id: string;
  name: string;
  logo_image?: string;
  name_kana?: string;
  address: string;
  station_name?: string;
  ktai_coupon?: number | string; // 0:あり 1:なし
  large_service_area?: CodeName;
  service_area?: CodeName;
  large_area?: CodeName;
  middle_area?: CodeName;
  small_area?: CodeName;
  lat: number | string;
  lng: number | string;
  genre: { code?: string; name: string; catch?: string };
  sub_genre?: CodeName;
  budget?: { code: string; name: string; average?: string };
  budget_memo?: string;
  catch: string;
  capacity?: number | string;
  access: string;
  mobile_access?: string;
  urls: { pc: string };
  photo: {
    pc: { l: string; m: string; s: string };
    mobile?: { l: string; s: string };
  };
  open?: string;
  close?: string;
  party_capacity?: number | string;
  wifi?: string;
  wedding?: string;
  course?: string;
  free_drink?: string;
  free_food?: string;
  private_room?: string;
  horigotatsu?: string;
  tatami?: string;
  card?: string;
  non_smoking?: string;
  charter?: string;
  ktai?: string;
  parking?: string;
  barrier_free?: string;
  other_memo?: string;
  sommelier?: string;
  open_air?: string;
  show?: string;
  equipment?: string;
  karaoke?: string;
  band?: string;
  tv?: string;
  english?: string;
  pet?: string;
  child?: string;
  lunch?: string;
  midnight?: string;
  shop_detail_memo?: string;
  coupon_urls?: { pc?: string; sp?: string };
};

export type HotpepperSearchResponse = {
  results: {
    api_version: string;
    results_available: number | string;
    results_returned: number | string;
    results_start: number | string;
    shop?: HotpepperShop[];
    error?: HotpepperApiErrorBody;
  };
};

/** エラー時の results.error(配列のときと1件のときがある) */
export type HotpepperApiErrorBody = { message: string; code: number | string }[] | { message: string; code: number | string };

export type HotpepperMasterResponse<K extends string> = {
  results: {
    api_version: string;
    results_available: number | string;
    results_returned: number | string;
    results_start: number | string;
    error?: HotpepperApiErrorBody;
  } & { [key in K]?: (CodeName & Record<string, unknown>)[] };
};

/** APIに渡す検索パラメータ(値はすべて文字列化して送る) */
export type HotpepperQuery = Record<string, string | string[] | undefined>;

/** 検索結果(1回のAPI呼び出し分) */
export type HotpepperPage = {
  total: number;
  start: number;
  shops: HotpepperShop[];
};

/**
 * 検索の実行先。本物のAPIと仮データを差し替えられるようにしている。
 * 1回の呼び出しで最大100件(API仕様)。
 */
export interface HotpepperBackend {
  readonly kind: "api" | "mock";
  search(query: HotpepperQuery): Promise<HotpepperPage>;
}

export class HotpepperApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "HotpepperApiError";
  }
}
