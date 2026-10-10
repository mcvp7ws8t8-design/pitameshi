// 厨房の設備。コンロ・冷蔵庫・シンク・調理台・レンジフード・壁棚は「3Dキッチン」のモデル(zukan.ts の zukanEquipment)。
// 位置は src/shared/layout.ts の STOVES(調理場)・FRIDGE(冷蔵庫)・PASS(受け渡し窓)と合わせてある。
//  - 調理場: コンロ(焼く・揚げる・茹でる、どれも同じ設備。調理中は天板が光る)と、その間をうめる調理台
//  - 冷蔵庫(2台並べる) / シンク / 右の壁の調理台と壁棚 / 吊り下げの調理器具
//  - 受け渡し窓の上: 注文伝票のレール(注文の数だけ伝票が下がる)

import * as THREE from "three";
import { FRIDGE, STOVES } from "../shared/layout";
import { zukanEquipment } from "./zukan";

export interface KitchenHelpers {
  box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, o?: { cast?: boolean; recv?: boolean; round?: number }): THREE.Mesh;
  cyl(rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg?: number): THREE.Mesh;
  plain(color: number, rough?: number, metal?: number): THREE.MeshStandardMaterial;
  steel(w: number, h: number): THREE.MeshStandardMaterial;
  wood(w: number, h: number): THREE.MeshStandardMaterial;
}

export interface TicketRail {
  /** 伝票を色つきで並べる。色は料理ごとの代表色。数が多いときは先頭から表示する */
  set(slips: { color: number; late: boolean }[]): void;
}

export interface Kitchen {
  /** 調理場ごとの、調理中に光る材質 */
  burners: THREE.MeshStandardMaterial[][];
  /** 冷蔵庫を開け閉めする(E で食材を取ったとき) */
  openFridge(): void;
  /** 毎フレーム呼ぶ(扉の動き) */
  update(dt: number): void;
  rail: TicketRail;
}

/** メッシュを回して返す(add の戻り値は親なので、回す前に作っておく) */
const rotated = <T extends THREE.Object3D>(m: T, x = 0, y = 0, z = 0): T => {
  m.rotation.set(x, y, z);
  return m;
};

const glow = (base: number, emissive: number, rough = 0.4, metal = 0.7) =>
  new THREE.MeshStandardMaterial({ color: base, roughness: rough, metalness: metal, emissive, emissiveIntensity: 0 });

export function buildKitchen(scene: THREE.Scene, h: KitchenHelpers): Kitchen {
  const { box, cyl, plain, steel } = h;
  const darkSteel = plain(0x4a4f56, 0.35, 0.85);
  const rubber = plain(0x1d1d1f, 0.95, 0);
  const burners: THREE.MeshStandardMaterial[][] = [];

  /** 設備1台ぶんの入れ物。前(客側)が +z。壁に沿って並べるので、左の壁の台は回して置く */
  const unit = (x: number, z: number, rotY: number) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    return g;
  };
  const add = (g: THREE.Group, ...m: THREE.Mesh[]) => g.add(...m);
  /** 設備のモデルを置く。sx は幅の伸び縮み(調理台の幅を、すき間に合わせる) */
  const equip = (id: string, x: number, y: number, z: number, rotY = 0, sx = 1) => {
    const o = zukanEquipment(id)!.clone(true);
    o.position.set(x, y, z);
    o.rotation.y = rotY;
    o.scale.set(sx, 1, 1);
    scene.add(o);
    return o;
  };

  // ---- 調理場: コンロ(焼く5・茹でる4)とフライヤー(揚げる2)と、その間の調理台。調理中は天板が光る ----
  const glowOf = { grill: [0x3b3d41, 0xff4a10], fry: [0xb87a14, 0xff4a10], boil: [0x5f9bc4, 0x7ec8ff] } as const;
  STOVES.forEach((s) => {
    const back = s.kind !== "boil";
    const x = back ? s.x : s.x - 0.2;
    const z = back ? s.z - 0.2 : s.z;
    const rotY = back ? 0 : Math.PI / 2;
    const [base, emissive] = glowOf[s.kind];
    const m = glow(base, emissive, s.kind === "fry" ? 0.1 : 0.3, s.kind === "fry" ? 0.1 : 0.4);
    if (s.kind === "fry") {
      // フライヤー: 2つの油槽が、調理中に光る
      equip("fryer", x, 0, z, rotY);
      for (const dx of [-0.25, 0.25]) {
        const oil = box(0.36, 0.012, 0.48, m, x + dx, 0.903, z, { cast: false, recv: false });
        scene.add(oil);
      }
    } else {
      equip("stove", x, 0, z, rotY);
      const disc = cyl(0.17, 0.17, 0.012, m, x, 0.905, z, 28);
      disc.castShadow = false;
      scene.add(disc);
    }
    burners.push([m]);
    if (back) equip("hood", x, 1.75, z); // 奥の壁のコンロには、レンジフード
  });
  // コンロの間の調理台(奥の壁は 2m おき、左の壁は 1.5m おき)
  for (const cx of [-7, -5, -3, -1, 1, 3]) equip("counter", cx, 0, -9.0, 0, 1 / 1.2);
  equip("counter", 4.9, 0, -9.0, 0, 0.7 / 1.2);
  equip("counter", -9.1, 0, -9.0, 0, 1);
  for (const cz of [-3.55, -5.05, -6.55]) equip("counter", -9.2, 0, cz, Math.PI / 2, 0.5 / 1.2);
  equip("counter", -9.2, 0, -8.1, Math.PI / 2, 0.55 / 1.2);

  // ---- 奥の壁: ステンレスの立ち上がり ----
  scene.add(box(14, 0.7, 0.03, steel(6, 1), -2, 1.45, -9.74));
  const red = plain(0xb3261e, 0.45, 0.5);
  scene.add(rotated(cyl(0.025, 0.025, 12.6, red, -2.5, 2.0, -9.6, 8), 0, 0, Math.PI / 2)); // 消火設備の配管

  // ---- 冷蔵庫(2台並べる。E で食材を取ると、扉がゆれる) ----
  const fridges = [-0.5, 0.5].map((dx) => equip("fridge", FRIDGE.x + dx, 0, FRIDGE.z - 0.2));
  let openT = 0;

  // ---- シンクと洗い場(右奥) ----
  equip("sink", 8.5, 0, -9.0);
  for (let k = 0; k < 8; k++) equip("plate", 9.1, 0.9 + k * 0.016, -8.7);
  equip("cardboard_box", 7.5, 0, -9.0, 0.1);

  // ---- 右の壁: 作業台(下は引き出し付きの冷蔵庫)・まな板・オーブン・ワイヤー棚 ----
  const bright = plain(0xc9ced4, 0.28, 0.95);
  for (const cz of [-7.1, -5.9, -4.7, -3.5]) equip("counter", 9.42, 0, cz, -Math.PI / 2);
  // 上に置くもの: オーブン、まな板、包丁、保存容器
  const oven = box(0.8, 0.85, 0.75, steel(1, 1), 9.3, 1.34, -2.95, { round: 0.015 });
  scene.add(oven);
  scene.add(box(0.02, 0.55, 0.55, new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.08, metalness: 0.6 }), 8.89, 1.3, -2.95, { cast: false })); // ガラス扉
  scene.add(box(0.02, 0.16, 0.5, new THREE.MeshStandardMaterial({ color: 0x1a1f24, emissive: 0xff7a1a, emissiveIntensity: 1.2 }), 8.89, 1.66, -2.95, { cast: false })); // 表示部
  scene.add(box(0.03, 0.03, 0.4, bright, 8.87, 1.55, -2.95));
  for (let k = 0; k < 4; k++) equip("cutting_board", 9.3, 0.9, -4.0 - k * 0.8, Math.PI / 2 + (k % 2 ? 0.05 : -0.05));
  equip("knife", 9.3, 0.926, -4.1, 1.1);
  equip("knife_block", 9.55, 0.9, -7.5, -0.4);
  equip("cookbook", 9.3, 0.9, -7.0, 0.3);
  equip("bowl", 9.3, 0.9, -7.8, 0);
  const tubColors = [0xd9453b, 0x6aa83a, 0xe9a23a, 0xf0e6c8];
  for (let k = 0; k < 5; k++) {
    scene.add(box(0.3, 0.1, 0.22, plain(tubColors[k % 4]!, 0.5, 0), 9.62, 0.97, -3.9 - k * 0.55, { round: 0.01 }));
  }
  // 壁棚(2段)。下の段にスパイス瓶
  for (const cz of [-7.3, -6.1, -4.9, -3.7]) for (const y of [1.35, 1.85]) equip("wall_shelf", 9.62, y, cz, -Math.PI / 2);
  for (const cz of [-7.3, -6.1, -4.9, -3.7]) for (let k = 0; k < 4; k++) equip(`spice_jar_${k + 1}`, 9.62, 1.57, cz - 0.4 + k * 0.27);
  // 手洗い用の石けんとペーパータオル
  scene.add(box(0.08, 0.2, 0.06, plain(0xe8eef2, 0.4, 0), 9.85, 1.2, -9.55), box(0.2, 0.28, 0.1, plain(0xc9ced4, 0.3, 0.9), 9.85, 1.5, -9.0));

  // ---- 左の壁: 調理器具を吊るすレール ----
  scene.add(rotated(cyl(0.012, 0.012, 5.0, darkSteel, -9.75, 1.95, -5, 8), Math.PI / 2, 0, 0));
  const hang = [["ladle", 1.52], ["spatula", 1.56], ["spatula", 1.56]] as const;
  for (let k = 0; k < 9; k++) {
    const z = -2.7 - k * 0.5;
    const [id, y] = hang[k % 3]!;
    scene.add(cyl(0.006, 0.006, 0.05, plain(0xbfc4ca, 0.25, 1), -9.75, 1.92, z, 6));
    equip(id, -9.72, y, z, k % 2 ? 0.2 : -0.2);
  }

  // ---- 床: ゴムの足元マット、排水口 ----
  scene.add(box(14, 0.015, 1.0, rubber, -2, 0.008, -7.7, { cast: false }));
  scene.add(box(1.0, 0.015, 5.8, rubber, -7.9, 0.008, -5.2, { cast: false }));
  scene.add(cyl(0.16, 0.16, 0.01, plain(0x7a7f86, 0.4, 0.9), 0, 0.005, -5.4, 20));
  for (let k = -2; k <= 2; k++) scene.add(box(0.22, 0.012, 0.012, plain(0x2a2d31, 0.7, 0.5), 0, 0.012, -5.4 + k * 0.05, { cast: false }));

  // ---- 小物: 消火器、ゴミ箱、時計、受け渡し窓の皿 ----
  scene.add(cyl(0.08, 0.08, 0.45, plain(0xc0302a, 0.4, 0.4), 9.8, 0.35, -9.4, 14), cyl(0.03, 0.03, 0.08, plain(0x2a2a2c, 0.5, 0.5), 9.8, 0.62, -9.4, 8));
  scene.add(cyl(0.2, 0.18, 0.55, plain(0x3a3d42, 0.6, 0.3), 9.5, 0.28, -2.2, 16));
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.5 }));
  clock.rotation.x = Math.PI / 2;
  clock.position.set(-5, 2.7, -1.03);
  scene.add(clock, box(0.012, 0.14, 0.01, plain(0x111111, 0.5, 0), -5, 2.74, -1.06), box(0.1, 0.012, 0.01, plain(0x111111, 0.5, 0), -4.95, 2.7, -1.06));
  for (let k = 0; k < 6; k++) equip("plate", -1.9, 1.04 + k * 0.016, -0.7);

  // ---- 壁のステンレス張り、天井の設備(LED照明・ダクト・配管)、排水溝 ----
  const wallSteel = steel(8, 2);
  for (const [x, z, w, d] of [[-9.745, -5, 0.03, 10], [9.745, -5, 0.03, 10]] as const) {
    scene.add(box(w, 1.1, d, wallSteel, x, 1.35, z, { cast: false }));
  }
  // 仕切りの厨房側もステンレス張り
  scene.add(box(20, 1.0, 0.03, wallSteel, 0, 0.5, -1.015, { cast: false }));
  // 板の継ぎ目
  for (let k = 0; k < 10; k++) {
    for (const x of [-9.725, 9.725]) scene.add(box(0.012, 1.1, 0.012, plain(0x2a2d31, 0.7, 0.4), x, 1.35, -9.5 + k, { cast: false }));
    scene.add(box(0.012, 0.7, 0.012, plain(0x2a2d31, 0.7, 0.4), -9 + k * 2, 1.45, -9.725, { cast: false }));
  }
  const led = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf0f8ff, emissiveIntensity: 2.6 });
  for (const [x, z] of [[-7, -3], [-2, -3], [3, -3], [7, -3], [-7, -6.5], [-2, -6.5], [3, -6.5], [7, -6.5]] as const) {
    scene.add(box(1.6, 0.03, 0.22, led, x, 3.17, z, { cast: false }));
  }
  // ダクトと配管(フードから天井、横へ)
  const duct = steel(4, 1);
  scene.add(box(0.9, 0.55, 8.5, duct, 4.2, 2.95, -5.2, { cast: false }), box(13.6, 0.55, 0.9, duct, -2, 2.95, -9.2, { cast: false }));
  scene.add(rotated(cyl(0.05, 0.05, 6, plain(0xb7bcc2, 0.35, 0.9), -3, 3.05, -2.4, 10), 0, 0, Math.PI / 2));
  scene.add(rotated(cyl(0.03, 0.03, 5, plain(0xb3261e, 0.45, 0.5), -3, 3.0, -2.6, 8), 0, 0, Math.PI / 2));
  // 床の排水溝(ステンレスの格子ぶた)
  scene.add(box(15, 0.012, 0.18, plain(0x8f949b, 0.35, 0.95), 0, 0.007, -5.4, { cast: false }));
  for (let k = -36; k <= 36; k++) scene.add(box(0.015, 0.014, 0.16, plain(0x2a2d31, 0.7, 0.5), k * 0.2, 0.008, -5.4, { cast: false }));
  // 移動式のトレー棚(天板の保存容器やトレーを載せる)
  const rollRack = unit(-9.1, -1.55, 0);
  for (const dx of [-0.25, 0.25]) for (const dz of [-0.2, 0.2]) add(rollRack, cyl(0.015, 0.015, 1.6, bright, dx, 0.8, dz, 8));
  for (let k = 0; k < 6; k++) {
    add(rollRack, box(0.56, 0.015, 0.46, bright, 0, 0.25 + k * 0.25, 0, { cast: false }));
    add(rollRack, box(0.5, 0.03, 0.4, plain(k % 2 ? 0x2a2d31 : 0xb8bdc4, 0.4, 0.85), 0, 0.28 + k * 0.25, 0, { cast: false }));
  }

  // ---- 受け渡し窓の上: 注文伝票のレール ----
  scene.add(box(2.9, 0.025, 0.03, darkSteel, 0, 2.62, -1.04));
  const slipM = [0, 1].map((late) => new THREE.MeshStandardMaterial({ color: late ? 0xffd9d0 : 0xfff6dc, roughness: 0.85, side: THREE.DoubleSide }));
  const slips: { paper: THREE.Mesh; stripe: THREE.Mesh; stripeM: THREE.MeshStandardMaterial }[] = [];
  for (let k = 0; k < 14; k++) {
    const g = new THREE.Group();
    g.position.set(-1.35 + k * 0.207, 2.5, -1.05);
    g.rotation.z = ((k * 37) % 7 - 3) * 0.012;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.2), slipM[0]);
    const stripeM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide });
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.04), stripeM);
    stripe.position.set(0, 0.08, 0.001);
    g.add(paper, stripe);
    g.visible = false;
    g.rotation.y = Math.PI; // 厨房側(+z)を向ける
    scene.add(g);
    slips.push({ paper, stripe, stripeM });
  }
  const ticketRail: TicketRail = {
    set(list) {
      slips.forEach((s, k) => {
        const slip = list[k];
        s.paper.parent!.visible = !!slip;
        if (!slip) return;
        s.stripeM.color.setHex(slip.color);
        s.paper.material = slipM[slip.late ? 1 : 0]!;
      });
    },
  };

  return {
    burners,
    openFridge() {
      openT = 1.2;
    },
    update(dt: number) {
      // 取ったとき、冷蔵庫が少しゆれる
      if (openT > 0) openT = Math.max(0, openT - dt);
      const wobble = Math.sin(openT * 30) * Math.min(1, openT / 0.4) * 0.03;
      for (const f of fridges) f.rotation.y = wobble;
    },
    rail: ticketRail,
  };
}
