// Вариант «WebGPU» на экране: react-native-webgpu (Dawn: Vulkan на Android) и Three.js WebGPURenderer.
import { useEffect, useRef } from 'react';
import { PixelRatio, Platform, StyleSheet } from 'react-native';
import { Canvas, type CanvasRef } from 'react-native-webgpu';
import * as THREE from 'three/webgpu';
import { crowd, step } from '../../sim/crowd';
import type { People } from '../../load';
import type { Detail } from '../hall';
import { loop, type Sink } from '../loop';
import { buildGPU } from './scene';

type Props = { people: People; count: number; detail: Detail; onFrame: Sink; onError: (e: string) => void };

export function GPUScene({ people, count, detail, onFrame, onError }: Props) {
  const ref = useRef<CanvasRef>(null);
  const sink = useRef(onFrame);
  useEffect(() => {
    sink.current = onFrame;
  }, [onFrame]);
  useEffect(() => {
    let stop: (() => void) | null = null;
    let renderer: THREE.WebGPURenderer | null = null;
    let cancelled = false;
    void (async () => {
      try {
        const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
        // в браузере без WebGPU (сценарий tools/e2e; в Chromium без окна navigator.gpu есть, а адаптера нет) Three.js сам
        // переходит на WebGL 2 — холсту нельзя сначала давать контекст WebGPU: второй контекст холст не отдаст
        const fallback = Platform.OS === 'web' && !(gpu && (await gpu.requestAdapter()));
        const id = ref.current?.getContextId();
        const el = fallback ? (document.getElementById(`rnwgpu-canvas-${id}`) as HTMLCanvasElement | null) : null;
        const context = fallback ? null : ref.current?.getContext('webgpu');
        if (!el && !context) throw new Error('no webgpu context');
        const canvas = (el ?? context!.canvas) as unknown as { width: number; height: number; clientWidth: number; clientHeight: number };
        canvas.width = Math.round(canvas.clientWidth * PixelRatio.get());
        canvas.height = Math.round(canvas.clientHeight * PixelRatio.get());
        renderer = context
          ? new THREE.WebGPURenderer({ antialias: true, canvas: context.canvas as unknown as HTMLCanvasElement, context })
          : new THREE.WebGPURenderer({ antialias: true, canvas: el! });
        await renderer.init();
        if (cancelled) return;
        const b = buildGPU(people.pack, people.atlases, count, detail);
        b.setAspect(canvas.width / canvas.height);
        const c = crowd(count, people.pack.looks.map(l => l.walk), 1);
        const r = renderer;
        stop = loop((dt, t) => {
          step(c, dt);
          b.update(c, t);
          r.render(b.scene, b.camera);
          context?.present();
          return b.tris;
        }, (iv, cpu, tris) => sink.current(iv, cpu, tris));
      } catch (e) {
        onError(String((e as Error)?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
      renderer?.dispose();
    };
    // одна сцена на монтирование: смена варианта — новый ключ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Canvas ref={ref} style={StyleSheet.absoluteFill} />;
}
