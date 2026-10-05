// Регрессия поиска dk-select в настоящем Chrome, без зависимостей.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function findChrome() {
  const c = [
    process.env.DK_CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  return c.find(p => p && existsSync(p)) || null;
}

async function launch(chrome) {
  const profile = await mkdtemp(join(tmpdir(), 'dk-mobile-'));
  const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  let ws;
  try {
  const url = await new Promise((ok, no) => {
    let buf = '';
    const t = setTimeout(() => no(new Error('Chrome не ответил за 30 с: ' + buf.slice(-2000))), 30000);
    proc.stderr.on('data', d => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); ok(m[1]); }
    });
    proc.on('exit', c => no(new Error('Chrome вышел с кодом ' + c)));
  });
  ws = new WebSocket(url);
  await new Promise((ok, no) => {
    const timer = setTimeout(() => no(new Error('CDP WebSocket не открылся за 15 с')), 15000);
    ws.onopen = () => { clearTimeout(timer); ok(); };
    ws.onerror = () => { clearTimeout(timer); no(new Error('CDP WebSocket: ошибка подключения')); };
    ws.onclose = () => { clearTimeout(timer); no(new Error('CDP WebSocket закрыт до подключения')); };
  });
  let id = 0;
  const wait = new Map();
  const listeners = [];
  ws.onclose = () => {
    for (const [, no, timer] of wait.values()) { clearTimeout(timer); no(new Error('CDP соединение закрыто')); }
    wait.clear();
  };
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && wait.has(m.id)) {
      const [ok, no, timer] = wait.get(m.id); wait.delete(m.id); clearTimeout(timer);
      m.error ? no(new Error(m.error.message)) : ok(m.result);
    } else if (m.method) listeners.forEach(f => f(m));
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, no) => {
    const n = ++id;
    const timer = setTimeout(() => { wait.delete(n); no(new Error(method + ': Chrome не ответил за 30 с')); }, 30000);
    wait.set(n, [ok, no, timer]);
    try { ws.send(JSON.stringify({ id: n, method, params, sessionId })); }
    catch (e) { clearTimeout(timer); wait.delete(n); no(e); }
  });
  const close = async () => {
    // Browser.close может закрыть WebSocket до ответа — не ждать бесконечно.
    let timer;
    try {
      await Promise.race([send('Browser.close'), new Promise(ok => { timer = setTimeout(ok, 1500); })]);
    } catch { /* Chrome уже закрыт */ }
    finally {
      clearTimeout(timer);
      for (const [, no, pendingTimer] of wait.values()) { clearTimeout(pendingTimer); no(new Error('Chrome закрывается')); }
      wait.clear();
      ws.close();
      proc.kill();
    }
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  };
  return { send, on: f => listeners.push(f), off: f => listeners.splice(listeners.indexOf(f), 1), close };
  } catch (e) {
    ws?.close();
    proc.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
}


const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function regression() {
  const assert = (v, m) => { if (!v) throw new Error(m); };
  const host = document.createElement('div'); document.body.append(host);
  const changes = [];
  const options = [{value:'a', name:'Alpha'}, {value:'b', name:'Beta'}, {value:'c', name:'Alpine'}];
  const f = dkSelect(host, {label:'Test', options, search:true, mode:'multi', onChange:v=>changes.push(v)});
  const trigger = host.querySelector('button'); trigger.click();
  const input = host.querySelector('input'); input.focus();
  const edit = value => { input.value=value; input.dispatchEvent(new Event('input', {bubbles:true})); };
  edit('Al');
  assert(host.querySelector('input') === input, 'Поиск пересоздал поле');
  assert(document.activeElement === input, 'Потерян фокус');
  assert(host.querySelectorAll('[role=option]').length === 2, 'Фильтрация неверна');
  // Выделение в настоящем текстовом поле: input type=search не поддерживает
  // selectionStart в Chrome, поэтому проверяем тот же узел с type=text.
  input.type='text'; input.setSelectionRange(0,1);
  input.dispatchEvent(new Event('input', {bubbles:true}));
  assert(input.selectionStart===0 && input.selectionEnd===1, 'Потеряно выделение');
  edit('zzz');
  assert(!input.hasAttribute('aria-controls'), 'aria-controls ссылается на удалённый список');
  assert(host.querySelector('.dk-menu__empty'), 'Нет сообщения о пустом результате');
  edit('Al');
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  assert(document.getElementById(input.getAttribute('aria-activedescendant')), 'Не объявлен курсор');
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert(f.value.includes('a') && trigger.getAttribute('aria-expanded')==='true', 'Множественный выбор');
  assert(host.querySelector('input')===input, 'Выбор пересоздал поиск');
  host.querySelector('[data-act=all]').click();
  assert(f.value.length===2, 'Выбрать все видимые');
  assert(changes.length===2, 'Обработчики вызваны повторно');
  f.clear(); assert(f.value.length===0, 'Сброс выбора');
  f.setOptions([{value:'d',name:'Albatross'}]);
  assert(host.querySelectorAll('[role=option]').length===1, 'setOptions');
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert(document.activeElement===trigger && trigger.getAttribute('aria-expanded')==='false', 'Escape');
  trigger.click(); assert(input.value==='' && host.querySelector('input')===input, 'Повторное открытие');
  const singleHost=document.createElement('div'); document.body.append(singleHost);
  const single=dkSelect(singleHost,{label:'Single',options,search:true});
  singleHost.querySelector('button').click(); singleHost.querySelector('[data-value=b]').click();
  assert(single.value==='b' && singleHost.querySelector('button').getAttribute('aria-expanded')==='false','Одиночный выбор');
  return 'PASS: поиск, выделение, фокус, клавиатура, пустой результат, multi/single, API, повторное открытие';
}
let browser;
try {
  const chrome=findChrome(); if(!chrome) throw new Error('Chrome не найден');
  browser=await launch(chrome);
  const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
  const send=(method,params)=>browser.send(method,params,sessionId);
  for(const file of [join(ROOT,'js/dk-util.js'),process.env.DK_SELECT_SOURCE || join(ROOT,'js/dk-select.js')]) {
    const r=await send('Runtime.evaluate',{expression:await readFile(file,'utf8')});
    if(r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  }
  const r=await send('Runtime.evaluate',{expression:`(${regression.toString()})()`,returnByValue:true});
  if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  console.log(r.result.value);
} catch(e) { console.error(e.message); process.exitCode=1; }
finally { if(browser) await browser.close(); }
