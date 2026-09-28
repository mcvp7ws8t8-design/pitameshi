import type { BBox, LatLng } from "../geo";

/**
 * OpenStreetMap 由来のデータ(ODbL)。
 * 重要: OSMのデータ(osm_*)と独自データ(cafe_attributes)は別テーブルに持ち、OSM IDで参照するだけにする。
 * OSMの項目自体を書き換えたり、ホットペッパーの店舗と重複排除して1つにまとめたりしない。
 * (要件定義書「外部連携と制約 > OpenStreetMap」)
 */

export type OsmCafe = {
  osmId: string; // "node/123" "way/456" の形
  name: string;
  lat: number;
  lng: number;
  openingHours?: string;
  internetAccess?: string; // wlan / yes / no など
  smoking?: string;
  brand?: string;
  website?: string;
};

/** 独自属性(C-03)。運営者が確認して登録する。 */
export type CafeAttributes = {
  osmId: string;
  power?: boolean; // 電源
  workFriendly?: boolean; // 作業OK
  longStay?: boolean; // 長居しやすい
  solo?: boolean; // 一人で入りやすい
  checkedAt: string; // 確認日(YYYY-MM-DD)
  source?: string;
};

export type CafeView = OsmCafe & { attributes?: CafeAttributes; distanceM?: number; stale?: boolean };

export type CafeQuery = {
  center: LatLng;
  radiusM: number;
  wifi?: boolean;
  power?: boolean;
  workFriendly?: boolean;
  includeUnknown: boolean;
  limit: number;
};

export interface CafeProvider {
  readonly kind: "supabase" | "mock";
  nearby(q: CafeQuery): Promise<CafeView[]>;
}

export type Station = { osmId: string; name: string; lat: number; lng: number };

export interface StationProvider {
  readonly kind: "supabase" | "mock";
  inBBox(bbox: BBox): Promise<Station[]>;
}

/** 独自属性の確認日がこの日数より古ければ「情報が古い可能性」と表示する */
export const ATTRIBUTE_STALE_DAYS = 180;

export function isStale(checkedAt: string, now: Date = new Date()): boolean {
  const t = Date.parse(checkedAt);
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t > ATTRIBUTE_STALE_DAYS * 24 * 60 * 60 * 1000;
}
