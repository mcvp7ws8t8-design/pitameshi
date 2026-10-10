// ホールの右奥の角にある、バーカウンター。ドリンクはここで作る。
// 手前(お客さん側)のカウンターにスツール、奥(厨房との仕切りの壁ぎわ)にバックバー(ビールサーバー・エスプレッソマシン・氷・ボトル棚)。
// ホールは、手前のカウンターとバックバーの間に入って作る(BARS のとおり、z≒1.2)。
// 位置は src/shared/layout.ts の BARS・BAR_COUNTER・BAR_STOOLS と合わせてある。

import * as THREE from "three";
import { BAR_COUNTER, BAR_STOOLS, BARS } from "../shared/layout";
import { chalkboard } from "./textures";

export interface BarHelpers {
  box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, o?: { cast?: boolean; recv?: boolean; round?: number }): THREE.Mesh;
  cyl(rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg?: number): THREE.Mesh;
  plain(color: number, rough?: number, metal?: number): THREE.MeshStandardMaterial;
  steel(w: number, h: number): THREE.MeshStandardMaterial;
}

/** バックバーの天板の高さ(ドリンクを置く高さ)。view.ts でも使う */
export const BACKBAR_TOP = 0.95;
/** バックバーの前に置くドリンクの位置(奥行き) */
export const BACKBAR_Z = 0.47;

export function buildBar(scene: THREE.Scene, h: BarHelpers): void {
  const { box, cyl, plain, steel } = h;
  const walnut = plain(0x3b2416, 0.4, 0.05);
  const oak = plain(0x9a6a3e, 0.55, 0);
  const brass = plain(0xc9a24a, 0.25, 1);
  const black = plain(0x1c1c1e, 0.5, 0.3);
  const leather = plain(0x8a2a22, 0.5, 0);
  const steelM = plain(0xc5c9cc, 0.3, 0.9);

  const cx = (BAR_COUNTER.x0 + BAR_COUNTER.x1) / 2;
  const w = BAR_COUNTER.x1 - BAR_COUNTER.x0;
  const cz = (BAR_COUNTER.z0 + BAR_COUNTER.z1) / 2;
  const d = BAR_COUNTER.z1 - BAR_COUNTER.z0;

  // ---- 手前のカウンター(お客さん側) ----
  scene.add(box(w, 0.96, d, oak, cx, 0.48, cz, { round: 0.01 }));
  scene.add(box(w + 0.1, 0.06, d + 0.12, walnut, cx, 1.0, cz, { round: 0.02 })); // 天板(手前に少しはみ出す)
  // 前の面の羽目板
  for (let k = 0; k < Math.floor(w / 0.18); k++) {
    scene.add(box(0.1, 0.8, 0.02, plain(k % 2 ? 0x7a4a2a : 0x8a5a34, 0.5, 0), BAR_COUNTER.x0 + 0.12 + k * 0.18, 0.5, BAR_COUNTER.z1 + 0.01, { cast: false }));
  }
  // 足置きの真鍮のレール
  const railZ = BAR_COUNTER.z1 + 0.14;
  const rail = cyl(0.025, 0.025, w - 0.2, brass, cx, 0.25, railZ, 12);
  rail.rotation.z = Math.PI / 2;
  scene.add(rail);
  for (const x of [BAR_COUNTER.x0 + 0.2, cx, BAR_COUNTER.x1 - 0.2]) scene.add(cyl(0.015, 0.015, 0.25, brass, x, 0.125, railZ - 0.06, 8));
  // スツール
  for (const s of BAR_STOOLS) {
    scene.add(cyl(0.17, 0.17, 0.07, leather, s.x, 0.72, s.z, 20));
    scene.add(cyl(0.025, 0.025, 0.62, black, s.x, 0.36, s.z, 10));
    scene.add(cyl(0.2, 0.2, 0.025, black, s.x, 0.015, s.z, 20));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 20), brass);
    ring.position.set(s.x, 0.27, s.z);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
  }
  // ペンダントライト(カウンターの上)
  const lampM = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc063, emissiveIntensity: 2.2, roughness: 0.4 });
  for (const x of [cx - 0.9, cx, cx + 0.9]) {
    scene.add(cyl(0.004, 0.004, 1.0, black, x, 2.7, cz, 6));
    scene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 0.2, 20, 1, true), plain(0x2a2a2c, 0.4, 0.6)).translateX(x).translateY(2.12).translateZ(cz));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), lampM).translateX(x).translateY(2.08).translateZ(cz));
  }

  // ---- バックバー(奥の仕切りの壁ぎわ) ----
  const bx = cx;
  scene.add(box(w, 0.9, 0.55, oak, bx, 0.45, 0.475, { round: 0.008 }));
  for (let k = 0; k < 6; k++) scene.add(box(w / 6 - 0.04, 0.7, 0.015, plain(0x6a4224, 0.5, 0), BAR_COUNTER.x0 + (k + 0.5) * (w / 6), 0.46, 0.76, { cast: false })); // 扉
  scene.add(box(w + 0.04, 0.05, 0.62, steelM, bx, 0.925, 0.47, { round: 0.008 })); // ステンレスの天板
  // ビールサーバー(タワーに3本のハンドル)
  const tapX = BAR_COUNTER.x0 + 0.45;
  scene.add(box(0.5, 0.03, 0.3, black, tapX, 0.955, BACKBAR_Z, { cast: false })); // 受け皿
  scene.add(box(0.1, 0.4, 0.1, steelM, tapX, 1.15, 0.3));
  for (const dx of [-0.12, 0, 0.12]) {
    scene.add(cyl(0.012, 0.014, 0.1, steelM, tapX + dx, 1.12, 0.42, 8));
    scene.add(box(0.025, 0.14, 0.025, plain([0x7e2f2f, 0x2f5f3a, 0x2f3f7e][Math.round(dx * 8.3) + 1]!, 0.4, 0), tapX + dx, 1.3, 0.42));
  }
  scene.add(cyl(0.01, 0.01, 0.28, steelM, tapX, 1.42, 0.38, 6).rotateX(Math.PI / 2));
  // エスプレッソマシン
  const espX = BAR_COUNTER.x0 + 1.55;
  scene.add(box(0.62, 0.42, 0.5, plain(0xb8bdc4, 0.25, 0.95), espX, 1.16, 0.34, { round: 0.02 }));
  scene.add(box(0.64, 0.06, 0.52, black, espX, 1.4, 0.34, { round: 0.015 }));
  scene.add(box(0.54, 0.02, 0.28, steelM, espX, 0.965, 0.52)); // カップ置き
  for (const dx of [-0.17, 0.17]) {
    scene.add(cyl(0.04, 0.04, 0.05, black, espX + dx, 1.07, 0.56, 14));
    scene.add(box(0.03, 0.03, 0.14, black, espX + dx, 1.06, 0.66));
    scene.add(cyl(0.015, 0.015, 0.06, steelM, espX + dx, 1.02, 0.56, 8));
  }
  scene.add(cyl(0.03, 0.03, 0.2, steelM, espX + 0.36, 1.1, 0.5, 8).rotateZ(0.5)); // スチームのノズル
  // 氷のビン(ステンレス)・ソーダガン・グラスのラック
  const iceX = BAR_COUNTER.x1 - 0.5;
  scene.add(box(0.5, 0.14, 0.4, steelM, iceX, 1.0, 0.45, { round: 0.01 }));
  scene.add(box(0.44, 0.02, 0.34, plain(0xcfeaf5, 0.1, 0.1), iceX, 1.075, 0.45, { cast: false }));
  for (let k = 0; k < 6; k++) scene.add(box(0.08, 0.06, 0.08, plain(0xe6f6fc, 0.05, 0), iceX - 0.15 + (k % 3) * 0.12, 1.1 + Math.floor(k / 3) * 0.05, 0.4 + (k % 2) * 0.08, { cast: false }));
  scene.add(box(0.28, 0.2, 0.04, black, iceX - 0.5, 1.1, 0.25));
  const glassM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.3 });
  for (let k = 0; k < 5; k++) scene.add(cyl(0.04, 0.032, 0.13, glassM, BAR_COUNTER.x0 + 2.0 + k * 0.1, 1.0, 0.62, 12)); // ふせたグラス

  // ---- ボトル棚(壁に2段) ----
  const wall = steel(2, 1);
  void wall;
  for (const y of [1.5, 1.9]) scene.add(box(w, 0.04, 0.22, walnut, bx, y, 0.12));
  const colors = [0x2f6b3a, 0x8a5a2b, 0x8a1a2e, 0xcfe8f5, 0xe9b43a, 0x2b4a7a, 0xf4f1e6, 0x6a2a6a];
  for (let k = 0; k < 15; k++) {
    const x = BAR_COUNTER.x0 + 0.15 + k * ((w - 0.3) / 14);
    const m = new THREE.MeshStandardMaterial({ color: colors[k % colors.length]!, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
    for (const y of [1.5, 1.9]) {
      scene.add(cyl(0.04, 0.04, 0.22, m, x, y + 0.13, 0.12, 12), cyl(0.014, 0.02, 0.1, m, x, y + 0.29, 0.12, 8));
    }
  }
  // 看板
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), new THREE.MeshBasicMaterial({ map: chalkboard(["BAR"]), toneMapped: false }));
  sign.position.set(cx, 2.6, 0.02);
  scene.add(sign);
  void BARS;
}
