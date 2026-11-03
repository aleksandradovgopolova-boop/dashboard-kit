import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {launch,findChrome} from './browser-harness.mjs';
const css=(await Promise.all(['tokens.primitives.css','tokens.semantic.css','components.css'].map(n=>readFile(new URL('../css/'+n,import.meta.url),'utf8')))).join('\n');
const scripts=(await Promise.all(['dk-util.js','dk-modal.js','dk-context.js','dk-select.js','dk-popover.js'].map(n=>readFile(new URL('../js/'+n,import.meta.url),'utf8')))).map(s=>'<script>'+s.replace(/<\/script/gi,'<\\/script')+'</script>').join('');
const evidence=resolve(process.env.DK_EVIDENCE_DIR||resolve(tmpdir(),'dashboard-kit-popover-evidence'));
assert(findChrome(),'Chrome required');const browser=await launch(findChrome()),report=[],errors=[];
try{
 const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'}),{sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
 browser.on(m=>{if(m.sessionId===sessionId&&m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)});
 const send=(method,params={})=>browser.send(method,params,sessionId);
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const frames=()=>ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const key=async(name,shift=false)=>{for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:name,code:name,modifiers:shift?8:0,windowsVirtualKeyCode:name==='Escape'?27:name==='Tab'?9:13});await frames();};
 const click=async selector=>{const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await frames();};
 const bounds=()=>ev(`(()=>{const r=api.element.getBoundingClientRect(),s=getComputedStyle(api.element);return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,viewport:[innerWidth,innerHeight],padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],shadow:s.boxShadow,open:!api.element.hidden,focus:api.element.contains(document.activeElement),placement:api.element.dataset.placement}})()`);
 await send('Page.enable');await send('Runtime.enable');await mkdir(evidence,{recursive:true});
 for(const native of [true,false])for(const theme of ['dark','light'])for(const width of [320,390,1280]){
  if(process.env.DK_POPOVER_CASE&&process.env.DK_POPOVER_CASE!==[native?'native':'fallback',theme,width].join(':'))continue;
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  const height=600;await send('Emulation.setTouchEmulationEnabled',{enabled:width<768,maxTouchPoints:5});await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
  const html='<!doctype html><html class="dk-root" data-theme="'+theme+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><button id="opener" class="dk-btn">Сведения</button><button id="after" class="dk-btn">Следующее действие</button><div style="height:1600px"></div>'+scripts+'</body></html>';
  await send('Page.navigate',{url:'data:text/html;charset=utf-8,'+encodeURIComponent(html)});await ev('document.fonts.ready');
  if(!native)await ev("HTMLElement.prototype.showPopover=undefined;HTMLElement.prototype.hidePopover=undefined");
  await ev(`window.content=document.createElement('div');content.innerHTML='<label for="note">Заметка</label><input class="dk-input" id="note"><a href="#target" id="link">Источник данных</a><button class="dk-btn" id="confirm">Применить</button>';window.api=dkPopover(document.querySelector('#opener'),{label:'Данные и методика',content});`);
  await click('#opener');assert.equal(await ev('document.activeElement.id'),'note','Initial content focus');
  let state=await bounds();assert(state.open&&state.focus&&state.shadow==='none');assert(new Set(state.padding).size===1,'Equal padding');
  assert(await ev("api.element.getAttribute('role')==='dialog'&&document.querySelector('#opener').getAttribute('aria-expanded')==='true'"),'ARIA');
  await ev("document.querySelector('#confirm').focus()");await key('Tab');assert(await ev("api.element.hidden&&document.activeElement.id==='after'"),'Tab resumes after trigger');
  await click('#opener');await ev("api.element.querySelector('.dk-iconbtn').focus()");await key('Tab',true);assert(await ev("api.element.hidden&&document.activeElement.id==='opener'"),'Shift Tab returns trigger');
  await click('#opener');await key('Escape');assert(await ev("api.element.hidden&&document.activeElement.id==='opener'"),'Escape restore');
  await click('#opener');await click('#after');assert(await ev("api.element.hidden&&document.activeElement.id==='after'"),'Outside click preserves destination focus');
  if(width<768){
   const touch=await ev("(()=>{const r=document.querySelector('#opener').getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}})()");
   await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await frames();
   assert(await ev('!api.element.hidden'),'Touch opens');await key('Escape');
  }
  await ev("document.querySelector('#opener').style.cssText='position:absolute;left:8px;top:100px';api.open();window.scrollTo(0,500)");await frames();assert(await ev('api.element.hidden'),'Scroll removes orphaned layer');await ev('window.scrollTo(0,0)');await frames();
  await ev("document.querySelector('#opener').style.cssText='position:fixed;right:8px;bottom:8px';api.open()");await frames();state=await bounds();
  assert(state.left>=0&&state.top>=0&&state.right<=width+1&&state.bottom<=height+1,'Edge bounds');assert.equal(state.placement,'top');
  await ev("api.update({content:'<img src=x onerror=alert(1)>'})");assert(await ev("!api.element.querySelector('img')&&api.element.textContent.includes('<img')&&api.element.contains(document.activeElement)"),'Text escaped and update focus');
  await ev("api.update({content:'Длинное содержание '.repeat(200)})");await frames();assert(await ev('api.element.scrollHeight>api.element.clientHeight'),'Long content scrolls');
  await ev("api.element.scrollTop=80;window.dispatchEvent(new Event('resize'));document.documentElement.style.setProperty('--size-14','28px');document.documentElement.style.setProperty('--lh-20','40px')");await frames();state=await bounds();assert(state.right<=width+1&&state.bottom<=height+1&&state.top>=0,'Resize/text growth remains bounded');
  await ev("api.update({content:'Методика доступна по запросу'});api.close();document.documentElement.style.removeProperty('--size-14');document.documentElement.style.removeProperty('--lh-20')");
  await ev(`window.dialog=document.createElement('dialog');dialog.className='dk-modal';dialog.innerHTML='<button id="modal-opener" class="dk-btn">Настройки</button><button class="dk-btn">Далее</button>';document.body.append(dialog);dkModal(dialog).open();window.modalContent=document.createElement('div');modalContent.innerHTML='<input aria-label="Период"><button class="dk-btn">Применить</button>';window.modalApi=dkPopover(document.querySelector('#modal-opener'),{label:'Настройки периода',content:modalContent});modalApi.open();`);await frames();
  assert(await ev('modalApi.element.parentElement===dialog&&modalApi.element.contains(document.activeElement)'), 'Popover belongs to modal '+JSON.stringify(await ev("({hidden:modalApi.element.hidden,parent:modalApi.element.parentElement?.tagName,focus:[document.activeElement.tagName,document.activeElement.id],trigger:document.querySelector('#modal-opener').getBoundingClientRect().toJSON(),panel:modalApi.element.getBoundingClientRect().toJSON(),dialog:dialog.getBoundingClientRect().toJSON(),scrollY})")));
  await key('Escape');assert(await ev("dialog.open&&modalApi.element.hidden&&document.activeElement.id==='modal-opener'"),'Escape closes one layer');
  await ev("window.animation=dialog.animate([{transform:'scale(.97)'},{transform:'none'}],{duration:80});window.pending=modalApi.open();modalApi.close();pending");
  assert(await ev('modalApi.element.hidden&&dialog.open'),'Pending open is cancellable without closing parent');
  await ev("window.animation=dialog.animate([{transform:'scale(.97)'},{transform:'none'}],{duration:80});window.pending=modalApi.open();dialog.querySelectorAll('button')[1].focus();pending");
  assert(await ev('modalApi.element.hidden&&dialog.open'),'Pending open cannot steal focus after navigation');

  await ev("window.selectHost=document.createElement('div');window.selectApi=dkSelect(selectHost,{options:[{value:'a',name:'Первый'},{value:'b',name:'Второй'}]});modalApi.update({content:selectHost});modalApi.open();selectHost.querySelector('button').click()");await frames();
  await key('Escape');assert(await ev("!modalApi.element.hidden&&dialog.open&&selectHost.querySelector('button').getAttribute('aria-expanded')==='false'"),'Nested select Escape only closes select');
  await key('Escape');await key('Escape');assert(await ev('!dialog.open'),'Parent modal remains keyboard closable');
  await ev("modalApi.destroy();dialog.remove();api.update({label:'Обновлённая методика'});api.open()");await frames();
  const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(evidence,`popover-${native?'native':'fallback'}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
  await ev("api.destroy();api.destroy();api.open()");assert(await ev("!document.querySelector('.dk-popover')&&!document.querySelector('#opener').hasAttribute('aria-controls')"),'Destroy cleanup and idempotence');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert(await ev("matchMedia('(prefers-reduced-motion: reduce)').matches"),'Reduced motion emulation');
  await ev("window.previous=dkPopover(document.querySelector('#opener'),{label:'Первая',content:'Первое'});window.current=dkPopover(document.querySelector('#opener'),{label:'Вторая',content:'Второе'});previous.destroy();current.open()");assert(await ev("current.element.getAttribute('aria-labelledby')&&document.querySelector('#opener').getAttribute('aria-controls')===current.element.id"),'Reinit owns ARIA');
  await ev("window.other=document.createElement('button');other.textContent='Другие сведения';other.style.cssText='position:fixed;top:80px;right:8px';document.body.append(other);window.otherApi=dkPopover(other,{label:'Другие сведения',content:'Другой текст'});otherApi.open()");assert(await ev("current.element.hidden&&!otherApi.element.hidden"),'One active layer');await ev("otherApi.destroy();other.remove()");
  await ev("current.destroy();window.removed=document.createElement('button');removed.textContent='Удалить';removed.style.cssText='position:fixed;right:8px;top:120px';document.body.append(removed);window.removedApi=dkPopover(removed,{label:'Удаляемый',content:'Текст'});removedApi.open();removed.remove()");await frames();assert(await ev("!document.querySelector('.dk-popover')"),'Removed trigger disposes layer');
  report.push({native,theme,width,height,...state});console.log('PASS: popover',native?'native':'fallback',theme,width);
 }
 assert.equal(errors.length,0,'No runtime exceptions');
 await writeFile(resolve(evidence,'popover.json'),JSON.stringify(report,null,2));console.log('PASS: Popover geometry, focus/Tab/Escape, outside click, modal/select, text growth, native/fallback and lifecycle');
}finally{await browser.close();}
