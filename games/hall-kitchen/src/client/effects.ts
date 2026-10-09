// 湯気・煙・油の泡・冷蔵庫の冷気。小さな粒をたくさん出して動かす(Points)。
// 調理中の調理場から出る: 焼く→うっすら煙 / 茹でる→湯気 / 揚げる→油の泡と、うっすら湯気。

import * as THREE from "three";
import { FRIDGE, STOVES } from "../shared/layout";

type Kind = "steam" | "smoke" | "bubble" | "fog";
interface Preset {
  size: [number, number]; // 出たときの大きさ → 消えるときの大きさ(m)
  life: [number, number];
  rise: [number, number]; // 上がる速さ(m/s)
  alpha: number;
  color: number;
  spread: number; // 出る位置のばらつき(m)
}
const PRESET: Record<Kind, Preset> = {
  steam: { size: [0.25, 1.0], life: [1.6, 2.6], rise: [0.3, 0.55], alpha: 0.5, color: 0xffffff, spread: 0.25 },
  smoke: { size: [0.15, 0.55], life: [1.6, 2.6], rise: [0.25, 0.45], alpha: 0.38, color: 0xd5d9de, spread: 0.45 },
  bubble: { size: [0.05, 0.085], life: [0.3, 0.6], rise: [0.05, 0.15], alpha: 0.95, color: 0xfff4d0, spread: 0.3 },
  fog: { size: [0.3, 0.8], life: [1.0, 1.6], rise: [-0.15, 0.0], alpha: 0.28, color: 0xdceaff, spread: 0.5 },
};

const MAX = 700;
const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

export class Effects {
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private alpha = new Float32Array(MAX);
  private color = new Float32Array(MAX * 3);
  private baseSize = new Float32Array(MAX * 2);
  private baseAlpha = new Float32Array(MAX);
  private next = 0;
  private geo = new THREE.BufferGeometry();
  private mat: THREE.ShaderMaterial;
  private active: boolean[] = STOVES.map(() => false);
  private acc: number[] = STOVES.map(() => 0);
  private fogLeft = 0;

  constructor(scene: THREE.Scene) {
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(this.color, 3));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 600 } },
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(this.geo, this.mat);
    points.frustumCulled = false;
    points.renderOrder = 5;
    scene.add(points);
    this.life.fill(0);
  }

  /** 画面の高さ(px)とカメラの縦の視野角(度)。粒の大きさを、距離に合わせて決めるのに使う */
  setViewport(heightPx: number, fovDeg: number) {
    this.mat.uniforms.uScale!.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  /** 調理場 i が調理中かどうか */
  setStation(i: number, cooking: boolean) {
    this.active[i] = cooking;
  }

  /** 冷蔵庫を開けたときの冷気 */
  fridgeFog() {
    this.fogLeft = 0.9;
  }

  private spawn(kind: Kind, x: number, y: number, z: number) {
    const p = PRESET[kind];
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    const r = Math.random;
    const j = (v: number) => (r() - 0.5) * 2 * v;
    this.pos[i * 3] = x + j(p.spread);
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z + j(p.spread);
    this.vel[i * 3] = j(0.06);
    this.vel[i * 3 + 1] = p.rise[0] + r() * (p.rise[1] - p.rise[0]);
    this.vel[i * 3 + 2] = kind === "fog" ? 0.25 + r() * 0.2 : j(0.06);
    this.maxLife[i] = this.life[i] = p.life[0] + r() * (p.life[1] - p.life[0]);
    this.baseSize[i * 2] = p.size[0];
    this.baseSize[i * 2 + 1] = p.size[1];
    this.baseAlpha[i] = p.alpha;
    const c = new THREE.Color(p.color);
    this.color[i * 3] = c.r;
    this.color[i * 3 + 1] = c.g;
    this.color[i * 3 + 2] = c.b;
  }

  update(dt: number) {
    // 出す
    STOVES.forEach((s, i) => {
      if (!this.active[i]) return;
      const rate = s.kind === "boil" ? 22 : s.kind === "fry" ? 20 : 12; // 1秒に出す粒の数
      this.acc[i]! += rate * dt;
      while (this.acc[i]! >= 1) {
        this.acc[i]! -= 1;
        if (s.kind === "boil") this.spawn("steam", s.x, 1.0, s.z);
        else if (s.kind === "grill") this.spawn("smoke", s.x, 0.98, s.z);
        else {
          this.spawn("bubble", s.x + (Math.random() < 0.5 ? -0.45 : 0.45), 0.96, s.z);
          if (Math.random() < 0.25) this.spawn("steam", s.x, 1.0, s.z);
        }
      }
    });
    if (this.fogLeft > 0) {
      this.fogLeft -= dt;
      for (let k = 0; k < 2; k++) this.spawn("fog", FRIDGE.x, 0.9 + Math.random() * 0.8, FRIDGE.z + 0.6);
    }
    // 動かす
    for (let i = 0; i < MAX; i++) {
      if (this.life[i]! <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i]! -= dt;
      const t = 1 - this.life[i]! / this.maxLife[i]!; // 0 → 1
      this.pos[i * 3]! += this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      this.vel[i * 3]! += (Math.random() - 0.5) * 0.3 * dt; // ゆらぎ
      this.size[i] = this.baseSize[i * 2]! + (this.baseSize[i * 2 + 1]! - this.baseSize[i * 2]!) * t;
      this.alpha[i] = this.baseAlpha[i]! * Math.min(1, t * 6) * (1 - t); // すっと現れて、ゆっくり消える
    }
    this.geo.attributes.position!.needsUpdate = true;
    this.geo.attributes.aSize!.needsUpdate = true;
    this.geo.attributes.aAlpha!.needsUpdate = true;
    this.geo.attributes.aColor!.needsUpdate = true;
  }
}
