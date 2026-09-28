import { test } from "node:test";
import assert from "node:assert/strict";
import { addRecent, isSavable, parseRecent, RECENT_MAX } from "./recent";

const item = (path: string, savedAt = 0) => ({ path, label: path, detail: "", savedAt });

test("addRecent: 同じ条件は先頭に移し、最大件数で切る", () => {
  let list = [item("/search?ma=A"), item("/search?ma=B")];
  list = addRecent(list, item("/search?ma=B", 9));
  assert.deepEqual(list.map((r) => r.path), ["/search?ma=B", "/search?ma=A"]);
  for (let i = 0; i < 10; i++) list = addRecent(list, item(`/search?q=${i}`));
  assert.equal(list.length, RECENT_MAX);
  assert.equal(list[0]!.path, "/search?q=9");
});

test("parseRecent: 壊れた値・よそのURLは捨てる", () => {
  assert.deepEqual(parseRecent("not json"), []);
  assert.deepEqual(parseRecent('{"a":1}'), []);
  const parsed = parseRecent(JSON.stringify([item("/search?ma=A"), { path: "https://evil.example/", label: "x" }, null]));
  assert.deepEqual(parsed.map((r) => r.path), ["/search?ma=A"]);
});

test("isSavable: 現在地の検索は保存しない", () => {
  assert.equal(isSavable("/search?ma=Y055"), true);
  assert.equal(isSavable("/search?lat=35.6&lng=139.7"), false);
  assert.equal(isSavable("/search"), false);
});
