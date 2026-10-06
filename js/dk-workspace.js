/* Optional offline dashboard state, presentation controls and export.
   Host owns data aggregation: these APIs never pretend to filter a server. */
(function(){
 'use strict';
 var esc=window.dkEsc;
 function copy(v){return JSON.parse(JSON.stringify(v));}
 var defaults={filters:{},period:null,sort:null,page:1,size:20,mode:'map',density:'comfortable'};
 function state(v){
  v=v||{};var out=copy(defaults);
  if(v.filters&&typeof v.filters==='object'&&!Array.isArray(v.filters))Object.keys(v.filters).forEach(function(k){if(['__proto__','constructor','prototype'].indexOf(k)<0&&(typeof v.filters[k]==='string'||Array.isArray(v.filters[k])&&v.filters[k].every(function(x){return typeof x==='string';})))out.filters[k]=copy(v.filters[k]);});
  if(typeof v.period==='string'||v.period===null)out.period=v.period;
  if(v.sort&&typeof v.sort.column==='string'&&['asc','desc'].indexOf(v.sort.dir)>=0)out.sort={column:v.sort.column,dir:v.sort.dir};
  ['page','size'].forEach(function(k){if(Number.isInteger(v[k])&&v[k]>0)out[k]=v[k];});
  if(['map','list','tiles'].indexOf(v.mode)>=0)out.mode=v.mode;
  if(['comfortable','compact'].indexOf(v.density)>=0)out.density=v.density;
  return out;
 }
 window.dkState=function(el,initial,opts){
  opts=opts||{};
  var value=state(initial),stopped=false;
  if(opts.url)try{var raw=window.dkUrl.get(opts.url);if(raw)value=state(JSON.parse(raw));}catch(e){/* Invalid URL state falls back to the supplied defaults. */}
  var release=window.dkOwn(el,function(){stopped=true;});
  return {get:function(){return copy(value);},update:function(patch){if(stopped)return;value=state(Object.assign({},value,patch));if(opts.url)window.dkUrl.set(opts.url,JSON.stringify(value));el.dispatchEvent(new CustomEvent('dk:statechange',{bubbles:true,detail:copy(value)}));},destroy:release};
 };
 window.dkState.normalize=state;
 window.dkDensity=function(el,opts){
  if(!el)return null;opts=opts||{};var root=opts.root||el.closest('.dk-root');if(!root)throw Error('density needs dk-root');
  var previous=root.getAttribute('data-density'),stopped=false;
  el.innerHTML='<label class="dk-density">Плотность <select aria-label="Плотность данных"><option value="comfortable">Обычная</option><option value="compact">Компактная</option></select></label>';
  var select=el.querySelector('select');
  function set(v,notify){if(stopped)return;if(['comfortable','compact'].indexOf(v)<0)throw TypeError('density');root.dataset.density=v;select.value=v;if(notify&&opts.onChange)opts.onChange(v);}
  function change(){set(select.value,true);}select.addEventListener('change',change);set(opts.value||'comfortable');
  var release=window.dkOwn(el,function(){stopped=true;select.removeEventListener('change',change);if(previous===null)root.removeAttribute('data-density');else root.setAttribute('data-density',previous);el.replaceChildren();});
  return {value:function(v){if(!arguments.length)return root.dataset.density;set(v);},update:function(o){set(o.value);},destroy:release};
 };
 function filename(name,ext){return String(name||'dashboard').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/[. ]+$/,'').slice(0,120).replace(new RegExp('\\.'+ext+'$','i'),'')+'.'+ext;}
 function download(blob,name){var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
 function cell(v){var s=v==null?'':String(v);if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
 window.dkExport={
  csv:function(rows,columns,name){var text='\ufeff'+[columns.map(function(c){return cell(c.label||c.key);}).join(',')].concat(rows.map(function(r){return columns.map(function(c){return cell(r[c.key]);}).join(',');})).join('\r\n');var blob=new Blob([text],{type:'text/csv;charset=utf-8'});if(name)download(blob,filename(name,'csv'));return blob;},
  chart:function(chart,name){if(!chart||!chart.exportImage) return Promise.reject(Error('chart export unsupported'));return chart.exportImage().then(function(blob){if(name)download(blob,filename(name,'png'));return blob;});},
  svg:function(svg,name){if(!svg||svg.localName!=='svg')throw TypeError('SVG element required');if(svg.querySelector('script,style,foreignObject,image,use')||[svg].concat(Array.from(svg.querySelectorAll('*'))).some(function(n){return Array.from(n.attributes).some(function(a){return /^on/i.test(a.name)||/href$/i.test(a.name)||/url\(|https?:|data:|javascript:/i.test(a.value);});}))throw Error('Export only self-contained trusted SVG');var clone=svg.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');var blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'});if(name)download(blob,filename(name,'svg'));return blob;},
  filename:filename
 };
 window.dkFullscreen=function(el,button){
  if(!el||!button)return null;var stopped=false,dialog=null,placeholder=null,opener=null,active=false;
  var oldPressed=button.getAttribute('aria-pressed');button.setAttribute('aria-pressed','false');
  function reflect(){var previous=active;active=document.fullscreenElement===el||!!dialog;button.setAttribute('aria-pressed',String(active));if(previous&&!active&&opener&&opener.isConnected)opener.focus();}
  function restore(){if(!dialog)return;var d=dialog;dialog=null;if(placeholder&&placeholder.parentNode){placeholder.replaceWith(el);placeholder=null;}d.remove();reflect();if(opener&&opener.isConnected)opener.focus();}
  function fallback(){if(!el.isConnected||stopped)return;placeholder=document.createComment('dk-fullscreen');el.before(placeholder);dialog=document.createElement('dialog');dialog.className='dk-fullscreen';dialog.setAttribute('aria-label',el.getAttribute('aria-label')||'Полный экран');dialog.tabIndex=-1;placeholder.parentNode.append(dialog);dialog.append(el);dialog.addEventListener('close',restore,{once:true});dialog.showModal();dialog.focus();reflect();}
  async function enter(){if(stopped||active)return;opener=document.activeElement;try{if(!el.requestFullscreen)throw Error('fallback');await el.requestFullscreen();if(stopped&&document.fullscreenElement===el)await document.exitFullscreen();}catch(e){if(!stopped)fallback();}reflect();}
  async function exit(){if(dialog){dialog.close();restore();}else if(document.fullscreenElement===el){await document.exitFullscreen();if(opener&&opener.isConnected)opener.focus();}reflect();}
  function toggle(){(active?exit():enter()).catch(function(e){console.warn('dk-fullscreen:',e.message);});}
  function key(e){if(e.key==='Escape'&&dialog){e.preventDefault();exit();}if(e.key==='Tab'&&dialog){var nodes=Array.from(dialog.querySelectorAll('button,a[href],input,select,[tabindex]')).filter(function(n){return !n.disabled&&n.tabIndex>=0&&n.getClientRects().length;});var first=nodes[0],last=nodes[nodes.length-1];if(!first){e.preventDefault();dialog.focus();}else if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
  button.addEventListener('click',toggle);document.addEventListener('fullscreenchange',reflect);document.addEventListener('keydown',key);
  var release=window.dkOwn(button,function(){stopped=true;exit().catch(function(){});button.removeEventListener('click',toggle);document.removeEventListener('fullscreenchange',reflect);document.removeEventListener('keydown',key);if(oldPressed===null)button.removeAttribute('aria-pressed');else button.setAttribute('aria-pressed',oldPressed);});
  return {enter:enter,exit:exit,destroy:release};
 };
 window.dkSavedViews=function(el,opts){
  if(!el)return null;opts=opts||{};if(!opts.key||!opts.state)throw TypeError('saved views needs key and state API');
  var storage=opts.storage;try{if(!storage)storage=localStorage;}catch(e){storage=null;}
  var doc={version:1,defaultId:null,views:[]},stopped=false,serial=0,status='';
  try{var raw=storage&&storage.getItem(opts.key);if(raw){var parsed=JSON.parse(raw);if(parsed.version===0&&Array.isArray(parsed.views))parsed={version:1,defaultId:null,views:parsed.views};if(parsed.version!==1||!Array.isArray(parsed.views))throw Error('Unsupported views version');doc={version:1,defaultId:parsed.defaultId||null,views:parsed.views.filter(function(v){return v&&typeof v.id==='string'&&typeof v.name==='string';}).map(function(v){return {id:v.id,name:v.name,state:state(v.state)};})};}}catch(e){status='Сохранённые виды недоступны: '+e.message;storage=null;}
  function persist(){try{if(!storage)throw Error('storage unavailable');storage.setItem(opts.key,JSON.stringify(doc));status='Сохранено на этом устройстве';return true;}catch(e){status='Изменения только в памяти: '+e.message;return false;}}
  function render(){el.innerHTML='<div class="dk-saved-views"><label>Название вида <input type="text" maxlength="120" data-name></label><button class="dk-btn" type="button" data-action="create">Сохранить текущий вид</button><ul>'+doc.views.map(function(v){return '<li data-id="'+esc(v.id)+'"><span>'+esc(v.name)+(v.id===doc.defaultId?' · по умолчанию':'')+'</span><button class="dk-btn" type="button" data-action="apply">Применить</button><button class="dk-btn" type="button" data-action="rename">Переименовать</button><button class="dk-btn" type="button" data-action="default">По умолчанию</button><button class="dk-btn" type="button" data-action="delete">Удалить</button></li>';}).join('')+'</ul><p role="status">'+esc(status)+'</p></div>';}
  function find(id){return doc.views.find(function(v){return v.id===id;});}
  function save(name){if(stopped)return null;name=String(name||'').trim().slice(0,120);if(!name)throw Error('Название обязательно');var id=Date.now().toString(36)+'-'+(++serial);while(find(id))id+='x';doc.views.push({id:id,name:name,state:state(opts.state.get())});persist();render();return id;}
  function apply(id){var v=find(id);if(v&&!stopped)opts.state.update(copy(v.state));}
  function rename(id,name){var v=find(id);name=String(name||'').trim().slice(0,120);if(v&&name&&!stopped){v.name=name;persist();render();}}
  function remove(id){if(stopped)return;doc.views=doc.views.filter(function(v){return v.id!==id;});if(doc.defaultId===id)doc.defaultId=null;persist();render();}
  function setDefault(id){if(stopped||id!==null&&!find(id))return;doc.defaultId=id;persist();render();}
  function click(e){var b=e.target.closest('[data-action]');if(!b||!el.contains(b)||stopped)return;var li=b.closest('[data-id]'),id=li&&li.dataset.id,name=el.querySelector('[data-name]').value,action=b.dataset.action;try{if(action==='create')save(name);if(action==='apply')apply(id);if(action==='rename')rename(id,name);if(action==='delete')remove(id);if(action==='default')setDefault(id);}catch(err){status=err.message;el.querySelector('[role=status]').textContent=status;}var nextRow=li&&Array.from(el.querySelectorAll('[data-id]')).find(function(n){return n.dataset.id===id;});var next=nextRow&&nextRow.querySelector('[data-action="'+action+'"]');if(next)next.focus();else el.querySelector('[data-name]').focus();}
  el.addEventListener('click',click);var release=window.dkOwn(el,function(){stopped=true;el.removeEventListener('click',click);el.replaceChildren();});render();if(opts.applyDefault&&doc.defaultId)apply(doc.defaultId);
  return {list:function(){return copy(doc.views);},create:save,rename:rename,apply:apply,remove:remove,setDefault:setDefault,update:function(){if(!stopped)render();},destroy:release};
 };
})();
