#!/usr/bin/env node
/* =============================================================================
   dashboard-kit · ИКОНКИ ПРИЛОЖЕНИЯ И ФАВИКОН ИЗ ОДНОГО ЗНАКА

       node tools/build-app-icons.mjs                       # знак кита: молния, синий акцент → ./icons
       node tools/build-app-icons.mjs --glyph map --accent violet --out ../product/icons
       node tools/build-app-icons.mjs --mark logo.svg --bg "#18191E" --out icons
       node tools/build-app-icons.mjs … --manifest --name "Мониторинг ЖКХ" --short "ЖКХ"

   ЗАЧЕМ СКРИПТ. Иконок у продукта шесть, и у каждой свои правила: фавикон
   читается в 16 px, iPhone не терпит прозрачности и скругляет сам, Android
   обрезает «маскируемую» иконку по своей форме — круг, капля, квадрат. Шесть
   файлов, нарисованных руками, расходятся с первой же правкой знака: один
   обновили, пять остались старыми. Здесь форма одна, остальное выводится
   (README, «Иконки приложения, фавикон и логотип»).

   ЧТО ПОЛУЧАЕТСЯ:
     favicon.svg             вкладка браузера; вектор, чёткий на любом экране
     icon-32.png             вкладка, где SVG-фавикон не понимают
     apple-touch-icon.png    180×180, непрозрачная, без скругления — iOS скругляет сам,
                             а прозрачное зальёт чёрным
     icon-192.png, icon-512.png   Android и установка с главного экрана («any»)
     icon-maskable-512.png   фон до краёв, знак в безопасном круге 80% —
                             Android режет иконку своей формой
     manifest.webmanifest    только с --manifest: кит его не поставляет, это
                             решение продукта (README, «С главного экрана»)

   ЗНАК. По умолчанию — значок из набора кита (js/dk-icons.js) белым по
   акценту: так нарисован знак в каркасе (.dk-side__mark). Цвета берутся из
   токенов, а не пишутся здесь: акцент продукта меняется одной строкой в
   tokens.primitives.css, и иконки после пересборки идут за ним. --mark
   подставляет свой знак целиком (квадратный SVG): для маскируемой иконки он
   уменьшается до безопасной зоны на фоне --bg.

   Без зависимостей: Chrome, который уже стоит на машине, и протокол отладки
   через встроенный в node WebSocket (node 22+), как tools/check-mobile.mjs.
   ========================================================================== */

import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const flag = name => args.includes('--' + name);

/* Неизвестный ключ — подсказка и выход, НИЧЕГО не записав. Раньше скрипт
   ключей не проверял: исполнитель проверочной задачи скилла запустил его с
   --help, чтобы узнать ключи, и скрипт молча собрал иконки поверх иконок
   кита (29.09; содержимое совпало, но это случайность). */
const KNOWN = new Set(['glyph', 'accent', 'mark', 'bg', 'out', 'manifest', 'name', 'short']);
const WITH_VALUE = new Set(['glyph', 'accent', 'mark', 'bg', 'out', 'name', 'short']);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const key = a.startsWith('--') ? a.slice(2) : null;
  if (!key || !KNOWN.has(key)) {
    const head = (await readFile(fileURLToPath(import.meta.url), 'utf8')).split('\n').slice(2, 7).join('\n');
    console.error((key === 'help' || a === '-h' ? '' : 'неизвестный ключ: ' + a + '\n\n') + head);
    process.exit(2);
  }
  if (WITH_VALUE.has(key)) i++;
}

// По умолчанию — папка icons там, откуда запустили, а не в ките: иначе
// запуск из проекта продукта без --out перезаписал бы иконки самого кита.
const OUT = resolve(opt('out', join(process.cwd(), 'icons')));
const GLYPH = opt('glyph', 'bolt');
const ACCENT = opt('accent', 'blue');
const MARK = opt('mark', null);

/* --- цвета из токенов ------------------------------------------------------ */
const prim = await readFile(join(ROOT, 'css', 'tokens.primitives.css'), 'utf8');
const tok = name => {
  const m = prim.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{6})'));
  if (!m) throw new Error('в tokens.primitives.css нет --' + name);
  return m[1];
};
const BRAND = tok('c-accent-' + ACCENT);
const INK = tok('c-widget-1-light');          // --brand-ink: подпись на акценте
const BG = opt('bg', tok('c-board-dark'));    // фон маскируемой иконки со своим знаком, заставка

/* --- знак ------------------------------------------------------------------ */
async function glyphPaths(name) {
  const sprite = await readFile(join(ROOT, 'js', 'dk-icons.js'), 'utf8');
  const m = sprite.match(new RegExp('<symbol id=\\\\?"ti-' + name + '\\\\?"[^>]*>(.*?)</symbol>'));
  if (!m) throw new Error('иконки ti-' + name + ' нет в спрайте: впиши имя в ICONS в tools/build-icons.py и пересобери');
  return m[1].replace(/\\"/g, '"');
}

/* Квадрат S×S. radius — доля стороны (0 — квадрат до краёв), part — доля
   стороны, которую занимает знак. Штрих масштабируется вместе со знаком:
   значок Tabler нарисован штрихом 2 на поле 24, и тоньше в 16 px он пропадает. */
function tile(S, { radius, part, bg }) {
  const k = S * part / 24, off = (S - 24 * k) / 2;
  const rx = radius ? ` rx="${(S * radius).toFixed(2)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
    `<rect width="${S}" height="${S}"${rx} fill="${bg}"/>` +
    `<g transform="translate(${off.toFixed(3)} ${off.toFixed(3)}) scale(${k.toFixed(4)})" fill="none" stroke="${INK}" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS}</g></svg>`;
}

/* Свой знак: вписывается в квадрат целиком или уменьшается до доли part на
   фоне bg (маскируемая, iPhone). */
function custom(S, { part, bg }) {
  const inner = MARK_SVG.replace(/<svg\b/, `<svg width="${S * part}" height="${S * part}" x="${S * (1 - part) / 2}" y="${S * (1 - part) / 2}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">` +
    (bg ? `<rect width="${S}" height="${S}" fill="${bg}"/>` : '') + inner + '</svg>';
}

const PATHS = MARK ? '' : await glyphPaths(GLYPH);
const MARK_SVG = MARK ? await readFile(resolve(MARK), 'utf8') : '';

/* Доли выбраны по правилам платформ, а не на глаз:
   - вкладка: скругление 22%, знак 70% — в 16 px меньшая доля сливается в точку;
   - «any» 192/512: скругление 22%, знак 56%;
   - iPhone: квадрат до краёв (скругляет система), знак 56%, без прозрачности;
   - маскируемая: фон до краёв, знак 44% — его диагональ 62% стороны, внутри
     безопасного круга 80%, который Android обещает не обрезать. */
const SET = MARK ? [
  ['favicon.svg', 64, { part: 1 }],
  ['icon-32.png', 32, { part: 1 }],
  ['apple-touch-icon.png', 180, { part: 0.8, bg: BG }],
  ['icon-192.png', 192, { part: 1 }],
  ['icon-512.png', 512, { part: 1 }],
  ['icon-maskable-512.png', 512, { part: 0.6, bg: BG }],
] : [
  ['favicon.svg', 64, { radius: 0.22, part: 0.7, bg: BRAND }],
  ['icon-32.png', 32, { radius: 0.22, part: 0.7, bg: BRAND }],
  ['apple-touch-icon.png', 180, { radius: 0, part: 0.56, bg: BRAND }],
  ['icon-192.png', 192, { radius: 0.22, part: 0.56, bg: BRAND }],
  ['icon-512.png', 512, { radius: 0.22, part: 0.56, bg: BRAND }],
  ['icon-maskable-512.png', 512, { radius: 0, part: 0.44, bg: BRAND }],
];
const draw = (S, o) => MARK ? custom(S, o) : tile(S, o);

/* --- растр через Chrome ---------------------------------------------------- */
function findChrome() {
  return [process.env.DK_CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].find(p => p && existsSync(p)) || null;
}

async function launch(chrome) {
  const profile = await mkdtemp(join(tmpdir(), 'dk-icons-'));
  const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const url = await new Promise((ok, no) => {
    let buf = '';
    const t = setTimeout(() => no(new Error('Chrome не ответил за 15 с')), 15000);
    proc.stderr.on('data', d => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); ok(m[1]); } });
    proc.on('exit', c => no(new Error('Chrome вышел с кодом ' + c)));
  });
  const ws = new WebSocket(url);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const wait = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { const [a, b] = wait.get(m.id); wait.delete(m.id); m.error ? b(new Error(m.error.message)) : a(m.result); } };
  const send = (method, params = {}, sessionId) => new Promise((a, b) => { const n = ++id; wait.set(n, [a, b]); ws.send(JSON.stringify({ id: n, method, params, sessionId })); });
  const close = async () => { try { await send('Browser.close'); } catch { /* закрыт */ } proc.kill(); await rm(profile, { recursive: true, force: true }).catch(() => {}); };
  return { send, close };
}

async function raster(b, svg, S) {
  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => b.send(m, p, sessionId);
  try {
    await s('Emulation.setDeviceMetricsOverride', { width: S, height: S, deviceScaleFactor: 1, mobile: false });
    // Прозрачный фон страницы: углы скруглённой иконки остаются прозрачными,
    // а не белыми. Иконка iPhone и маскируемая залиты до краёв и так.
    await s('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    await s('Runtime.evaluate', { expression:
      `document.documentElement.style.margin=0;document.body.style.margin=0;document.body.innerHTML=${JSON.stringify(svg)};` +
      `document.body.firstElementChild.style.display='block'` });
    const { data } = await s('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: S, height: S, scale: 1 } });
    return Buffer.from(data, 'base64');
  } finally {
    await b.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

/* --- сборка ---------------------------------------------------------------- */
const chrome = findChrome();
if (!chrome) { console.error('нет Chrome: укажи путь в DK_CHROME'); process.exit(1); }
await mkdir(OUT, { recursive: true });
const b = await launch(chrome);
try {
  for (const [file, S, o] of SET) {
    const svg = draw(S, o);
    if (file.endsWith('.svg')) await writeFile(join(OUT, file), svg + '\n');
    else await writeFile(join(OUT, file), await raster(b, svg, S));
    console.log('собрано:', join(OUT, file).replace(ROOT + '/', ''));
  }
} finally {
  await b.close();
}

if (flag('manifest')) {
  const name = opt('name', 'Дашборд'), short = opt('short', name);
  const manifest = {
    name, short_name: short, start_url: './', display: 'standalone',
    background_color: BG, theme_color: BG,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  await writeFile(join(OUT, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('собрано:', join(OUT, 'manifest.webmanifest').replace(ROOT + '/', ''));
}

console.log(`
В <head> каждой страницы (пути — от страницы до папки с иконками):
  <link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="icons/icon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">` +
  (flag('manifest') ? `\n  <link rel="manifest" href="icons/manifest.webmanifest">` : ''));
