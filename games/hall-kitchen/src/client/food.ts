// 食材・ドリンクの3Dモデル(Kenney の Food Kit。CC0)。public/assets/models/food に置いてある。
// モデルの元は Draco 圧縮と「光に反応しない(unlit)」材質だったので、
//  - 圧縮は取り込むときに展開して(gltf-transform)、
//  - 材質は読み込み時に、光と影に反応する材質へ置き換える。
// 読み込めなかったときは、items.ts のコードで作った形に戻る。

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadAsset } from "./assets";

export const FOOD_MODELS = [
  "meat-patty", "meat-raw", "meat-cooked", "meat-ribs", "turkey", "bacon-raw", "bacon", "egg", "egg-cooked", "egg-half",
  "onion", "onion-half", "paprika", "mushroom", "rice-ball", "bread", "cheese-cut", "skewer", "fish", "eggplant", "dim-sum",
  "carrot", "broccoli", "cabbage", "leek", "corn", "pumpkin-basic", "fries", "pot-stew", "plate", "frying-pan",
  // ドリンク
  "glass", "glass-wine", "soda-glass", "soda", "frappe", "mug-1", "cup", "cup-tea", "cup-thea", "egg-cup", "soda-bottle", "bottle",
] as const;
export type FoodModel = (typeof FOOD_MODELS)[number];

/** 色を、指定の色へ amount(0〜1)だけ寄せる。焼き色・衣・煮汁などの違いを出すのに使う */
export type Tint = [color: number, amount: number];

const templates = new Map<string, THREE.Group>();
const tinted = new Map<string, THREE.Group>();
let loaded = false;

/** すべてのモデルを読み込む。1つ読めなくても、ほかは使える */
export async function preloadFood(): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all(
    FOOD_MODELS.map(async (name) => {
      try {
        const gltf = await loader.parseAsync(await loadAsset(`models/food/${name}.glb`), "");
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          const lit = mats.map((m) => {
            const basic = m as THREE.MeshBasicMaterial;
            return new THREE.MeshStandardMaterial({ color: basic.color, map: basic.map, roughness: 0.7, metalness: 0 });
          });
          mesh.material = Array.isArray(mesh.material) ? lit : lit[0]!;
        });
        templates.set(name, gltf.scene);
      } catch (e) {
        console.warn(`食材のモデルを読み込めませんでした: ${name}`, e);
      }
    }),
  );
  loaded = true;
}

export const foodLoaded = () => loaded;

/**
 * 食材のモデルを、いちばん大きい辺が size(m)になる大きさで返す。底は y=0、水平の中心は原点。
 * まだ読み込めていない(または読めなかった)ときは null
 */
export function foodModel(name: FoodModel, size: number, tint?: Tint): THREE.Group | null {
  const base = templates.get(name);
  if (!base) return null;
  const key = `${name}:${tint ? `${tint[0]}.${tint[1]}` : ""}`;
  let tpl = tinted.get(key);
  if (!tpl) {
    tpl = base.clone(true);
    if (tint) {
      const c = new THREE.Color(tint[0]);
      tpl.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
          const mm = (m as THREE.MeshStandardMaterial).clone();
          mm.color.lerp(c, tint[1]);
          return mm;
        });
        mesh.material = Array.isArray(mesh.material) ? mats : mats[0]!;
      });
    }
    tinted.set(key, tpl);
  }
  const inst = tpl.clone(true);
  const box = new THREE.Box3().setFromObject(inst);
  const dim = box.getSize(new THREE.Vector3());
  const k = size / Math.max(dim.x, dim.y, dim.z);
  inst.scale.setScalar(k);
  inst.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  const wrap = new THREE.Group();
  wrap.add(inst);
  return wrap;
}
