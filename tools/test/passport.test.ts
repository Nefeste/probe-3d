// Паспорт файлов (assets/LICENSES.md): SHA-256 каждого файла из таблиц — тот же, что у файла.
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');
const md = readFileSync(join(ROOT, 'assets/LICENSES.md'), 'utf8');

test('каждый файл паспорта — с тем же SHA-256', () => {
  const rows = [...md.matchAll(/^\| `([^`]+)` \|[^\n]*`([0-9a-f]{64})` \|$/gm)];
  expect(rows.length).toBe(11);
  for (const [, name, sha] of rows) {
    const path = name.includes('/') ? name : `assets/rocketbox/${name}.glb`;
    const real = createHash('sha256').update(readFileSync(join(ROOT, path))).digest('hex');
    expect([name, real]).toEqual([name, sha]);
  }
});
