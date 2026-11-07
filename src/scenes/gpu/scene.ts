// Вариант «WebGPU» (docs/spec.md): Three.js с WebGPURenderer — WebGPU на телефоне через react-native-webgpu (Dawn:
// Vulkan на Android). Сцена та же, что у варианта WebGL (src/scenes/gl/scene.ts), но шейдеры — узлы TSL, а не GLSL:
// WebGPURenderer не берёт onBeforeCompile. Люди — по одной отрисовке на вид (InstancedBufferGeometry), поза и кадры —
// атрибуты экземпляра; скелет — в вершинном шейдере из той же текстуры костей (src/people/pack.ts).
//
// Почему не InstancedMesh: у WebGPURenderer positionNode применяется после матрицы экземпляра, а скелет нужно применить
// до неё — поэтому весь путь вершины (скелет → поворот → место) — в одном positionNode.
import * as THREE from 'three/webgpu';
import {
  Fn, attribute, float, instancedBufferAttribute, int, ivec2, mix, normalLocal, normalize, positionLocal, texture, textureLoad, vec3, vec4,
} from 'three/tsl';
import { CAMERA } from '../../sim/camera';
import type { Crowd } from '../../sim/crowd';
import type { Pack } from '../../people/pack';
import { SKY } from '../../art/palette';
import { blobTexture, hallArrays, posesOf, type Detail } from '../hall';
import type { Atlas } from '../gl/scene';

export type GPUBuilt = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  setAspect(a: number): void;
  update(c: Crowd, t: number): void;
  tris: number;
  dispose(): void;
};

export function buildGPU(pack: Pack, atlases: Atlas[], max: number, detail: Detail): GPUBuilt {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  const camera = new THREE.PerspectiveCamera(CAMERA.fovY, 16 / 9, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.eye);
  camera.lookAt(...CAMERA.target);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
  sun.position.set(-5, 10, 7);
  scene.add(sun);
  const disposables: { dispose(): void }[] = [];

  const h = hallArrays();
  const hallGeo = new THREE.BufferGeometry();
  hallGeo.setAttribute('position', new THREE.BufferAttribute(h.pos, 3));
  hallGeo.setAttribute('normal', new THREE.BufferAttribute(h.nrm, 3));
  hallGeo.setAttribute('color', new THREE.BufferAttribute(h.col, 3));
  const hallMat = new THREE.MeshLambertNodeMaterial({ vertexColors: true });
  scene.add(new THREE.Mesh(hallGeo, hallMat));
  disposables.push(hallGeo, hallMat);

  const bones = new THREE.DataTexture(pack.bones, pack.boneW, pack.boneH, THREE.RGBAFormat, THREE.HalfFloatType);
  bones.minFilter = THREE.NearestFilter;
  bones.magFilter = THREE.NearestFilter;
  bones.generateMipmaps = false;
  bones.needsUpdate = true;
  disposables.push(bones);
  const boneTex = texture(bones);
  const W = pack.boneW;
  const STRIDE = pack.stride;

  const meshes: { geo: THREE.InstancedBufferGeometry; anim: THREE.InstancedBufferAttribute; pose: THREE.InstancedBufferAttribute; tris: number }[] = [];
  pack.looks.forEach((L, li) => {
    const g = detail === 'full' ? L.full : L.lod;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(g.normal, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(g.skinIndex, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(g.skinWeight, 4));
    geo.setIndex(new THREE.BufferAttribute(g.index, 1));
    const anim = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    anim.setUsage(THREE.DynamicDrawUsage);
    const pose = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    pose.setUsage(THREE.DynamicDrawUsage);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

    const a = atlases[li];
    const map = new THREE.DataTexture(a.rgba, a.w, a.h, THREE.RGBAFormat);
    map.colorSpace = THREE.SRGBColorSpace;
    map.generateMipmaps = true;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.needsUpdate = true;

    const mat = new THREE.MeshLambertNodeMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.5 });
    const an: any = instancedBufferAttribute(anim);
    const po: any = instancedBufferAttribute(pose);
    const sIdx: any = attribute('skinIndex', 'vec4');
    const sW: any = attribute('skinWeight', 'vec4');
    // строки матрицы сустава j кадра f — три текселя подряд (bake.ts, packPeople)
    const rows = (f: any, j: any): any[] => {
      const b = f.mul(STRIDE).add(j).mul(3);
      const p: any = ivec2(b.mod(W), b.div(W));
      return [textureLoad(boneTex, p), textureLoad(boneTex, p.add(ivec2(1, 0))), textureLoad(boneTex, p.add(ivec2(2, 0)))];
    };
    // точка и нормаль после скелета в кадре f: сумма по четырём суставам с весами
    const skin = (f: any, p4: any, n3: any): any[] => {
      let pos: any = vec3(0);
      let nrm: any = vec3(0);
      for (const k of ['x', 'y', 'z', 'w'] as const) {
        const [r0, r1, r2] = rows(f, int(sIdx[k]));
        const w = sW[k];
        pos = pos.add(vec3(r0.dot(p4), r1.dot(p4), r2.dot(p4)).mul(w));
        nrm = nrm.add(vec3(r0.xyz.dot(n3), r1.xyz.dot(n3), r2.xyz.dot(n3)).mul(w));
      }
      return [pos, nrm];
    };
    mat.positionNode = Fn(() => {
      const p4 = vec4(positionLocal, 1);
      const n3 = attribute('normal', 'vec3');
      const [pa, na] = skin(int(an.x), p4, n3);
      const [pb, nb] = skin(int(an.y), p4, n3);
      const t = an.z;
      // функцией, а не методом: у метода .mix() у узла другой порядок аргументов
      const p: any = (mix as any)(pa, pb, t);
      const n: any = (normalize as any)(mix(na, nb, t));
      // поворот вокруг y на курс (cos, sin) и место на полу
      const co = po.z;
      const si = po.w;
      const rp = vec3(p.x.mul(co).add(p.z.mul(si)), p.y, p.z.mul(co).sub(p.x.mul(si)));
      const rn = vec3(n.x.mul(co).add(n.z.mul(si)), n.y, n.z.mul(co).sub(n.x.mul(si)));
      normalLocal.assign(rn);
      return rp.add(vec3(po.x, float(0), po.y));
    })();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshes.push({ geo, anim, pose, tris: g.index.length / 3 });
    disposables.push(geo, mat, map);
  });

  // тени-пятна: та же InstancedBufferGeometry, место — атрибут экземпляра
  const blob = new THREE.DataTexture(blobTexture(), 64, 64, THREE.RGBAFormat);
  blob.needsUpdate = true;
  const plane = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
  const blobGeo = new THREE.InstancedBufferGeometry();
  blobGeo.index = plane.index;
  blobGeo.setAttribute('position', plane.getAttribute('position'));
  blobGeo.setAttribute('uv', plane.getAttribute('uv'));
  const blobAt = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
  blobAt.setUsage(THREE.DynamicDrawUsage);
  blobGeo.instanceCount = 0;
  blobGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const blobMat = new THREE.MeshBasicNodeMaterial({ map: blob, transparent: true, depthWrite: false, color: 0x000000, opacity: 0.32 });
  const ba: any = instancedBufferAttribute(blobAt);
  blobMat.positionNode = positionLocal.add(vec3(ba.x, float(0.01), ba.y));
  const blobs = new THREE.Mesh(blobGeo, blobMat);
  blobs.frustumCulled = false;
  blobs.renderOrder = 1;
  scene.add(blobs);
  disposables.push(blob, plane, blobGeo, blobMat);

  const built: GPUBuilt = {
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
      const bArr = blobAt.array as Float32Array;
      meshes.forEach((x, li) => {
        const pose = x.pose.array as Float32Array;
        const k = posesOf(c, pack, li, t, pose, x.anim.array as Float32Array);
        for (let i = 0; i < k; i++) {
          bArr[b * 2] = pose[i * 4];
          bArr[b * 2 + 1] = pose[i * 4 + 1];
          b++;
        }
        x.geo.instanceCount = k;
        x.pose.needsUpdate = true;
        x.anim.needsUpdate = true;
        tris += k * x.tris;
      });
      blobGeo.instanceCount = b;
      blobAt.needsUpdate = true;
      built.tris = tris;
    },
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
  return built;
}
