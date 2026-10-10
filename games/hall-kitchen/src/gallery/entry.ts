// モデル図鑑。食材(生・調理後)・料理・ドリンクを、並べて回しながら見られる。
// ゲームと同じ形(src/client/items.ts)を使うので、見えるものがそのままゲームの中の姿。

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DISHES, DRINKS, INGREDIENTS, METHOD_NAME } from "../shared/menu";
import { preloadFood } from "../client/food";
import { dishHasModel, drinkHasModel, ingredientHasModel, makeDish, makeDrink, makeIngredient } from "../client/items";

type Tab = "raw" | "cooked" | "dish" | "drink";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x17120f);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.2;
scene.add(new THREE.HemisphereLight(0xfff3e0, 0x6a5a48, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(2, 4, 3);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;

function label(text: string, sub: string, fromModel: boolean): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.fillStyle = "#f6ecda";
  let px = 44;
  ctx.font = `bold ${px}px sans-serif`;
  while (ctx.measureText(text).width > 360 && px > 20) ctx.font = `bold ${(px -= 2)}px sans-serif`;
  ctx.fillText(text, 192, 52);
  ctx.fillStyle = fromModel ? "#6ec27a" : "#e3b64a";
  ctx.font = "30px sans-serif";
  ctx.fillText(sub, 192, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.scale.set(0.5, 0.1667, 1);
  return s;
}

interface Entry {
  name: string;
  sub: string;
  model: boolean;
  make: () => THREE.Group;
  scale: number;
}

const entries: Record<Tab, () => Entry[]> = {
  raw: () => INGREDIENTS.map((x, i) => ({ name: x.name, sub: `${METHOD_NAME[x.method]}・${x.cook}秒`, model: ingredientHasModel(i), make: () => makeIngredient(i, false), scale: 3.0 })),
  cooked: () => INGREDIENTS.map((x, i) => ({ name: x.name, sub: `${METHOD_NAME[x.method]}・${x.cook}秒`, model: ingredientHasModel(i), make: () => makeIngredient(i, true), scale: 3.0 })),
  dish: () => DISHES.map((d, i) => ({ name: d.name, sub: d.parts.map((p) => INGREDIENTS[p]!.name).join("・"), model: dishHasModel(i) || d.parts.every((p) => ingredientHasModel(p)), make: () => makeDish(i), scale: 1.9 })),
  drink: () => DRINKS.map((d, i) => ({ name: d.name, sub: `作る${d.make}秒`, model: drinkHasModel(i), make: () => makeDrink(i), scale: 2.8 })),
};

let spinners: THREE.Object3D[] = [];
let stage = new THREE.Group();
scene.add(stage);

function show(tab: Tab) {
  scene.remove(stage);
  stage = new THREE.Group();
  scene.add(stage);
  spinners = [];
  const list = entries[tab]();
  const cols = tab === "dish" || tab === "drink" ? 5 : 8;
  const gap = tab === "dish" ? 0.9 : tab === "drink" ? 0.75 : 0.6;
  const rows = Math.ceil(list.length / cols);
  list.forEach((e, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = (col - (cols - 1) / 2) * gap;
    const z = (row - (rows - 1) / 2) * gap * 1.35;
    const holder = new THREE.Group();
    holder.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(gap * 0.4, gap * 0.42, 0.02, 40), new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.8 }));
    base.position.y = -0.01;
    holder.add(base);
    const item = e.make();
    item.scale.setScalar(e.scale);
    const spin = new THREE.Group();
    spin.add(item);
    holder.add(spin);
    spinners.push(spin);
    const tag = label(e.name, e.sub, e.model);
    tag.position.set(0, 0.0, gap * 0.52);
    tag.scale.multiplyScalar(gap > 0.7 ? 1.25 : 1.0);
    holder.add(tag);
    stage.add(holder);
  });
  // 全体が収まる距離にカメラを置く
  const w = cols * gap;
  const d = rows * gap * 1.35;
  const dist = Math.max(w / camera.aspect, d * 1.5) * 0.95 + 0.4;
  camera.position.set(0, dist * 0.85, dist * 0.6);
  controls.target.set(0, 0.05, 0.1);
  controls.update();
  for (const b of document.querySelectorAll<HTMLButtonElement>("#tabs button")) b.setAttribute("aria-pressed", String(b.dataset.tab === tab));
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

let current: Tab = "raw";
for (const b of document.querySelectorAll<HTMLButtonElement>("#tabs button")) {
  b.onclick = () => {
    current = b.dataset.tab as Tab;
    show(current);
  };
}

const initial = (new URLSearchParams(location.search).get("tab") as Tab | null) ?? "raw";
preloadFood().then(() => {
  document.getElementById("status")!.hidden = true;
  current = initial;
  show(current);
  (window as unknown as { __ready: boolean }).__ready = true;
});

renderer.setAnimationLoop((now) => {
  const t = now / 1000;
  spinners.forEach((s, i) => (s.rotation.y = t * 0.7 + i * 0.5));
  controls.update();
  renderer.render(scene, camera);
});
