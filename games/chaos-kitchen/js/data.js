// 材料・調理器具・料理・イベントの定義(ブラウザでもNodeでも読める)
(function () {
  // 調理器具: S=コンロ F=フライヤー V=オーブン。結果の状態はそれぞれ 煮る/揚げる/焼く
  const COOKERS = {
    S: { name: "コンロ", res: "cooked", emoji: "🍳" },
    F: { name: "フライヤー", res: "fried", emoji: "🍟" },
    V: { name: "オーブン", res: "baked", emoji: "♨️" },
  };
  const STATE_TAG = { chopped: "切", cooked: "煮", fried: "揚", baked: "焼" };
  const STATE_VERB = { chopped: "切った", cooked: "煮た", fried: "揚げた", baked: "焼いた" };
  const STATION_OF = { cooked: "S", fried: "F", baked: "V" };

  // crate=置き場の文字 chop=切れる rawOk=生のままお皿に乗せられる cook[器具]={t:秒, from:入れる時の状態}
  const ING = {
    tomato: { name: "トマト", emoji: "🍅", crate: "T", words: ["トマト"], chop: true, cook: { S: { t: 6, from: "chopped" } } },
    lettuce: { name: "レタス", emoji: "🥬", crate: "L", words: ["レタス"], chop: true },
    onion: { name: "玉ねぎ", emoji: "🧅", crate: "N", words: ["玉ねぎ", "たまねぎ", "玉葱", "オニオン"], chop: true, cook: { S: { t: 7, from: "chopped" } } },
    carrot: { name: "にんじん", emoji: "🥕", crate: "Q", words: ["にんじん", "人参", "ニンジン"], chop: true, cook: { S: { t: 7, from: "chopped" } } },
    potato: { name: "じゃがいも", emoji: "🥔", crate: "J", words: ["じゃがいも", "ジャガイモ", "ポテト", "いも"], chop: true,
      cook: { S: { t: 8, from: "chopped" }, F: { t: 6, from: "chopped" }, V: { t: 8, from: "chopped" } } },
    meat: { name: "お肉", emoji: "🥩", crate: "M", words: ["お肉", "肉", "ミート"], cook: { S: { t: 8, from: "raw" } } },
    fish: { name: "お魚", emoji: "🐟", crate: "H", words: ["お魚", "魚", "さかな"], cook: { S: { t: 7, from: "raw" }, F: { t: 6, from: "raw" }, V: { t: 7, from: "raw" } } },
    egg: { name: "たまご", emoji: "🥚", crate: "G", words: ["たまご", "卵"], cook: { S: { t: 4, from: "raw" } } },
    rice: { name: "ごはん", emoji: "🍚", crate: "R", words: ["ごはん", "ご飯", "お米", "米"], cook: { S: { t: 9, from: "raw" } } },
    bread: { name: "パン", emoji: "🍞", crate: "W", words: ["パン", "バンズ"], rawOk: true },
    cheese: { name: "チーズ", emoji: "🧀", crate: "I", words: ["チーズ"], chop: true, cook: { V: { t: 5, from: "chopped" } } },
    mushroom: { name: "きのこ", emoji: "🍄", crate: "U", words: ["きのこ", "キノコ"], chop: true, cook: { S: { t: 5, from: "chopped" }, V: { t: 6, from: "chopped" } } },
  };
  const CRATE = {};
  Object.entries(ING).forEach(([k, v]) => { CRATE[v.crate] = k; });

  // need: "材料:状態"(状態: raw / chopped / cooked / fried / baked)
  const R = (name, need) => ({ name, need });
  const RECIPES = [
    R("きざみレタス", ["lettuce:chopped"]),
    R("サラダ", ["lettuce:chopped", "tomato:chopped"]),
    R("トマトスープ", ["tomato:cooked"]),
    R("玉ねぎスープ", ["onion:cooked"]),
    R("にんじんスープ", ["carrot:cooked"]),
    R("野菜スープ", ["onion:cooked", "carrot:cooked"]),
    R("ミックスサラダ", ["lettuce:chopped", "tomato:chopped", "carrot:chopped"]),
    R("ポトフ", ["potato:cooked", "carrot:cooked", "onion:cooked"]),
    R("ステーキ", ["meat:cooked"]),
    R("ステーキプレート", ["meat:cooked", "potato:cooked"]),
    R("肉野菜炒め", ["meat:cooked", "onion:cooked", "carrot:cooked"]),
    R("きのこソテー", ["mushroom:cooked"]),
    R("ごはん", ["rice:cooked"]),
    R("目玉焼き", ["egg:cooked"]),
    R("たまごごはん", ["rice:cooked", "egg:cooked"]),
    R("焼き魚定食", ["fish:cooked", "rice:cooked"]),
    R("肉丼", ["meat:cooked", "rice:cooked", "onion:cooked"]),
    R("ハンバーガー", ["bread:raw", "meat:cooked", "lettuce:chopped"]),
    R("チーズバーガー", ["bread:raw", "meat:cooked", "cheese:chopped"]),
    R("ベジバーガー", ["bread:raw", "lettuce:chopped", "tomato:chopped"]),
    R("フライドポテト", ["potato:fried"]),
    R("フィッシュフライ", ["fish:fried"]),
    R("フィッシュ&チップス", ["fish:fried", "potato:fried"]),
    R("バーガーセット", ["bread:raw", "meat:cooked", "potato:fried"]),
    R("焼きポテト", ["potato:baked"]),
    R("チーズトースト", ["bread:raw", "cheese:baked"]),
    R("ピザトースト", ["bread:raw", "cheese:baked", "tomato:chopped"]),
    R("ポテトグラタン", ["potato:baked", "cheese:baked"]),
    R("きのこグラタン", ["mushroom:baked", "cheese:baked"]),
    R("海鮮グラタン", ["fish:baked", "cheese:baked"]),
    R("フルコース", ["meat:cooked", "potato:fried", "lettuce:chopped"]),
  ];
  const RECIPE_BY_NAME = {};
  RECIPES.forEach(r => { RECIPE_BY_NAME[r.name] = r; });

  const EVENTS = {
    blackout: { icon: "⚡", name: "停電", dur: 12, msg: "停電だ! 手元しか見えない" },
    slippery: { icon: "🧼", name: "床がツルツル", dur: 15, msg: "床が滑る! 急には止まれない" },
    rush: { icon: "🎉", name: "団体客ラッシュ", dur: 20, msg: "団体客が来た! 提供ボーナス2倍" },
    fire: { icon: "🔥", name: "コンロ火事", dur: 0, msg: "調理器具が燃えた! 片付けよう" },
    mouse: { icon: "🐭", name: "ネズミ", dur: 0, msg: "ネズミが食材を盗んだ!" },
  };

  const splitKey = k => k.split(":");
  const needKey = need => [...need].sort().join(",");

  // 料理に必要な設備(まな板の数・調理器具の数・材料の置き場)
  function requirements(menu) {
    const crates = new Set(); let boards = 0; const cooks = { S: 0, F: 0, V: 0 };
    for (const r of menu) {
      let choppedFinal = 0, cookChop = 0; const by = { S: 0, F: 0, V: 0 };
      for (const n of r.need) {
        const [type, state] = splitKey(n); crates.add(type);
        if (state === "chopped") choppedFinal++;
        else if (state !== "raw") {
          const st = STATION_OF[state]; by[st]++;
          if (ING[type].cook[st].from === "chopped") cookChop = 1;
        }
      }
      boards = Math.max(boards, choppedFinal, cookChop);
      for (const k of Object.keys(cooks)) cooks[k] = Math.max(cooks[k], by[k]);
    }
    return { crates: [...crates], boards, cooks };
  }

  // お手本の手順(AIに教えるヒントと、ステージ検証用)
  function canonicalSteps(recipe) {
    const steps = [], finals = [];
    const st = (skill, a) => ({ skill, a });
    const cooks = recipe.need.map(splitKey).filter(([, state]) => state !== "raw" && state !== "chopped")
      .sort((a, b) => ING[b[0]].cook[STATION_OF[b[1]]].t - ING[a[0]].cook[STATION_OF[a[1]]].t);   // 煮る時間が長いものから始める
    for (const [type, state] of cooks) {                   // 先に調理を始める(待ち時間を有効に使う)
      const k = STATION_OF[state], c = ING[type].cook[k];
      if (c.from === "chopped") steps.push(st("get", type), st("board"), st("chop", type), st("grab", type), st("cook", k));
      else steps.push(st("get", type), st("cook", k));
      finals.push(type);
    }
    for (const n of recipe.need) {
      const [type, state] = splitKey(n);
      if (state === "chopped") { steps.push(st("get", type), st("board"), st("chop", type)); finals.push(type); }
      else if (state === "raw") finals.push(type);
    }
    steps.push(st("get", "plate"));
    finals.forEach(t => steps.push(st("plateAdd", t)));
    steps.push(st("deliver"));
    return steps;
  }

  globalThis.CKData = { COOKERS, STATE_TAG, STATE_VERB, STATION_OF, ING, CRATE, RECIPES, RECIPE_BY_NAME, EVENTS, requirements, canonicalSteps, needKey };
})();
