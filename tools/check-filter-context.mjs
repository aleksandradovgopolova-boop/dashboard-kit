// Проверяет общий срез настоящей страницы и контракт карты в Chrome.
import { launch, findChrome } from './browser-harness.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
    if (!path.startsWith(resolve(root) + sep)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(path);
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.topojson': 'application/json' })[extname(path)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  const chrome = findChrome();
  if (!chrome) throw Error('Chrome required');
  browser = await launch(chrome);
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Page.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/regions.html` });
  await evaluate(`new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{if(document.querySelector('#r-tbody tr')&&document.querySelector('#r-map .dk-map__canvas')){clearInterval(timer);resolve();}else if(++tries>100){clearInterval(timer);reject(Error('Region data timeout'));}},50);})`);
  console.log(await evaluate(`(async()=>{
    const assert=(value,message)=>{if(!value)throw Error(message)};
    const search=document.getElementById('r-search');
    const input=query=>{search.value=query;search.dispatchEvent(new Event('input',{bubbles:true}))};
    // API fixture isolates null (=all), [] (=none) and view-switch preservation.
    const host=document.createElement('div');document.body.append(host);
    const map=dkMap(host,{view:'tiles',values:{a:0,b:80},tiles:{cols:2,rows:1,tiles:[{id:'a',abbr:'A',name:'A',row:0,col:0},{id:'b',abbr:'B',name:'B',row:0,col:1}]}});
    const outside=()=>host.querySelectorAll('.dk-map__tile--out').length;
    assert(outside()===0,'initial unrestricted map');
    map.setScope([]);assert(outside()===2,'empty scope must exclude every region');
    assert(host.querySelectorAll('.dk-map__tile.dk-nodata').length===0,'outside scope must not become no-data');
    map.setScope(['a']);assert(outside()===1,'one selected region');
    map.update({scope:[]});assert(outside()===2,'update empty scope must stay empty');
    map.update({view:'map'});map.update({view:'tiles'});assert(outside()===2,'view switch must keep empty scope');
    map.setScope(null);assert(outside()===0,'null resets scope');
    map.update({scope:[]});map.update({scope:null});assert(outside()===0,'update null resets scope');
    map.destroy();host.remove();
    // Real-page search must agree across table, KPI, rank and geographic map.
    input('НЕСУЩЕСТВУЮЩИЙ РЕГИОН 987654321');
    assert(!document.querySelector('#r-tbody tr'),'empty search table');
    assert(!document.querySelector('#r-rank [data-region]'),'empty search rank');
    assert(document.getElementById('r-k-crit').textContent==='0'&&document.getElementById('r-k-high').textContent==='0'&&document.getElementById('r-k-avg').textContent==='—','empty search KPI');
    assert(document.getElementById('r-results').textContent==='Ничего не найдено','honest no-result text');
    const canvas=document.querySelector('#r-map .dk-map__canvas');
    const chart=canvas&&echarts.getInstanceByDom(canvas);
    assert(chart&&chart.getOption().series[0].data.every(row=>row.itemStyle.opacity===0.25),'empty geographic scope');
    // Closing details preserves the current slice and keyboard return target.
    input('Новосибирская');
    const button=document.querySelector('#r-tbody [data-region]');assert(button,'matching region');
    button.focus();button.click();
    const dialog=document.getElementById('r-details');assert(dialog.open,'open selected details');
    dialog.close();await new Promise(resolve=>setTimeout(resolve,30));
    assert(search.value==='Новосибирская'&&document.querySelectorAll('#r-tbody tr').length===1,'details preserves filter');
    assert(document.activeElement===button,'details returns focus');
    document.getElementById('r-reset').click();
    assert(!search.value&&!document.getElementById('r-results').textContent,'reset clears search');
    assert(document.querySelectorAll('#r-tbody tr').length===8,'reset restores first page');
    const demo=await fetch('data/monitor-demo.json').then(response=>response.json());
    const values=Object.values(demo.risk.values);
    assert(document.getElementById('r-k-crit').textContent===String(demo.risk.counts.high),'reset high-risk KPI agrees with shared source');
    assert(document.getElementById('r-k-high').textContent===String(demo.risk.counts.medium),'reset medium-risk KPI agrees with shared source');
    assert(document.getElementById('r-k-nodata').textContent===String(demo.risk.counts.missing),'no-data KPI agrees with shared source');
    assert(document.getElementById('r-k-avg').textContent===String(Math.round(values.reduce((sum,value)=>sum+value,0)/values.length)),'average KPI agrees with shared source');
    const restored=echarts.getInstanceByDom(document.querySelector('#r-map .dk-map__canvas'));
    assert(restored.getOption().series[0].data.every(row=>row.itemStyle.opacity===1),'reset restores all map regions');
    return 'PASS: empty scope, null reset, view persistence, no-data distinction, real-page KPI/map/table/rank agreement, details context/focus, shared-source KPI reset';
  })()`));
  for (const [page, prefix] of [['regions.html', 'r'], ['accidents.html', 'a']]) {
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/${page}` });
    await evaluate(`new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{if(document.querySelector('#${prefix}-tbody tr')){clearInterval(timer);resolve();}else if(++tries>100){clearInterval(timer);reject(Error('Demo data timeout'));}},50);})`);
    console.log(await evaluate(`(()=>{
      const assert=(value,message)=>{if(!value)throw Error(message)};
      const period=document.getElementById('${prefix}-period');
      assert(period.textContent.includes('Демонстрационные данные за')&&!period.querySelector('button,input,select'),'demo period must describe fixed data');
      const url=location.href;
      for(const link of document.querySelectorAll('.dk-side__item[aria-disabled="true"]')){
        assert(!link.hasAttribute('href')&&link.getAttribute('role')==='link','disabled destination must not navigate');
        assert(link.getAttribute('aria-label').includes('недоступно в демонстрации'),'rail preserves disabled reason');
        link.click();
      }
      assert(location.href===url,'unavailable navigation must preserve location');
      const calendar=[...document.querySelectorAll('.dk-side__item')].find(link=>link.textContent.includes('Календарь'));
      if(calendar)assert(calendar.getAttribute('href')==='calendar.html','available calendar must have a destination');
      if('${prefix}'==='a'){
        assert(!document.getElementById('a-at')&&document.querySelectorAll('#a-period').length===1,'static demo period must appear once');
        const titles=[...document.querySelectorAll('.dk-widget__title')].map(title=>title.textContent.trim());
        assert(titles.includes('Аварии по часам')&&titles.includes('Аварии по типам'),'chart titles name their metric and grouping without repeating the period');
        const hint=document.querySelector('#a-hours').previousElementSibling.querySelector('.dk-widget__hint');
        assert(hint.closest('.dk-widget__title'),'chart information hint stays with its title');
        const bars=echarts.getInstanceByDom(document.getElementById('a-late')).getOption();
        assert(bars.xAxis[0].splitLine.show===false&&bars.series.every(series=>series.label.show),'labelled horizontal bars need no grid lines');
        assert(bars.series[0].data.includes(0)&&bars.xAxis[0].name==='ч','removing grid preserves zero and unit');
        const button=document.querySelector('#a-tbody .dk-td-act button'),rows=document.getElementById('a-tbody').innerHTML;
        assert(button.disabled&&button.getAttribute('aria-describedby')==='a-demo-actions','demo close must be disabled with explanation');
        assert(document.getElementById('a-demo-actions').textContent.includes('недоступно в демонстрации'),'visible unavailable-action explanation');
        button.click();
        assert(document.getElementById('a-tbody').innerHTML===rows&&!document.querySelector('dialog[open],.dk-toast'),'disabled close must not report success');
      }
      return 'PASS: ${page} fixed demo period, honest unavailable navigation/action, available calendar destination';
    })()`));
  }
  for (const width of [1366, 1024, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate(`new Promise(resolve=>setTimeout(resolve,250))`);
    console.log(await evaluate(`(()=>{
      const assert=(value,message)=>{if(!value)throw Error(message)};
      const ids=['a-hours','a-kinds','a-late','a-crews'];
      const widgets=ids.map(id=>document.getElementById(id).closest('.dk-widget'));
      const rects=widgets.map(widget=>widget.getBoundingClientRect());
      const near=(a,b)=>Math.abs(a-b)<1;
      if(innerWidth>=1024){
        assert(near(rects[0].left,rects[2].left)&&near(rects[0].right,rects[2].right)&&near(rects[1].left,rects[3].left)&&near(rects[1].right,rects[3].right),'cross-row widget columns must align');
        assert(near(rects[0].height,rects[1].height)&&near(rects[2].height,rects[3].height),'adjacent widgets must have equal height');
        const titles=widgets.map(widget=>widget.querySelector('.dk-widget__title').getBoundingClientRect());
        assert(near(titles[0].left,titles[2].left)&&near(titles[1].left,titles[3].left),'cross-row headings must align');
        assert(near(titles[0].top,titles[1].top)&&near(titles[2].top,titles[3].top),'adjacent headings must share a baseline');
      }else{
        assert(rects.every(rect=>near(rect.left,rects[0].left)&&near(rect.right,rects[0].right)),'phone widgets must use one column');
      }
      assert(document.documentElement.scrollWidth<=innerWidth+1,'phone must not overflow horizontally');
      for(const widget of widgets){
        const title=widget.querySelector('.dk-widget__title'),style=getComputedStyle(title);
        assert(style.textOverflow!=='ellipsis'&&title.scrollWidth<=title.clientWidth+1,'widget title must remain readable');
      }
      const chart=echarts.getInstanceByDom(document.getElementById('a-hours'));
      assert(chart.getOption().xAxis[0].data.length===24&&chart.getOption().series[0].data.length===24,'hour chart must retain all 24 hours');
      const labels=chart.getZr().storage.getDisplayList().filter(item=>item.type==='tspan'&&/^(0[0-9]|1[0-9]|2[0-3])$/.test(String(item.style?.text)));
      assert(labels.length>=6,'hour chart must retain readable time ticks');
      const boxes=labels.map(item=>{const box=item.getBoundingRect().clone();box.applyTransform(item.getComputedTransform());return box}).sort((a,b)=>a.x-b.x);
      assert(boxes.every((box,index)=>!index||boxes[index-1].x+boxes[index-1].width<=box.x+1),'time tick labels must not overlap');
      return 'PASS: accidents widget alignment/reflow and 24-hour readable chart at ${width}px (chart '+document.getElementById('a-hours').clientWidth+'px)';
    })()`));
  }
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/regions.html` });
  await evaluate(`new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{if(document.querySelector('#r-tbody tr')){clearInterval(timer);resolve();}else if(++tries>100){clearInterval(timer);reject(Error('Region layout data timeout'));}},50);})`);
  for (const width of [1366, 1024, 390]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate(`new Promise(resolve=>setTimeout(resolve,250))`);
    console.log(await evaluate(`(()=>{
      const assert=(value,message)=>{if(!value)throw Error(message)};
      const wrap=document.querySelector('.dk-wrap--monitor');assert(wrap,'regions must use monitor spacing');
      const pad=innerWidth>=768?20:16;
      for(const widget of wrap.querySelectorAll('.dk-widget')){
        const style=getComputedStyle(widget);
        for(const side of ['Top','Right','Bottom','Left'])assert(parseFloat(style['padding'+side])===pad,'region inner padding must be '+pad+'px, got '+style['padding'+side]+' on '+widget.className);
      }
      for(const grid of wrap.querySelectorAll('.dk-grid')){
        const style=getComputedStyle(grid);
        assert(parseFloat(style.columnGap)===10&&parseFloat(style.rowGap)===10,'region grid gap must be 10px');
        const rows=new Map();
        for(const column of grid.children){
          const widget=column.querySelector(':scope > .dk-widget');if(!widget)continue;
          const rect=widget.getBoundingClientRect(),key=Math.round(rect.top);
          if(!rows.has(key))rows.set(key,[]);rows.get(key).push(rect);
        }
        for(const rects of rows.values()){
          assert(Math.max(...rects.map(rect=>rect.height))-Math.min(...rects.map(rect=>rect.height))<1,'region adjacent widgets must have equal height');
          rects.sort((a,b)=>a.left-b.left);
          for(let i=1;i<rects.length;i++)assert(Math.abs(rects[i].left-rects[i-1].right-10)<1,'region visible gutter must be 10px');
        }
      }
      assert(document.documentElement.scrollWidth<=innerWidth+1,'regions must not overflow viewport');
      return 'PASS: regions 10px grid gutters, '+pad+'px inner padding, equal adjacent heights and no horizontal overflow at ${width}px';
    })()`));
  }
  // Shared monitor KPI rule applies across the three related screens.
  for (const page of ['dashboard.html','regions.html','accidents.html']) {
    for (const theme of ['dark','light']) {
      for (const width of [320,390,768,1024,1366]) {
        await send('Emulation.setDeviceMetricsOverride',{width,height:768,deviceScaleFactor:1,mobile:width<768});
        await send('Emulation.setTouchEmulationEnabled',{enabled:width<768,maxTouchPoints:5});
        await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/${page}?theme=${theme}`});
        await evaluate(`new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{
          if(document.readyState==='complete'&&document.querySelectorAll('.dk-wrap--monitor .dk-tile').length===4){clearInterval(timer);document.fonts.ready.then(()=>setTimeout(resolve,250));}
          else if(++tries>100){clearInterval(timer);reject(Error('Monitor KPI page timeout'));}
        },50);})`);
        console.log(await evaluate(`(()=>{
          const assert=(value,message)=>{if(!value)throw Error(message)};
          const cards=[...document.querySelectorAll('.dk-wrap--monitor .dk-tile')];
          const boxes=cards.map(card=>card.getBoundingClientRect());
          assert(boxes.length===4,'exactly four primary KPI');
          if(innerWidth>=768){
            assert(boxes.every(box=>Math.abs(box.top-boxes[0].top)<1),'four KPI must share one row outside phone');
            for(let i=1;i<boxes.length;i++)assert(boxes[i].left>boxes[i-1].right,'desktop KPI keep separate columns and gutters');
          }else{
            assert(Math.abs(boxes[0].top-boxes[1].top)<1&&Math.abs(boxes[2].top-boxes[3].top)<1&&boxes[2].top>=boxes[0].bottom,'phone KPI must form two rows');
            assert(boxes[1].left>boxes[0].right&&Math.abs(boxes[0].left-boxes[2].left)<1&&Math.abs(boxes[1].left-boxes[3].left)<1,'phone KPI must form two columns, including 320px');
          }
          const visualRows=new Map();
          cards.forEach(card=>{
            const key=Math.round(card.getBoundingClientRect().top);
            if(!visualRows.has(key))visualRows.set(key,[]);visualRows.get(key).push(card);
          });
          for(const row of visualRows.values()){
            const numberTops=row.map(card=>card.querySelector('.dk-metric-lg').getBoundingClientRect().top);
            assert(Math.max(...numberTops)-Math.min(...numberTops)<1,'KPI values share a common row baseline');
            const trends=row.map(card=>card.querySelector('.dk-trend')).filter(Boolean).map(el=>el.getBoundingClientRect().top);
            if(trends.length)assert(Math.max(...trends)-Math.min(...trends)<1,'KPI trends share a common row baseline');
            const sparks=row.map(card=>card.querySelector('.dk-chart--spark')).filter(Boolean).map(el=>el.getBoundingClientRect().bottom);
            if(sparks.length)assert(Math.max(...sparks)-Math.min(...sparks)<1,'KPI sparklines share the same bottom edge');
          }
          cards.forEach(card=>{
            const box=card.getBoundingClientRect(),style=getComputedStyle(card),pad=parseFloat(style.paddingLeft);
            const label=card.querySelector('.dk-tile__label'),value=card.querySelector('.dk-metric-lg');
            assert(label&&value,'full label and numeric value present');
            const labelBox=label.getBoundingClientRect(),valueBox=value.getBoundingClientRect();
            assert(!label.textContent.includes('…')&&getComputedStyle(label).textOverflow!=='ellipsis','KPI label must not be truncated');
            assert(labelBox.left>=box.left+pad-1&&labelBox.right<=box.right-parseFloat(style.paddingRight)+1,'label stays inside spacious card padding');
            assert(Math.abs(valueBox.left-box.left-pad)<=2,'metric remains on the leading edge');
            assert(valueBox.right<=box.right-parseFloat(style.paddingRight)+1,'metric stays inside card padding');
            assert(card.scrollWidth<=card.clientWidth+1,'KPI content must not overflow horizontally');
            assert(box.left>=-1&&box.right<=innerWidth+1,'KPI stays in viewport');
          });
          assert(document.documentElement.scrollWidth<=innerWidth+1,'shared monitor must not overflow horizontally');
          return 'PASS: ${page}/${theme}/${width} four KPI '+(innerWidth>=768?'one row':'2×2')+', full labels and leading values';
        })()`));
      }
    }
  }

} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
