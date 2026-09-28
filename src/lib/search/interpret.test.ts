import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySmoking, estimateBudgetYen, matchesSmoking, parseCount, yesNo } from "./interpret";
import { EMPTY_STATE, parseSearchState, serializeSearchState } from "./query";

test("yesNo: 否定語を先に判定する", () => {
  assert.equal(yesNo("あり"), true);
  assert.equal(yesNo("なし"), false);
  assert.equal(yesNo("貸切可"), true);
  assert.equal(yesNo("貸切不可"), false);
  assert.equal(yesNo("お子様連れ歓迎"), true);
  assert.equal(yesNo("営業している"), true);
  assert.equal(yesNo("営業していない"), false);
  assert.equal(yesNo("未確認"), undefined);
  assert.equal(yesNo(""), undefined);
  assert.equal(yesNo(undefined), undefined);
});

test("classifySmoking: 禁煙席の記載から判定", () => {
  assert.equal(classifySmoking("全面禁煙"), "none");
  assert.equal(classifySmoking("一部禁煙"), "separated");
  assert.equal(classifySmoking("一部禁煙(喫煙専用室あり)"), "separated");
  assert.equal(classifySmoking("禁煙席なし"), "ok");
  assert.equal(classifySmoking("未確認"), "unknown");
  assert.equal(classifySmoking(undefined), "unknown");
});

test("matchesSmoking: 喫煙できるは分煙も含む、不明は指定時のみ", () => {
  assert.equal(matchesSmoking("separated", "ok", false), true);
  assert.equal(matchesSmoking("none", "ok", false), false);
  assert.equal(matchesSmoking("unknown", "none", false), false);
  assert.equal(matchesSmoking("unknown", "none", true), true);
});

test("parseCount: 全角や単位つきでも数える", () => {
  assert.equal(parseCount("185"), 185);
  assert.equal(parseCount("最大１２０名"), 120);
  assert.equal(parseCount(40), 40);
  assert.equal(parseCount(""), undefined);
  assert.equal(parseCount("なし"), undefined);
});

test("estimateBudgetYen: 平均予算の文言を優先", () => {
  const shop = { budget: { code: "B002", name: "2001～3000円", average: "宴会3,500円" } } as never;
  assert.equal(estimateBudgetYen(shop), 3500);
  const noAvg = { budget: { code: "B002", name: "2001～3000円", average: "" } } as never;
  assert.equal(estimateBudgetYen(noAvg), 2501);
});

test("検索条件はURLと行き来できる(共有URL)", () => {
  const state = {
    ...EMPTY_STATE,
    preset: "nomikai",
    middleAreas: ["Y055"],
    genres: ["G001", "G002"],
    flags: ["private_room", "free_drink"],
    alcohol: ["sake" as const, "wine" as const],
    smoking: "ok" as const,
    partyMin: 10,
    partyMax: 20,
    sort: "budget_asc" as const,
    includeUnknown: true,
  };
  const qs = serializeSearchState(state);
  const back = parseSearchState(qs);
  assert.deepEqual(back.middleAreas, ["Y055"]);
  assert.deepEqual(back.flags.sort(), ["free_drink", "private_room"]);
  assert.deepEqual(back.alcohol.sort(), ["sake", "wine"]);
  assert.equal(back.smoking, "ok");
  assert.equal(back.partyMax, 20);
  assert.equal(back.sort, "budget_asc");
  assert.equal(back.includeUnknown, true);
  assert.equal(back.preset, "nomikai");
});

test("不正なURLの値は捨てる", () => {
  const s = parseSearchState(new URLSearchParams("f=private_room,<script>,hack&sm=abc&page=999&lat=99&lng=0&g=G001,DROP TABLE"));
  assert.deepEqual(s.flags, ["private_room"]);
  assert.equal(s.smoking, undefined);
  assert.equal(s.page, 1);
  assert.equal(s.lat, undefined);
  assert.deepEqual(s.genres, ["G001"]);
});
