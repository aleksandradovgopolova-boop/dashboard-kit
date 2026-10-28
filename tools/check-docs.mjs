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
    res.setHeader('Content-Type', ({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(path)] || 'application/octet-stream');
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
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const settle = () => evaluate('new Promise(r=>setTimeout(r,150))');
  const visit = async (file, width, theme = 'light') => {
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
          first:document.querySelector('.sc-nav__catalog > a .sc-nav__text').textContent,
          nested:!!document.querySelector('.sc-nav details details'),
          visible:[...document.querySelectorAll('h1')].filter(x=>x.getClientRects().length).map(x=>x.textContent),
          open:[...document.querySelectorAll('.sc-nav__component-group[open]')].length,
          current:!active||!!active.getClientRects().length||innerWidth<1024,
          toc:!!document.querySelector('.sc-toc:not([hidden])')&&getComputedStyle(document.querySelector('.sc-toc')).display!=='none',
          focus:[...document.querySelectorAll('.dk-tablewrap')].every(x=>!x.clientWidth||x.scrollWidth<=x.clientWidth+1||x.tabIndex===0)};
      })()`);
      if (state.overflow || state.nested || state.first !== 'Обзор' || state.visible.length !== 1 || !state.current || !state.focus || (file === 'index.html' ? state.open !== 0 || state.visible[0] !== 'От вашей задачи к дашборду' : state.open !== 1) || (width < 1440 && state.toc)) failures.push({file,width,theme,...state});
      if (['index.html','component-table.html'].includes(file) && [320,1280].includes(width)) {
        const shot = await send('Page.captureScreenshot', {format:'png'});
        await writeFile(resolve(evidence, `docs-${file.replace('.html','')}-${theme}-${width}.png`), Buffer.from(shot.data,'base64'));
      }
    }
  }
  assert(!failures.length, 'Docs layout: ' + JSON.stringify(failures.slice(0,12)));

  await visit('index.html',1280);
  assert(await evaluate(`document.querySelectorAll('.sc-hero--overview .sc-overview-steps > li').length===3&&!!document.querySelector('.sc-hero--overview a[href="#start"]')`), 'Overview must expose the accepted task/data/dashboard flow');
  await evaluate(`const rules=document.querySelector('.sc-nav a[href="index.html#rules"]');rules.closest('details').querySelector('summary').click();rules.click()`); await settle();
  assert(await evaluate(`document.querySelector('#rules').hidden===false&&document.querySelector('.sc-hero').hidden&&document.querySelector('#catalog').hidden`), 'Rules route must show one article');
  await evaluate('history.back()'); await settle();
  assert(await evaluate(`!document.querySelector('.sc-hero').hidden&&[...document.querySelectorAll('.sc-sec')].every(x=>x.hidden)`), 'Back must restore overview');
  await evaluate(`location.hash='catalog'`); await settle();
  assert(await evaluate(`!document.querySelector('#catalog').hidden&&!!document.querySelector('.sc-nav a[aria-current="location"][href="index.html#catalog"]')`), 'Catalog deep link and active navigation');
  await visit('index.html',390);
  await evaluate(`document.querySelector('.sc-bar > button[aria-controls="sc-navigation"]').click()`); await settle();
  assert(await evaluate(`!document.querySelector('.sc-nav').hidden&&document.querySelector('.sc-shell>.dk-wrap').inert`), 'Mobile menu must isolate background');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert(await evaluate(`document.querySelector('.sc-nav').hidden&&!document.querySelector('.sc-shell>.dk-wrap').inert&&!document.body.classList.contains('sc-menu-open')`), 'Escape must release page scrolling and restore focus');
  await evaluate(`document.querySelector('.sc-search-trigger').click();const q=document.querySelector('.sc-search input');q.value='Таблица';q.dispatchEvent(new Event('input'))`); await settle();
  assert(await evaluate(`document.querySelector('.sc-search').open&&!!document.querySelector('.sc-search__results a[href="component-table.html"]')`), 'Component search must work with folded groups');
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
