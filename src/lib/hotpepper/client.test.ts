import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQueryString, CACHE_SECONDS, createApiBackend, parseSearchResponse } from "./client";
import { HotpepperApiError } from "./types";

test("キャッシュは規約どおり24時間以内", () => {
  assert.ok(CACHE_SECONDS <= 24 * 60 * 60);
});

test("クエリは並び順が固定され、配列はカンマ区切り", () => {
  const a = buildQueryString({ genre: ["G001", "G002"], large_area: "Z011", empty: "" }, "KEY");
  const b = buildQueryString({ large_area: "Z011", genre: ["G001", "G002"] }, "KEY");
  assert.equal(a, b);
  assert.ok(a.includes("genre=G001%2CG002"));
  assert.ok(a.includes("format=json"));
  assert.ok(!a.includes("empty"));
});

test("エラーもHTTP 200で返るので中身で判定する", () => {
  assert.throws(
    () => parseSearchResponse({ results: { api_version: "1.2", results_available: 0, results_returned: 0, results_start: 1, error: [{ message: "keyは必須パラメーターです", code: 3000 }] } }),
    (e: unknown) => e instanceof HotpepperApiError && e.code === "3000",
  );
});

test("APIバックエンドは revalidate を付けて呼ぶ", async () => {
  let seenUrl = "";
  let seenRevalidate: number | undefined;
  const backend = createApiBackend("KEY", async (url, init) => {
    seenUrl = url;
    seenRevalidate = init?.next?.revalidate;
    return new Response(JSON.stringify({ results: { api_version: "1.2", results_available: "1", results_returned: "1", results_start: "1", shop: [{ id: "J1" }] } }));
  });
  const page = await backend.search({ middle_area: ["Y055"] });
  assert.equal(page.total, 1);
  assert.equal(page.shops[0]?.id, "J1");
  assert.ok(seenUrl.startsWith("https://webservice.recruit.co.jp/hotpepper/gourmet/v1/?"));
  assert.equal(seenRevalidate, CACHE_SECONDS);
});
