// Вариант «WebGL» (docs/spec.md): обычный Three.js (WebGLRenderer) — как в «Больнице» и «Фармзаводе». Люди — по
// InstancedMesh на вид, скелетная анимация в вершинном шейдере из текстуры костей (из bolnitsa: src/render/people.ts
// @ cd7f707 — шейдер тот же, без окраски одежды и оттенков). Зал — цвет вершин с затенением из Blender.
import * as THREE from 'three';
import { CAMERA } from '../../sim/camera';
import type { Crowd } from '../../sim/crowd';
import type { Pack } from '../../people/pack';
import { SKY } from '../../art/palette';
import { blobTexture, hallArrays, posesOf, type Detail } from '../hall';

export type Atlas = { rgba: Uint8Array; w: number; h: number };

const PARS = /* glsl */ `
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute vec3 aAnim;
uniform highp sampler2D uBones;
mat4 boneAt(int f, float j) {
  int b = (f * JOINT_STRIDE + int(j)) * 3;
  ivec2 p = ivec2(b % BONE_W, b / BONE_W);
  vec4 r0 = texelFetch(uBones, p, 0);
  vec4 r1 = texelFetch(uBones, p + ivec2(1, 0), 0);
  vec4 r2 = texelFetch(uBones, p + ivec2(2, 0), 0);
  return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}
mat4 skinAt(int f) {
  return boneAt(f, skinIndex.x) * skinWeight.x + boneAt(f, skinIndex.y) * skinWeight.y
       + boneAt(f, skinIndex.z) * skinWeight.z + boneAt(f, skinIndex.w) * skinWeight.w;
}
`;
const BASE = /* glsl */ `
mat4 skinM = skinAt(int(aAnim.x));
if (aAnim.z > 0.001) skinM = skinM * (1.0 - aAnim.z) + skinAt(int(aAnim.y)) * aAnim.z;
`;

export type GLBuilt = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  setAspect(a: number): void;
  update(c: Crowd, t: number): void;
  /** Сколько треугольников людей в последнем кадре. */
  tris: number;
  dispose(): void;
  /** Только зал или зал без людей — для запекания фона Skia (tools/bake). */
  showPeople(on: boolean): void;
  /** Один человек в начале координат — для запекания спрайтов. */
  single(look: number, yaw: number, frameA: number): void;
};

export function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.position.set(-5, 10, 7);
  scene.add(sun);
}

export function buildGL(pack: Pack, atlases: Atlas[], max: number, detail: Detail): GLBuilt {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  const camera = new THREE.PerspectiveCamera(CAMERA.fovY, 16 / 9, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.eye);
  camera.lookAt(...CAMERA.target);
  lights(scene);

  const disposables: { dispose(): void }[] = [];
  // зал
  const h = hallArrays();
  const hallGeo = new THREE.BufferGeometry();
  hallGeo.setAttribute('position', new THREE.BufferAttribute(h.pos, 3));
  hallGeo.setAttribute('normal', new THREE.BufferAttribute(h.nrm, 3));
  hallGeo.setAttribute('color', new THREE.BufferAttribute(h.col, 3));
  const hallMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const hall = new THREE.Mesh(hallGeo, hallMat);
  scene.add(hall);
  disposables.push(hallGeo, hallMat);

  // кости
  const bones = new THREE.DataTexture(pack.bones, pack.boneW, pack.boneH, THREE.RGBAFormat, THREE.HalfFloatType);
  bones.minFilter = THREE.NearestFilter;
  bones.magFilter = THREE.NearestFilter;
  bones.generateMipmaps = false;
  bones.needsUpdate = true;
  disposables.push(bones);

  const people = new THREE.Group();
  scene.add(people);
  const meshes: { mesh: THREE.InstancedMesh; anim: THREE.InstancedBufferAttribute; tris: number }[] = [];
  pack.looks.forEach((L, li) => {
    const g = detail === 'full' ? L.full : L.lod;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(g.normal, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(g.skinIndex, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(g.skinWeight, 4));
    geo.setIndex(new THREE.BufferAttribute(g.index, 1));
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    anim.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAnim', anim);
    const a = atlases[li];
    const map = new THREE.DataTexture(a.rgba, a.w, a.h, THREE.RGBAFormat);
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    const mat = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.5 });
    mat.onBeforeCompile = shader => {
      shader.uniforms.uBones = { value: bones };
      shader.vertexShader = `#define JOINT_STRIDE ${pack.stride}\n#define BONE_W ${pack.boneW}\n${shader.vertexShader}`
        .replace('#include <skinning_pars_vertex>', PARS)
        .replace('#include <skinbase_vertex>', BASE)
        .replace('#include <skinnormal_vertex>', 'objectNormal = normalize(mat3(skinM) * objectNormal);')
        .replace('#include <skinning_vertex>', 'transformed = (skinM * vec4(transformed, 1.0)).xyz;');
    };
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    people.add(mesh);
    meshes.push({ mesh, anim, tris: g.index.length / 3 });
    disposables.push(geo, mat, map);
  });

  // тени-пятна
  const blob = new THREE.DataTexture(blobTexture(), 64, 64, THREE.RGBAFormat);
  blob.needsUpdate = true;
  const blobGeo = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.32 });
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, max);
  blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blobs.frustumCulled = false;
  blobs.count = 0;
  blobs.renderOrder = 1;
  people.add(blobs);
  disposables.push(blob, blobGeo, blobMat);

  const pose = new Float32Array(max * 4);
  const m = new THREE.Matrix4();
  const built: GLBuilt = {
    scene,
    camera,
    tris: 0,
    setAspect(a) {
      camera.aspect = a;
      camera.updateProjectionMatrix();
    },
    update(c, t) {
      let tris = 0;
      let b = 0;
      meshes.forEach((x, li) => {
        const k = posesOf(c, pack, li, t, pose, x.anim.array as Float32Array);
        for (let i = 0; i < k; i++) {
          const px = pose[i * 4], pz = pose[i * 4 + 1], co = pose[i * 4 + 2], si = pose[i * 4 + 3];
          // поворот вокруг y на курс: (cos, 0, −sin) / (0, 1, 0) / (sin, 0, cos) по столбцам
          m.set(co, 0, si, px, 0, 1, 0, 0, -si, 0, co, pz, 0, 0, 0, 1);
          x.mesh.setMatrixAt(i, m);
          m.set(1, 0, 0, px, 0, 1, 0, 0.01, 0, 0, 1, pz, 0, 0, 0, 1);
          blobs.setMatrixAt(b++, m);
        }
        x.mesh.count = k;
        x.mesh.instanceMatrix.needsUpdate = true;
        x.anim.needsUpdate = true;
        tris += k * x.tris;
      });
      blobs.count = b;
      blobs.instanceMatrix.needsUpdate = true;
      built.tris = tris;
    },
    showPeople(on) {
      people.visible = on;
    },
    single(look, yaw, frameA) {
      meshes.forEach((x, li) => {
        x.mesh.count = li === look ? 1 : 0;
      });
      const x = meshes[look];
      const co = Math.cos(yaw), si = Math.sin(yaw);
      m.set(co, 0, si, 0, 0, 1, 0, 0, -si, 0, co, 0, 0, 0, 0, 1);
      x.mesh.setMatrixAt(0, m);
      x.mesh.instanceMatrix.needsUpdate = true;
      const an = x.anim.array as Float32Array;
      an[0] = frameA;
      an[1] = frameA;
      an[2] = 0;
      x.anim.needsUpdate = true;
      m.identity().setPosition(0, 0.01, 0);
      blobs.setMatrixAt(0, m);
      blobs.count = 1;
      blobs.instanceMatrix.needsUpdate = true;
      hall.visible = false;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
  return built;
}
