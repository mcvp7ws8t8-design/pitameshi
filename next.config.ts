import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cloudflare Workers では Next.js 標準の画像最適化が使えないため無効化。
    // ホットペッパーの写真URLはそのまま表示する(API規約上、画像の再配布・加工はしない)。
    unoptimized: true,
  },
  poweredByHeader: false,
};

export default nextConfig;

// `next dev` 中も Cloudflare のバインディング(KV など)を使えるようにする。
// 参考: https://opennext.js.org/cloudflare/get-started
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
