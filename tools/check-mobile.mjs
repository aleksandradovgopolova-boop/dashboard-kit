#!/usr/bin/env node
/* =============================================================================
   dashboard-kit · ПРОВЕРКА ТЕЛЕФОНА В НАСТОЯЩЕМ БРАУЗЕРЕ

       node tools/check-mobile.mjs            # все страницы кита
       node tools/check-mobile.mjs a.html     # только эти
       node tools/check-mobile.mjs --json     # для check.py

   Зачем отдельный скрипт, а не ещё одна функция в check.py. Всё, что ниже,
   статически не видно. Страница стала шире экрана из-за подписи для
   скринридера в шапке таблицы (position: absolute выходит из-под прокрутки,
   если прокручиваемый контейнер не задаёт ей границ) — это видно только по
   раскладке. Зона нажатия у мелкой кнопки выросла невидимым ::after — и
   первый ручной замер «по размеру прямоугольника» насчитал двадцать
   нарушений там, где их не было. Поэтому цель мерится так, как её мерит палец:
   куда попадёт касание в 21 px от центра.

   Без зависимостей: Chrome, который уже стоит на машине, и протокол отладки
   через встроенный в node WebSocket (node 22+). Сервер страниц — свой, на
   случайном порту: проверка не должна зависеть от того, запущен ли 8766.

   Чего проверка НЕ видит — и это важнее того, что видит. Эмулятор Chrome — не
   Safari и не WebView. Зум iOS при фокусе в поле, вырез и строка состояния,
   поведение внутри WKWebView и Android WebView здесь не воспроизводятся;
   проверяется только то, что к ним ведёт (размер шрифта поля, viewport-fit,
   theme-color). Живой телефон по-прежнему нужен: README, «Телефон и
   приложения», список ручной проверки.
   ========================================================================== */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// DK_ROOT — корень чужой страницы (check.py --page): кит лежит рядом с ней.
const ROOT = process.env.DK_ROOT ? resolve(process.env.DK_ROOT) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const only = args.filter(a => a.endsWith('.html'));

/* Три размера, и у каждого своя причина. 360 — самый частый Android и самый
   узкий из массовых: что влезло сюда, влезет в 375 и 390. 812×375 — телефон
   боком: высота падает вдвое, и прижатое к низу встречает прижатое к верху.
   768×1024 — iPad: палец, но ширина уже планшетная, и правила, привязанные к
   ширине, а не к указателю, здесь промахиваются. */
const VIEWPORTS = [
  { name: 'android 360', width: 360, height: 800, dpr: 3 },
  // Вырез iPhone боком: 47 px с одной стороны, но какой — зависит от того,
  // куда повернули телефон, поэтому страница обязана отступить с обеих.
  { name: 'телефон боком', width: 812, height: 375, dpr: 3, insets: { top: 0, left: 47, right: 47, bottom: 21 } },
  { name: 'ipad 768', width: 768, height: 1024, dpr: 2 },
];

/* Исключения из правила 44 px — поимённо и с причиной. Исключение без
   причины — это отключённая проверка. */
const EXEMPT = [
  ['.dk-cal__day',
   'день в месячной сетке: семь колонок на 360 дают 39 px, больше 44 физически не выйдет; ' +
   'на телефоне день — единственная цель, события сквозь него не нажимаются'],
  ['.dk-cal__e',
   'событие в сетке: его высота — это длительность или место в дне, и растить её значит врать; ' +
   'на телефоне в месяце событие не цель вовсе (pointer-events: none), в неделе — открытый пункт REVIEW'],
];

const TARGET = 44;

import {findChrome,launch} from './browser-harness.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.topojson': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };

function serve() {
  return new Promise(ok => {
    const s = createServer(async (req, res) => {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = join(ROOT, path === '/' ? 'index.html' : path);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(404); res.end(); }
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

/* --- протокол отладки ------------------------------------------------------ */

/* --- замер внутри страницы ------------------------------------------------- *
   Функция уходит в страницу текстом, поэтому ничего снаружи не видит. */
function measure({ TARGET, EXEMPT, insets }) {
  const out = { width: null, targets: [], fields: [], meta: [], safe: [] };
  const W = document.documentElement.clientWidth;
  const owns = document.body.classList.contains('dk-page');

  const label = e => {
    const own = (typeof e.className === 'string' && e.className.trim()) ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return e.tagName.toLowerCase() + own + (txt ? ` «${txt}»` : '');
  };

  /* 1. ШИРИНА. Страница шире экрана — телефон либо уменьшит её целиком (всё
     мелкое), либо даст уехать вбок. Виновник — элемент с самым дальним правым
     краем среди тех, кого не держит прокручиваемый контейнер.

     «Держит» — не то же, что «лежит внутри». Первая версия называла виновником
     ячейку таблицы, которая честно прокручивалась в своей обёртке, а настоящий
     виновник — подпись с position: absolute — проскальзывал: абсолютный
     элемент подчиняется обрезке контейнера, только если между ними есть
     позиционированный предок. */
  const clipped = e => {
    let abs = /absolute|fixed/.test(getComputedStyle(e).position), positioned = false;
    if (getComputedStyle(e).position === 'fixed') return false;
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX !== 'visible' && (!abs || positioned || s.position !== 'static')) return true;
      if (s.position !== 'static') positioned = true;
    }
    return false;
  };
  const sw = document.documentElement.scrollWidth;
  if (sw > W + 1) {
    let worst = null, far = 0;
    for (const e of document.body.querySelectorAll('*')) {
      const r = e.getBoundingClientRect();
      if (r.width && r.right > far && !clipped(e)) { far = r.right; worst = e; }
    }
    const path = [];
    for (let a = worst; a && a !== document.body && path.length < 4; a = a.parentElement) path.unshift(label(a).split(' ')[0]);
    out.width = { page: sw, screen: W, culprit: path.join(' > ') };
  }

  /* 2. ЦЕЛИ. Меряем не прямоугольник, а касание: точка в 21 px от центра по
     каждой оси должна попасть в сам элемент. Так видна и зона, выращенная
     невидимым ::after, и сосед, который её перекрывает. */
  const own = e => { // элемент кита, а не оформление страницы документации
    for (let a = e; a && a !== document.body; a = a.parentElement) {
      const c = typeof a.className === 'string' ? a.className : '';
      if (/(^|\s)dk-/.test(c)) return true;
      if (/(^|\s)sc-/.test(c)) return false;
    }
    return false;
  };
  const inText = e => { // ссылка внутри фразы: для неё WCAG размер не требует
    if (getComputedStyle(e).display !== 'inline') return false;
    return [...e.parentElement.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  };
  const seen = new Set();
  const sel = 'button, a[href], select, textarea, input, summary, [role="button"], [role="tab"], [role="switch"], [tabindex="0"]';
  for (let e of document.querySelectorAll(sel)) {
    if (e.matches('input[type=checkbox], input[type=radio]')) e = e.closest('label') || e;
    if (e.matches('input[type=hidden]') || e.disabled || e.closest('[inert], [hidden], .dk-vh, .dk-skip')) continue;
    if (seen.has(e) || !own(e) || inText(e)) continue;
    if (EXEMPT.some(([s]) => e.matches(s))) continue;
    if (getComputedStyle(e).pointerEvents === 'none') continue;   // не цель: касание проходит сквозь
    seen.add(e);
    if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    let r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.width >= TARGET && r.height >= TARGET) continue;
    e.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    r = e.getBoundingClientRect();
    /* Закреплённая колонка накрывает то, что под неё уехало, — это не
       дефект цели, а место, куда её прокрутили. Человек докрутит; докручиваем
       и мы: сдвигаем прокрутку, пока цель не выйдет из-под закреплённого. */
    for (let i = 0; i < 2; i++) {
      const h = document.elementFromPoint(r.left + 1, r.top + r.height / 2);
      const pin = h && !e.contains(h) && !h.contains(e) && [h, ...(function* () { for (let a = h.parentElement; a; a = a.parentElement) yield a; })()]
        .find(a => a !== document.body && getComputedStyle(a).position === 'sticky' && !a.contains(e));
      if (!pin) break;
      let sc = e.parentElement; while (sc && !(sc.scrollWidth > sc.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(sc).overflowX))) sc = sc.parentElement;
      if (!sc) break;
      sc.scrollLeft -= pin.getBoundingClientRect().right - r.left + 2;
      r = e.getBoundingClientRect();
    }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, d = TARGET / 2 - 1;
    const hit = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); };
    const wOk = r.width >= TARGET || (hit(cx - d, cy) && hit(cx + d, cy));
    const hOk = r.height >= TARGET || (hit(cx, cy - d) && hit(cx, cy + d));
    if (!wOk || !hOk) {
      const other = ['cx-d', 'cx+d', 'cy-d', 'cy+d'].map((k, i) => document.elementFromPoint(
        i < 2 ? cx + (i ? d : -d) : cx, i < 2 ? cy : cy + (i === 3 ? d : -d))).find(h => h && h !== e && !e.contains(h));
      out.targets.push(`${label(e)} ${Math.round(r.width)}×${Math.round(r.height)}` +
        (other && other.closest(sel) && other.closest(sel) !== e ? ` — зону перекрывает ${label(other.closest(sel))}` : ''));
    }
  }
  window.scrollTo(0, 0);

  /* 3. ПОЛЯ. Шрифт меньше 16 px — iOS увеличит страницу при фокусе и обратно
     не уменьшит. Эмулятор этого не покажет, поэтому меряем причину. */
  for (const e of document.querySelectorAll('input, select, textarea')) {
    if (e.matches('[type=checkbox],[type=radio],[type=hidden],[type=range],[type=color]') || !own(e)) continue;
    if (e.checkVisibility && !e.checkVisibility({ visibilityProperty: true })) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 16) out.fields.push(`${label(e)} ${fs}px`);
  }

  /* 4. ЗАГОЛОВОК СТРАНИЦЫ. Только если кит владеет страницей (.dk-page):
     встроенный кит чужой <head> не трогает. */
  const vp = document.querySelector('meta[name=viewport]')?.content || '';
  if (owns) {
    if (!/width=device-width/.test(vp)) out.meta.push('viewport без width=device-width');
    if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp)) out.meta.push('viewport запрещает масштаб — это отказ в доступности');
    const tsa = getComputedStyle(document.documentElement).webkitTextSizeAdjust || getComputedStyle(document.documentElement).textSizeAdjust;
    if (tsa !== '100%') out.meta.push(`text-size-adjust = ${tsa || 'auto'}: Safari боком и Android сами увеличат текст`);
    if (!/viewport-fit=cover/.test(vp)) out.meta.push('нет viewport-fit=cover: env(safe-area-inset-*) на iPhone будет нулём');
    const themeMeta = document.querySelector('meta[name=theme-color]');
    if (!themeMeta) out.meta.push('нет <meta name="theme-color">: строку состояния браузер красит своим цветом');
  }

  /* 5. ВЫРЕЗ. Под вырез может уйти фон, но не текст, не значок и не то, что
     нажимают. Проверяется по горизонтали на всей странице — вырез сбоку
     стоит на любой высоте прокрутки; по вертикали — только у прилипшего и
     закреплённого: обычное содержимое из-под полосы «домой» уезжает само.
     Содержимое прокручиваемых блоков не проверяется: оно заходит под вырез
     законно, пока его листают; проверяется сам блок. */
  if (owns && insets) {
    const H = innerHeight, bad = new Set();
    const scroller = e => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a); if (/auto|scroll/.test(s.overflowX) && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
    for (const e of document.body.querySelectorAll('*')) {
      const content = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) ||
        e.matches('button, a[href], input, select, textarea, canvas, svg:not([aria-hidden="true"] svg)');
      if (!content || scroller(e)) continue;
      if (e.checkVisibility && !e.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || r.right <= 0 || r.left >= W) continue;
      const pos = getComputedStyle(e).position;
      let pinned = pos === 'fixed' || pos === 'sticky';
      for (let a = e.parentElement; !pinned && a && a !== document.body; a = a.parentElement) pinned = /fixed|sticky/.test(getComputedStyle(a).position);
      const side = r.left < insets.left - 0.5 ? `слева ${Math.round(insets.left - r.left)} px` :
                   r.right > W - insets.right + 0.5 ? `справа ${Math.round(r.right - (W - insets.right))} px` :
                   pinned && r.bottom > H - insets.bottom + 0.5 && r.top < H ? `снизу ${Math.round(r.bottom - (H - insets.bottom))} px` : '';
      if (side) {
        const top = [...bad].find(b => b.contains(e));
        if (!top) { [...bad].filter(b => e.contains(b)).forEach(b => bad.delete(b)); bad.add(e); out.safe.push(`${label(e)} под вырезом ${side}`); }
      }
    }
    out.safe = out.safe.slice(0, 12);
  }
  return out;
}

/* theme-color обязан совпадать с фоном в обеих темах и переключаться вместе с
   ней. Сравниваем в одном формате: цвет прогоняется через холст. */
function themeColorMatches() {
  const m = document.querySelector('meta[name=theme-color]');
  if (!m || !document.body.classList.contains('dk-page')) return null;
  // Через пиксель, а не через строку: фон из color-mix приходит как
  // color(srgb …), и строки не совпадут, даже когда цвет тот же.
  const px = c => { const k = document.createElement('canvas'); k.width = k.height = 1; const x = k.getContext('2d');
    x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  const a = px(m.content), b = px(getComputedStyle(document.body).backgroundColor);
  if (!/^(#|rgb)/.test(m.content.trim())) return `theme-color записан как «${m.content}» — не каждый браузер это поймёт, нужен #hex или rgb()`;
  return a.every((v, i) => Math.abs(v - b[i]) <= 1) ? null : `theme-color ${m.content} ≠ фону страницы rgb(${b}) в теме ${document.documentElement.dataset.theme}`;
}

async function checkPage(b, base, page, vp) {
  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => b.send(m, p, sessionId);
  const errors = [];
  const onEvent = m => {
    if (m.sessionId !== sessionId) return;
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url || '')) errors.push(m.params.entry.text + (m.params.entry.url ? ' ' + m.params.entry.url.replace(base, '') : ''));
  };
  b.on(onEvent);
  try {
    await s('Runtime.enable'); await s('Log.enable'); await s('Page.enable');
    await s('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr, mobile: true });
    // Вырез изображается только в Chrome 136+; в старом команды нет, и
    // тогда проверка выреза честно пропускается, а не выдаётся за пройденную.
    let insetsOk = false;
    if (vp.insets) insetsOk = await s('Emulation.setSafeAreaInsetsOverride', { insets: vp.insets }).then(() => true, () => false);
    await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await s('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    // Движение выключено: замер посреди перехода ловит середину (HANDOFF).
    await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const loaded = new Promise(ok => { const f = m => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { b.off(f); ok(); } }; b.on(f); });
    await s('Page.navigate', { url: base + '/' + page });
    await Promise.race([loaded, new Promise(ok => setTimeout(ok, 15000))]);
    const ev = async (fn, arg) => (await s('Runtime.evaluate', {
      expression: `(${fn})(${JSON.stringify(arg)})`, awaitPromise: true, returnByValue: true })).result.value;
    await ev(() => document.fonts.ready.then(() => new Promise(r => setTimeout(r, 600))));
    const coarse = await ev(() => matchMedia('(pointer: coarse)').matches);
    if (!coarse) throw new Error('эмуляция не включила (pointer: coarse) — замер недействителен');
    const res = await ev(measure, { TARGET, EXEMPT, insets: insetsOk ? vp.insets : null });
    if (vp.insets && !insetsOk) res.safe = ['вырез не проверен: этот Chrome не умеет его изображать'];
    res.theme = [];
    for (const t of ['dark', 'light']) {
      const msg = await ev(t => { document.documentElement.setAttribute('data-theme', t);
        return new Promise(r => setTimeout(r, 100)); }, t).then(() => ev(themeColorMatches));
      if (msg) res.theme.push(msg);
    }
    res.errors = [...new Set(errors)];
    return res;
  } finally {
    b.off(onEvent);
    await b.send('Target.closeTarget', { targetId }).catch(() => {});
  }
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    const msg = 'нет Chrome: укажи путь в DK_CHROME';
    if (JSON_OUT) { console.log(JSON.stringify({ skipped: msg })); return 0; }
    console.error(msg); return 2;
  }
  const pages = only.length ? only : (await readdir(ROOT)).filter(f => f.endsWith('.html')).sort();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const b = await launch(chrome);
  const problems = [];
  try {
    const jobs = [];
    for (const page of pages) for (const vp of VIEWPORTS) jobs.push({ page, vp });
    // Шесть вкладок разом: по одной — две минуты, так — меньше тридцати секунд.
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const { page, vp } = jobs[next++];
        const where = `${page} · ${vp.name}`;
        try {
          const r = await checkPage(b, base, page, vp);
          if (r.width) problems.push(`${where}: страница ${r.width.page} px при экране ${r.width.screen} — распирает ${r.width.culprit}`);
          for (const t of r.targets) problems.push(`${where}: цель меньше ${TARGET} px — ${t}`);
          for (const f of r.fields) problems.push(`${where}: поле со шрифтом меньше 16 px, iOS увеличит страницу — ${f}`);
          for (const f of r.safe) problems.push(`${where}: ${f}`);
          // Заголовок и тема от размера экрана не зависят: одного раза хватит.
          if (vp === VIEWPORTS[0]) {
            for (const m of r.meta) problems.push(`${page}: ${m}`);
            for (const m of r.theme) problems.push(`${page}: ${m}`);
          }
          for (const e of r.errors) problems.push(`${where}: ошибка в консоли — ${e}`);
        } catch (e) { problems.push(`${where}: замер не состоялся — ${e.message}`); }
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  } finally {
    await b.close();
    server.close();
  }
  const uniq = [...new Set(problems)].sort();
  if (JSON_OUT) console.log(JSON.stringify({ pages: pages.length, viewports: VIEWPORTS.map(v => v.name), problems: uniq }));
  else {
    uniq.forEach(p => console.log('  ✗ ' + p));
    console.log(`\n  ${pages.length} страниц × ${VIEWPORTS.length} размера: ${uniq.length ? 'нарушений ' + uniq.length : 'чисто'}\n`);
  }
  return uniq.length ? 1 : 0;
}

main().then(c => process.exit(c), e => { console.error(e); process.exit(2); });
