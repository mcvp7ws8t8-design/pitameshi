import { defineConfig } from "vite";

// Claude の画面(Artifact)用。ゲーム全体を1つの JS にまとめる(scripts/make-artifact.mjs が HTML に埋め込む)
export default defineConfig({
  build: {
    outDir: "dist-artifact",
    emptyOutDir: true,
    lib: { entry: "src/artifact/entry.ts", formats: ["iife"], name: "HallKitchen", fileName: () => "app.js" },
    chunkSizeWarningLimit: 2000,
  },
});
