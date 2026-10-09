// 人の3Dモデル。胴・頭・髪・腕・脚を組み合わせた、少しリアルな等身。
// お客さん(座る/並ぶ)、ホールの店員、キッチンの料理人で使い回す。

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const SKINS = [0xf1c9a5, 0xe0ac86, 0xc68863, 0x9a6a48, 0x73492f];
const HAIRS = [0x15110e, 0x2b1d14, 0x4a3022, 0x8a6a3a, 0x9a9a9a, 0x6a2a1a];
const SHIRTS = [0x3e6a8e, 0x8e3e3e, 0x4d7a4f, 0xb89a3e, 0x6a4e8a, 0x2f3a4a, 0xd5d0c4, 0xa85a2a];
const PANTS = [0x2b2f3a, 0x3a3228, 0x46505e, 0x24272b];

export interface Look {
  skin: number;
  hair: number;
  shirt: number;
  pants: number;
  hairStyle: 0 | 1 | 2;
  height: number;
}

/** 番号から決まる見た目。同じ番号なら同じ人 */
export function lookFor(n: number): Look {
  const h = (k: number) => {
    let x = (n + 1) * 2654435761 + k * 40503;
    x = Math.imul(x ^ (x >>> 15), 2246822507);
    x = Math.imul(x ^ (x >>> 13), 3266489909);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  const pick = <T,>(a: T[], k: number) => a[Math.floor(h(k) * a.length)]!;
  return {
    skin: pick(SKINS, 1),
    hair: pick(HAIRS, 2),
    shirt: pick(SHIRTS, 3),
    pants: pick(PANTS, 4),
    hairStyle: Math.floor(h(5) * 3) as 0 | 1 | 2,
    height: 0.94 + h(6) * 0.14,
  };
}

export type Outfit = "customer" | "waiter" | "chef";

export interface Person {
  group: THREE.Group;
  skin: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  shirt: THREE.MeshStandardMaterial;
  pants: THREE.MeshStandardMaterial;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
}

const g = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry) {
  let x = g.get(key);
  if (!x) g.set(key, (x = make()));
  return x;
}

function part(geometry: THREE.BufferGeometry, material: THREE.Material, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = shadow;
  return m;
}

const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.8 });
const dark = new THREE.MeshStandardMaterial({ color: 0x22201f, roughness: 0.7 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1d1a18, roughness: 0.6 });

/**
 * sit: true なら座った姿勢(太ももが水平、すねが垂直)。
 * 原点は足元(立っているとき)。座るときは原点を座面の高さに合わせて置くこと。
 */
export function buildPerson(look: Look, outfit: Outfit = "customer", sit = false): Person {
  const skin = new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.6 });
  const hair = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.85 });
  const shirt = new THREE.MeshStandardMaterial({ color: outfit === "customer" ? look.shirt : 0xf4f2ec, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: outfit === "chef" ? 0x2c2c2e : look.pants, roughness: 0.8 });

  const group = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(look.height);
  group.add(body);

  const legLen = 0.8;
  const hipY = sit ? 0.0 : legLen;
  const make = (side: 1 | -1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.09, hipY, 0);
    const thigh = part(geo("thigh", () => new THREE.CapsuleGeometry(0.075, 0.34, 4, 10)), pants);
    const shin = part(geo("shin", () => new THREE.CapsuleGeometry(0.065, 0.34, 4, 10)), pants);
    const shoe = part(geo("shoe", () => new THREE.BoxGeometry(0.1, 0.07, 0.24)), shoeMat);
    if (sit) {
      // 太ももは前(+z)へ水平に、すねは膝から下へ垂直に
      thigh.rotation.x = Math.PI / 2;
      thigh.position.set(0, 0, 0.24);
      shin.position.set(0, -0.28, 0.46);
      shoe.position.set(0, -0.5, 0.52);
    } else {
      thigh.position.y = -0.22;
      shin.position.y = -0.58;
      shoe.position.set(0, -0.76, 0.04);
    }
    hip.add(thigh, shin, shoe);
    return hip;
  };
  const legL = make(1);
  const legR = make(-1);
  const torsoY = (sit ? 0 : legLen) + 0.32;
  const torso = part(geo("torso", () => new THREE.CapsuleGeometry(0.17, 0.34, 6, 14)), shirt);
  torso.scale.z = 0.62;
  torso.position.y = torsoY;
  body.add(legL, legR, torso);

  const shoulderY = torsoY + 0.26;
  const makeArm = (side: 1 | -1) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.225, shoulderY, 0);
    const upper = part(geo("arm", () => new THREE.CapsuleGeometry(0.05, 0.4, 4, 10)), shirt);
    upper.position.y = -0.24;
    const hand = part(geo("hand", () => new THREE.SphereGeometry(0.052, 12, 10)), skin);
    hand.position.y = -0.5;
    arm.add(upper, hand);
    return arm;
  };
  const armL = makeArm(1);
  const armR = makeArm(-1);
  if (sit) {
    // 手は膝の上あたりに置く
    armL.rotation.x = armR.rotation.x = -0.75;
  }
  body.add(armL, armR);

  const neckY = shoulderY + 0.02;
  const neck = part(geo("neck", () => new THREE.CylinderGeometry(0.05, 0.055, 0.1, 10)), skin);
  neck.position.y = neckY + 0.04;
  const headY = neckY + 0.2;
  const head = part(geo("head", () => new THREE.SphereGeometry(0.115, 20, 16)), skin);
  head.scale.set(0.92, 1.12, 1);
  head.position.y = headY;
  body.add(neck, head);
  for (const s of [-1, 1]) {
    const eye = part(geo("eye", () => new THREE.SphereGeometry(0.013, 8, 6)), eyeMat, false);
    eye.position.set(s * 0.04, headY + 0.015, 0.105);
    body.add(eye);
  }

  const cap = (style: number) => {
    // 頭の上半分をおおう髪
    const h = part(geo(`hair${style}`, () => new THREE.SphereGeometry(0.123, 20, 12, 0, Math.PI * 2, 0, style === 1 ? Math.PI * 0.62 : Math.PI * 0.5)), hair);
    h.scale.set(0.95, 1.14, 1.04);
    h.position.set(0, headY + (style === 1 ? 0.0 : 0.012), style === 1 ? -0.012 : -0.008);
    return h;
  };

  if (outfit === "chef") {
    const hat = part(geo("chefhat", () => new THREE.CylinderGeometry(0.1, 0.11, 0.1, 18)), white);
    hat.position.y = headY + 0.15;
    const puff = part(geo("chefpuff", () => new THREE.SphereGeometry(0.13, 16, 12)), white);
    puff.scale.y = 0.65;
    puff.position.y = headY + 0.23;
    body.add(hat, puff, cap(0));
  } else {
    body.add(cap(look.hairStyle));
  }
  if (outfit === "waiter") {
    const apron = part(geo("apron", () => new THREE.BoxGeometry(0.34, 0.5, 0.03)), dark);
    apron.position.set(0, (sit ? 0 : legLen) + 0.1, 0.11);
    body.add(apron);
  }
  if (outfit === "chef") {
    const apron = part(geo("apronC", () => new THREE.BoxGeometry(0.34, 0.55, 0.03)), white);
    apron.position.set(0, (sit ? 0 : legLen) + 0.12, 0.115);
    body.add(apron);
  }
  return { group, skin, hair, shirt, pants, armL, armR, legL, legR };
}

/** 見た目だけ差し替える(座席のお客さんが入れ替わったとき) */
export function applyLook(p: Person, look: Look) {
  p.skin.color.setHex(look.skin);
  p.hair.color.setHex(look.hair);
  p.shirt.color.setHex(look.shirt);
  p.pants.color.setHex(look.pants);
  p.group.children[0]!.scale.setScalar(look.height);
}

/** 歩いているときの手足の振り。speed は m/s */
export function animateWalk(p: Person, time: number, speed: number) {
  const k = Math.min(1, speed / 3);
  const s = Math.sin(time * 8) * 0.7 * k;
  p.legL.rotation.x = s;
  p.legR.rotation.x = -s;
  p.armL.rotation.x = -s * 0.8;
  p.armR.rotation.x = s * 0.8;
}

/** 動かさない人(行列)用に、材質ごとに1つのメッシュへまとめる。描画の負担を減らす */
export function bakePerson(p: Person): THREE.Group {
  p.group.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  p.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geom = m.geometry.clone();
    geom.applyMatrix4(m.matrixWorld);
    const list = byMat.get(m.material as THREE.Material) ?? [];
    list.push(geom);
    byMat.set(m.material as THREE.Material, list);
  });
  const out = new THREE.Group();
  for (const [mat, list] of byMat) {
    const merged = mergeGeometries(list, false);
    if (merged) out.add(new THREE.Mesh(merged, mat));
  }
  return out;
}
