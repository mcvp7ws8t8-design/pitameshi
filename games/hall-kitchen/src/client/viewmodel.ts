// 一人称の手元。自分の腕と、運んでいるもの(トレーに載せる。ホールは料理とドリンク、キッチンは食材)。
// 壁に近づいても手がめり込まないよう、別のシーンに分けて重ねて描く。

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Role } from "../shared/room";
import { makeDish, makeDrink, makeIngredient } from "./items";

export interface Held {
  kind: "food" | "drink" | "ing";
  item: number; // 料理・ドリンク・食材の番号
  cooked?: boolean; // 食材のとき、調理済みか
  cut?: boolean; // 食材のとき、切ってあるか
}

const sleeve = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.8 });
const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac86, roughness: 0.6 });

/** from から to へ伸びる腕(カプセル) */
function limb(from: THREE.Vector3, to: THREE.Vector3, r: number): THREE.Mesh {
  const len = from.distanceTo(to);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 4, 10), sleeve);
  m.position.copy(from).add(to).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return m;
}

export class ViewModel {
  readonly scene = new THREE.Scene();
  private group = new THREE.Group();
  private items = new THREE.Group();
  private tray: THREE.Object3D;
  private arms = new THREE.Group();
  private key = "";
  private role: Role = "hall";
  private bob = 0;

  constructor(env: THREE.Texture | null) {
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.5;
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x7a5a3a, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.5, 1, 0.8);
    this.scene.add(sun);
    this.tray = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.02, 0.3, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.3, metalness: 0.85 }));
    this.tray.position.set(0, -0.31, -0.55);
    this.tray.rotation.x = 0.08;
    this.group.add(this.tray, this.items, this.arms);
    this.scene.add(this.group);
    this.setRole("hall");
  }

  setRole(role: Role) {
    this.role = role;
    this.key = "";
    this.tray.visible = true;
    this.arms.clear();
    // 手の位置。ホールはトレーの両端、キッチンは体の前
    const hands: [number, number, number][] = [[-0.2, -0.32, -0.55], [0.2, -0.32, -0.55]];
    hands.forEach(([x, y, z], i) => {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), skin);
      hand.position.set(x, y, z);
      const shoulder = new THREE.Vector3(i ? 0.34 : -0.34, -0.55, 0.05);
      this.arms.add(hand, limb(shoulder, new THREE.Vector3(x, y - 0.01, z + 0.02), 0.05));
    });
  }

  /** 素材が読み込めたときに、作り直してもらう */
  invalidate() {
    this.key = "\0";
  }

  /** 持っているものを台の上に並べる。変わったときだけ作り直す */
  setHeld(held: Held[]) {
    const key = held.map((h) => `${h.kind}${h.item}${h.cooked ? "c" : ""}${h.cut ? "k" : ""}`).join(",");
    if (key === this.key) return;
    this.key = key;
    this.items.clear();
    const trayPos: [number, number][] = [[-0.1, -0.07], [0.1, -0.07], [-0.1, 0.07], [0.1, 0.07]];
    held.slice(0, 4).forEach((h, i) => {
      const o = h.kind === "food" ? makeDish(h.item) : h.kind === "drink" ? makeDrink(h.item) : makeIngredient(h.item, !!h.cooked, !!h.cut);
      o.traverse((c) => ((c as THREE.Mesh).castShadow = false));
      o.scale.setScalar(h.kind === "ing" ? 1.1 : 0.6);
      o.position.set(trayPos[i]![0], -0.295, -0.55 + trayPos[i]![1]);
      this.items.add(o);
    });
  }

  /** カメラに合わせて置く。speed は歩く速さ(m/s) */
  update(camera: THREE.Camera, time: number, speed: number) {
    const k = Math.min(1, speed / 3);
    this.bob += (k - this.bob) * 0.1;
    this.group.position.copy(camera.position);
    this.group.quaternion.copy(camera.quaternion);
    this.group.translateY(Math.sin(time * 9) * 0.008 * this.bob);
    this.group.translateX(Math.cos(time * 4.5) * 0.006 * this.bob);
  }
}
