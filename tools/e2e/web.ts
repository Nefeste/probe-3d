// Сценарий в браузере (docs/spec.md, «Проверки»): веб-сборка пробы (npm run export:web) в Chromium без окна —
// меню, каждый вариант на экране, затем «Замер всего» в коротком режиме (?quick) до таблицы итогов. В Chromium без окна
// WebGPU обычно нет: вариант WebGPU тогда рисует тот же Three.js через WebGL 2 — сценарий проверяет код, не скорость.
// Снимки — tools/e2e/out/. Запуск: bun tools/e2e/web.ts (Chromium: CHROMIUM_PATH или /opt/pw-browsers/chromium).
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');
const DIST = join(ROOT, 'dist-web');
const OUT = join(import.meta.dir, 'out');
mkdirSync(OUT, { recursive: true });
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.png': 'image/png', '.bin': 'application/octet-stream', '.json': 'application/json' };
const server = Bun.serve({
  port: 0,
  fetch(req) {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/') p = '/index.html';
    const file = join(DIST, p);
    if (!file.startsWith(DIST) || !existsSync(file)) return new Response('', { status: 404 });
    return new Response(readFileSync(file), { headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' } });
  },
});
const base = `http://127.0.0.1:${server.port}/`;
const browser = await chromium.launch({ executablePath: (process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium') || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 450 } });
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
let failed = false;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'ok ' : 'НЕТ'} ${what}`);
  if (!ok) failed = true;
};

await page.goto(base);
await page.getByTestId('run').waitFor({ timeout: 60_000 });
check(true, 'меню открылось, люди загружены');
await page.screenshot({ path: join(OUT, 'menu.png') });

for (let i = 0; i < 6; i++) {
  await page.goto(base);
  await page.getByTestId(`live-${i}`).click({ timeout: 60_000 });
  // кадры в секунду появляются через полсекунды кадров
  const hud = page.getByText(/к\/с/);
  const shown = await hud.waitFor({ timeout: 90_000 }).then(() => true, () => false);
  await page.screenshot({ path: join(OUT, `live-${i}.png`) });
  const failedText = await page.getByText(/не запустилось/).count();
  check(shown && failedText === 0, `вариант ${i}: рисует, кадры считаются`);
}

await page.goto(`${base}?quick`);
await page.getByTestId('run').click({ timeout: 60_000 });
const done = await page.getByTestId('result-5').waitFor({ timeout: 600_000 }).then(() => true, () => false);
await page.screenshot({ path: join(OUT, 'results.png'), fullPage: true });
check(done, 'замер прошёл все шаги до таблицы');
check((await page.getByText(/не запустилось/).count()) === 0, 'в таблице нет «не запустилось»');
const real = errors.filter(e => !/WebGPU is not available|No available adapters|404/.test(e));
check(real.length === 0, `ошибок на странице нет${real.length ? ': ' + real.slice(0, 3).join(' | ') : ''}`);
await browser.close();
server.stop();
process.exit(failed ? 1 : 0);
