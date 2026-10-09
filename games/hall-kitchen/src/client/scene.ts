// 店の3Dモデル。ホール(z > 0)とキッチン(z < 0)がカウンターで分かれている。
// 画像やモデルのファイルは使わず、箱だけで作る。

import * as THREE from "three";

function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}

export function buildRestaurant(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4e6d0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x886644, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(4, 8, 3);
  scene.add(sun);

  // 床(ホールは木、キッチンはタイル)
  scene.add(box(20, 0.1, 10, 0xb98a5a, 0, -0.05, 5));
  scene.add(box(20, 0.1, 10, 0xd9dde0, 0, -0.05, -5));

  // 外壁
  const wall = 0xefe3cf;
  scene.add(box(20, 3, 0.2, wall, 0, 1.5, 10));
  scene.add(box(20, 3, 0.2, wall, 0, 1.5, -10));
  scene.add(box(0.2, 3, 20, wall, -10, 1.5, 0));
  scene.add(box(0.2, 3, 20, wall, 10, 1.5, 0));

  // カウンター(中央に受け渡しの窓)
  const counter = 0x7a4b2a;
  scene.add(box(8.5, 1, 1, counter, -5.75, 0.5, -0.5));
  scene.add(box(8.5, 1, 1, counter, 5.75, 0.5, -0.5));
  scene.add(box(3, 1, 1, counter, 0, 0.5, -0.5)); // 受け渡し台(窓の下)
  scene.add(box(8.5, 2, 1, wall, -5.75, 2, -0.5));
  scene.add(box(8.5, 2, 1, wall, 5.75, 2, -0.5));
  scene.add(box(3, 1, 1, wall, 0, 2.5, -0.5)); // 窓の上

  // ホールのテーブル(4つ)
  for (const [x, z] of [[-6, 4], [-2, 4], [2, 4], [6, 4]] as const) {
    scene.add(box(1.4, 0.08, 1.4, 0xc9a06b, x, 0.75, z));
    scene.add(box(0.12, 0.75, 0.12, 0x555555, x, 0.375, z));
    scene.add(box(0.5, 0.45, 0.5, 0x3b6ea5, x, 0.225, z + 1.1));
    scene.add(box(0.5, 0.45, 0.5, 0x3b6ea5, x, 0.225, z - 1.1));
  }

  // ドリンクバー(ホールの右の壁沿い)
  scene.add(box(1, 1, 3.6, 0x2c6e8f, 9.4, 0.5, 2.6));
  scene.add(box(1, 0.1, 3.6, 0xdfe9ef, 9.4, 1.05, 2.6));

  // キッチンの設備(奥の壁沿い)
  scene.add(box(2, 0.9, 1, 0x444a50, -6, 0.45, -8.8)); // コンロ1
  scene.add(box(2, 0.9, 1, 0x444a50, -3, 0.45, -8.8)); // コンロ2
  scene.add(box(2, 0.9, 1, 0x7fb4d6, 0, 0.45, -8.8)); // 洗い場(まだ使わない)
  scene.add(box(2, 1.8, 1, 0xcfd6dc, 4, 0.9, -8.8)); // 冷蔵庫
  scene.add(box(1.6, 0.9, 1.6, 0x9aa3ab, 0, 0.45, -5)); // 中央の作業台
  return scene;
}

/** 相手プレイヤーの見た目(胴体と頭)。足元の位置を x,z に合わせる */
export function buildAvatar(color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.6, 0.9, 0.35, color, 0, 1.0, 0));
  g.add(box(0.3, 0.3, 0.3, 0xf2c9a0, 0, 1.65, 0));
  g.add(box(0.2, 0.7, 0.25, 0x333333, -0.15, 0.35, 0));
  g.add(box(0.2, 0.7, 0.25, 0x333333, 0.15, 0.35, 0));
  return g;
}
