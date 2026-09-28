import { test } from "node:test";
import assert from "node:assert/strict";
import { MOCK_SHOPS } from "./hotpepper/fixtures";
import { breadcrumbLd, jsonLdString, shopListLd } from "./seo";

test("jsonLdString: </script> で抜け出せない", () => {
  const s = jsonLdString({ name: "</script><script>alert(1)</script>" });
  assert.ok(!s.includes("</script>"));
  assert.deepEqual(JSON.parse(s), { name: "</script><script>alert(1)</script>" });
});

test("shopListLd / breadcrumbLd: 順番と必須項目", () => {
  const ld = shopListLd("新宿の居酒屋", MOCK_SHOPS.slice(0, 2));
  assert.equal(ld.itemListElement.length, 2);
  assert.equal(ld.itemListElement[1]!.position, 2);
  assert.equal(ld.itemListElement[0]!.item["@type"], "Restaurant");
  assert.match(ld.itemListElement[0]!.item.url, /\/shop\/J\d+$/);
  const bc = breadcrumbLd([{ name: "トップ", path: "/" }, { name: "新宿", path: "/search?ma=Y055" }]);
  assert.equal(bc.itemListElement[1]!.position, 2);
});
