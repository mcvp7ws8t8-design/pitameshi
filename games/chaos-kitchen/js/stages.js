// 100ステージの定義と生成(決まった種から作るので、毎回同じステージになる)
(function () {
  const D = globalThis.CKData;
  const WALK = new Set([".", "~", "→", "←", "↑", "↓"]);

  // ---- 乱数(同じ種なら同じ結果) ----
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  // ---- 世界とステージの台本 ----
  // k番目のステージごとに { t:タイトル, m:料理, s:形, ...上書き } を並べる
  const FLAVORS = [   // 1〜10番目の性格
    { id: "intro", tm: 1.0, sm: 1.25, label: "" },
    { id: "normal", tm: 1.0, sm: 1.0, label: "" },
    { id: "normal", tm: 1.0, sm: 1.0, label: "" },
    { id: "sprint", tm: 0.65, sm: 0.7, label: "⚡ダッシュ" },
    { id: "normal", tm: 1.0, sm: 1.0, label: "" },
    { id: "normal", tm: 1.0, sm: 0.95, label: "" },
    { id: "marathon", tm: 1.6, sm: 1.0, label: "⏳長丁場" },
    { id: "rush", tm: 0.85, sm: 0.8, label: "🎉ラッシュ" },
    { id: "gauntlet", tm: 1.1, sm: 0.9, label: "🔥激戦" },
    { id: "boss", tm: 1.4, sm: 0.85, label: "👑ボス" },
  ];
  const N = n => n;           // 読みやすさのための印
  const WORLDS = [
    { name: "はじめてのキッチン", emoji: "🍅", mode: "kitchen", time: 60, spawn: 26, events: [], evFrom: 8, evList: ["mouse"],
      tips: { 1: "レタスを取って、まな板で長押しして切り、お皿に盛って「提供」の窓口へ!", 4: "コンロ登場! 切ったトマトを入れて煮るとスープになるよ。煮すぎると焦げる!" },
      st: [
        { t: "はじめの一歩", m: ["きざみレタス"], s: "box", w: 9, h: 7 },
        { t: "サラダデビュー", m: ["きざみレタス", "サラダ"], s: "box", w: 10, h: 7 },
        { t: "おいしいサラダ", m: ["サラダ"], s: "box", w: 11, h: 7 },
        { t: "スープをコトコト", m: ["トマトスープ", "きざみレタス"], s: "box", w: 10, h: 7 },
        { t: "両方おまかせ", m: ["サラダ", "トマトスープ"], s: "L", w: 11, h: 8 },
        { t: "ほそながキッチン", m: ["サラダ", "トマトスープ", "きざみレタス"], s: "corridor", w: 13, h: 5 },
        { t: "島のあるキッチン", m: ["サラダ", "トマトスープ", "きざみレタス"], s: "islands", w: 12, h: 8 },
        { t: "ダッシュ!ランチタイム", m: ["サラダ", "トマトスープ", "きざみレタス"], s: "U", w: 11, h: 8 },
        { t: "ぐるぐるキッチン", m: ["サラダ", "トマトスープ", "きざみレタス"], s: "ring", w: 11, h: 8 },
        { t: "オープン記念ボス", m: ["サラダ", "トマトスープ", "きざみレタス"], s: "cross", w: 12, h: 9 },
      ] },
    { name: "スープの季節", emoji: "🥕", mode: "kitchen", time: 70, spawn: 24, events: ["fire", "mouse"], evFrom: 3,
      tips: { 1: "玉ねぎ・にんじんが登場。切ってからコンロへ。コンロを何台か使い分けよう。", 7: "ポトフは3種類を同時に煮る料理。コンロが3台あるよ!" },
      st: [
        { t: "玉ねぎスープ", m: ["玉ねぎスープ", "トマトスープ"], s: "box", w: 10, h: 7 },
        { t: "やさいスープ", m: ["玉ねぎスープ", "野菜スープ"], s: "box", w: 11, h: 7 },
        { t: "にんじんの季節", m: ["にんじんスープ", "野菜スープ", "トマトスープ"], s: "L", w: 11, h: 8 },
        { t: "スープバー", m: ["玉ねぎスープ", "にんじんスープ", "トマトスープ"], s: "corridor", w: 14, h: 5 },
        { t: "ゆげゆげ厨房", m: ["野菜スープ", "ミックスサラダ"], s: "islands", w: 12, h: 8 },
        { t: "ポトフの香り", m: ["ポトフ", "野菜スープ"], s: "pillars", w: 12, h: 8 },
        { t: "大なべ祭り", m: ["ポトフ", "野菜スープ", "玉ねぎスープ", "にんじんスープ"], s: "ring", w: 12, h: 9 },
        { t: "スープ競争", m: ["野菜スープ", "トマトスープ", "にんじんスープ"], s: "steps", w: 11, h: 8 },
        { t: "あつあつ戦争", m: ["ポトフ", "ミックスサラダ", "野菜スープ"], s: "U", w: 12, h: 8 },
        { t: "スープ大会ボス", m: ["ポトフ", "ミックスサラダ", "野菜スープ", "トマトスープ", "にんじんスープ"], s: "cross", w: 13, h: 9 },
      ] },
    { name: "ホールデビュー", emoji: "🛎", mode: "restaurant", time: 80, spawn: 22, events: ["rush", "mouse"], evFrom: 4,
      tips: { 1: "お客さんが来る! 注文を取り→料理を作って受け渡し台へ→席に運び→お会計→皿を下げて洗う。お皿は数に限りがあるよ。" },
      st: [
        { t: "ホールデビュー", m: ["サラダ"], s: "box", w: 7, h: 7, tables: 2 },
        { t: "いらっしゃいませ", m: ["サラダ", "きざみレタス"], s: "box", w: 7, h: 7, tables: 3 },
        { t: "テーブル係", m: ["サラダ", "トマトスープ"], s: "box", w: 8, h: 7, tables: 4 },
        { t: "お皿が足りない?", m: ["サラダ", "トマトスープ"], s: "L", w: 8, h: 8, tables: 4, plates: 4 },
        { t: "満席です!", m: ["サラダ", "トマトスープ", "きざみレタス"], s: "box", w: 8, h: 8, tables: 6 },
        { t: "ランチ満員", m: ["野菜スープ", "サラダ"], s: "islands", w: 9, h: 8, tables: 6 },
        { t: "ディナータイム", m: ["野菜スープ", "ミックスサラダ", "トマトスープ"], s: "pillars", w: 9, h: 8, tables: 6, plates: 4 },
        { t: "カフェテラス", m: ["ミックスサラダ", "玉ねぎスープ", "サラダ"], s: "U", w: 9, h: 8, tables: 6 },
        { t: "行列のできる店", m: ["ポトフ", "ミックスサラダ", "野菜スープ"], s: "ring", w: 10, h: 9, tables: 6, plates: 5 },
        { t: "ホール長ボス", m: ["ポトフ", "ミックスサラダ", "野菜スープ", "トマトスープ"], s: "cross", w: 10, h: 9, tables: 8 },
      ] },
    { name: "お肉の日", emoji: "🥩", mode: "restaurant", time: 85, spawn: 21, events: ["fire", "rush", "mouse"], evFrom: 3,
      tips: { 1: "お肉登場! 生の肉をそのままコンロへ。焦がさないように!" },
      st: [
        { t: "お肉の日", m: ["ステーキ"], s: "box", w: 8, h: 7, tables: 3 },
        { t: "じゅーじゅー", m: ["ステーキ", "トマトスープ"], s: "box", w: 8, h: 8, tables: 4 },
        { t: "ステーキハウス", m: ["ステーキ", "ステーキプレート"], s: "L", w: 9, h: 8, tables: 4 },
        { t: "肉と野菜", m: ["ステーキプレート", "サラダ", "ステーキ"], s: "islands", w: 9, h: 8, tables: 5 },
        { t: "きのこソテー", m: ["きのこソテー", "ステーキ", "サラダ"], s: "corridor", w: 10, h: 6, tables: 4 },
        { t: "焼き肉パーティ", m: ["肉野菜炒め", "ステーキ", "きのこソテー"], s: "pillars", w: 9, h: 8, tables: 6 },
        { t: "鉄板ダッシュ", m: ["ステーキ", "ステーキプレート", "肉野菜炒め"], s: "ring", w: 10, h: 9, tables: 6 },
        { t: "スタミナ定食", m: ["肉野菜炒め", "ステーキプレート", "野菜スープ"], s: "steps", w: 9, h: 8, tables: 6, plates: 4 },
        { t: "肉の祭典", m: ["肉野菜炒め", "ステーキプレート", "きのこソテー", "ミックスサラダ"], s: "U", w: 10, h: 8, tables: 6 },
        { t: "ステーキ王ボス", m: ["肉野菜炒め", "ステーキプレート", "きのこソテー", "ステーキ", "ポトフ"], s: "cross", w: 11, h: 9, tables: 8 },
      ] },
    { name: "ごはん屋さん", emoji: "🍚", mode: "kitchen", altMode: "restaurant", time: 90, spawn: 20, events: ["slippery", "rush", "mouse"], evFrom: 3,
      tips: { 1: "お米は炊くのに時間がかかる。先にコンロに入れておこう。" },
      st: [
        { t: "ごはんの時間", m: ["ごはん", "目玉焼き"], s: "box", w: 10, h: 7 },
        { t: "たまごごはん", m: ["たまごごはん", "ごはん"], s: "box", w: 10, h: 7, mode: "restaurant", w2: 8, tables: 3 },
        { t: "焼き魚の朝", m: ["焼き魚定食", "目玉焼き"], s: "L", w: 11, h: 8 },
        { t: "定食屋", m: ["焼き魚定食", "たまごごはん", "ごはん"], s: "islands", w: 9, h: 8, mode: "restaurant", tables: 4 },
        { t: "おにぎり山", m: ["ごはん", "たまごごはん", "目玉焼き"], s: "corridor", w: 14, h: 5 },
        { t: "海の幸", m: ["焼き魚定食", "肉丼", "ごはん"], s: "pillars", w: 9, h: 8, mode: "restaurant", tables: 5 },
        { t: "おかわり自由", m: ["たまごごはん", "焼き魚定食", "肉丼"], s: "ring", w: 12, h: 9 },
        { t: "夜の食堂", m: ["肉丼", "焼き魚定食", "たまごごはん"], s: "steps", w: 9, h: 8, mode: "restaurant", tables: 6 },
        { t: "和食の宴", m: ["肉丼", "焼き魚定食", "たまごごはん", "野菜スープ"], s: "U", w: 12, h: 8 },
        { t: "和食王ボス", m: ["肉丼", "焼き魚定食", "たまごごはん", "ステーキ", "ごはん"], s: "cross", w: 11, h: 9, mode: "restaurant", tables: 8 },
      ] },
    { name: "バーガーショップ", emoji: "🍔", mode: "restaurant", time: 95, spawn: 19, events: ["rush", "slippery", "mouse"], evFrom: 3, belt: 3,
      tips: { 1: "パンは切らずにそのままお皿へ! 材料3つの料理は手順が多いよ。", 2: "ベルトコンベアの床! 乗ると流されるよ。" },
      st: [
        { t: "バーガーオープン", m: ["ベジバーガー", "サラダ"], s: "box", w: 8, h: 8, tables: 3 },
        { t: "ベルトコンベア", m: ["ハンバーガー", "ベジバーガー"], s: "box", w: 9, h: 8, tables: 4, belt: 1 },
        { t: "ドライブスルー", m: ["ハンバーガー", "ベジバーガー", "サラダ"], s: "corridor", w: 10, h: 6, tables: 4, belt: 1 },
        { t: "チーズ祭", m: ["チーズバーガー", "ハンバーガー"], s: "L", w: 9, h: 8, tables: 5 },
        { t: "ダブルバーガー", m: ["チーズバーガー", "ハンバーガー", "ベジバーガー"], s: "islands", w: 9, h: 8, tables: 5, belt: 1 },
        { t: "ベジバーガー", m: ["ベジバーガー", "ミックスサラダ", "ハンバーガー"], s: "pillars", w: 10, h: 8, tables: 6, belt: 2 },
        { t: "ランチラッシュ", m: ["チーズバーガー", "ハンバーガー", "ベジバーガー", "トマトスープ"], s: "ring", w: 10, h: 9, tables: 6, belt: 2 },
        { t: "ファストフード", m: ["チーズバーガー", "ハンバーガー", "ステーキ"], s: "steps", w: 10, h: 8, tables: 6, belt: 2 },
        { t: "ジャンボセット", m: ["チーズバーガー", "ハンバーガー", "ベジバーガー", "ステーキプレート"], s: "U", w: 10, h: 8, tables: 6, belt: 2 },
        { t: "バーガー王ボス", m: ["チーズバーガー", "ハンバーガー", "ベジバーガー", "ステーキプレート", "ミックスサラダ"], s: "cross", w: 11, h: 9, tables: 8, belt: 3 },
      ] },
    { name: "揚げ物パーティ", emoji: "🍟", mode: "kitchen", altMode: "restaurant", time: 100, spawn: 18, events: ["fire", "rush", "blackout"], evFrom: 3, burn: 1.5,
      tips: { 1: "フライヤー登場! ポテトは切ってから揚げる。油は焦げやすいよ。" },
      st: [
        { t: "フライヤー点火", m: ["フライドポテト", "フィッシュフライ"], s: "box", w: 10, h: 7 },
        { t: "ポテトの海", m: ["フライドポテト", "フィッシュフライ", "サラダ"], s: "box", w: 10, h: 8, mode: "restaurant", tables: 4 },
        { t: "フィッシュ&チップス", m: ["フィッシュ&チップス", "フライドポテト"], s: "L", w: 11, h: 8 },
        { t: "あげものパーティ", m: ["フィッシュ&チップス", "フィッシュフライ", "フライドポテト"], s: "islands", w: 10, h: 8, mode: "restaurant", tables: 5 },
        { t: "油はね注意", m: ["バーガーセット", "フライドポテト", "ハンバーガー"], s: "corridor", w: 14, h: 5 },
        { t: "あつあつ揚げ", m: ["フィッシュ&チップス", "バーガーセット", "フライドポテト"], s: "pillars", w: 10, h: 8, mode: "restaurant", tables: 6 },
        { t: "揚げ物天国", m: ["フィッシュ&チップス", "バーガーセット", "フィッシュフライ", "トマトスープ"], s: "ring", w: 12, h: 9 },
        { t: "停電のフライ", m: ["フィッシュ&チップス", "フライドポテト", "ステーキ"], s: "steps", w: 10, h: 8, mode: "restaurant", tables: 6 },
        { t: "フライ戦争", m: ["フィッシュ&チップス", "バーガーセット", "ステーキプレート", "フライドポテト"], s: "U", w: 12, h: 8 },
        { t: "フライ王ボス", m: ["フィッシュ&チップス", "バーガーセット", "フルコース", "フィッシュフライ", "ステーキ"], s: "cross", w: 11, h: 9, mode: "restaurant", tables: 8 },
      ] },
    { name: "こおりの国", emoji: "🧊", mode: "restaurant", altMode: "kitchen", time: 105, spawn: 17, events: ["blackout", "slippery", "mouse", "rush"], evFrom: 3, ice: 1,
      tips: { 1: "床がツルツル! 急には止まれないよ。", 3: "オーブン登場! チーズを焼いてグラタンやトーストに。", 5: "材料の在庫が少ない! 使うと数が減って、少しずつ補充されるよ。" },
      st: [
        { t: "つるつるキッチン", m: ["サラダ", "トマトスープ"], s: "box", w: 8, h: 8, tables: 3 },
        { t: "こおりの国", m: ["ミックスサラダ", "玉ねぎスープ", "サラダ"], s: "box", w: 9, h: 8, tables: 4 },
        { t: "オーブン登場", m: ["焼きポテト", "チーズトースト"], s: "L", w: 9, h: 8, tables: 4 },
        { t: "グラタン日和", m: ["ポテトグラタン", "チーズトースト", "焼きポテト"], s: "islands", w: 9, h: 8, tables: 5 },
        { t: "在庫が足りない", m: ["ピザトースト", "チーズトースト", "サラダ"], s: "pillars", w: 10, h: 8, tables: 5, stock: 4, mode: "kitchen", w2: 12 },
        { t: "氷上のカフェ", m: ["きのこグラタン", "ポテトグラタン", "ピザトースト"], s: "ring", w: 10, h: 9, tables: 6, stock: 5 },
        { t: "ふぶき", m: ["ポテトグラタン", "ピザトースト", "チーズトースト", "ステーキ"], s: "steps", w: 12, h: 8, stock: 4, mode: "kitchen" },
        { t: "凍る厨房", m: ["海鮮グラタン", "きのこグラタン", "ピザトースト"], s: "U", w: 10, h: 8, tables: 6, stock: 5 },
        { t: "オーロラレストラン", m: ["海鮮グラタン", "ポテトグラタン", "ピザトースト", "ステーキプレート"], s: "corridor", w: 14, h: 6, stock: 4, mode: "kitchen" },
        { t: "氷の女王ボス", m: ["海鮮グラタン", "ポテトグラタン", "きのこグラタン", "ピザトースト", "ステーキプレート"], s: "cross", w: 11, h: 9, tables: 8, stock: 5 },
      ] },
    { name: "ぶんぎょうキッチン", emoji: "🤝", mode: "kitchen", time: 110, spawn: 20, events: ["fire", "mouse"], evFrom: 4, minPlayers: 2,
      tips: { 1: "厨房が壁で分かれてる! 材料や料理は「受け渡し台」に置いて向こうの部屋に渡そう。2人以上で遊ぶよ(AIが入る)。" },
      st: [
        { t: "ふたりで厨房", m: ["サラダ", "トマトスープ"], split: 2, w: 12, h: 7 },
        { t: "壁の向こう", m: ["サラダ", "トマトスープ", "きざみレタス"], split: 2, w: 12, h: 7 },
        { t: "受け渡しの達人", m: ["野菜スープ", "サラダ"], split: 2, w: 13, h: 7 },
        { t: "分業ダッシュ", m: ["トマトスープ", "サラダ", "玉ねぎスープ"], split: 2, w: 12, h: 7 },
        { t: "連携プレー", m: ["ステーキ", "ステーキプレート", "サラダ"], split: 2, w: 13, h: 8 },
        { t: "三部屋キッチン", m: ["サラダ", "トマトスープ", "野菜スープ"], split: 3, w: 16, h: 7 },
        { t: "リレー厨房", m: ["ステーキプレート", "サラダ", "ごはん"], split: 3, w: 16, h: 7 },
        { t: "息ぴったり", m: ["たまごごはん", "ステーキ", "野菜スープ"], split: 3, w: 16, h: 8 },
        { t: "ミラクル連携", m: ["焼き魚定食", "ハンバーガー", "ステーキプレート"], split: 3, w: 16, h: 8 },
        { t: "連携王ボス", m: ["肉野菜炒め", "焼き魚定食", "ハンバーガー", "ミックスサラダ"], split: 3, w: 16, h: 8 },
      ] },
    { name: "グランシェフ", emoji: "👨‍🍳", mode: "restaurant", altMode: "kitchen", time: 120, spawn: 16, events: ["fire", "rush", "blackout", "slippery", "mouse"], evFrom: 2, burn: 1.3,
      tips: { 1: "最終ワールド! これまでの全部が登場するよ。" },
      st: [
        { t: "グランシェフ入門", m: ["ステーキプレート", "ミックスサラダ", "ポテトグラタン"], s: "box", w: 10, h: 9, tables: 6 },
        { t: "世界の味", m: ["チーズバーガー", "フィッシュ&チップス", "たまごごはん"], s: "L", w: 14, h: 8, mode: "kitchen" },
        { t: "全部のせ", m: ["バーガーセット", "海鮮グラタン", "肉野菜炒め", "ミックスサラダ"], s: "islands", w: 10, h: 9, tables: 6, belt: 1 },
        { t: "嵐のレストラン", m: ["ポトフ", "ステーキプレート", "フィッシュ&チップス", "ピザトースト"], s: "pillars", w: 10, h: 9, tables: 6, ice: 1 },
        { t: "フルコース", m: ["フルコース", "ステーキプレート", "ポテトグラタン"], s: "ring", w: 14, h: 9, mode: "kitchen", stock: 6 },
        { t: "食の都", m: ["フルコース", "海鮮グラタン", "バーガーセット", "肉丼"], s: "steps", w: 10, h: 9, tables: 7, belt: 2 },
        { t: "極限ラッシュ", m: ["フルコース", "チーズバーガー", "フィッシュ&チップス", "きのこグラタン", "野菜スープ"], s: "U", w: 14, h: 9, mode: "kitchen", ice: 1 },
        { t: "ミシュラン", m: ["フルコース", "海鮮グラタン", "肉丼", "ピザトースト", "ポトフ"], s: "cross", w: 11, h: 9, tables: 8, stock: 6 },
        { t: "伝説の厨房", m: ["フルコース", "海鮮グラタン", "バーガーセット", "ポトフ", "肉野菜炒め"], s: "islands", w: 15, h: 9, mode: "kitchen", belt: 2, ice: 1 },
        { t: "ぴためし大賞ボス", m: ["フルコース", "海鮮グラタン", "バーガーセット", "ポトフ", "肉野菜炒め", "フィッシュ&チップス"], s: "ring", w: 11, h: 10, tables: 8, belt: 2, ice: 1, stock: 6 },
      ] },
  ];

  // ---- 地形づくり ----
  const blank = (w, h) => Array.from({ length: h }, () => Array(w).fill("#"));
  const carve = (g, x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && g[y][x] !== undefined) g[y][x] = "."; };
  const fill = (g, x0, y0, x1, y1, ch = "#") => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y] && g[y][x] !== undefined) g[y][x] = ch; };
  const isWalk = ch => WALK.has(ch);

  function shapeGrid(shape, w, h, r) {
    const g = blank(w, h); carve(g, 1, 1, w - 2, h - 2);
    switch (shape) {
      case "L": fill(g, Math.ceil(w * 0.55), 1, w - 2, Math.floor(h * 0.5)); break;
      case "U": fill(g, Math.floor(w * 0.32), 1, Math.ceil(w * 0.68) - 1, h - 4); break;
      case "ring": fill(g, 3, 3, w - 4, h - 4); break;
      case "cross": { const cw = Math.max(2, Math.floor((w - 2) / 3)), ch = Math.max(2, Math.floor((h - 2) / 3));
        fill(g, 1, 1, cw, ch); fill(g, w - 1 - cw, 1, w - 2, ch); fill(g, 1, h - 1 - ch, cw, h - 2); fill(g, w - 1 - cw, h - 1 - ch, w - 2, h - 2); break; }
      case "steps": { const sh = Math.max(1, Math.floor((h - 2) / 4));
        for (let i = 0; i < 3; i++) fill(g, w - 2 - i * 2 - 1, 1, w - 2, 1 + (2 - i) * sh - 1 + (i === 2 ? 0 : 0)); break; }
      case "islands": { const n = w >= 12 ? 2 : 1, iw = w >= 12 ? 3 : 2, y = Math.floor(h / 2);
        for (let i = 0; i < n; i++) { const x = Math.floor(((i + 1) * (w - 2)) / (n + 1)) - Math.floor(iw / 2) + 1; fill(g, x, y, x + iw - 1, y + (h >= 9 ? 1 : 0)); } break; }
      case "pillars": { const n = Math.max(2, Math.floor(w * h / 30)); const used = [];
        for (let i = 0; i < n * 8 && used.length < n; i++) { const x = 3 + Math.floor(r() * (w - 6)), y = 3 + Math.floor(r() * (h - 6));
          if (used.some(([a, b]) => Math.abs(a - x) < 3 && Math.abs(b - y) < 3)) continue; used.push([x, y]); g[y][x] = "#"; } break; }
      default: break; // box, corridor
    }
    return g;
  }

  // 台所の壁面に設備を置く(設備は壁扱い。床につながる壁マスだけに置く)
  function slotsOf(g, xmax) {
    const out = [];
    for (let y = 0; y < g.length; y++) for (let x = 0; x <= xmax; x++) {
      if (g[y][x] !== "#") continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] !== undefined && x + dx <= xmax && isWalk(g[y + dy][x + dx]))) out.push([x, y]);
    }
    return out;
  }
  // 設備を置く: 同じ種類は離し、全体はなるべく近くにまとめる(歩く距離を短くする)
  function place(g, slots, ch, r, same, all) {
    if (!slots.length) return false;
    let cand = slots.filter(s => same.every(([x, y]) => Math.abs(x - s[0]) + Math.abs(y - s[1]) >= 2));
    if (!cand.length) cand = slots;
    let cx, cy;
    if (all && all.length) { cx = all.reduce((a, [x]) => a + x, 0) / all.length; cy = all.reduce((a, [, y]) => a + y, 0) / all.length; }
    else { cx = g[0].length / 2; cy = g.length / 2; }
    cand = cand.map(s => ({ s, d: Math.abs(s[0] - cx) + Math.abs(s[1] - cy) + r() * 2.5 })).sort((a, b) => a.d - b.d);
    const [x, y] = cand[0].s;
    g[y][x] = ch; slots.splice(slots.findIndex(s => s[0] === x && s[1] === y), 1);
    return [x, y];
  }
  function floodRegions(g) {
    const seen = g.map(row => row.map(() => -1)); let n = 0; const sizes = [];
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
      if (!isWalk(g[y][x]) || seen[y][x] >= 0) continue;
      let cnt = 0; const q = [[x, y]]; seen[y][x] = n;
      for (let i = 0; i < q.length; i++) { const [a, b] = q[i]; cnt++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = a + dx, ny = b + dy;
          if (g[ny] && g[ny][nx] !== undefined && isWalk(g[ny][nx]) && seen[ny][nx] < 0) { seen[ny][nx] = n; q.push([nx, ny]); } } }
      sizes.push(cnt); n++;
    }
    return { seen, n, sizes };
  }

  // 設備の一覧(置く順番どおり)
  function stationList(spec) {
    const list = ["P", "X"];
    if (spec.mode === "kitchen") list.push("D"); else list.push("Z");
    spec.crates.forEach(c => list.push(c));
    for (let i = 0; i < spec.boards; i++) list.push("C");
    for (const k of ["S", "F", "V"]) for (let i = 0; i < spec.cooks[k]; i++) list.push(k);
    return list;
  }

  function buildKitchen(spec, r) {
    const stations = stationList(spec);
    for (let grow = 0; grow < 8; grow++) {
      const w = spec.w + (grow >> 1), h = spec.h + ((grow + 1) >> 1);
      const kg = shapeGrid(spec.shape, w, h, r);
      let g = kg, hallX = null;
      if (spec.mode === "restaurant") {                       // 右にホールをつなげる
        const hw = spec.tables <= 4 ? 5 : spec.tables <= 6 ? 6 : 7, W2 = w + hw;
        g = blank(W2, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y][x] = kg[y][x];
        carve(g, w, 1, W2 - 2, h - 2); hallX = w;
        const ys = []; for (let y = 1; y <= h - 2; y++) if (isWalk(g[y][w - 2])) ys.push(y);
        if (ys.length < 3) continue;
        const doorY = ys[ys.length - 1]; g[doorY][w - 1] = "."; if (ys.length >= 5) { /* 出入口は1か所 */ }
        const kc = ys.filter(y => y < doorY - 1).slice(0, 4); if (kc.length < 2) continue; kc.forEach(y => { g[y][w - 1] = "K"; });
        // テーブル(1マスおきに並べる)
        const tp = []; for (let x = w + 1; x <= W2 - 2; x += 2) for (let y = 2; y <= h - 2; y += 2) tp.push([x, y]);
        if (tp.length < spec.tables) continue;
        const chosen = []; const stepN = tp.length / spec.tables;
        for (let i = 0; i < spec.tables; i++) chosen.push(tp[Math.min(tp.length - 1, Math.floor(i * stepN))]);
        chosen.forEach(([x, y]) => { g[y][x] = "B"; });
        const ey = [];
        for (let y = 1; y <= h - 2; y++) if (g[y][W2 - 2] === ".") ey.push(y);
        if (!ey.length) continue;
        g[ey[Math.floor(ey.length / 2)]][W2 - 1] = "E";
      }
      const slots = slotsOf(g, hallX === null ? 99 : hallX - 2).filter(([x, y]) => !(hallX !== null && x >= hallX - 1));
      if (slots.length < stations.length + 2) continue;
      const placed = {}, allPos = []; let ok = true;
      for (const ch of stations) {
        const pos = place(g, slots, ch, r, placed[ch] || [], allPos);
        if (!pos) { ok = false; break; } (placed[ch] = placed[ch] || []).push(pos); allPos.push(pos);
      }
      if (!ok) continue;
      return { g, hallX };
    }
    throw new Error("配置できない: " + JSON.stringify({ shape: spec.shape, mode: spec.mode, w: spec.w, h: spec.h, tables: spec.tables, st: stations.length }));
  }

  // 分かれた厨房: 部屋を壁で区切り、壁の「受け渡し台」だけでつながる
  function buildSplit(spec, r) {
    const n = spec.split, w = spec.w, h = spec.h, g = blank(w, h);
    const bounds = []; const roomW = Math.floor((w - 1 - (n - 1)) / n); let x = 1;
    for (let i = 0; i < n; i++) { const x1 = i === n - 1 ? w - 2 : x + roomW - 1; carve(g, x, 1, x1, h - 2); bounds.push([x, x1]); x = x1 + 2; }
    const kcol = [];
    for (let i = 0; i < n - 1; i++) {
      const dx = bounds[i][1] + 1; kcol.push(dx);
      const ys = []; for (let y = 1; y <= h - 2; y++) ys.push(y);
      const cnt = Math.min(3, ys.length - 2), start = 1 + Math.floor((ys.length - cnt) / 2);
      for (let j = 0; j < cnt; j++) g[start + j][dx] = "K";
    }
    const roles = n === 2 ? [["crate", "board", "X"], ["cook", "P", "D", "X"]] : [["crate", "board"], ["cook", "X"], ["P", "D", "X"]];
    const placedBy = {};
    roles.forEach((role, i) => {
      const [a, b] = bounds[i], local = [], roomPos = [];
      for (let x = a; x <= b; x++) { local.push([x, 0]); local.push([x, h - 1]); }      // 部屋の上下の壁
      if (i === 0) for (let y = 1; y <= h - 2; y++) local.push([0, y]);                  // 一番左の壁
      if (i === n - 1) for (let y = 1; y <= h - 2; y++) local.push([w - 1, y]);          // 一番右の壁
      const want = [];
      for (const k of role) {
        if (k === "crate") spec.crates.forEach(c => want.push(c));
        else if (k === "board") for (let j = 0; j < spec.boards; j++) want.push("C");
        else if (k === "cook") for (const ck of ["S", "F", "V"]) for (let j = 0; j < spec.cooks[ck]; j++) want.push(ck);
        else want.push(k);
      }
      for (const ch of want) { const pos = place(g, local, ch, r, placedBy[ch] || [], roomPos); if (!pos) throw new Error("分業ステージの配置に失敗: " + ch); (placedBy[ch] = placedBy[ch] || []).push(pos); roomPos.push(pos); }
    });
    return { g, hallX: null, bounds };
  }

  function decorate(g, r, opt) {
    const cells = [];
    for (let y = 1; y < g.length - 1; y++) for (let x = 1; x < g[0].length - 1; x++) if (g[y][x] === ".") cells.push([x, y]);
    if (opt.ice) {                       // 氷の床(一つの長方形ゾーン)
      const W2 = g[0].length, zw = Math.max(3, Math.floor(W2 * 0.4)), zx = 1 + Math.floor(r() * Math.max(1, W2 - 2 - zw));
      for (const [x, y] of cells) if (x >= zx && x < zx + zw && (opt.hallX === null || x < opt.hallX - 1 || r() < 0.5)) g[y][x] = "~";
    }
    for (let b = 0; b < (opt.belt || 0); b++) {   // ベルトコンベア(まっすぐな帯)
      for (let tries = 0; tries < 40; tries++) {
        const horiz = r() < 0.5, len = 3 + Math.floor(r() * 3), [sx, sy] = pick(r, cells);
        const line = []; for (let i = 0; i < len; i++) line.push(horiz ? [sx + i, sy] : [sx, sy + i]);
        if (!line.every(([x, y]) => g[y] && g[y][x] === ".")) continue;
        const dir = horiz ? (r() < 0.5 ? "→" : "←") : (r() < 0.5 ? "↑" : "↓");
        line.forEach(([x, y]) => { g[y][x] = dir; }); break;
      }
    }
  }

  function pickSpawns(g, r, hallX, bounds) {
    const out = [];
    const ok = (x, y) => g[y][x] === "." && (hallX === null || x < hallX - 1);
    for (let i = 0; i < 4; i++) {
      let region = bounds ? bounds[i % bounds.length] : [1, g[0].length - 2], c = null;
      for (let t = 0; t < 200 && !c; t++) {
        const x = region[0] + Math.floor(r() * (region[1] - region[0] + 1)), y = 1 + Math.floor(r() * (g.length - 2));
        if (ok(x, y) && !out.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) < 2)) c = [x, y];
      }
      if (!c) for (let y = 1; y < g.length - 1 && !c; y++) for (let x = region[0]; x <= region[1] && !c; x++) if (ok(x, y) && !out.some(([a, b]) => a === x && b === y)) c = [x, y];
      out.push(c);
    }
    return out.map(([x, y]) => [x + 0.5, y + 0.5]);
  }

  // ---- ステージ1つを作る ----
  function buildStage(wi, ki) {                 // wi: 0..9 ki: 0..9
    const W = WORLDS[wi], S = W.st[ki], id = wi * 10 + ki + 1, fl = FLAVORS[ki];
    const r = rng(id * 2654435761 + 12345);
    const menu = S.m.map(n => { const rec = D.RECIPE_BY_NAME[n]; if (!rec) throw new Error("料理がない: " + n); return rec; });
    const rq = D.requirements(menu);
    const mode = S.split ? "kitchen" : (S.mode || W.mode);
    const spec = {
      mode, shape: S.s || "box", w: (mode !== W.mode && S.w2) ? S.w2 : S.w, h: S.h, tables: S.tables || 4, split: S.split || 0,
      crates: rq.crates.map(t => D.ING[t].crate),
      boards: Math.max(3, rq.boards + 2),
      cooks: { S: 0, F: 0, V: 0 },
    };
    for (const k of ["S", "F", "V"]) spec.cooks[k] = rq.cooks[k] ? Math.max(rq.cooks[k], 2) : 0;
    if (spec.mode === "restaurant" && spec.shape === "corridor") spec.shape = "box";
    const built = S.split ? buildSplit(spec, r) : buildKitchen(spec, r);
    const g = built.g;
    decorate(g, r, { ice: S.ice || (W.ice && ki >= 0 ? W.ice : 0), belt: S.belt != null ? S.belt : (W.belt && ki >= 1 ? 1 : 0), hallX: built.hallX });
    const map = g.map(row => row.join(""));
    // 時間・出題・イベント
    const time = Math.max(45, Math.round(W.time * fl.tm * (mode === "restaurant" ? 1.35 : 1) / 5) * 5);
    const cal = (globalThis.CKCal || {})[id];     // 実測した処理能力(皿/秒)があれば、それに合わせて出題の速さを決める
    const designed = Math.max(11, Math.round(W.spawn * fl.sm));    // 設計した速さ。AIが捌けないステージだけ、さらに遅くする
    const spawn = cal ? Math.max(designed, Math.min(45, Math.round(1 / (1.5 * cal) * fl.sm))) : designed;
    const events = ki + 1 >= W.evFrom ? (ki === 7 ? W.events.concat(["rush"]) : W.events) : [];
    const tip = (W.tips && W.tips[ki + 1]) || "";
    const evGap = Math.max(14, Math.round(40 - wi * 2.5 - (fl.id === "gauntlet" || fl.id === "boss" ? 8 : 0)));
    const stage = {
      id, world: wi + 1, k: ki + 1, name: S.t, worldName: W.name, emoji: W.emoji, label: fl.label, flavor: fl.id,
      mode, map, hallX: built.hallX, menu: S.m, tables: mode === "restaurant" ? spec.tables : 0,
      time, spawn, patience: Math.round(80 - wi * 2 - (fl.id === "boss" ? 6 : 0)), events, evGap,
      plates: mode === "restaurant" ? (S.plates || Math.min(7, spec.tables + 2)) : 6,
      stock: S.stock || (W.stock || null), burn: W.burn || 1, minPlayers: W.minPlayers || 1,
      split: S.split || 0, ice: !!map.join("").includes("~"), belt: /[→←↑↓]/.test(map.join("")), tip,
      req: { boards: spec.boards, cooks: spec.cooks, crates: rq.crates },
      spawns: pickSpawns(g, r, built.hallX, built.bounds),
    };
    stage.gimmicks = [stage.split ? "🧱分業" : "", stage.ice ? "🧊氷" : "", stage.belt ? "➡ベルト" : "", stage.stock ? "📦在庫" : "", stage.burn > 1 ? "🔥焦げやすい" : "", stage.mode === "restaurant" ? "🛎接客" : "🍳厨房"].filter(Boolean);
    return stage;
  }

  // ---- 対戦・エンドレス用のアリーナ(通常ステージとは別枠) ----
  const mirrorRow = row => [...row].reverse().map(ch => ch === "→" ? "←" : ch === "←" ? "→" : ch);
  function buildArena(a) {
    const r = rng(a.id * 2654435761 + 777);
    const menu = a.menu.map(n => D.RECIPE_BY_NAME[n]); if (menu.some(x => !x)) throw new Error("料理がない: " + a.menu);
    const rq = D.requirements(menu);
    const spec = { mode: "kitchen", shape: a.shape, w: a.w, h: a.h, tables: 0, split: 0, crates: rq.crates.map(t => D.ING[t].crate), boards: Math.max(3, rq.boards + 2), cooks: { S: 0, F: 0, V: 0 } };
    for (const k of ["S", "F", "V"]) spec.cooks[k] = rq.cooks[k] ? Math.max(rq.cooks[k], 2) : 0;
    const built = buildKitchen(spec, r), g = built.g;
    decorate(g, r, { ice: a.ice || 0, belt: a.belt || 0, hallX: null });
    let rows = g.map(row => row.join("")), spawns = pickSpawns(g, r, null, null);
    if (a.versus) {                                     // 同じ厨房を左右に並べる(壁は2枚重ねで、向こう側には届かない)
      const gw = rows[0].length;
      rows = rows.map(row => row + mirrorRow(row).join(""));
      spawns = [spawns[0], spawns[1], [2 * gw - spawns[0][0], spawns[0][1]], [2 * gw - spawns[1][0], spawns[1][1]]];
    }
    const map = rows, flat = map.join("");
    const st = {
      id: a.id, world: a.world, k: 0, name: a.name, worldName: a.kind, emoji: a.emoji, label: a.label || "", flavor: a.kind,
      mode: "kitchen", map, hallX: null, menu: a.menu, tables: 0, time: a.time || 120, spawn: a.spawn || 18, patience: a.patience || 60,
      events: a.events || [], evGap: a.evGap || 30, plates: 6, stock: a.stock || null, burn: a.burn || 1, minPlayers: 1, split: 0,
      ice: flat.includes("~"), belt: /[→←↑↓]/.test(flat), tip: a.tip || "", req: { boards: spec.boards, cooks: spec.cooks, crates: rq.crates }, spawns,
      versus: !!a.versus, endless: !!a.endless, desc: a.desc || "",
    };
    st.gimmicks = [st.ice ? "🧊氷" : "", st.belt ? "➡ベルト" : "", st.stock ? "📦在庫" : "", "🍳厨房"].filter(Boolean);
    return st;
  }
  const ENDLESS_DEFS = [
    { id: 201, name: "サラダ工房", emoji: "🥗", world: 1, shape: "box", w: 11, h: 8, menu: ["きざみレタス", "サラダ", "トマトスープ", "ミックスサラダ", "玉ねぎスープ", "野菜スープ"], desc: "やさしい練習向け。野菜と簡単なスープ。" },
    { id: 202, name: "スープの街", emoji: "🍲", world: 2, shape: "L", w: 12, h: 8, menu: ["トマトスープ", "玉ねぎスープ", "にんじんスープ", "野菜スープ", "ミックスサラダ", "ポトフ"], desc: "コンロの取り合い。煮込みが主役。" },
    { id: 203, name: "ステーキハウス", emoji: "🥩", world: 4, shape: "islands", w: 12, h: 8, menu: ["ステーキ", "サラダ", "ステーキプレート", "きのこソテー", "肉野菜炒め", "ミックスサラダ"], desc: "お肉と付け合わせ。焦がさずさばこう。" },
    { id: 204, name: "バーガー&ポテト", emoji: "🍔", world: 6, shape: "ring", w: 12, h: 9, belt: 1, menu: ["ベジバーガー", "ハンバーガー", "フライドポテト", "チーズバーガー", "バーガーセット", "フィッシュ&チップス"], desc: "ベルトコンベア付き。揚げ物も登場。" },
    { id: 205, name: "グランシェフ", emoji: "👨‍🍳", world: 10, shape: "cross", w: 13, h: 9, ice: 1, menu: ["サラダ", "ステーキ", "ハンバーガー", "ポテトグラタン", "フルコース", "海鮮グラタン", "肉丼"], desc: "氷の床。全部のせの上級者向け。" },
  ].map(d => ({ ...d, kind: "エンドレス", endless: true, time: 99999, spawn: 20, patience: 70, events: [] }));
  const VERSUS_DEFS = [
    { id: 301, name: "サラダ対決", emoji: "🥗", world: 1, shape: "box", w: 8, h: 7, menu: ["サラダ", "きざみレタス", "トマトスープ"], desc: "入門。まずは操作に慣れよう。" },
    { id: 302, name: "スープ対決", emoji: "🍲", world: 2, shape: "box", w: 8, h: 8, menu: ["トマトスープ", "玉ねぎスープ", "野菜スープ", "サラダ"], desc: "コンロの使い方が勝負。" },
    { id: 303, name: "ステーキ対決", emoji: "🥩", world: 4, shape: "L", w: 9, h: 8, menu: ["ステーキ", "ステーキプレート", "サラダ", "きのこソテー"], desc: "お肉を焦がしたら負け。" },
    { id: 304, name: "バーガー対決", emoji: "🍔", world: 6, shape: "box", w: 9, h: 8, belt: 1, menu: ["ベジバーガー", "ハンバーガー", "チーズバーガー", "サラダ"], desc: "ベルトコンベアに流されるな。" },
    { id: 305, name: "揚げ物対決", emoji: "🍟", world: 7, shape: "box", w: 9, h: 8, menu: ["フライドポテト", "フィッシュフライ", "フィッシュ&チップス", "ハンバーガー"], desc: "油は焦げやすい。手早く!" },
    { id: 306, name: "氷上対決", emoji: "🧊", world: 8, shape: "box", w: 9, h: 8, ice: 1, menu: ["焼きポテト", "チーズトースト", "ポテトグラタン", "サラダ"], desc: "滑る床で、止まれない!" },
  ].map(d => ({ ...d, kind: "対戦", versus: true, time: 120, spawn: 14, patience: 50, events: [] }));
  const ENDLESS = ENDLESS_DEFS.map(buildArena), VS_STAGES = VERSUS_DEFS.map(buildArena);

  const STAGES = [];
  for (let w = 0; w < WORLDS.length; w++) for (let k = 0; k < 10; k++) STAGES.push(buildStage(w, k));

  // ---- 検査(テストとシミュレーションで使う) ----
  function validate(st) {
    const errs = [], rows = st.map, H = rows.length, W = rows[0].length;
    if (!rows.every(r => [...r].length === W)) errs.push("行の長さがそろっていない");
    const g = rows.map(r => [...r]);
    const cnt = {}; g.flat().forEach(c => { cnt[c] = (cnt[c] || 0) + 1; });
    const mult = st.versus ? 2 : 1;
    const need = (ch, n, label) => { n *= mult; if ((cnt[ch] || 0) < n) errs.push(`${label}が足りない(${cnt[ch] || 0}/${n})`); };
    need("P", 1, "お皿置き場"); need("X", 1, "ゴミ箱"); need("C", st.req.boards, "まな板");
    for (const k of ["S", "F", "V"]) if (st.req.cooks[k]) need(k, st.req.cooks[k], D.COOKERS[k].name);
    st.req.crates.forEach(t => need(D.ING[t].crate, 1, D.ING[t].name + "の置き場"));
    if (st.mode === "kitchen") need("D", 1, "提供窓口"); else { need("Z", 1, "シンク"); need("B", st.tables, "テーブル"); need("K", 1, "受け渡し台"); }
    if (st.split) need("K", st.split - 1, "受け渡し台");
    // 床のつながり
    const { seen, n } = floodRegions(g);
    const want = st.versus ? 2 : (st.split || 1); if (n !== want) errs.push(`部屋の数が${n}(期待${want})`);
    // 設備はどれも床に面している
    g.forEach((row, y) => row.forEach((ch, x) => {
      if (isWalk(ch) || ch === "#") return;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] !== undefined && isWalk(g[y + dy][x + dx]))) errs.push(`設備(${ch})が床に面していない (${x},${y})`);
    }));
    // 出現位置は床。人数ぶん用意
    st.spawns.forEach(([x, y], i) => { if (!isWalk(g[Math.floor(y)][Math.floor(x)])) errs.push(`出現位置${i}が床でない`); });
    if (st.spawns.length < 4) errs.push("出現位置が足りない");
    // 分業は受け渡し台が隣り合う2部屋にまたがること
    if (st.split) {
      const links = new Set();
      g.forEach((row, y) => row.forEach((ch, x) => { if (ch !== "K") return;
        const a = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] !== undefined && isWalk(g[y + dy][x + dx]) ? seen[y + dy][x + dx] : -1).filter(v => v >= 0);
        if (new Set(a).size === 2) links.add([...new Set(a)].sort().join("-")); }));
      if (links.size < st.split - 1) errs.push("部屋どうしが受け渡し台でつながっていない");
    }
    if (st.time < 40) errs.push("時間が短すぎる");
    return errs;
  }

  globalThis.CKStages = { STAGES, ENDLESS, VS_STAGES, WORLDS, FLAVORS, validate, floodRegions, WALK, rng };
})();
