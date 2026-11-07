// Толпа (src/sim/crowd.ts): одинаковая при одном зерне, люди в зале и не в колоннах.
import { expect, test } from 'bun:test';
import { AREA, STRIDE, crowd, step } from '../../src/sim/crowd';

const walk = [1.3, 1.2, 1.3, 1.2, 1.3, 1.2];

test('одно зерно — одна толпа', () => {
  const a = crowd(150, walk, 7);
  const b = crowd(150, walk, 7);
  for (let i = 0; i < 600; i++) {
    step(a, 1 / 60);
    step(b, 1 / 60);
  }
  expect(Array.from(a.s)).toEqual(Array.from(b.s));
});

test('люди не выходят из зала и не стоят в колоннах', () => {
  const c = crowd(150, walk, 3);
  for (let i = 0; i < 3600; i++) {
    step(c, 1 / 60);
    for (let k = 0; k < c.n; k++) {
      const x = c.s[k * STRIDE], z = c.s[k * STRIDE + 1];
      expect(x > AREA.x0 - 0.5 && x < AREA.x1 + 0.5 && z > AREA.z0 - 0.5 && z < AREA.z1 + 0.5).toBe(true);
      expect(Math.abs(x - 0) < 0.6 && Math.abs(z + 2.5) < 0.6).toBe(false);
    }
  }
});

test('виды по кругу', () => {
  const c = crowd(12, walk, 1);
  for (let k = 0; k < 12; k++) expect(c.s[k * STRIDE + 6]).toBe(k % 6);
});
