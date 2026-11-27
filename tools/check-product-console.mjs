// Real local API, responsive UI, stale results, XSS, refresh recovery and static fallback.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {findChrome,launch} from './browser-harness.mjs';

const root=new URL('../',import.meta.url).pathname;
const out=process.env.DK_EVIDENCE_DIR?resolve(process.env.DK_EVIDENCE_DIR):await mkdtemp(join(tmpdir(),'dashboard-product-console-'));
await mkdir(out,{recursive:true});
const expected=JSON.parse(execFileSync('python3',['tools/product-console.py','json'],{cwd:root,encoding:'utf8'}));
const server=spawn('python3',['tools/product-console.py','serve','--port','0','--preserve-snapshot'],{cwd:root,stdio:['ignore','pipe','pipe']});
let browser,serverLog='';server.stderr.on('data',d=>{serverLog=(serverLog+d).slice(-6000)});
try{
 const base=await new Promise((ok,no)=>{let log='';const timer=setTimeout(()=>no(Error('Console server timed out')),20000);server.stdout.on('data',chunk=>{log+=chunk;const m=log.match(/http:\/\/127\.0\.0\.1:\d+/);if(m){clearTimeout(timer);ok(m[0]);}});server.on('exit',code=>{clearTimeout(timer);no(Error('Console server exited '+code));});});
 browser=await launch(findChrome());
 const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
 const send=(method,params={})=>browser.send(method,params,sessionId);
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 let loadCount=0;
 const errors=[];browser.on(m=>{if(m.sessionId!==sessionId)return;if(m.method==='Page.loadEventFired')loadCount++;if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');const resources=[];browser.on(m=>{if(m.sessionId===sessionId&&m.method==='Network.responseReceived'&&m.params.type==='Script')resources.push({url:m.params.response.url,status:m.params.response.status,mime:m.params.response.mimeType});});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const settle=()=>ev('document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,250)))');
 var visitNumber=0;
 async function visit(theme){
  const url=base+'/product-console.html?theme='+theme+'&view='+(++visitNumber);
  const beforeLoad=loadCount;
  await send('Page.navigate',{url});
  for(let i=0;i<150;i++){
   if(loadCount>beforeLoad&&await ev('location.href==='+JSON.stringify(url)+"&&document.readyState==='complete'&&document.querySelector('#console-summary .pc-value')&&document.querySelector('#snapshot-time').textContent.startsWith('Локальный статус')")){await settle();return;}
   await new Promise(r=>setTimeout(r,60));
  }
  throw Error('UI did not load: '+JSON.stringify(await ev("({url:location.href,state:document.readyState,time:document.querySelector('#snapshot-time')?.textContent,feedback:document.querySelector('#console-feedback')?.textContent})"))+'; errors='+errors.join(',')+'; scripts='+JSON.stringify(resources)+'; server='+serverLog);
 }
 async function click(selector){await ev('document.querySelector('+JSON.stringify(selector)+').click()');await settle();}
 for(const theme of ['dark','light'])for(const width of [320,390,768,1280]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
  await send('Emulation.setTouchEmulationEnabled',{enabled:width<768,maxTouchPoints:5});
  await visit(theme);
  assert(await ev('document.documentElement.scrollWidth<=innerWidth+1'),'Page overflow '+theme+width);
  assert.equal(await ev('document.documentElement.dataset.theme'),theme);
  assert.equal(await ev("document.querySelectorAll('[data-metric]').length"),3);
  assert(await ev("[...document.querySelectorAll('[data-metric]')].every(n=>n.textContent==='Не измерено')"),'Missing measurements remain unknown');
  assert(await ev('document.querySelector("#console-summary").textContent.includes('+JSON.stringify(expected.aiops.installed || 'Неизвестно')+')'),'Installed version is read from the local config, or explicitly unknown without the AI Ops YAML reader');
  await click('[data-filter="plan"]');
  assert(await ev("[...document.querySelectorAll('#console-work a')].every(a=>a.getAttribute('href')==='planning/plan.yaml')"),'Plan is not copied into a second task list');
  await click('[data-filter="deferred"]');
  assert.equal(await ev("document.querySelectorAll('#console-work .pc-work-row').length"),expected.github.issues.filter(x=>x.deferred).length,'Only deferred tasks, not the entire epic');
  await click('[data-filter="all"]');
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,`console-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
  if(width===390||width===1280){
   const height=await ev('document.documentElement.scrollHeight');
   const full=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width,height:Math.min(height,9000),scale:1},captureBeyondViewport:true});
   await writeFile(resolve(out,`console-full-${theme}-${width}.png`),Buffer.from(full.data,'base64'));
  }
 }
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setTouchEmulationEnabled',{enabled:false,maxTouchPoints:5});
 await visit('dark');
 await ev("document.querySelector('[data-filter=plan]').focus()");
 assert(await ev("document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).backgroundColor!==getComputedStyle(document.activeElement).color"),'Visible keyboard focus');
 await click('[data-theme-set="light"]');assert.equal(await ev('document.documentElement.dataset.theme'),'light');
 await ev("window.consoleFetch=window.fetch;window.fetch=()=>Promise.reject(Error('offline'))");
 await click('#console-refresh');
 assert(await ev("document.querySelector('#console-feedback').textContent.includes('недоступен')&&!document.querySelector('#console-refresh').disabled"),'Failed refresh preserves content and permits retry');
 await ev('window.fetch=window.consoleFetch');await click('#console-refresh');
 assert(await ev("document.querySelector('#snapshot-time').textContent.startsWith('Локальный статус')"),'Refresh recovers');
 await ev(`window.fetch=async()=>{const d=await (await window.consoleFetch('api/product-console')).json();d.github.issues=[{number:999,title:'<img src=x onerror="window.consoleXSS=1">',url:'javascript:alert(1)',state:'open'}];return {ok:true,json:async()=>d}}`);
 await click('#console-refresh');
 assert(await ev("!window.consoleXSS&&!document.querySelector('#console-work img')&&!document.querySelector('#console-work a[href^=javascript]')&&document.querySelector('#console-work').textContent.includes('<img')"),'Remote titles and URLs cannot inject HTML or script');
 await ev('window.fetch=window.consoleFetch');await click('#console-refresh');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"window.fetch=()=>Promise.reject(Error('offline'))"});
 await send('Page.navigate',{url:base+'/product-console.html?theme=dark'});
 await settle();await ev('new Promise(r=>setTimeout(r,250))');
 assert(await ev("document.querySelector('#snapshot-time').textContent.startsWith('Снимок')&&document.querySelectorAll('[data-metric]').length===3&&document.querySelector('#console-refresh').disabled"),'Snapshot remains useful without the local API');
 assert(await ev("document.querySelector('#snapshot-time').textContent.startsWith('Снимок рабочей копии')&&!document.querySelector('a[href^=\".ai/\"]')&&!document.querySelector('a[href^=\".ai-ops/\"]')&&!document.querySelector('a[href^=\"planning/\"]')"),'Public snapshot labels the source and exposes no local-only links');
 await click('[data-filter="plan"]');
 assert(await ev("[...document.querySelectorAll('#console-work a')].every(a=>a.href==='https://github.com/aleksandradovgopolova-boop/dashboard-kit/blob/'+window.DK_PRODUCT_CONSOLE.sourceRevision+'/planning/plan.yaml')"),'Public plan links point to an exact source revision');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
 await ev("[...getComputedStyle(document.documentElement)].filter(n=>/^--(?:size-|lh-)/.test(n)).forEach(n=>{const v=getComputedStyle(document.documentElement).getPropertyValue(n).trim();if(/^[0-9.]+px$/.test(v))document.documentElement.style.setProperty(n,parseFloat(v)*2+'px')})");
 assert(await ev('document.documentElement.scrollWidth<=innerWidth+1'),'200% text remains in viewport');
 assert.deepEqual(errors,[],'No uncaught JS exceptions');
 console.log('PASS: product console, 8 theme/viewport views, real API, plan/deferred filters, unknown metrics, keyboard/theme, refresh recovery, XSS and snapshot fallback, 200% text');
 console.log('Evidence: '+out);
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
