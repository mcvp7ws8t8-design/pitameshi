// ゲームの状態(サーバーから届く GameSnapshot)を3Dの店に映す。
// 席のお客さん・入口の行列・コンロの料理・受け渡し台の料理・ドリンクバー・席の番号。

import * as THREE from "three";
import { partIndex, partTicket, type GameSnapshot } from "../shared/game";
import { BARS, CUTS, FRIDGE, PASS, PASS_SLOT, QUEUE_MAX_SHOWN, SEATS, STOVES, queueSpot, seatLabel } from "../shared/layout";
import { METHOD_NAME } from "../shared/menu";
import { makeDish, makeDrink, makeIngredient } from "./items";
import { zukanEquipment } from "./zukan";
import { dishColorHex } from "./items";
import type { Kitchen } from "./kitchen";
import { Effects } from "./effects";
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

/** 丸い札に文字を入れた、常にこちらを向く看板 */
function tagSprite(text: string, size: number, color = "#222"): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(4, 4, 120, 56, 28);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  let px = 36;
  ctx.font = `bold ${px}px sans-serif`;
  while (ctx.measureText(text).width > 100 && px > 14) ctx.font = `bold ${(px -= 2)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }));
  s.scale.set(size, size / 2, 1);
  return s;
}

// 調理中の調理器具(「3Dキッチン」の道具)。[モデル, 食材を置く高さ]
const COOKWARE = { grill: ["frying_pan", 0.012], boil: ["pot_water", 0.17], fry: ["fry_basket", 0.045] } as const;
function cookware(kind: "grill" | "boil" | "fry"): [THREE.Group, number] {
  const [id, y] = COOKWARE[kind];
  return [zukanEquipment(id)!.clone(true), y];
}

/** 入れ物の中身を、キー(種類)が変わったときだけ作り直す */
class Slot {
  private key = "";
  readonly group = new THREE.Group();
  constructor(parent: THREE.Object3D, x: number, y: number, z: number) {
    this.group.position.set(x, y, z);
    parent.add(this.group);
  }
  reset() {
    this.key = "\0";
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
  readonly effects: Effects;
  private seatState: string[] = [];
  private seatPeople: Person[] = [];
  private seatLook: number[] = [];
  private bars: THREE.Sprite[] = [];
  private bubbles: THREE.Sprite[] = [];
  private drinkMarks: THREE.Sprite[] = [];
  private tableDish: Slot[] = [];
  private tableDrink: Slot[] = [];
  private queue: THREE.Group[] = [];
  private stoveSlot: Slot[] = [];
  private boardSlot: Slot[] = [];
  private barSlot: Slot[] = [];
  private passSlot: Slot[] = [];

  constructor(scene: THREE.Scene, private kitchen: Kitchen) {
    this.effects = new Effects(scene);
    SEATS.forEach((s, i) => {
      const back = s.yaw === 0 ? 1 : -1; // 背もたれ側
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

      const label = tagSprite(seatLabel(i), 0.34);
      label.position.set(s.x, 2.2, s.z);
      scene.add(label);

      // テーブルの上(座った人の正面。右手側にドリンク)
      const fx = -Math.sin(s.yaw) * 0.55;
      const fz = -Math.cos(s.yaw) * 0.55;
      const rx = Math.cos(s.yaw) * 0.22;
      const rz = -Math.sin(s.yaw) * 0.22;
      this.tableDish.push(new Slot(scene, s.x + fx - rx * 0.3, 0.79, s.z + fz - rz * 0.3));
      this.tableDrink.push(new Slot(scene, s.x + fx + rx, 0.79, s.z + fz + rz));
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

    STOVES.forEach((s) => {
      // コンロ・フライヤーの天板の中心(kitchen.ts の置き場所と同じ)
      const back = s.kind !== "boil";
      this.stoveSlot.push(new Slot(scene, back ? s.x : s.x - 0.2, 0.9, back ? s.z - 0.2 : s.z));
      const tag = tagSprite(`${METHOD_NAME[s.kind]}${STOVES.filter((x, k) => x.kind === s.kind && k <= STOVES.indexOf(s)).length}`, 0.5, s.kind === "grill" ? "#a5471b" : s.kind === "boil" ? "#2a6f97" : "#9a7413");
      tag.position.set(s.x, 1.6, s.z);
      scene.add(tag);
    });
    CUTS.forEach((s, i) => {
      this.boardSlot.push(new Slot(scene, 9.3, 0.93, s.z));
      const tag = tagSprite(`切る${i + 1}`, 0.4, "#6b7a2a");
      tag.position.set(9.3, 1.35, s.z);
      scene.add(tag);
    });
    BARS.forEach((s) => this.barSlot.push(new Slot(scene, 9.4, 1.06, s.z)));
    const fridgeTag = tagSprite("冷蔵庫", 0.6, "#2f6f8f");
    fridgeTag.position.set(FRIDGE.x, 2.3, FRIDGE.z + 0.6);
    scene.add(fridgeTag);
    const platingTag = tagSprite("盛り付け", 0.6, "#6a4a8a");
    platingTag.position.set(PASS.kitchen.x, 1.75, PASS.kitchen.z + 0.9);
    scene.add(platingTag);
    for (let i = 0; i < 8; i++) {
      const p = PASS_SLOT(i);
      this.passSlot.push(new Slot(scene, p.x, p.y - 0.01, p.z));
    }
  }

  /** 毎フレーム呼ぶ。お客さんの動き(食べる・手を挙げる)と、湯気や煙 */
  tick(dt: number, time: number): void {
    this.effects.update(dt);
    this.seatPeople.forEach((p, i) => {
      const st = this.seatState[i];
      if (!st) return;
      const phase = time * 1.4 + i * 1.7;
      if (st === "eating") {
        // 食べる: 右手を口もとへ上げ下げ
        p.armR.rotation.x = -1.0 - Math.max(0, Math.sin(phase * 1.6)) * 0.9;
        p.armL.rotation.x = -0.75;
      } else if (st === "waitOrder") {
        // 注文したくて手を挙げる
        p.armR.rotation.x = -2.7 + Math.sin(phase * 3) * 0.15;
        p.armL.rotation.x = -0.75;
      } else {
        p.armR.rotation.x = p.armL.rotation.x = -0.75 + Math.sin(phase) * 0.04;
      }
    });
    this.queue.forEach((q, i) => {
      if (q.visible) q.rotation.y = Math.PI + (((i * 37) % 11) - 5) * 0.04 + Math.sin(time * 0.6 + i * 2.1) * 0.05;
    });
  }

  /** 素材(食材のモデル)が読み込めたときに、作り直してもらう */
  invalidate(): void {
    for (const slots of [this.tableDish, this.tableDrink, this.stoveSlot, this.boardSlot, this.barSlot, this.passSlot]) for (const s of slots) s.reset();
  }

  update(g: GameSnapshot): void {
    g.seats.forEach((seat, i) => {
      const person = this.seatPeople[i]!;
      const bar = this.bars[i]!;
      const bubble = this.bubbles[i]!;
      person.group.visible = seat !== null;
      if (!seat) this.seatState[i] = "";
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
      this.seatState[i] = seat.s;
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
    this.kitchen.rail.set(
      g.tickets
        .filter((t) => t.kind === "food" && t.status === "new")
        .sort((a, b) => a.id - b.id)
        .map((t, i) => ({ color: dishColorHex(t.item), late: i < 2 && g.tickets.length > 8 })),
    );
    g.stoves.forEach((id, i) => {
      const part = id === null ? undefined : byId.get(partTicket(id))?.parts?.[partIndex(id)];
      const cooking = part?.st === "cooking";
      const kind = STOVES[i]!.kind;
      this.stoveSlot[i]!.set(!part || id === null ? "" : `${id}${part.st}`, () => {
        if (!part) return null;
        const g2 = new THREE.Group();
        if (cooking) {
          const [ware, y] = cookware(kind);
          g2.add(ware);
          const raw = makeIngredient(part.ing, false, true);
          raw.scale.setScalar(0.8);
          raw.position.y = y;
          g2.add(raw);
        } else {
          // できあがり。小皿にのせて置いてある
          g2.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.015, 20), new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.25 })));
          const done = makeIngredient(part.ing, true, true);
          done.position.y = 0.012;
          g2.add(done);
        }
        return g2;
      });
      for (const m of this.kitchen.burners[i] ?? []) m.emissiveIntensity = cooking ? 1.6 : 0;
      this.effects.setStation(i, cooking);
    });
    g.boards.forEach((id, i) => {
      const part = id === null ? undefined : byId.get(partTicket(id))?.parts?.[partIndex(id)];
      this.boardSlot[i]!.set(!part || id === null ? "" : `${id}${part.st}`, () => {
        if (!part) return null;
        // 切っている間は丸ごと、切り終わると小さく切った形
        return makeIngredient(part.ing, false, part.st === "chopped");
      });
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
