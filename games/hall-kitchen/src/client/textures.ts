// 床・壁・天板などの質感。画像ファイルは使わず、Canvas に描いて作る。
// 乱数は固定のシードなので、毎回同じ見た目になる。

import * as THREE from "three";

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!];
}

function toTexture(c: HTMLCanvasElement, repeatX: number, repeatY: number, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const hsl = (h: number, s: number, l: number) => `hsl(${h} ${s}% ${l}%)`;

function noise(ctx: CanvasRenderingContext2D, size: number, r: () => number, amount: number) {
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amount;
    img.data[i]! += n;
    img.data[i + 1]! += n;
    img.data[i + 2]! += n;
  }
  ctx.putImageData(img, 0, 0);
}

export interface PBRMaps {
  map: THREE.Texture;
  bump: THREE.Texture;
}

/** 板張りの床。1枚で 2m × 2m ぶん */
export function woodFloor(repeatX: number, repeatY: number): PBRMaps {
  const S = 512;
  const r = rng(11);
  const [c, ctx] = canvas(S);
  const [b, bctx] = canvas(S);
  bctx.fillStyle = "#999";
  bctx.fillRect(0, 0, S, S);
  const planks = 8;
  const h = S / planks;
  for (let row = 0; row < planks; row++) {
    const cuts = [0, 0.35 + r() * 0.3, 1];
    for (let k = 0; k < 2; k++) {
      const x0 = cuts[k]! * S + (row % 2 ? 0 : 0);
      const w = (cuts[k + 1]! - cuts[k]!) * S;
      const hue = 28 + r() * 8;
      const light = 36 + r() * 12;
      ctx.fillStyle = hsl(hue, 45, light);
      ctx.fillRect(x0, row * h, w, h);
      for (let g = 0; g < 26; g++) {
        ctx.strokeStyle = `hsla(${hue} 40% ${light - 10 + r() * 6}% / ${0.15 + r() * 0.2})`;
        ctx.lineWidth = 0.6 + r() * 1.2;
        const y = row * h + r() * h;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.bezierCurveTo(x0 + w * 0.3, y + (r() - 0.5) * 3, x0 + w * 0.6, y + (r() - 0.5) * 3, x0 + w, y + (r() - 0.5) * 2);
        ctx.stroke();
      }
      // 板のすき間
      ctx.fillStyle = "rgba(20,10,4,0.75)";
      ctx.fillRect(x0, row * h, w, 1.5);
      ctx.fillRect(x0, row * h, 1.5, h);
      bctx.fillStyle = "#222";
      bctx.fillRect(x0, row * h, w, 2);
      bctx.fillRect(x0, row * h, 2, h);
    }
  }
  noise(ctx, S, r, 14);
  return { map: toTexture(c, repeatX, repeatY, true), bump: toTexture(b, repeatX, repeatY, false) };
}

/** 白いタイル(キッチンの床と壁)。1枚で 1m × 1m、4×4 枚 */
export function tiles(repeatX: number, repeatY: number, base = 232): PBRMaps {
  const S = 512;
  const r = rng(23);
  const [c, ctx] = canvas(S);
  const [b, bctx] = canvas(S);
  ctx.fillStyle = "#8d9399";
  ctx.fillRect(0, 0, S, S);
  bctx.fillStyle = "#222";
  bctx.fillRect(0, 0, S, S);
  const n = 4;
  const t = S / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = base - r() * 14;
      ctx.fillStyle = `rgb(${v} ${v + 2} ${v + 4})`;
      ctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
      bctx.fillStyle = "#bbb";
      bctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
    }
  }
  noise(ctx, S, r, 8);
  return { map: toTexture(c, repeatX, repeatY, true), bump: toTexture(b, repeatX, repeatY, false) };
}

/** 塗り壁。ごく細かいムラ */
export function plaster(color: string, repeatX: number, repeatY: number): PBRMaps {
  const S = 256;
  const r = rng(5);
  const [c, ctx] = canvas(S);
  const [b, bctx] = canvas(S);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  bctx.fillStyle = "#888";
  bctx.fillRect(0, 0, S, S);
  noise(ctx, S, r, 10);
  noise(bctx, S, r, 60);
  return { map: toTexture(c, repeatX, repeatY, true), bump: toTexture(b, repeatX, repeatY, false) };
}

/** 木目(テーブル・カウンター・羽目板) */
export function woodGrain(hue: number, light: number, repeatX = 1, repeatY = 1): PBRMaps {
  const S = 256;
  const r = rng(hue * 7 + 3);
  const [c, ctx] = canvas(S);
  const [b, bctx] = canvas(S);
  ctx.fillStyle = hsl(hue, 42, light);
  ctx.fillRect(0, 0, S, S);
  bctx.fillStyle = "#999";
  bctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const y = r() * S;
    const a = 0.1 + r() * 0.25;
    ctx.strokeStyle = `hsla(${hue} 40% ${light - 14 + r() * 8}% / ${a})`;
    bctx.strokeStyle = `rgba(0,0,0,${a * 0.8})`;
    ctx.lineWidth = bctx.lineWidth = 0.5 + r() * 1.5;
    for (const k of [ctx, bctx]) {
      k.beginPath();
      k.moveTo(0, y);
      k.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 8, S * 0.7, y + (r() - 0.5) * 8, S, y + (r() - 0.5) * 4);
      k.stroke();
    }
  }
  return { map: toTexture(c, repeatX, repeatY, true), bump: toTexture(b, repeatX, repeatY, false) };
}

/** ステンレスのヘアライン */
export function steel(repeatX = 1, repeatY = 1): PBRMaps {
  const S = 256;
  const r = rng(77);
  const [c, ctx] = canvas(S);
  const [b, bctx] = canvas(S);
  ctx.fillStyle = "#b7bcc2";
  ctx.fillRect(0, 0, S, S);
  bctx.fillStyle = "#888";
  bctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) {
    const y = r() * S;
    const v = 150 + r() * 80;
    ctx.strokeStyle = `rgba(${v},${v},${v + 4},0.1)`;
    bctx.strokeStyle = `rgba(${v},${v},${v},0.12)`;
    for (const k of [ctx, bctx]) {
      k.lineWidth = 0.6;
      k.beginPath();
      k.moveTo(0, y);
      k.lineTo(S, y + (r() - 0.5) * 2);
      k.stroke();
    }
  }
  return { map: toTexture(c, repeatX, repeatY, true), bump: toTexture(b, repeatX, repeatY, false) };
}

/** 窓の外の景色(空と遠くの街並み)。光るだけの板に貼る */
export function outside(): THREE.Texture {
  const S = 256;
  const r = rng(99);
  const [c, ctx] = canvas(S);
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, "#7fb8ee");
  g.addColorStop(0.6, "#cfe6f7");
  g.addColorStop(1, "#f6ecd2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) {
    const w = 18 + r() * 30;
    const h = 40 + r() * 70;
    ctx.fillStyle = `hsl(${210 + r() * 20} 12% ${55 + r() * 15}%)`;
    ctx.fillRect(i * 30 + r() * 8, S - h, w, h);
  }
  return toTexture(c, 1, 1, true);
}

/** 黒板(今日のメニュー) */
export function chalkboard(lines: string[]): THREE.Texture {
  const S = 512;
  const [c, ctx] = canvas(S);
  ctx.fillStyle = "#26302b";
  ctx.fillRect(0, 0, S, S);
  noise(ctx, S, rng(3), 16);
  ctx.fillStyle = "#f2efe6";
  ctx.textAlign = "center";
  ctx.font = "bold 54px sans-serif";
  ctx.fillText(lines[0] ?? "", S / 2, 80);
  ctx.font = "34px sans-serif";
  lines.slice(1).forEach((l, i) => ctx.fillText(l, S / 2, 150 + i * 56));
  return toTexture(c, 1, 1, true);
}

/** 額縁の中の絵(抽象的な色面) */
export function painting(seed: number): THREE.Texture {
  const S = 256;
  const r = rng(seed);
  const [c, ctx] = canvas(S);
  ctx.fillStyle = hsl(r() * 360, 30, 85);
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = hsl(r() * 360, 45 + r() * 30, 35 + r() * 35);
    ctx.beginPath();
    ctx.arc(r() * S, r() * S, 30 + r() * 70, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c, 1, 1, true);
}
