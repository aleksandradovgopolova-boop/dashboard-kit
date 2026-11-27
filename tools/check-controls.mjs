// Control geometry and real keyboard/pointer states in Chrome; no dependencies.
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {extname} from 'node:path';
import {findChrome,launch} from './browser-harness.mjs';
const styles=await Promise.all(['tokens.primitives.css','tokens.semantic.css','components.css','chrome.css','glass.css'].map(n=>readFile(new URL('../css/'+n,import.meta.url),'utf8')));
const evidence=process.env.DK_EVIDENCE_DIR?resolve(process.env.DK_EVIDENCE_DIR):await mkdtemp(join(tmpdir(),'dashboard-kit-controls-'));
assert(findChrome(),'Chrome required');
const browser=await launch(findChrome()),report=[];
const root=new URL('../',import.meta.url);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.topojson':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const file=new URL('.'+new URL(req.url,'http://localhost').pathname,root);if(!file.href.startsWith(root.href)){res.writeHead(403);res.end();return;}const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file.pathname)]||'application/octet-stream'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
try {
 const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
 const send=(method,params={})=>browser.send(method,params,sessionId);
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Page.enable');await send('Page.bringToFront');await mkdir(evidence,{recursive:true});
 // Headless Linux can have no physical hover-capable pointer. CDP's media
 // override does not change hover/pointer (verified by a separate probe).
 // Emulate only that device capability in this isolated fixture's CSSOM;
 // retain all width conditions and the real :hover selector/mouse events.
 const enableFineHover = force => {
  const native = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (force || !native) {
   const walk = rules => {
    for (const rule of rules) {
     if ((rule instanceof CSSMediaRule) && /\(hover:\s*hover\)/.test(rule.media.mediaText)) {
      rule.media.mediaText = rule.media.mediaText.replace(/\((?:hover:\s*hover|pointer:\s*fine)\)/g, '(min-width: 0px)');
     }
     if (rule.cssRules) walk(rule.cssRules);
    }
   };
   for (const sheet of document.styleSheets) walk(sheet.cssRules);
  }
  return (native && !force) ? 'native' : 'fixture-cssom';
 };
 for(const glass of [false,true])for(const theme of ['dark','light'])for(const touch of [false,true]) {
  await send('Emulation.setTouchEmulationEnabled',{enabled:touch,maxTouchPoints:5});
  await send('Emulation.setDeviceMetricsOverride',{width:touch?390:1280,height:844,deviceScaleFactor:1,mobile:touch});
  const svg='<svg class="dk-i" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h16v16H4z" fill="none" stroke="currentColor"/></svg>';
  const row=size=>{const mod=size==='s'?'':'--'+size;return '<div class="row" data-size="'+size+'"><button class="dk-btn '+(mod?'dk-btn'+mod:'')+'">Действие</button><button class="dk-iconbtn '+(mod?'dk-iconbtn'+mod:'')+'" aria-label="Настройки">'+svg+'</button><div class="dk-seg dk-seg--icons '+(mod?'dk-seg'+mod:'')+'" role="group" aria-label="Вид"><button aria-pressed="true" aria-label="Карта">'+svg+'</button><button aria-pressed="false" aria-label="Список">'+svg+'</button></div><div class="dk-seg '+(mod?'dk-seg'+mod:'')+'" role="group" aria-label="Период"><button aria-pressed="true">7 дней</button><button aria-pressed="false">30 дней</button></div><button class="dk-btn '+(mod?'dk-btn'+mod:'')+'">'+svg+'Добавить</button></div>';};
  const html='<!doctype html><html class="dk-root" data-theme="'+theme+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles.slice(0,glass?5:4).join('\n')+'\n.row{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:12px}body{padding:12px}</style></head><body class="'+(glass?'dk-glass':'')+'">'+['s','md','lg'].map(row).join('')+'<button class="dk-btn" disabled>Недоступно</button><button class="dk-btn dk-btn--primary" aria-disabled="true">Сохранить</button><div class="dk-field"><input aria-label="Название" placeholder="Название"></div><nav class="dk-tabs"><a class="dk-tab" href="#a" aria-current="page">Обзор</a><a class="dk-tab" href="#b">Работа <span class="dk-tab__n">7</span></a></nav><nav class="dk-tabbar"><a class="dk-tabbar__item" href="#a"><span>Обзор</span></a><a class="dk-tabbar__item" href="#b"><span>Работа</span></a></nav></body></html>';
  await send('Page.navigate',{url:'data:text/html;charset=utf-8,'+encodeURIComponent(html)});
  const hoverCapability=touch?'touch':await ev('('+enableFineHover.toString()+')('+glass+')');
  const geometry=await ev(`Array.from(document.querySelectorAll('.row')).map(row=>({size:row.dataset.size,items:[...row.children].map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {width:r.width,height:r.height,padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft]}})}))`);
  for(const row of geometry){const expected=touch?44:({s:32,md:36,lg:44}[row.size]);for(const item of row.items)assert.equal(item.height,expected,JSON.stringify({glass,theme,touch,row}));assert.equal(row.items[1].width,expected);const y=touch?12:({s:6,md:8,lg:12}[row.size]),x=({s:16,md:16,lg:24}[row.size]);assert.deepEqual(row.items[0].padding,[y,x,y,x].map(n=>n+'px'),'Text button has balanced paired gutters');}
  assert.equal(await ev("getComputedStyle(document.querySelector('.dk-field input')).paddingLeft"),'12px','Input left inset');
  assert(await ev("[...document.querySelectorAll('.row > button .dk-i')].every(n=>n.getBoundingClientRect().width===20&&n.getBoundingClientRect().height===20)"),'Action icons stay 20px for every size and pointer');
  const tabWidths=await ev("[...document.querySelectorAll('.dk-tab')].map(n=>n.getBoundingClientRect().width)");
  await ev("document.querySelectorAll('.dk-tab')[1].setAttribute('aria-current','page');document.querySelector('.dk-tab').removeAttribute('aria-current')");
  assert.deepEqual(await ev("[...document.querySelectorAll('.dk-tab')].map(n=>n.getBoundingClientRect().width)"),tabWidths,'Switching the current tab does not shift labels');
  assert.equal(await ev("getComputedStyle(document.querySelectorAll('.dk-tab')[1],'::after').height"),'2px','Current tab has a persistent underline');
  await ev("document.querySelectorAll('.dk-tab')[1].setAttribute('aria-current','false')");
  assert.equal(await ev("getComputedStyle(document.querySelectorAll('.dk-tab')[1],'::after').content"),'none','aria-current=false is not selected');
  await ev("document.querySelectorAll('.dk-tab')[1].removeAttribute('aria-current');document.querySelector('.dk-tab').setAttribute('aria-current','page')");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  await ev('new Promise(r=>setTimeout(r,200))');
  const focus=await ev("(()=>{const e=document.activeElement,s=getComputedStyle(e);return {button:e.classList.contains('dk-btn'),visible:e.matches(':focus-visible'),outline:s.outlineStyle,bg:s.backgroundColor,color:s.color}})()");
  assert(focus.button&&focus.visible&&focus.outline==='none'&&focus.bg!==focus.color,'Visible keyboard fill without outline '+JSON.stringify(focus));
  for(const selector of ['.dk-tab','.dk-iconbtn']) {
   await ev('document.querySelector('+JSON.stringify(selector)+').focus()');
   await ev('new Promise(r=>setTimeout(r,200))');
   assert.equal(await ev("getComputedStyle(document.activeElement).backgroundColor"),focus.bg,'Consistent visible focus: '+selector);
  }
  await ev("document.querySelectorAll('.dk-tab')[1].focus()");
  await ev('new Promise(r=>setTimeout(r,200))');
  assert(await ev("getComputedStyle(document.querySelector('.dk-tab__n')).color===getComputedStyle(document.activeElement).color"),'Tab count stays readable on the focus fill');
  // Focused selected segments must keep their own distinct focus fill.
  await ev("document.querySelector('.dk-seg button').focus()");
  await ev('new Promise(r=>setTimeout(r,200))');
  assert.equal(await ev("getComputedStyle(document.activeElement).backgroundColor"),focus.bg,'Selected segment keyboard fill');
  const ax=await send('Accessibility.getFullAXTree');
  for(const label of ['Карта','Список','Настройки'])assert(ax.nodes.some(n=>n.role?.value==='button'&&n.name?.value===label),'Accessible name: '+label);
  if(!touch){
   for(const selector of ['.dk-btn[disabled]','.dk-btn[aria-disabled="true"]']) {
    const state=await ev('(()=>{const n=document.querySelector('+JSON.stringify(selector)+'),r=n.getBoundingClientRect();return {bg:getComputedStyle(n).backgroundColor,x:r.x+r.width/2,y:r.y+r.height/2}})()');
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:state.x,y:state.y});
    await ev('new Promise(r=>setTimeout(r,200))');
    assert.equal(await ev('getComputedStyle(document.querySelector('+JSON.stringify(selector)+')).backgroundColor'),state.bg,'Disabled button does not react to hover');
   }
   const point=await ev("(()=>{const r=document.querySelector('.dk-tab').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
   const before=await ev("getComputedStyle(document.querySelector('.dk-tab')).backgroundColor");
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
   await ev('new Promise(r=>setTimeout(r,200))');
   const hovered=await ev("(()=>{const e=document.querySelector('.dk-tab');return {bg:getComputedStyle(e).backgroundColor,hover:e.matches(':hover'),native:matchMedia('(hover: hover) and (pointer: fine)').matches}})()");
   assert(hovered.hover&&hovered.bg!==before,'Tab hover is visible '+JSON.stringify({hoverCapability,hovered,before}));
   await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
   const nav=await ev("(()=>{const e=document.querySelector('.dk-tabbar__item'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,bg:getComputedStyle(e).backgroundColor}})()");
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:nav.x,y:nav.y});
   await ev('new Promise(r=>setTimeout(r,200))');
   assert.notEqual(await ev("getComputedStyle(document.querySelector('.dk-tabbar__item')).backgroundColor"),nav.bg,'Narrow-screen tabbar hover is visible');
   await send('Emulation.setDeviceMetricsOverride',{width:1280,height:844,deviceScaleFactor:1,mobile:false});
  }else{
   assert(await ev("!matchMedia('(hover: hover)').matches"),'Touch has no hover capability');
   const point=await ev("(()=>{const e=document.querySelector('.dk-tab'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,bg:getComputedStyle(e).backgroundColor}})()");
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
   await ev('new Promise(r=>setTimeout(r,200))');
   assert.equal(await ev("getComputedStyle(document.querySelector('.dk-tab')).backgroundColor"),point.bg,'Touch excludes mouse-only hover styles');
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]});
  await ev("document.querySelector('.dk-tab').focus()");
  assert.equal(await ev("getComputedStyle(document.activeElement).outlineStyle"),'solid','System focus survives forced colors');
  await send('Emulation.setEmulatedMedia',{features:[]});
  await ev("document.activeElement.blur()");
  // Zoom text without clipping: a size variant is a minimum, not a fixed line box.
  await ev("document.querySelectorAll('.dk-btn').forEach(n=>{n.style.fontSize='28px';n.style.lineHeight='40px'})");
  assert(await ev("[...document.querySelectorAll('.dk-btn')].every(n=>n.scrollHeight<=n.clientHeight+1)"),'200% text fits');
  await ev("document.querySelectorAll('.dk-btn').forEach(n=>{n.style.fontSize='';n.style.lineHeight=''})");
  await writeFile(resolve(evidence,`controls-${glass?'glass':'base'}-${theme}-${touch?'touch':'mouse'}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  report.push({glass,theme,touch,hoverCapability,geometry,focus});
 }
 for(const page of ['dashboard','family-mortgage','regions','calendar'])for(const theme of ['dark','light'])for(const width of [390,1280]){
  await send('Emulation.setTouchEmulationEnabled',{enabled:width===390,maxTouchPoints:5});
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width===390});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/${page}.html?theme=${theme}`});
  await ev('document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,400)))');
  const segments=await ev("[...document.querySelectorAll('.dk-seg')].filter(n=>n.getClientRects().length).map(n=>({id:n.id,label:n.getAttribute('aria-label'),height:n.getBoundingClientRect().height,expected:parseFloat(getComputedStyle(n).getPropertyValue('--glass-control-size'))}))");
  assert(segments.length,'Live switches exist');
  for(const seg of segments)assert.equal(seg.height,seg.expected,JSON.stringify({page,theme,width,seg}));
  if(page==='calendar')assert(await ev("[...document.querySelectorAll('.dk-cal__head')].every(head=>{const boxes=[...head.children].map(n=>n.getBoundingClientRect());return boxes.every((a,i)=>boxes.every((b,j)=>i===j||Math.min(a.right,b.right)-Math.max(a.left,b.left)<1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<1))})"),'Calendar header controls do not overlap');
  report.push({page,theme,width,segments});
 }
 await writeFile(resolve(evidence,'controls.json'),JSON.stringify(report,null,2));
 console.log('PASS: controls S/M/L, proportional text gutters, stable tab selection, disabled hover, touch targets, keyboard focus, input inset, hover and icon names (8 fixtures + 16 live views)');
 console.log('Evidence:',evidence);
}finally{await browser.close();server.close();}
