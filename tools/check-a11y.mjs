#!/usr/bin/env node
/* =============================================================================
   dashboard-kit · ПРОВЕРКА ДОСТУПНОСТИ В НАСТОЯЩЕМ БРАУЗЕРЕ

       node tools/check-a11y.mjs            # собранные дашборды
       node tools/check-a11y.mjs a.html     # только эти
       node tools/check-a11y.mjs --json     # для check.py

   Зачем отдельный скрипт, а не ещё одна функция в check.py. Всё, что ниже,
   статически не видно. Достижима ли кнопка с клавиатуры, виден ли на ней фокус,
   не запирает ли модальное окно обход, есть ли у контрола имя, которое озвучит
   скринридер, — это свойства живого дерева, а не текста разметки. Поэтому мы
   меряем так, как это переживает человек: нажимаем Tab и смотрим, куда уехал
   фокус и видно ли его, а имена берём из того же дерева доступности, что читает
   скринридер (протокол Chrome, домен Accessibility), а не из нашей догадки по
   атрибутам.

   Без зависимостей: Chrome, который уже стоит на машине, и протокол отладки
   через встроенный в node WebSocket (node 22+) — тот же драйвер, что у
   check-mobile.mjs.

   Что проверяется:

     1. КЛАВИАТУРА  каждый видимый контрол достижим обходом Tab, на нём виден
                    фокус, и обход не застревает (нет ловушки фокуса)
     2. ИМЯ         у каждого контрола и значимой картинки есть доступное имя,
                    которое озвучит скринридер (считает сам браузер)
     3. КАРКАС      у страницы есть ориентир main и единственный заголовок h1,
                    уровни заголовков идут без пропусков

   Чего проверка НЕ видит — и это важнее того, что видит. Автомат проверяет, что
   имя ЕСТЬ и что фокус ДОСТИЖИМ и ВИДЕН; он не слышит, ПОНЯТНА ли речь на живом
   устройстве и верно ли читается порядок вслух. Реальное озвучивание
   скринридером (VoiceOver, TalkBack, NVDA) на живом устройстве по-прежнему не
   проверено — это отдельный, ручной шаг (README, ROADMAP, список ручной
   проверки). «Имя есть» не равно «озвучено правильно».
   ========================================================================== */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, launch } from './browser-harness.mjs';

const ROOT = process.env.DK_ROOT ? resolve(process.env.DK_ROOT) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const only = args.filter(a => a.endsWith('.html'));

/* Собранные дашборды — объём этой итерации. Прочие страницы кита (демонстрации
   компонентов) проверяются своими суховыми правилами; здесь — реальные экраны,
   которые показывают людям. */
const DASHBOARDS = ['dashboard.html', 'family-mortgage.html', 'regions.html', 'mobile.html'];

/* Роли, у которых имя обязательно: без него скринридер назовёт «кнопка», «поле»,
   «ссылка» — и человек не узнает, что это. image сюда входит: декоративную
   картинку браузер сам помечает ignored и в дерево не кладёт, поэтому значимая
   картинка без имени — настоящий дефект. */
const NAMED_ROLES = new Set([
  'button', 'link', 'textbox', 'combobox', 'searchbox', 'checkbox', 'radio',
  'switch', 'slider', 'spinbutton', 'menuitem', 'menuitemcheckbox',
  'menuitemradio', 'tab', 'treeitem', 'image',
]);

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

/* --- внутри страницы: кто ДОЛЖЕН быть достижим Tab и как описать элемент ---- *
   Функция уходит в страницу текстом и ничего снаружи не видит. Помечает каждый
   видимый контрол кита уникальным номером, чтобы снаружи понять, дошёл ли до
   него обход. Роль tab с tabindex="-1" (roving tabindex) из ожидания исключена
   намеренно: по ARIA активна одна вкладка, остальные берут стрелками, а не Tab —
   требовать от них Tab значило бы ругать правильный паттерн. */
function tagReachable() {
  const sel = 'button, a[href], select, textarea, input, summary, [role="button"], [role="tab"], [role="switch"], [role="link"], [tabindex]';
  const own = e => { for (let a = e; a && a !== document.body; a = a.parentElement) {
    const c = typeof a.className === 'string' ? a.className : '';
    if (/(^|\s)(dk-|d-|r-|m-)/.test(c)) return true;
    if (/(^|\s)sc-/.test(c)) return false;
  } return false; };
  const label = e => {
    const own = (typeof e.className === 'string' && e.className.trim()) ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return e.tagName.toLowerCase() + own + (txt ? ` «${txt}»` : '');
  };
  let n = 0;
  const expected = [];
  for (const e of document.querySelectorAll(sel)) {
    if (!own(e) || e.disabled) continue;
    if (e.matches('input[type=hidden]') || e.closest('[inert], [hidden], .dk-vh, .dk-skip')) continue;
    const ti = e.getAttribute('tabindex');
    if (ti !== null && parseInt(ti, 10) < 0) continue;         // намеренно вне обхода Tab
    if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (getComputedStyle(e).pointerEvents === 'none') continue;
    e.setAttribute('data-a11y', String(n));
    expected.push({ idx: n, label: label(e) });
    n++;
  }
  return expected;
}

/* Описание активного элемента после нажатия Tab: его номер (если это помеченный
   контрол), видно ли фокус-кольцо и считает ли браузер фокус «клавиатурным»
   (:focus-visible). Невидимый фокус на клавиатурном элементе — настоящий
   дефект: человек не знает, где он на странице. */
function activeState() {
  const e = document.activeElement;
  if (!e || e === document.body || e === document.documentElement) return { body: true };
  // Кольцо может рисовать не сам элемент, а обёртка через :focus-within —
  // так кит метит фокус у составного поля и у пилюли поиска. Поэтому кольцо
  // ищем на элементе и его предках, пока фокус внутри них.
  const hasRing = n => { const s = getComputedStyle(n);
    return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'; };
  let ring = hasRing(e);
  for (let a = e.parentElement; !ring && a && a !== document.body; a = a.parentElement) {
    if (a.matches(':focus-within') && hasRing(a)) ring = true;
  }
  let visible = false; try { visible = e.matches(':focus-visible'); } catch { visible = true; }
  const own = (typeof e.className === 'string' && e.className.trim()) ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  const txt = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  return { idx: e.getAttribute('data-a11y'), ring, keyboard: visible,
    label: e.tagName.toLowerCase() + own + (txt ? ` «${txt}»` : '') };
}

/* Каркас страницы: один main, один h1, уровни заголовков без провалов. */
function frame() {
  const out = { landmarks: [], headings: [] };
  const mains = document.querySelectorAll('main, [role=main]');
  if (!mains.length) out.landmarks.push('нет ориентира main — скринридер не сможет перепрыгнуть к содержимому');
  const h1 = document.querySelectorAll('h1, [role=heading][aria-level="1"]');
  if (h1.length === 0) out.landmarks.push('нет заголовка h1 — у страницы нет имени в структуре');
  if (h1.length > 1) out.landmarks.push(`заголовков h1 несколько (${h1.length}) — у страницы должно быть одно имя`);
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter(h => !h.closest('[inert],[hidden],.dk-vh'))
    .map(h => parseInt(h.tagName[1], 10));
  let prev = 0;
  for (const lvl of hs) {
    if (prev && lvl > prev + 1) out.headings.push(`уровень заголовков прыгает h${prev} → h${lvl}: пропущена ступень`);
    prev = lvl;
  }
  out.headings = [...new Set(out.headings)];
  return out;
}

async function checkPage(b, base, page) {
  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => b.send(m, p, sessionId);
  const problems = [];
  try {
    await s('Runtime.enable'); await s('Page.enable'); await s('DOM.enable'); await s('Accessibility.enable');
    await s('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await s('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const loaded = new Promise(ok => { const f = m => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { b.off(f); ok(); } }; b.on(f); });
    await s('Page.navigate', { url: base + '/' + page });
    await Promise.race([loaded, new Promise(ok => setTimeout(ok, 15000))]);
    const ev = async (fn, arg) => (await s('Runtime.evaluate', {
      expression: `(${fn})(${JSON.stringify(arg ?? null)})`, awaitPromise: true, returnByValue: true })).result.value;
    // Данные дашборда подгружаются и дорисовывают контролы — даём им осесть.
    await ev(() => document.fonts.ready.then(() => new Promise(r => setTimeout(r, 800))));

    /* 1. КЛАВИАТУРА. Помечаем ожидаемые контролы, затем реально жмём Tab и
       смотрим, куда уехал фокус. Обход ограничен: если за 4× ожидаемых шагов он
       не замкнулся и не ушёл со страницы — это ловушка фокуса. */
    const expected = await ev(tagReachable);
    const reached = new Set();
    const noRing = new Map();
    const tab = async () => {
      for (const type of ['rawKeyDown', 'keyUp']) {
        await s('Input.dispatchKeyEvent', { type, windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, key: 'Tab', code: 'Tab' });
      }
    };
    const limit = Math.max(expected.length * 4 + 10, 40);
    let trap = null, steps = 0, stuck = 0, lastLabel = null;
    for (; steps < limit; steps++) {
      await tab();
      const a = await ev(activeState);
      if (a.body) { if (reached.size) break; continue; }         // ушли со страницы — обход честно кончился
      if (a.idx !== null && a.idx !== undefined) {
        if (reached.has(a.idx)) { if (reached.size >= expected.length) break; } // замкнулся круг
        reached.add(a.idx);
        if (!a.ring && a.keyboard) noRing.set(a.idx, a.label);
      }
      // Застревание: фокус не двигается с одного и того же места много шагов.
      if (a.label === lastLabel) { if (++stuck >= 6) { trap = a.label; break; } } else stuck = 0;
      lastLabel = a.label;
    }
    if (trap) problems.push(`ловушка фокуса: Tab не уходит дальше «${trap}» — с клавиатуры со страницы не выбраться`);
    const missed = expected.filter(e => !reached.has(String(e.idx)));
    // Если обход вовсе не состоялся (0 достигнуто при ожидаемых) — это не «всё
    // недостижимо», а сбой обхода; сообщаем честно, не плодя строк на каждый.
    if (expected.length && reached.size === 0) {
      problems.push('обход Tab не состоялся: фокус не попал ни на один контрол — проверка клавиатуры недействительна');
    } else {
      for (const m of missed.slice(0, 12)) problems.push(`контрол недостижим с клавиатуры (Tab до него не доходит): ${m.label}`);
      for (const [, label] of [...noRing].slice(0, 12)) problems.push(`фокус не виден на контроле (нет кольца при клавиатурном фокусе): ${label}`);
    }

    /* 2. ИМЯ. Дерево доступности — то же, что читает скринридер. Нужен не наш
       пересказ атрибутов, а имя, которое вычислил сам браузер. */
    const { nodes } = await s('Accessibility.getFullAXTree');
    const nameless = [];
    for (const nd of nodes) {
      if (nd.ignored) continue;
      const role = nd.role?.value;
      if (!NAMED_ROLES.has(role)) continue;
      const name = (nd.name?.value || '').trim();
      if (name) continue;
      let label = role;
      if (nd.backendDOMNodeId != null) {
        try {
          const { node } = await s('DOM.describeNode', { backendNodeId: nd.backendDOMNodeId });
          const attrs = node.attributes || [];
          let cls = '';
          for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'class') cls = attrs[i + 1];
          label = (node.localName || role) + (cls ? '.' + cls.trim().split(/\s+/).slice(0, 2).join('.') : '');
        } catch { /* узел мог исчезнуть — оставим роль */ }
      }
      nameless.push(`${label} (роль ${role})`);
    }
    for (const n of [...new Set(nameless)].slice(0, 15)) problems.push(`без доступного имени — скринридер не скажет, что это: ${n}`);

    /* 3. КАРКАС. */
    const fr = await ev(frame);
    for (const m of fr.landmarks) problems.push(m);
    for (const m of fr.headings) problems.push(m);

    return [...new Set(problems)];
  } finally {
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
  let pages = only.length ? only : DASHBOARDS;
  const have = new Set((await readdir(ROOT)).filter(f => f.endsWith('.html')));
  pages = pages.filter(p => have.has(p));
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const b = await launch(chrome);
  const found = [];
  try {
    // Клавиатурный обход жмёт глобальные Tab — вкладки нельзя вести параллельно,
    // иначе нажатия уйдут не в ту. Поэтому страницы проверяются по одной.
    for (const page of pages) {
      try {
        const ps = await checkPage(b, base, page);
        for (const p of ps) found.push(`${page}: ${p}`);
      } catch (e) { found.push(`${page}: проверка не состоялась — ${e.message}`); }
    }
  } finally {
    await b.close();
    server.close();
  }
  const uniq = [...new Set(found)].sort();
  if (JSON_OUT) console.log(JSON.stringify({ pages: pages.length, problems: uniq }));
  else {
    uniq.forEach(p => console.log('  ✗ ' + p));
    console.log(`\n  ${pages.length} дашбордов: ${uniq.length ? 'нарушений ' + uniq.length : 'чисто'}\n`);
    console.log('  не проверено здесь: реальное озвучивание скринридером на живом устройстве — ручной шаг.\n');
  }
  return uniq.length ? 1 : 0;
}

main().then(c => process.exit(c), e => { console.error(e); process.exit(2); });
