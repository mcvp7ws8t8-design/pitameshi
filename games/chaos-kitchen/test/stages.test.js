// 実行: node --test games/chaos-kitchen/test/stages.test.js
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

function load() {
  for (const f of ["data.js", "calibration.js", "stages.js"]) delete require.cache[require.resolve(path.join("../js", f))];
  delete globalThis.CKData; delete globalThis.CKStages; delete globalThis.CKCal;
  require("../js/data.js"); require("../js/calibration.js"); require("../js/stages.js");
  return { D: globalThis.CKData, S: globalThis.CKStages };
}
const { D, S } = load();

test("ステージは100個で、10ワールド×10", () => {
  assert.equal(S.STAGES.length, 100);
  S.STAGES.forEach((st, i) => { assert.equal(st.id, i + 1); assert.equal(st.world, Math.floor(i / 10) + 1); assert.equal(st.k, (i % 10) + 1); });
});

test("全ステージが構造検査を通る(つながり・設備の数・出現位置)", () => {
  for (const st of S.STAGES) assert.deepEqual(S.validate(st), [], `ステージ${st.id} ${st.name}`);
});

test("ステージ名はすべて違う", () => {
  const names = S.STAGES.map(s => s.name);
  assert.equal(new Set(names).size, names.length);
});

test("同じ種から同じステージが作られる(毎回同じ)", () => {
  const a = JSON.stringify(S.STAGES.map(s => s.map));
  const { S: S2 } = load();
  assert.equal(JSON.stringify(S2.STAGES.map(s => s.map)), a);
});

test("メニューの料理は実在し、必要な材料の置き場がある", () => {
  for (const st of S.STAGES) {
    assert.ok(st.menu.length >= 1);
    for (const n of st.menu) {
      const r = D.RECIPE_BY_NAME[n]; assert.ok(r, `${st.id}: ${n}`);
      for (const k of r.need) assert.ok(st.map.join("").includes(D.ING[k.split(":")[0]].crate), `${st.id}: ${n} の ${k}`);
    }
  }
});

test("分業ステージはワールド9だけで、2人以上が必要", () => {
  for (const st of S.STAGES) {
    assert.equal(!!st.split, st.world === 9);
    assert.equal(st.minPlayers, st.world === 9 ? 2 : 1);
  }
});

test("制限時間と出題の速さが妥当な範囲", () => {
  for (const st of S.STAGES) {
    assert.ok(st.time >= 45 && st.time <= 300, `${st.id}: ${st.time}`);
    assert.ok(st.spawn >= 8 && st.spawn <= 60, `${st.id}: ${st.spawn}`);
  }
});

test("世界が進むほど新しい要素が登場する", () => {
  const has = (w, pred) => S.STAGES.filter(s => s.world === w).some(pred);
  assert.ok(has(3, s => s.mode === "restaurant"));                 // 接客
  assert.ok(has(6, s => s.belt));                                    // ベルトコンベア
  assert.ok(has(7, s => s.menu.some(n => /フライ|ポテト/.test(n))) );
  assert.ok(has(8, s => s.ice) && has(8, s => s.stock));            // 氷・在庫
  assert.ok(has(10, s => s.events.length === 5));                    // イベント全部
});

test("全レシピのお手本手順が作れて、提供で終わる", () => {
  for (const r of D.RECIPES) {
    assert.ok(r.need.length >= 1 && r.need.length <= 3, r.name);
    const types = r.need.map(n => n.split(":")[0]); assert.equal(new Set(types).size, types.length, r.name + " 材料の重複");
    const steps = D.canonicalSteps(r);
    assert.equal(steps[steps.length - 1].skill, "deliver");
    for (const n of r.need) {
      const [type, state] = n.split(":");
      if (state === "raw") assert.ok(D.ING[type].rawOk, `${r.name}: ${type} は生では乗せられない`);
      else if (state === "chopped") assert.ok(D.ING[type].chop, `${r.name}: ${type} は切れない`);
      else assert.ok(D.ING[type].cook[D.STATION_OF[state]], `${r.name}: ${type} を ${state} にできない`);
    }
  }
});

test("対戦・エンドレスのアリーナが構造検査を通る", () => {
  assert.ok(S.ENDLESS.length >= 5 && S.VS_STAGES.length >= 5);
  for (const st of [...S.ENDLESS, ...S.VS_STAGES]) assert.deepEqual(S.validate(st), [], `${st.id} ${st.name}`);
});

test("対戦は左右が鏡写しで、2つの部屋が壁で完全に分かれている", () => {
  const flip = row => [...row].reverse().map(c => (c === "→" ? "←" : c === "←" ? "→" : c)).join("");
  for (const st of S.VS_STAGES) {
    const w = st.map[0].length / 2;
    st.map.forEach(row => assert.equal(row.slice(w), flip(row.slice(0, w)), `${st.name}`));
    assert.equal(S.floodRegions(st.map.map(r => [...r])).n, 2);
    assert.equal(st.spawns.length, 4);
    assert.ok(st.spawns[0][0] < w && st.spawns[1][0] < w && st.spawns[2][0] > w && st.spawns[3][0] > w);   // 出現位置も左右に2つずつ
  }
});

test("エンドレスの料理は、後ろへいくほど難しい(材料が増える)", () => {
  for (const st of S.ENDLESS) {
    const sizes = st.menu.map(n => D.RECIPE_BY_NAME[n].need.length);
    assert.ok(Math.max(...sizes.slice(-2)) >= Math.max(...sizes.slice(0, 2)), st.name);
  }
});
