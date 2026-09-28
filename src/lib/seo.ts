import type { HotpepperShop } from "./hotpepper/types";
import { shopLatLng } from "./search/interpret";
import { SITE_NAME, siteUrl } from "./site";

/**
 * 構造化データ(JSON-LD)。要件定義書「非機能要件 > SEO」。
 * <script type="application/ld+json"> に入れるので、"<" をエスケープして HTML として解釈されないようにする。
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${base}${it.path}` })),
  };
}

function restaurantLd(shop: HotpepperShop) {
  const pos = shopLatLng(shop);
  return {
    "@type": "Restaurant",
    name: shop.name,
    url: `${siteUrl()}/shop/${shop.id}`,
    image: shop.photo.pc.l,
    servesCuisine: shop.genre.name,
    address: { "@type": "PostalAddress", streetAddress: shop.address, addressCountry: "JP" },
    ...(shop.budget?.name ? { priceRange: shop.budget.name } : {}),
    ...(pos ? { geo: { "@type": "GeoCoordinates", latitude: pos.lat, longitude: pos.lng } } : {}),
  };
}

/** エリア×ジャンルのページ(F-05)のお店一覧 */
export function shopListLd(name: string, shops: HotpepperShop[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: shops.length,
    itemListElement: shops.map((s, i) => ({ "@type": "ListItem", position: i + 1, item: restaurantLd(s) })),
  };
}

export function websiteLd() {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${base}/`,
    potentialAction: { "@type": "SearchAction", target: `${base}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
  };
}
