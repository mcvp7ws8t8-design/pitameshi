// dist-gallery/app.js と gallery.html の見た目から、Artifact に公開する1枚のページを作る(make-artifact.mjs の図鑑版)。
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const html = readFileSync("gallery.html", "utf8");
const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const body = html.match(/<body>([\s\S]*?)<script type="module"/)?.[1];
if (!title || !css || !body) throw new Error("gallery.html から見た目を取り出せませんでした");
const js = readFileSync("dist-gallery/app.js", "utf8").replaceAll("</script", "<\\/script");
const assets = Object.fromEntries(readdirSync("public/assets/models/food").map((f) => [`models/food/${f}`, readFileSync(`public/assets/models/food/${f}`).toString("base64")]));

const page = `<title>${title}</title>
<style>${css}</style>
${body.trim()}
<script>
window.__HK_ASSETS__ = ${JSON.stringify(assets)};
</script>
<script>
${js}
</script>
`;
writeFileSync("dist-gallery/page.html", page);
console.log(`dist-gallery/page.html ${(page.length / 1024).toFixed(0)} KB`);
