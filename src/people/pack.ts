// Файл людей для телефона (docs/spec.md, «Люди»): анимации запечены заранее (tools/people/pack.ts — тем же кодом, что
// в «Больнице», bake.ts), на телефоне — только чтение. Устройство: «PPL1», длина заголовка JSON (u32), заголовок,
// затем куски по 4 байта: текстура костей (половинная точность), по каждому виду — полная и упрощённая геометрия и атлас
// (WebP, как в наборе Rocketbox; на телефоне его читает Skia).
export type Clip = { start: number; frames: number; fps: number };
export type Geo = {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  skinIndex: Float32Array;
  skinWeight: Float32Array;
  index: Uint16Array;
};
export type PackLook = {
  name: string;
  height: number;
  /** скорость шага при ×1, м/с */
  walk: number;
  idle: Clip;
  walkClip: Clip;
  full: Geo;
  lod: Geo;
  atlas: Uint8Array;
};
export type Pack = { boneW: number; boneH: number; stride: number; bones: Uint16Array; looks: PackLook[] };

const MAGIC = 0x314c5050; // «PPL1»
const ATTRS = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'] as const;

type Head = {
  boneW: number;
  boneH: number;
  stride: number;
  looks: { name: string; height: number; walk: number; idle: Clip; walkClip: Clip; full: number[]; lod: number[]; atlas: number }[];
};

const pad = (n: number) => (n + 3) & ~3;

export function encodePack(p: Pack): Uint8Array {
  const blobs: Uint8Array[] = [];
  const add = (a: ArrayBufferView) => {
    blobs.push(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
    return a.byteLength;
  };
  add(p.bones);
  const geo = (g: Geo) => [...ATTRS.map(k => add(g[k])), add(g.index)];
  const head: Head = {
    boneW: p.boneW,
    boneH: p.boneH,
    stride: p.stride,
    looks: p.looks.map(l => ({ name: l.name, height: l.height, walk: l.walk, idle: l.idle, walkClip: l.walkClip, full: geo(l.full), lod: geo(l.lod), atlas: add(l.atlas) })),
  };
  const json = new TextEncoder().encode(JSON.stringify(head));
  let size = 8 + pad(json.length);
  for (const b of blobs) size += pad(b.length);
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, json.length, true);
  out.set(json, 8);
  let o = 8 + pad(json.length);
  for (const b of blobs) {
    out.set(b, o);
    o += pad(b.length);
  }
  return out;
}

function utf8(bytes: Uint8Array): string {
  // Hermes без TextDecoder: заголовок — ASCII и кириллицы нет, но на всякий случай — UTF-8 вручную
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (bytes[++i] & 0x3f));
    else s += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f));
  }
  return s;
}

export function decodePack(buf: ArrayBuffer): Pack {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('people.bin: not a PPL1 file');
  const len = dv.getUint32(4, true);
  const head = JSON.parse(utf8(new Uint8Array(buf, 8, len))) as Head;
  let o = 8 + pad(len);
  const take = (n: number) => {
    const at = o;
    o += pad(n);
    return at;
  };
  const f32 = (n: number) => new Float32Array(buf, take(n), n / 4);
  const boneBytes = head.boneW * head.boneH * 4 * 2;
  const bones = new Uint16Array(buf, take(boneBytes), boneBytes / 2);
  const geo = (sizes: number[]): Geo => {
    const [position, normal, uv, skinIndex, skinWeight] = ATTRS.map((_, i) => f32(sizes[i]));
    const index = new Uint16Array(buf, take(sizes[5]), sizes[5] / 2);
    return { position, normal, uv, skinIndex, skinWeight, index };
  };
  const looks = head.looks.map(l => {
    const full = geo(l.full);
    const lod = geo(l.lod);
    const atlas = new Uint8Array(buf, take(l.atlas), l.atlas);
    return { name: l.name, height: l.height, walk: l.walk, idle: l.idle, walkClip: l.walkClip, full, lod, atlas };
  });
  return { boneW: head.boneW, boneH: head.boneH, stride: head.stride, bones, looks };
}

/** Кадры анимации на секунде `t` по кругу: A, B (номера в текстуре костей) и доля между ними (как в «Больнице», people.ts). */
export function frameOf(c: Clip, t: number, out: Float32Array, o: number): void {
  const tt = (Math.max(0, t) * c.fps) % (c.frames - 1);
  const fa = Math.floor(tt);
  out[o] = c.start + fa;
  out[o + 1] = c.start + ((fa + 1) % (c.frames - 1));
  out[o + 2] = tt - fa;
}
