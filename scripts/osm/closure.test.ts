import { test } from "node:test";
import assert from "node:assert/strict";
import { closureReport, findClosureIssues, type AttributeCheckRow } from "./closure";

const today = new Date("2026-09-28T00:00:00Z");
const row = (p: Partial<AttributeCheckRow>): AttributeCheckRow => ({
  osm_id: "node/1",
  name_at_check: "珈琲店 あおば",
  current_name: "珈琲店 あおば",
  checked_at: "2026-09-01",
  in_osm: true,
  ...p,
});

test("findClosureIssues: 消えた・店名変更・古い を見つける", () => {
  const found = findClosureIssues(
    [
      row({ osm_id: "node/1" }),
      row({ osm_id: "node/2", in_osm: false, current_name: null }),
      row({ osm_id: "node/3", current_name: "カフェ みどり" }),
      row({ osm_id: "node/4", checked_at: "2026-01-01" }),
      row({ osm_id: "node/5", current_name: "珈琲店あおば" }), // 空白の違いだけ
    ],
    today,
  );
  assert.deepEqual(
    found.map((f) => [f.osmId, f.reasons]),
    [
      ["node/2", ["missing"]],
      ["node/3", ["renamed"]],
      ["node/4", ["stale"]],
    ],
  );
});

test("closureReport: 表に OSM へのリンクを出す", () => {
  const md = closureReport(findClosureIssues([row({ osm_id: "way/9", in_osm: false })], today), 3);
  assert.match(md, /3 件のうち、確認が必要なもの: 1 件/);
  assert.match(md, /\[way\/9\]\(https:\/\/www\.openstreetmap\.org\/way\/9\)/);
});
