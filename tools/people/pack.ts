// Люди пробы для телефона (docs/spec.md, «Люди»): шесть видов Rocketbox из «Больницы» (assets/rocketbox, MIT) запекаются
// её кодом (src/people/bake.ts) и складываются в assets/people/people.bin (src/people/pack.ts). Запуск: bun tools/people/pack.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bakeLook, packPeople } from '../../src/people/bake';
import { LOOKS } from '../../src/people/cast';
import { encodePack, type Geo, type PackLook } from '../../src/people/pack';

const ROOT = join(import.meta.dir, '../..');
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
// картинок в Bun нет: атлас берётся из файла как есть (atlasOf), здесь его не декодируем
loader.register(() => ({ name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(null) as never }));

/** Байты атласа из .glb: картинка базового цвета первого материала. */
function atlasOf(glb: Buffer): Uint8Array {
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const tex = json.materials[0].pbrMetallicRoughness.baseColorTexture.index;
  const t = json.textures[tex];
  const src = t.extensions?.EXT_texture_webp?.source ?? t.source;
  const img = json.images[src];
  const bv = json.bufferViews[img.bufferView];
  return new Uint8Array(glb.subarray(binStart + (bv.byteOffset ?? 0), binStart + (bv.byteOffset ?? 0) + bv.byteLength));
}

function geo(g: THREE.BufferGeometry): Geo {
  const f = (name: string, size: number) => {
    const a = g.getAttribute(name);
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = a.getComponent(i, k);
    return out;
  };
  const idx = g.index!.array;
  if (g.getAttribute('position').count > 65535) throw new Error('too many vertices for 16-bit index');
  return { position: f('position', 3), normal: f('normal', 3), uv: f('uv', 2), skinIndex: f('skinIndex', 4), skinWeight: f('skinWeight', 4), index: Uint16Array.from(idx) };
}

const raws = [];
const atlases: Uint8Array[] = [];
for (const l of LOOKS) {
  const buf = readFileSync(join(ROOT, 'assets/rocketbox', `${l.name}.glb`));
  const g = await new Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>((res, rej) =>
    loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '', r => res(r as never), rej));
  raws.push(bakeLook(g, l.name));
  atlases.push(atlasOf(buf));
}
const p = packPeople(raws);
const looks: PackLook[] = p.looks.map((l, i) => ({
  name: l.name,
  height: l.height,
  walk: l.walk,
  idle: { start: l.clips.Idle.start, frames: l.clips.Idle.frames, fps: l.clips.Idle.fps },
  walkClip: { start: l.clips.Walk.start, frames: l.clips.Walk.frames, fps: l.clips.Walk.fps },
  full: geo(l.geometry),
  lod: geo(l.lod),
  atlas: atlases[i],
}));
const img = p.boneTexture.image as { width: number; height: number };
const out = encodePack({ boneW: img.width, boneH: img.height, stride: p.jointStride, bones: p.data, looks });
mkdirSync(join(ROOT, 'assets/people'), { recursive: true });
writeFileSync(join(ROOT, 'assets/people/people.bin'), out);
for (const l of p.looks) console.log(`${l.name}: ${l.tris} треугольников, упрощённая — ${l.lodTris}, шаг ${l.walk.toFixed(2)} м/с`);
console.log(`people.bin: ${(out.length / 1e6).toFixed(2)} МБ, SHA-256 ${createHash('sha256').update(out).digest('hex')}`);
