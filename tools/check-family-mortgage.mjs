// Browser acceptance for the analytical mortgage consumer.
// Requires an allowed local HTTP server and Chrome. Skipping it is not PASS.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, writeFile, mkdtemp, readFile, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {launch, findChrome} from './browser-harness.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let browser, server, downloadDirectory;
try {
  const chrome = findChrome();
  assert(chrome, 'Chrome required for family mortgage acceptance');
  server = spawn('python3', ['tools/reference-server.py', '--port', '0'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe']
  });
  const base = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error('Server startup timeout: ' + output)), 15000);
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    server.stderr.on('data', chunk => { output += chunk; console.error('Fixture server:',String(chunk)); });
    server.on('error', error => { clearTimeout(timer); reject(error); });
    server.on('exit', code => { clearTimeout(timer); reject(Error('Server exited ' + code + ': ' + output)); });
  });
  browser = await launch(chrome);
  const {targetId} = await browser.send('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await browser.send('Target.attachToTarget', {targetId, flatten: true});
  const send = (method, params = {}) => browser.send(method, params, sessionId);
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = expression => evaluate(`new Promise((resolve,reject)=>{
    let n=0;const tick=()=>{if(${expression})return resolve(true);
    if(++n>150)return reject(Error('Condition timeout: '+JSON.stringify({url:location.href,ready:document.readyState,status:document.querySelector('#fm-dashboard')?.dataset.status,message:document.querySelector('#fm-status')?.textContent})));setTimeout(tick,50)};tick();
  })`).catch(error=>{throw Error(error.message+'; browser exceptions: '+JSON.stringify(errors));});
  const api = `document.querySelector('#fm-dashboard').familyMortgageDashboard`;
  const click = selector => evaluate(`(()=>{
    const target=document.querySelector(${JSON.stringify(selector)});
    if(!target)throw Error('Missing control: '+${JSON.stringify(selector)});
    target.focus();target.click();
  })()`);
  const ready = () => waitFor(`document.querySelector('#fm-dashboard')?.dataset.status==='ready'`);
  const view = () => evaluate(`${api}.getView()`);
  const patch = async query => { await evaluate(`${api}.setQuery(${JSON.stringify(query)})`); await ready(); };
  const escape = async () => {
    await send('Input.dispatchKeyEvent', {type:'keyDown', key:'Escape', code:'Escape', windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent', {type:'keyUp', key:'Escape', code:'Escape', windowsVirtualKeyCode:27});
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  const errors = [];
  browser.on(message => {
    if (message.sessionId===sessionId && message.method==='Network.responseReceived' && message.params.response.status>=400) errors.push('HTTP '+message.params.response.status+' '+message.params.response.url);
    if (message.sessionId===sessionId && message.method==='Network.loadingFailed' && !message.params.canceled) errors.push('Network '+message.params.errorText);
    if (message.sessionId === sessionId && message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
  });
  const evidence = resolve(process.env.DK_EVIDENCE_DIR || resolve(tmpdir(), 'dashboard-kit-evidence'));
  await mkdir(evidence, {recursive:true});

  const equalHeaderInsets = async () => {
    const controls = await evaluate(`Array.from(document.querySelectorAll('.fm-topbar .dk-select__trigger,.fm-topbar .dk-iconbtn,.fm-topbar__tools .dk-seg button,.fm-filters')).filter(x=>x.getClientRects().length).map(x=>{const s=getComputedStyle(x),r=x.getBoundingClientRect(),b=Array.from(x.children).filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect());return {name:x.className,padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map(parseFloat),insets:x.matches('.dk-select__trigger')?[Math.min(...b.map(n=>n.top))-r.top,r.right-Math.max(...b.map(n=>n.right)),r.bottom-Math.max(...b.map(n=>n.bottom)),Math.min(...b.map(n=>n.left))-r.left]:[]};})`);
    for (const c of controls) {
      assert(Math.max(...c.padding)-Math.min(...c.padding)<.1,'Equal padding on all four sides: '+JSON.stringify(c));
      if(c.insets.length) assert(Math.max(...c.insets)-Math.min(...c.insets)<=1.1,'Filter text/arrow have equal actual edge insets: '+JSON.stringify(c));
    }
  };

  for (const theme of ['light', 'dark']) for (const width of [320, 390, 600, 768, 859, 860, 886, 1024, 1100, 1280, 1536]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height:900, deviceScaleFactor:1, mobile:width < 768});
    const url = `${base}/family-mortgage.html?theme=${theme}`;
    await send('Page.navigate', {url});
    await waitFor(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&document.querySelector('#fm-dashboard')?.dataset.status==='ready'`);
    await evaluate('document.fonts.ready');
    await waitFor(`document.querySelector('#fm-map .dk-map__tile')`);
    await click(`[data-theme-set="${theme}"]`);
    assert(await evaluate(`document.documentElement.dataset.theme===${JSON.stringify(theme)}`), 'Requested theme must be applied');
    const header=await evaluate(`(()=>{const r=x=>{const a=x.getBoundingClientRect();return {l:a.left,r:a.right,t:a.top,b:a.bottom,h:a.height,cy:(a.top+a.bottom)/2};};return {inner:r(document.querySelector('.fm-topbar__inner')),brand:r(document.querySelector('.fm-brand')),filters:r(document.querySelector('.fm-filters')),tools:r(document.querySelector('.fm-topbar__tools')),toggle:r(document.querySelector('#fm-filter-toggle')),compact:!document.querySelector('#fm-filter-toggle').hidden,hidden:document.querySelector('.fm-filters').hidden};})()`);
    assert(header.inner.h<=58&&header.brand.r<= (width<860?header.toggle.l:header.filters.l)+1&&header.tools.r<=width+1,'One family header row without overlap: '+width+' '+JSON.stringify(header));
    if(width>=860){
      assert(!header.compact&&!header.hidden&&header.filters.r<=header.tools.l+1&&Math.abs(header.filters.cy-header.tools.cy)<1,'Inline filters stay in the title row');
      await equalHeaderInsets();
    }else{
      assert(header.compact&&header.hidden,'Phone filters use the compact entry');
      await click('#fm-filter-toggle');
      assert(await evaluate(`(()=>{const r=document.querySelector('.fm-filters').getBoundingClientRect(),h=document.querySelector('.fm-topbar__inner').getBoundingClientRect();return r.width>250&&r.left>=0&&r.right<=innerWidth+1&&r.top>=h.bottom-1;})()`),'Filter disclosure uses the viewport width below the header');
      assert(await evaluate(`Array.from(document.querySelectorAll('.fm-topbar .dk-select__label')).every(x=>x.scrollWidth<=x.clientWidth+1)`),'Expanded phone filters show full default labels');
      await equalHeaderInsets();
      assert(await evaluate(`!document.querySelector('.fm-filters').hidden&&document.querySelector('#fm-filter-toggle').getAttribute('aria-expanded')==='true'`),'Compact filters open');
      await click('#fm-district-filter .dk-select__trigger');await escape();
      assert(await evaluate(`!document.querySelector('.fm-filters').hidden`),'First Escape closes select only');
      await escape();assert(await evaluate(`document.querySelector('.fm-filters').hidden&&document.activeElement.id==='fm-filter-toggle'`),'Second Escape closes filters and restores focus');
    }
    if(width===886){
      const widths=()=>evaluate(`Array.from(document.querySelectorAll('.fm-topbar .fm-filter')).map(e=>e.getBoundingClientRect().width)`);
      const actions=()=>evaluate(`document.querySelector('.fm-filter-actions').getBoundingClientRect().width`);
      const original=await widths(),collapsed=await actions();
      assert(await evaluate(`document.querySelector('#fm-reset').hidden`),'No reset in the initial state');
      await click('#fm-district-filter .dk-select__trigger');
      await evaluate(`Array.from(document.querySelectorAll('#fm-district-filter .dk-menu__item')).find(b=>b.textContent.includes('Дальневосточный')).click()`);await ready();
      assert.deepEqual(await widths(),original,'Selected value must not expand any filter');
      assert(await evaluate(`!document.querySelector('#fm-reset').hidden`),'Active filter exposes reset');
      assert((await actions())>collapsed+20,'Reset occupies its real space only while present');
      await click('#fm-reset');await ready();assert.deepEqual(await widths(),original,'Reset restores the same field sizes');
      assert.equal(await actions(),collapsed,'No reserved width remains after reset');
      const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(evidence,'mortgage-header-'+theme+'-886.png'),Buffer.from(shot.data,'base64'));
    }
    assert(await evaluate(`Array.from(document.querySelectorAll('.fm-topbar .dk-select__label')).filter(x=>x.getClientRects().length).every(x=>x.scrollWidth<=x.clientWidth+1)`),'Default filter labels remain readable');
    const baseline = await view();
    assert.equal(baseline.rowCount, 89, 'All demonstration regions must be accessible');
    assert.equal(baseline.rows.length, 12);
    assert(await evaluate(`Array.from(document.querySelectorAll('#fm-table .dk-status > span')).every(el => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) * 2 + 1)`), 'Short status labels wrap by words in at most two lines');

    const adaptive = await evaluate(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,y:r.top};};return {kpis:[...document.querySelectorAll('.fm-overview .dk-tile')].map(rect),graphs:[...document.querySelectorAll('#fm-panels > *')].map(rect),fields:[...document.querySelectorAll('#fm-tbody td')].every(e=>e.scrollWidth<=e.clientWidth+1)};})()`);
    assert(adaptive.kpis.every(r=>Math.abs(r.w-adaptive.kpis[0].w)<1&&Math.abs(r.h-adaptive.kpis[0].h)<1),'All six KPI mini-widgets stay equal');
    if(width<1024)assert(adaptive.graphs[1].y>adaptive.graphs[0].y,'Narrow charts use separate rows');
    assert(adaptive.fields,'Regional fields must remain readable without clipping');
    const mapFrame = await evaluate(`(()=>{const r=document.querySelector('#fm-map-widget').getBoundingClientRect();return {w:r.width,h:r.height};})()`);
    for (const mode of ['map','list','tiles']) {
      await click('#fm-map-controls [data-view="'+mode+'"]');
      const nextFrame = await evaluate(`(()=>{const r=document.querySelector('#fm-map-widget').getBoundingClientRect();return {w:r.width,h:r.height};})()`);
      assert(Math.abs(nextFrame.w-mapFrame.w)<1 && Math.abs(nextFrame.h-mapFrame.h)<1, 'Map view must keep the configured widget frame: '+mode);
    }

    assert(await evaluate(`!document.querySelector('#fm-map .dk-map__unit')`), 'Map legend omits units while tooltips retain them');
    await click('#fm-map [data-map-bucket="2"]');
    assert.equal(await evaluate(`document.querySelectorAll('#fm-map .dk-map__tile:not(.dk-map__tile--out)').length`), baseline.counts.crit, 'Legend selects the critical category');
    assert.equal(await evaluate(`document.activeElement.dataset.mapBucket`), '2', 'Legend retains keyboard focus after rendering');
    assert.deepEqual(await view(), baseline, 'Local map legend preserves the dashboard data');
    await click('#fm-map [data-map-bucket="2"]');
    assert.equal(await evaluate(`document.querySelectorAll('#fm-map .dk-map__tile:not(.dk-map__tile--out)').length`), 89, 'Repeated category click restores all map regions');

    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'), `Page overflow: ${width} ${theme}`);
    const ax = await send('Accessibility.getFullAXTree');
    assert(!ax.nodes.some(n => !n.ignored && ['button','combobox','dialog','textbox'].includes(n.role?.value) && !n.name?.value), 'Unnamed mortgage control');
    if ([390,1280].includes(width)) {
      const shot = await send('Page.captureScreenshot', {format:'png'});
      await writeFile(resolve(evidence, `family-mortgage-${theme}-${width}.png`), Buffer.from(shot.data,'base64'));
    }
    await click('#fm-next'); await ready();
    const next = await view();
    assert.equal(next.query.page, 2);
    assert(await evaluate(`document.querySelector('#fm-reset').hidden`),'Pagination alone is not an active filter requiring reset');
    assert.deepEqual(next.kpis, baseline.kpis, 'Changing table page must preserve the full-slice KPIs');
    assert.deepEqual(next.monthly, baseline.monthly, 'Changing table page must preserve the graph');
    assert.deepEqual(next.counts, baseline.counts, 'Changing table page must preserve the regional summary');
    assert.notDeepEqual(next.rows.map(r => r.id), baseline.rows.map(r => r.id));
    await click('#fm-prev'); await ready();
    assert.deepEqual((await view()).rows, baseline.rows);

    const detailName = await evaluate(`(()=>{
      const b=document.querySelector('#fm-tbody [data-region]');
      if(!b)throw Error('Missing regional detail control');
      const id=b.dataset.region;
      const region=${api}.getView().regions.find(r=>r.id===id);
      b.focus();b.click();return region.name;
    })()`);
    assert(await evaluate(`document.querySelector('#fm-detail').open`), 'Regional details must open');
    assert(await evaluate(`document.querySelector('#fm-detail-title').textContent.includes(${JSON.stringify(detailName)})`), 'Regional detail title must match the selected row');
    assert(await evaluate(`document.querySelector('#fm-detail-body').textContent.trim().length>0`), 'Regional details must have content');
    await escape();
    assert(await evaluate(`!document.querySelector('#fm-detail').open&&document.activeElement.hasAttribute('data-region')`), 'Escape must close details and return focus to its opener');
  }

  // The full dataset oracle catches stale KPIs or mismatched widget filters.
  await evaluate(`(async()=>{window.__mortgageFixture=await fetch('data/family-mortgage-observations.json').then(r=>r.json())})()`);
  await patch({month:'2025-09', district:'all', search:'', page:1});
  await patch({district:'ЦФО'});
  const filtered = await view();
  const expected = await evaluate(`window.familyMortgageData.select(window.__mortgageFixture,${JSON.stringify(filtered.query)})`);
  assert.deepEqual(filtered.kpis, expected.kpis);
  assert.deepEqual(filtered.regions, expected.regions);
  assert(filtered.rowCount > 0 && filtered.rowCount < 89);
  assert.equal(filtered.query.page, 1);
  await evaluate('history.back()');
  await waitFor(`${api}.getView()?.query.district==='all'&&${api}.getView()?.query.month==='2025-09'`);
  await ready();
  await click('#fm-region-filter .dk-select__trigger');
  await evaluate(`(()=>{const input=document.querySelector('#fm-region-filter input');input.value='Москва';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await click('#fm-region-filter .dk-menu__item');
  await waitFor(`${api}.getView()?.query.region!=='all'`); await ready();
  const searched = await view();
  assert(searched.rowCount > 0 && searched.rowCount < 89);
  assert(searched.regions.every(r => r.name.toLocaleLowerCase('ru').includes('москва')));
  await evaluate(`${api}.setQuery({search:'__нет_такого_региона__'})`);
  await waitFor(`document.querySelector('#fm-dashboard').dataset.status==='empty'`);
  assert(await evaluate(`document.querySelector('#fm-content').hidden&&document.querySelector('#fm-export').disabled`), 'Empty results must not leave old widgets or an active export');
  await click('#fm-reset'); await ready();
  assert.equal((await view()).rowCount,89);
  // Inspect the generated artifact through the real CSV serializer without
  // writing a download to the test user's profile.
  await evaluate(`(()=>{
    window.__mortgageCsvOriginal=dkExport.csv;
    dkExport.csv=function(rows,columns,name){
      window.__mortgageExport={rows,columns,name,blob:window.__mortgageCsvOriginal(rows,columns)};
      return window.__mortgageExport.blob;
    };
  })()`);
  await click('#fm-export');
  const exported = await evaluate(`(async()=>{
    const result=window.__mortgageExport;
    dkExport.csv=window.__mortgageCsvOriginal;
    return {count:result.rows.length,rows:result.rows,text:await result.blob.text(),name:result.name};
  })()`);
  assert.equal(exported.count,89, 'CSV must include the full slice, not the visible 12 rows');
  assert(exported.rows.every(row => row.kind === 'demo' && row.from === '2025-04-01' && row.to === '2025-09-30'));
  assert(exported.text.includes('Объём, млн ₽') && exported.text.includes('Одобрено / рассмотрено, %'), 'Export must retain explicit metric units');

  // Genuine browser downloads in an isolated temporary directory; keep the
  // serializer untouched and compare saved bytes/order with the current slice.
  downloadDirectory = await mkdtemp(resolve(tmpdir(), 'dk-mortgage-csv-'));
  await browser.send('Browser.setDownloadBehavior', {behavior:'allow', downloadPath:downloadDirectory, eventsEnabled:true});
  const download = async (selector, filename) => {
    let guid, timer, listener;
    const completion = new Promise((resolve, reject) => {
      timer = setTimeout(()=>reject(Error('CSV download did not complete: '+filename)),20000);
      listener = message => {
        if(message.method==='Browser.downloadWillBegin') {
          if(message.params.suggestedFilename!==filename) {reject(Error('Unexpected CSV filename: '+message.params.suggestedFilename)); return;}
          guid = message.params.guid;
        }
        if(message.method==='Browser.downloadProgress' && message.params.guid===guid) {
          if(message.params.state==='completed') resolve();
          if(message.params.state==='canceled') reject(Error('CSV download canceled'));
        }
      };
      browser.on(listener);
    });
    // Register the handler before clicking, including an early rejection handler.
    completion.catch(()=>{});
    try {
      await click(selector);
      await completion;
      const bytes = await readFile(resolve(downloadDirectory,filename));
      assert.deepEqual([...bytes.subarray(0,3)],[239,187,191],'Excel UTF-8 BOM retained');
      return bytes.toString('utf8');
    } finally {clearTimeout(timer); browser.off(listener);}
  };
  const fullText = await download('#fm-export','family-mortgage-demo-2025-04-01-2025-09-30.csv');
  assert.equal(fullText.replace(/^\uFEFF/,''), exported.text, 'Saved whole-slice CSV matches real serializer (Blob.text omits the BOM)');
  await patch({region:'khmao',month:'all',district:'all',search:'',page:1});
  await click('#fm-tbody [data-region="khmao"]');
  await click('#fm-detail-body th[data-sortable="1"] button');
  await click('#fm-detail-body th[data-sortable="1"] button');
  const regionalExpected = await evaluate(`(()=>{
    const v=${api}.getView(), region=v.regions[0];
    return [...document.querySelectorAll('#fm-detail-body tbody tr')].map(row=>{
      const m=region.monthly.find(m=>m.month===row.dataset.month);
      return [region.name,m.month,m.issued,m.issuedPlan,m.planPct,m.volume,v.source.label,v.source.updatedAt].map(v=>v==null?'':String(v));
    });
  })()`);
  assert.equal(regionalExpected.length,6);
  assert(regionalExpected.every((row,i)=>!i || +row[2]<=+regionalExpected[i-1][2]),'Fact sort descending');
  const regionalText = await download('#fm-detail-export','family-mortgage-khmao-2025-04-01-2025-09-30.csv');
  const regionalRows = regionalText.replace(/^\uFEFF/,'').split('\r\n').map(line=>
    [...line.matchAll(/"((?:""|[^"])*)"/g)].map(match=>match[1].replace(/""/g,'"')));
  assert.deepEqual(regionalRows[0],['Регион','Месяц','Факт, кредитов','План, кредитов','Выполнение, %','Объём, млн ₽','Источник','Обновлено']);
  assert.deepEqual(regionalRows.slice(1),regionalExpected,'Saved regional CSV retains six sorted months, numbers, units, source and update time');
  await escape();
  assert(await evaluate(`!document.querySelector('#fm-detail').open&&document.activeElement.dataset.region==='khmao'`),'Downloaded details close and restore focus');
  await patch({region:'all'});
  console.log('PASS: genuine full-slice and sorted regional CSV files saved/read, UTF-8 BOM, six monthly rows and focus return');

  // Fetch failure must hide prior values and remain recoverable on the same mount.
  await evaluate(`(()=>{
    window.__mortgageLoads=0;
    window.familyMortgageDashboard(document.querySelector('#fm-dashboard'),{
      load:async()=>{if(++window.__mortgageLoads===1)throw Error('injected failure');return window.__mortgageFixture;}
    });
  })()`);
  await waitFor(`document.querySelector('#fm-dashboard').dataset.status==='error'`);
  assert(await evaluate(`document.querySelector('#fm-content').hidden&&!document.querySelector('#fm-retry').hidden`));
  await click('#fm-retry'); await ready();
  assert.equal((await view()).rowCount,89);
  await evaluate(`${api}.destroy();window.familyMortgageDashboard(document.querySelector('#fm-dashboard'),{load:async()=>window.__mortgageFixture})`);
  await ready();
  assert(await evaluate(`document.querySelectorAll('#fm-month-filter .dk-select__trigger').length===1&&document.querySelectorAll('#fm-district-filter .dk-select__trigger').length===1`), 'Remount must release old select instances');
  await waitFor(`document.querySelector('#fm-map .dk-map__tile')`);
  // Each focus creates one tooltip; remount must dispose both that tooltip
  // and callbacks attached to the surviving #fm-map host.
  for (let iteration = 0; iteration < 3; iteration++) {
    await evaluate(`document.querySelector('#fm-map .dk-map__tile').focus()`);
    assert.equal(await evaluate(`document.querySelectorAll('.dk-map__tip').length`),1,'One tooltip per live map');
    await evaluate(`${api}.destroy()`);
    assert.equal(await evaluate(`document.querySelectorAll('.dk-map__tip').length`),0,'Destroy removes the tooltip from document.body');
    await evaluate(`window.familyMortgageDashboard(document.querySelector('#fm-dashboard'),{load:async()=>window.__mortgageFixture})`);
    await ready(); await waitFor(`document.querySelector('#fm-map .dk-map__tile')`);
  }
  // A direct component remount with an observable callback catches duplicate
  // click listeners even if a destroyed consumer happens to ignore its call.
  await evaluate(`(async()=>{
    ${api}.destroy();document.querySelector('#fm-content').hidden=false;
    const [topo,tiles]=await Promise.all(['data/regions.topojson','data/regions-tiles.json'].map(url=>fetch(url).then(r=>r.json())));
    window.__mortgageMapClicks=0;
    const host=document.querySelector('#fm-map');
    for(let n=0;n<3;n++){
      window.__mortgageTestMap=dkMap(host,{topo,object:'ru89',tiles,values:{spb:13.123456789},unit:'п.п. недовыполнения плана',controls:document.querySelector('#fm-map-controls'),onSelect:()=>window.__mortgageMapClicks++});
      if(n<2)window.__mortgageTestMap.destroy();
    }
    host.querySelector('.dk-map__tile').click();
  })()`);
  assert.equal(await evaluate('window.__mortgageMapClicks'),1,'Repeated map mount must retain exactly one click callback');
  await evaluate(`document.querySelector('#fm-map .dk-map__tile[data-id="spb"]').focus()`);
  assert.equal(await evaluate(`document.querySelector('.dk-map__tip-v').textContent.trim()`),'13,12 п.п. недовыполнения плана','Map tooltip must use the kit decimal formatter and explicit units');
  await evaluate('window.__mortgageTestMap.destroy()');
  assert.deepEqual(errors, []);
  console.log('PASS: mortgage consumer, full-slice totals, pages, filters/history, region details/focus, empty/error/retry/remount, themes/mobile/AX names');
} finally {
  if (browser) await browser.close();
  if (downloadDirectory) await rm(downloadDirectory,{recursive:true,force:true});
  if (server) server.kill();
}
