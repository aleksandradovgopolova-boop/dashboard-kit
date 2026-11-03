import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {launch,findChrome} from './browser-harness.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),temp=await mkdtemp(resolve(tmpdir(),'dk-screen-browser-'));
const app=resolve(temp,'app'),out=resolve(process.env.DK_EVIDENCE_DIR||resolve(tmpdir(),'dashboard-kit-screen-evidence'));
let server,browser;
try{
 execFileSync('python3',['tools/build-screen.py','examples/spec/plan-fact.json','--out',app],{cwd:root,stdio:'pipe'});
 await mkdir(out,{recursive:true});
 server=createServer(async(req,res)=>{
  const path=resolve(app,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(path!==app&&!path.startsWith(app+sep)){res.writeHead(403);res.end();return;}
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'};
  try{const data=await readFile(path===app?resolve(app,'index.html'):path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 assert(findChrome(),'Chrome required');browser=await launch(findChrome());
 const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'}),{sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
 const send=(method,params={})=>browser.send(method,params,sessionId),errors=[],report=[];
 browser.on(m=>{if(m.sessionId===sessionId&&m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const frames=()=>ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const wait=condition=>ev(`new Promise((resolve,reject)=>{let i=0;function tick(){if(${condition})return resolve();if(++i>300)return reject(Error('Wait '+${JSON.stringify(condition)}));setTimeout(tick,30)}tick()})`);
 const key=async key=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code:key,windowsVirtualKeyCode:key==='Escape'?27:key==='Tab'?9:key==='ArrowRight'?39:key==='ArrowLeft'?37:13});await frames();};
 const click=async selector=>{await ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);await frames();const point=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}})()`);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point});await frames();};
 const api="document.querySelector('[data-dk-screen-config]').dashboardScreen";
 const values=()=>ev(`${api}.getSnapshot().values`);
 const chartValues=async()=>{await wait("!!echarts.getInstanceByDom(document.querySelector('.dk-screen .dk-chart'))");return ev("echarts.getInstanceByDom(document.querySelector('.dk-screen .dk-chart')).getOption().series.map(s=>s.data)");};
 const assertValues=async(expected)=>{const actual=await values();for(const [name,value] of Object.entries(expected)){assert.equal(actual[name].code,'ready',name);assert(Math.abs(actual[name].value-value)<1e-10,name+' literal value');}};
 const shot=async name=>{await ev('document.fonts.ready');await ev('Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished))');await frames();const result=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,name+'.png'),Buffer.from(result.data,'base64'));};
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 for(const theme of ['dark','light'])for(const width of [320,375,390,768,1280,1920]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});await send('Emulation.setTouchEmulationEnabled',{enabled:width<768,maxTouchPoints:5});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/index.html?theme=${theme}`});await wait("document.querySelector('[data-dk-screen-config]')?.dataset.status==='ready'");await ev('document.fonts.ready');
  await assertValues({issued:100,plan:200,execution:50,'weighted-rate':6.6});
  const layout=await ev(`(()=>{const root=document.querySelector('.dk-screen'),s=getComputedStyle(root),r=x=>x.getBoundingClientRect(),header=root.querySelector('header'),title=header.querySelector('h1'),actions=header.querySelector('.dk-head__actions');return {overflow:document.documentElement.scrollWidth>innerWidth+1,padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],kpis:root.querySelectorAll('[data-screen-kpis] [data-dk-kpi]').length,resetHidden:root.querySelector('[data-dk-reset]').hidden,clearIndicators:root.querySelectorAll('.dk-select__clear').length,titleWidth:r(title).width,titleLines:r(title).height/parseFloat(getComputedStyle(title).lineHeight),header:[r(title).top+r(title).height/2,r(actions).top+r(actions).height/2],titles:[...root.querySelectorAll('.dk-widget__head h2')].map(x=>[getComputedStyle(x).fontSize,getComputedStyle(x).lineHeight,getComputedStyle(x).fontWeight]),buttons:[...root.querySelectorAll('button')].filter(x=>x.getClientRects().length).map(x=>({label:x.getAttribute('aria-label')||x.textContent,width:r(x).width,height:r(x).height}))};})()`);
  assert(!layout.overflow&&new Set(layout.padding).size===1,'Geometry '+JSON.stringify(layout));assert.equal(layout.kpis,3);assert(layout.resetHidden&&layout.clearIndicators===0,'No inactive reset reservation');
  assert(Math.abs(layout.header[0]-layout.header[1])<1,'Header stays one row');assert(layout.titleWidth>=120&&layout.titleLines<=1.05,'Short page title stays readable on one line '+JSON.stringify(layout));assert(layout.titles.every(t=>t.join('/')==='18px/24px/500'),'Shared widget title');
  if(width<768)assert(layout.buttons.every(b=>b.width>=43&&b.height>=43),'Touch targets '+JSON.stringify(layout.buttons));
  if([390,1280].includes(width)){
   await shot(`screen-${theme}-${width}`);
   const invalidFilters=await ev(`(()=>{let rejected=0;for(const filters of [{region:['Север','Юг']},{undeclared:['x']},{region:['missing']}])try{${api}.setFilters(filters)}catch{rejected++}return {rejected,filters:${api}.getSnapshot().query.filters}})()`);
   assert.equal(invalidFilters.rejected,3);assert.deepEqual(invalidFilters.filters,{},'Rejected hidden/multi filters preserve the visible query');
   // Real filter UI binding, independent from the public setFilters helper.
   await click('.dk-screen__filter .dk-select__trigger');await click('.dk-screen__filter [data-value="value-0"]');
   await assertValues({issued:40,execution:80,'weighted-rate':4.5});
   assert(await ev(`!document.querySelector('[data-dk-reset]').hidden`),'Active reset appears');
   await click('[data-open-details="Север"]');await wait("document.querySelector('dialog').open");
   const detail=await ev("[...document.querySelectorAll('dialog .dk-modal__metrics .dk-metric-lg')].map(x=>x.textContent)");assert.deepEqual(detail,['40','80,0%','4,5%'],'Detail literal numbers');
   const labels=await ev("[...document.querySelectorAll('dialog .dk-modal__metrics .dk-tile__label')].map(x=>({text:x.textContent,width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height,visibility:getComputedStyle(x).visibility}))");
   assert.deepEqual(labels.map(x=>x.text),['Выдано','Выполнение плана','Средняя ставка']);assert(labels.every(x=>x.width>80&&x.height>12&&x.visibility!=='hidden'),'Detail KPI labels are really visible '+JSON.stringify(labels));
   if(width===390){
    await ev("window.scrollRegion=document.querySelector('dialog .dk-tablewrap');scrollRegion.scrollLeft=0;scrollRegion.focus()");
    assert(await ev("scrollRegion.tabIndex===0&&scrollRegion.getAttribute('role')==='region'&&!!scrollRegion.getAttribute('aria-label')"),'Named keyboard scroll region');
    if(await ev('scrollRegion.scrollWidth>scrollRegion.clientWidth+1')){await key('ArrowRight');await wait('scrollRegion.scrollLeft>0');}
   }

   assert.equal((await ev(`${api}.getSnapshot().query.filters`)).region[0],'Север');await shot(`screen-detail-${theme}-${width}`);
   await key('Escape');assert(await ev("document.activeElement.dataset.openDetails==='Север'&&!document.querySelector('dialog').open"),'Detail returns focus');
   await assertValues({issued:40,execution:80,'weighted-rate':4.5});
   await ev(`${api}.setFilters({region:['Юг'],channel:['Отделение']})`);
   assert(await ev("!document.querySelector('[data-screen-empty]').hidden&&document.querySelector('[data-screen-content]').hidden&&!document.querySelector('[data-screen-kpis]').children.length"),'Empty slice hides stale values');
   await click('[data-dk-reset]');await assertValues({issued:100,execution:50,'weighted-rate':6.6});assert(await ev("document.querySelector('[data-dk-reset]').hidden"),'Reset removed again');
   // Ordinary row sort uses raw numeric keys, including percentage values.
   await click('[data-screen-table] th[data-sortable="execution"] button');
   assert.equal(await ev("document.querySelector('[data-screen-table] tbody tr').dataset.group"),'Юг');
   await click('[data-screen-info]');assert(await ev("!!document.querySelector('.dk-popover:not([hidden])')&&document.querySelector('.dk-popover').contains(document.activeElement)"),'Method by request');await key('Escape');
   await ev(`window.originalConfig=JSON.parse(document.getElementById(document.querySelector('[data-dk-screen-config]').dataset.dkScreenConfig).textContent);window.partial=JSON.parse(JSON.stringify(originalConfig));partial.data.rows[0].values.issued=null;dkScreen(document.querySelector('.dk-screen'),partial)`);
   const partial=await values();assert.equal(partial.issued.value,null);assert.equal(partial.execution.code,'partial-input');assert.equal(partial['weighted-rate'].value,6.6);
   assert.deepEqual(await chartValues(),[[null,30],[120,80]],'Partial chart point is unavailable, not an understated total');assert(await ev("!!document.querySelector('[data-chart-state=partial]')"),'Partial chart has a reason');
   await shot(`screen-partial-${theme}-${width}`);
   await ev("window.zero=JSON.parse(JSON.stringify(originalConfig));zero.data.rows.forEach(r=>r.values.plan=0);dkScreen(document.querySelector('.dk-screen'),zero)");assert.equal((await values()).execution.code,'zero-denominator');
   await ev("window.missing=JSON.parse(JSON.stringify(originalConfig));missing.data.rows.pop();dkScreen(document.querySelector('.dk-screen'),missing)");assert.equal((await values()).issued.code,'incomplete-source');assert.equal((await values()).execution.value,null);assert((await chartValues()).flat().every(x=>x===null),'Unconfirmed full source has no invented full chart values');
   await ev("dkScreen(document.querySelector('.dk-screen'),originalConfig)");await assertValues({issued:100,execution:50,'weighted-rate':6.6});
   const fontBefore=await ev("parseFloat(getComputedStyle(document.querySelector('[data-screen-kpis] .dk-tile__label')).fontSize)");
   await ev("window.textRoles=[...getComputedStyle(document.documentElement)].filter(name=>/^--(?:size-|lh-)/.test(name)).map(name=>[name,getComputedStyle(document.documentElement).getPropertyValue(name).trim(),document.documentElement.style.getPropertyValue(name)]).filter(([,value])=>/^[0-9.]+px$/.test(value));textRoles.forEach(([name,value])=>document.documentElement.style.setProperty(name,(parseFloat(value)*2)+'px'))");await frames();
   const fontAfter=await ev("parseFloat(getComputedStyle(document.querySelector('[data-screen-kpis] .dk-tile__label')).fontSize)");assert(Math.abs(fontAfter/fontBefore-2)<0.02,'HTML text actually grows to 200%');
   assert(await ev('document.documentElement.scrollWidth<=innerWidth+1'),'Enlarged text stays accessible');
   const wordFits=await ev("(()=>{const title=document.querySelector('.dk-screen h1'),range=document.createRange();range.selectNodeContents(title);const probe=document.createElement('span');probe.textContent='Выдачи';probe.style.cssText='position:fixed;white-space:nowrap;visibility:hidden;font:inherit';title.append(probe);const fits=probe.getBoundingClientRect().width<=title.getBoundingClientRect().width+1;probe.remove();return fits})()");
   assert(wordFits,'Enlarged header reflows before splitting an ordinary word');await shot(`screen-enlarged-${theme}-${width}`);
   await ev("textRoles.forEach(([name,,original])=>{if(original)document.documentElement.style.setProperty(name,original);else document.documentElement.style.removeProperty(name)})");
   const snapshot=await ev(`${api}.getSnapshot()`);snapshot.query.filters.region=['mutated'];assert.deepEqual(await ev(`${api}.getSnapshot().query.filters`),{});
  }
  report.push({theme,width,...layout});console.log('PASS: generated plan-fact',theme,width);
 }
 assert.equal(errors.length,0,'No runtime exceptions');await writeFile(resolve(out,'screen-builder.json'),JSON.stringify({views:report,errors},null,2));
 console.log('PASS: standalone generated screen, both themes, 320–1920, literal KPI/detail values, real filters, empty/reset, data transitions, focus, sort and enlarged text');
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await rm(temp,{recursive:true,force:true});}
