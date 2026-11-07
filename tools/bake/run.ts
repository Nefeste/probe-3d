// Запекание для варианта Skia (docs/spec.md, «Вариант Skia»): фон зала и спрайты людей рендерит тот же Three.js, что
// вариант WebGL, — в Chromium без окна. Плюс снимки сцены для отчёта. Запуск: bun tools/bake/run.ts
// (Chromium: CHROMIUM_PATH или /opt/pw-browsers/chromium).
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');
const built = await Bun.build({ entrypoints: [join(import.meta.dir, 'page.ts')], target: 'browser', minify: false });
if (!built.success) throw new Error(built.logs.join('\n'));
const js = await built.outputs[0].text();
const server = Bun.serve({
  port: 0,
  fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === '/') return new Response('<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="module" src="/page.js"></script>', { headers: { 'content-type': 'text/html' } });
    if (p === '/page.js') return new Response(js, { headers: { 'content-type': 'text/javascript' } });
    if (p === '/people.bin') return new Response(readFileSync(join(ROOT, 'assets/people/people.bin')));
    return new Response('', { status: 404 });
  },
});
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[error]', e.message));
await page.goto(`http://127.0.0.1:${server.port}/`);
await page.waitForFunction(() => 'probe' in window);
if (process.env.DUMP) await page.evaluate(() => { (window as any).dumpShader = true; });
await page.evaluate(() => (window as any).probe.init());
const png = (url: string) => Buffer.from(url.split(',')[1], 'base64');
const save = (rel: string, url: string) => {
  const file = join(ROOT, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  const b = png(url);
  writeFileSync(file, b);
  console.log(`${rel}: ${(b.length / 1e3).toFixed(0)} КБ, SHA-256 ${createHash('sha256').update(b).digest('hex')}`);
};
const only = process.argv[2];
if (!only || only === 'preview') {
  save('docs/img/gl-120-lod.png', await page.evaluate(() => (window as any).probe.preview(120, 1280, 600, 'lod')));
  save('docs/img/gl-40-full.png', await page.evaluate(() => (window as any).probe.preview(40, 1280, 600, 'full')));
}
if (!only || only === 'gpu') {
  save('docs/img/gpu-120-lod.png', await page.evaluate(() => (window as any).probe.previewGPU(120, 1280, 600, 'lod')));
}
if (!only || only === 'skia') {
  save('assets/bake/hall.png', await page.evaluate(() => (window as any).probe.background(1920)));
  save('assets/bake/people.png', await page.evaluate(() => (window as any).probe.sprites()));
}
await browser.close();
server.stop();
