// Acceptance of real fresh-context consumer artifacts, separate from SDK fixtures.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {launch,findChrome} from './browser-harness.mjs';
const option=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
const root=resolve(option('--root','/tmp/kit-evals-20261103')),out=resolve(option('--out','/tmp/kit-agent-eval-evidence-20261103'));
const tasks=option('--tasks','16,17,18,19,20,21,22').split(',').map(Number);
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!path.startsWith(root+sep))throw Error('Path');const body=await readFile(path);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser,ops;
const report={runtime:'Codex native fresh-context agents; coordinator Chrome acceptance',views:[],failures:[]};
try{
 browser=await launch(findChrome());
 const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'}),{sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
 const send=(method,params={})=>browser.send(method,params,sessionId),errors=[];
 browser.on(m=>{if(m.sessionId===sessionId&&m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const frames=()=>ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const wait=condition=>ev(`new Promise((resolve,reject)=>{let n=0;function tick(){if(${condition})return resolve();if(++n>300)return reject(Error('Timeout '+${JSON.stringify(condition)}));setTimeout(tick,25)}tick()})`);
 const key=async(key,code=key)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:key==='Escape'?27:key==='ArrowRight'?39:9});await frames();};
 const click=async selector=>{await ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);await frames();const point=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden click '+${JSON.stringify(selector)});return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}})()`);for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point});await frames();};
 const text=selector=>ev(`document.querySelector(${JSON.stringify(selector)})?.textContent.replace(/\s+/g,' ').trim()`);
 const detailGeometry=async()=>{const geometry=await ev(`(()=>{const dialog=document.querySelector('dialog[open]'),metrics=dialog?.querySelector('.dk-modal__metrics');if(!metrics)return null;const r=x=>{const b=x.getBoundingClientRect();return {top:b.top,bottom:b.bottom,width:b.width,height:b.height}};return {parent:r(metrics),cards:[...metrics.querySelectorAll(':scope > .dk-tile')].map(x=>({box:r(x),label:r(x.querySelector('.dk-tile__label')),text:x.querySelector('.dk-tile__label')?.textContent})),next:metrics.nextElementSibling?r(metrics.nextElementSibling):null}})()`);if(!geometry)return;assert(geometry.cards.length>0,'Real detail cards');assert(geometry.cards.every(x=>x.label.width>20&&x.label.height>8&&x.text?.trim()),'Detail labels really visible '+JSON.stringify(geometry));assert(geometry.cards.every(x=>x.box.bottom<=geometry.parent.bottom+1),'Cards fit their parent '+JSON.stringify(geometry));assert(!geometry.next||geometry.next.top>=geometry.parent.bottom-1,'Details do not overlap following table '+JSON.stringify(geometry));};
 const shot=async(name,check=true)=>{await ev('document.fonts.ready');if(check&&/-detail-|-action-/.test(name))await detailGeometry();await ev('Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished))');await frames();const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,name+'.png'),Buffer.from(r.data,'base64'));};
 const choose=async(host,value)=>{await click(host+' .dk-select__trigger');await click(host+' [data-value="'+value+'"]');};
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 ops=spawn('python3',[resolve(root,'task19/serve.py'),'--port','0'],{cwd:resolve(root,'task19'),stdio:['ignore','pipe','pipe']});
 const opsUrl=await new Promise((res,rej)=>{let body='';const timer=setTimeout(()=>rej(Error('Operations server timeout')),10000);ops.stdout.on('data',x=>{body+=x;const url=body.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(url){clearTimeout(timer);res(url);}});ops.once('exit',code=>{clearTimeout(timer);rej(Error('Operations server exited '+code));});});
 for(const task of tasks)for(const theme of ['dark','light'])for(const width of [390,1280]){
  const entry={task,theme,width,status:'pending'},startErrors=errors.length;
  try{
   await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});await send('Emulation.setTouchEmulationEnabled',{enabled:width<768,maxTouchPoints:5});
   const url=task===19?opsUrl+'/index.html':`http://127.0.0.1:${server.address().port}/task${task}/${task===21?'accepted':'app'}/index.html`;
   await send('Page.navigate',{url:url+'?theme='+theme});await wait("document.readyState==='complete'");await ev('document.fonts.ready');
   await wait(task===16?'!!window.monitoring':task===17?'!!window.planFact':task===18?'!!window.portfolio':task===19?"!!document.querySelector('#ref-rows tr')":task===20?'!!window.weeklyRequests':"document.querySelector('[data-dk-screen-config]')?.dataset.status==='ready'");await frames();
   entry.geometry=await ev("({overflow:document.documentElement.scrollWidth>innerWidth+1,kpis:document.querySelectorAll('.dk-tile,.dk-hero__n').length,copy:[...document.querySelectorAll('p')].filter(x=>x.getClientRects().length&&!x.closest('dialog:not([open]),[hidden]')).map(x=>x.textContent),buttons:[...document.querySelectorAll('button,input')].filter(x=>x.getClientRects().length).map(x=>({name:x.getAttribute('aria-label')||x.textContent,w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}))})");
   await shot(`task${task}-${theme}-${width}`);assert(!entry.geometry.overflow,'Page must not overflow');
   if(width===390)assert(entry.geometry.buttons.every(b=>b.w>=43&&b.h>=43),'Touch controls remain available');
   if(task===19){const toolbar=await ev("(()=>{const group=document.querySelector('.dk-toolbar__group').getBoundingClientRect(),action=document.querySelector('#ref-refresh').getBoundingClientRect();return {intersection:Math.min(group.right,action.right)-Math.max(group.left,action.left)>1&&Math.min(group.bottom,action.bottom)-Math.max(group.top,action.top)>1,left:group.left}})()");assert(!toolbar.intersection&&toolbar.left>=0,'Toolbar group and action do not overlap');}
   if(task===17)assert(await ev("[...document.querySelectorAll('link[rel=stylesheet]')].some(x=>x.href.includes('/css/glass.css'))&&[...document.querySelectorAll('.dk-widget__title')].every(x=>getComputedStyle(x).textTransform==='none')"),'Declared Glass material and shared title style');
   if(task===16){
    assert((await text('#attention')).startsWith('2 из 2'));assert((await text('#performance')).includes('50'));assert((await text('#issued')).includes('100 из 200'));
    await choose('#district','СЗФО');assert.equal(await ev('monitoring.view.kpis.issued'),40);assert.equal(await ev('monitoring.view.kpis.planPct'),80);
    await click('[data-open-region="spb"]');await wait("document.querySelector('#detail').open");assert((await text('#detail-performance')).includes('80'));const headers=await ev("[...document.querySelectorAll('#months thead th')].map(th=>{const range=document.createRange();range.selectNodeContents(th);const b=th.getBoundingClientRect();return [...range.getClientRects()].every(r=>r.left>=b.left-1&&r.right<=b.right+1)})");assert(headers.every(Boolean),'Detail table headers stay inside their own columns');if(width===390){await ev("document.querySelector('#months-scroll').focus()");await key('ArrowRight');await wait("document.querySelector('#months-scroll').scrollLeft>0");}await shot(`task${task}-detail-${theme}-${width}`);
    await key('Escape');assert.equal(await ev('document.activeElement.dataset.openRegion'),'spb');assert.equal(await ev('monitoring.state.district'),'СЗФО');
    await click('#method');assert(await ev("[...document.querySelectorAll('[role=tooltip]')].some(x=>x.getClientRects().length)"),'Method available by click');await key('Escape');
    await ev("window.partial=JSON.parse(JSON.stringify(MONITORING_SOURCE));partial.rows[0].values.issued=null;monitoring.load(partial)");assert.equal(await ev('monitoring.view.kpis.issued'),null);assert((await text('#assessment')).includes('1'));
   }else if(task===17){
    assert((await text('#summary [data-metric=issued] [data-value=percent]')).includes('50'));assert((await text('#summary [data-metric=budget] [data-value=percent]')).includes('62,5'));
    await click('#months [data-month="2025-05"]');assert.equal(await ev('planFact.getView().summary.issued'),30);assert.equal(await ev('planFact.getView().summary.issuedPct'),37.5);
    await click('#regions [data-open="altai-rep"]');await wait("document.querySelector('#detail').open");assert((await text('#detail-summary [data-metric=issued] [data-value=actual]')).includes('0'));await shot(`task${task}-detail-${theme}-${width}`);await key('Escape');
    assert.equal(await ev('planFact.getView().month'),'2025-05');assert.equal(await ev('document.activeElement.dataset.open'),'altai-rep');
    await ev("window.partial=structuredClone(PLAN_SOURCE);partial.rows.forEach(r=>r.values.issuedPlan=0);planFact.replaceSource(partial)");assert.equal(await ev('planFact.getView().summary.issuedPct'),null);assert((await text('#summary [data-metric=issued] [data-value=status]')).toLowerCase().includes('план'));
   }else if(task===18){
    assert((await text('#summary [data-value=issued]')).includes('100'));assert((await text('#summary [data-value=execution]')).includes('50'));assert((await text('#summary [data-value=rate]')).includes('6,6'));
    await choose('#district','СЗФО');assert((await text('#summary [data-value=issued]')).includes('40'));
    await click('[data-detail="spb"]');await wait("document.querySelector('#details').open");assert((await text('#detail-metrics')).includes('4,5'));await shot(`task${task}-detail-${theme}-${width}`);await key('Escape');assert.equal(await ev('document.activeElement.dataset.detail'),'spb');
    await ev("portfolio.reset();portfolio.setMode('partial')");assert((await text('#summary [data-value=issued]')).includes('—'));assert.equal(await ev('portfolio.getView().totals.issued.value'),null);await shot(`task${task}-partial-${theme}-${width}`);
    await ev("portfolio.setMode('original');portfolio.setFilters({district:'СФО',month:'2025-05'})");assert((await text('#summary [data-value=issued]')).includes('0'));assert((await text('#summary [data-value=rate]')).includes('—'));
    await ev("portfolio.setFilters({search:'no-such-region'})");assert(await ev("!document.querySelector('#empty').hidden"));await click('#empty-reset');assert((await text('#summary [data-value=issued]')).includes('100'));
   }else if(task===19){
    assert((await text('#ref-metrics [data-metric=received] .dk-metric-lg')).includes('85'));assert((await text('#ref-metrics [data-metric=completed] .dk-metric-lg')).includes('60'));
    await click('[data-row][data-trigger=details]');await wait("document.querySelector('#ref-detail').open");await shot(`task${task}-detail-${theme}-${width}`);await key('Escape');assert(await ev("document.activeElement.matches('[data-trigger=details]')"),'Details return to real row action');
    await ev("window.realFetch=window.fetch;window.failTask=true;window.fetch=function(input,init){if(failTask&&String(input).includes('/api/tasks')){failTask=false;return Promise.reject(Error('Учебный отказ связи'))}return realFetch(input,init)}");
    await click('[data-row][data-trigger=action]');await wait("document.querySelector('#ref-detail').open");await click('#ref-action');await wait("document.querySelector('#ref-action-status').textContent.length>0&&!document.querySelector('#ref-action').disabled");assert((await text('#ref-action-status')).includes('не подтверждён'));
    await click('#ref-action');await wait("/создан|уже|готов/i.test(document.querySelector('#ref-action-status').textContent)");await shot(`task${task}-action-${theme}-${width}`);await key('Escape');await ev('window.fetch=realFetch');
   }else if(task===20){
    assert.equal(await ev("document.querySelectorAll('.dk-widget').length"),1);assert.equal(await ev("document.querySelectorAll('.dk-tile,.dk-hero,nav').length"),0);
    const rows=await ev("[...document.querySelectorAll('#weekly-requests-table tbody tr')].map(x=>x.textContent)");assert.equal(rows.length,7);assert(rows[0].includes('34')&&rows[6].includes('9'));
    assert.deepEqual(await ev('weeklyRequests.chart.instance.getOption().series[0].data'),[34,28,31,40,36,12,9]);await click('#weekly-requests-method');assert(await ev("[...document.querySelectorAll('[role=tooltip]')].some(x=>x.getClientRects().length)"));await key('Escape');
   }else{
    const api="document.querySelector('[data-dk-screen-config]').dashboardScreen",expected=task===21?[100,50,6.6]:[80,80/150*100,5800/1100];
    const read=()=>ev(`${api}.getSnapshot()`),snapshot=await read(),value=id=>snapshot.values[id]?.value;
    const bindings=await ev("JSON.parse(document.getElementById(document.querySelector('[data-dk-screen-config]').dataset.dkScreenConfig).textContent).spec.bindings"),issueKey=bindings.find(b=>b.kind==='source'&&b.field==='issued')?.id,execKey=bindings.find(b=>b.kind==='named'&&b.field==='execution')?.id,rateKey=bindings.find(b=>b.kind==='named'&&b.field==='rate')?.id;
    assert(issueKey&&execKey&&rateKey,'Named bindings discoverable');[value(issueKey),value(execKey),value(rateKey)].forEach((x,i)=>assert(Math.abs(x-expected[i])<1e-8,'Independent unseen fixture answer'));
    await choose('.dk-screen__filter','value-0');await click('[data-open-details="Север"]');await wait("document.querySelector('dialog').open");await shot(`task${task}-detail-${theme}-${width}`);await key('Escape');assert.equal(await ev('document.activeElement.dataset.openDetails'),'Север');
    await ev(`${api}.setFilters({region:['Юг'],channel:['Отделение']})`);assert(await ev("!document.querySelector('[data-screen-empty]').hidden"));await click('[data-dk-reset]');assert.deepEqual((await read()).query.filters,{});
   }
   assert.equal(errors.length,startErrors,'No runtime exceptions');entry.status='pass';console.log('PASS: native agent artifact',task,theme,width);
  }catch(error){entry.status='fail';entry.error=String(error.stack||error);report.failures.push({task,theme,width,error:entry.error});console.log('FAIL:',task,theme,width,String(error.message||error));await shot(`task${task}-failure-${theme}-${width}`,false).catch(()=>{});}
  report.views.push(entry);await writeFile(resolve(out,'agent-evals.json'),JSON.stringify(report,null,2));
 }
 if(report.failures.length)throw Error(report.failures.length+' eval acceptance failures; see agent-evals.json');
 console.log('PASS: '+tasks.length+' real Codex artifacts, both themes, 390/1280, independent data/interaction acceptance');
}finally{if(browser)await browser.close();if(ops)ops.kill('SIGTERM');server.closeAllConnections();await new Promise(r=>server.close(r));}
