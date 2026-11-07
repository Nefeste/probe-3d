// Числа замера (docs/spec.md, «Что меряем»): промежутки между кадрами и время процессора на кадр, мс.
export type Stats = {
  frames: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  worstMs: number;
  /** доля кадров дольше 25 мс (меньше 40 к/с) */
  longShare: number;
  cpuMedianMs: number;
  cpuP95Ms: number;
};

function q(sorted: Float64Array, p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

export const LONG_MS = 25;

export function stats(intervals: readonly number[], cpu: readonly number[]): Stats {
  const a = Float64Array.from(intervals).sort();
  const c = Float64Array.from(cpu).sort();
  let long = 0;
  for (const x of intervals) if (x > LONG_MS) long++;
  return {
    frames: a.length,
    medianMs: q(a, 0.5),
    p95Ms: q(a, 0.95),
    p99Ms: q(a, 0.99),
    worstMs: a.length ? a[a.length - 1] : 0,
    longShare: a.length ? long / a.length : 0,
    cpuMedianMs: q(c, 0.5),
    cpuP95Ms: q(c, 0.95),
  };
}
