// Проверяет общий срез настоящей страницы и контракт карты в Chrome.
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
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/regions.html` });
  await evaluate(`new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{if(document.querySelector('#r-tbody tr')&&document.querySelector('#r-map .dk-map__canvas')){clearInterval(timer);resolve();}else if(++tries>100){clearInterval(timer);reject(Error('Region data timeout'));}},50);})`);
  console.log(await evaluate(`(async()=>{
    const assert=(value,message)=>{if(!value)throw Error(message)};
    const search=document.getElementById('r-search');
    const input=query=>{search.value=query;search.dispatchEvent(new Event('input',{bubbles:true}))};
    // API fixture isolates null (=all), [] (=none) and view-switch preservation.
    const host=document.createElement('div');document.body.append(host);
    const map=dkMap(host,{view:'tiles',values:{a:0,b:80},tiles:{cols:2,rows:1,tiles:[{id:'a',abbr:'A',name:'A',row:0,col:0},{id:'b',abbr:'B',name:'B',row:0,col:1}]}});
    const outside=()=>host.querySelectorAll('.dk-map__tile--out').length;
    assert(outside()===0,'initial unrestricted map');
    map.setScope([]);assert(outside()===2,'empty scope must exclude every region');
    assert(host.querySelectorAll('.dk-map__tile.dk-nodata').length===0,'outside scope must not become no-data');
    map.setScope(['a']);assert(outside()===1,'one selected region');
    map.update({scope:[]});assert(outside()===2,'update empty scope must stay empty');
    map.update({view:'map'});map.update({view:'tiles'});assert(outside()===2,'view switch must keep empty scope');
    map.setScope(null);assert(outside()===0,'null resets scope');
    map.update({scope:[]});map.update({scope:null});assert(outside()===0,'update null resets scope');
    map.destroy();host.remove();
    // Real-page search must agree across table, KPI, rank and geographic map.
    input('НЕСУЩЕСТВУЮЩИЙ РЕГИОН 987654321');
    assert(!document.querySelector('#r-tbody tr'),'empty search table');
    assert(!document.querySelector('#r-rank [data-region]'),'empty search rank');
    assert(document.getElementById('r-k-crit').textContent==='0'&&document.getElementById('r-k-high').textContent==='0'&&document.getElementById('r-k-avg').textContent==='—','empty search KPI');
    assert(document.getElementById('r-results').textContent==='Ничего не найдено','honest no-result text');
    const canvas=document.querySelector('#r-map .dk-map__canvas');
    const chart=canvas&&echarts.getInstanceByDom(canvas);
    assert(chart&&chart.getOption().series[0].data.every(row=>row.itemStyle.opacity===0.25),'empty geographic scope');
    // Closing details preserves the current slice and keyboard return target.
    input('Новосибирская');
    const button=document.querySelector('#r-tbody [data-region]');assert(button,'matching region');
    button.focus();button.click();
    const dialog=document.getElementById('r-details');assert(dialog.open,'open selected details');
    dialog.close();await new Promise(resolve=>setTimeout(resolve,30));
    assert(search.value==='Новосибирская'&&document.querySelectorAll('#r-tbody tr').length===1,'details preserves filter');
    assert(document.activeElement===button,'details returns focus');
    document.getElementById('r-reset').click();
    assert(!search.value&&!document.getElementById('r-results').textContent,'reset clears search');
    assert(document.querySelectorAll('#r-tbody tr').length===8,'reset restores first page');
    const demo=await fetch('data/monitor-demo.json').then(response=>response.json());
    const values=Object.values(demo.risk.values);
    assert(document.getElementById('r-k-crit').textContent===String(demo.risk.counts.high),'reset high-risk KPI agrees with shared source');
    assert(document.getElementById('r-k-high').textContent===String(demo.risk.counts.medium),'reset medium-risk KPI agrees with shared source');
    assert(document.getElementById('r-k-nodata').textContent===String(demo.risk.counts.missing),'no-data KPI agrees with shared source');
    assert(document.getElementById('r-k-avg').textContent===String(Math.round(values.reduce((sum,value)=>sum+value,0)/values.length)),'average KPI agrees with shared source');
    const restored=echarts.getInstanceByDom(document.querySelector('#r-map .dk-map__canvas'));
    assert(restored.getOption().series[0].data.every(row=>row.itemStyle.opacity===1),'reset restores all map regions');
    return 'PASS: empty scope, null reset, view persistence, no-data distinction, real-page KPI/map/table/rank agreement, details context/focus, shared-source KPI reset';
  })()`));
  for (const [page, prefix] of [['regions.html', 'r'], ['accidents.html', 'a']]) {
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/${page}` });
    await evaluate(`new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{if(document.querySelector('#${prefix}-tbody tr')){clearInterval(timer);resolve();}else if(++tries>100){clearInterval(timer);reject(Error('Demo data timeout'));}},50);})`);
    console.log(await evaluate(`(()=>{
      const assert=(value,message)=>{if(!value)throw Error(message)};
      const period=document.getElementById('${prefix}-period');
      assert(period.textContent.includes('Демонстрационные данные за')&&!period.querySelector('button,input,select'),'demo period must describe fixed data');
      const url=location.href;
      for(const link of document.querySelectorAll('.dk-side__item[aria-disabled="true"]')){
        assert(!link.hasAttribute('href')&&link.getAttribute('role')==='link','disabled destination must not navigate');
        assert(link.getAttribute('aria-label').includes('недоступно в демонстрации'),'rail preserves disabled reason');
        link.click();
      }
      assert(location.href===url,'unavailable navigation must preserve location');
      const calendar=[...document.querySelectorAll('.dk-side__item')].find(link=>link.textContent.includes('Календарь'));
      if(calendar)assert(calendar.getAttribute('href')==='calendar.html','available calendar must have a destination');
      if('${prefix}'==='a'){
        assert(document.getElementById('a-at').textContent==='Демонстрационные данные','static demo must not claim current data freshness');
        const button=document.querySelector('#a-tbody .dk-td-act button'),rows=document.getElementById('a-tbody').innerHTML;
        assert(button.disabled&&button.getAttribute('aria-describedby')==='a-demo-actions','demo close must be disabled with explanation');
        assert(document.getElementById('a-demo-actions').textContent.includes('недоступно в демонстрации'),'visible unavailable-action explanation');
        button.click();
        assert(document.getElementById('a-tbody').innerHTML===rows&&!document.querySelector('dialog[open],.dk-toast'),'disabled close must not report success');
      }
      return 'PASS: ${page} fixed demo period, honest unavailable navigation/action, available calendar destination';
    })()`));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
