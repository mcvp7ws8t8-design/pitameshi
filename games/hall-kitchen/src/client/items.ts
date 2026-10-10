// 食材・料理・ドリンクの3Dモデル。食材40種は十数種類の形に色を変えて作り、料理は皿に食材を盛って作る。
// 原点は底の中心。皿は直径およそ 0.3m。

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DISHES } from "../shared/menu";
import { foodModel, type FoodModel, type Tint } from "./food";
import { zukanBuild } from "./zukan";

type DrinkShape = "glass" | "mug" | "wine" | "beer" | "sake";

type IngShape =
  | "patty" | "steak" | "thigh" | "strips" | "egg" | "ball" | "log" | "mushroom" | "mound" | "slice"
  | "slab" | "skewer" | "dumpling" | "coil" | "floret" | "leaf" | "cob" | "shrimp" | "ring" | "roll" | "disc";

interface IngLook {
  shape: IngShape;
  raw: number;
  cooked: number;
}

// 順番は src/shared/menu.ts の INGREDIENTS と同じ。生のときと調理後で色が変わる
const ING_LOOK: IngLook[] = [
  // 焼く
  { shape: "patty", raw: 0xc4605a, cooked: 0x6b3a22 }, // 合い挽き肉
  { shape: "steak", raw: 0xb4403f, cooked: 0x5a3020 }, // 牛ステーキ肉
  { shape: "thigh", raw: 0xe7b79a, cooked: 0xc98a3c }, // 鶏もも肉
  { shape: "strips", raw: 0xe9a7a0, cooked: 0xc2864a }, // 豚バラ肉
  { shape: "egg", raw: 0xf3e6c8, cooked: 0xf6d24a }, // 卵
  { shape: "ball", raw: 0xefe2c3, cooked: 0xc98d3d }, // 玉ねぎ
  { shape: "log", raw: 0x3f9a3a, cooked: 0x2f7a2c }, // ピーマン
  { shape: "mushroom", raw: 0xa0825a, cooked: 0x6e4c2a }, // しいたけ
  { shape: "mound", raw: 0xf7f4ec, cooked: 0xe2c47e }, // ごはん
  { shape: "slice", raw: 0xf0dcae, cooked: 0xc88a3a }, // 食パン
  { shape: "slab", raw: 0xf6d24a, cooked: 0xf0b030 }, // チーズ
  { shape: "strips", raw: 0xe08a7a, cooked: 0xa8452e }, // ベーコン
  { shape: "skewer", raw: 0xe9b9a0, cooked: 0x9a5a2a }, // 焼き鳥串
  { shape: "slab", raw: 0xf08a6a, cooked: 0xe0715a }, // 鮭
  { shape: "log", raw: 0x5a2f6a, cooked: 0x3f2a4a }, // なす
  { shape: "dumpling", raw: 0xf2e6c8, cooked: 0xe0a85a }, // 餃子
  // 茹でる
  { shape: "coil", raw: 0xe9d9a0, cooked: 0xf0d77a }, // スパゲッティ
  { shape: "coil", raw: 0xf0dd9a, cooked: 0xf3d575 }, // 中華麺
  { shape: "slab", raw: 0xf5f1e4, cooked: 0xf1ecd8 }, // 豆腐
  { shape: "log", raw: 0xe9772a, cooked: 0xe0701e }, // にんじん
  { shape: "floret", raw: 0x4a8a3a, cooked: 0x3f9a40 }, // ブロッコリー
  { shape: "leaf", raw: 0x2f7a35, cooked: 0x2a6a30 }, // ほうれん草
  { shape: "cob", raw: 0xf1d24a, cooked: 0xf0c42a }, // トウモロコシ
  { shape: "mound", raw: 0xb5782a, cooked: 0x9a5a14 }, // カレー
  { shape: "slab", raw: 0xe9a7a0, cooked: 0x8a5a3a }, // 煮豚
  { shape: "egg", raw: 0xf3e6c8, cooked: 0xc89a5a }, // 煮卵
  { shape: "mound", raw: 0xf7f4ec, cooked: 0xfbfaf4 }, // 白米
  { shape: "dumpling", raw: 0xe7c68a, cooked: 0xe9c27a }, // 焼売
  // 揚げる
  { shape: "strips", raw: 0xf0dca0, cooked: 0xe6b03a }, // フライドポテト
  { shape: "ball", raw: 0xe7b79a, cooked: 0xc17a2a }, // から揚げ肉
  { shape: "slab", raw: 0xe9a7a0, cooked: 0xc88a2f }, // 豚ロース
  { shape: "shrimp", raw: 0xe9a090, cooked: 0xe0602a }, // えび
  { shape: "slab", raw: 0xe39a2a, cooked: 0xe08a1a }, // かぼちゃ
  { shape: "slab", raw: 0xf2f0e8, cooked: 0xd9a040 }, // 白身魚
  { shape: "ring", raw: 0xf0eee6, cooked: 0xe0b060 }, // いか
  { shape: "ball", raw: 0xe0b87a, cooked: 0xb8761f }, // コロッケ
  { shape: "roll", raw: 0xe9d8a0, cooked: 0xc88a2a }, // 春巻き
  { shape: "strips", raw: 0x6aa83a, cooked: 0x5a9a30 }, // アスパラ
  { shape: "disc", raw: 0xeed9c0, cooked: 0xe0b878 }, // れんこん
  { shape: "slab", raw: 0xe9b79a, cooked: 0xc0832a }, // チキンカツ
];

const DRINK_LOOK: { shape: DrinkShape; color: number }[] = [
  { shape: "glass", color: 0xcfe8f5 }, // お冷
  { shape: "glass", color: 0x8a5a2b }, // 烏龍茶
  { shape: "mug", color: 0x8aa84a }, // 緑茶
  { shape: "glass", color: 0x2b1a12 }, // コーラ
  { shape: "glass", color: 0xd9a441 }, // ジンジャーエール
  { shape: "glass", color: 0xf08a1a }, // オレンジジュース
  { shape: "glass", color: 0xe6c75a }, // アップルジュース
  { shape: "glass", color: 0x3a2416 }, // アイスコーヒー
  { shape: "mug", color: 0x3a2416 }, // ホットコーヒー
  { shape: "glass", color: 0xb86a24 }, // アイスティー
  { shape: "mug", color: 0xb86a24 }, // ホットティー
  { shape: "glass", color: 0xe8e060 }, // レモンスカッシュ
  { shape: "beer", color: 0xe9b43a }, // 生ビール
  { shape: "glass", color: 0xe8c860 }, // ハイボール
  { shape: "glass", color: 0xc89a30 }, // 梅酒
  { shape: "mug", color: 0xc8a078 }, // カフェラテ
  { shape: "mug", color: 0x6a3a22 }, // ココア
  { shape: "glass", color: 0xf0f0a0 }, // レモンサワー
  { shape: "wine", color: 0x8a1a2e }, // ワイン
  { shape: "sake", color: 0xeef2f4 }, // 日本酒
];

/**
 * 食材ごとの3Dモデル(Kenney の Food Kit)。値は [生のモデル, 調理後のモデル, 大きさ(m), 生の色寄せ, 調理後の色寄せ]。
 * ここにない食材(麺・豆腐・えび・いか・コロッケ・春巻きなど)は、このファイルのコードで作った形を使う。
 * 順番は src/shared/menu.ts の INGREDIENTS と同じ(番号で引く)。
 */
type ModelSpec = [raw: FoodModel, cooked: FoodModel, size: number, rawTint?: Tint, cookedTint?: Tint];
const ING_MODEL: Record<number, ModelSpec> = {
  0: ["meat-patty", "meat-patty", 0.13, [0xe0707a, 0.55], undefined], // 合い挽き肉
  1: ["meat-raw", "meat-cooked", 0.15], // 牛ステーキ肉
  2: ["turkey", "turkey", 0.15, [0xf0b8a0, 0.5]], // 鶏もも肉
  3: ["meat-ribs", "meat-ribs", 0.14, [0xf0a0a0, 0.45]], // 豚バラ肉
  4: ["egg", "egg-cooked", 0.07], // 卵(焼くと目玉焼き)
  5: ["onion", "onion-half", 0.08], // 玉ねぎ
  6: ["paprika", "paprika", 0.08, [0x3f9a3a, 0.9], [0x2f7a2c, 0.9]], // ピーマン(緑に染める)
  7: ["mushroom", "mushroom", 0.08], // しいたけ
  8: ["rice-ball", "rice-ball", 0.09], // ごはん
  9: ["bread", "bread", 0.12, undefined, [0xb06a2a, 0.35]], // 食パン(焼くと焼き色)
  10: ["cheese-cut", "cheese-cut", 0.1], // チーズ
  11: ["bacon-raw", "bacon", 0.13], // ベーコン
  12: ["skewer", "skewer", 0.16, [0xf0b9a0, 0.4]], // 焼き鳥串
  13: ["fish", "fish", 0.16, [0xff9a8a, 0.15], [0xe08a6a, 0.35]], // 鮭
  14: ["eggplant", "eggplant", 0.1], // なす
  15: ["dim-sum", "dim-sum", 0.1], // 餃子
  19: ["carrot", "carrot", 0.15], // にんじん
  20: ["broccoli", "broccoli", 0.1], // ブロッコリー
  21: ["cabbage", "cabbage", 0.1, [0x2f7a35, 0.6], [0x2a6a30, 0.6]], // ほうれん草(葉物)
  22: ["corn", "corn", 0.13], // トウモロコシ
  23: ["pot-stew", "pot-stew", 0.16], // カレー(煮込み鍋)
  24: ["meat-cooked", "meat-cooked", 0.13, undefined, [0x7a4a2a, 0.5]], // 煮豚(煮汁の色)
  25: ["egg-half", "egg-half", 0.08, undefined, [0xc89a5a, 0.6]], // 煮卵
  27: ["dim-sum", "dim-sum", 0.1, [0xe7c68a, 0.4]], // 焼売
  28: ["fries", "fries", 0.11], // フライドポテト
  30: ["meat-cooked", "meat-cooked", 0.13, [0xe9a7a0, 0.3], [0xc88a2f, 0.55]], // 豚ロース(衣をつけて揚げた色)
  32: ["pumpkin-basic", "pumpkin-basic", 0.1], // かぼちゃ
  33: ["fish", "fish", 0.16, [0xf2f0e8, 0.7], [0xd9a040, 0.6]], // 白身魚
  37: ["leek", "leek", 0.15, [0x6aa83a, 0.5], [0x5a9a30, 0.5]], // アスパラ
};

/**
 * 図鑑(zukan.ts)の細かい形を使う食材。値は [図鑑の id, 大きさ(m), 調理後の色寄せ]。調理後の色寄せが null のものは、
 * 調理後だけ上の ING_MODEL(目玉焼きなど)を使う。ここにあるものは ING_MODEL より優先する。順番は INGREDIENTS と同じ。
 */
type ZukanIng = [id: string, size: number, cooked: Tint | null | undefined];
const ZUKAN_ING: Record<number, ZukanIng> = {
  0: ["ground_meat", 0.13, [0x6b3a22, 0.5]], // 合い挽き肉
  1: ["beef", 0.15, [0x5a3020, 0.55]], // 牛ステーキ肉
  2: ["chicken", 0.14, [0xc98a3c, 0.45]], // 鶏もも肉
  3: ["pork", 0.14, [0xc2864a, 0.4]], // 豚バラ肉
  4: ["egg", 0.07, null], // 卵(焼くと目玉焼き)
  5: ["onion", 0.08, [0xc98d3d, 0.35]], // 玉ねぎ
  6: ["green_pepper", 0.09, [0x2f7a2c, 0.2]], // ピーマン
  8: ["rice", 0.11, [0xe2c47e, 0.18]], // ごはん
  9: ["bread", 0.11, [0xc88a3a, 0.4]], // 食パン
  10: ["cheese", 0.1, [0xf0b030, 0.15]], // チーズ
  11: ["bacon", 0.14, [0xa8452e, 0.35]], // ベーコン
  13: ["salmon", 0.14, [0xe0715a, 0.3]], // 鮭
  14: ["eggplant", 0.11, [0x3f2a4a, 0.2]], // なす
  16: ["pasta", 0.13, [0xf0d77a, 0.12]], // スパゲッティ
  17: ["chinese_noodles", 0.12, undefined], // 中華麺
  18: ["tofu", 0.1, undefined], // 豆腐
  19: ["carrot", 0.14, undefined], // にんじん
  26: ["rice", 0.11, undefined], // 白米
  30: ["pork", 0.14, [0xc88a2f, 0.55]], // 豚ロース(衣をつけて揚げた色)
  31: ["shrimp", 0.12, [0xe0602a, 0.5]], // えび
};

/** 図鑑の料理をそのまま皿ごと使う料理。値は図鑑の id。順番は DISHES と同じ */
const ZUKAN_DISH: Record<number, string> = {
  1: "salad", // 温野菜サラダ(図鑑のサラダは生野菜。いちばん近い形)
  2: "onigiri", // 焼きおにぎり
  4: "sandwich", // ホットサンド
  6: "gyoza", // 点心盛り合わせ(餃子)
  8: "curry_rice", // コロッケカレー(コロッケは付かない)
  9: "napolitan", // ナポリタン
  11: "hamburg_steak", // ハンバーグ定食
  12: "omurice", // オムライス
  14: "ramen", // ラーメン
  15: "tonkatsu", // とんかつ定食
  16: "tempura", // 天ぷら盛り合わせ
  17: "steak", // ステーキ
};

/**
 * ドリンクごとの3Dモデル。[モデル, 大きさ(m), 色寄せ]。順番は src/shared/menu.ts の DRINKS と同じ。
 * 色寄せは、中身の色(お茶・ジュース・お酒など)を出すのに使う。
 */
type DrinkSpec = [model: FoodModel, size: number, tint?: Tint];
const DRINK_MODEL: DrinkSpec[] = [
  ["glass", 0.13], // お冷
  ["cup-tea", 0.1, [0x8a5a2b, 0.6]], // 烏龍茶
  ["cup-thea", 0.1, [0x6f9a3a, 0.65]], // 緑茶
  ["soda-bottle", 0.18], // コーラ
  ["soda", 0.15, [0xd9a441, 0.8]], // ジンジャーエール
  ["soda-glass", 0.14, [0xf08a1a, 0.85]], // オレンジジュース
  ["soda-glass", 0.14, [0xd9c24a, 0.8]], // アップルジュース
  ["soda", 0.15, [0x5a3a22, 0.85]], // アイスコーヒー
  ["cup", 0.1], // ホットコーヒー
  ["soda", 0.15, [0xb86a24, 0.8]], // アイスティー
  ["cup-tea", 0.1], // ホットティー
  ["soda-glass", 0.14, [0xe0e040, 0.8]], // レモンスカッシュ
  ["bottle", 0.18, [0xe9a21a, 0.85]], // 生ビール
  ["glass", 0.13, [0xe8c050, 0.75]], // ハイボール
  ["glass", 0.13, [0xc88a20, 0.8]], // 梅酒
  ["cup", 0.1, [0xc8946a, 0.7]], // カフェラテ
  ["mug-1", 0.11], // ココア
  ["frappe", 0.15, [0xeaea70, 0.7]], // レモンサワー
  ["glass-wine", 0.17, [0x8a1a2e, 0.85]], // ワイン
  ["egg-cup", 0.07], // 日本酒
];

const geoCache = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
}
const matCache = new Map<string, THREE.Material>();
function mat(key: string, make: () => THREE.Material): THREE.Material {
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = make()));
  return m;
}
const std = (color: number, rough = 0.6, metal = 0) =>
  mat(`s${color}.${rough}.${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
const glassMat = () =>
  mat("glass", () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.28 }));

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

const cyl = (rt: number, rb: number, h: number, seg = 24) => geo(`c${rt}.${rb}.${h}.${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const sph = (r: number, ws = 16, hs = 12) => geo(`p${r}.${ws}.${hs}`, () => new THREE.SphereGeometry(r, ws, hs));

function plateBase(g: THREE.Group, rough = 0.25) {
  const plate = foodModel("plate", 0.32);
  if (plate) g.add(plate);
  else g.add(mesh(cyl(0.15, 0.1, 0.02), std(0xf6f6f2, rough)));
}

const box = (w: number, h: number, d: number) => geo(`b${w}.${h}.${d}`, () => new THREE.BoxGeometry(w, h, d));
const rbox = (w: number, h: number, d: number, r: number) => geo(`rb${w}.${h}.${d}`, () => new RoundedBoxGeometry(w, h, d, 3, r));
const torus = (r: number, t: number) => geo(`t${r}.${t}`, () => new THREE.TorusGeometry(r, t, 8, 20));
const capsule = (r: number, l: number) => geo(`cap${r}.${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 10));

/** 食材1つ。cooked=false は生、true は調理後。原点は底の中心、大きさはおよそ 0.12m */
function proceduralIngredient(i: number, cooked: boolean): THREE.Group {
  const look = ING_LOOK[i % ING_LOOK.length]!;
  const color = cooked ? look.cooked : look.raw;
  const rough = cooked ? 0.65 : 0.4;
  const m = std(color, rough);
  const g = new THREE.Group();
  const add = (o: THREE.Mesh) => {
    g.add(o);
    return o;
  };
  switch (look.shape) {
    case "patty":
      add(mesh(cyl(0.06, 0.06, 0.03, 20), m, 0, 0.015, 0));
      break;
    case "steak": {
      const o = add(mesh(rbox(0.13, 0.035, 0.1, 0.012), m, 0, 0.0175, 0));
      o.rotation.y = 0.4;
      if (cooked) {
        // 焼き目
        for (const k of [-0.03, 0, 0.03]) add(mesh(box(0.1, 0.002, 0.008), std(0x2a140c, 0.9), k * 0.3, 0.036, k)).rotation.y = 0.4 + 0.7;
      }
      break;
    }
    case "thigh": {
      const o = add(mesh(sph(0.055, 14, 10), m, 0, 0.025, 0));
      o.scale.set(1.4, 0.55, 1);
      break;
    }
    case "strips":
      for (let k = 0; k < 3; k++) {
        const o = add(mesh(box(0.1, 0.012, 0.022), m, 0, 0.007 + (k % 2) * 0.012, -0.03 + k * 0.03));
        o.rotation.y = (k - 1) * 0.12;
      }
      break;
    case "egg": {
      if (cooked) {
        // 目玉焼きのように、白身の上に黄身
        const w = add(mesh(cyl(0.06, 0.06, 0.008, 20), std(0xf8f6ee, 0.5), 0, 0.004, 0));
        w.scale.z = 0.8;
        const y = add(mesh(sph(0.022, 12, 8), std(color, 0.35), 0, 0.016, 0));
        y.scale.y = 0.6;
      } else {
        const o = add(mesh(sph(0.04, 14, 10), m, 0, 0.045, 0));
        o.scale.y = 1.25;
      }
      break;
    }
    case "ball": {
      const o = add(mesh(sph(0.045, 14, 10), m, 0, 0.04, 0));
      o.scale.y = 0.85;
      if (look.cooked === 0xc17a2a || look.cooked === 0xb8761f) {
        add(mesh(sph(0.032, 10, 8), m, 0.05, 0.03, 0.02));
        add(mesh(sph(0.03, 10, 8), m, -0.03, 0.03, 0.05));
      }
      break;
    }
    case "log": {
      const o = add(mesh(cyl(0.022, 0.022, 0.11, 12), m, 0, 0.022, 0));
      o.rotation.z = Math.PI / 2;
      break;
    }
    case "mushroom": {
      const cap = add(mesh(geo("cap", () => new THREE.SphereGeometry(0.055, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), m, 0, 0.03, 0));
      cap.scale.y = 0.7;
      add(mesh(cyl(0.014, 0.016, 0.03, 8), std(0xe8dcc0, 0.7), 0, 0.015, 0));
      break;
    }
    case "mound": {
      const o = add(mesh(sph(0.075, 18, 12), m, 0, 0.012, 0));
      o.scale.set(1, 0.55, 1);
      break;
    }
    case "slice":
      add(mesh(rbox(0.1, 0.014, 0.1, 0.005), m, 0, 0.007, 0));
      break;
    case "slab":
      add(mesh(rbox(0.1, 0.035, 0.07, 0.008), m, 0, 0.0175, 0));
      break;
    case "skewer":
      add(mesh(cyl(0.004, 0.004, 0.2, 6), std(0xc8a878, 0.8), 0, 0.012, 0)).rotation.z = Math.PI / 2;
      for (let k = 0; k < 4; k++) add(mesh(box(0.035, 0.03, 0.03), m, -0.06 + k * 0.04, 0.025, 0));
      break;
    case "dumpling":
      for (let k = 0; k < 3; k++) {
        const o = add(mesh(geo("dump", () => new THREE.SphereGeometry(0.035, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), m, -0.045 + k * 0.045, 0.004, (k % 2) * 0.03));
        o.scale.set(1.3, 0.9, 0.9);
      }
      break;
    case "coil": {
      for (let k = 0; k < 3; k++) {
        const o = add(mesh(torus(0.045 - k * 0.008, 0.012), m, 0, 0.012 + k * 0.014, 0));
        o.rotation.x = Math.PI / 2;
      }
      break;
    }
    case "floret": {
      add(mesh(cyl(0.012, 0.016, 0.04, 8), std(0x7fb257, 0.7), 0, 0.02, 0));
      for (const [x, z] of [[0, 0], [0.025, 0.01], [-0.025, 0.01], [0, -0.025]] as const) add(mesh(sph(0.03, 8, 6), m, x, 0.055, z));
      break;
    }
    case "leaf":
      for (let k = 0; k < 3; k++) {
        const o = add(mesh(sph(0.05, 10, 6), m, 0, 0.012 + k * 0.006, 0));
        o.scale.set(1.3, 0.2, 0.6);
        o.rotation.y = k * 0.9;
      }
      break;
    case "cob": {
      const o = add(mesh(cyl(0.03, 0.03, 0.12, 14), m, 0, 0.03, 0));
      o.rotation.z = Math.PI / 2;
      break;
    }
    case "shrimp": {
      const o = add(mesh(capsule(0.025, 0.07), m, 0, 0.03, 0));
      o.rotation.z = Math.PI / 2;
      o.rotation.y = 0.3;
      add(mesh(box(0.025, 0.008, 0.03), std(cooked ? 0xe0502a : 0xe9a090, 0.5), 0.065, 0.03, 0.01));
      break;
    }
    case "ring":
      add(mesh(torus(0.04, 0.014), m, 0, 0.014, 0)).rotation.x = Math.PI / 2;
      add(mesh(torus(0.025, 0.012), m, 0.04, 0.012, 0.03)).rotation.x = Math.PI / 2;
      break;
    case "roll": {
      const o = add(mesh(cyl(0.022, 0.022, 0.1, 12), m, 0, 0.022, 0));
      o.rotation.z = Math.PI / 2;
      add(mesh(cyl(0.022, 0.022, 0.1, 12), m, 0, 0.022, 0.05)).rotation.z = Math.PI / 2;
      break;
    }
    case "disc":
      for (let k = 0; k < 3; k++) add(mesh(cyl(0.035, 0.035, 0.012, 16), m, -0.04 + k * 0.04, 0.006 + (k % 2) * 0.012, (k % 2) * 0.02));
      break;
  }
  return g;
}

/** 皿ごと使う図鑑の料理の、横幅(m)。ゲームの皿(直径およそ 0.3m)に合わせる */
const DISH_SIZE = 0.3;

const zukanTinted = new Map<string, THREE.Group>();

/** 図鑑のモデルを、横幅(皿は直径・食材は最大の辺)が size(m)になる大きさで返す。tint を渡すと、材質の色をそれへ寄せる */
function zukanModel(kind: "ingredient" | "dish", id: string, size: number, tint?: Tint): THREE.Group | null {
  const base = zukanBuild(kind, id);
  if (!base) return null;
  const key = `${kind}:${id}:${tint ? `${tint[0]}.${tint[1]}` : ""}`;
  let tpl = zukanTinted.get(key);
  if (!tpl) {
    tpl = base.clone(true);
    if (tint) {
      const c = new THREE.Color(tint[0]);
      tpl.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mm = (mesh.material as THREE.MeshStandardMaterial).clone();
        mm.color.lerp(c, tint[1]);
        mesh.material = mm;
      });
    }
    zukanTinted.set(key, tpl);
  }
  const box = new THREE.Box3().setFromObject(tpl);
  const dim = box.getSize(new THREE.Vector3());
  const k = size / (kind === "dish" ? Math.max(dim.x, dim.z) : Math.max(dim.x, dim.y, dim.z));
  const inst = tpl.clone(true);
  inst.scale.setScalar(k);
  const wrap = new THREE.Group();
  wrap.add(inst);
  return wrap;
}

/**
 * 食材1つ。モデルがあるものはそれ、ないものはコードで作った形。cooked=false は生、true は調理後。
 * 原点は底の中心、大きさはおよそ 0.12m。
 */
export function makeIngredient(i: number, cooked: boolean): THREE.Group {
  const z = ZUKAN_ING[i];
  if (z && !(cooked && z[2] === null)) {
    const m = zukanModel("ingredient", z[0], z[1], cooked ? (z[2] ?? undefined) : undefined);
    if (m) return m;
  }
  const spec = ING_MODEL[i];
  if (spec) {
    const m = foodModel(cooked ? spec[1] : spec[0], spec[2], cooked ? spec[4] : spec[3]);
    if (m) return m;
  }
  return proceduralIngredient(i, cooked);
}

/** 1皿。皿の上に、その料理の食材(調理後)を並べる */
export function makeDish(i: number): THREE.Group {
  const zd = ZUKAN_DISH[i % DISHES.length];
  if (zd) {
    const m = zukanModel("dish", zd, DISH_SIZE);
    if (m) return m;
  }
  const dish = DISHES[i % DISHES.length]!;
  const g = new THREE.Group();
  plateBase(g);
  const n = dish.parts.length;
  dish.parts.forEach((ing, k) => {
    const o = makeIngredient(ing, true);
    o.scale.setScalar(n === 1 ? 1.3 : n === 2 ? 1.0 : 0.9);
    o.position.y = 0.02;
    if (n > 1) {
      const a = (k / n) * Math.PI * 2 + 0.6;
      o.position.x = Math.cos(a) * 0.065;
      o.position.z = Math.sin(a) * 0.055;
    }
    o.rotation.y = k * 1.3;
    g.add(o);
  });
  return g;
}

function proceduralDrink(i: number): THREE.Group {
  const look = DRINK_LOOK[i % DRINK_LOOK.length]!;
  const g = new THREE.Group();
  const liquid = std(look.color, 0.2);
  switch (look.shape) {
    case "glass":
      g.add(mesh(cyl(0.04, 0.032, 0.14), glassMat(), 0, 0.07, 0));
      g.add(mesh(cyl(0.036, 0.03, 0.1), liquid, 0, 0.055, 0));
      break;
    case "mug":
      g.add(mesh(cyl(0.04, 0.036, 0.09), std(0xf4f1ea, 0.3), 0, 0.045, 0));
      g.add(mesh(cyl(0.034, 0.034, 0.005), liquid, 0, 0.088, 0));
      {
        const h = mesh(geo("handle", () => new THREE.TorusGeometry(0.025, 0.007, 8, 16, Math.PI)), std(0xf4f1ea, 0.3), 0.045, 0.045, 0);
        h.rotation.z = -Math.PI / 2;
        g.add(h);
      }
      break;
    case "beer":
      g.add(mesh(cyl(0.05, 0.045, 0.15), glassMat(), 0, 0.075, 0));
      g.add(mesh(cyl(0.046, 0.042, 0.115), liquid, 0, 0.06, 0));
      g.add(mesh(cyl(0.047, 0.047, 0.03), std(0xfaf6e8, 0.9), 0, 0.14, 0));
      {
        const h = mesh(geo("handle2", () => new THREE.TorusGeometry(0.035, 0.008, 8, 16, Math.PI)), glassMat(), 0.055, 0.075, 0);
        h.rotation.z = -Math.PI / 2;
        g.add(h);
      }
      break;
    case "wine":
      g.add(mesh(cyl(0.035, 0.035, 0.005), glassMat(), 0, 0.003, 0));
      g.add(mesh(cyl(0.004, 0.004, 0.1), glassMat(), 0, 0.055, 0));
      {
        const bowl = mesh(geo("bowlW", () => new THREE.SphereGeometry(0.045, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), glassMat(), 0, 0.165, 0);
        bowl.material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
        const wine = mesh(sph(0.04, 14, 8), liquid, 0, 0.14, 0);
        wine.scale.y = 0.7;
        g.add(bowl, wine);
      }
      break;
    case "sake":
      g.add(mesh(cyl(0.022, 0.018, 0.045), std(0xf4f1ea, 0.3), 0, 0.0225, 0));
      g.add(mesh(cyl(0.017, 0.017, 0.004), liquid, 0, 0.042, 0));
      break;
  }
  return g;
}

/** ドリンク1つ。モデルがあるものはそれ、読み込めていなければコードで作った形。原点は底の中心 */
export function makeDrink(i: number): THREE.Group {
  const spec = DRINK_MODEL[i % DRINK_MODEL.length];
  if (spec) {
    const m = foodModel(spec[0], spec[1], spec[2]);
    if (m) return m;
  }
  return proceduralDrink(i);
}

/** 注文票などに使う代表色(#rrggbb) */
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
/** 料理の代表色(いちばん目立つ食材の調理後の色) */
export const dishColorCss = (i: number): string => hex(ING_LOOK[DISHES[i % DISHES.length]!.parts[0]! % ING_LOOK.length]!.cooked);
export const ingredientColorCss = (i: number, cooked: boolean): string => hex(cooked ? ING_LOOK[i]!.cooked : ING_LOOK[i]!.raw);
export const drinkColorCss = (i: number): string => hex(DRINK_LOOK[i % DRINK_LOOK.length]!.color);
export const dishColorHex = (i: number): number => ING_LOOK[DISHES[i % DISHES.length]!.parts[0]! % ING_LOOK.length]!.cooked;

/** 図鑑用: 食材・ドリンクの形が、配布モデルか、コードで作ったものか(モデルが読み込めているときの話) */
export const ingredientHasModel = (i: number): boolean => ING_MODEL[i] !== undefined || ZUKAN_ING[i] !== undefined;
/** 図鑑用: 皿ごと作り込んだ料理か */
export const dishHasModel = (i: number): boolean => ZUKAN_DISH[i % DISHES.length] !== undefined;
export const drinkHasModel = (i: number): boolean => DRINK_MODEL[i % DRINK_MODEL.length] !== undefined;
