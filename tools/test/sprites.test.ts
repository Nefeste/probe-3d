// Раскладка спрайтов (src/art/sprites.ts): кадры не накладываются и лежат в атласе; направления — по кругу.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ATLAS_H, ATLAS_W, DIRS, FRAME_H, FRAME_W, LOOKS, PER_DIR, courseOf, dirOf, frameAt, idleSprite, walkSprite, WALK_FRAMES } from '../../src/art/sprites';

test('все кадры — в атласе и разные', () => {
  const seen = new Set<string>();
  for (let l = 0; l < LOOKS; l++) for (let d = 0; d < DIRS; d++) for (let f = 0; f < PER_DIR; f++) {
    const [x, y] = frameAt(l, d, f);
    expect(x + FRAME_W).toBeLessThanOrEqual(ATLAS_W);
    expect(y + FRAME_H).toBeLessThanOrEqual(ATLAS_H);
    seen.add(`${x},${y}`);
  }
  expect(seen.size).toBe(LOOKS * DIRS * PER_DIR);
});

test('атлас — того размера, что раскладка', () => {
  const png = readFileSync(join(import.meta.dir, '../../assets/bake/people.png'));
  expect(png.readUInt32BE(16)).toBe(ATLAS_W);
  expect(png.readUInt32BE(20)).toBe(ATLAS_H);
});

test('направление по курсу и обратно', () => {
  for (let d = 0; d < DIRS; d++) expect(dirOf(courseOf(d))).toBe(d);
  expect(dirOf(-0.1)).toBe(0);
  expect(dirOf(Math.PI * 2 - 0.1)).toBe(0);
});

test('кадры клипа — в своих рядах', () => {
  expect(walkSprite(0, 33)).toBe(0);
  expect(walkSprite(32, 33)).toBe(WALK_FRAMES - 1);
  expect(idleSprite(0, 42)).toBe(WALK_FRAMES);
  expect(idleSprite(41, 42)).toBe(PER_DIR - 1);
});
