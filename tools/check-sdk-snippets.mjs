// Consumer integration: copy kit.py head + published examples into clean pages.
// This checks the SDK recipe, not an independent AI execution of skill prompts.
import {launch,findChrome} from './browser-harness.mjs';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,symlink,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join,resolve,sep,extname} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=await mkdtemp(join(tmpdir(),'dk-sdk-snippets-'));
const manifest=JSON.parse(await readFile(join(root,'kit-manifest.json'),'utf8'));
const parts=Object.fromEntries(manifest.parts.map(p=>[p.id,p]));
const groups=[['breadcrumbs','details-sidebar','tooltip'],['heatmap'],['bullet-chart','period-comparison','timeline-annotations'],['fullscreen','export','density-controls'],['tree-select'],['saved-views','layout-editor']];
let browser,server;const results=[];
try {
 for(const dir of ['css','js','vendor','fonts','icons'])await symlink(join(root,dir),join(fixture,dir));
 for(const [i,names] of groups.entries()){
  const head=execFileSync('python3',['tools/kit.py','head',...names],{cwd:root,encoding:'utf8',timeout:60000});
  const body=names.map(n=>parts[n].example).join('\n');
  await writeFile(join(fixture,`scenario-${i+7}.html`),`<!doctype html><html lang="ru" class="dk-root" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SDK scenario ${i+7}</title>${head}</head><body class="dk-page"><main class="dk-wrap"><h1 class="dk-h1">SDK scenario ${i+7}</h1>${body}</main></body></html>`);
  execFileSync('python3',['tools/check.py','--fast','--page',join(fixture,`scenario-${i+7}.html`)],{cwd:root,stdio:'pipe',timeout:60000});
 }
 server=createServer(async(req,res)=>{try{const f=resolve(fixture,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!f.startsWith(fixture+sep)){res.writeHead(403);return res.end()}const data=await readFile(f);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[extname(f)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await launch(findChrome());const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
 const send=(m,p)=>browser.send(m,p,sessionId);
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
 await send('Runtime.enable');await send('Page.enable');
 const errors=[];browser.on(m=>{if(m.sessionId===sessionId&&m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)});
 const evidence=process.env.DK_EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});
 for(const [i,names] of groups.entries())for(const theme of ['dark','light'])for(const width of [390,1280]){
  const before=errors.length;
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
  await send('Emulation.setTouchEmulationEnabled',{enabled:width===390});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/scenario-${i+7}.html?theme=${theme}`});
  await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.readyState==='complete'){clearInterval(t);document.fonts.ready.then(()=>setTimeout(resolve,250));}else if(++n>100){clearInterval(t);reject(Error('load timeout'));}},50)})`);
  if(errors.length!==before)throw Error(`scenario ${i+7}: ${errors.slice(before).join('; ')}`);
  const result=await evaluate(`(()=>{const required=${JSON.stringify(names)},selectors={'breadcrumbs':'.dk-breadcrumbs','details-sidebar':'.dk-sidebar','tooltip':'.dk-tooltip','heatmap':'.dk-heatmap__table','bullet-chart':'.dk-bullet','period-comparison':'.dk-comparison','timeline-annotations':'.dk-annotations','fullscreen':'#advanced-fullscreen-button[aria-pressed]','export':'.dk-export','density-controls':'.dk-density select','tree-select':'[role=treeitem]','saved-views':'.dk-saved-views','layout-editor':'.dk-layout-editor'};const ids=new Set(),duplicates=[];for(const el of document.querySelectorAll('[id]')){if(ids.has(el.id))duplicates.push(el.id);ids.add(el.id)}return {missing:required.filter(n=>!document.querySelector(selectors[n])),duplicates,width:document.documentElement.scrollWidth,viewport:innerWidth,theme:document.documentElement.dataset.theme};})()`);
  if(result.missing.length||result.duplicates.length||result.width>width+1||result.theme!==theme)throw Error(`scenario ${i+7}: ${JSON.stringify(result)}`);
  const ax=await send('Accessibility.getFullAXTree');if(ax.nodes.some(n=>!n.ignored&&['button','combobox','textbox','searchbox'].includes(n.role?.value)&&!n.name?.value))throw Error(`scenario ${i+7}: unnamed control`);
  if(width===390){const small=await evaluate(`Array.from(document.querySelectorAll('button,input,select,a[href],[role=treeitem]')).filter(e=>!e.disabled&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').filter(e=>{const r=e.getBoundingClientRect();return r.width<43.9||r.height<43.9}).map(e=>e.textContent||e.getAttribute('aria-label')||e.tagName)`);if(small.length)throw Error(`scenario ${i+7}: small touch controls ${small.join(', ')}`)}
  // Interactions confirm copied examples include their host-side wiring.
  if(names.includes('details-sidebar'))await evaluate(`(()=>{const b=document.querySelector('[data-modal]');b.focus();b.click();const d=document.querySelector('.dk-sidebar');if(!d.open)throw Error('sidebar wiring');d.querySelector('button').click();if(d.open||document.activeElement!==b)throw Error('sidebar close/focus');})()`);
  if(names.includes('tooltip'))await evaluate(`(()=>{const b=document.querySelector('#advanced-tooltip');b.focus();if(document.querySelector('.dk-tooltip').hidden)throw Error('tooltip wiring');b.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));if(!document.querySelector('.dk-tooltip').hidden)throw Error('tooltip Escape');b.blur();})()`);
  if(names.includes('heatmap'))await evaluate(`(async()=>{const root=document.documentElement,cell=document.querySelector('td.dk-nodata'),probe=document.createElement('span');probe.style.backgroundColor='var(--surface)';root.append(probe);for(const theme of ['light','dark',${JSON.stringify(theme)}]){root.dataset.theme=theme;await new Promise(r=>setTimeout(r,250));if(getComputedStyle(cell).backgroundColor!==getComputedStyle(probe).backgroundColor)throw Error('no-data background did not follow live theme');if(getComputedStyle(cell).color!==getComputedStyle(root).color)throw Error('no-data text did not follow live theme')}probe.remove();})()`);
  if(names.includes('fullscreen'))await evaluate(`(async()=>{const b=document.querySelector('#advanced-fullscreen-button');b.focus();b.click();await new Promise(r=>setTimeout(r,100));if(!document.querySelector('dialog.dk-fullscreen[open]')&&!document.fullscreenElement)throw Error('fullscreen wiring');document.querySelector('#advanced-fullscreen-exit').click();await new Promise(r=>setTimeout(r,100));if(document.querySelector('dialog.dk-fullscreen[open]')||document.fullscreenElement||document.activeElement!==b)throw Error('fullscreen close/focus');})()`);
  results.push({scenario:i+7,theme,width,parts:names});
  if(evidence){const {data}=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(evidence,`sdk-${i+7}-${theme}-${width}.png`),Buffer.from(data,'base64'))}
 }
 if(process.env.DK_EVIDENCE_DIR)await writeFile(join(process.env.DK_EVIDENCE_DIR,'sdk-snippets.json'),JSON.stringify({kind:'consumer integration; independent AI skill execution not assessed',results},null,2));
 console.log('PASS: 13 published SDK examples assembled on 6 clean pages; static rules, deferred loading, real actions, 390/1280, dark/light');
} finally {if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await rm(fixture,{recursive:true,force:true})}
