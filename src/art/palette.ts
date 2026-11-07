// Цвета зала (docs/spec.md, «Сцена»): одна таблица на все варианты. Номер области — в hall.gen.ts (blender/build.py,
// REGIONS — тот же порядок). Цвет грани = цвет области × затенение вершины × свет сцены.
export const REGIONS = ['floorA', 'floorB', 'wall', 'skirting', 'wood', 'metal', 'fabric', 'leaf', 'pot', 'desk'] as const;

export const COLORS: Record<(typeof REGIONS)[number], string> = {
  floorA: '#d8d4c8',
  floorB: '#bfc8c4',
  wall: '#e9e4d8',
  skirting: '#6f7d80',
  wood: '#b07d4f',
  metal: '#8a9396',
  fabric: '#4f7f9a',
  leaf: '#5d9a52',
  pot: '#b8674a',
  desk: '#d9cdb4',
};

export const SKY = '#f1efe8';

/** Цвет области — линейный RGB 0…1 (sRGB → линейный). */
export function linear(hex: string): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    out[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return out;
}
