export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

/** 2点間の距離(メートル、直線)。 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type BBox = { south: number; west: number; north: number; east: number };

/** 点の集まりを囲む範囲に、余白(メートル)を足したもの */
export function bboxAround(points: LatLng[], paddingM: number): BBox | undefined {
  if (points.length === 0) return undefined;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const dLat = paddingM / 111_320;
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLng = paddingM / (111_320 * Math.cos((midLat * Math.PI) / 180));
  return {
    south: Math.min(...lats) - dLat,
    north: Math.max(...lats) + dLat,
    west: Math.min(...lngs) - dLng,
    east: Math.max(...lngs) + dLng,
  };
}

/** API の range(1〜5)をメートルに */
export const RANGE_METERS: Record<number, number> = { 1: 300, 2: 500, 3: 1000, 4: 2000, 5: 3000 };
