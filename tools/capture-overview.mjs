// Refresh actual example thumbnails. No external services or dependencies.
import {launch, findChrome} from './browser-harness.mjs';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve, extname, sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../',import.meta.url));
const server = createServer(async (request,response)=>{
  try {
    const path=resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://local').pathname));
    if(!path.startsWith(resolve(root)+sep)){response.writeHead(403);response.end();return;}
    const data=await readFile(path);
    response.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.topojson':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png'})[extname(path)]||'application/octet-stream');
    response.end(data);
  } catch {response.writeHead(404);response.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base = 'http://127.0.0.1:'+server.address().port+'/';
const directory = new URL('../assets/examples/',import.meta.url);
await mkdir(directory,{recursive:true});
const browser = await launch(findChrome());
try {
  const {targetId} = await browser.send('Target.createTarget',{url:'about:blank'});
  const {sessionId} = await browser.send('Target.attachToTarget',{targetId,flatten:true});
  const send = (method,params={}) => browser.send(method,params,sessionId);
  await send('Page.enable'); await send('Runtime.enable');
  browser.on(event=>{if(event.sessionId!==sessionId)return;if(event.method==='Runtime.exceptionThrown')console.error(event.params.exceptionDetails.exception?.description);if(event.method==='Runtime.consoleAPICalled'&&event.params.type==='error')console.error(event.params.args.map(x=>x.description||x.value).join(' '));});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for (const name of ['regions','accidents','calendar','family-mortgage']) for (const theme of ['dark','light']) {
    await send('Page.navigate',{url:new URL(name+'.html?theme='+theme,base).href});
    for (let i=0;i<100;i++) {
      const result=await send('Runtime.evaluate',{expression:`document.readyState==='complete'&&location.pathname.endsWith('/${name}.html')&&location.search==='?theme=${theme}'`,returnByValue:true});
      if(result.result.value) break;
      await new Promise(r=>setTimeout(r,100));
      if(i===99) throw Error(name+' did not load');
    }
    const ready = {
      regions:"document.querySelector('#r-map .dk-map__body')?.children.length>0",
      accidents:"document.querySelectorAll('canvas').length>=3",
      calendar:"document.querySelectorAll('#cal .dk-cal__day').length>=28",
      'family-mortgage':"document.querySelector('#fm-dashboard')?.dataset.status==='ready'&&document.querySelector('#fm-map')?.dataset.ready==='true'"
    }[name];
    for(let i=0;i<150;i++) {
      const state=await send('Runtime.evaluate',{expression:ready,returnByValue:true});
      if(state.result.value) break;
      if(i===149) { const state=await send('Runtime.evaluate',{expression:'document.body.innerText.slice(-1800)',returnByValue:true});console.error(state.result.value);throw Error(name+' has not rendered its data'); }
      await new Promise(r=>setTimeout(r,100));
    }
    await send('Runtime.evaluate',{expression:'document.fonts.ready.then(()=>new Promise(r=>setTimeout(r,1800)))',awaitPromise:true});
    const image=await send('Page.captureScreenshot',{format:'png'});
    const path=fileURLToPath(new URL(name+'-'+theme+'.png',directory));
    await writeFile(path,Buffer.from(image.data,'base64'));
    // macOS built-in image tool: preserve the complete screenshot, reduce weight.
    execFileSync('/usr/bin/sips',['--resampleWidth','640',path],{stdio:'ignore'});
    console.log(name,theme,path.replace(root,''));
  }
} finally { await browser.close(); server.close(); }
