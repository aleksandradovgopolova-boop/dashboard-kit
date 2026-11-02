// Shared example frame: one rail-to-content inset, compact headers and useful copy.
import {launch,findChrome} from './browser-harness.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';

const root=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(process.env.DK_EVIDENCE_DIR||resolve(tmpdir(),'dashboard-kit-evidence'));
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
  try {
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));
    if(!path.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
    const body=await readFile(path);
    res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.topojson':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(path)]||'application/octet-stream');
    res.end(body);
  }catch{res.writeHead(404);res.end();}
});
if(!process.env.DK_PREVIEW_URL)await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=process.env.DK_PREVIEW_URL||'http://127.0.0.1:'+server.address().port+'/';
const browser=await launch(findChrome()),rows=[],errors=[];
const files=['regions','accidents','calendar','dashboard','family-mortgage','reference-dashboard','mobile'];
try {
  const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
  const send=(m,p={})=>browser.send(m,p,sessionId);
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const settle=()=>evaluate('new Promise(r=>setTimeout(r,150))');
  await send('Page.enable');await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const measure=()=>evaluate(`(()=>{
    const rect=x=>{const r=x?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;};
    const side=document.querySelector('.dk-side'),first=[...document.querySelectorAll('.dk-content .dk-widget,.dk-content .dk-hero,.dk-content .dk-banner')].filter(x=>x.getClientRects().length).sort((a,b)=>a.getBoundingClientRect().left-b.getBoundingClientRect().left)[0];
    const header=document.querySelector('.dk-top'),style=header&&getComputedStyle(header),rail=rect(side),content=rect(first);
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,rail,content,gap:rail&&content?content.left-rail.right:null,header:rect(header),headerPadding:style?[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft].map(parseFloat):null,
      obsoletePath:!!document.querySelector('.dk-top__path'),
      widgetTitles:[...document.querySelectorAll('.dk-widget__head .dk-head__title,.dk-widget__title')].filter(x=>x.getClientRects().length).map(x=>{const s=getComputedStyle(x);return {text:x.textContent.trim(),size:parseFloat(s.fontSize),line:parseFloat(s.lineHeight),weight:s.fontWeight};}),
      headerRow:(()=>{const b=document.querySelector('.dk-top__burger'),t=document.querySelector('.dk-top__titles'),a=document.querySelector('.dk-top__tools .dk-seg[aria-label="Тема"]');return [b,t,a].every(x=>x?.getClientRects().length)?[b,t,a].map(x=>{const r=x.getBoundingClientRect();return (r.top+r.bottom)/2;}):null;})(),
      copy:[...document.querySelectorAll('.dk-widget__meta,.dk-head__subtitle,p.dk-caption')].filter(x=>x.getClientRects().length).map(x=>x.textContent.trim()).filter(Boolean)};
  })()`);
  for(const theme of ['dark','light'])for(const width of [320,390,713,859,860,1023,1024,1280,1470,1920])for(const file of files){
    await send('Page.navigate',{url:'about:blank'});
    await send('Emulation.setDeviceMetricsOverride',{width,height:836,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setTouchEmulationEnabled',{enabled:width<768,maxTouchPoints:5});
    await send('Page.navigate',{url:base+file+'.html?theme='+theme});
    for(let i=0;i<100;i++){
      const ready=await evaluate(`location.pathname.endsWith('/${file}.html')&&document.readyState==='complete'`);
      if(ready)break;if(i===99)throw Error('Load timeout: '+file);await settle();
    }
    await evaluate('document.fonts.ready');await settle();
    if(['family-mortgage','reference-dashboard'].includes(file)){
      const selector=file==='family-mortgage'?'#fm-tbody tr':'#ref-rows tr';
      for(let i=0;i<100;i++){if(await evaluate(`!!document.querySelector('${selector}')`))break;if(i===99)throw Error('Data timeout: '+file+' '+JSON.stringify(await evaluate("({url:location.href,text:document.body.innerText.slice(0,1500)})")));await settle();}
    }
    const state=await measure();rows.push({file,theme,width,view:'initial',...state});
    if(state.overflow)errors.push(file+' overflow at '+width);
    if(state.rail&&width>=1024&&Math.abs(state.gap-14)>1)errors.push(file+' rail gap '+width+': '+state.gap);
    if(state.obsoletePath)errors.push(file+' redundant header path');
    if(state.widgetTitles.some(x=>x.size!==18||x.line!==24||x.weight!=='500'))errors.push(file+' widget title mismatch '+JSON.stringify(state.widgetTitles));
    if(state.headerRow&&Math.max(...state.headerRow)-Math.min(...state.headerRow)>1)errors.push(file+' header elements are on different rows '+width+' '+JSON.stringify(state.headerRow));
    // Below 1200px the working overview intentionally has a second action row.
    if(state.header&&width>=1280&&state.header.height>80)errors.push(file+' oversized desktop header: '+state.header.height);
    if(file==='regions'&&await evaluate("!!document.querySelector('#r-scope,#r-rank-caption')"))errors.push('Redundant region labels');
    if(file==='reference-dashboard'&&await evaluate("(()=>{const root=document.querySelector('#reference-dashboard'),view=root.referenceDashboard.session.getSnapshot().view,partial=Object.values(view.totals).some(x=>x.partial),note=document.querySelector('#ref-chart-note');return !!document.querySelector('.dk-head__subtitle')||note.hidden===partial||(!note.hidden&&!note.textContent.includes('Неполные'));})()"))errors.push('Redundant normal reference explanation');
    if(width===1470||width===390||(width===713&&['accidents','calendar','dashboard'].includes(file))){
      await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))');
      await settle();const shot=await send('Page.captureScreenshot',{format:'png'});
      await writeFile(resolve(out,file+'-'+theme+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
    }
    if(width===1470&&state.rail){
      await evaluate("document.querySelector('[data-act=fold]').click()");await settle();
      const expanded=await measure();rows.push({file,theme,width,view:'expanded',...expanded});
      if(expanded.overflow||Math.abs(expanded.gap-14)>1)errors.push(file+' expanded rail geometry');
      await evaluate("document.querySelector('[data-act=fold]').click()");await settle();
    }
  }
  await writeFile(resolve(out,'example-shell.json'),JSON.stringify({rows,errors},null,2));
  console.log(JSON.stringify({views:rows.length,errors},null,2));
  if(errors.length)throw Error('Example shell regression');
  console.log('PASS: seven examples, both themes, 320/390/713/859/860/1023/1024/1280/1470/1920px, folded/expanded rail, compact desktop headers and concise copy');
}finally{await browser.close();if(server.listening)server.close();}
