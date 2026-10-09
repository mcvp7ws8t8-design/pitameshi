import { defineConfig } from "vite";

// 図鑑ページ用(開発中は `npx vite -c vite.gallery.config.ts` で gallery.html を開く)。
// 公開用の1枚のページは scripts/make-gallery.mjs が作る。
export default defineConfig({
  build: {
    outDir: "dist-gallery",
    emptyOutDir: true,
    lib: { entry: "src/gallery/entry.ts", formats: ["iife"], name: "HallKitchenGallery", fileName: () => "app.js" },
    chunkSizeWarningLimit: 2000,
  },
});
