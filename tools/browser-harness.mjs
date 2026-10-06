// Регрессия поиска dk-select в настоящем Chrome, без зависимостей.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function findChrome() {
  const c = [
    process.env.DK_CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  return c.find(p => p && existsSync(p)) || null;
}

export async function launch(chrome) {
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
