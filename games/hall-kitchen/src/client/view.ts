// ゲームの状態(サーバーから届く GameSnapshot)を3Dの店に映す。
// お客さん・行列・コンロの上の料理・受け渡し台の料理・席の番号。

import * as THREE from "three";
import { type Dish, type GameSnapshot } from "../shared/game";
import { PASS_SLOT, QUEUE_MAX_SHOWN, SEATS, STOVES, queueSpot } from "../shared/layout";
import { buildAvatar } from "./scene";

const DISH_COLOR: Record<Dish, number> = { salad: 0x6ab04c, burger: 0x8b5a2b };
const STATE_COLOR = { waitOrder: 0xf1c40f, waitFood: 0xe67e22, eating: 0x2ecc71 } as const;

function setShirt(g: THREE.Group, color: number) {
  const body = g.children[0] as THREE.Mesh;
  (body.material as THREE.MeshLambertMaterial).color.setHex(color);
}

function numberSprite(n: number): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c) }));
  s.scale.set(0.45, 0.45, 1);
  return s;
}

function dishBox(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  m.visible = false;
  return m;
}

export class GameView {
  private seatGroups: THREE.Group[] = [];
  private bars: THREE.Sprite[] = [];
  private queue: THREE.Group[] = [];
  private stoveDish: THREE.Mesh[] = [];
  private passDish: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    SEATS.forEach((s, i) => {
      const g = buildAvatar(0xffffff);
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.yaw;
      g.visible = false;
      scene.add(g);
      this.seatGroups.push(g);

      const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x2ecc71 }));
      bar.position.set(s.x, 2.2, s.z);
      bar.visible = false;
      scene.add(bar);
      this.bars.push(bar);

      const label = numberSprite(i + 1);
      label.position.set(s.x, 2.65, s.z);
      scene.add(label);
    });
    for (let i = 0; i < QUEUE_MAX_SHOWN; i++) {
      const g = buildAvatar(0x95a5a6);
      const q = queueSpot(i);
      g.position.set(q.x, 0, q.z);
      g.rotation.y = Math.PI / 2;
      g.visible = false;
      scene.add(g);
      this.queue.push(g);
    }
    STOVES.forEach((s) => {
      const d = dishBox();
      d.position.set(s.x, 0.96, s.z);
      scene.add(d);
      this.stoveDish.push(d);
    });
    for (let i = 0; i < 8; i++) {
      const d = dishBox();
      const p = PASS_SLOT(i);
      d.position.set(p.x, p.y, p.z);
      scene.add(d);
      this.passDish.push(d);
    }
  }

  update(g: GameSnapshot): void {
    g.seats.forEach((seat, i) => {
      const grp = this.seatGroups[i]!;
      const bar = this.bars[i]!;
      grp.visible = bar.visible = seat !== null;
      if (!seat) return;
      setShirt(grp, STATE_COLOR[seat.s]);
      const m = bar.material;
      m.color.setHex(seat.p > 0.5 ? 0x2ecc71 : seat.p > 0.25 ? 0xf1c40f : 0xe74c3c);
      bar.scale.set(Math.max(0.02, seat.p) * 0.9, 0.1, 1);
      bar.visible = seat.s !== "eating";
    });
    this.queue.forEach((q, i) => (q.visible = i < g.queue));

    const byId = new Map(g.tickets.map((t) => [t.id, t]));
    g.stoves.forEach((id, i) => {
      const d = this.stoveDish[i]!;
      const t = id === null ? undefined : byId.get(id);
      d.visible = !!t;
      if (!t) return;
      (d.material as THREE.MeshLambertMaterial).color.setHex(t.status === "cooking" ? 0xe74c3c : DISH_COLOR[t.dish]);
      d.scale.y = t.status === "cooking" ? 0.5 : 1;
    });
    const onPass = g.tickets.filter((t) => t.status === "pass").sort((a, b) => a.id - b.id);
    this.passDish.forEach((d, i) => {
      const t = onPass[i];
      d.visible = !!t;
      if (t) (d.material as THREE.MeshLambertMaterial).color.setHex(DISH_COLOR[t.dish]);
    });
  }
}
