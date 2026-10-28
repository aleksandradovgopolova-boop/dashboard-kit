// End-to-end reference consumer: the real Python fixture API and Chrome.
// Deliberately separate from Node-only contract tests; a skipped browser is not PASS.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {launch, findChrome} from './browser-harness.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let browser, server;
try {
  const chrome = findChrome();
  assert(chrome, 'Chrome required for the reference consumer');
  server = spawn('python3', ['tools/reference-server.py','--port','0'], {cwd:root,stdio:['ignore','pipe','pipe']});
  const base = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error('Reference server startup timeout: '+output)),15000);
    server.stdout.on('data',chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    server.stderr.on('data',chunk => { output += chunk; });
    server.on('error',error => { clearTimeout(timer); reject(error); });
    server.on('exit',code => { clearTimeout(timer); reject(Error('Reference server exited '+code+': '+output)); });
  });
  browser = await launch(chrome);
  const {targetId} = await browser.send('Target.createTarget',{url:'about:blank'});
  const {sessionId} = await browser.send('Target.attachToTarget',{targetId,flatten:true});
  const send = (method,params={}) => browser.send(method,params,sessionId);
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = expression => evaluate(`new Promise((resolve,reject)=>{let n=0;const tick=()=>{if(${expression})return resolve(true);if(++n>100)return reject(Error('Condition timeout'));setTimeout(tick,50)};tick()})`);
  const click = selector => evaluate(`(()=>{const target=document.querySelector(${JSON.stringify(selector)});target.focus();target.click()})()`);
  const ready = () => waitFor(`document.querySelector('#reference-dashboard')?.dataset.status==='ready'`);
  const view = () => evaluate(`document.querySelector('#reference-dashboard').referenceDashboard.session.getSnapshot().view`);
  await send('Runtime.enable'); await send('Page.enable');
  const errors=[];
  browser.on(message => { if(message.sessionId===sessionId && message.method==='Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text); });
  for (const theme of ['light','dark']) for (const width of [320,390,768,1280]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
    const url = `${base}/reference-dashboard.html?source=server&theme=${theme}`;
    await send('Page.navigate',{url});
    await waitFor(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&document.querySelector('#reference-dashboard')?.dataset.status==='ready'`);
    await evaluate('document.fonts.ready');
    const snapshot = await view();
    assert.equal(snapshot.rowCount,9); assert.equal(snapshot.rows.length,5);
    assert.equal(snapshot.totals.received.value,85);
    assert.equal(snapshot.totals.completed.value,60);
    assert.equal(snapshot.totals.completed.partial,true);
    assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),`Overflow ${width} ${theme}`);
    const ax=await send('Accessibility.getFullAXTree');
    assert(!ax.nodes.some(n=>!n.ignored&&['button','combobox','dialog'].includes(n.role?.value)&&!n.name?.value),'Unnamed reference control');
    const evidence=resolve(process.env.DK_EVIDENCE_DIR || resolve(tmpdir(),'dashboard-kit-evidence'));
    await mkdir(evidence,{recursive:true});
    if ([390,1280].includes(width)) {
      const shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(resolve(evidence,`reference-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
    }
    await click('#ref-next'); await ready();
    const page2 = await view();
    assert.equal(page2.query.page,2); assert.equal(page2.rows.length,4);
    assert.deepEqual(page2.totals,snapshot.totals); assert.deepEqual(page2.series,snapshot.series);
    await click('#ref-service .dk-select__trigger');
    await click('#ref-service [data-value="Водоснабжение"]'); await ready();
    const water = await view();
    assert.equal(water.query.page,1); assert.equal(water.rowCount,5); assert.equal(water.totals.received.value,44);
    assert(water.rows.every(row=>row.dimensions.service==='Водоснабжение'));
    await click('#ref-rows [data-row]');
    assert(await evaluate(`document.querySelector('#ref-detail').open`),'Details must open');
    await click('#ref-action');
    await waitFor(`document.querySelector('#ref-action-status').textContent.includes('создано')`);
    assert(await evaluate(`document.querySelector('#ref-action').disabled`),'Completed command must not be submitted twice');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    assert(await evaluate(`!document.querySelector('#ref-detail').open&&document.activeElement.hasAttribute('data-row')`),'Close details restores row focus');
    await click('#ref-reset'); await ready(); assert.equal((await view()).rowCount,9);
  }
  // Failure -> retry uses the same conditions; invalid command responses remain retryable.
  await evaluate(`(async()=>{
    const fixture=await fetch('data/reference-dashboard.json').then(r=>r.json());
    window.__referenceChecks={loads:0,actions:[]};
    window.referenceDashboard(document.querySelector('#reference-dashboard'),{mode:'local',load:async()=>{if(++window.__referenceChecks.loads===1)throw Error('fixture failure');return fixture;},onAction:async(payload)=>{window.__referenceChecks.actions.push(payload);if(window.__referenceChecks.actions.length===1)return null;return {id:'checked-task',message:'Демонстрационное поручение создано'};}});
  })()`);
  await waitFor(`document.querySelector('#reference-dashboard').dataset.status==='error'`);
  assert(await evaluate(`document.querySelector('#ref-content').hidden&&!document.querySelector('#ref-retry').hidden`));
  await click('#ref-retry'); await ready();
  await click('#ref-rows [data-row]'); await click('#ref-action');
  await waitFor(`document.querySelector('#ref-action-status').textContent.includes('не подтверждён')`);
  assert(await evaluate(`!document.querySelector('#ref-action').disabled`),'Malformed success must allow retry');
  await evaluate(`document.querySelector('#ref-detail').close()`);
  await click('#ref-rows [data-row]'); await click('#ref-action');
  await waitFor(`document.querySelector('#ref-action-status').textContent.includes('создано')`);
  assert(await evaluate(`window.__referenceChecks.actions[0].idempotencyKey===window.__referenceChecks.actions[1].idempotencyKey`),'Reopening details must retain the retry key');
  await evaluate(`document.querySelector('#ref-detail').close();document.querySelector('#reference-dashboard').referenceDashboard.destroy();window.referenceDashboard(document.querySelector('#reference-dashboard'),{mode:'local'});`);
  await ready(); assert(await evaluate(`document.querySelectorAll('#ref-region .dk-select__trigger').length===1`),'Remount must release old components');
  await send('Page.navigate',{url:`${base}/reference-dashboard.html?source=server&region=Неизвестный`});
  await waitFor(`document.querySelector('#reference-dashboard')?.dataset.status==='empty'`);
  assert(await evaluate(`!document.querySelector('#ref-empty').hidden&&document.querySelector('#ref-content').hidden`));
  await click('#ref-empty-reset'); await ready();
  assert.deepEqual(errors,[]);
  console.log('PASS: reference server + consumer, pagination/full-slice totals, filters, empty/error/retry, actions, remount, themes, mobile and AX names');
} finally {
  if(browser) await browser.close();
  if(server) server.kill();
}
