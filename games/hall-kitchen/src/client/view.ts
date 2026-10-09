// ゲームの状態(サーバーから届く GameSnapshot)を3Dの店に映す。
// 席のお客さん・入口の行列・コンロの料理・受け渡し台の料理・ドリンクバー・席の番号。

import * as THREE from "three";
import { type GameSnapshot } from "../shared/game";
import { BARS, PASS_SLOT, QUEUE_MAX_SHOWN, SEATS, STOVES, queueSpot } from "../shared/layout";
import { makeDish, makeDrink } from "./items";
import { applyLook, bakePerson, buildPerson, lookFor, type Person } from "./people";

function bubbleTexture(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.beginPath();
  ctx.arc(64, 60, 52, 0, Math.PI * 2);
  ctx.moveTo(52, 108);
  ctx.lineTo(64, 126);
  ctx.lineTo(78, 108);
  ctx.fill();
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const BUBBLES = {
  // 注文を取ってほしい
  waitOrder: bubbleTexture((ctx) => {
    ctx.fillStyle = "#e6a000";
    ctx.font = "bold 84px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", 64, 66);
  }),
  // 料理を待っている
  waitFood: bubbleTexture((ctx) => {
    ctx.fillStyle = "#d9534f";
    for (const x of [38, 64, 90]) {
      ctx.beginPath();
      ctx.arc(x, 62, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }),
};

function sprite(color: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthWrite: false }));
  s.visible = false;
  return s;
}

function numberSprite(n: number): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.scale.set(0.3, 0.3, 1);
  return s;
}

function pan(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.4, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.05, 24), m);
  body.position.y = 0.03;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.03), m);
  handle.position.set(0.3, 0.05, 0);
  body.castShadow = handle.castShadow = true;
  g.add(body, handle);
  return g;
}

/** 入れ物の中身を、キー(種類)が変わったときだけ作り直す */
class Slot {
  private key = "";
  readonly group = new THREE.Group();
  constructor(parent: THREE.Object3D, x: number, y: number, z: number) {
    this.group.position.set(x, y, z);
    parent.add(this.group);
  }
  set(key: string, make: () => THREE.Object3D | null) {
    if (key === this.key) return;
    this.key = key;
    this.group.clear();
    const o = key ? make() : null;
    if (o) this.group.add(o);
  }
}

export class GameView {
  private seatPeople: Person[] = [];
  private seatLook: number[] = [];
  private bars: THREE.Sprite[] = [];
  private bubbles: THREE.Sprite[] = [];
  private drinkMarks: THREE.Sprite[] = [];
  private tableDish: Slot[] = [];
  private tableDrink: Slot[] = [];
  private queue: THREE.Group[] = [];
  private stoveSlot: Slot[] = [];
  private barSlot: Slot[] = [];
  private passSlot: Slot[] = [];

  constructor(scene: THREE.Scene, private burners: THREE.MeshStandardMaterial[][]) {
    SEATS.forEach((s, i) => {
      const back = s.z > 4 ? 1 : -1;
      const person = buildPerson(lookFor(0), "customer", true);
      person.group.position.set(s.x, 0.49, s.z + back * 0.08);
      person.group.rotation.y = s.yaw + Math.PI;
      person.group.visible = false;
      scene.add(person.group);
      this.seatPeople.push(person);
      this.seatLook.push(-1);

      const bar = sprite(0x2ecc71);
      bar.position.set(s.x, 1.62, s.z);
      scene.add(bar);
      this.bars.push(bar);

      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: BUBBLES.waitOrder, depthWrite: false }));
      bubble.position.set(s.x, 1.98, s.z);
      bubble.scale.set(0.42, 0.42, 1);
      bubble.visible = false;
      scene.add(bubble);
      this.bubbles.push(bubble);

      const mark = sprite(0x3fc1ff);
      mark.position.set(s.x + 0.38, 1.98, s.z);
      mark.scale.set(0.12, 0.2, 1);
      scene.add(mark);
      this.drinkMarks.push(mark);

      const label = numberSprite(i + 1);
      label.position.set(s.x, 2.4, s.z);
      scene.add(label);

      // テーブルの上(座った人の正面)
      const tz = s.z > 4 ? 4.3 : 3.7;
      this.tableDish.push(new Slot(scene, s.x - 0.05, 0.79, tz));
      this.tableDrink.push(new Slot(scene, s.x + 0.32, 0.79, tz + (s.z > 4 ? 0.1 : -0.1)));
    });

    for (let i = 0; i < QUEUE_MAX_SHOWN; i++) {
      const p = buildPerson(lookFor(1000 + i), "customer", false);
      const baked = bakePerson(p);
      const q = queueSpot(i);
      baked.position.set(q.x, 0, q.z);
      baked.rotation.y = Math.PI + (((i * 37) % 11) - 5) * 0.04;
      baked.visible = false;
      scene.add(baked);
      this.queue.push(baked);
    }

    STOVES.forEach((s) => this.stoveSlot.push(new Slot(scene, s.x - 0.45, 0.96, s.z)));
    BARS.forEach((s) => this.barSlot.push(new Slot(scene, 9.4, 1.06, s.z)));
    for (let i = 0; i < 8; i++) {
      const p = PASS_SLOT(i);
      this.passSlot.push(new Slot(scene, p.x, p.y - 0.01, p.z));
    }
  }

  update(g: GameSnapshot): void {
    g.seats.forEach((seat, i) => {
      const person = this.seatPeople[i]!;
      const bar = this.bars[i]!;
      const bubble = this.bubbles[i]!;
      person.group.visible = seat !== null;
      bar.visible = bubble.visible = false;
      this.drinkMarks[i]!.visible = false;
      if (!seat) {
        this.tableDish[i]!.set("", () => null);
        this.tableDrink[i]!.set("", () => null);
        this.seatLook[i] = -1;
        return;
      }
      if (this.seatLook[i] !== seat.id) {
        applyLook(person, lookFor(seat.id));
        this.seatLook[i] = seat.id;
      }
      const eating = seat.s === "eating";
      bar.visible = !eating;
      if (!eating) {
        bar.material.color.setHex(seat.p > 0.5 ? 0x2ecc71 : seat.p > 0.25 ? 0xf1c40f : 0xe74c3c);
        bar.scale.set(Math.max(0.02, seat.p) * 0.7, 0.08, 1);
        bubble.visible = true;
        bubble.material.map = seat.s === "waitOrder" ? BUBBLES.waitOrder : BUBBLES.waitFood;
        bubble.material.needsUpdate = true;
      }
      this.drinkMarks[i]!.visible = seat.d === 1;
      this.tableDish[i]!.set(eating ? `d${seat.id}` : "", () => makeDish(seat.dish));
      this.tableDrink[i]!.set(seat.d === 2 ? `k${seat.id}` : "", () => makeDrink(seat.drink));
    });
    this.queue.forEach((q, i) => (q.visible = i < g.queue));

    const byId = new Map(g.tickets.map((t) => [t.id, t]));
    g.stoves.forEach((id, i) => {
      const t = id === null ? undefined : byId.get(id);
      const cooking = t?.status === "cooking";
      this.stoveSlot[i]!.set(!t ? "" : `${cooking ? "pan" : "dish"}${t.id}`, () => (cooking ? pan() : makeDish(t!.item)));
      for (const m of this.burners[i] ?? []) m.emissiveIntensity = cooking ? 1.6 : 0;
    });
    g.bars.forEach((id, i) => {
      const t = id === null ? undefined : byId.get(id);
      const making = t?.status === "cooking";
      this.barSlot[i]!.set(!t ? "" : `${making ? "m" : "r"}${t.id}`, () => {
        const d = makeDrink(t!.item);
        if (making) d.scale.setScalar(0.7);
        return d;
      });
    });
    const onPass = g.tickets.filter((t) => t.status === "pass").sort((a, b) => a.id - b.id);
    this.passSlot.forEach((slot, i) => {
      const t = onPass[i];
      slot.set(t ? `p${t.id}` : "", () => {
        const d = makeDish(t!.item);
        d.scale.setScalar(0.85);
        return d;
      });
    });
  }
}
