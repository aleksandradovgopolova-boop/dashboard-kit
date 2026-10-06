import {readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {findChrome,launch} from './browser-harness.mjs';


const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function regression() {
  const assert = (v, m) => { if (!v) throw new Error(m); };
  const host = document.createElement('div'); document.body.append(host);
  const changes = [];
  const options = [{value:'a', name:'Alpha'}, {value:'b', name:'Beta'}, {value:'c', name:'Alpine'}];
  const f = dkSelect(host, {label:'Test', options, search:true, mode:'multi', onChange:v=>changes.push(v)});
  const trigger = host.querySelector('button'); trigger.click();
  const input = host.querySelector('input'); input.focus();
  const edit = value => { input.value=value; input.dispatchEvent(new Event('input', {bubbles:true})); };
  edit('Al');
  assert(host.querySelector('input') === input, 'Поиск пересоздал поле');
  assert(document.activeElement === input, 'Потерян фокус');
  assert(host.querySelectorAll('[role=option]').length === 2, 'Фильтрация неверна');
  // Выделение в настоящем текстовом поле: input type=search не поддерживает
  // selectionStart в Chrome, поэтому проверяем тот же узел с type=text.
  input.type='text'; input.setSelectionRange(0,1);
  input.dispatchEvent(new Event('input', {bubbles:true}));
  assert(input.selectionStart===0 && input.selectionEnd===1, 'Потеряно выделение');
  edit('zzz');
  assert(!input.hasAttribute('aria-controls'), 'aria-controls ссылается на удалённый список');
  assert(host.querySelector('.dk-menu__empty'), 'Нет сообщения о пустом результате');
  edit('Al');
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  assert(document.getElementById(input.getAttribute('aria-activedescendant')), 'Не объявлен курсор');
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert(f.value.includes('a') && trigger.getAttribute('aria-expanded')==='true', 'Множественный выбор');
  assert(host.querySelector('input')===input, 'Выбор пересоздал поиск');
  host.querySelector('[data-act=all]').click();
  assert(f.value.length===2, 'Выбрать все видимые');
  assert(changes.length===2, 'Обработчики вызваны повторно');
  f.clear(); assert(f.value.length===0, 'Сброс выбора');
  f.setOptions([{value:'d',name:'Albatross'}]);
  assert(host.querySelectorAll('[role=option]').length===1, 'setOptions');
  input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert(document.activeElement===trigger && trigger.getAttribute('aria-expanded')==='false', 'Escape');
  trigger.click(); assert(input.value==='' && host.querySelector('input')===input, 'Повторное открытие');
  const singleHost=document.createElement('div'); document.body.append(singleHost);
  const single=dkSelect(singleHost,{label:'Single',options,search:true});
  singleHost.querySelector('button').click(); singleHost.querySelector('[data-value=b]').click();
  assert(single.value==='b' && singleHost.querySelector('button').getAttribute('aria-expanded')==='false','Одиночный выбор');
  return 'PASS: поиск, выделение, фокус, клавиатура, пустой результат, multi/single, API, повторное открытие';
}
let browser;
try {
  const chrome=findChrome(); if(!chrome) throw new Error('Chrome не найден');
  browser=await launch(chrome);
  const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
  const send=(method,params)=>browser.send(method,params,sessionId);
  for(const file of [join(ROOT,'js/dk-util.js'),process.env.DK_SELECT_SOURCE || join(ROOT,'js/dk-select.js')]) {
    const r=await send('Runtime.evaluate',{expression:await readFile(file,'utf8')});
    if(r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  }
  const r=await send('Runtime.evaluate',{expression:`(${regression.toString()})()`,returnByValue:true});
  if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  console.log(r.result.value);
} catch(e) { console.error(e.message); process.exitCode=1; }
finally { if(browser) await browser.close(); }
