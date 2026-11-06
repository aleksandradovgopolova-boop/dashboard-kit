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
    const controls = await evaluate(`Array.from(document.querySelectorAll('.fm-topbar .dk-select__trigger,.fm-topbar .dk-iconbtn,.fm-topbar__tools .dk-seg button,.fm-filters')).filter(x=>x.getClientRects().length).map(x=>{const s=getComputedStyle(x),r=x.getBoundingClientRect(),b=Array.from(x.children).filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect());return {name:x.className,leftInset:parseFloat(s.getPropertyValue('--field-inset')),padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map(parseFloat),insets:x.matches('.dk-select__trigger')?[Math.min(...b.map(n=>n.top))-r.top,r.right-Math.max(...b.map(n=>n.right)),r.bottom-Math.max(...b.map(n=>n.bottom)),Math.min(...b.map(n=>n.left))-r.left]:[]};})`);
    for (const c of controls) {
      if(c.insets.length){
        // Owner's 06.11 input/select exception: larger left inset, other edges equal.
        assert.equal(c.padding[3],c.leftInset,'Filter left padding uses field-inset');
        assert(Math.max(...c.padding.slice(0,3))-Math.min(...c.padding.slice(0,3))<.1,'Other filter paddings remain equal: '+JSON.stringify(c));
        assert(c.insets.every((v,i)=>Math.abs(v-(i===3?c.leftInset:c.padding[i]))<=1.1),'Actual filter edges match their tokens: '+JSON.stringify(c));
      }else assert(Math.max(...c.padding)-Math.min(...c.padding)<.1,'Equal button/container padding on all four sides: '+JSON.stringify(c));
    }
  };

  // Consumer acceptance: optional explanations, rather than a second test of
  // the generic Tooltip API. Real source changes and filters exercise cleanup.
  const coverageHidden = async () => {
    assert(await evaluate(`(()=>{const b=document.querySelector('#fm-coverage');return b.hidden&&!b.textContent&&!b.hasAttribute('aria-describedby')&&!b.getClientRects().length;})()`),'Complete coverage leaves no status, tooltip link or reserved slot');
    assert.equal(await evaluate(`document.querySelectorAll('.dk-tooltip[id^="dk-tooltip-"]').length`),0,'No stale coverage tooltip');
  };
  const tipFor = selector => evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}),id=b.getAttribute('aria-describedby'),t=document.getElementById(id);return {id,text:t?.textContent,visible:!!t&&!t.hidden,role:t?.getAttribute('role'),inDialog:!!t?.closest('dialog'),name:b.getAttribute('aria-label')};})()`);
  const pointerAt = async selector => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  const focusHint = async selector => {
    await pointerAt(selector);
    await evaluate('new Promise(requestAnimationFrame)');
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus({preventScroll:true})`);
  };
  const tap = async selector => {
    const point = await pointerAt(selector);
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:1,radiusY:1}]});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const checkCoverage = async (width,theme) => {
    await evaluate(`(async()=>{
      window.__mortgageCoverageFixture=await fetch('data/family-mortgage-observations.json').then(r=>r.json());
      window.__mortgageCoverageSource=structuredClone(window.__mortgageCoverageFixture);
      window.__mortgageCompleteRegion=window.__mortgageCoverageFixture.rows.find(r=>r.dimensions.region!=='spb').dimensions.region;
      window.familyMortgageDashboard(document.querySelector('#fm-dashboard'),{url:false,load:async()=>window.__mortgageCoverageSource});
    })()`);
    await ready(); await waitFor(`document.querySelector('#fm-map .dk-map__tile')`);
    const full = await view();
    await coverageHidden();
    const load = async mutation => {
      await evaluate(`(async()=>{window.__mortgageCoverageSource=structuredClone(window.__mortgageCoverageFixture);${mutation};await ${api}.session.retry();})()`);
      await ready();
    };
    await load(`window.__mortgageCoverageSource.rows.find(r=>r.dimensions.region==='spb').values.issued=null`);
    assert.equal((await view()).kpis.issued,null,'Partial observation stays missing rather than zero');
    assert.equal(await evaluate(`document.querySelector('#fm-coverage').textContent.trim()`),'Без оценки: 1');
    await focusHint('#fm-coverage');
    const partialTip = await tipFor('#fm-coverage');
    assert(partialTip.visible&&partialTip.role==='tooltip'&&partialTip.name.includes('пояснение')&&partialTip.text.includes('не ноль'),'Focus reveals named, described partial-data explanation: '+JSON.stringify(partialTip));
    assert(!partialTip.text.includes('нулевом плане'),'Partial data is not mislabelled as a zero denominator');
    await escape(); assert(!(await tipFor('#fm-coverage')).visible,'Escape dismisses coverage explanation');
    await evaluate(`document.querySelector('#fm-coverage').blur()`);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',...await pointerAt('#fm-coverage')});
    assert((await tipFor('#fm-coverage')).visible,'Mouse hover exposes the same explanation');
    await escape();
    if (width===390) {
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
      await tap('#fm-coverage');
      await waitFor(`!document.getElementById(document.querySelector('#fm-coverage').getAttribute('aria-describedby')).hidden`);
      assert(await evaluate(`(()=>{const r=document.querySelector('#fm-coverage').getBoundingClientRect();return r.height>=44&&r.width>=44;})()`),'Coverage touch target is at least 44×44');
      await tap('#fm-coverage');
      assert(!(await tipFor('#fm-coverage')).visible,'Second emulated tap dismisses the pinned explanation');
      await tap('#fm-map-controls [data-view="list"]');
      assert(await evaluate(`document.querySelector('#fm-map').dataset.view==='list'&&document.querySelector('#fm-map .dk-map__li[data-id="spb"]').textContent.includes('Санкт-Петербург')`),'Emulated tap opens the list with full region names');
      await tap('#fm-map .dk-map__li');
      assert(await evaluate(`document.querySelector('#fm-detail').open`),'An emulated list tap opens actual region details');
      await escape();
      await tap('#fm-map-controls [data-view="tiles"]');
      await evaluate(`document.querySelector('#fm-map .dk-map__pan').scrollLeft=0`);
      const pan=await pointerAt('#fm-map .dk-map__pan');
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pan.x+60,y:pan.y}]});
      for (let step=1;step<=6;step++) {
        await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pan.x+60-step*20,y:pan.y}]});
        await evaluate('new Promise(requestAnimationFrame)');
      }
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await waitFor(`document.querySelector('#fm-map .dk-map__pan').scrollLeft>20`);
      assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),'Map pans inside its viewport without page overflow');
    } else {
      await click('#fm-coverage'); assert((await tipFor('#fm-coverage')).visible,'Click opens the explanation');
      await click('#fm-coverage'); assert(!(await tipFor('#fm-coverage')).visible,'Repeated click dismisses the explanation');
    }
    await evaluate(`scrollTo(0,0);document.activeElement.blur()`);
    const shot = await send('Page.captureScreenshot',{format:'png'});
    await writeFile(resolve(evidence,`family-mortgage-partial-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));

    for(let repeat=0;repeat<2;repeat++) {
      await click('#fm-map .dk-map__tile[data-id="spb"]');
      await evaluate('new Promise(requestAnimationFrame)');
      assert.equal(await evaluate(`document.querySelectorAll('#fm-detail-coverage').length`),1,'One regional coverage entry after repeated opening');
      assert(await evaluate(`!document.querySelector('#fm-detail-method').open&&!document.querySelector('#fm-detail-body').innerText.includes('Полоса ограничена')`),'Methodology stays available on demand without a permanent explanatory paragraph');
      await focusHint('#fm-detail-coverage');
      const regionalTip=await tipFor('#fm-detail-coverage');
      assert(regionalTip.visible&&regionalTip.inDialog&&regionalTip.text.includes('полный факт'),'Regional explanation belongs to the active modal: '+JSON.stringify(regionalTip));
      const metricBounds = await evaluate(`Array.from(document.querySelectorAll('#fm-detail-kpis .dk-tile'),card=>{
        const value=card.querySelector('.dk-metric-lg'),r=card.getBoundingClientRect(),v=value.getBoundingClientRect(),s=getComputedStyle(card);
        return {text:value.textContent,left:v.left-r.left-parseFloat(s.paddingLeft),right:r.right-parseFloat(s.paddingRight)-v.right,overflow:value.scrollWidth>value.clientWidth+1};
      })`);
      assert(metricBounds.every(v=>v.left>=-1&&v.right>=-1&&!v.overflow),'Regional metric values stay within equal card padding: '+JSON.stringify(metricBounds));
      await escape();
      assert(await evaluate(`document.querySelector('#fm-detail').open`),'First Escape dismisses only the explanation');
      if(width===390) {
        await tap('#fm-detail-coverage');
        assert((await tipFor('#fm-detail-coverage')).visible,'Emulated tap reveals the regional explanation inside the dialog');
        await tap('#fm-detail-coverage');
        assert(!(await tipFor('#fm-detail-coverage')).visible&&await evaluate(`document.querySelector('#fm-detail').open`),'Repeated regional tap dismisses only its explanation');
      }
      if(repeat===0) {
        await evaluate(`document.querySelector('#fm-detail-method summary').focus()`);
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
        await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
        const disclosure=await evaluate(`({open:document.querySelector('#fm-detail-method').open,text:document.querySelector('#fm-detail-body').innerText,focus:document.activeElement.tagName,dialog:document.querySelector('#fm-detail').open})`);
        assert(disclosure.open&&disclosure.text.includes('Полоса ограничена'),'Keyboard reveals the existing methodology disclosure: '+JSON.stringify(disclosure));
        await click('#fm-detail-method summary');
      }
      await escape();
      await waitFor(`!document.querySelector('#fm-detail').open&&!document.querySelector('#fm-detail .dk-tooltip')`);
      assert(await evaluate(`!document.getElementById(${JSON.stringify(regionalTip.id)})`),'Closing details removes its tooltip and stale contents');
    }
    await evaluate(`${api}.setQuery({region:window.__mortgageCompleteRegion})`); await ready();
    await coverageHidden();
    assert(await evaluate(`!document.getElementById(${JSON.stringify(partialTip.id)})`),'A complete filtered slice removes the earlier explanation');
    await click('#fm-tbody [data-region]');
    assert(await evaluate(`!document.querySelector('#fm-detail-coverage')&&!document.querySelector('#fm-detail-method').open`),'Complete regional details do not retain a partial status or open methodology');
    await escape();
    await patch({region:'all'});
    await load(''); await coverageHidden();
    assert.deepEqual((await view()).kpis,full.kpis,'Full observations restore the original metrics');

    await load(`window.__mortgageCoverageSource.rows.find(r=>r.dimensions.region==='spb').values.volume=null`);
    assert.equal((await view()).counts.missing,0,'Missing volume does not remove a valid plan assessment');
    assert.equal(await evaluate(`document.querySelector('#fm-coverage').textContent.trim()`),'Частичные данные','Non-plan missing data still has a visible status');
    await focusHint('#fm-coverage');
    assert((await tipFor('#fm-coverage')).text.includes('не ноль')&&!(await tipFor('#fm-coverage')).text.includes('полный факт'),'Volume-only explanation does not invent a missing plan');
    await load(''); await coverageHidden();

    await patch({month:'2025-09'});
    assert(await evaluate(`document.querySelector('#fm-context').textContent==='Учебные данные · 01.09.2025–30.09.2025'&&document.querySelector('#fm-context').getClientRects().length>0`),'Visible common period follows the selected month');
    await patch({month:'all'});

    await load(`window.__mortgageCoverageSource.rows.filter(r=>r.dimensions.region==='spb').forEach(r=>{r.values.issued=null;r.values.issuedPlan=null;})`);
    await patch({region:'spb'});
    assert.equal((await view()).counts.missing,1);
    assert(await evaluate(`document.querySelector('#fm-rank').textContent.includes('Нет данных об отставании')`),'Missing observations do not assert that no regions are behind plan');
    await patch({region:'all'});
    await load(''); await coverageHidden();

    await load(`window.__mortgageCoverageSource.rows.filter(r=>r.dimensions.region==='spb').forEach(r=>{r.values.issuedPlan=0;})`);
    assert(await evaluate(`Object.values(${api}.getView().kpis.coverage).every(c=>!c.partial)`),'Zero denominator fixture has complete coverage');
    await click('#fm-coverage');
    const zeroTip=await tipFor('#fm-coverage');
    assert(zeroTip.visible&&zeroTip.text.includes('нулевом плане')&&!zeroTip.text.includes('Неполные'),'Zero denominator has its own explanation, not a false partial-data warning');
    await escape();
    await click('#fm-map .dk-map__tile[data-id="spb"]');
    assert.equal(await evaluate(`document.querySelector('#fm-detail-coverage').textContent.trim()`),'Без оценки выполнения');
    await focusHint('#fm-detail-coverage');
    assert((await tipFor('#fm-detail-coverage')).text.includes('нулевом плане'),'Regional details preserve the zero-denominator explanation');
    await load(''); await coverageHidden();
    assert(await evaluate(`!document.querySelector('#fm-detail').open`),'Reload closes stale regional details');
    assert(await evaluate(`!document.getElementById(${JSON.stringify(zeroTip.id)})`),'Restored source removes zero-denominator tooltip content');
    assert.deepEqual((await view()).kpis,full.kpis);
    await send('Emulation.setTouchEmulationEnabled',{enabled:false});
  };

  for (const theme of ['light', 'dark']) for (const width of [320, 390, 600, 768, 859, 860, 886, 1024, 1100, 1280, 1536]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height:900, deviceScaleFactor:1, mobile:width < 768});
    const url = `${base}/family-mortgage.html?theme=${theme}`;
    await send('Page.navigate', {url});
    await waitFor(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&document.querySelector('#fm-dashboard')?.dataset.status==='ready'`);
    await evaluate('document.fonts.ready');
    await waitFor(`document.querySelector('#fm-map .dk-map__tile')`);
    assert(await evaluate(`!document.querySelector('.fm-map-help')`),'The working map has no permanent instruction paragraph');
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
    const periodText=baseline.period.from.split('-').reverse().join('.')+'–'+baseline.period.to.split('-').reverse().join('.');
    assert.equal(await evaluate(`document.querySelector('#fm-context').textContent`),'Учебные данные · '+periodText,'Working overview exposes data kind and actual date range');
    if(width===390) assert(await evaluate(`document.querySelector('#fm-filter-panel').hidden&&document.querySelector('#fm-context').getClientRects().length>0`),'Phone context stays visible while filters are closed');
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
    if ([390,1280].includes(width)) await checkCoverage(width,theme);
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
