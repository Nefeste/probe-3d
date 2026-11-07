// Проекция варианта Skia (src/sim/camera.ts) — та же, что у камеры Three.js: люди-спрайты стоят там же, где 3D.
import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { CAMERA, project, view } from '../../src/sim/camera';

test('точка пола на экране — как у PerspectiveCamera', () => {
  const w = 2400, h = 1080;
  const cam = new THREE.PerspectiveCamera(CAMERA.fovY, w / h, CAMERA.near, CAMERA.far);
  cam.position.set(...CAMERA.eye);
  cam.lookAt(...CAMERA.target);
  cam.updateMatrixWorld();
  const v = view();
  const out = new Float32Array(4);
  for (const [x, z] of [[0, 0], [-10, -6], [10, 7], [4, -3]]) {
    project(v, w, h, x, 0, z, out, 0);
    const p = new THREE.Vector3(x, 0, z).project(cam);
    expect(out[0]).toBeCloseTo((p.x + 1) / 2 * w, 2);
    expect(out[1]).toBeCloseTo((1 - p.y) / 2 * h, 2);
  }
});
