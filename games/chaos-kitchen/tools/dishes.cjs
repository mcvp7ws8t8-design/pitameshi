// 各ステージの各料理が「その地形で作れる」ことを確かめる。AI1人に、その料理だけを時間をかけて作らせる(分業ステージは対象外)。
// 使い方: node tools/dishes.cjs [開始ID] [終了ID]
const path = require("path");
const pw = (() => { for (const p of ["playwright", "/opt/node-tools/node_modules/playwright"]) { try { return require(p); } catch {} } throw new Error("playwright が見つかりません"); })();
const from = +process.argv[2] || 1, to = +process.argv[3] || 100;
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
  const p = await b.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + path.resolve(__dirname, "../index.html") + "?2d");
  let bad = 0, total = 0, tricky = 0;
  for (let id = from; id <= to; id++) {
    const r = await p.evaluate(id => {
      if (STAGES[id - 1].split) return null;
      CKData.RECIPES.forEach(rc => { recipes[rc.name] = CKData.canonicalSteps(rc).map(s => ({ skill: s.skill, a: s.a })); });
      const out = [];
      for (const dish of STAGES[id - 1].menu) {
        startStage(id, { humans: 1, ai: 1 }); introT = 0;
        stage.menu = [dish]; stage.events = []; stage.patience = 9999; evNext = 1e9; spawnEvery = 6; timeLeft = 420;
        players.filter(q => q.ai).forEach(q => runCmd(q, { cmd: "auto" }));
        let n = 0; while (state === "play" && n < 20000 && served < 1) { update(0.05); n++; }
        let kind = served ? "ok" : "ng";
        if (!served) {                                         // 手際が悪くて焦げただけか、構造的に無理かを切り分ける(焦げるまでの猶予を長くして再挑戦)
          startStage(id, { humans: 1, ai: 1 }); introT = 0;
          stage.menu = [dish]; stage.events = []; stage.patience = 9999; stage.burn = 0.05; evNext = 1e9; spawnEvery = 6; timeLeft = 600;
          players.filter(q => q.ai).forEach(q => runCmd(q, { cmd: "auto" }));
          n = 0; while (state === "play" && n < 30000 && served < 1) { update(0.05); n++; }
          kind = served ? "tricky" : "impossible";
        }
        out.push([dish, kind, Math.round(n * 0.05)]);
      }
      return out;
    }, id);
    if (!r) continue;
    for (const [dish, kind] of r) { total++; if (kind === "tricky") { tricky++; console.log(`注意 ステージ${id} ${dish}: AI1人では焦げる(猶予を延ばせば作れる=構造は問題なし。手際が要る)`); } if (kind === "impossible") { bad++; console.log(`NG  ステージ${id} ${dish}: 焦げの猶予を延ばしても作れない(構造の問題)`); } }
  }
  console.log(`検査した料理: ${total}、手際が要る: ${tricky}、構造的に作れない: ${bad}`, errs.length ? errs.slice(0, 3) : "");
  await b.close();
  process.exit(bad ? 1 : 0);
})();
