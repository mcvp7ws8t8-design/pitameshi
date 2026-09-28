/**
 * `osmium export --add-unique-id=type_id -f geojsonseq` の1行(GeoJSON Feature)を、
 * DBに入れる行に変換する。OSMの値は書き換えずにそのまま入れる(ODbLのルール)。
 */

type Position = [number, number];
type Geometry =
  | { type: "Point"; coordinates: Position }
  | { type: "LineString"; coordinates: Position[] }
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };

export type OsmFeature = {
  type: "Feature";
  id?: string; // "n123" "w456" "r789"
  geometry: Geometry | null;
  properties: Record<string, string | undefined>;
};

export type CafeRow = {
  osm_id: string;
  name: string;
  geom: string; // EWKT
  opening_hours: string | null;
  internet_access: string | null;
  smoking: string | null;
  brand: string | null;
  website: string | null;
};

export type StationRow = { osm_id: string; name: string; geom: string };

const TYPE_NAMES: Record<string, string> = { n: "node", w: "way", r: "relation" };

export function osmIdOf(feature: OsmFeature): string | undefined {
  const m = feature.id?.match(/^([nwr])(\d+)$/);
  if (!m) return undefined;
  return `${TYPE_NAMES[m[1]!]}/${m[2]}`;
}

/** 面(建物など)で登録されている店は、外周の頂点の平均を代表点にする(店の位置を示す用途には十分) */
export function representativePoint(g: Geometry | null): Position | undefined {
  if (!g) return undefined;
  const avg = (ring: Position[]): Position => {
    const pts = ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;
    const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return [lng, lat];
  };
  switch (g.type) {
    case "Point":
      return g.coordinates;
    case "LineString":
      return g.coordinates.length ? avg(g.coordinates) : undefined;
    case "Polygon":
      return g.coordinates[0]?.length ? avg(g.coordinates[0]) : undefined;
    case "MultiPolygon":
      return g.coordinates[0]?.[0]?.length ? avg(g.coordinates[0][0]) : undefined;
    default:
      return undefined;
  }
}

function inJapan([lng, lat]: Position): boolean {
  return lat >= 20 && lat <= 46 && lng >= 122 && lng <= 154;
}

function ewkt([lng, lat]: Position): string {
  return `SRID=4326;POINT(${lng.toFixed(7)} ${lat.toFixed(7)})`;
}

function nameOf(p: Record<string, string | undefined>): string | undefined {
  return (p["name"] ?? p["name:ja"] ?? p["brand:ja"] ?? p["brand"])?.trim() || undefined;
}

export function toCafeRow(f: OsmFeature): CafeRow | undefined {
  const p = f.properties ?? {};
  if (p["amenity"] !== "cafe") return undefined;
  const osmId = osmIdOf(f);
  const name = nameOf(p);
  const pt = representativePoint(f.geometry);
  // 店名がない・位置が取れない・日本の外のデータは入れない
  if (!osmId || !name || !pt || !inJapan(pt)) return undefined;
  return {
    osm_id: osmId,
    name,
    geom: ewkt(pt),
    opening_hours: p["opening_hours"] ?? null,
    internet_access: p["internet_access"] ?? null,
    smoking: p["smoking"] ?? null,
    brand: p["brand"] ?? null,
    website: p["website"] ?? p["contact:website"] ?? null,
  };
}

export function toStationRow(f: OsmFeature): StationRow | undefined {
  const p = f.properties ?? {};
  if (p["railway"] !== "station" && p["railway"] !== "halt") return undefined;
  const osmId = osmIdOf(f);
  const name = nameOf(p);
  const pt = representativePoint(f.geometry);
  if (!osmId || !name || !pt || !inJapan(pt)) return undefined;
  return { osm_id: osmId, name, geom: ewkt(pt) };
}
