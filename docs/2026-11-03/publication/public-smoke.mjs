import {launch,findChrome} from '../../../tools/browser-harness.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=process.cwd(),out=resolve(root,'docs/2026-11-03/publication');
const origin='https://aleksandradovgopolova-boop.github.io/dashboard-kit/';
await mkdir(out,{recursive:true});
const files=['family-mortgage.html','css/page.family-mortgage.css','js/family-mortgage.js','js/family-mortgage-data.js','js/dk-analysis.js','kit-manifest.json','component-period-comparison.html','component-period-comparison.md','skill/dashboard-build/references/recipes.md','skill/dashboard-build/references/numeric-checks.md','assets/examples/family-mortgage-dark.png','assets/examples/family-mortgage-light.png','index.html','regions.html','accidents.html','calendar.html','dashboard.html','reference-dashboard.html','component-table.html','component-table.md','css/components.css','css/chrome.css','css/glass.css','css/page.dashboard.css','css/page.regions.css','css/reference-dashboard.css','js/reference-dashboard.js','docs/assembly-rules.md','skill/dashboard-build/references/data.md','assets/examples/regions-dark.png'];
const hashes=[];
for(const file of files){
 const response=await fetch(origin+file+'?publication='+process.env.DK_PUBLISHED_SHA,{headers:{'Cache-Control':'no-cache'}});
 if(!response.ok)throw Error(file+' HTTP '+response.status);
 const expected=createHash('sha256').update(await readFile(resolve(root,file))).digest('hex');
 const actual=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
 hashes.push({file,expected,actual,status:response.status});if(expected!==actual)throw Error('Published file mismatch: '+file);
}
await writeFile(resolve(out,'published-hashes.json'),JSON.stringify({origin,sha:process.env.DK_PUBLISHED_SHA,files:hashes},null,2));
const b=await launch(findChrome()),views=[],errors=[];
try{
 const {targetId}=await b.send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await b.send('Target.attachToTarget',{targetId,flatten:true});
 const send=(m,p={})=>b.send(m,p,sessionId);
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:false});
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 b.on(m=>{if(m.sessionId===sessionId&&m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)});
 for(const theme of ['dark','light'])for(const [file,width,height] of [['index',1366,768],['index',390,844],['regions',1470,836],['accidents',713,836],['family-mortgage',1280,900],['family-mortgage',390,900],['component-period-comparison',1280,900],['component-period-comparison',390,900]]){
  await send('Page.navigate',{url:'about:blank'});await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await send('Emulation.setTouchEmulationEnabled',{enabled:width<768,maxTouchPoints:5});
  await send('Page.navigate',{url:origin+file+'.html?theme='+theme+'&publication='+process.env.DK_PUBLISHED_SHA});
  for(let i=0;i<1200;i++){if(await ev(`location.pathname.endsWith('/${file}.html')&&document.readyState==='complete'`))break;if(i===1199)throw Error('Load timeout '+file+' '+JSON.stringify(await ev('({url:location.href,ready:document.readyState,title:document.title})')));await ev('new Promise(r=>setTimeout(r,100))');}
  await ev('document.fonts.ready');await ev('new Promise(r=>setTimeout(r,200))');
  const state=await ev(`(()=>{const r=x=>x?.getBoundingClientRect();const side=r(document.querySelector('.dk-side')),content=r(document.querySelector('.dk-focus-layout__primary'));return {overflow:document.documentElement.scrollWidth>innerWidth+1,titles:[...document.querySelectorAll('.dk-widget__head .dk-head__title,.dk-widget__title')].filter(x=>x.getClientRects().length).map(x=>{const s=getComputedStyle(x);return [s.fontSize,s.lineHeight,s.fontWeight]}),gap:side&&content?content.left-side.right:null,cards:document.querySelectorAll('.sc-example-cards>a').length,heroText:document.querySelector('.sc-overview-intro p')?.textContent||'',buttons:[...document.querySelectorAll('.sc-overview-intro .dk-btn')].map(x=>r(x).height),headerRow:(()=>{const a=['.dk-top__burger','.dk-top__titles','.dk-top__tools .dk-seg'].map(s=>document.querySelector(s));return a.every(x=>x&&x.getClientRects().length)?a.map(x=>(r(x).top+r(x).bottom)/2):null})(),sortHeaders:[...document.querySelectorAll('#a-table th[aria-sort]')].filter(x=>x.getClientRects().length).map(x=>[getComputedStyle(x).backgroundColor,getComputedStyle(x).borderRadius])};})()`);
  if(state.overflow||state.titles.some(t=>t.join('/')!=='18px/24px/500'))throw Error('Published geometry mismatch: '+JSON.stringify({file,width,theme,state}));
  if(file==='regions'&&state.gap!==14)throw Error('Published rail gap');
  if(file==='index'){
   if(state.cards!==4||state.buttons.some(h=>h!==44))throw Error('Published overview actions/examples');
   await ev(`document.querySelector('.sc-overview-intro a[href="#start"]').click()`);
   if(!await ev(`!document.querySelector('#start').hidden&&!!document.querySelector('#dashboard-task-form')`))throw Error('Published task journey');
   await ev(`location.hash=''`);await ev('new Promise(r=>setTimeout(r,150))');
  }
  if(file==='accidents'){
   if(Math.max(...state.headerRow)-Math.min(...state.headerRow)>1||state.sortHeaders.some(([bg,r])=>bg!=='rgba(0, 0, 0, 0)'||r!=='0px'))throw Error('Published accident header');
   await ev(`document.querySelector('#a-table').closest('.dk-widget').scrollIntoView({block:'start'})`);
  }
  if(file==='family-mortgage'){
   for(let i=0;i<600;i++){if(await ev("document.querySelector('#fm-dashboard')?.dataset.status==='ready'"))break;if(i===599)throw Error('Public mortgage data timeout');await ev('new Promise(r=>setTimeout(r,100))');}
   state.issued=await ev("document.querySelector('#fm-issued').textContent");if(state.issued.replace(/\s/g,'')!=='282682')throw Error('Public default mortgage total '+state.issued);
   const entry=await ev("document.querySelector('#fm-tbody [data-region]')?.getAttribute('data-region')");
   await ev(`document.querySelector('#fm-tbody [data-region="${entry}"]').click()`);
   await ev('document.fonts.ready');await ev('Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished))');
   state.detail=await ev("({open:document.querySelector('#fm-detail').open,opacity:getComputedStyle(document.querySelector('#fm-detail')).opacity,method:!!document.querySelector('#fm-detail details')})");
   if(!state.detail.open||state.detail.opacity!=='1'||!state.detail.method)throw Error('Public mortgage detail');
  }
  if(file==='component-period-comparison'){
   const text=await ev("document.querySelector('#advanced-comparison').innerText");if(!text.includes('Неполный период')||!text.includes('База: 40 заявок'))throw Error('Public comparison context');
   await ev("document.querySelector('#advanced-comparison').scrollIntoView({block:'center'})");
   await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
   await ev("document.querySelector('#advanced-comparison button').focus()");
   state.comparison=await ev("(()=>{const b=document.querySelector('#advanced-comparison button'),t=document.getElementById(b.getAttribute('aria-describedby'));return {text:b.textContent,tipVisible:!t.hidden,reason:t.textContent,width:b.getBoundingClientRect().width,container:b.parentElement.getBoundingClientRect().width,delta:!!document.querySelector('#advanced-comparison .dk-comparison__delta')};})()");
   if(!state.comparison.tipVisible||state.comparison.delta||(width===1280&&state.comparison.width>=state.comparison.container/2)){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,'diagnostic-comparison.png'),Buffer.from(shot.data,'base64'));throw Error('Public comparison reason '+JSON.stringify(state.comparison));}
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   if(!await ev("document.getElementById(document.querySelector('#advanced-comparison button').getAttribute('aria-describedby')).hidden"))throw Error('Public comparison Escape');
   await ev("document.querySelector('#advanced-comparison button').click()");
  }
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(out,`published-${file}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
  views.push({file,theme,width,height,...state});console.log('Verified published view',file,theme,width);
 }
 if(errors.length)throw Error('Published JS exceptions: '+errors.join('; '));
 await writeFile(resolve(out,'smoke.json'),JSON.stringify({origin,sha:process.env.DK_PUBLISHED_SHA,views,errors},null,2));
 console.log('PASS: 30 published hashes; sixteen Chrome views, both themes, overview/examples, rail gap, widget titles, mobile table, mortgage details and comparison reason/Escape');
}finally{await b.close();}
