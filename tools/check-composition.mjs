// Проверяет выбранную композицию страны и рабочие представления в Chrome.
import { launch, findChrome } from './browser-harness.mjs';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
    if (!path.startsWith(resolve(root) + sep)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(path);
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.topojson': 'application/json' })[extname(path)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  const chrome = findChrome();
  if (!chrome) throw Error('Chrome required');
  browser = await launch(chrome);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Page.enable');
  const assert = (value, message) => { if (!value) throw Error(message); };

  for (const theme of ['light','dark']) for (const width of [320,390,1536]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:false});
    for (const slug of ['page-header','widget-header','widget']) {
      await send('Page.navigate', {url:`http://127.0.0.1:${server.address().port}/component-${slug}.html?theme=${theme}`});
      await evaluate(`document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,200)))`);
      const result=await evaluate(`(()=>{
        const host=document.querySelector('.sc-playground__canvas');
        const headings=[...host.querySelectorAll('.dk-head__title,.dk-widget__title')];
        return {width:document.documentElement.scrollWidth,viewport:innerWidth,h1:document.querySelectorAll('h1').length,
          headings:headings.length>0&&headings.every(el=>el.scrollWidth<=el.clientWidth+1),
          surfaces:[...host.querySelectorAll('.dk-widget')].every(el=>{const s=getComputedStyle(el);return s.boxShadow==='none'&&parseFloat(s.borderTopWidth)===0}),
          links:[...host.querySelectorAll('a')].every(a=>a.getAttribute('href')&&!a.getAttribute('href').startsWith('#'))};})()`);
      assert(result.width<=width&&result.h1===1&&result.headings&&result.surfaces&&result.links, `${slug}/${theme}/${width}: ${JSON.stringify(result)}`);
    }
  }
  console.log('PASS: three composition components, both themes, 320/390/1536px, complete headings and working link targets');
} finally { if(browser) await browser.close(); server.close(); }
