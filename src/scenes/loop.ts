// Кадры варианта (docs/spec.md, «Что меряем»): requestAnimationFrame, на каждый кадр — шаг толпы и отрисовка; наружу —
// промежуток между кадрами и время процессора на кадр, мс.
export type Sink = (intervalMs: number, cpuMs: number, tris: number) => void;

export function loop(frame: (dt: number, t: number) => number, sink: Sink): () => void {
  let last = 0;
  let raf = 0;
  let stopped = false;
  let t = 0;
  const tick = (now: number) => {
    if (stopped) return;
    const iv = last ? now - last : 16.7;
    last = now;
    t += Math.min(iv, 50) / 1000;
    const c0 = performance.now();
    const tris = frame(Math.min(iv, 50) / 1000, t);
    sink(iv, performance.now() - c0, tris);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
