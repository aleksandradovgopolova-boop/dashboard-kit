// Local acceptance of opened layers after shared sizing changes; uses existing 8771.
import assert from 'node:assert/strict';
import {launch,findChrome} from './browser-harness.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('../docs/2026-10-30/compact-system/',import.meta.url));await mkdir(out,{recursive:true});
const b=await launch(findChrome());
try{
 const {targetId}=await b.send('Target.createTarget',{url:'about:blank'}),{sessionId}=await b.send('Target.attachToTarget',{targetId,flatten:true});
 const send=(m,p={})=>b.send(m,p,sessionId),ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const settle=()=>ev('new Promise(r=>setTimeout(r,220))');
 async function visit(file,width,theme){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await send('Emulation.setTouchEmulationEnabled',{enabled:width<768,maxTouchPoints:5});await send('Page.navigate',{url:'http://localhost:8771/'+file+'?theme='+theme});for(let i=0;i<100;i++){if(await ev("document.readyState==='complete'&&!!document.querySelector('.sc-mega__rail')"))break;await settle();}await ev('document.fonts.ready');}
 async function key(key,virtual){await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:virtual});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:virtual});await settle();}
 async function pointer(selector){const p=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await send('Input.dispatchMouseEvent',{type:'mouseMoved',...p});await settle();}
 async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(out+name+'.png',Buffer.from(r.data,'base64'));}
 for(const theme of ['dark','light']){
  await visit('index.html',1280,theme);
  for(const i of [1,2,3,4]){await pointer('#sc-mega-trigger-'+i);assert(await ev(`!document.querySelector('.sc-nav').hidden&&document.querySelector('#sc-mega-trigger-${i}').getAttribute('aria-expanded')==='true'`),'Hover each section');await pointer('.sc-mega__panel:not([hidden]) a');assert(await ev("!document.querySelector('.sc-nav').hidden"),'Pointer bridge');await pointer('#sc-mega-trigger-'+i);assert(await ev("!document.querySelector('.sc-nav').hidden"),'Return cancels close');if(i===2||i===3)await shot('menu-'+i+'-'+theme);}
  await key('Escape',27);assert(await ev("document.querySelector('.sc-nav').hidden"),'Escape closes menu');
  await ev("document.querySelector('a[href=\"#examples\"]').click()");await settle();assert(await ev("!document.querySelector('#examples').hidden&&document.querySelectorAll('#examples a[href$=\".html\"]').length===7"),'All examples opens real list');
  for(const width of [390,1280]){
   await visit('component-modal.html',width,theme);await ev("(()=>{const b=document.querySelector('[data-modal=\"#x-form\"]');b.focus();b.click();})()");await settle();
   assert(await ev("document.querySelector('#x-form').open"),'Live modal opens');
   assert(await ev("(()=>{const r=document.querySelector('#x-form').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;})()"),'Modal stays in viewport');
   await key('Tab',9);assert(await ev("document.querySelector('#x-form').contains(document.activeElement)"),'Tab remains inside modal');await shot('modal-'+theme+'-'+width);await key('Escape',27);assert(await ev("!document.querySelector('#x-form').open&&document.activeElement.dataset.modal==='#x-form'"),'Escape restores modal opener');
  }
 }
 console.log('PASS: all four desktop hover sections, pointer bridge/return, Escape, All examples, live modal at 390/1280 in both themes, Tab and focus restoration');
}finally{await b.close();}
