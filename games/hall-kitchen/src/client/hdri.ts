// 反射用の背景画像(HDRI)。ステンレスなど金属に、実際の室内の景色が映り込む。
// 画像は Poly Haven(CC0)のもの。pmndrs/assets 経由で取得した 512px 版を、public/assets/hdri に置いている。

import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { loadAsset } from "./assets";

/** HDRI を読み込んで、反射に使える形(PMREM)にして返す。読めなければ reject */
export async function loadHdri(renderer: THREE.WebGLRenderer, name: string): Promise<THREE.Texture> {
  const buffer = await loadAsset(`hdri/${name}.hdr`);
  // RGBELoader#load と同じ手順を、取り出し済みのデータに対して行う
  const d = new RGBELoader().parse(buffer);
  const tex = new THREE.DataTexture(d.data as unknown as BufferSource, d.width, d.height, THREE.RGBAFormat, d.type);
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = true;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}
