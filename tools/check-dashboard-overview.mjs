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
  for (const theme of ['dark', 'light']) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
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
    assert(await evaluate(`(()=>{const tabs=document.getElementById('d-views').getBoundingClientRect(),header=document.querySelector('.dk-top').getBoundingClientRect(),status=document.querySelector('.dk-banner').getBoundingClientRect();return tabs.top>=header.bottom-1&&tabs.bottom<=status.top+1;})()`), `${theme}: view tabs follow the heading before status and data`);
    assert(result.country.bottom <= 768 && result.height <= 768, `${theme}: country overview must fit the complete working viewport: ${JSON.stringify(result)}`);
    assert(result.width <= 1366, `${theme}: no horizontal page overflow`);
    assert(result.tileCount === 4 && result.tiles.every(tile=>Math.abs(tile.top-result.tiles[0].top)<1), `${theme}: four KPI in one row`);
    assert(result.charts.every(chart=>chart.top>=result.tiles[0].bottom), `${theme}: KPI before detailed charts`);
    assert(result.visibleTitles.join('|')==='Аварии: факт и прогноз|Средний риск по округам|Последние события', `${theme}: main country answer cannot be hidden in tabs`);
    assert(result.charts.every(chart=>Math.abs(chart.height-result.charts[0].height)<1), `${theme}: neighboring widgets have equal heights`);
    assert(result.padding.every(pad=>parseFloat(pad)>=20), `${theme}: spacious desktop padding`);
    assert(await evaluate(`document.querySelectorAll('#d-risk-summary .dk-split__seg').length===4 && getComputedStyle(document.querySelector('#d-risk-summary .dk-split__seg:last-child')).display==='none' && echarts.getInstanceByDom(document.getElementById('d-bars')).getOption().yAxis[0].data.length===8`), `${theme}: zero share invisible and all eight districts represented`);
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
    assert(causesGeometry.panel.bottom<=768 && causesGeometry.page<=768, `${theme}: causes view fits: ${JSON.stringify(causesGeometry)}`);
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
    assert(await evaluate(`!document.getElementById('d-view-country').hidden && document.querySelectorAll('#d-view-country .dk-tile').length===4`), `${theme}: returning preserves the overview`);
    for(const width of [390,320]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
      await evaluate(`new Promise(resolve=>setTimeout(resolve,300))`);
      assert(await evaluate(`document.documentElement.scrollWidth<=${width} && [...document.querySelectorAll('#d-views button')].every(el=>el.getBoundingClientRect().height>=44)`), `${theme}/${width}: mobile reflow and usable tab targets`);
      assert(await evaluate(`getComputedStyle(document.querySelector('.dk-tabbar')).borderTopWidth==='0px'`), `${theme}/${width}: mobile navigation has no decorative frame`);
      assert(await evaluate(`(()=>{
        const cards=[...document.querySelectorAll('#d-view-country .dk-tile')].map(el=>el.getBoundingClientRect());
        return cards.length===4 && Math.abs(cards[0].top-cards[1].top)<1 && Math.abs(cards[2].top-cards[3].top)<1 &&
          cards[2].top>cards[0].bottom && cards[1].left>cards[0].right &&
          Math.abs(cards[0].left-cards[2].left)<1 && Math.abs(cards[1].left-cards[3].left)<1;
      })()`), `${theme}/${width}: exactly four KPI in two rows and two columns`);
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
  // Intermediate containers must not right-align KPI because of sparkline grid rules.
  for (const width of [768, 1024, 1199]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:720,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await evaluate(`document.getElementById('d-tab-country').click();new Promise(resolve=>setTimeout(resolve,300))`);
    assert(await evaluate(`(()=>{
      const grid=document.getElementById('d-country-charts').getBoundingClientRect();
      const cards=[...document.querySelectorAll('#d-country-charts .dk-widget')].map(el=>el.getBoundingClientRect());
      return cards.length===3 && cards.every((card,index)=>Math.abs(card.left-grid.left)<1 &&
        Math.abs(card.right-grid.right)<1 && (!index || card.top>=cards[index-1].bottom));
    })()`), `${width}: all three detailed widgets stack at the full available width`);
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
  console.log('PASS: complete 1366×768 country overview, four KPI, equal widgets, keyboard views, genuine work rows, both themes, mobile 2×2 KPI/one-row tabs/status action, full-width tablet stack');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
