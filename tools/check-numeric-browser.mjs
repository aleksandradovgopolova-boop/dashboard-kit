// UI binding oracle: literal expected strings, never getView()/dkFmt for expected.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {launch,findChrome} from './browser-harness.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const fixture=async name=>JSON.parse(await readFile(root+'tools/fixtures/numeric/'+name,'utf8'));
const [source,oracle,comparisons]=await Promise.all(['mortgage-source.json','mortgage-expected.json','comparison.json'].map(fixture));
const normalized=value=>value.replace(/[\s\u00a0\u202f]+/g,' ').replace(/\s+%/g,'%').replace(/−/g,'-').trim();
const evidence=resolve(process.env.DK_EVIDENCE_DIR||resolve(tmpdir(),'dashboard-kit-numeric-evidence'));
let server,browser;
try {
  server=spawn('python3',['tools/reference-server.py','--port','0'],{cwd:root,stdio:['ignore','pipe','pipe']});
  const base=await new Promise((resolve,reject)=>{
    let output='';const timeout=setTimeout(()=>reject(Error('Server timeout '+output)),15000);
    server.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0]);}});
    server.stderr.on('data',chunk=>{output+=chunk;});server.on('error',reject);
    server.on('exit',code=>{clearTimeout(timeout);reject(Error('Server exited '+code+' '+output));});
  });
  assert(findChrome(),'Chrome required: cannot skip numeric UI acceptance');
  browser=await launch(findChrome());
  const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
  const send=(method,params={})=>browser.send(method,params,sessionId);
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const wait=condition=>evaluate(`new Promise((resolve,reject)=>{let n=0;const tick=()=>{if(${condition})return resolve();if(++n>200)return reject(Error('UI wait: '+${JSON.stringify(condition)}));setTimeout(tick,50)};tick()})`);
  const key=async key=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,windowsVirtualKeyCode:key==='Escape'?27:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,windowsVirtualKeyCode:key==='Escape'?27:13});};
  const frames=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const click=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.focus();e.click()})()`);
  const errors=[];
  browser.on(message=>{if(message.sessionId===sessionId&&message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);});
  await send('Runtime.enable');await send('Page.enable');await mkdir(evidence,{recursive:true});
  const shot=async name=>{
    await evaluate('document.fonts.ready');
    await evaluate('Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished))');
    await frames();
    assert(await evaluate("Array.from(document.querySelectorAll('dialog[open]')).every(d=>getComputedStyle(d).opacity==='1')"),'Screenshot waits for completed dialog entry');
    const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(resolve(evidence,name+'.png'),Buffer.from(r.data,'base64'));
  };
  const api=`document.querySelector('#fm-dashboard').familyMortgageDashboard`;
  for(const theme of ['dark','light']) for(const width of [390,1280]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
    await send('Page.navigate',{url:base+'/family-mortgage.html?theme='+theme});
    await wait(`document.querySelector('#fm-dashboard')?.dataset.status==='ready'`);
    await click(`[data-theme-set="${theme}"]`);
    await evaluate(`window.__numericSource=${JSON.stringify(source)};window.familyMortgageDashboard(document.querySelector('#fm-dashboard'),{url:false,load:async()=>window.__numericSource});`);
    await wait(`document.querySelector('#fm-dashboard').dataset.status==='ready'`);
    for(const item of oracle.cases) {
      await evaluate(`window.__numericSource=${JSON.stringify(source)};`+
        (item.mutation==='approval-bases'?`window.__numericSource.rows[2].values.applied=200;window.__numericSource.rows[2].values.approved=180;`:'')+
        (item.mutation==='partial'?`window.__numericSource.rows[0].values.issued=null;`:'')+
        (item.mutation==='no-data'?`window.__numericSource.rows.forEach(r=>Object.keys(r.values).forEach(k=>r.values[k]=null));`:'')+
        `${api}.setQuery({district:'all',region:'all',month:'all',search:'',page:1,sort:'lag'});${api}.session.retry();`);
      await wait(`document.querySelector('#fm-dashboard').dataset.status==='ready'`);
      await evaluate(`${api}.setQuery(${JSON.stringify(item.query)});`);
      await wait(`document.querySelector('#fm-dashboard').dataset.status===${JSON.stringify(item.rowCount?'ready':'empty')}`);
      for(const [id,expected] of Object.entries(item.dom)) {
        const actual=await evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
        assert.equal(normalized(actual),normalized(expected),`UI binding ${item.id}/${theme}/${width}/#${id}`);
      }
      assert(await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),'UI binding page overflow '+item.id);
      if(item.id==='empty') {
        assert(await evaluate(`!document.querySelector('#fm-empty').hidden&&document.querySelector('#fm-content').hidden`),'UI binding empty hides stale KPI');
      }
      if(item.id==='all') {
        await evaluate(`${api}.setQuery({pageSize:1,page:2})`);
        assert.equal(await evaluate(`document.querySelector('#fm-issued').textContent`),'100','UI binding pagination retains whole-slice total');
        await evaluate(`${api}.setQuery({pageSize:12,page:1})`);
        await shot('numeric-overview-'+theme+'-'+width);
      }
      if(item.id==='district') {
        const opener='#fm-tbody [data-region="spb"]';await click(opener);
        await wait(`document.querySelector('#fm-detail').open`);
        const values=await evaluate(`Array.from(document.querySelectorAll('#fm-detail-kpis .dk-metric-lg'),e=>e.textContent)`);
        assert.deepEqual(values.map(normalized),oracle.detail.kpis.map(normalized),'UI binding detail KPI literals');
        const months=await evaluate(`Array.from(document.querySelectorAll('#fm-detail-body tr[data-month]'),r=>Array.from(r.cells).slice(1).map(c=>c.textContent))`);
        assert.deepEqual(months.map(row=>row.map(normalized)),oracle.detail.monthly.map(row=>row.map(normalized)),'UI binding detail month literals');
        await shot('numeric-detail-'+theme+'-'+width);await key('Escape');
        assert(await evaluate(`!document.querySelector('#fm-detail').open&&document.activeElement.matches(${JSON.stringify(opener)})`),'UI binding return restores focus');
        assert.equal(await evaluate(`document.querySelector('#fm-issued').textContent`),'40','UI binding return retains slice');
      }
      if(item.mutation) await shot('numeric-'+item.id+'-'+theme+'-'+width);
    }
    await evaluate(`window.__numericSource=${JSON.stringify(source)};${api}.session.retry();`);
    await wait(`document.querySelector('#fm-dashboard').dataset.status==='ready'`);
    assert.equal(await evaluate(`document.querySelector('#fm-issued').textContent`),'100','UI binding complete values restored');
    assert(await evaluate(`document.querySelector('#fm-coverage').hidden&&!document.querySelector('#fm-coverage').textContent`),'UI binding no stale partial status');

    await send('Page.navigate',{url:base+'/component-period-comparison.html?theme='+theme});
    await wait(`document.readyState==='complete'&&typeof dkPeriodComparison==='function'&&typeof dkTooltip==='function'`);
    // A standalone kit surface isolates component geometry from the documentation shell.
    await evaluate(`document.body.replaceChildren();document.documentElement.dataset.theme=${JSON.stringify(theme)};document.body.className='dk-page dk-glass';window.__host=document.createElement('section');__host.className='dk-widget';document.body.append(__host);window.__comparison=dkPeriodComparison(__host,{});`);
    for(const item of comparisons) {
      // Isolate keyboard input from pointer/touch events left by the previous case.
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:width-2,y:898});
      await evaluate(`__comparison.update(${JSON.stringify({label:'Учебные обращения',unit:'обращений',current:item.current,previous:item.previous,better:item.better,comparison:item.comparison})})`);
      await frames();
      const text=normalized(await evaluate('__host.innerText'));
      assert(text.includes(normalized(item.dom)),'UI binding comparison '+item.id+': '+text);
      assert(text.includes(item.comparison.currentPeriod.from)&&text.includes(item.comparison.currentPeriod.to)&&text.includes(item.comparison.previousPeriod.from)&&text.includes(item.comparison.previousPeriod.to),'UI binding dates remain visible');
      assert(text.includes('База: '+item.comparison.currentPeriod.sampleSize+' заявок')&&text.includes('База: '+item.comparison.previousPeriod.sampleSize+' заявок'),'UI binding both bases and unit remain visible');
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'UI comparison overflow');
      if(item.expected.comparable===false) assert(await evaluate(`!__host.querySelector('.dk-comparison__delta')`),'UI binding blocked delta has no success/failure colour');
      if(item.expected.code) {
        if(width===1280){
          const geometry=await evaluate(`(()=>{const b=__host.querySelector('button'),s=getComputedStyle(b),range=document.createRange();range.selectNodeContents(b);return {width:b.getBoundingClientRect().width,content:range.getBoundingClientRect().width+parseFloat(s.paddingLeft)+parseFloat(s.paddingRight)+parseFloat(s.borderLeftWidth)+parseFloat(s.borderRightWidth),container:b.parentElement.getBoundingClientRect().width};})()`);
          assert(Math.abs(geometry.width-geometry.content)<2&&geometry.width<geometry.container/2,'Comparison status button uses content width: '+JSON.stringify(geometry));
        }
        await evaluate(`window.__events=[];window.__button=__host.querySelector('button');window.__tip=document.getElementById(__button.getAttribute('aria-describedby'));for(const type of ['mouseenter','mouseleave','focus','blur','click','keydown','keyup'])__button.addEventListener(type,e=>__events.push({type:e.type,key:e.key,time:performance.now(),hidden:__tip.hidden}));`);
        assert.equal(await evaluate(`document.querySelectorAll('.dk-tooltip').length`),1,'UI explanation has one owner');
        await evaluate(`__host.querySelector('button').focus()`);
        assert(await evaluate(`!__tip.hidden`),'UI explanation on focus');
        assert((await evaluate(`__tip.textContent`)).includes(item.reasonContains),'UI explanation belongs to current state: '+item.id);
        await key('Escape');
        const initiallyHidden=await evaluate('__tip.hidden');
        // A transient hidden state is insufficient: Escape must stay effective.
        await frames();
        const escapeState=await evaluate(`({hidden:__tip.hidden,focused:document.activeElement===__button,id:__tip.id,count:document.querySelectorAll('.dk-tooltip').length,text:__tip.textContent,active:document.activeElement.outerHTML,documentFocused:document.hasFocus(),hover:__button.matches(':hover'),events:__events})`);
        assert(initiallyHidden&&escapeState.hidden&&escapeState.focused,'UI explanation Escape '+item.id+'/'+theme+'/'+width+': '+JSON.stringify({initiallyHidden,...escapeState}));
        await evaluate(`__host.querySelector('button').blur()`);
        const point=await evaluate(`(()=>{const r=__host.querySelector('button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
        await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:width-2,y:898});
        await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
        assert(await evaluate(`!document.querySelector('.dk-tooltip').hidden`),'UI explanation on hover');await key('Escape');
        if(width===390) {
          await send('Emulation.setTouchEmulationEnabled',{enabled:true});
          await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:1,radiusY:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          await send('Emulation.setTouchEmulationEnabled',{enabled:false});
        } else await click('.dk-comparison button');
        assert(await evaluate(`!document.querySelector('.dk-tooltip').hidden`),'UI explanation on tap/click');
        if(['partial','small-base','unequal'].includes(item.id)) await shot('comparison-'+item.id+'-'+theme+'-'+width);
        await key('Escape');
      } else assert(await evaluate(`!document.querySelector('.dk-tooltip')&&!__host.querySelector('button')`),'UI normal state has no empty explanation slot');
    }
    const partialOptions={current:10,previous:20,comparison:comparisons.find(c=>c.id==='partial').comparison};
    await evaluate(`__comparison.update(${JSON.stringify(partialOptions)});__host.querySelector('button').focus();__comparison.update(${JSON.stringify(partialOptions)});`);
    assert(await evaluate(`document.activeElement===__host.querySelector('button')`),'UI update retains status focus');
    await evaluate(`__comparison.update(${JSON.stringify({current:10,previous:20,comparison:comparisons[0].comparison})});`);
    assert(await evaluate(`document.activeElement===__host&&__host.tabIndex===-1&&!document.querySelector('.dk-tooltip')`),'UI resolved reason returns focus to host without Tab stop');
    await evaluate(`__host.blur()`);
    assert(await evaluate(`!__host.hasAttribute('tabindex')`),'UI temporary focus attribute removed on blur');
    await evaluate(`__comparison.update(${JSON.stringify(partialOptions)});__host.querySelector('button').click();__comparison.destroy();`);
    assert(await evaluate(`!document.querySelector('.dk-tooltip')&&!__host.childNodes.length`),'UI destroy releases tooltip and contents');
    console.log('PASS: numeric UI binding '+theme+' '+width);
  }
  assert.deepEqual(errors,[],'UI uncaught browser exceptions');
  console.log('PASS: literal UI oracle, filters/details/return, zero/partial/no-data, comparison policies and tooltip lifecycle');
} finally {if(browser)await browser.close();if(server)server.kill();}
