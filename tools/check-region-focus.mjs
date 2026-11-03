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


  for(const theme of ['dark','light']) for(const width of [320,390,1536]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:874,deviceScaleFactor:1,mobile:width<768});
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/regions.html?theme=${theme}`});
    await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.getElementById('r-k-total')?.textContent==='89'&&document.querySelector('#r-rank button')){clearInterval(t);document.fonts.ready.then(()=>setTimeout(resolve,250));}else if(++n>100){clearInterval(t);reject(Error('Regions timeout'));}},50);})`);
    // Карта по умолчанию — плитки; проверка соотношения сторон идёт по гео-canvas.
    await evaluate(`(()=>{const b=document.querySelector('button[data-view="map"]');if(b&&b.getAttribute('aria-pressed')!=='true')b.click();})()`);
    await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('#r-map .dk-map__canvas')){clearInterval(t);resolve();}else if(++n>100){clearInterval(t);reject(Error('Region map canvas timeout'));}},50);})`);
    const geometry=await evaluate(`(()=>{
      const box=s=>document.querySelector(s).getBoundingClientRect();
      const primary=box('.dk-focus-layout__primary'),summary=box('.r-summary-panel'),map=box('#r-map .dk-map__canvas');
      return {overflow:document.documentElement.scrollWidth>innerWidth+1,
        aspect:map.width/map.height,dominant:primary.width>summary.width*1.8&&summary.left>=primary.right,
        columns:document.getElementById('r-count-crit').textContent+'|'+document.getElementById('r-k-high').textContent+'|'+document.getElementById('r-k-low').textContent};})()`);
    assert(!geometry.overflow&&Math.abs(geometry.aspect-1.9)<0.02&&geometry.columns==='18|20|51'&&(width<1200||geometry.dominant),`${theme}/${width}: ${JSON.stringify(geometry)}`);
  }
  await evaluate(`(()=>{
    const assert=(v,m)=>{if(!v)throw Error(m)};
    const high=document.querySelector('#r-risk [data-risk="crit"]');
    assert(high.getBoundingClientRect().height>0,'Risk chip is visible without opening settings');
    high.click();
    assert(high.getAttribute('aria-pressed')==='true','Selected risk chip');
    assert(document.getElementById('r-k-total').textContent==='18','High risk scope has 18 regions');
    assert(new URLSearchParams(location.search).get('risk')==='crit','Risk selection saved in URL');
    assert(document.querySelectorAll('#r-risk [aria-pressed="true"]').length===1,'Only selected scope marked');
    document.querySelector('#r-risk [data-risk=""]').click();
    assert(document.getElementById('r-k-total').textContent==='89','All chip restores all regions');
    const search=document.getElementById('r-search');search.value='Новосибирская';search.dispatchEvent(new Event('input',{bubbles:true}));
    assert(document.querySelector('#r-risk [data-risk=""] .dk-lg__n').textContent==='1','Chip counts reflect search');
    document.getElementById('r-reset').click();
    assert(document.getElementById('r-k-total').textContent==='89','Reset restores scope');
    document.querySelector('[data-modal="#r-settings"]').click();
    assert(document.getElementById('r-settings').open,'Settings opens');
    document.getElementById('r-settings').close();
  })()`);
  console.log('PASS: region focus composition, map aspect, visible context, shared risk totals, both themes and phone widths');
} finally { if(browser) await browser.close(); server.close(); }
