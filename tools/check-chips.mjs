import {readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {findChrome,launch} from './browser-harness.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function test(){
 const ok=(v,m)=>{if(!v)throw Error(m)};
 const host=document.createElement('div');document.body.append(host);
 const calls=[];const f=dkChipsInput(host,{label:'Метки',value:[' a ','a',null],onChange:v=>calls.push(v)});
 const input=host.querySelector('input');ok(f.value().join()==='a','normalize');
 const key=(k,composing=false)=>input.dispatchEvent(new KeyboardEvent('keydown',{key:k,isComposing:composing,bubbles:true,cancelable:true}));
 input.value='b';key('Enter',true);ok(f.value().length===1,'IME');key('Enter');ok(f.value().join()==='a,b'&&calls.length===1,'add');
 input.value='b';key('Enter');ok(calls.length===1,'duplicate');input.value='';key('Backspace');
 ok(document.activeElement===host.querySelectorAll('[data-chip-remove]')[1],'Backspace focus');document.activeElement.click();
 ok(f.value().join()==='a'&&document.activeElement===host.querySelector('[data-chip-remove]'),'remove focus');
 f.disabled(true);input.value='c';key('Enter');ok(f.value().join()==='a'&&input.disabled,'disabled');
 f.disabled(false);f.value(['<img src=x onerror=alert(1)>']);ok(!host.querySelector('img'),'escaping');
 const g=dkChipsSelect(host,{label:'Выбор',options:[{value:'a',label:'A'},{value:'b',disabled:true}],onChange:v=>calls.push(v)});
 const select=host.querySelector('select');select.value='a';select.dispatchEvent(new Event('change',{bubbles:true}));ok(g.value().join()==='a','select');
 ok(select.querySelector('[value=a]').disabled&&select.querySelector('[value=b]').disabled,'selected/disabled options');
 f.destroy();ok(host.querySelector('select')===select,'old destroy');g.destroy();ok(!host.children.length,'destroy');
 return 'PASS: ChipsInput/Select normalization, IME, duplicates, focus, disabled, safe text, reinit/destroy';
}
let browser;
try{
 const chrome=findChrome();if(!chrome)throw Error('Chrome не найден');browser=await launch(chrome);
 const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
 const send=(m,p)=>browser.send(m,p,sessionId);
 for(const f of ['js/dk-util.js','js/dk-chips.js']){const r=await send('Runtime.evaluate',{expression:await readFile(join(ROOT,f),'utf8')});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);}
 const r=await send('Runtime.evaluate',{expression:`(${test.toString()})()`,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);console.log(r.result.value);
}catch(e){console.error(e.message);process.exitCode=1}finally{if(browser)await browser.close()}
