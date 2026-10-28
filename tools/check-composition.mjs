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
  // Regression: a tall action must never push the widget title down.
  for (const theme of ['light', 'dark']) for (const width of [390, 900, 1280]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate', {url:`http://127.0.0.1:${server.address().port}/family-mortgage.html?theme=${theme}`});
    await evaluate(`document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,500)))`);
    const geometry = await evaluate(`(() => {
      const widget = document.querySelector('#fm-map-widget');
      const title = widget.querySelector('.dk-widget__title');
      const actions = widget.querySelector('.dk-widget__actions');
      actions.style.minHeight = '64px';
      const w = widget.getBoundingClientRect(), t = title.getBoundingClientRect();
      const ws = getComputedStyle(widget), ts = getComputedStyle(title);
      const top = t.top - w.top, left = t.left - w.left;
      const kpis = [...document.querySelectorAll('#fm-kpis > .dk-tile')];
      return {
        top, left, padding: parseFloat(ws.paddingLeft),
        caps: ts.textTransform, weight: ts.fontWeight,
        equalFields: kpis.every(el => { const s = getComputedStyle(el); return s.paddingTop === s.paddingLeft && s.paddingBottom === s.paddingRight && s.paddingTop === s.paddingBottom; }),
        noOverflow: kpis.every(el => el.scrollWidth <= el.clientWidth + 1),
        noEmptyRows: kpis.every(el => getComputedStyle(el).display === 'flex'),
        chartsVisible: ['fm-demand', 'fm-line'].every(id => {
          const chart = document.getElementById(id), canvas = chart.querySelector('canvas');
          const body = chart.parentElement.getBoundingClientRect(), rect = chart.getBoundingClientRect();
          return rect.height >= 150 && canvas && canvas.width > 0 && canvas.height > 0
            && rect.top >= body.top - 1 && rect.bottom <= body.bottom + 1;
        })
      };
    })()`);
    assert(Math.abs(geometry.top - geometry.left) <= 1 && Math.abs(geometry.left - geometry.padding) <= 1,
      `widget title inset/${theme}/${width}: ${JSON.stringify(geometry)}`);
    assert(geometry.caps === 'uppercase' && geometry.weight === '400' && geometry.equalFields && geometry.noOverflow && geometry.noEmptyRows,
      `KPI and typography/${theme}/${width}: ${JSON.stringify(geometry)}`);
    assert(geometry.chartsVisible, `Visible mortgage charts/${theme}/${width}: ${JSON.stringify(geometry)}`);
  }
  // Each actual row must reach both edges; hidden cards reserve no slot.
  for (const theme of ['light','dark']) for (const width of [390,900,1280]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate', {url:`http://127.0.0.1:${server.address().port}/family-mortgage.html?theme=${theme}`});
    await evaluate(`document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,300)))`);
    const layout = await evaluate(`(() => {
      function filled(container) {
        const bounds = container.getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(container).columnGap);
        const rows = [];
        for (const child of container.children) {
          if (!child.getClientRects().length) continue;
          const r = child.getBoundingClientRect();
          let row = rows.find(row => Math.abs(row[0].top-r.top)<2);
          if (!row) rows.push(row=[]);
          row.push(r);
        }
        return rows.length > 0 && rows.every(row =>
          Math.abs(row[0].left-bounds.left)<2 && Math.abs(row.at(-1).right-bounds.right)<2 &&
          row.every((r,i) => !i || Math.abs(r.left-row[i-1].right-gap)<2));
      }
      const actual = ['fm-kpis','fm-panels'].every(id => filled(document.getElementById(id)));
      let variants = true;
      for (const kind of ['dk-grid--five','dk-grid--balanced']) for (const count of [1,2,3,4,5,6,7]) {
        const fixture = document.createElement('div'); fixture.className='dk-grid '+kind;
        for (let i=0;i<count;i++) { const item=document.createElement('div'); item.style.minHeight='48px'; fixture.append(item); }
        document.getElementById('fm-kpis').parentElement.append(fixture);
        variants = variants && filled(fixture);
        if (count>1) {fixture.children[0].hidden=true; variants = variants && filled(fixture);}
        fixture.remove();
      }
      return {actual,variants,overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    assert(layout.actual && layout.variants && !layout.overflow, `filled rows/${theme}/${width}: ${JSON.stringify(layout)}`);
  }
  console.log('PASS: three composition components, both themes, 320/390/1536px, complete headings and working link targets');
} finally { if(browser) await browser.close(); server.close(); }
