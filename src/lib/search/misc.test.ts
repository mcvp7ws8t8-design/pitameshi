import { test } from "node:test";
import assert from "node:assert/strict";
import { MOCK_SHOPS } from "../hotpepper/fixtures";
import { buildAffiliateUrl, isAllowedDestination } from "../affiliate";
import { createMockCafeProvider, formatOpeningHours, joinAttributes } from "../osm/cafes";
import { isStale } from "../osm/types";
import { aggregate, percent } from "./aggregate";
import { shopBadges } from "./badges";
import { classifySmoking } from "./interpret";

test("エリアの集計", () => {
  const shinjukuIzakaya = MOCK_SHOPS.filter((s) => s.middle_area?.code === "Y055" && s.genre.code === "G001");
  const st = aggregate(shinjukuIzakaya);
  assert.equal(st.sampled, shinjukuIzakaya.length);
  assert.equal(st.smoking.ok + st.smoking.separated + st.smoking.none + st.smoking.unknown, st.sampled);
  // 予算は安い順に並ぶ
  const firstNums = st.budgets.map((b) => Number(b.name.match(/\d+/)![0]));
  assert.deepEqual(firstNums, [...firstNums].sort((a, b) => a - b));
  assert.equal(percent(1, 4), 25);
  assert.equal(percent(1, 0), 0);
});

test("バッジは選んだ条件を先頭に出す", () => {
  const shop = MOCK_SHOPS.find((s) => s.name.includes("宴会場"))!;
  const badges = shopBadges(shop, classifySmoking(shop.non_smoking), ["charter"]);
  assert.equal(badges[0]?.id, "charter");
  assert.ok(badges.length <= 6);
});

test("アフィリエイト:送り先はホットペッパーだけ", () => {
  assert.ok(isAllowedDestination("https://www.hotpepper.jp/strJ000000001/"));
  assert.ok(!isAllowedDestination("https://evil.example.com/"));
  assert.ok(!isAllowedDestination("javascript:alert(1)"));
  assert.throws(() => buildAffiliateUrl("https://evil.example.com/", undefined));
  assert.equal(buildAffiliateUrl("https://www.hotpepper.jp/x/", undefined), "https://www.hotpepper.jp/x/");
  assert.equal(
    buildAffiliateUrl("https://www.hotpepper.jp/x/", "https://ck.example/r?vc_url={URL}"),
    "https://ck.example/r?vc_url=https%3A%2F%2Fwww.hotpepper.jp%2Fx%2F",
  );
});

test("カフェ:独自情報のある店を先に、電源で絞ると不明は指定時のみ", async () => {
  const p = createMockCafeProvider();
  const center = { lat: 35.6905, lng: 139.7005 };
  const all = await p.nearby({ center, radiusM: 1000, includeUnknown: true, limit: 50 });
  assert.ok(all[0]?.attributes, "独自情報がある店が先頭");
  const strict = await p.nearby({ center, radiusM: 1000, power: true, includeUnknown: false, limit: 50 });
  assert.ok(strict.length > 0 && strict.every((c) => c.attributes?.power === true));
});

test("独自情報の確認日が古いと印をつける", () => {
  const now = new Date("2026-09-28");
  assert.equal(isStale("2026-09-01", now), false);
  assert.equal(isStale("2026-01-01", now), true);
  const v = joinAttributes([{ osmId: "node/1", name: "x", lat: 35, lng: 139 }], [{ osmId: "node/1", checkedAt: "2025-01-01" }], now);
  assert.equal(v[0]?.stale, true);
});

test("OSMの営業時間を読みやすく", () => {
  assert.equal(formatOpeningHours("Mo-Fr 08:00-20:00; Sa 10:00-18:00"), "月〜金 08:00〜20:00 / 土 10:00〜18:00");
});
