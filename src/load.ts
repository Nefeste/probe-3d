// Загрузка людей (docs/spec.md, «Люди»): people.bin из сборки, атласы WebP читает Skia — на телефоне и в браузере
// одинаково. Один раз на запуск.
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { AlphaType, ColorType, Skia } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { decodePack, type Pack } from './people/pack';
import type { Atlas } from './scenes/gl/scene';

export type People = { pack: Pack; atlases: Atlas[] };

async function bytesOf(mod: number): Promise<ArrayBuffer> {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

function decodeAtlas(bytes: Uint8Array): Atlas {
  // у массива должен быть свой буфер с нуля: нативный fromBytes берёт весь буфер (см. src/people/pack.ts, decodePack)
  const own = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes : bytes.slice();
  const img = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(own));
  if (!img) throw new Error('atlas: cannot decode');
  const w = img.width();
  const h = img.height();
  const px = img.readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  if (!px) throw new Error('atlas: cannot read pixels');
  return { rgba: px instanceof Uint8Array ? px : new Uint8Array(px.buffer), w, h };
}

let cached: Promise<People> | undefined;

export function loadPeople(): Promise<People> {
  cached ??= (async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const buf = await bytesOf(require('../assets/people/people.bin'));
    const pack = decodePack(buf);
    return { pack, atlases: pack.looks.map(l => decodeAtlas(l.atlas)) };
  })();
  return cached;
}
