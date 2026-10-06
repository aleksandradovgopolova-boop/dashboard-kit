// Real-page runtime evidence; device emulation is not physical-device proof.
import {launch,findChrome} from './browser-harness.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=createServer(async(req,res)=>{try{const f=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!f.startsWith(resolve(root)+sep)){res.writeHead(403);return res.end()}const data=await readFile(f);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.topojson':'application/json','.svg':'image/svg+xml'})[extname(f)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const evidence=[];
const pages=['regions.html','accidents.html','calendar.html','dashboard.html','component-heatmap.html','component-tree-select.html','component-layout-editor.html','component-saved-views.html','component-fullscreen.html','component-tooltip.html','component-bullet-chart.html','component-period-comparison.html','component-timeline-annotations.html'];
try{
 browser=await launch(findChrome());const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});const send=(m,p)=>browser.send(m,p,sessionId);
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Runtime.enable');await send('Page.enable');
 const errors=[];browser.on(m=>{if(m.sessionId===sessionId&&m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)});
 for(const page of pages){
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true});await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/${page}`});
  await evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.readyState==='complete'){clearInterval(t);document.fonts.ready.then(()=>setTimeout(resolve,500));}else if(++n>100){clearInterval(t);reject(Error('page load timeout'));}},50);})`);
  const basic=await evaluate(`(()=>{const ids=new Set(),duplicate=[];for(const e of document.querySelectorAll('[id]')){if(ids.has(e.id))duplicate.push(e.id);ids.add(e.id)}const dangling=[];for(const e of document.querySelectorAll('[aria-describedby],[aria-labelledby],[aria-controls]'))for(const a of ['aria-describedby','aria-labelledby','aria-controls'])for(const id of (e.getAttribute(a)||'').split(' ').filter(Boolean))if(!document.getElementById(id))dangling.push(id);return {duplicate,dangling,width:document.documentElement.scrollWidth,viewport:innerWidth,chartTop:document.getElementById('d-line')?.getBoundingClientRect().top,heroTop:document.querySelector('.dk-hero')?.getBoundingClientRect().top,sticky:document.querySelector('.dk-top')?getComputedStyle(document.querySelector('.dk-top')).position:null};})()`);
  if(['accidents.html','dashboard.html'].includes(page)&&await evaluate(`!!document.querySelector('.dk-data-summary')`))throw Error(page+': unwanted chart composition table');
  if(basic.duplicate.length||basic.dangling.length||basic.width>basic.viewport+1)throw Error(page+': '+JSON.stringify(basic));
  const ax=await send('Accessibility.getFullAXTree');const unnamed=ax.nodes.filter(n=>!n.ignored&&['button','combobox','textbox','searchbox','dialog'].includes(n.role?.value)&&!n.name?.value);if(unnamed.length)throw Error(page+': unnamed controls '+unnamed.length);
  if(page==='dashboard.html'&&(basic.heroTop>844/2||basic.sticky==='sticky'))throw Error('mobile information hierarchy regression');
  if(page==='regions.html') {
    basic.regionReset=await evaluate(`(()=>{const search=document.getElementById('r-search'),result=document.getElementById('r-results');if(result.textContent||document.getElementById('r-map-title').textContent.includes('срез'))throw Error('redundant region caption');search.value='Новосибирская';search.dispatchEvent(new Event('input',{bubbles:true}));if(!result.textContent.startsWith('Найдено:'))throw Error('missing search count');const reset=document.getElementById('r-reset');if(reset.textContent.trim()||!reset.getAttribute('aria-label'))throw Error('reset not an icon');reset.click();if(search.value||result.textContent)throw Error('reset failed');return true;})()`);
  }
  if(page==='dashboard.html'){
    await send('Runtime.evaluate',{expression:"document.getElementById('d-fullscreen').click()",userGesture:true,awaitPromise:true});
    await evaluate(`new Promise(r=>setTimeout(r,100))`);
    basic.fullscreen=await evaluate(`document.fullscreenElement?'native':document.querySelector('dialog.dk-fullscreen[open]')?'fallback':'none'`);
    if(basic.fullscreen==='none')throw Error('fullscreen action did not open');
    await evaluate(`document.getElementById('d-fullscreen').click();new Promise(r=>setTimeout(r,100))`);
  }
  if(page==='calendar.html') {
    await evaluate(`document.querySelector('.dk-cal [data-view=week]').click()`);
    const agenda=await evaluate(`!!document.querySelector('.dk-cal__agenda')`);
    if(!agenda)throw Error('touch calendar week did not use agenda');
    basic.calendarAgenda=true;
  }
  // Doubling the actual font tokens tests large text without changing target sizes.
  await evaluate(`(()=>{const root=document.documentElement,s=getComputedStyle(root);for(const key of Array.from(s).filter(k=>/^--(type-|text-)/.test(k))){const v=s.getPropertyValue(key);if(/px/.test(v))root.style.setProperty(key,v.replace(/([0-9.]+)px/g,(_,n)=>Number(n)*2+'px'));}})()`);
  const large=await evaluate(`({width:document.documentElement.scrollWidth,viewport:innerWidth})`);if(large.width>large.viewport+1)throw Error(page+': large text overflow '+JSON.stringify(large));
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:720,deviceScaleFactor:1,mobile:false});await evaluate(`new Promise(r=>setTimeout(r,350))`);const zoom=await evaluate(`({width:document.documentElement.scrollWidth,viewport:innerWidth,textOverflow:(()=>{const a=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(!n.textContent.trim()||n.parentElement.closest('.dk-tablewrap,.dk-vh'))continue;const r=document.createRange();r.selectNode(n);if(r.getBoundingClientRect().right>innerWidth+1)a.push({text:n.textContent.slice(0,60),cls:n.parentElement.className});}return a.slice(0,12);})(),overflow:Array.from(document.querySelectorAll('body *')).filter(e=>e.scrollWidth>e.clientWidth+1&&e.scrollWidth>320).map(e=>({cls:e.className,scroll:e.scrollWidth,width:e.clientWidth,overflow:getComputedStyle(e).overflowX})).slice(0,15),culprit:Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1&&!e.closest('.dk-tablewrap,.dk-scroll,.dk-map__scroll')).map(e=>({tag:e.tagName,cls:e.className,parent:e.parentElement.className,text:e.textContent.slice(0,60)})).slice(0,15)})`);if(zoom.width>zoom.viewport+1)throw Error(page+': 320px reflow overflow '+JSON.stringify(zoom));
  evidence.push({page,...basic,largeText:large,reflow320:zoom,axNamedControls:true});
 }
 // The working overview must reflow in both themes, including short laptop windows.
 for(const page of ['dashboard.html','accidents.html']) for(const theme of ['dark','light']) {
  for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080]]) {
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});
   await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/${page}?theme=${theme}`});
   await evaluate(`new Promise(r=>setTimeout(r,550))`);
   const fit=await evaluate(`(()=>{const widgets=[...document.querySelectorAll('.dk-widget,.dk-hero')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}});return {width:document.documentElement.scrollWidth,viewport:innerWidth,widgets,overviewBottom:document.querySelector('.dk-grid--overview')?.getBoundingClientRect().bottom,mainChartsBottom:Math.max(...['a-hours','a-kinds'].map(id=>document.getElementById(id)?.closest('.dk-widget').getBoundingClientRect().bottom||0))};})()`);
   const layout=await evaluate(`(()=>{const mismatch=[];for(const grid of document.querySelectorAll('.dk-wrap--monitor .dk-grid')){const rows=new Map();for(const col of grid.children){const card=col.querySelector(':scope > .dk-widget,:scope > .dk-hero,:scope > .dk-grid--metrics');if(!card)continue;const y=Math.round(col.getBoundingClientRect().top),h=card.getBoundingClientRect().height;if(!rows.has(y))rows.set(y,[]);rows.get(y).push(h)}for(const heights of rows.values())if(Math.max(...heights)-Math.min(...heights)>1)mismatch.push(heights)}return {mismatch,kpiBottom:document.querySelector('.dk-grid--metrics')?.getBoundingClientRect().bottom,chartTop:document.getElementById('d-line')?.closest('.dk-widget').getBoundingClientRect().top,technicalCaption:document.body.textContent.includes('Ромбы и тонкая линия')};})()`);
   if(layout.mismatch.length||layout.technicalCaption||(page==='dashboard.html'&&layout.kpiBottom>layout.chartTop))throw Error(page+' row alignment/order '+JSON.stringify(layout));
   if(fit.width>width+1||fit.widgets.some(w=>w.left< -1||w.right>width+1||w.width<=0))throw Error(page+' viewport '+width+' '+theme+': '+JSON.stringify(fit));
   if(width>=1200&&(page==='dashboard.html'?fit.overviewBottom:fit.mainChartsBottom)>height)throw Error(page+' primary overview exceeds '+width+'x'+height);
   evidence.push({page,theme,width,height,viewportFit:true,overviewBottom:fit.overviewBottom,mainChartsBottom:fit.mainChartsBottom});
  }
 }
 // Rail: names remain accessible when labels are hidden; expansion and profile work.
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/dashboard.html`});
 await evaluate(`new Promise(r=>setTimeout(r,550))`);
 const rail=await evaluate(`(()=>{const app=document.querySelector('.dk-app'),side=app.querySelector('.dk-side');if(app.dataset.nav!=='folded'||side.getBoundingClientRect().width>68||parseFloat(getComputedStyle(side).borderTopLeftRadius)>12||side.querySelector('.dk-side__group'))throw Error('rail not compact');if([...side.querySelectorAll('.dk-side__item')].some(e=>!e.getAttribute('aria-label')||e.getBoundingClientRect().height<40||Math.abs(e.getBoundingClientRect().width-e.getBoundingClientRect().height)>1))throw Error('unnamed rail link');app.querySelector('[data-act=fold]').click();if(app.dataset.nav!=='closed')throw Error('rail did not expand');const profile=app.querySelector('.dk-side__profile');profile.querySelector('summary').click();if(!profile.open)throw Error('profile closed');document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));if(profile.open||document.activeElement!==profile.querySelector('summary'))throw Error('profile Escape/focus');app.querySelector('[data-act=fold]').click();return {compact:true,expanded:true,profileEscape:true,namedLinks:true};})()`);
 evidence.push({rail});
 // Forecast and target must stay solid; preliminary data remains explicit.
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/dashboard.html`});
 await evaluate(`new Promise(r=>setTimeout(r,800))`);
 const solid=await evaluate(`(()=>{const host=document.createElement('div');host.className='dk-chart';document.body.append(host);const chart=dkChart(host,{type:'line',label:'Тест прогноза',categories:['1','2','3','4'],series:[{name:'Аварии',data:[1,2,3,4],forecast:2}],target:{value:3,label:'Норма'}});const o=chart.instance.getOption(),tail=o.series[1];if(o.tooltip[0].axisPointer.lineStyle.type!=='solid'||o.tooltip[0].axisPointer.crossStyle.type!=='solid'||o.series[0].markLine.lineStyle.type!=='solid'||tail.lineStyle.type!=='solid')throw Error('dashed chart line');if(tail.symbol!=='emptyDiamond'||!tail.endLabel.show||tail.endLabel.textBorderWidth!==0||tail.endLabel.formatter!=='Прогноз'||o.grid[0].right<70)throw Error('forecast missing visual distinction');if(!host.getAttribute('aria-label')?.includes('Прогноз'))throw Error('forecast missing accessible explanation');chart.destroy();host.remove();return {targetSolid:true,forecastSolid:true,forecastNamed:true};})()`);
 evidence.push({solidLines:solid});
 // Chart export and map decals use the actual vendored rendering engine.
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/component-chart.html`});await evaluate(`new Promise(r=>setTimeout(r,800))`);
 const chart=await evaluate(`(async()=>{const el=document.createElement('div');el.className='dk-chart';el.style.height='200px';document.body.append(el);const chart=dkChart(el,{type:'donut',palette:'status',data:[{name:'Риск',value:1},{name:'Средний',value:1},{name:'Низкий',value:1},{name:'Нет данных',value:1}]});await new Promise(r=>setTimeout(r,100));const option=chart.instance.getOption();const blob=await chart.exportImage();if(option.series[0].data[3].itemStyle.decal)throw Error('unwanted chart hatching');if(blob.type!=='image/png'||blob.size<100)throw Error('invalid chart PNG');chart.destroy();return {pngBytes:blob.size,solidNoData:true};})()`);
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/component-map.html`});await evaluate(`new Promise(r=>setTimeout(r,800))`);
 const map=await evaluate(`(()=>{const host=document.createElement('div');host.style.width='280px';document.body.append(host);const geometry={type:'FeatureCollection',features:[{type:'Feature',id:'a',properties:{id:'a',name:'Known'},geometry:{type:'Polygon',coordinates:[[[30,50],[31,50],[31,51],[30,51],[30,50]]]}},{type:'Feature',id:'b',properties:{id:'b',name:'Missing'},geometry:{type:'Polygon',coordinates:[[[32,50],[33,50],[33,51],[32,51],[32,50]]]}}]};const map=dkMap(host,{geo:geometry,name:'runtime-test',values:{a:0,b:null},tiles:{cols:2,rows:1,tiles:[{id:'a',abbr:'A',name:'Known',x:0,y:0},{id:'b',abbr:'B',name:'Missing',x:1,y:0}]}});const inst=echarts.getInstanceByDom(host.querySelector('.dk-map__canvas'));if(!inst)throw Error('map not rendered');const data=inst.getOption().series[0].data;if(data.some(d=>d.itemStyle.decal))throw Error('unwanted map hatching');map.view='tiles';if(host.querySelectorAll('.dk-map__tile.dk-nodata').length!==1)throw Error('tile texture');map.destroy();return {solidNoData:true,zeroIsData:true,tileTexture:true};})()`);
 if(errors.length)throw Error(errors.join('\n'));
 const report={browser:'Chrome CDP',physicalDevices:false,screenReaderSpeech:false,pages:evidence,chart,map};
 if(process.env.DK_EVIDENCE_DIR){await mkdir(process.env.DK_EVIDENCE_DIR,{recursive:true});await writeFile(resolve(process.env.DK_EVIDENCE_DIR,'runtime.json'),JSON.stringify(report,null,2));}
 console.log('PASS: real pages, 200% font tokens, 320px reflow, named AX controls, mobile hierarchy, reduced-motion environment, PNG/solid no-data');console.log(JSON.stringify(evidence.find(e=>e.page==='dashboard.html')));
}catch(e){console.error(e.message);process.exitCode=1}finally{if(browser)await browser.close();server.close();}
