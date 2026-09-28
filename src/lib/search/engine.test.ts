import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockBackend } from "../hotpepper/mock";
import type { HotpepperBackend, HotpepperQuery } from "../hotpepper/types";
import { buildApiQuery, countResults, needsServerProcessing, removableConditions, runSearch, suggestRelaxations } from "./engine";
import { applyPreset, PRESET_BY_ID } from "./presets";
import { EMPTY_STATE, type SearchState } from "./query";
import type { StationProvider } from "../osm/types";

const shinjuku: SearchState = { ...EMPTY_STATE, middleAreas: ["Y055"] };

/** 呼び出されたクエリを記録する */
function spy(backend: HotpepperBackend) {
  const calls: HotpepperQuery[] = [];
  return {
    calls,
    backend: {
      kind: backend.kind,
      search: (q: HotpepperQuery) => {
        calls.push(q);
        return backend.search(q);
      },
    } satisfies HotpepperBackend,
  };
}

test("場所がないときは検索しない", async () => {
  const r = await runSearch(EMPTY_STATE, { backend: createMockBackend() });
  assert.equal(r.status, "need-location");
});

test("APIフラグはそのままAPIに渡る", () => {
  const q = buildApiQuery({ ...shinjuku, flags: ["private_room", "ktai_coupon"], partyMin: 20 });
  assert.equal(q.private_room, "1");
  assert.equal(q.ktai_coupon, "0"); // クーポンは 0 = あり
  assert.equal(q.party_capacity, "19"); // API は「指定より大きい」なので 1 引く
  assert.equal(needsServerProcessing({ ...shinjuku, flags: ["private_room"] }), false);
});

test("予算コードが3つ以上ならAPIに渡さずサーバー側で絞る", async () => {
  const state = { ...shinjuku, budgets: ["B009", "B010", "B011", "B001"] };
  assert.equal(buildApiQuery(state).budget, undefined);
  assert.equal(needsServerProcessing(state), true);
  const r = await runSearch(state, { backend: createMockBackend() });
  assert.ok(r.items.length > 0);
  for (const v of r.items) assert.ok(state.budgets.includes(v.shop.budget!.code));
});

test("喫煙できる(分煙含む)で絞ると、全席禁煙と不明の店は出ない", async () => {
  const r = await runSearch({ ...shinjuku, smoking: "ok" }, { backend: createMockBackend() });
  assert.ok(r.items.length > 0);
  for (const v of r.items) assert.ok(v.smoking === "ok" || v.smoking === "separated");
  const withUnknown = await runSearch({ ...shinjuku, smoking: "ok", includeUnknown: true }, { backend: createMockBackend() });
  assert.ok(withUnknown.total > r.total, "不明の店も含めると増える");
});

test("お酒の「どれか」は種類ごとに呼んで重複なしでまとめる", async () => {
  const { backend, calls } = spy(createMockBackend());
  const r = await runSearch({ ...shinjuku, alcohol: ["sake", "cocktail"] }, { backend });
  assert.ok(calls.some((c) => c.sake === "1") && calls.some((c) => c.cocktail === "1"));
  const ids = r.items.map((v) => v.shop.id);
  assert.equal(new Set(ids).size, ids.length, "重複がない");
  const sakeOnly = await runSearch({ ...shinjuku, alcohol: ["sake"] }, { backend: createMockBackend() });
  assert.ok(r.total >= sakeOnly.total);
});

test("宴会人数の上限と並び替え", async () => {
  const r = await runSearch({ ...shinjuku, partyMin: 20, partyMax: 60, sort: "party_desc" }, { backend: createMockBackend() });
  assert.ok(r.items.length > 1);
  const caps = r.items.map((v) => v.partyCapacity!);
  for (const c of caps) assert.ok(c >= 20 && c <= 60);
  assert.deepEqual(caps, [...caps].sort((a, b) => b - a));
});

test("予算が安い順", async () => {
  const r = await runSearch({ ...shinjuku, sort: "budget_asc" }, { backend: createMockBackend() });
  const yen = r.items.map((v) => v.budgetYen ?? Infinity);
  assert.deepEqual(yen, [...yen].sort((a, b) => a - b));
});

test("プリセット「飲み会」で検索できる", async () => {
  const state = applyPreset(shinjuku, PRESET_BY_ID.get("nomikai")!);
  const r = await runSearch(state, { backend: createMockBackend() });
  assert.equal(r.status, "ok");
  assert.ok(r.total > 0);
  for (const v of r.items) assert.ok(["G001", "G002"].includes(v.shop.genre.code!));
});

test("0件のときは外すと増える条件を提案する", async () => {
  const state: SearchState = { ...shinjuku, flags: ["private_room", "pet", "karaoke"], smoking: "none" };
  const r = await runSearch(state, { backend: createMockBackend() });
  assert.equal(r.total, 0);
  const suggestions = await suggestRelaxations(state, { backend: createMockBackend() });
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((s) => s.count > 0));
  assert.ok(removableConditions(state).some((c) => c.id === "smoking"));
});

test("1つ外せば見つかるときは、その条件を件数つきで提案する", async () => {
  const state: SearchState = { ...shinjuku, flags: ["pet", "karaoke"] };
  const suggestions = await suggestRelaxations(state, { backend: createMockBackend() });
  assert.ok(suggestions.length >= 2);
  assert.ok(suggestions.every((s) => !s.id.startsWith("multi:")));
});

test("件数だけ数える", async () => {
  const { total } = await countResults({ ...shinjuku, flags: ["free_drink"] }, { backend: createMockBackend() });
  const full = await runSearch({ ...shinjuku, flags: ["free_drink"] }, { backend: createMockBackend() });
  assert.equal(total, full.total);
});

test("駅から徒歩○分(駅データがあるとき)", async () => {
  const stations: StationProvider = {
    kind: "mock",
    inBBox: async () => [{ osmId: "node/1", name: "新宿", lat: 35.6905, lng: 139.7005 }],
  };
  const r = await runSearch({ ...shinjuku, walkMax: 5 }, { backend: createMockBackend(), stations });
  assert.ok(r.items.length > 0);
  for (const v of r.items) assert.ok(v.station && v.station.walkMinutes <= 5);
  assert.equal(r.notes.length, 0);
});

test("駅データがないときは徒歩の条件を使わず、そのことを知らせる", async () => {
  const r = await runSearch({ ...shinjuku, walkMax: 5 }, { backend: createMockBackend() });
  assert.ok(r.notes.some((n) => n.includes("駅")));
});

test("現在地検索:近い順は order を渡さない / おすすめ順は 4", () => {
  const loc = { ...EMPTY_STATE, lat: 35.69, lng: 139.7, range: 3 };
  assert.equal(buildApiQuery({ ...loc, sort: "distance" }).order, undefined);
  assert.equal(buildApiQuery(loc).order, "4");
});
