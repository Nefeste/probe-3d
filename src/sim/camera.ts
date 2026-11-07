// Камера пробы (docs/spec.md, «Сцена»): одна для всех вариантов. Three.js строит из этих чисел PerspectiveCamera;
// Skia проецирует людей тем же расчётом (project) — тест сверяет его с Three.js.
export const CAMERA = {
  eye: [0, 8.5, 15.5] as const,
  target: [0, 0.6, -0.5] as const,
  fovY: 42,
  near: 0.1,
  far: 80,
};

/** Фон для Skia запечён шире любого телефона: при той же вертикали угла обзора лишнее по бокам обрезается. */
export const BAKE_ASPECT = 2.4;

export type View = {
  r: [number, number, number];
  u: [number, number, number];
  f: [number, number, number];
  eye: readonly [number, number, number];
  /** тангенс половины вертикального угла */
  t: number;
};

function norm(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a: readonly number[], b: readonly number[]): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function view(): View {
  const e = CAMERA.eye;
  const g = CAMERA.target;
  const f = norm([g[0] - e[0], g[1] - e[1], g[2] - e[2]]);
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  return { r, u, f, eye: e, t: Math.tan((CAMERA.fovY * Math.PI) / 360) };
}

/** Точка мира → экран (w × h точек, y вниз): x, y, глубина вдоль взгляда и точек на метр на этой глубине — в out[o…o+3]. */
export function project(v: View, w: number, h: number, x: number, y: number, z: number, out: Float32Array, o: number): void {
  const dx = x - v.eye[0];
  const dy = y - v.eye[1];
  const dz = z - v.eye[2];
  const depth = dx * v.f[0] + dy * v.f[1] + dz * v.f[2];
  const sx = dx * v.r[0] + dy * v.r[1] + dz * v.r[2];
  const sy = dx * v.u[0] + dy * v.u[1] + dz * v.u[2];
  const ppu = h / (2 * v.t * depth);
  out[o] = w / 2 + sx * ppu;
  out[o + 1] = h / 2 - sy * ppu;
  out[o + 2] = depth;
  out[o + 3] = ppu;
}

/** Угол, под которым камера видит пол: нужен запеканию спрайтов людей (tools/bake). */
export function pitch(): number {
  const v = view();
  return Math.asin(-v.f[1]);
}
