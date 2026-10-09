// スモークテスト: ページを開き、メニューから始めて、AIと数ステージを最後まで自動プレイし、エラーが出ないか確かめる。
// 使い方: node tools/smoke.cjs [--2d]      (要 playwright。WebGLはソフトウェア描画で動かす)
const path = require("path");
const pw = (() => { for (const p of ["playwright", "/opt/node-tools/node_modules/playwright"]) { try { return require(p); } catch {} } throw new Error("playwright が見つかりません"); })();
const force2d = process.argv.includes("--2d");
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && !/Failed to load resource|net::/.test(m.text()) && errs.push(m.text()));
  await p.goto("file://" + path.resolve(__dirname, "../index.html") + (force2d ? "?2d" : ""));
  const fail = [];
  const check = (name, ok, info = "") => { console.log(ok ? "OK  " : "NG  ", name, info); if (!ok) fail.push(name); };
  check("表示モード", (await p.evaluate(() => G3.ok)) === !force2d, force2d ? "2D" : "3D");
  await p.click("#homeStart"); await p.click("#stageGo");                    // メニューから1-1を始める
  check("ステージ開始", await p.evaluate(() => state === "play" && stage.id === 1));
  for (const id of [1, 27, 43, 60, 78, 92]) {
    const r = await p.evaluate(id => {
      CKData.RECIPES.forEach(rc => { recipes[rc.name] = CKData.canonicalSteps(rc).map(s => ({ skill: s.skill, a: s.a })); });
      startStage(id, { humans: 1, ai: 3 }); introT = 0;
      players.filter(q => q.ai).forEach(q => runCmd(q, { cmd: "auto" }));
      let n = 0; while (state === "play" && n < 20000) { update(0.05); if (n % 40 === 0) draw(); n++; }
      return { score, stars: lastResult && lastResult.stars, served };
    }, id);
    check(`ステージ${id}を最後まで`, r.served > 0, JSON.stringify(r));
  }
  // 対戦: 何もしない人間チーム vs AIチーム → AI側が勝つ。壁の向こうへは行かない
  const v = await p.evaluate(() => {
    startStage(VS_STAGES[0], { humans: 1, teamSize: 1 }); introT = 0;
    let n = 0, cross = 0; while (state === "play" && n < 20000) { update(0.05); n++; if (n % 5 === 0) for (const q of players) if (q.team === 0 ? q.x > W / 2 : q.x < W / 2) cross++; if (n % 60 === 0) draw(); }
    return { a: lastResult.a, b: lastResult.b, winner: lastResult.winner, cross };
  });
  check("対戦(AIチームが勝つ・壁を越えない)", v.winner === 1 && v.cross === 0, JSON.stringify(v));
  // エンドレス: AI3人で、注文を逃し続けると終わる
  const e = await p.evaluate(() => {
    CKData.RECIPES.forEach(rc => { recipes[rc.name] = CKData.canonicalSteps(rc).map(s => ({ skill: s.skill, a: s.a })); });
    startStage(ENDLESS[4], { humans: 1, ai: 3 }); introT = 0; players.filter(q => q.ai).forEach(q => runCmd(q, { cmd: "auto" }));
    let n = 0; while (state === "play" && n < 80000) { update(0.05); n++; if (n % 60 === 0) draw(); }
    return { state, time: lastResult && lastResult.time, score: lastResult && lastResult.score };
  });
  check("エンドレス(最後は終わる)", e.state === "result" && e.time > 10, JSON.stringify(e));
  check("結果画面", await p.evaluate(() => $("scr-result").style.display !== "none"));
  check("ブラウザのエラーなし", errs.length === 0, errs.slice(0, 3).join(" | "));
  await b.close();
  process.exit(fail.length ? 1 : 0);
})();
