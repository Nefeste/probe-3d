// Люди в зале (docs/spec.md, «Сцена»): ходят от точки к точке по полу, иногда стоят. Одинаковые во всех вариантах:
// варианты различаются только отрисовкой. Случайность — своя, с зерном; шаг — плавный поворот к цели.
export const AREA = { x0: -11, x1: 11, z0: -6.6, z1: 7.5 } as const;
// где стоять нельзя: колонны и стойка (x0, z0, x1, z1)
const BLOCKS: readonly (readonly [number, number, number, number])[] = [
  [-6.6, -3.1, -5.4, -1.9], [-0.6, -3.1, 0.6, -1.9], [5.4, -3.1, 6.6, -1.9], [5.8, 2.6, 9.2, 3.8],
];
export const STRIDE = 8; // x z курс скорость ждёт(с) время-анимации вид цель-номер
const TURN = 3; // рад/с

export type Crowd = {
  n: number;
  s: Float32Array;
  /** цели: x, z */
  goal: Float32Array;
  /** скорость шага вида, м/с (bake.ts: ступня не скользит) */
  walk: readonly number[];
  next: () => number;
};

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function free(x: number, z: number): boolean {
  for (const b of BLOCKS) if (x > b[0] && x < b[2] && z > b[1] && z < b[3]) return false;
  return true;
}

function pick(c: Crowd, i: number): void {
  for (;;) {
    const x = AREA.x0 + (AREA.x1 - AREA.x0) * c.next();
    const z = AREA.z0 + (AREA.z1 - AREA.z0) * c.next();
    if (free(x, z)) {
      c.goal[i * 2] = x;
      c.goal[i * 2 + 1] = z;
      return;
    }
  }
}

/** n человек, виды — по кругу из `walk.length`. */
export function crowd(n: number, walk: readonly number[], seed = 1): Crowd {
  const c: Crowd = { n, s: new Float32Array(n * STRIDE), goal: new Float32Array(n * 2), walk, next: rng(seed) };
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE;
    pick(c, i);
    let x = 0, z = 0;
    do {
      x = AREA.x0 + (AREA.x1 - AREA.x0) * c.next();
      z = AREA.z0 + (AREA.z1 - AREA.z0) * c.next();
    } while (!free(x, z));
    c.s[o] = x;
    c.s[o + 1] = z;
    c.s[o + 2] = c.next() * Math.PI * 2;
    const look = i % walk.length;
    c.s[o + 3] = walk[look];
    c.s[o + 4] = c.next() < 0.25 ? c.next() * 3 : 0;
    c.s[o + 5] = c.next() * 10;
    c.s[o + 6] = look;
  }
  return c;
}

/** Курс: 0 — лицом к +z (к зрителю), против часовой, если смотреть сверху (как поворот Three.js вокруг y). */
export function step(c: Crowd, dt: number): void {
  dt = Math.min(dt, 0.05);
  const s = c.s;
  for (let i = 0; i < c.n; i++) {
    const o = i * STRIDE;
    s[o + 5] += dt;
    if (s[o + 4] > 0) {
      s[o + 4] -= dt;
      if (s[o + 4] <= 0) {
        s[o + 4] = 0;
        s[o + 5] = 0;
        pick(c, i);
      }
      continue;
    }
    const gx = c.goal[i * 2] - s[o];
    const gz = c.goal[i * 2 + 1] - s[o + 1];
    const d = Math.hypot(gx, gz);
    if (d < 0.3) {
      // дошёл: постоять 1–4 с или сразу дальше
      if (c.next() < 0.5) {
        s[o + 4] = 1 + c.next() * 3;
        s[o + 5] = 0;
      } else pick(c, i);
      continue;
    }
    const want = Math.atan2(gx, gz);
    let da = want - s[o + 2];
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const turn = Math.max(-TURN * dt, Math.min(TURN * dt, da));
    s[o + 2] += turn;
    // на крутом повороте — медленнее
    const v = s[o + 3] * (Math.abs(da) > 1.2 ? 0.5 : 1);
    const nx = s[o] + Math.sin(s[o + 2]) * v * dt;
    const nz = s[o + 1] + Math.cos(s[o + 2]) * v * dt;
    if (free(nx, nz)) {
      s[o] = nx;
      s[o + 1] = nz;
    } else pick(c, i);
  }
}

/** Стоит ли человек i (иначе идёт). */
export const standing = (c: Crowd, i: number): boolean => c.s[i * STRIDE + 4] > 0;
