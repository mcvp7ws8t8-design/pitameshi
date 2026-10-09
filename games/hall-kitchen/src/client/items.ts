// 料理とドリンクの3Dモデル。形は数種類の型に色を変えて使い回す。
// 原点は底の中心。皿は直径およそ 0.3m。

import * as THREE from "three";

type DishShape = "plate" | "bowl" | "burger" | "cube" | "sushi";
type DrinkShape = "glass" | "mug" | "wine" | "beer" | "sake";

// 順番は src/shared/menu.ts と同じ
const DISH_LOOK: { shape: DishShape; color: number; accent: number }[] = [
  { shape: "cube", color: 0xf4f1e6, accent: 0x6aa84f }, // 冷やっこ
  { shape: "plate", color: 0x5aa84a, accent: 0xd9432e }, // サラダ
  { shape: "bowl", color: 0xf0c23a, accent: 0xf6e7a0 }, // コーンスープ
  { shape: "plate", color: 0xf4f4ee, accent: 0x1c1c1c }, // おにぎり
  { shape: "plate", color: 0xe6b84a, accent: 0xd9a43a }, // フライドポテト
  { shape: "burger", color: 0xe9c88a, accent: 0x6aa84f }, // サンドイッチ
  { shape: "plate", color: 0xc8832e, accent: 0xe8b04a }, // から揚げ
  { shape: "plate", color: 0xe0b979, accent: 0xa8662a }, // 餃子
  { shape: "plate", color: 0x9a4f22, accent: 0x6e3414 }, // 焼き鳥
  { shape: "plate", color: 0xb8741f, accent: 0xf4f1e6 }, // カレーライス
  { shape: "plate", color: 0xd9532b, accent: 0xe8a05a }, // ナポリタン
  { shape: "plate", color: 0xd9a84a, accent: 0x6aa84f }, // チャーハン
  { shape: "burger", color: 0xd9a05a, accent: 0x5a2e1c }, // ハンバーグ
  { shape: "plate", color: 0xf0c040, accent: 0xc0392b }, // オムライス
  { shape: "plate", color: 0xf3e2a8, accent: 0x3a2a1a }, // カルボナーラ
  { shape: "bowl", color: 0xd9a35a, accent: 0xf4e9c8 }, // ラーメン
  { shape: "sushi", color: 0xf4f1e6, accent: 0xe4604a }, // 寿司盛り合わせ
  { shape: "plate", color: 0xc98a35, accent: 0x7fae4a }, // とんかつ定食
  { shape: "plate", color: 0xe0a850, accent: 0xc8782a }, // 天ぷら盛り合わせ
  { shape: "plate", color: 0x5a2e1c, accent: 0xe8d46a }, // ステーキ
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
  g.add(mesh(cyl(0.15, 0.1, 0.02), std(0xf6f6f2, rough)));
}

export function makeDish(i: number): THREE.Group {
  const look = DISH_LOOK[i % DISH_LOOK.length]!;
  const g = new THREE.Group();
  switch (look.shape) {
    case "plate": {
      plateBase(g);
      const m = mesh(sph(0.1), std(look.color, 0.8), 0, 0.03, 0);
      m.scale.set(1, 0.45, 0.85);
      g.add(m);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + i;
        g.add(mesh(sph(0.03, 10, 8), std(look.accent, 0.7), Math.cos(a) * 0.07, 0.065, Math.sin(a) * 0.06));
      }
      break;
    }
    case "bowl": {
      g.add(mesh(geo("bowl", () => new THREE.SphereGeometry(0.11, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), std(0xf4f1ea, 0.3), 0, 0.1, 0));
      (g.children[0] as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.3, side: THREE.DoubleSide });
      g.add(mesh(cyl(0.1, 0.1, 0.01, 24), std(look.color, 0.5), 0, 0.085, 0));
      g.add(mesh(sph(0.035, 10, 8), std(look.accent, 0.6), 0.02, 0.1, 0.01));
      break;
    }
    case "burger": {
      plateBase(g);
      g.add(mesh(cyl(0.085, 0.085, 0.025), std(look.color, 0.7), 0, 0.035, 0));
      g.add(mesh(cyl(0.09, 0.09, 0.02), std(look.accent, 0.8), 0, 0.058, 0));
      g.add(mesh(cyl(0.085, 0.085, 0.02), std(0xe8c04a, 0.6), 0, 0.078, 0));
      const top = mesh(geo("bun", () => new THREE.SphereGeometry(0.088, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), std(look.color, 0.65), 0, 0.088, 0);
      top.scale.y = 0.75;
      g.add(top);
      break;
    }
    case "cube": {
      plateBase(g);
      g.add(mesh(geo("tofu", () => new THREE.BoxGeometry(0.1, 0.06, 0.1)), std(look.color, 0.4), 0, 0.05, 0));
      g.add(mesh(sph(0.025, 8, 6), std(look.accent, 0.7), 0, 0.09, 0));
      break;
    }
    case "sushi": {
      g.add(mesh(geo("geta", () => new THREE.BoxGeometry(0.3, 0.02, 0.16)), std(0x8b5a2b, 0.8)));
      for (let k = 0; k < 5; k++) {
        g.add(mesh(geo("rice", () => new THREE.BoxGeometry(0.045, 0.03, 0.08)), std(0xf4f1e6, 0.6), -0.1 + k * 0.05, 0.03, 0));
        g.add(mesh(geo("neta", () => new THREE.BoxGeometry(0.05, 0.015, 0.085)), std(k % 2 ? look.accent : 0xf0a070, 0.4), -0.1 + k * 0.05, 0.053, 0));
      }
      break;
    }
  }
  return g;
}

export function makeDrink(i: number): THREE.Group {
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

/** 注文票などに使う代表色(#rrggbb) */
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
export const dishColorCss = (i: number): string => hex(DISH_LOOK[i % DISH_LOOK.length]!.color);
export const drinkColorCss = (i: number): string => hex(DRINK_LOOK[i % DRINK_LOOK.length]!.color);
