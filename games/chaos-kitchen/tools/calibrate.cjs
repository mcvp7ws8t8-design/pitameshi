// 各ステージで、AI3人に「お客が絶え間なく来る」状況で何皿さばけるか測り、js/calibration.js に書き出す。
// 使い方: node tools/calibrate.cjs      (要 playwright)
const fs = require("fs"), path = require("path");
const pw = (() => { for (const p of ["playwright", "/opt/node-tools/node_modules/playwright"]) { try { return require(p); } catch {} } throw new Error("playwright が見つかりません"); })();
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
  const p = await b.newPage();
  // 前回の測定結果の影響を受けないよう、calibration.js なしで読み込む
  await p.route("**/calibration.js", r => r.fulfill({ body: "", contentType: "text/javascript" }));
  await p.goto("file://" + path.resolve(__dirname, "../index.html") + "?unlock=all");
  const cal = {}, SECS = 150;
  const n = await p.evaluate(() => STAGES.length);
  for (let id = 1; id <= n; id++) {
    const r = await p.evaluate(([id, SECS, TRIALS]) => {
      if (STAGES[id - 1].split) return null;
      CKData.RECIPES.forEach(rc => { recipes[rc.name] = CKData.canonicalSteps(rc).map(s => ({ skill: s.skill, a: s.a })); });
      const real = Math.random; let sum = 0;
      for (let t = 0; t < TRIALS; t++) {                       // 乱数の種を変えて何度か測り、平均する
        let a = (id * 7919 + t * 104729) >>> 0;
        Math.random = () => { a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
        startStage(id, 5);
        spawnEvery = 3; timeLeft = SECS; stage.patience = 9999; stage.events = []; evNext = 1e9;
        players.filter(q => q.ai).forEach(q => runCmd(q, { cmd: "auto" }));
        let steps = 0; while (state === "play" && steps < 30000) { update(0.05); steps++; }
        sum += served / SECS;
      }
      Math.random = real;
      return sum / TRIALS;
    }, [id, SECS, 4]);
    if (r !== null) cal[id] = Math.round(r * 10000) / 10000;
    console.log(id, r === null ? "(分業: 測定しない)" : `${(r * 60).toFixed(1)} 皿/分`);
  }
  fs.writeFileSync(path.resolve(__dirname, "../js/calibration.js"), "// tools/calibrate.cjs が作る。AI3人の処理能力(皿/秒)。\nglobalThis.CKCal = " + JSON.stringify(cal) + ";\n");
  await b.close();
})();
