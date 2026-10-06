#!/usr/bin/env node
/* =============================================================================
   dashboard-kit · СНИМОК СТРАНИЦЫ В ФИКСИРОВАННОМ ОКНЕ

       node tools/snap.mjs путь/к/странице.html                    # 390×844, тёмная → рядом .png
       node tools/snap.mjs страница.html --size 1280x900 --theme light --out вид.png
       node tools/snap.mjs страница.html --full                    # вся страница, не только экран

   ЗАЧЕМ. Снимок в общей панели браузера неповторяем: панель меняет ширину,
   пока её двигают, бывает скрыта (окно 0×0) и делится между сессиями. Два
   исполнителя проверочных задач скилла из шести зависли на ней насмерть
   (29.09). Здесь — свой Chrome без окна, своё окно заданного размера, свой
   сервер от папки страницы (кит лежит рядом, ссылкой или копией), и
   движение выключено: снимок посреди перехода ловит середину.

   ЧЕГО НЕ ДЕЛАЕТ. --full снимает страницу разом, и часть холстов (кольцо
   пончика, точки линий) в таком снимке не рисуется, хотя на экране они есть
   (урок 29.09). Для графиков снимай экраном, без --full.

   Без зависимостей: Chrome, который уже стоит на машине, и протокол отладки
   через встроенный в node WebSocket (node 22+).
   ========================================================================== */

import {findChrome,launch} from './browser-harness.mjs';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, dirname, basename } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const page = args.find(a => a.endsWith('.html'));
if (!page) { console.error('нужна страница: node tools/snap.mjs путь/к/странице.html'); process.exit(2); }
const file = resolve(page);
const ROOT = dirname(file);
const [W, H] = opt('size', '390x844').split('x').map(Number);
const THEME = opt('theme', 'dark');
const OUT = resolve(opt('out', file.replace(/\.html$/, `-${W}-${THEME}.png`)));
const FULL = args.includes('--full');

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.topojson': 'application/json', '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = await new Promise(ok => {
  const s = createServer(async (q, r) => {
    const f = join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname));
    if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
    try { const b = await readFile(f); r.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); r.end(b); }
    catch { r.writeHead(404); r.end(); }
  });
  s.listen(0, '127.0.0.1', () => ok(s));
});

const chrome = [process.env.DK_CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find(p => p && existsSync(p));
if (!chrome) { console.error('нет Chrome: укажи путь в DK_CHROME'); process.exit(1); }
const browser = await launch(chrome);
const send = browser.send;
const errors = [];
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  browser.on(m => { if (m.sessionId === sessionId && m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0]); });
  await s('Runtime.enable'); await s('Page.enable');
  const mobile = W < 768;
  await s('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile });
  if (mobile) await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const loaded = new Promise(ok => browser.on(m => m.sessionId === sessionId && m.method === 'Page.loadEventFired' && ok()));
  // Тема — параметром адреса, как её передаёт приложение (README, WebView).
  await s('Page.navigate', { url: `http://127.0.0.1:${srv.address().port}/${basename(file)}?theme=${THEME}` });
  await Promise.race([loaded, new Promise(ok => setTimeout(ok, 15000))]);
  await s('Runtime.evaluate', { awaitPromise: true, expression: `document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,1200)))` });
  const clip = FULL
    ? { x: 0, y: 0, width: W, height: Math.min(8000, (await s('Runtime.evaluate', { expression: 'document.documentElement.scrollHeight', returnByValue: true })).result.value), scale: 1 }
    : undefined;
  const { data } = await s('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) });
  await writeFile(OUT, Buffer.from(data, 'base64'));
  console.log('снимок:', OUT, `${W}×${H}`, THEME);
  if (errors.length) console.log('ошибки на странице:', [...new Set(errors)].join(' | '));
} finally {
  await browser.close(); srv.close();
}
process.exit(errors.length ? 1 : 0);
