// 厨房の設備。業務用の厨房に近い形で作る。
// 位置は src/shared/layout.ts の STOVES(調理場)・FRIDGE(冷蔵庫)・PASS(受け渡し窓)と合わせてある。
//  - 焼く: 鉄板焼き台(フラットトップ) / 揚げる: 2槽のフライヤー / 茹でる: 寸胴の茹で麺機
//  - 冷蔵庫: 両開きのリーチイン(開けると中の棚が見える) / シンク / 作業台 / 棚 / 吊り下げの調理器具
//  - 受け渡し窓の上: 注文伝票のレール(注文の数だけ伝票が下がる)

import * as THREE from "three";
import { FRIDGE, STOVES } from "../shared/layout";

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
  const knobM = plain(0x1c1c1e, 0.5, 0.2);
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
  const knobs = (g: THREE.Group, n: number, w: number, y: number, z: number) => {
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + (w / (n + 1)) * (k + 1);
      const knob = cyl(0.028, 0.03, 0.04, knobM, x, y, z, 12);
      knob.rotation.x = Math.PI / 2;
      add(g, knob);
    }
  };
  /** キャビネット(両開きの扉・取っ手・足) */
  const cabinet = (g: THREE.Group, w: number, d: number, topY = 0.86) => {
    add(g, box(w, topY - 0.12, d, steel(w, 1), 0, 0.12 + (topY - 0.12) / 2, 0, { round: 0.008 }));
    add(g, box(w + 0.01, 0.06, d + 0.01, plain(0x2a2d31, 0.5, 0.6), 0, 0.06, 0)); // 台座
    const doorW = w / 2 - 0.05;
    for (const s of [-1, 1]) {
      add(g, box(doorW, topY - 0.34, 0.015, darkSteel, s * (w / 4), 0.4, d / 2 + 0.002));
      add(g, box(0.02, 0.18, 0.025, plain(0xbfc4ca, 0.25, 1), s * 0.04, 0.45, d / 2 + 0.02));
    }
  };

  STOVES.forEach((s) => {
    const mats: THREE.MeshStandardMaterial[] = [];
    if (s.kind === "grill") {
      // 鉄板焼き台。厚い鉄板、うしろの立ち上がり、手前の油受け
      const g = unit(s.x, s.z, 0);
      cabinet(g, 1.8, 0.95);
      const plate = glow(0x3b3d41, 0xff4a10, 0.45, 0.8);
      mats.push(plate);
      add(g, box(1.72, 0.04, 0.8, plate, 0, 0.9, -0.02, { recv: false }));
      add(g, box(1.8, 0.02, 0.04, darkSteel, 0, 0.93, 0.4)); // 油受けの縁
      add(g, box(1.8, 0.4, 0.05, steel(2, 1), 0, 1.1, -0.45)); // うしろの立ち上がり
      add(g, box(0.04, 0.12, 0.8, darkSteel, -0.88, 0.95, -0.02), box(0.04, 0.12, 0.8, darkSteel, 0.88, 0.95, -0.02));
      add(g, box(1.8, 0.1, 0.06, plain(0x1e2023, 0.5, 0.7), 0, 0.8, 0.5)); // 操作パネル
      knobs(g, 5, 1.6, 0.8, 0.54);
      // 鉄板の上のへら
      add(g, box(0.18, 0.005, 0.12, plain(0xbfc4ca, 0.25, 1), 0.55, 0.925, 0.25));
    } else if (s.kind === "fry") {
      // 2槽のフライヤー。油の面、持ち上げたフライバスケット、うしろの飛びはね板
      const g = unit(s.x, s.z, 0);
      cabinet(g, 1.8, 0.9);
      add(g, box(1.8, 0.04, 0.9, darkSteel, 0, 0.88, 0));
      for (const sx of [-1, 1]) {
        const oil = glow(0xb87a14, 0xff4a10, 0.1, 0.1);
        mats.push(oil);
        add(g, box(0.72, 0.03, 0.55, plain(0x9aa0a7, 0.3, 0.9), sx * 0.45, 0.9, 0.0));
        add(g, box(0.64, 0.02, 0.47, oil, sx * 0.45, 0.915, 0.0, { recv: false }));
        // 手前に傾けて掛けたバスケット
        const basket = box(0.4, 0.12, 0.34, plain(0x55595f, 0.5, 0.9), sx * 0.45, 1.12, -0.2, { recv: false });
        basket.rotation.x = 0.12;
        add(g, basket);
        const handle = cyl(0.012, 0.012, 0.5, plain(0x222222, 0.6, 0.3), sx * 0.45, 1.2, 0.05, 8);
        handle.rotation.x = Math.PI / 2 - 0.2;
        add(g, handle);
      }
      add(g, rotated(cyl(0.012, 0.012, 1.7, darkSteel, 0, 1.3, -0.3, 8), 0, 0, Math.PI / 2));
      add(g, box(1.8, 0.45, 0.04, steel(2, 1), 0, 1.1, -0.43));
      add(g, box(1.8, 0.1, 0.06, plain(0x1e2023, 0.5, 0.7), 0, 0.8, 0.48));
      knobs(g, 4, 1.5, 0.8, 0.52);
    } else {
      // 茹で麺機。大きな寸胴、吊るした網かご、鍋に水を入れる蛇口
      const g = unit(s.x, s.z, Math.PI / 2);
      cabinet(g, 1.4, 0.95);
      add(g, box(1.4, 0.04, 0.95, darkSteel, 0, 0.88, 0));
      const water = glow(0x5f9bc4, 0x7ec8ff, 0.06, 0.05);
      mats.push(water);
      add(g, cyl(0.4, 0.4, 0.2, plain(0xaab0b7, 0.28, 0.9), 0, 0.8, 0.0, 32)); // 寸胴(天板に埋まっている)
      add(g, cyl(0.37, 0.37, 0.012, water, 0, 0.935, 0, 32));
      add(g, cyl(0.42, 0.42, 0.025, plain(0xbfc4ca, 0.25, 1), 0, 0.915, 0, 32));
      // 吊るした網かご
      for (const sx of [-0.28, 0.28]) {
        add(g, cyl(0.09, 0.08, 0.2, plain(0x777c83, 0.5, 0.9), sx, 1.18, -0.36, 14));
        add(g, rotated(cyl(0.008, 0.008, 0.3, darkSteel, sx, 1.1, -0.28, 6), Math.PI / 2 - 0.6, 0, 0));
      }
      add(g, rotated(cyl(0.012, 0.012, 1.2, darkSteel, 0, 1.3, -0.4, 8), 0, 0, Math.PI / 2));
      // 蛇口(パイプが壁から出て、鍋の上で下を向く)
      add(g, cyl(0.016, 0.016, 0.9, plain(0xbfc4ca, 0.2, 1), 0, 1.35, -0.46, 10));
      add(g, rotated(cyl(0.016, 0.016, 0.5, plain(0xbfc4ca, 0.2, 1), 0, 1.78, -0.22, 10), Math.PI / 2, 0, 0));
      add(g, cyl(0.016, 0.016, 0.12, plain(0xbfc4ca, 0.2, 1), 0, 1.72, 0.03, 10));
      add(g, box(1.4, 0.1, 0.06, plain(0x1e2023, 0.5, 0.7), 0, 0.8, 0.5));
      knobs(g, 3, 1.2, 0.8, 0.54);
    }
    burners.push(mats);
  });

  // ---- 奥の壁: ステンレスの立ち上がり、フード(油こしフィルター)、消火設備 ----
  scene.add(box(14, 0.7, 0.03, steel(6, 1), -2, 1.45, -9.8));
  const hoodX = -2.5;
  scene.add(box(13, 0.5, 1.3, steel(6, 1), hoodX, 2.35, -9.2, { round: 0.02 }), box(1.1, 0.9, 1.1, steel(1, 1), hoodX, 2.95, -9.2));
  for (let k = 0; k < 13; k++) {
    // フードの下に並ぶ油こしフィルター
    scene.add(box(0.86, 0.02, 0.9, plain(0x7e838a, 0.45, 0.9), hoodX - 6 + k, 2.095, -9.2, { cast: false }));
  }
  const red = plain(0xb3261e, 0.45, 0.5);
  scene.add(rotated(cyl(0.025, 0.025, 12.6, red, hoodX, 2.0, -9.6, 8), 0, 0, Math.PI / 2));
  for (const dx of [-5, -1.5, 2, 5]) scene.add(cyl(0.012, 0.012, 0.2, plain(0xbfc4ca, 0.3, 1), hoodX + dx, 1.9, -9.55, 6));

  // ---- 冷蔵庫(両開き。中の棚が見える) ----
  const fx = FRIDGE.x;
  const fz = FRIDGE.z;
  const fridge = unit(fx, fz, 0);
  const fw = 2.0;
  const fd = 0.85;
  add(fridge, box(0.05, 1.95, fd, steel(1, 2), -fw / 2 + 0.025, 0.975, 0), box(0.05, 1.95, fd, steel(1, 2), fw / 2 - 0.025, 0.975, 0));
  add(fridge, box(fw, 0.05, fd, steel(2, 1), 0, 1.925, 0), box(fw, 0.12, fd, plain(0x2a2d31, 0.5, 0.6), 0, 0.06, 0));
  add(fridge, box(fw - 0.1, 1.8, 0.04, plain(0xdfe5ea, 0.4, 0.2), 0, 1.0, -fd / 2 + 0.03)); // 内側の壁
  const tubM = (c: number) => plain(c, 0.5, 0);
  const contents = [0xd9453b, 0x6aa83a, 0xe9a23a, 0xf4e6c8, 0xb8761f, 0xe9a7a0, 0x4a8a3a, 0xe9772a];
  for (let row = 0; row < 4; row++) {
    const y = 0.35 + row * 0.42;
    add(fridge, box(fw - 0.12, 0.02, fd - 0.1, plain(0xaab0b7, 0.35, 0.9), 0, y, 0.0, { recv: false }));
    for (let k = 0; k < 4; k++) {
      const tub = box(0.34, 0.2, 0.55, tubM(contents[(row * 4 + k) % contents.length]!), -0.72 + k * 0.48, y + 0.11, 0.0, { recv: false, round: 0.02 });
      add(fridge, tub);
      add(fridge, box(0.34, 0.015, 0.55, plain(0xe8eef2, 0.4, 0), -0.72 + k * 0.48, y + 0.215, 0.0, { cast: false }));
    }
  }
  // 扉(外の縁にヒンジ)。開けると手前に回る
  const doorM = steel(1, 2);
  const makeDoor = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (fw / 2 - 0.02), 0, fd / 2);
    const door = box(fw / 2 - 0.03, 1.88, 0.07, doorM, -side * (fw / 4 - 0.015), 1.0, 0.0, { round: 0.01 });
    const gasket = box(fw / 2 - 0.08, 1.8, 0.01, plain(0x222426, 0.9, 0), -side * (fw / 4 - 0.015), 1.0, -0.04, { cast: false });
    const handle = box(0.03, 0.7, 0.05, plain(0xc4c9cf, 0.2, 1), -side * 0.06, 1.0, 0.07);
    pivot.add(door, gasket, handle);
    fridge.add(pivot);
    return pivot;
  };
  const doorL = makeDoor(-1);
  const doorR = makeDoor(1);
  const display = box(0.16, 0.05, 0.02, new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x33ff66, emissiveIntensity: 1.6 }), 0, 1.86, fd / 2 + 0.05, { cast: false });
  fridge.add(display);
  let openT = 0;

  // ---- シンクと洗い場(右奥) ----
  const sink = unit(8.5, -8.8, 0);
  add(sink, box(2, 0.86, 1, steel(2, 1), 0, 0.43, 0, { round: 0.008 }), box(2.02, 0.04, 1.02, steel(2, 1), 0, 0.88, 0));
  for (const sx of [-0.45, 0.45]) add(sink, box(0.75, 0.02, 0.6, plain(0x6d737a, 0.25, 0.9), sx, 0.9, 0.0, { recv: false }));
  add(sink, cyl(0.016, 0.016, 0.5, plain(0xbfc4ca, 0.2, 1), 0, 1.12, -0.38, 10));
  add(sink, rotated(cyl(0.014, 0.014, 0.3, plain(0xbfc4ca, 0.2, 1), 0, 1.36, -0.25, 10), Math.PI / 2, 0, 0));
  add(sink, cyl(0.012, 0.012, 0.45, plain(0x333333, 0.6, 0.3), 0.12, 1.2, -0.38, 6)); // 洗浄用シャワーのホース
  // 皿とラック
  for (let k = 0; k < 8; k++) add(sink, cyl(0.12, 0.1, 0.018, plain(0xf6f6f2, 0.25, 0), 0.65, 0.92 + k * 0.02, 0.15, 20));

  // ---- 右の壁: 作業台(まな板・包丁・保存容器)と棚 ----
  scene.add(box(1.0, 0.86, 4.8, steel(2, 3), 9.4, 0.43, -5, { round: 0.008 }), box(1.04, 0.05, 4.84, steel(3, 2), 9.4, 0.89, -5));
  scene.add(box(0.9, 0.02, 4.6, plain(0x9aa0a7, 0.35, 0.9), 9.4, 0.3, -5, { recv: false })); // 下段の棚
  const boards = [0xf2f0ea, 0xe8c77a, 0x7fae6a, 0xd9867a];
  boards.forEach((c, k) => {
    scene.add(box(0.42, 0.025, 0.6, plain(c, 0.7, 0), 9.3, 0.93, -3.2 - k * 0.8));
  });
  scene.add(box(0.03, 0.018, 0.3, plain(0xc4c9cf, 0.2, 1), 9.28, 0.96, -3.3));
  scene.add(box(0.025, 0.02, 0.13, plain(0x2a2a2c, 0.6, 0.1), 9.28, 0.96, -3.52));
  const tubColors = [0xd9453b, 0x6aa83a, 0xe9a23a, 0xf0e6c8];
  for (let k = 0; k < 6; k++) {
    scene.add(box(0.3, 0.1, 0.22, plain(tubColors[k % 4]!, 0.5, 0), 9.62, 0.97, -3.0 - k * 0.55, { round: 0.01 }));
  }
  // 壁の棚: 保存容器と鍋
  scene.add(box(0.4, 0.04, 4.8, h.wood(2, 1), 9.7, 1.75, -5), box(0.4, 0.04, 4.8, h.wood(2, 1), 9.7, 2.3, -5));
  for (let k = 0; k < 7; k++) {
    const z = -7.2 + k * 0.66;
    const potM = plain([0xb8bdc4, 0x8a8f96, 0xc9a24a, 0x6a6e75][k % 4]!, 0.3, 0.9);
    scene.add(cyl(0.14, 0.12, 0.16, potM, 9.7, 1.85, z, 18), cyl(0.12, 0.1, 0.14, potM, 9.7, 2.4, z, 18));
    scene.add(box(0.28, 0.14, 0.24, plain([0xe9a23a, 0xe9e3d2, 0xb8d9a0][k % 3]!, 0.5, 0), 9.7, 2.0 + 0.0, z - 0.3, { round: 0.01 }));
  }

  // ---- 左の壁: 調理器具を吊るすレール ----
  scene.add(rotated(cyl(0.012, 0.012, 5.0, darkSteel, -9.75, 1.95, -5, 8), Math.PI / 2, 0, 0));
  for (let k = 0; k < 9; k++) {
    const z = -2.7 - k * 0.5;
    const metal = plain(0xbfc4ca, 0.25, 1);
    scene.add(cyl(0.006, 0.006, 0.05, metal, -9.75, 1.92, z, 6));
    if (k % 3 === 0) {
      // お玉
      scene.add(cyl(0.008, 0.008, 0.4, metal, -9.75, 1.7, z, 6));
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xbfc4ca, roughness: 0.25, metalness: 1, side: THREE.DoubleSide }));
      bowl.position.set(-9.75, 1.5, z);
      scene.add(bowl);
    } else if (k % 3 === 1) {
      // トング
      scene.add(box(0.012, 0.36, 0.03, metal, -9.75, 1.72, z));
    } else {
      // 泡立て器
      scene.add(cyl(0.006, 0.006, 0.2, metal, -9.75, 1.82, z, 6));
      const wh = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.003, 6, 14), metal);
      wh.position.set(-9.75, 1.6, z);
      wh.rotation.y = Math.PI / 2;
      scene.add(wh);
    }
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
  for (let k = 0; k < 6; k++) scene.add(cyl(0.12, 0.1, 0.018, plain(0xf6f6f2, 0.25, 0), -1.9, 1.06 + k * 0.02, -0.7, 20));

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
      // 開く(0.25秒)→ 少し止まる → 閉じる
      if (openT > 0) openT = Math.max(0, openT - dt);
      const open = openT > 0.9 ? (1.2 - openT) / 0.3 : openT > 0.4 ? 1 : openT / 0.4;
      doorL.rotation.y = open * 1.9;
      doorR.rotation.y = -open * 1.9;
    },
    rail: ticketRail,
  };
}
