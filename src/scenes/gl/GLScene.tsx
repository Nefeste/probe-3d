// Вариант «WebGL» на экране: expo-gl (WebGL 2 поверх OpenGL ES) и обычный Three.js WebGLRenderer.
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import * as THREE from 'three';
import { crowd, step } from '../../sim/crowd';
import type { People } from '../../load';
import type { Detail } from '../hall';
import { loop, type Sink } from '../loop';
import { buildGL } from './scene';

type Props = { people: People; count: number; detail: Detail; onFrame: Sink; onError: (e: string) => void };

export function GLScene({ people, count, detail, onFrame, onError }: Props) {
  const stop = useRef<(() => void) | null>(null);
  const sink = useRef(onFrame);
  useEffect(() => {
    sink.current = onFrame;
  }, [onFrame]);
  useEffect(() => () => stop.current?.(), []);
  const create = (gl: ExpoWebGLRenderingContext) => {
    try {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      // Three.js ждёт холст: у expo-gl его нет — хватает размеров и пустых обработчиков
      const canvas = { width: w, height: h, clientWidth: w, clientHeight: h, style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => gl } as unknown as HTMLCanvasElement;
      const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true });
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      const b = buildGL(people.pack, people.atlases, count, detail);
      b.setAspect(w / h);
      const c = crowd(count, people.pack.looks.map(l => l.walk), 1);
      stop.current = loop((dt, t) => {
        step(c, dt);
        b.update(c, t);
        renderer.render(b.scene, b.camera);
        gl.endFrameEXP();
        return b.tris;
      }, (iv, cpu, tris) => sink.current(iv, cpu, tris));
    } catch (e) {
      onError(String((e as Error)?.message ?? e));
    }
  };
  return <GLView style={StyleSheet.absoluteFill} onContextCreate={create} />;
}
