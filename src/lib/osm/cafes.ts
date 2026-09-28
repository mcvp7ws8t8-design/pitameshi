import { distanceMeters, type BBox } from "../geo";
import { isStale, type CafeAttributes, type CafeProvider, type CafeQuery, type CafeView, type OsmCafe, type Station, type StationProvider } from "./types";

/**
 * 仮データ(OSMの取り込み前・Supabase未設定のとき用)。店名はすべて架空。
 * 本番では supabase/migrations の関数 nearby_cafes / stations_in_bbox から取る(providers.ts)。
 */

export const MOCK_STATIONS: Station[] = [
  { osmId: "node/mock-1", name: "新宿", lat: 35.6905, lng: 139.7005 },
  { osmId: "node/mock-2", name: "新宿三丁目", lat: 35.6906, lng: 139.7066 },
  { osmId: "node/mock-3", name: "銀座", lat: 35.6717, lng: 139.765 },
  { osmId: "node/mock-4", name: "有楽町", lat: 35.6751, lng: 139.763 },
  { osmId: "node/mock-5", name: "新橋", lat: 35.6663, lng: 139.7583 },
];

const MOCK_CAFES: OsmCafe[] = [
  { osmId: "node/m101", name: "珈琲店 あおば", lat: 35.6921, lng: 139.7021, openingHours: "Mo-Su 08:00-22:00", internetAccess: "wlan" },
  { osmId: "node/m102", name: "喫茶 しおり", lat: 35.6889, lng: 139.7034, openingHours: "Mo-Sa 10:00-19:00" },
  { osmId: "node/m103", name: "ワークカフェ ノート", lat: 35.6912, lng: 139.6988, internetAccess: "wlan" },
  { osmId: "way/m104", name: "カフェ ひだまり", lat: 35.6878, lng: 139.7002 },
  { osmId: "node/m105", name: "純喫茶 マロン", lat: 35.6935, lng: 139.7049, openingHours: "Mo-Su 07:00-20:00", smoking: "yes" },
  { osmId: "node/m201", name: "銀座珈琲 つばめ", lat: 35.6728, lng: 139.7661, openingHours: "Mo-Su 09:00-21:00", internetAccess: "wlan" },
  { osmId: "node/m202", name: "カフェ 白い椅子", lat: 35.6705, lng: 139.7639 },
  { osmId: "node/m203", name: "ティーサロン 月光", lat: 35.6741, lng: 139.7674, openingHours: "Tu-Su 11:00-19:00" },
];

const MOCK_ATTRIBUTES: CafeAttributes[] = [
  { osmId: "node/m101", power: true, workFriendly: true, longStay: true, solo: true, checkedAt: "2026-09-20", source: "運営者が確認(仮)" },
  { osmId: "node/m103", power: true, workFriendly: true, longStay: false, solo: true, checkedAt: "2026-02-01", source: "運営者が確認(仮)" },
  { osmId: "node/m201", power: false, workFriendly: false, longStay: true, solo: true, checkedAt: "2026-08-15", source: "運営者が確認(仮)" },
];

function wifiOf(c: OsmCafe): boolean | undefined {
  if (!c.internetAccess) return undefined;
  return c.internetAccess !== "no";
}

/** 条件で絞る。情報がない項目は includeUnknown のときだけ残す(U-07) */
export function filterCafes(cafes: CafeView[], q: CafeQuery): CafeView[] {
  const pass = (v: boolean | undefined) => (v === undefined ? q.includeUnknown : v);
  return cafes
    .map((c) => ({ ...c, distanceM: Math.round(distanceMeters(q.center, c)) }))
    .filter((c) => c.distanceM! <= q.radiusM)
    .filter((c) => (q.wifi ? pass(wifiOf(c)) : true))
    .filter((c) => (q.power ? pass(c.attributes?.power) : true))
    .filter((c) => (q.workFriendly ? pass(c.attributes?.workFriendly) : true))
    .sort((a, b) => {
      // 独自情報がある店を先に、その中で近い順
      const ia = a.attributes ? 0 : 1;
      const ib = b.attributes ? 0 : 1;
      return ia - ib || a.distanceM! - b.distanceM!;
    })
    .slice(0, q.limit);
}

export function joinAttributes(cafes: OsmCafe[], attrs: CafeAttributes[], now: Date = new Date()): CafeView[] {
  const byId = new Map(attrs.map((a) => [a.osmId, a]));
  return cafes.map((c) => {
    const a = byId.get(c.osmId);
    return a ? { ...c, attributes: a, stale: isStale(a.checkedAt, now) } : { ...c };
  });
}

export function createMockCafeProvider(): CafeProvider {
  return {
    kind: "mock",
    async nearby(q) {
      return filterCafes(joinAttributes(MOCK_CAFES, MOCK_ATTRIBUTES), q);
    },
  };
}

export function createMockStationProvider(): StationProvider {
  return {
    kind: "mock",
    async inBBox(b: BBox) {
      return MOCK_STATIONS.filter((s) => s.lat >= b.south && s.lat <= b.north && s.lng >= b.west && s.lng <= b.east);
    },
  };
}

/** OSMの opening_hours を人が読める形に(細かい書式は変換せず、曜日だけ日本語にする) */
export function formatOpeningHours(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const days: Record<string, string> = { Mo: "月", Tu: "火", We: "水", Th: "木", Fr: "金", Sa: "土", Su: "日", PH: "祝" };
  return value.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => days[d] ?? d).replace(/-/g, "〜").replace(/\s*;\s*/g, " / ");
}
