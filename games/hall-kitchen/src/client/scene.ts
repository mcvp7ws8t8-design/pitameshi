// 店の3Dモデル。ホール(z > 0)とキッチン(z < 0)がカウンターで分かれている。
// 画像やモデルのファイルは使わず、形と質感はすべてコードで作る。
// 位置は src/shared/layout.ts と合わせてある(席・コンロ・ドリンクバー・受け渡し窓)。

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BARS, SEATS, STOVES, TABLES, TABLE_SIZE } from "../shared/layout";
import { buildKitchen, type Kitchen } from "./kitchen";
import * as tex from "./textures";

const H = 3.2; // 天井の高さ

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function pbr(key: string, make: () => THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = make()));
  return m;
}
const plain = (color: number, rough = 0.6, metal = 0) =>
  pbr(`p${color}.${rough}.${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));

function surface(maps: tex.PBRMaps, key: string, rx: number, ry: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return pbr(`${key}.${rx.toFixed(2)}.${ry.toFixed(2)}`, () => {
    const map = maps.map.clone();
    const bump = maps.bump.clone();
    for (const t of [map, bump]) {
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
    }
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.5, roughness: 0.7, ...o });
  });
}

function box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, o: { cast?: boolean; recv?: boolean; round?: number } = {}) {
  const geom = o.round ? new RoundedBoxGeometry(w, h, d, 3, o.round) : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geom, m);
  mesh.position.set(x, y, z);
  mesh.castShadow = o.cast ?? true;
  mesh.receiveShadow = o.recv ?? true;
  return mesh;
}

function cylinder(rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export interface Restaurant {
  scene: THREE.Scene;
  kitchen: Kitchen;
}

export function buildRestaurant(renderer: THREE.WebGLRenderer): Restaurant {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15110e);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  const woodFloor = tex.woodFloor(1, 1);
  const tileMaps = tex.tiles(1, 1);
  const plasterCream = tex.plaster("#efe1c8", 1, 1);
  const plasterWhite = tex.plaster("#f3f1ec", 1, 1);
  const darkWood = tex.woodGrain(24, 26);
  const midWood = tex.woodGrain(28, 40);
  const steelMaps = tex.steel();

  const wood = (w: number, h: number) => surface(darkWood, "dw", w, h, { roughness: 0.55 });
  const tableWood = (w: number, h: number) => surface(midWood, "mw", w, h, { roughness: 0.5 });
  const steelM = (w: number, h: number) => surface(steelMaps, "st", w, h, { roughness: 0.35, metalness: 0.85 });
  const tileM = (w: number, h: number) => surface(tileMaps, "tl", w / 2, h / 2, { roughness: 0.25 });
  const cream = (w: number, h: number) => surface(plasterCream, "pc", w / 2, h / 2, { roughness: 0.95, bumpScale: 0.4 });
  const white = (w: number, h: number) => surface(plasterWhite, "pw", w / 2, h / 2, { roughness: 0.95, bumpScale: 0.4 });

  // ---- 床・天井 ----
  const hallFloor = box(20, 0.1, 10, surface(woodFloor, "wf", 10, 5, { roughness: 0.45 }), 0, -0.05, 5);
  const kitchenFloor = box(20, 0.1, 10, surface(tileMaps, "kf", 10, 5, { roughness: 0.2 }), 0, -0.05, -5);
  const ceiling = box(20, 0.1, 20, white(20, 20), 0, H + 0.05, 0, { cast: false });
  scene.add(hallFloor, kitchenFloor, ceiling);

  // ---- 外壁(ホール) ----
  const wallCream = (w: number, h: number) => cream(w, h);
  // 奥(入口側)
  scene.add(box(20, H, 0.2, wallCream(20, H), 0, H / 2, 10.0));
  scene.add(box(20, 1.0, 0.24, wood(10, 0.5), 0, 0.5, 9.88)); // 腰壁
  scene.add(box(20, 0.08, 0.28, plain(0xf4efe4, 0.5), 0, 1.0, 9.86)); // 笠木
  // 入口のドア
  scene.add(box(1.5, 2.4, 0.08, wood(1, 2), -8.8, 1.2, 9.86, { round: 0.02 }));
  scene.add(box(1.7, 0.12, 0.12, plain(0xf4efe4, 0.5), -8.8, 2.46, 9.86));
  scene.add(cylinder(0.025, 0.025, 0.3, plain(0xc9a24a, 0.3, 1), -8.35, 1.1, 9.8, 12));
  // 右の壁(ドリンクバー側)
  scene.add(box(0.2, H, 10, wallCream(10, H), 10, H / 2, 5));
  scene.add(box(0.24, 1.0, 10, wood(5, 0.5), 9.88, 0.5, 5));
  // 左の壁: 窓が2つ
  const wl = (z0: number, z1: number, y0: number, y1: number) =>
    box(0.2, y1 - y0, z1 - z0, wallCream(z1 - z0, y1 - y0), -10, (y0 + y1) / 2, (z0 + z1) / 2);
  scene.add(wl(0, 10, 0, 1.0), wl(0, 10, 2.4, H));
  for (const [a, b] of [[0, 1.4], [3.6, 6.4], [8.6, 10]] as const) scene.add(wl(a, b, 1.0, 2.4));
  scene.add(box(0.24, 1.0, 10, wood(5, 0.5), -9.88, 0.5, 5));
  for (const zc of [2.5, 7.5]) {
    const frame = plain(0xf4efe4, 0.5);
    scene.add(box(0.3, 0.07, 2.4, frame, -10, 1.0, zc), box(0.1, 0.07, 2.3, frame, -10, 2.4, zc));
    scene.add(box(0.1, 1.4, 0.07, frame, -10, 1.7, zc), box(0.1, 1.4, 0.07, frame, -10, 1.7, zc - 1.1), box(0.1, 1.4, 0.07, frame, -10, 1.7, zc + 1.1));
    scene.add(box(0.06, 0.05, 2.2, frame, -10, 1.7, zc));
  }
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), new THREE.MeshBasicMaterial({ map: tex.outside(), toneMapped: false }));
  sky.position.set(-11.5, 1.8, 5);
  sky.rotation.y = Math.PI / 2;
  scene.add(sky);

  // ---- 外壁(キッチン) ----
  scene.add(box(20, H, 0.2, white(20, H), 0, H / 2, -10));
  scene.add(box(20, 1.8, 0.24, tileM(20, 1.8), 0, 0.9, -9.88));
  scene.add(box(0.2, H, 10, white(10, H), -10, H / 2, -5), box(0.24, 1.8, 10, tileM(10, 1.8), -9.88, 0.9, -5));
  scene.add(box(0.2, H, 10, white(10, H), 10, H / 2, -5), box(0.24, 1.8, 10, tileM(10, 1.8), 9.88, 0.9, -5));

  // ---- カウンター(中央に受け渡しの窓。x ±1.5、高さ 1.05〜2.5) ----
  scene.add(box(20, 1.0, 1.0, wood(10, 0.5), 0, 0.5, -0.5)); // 腰の高さ
  const upper = (x0: number, x1: number) => box(x1 - x0, H - 1.0, 1.0, white(x1 - x0, H - 1.0), (x0 + x1) / 2, 1.0 + (H - 1.0) / 2, -0.5);
  scene.add(upper(-10, -1.5), upper(1.5, 10));
  scene.add(box(3, H - 2.5, 1.0, white(3, 0.7), 0, 2.5 + (H - 2.5) / 2, -0.5));
  scene.add(box(20, 0.06, 1.3, tableWood(4, 1), 0, 1.03, -0.5, { round: 0.015 })); // 天板(厚み)
  scene.add(box(3.3, 0.06, 1.3, steelM(2, 1), 0, 1.06, -0.5)); // 受け渡しの金属板
  // 保温ランプ
  for (const x of [-1.0, 1.0]) {
    scene.add(cylinder(0.02, 0.02, 0.35, plain(0x333333, 0.5, 0.8), x, 2.32, -0.5, 8));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.14, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.8, side: THREE.DoubleSide }));
    shade.position.set(x, 2.1, -0.5);
    scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8a30, emissiveIntensity: 2.5 }));
    bulb.position.set(x, 2.08, -0.5);
    scene.add(bulb);
  }

  // ---- ホール: テーブルと椅子(位置は layout.ts の TABLES / SEATS と同じ) ----
  const woodChair = plain(0x6a4529, 0.6);
  const seatPad = plain(0x7e2f2f, 0.85);
  const metal = plain(0x2b2b2d, 0.35, 0.9);
  const glassVase = new THREE.MeshPhysicalMaterial({ color: 0xcfe8f5, roughness: 0.05, transparent: true, opacity: 0.55 });
  const lampShade = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide });
  const lampBulb = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb860, emissiveIntensity: 3 });
  TABLES.forEach((t) => {
    const { w, d } = TABLE_SIZE[t.seats];
    scene.add(box(w, 0.06, d, tableWood(w * 1.1, d * 1.1), t.x, 0.76, t.z, { round: 0.02 }));
    // 脚は、2名掛けは1本、4名掛けは2本
    const legs = t.seats === 2 ? [0] : [-0.45, 0.45];
    for (const lx of legs) {
      scene.add(cylinder(0.06, 0.08, 0.73, metal, t.x + lx, 0.365, t.z));
      scene.add(cylinder(0.26, 0.28, 0.03, metal, t.x + lx, 0.015, t.z, 24));
    }
    // 花瓶と調味料
    scene.add(cylinder(0.03, 0.04, 0.12, glassVase, t.x - w * 0.3, 0.85, t.z, 14));
    scene.add(cylinder(0.004, 0.004, 0.2, plain(0x3f7a3a, 0.8), t.x - w * 0.3, 0.96, t.z, 6));
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), plain(0xd9486a, 0.7));
    flower.position.set(t.x - w * 0.3, 1.07, t.z);
    scene.add(flower);
    scene.add(cylinder(0.016, 0.018, 0.055, plain(0xf4f1ea, 0.3), t.x + w * 0.28, 0.82, t.z, 10), cylinder(0.016, 0.018, 0.055, plain(0x2b2b2b, 0.3), t.x + w * 0.28 + 0.05, 0.82, t.z, 10));
    // 吊りランプ(見た目だけ。実際の光は下でまとめて置く)
    scene.add(cylinder(0.006, 0.006, H - 2.3, plain(0x222222, 0.5), t.x, (H + 2.3) / 2, t.z, 6));
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.26, 0.24, 24, 1, true), lampShade);
    shade.position.set(t.x, 2.25, t.z);
    scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), lampBulb);
    bulb.position.set(t.x, 2.2, t.z);
    scene.add(bulb);
  });
  // 実際に照らす光は、列ごとに数個だけ(全部のランプに置くと重いので)
  for (const [x, z] of [[-5, 2.8], [0, 2.5], [5, 2.8], [-4.4, 5.3], [4.4, 5.3], [0, 7.6]] as const) {
    const light = new THREE.PointLight(0xffc98a, 13, 8, 2);
    light.position.set(x, 2.1, z);
    scene.add(light);
  }
  for (const s of SEATS) {
    const dir = s.yaw === 0 ? 1 : -1; // 背もたれはテーブルと反対側
    scene.add(box(0.42, 0.05, 0.42, seatPad, s.x, 0.46, s.z, { round: 0.02 }));
    scene.add(box(0.42, 0.42, 0.045, woodChair, s.x, 0.73, s.z + dir * 0.19, { round: 0.015 }));
    for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const) {
      scene.add(cylinder(0.018, 0.015, 0.44, woodChair, s.x + dx, 0.22, s.z + dz, 8));
    }
  }

  // ---- ホール: 飾り ----
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({ map: tex.chalkboard(["本日のメニュー", "料理 20種", "ドリンク 20種", "ご注文はお早めに!"]), roughness: 0.9 }));
  board.position.set(-3.6, 1.95, 9.86);
  board.rotation.y = Math.PI;
  scene.add(board, box(1.7, 1.7, 0.05, wood(1, 1), -3.6, 1.95, 9.9, { cast: false }));
  [[0.6, 2.0, 5], [2.0, 2.0, 7.5], [0.5, 2.0, 9.86]].forEach(([w, y, z], i) => {
    if (i === 2) return;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshStandardMaterial({ map: tex.painting(i + 4), roughness: 0.8 }));
    art.position.set(9.86, y!, z!);
    art.rotation.y = -Math.PI / 2;
    scene.add(art, box(0.05, 0.8, 1.0, wood(1, 1), 9.9, y!, z!, { cast: false }));
    void w;
  });
  for (const [x, z] of [[-9.2, 0.8], [9.2, 9.2]] as const) {
    scene.add(cylinder(0.2, 0.15, 0.4, plain(0x8a5a3a, 0.7), x, 0.2, z));
    for (let k = 0; k < 7; k++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), plain(0x2f6b34, 0.8));
      leaf.scale.set(1, 0.5, 0.5);
      const a = (k / 7) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 0.18, 0.62 + (k % 3) * 0.15, z + Math.sin(a) * 0.18);
      leaf.rotation.set(0.5, a, 0.4);
      leaf.castShadow = true;
      scene.add(leaf);
    }
  }

  // ---- ホール: ドリンクバー(右の壁沿い。BARS の x=8.8 側に立つ) ----
  scene.add(box(1.0, 1.0, 3.8, wood(2, 1), 9.4, 0.5, 2.6));
  scene.add(box(1.1, 0.06, 3.9, steelM(2, 2), 9.4, 1.03, 2.6, { round: 0.015 }));
  for (const z of [1.6, 3.6]) {
    scene.add(cylinder(0.12, 0.14, 0.04, plain(0x1e1e20, 0.3, 0.8), 9.4, 1.08, z)); // ドリンクを作る台
  }
  for (const z of [2.2, 2.6, 3.0]) {
    scene.add(cylinder(0.02, 0.02, 0.22, steelM(1, 1), 9.7, 1.18, z, 8));
    const handle = box(0.03, 0.12, 0.03, plain(0x7e2f2f, 0.4), 9.7, 1.34, z);
    scene.add(handle);
  }
  scene.add(box(0.4, 0.04, 3.8, wood(2, 1), 9.7, 1.7, 2.6), box(0.4, 0.04, 3.8, wood(2, 1), 9.7, 2.1, 2.6));
  const bottleColors = [0x2f6b3a, 0x8a5a2b, 0x8a1a2e, 0xcfe8f5, 0xe9b43a, 0x2b4a7a, 0xf4f1e6, 0x6a2a6a];
  for (let k = 0; k < 14; k++) {
    const z = 0.9 + k * 0.28;
    const c = bottleColors[k % bottleColors.length]!;
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
    for (const y of [1.72 + 0.14, 2.12 + 0.14]) {
      scene.add(cylinder(0.04, 0.04, 0.22, m, 9.7, y, z, 12), cylinder(0.015, 0.02, 0.1, m, 9.7, y + 0.16, z, 8));
    }
  }
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.4),
    new THREE.MeshBasicMaterial({ map: tex.chalkboard(["DRINK BAR"]), toneMapped: false }),
  );
  neon.position.set(9.85, 2.7, 2.6);
  neon.rotation.y = -Math.PI / 2;
  scene.add(neon);
  void BARS;

  // ---- キッチンの設備(調理場・冷蔵庫・シンク・作業台・棚・伝票レール) ----
  const kitchen = buildKitchen(scene, {
    box,
    cyl: (rt, rb, h, m, x, y, z, seg) => cylinder(rt, rb, h, m, x, y, z, seg),
    plain,
    steel: (w, h) => steelM(w, h),
    wood: (w, h) => wood(w, h),
  });
  // キッチンの天井灯
  for (const [x, z] of [[-5, -3.5], [3, -3.5], [-1, -7.5]] as const) {
    scene.add(box(1.2, 0.04, 0.5, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f2ff, emissiveIntensity: 2.2 }), x, H - 0.02, z, { cast: false }));
    const l = new THREE.PointLight(0xeaf4ff, 22, 11, 2);
    l.position.set(x, H - 0.3, z);
    scene.add(l);
  }

  // ---- 光 ----
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x7a5a3a, 0.45));
  // 左の窓から差し込む日光。壁と窓枠が影になって、床に窓の形の光がのびる
  const sun = new THREE.DirectionalLight(0xfff0d0, 4.2);
  sun.position.set(-30, 10, 5);
  sun.target.position.set(-2, 0, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -16;
  cam.right = 16;
  cam.top = 16;
  cam.bottom = -16;
  cam.near = 1;
  cam.far = 80;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  scene.fog = new THREE.Fog(0x15110e, 25, 45);
  return { scene, kitchen };
}
