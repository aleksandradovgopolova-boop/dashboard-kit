// Проверяет выбранную композицию страны и рабочие представления в Chrome.
import { launch, findChrome } from './browser-harness.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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
  for (const theme of ['dark', 'light']) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/dashboard.html?theme=${theme}` });
    await evaluate(`document.fonts.ready.then(()=>new Promise(resolve=>setTimeout(resolve,1200)))`);
    const result = await evaluate(`(()=>{
      const visible = el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
      const country = document.getElementById('d-view-country');
      const charts = [...document.querySelectorAll('#d-country-charts .dk-widget')];
      const tiles = [...country.querySelectorAll('.dk-tile')];
      const box = el => {const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};
      return {height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,
        country:box(country),charts:charts.map(box),tiles:tiles.map(box),
        tileCount:tiles.length, visibleTitles:charts.map(el=>el.querySelector('h2').textContent),
        hiddenWork:!visible(document.getElementById('d-table')),
        riskReady:document.getElementById('d-risk-summary').dataset.ready==='true', riskHigh:document.querySelector('#d-risk-summary .dk-hero__n').textContent,
        hiddenCauses:!visible(document.getElementById('d-donut')),
        padding:charts.map(el=>getComputedStyle(el).paddingLeft),
        canvas:document.querySelector('#d-line canvas')?.width||0};})()`);
    assert(result.country.bottom <= 768 && result.height <= 768, `${theme}: country overview must fit the complete working viewport`);
    assert(result.width <= 1366, `${theme}: no horizontal page overflow`);
    assert(result.tileCount === 4 && result.tiles.every(tile=>Math.abs(tile.top-result.tiles[0].top)<1), `${theme}: four KPI in one row`);
    assert(result.charts.every(chart=>chart.top>=result.tiles[0].bottom), `${theme}: KPI before detailed charts`);
    assert(result.visibleTitles.join('|')==='Аварии: факт и прогноз|Средний риск по округам|Последние события', `${theme}: main country answer cannot be hidden in tabs`);
    assert(result.charts.every(chart=>Math.abs(chart.height-result.charts[0].height)<1), `${theme}: neighboring widgets have equal heights`);
    assert(result.padding.every(pad=>parseFloat(pad)>=20), `${theme}: spacious desktop padding`);
    assert(await evaluate(`document.querySelectorAll('#d-risk-summary .dk-split__seg').length===4 && getComputedStyle(document.querySelector('#d-risk-summary .dk-split__seg:last-child')).display==='none' && echarts.getInstanceByDom(document.getElementById('d-bars')).getOption().yAxis[0].data.length===8`), `${theme}: zero share invisible and all eight districts represented`);
    assert(result.riskReady && result.riskHigh==='18', `${theme}: shared region counts must load without invented deltas`);
    assert(result.hiddenWork && result.hiddenCauses && result.canvas>0, `${theme}: hidden details and visible chart`);
    await evaluate(`document.getElementById('d-tab-country').focus()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    assert(await evaluate(`document.activeElement.id==='d-tab-work' && document.getElementById('d-tab-work').getAttribute('aria-selected')==='true' && !document.getElementById('d-view-work').hidden && document.getElementById('d-table').getBoundingClientRect().height>0 && document.querySelectorAll('#d-table tbody tr').length===4 && !document.getElementById('d-pager')`), `${theme}: keyboard opens real work rows without invented pagination`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35});
    await evaluate(`new Promise(resolve=>setTimeout(resolve,300))`);
    assert(await evaluate(`document.activeElement.id==='d-tab-causes' && !document.getElementById('d-view-causes').hidden && document.getElementById('d-donut').getBoundingClientRect().width>0 && document.querySelector('#d-donut canvas')?.width>0`), `${theme}: End reaches causes and restores chart dimensions`);
    assert(await evaluate(`document.getElementById('d-view-causes').getBoundingClientRect().bottom<=768 && document.documentElement.scrollHeight<=768`), `${theme}: causes view also fits with an internally scrollable list`);
    await evaluate(`document.getElementById('d-tab-country').click()`);
    assert(await evaluate(`!document.getElementById('d-view-country').hidden && document.querySelectorAll('#d-view-country .dk-tile').length===4`), `${theme}: returning preserves the overview`);
    for(const width of [390,320]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
      await evaluate(`new Promise(resolve=>setTimeout(resolve,300))`);
      assert(await evaluate(`document.documentElement.scrollWidth<=${width} && [...document.querySelectorAll('#d-views button')].every(el=>el.getBoundingClientRect().height>=44)`), `${theme}/${width}: mobile reflow and usable tab targets`);
      await evaluate(`document.getElementById('d-tab-work').click()`);
      assert(await evaluate(`document.documentElement.scrollWidth<=${width} && document.getElementById('d-table').getBoundingClientRect().width>0`), `${theme}/${width}: work cards stay accessible`);
      await evaluate(`document.getElementById('d-tab-country').click()`);
    }
  }
  console.log('PASS: complete 1366×768 country overview, four KPI, equal widgets, keyboard views, genuine work rows, both themes and mobile reflow');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
