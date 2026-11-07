// Люди пробы (assets/people/people.bin): файл читается, в нём шесть видов «Больницы» с шагом и покоем, геометрия
// цела; кадры анимации — внутри текстуры костей.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodePack, encodePack, frameOf } from '../../src/people/pack';
import { LOOKS } from '../../src/people/cast';

const file = readFileSync(join(import.meta.dir, '../../assets/people/people.bin'));
const pack = decodePack(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);

test('шесть видов, по таблице cast.ts', () => {
  expect(pack.looks.map(l => l.name)).toEqual(LOOKS.map(l => l.name));
});

test('записать и прочитать — тот же файл', () => {
  expect(Buffer.from(encodePack(pack)).equals(file)).toBe(true);
});

test('геометрия: индексы внутри вершин, веса суставов в сумме 1, атлас — WebP', () => {
  for (const l of pack.looks) {
    for (const g of [l.full, l.lod]) {
      const n = g.position.length / 3;
      expect(g.normal.length).toBe(n * 3);
      expect(g.uv.length).toBe(n * 2);
      let max = 0;
      for (const i of g.index) max = Math.max(max, i);
      expect(max).toBeLessThan(n);
      for (let v = 0; v < n; v += 97) {
        const w = g.skinWeight[v * 4] + g.skinWeight[v * 4 + 1] + g.skinWeight[v * 4 + 2] + g.skinWeight[v * 4 + 3];
        expect(w).toBeCloseTo(1, 2);
        for (let k = 0; k < 4; k++) expect(g.skinIndex[v * 4 + k]).toBeLessThan(pack.stride);
      }
    }
    expect(l.lod.index.length).toBeLessThan(l.full.index.length / 4);
    expect(String.fromCharCode(...l.atlas.slice(8, 12))).toBe('WEBP');
  }
});

test('кадры шага и покоя — в текстуре костей', () => {
  const frames = (pack.boneW * pack.boneH) / (pack.stride * 3);
  const out = new Float32Array(3);
  for (const l of pack.looks) {
    for (const c of [l.idle, l.walkClip]) {
      for (let t = 0; t < 5; t += 0.13) {
        frameOf(c, t, out, 0);
        expect(out[0]).toBeGreaterThanOrEqual(c.start);
        expect(out[1]).toBeLessThan(c.start + c.frames);
        expect(out[0]).toBeLessThan(frames);
      }
    }
  }
});
