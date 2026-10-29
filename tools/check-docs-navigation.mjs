// Header navigation and static overview regression; no external dependencies.
import {launch,findChrome} from './browser-harness.mjs';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const out=root+'/docs/2026-10-29/kit-clean-home/';
const server=createServer(async(req,res)=>{try{const f=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!f.startsWith(root+sep)){res.writeHead(403);res.end();return;}const b=await readFile(f);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.topojson':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'})[extname(f)]||'application/octet-stream');res.end(b);}catch{res.writeHead(404);res.end();}});
await mkdir(out,{recursive:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try {
 browser=await launch(findChrome());
 const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
 const send=(m,p={})=>browser.send(m,p,sessionId);
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const assert=(yes,message)=>{if(!yes)throw Error(message);};
 await send('Page.enable');await send('Runtime.enable');
 const errors=[];browser.on(e=>{if(e.sessionId===sessionId&&e.method==='Runtime.exceptionThrown')errors.push(e.params.exceptionDetails.text);});
 const expected=['Обзор','Начало работы','Дизайн-система','Компоненты','Разработка'];
 const names=`[...document.querySelectorAll('.sc-mega__rail .sc-nav__text')].map(x=>x.textContent)`;
 const panel=`document.querySelector('.sc-mega__panel:not([hidden])')`;
 async function settled(){await ev('document.fonts.ready');await ev('new Promise(r=>setTimeout(r,100))');}
 async function waitRoute(file){const url=new URL(file,'http://local');for(let i=0;i<100;i++){if(await ev(`location.pathname===${JSON.stringify(url.pathname)}&&location.hash===${JSON.stringify(url.hash)}&&location.search===${JSON.stringify(url.search)}&&document.readyState==='complete'&&!!document.querySelector('.sc-mega__rail')`))break;if(i===99)throw Error('Route failed: '+file);await new Promise(r=>setTimeout(r,60));}await settled();}
 async function visit(file,width,theme='dark',height=900){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setTouchEmulationEnabled',{enabled:width<=680,maxTouchPoints:5});
  const path=file.replace('.html','.html?theme='+theme);await send('Page.navigate',{url:new URL(path,'http://127.0.0.1:'+server.address().port+'/').href});await waitRoute(path);
  assert(JSON.stringify(await ev(names))===JSON.stringify(expected),'Five primary sections');
  assert(await ev(`document.querySelector('.sc-nav').hidden&&!document.querySelector('.sc-shell>.dk-wrap').inert`),'Megamenu is closed by default');
  assert(await ev(`document.documentElement.scrollWidth<=innerWidth+1`),'No page overflow: '+file+' '+width);
 }
 async function open(){await ev(`(()=>{const id=document.querySelector('.sc-mega__panel:not([hidden])').id;document.querySelector('.sc-topnav [aria-controls="'+id+'"]').click();})()`);await settled();assert(await ev(`!document.querySelector('.sc-nav').hidden&&document.querySelector('.sc-shell>.dk-wrap').inert`),'Open menu isolates page');}
 async function choose(name){await ev(`(()=>{const b=[...document.querySelectorAll('button.sc-mega__category')].find(x=>x.querySelector('.sc-nav__text').textContent===${JSON.stringify(name)});if(b.getAttribute('aria-expanded')!=='true')b.click();})()`);await settled();assert(await ev(`${panel}.querySelector('.sc-mega__title').textContent===${JSON.stringify(name)}`),'Selected category: '+name);}
 async function key(key,code=key,virtual=0,shift=false){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,modifiers:shift?8:0});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual,modifiers:shift?8:0});await settled();}
 let count=0;
 for(const file of ['index.html','component-chips-input.html'])for(const theme of ['dark','light'])for(const width of [320,390,744,1024,1280,1536]){
  await visit(file,width,theme);if(file==='index.html'&&[390,1280].includes(width)){assert(await ev(`document.querySelector('.sc-overview-art img').naturalWidth>0&&!document.querySelector('.sc-live-preview')`),'Static hero');const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(out+'home-'+theme+'-'+width+'.png',Buffer.from(shot.data,'base64'));}await open();
  const frame=await ev(`(()=>{const h=document.querySelector('.sc-bar').getBoundingClientRect(),n=document.querySelector('.sc-nav').getBoundingClientRect();return {header:h.bottom,top:n.top,bottom:n.bottom,right:n.right,w:innerWidth,h:innerHeight,controls:[...document.querySelectorAll('.sc-bar button')].filter(x=>x.getClientRects().length).every(x=>x.getBoundingClientRect().bottom<=h.bottom+1)};})()`);
  assert(frame.top>=frame.header-1&&frame.right<=frame.w+1&&frame.bottom<=frame.h+1&&frame.controls,'Header/menu geometry '+JSON.stringify(frame));
  assert(await ev(`(()=>{const n=document.querySelector('.sc-topnav'),r=n.getBoundingClientRect();return (innerWidth<1024||Math.abs((r.left+r.right)/2-innerWidth/2)<1)&&[...n.children].every(x=>{const c=getComputedStyle(x);return c.textDecorationLine==='none'&&c.borderBottomWidth==='0px'&&c.backgroundColor==='rgba(0, 0, 0, 0)'&&!x.querySelector('svg');});})()`),'Centered text navigation with emoji, without underline, pills or arrows');
  await choose('Дизайн-система');assert(await ev(`${panel}.querySelectorAll('.sc-mega__group').length===3&&${panel}.querySelectorAll('a').length===15`),'Design contains all three groups and 15 links');
  assert(await ev(`(()=>{const a=document.querySelector('button.sc-mega__category[aria-expanded="true"]').getBoundingClientRect(),r=document.querySelector('.sc-mega__rail').getBoundingClientRect();return a.left>=r.left-1&&a.right<=r.right+1;})()`),'Selected category is visible on header buttons');
  if(file==='index.html'&&[390,1280].includes(width)){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(out+'header-design-'+theme+'-'+width+'.png',Buffer.from(shot.data,'base64'));}
  await choose('Компоненты');assert(await ev(`${panel}.querySelectorAll('a[href^="component-"]').length===56&&${panel}.querySelectorAll('.sc-mega__group').length===7`),'All components retained');
  await ev(`(()=>{const links=${panel}.querySelectorAll('a');links[links.length-1].focus();})()`);await key('Tab','Tab',9);
  assert(await ev(`document.activeElement===document.querySelector('.sc-brand')`),'Tab wraps to header');
  await key('Escape','Escape',27);assert(await ev(`document.querySelector('.sc-nav').hidden&&!document.querySelector('.sc-shell>.dk-wrap').inert&&document.activeElement.matches('.sc-topnav button')`),'Escape closes and restores focus');
  count++;
 }
 for(const file of ['index.html','component-table.html','showcase.html'])for(const width of [844,1180]){
  await visit(file,width,'dark',390);await open();await choose('Дизайн-система');
  assert(await ev(`document.querySelector('.sc-mega__content').clientHeight>150&&document.querySelector('.sc-nav').getBoundingClientRect().bottom<=innerHeight+1`),'Landscape menu stays usable');count++;
 }
 // Desktop viewport: no clipping or hidden overflow used to make the overview fit.
 for(const [width,height] of [[1024,600],[1280,600],[1280,720],[1366,768],[1440,900],[1536,864],[1920,1080]])for(const theme of ['dark','light']){
  await visit('index.html',width,theme,height);
  assert(await ev(`(()=>{const h=document.querySelector('.sc-hero--overview'),a=h.querySelector('.sc-overview-catalog a'),r=h.getBoundingClientRect();return r.bottom<=innerHeight+1&&a.getBoundingClientRect().bottom<=innerHeight+1&&getComputedStyle(h).overflowY==='visible'&&document.documentElement.scrollHeight<=innerHeight+1;})()`),'Complete overview in desktop viewport '+width+'x'+height+' '+theme);
  assert(await ev(`(()=>{const e=document.querySelector('.sc-overview-examples'),c=e.querySelector('.sc-example-cards'),b=e.querySelector('[data-more-examples]');return !e.querySelector('p')&&c.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING;})()`),'Examples heading, cards, then all-examples action without subtitle');
  if([1280,1440].includes(width)&&height!==600){const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(out+'home-'+theme+'-'+width+'x'+height+'.png',Buffer.from(shot.data,'base64'));}
 }
 // Real mouse movement opens, switches and closes the concrete desktop disclosure.
 await visit('index.html',1280,'dark',720);
 async function pointerTo(selector){const r=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mouseMoved',...r});await settled();}
 await pointerTo('#sc-mega-trigger-2');assert(await ev(`${panel}.querySelector('.sc-mega__title').textContent==='Дизайн-система'&&!document.querySelector('.sc-nav').hidden`),'Mouse hover opens the specific section');
 await pointerTo('#sc-mega-trigger-3');assert(await ev(`${panel}.querySelector('.sc-mega__title').textContent==='Компоненты'`),'Hover switches sections');
 await pointerTo('.sc-mega__panel:not([hidden]) a');assert(await ev(`!document.querySelector('.sc-nav').hidden`),'Pointer bridge into dropdown stays open');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10});await ev('new Promise(r=>setTimeout(r,250))');assert(await ev(`document.querySelector('.sc-nav').hidden`),'Hover menu closes when pointer leaves');
 await pointerTo('#sc-mega-trigger-2');await key('Escape','Escape',27);assert(await ev(`document.querySelector('.sc-nav').hidden&&document.activeElement.id==='sc-mega-trigger-2'`),'Escape dismisses hover menu and restores focus');
 await visit('index.html',1280);await open();await choose('Дизайн-система');
 const routes=await ev(`[...${panel}.querySelectorAll('a')].map(x=>x.getAttribute('href'))`);
 await ev(`document.querySelector('.sc-nav a[href="showcase.html#principy-teksta"]').click()`);await waitRoute('showcase.html#principy-teksta');
 assert(await ev(`document.querySelector('.sc-nav').hidden&&!document.querySelector('#principy-teksta').hidden`),'Click opens article and closes menu');
 for(const route of routes){await visit(route,1280);await open();assert(await ev(`${panel}.querySelector('.sc-mega__title').textContent==='Дизайн-система'`),'Deep link selects design-system category');}
 for(const width of [390,1280]){
  await visit('component-touch.html',width);await open();
  assert(await ev(`${panel}.classList.contains('sc-nav__component-group')`),'Direct component selects component category');
  assert(await ev(`(()=>{const a=document.querySelector('.sc-nav__component-group a[aria-current="page"]').getBoundingClientRect(),r=document.querySelector('.sc-mega__content').getBoundingClientRect();return a.top>=r.top&&a.bottom<=r.bottom;})()`),'Selected component automatically visible');
 }
 await visit('index.html',1280);await open();await choose('Дизайн-система');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:640,y:880});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:640,y:880});await settled();
 assert(await ev(`document.querySelector('.sc-nav').hidden`),'Outside click closes menu');
 await open();await ev(`document.querySelector('.sc-search-trigger').click();const i=document.querySelector('.sc-search input');i.value='Семейная ипотека';i.dispatchEvent(new Event('input'));`);await settled();
 assert(await ev(`document.querySelector('.sc-nav').hidden&&document.querySelector('.sc-search').open&&!!document.querySelector('.sc-search__results a[href="family-mortgage.html"]')`),'Search closes mega and retains example results');
 console.log('PASS: '+count+' responsive portrait/landscape views plus 14 desktop viewport checks and real hover; five categories, 15 design routes, 56 components, mouse/keyboard, header buttons, current component, search, outside click and focus restoration');
 assert(errors.length===0,'Runtime errors: '+errors.join(', '));

} finally {if(browser)await browser.close();server.close();}
