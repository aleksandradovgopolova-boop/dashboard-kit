// Регрессия документации: маршруты, меню и нативная прокрутка таблиц.
import {launch, findChrome} from './browser-harness.mjs';
import {createServer} from 'node:http';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve, extname, sep} from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(resolve(root) + sep)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(path);
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'})[extname(path)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
server.on('error', error => { console.error(error); process.exit(1); });
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  const chrome = findChrome();
  if (!chrome) throw Error('Chrome required');
  browser = await launch(chrome);
  const {targetId} = await browser.send('Target.createTarget', {url:'about:blank'});
  const {sessionId} = await browser.send('Target.attachToTarget', {targetId, flatten:true});
  const send = (method, params = {}) => browser.send(method, params, sessionId);
  let currentView = 'startup';
  const evaluate = async expression => {
    let result;
    try { result=await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true}); }
    catch(error){throw Error(error.message+'; view: '+currentView);}
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const settle = () => evaluate('new Promise(r=>setTimeout(r,150))');
  const visit = async (file, width, theme = 'light') => {
    currentView=file+' '+width+' '+theme;
    // Dispose the previous chart-heavy page before changing emulated dimensions.
    await send('Page.navigate',{url:'about:blank'});
    await send('Emulation.setDeviceMetricsOverride', {width,height:900,deviceScaleFactor:1,mobile:false});
    const url = new URL(file, `http://127.0.0.1:${server.address().port}/`);
    url.searchParams.set('theme', theme);
    await send('Page.navigate', {url:url.href});
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`location.pathname===${JSON.stringify(new URL(url).pathname)}&&document.readyState==='complete'&&!!document.querySelector('.sc-nav__catalog')`)) break;
      if (i === 99) throw Error('Documentation did not load: ' + file);
      await settle();
    }
    await evaluate('document.fonts.ready'); await settle();
  };
  await send('Page.enable');
  const failures = [];
  const evidence = resolve(process.env.DK_EVIDENCE_DIR || resolve(tmpdir(), 'dashboard-kit-evidence'));
  await mkdir(evidence, {recursive:true});
  const pages = (await readdir(root)).filter(name => name.startsWith('component-') && name.endsWith('.html'));
  // Каждый компонент использует общую оболочку; проверяем все её потребители.
  for (const theme of ['light','dark']) for (const width of [320,768,1280,1536]) {
    for (const file of ['index.html', ...pages]) {
      await visit(file, width, theme);
      const state = await evaluate(`(()=>{
        const active=document.querySelector('.sc-nav__component-group a[aria-current="page"]');
        return {overflow:document.documentElement.scrollWidth>innerWidth+1,
          first:document.querySelector('.sc-mega__home .sc-nav__text').textContent,
          nested:!!document.querySelector('.sc-nav details details'),
          visible:[...document.querySelectorAll('h1')].filter(x=>x.getClientRects().length).map(x=>x.textContent),
          open:[...document.querySelectorAll('.sc-nav__component-group:not([hidden])')].length,
          current:!active||!active.closest('.sc-mega__panel').hidden,closed:document.querySelector('.sc-nav').hidden,
          toc:!!document.querySelector('.sc-toc:not([hidden])')&&getComputedStyle(document.querySelector('.sc-toc')).display!=='none',
          focus:[...document.querySelectorAll('.dk-tablewrap')].every(x=>!x.clientWidth||x.scrollWidth<=x.clientWidth+1||x.tabIndex===0)};
      })()`);
      if (!state.closed || state.overflow || state.nested || state.first !== 'Обзор' || state.visible.length !== 1 || !state.current || !state.focus || (file === 'index.html' ? state.open !== 0 || state.visible[0] !== 'От вашей задачи к дашборду' : state.open !== 1) || (width < 1440 && state.toc)) failures.push({file,width,theme,...state});
      if ((width===1280 && theme==='dark') || (['index.html','component-table.html'].includes(file) && [320,1280].includes(width))) {
        const shot = await send('Page.captureScreenshot', {format:'png'});
        await writeFile(resolve(evidence, `docs-${file.replace('.html','')}-${theme}-${width}.png`), Buffer.from(shot.data,'base64'));
      }
    }
  }
  assert(!failures.length, 'Docs layout: ' + JSON.stringify(failures.slice(0,12)));

  await visit('index.html',1280);
  assert(await evaluate(`document.querySelectorAll('.sc-hero--overview .sc-overview-steps > li').length===3&&!!document.querySelector('.sc-hero--overview a[href="#start"]')`), 'Overview must expose the accepted task/data/dashboard flow');
  assert(await evaluate(`JSON.stringify([...document.querySelectorAll('.sc-mega__rail .sc-nav__text')].map(x=>x.textContent))===JSON.stringify(['Обзор','Начало работы','Дизайн-система','Компоненты','Разработка'])`),'Navigation must expose the five agreed primary sections');
  await evaluate(`[...document.querySelectorAll('.sc-mega__category')].find(x=>x.textContent.includes('Дизайн-система')).click()`);
  assert(await evaluate(`(()=>{const group=[...document.querySelectorAll('.sc-mega__panel')].find(x=>x.querySelector('.sc-mega__title').textContent==='Дизайн-система');return !group.hidden&&group.querySelectorAll('details').length===0&&group.querySelectorAll('.sc-mega__group').length===3&&!!group.querySelector('a[href="showcase.html#principy-teksta"]')&&!!group.querySelector('a[href="showcase.html#dostupnost"]');})()`),'Megamenu design system combines visual language, editorial policy and interface quality');
  await evaluate(`document.querySelector('.sc-nav a[href="showcase.html#principy-teksta"]').click()`); await settle();
  await visit('index.html',1280);
  // The primary journey must produce a usable, safe task rather than a demo link.
  assert(await evaluate(`(()=>{const img=document.querySelector('.sc-overview-art img');return img.complete&&img.naturalWidth>0&&!document.querySelector('.sc-live-preview')&&!document.querySelector('.sc-overview-intro canvas');})()`),'Hero must use the accepted static illustration, without live preview');
  assert(await evaluate(`!document.querySelector('script[src*="echarts"]')&&!document.querySelector('script[src*="dk-map"]')`),'Static overview must not load live chart/map dependencies');
  assert(await evaluate(`[...document.querySelectorAll('[data-example-image]')].every(x=>x.complete&&x.naturalWidth>0)`),'Real example screenshots must load');
  assert(await evaluate(`document.querySelectorAll('.sc-example-cards>a').length===4&&!document.querySelector('[data-more-examples],#overview-more-examples,.sc-overview-catalog')`),'Overview contains exactly four examples and no extra examples or library banner');
  await evaluate(`location.hash='start'`); await settle();
  await evaluate(`document.querySelector('#dashboard-task-form button[type="submit"]').click()`);
  assert(await evaluate(`document.querySelector('[data-task-result]').hidden && document.querySelector('#task-goal').getAttribute('aria-invalid')==='true'`),'Blank task must be rejected without losing entered values');
  await evaluate(`(()=>{const values={goal:'Сравнить план и факт <img src=x onerror=alert(1)>',audience:'Руководители регионов',data:'Данных пока нет, предложи структуру',context:'Телефон и компьютер; полный месяц'};Object.keys(values).forEach(name=>{const el=document.querySelector('#dashboard-task-form').elements[name];el.value=values[name];el.dispatchEvent(new Event('input',{bubbles:true}));});document.querySelector('#dashboard-task-form button[type="submit"]').click();})()`); await settle();
  assert(await evaluate(`(()=>{const x=document.querySelector('#dashboard-task-prompt');return !document.querySelector('[data-task-result]').hidden && !x.querySelector('img') && x.textContent.includes('Руководители регионов') && x.textContent.includes('Данных пока нет') && x.textContent.includes('skill/dashboard-build/SKILL.md') && x.textContent.includes('Публикацию согласуй отдельно') && document.activeElement.matches('[data-task-result-title]');})()`),'Task must include inputs, kit instructions, demo boundary, safe text and focus');
  await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedTask=text;}}});document.querySelector('[data-copy-task]').click()`); await settle();
  assert(await evaluate(`window.copiedTask===document.querySelector('#dashboard-task-prompt').textContent&&document.querySelector('[data-copy-task-status]').textContent.includes('скопирован')`),'Copy must use the prepared task');
  await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}});document.querySelector('[data-copy-task]').click()`); await settle();
  assert(await evaluate(`document.querySelector('[data-copy-task-status]').textContent.includes('вручную')`),'Clipboard denial must explain manual recovery');
  await visit('index.html#start',1280);
  assert(await evaluate(`document.querySelector('#task-goal').value.includes('Сравнить план и факт')&&document.querySelector('#task-data').value.includes('Данных пока нет')`),'Task draft must survive reload in the current session');
  await evaluate(`sessionStorage.removeItem('dk-overview-task-v1')`);
  await visit('index.html',1280);
  await evaluate(`const rules=document.querySelector('.sc-nav a[href="index.html#rules"]');[...document.querySelectorAll('.sc-mega__category')].find(x=>x.textContent.includes('Начало работы')).click();rules.click()`); await settle();
  assert(await evaluate(`document.querySelector('#rules').hidden===false&&document.querySelector('.sc-hero').hidden&&document.querySelector('#catalog').hidden`), 'Rules route must show one article');
  await evaluate('history.back()'); await settle();
  assert(await evaluate(`!document.querySelector('.sc-hero').hidden&&[...document.querySelectorAll('.sc-sec')].every(x=>x.hidden)`), 'Back must restore overview');
  await evaluate(`location.hash='catalog'`); await settle();
  assert(await evaluate(`!document.querySelector('#catalog').hidden&&!!document.querySelector('.sc-nav a[aria-current="location"][href="index.html#catalog"]')`), 'Catalog deep link and active navigation');
  await visit('index.html',390);
  await evaluate(`document.querySelector('.sc-bar__menu').click()`); await settle();
  assert(await evaluate(`!document.querySelector('.sc-nav').hidden&&document.querySelector('.sc-shell>.dk-wrap').inert`), 'Mobile menu must isolate background');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert(await evaluate(`document.querySelector('.sc-nav').hidden&&!document.querySelector('.sc-shell>.dk-wrap').inert&&!document.body.classList.contains('sc-menu-open')`), 'Escape must release page scrolling and restore focus');
  await evaluate(`document.querySelector('.sc-search-trigger').click();const q=document.querySelector('.sc-search input');q.value='Таблица';q.dispatchEvent(new Event('input'))`); await settle();
  assert(await evaluate(`document.querySelector('.sc-search').open&&!!document.querySelector('.sc-search__results a[href="component-table.html"]')`), 'Component search must work with folded groups');
  await visit('component-density-controls.html',1280);
  const comfortableHeight=await evaluate(`document.querySelector('#zhivoy-primer tbody tr').getBoundingClientRect().height`);
  await evaluate(`const density=document.querySelector('#advanced-density select');density.value='compact';density.dispatchEvent(new Event('change',{bubbles:true}))`); await settle();
  assert(await evaluate(`document.querySelector('#zhivoy-primer tbody tr').getBoundingClientRect().height`) < comfortableHeight,'Density example must visibly change its sample rows');
  await visit('component-saved-views.html',1280);
  await evaluate(`localStorage.removeItem('dk-demo-views')`);
  await visit('component-saved-views.html',1280);
  await evaluate(`document.querySelector('#view-service').value='water';document.querySelector('#view-period').value='30d';document.querySelector('#view-service').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#advanced-views [data-name]').value='Вода за месяц';document.querySelector('#advanced-views [data-action="create"]').click();document.querySelector('#view-service').value='heat';document.querySelector('#view-period').value='14d';document.querySelector('#view-service').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#advanced-views [data-action="apply"]').click()`); await settle();
  assert(await evaluate(`document.querySelector('#view-service').value==='water'&&document.querySelector('#view-period').value==='30d'`),'Saved-view example must restore visible parameters');
  await evaluate(`localStorage.removeItem('dk-demo-views')`);
  await visit('showcase.html',1280);
  await evaluate(`location.hash='tipografika'`); await settle();
  assert(await evaluate(`!document.querySelector('#tipografika').hidden&&[...document.querySelectorAll('.sc-sec:not([hidden])')].length===1`), 'Legacy showcase anchors');

  // Все статьи проходят через маршрутизацию, включая ранее выпадавший SDK-блок.
  for (const file of ['index.html','showcase.html']) for (const theme of ['light','dark']) for (const width of [320,1280]) {
    await visit(file,width,theme);
    const ids = await evaluate(`[...document.querySelectorAll('.sc-shell>.dk-wrap>section')].map(x=>x.id)`);
    for (const id of ids) {
      await evaluate(`location.hash=${JSON.stringify(id)}`); await settle();
      const state = await evaluate(`(()=>{const main=document.querySelector('.sc-shell>.dk-wrap');return {
        visible:[...main.querySelectorAll(':scope>section')].filter(x=>x.getClientRects().length).map(x=>x.id),
        headings:[...main.querySelectorAll('h1')].filter(x=>x.getClientRects().length).length,
        overflow:document.documentElement.scrollWidth>innerWidth+1
      };})()`);
      const expectedId = id === 'redpolitika' ? 'principy-teksta' : id; // Preserved legacy anchor.
      assert(state.visible.length===1&&state.visible[0]===expectedId&&state.headings===1&&!state.overflow, `Article ${file}#${id} ${theme} ${width}: `+JSON.stringify(state));
    }
  }
  await visit('showcase.html#sdk-extensions',1280);
  assert(await evaluate(`!document.querySelector('#sdk-extensions').hidden&&!!document.querySelector('.sc-nav a[href="#sdk-extensions"][aria-current="location"]')`), 'Scenarios direct link must open its article and navigation');
  await evaluate(`location.hash='tipografika'`); await settle();
  assert(await evaluate(`document.querySelector('#sdk-extensions').hidden`), 'Scenarios must not repeat below another article');
  await evaluate('history.back()'); await settle();
  assert(await evaluate(`!document.querySelector('#sdk-extensions').hidden`), 'Back must restore scenarios');
  await visit('index.html#development--connect',390);
  assert(await evaluate(`!document.querySelector('#development').hidden&&document.activeElement.id==='development--connect'`), 'Developer deep link and focus');

  // Колесо над таблицей двигает её, а у вертикального края — страницу.
  await visit('component-table.html',768);
  const point = async (selector, bottom = false) => evaluate(`(()=>{
    const x=document.querySelector(${JSON.stringify(selector)});x.scrollIntoView({block:'center'});x.scrollTop=${bottom ? 'x.scrollHeight' : '0'};
    const r=x.getBoundingClientRect();return {x:r.left+Math.min(120,r.width/2),y:Math.max(80,Math.min(innerHeight-80,r.top+r.height/2)),page:scrollY,left:x.scrollLeft,top:x.scrollTop};
  })()`);
  const wheel = async (p, deltaX, deltaY) => {
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
    await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:p.x,y:p.y,deltaX,deltaY}); await settle();
  };
  let p = await point('.sc-playground .dk-tablewrap');
  await wheel(p,240,0);
  assert(await evaluate('document.querySelector(".sc-playground .dk-tablewrap").scrollLeft>0'), 'Horizontal wheel must scroll live table');
  p = await point('.sc-playground .dk-tablewrap'); await wheel(p,0,180);
  assert(await evaluate('document.querySelector(".sc-playground .dk-tablewrap").scrollTop>0'), 'Vertical wheel must scroll tall table');
  p = await point('.sc-playground .dk-tablewrap',true); await wheel(p,0,240);
  assert(await evaluate('scrollY') > p.page, 'At table bottom vertical wheel must continue page');
  p = await point('#varianty-i-razmery .dk-tablewrap'); await wheel(p,0,240);
  assert(await evaluate('scrollY') > p.page, 'Horizontal-only table must not trap page scroll');
  await visit('component-table.html',320);
  await point('#varianty-i-razmery .dk-tablewrap');
  await evaluate('document.querySelector("#varianty-i-razmery .dk-tablewrap").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39}); await settle();
  assert(await evaluate('document.querySelector("#varianty-i-razmery .dk-tablewrap").scrollLeft>0'), 'Keyboard must scroll overflow table');
  console.log(`PASS: overview/routes/menu, ${pages.length} component pages, both themes at 320/768/1280/1536px, native wheel chaining and keyboard table scroll`);
} finally { if (browser) await browser.close(); server.close(); }
