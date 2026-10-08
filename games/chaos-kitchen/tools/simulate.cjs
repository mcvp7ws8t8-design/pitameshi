// 全ステージをAI(お手本の手順を覚えた状態)で自動プレイして、遊べるか確かめる。
// 使い方: node tools/simulate.cjs [開始ID] [終了ID]   (要 playwright。ブラウザは PLAYWRIGHT_BROWSERS_PATH のものを使う)
const path = require("path");
const pw = (() => { for (const p of ["playwright", "/opt/node-tools/node_modules/playwright"]) { try { return require(p); } catch {} } throw new Error("playwright が見つかりません"); })();
const from = +process.argv[2] || 1, to = +process.argv[3] || 100, nAi = +process.argv[4] || 3;
(async () => {
  const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium";
  const b = await pw.chromium.launch({ executablePath: exe });
  const p = await b.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + path.resolve(__dirname, "../index.html") + "?unlock=all");
  const rows = [];
  for (let id = from; id <= to; id++) {
    const r = await p.evaluate(([id, nAi]) => {
      CKData.RECIPES.forEach(rc => { recipes[rc.name] = CKData.canonicalSteps(rc).map(s => ({ skill: s.skill, a: s.a })); });
      startStage(id, 2 + nAi);
      let fails = 0, delivered = 0, msgs = {};
      const origFail = failStep; failStep = function (b, m) { fails++; msgs[m] = (msgs[m] || 0) + 1; return origFail(b, m); };
      const bots = players.filter(q => q.ai);
      bots.forEach(q => runCmd(q, { cmd: "auto" }));
      const sc0 = []; let steps = 0;
      while (state === "play" && steps < 20000) { update(0.05); steps++; }
      failStep = origFail;
      const s = STAGES[id - 1];
      return { id, name: s.name, mode: s.mode, split: s.split, time: s.time, score, goals: goals.slice(), stars: lastResult ? lastResult.stars : 0, fails, msgs, plates };
    }, [id, nAi]);
    rows.push(r);
    const top = Object.entries(r.msgs).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([m, n]) => `${m}×${n}`).join(" ");
    console.log(`${String(r.id).padStart(3)} ${r.mode[0]}${r.split ? "S" : " "} t=${String(r.time).padStart(3)} score=${String(r.score).padStart(4)} goals=${r.goals.join("/")} ★${r.stars} fails=${r.fails} ${top}`);
  }
  console.log("errors:", errs.slice(0, 5));
  await b.close();
})();
