// dist-artifact/app.js と index.html の見た目から、Artifact に公開する1枚のページを作る。
// Artifact は <html> や <head> を自分で書かないので、<title>・<style>・本体・<script> だけを並べる。
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const body = html.match(/<body>([\s\S]*?)<script type="module"/)?.[1];
if (!css || !body) throw new Error("index.html から見た目を取り出せませんでした");
const js = readFileSync("dist-artifact/app.js", "utf8").replaceAll("</script", "<\\/script");
// 素材ファイルはページに添えて公開できない形式なので、base64 にして埋め込む(src/client/assets.ts が読む)
const assets = Object.fromEntries(
  ["hdri/warehouse.hdr", "models/glass-vase-flowers.glb"].map((f) => [f, readFileSync(`public/assets/${f}`).toString("base64")]),
);

const page = `<title>ホール&amp;キッチン</title>
<style>
:root { color-scheme: dark; }
${css}
</style>
${body.trim()}
<script>
window.__HK_ASSETS__ = ${JSON.stringify(assets)};
</script>
<script>
${js}
</script>
`;
writeFileSync("dist-artifact/page.html", page);
console.log(`dist-artifact/page.html ${(page.length / 1024).toFixed(0)} KB`);
