import { test } from "node:test";
import assert from "node:assert/strict";
import { osmIdOf, representativePoint, toCafeRow, toStationRow, type OsmFeature } from "./transform";

test("OSM ID を node/way の形に", () => {
  assert.equal(osmIdOf({ type: "Feature", id: "n123", geometry: null, properties: {} }), "node/123");
  assert.equal(osmIdOf({ type: "Feature", id: "w45", geometry: null, properties: {} }), "way/45");
  assert.equal(osmIdOf({ type: "Feature", id: "x", geometry: null, properties: {} }), undefined);
});

test("建物(面)のカフェは代表点を出す", () => {
  const p = representativePoint({ type: "Polygon", coordinates: [[[139, 35], [139.002, 35], [139.002, 35.002], [139, 35.002], [139, 35]]] });
  assert.ok(p);
  assert.ok(Math.abs(p[0] - 139.001) < 1e-9 && Math.abs(p[1] - 35.001) < 1e-9);
});

test("カフェの行:OSMの値をそのまま入れる", () => {
  const f: OsmFeature = {
    type: "Feature",
    id: "n1",
    geometry: { type: "Point", coordinates: [139.7, 35.69] },
    properties: { amenity: "cafe", name: "テスト珈琲", opening_hours: "Mo-Su 08:00-20:00", internet_access: "wlan" },
  };
  const row = toCafeRow(f);
  assert.ok(row);
  assert.equal(row.osm_id, "node/1");
  assert.equal(row.opening_hours, "Mo-Su 08:00-20:00");
  assert.equal(row.internet_access, "wlan");
  assert.ok(row.geom.startsWith("SRID=4326;POINT(139.7"));
});

test("店名がない・日本の外・カフェ以外は入れない", () => {
  const base = { type: "Feature" as const, id: "n1", geometry: { type: "Point" as const, coordinates: [139.7, 35.69] as [number, number] } };
  assert.equal(toCafeRow({ ...base, properties: { amenity: "cafe" } }), undefined);
  assert.equal(toCafeRow({ ...base, properties: { amenity: "restaurant", name: "x" } }), undefined);
  assert.equal(toCafeRow({ ...base, geometry: { type: "Point", coordinates: [2.35, 48.85] }, properties: { amenity: "cafe", name: "Paris" } }), undefined);
});

test("駅の行", () => {
  const row = toStationRow({ type: "Feature", id: "n9", geometry: { type: "Point", coordinates: [139.7005, 35.6905] }, properties: { railway: "station", name: "新宿" } });
  assert.equal(row?.name, "新宿");
});
