// dist-artifact/app.js と index.html の見た目から、Artifact に公開する1枚のページを作る。
// Artifact は <html> や <head> を自分で書かないので、<title>・<style>・本体・<script> だけを並べる。
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const body = html.match(/<body>([\s\S]*?)<script type="module"/)?.[1];
if (!css || !body) throw new Error("index.html から見た目を取り出せませんでした");
const js = readFileSync("dist-artifact/app.js", "utf8").replaceAll("</script", "<\\/script");

const page = `<title>ホール&amp;キッチン</title>
<style>
:root { color-scheme: dark; }
${css}
</style>
${body.trim()}
<script>
${js}
</script>
`;
writeFileSync("dist-artifact/page.html", page);
console.log(`dist-artifact/page.html ${(page.length / 1024).toFixed(0)} KB`);
