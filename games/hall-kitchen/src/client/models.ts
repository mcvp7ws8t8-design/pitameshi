// 配布されている3Dモデル(glTF)の読み込み。モデルは public/assets/models に置く。
// 出どころとライセンスは README の「素材」にまとめてある。

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadAsset } from "./assets";

const cache = new Map<string, Promise<THREE.Group>>();

/** モデル(public/assets 以下のパス)を読み込む(同じものは1回だけ)。返すのは、置く前の見本。使うときは clone する */
export function loadModel(path: string): Promise<THREE.Group> {
  let p = cache.get(path);
  if (!p) {
    p = loadAsset(path).then((buf) => new GLTFLoader().parseAsync(buf, "")).then((gltf) => {
      // 透過(transmission)の材質は、画面を描き直す重い処理を呼ぶので、ふつうの半透明にする
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const mm = m as THREE.MeshPhysicalMaterial;
          if (mm.transmission && mm.transmission > 0) {
            mm.transmission = 0;
            mm.transparent = true;
            mm.opacity = Math.min(mm.opacity, 0.28);
            mm.depthWrite = false;
          }
        }
      });
      return gltf.scene;
    });
    cache.set(path, p);
  }
  return p;
}

/** 底を y=0 に、水平の中心を原点にそろえ、高さが height(m)になる大きさにして返す */
export function placeable(model: THREE.Group, height: number): THREE.Group {
  const inst = model.clone(true);
  const box = new THREE.Box3().setFromObject(inst);
  const size = box.getSize(new THREE.Vector3());
  const k = height / size.y;
  inst.scale.setScalar(k);
  inst.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  const wrap = new THREE.Group();
  wrap.add(inst);
  return wrap;
}
