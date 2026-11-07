// Спрайты людей для варианта Skia (docs/spec.md, «Вариант Skia»): каждый вид отрендерен заранее тем же Three.js, что
// вариант WebGL (tools/bake), — 8 направлений, 12 кадров шага и 4 кадра покоя, кадр 48 × 96. В строке атласа — два
// направления; атлас 1536 × 2304. Один код раскладки для запекания и для Skia.
import { pitch } from '../sim/camera';

export const FRAME_W = 48;
export const FRAME_H = 96;
export const DIRS = 8;
export const WALK_FRAMES = 12;
export const IDLE_FRAMES = 4;
export const PER_DIR = WALK_FRAMES + IDLE_FRAMES;
export const LOOKS = 6;
export const COLS = PER_DIR * 2;
export const ROWS = LOOKS * (DIRS / 2);
export const ATLAS_W = FRAME_W * COLS;
export const ATLAS_H = FRAME_H * ROWS;
/** Ортокамера запекания: высота кадра в метрах и где у кадра середина по высоте над полом. */
export const SPAN_M = 2.2;
export const CENTER_Y = 0.95;
export const PX_PER_M = FRAME_H / SPAN_M;

/** Левый верхний угол кадра: вид l, направление d, кадр f (0…11 — шаг, 12…15 — покой). */
export function frameAt(l: number, d: number, f: number): [number, number] {
  const col = (d % 2) * PER_DIR + f;
  const row = l * (DIRS / 2) + Math.floor(d / 2);
  return [col * FRAME_W, row * FRAME_H];
}

/** Направление 0…7 по курсу (0 — лицом к зрителю, +z). */
export function dirOf(course: number): number {
  const step = (2 * Math.PI) / DIRS;
  return ((Math.round(course / step) % DIRS) + DIRS) % DIRS;
}

export const courseOf = (d: number): number => (d * 2 * Math.PI) / DIRS;

/** Где в кадре ступни: по ширине — середина, по высоте — ниже середины на проекцию CENTER_Y под углом камеры. */
export function footAnchor(): [number, number] {
  return [FRAME_W / 2, FRAME_H / 2 + CENTER_Y * Math.cos(pitch()) * PX_PER_M];
}

/** Кадр шага и покоя по номеру кадра в клипе (0…frames−1) → номер кадра спрайта. */
export function walkSprite(frame: number, frames: number): number {
  return Math.min(WALK_FRAMES - 1, Math.floor((frame / Math.max(1, frames - 1)) * WALK_FRAMES));
}

export function idleSprite(frame: number, frames: number): number {
  return WALK_FRAMES + Math.min(IDLE_FRAMES - 1, Math.floor((frame / Math.max(1, frames - 1)) * IDLE_FRAMES));
}
