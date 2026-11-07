// Вариант «Skia» (docs/spec.md, «Вариант Skia»): 3D заранее — фон зала и спрайты людей запечены тем же Three.js
// (tools/bake). На каждый кадр JS шагает толпу и записывает картинку: фон, затем люди одним drawAtlas от дальних к
// ближним. Кадры экрана рисует поток интерфейса — их и меряем (useFrameCallback), процессор — время записи на JS.
import { Canvas, Picture, Skia, useImage, type SkPicture, type SkRect, type SkRSXform } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DIRS, LOOKS, PER_DIR, PX_PER_M, dirOf, footAnchor, frameAt, idleSprite, walkSprite, FRAME_H, FRAME_W } from '../../art/sprites';
import { BAKE_ASPECT, project, view } from '../../sim/camera';
import { STRIDE, crowd, step } from '../../sim/crowd';
import { frameOf } from '../../people/pack';
import type { People } from '../../load';
import { loop, type Sink } from '../loop';

type Props = { people: People; count: number; onFrame: Sink; onError: (e: string) => void };

export function SkiaScene({ people, count, onFrame, onError }: Props) {
  const { width: w, height: h } = useWindowDimensions();
  const bg = useImage(require('../../../assets/bake/hall.png'), e => onError(e.message));
  const sprites = useImage(require('../../../assets/bake/people.png'), e => onError(e.message));
  // Пустая стартовая картинка — записью с beginRecording: без него нативная Skia отдаёт пустой указатель и падает
  // (0.1.1 на телефоне; CanvasKit в браузере это прощал). useMemo — чтобы не записывать её на каждой отрисовке.
  const empty = useMemo(() => {
    const r = Skia.PictureRecorder();
    r.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    return r.finishRecordingAsPicture();
  }, []);
  const pic = useSharedValue<SkPicture>(empty);
  const cpu = useRef(0);
  const sink = useRef(onFrame);
  useEffect(() => {
    sink.current = onFrame;
  }, [onFrame]);
  const report = (iv: number) => sink.current(iv, cpu.current, 0);
  const last = useSharedValue(0);
  useFrameCallback(f => {
    'worklet';
    const now = f.timestamp;
    if (last.value > 0) scheduleOnRN(report, now - last.value);
    last.value = now;
  });

  const rects = useMemo(() => {
    const out: SkRect[] = [];
    for (let l = 0; l < LOOKS; l++) for (let d = 0; d < DIRS; d++) for (let f = 0; f < PER_DIR; f++) {
      const [x, y] = frameAt(l, d, f);
      out.push(Skia.XYWHRect(x, y, FRAME_W, FRAME_H));
    }
    return out;
  }, []);

  useEffect(() => {
    if (!bg || !sprites) return;
    const v = view();
    const c = crowd(count, people.pack.looks.map(l => l.walk), 1);
    const xf: SkRSXform[] = Array.from({ length: count }, () => Skia.RSXform(1, 0, 0, 0));
    const proj = new Float32Array(count * 4);
    const order = Array.from({ length: count }, (_, i) => i);
    const anim = new Float32Array(3);
    const [ax, ay] = footAnchor();
    // фон: та же вертикаль угла обзора, по бокам — обрезка под экран
    const k = h / bg.height();
    const vis = Math.min(bg.width(), w / k);
    const src = Skia.XYWHRect((bg.width() - vis) / 2, 0, vis, bg.height());
    const dst = Skia.XYWHRect(0, 0, w, h);
    const paint = Skia.Paint();
    const bounds = Skia.XYWHRect(0, 0, w, h);
    const srcs: SkRect[] = new Array(count);
    const dsts: SkRSXform[] = new Array(count);
    void BAKE_ASPECT;
    return loop(dt => {
      const t0 = performance.now();
      step(c, dt);
      const s = c.s;
      for (let i = 0; i < count; i++) project(v, w, h, s[i * STRIDE], 0, s[i * STRIDE + 1], proj, i * 4);
      order.sort((a, b) => proj[b * 4 + 2] - proj[a * 4 + 2]);
      for (let j = 0; j < count; j++) {
        const i = order[j];
        const o = i * STRIDE;
        const look = s[o + 6];
        const L = people.pack.looks[look];
        const idle = s[o + 4] > 0;
        const clip = idle ? L.idle : L.walkClip;
        frameOf(clip, s[o + 5] + i * 0.37, anim, 0);
        const fr = idle ? idleSprite(anim[0] - clip.start, clip.frames) : walkSprite(anim[0] - clip.start, clip.frames);
        const d = dirOf(s[o + 2]);
        srcs[j] = rects[(look * DIRS + d) * PER_DIR + fr];
        const sc = proj[i * 4 + 3] / PX_PER_M;
        xf[j].set(sc, 0, proj[i * 4] - ax * sc, proj[i * 4 + 1] - ay * sc);
        dsts[j] = xf[j];
      }
      const rec = Skia.PictureRecorder();
      const cv = rec.beginRecording(bounds);
      cv.drawImageRect(bg, src, dst, paint);
      cv.drawAtlas(sprites, srcs, dsts, paint);
      pic.value = rec.finishRecordingAsPicture();
      cpu.current = performance.now() - t0;
      return 0;
    }, () => {});
  }, [bg, sprites, count, people, w, h, rects, pic]);

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={pic} />
    </Canvas>
  );
}
