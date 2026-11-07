// План замера (docs/spec.md, «Что меряем»): варианты по очереди, на каждом — разогрев, затем счёт кадров.
import { stats, type Stats } from './stats';

export const VARIANTS = ['webgl', 'webgpu', 'skia'] as const;
export type Variant = (typeof VARIANTS)[number];
export type DetailKind = 'full' | 'lod' | 'sprite';
export const WARM = 90;
export const MEASURE = 600;

export type Step = { variant: Variant; count: number; detail: DetailKind };
export type Result = Step & { stats?: Stats; firstFrameMs?: number; tris?: number; error?: string };

/** 40 человек полными моделями (как вблизи в «Больнице»), 150 — упрощёнными, 150 — спрайтами. */
export function plan(): Step[] {
  const out: Step[] = [];
  for (const variant of ['webgl', 'webgpu'] as const) {
    out.push({ variant, count: 40, detail: 'full' });
    out.push({ variant, count: 150, detail: 'lod' });
  }
  out.push({ variant: 'skia', count: 40, detail: 'sprite' });
  out.push({ variant: 'skia', count: 150, detail: 'sprite' });
  return out;
}

/** Счёт одного шага: кадры разогрева не считаются. */
export class Meter {
  private seen = 0;
  private iv: number[] = [];
  private cpu: number[] = [];
  constructor(readonly warm = WARM, readonly measure = MEASURE) {}
  /** false — шаг закончен. */
  frame(intervalMs: number, cpuMs: number): boolean {
    this.seen++;
    if (this.seen > this.warm) {
      this.iv.push(intervalMs);
      this.cpu.push(cpuMs);
    }
    return this.iv.length < this.measure;
  }
  get done(): boolean {
    return this.iv.length >= this.measure;
  }
  result(): Stats {
    return stats(this.iv, this.cpu);
  }
}
