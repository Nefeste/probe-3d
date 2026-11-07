// Общее для сцен: зал из Blender в числа для видеокарты, люди — поза экземпляра. Чистый TypeScript без Three.js:
// варианты WebGL и WebGPU строят из этого свои геометрии.
import { HALL } from '../art/hall.gen';
import { COLORS, REGIONS, linear } from '../art/palette';
import { STRIDE, type Crowd } from '../sim/crowd';
import { frameOf, type Pack } from '../people/pack';

/** Позиции, нормали граней и цвета вершин (цвет области × затенение), линейный RGB. */
export function hallArrays(): { pos: Float32Array; nrm: Float32Array; col: Float32Array } {
  const tris = HALL.reg.length;
  const pos = Float32Array.from(HALL.pos);
  const nrm = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  const lin = REGIONS.map(r => linear(COLORS[r]));
  for (let t = 0; t < tris; t++) {
    const c = lin[HALL.reg[t]];
    for (let k = 0; k < 3; k++) {
      const v = t * 3 + k;
      nrm[v * 3] = HALL.nrm[t * 3];
      nrm[v * 3 + 1] = HALL.nrm[t * 3 + 1];
      nrm[v * 3 + 2] = HALL.nrm[t * 3 + 2];
      // затенение — множитель в линейном свете (как в «Больнице»)
      const ao = (HALL.ao[v] / 255) ** 2.2;
      col[v * 3] = c[0] * ao;
      col[v * 3 + 1] = c[1] * ao;
      col[v * 3 + 2] = c[2] * ao;
    }
  }
  return { pos, nrm, col };
}

export type Detail = 'full' | 'lod';

/**
 * Позы людей вида `look`: на человека — x, z, cos и sin курса (pose) и кадры анимации A, B и доля (anim).
 * Возвращает, сколько людей этого вида.
 */
export function posesOf(c: Crowd, pack: Pack, look: number, t: number, pose: Float32Array, anim: Float32Array): number {
  const L = pack.looks[look];
  let k = 0;
  const s = c.s;
  for (let i = 0; i < c.n; i++) {
    const o = i * STRIDE;
    if (s[o + 6] !== look) continue;
    pose[k * 4] = s[o];
    pose[k * 4 + 1] = s[o + 1];
    pose[k * 4 + 2] = Math.cos(s[o + 2]);
    pose[k * 4 + 3] = Math.sin(s[o + 2]);
    frameOf(s[o + 4] > 0 ? L.idle : L.walkClip, s[o + 5] + i * 0.37, anim, k * 3);
    k++;
  }
  void t;
  return k;
}

/** Тень-пятно под человеком: радиальный спад, RGBA 64 × 64 (чёрный, прозрачность к краю). */
export function blobTexture(): Uint8Array {
  const n = 64;
  const out = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5) / n * 2 - 1;
      const dy = (y + 0.5) / n * 2 - 1;
      const r = Math.min(1, Math.hypot(dx, dy));
      const a = Math.max(0, 1 - r * r) ** 1.5;
      out[(y * n + x) * 4 + 3] = Math.round(a * 255);
    }
  }
  return out;
}
