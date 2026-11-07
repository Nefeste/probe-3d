// Ловушки нативной Skia, которых не видно в браузере (CanvasKit их прощает), — по исходникам приложения.
import { expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(import.meta.dir, '../../src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : [];
  });

test('картинка не дописывается без начала записи: finishRecordingAsPicture — только после beginRecording того же рекордера', () => {
  for (const f of files(SRC)) {
    const s = readFileSync(f, 'utf8');
    // рекордер, созданный и сразу закрытый одним выражением, — нативный пустой указатель и падение (0.1.1)
    expect([f, /PictureRecorder\(\)\s*\.\s*finishRecordingAsPicture/.test(s)]).toEqual([f, false]);
    const finishes = s.split('finishRecordingAsPicture(').length - 1;
    const begins = s.split('beginRecording(').length - 1;
    expect([f, begins >= finishes]).toEqual([f, true]);
  }
});

test('Skia.Data.fromBytes получает массив со своим буфером с нуля', () => {
  for (const f of files(SRC)) {
    const s = readFileSync(f, 'utf8');
    if (!s.includes('Data.fromBytes(')) continue;
    // единственный вызов — в src/load.ts, после проверки смещения
    expect(f.endsWith('load.ts')).toBe(true);
    expect(s).toContain('bytes.byteOffset === 0');
  }
});
