// 食材・料理・ドリンクの3Dモデル。食材40種と料理20種は「食材と料理の3D図鑑」のモデル(src/client/zukan.ts)、
// ドリンクは Kenney の Food Kit(CC0)。原点は底の中心。皿は直径およそ 0.3m。

import * as THREE from "three";
import { DISHES, INGREDIENTS, needsCut } from "../shared/menu";
import { foodModel, type FoodModel, type Tint } from "./food";
import { zukanBuild } from "./zukan";

type DrinkShape = "glass" | "mug" | "wine" | "beer" | "sake";

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

/** 食材ごとの色(UIの注文票や、遠くから見たときの色)。[生, 調理後]。キーは INGREDIENTS の id */
const ING_COLOR: Record<string, [raw: number, cooked: number]> = {
  ground_meat: [0xc4605a, 0x6b3a22], beef: [0xb4403f, 0x5a3020], chicken: [0xe7b79a, 0xc98a3c], pork: [0xe9a7a0, 0xc2864a],
  bacon: [0xe08a7a, 0xa8452e], salmon: [0xf08a6a, 0xe0715a], tuna: [0x9e1b2c, 0x7a2a2a], egg: [0xf3e6c8, 0xf6d24a],
  bread: [0xf0dcae, 0xc88a3a], butter: [0xf7dc6f, 0xf0c030], tomato: [0xdf2a1b, 0xc82a1a], lemon: [0xf4d21f, 0xf4d21f],
  nori: [0x1c2a1c, 0x101810], salt: [0xf5f7f8, 0xf5f7f8], mayonnaise: [0xf6efc8, 0xf6efc8],
  pasta: [0xe9d9a0, 0xf0d77a], chinese_noodles: [0xf0dd9a, 0xf3d575], rice: [0xf7f4ec, 0xfbfaf4], tofu: [0xf5f1e4, 0xf1ecd8],
  carrot: [0xe9772a, 0xe0701e], cabbage: [0xc5df8a, 0x9ccc5a], lettuce: [0xa8dc5c, 0xa8dc5c], cucumber: [0x2e6b2c, 0x2e6b2c],
  negi: [0x4a973d, 0x3f8a35], miso: [0xb9813f, 0xb9813f], curry_roux: [0x6b3d16, 0x8a5a1c], milk: [0xfafafa, 0xfafafa],
  soy_sauce: [0x2a120a, 0x2a120a], ketchup: [0xc81d14, 0xc81d14], strawberry: [0xd81e2c, 0xd81e2c],
  shrimp: [0xe9a090, 0xe0602a], flour: [0xefe7d2, 0xf0d9a8], breadcrumbs: [0xe8c98a, 0xd9b06a], potato: [0xc9a66b, 0xe6b03a],
  eggplant: [0x3a1a4e, 0x3f2a4a], garlic: [0xf3ecdc, 0xd9b06a], sausage: [0xb24a32, 0x8a3a26], onion: [0xd49a3e, 0xc98d3d],
  green_pepper: [0x1f7a2a, 0x2f7a2c], cheese: [0xf4b93a, 0xf0b030],
};

/** 調理後の見た目。材質の色を、この色へこの割合だけ寄せる(焼き色・衣・煮汁など)。ないものは生と同じ */
const COOK_TINT: Record<string, Tint> = {
  ground_meat: [0x6b3a22, 0.5], beef: [0x5a3020, 0.55], chicken: [0xc98a3c, 0.45], pork: [0xc2864a, 0.4],
  bacon: [0xa8452e, 0.35], salmon: [0xe0715a, 0.3], tuna: [0x7a2a2a, 0.25], egg: [0xf6d24a, 0.3],
  bread: [0xc88a3a, 0.4], tomato: [0xc82a1a, 0.15], nori: [0x101810, 0.4],
  pasta: [0xf0d77a, 0.12], rice: [0xfbfaf4, 0.2], carrot: [0xe0701e, 0.2], cabbage: [0x9ccc5a, 0.2], curry_roux: [0x8a5a1c, 0.4],
  shrimp: [0xe0602a, 0.5], flour: [0xf0d9a8, 0.3], breadcrumbs: [0xd9b06a, 0.4], potato: [0xe6b03a, 0.5],
  eggplant: [0x3f2a4a, 0.2], garlic: [0xd9b06a, 0.35], sausage: [0x8a3a26, 0.3], onion: [0xc98d3d, 0.4],
  green_pepper: [0x2f7a2c, 0.2], cheese: [0xf0b030, 0.2],
};

/** 食材の大きさ(いちばん大きい辺、m)。ないものは 0.12 */
const ING_SIZE: Record<string, number> = {
  potato: 0.1, egg: 0.07, onion: 0.09, garlic: 0.07, lemon: 0.08, strawberry: 0.07, tomato: 0.09, cucumber: 0.15, carrot: 0.15,
  negi: 0.15, eggplant: 0.13, bread: 0.11, bacon: 0.14, beef: 0.14, pork: 0.14, flour: 0.14, milk: 0.14, salt: 0.1, ketchup: 0.13,
  curry_roux: 0.11, nori: 0.11, miso: 0.1, rice: 0.11, pasta: 0.14, tofu: 0.1, cheese: 0.1, butter: 0.1, salmon: 0.14, tuna: 0.13,
  ground_meat: 0.13, chicken: 0.14, lettuce: 0.1, cabbage: 0.11, green_pepper: 0.1, breadcrumbs: 0.1,
};

/** 皿の横幅(m)。ゲームの皿(直径およそ 0.3m)に合わせる */
const DISH_SIZE = 0.3;

const tinted = new Map<string, THREE.Group>();

/** 図鑑のモデルを、いちばん大きい辺(皿は横幅)が size(m)になる大きさで返す。tint を渡すと、材質の色をそれへ寄せる */
function zukanModel(kind: "ingredient" | "dish", id: string, size: number, tint?: Tint): THREE.Group {
  const base = zukanBuild(kind, id)!;
  const key = `${kind}:${id}:${tint ? `${tint[0]}.${tint[1]}` : ""}`;
  let tpl = tinted.get(key);
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
    tinted.set(key, tpl);
  }
  const dim = new THREE.Box3().setFromObject(tpl).getSize(new THREE.Vector3());
  const k = size / (kind === "dish" ? Math.max(dim.x, dim.z) : Math.max(dim.x, dim.y, dim.z));
  const inst = tpl.clone(true);
  inst.scale.setScalar(k);
  const wrap = new THREE.Group();
  wrap.add(inst);
  return wrap;
}

/** 食材1つ。cooked=false は生、true は調理後。cut=true で、切る食材は小さく切った形(3つのかけら)になる。原点は底の中心 */
export function makeIngredient(i: number, cooked: boolean, cut = false): THREE.Group {
  const id = INGREDIENTS[i]!.id;
  const tint = cooked ? COOK_TINT[id] : undefined;
  if (!cut || !needsCut(i)) return zukanModel("ingredient", id, ING_SIZE[id] ?? 0.12, tint);
  const g = new THREE.Group();
  const size = (ING_SIZE[id] ?? 0.12) * 0.5;
  for (const [x, z, r] of [[-0.03, -0.015, 0.4], [0.03, -0.02, 2.2], [0, 0.035, 4.1]] as const) {
    const piece = zukanModel("ingredient", id, size, tint);
    piece.position.set(x, 0, z);
    piece.rotation.y = r;
    g.add(piece);
  }
  return g;
}

/** 1皿(図鑑の皿ごとのモデル)。原点は皿の底の中心 */
export function makeDish(i: number): THREE.Group {
  return zukanModel("dish", DISHES[i % DISHES.length]!.id, DISH_SIZE);
}

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
export const dishColorHex = (i: number): number => ING_COLOR[INGREDIENTS[DISHES[i % DISHES.length]!.parts[0]!]!.id]![1];
export const dishColorCss = (i: number): string => hex(dishColorHex(i));
export const ingredientColorCss = (i: number, cooked: boolean): string => hex(ING_COLOR[INGREDIENTS[i]!.id]![cooked ? 1 : 0]);
export const drinkColorCss = (i: number): string => hex(DRINK_LOOK[i % DRINK_LOOK.length]!.color);

/** 図鑑用: ドリンクの形が、配布モデルか、コードで作ったものか(モデルが読み込めているときの話) */
export const drinkHasModel = (i: number): boolean => DRINK_MODEL[i % DRINK_MODEL.length] !== undefined;
