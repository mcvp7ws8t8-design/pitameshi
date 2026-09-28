import type { MetadataRoute } from "next";
import { LANDING_PAGES } from "@/lib/landing";
import { siteUrl } from "@/lib/site";

/** サイトマップ。検索エンジンに登録するのは固定ページと、厳選したエリア×ジャンルのページだけ(F-05) */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...LANDING_PAGES.map((p) => ({
      url: `${base}/area/${p.area}/${p.genre}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...["/about", "/privacy", "/disclaimer", "/contact"].map((path) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: "yearly" as const, priority: 0.2 })),
  ];
}
