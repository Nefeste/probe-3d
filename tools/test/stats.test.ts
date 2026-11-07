import { expect, test } from 'bun:test';
import { Meter } from '../../src/sim/bench';
import { stats } from '../../src/sim/stats';

test('медиана, 99 %, худший и доля долгих кадров', () => {
  const iv = [...Array(98).fill(16.7), 40, 100];
  const s = stats(iv, Array(100).fill(2));
  expect(s.medianMs).toBeCloseTo(16.7, 5);
  expect(s.p99Ms).toBe(40);
  expect(s.worstMs).toBe(100);
  expect(s.longShare).toBeCloseTo(0.02, 5);
  expect(s.cpuMedianMs).toBe(2);
});

test('разогрев не считается', () => {
  const m = new Meter(3, 5);
  for (let i = 0; i < 3; i++) m.frame(500, 1);
  for (let i = 0; i < 5; i++) m.frame(16, 1);
  expect(m.done).toBe(true);
  expect(m.result().worstMs).toBe(16);
});
