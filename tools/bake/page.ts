// Страница запекания (tools/bake/run.ts): в Chromium без окна — сцена варианта WebGL (src/scenes/gl/scene.ts):
// фон зала для Skia, спрайты людей и снимок сцены с людьми для отчёта.
import * as THREE from 'three';
import * as GPU from 'three/webgpu';
import { buildGPU } from '../../src/scenes/gpu/scene';
import { decodePack, type Pack } from '../../src/people/pack';
import { buildGL, lights, type Atlas } from '../../src/scenes/gl/scene';
import { BAKE_ASPECT, CAMERA, pitch } from '../../src/sim/camera';
import { crowd, step } from '../../src/sim/crowd';
import { ATLAS_H, ATLAS_W, CENTER_Y, DIRS, FRAME_H, FRAME_W, IDLE_FRAMES, SPAN_M, WALK_FRAMES, courseOf, frameAt } from '../../src/art/sprites';

async function decode(bytes: Uint8Array): Promise<Atlas> {
  const bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/webp' }));
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext('2d')!;
  g.drawImage(bmp, 0, 0);
  return { rgba: new Uint8Array(g.getImageData(0, 0, bmp.width, bmp.height).data.buffer), w: bmp.width, h: bmp.height };
}

let pack: Pack;
let atlases: Atlas[];
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });

async function init() {
  const buf = await (await fetch('/people.bin')).arrayBuffer();
  pack = decodePack(buf);
  atlases = await Promise.all(pack.looks.map(l => decode(l.atlas)));
}

function shot(w: number, h: number, draw: () => void): string {
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  draw();
  return canvas.toDataURL('image/png');
}

/** Зал без людей шириной BAKE_ASPECT: Skia обрежет по бокам под экран. */
function background(w: number): string {
  const b = buildGL(pack, atlases, 1, 'lod');
  b.showPeople(false);
  const h = Math.round(w / BAKE_ASPECT);
  b.setAspect(BAKE_ASPECT);
  return shot(w, h, () => renderer.render(b.scene, b.camera));
}

/** Сцена с людьми — снимок для отчёта. */
function preview(n: number, w: number, h: number, detail: 'full' | 'lod'): string {
  const b = buildGL(pack, atlases, n, detail);
  const c = crowd(n, pack.looks.map(l => l.walk), 1);
  for (let i = 0; i < 300; i++) step(c, 1 / 60);
  b.setAspect(w / h);
  b.update(c, 5);
  return shot(w, h, () => renderer.render(b.scene, b.camera));
}

/** Атлас спрайтов: каждый кадр — ортокамерой под углом камеры сцены, в два раза крупнее, затем уменьшен. */
function sprites(): string {
  const b = buildGL(pack, atlases, 1, 'full');
  const scene = new THREE.Scene();
  lights(scene);
  // свет — тот же, люди — из сцены варианта
  scene.add(b.scene.children.find(o => o instanceof THREE.Group)!);
  const cam = new THREE.OrthographicCamera(-SPAN_M / 4, SPAN_M / 4, SPAN_M / 2, -SPAN_M / 2, 0.1, 50);
  const p = pitch();
  cam.position.set(0, CENTER_Y + Math.sin(p) * 20, Math.cos(p) * 20);
  cam.lookAt(0, CENTER_Y, 0);
  const out = document.createElement('canvas');
  out.width = ATLAS_W;
  out.height = ATLAS_H;
  const g = out.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  renderer.setPixelRatio(1);
  renderer.setSize(FRAME_W * 2, FRAME_H * 2, false);
  renderer.setClearColor(0x000000, 0);
  pack.looks.forEach((L, li) => {
    for (let d = 0; d < DIRS; d++) {
      for (let f = 0; f < WALK_FRAMES + IDLE_FRAMES; f++) {
        const frame = f < WALK_FRAMES
          ? L.walkClip.start + Math.round((f / WALK_FRAMES) * (L.walkClip.frames - 1))
          : L.idle.start + Math.round(((f - WALK_FRAMES) / IDLE_FRAMES) * (L.idle.frames - 1));
        b.single(li, courseOf(d), frame);
        renderer.render(scene, cam);
        const [x, y] = frameAt(li, d, f);
        g.drawImage(canvas, x, y, FRAME_W, FRAME_H);
      }
    }
  });
  renderer.setClearColor(0x000000, 1);
  return out.toDataURL('image/png');
}

/** Снимок варианта WebGPU (в Chromium без окна WebGPU обычно нет — тогда тот же код рисует через WebGL 2). */
async function previewGPU(n: number, w: number, h: number, detail: 'full' | 'lod'): Promise<string> {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  document.body.appendChild(cv);
  const r = new GPU.WebGPURenderer({ canvas: cv, antialias: true });
  await r.init();
  const b = buildGPU(pack, atlases, n, detail);
  const c = crowd(n, pack.looks.map(l => l.walk), 1);
  for (let i = 0; i < 300; i++) step(c, 1 / 60);
  b.setAspect(w / h);
  b.update(c, 5);
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  await r.renderAsync(b.scene, b.camera);
  const backend = (r.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'webgpu' : 'webgl2';
  console.log('backend', backend);
  if ((window as any).dumpShader) {
    const mesh = b.scene.children.find(o => (o as any).geometry?.isInstancedBufferGeometry && (o as any).material.map);
    const code = await (r as any).debug.getShaderAsync(b.scene, b.camera, mesh);
    console.log(code.vertexShader);
  }
  return cv.toDataURL('image/png');
}

(window as unknown as Record<string, unknown>).probe = { init, background, preview, previewGPU, sprites, camera: CAMERA };
