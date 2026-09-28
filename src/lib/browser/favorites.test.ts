import { test } from "node:test";
import assert from "node:assert/strict";
import { FAVORITES_MAX, parseFavorites, parseIdsParam, toggleFavorite } from "./favorites";

test("toggleFavorite: 追加と削除、上限", () => {
  let list = toggleFavorite([], "J000000001");
  assert.deepEqual(list, ["J000000001"]);
  list = toggleFavorite(list, "J000000001");
  assert.deepEqual(list, []);
  for (let i = 0; i < 30; i++) list = toggleFavorite(list, `J${String(i).padStart(9, "0")}`);
  assert.equal(list.length, FAVORITES_MAX);
  assert.equal(list[0], "J000000029");
});

test("parseFavorites / parseIdsParam: 店舗IDの形式以外は捨てる", () => {
  assert.deepEqual(parseFavorites('["J000000001","x",1,"J000000001"]'), ["J000000001"]);
  assert.deepEqual(parseFavorites("{"), []);
  assert.deepEqual(parseIdsParam("J000000001,javascript:alert(1),J000000002"), ["J000000001", "J000000002"]);
});
