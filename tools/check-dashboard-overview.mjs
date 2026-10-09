// Проверяет выбранную композицию страны и рабочие представления в Chrome.
import { launch, findChrome } from './browser-harness.mjs';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
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
  const assert = (value, message) => { if (!value) throw Error(message); };
  const checkDonutCenter = async (sideLegend, label) => {
    const geometry=await evaluate(`(()=>{
      const el=document.getElementById('d-types'), chart=echarts.getInstanceByDom(el);
      const ring=chart.getModel().getSeriesByIndex(0).getData().getItemLayout(0);
      const host=el.getBoundingClientRect(), text=el.querySelector('.dk-chart__center').getBoundingClientRect();
      const legend=chart.getOption().legend[0];
      return {dx:(text.left+text.right)/2-host.left-ring.cx,dy:(text.top+text.bottom)/2-host.top-ring.cy,
        total:el.querySelector('.dk-chart__center').textContent,side:legend.orient==='vertical'&&legend.right===0,bottom:legend.bottom===0};
    })()`);
    assert(geometry.total==='23'&&Math.abs(geometry.dx)<=1&&Math.abs(geometry.dy)<=1&&
      (sideLegend?geometry.side:geometry.bottom), `${label}: donut number matches rendered ring center and intended legend: ${JSON.stringify(geometry)}`);
  };
  for (const theme of ['dark', 'light']) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1536, height: 1024, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/dashboard.html?theme=${theme}` });
    await evaluate(`document.fonts.ready.then(()=>new Promise(resolve=>setTimeout(resolve,1200)))`);
    const result = await evaluate(`(()=>{
      const visible = el => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
      const country = document.getElementById('d-view-country');
      const charts = [...document.querySelectorAll('#d-country-charts .dk-widget')];
      const tiles = [...country.querySelectorAll('.dk-tile')];
      const box = el => {const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};
      return {height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,
        country:box(country),charts:charts.map(box),tiles:tiles.map(box),
        tileCount:tiles.length, visibleTitles:charts.map(el=>el.querySelector('h2').textContent),
        hiddenWork:!visible(document.getElementById('d-table')),
        riskReady:document.getElementById('d-risk-summary').dataset.ready==='true', riskHigh:document.querySelector('#d-risk-summary .dk-hero__n').textContent,
        hiddenCauses:!visible(document.getElementById('d-donut')),
        padding:charts.map(el=>getComputedStyle(el).paddingLeft),
        canvas:document.querySelector('#d-line canvas')?.width||0};})()`);
    assert(await evaluate(`(()=>{const tabs=document.getElementById('d-views').getBoundingClientRect(),header=document.querySelector('.dk-top').getBoundingClientRect(),status=document.getElementById('d-alert').getBoundingClientRect();return tabs.top>=header.top-1&&tabs.bottom<=header.bottom+1&&header.bottom<=status.top+1;})()`), `${theme}: accessible view tabs in header precede status and data`);
    assert(result.width <= 1536, `${theme}: no horizontal page overflow`);
    assert(result.tileCount === 5 && result.tiles.every(tile=>Math.abs(tile.top-result.tiles[0].top)<1), `${theme}: five KPI in one row`);
    assert(result.charts.every(chart=>chart.top>=result.tiles[0].bottom), `${theme}: KPI before detailed charts`);
    assert(result.visibleTitles.join('|')==='Карта рисков по регионам|Аварии: факт и прогноз|Средний риск по округам|Последние события|Типы аварий|Динамика по статусам', `${theme}: main country answer cannot be hidden in tabs`);
    assert(result.charts.length===6 && result.charts.every((chart,i)=>Math.abs(chart.top-result.charts[i<3?0:3].top)<1&&Math.abs(chart.height-result.charts[i<3?0:3].height)<1) && result.charts[3].top>=result.charts[0].bottom, `${theme}: six panels in two rows with equal neighboring heights`);
    assert(result.padding.every(pad=>parseFloat(pad)>=20), `${theme}: spacious desktop padding`);
    assert(await evaluate(`[...document.querySelectorAll('#d-country-charts > .dk-widget')].every(el=>el.classList.contains('dk-widget--overview')&&el.querySelector(':scope > .dk-widget__head')&&el.querySelector(':scope > .dk-widget__body'))`), `${theme}: every overview panel uses the shared header and body contract`);
    assert(await evaluate(`(()=>{
      const option=id=>echarts.getInstanceByDom(document.getElementById(id)).getOption();
      const sum=values=>values.reduce((n,v)=>n+(typeof v==='object'?v.value:v),0);
      return [...document.querySelectorAll('#d-risk-keys b')].map(el=>el.textContent).join('|')==='18|20|51|0' &&
        option('d-bars').yAxis[0].data.length===8 && sum(option('d-types').series[0].data)===23 &&
        option('d-hours').series.length===3 && option('d-hours').series.every(s=>s.data.length===30&&s.stack==='total') && document.getElementById('d-hours-widget').textContent.includes('демо') &&
        document.querySelectorAll('#d-events tbody tr').length===4 && document.querySelector('#d-map canvas')?.width>0;
    })()`), `${theme}: shared map counts, eight districts, 23 accidents by type and explicit status demo and four event rows`);
    assert(await evaluate(`(()=>{
      const panel=document.getElementById('d-view-country').getBoundingClientRect(),insight=document.querySelector('.d-insight').getBoundingClientRect();
      return insight.bottom<=panel.bottom+1&&insight.top>=document.getElementById('d-country-charts').getBoundingClientRect().bottom;
    })()`), `${theme}: insight follows all six panels within the overview`);
    assert(await evaluate(`(async()=>{
      const source=(await (await fetch('data/monitor-demo.json')).json()).risk;
      const host=document.getElementById('d-map'),canvas=host.querySelector('.dk-map__canvas');
      const rendered=echarts.getInstanceByDom(canvas).getOption().series[0].data;
      const ids=rendered.map(item=>item.name).sort(), expected=Object.keys(source.values).sort();
      return ids.length===89&&JSON.stringify(ids)===JSON.stringify(expected)&&rendered.every(item=>{
        const value=source.values[item.name],tone=value>=source.thresholds.high?'high':value>=source.thresholds.medium?'medium':'low';
        return item.value===value&&item.itemStyle.areaColor===getComputedStyle(host).getPropertyValue('--risk-area-'+tone).trim();
      });
    })()`), `${theme}: all 89 source regions use low/medium/high area fills at the declared risk thresholds`);
    assert(await evaluate(`(()=>{
      const host=document.getElementById('d-map'),ctx=document.createElement('canvas').getContext('2d');
      const normalize=color=>{ctx.fillStyle=color;return ctx.fillStyle};
      return ['high','medium','low'].every((tone,i)=>normalize(getComputedStyle(document.querySelectorAll('#d-risk-keys .dk-key__dot')[i]).backgroundColor)===normalize(getComputedStyle(host).getPropertyValue('--risk-area-'+tone).trim()));
    })()`), `${theme}: visible risk legend matches the map area palette`);
    await checkDonutCenter(true, `${theme}/1536`);
    assert(await evaluate(`(()=>{
      const source={
        'd-sp1':[12,14,11,16,15,19,17,21,18,22,20,24,21,23],
        'd-sp2':[1410,1388,1402,1350,1361,1329,1344,1312,1330,1298,1305,1288,1296,1284],
        'd-sp3':[38,41,39,44,42,46,43,47,44,45,43,44,41,42]
      };
      return document.querySelectorAll('#d-kpis .dk-chart--spark').length===3&&Object.entries(source).every(([id,values])=>{
        const host=document.getElementById(id),series=echarts.getInstanceByDom(host).getOption().series[0];
        const actual=series.data.map(v=>typeof v==='object'?v.value:v);
        const metric=Number(host.closest('.dk-tile').querySelector('.dk-metric-lg').textContent.replace(/[^0-9]/g,''));
        return series.type==='bar'&&JSON.stringify(actual)===JSON.stringify(values)&&values.at(-1)===metric&&host.querySelector('canvas')?.width>0;
      });
    })()`), `${theme}: exactly three bar sparks preserve the existing histories and end at their displayed KPI values`);
    assert(await evaluate(`(async()=>{
      const source=(await (await fetch('data/monitor-demo.json')).json()).risk;
      const host=document.getElementById('d-bars'),option=echarts.getInstanceByDom(host).getOption(),data=option.series[0].data;
      return JSON.stringify(option.yAxis[0].data)===JSON.stringify(source.districts.map(d=>d.name))&&
        data.length===8&&data.filter(d=>d.value>=60).length===3&&data.filter(d=>d.value<60).length===5&&
        data.every((d,i)=>d.value===source.districts[i].average&&d.itemStyle.color===getComputedStyle(host).getPropertyValue('--risk-area-'+(d.value>=78?'high':d.value>=60?'medium':'low')).trim());
    })()`), `${theme}: district bars retain all averages and apply three amber/five green risk fills`);
    assert(await evaluate(`(()=>{
      const rows=[...document.querySelectorAll('#d-events tbody tr')].map(row=>[...row.cells].map(cell=>cell.textContent.trim()));
      return [...document.querySelectorAll('#d-events th')].map(el=>el.textContent).join('|')==='Время|Событие|Регион|Статус|Пострадавшие'&&
        JSON.stringify(rows)===JSON.stringify([
          ['14:20','Прорыв теплотрассы','Новосибирская область','в работе','1 240 чел.'],
          ['12:05','Отключение электроснабжения','Ростовская область','выехала бригада','380 чел.'],
          ['09:48','Подача восстановлена','Крым','устранена','96 чел.'],
          ['08:12','Замена задвижки','Забайкальский край','выехала бригада','210 чел.']
        ]);
    })()`), `${theme}: five event columns preserve all four original rows without invented status history`);
    assert(await evaluate(`(()=>{
      const series=echarts.getInstanceByDom(document.getElementById('d-line')).getOption().series;
      const predicted=series.filter(s=>s.lineStyle?.type==='dashed');
      return predicted.length===1&&predicted[0].markArea.data.length===1&&predicted[0].markLine.data.length===1&&predicted[0].symbol==='emptyCircle'&&series.some(s=>s!==predicted[0]&&s.lineStyle?.type!=='dashed')&&
        JSON.stringify(predicted[0].data.filter(v=>v!==null).slice(-3))===JSON.stringify([25,27,24]);
    })()`), `${theme}: forecast is dashed with hollow markers and retains its three demo values`);

    assert(result.riskReady && result.riskHigh==='18', `${theme}: shared region counts must load without invented deltas`);
    assert(result.hiddenWork && result.hiddenCauses && result.canvas>0, `${theme}: hidden details and visible chart`);
    assert(await evaluate(`[...document.querySelectorAll('#d-view-country .dk-widget, #d-risk-summary')].every(el=>{const s=getComputedStyle(el);return ['Top','Right','Bottom','Left'].every(side=>parseFloat(s['border'+side+'Width'])===0)&&s.boxShadow==='none'})`), `${theme}: cards separate through surfaces without decorative borders or shadows`);

    assert(await evaluate(`(()=>{
      const banner=document.querySelector('.dk-banner'), number=banner.querySelector('.dk-banner__number');
      const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
      const rgb=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)};
      const lum=color=>rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const contrast=(a,b)=>{a=lum(a);b=lum(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      const action=banner.querySelector('.dk-btn'), bg=getComputedStyle(banner).backgroundColor;
      if(contrast(getComputedStyle(action).color,getComputedStyle(action).backgroundColor)<4.5) throw Error('Priority action contrast '+contrast(getComputedStyle(action).color,getComputedStyle(action).backgroundColor));
      return banner.classList.contains('dk-banner--priority') && number.textContent==='23' &&
        parseFloat(getComputedStyle(number).fontSize)>=40 && contrast(getComputedStyle(number).color,bg)>=3 &&
        contrast(getComputedStyle(action).color,getComputedStyle(action).backgroundColor)>=4.5 &&
        [...document.querySelectorAll('.dk-tile--prominent .dk-metric-lg')].every(el=>parseFloat(getComputedStyle(el).fontSize)>=40);
    })()`), `${theme}: priority count, readable action contrast and prominent desktop KPI`);

    await evaluate(`document.getElementById('d-tab-country').focus()`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
    assert(await evaluate(`document.activeElement.id==='d-tab-work' && document.getElementById('d-tab-work').getAttribute('aria-selected')==='true' && !document.getElementById('d-view-work').hidden && document.getElementById('d-table').getBoundingClientRect().height>0 && document.querySelectorAll('#d-table tbody tr').length===4 && !document.getElementById('d-pager')`), `${theme}: keyboard opens real work rows without invented pagination`);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35});
    await evaluate(`new Promise(resolve=>setTimeout(resolve,1000))`);
    assert(await evaluate(`document.activeElement.id==='d-tab-causes' && !document.getElementById('d-view-causes').hidden && document.getElementById('d-donut').getBoundingClientRect().width>0 && document.querySelector('#d-donut canvas')?.width>0`), `${theme}: End reaches causes and restores chart dimensions`);
    const causesGeometry = await evaluate(`(()=>{
      const track=document.querySelector('#d-car .dk-car__track'), cards=[...track.children];
      const box=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height}};
      return {panel:box(document.getElementById('d-view-causes')),track:box(track),cards:cards.map(box),donut:box(document.getElementById('d-donut').closest('.dk-widget')),uptime:box(document.getElementById('d-uptime').closest('.dk-widget')),page:document.documentElement.scrollHeight};})()`);
    if(process.env.DK_ANALYTICS_SHOTS) {
      const shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(`/tmp/dk-analytics-${theme}-1366.png`,Buffer.from(shot.data,'base64'));
    }
    assert(causesGeometry.panel.bottom<=causesGeometry.page, `${theme}: causes view fits: ${JSON.stringify(causesGeometry)}`);
    assert(await evaluate(`(()=>{
      const track=document.querySelector('#d-car .dk-car__track'),cards=[...track.children];
      track.scrollTop=0;const viewport=track.getBoundingClientRect(),first=cards[0].getBoundingClientRect();
      const complete=first.top>=viewport.top-1&&first.bottom<=viewport.bottom+1;
      const contentComplete=cards.every(card=>[...card.querySelectorAll('.dk-car__tags,.dk-car__row,.dk-car__text')].every(el=>el.getBoundingClientRect().bottom<=card.getBoundingClientRect().bottom-parseFloat(getComputedStyle(card).paddingBottom)+1));
      track.scrollTop=track.scrollHeight;const last=cards.at(-1).getBoundingClientRect();
      const reached=last.top>=viewport.top-1&&last.bottom<=viewport.bottom+1;
      const following=document.getElementById('d-donut').closest('.dk-widget').getBoundingClientRect();
      track.scrollTop=0;
      return cards.length===4&&complete&&contentComplete&&reached&&following.top>=track.getBoundingClientRect().bottom&&getComputedStyle(track).scrollbarWidth!=='none'&&track.tabIndex===0&&!!track.getAttribute('aria-label');
    })()`), `${theme}: complete first and last risk cards, all metrics/reasons, scroll does not overlap the donut`);
    if(process.env.DK_ANALYTICS_SHOTS) {
      await evaluate(`document.querySelector('#d-car .dk-car__track').scrollTop=10000`);
      const shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(`/tmp/dk-analytics-${theme}-1366-last.png`,Buffer.from(shot.data,'base64'));
      await evaluate(`document.querySelector('#d-car .dk-car__track').scrollTop=0`);
    }
    await evaluate(`document.getElementById('d-tab-country').click()`);
    assert(await evaluate(`!document.getElementById('d-view-country').hidden && document.querySelectorAll('#d-view-country .dk-tile').length===5`), `${theme}: returning preserves the overview`);
    for(const width of [390,320]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
      await evaluate(`new Promise(resolve=>setTimeout(resolve,300))`);
      assert(await evaluate(`document.documentElement.scrollWidth<=${width} && [...document.querySelectorAll('#d-views button')].every(el=>el.getBoundingClientRect().height>=44)`), `${theme}/${width}: mobile reflow and usable tab targets: ${JSON.stringify(await evaluate("({width:document.documentElement.scrollWidth,tabs:[...document.querySelectorAll('#d-views button')].map(el=>el.getBoundingClientRect().height)})"))}`);
      assert(await evaluate(`(()=>{
        const panels=[...document.querySelectorAll('#d-country-charts > .dk-widget')].map(el=>el.getBoundingClientRect());
        return panels.length===6&&panels.every((p,i)=>p.width>0&&p.left>=0&&p.right<=innerWidth&&(!i||p.top>=panels[i-1].bottom));
      })()`), `${theme}/${width}: all six panels form a complete single column`);
      assert(await evaluate(`(()=>{
        const header=document.querySelector('.dk-top').getBoundingClientRect();
        const controls=[...document.querySelectorAll('.dk-top button')].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
        const groups=[...document.querySelectorAll('.dk-top__tools > *')].map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height);
        const separate=rects=>rects.every((r,i)=>rects.slice(i+1).every(other=>r.right<=other.left+1||other.right<=r.left+1||r.bottom<=other.top+1||other.bottom<=r.top+1));
        return controls.every(r=>r.left>=0&&r.right<=innerWidth&&r.top>=header.top-1&&r.bottom<=header.bottom+1)&&separate(controls)&&separate(groups);
      })()`), `${theme}/${width}: header buttons, tabs, demo period and theme group do not overlap`);
      if(width===320) await checkDonutCenter(false, `${theme}/320`);
      assert(await evaluate(`getComputedStyle(document.querySelector('.dk-tabbar')).borderTopWidth==='0px'`), `${theme}/${width}: mobile navigation has no decorative frame`);
      assert(await evaluate(`(()=>{
        const cards=[...document.querySelectorAll('#d-view-country .dk-tile')].map(el=>el.getBoundingClientRect());
        return cards.length===5 && cards[4].top>=cards[2].bottom && Math.abs(cards[4].left-cards[0].left)<1 && Math.abs(cards[4].right-cards[1].right)<1 && Math.abs(cards[0].top-cards[1].top)<1 && Math.abs(cards[2].top-cards[3].top)<1 &&
          cards[2].top>cards[0].bottom && cards[1].left>cards[0].right &&
          Math.abs(cards[0].left-cards[2].left)<1 && Math.abs(cards[1].left-cards[3].left)<1;
      })()`), `${theme}/${width}: five KPI reflow into two columns with a full-width final card`);
      assert(await evaluate(`(()=>{
        const tabs=[...document.querySelectorAll('#d-views [role="tab"]')];
        const boxes=tabs.map(el=>el.getBoundingClientRect());
        return tabs.map(el=>el.textContent.trim()).join('|')==='Обзор|Работа|Аналитика' &&
          boxes.every(box=>Math.abs(box.top-boxes[0].top)<1 && box.left>=0 && box.right<=innerWidth);
      })()`), `${theme}/${width}: approved short view names stay in one visible row`);
      assert(await evaluate(`(()=>{
        const text=document.querySelector('.dk-banner__text').getBoundingClientRect();
        const action=document.querySelector('.dk-banner > .dk-btn').getBoundingClientRect();
        return action.left>=text.right-1 && Math.abs((action.top+action.bottom)/2-(text.top+text.bottom)/2)<2 && action.height>=44;
      })()`), `${theme}/${width}: status action stays on the right in the same row with a touch target`);

      await evaluate(`document.getElementById('d-tab-work').click()`);
      assert(await evaluate(`document.documentElement.scrollWidth<=${width} && document.getElementById('d-table').getBoundingClientRect().width>0`), `${theme}/${width}: work cards stay accessible`);
      await evaluate(`document.getElementById('d-tab-country').click()`);
    }
  }
  // A shorter desktop viewport may scroll vertically, but every panel stays reachable.
  await send('Emulation.setDeviceMetricsOverride',{width:1536,height:768,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.getElementById('d-tab-country').click();new Promise(resolve=>setTimeout(resolve,300))`);
  assert(await evaluate(`(()=>{window.scrollTo(0,document.documentElement.scrollHeight);const insight=document.querySelector('.d-insight').getBoundingClientRect();return document.documentElement.scrollWidth<=1536&&insight.bottom<=innerHeight+1&&insight.top>=0})()`),'768px height: vertical scroll reaches the insight without horizontal overflow');
  await evaluate(`window.scrollTo(0,0)`);
  // Intermediate containers must not right-align KPI because of sparkline grid rules.
  for (const width of [768, 1024, 1199]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:720,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await evaluate(`document.getElementById('d-tab-country').click();new Promise(resolve=>setTimeout(resolve,300))`);
    assert(await evaluate(`(()=>{
      const grid=document.getElementById('d-country-charts').getBoundingClientRect();
      const cards=[...document.querySelectorAll('#d-country-charts .dk-widget')].map(el=>el.getBoundingClientRect());
      return cards.length===6 && cards.every(card=>card.left>=grid.left-1&&card.right<=grid.right+1) &&
        Math.abs(cards[0].left-grid.left)<1&&Math.abs(cards[0].right-grid.right)<1 &&
        cards.every((card,i)=>cards.slice(i+1).every(other=>card.right<=other.left+1||other.right<=card.left+1||card.bottom<=other.top+1||other.bottom<=card.top+1));
    })()`), `${width}: full-width map and six detailed panels reflow without overlap`);
    assert(await evaluate(` [...document.querySelectorAll('#d-view-country .dk-tile')].every(tile=>{
      const card=tile.getBoundingClientRect();const head=tile.querySelector('.dk-tile__head').getBoundingClientRect();
      const row=tile.querySelector('.dk-tile__row').getBoundingClientRect();
      const pad=parseFloat(getComputedStyle(tile).paddingLeft);
      return Math.abs(head.left-card.left-pad)<=2&&Math.abs(row.left-card.left-pad)<=2;
    })`), `${width}: compact KPI share a leading edge with spacious padding`);
  }
  // Enlarged analytics copy must remain complete on tablet and phone; page scrolling is intentional.
  for(const theme of ['dark','light']) for(const width of [1024,390]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:768,deviceScaleFactor:1,mobile:width<768});
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/dashboard.html?theme=${theme}`});
    await evaluate(`document.fonts.ready.then(()=>new Promise(resolve=>setTimeout(resolve,700)))`);
    await evaluate(`document.getElementById('d-tab-causes').click();document.querySelectorAll('#d-car .dk-car__item *').forEach(el=>{el.style.fontSize='24px';el.style.lineHeight='1.5'});new Promise(resolve=>setTimeout(resolve,300))`);
    if(process.env.DK_ANALYTICS_SHOTS) {
      const shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(`/tmp/dk-analytics-${theme}-${width}-large.png`,Buffer.from(shot.data,'base64'));
    }
    assert(await evaluate(`(()=>{
      const cards=[...document.querySelectorAll('#d-car .dk-car__item')];
      const complete=cards.every(card=>{
        const b=card.getBoundingClientRect(),pad=parseFloat(getComputedStyle(card).paddingBottom);
        const children=[...card.querySelectorAll('.dk-car__tags,.dk-car__row,.dk-car__text')];
        return children.every(el=>{const r=el.getBoundingClientRect();return r.bottom<=b.bottom-pad+1&&r.right<=b.right+1&&!(getComputedStyle(el).overflow==='hidden'&&el.scrollHeight>el.clientHeight+1)}) &&
          children[2].getBoundingClientRect().top>=children[1].getBoundingClientRect().bottom-1;
      });
      const track=document.querySelector('#d-car .dk-car__track').getBoundingClientRect();
      const donut=document.getElementById('d-donut').closest('.dk-widget').getBoundingClientRect();
      return complete&&document.documentElement.scrollWidth<=innerWidth&&donut.top>=track.bottom;
    })()`), `${theme}/${width}: enlarged analytics names, metrics and reasons remain complete without overlap or page overflow`);
  }
  // A complete navigation word must occupy one line at 320px and after text enlargement.
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await evaluate(`new Promise(resolve=>setTimeout(resolve,300))`);
  for (const enlarged of [false,true]) {
    if (enlarged) await evaluate(`document.querySelectorAll('.dk-tabbar__item').forEach(item=>item.style.fontSize='24px')`);
    assert(await evaluate(`(()=>{
      const nav=document.querySelector('.dk-tabbar');
      return document.documentElement.scrollWidth<=320 && [...nav.querySelectorAll('.dk-tabbar__item')].every(item=>{
        const label=item.querySelector('span'), text=label.firstChild;
        const first=document.createRange();first.setStart(text,0);first.setEnd(text,1);
        const last=document.createRange();last.setStart(text,text.length-1);last.setEnd(text,text.length);
        const itemBox=item.getBoundingClientRect();
        return Math.abs(first.getBoundingClientRect().top-last.getBoundingClientRect().top)<1&&itemBox.height>=44;
      });})()`), `320/${enlarged?'large':'normal'} text: complete bottom navigation names, touch targets, internal overflow`);
  }
  console.log('PASS: reference overview at 1536px, five KPI, six panels, shared map counts, status demo/type totals, keyboard views, genuine work rows, both themes, mobile reflow and enlarged analytics');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
