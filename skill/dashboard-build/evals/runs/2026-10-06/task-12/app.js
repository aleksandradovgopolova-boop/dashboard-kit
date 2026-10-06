'use strict';
const $ = id => document.getElementById(id);
const initial = {filters:{district:''},period:'14',sort:{column:'risk',dir:'desc'},page:1,size:10,mode:'list',density:'comfortable'};
const key='eval12.current';
let memory=null, storageError='', alive=false, generation=0, handles=[], listeners=[], rows=[], map;
function storageRead(){try{const raw=localStorage.getItem(key);if(!raw)return initial;const record=JSON.parse(raw);if(record.version===0){const migrated={version:1,snapshot:record.state};localStorage.setItem(key,JSON.stringify(migrated));return migrated.snapshot;}if(record.version!==1){storageError='Неизвестная версия среза: исходная запись сохранена. Работаем в памяти.';return initial;}return record.snapshot;}catch(e){storageError='Хранилище недоступно или повреждено. Работаем в памяти.';return initial;}}
function persist(snapshot){memory=snapshot;if(storageError)return;try{localStorage.setItem(key,JSON.stringify({version:1,snapshot}));}catch(e){storageError='Срез не сохранён: хранилище недоступно. Работаем в памяти.';}}
function on(el,event,fn){el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));}
function periodValue(value){if(value==null)return null;if(Number(value))return {preset:Number(value)};try{return JSON.parse(value);}catch(e){return {preset:Number(value)||14};}}
function selectedRows(s){const days=s.period==null?Infinity:(Number(s.period)||14);let range;try{range=JSON.parse(s.period);}catch(e){}return rows.filter(r=>{const date=new Date();date.setDate(date.getDate()-r.age);const inPeriod=range&&range.from&&range.to?date>=new Date(range.from)&&date<=new Date(range.to):r.age<=days;return (!s.filters.district||r.fd===s.filters.district)&&inPeriod;}).sort((a,b)=>{let av=a[s.sort.column],bv=b[s.sort.column];if(av==null)return 1;if(bv==null)return -1;const n=typeof av==='number'?av-bv:String(av).localeCompare(String(bv),'ru');return s.sort.dir==='asc'?n:-n;});}
function mount(){if(alive)return;alive=true;const epoch=++generation;storageError='';
const state=dkState($('state-host'),memory||storageRead());handles.push(state);
const change=patch=>state.update(patch);
const filter=dkSelect($('filter'),{label:'Округ',mode:'single',options:[{value:'',name:'Все округа'},...['ЦФО','СЗФО','СФО','ПФО','УФО','ЮФО','СКФО','ДФО','Нет наблюдений'].map(name=>({value:name,name,count:rows.filter(r=>r.fd===name).length}))],onChange:value=>change({filters:{district:value},page:1})});
const period=dkPeriod($('period'),{value:{preset:14},presets:[{name:'Последние 7 дней',days:7},{name:'Последние 14 дней',days:14},{name:'Последние 30 дней',days:30}],onChange:value=>change({period:value==null?null:(value.preset?String(value.preset):JSON.stringify(value)),page:1})});
const density=dkDensity($('density'),{root:document.documentElement,value:'comfortable',onChange:value=>change({density:value})});
const pager=dkPager($('pager'),{total:rows.length,size:10,sizes:[10,20,50],page:1,noun:['регион','региона','регионов'],onChange:e=>change({page:e.page,size:e.size})});
const table=dkTable($('table'),{onSort:e=>change({sort:{column:e.column,dir:e.dir==='ascending'?'asc':'desc'},page:1})});
const views=dkSavedViews($('views'),{key:'eval12.views',state,applyDefault:false});
const editor=dkLayoutEditor($('editor'),{container:$('widgets'),key:'eval12.layout'});
handles.push(filter,period,density,pager,table,views,editor);
function render(){if(!alive)return;const s=state.get(), filtered=selectedRows(s);pager.update({total:filtered.length,page:s.page,size:s.size});if(pager.page!==s.page){change({page:pager.page});return;}
filter.update({value:s.filters.district||''});period.update({value:periodValue(s.period)});density.update({value:s.density});
const body=$('table').tBodies[0];body.replaceChildren();filtered.slice((s.page-1)*s.size,s.page*s.size).forEach(r=>{const tr=document.createElement('tr');tr.dataset.id=r.id;[r.name,r.risk==null?'Нет данных':dkFmt.num(r.risk),r.fd].forEach((value,i)=>{const td=document.createElement('td');td.textContent=value;if(i===1)td.className=r.risk==null?'dk-nodata':'dk-td-num';tr.append(td);});body.append(tr);});
$('table').querySelectorAll('th[data-sortable]').forEach(th=>th.setAttribute('aria-sort',th.dataset.sortable===s.sort.column?(s.sort.dir==='asc'?'ascending':'descending'):'none'));
$('empty').hidden=filtered.length>0;$('summary').textContent=dkFmt.num(filtered.length)+' регионов в срезе · период '+(s.period==null?'все даты':(Number(s.period)?dkFmt.num(Number(s.period))+' дней':'свой диапазон'));
document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===s.mode)));
if(map){const values={};filtered.forEach(r=>{if(r.risk!=null)values[r.id]=r.risk;});map.update({values,scope:filtered.map(r=>r.id),view:'map'});}
$('map').closest('[data-widget-id]').style.display=s.mode==='map'?'':'none';persist(s);$('status').textContent=storageError||'Срез сохраняется в этом браузере. '+dkFmt.num(filtered.length)+' регионов.';
}
on($('state-host'),'dk:statechange',render);
on($('reset'),'click',()=>change(initial));on($('empty-reset'),'click',()=>change(initial));on($('theme'),'click',()=>dkTheme.theme=document.documentElement.dataset.theme==='dark'?'light':'dark');
document.querySelectorAll('[data-mode]').forEach(b=>on(b,'click',()=>change({mode:b.dataset.mode})));
on($('tiles'),'click',()=>change({mode:'list'}));on($('preferences'),'click',()=>{const open=$('preferences-body').hidden;$('preferences-body').hidden=!open;$('preferences').setAttribute('aria-expanded',String(open));});
render();
Promise.all([fetch('../../../../../../data/regions.topojson').then(r=>r.json()),fetch('../../../../../../data/regions-tiles.json').then(r=>r.json())]).then(([topo,tiles])=>{if(!alive||epoch!==generation)return;map=dkMap($('map'),{topo,object:'ru89',tiles,values:{},unit:'баллов риска',controls:false});handles.push(map);render();}).catch(()=>{if(!alive||epoch!==generation)return;$('map').textContent='География не загрузилась. Наблюдения доступны в таблице; перезагрузите страницу.';});
window.demo={state,views,editor,filter,period,pager,density,table,destroy,mount,get alive(){return alive;},get ready(){return Boolean(map);}};
}
function destroy(){if(!alive)return;memory=window.demo.state.get();alive=false;generation++;listeners.splice(0).forEach(fn=>fn());handles.splice(0).reverse().forEach(h=>h.destroy());map=null;}
fetch('../../../../../../data/regions-tiles.json').then(r=>r.json()).then(data=>{rows=data.tiles.map((r,i)=>({...r,risk:i%11===0?null:(i===1?0:(i*17)%101),age:(i%30)+1}));mount();}).catch(()=>{$('status').textContent='Демонстрационные данные не загрузились. Перезагрузите страницу.';});
window.addEventListener('pagehide',destroy);
window.addEventListener('pageshow',e=>{if(e.persisted&&!alive)mount();});
