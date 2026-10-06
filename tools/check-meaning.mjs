import {regression} from './browser-harness.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const css=await Promise.all(['css/tokens.primitives.css','css/tokens.semantic.css','css/components.css'].map(f=>readFile(root+f,'utf8')));
const setup=`document.head.appendChild(Object.assign(document.createElement('style'),{textContent:${JSON.stringify(css.join('\n'))}}));document.documentElement.className='dk-root';`;
function test(){
 const ok=(v,m)=>{if(!v)throw Error(m)};
 ok(dkMeaning('crit','text')==='var(--crit-ink)','text role');ok(dkMeaning('crit','fill')==='var(--crit)','fill role');
 for(const [n,r] of [['oops','text'],['crit','oops'],['toString','text'],['crit',undefined]]){let caught=false;try{dkMeaning(n,r)}catch{caught=true}ok(caught,'invalid contract');}
 for(const theme of ['dark','light']){
 document.documentElement.dataset.theme=theme;
 const el=document.createElement('span');el.className='dk-nodata';document.body.append(el);
 ok(getComputedStyle(el).backgroundImage.includes('repeating-linear-gradient'),'texture '+theme);
 ok(dkMeaning.color('nodata','text',el),'resolved theme');ok(dkMeaning.decal(el).color===getComputedStyle(document.documentElement).getPropertyValue('--nodata-pattern').trim(),'canvas texture');el.remove();
 }
 const embedded=document.createElement('div');embedded.className='dk-root';embedded.dataset.theme='dark';document.body.append(embedded);
 ok(dkMeaning.color('crit','text',embedded)!==dkMeaning.color('crit','text',document.body),'root isolation');
 const host=document.createElement('div');document.body.append(host);const uptime=dkUptime(host,{rows:[{name:'Без данных',data:['none','up','down']} ]});
 ok(host.querySelector('[data-state=none]'),'missing state');ok(getComputedStyle(host.querySelector('[data-state=none]')).backgroundImage.includes('gradient'),'uptime texture');
 return 'PASS: meaning roles/rejection, dark/light texture, isolated roots, canvas decal, uptime';
}
try{await regression(['js/dk-util.js','js/dk-uptime.js'].map(f=>root+f),test,setup)}catch(e){console.error(e.message);process.exitCode=1}
