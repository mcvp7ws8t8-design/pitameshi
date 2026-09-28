import "server-only";
import { rpc, supabaseConfigured } from "../supabase";
import { createMockCafeProvider, createMockStationProvider, filterCafes, joinAttributes } from "./cafes";
import type { CafeAttributes, CafeProvider, OsmCafe, StationProvider } from "./types";

/**
 * Supabase の関数(supabase/migrations/0001_init.sql)を呼ぶ。未設定なら仮データ。
 * OSMデータ(osm_cafes)と独自データ(cafe_attributes)は別々に取り、ここで組み合わせる。
 */

type CafeRow = {
  osm_id: string;
  name: string;
  lat: number;
  lng: number;
  opening_hours: string | null;
  internet_access: string | null;
  smoking: string | null;
  brand: string | null;
  website: string | null;
};

type AttrRow = {
  osm_id: string;
  power: boolean | null;
  work_friendly: boolean | null;
  long_stay: boolean | null;
  solo: boolean | null;
  checked_at: string;
  source: string | null;
};

const opt = <T,>(v: T | null): T | undefined => (v === null ? undefined : v);

/** 仮データを使ってよいのは、ホットペッパーも仮データのとき(=開発中)だけ。本番で架空の店を出さないため。 */
function devMockAllowed(): boolean {
  return !process.env.HOTPEPPER_API_KEY;
}

/** Supabase 未設定の本番では undefined(カフェ機能は「準備中」表示) */
export function getCafeProvider(): CafeProvider | undefined {
  if (!supabaseConfigured()) return devMockAllowed() ? createMockCafeProvider() : undefined;
  return {
    kind: "supabase",
    async nearby(q) {
      const rows = await rpc<CafeRow[]>("nearby_cafes", { p_lat: q.center.lat, p_lng: q.center.lng, p_radius_m: q.radiusM, p_limit: 300 });
      const ids = rows.map((r) => r.osm_id);
      const attrs = ids.length ? await rpc<AttrRow[]>("cafe_attributes_for", { p_osm_ids: ids }) : [];
      const cafes: OsmCafe[] = rows.map((r) => ({
        osmId: r.osm_id,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        openingHours: opt(r.opening_hours),
        internetAccess: opt(r.internet_access),
        smoking: opt(r.smoking),
        brand: opt(r.brand),
        website: opt(r.website),
      }));
      const attributes: CafeAttributes[] = attrs.map((a) => ({
        osmId: a.osm_id,
        power: opt(a.power),
        workFriendly: opt(a.work_friendly),
        longStay: opt(a.long_stay),
        solo: opt(a.solo),
        checkedAt: a.checked_at,
        source: opt(a.source),
      }));
      return filterCafes(joinAttributes(cafes, attributes), q);
    },
  };
}

/** Supabase 未設定の本番では undefined(「駅から徒歩」は使われず、その旨を表示) */
export function getStationProvider(): StationProvider | undefined {
  if (!supabaseConfigured()) return devMockAllowed() ? createMockStationProvider() : undefined;
  return {
    kind: "supabase",
    async inBBox(b) {
      const rows = await rpc<{ osm_id: string; name: string; lat: number; lng: number }[]>("stations_in_bbox", {
        p_south: b.south,
        p_west: b.west,
        p_north: b.north,
        p_east: b.east,
      });
      return rows.map((r) => ({ osmId: r.osm_id, name: r.name, lat: r.lat, lng: r.lng }));
    },
  };
}
