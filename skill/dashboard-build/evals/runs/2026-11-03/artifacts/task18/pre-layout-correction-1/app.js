'use strict';
const $=id=>document.getElementById(id), esc=dkEsc, clone=x=>JSON.parse(JSON.stringify(x));
const original=clone(window.MORTGAGE_SOURCE),domain=clone(original);
let source=clone(original),state={search:'',district:'',month:'',sort:'issued',dir:'desc',mode:'original'},view;
const monthly={'2025-04':'Апрель 2025','2025-05':'Май 2025'};
const details=dkModal('#details'),method=dkModal('#method');
const filters={};
function makeFilter(id,label,options,key){filters[key]=dkSelect($(id),{label,options:[{value:'all',name:label},...options],defaultValue:'all',value:'all',onChange:v=>{state[key]=v==='all'||v==null?'':v;render();}});}
makeFilter('district','Все округа',[{value:'СЗФО',name:'Северо-Западный'},{value:'СФО',name:'Сибирский'}],'district');
makeFilter('month','Все месяцы',Object.entries(monthly).map(([value,name])=>({value,name})),'month');
const mode=dkSelect($('mode'),{label:'Исходные данные',defaultValue:'original',value:'original',options:[{value:'original',name:'Исходные данные'},{value:'partial',name:'Неполные · демо'},{value:'missing-row',name:'Пропуск строки · демо'}],onChange:v=>setMode(v||'original')});
function setMode(value){state.mode=value; source=clone(original);if(value==='partial'){source.rows.find(r=>r.id==='spb-2025-04').values.issued=null;delete source.rows.find(r=>r.id==='altai-rep-2025-04').values.rateWeight;}if(value==='missing-row')source.rows=source.rows.filter(r=>r.id!=='spb-2025-04');mode.set(value);render();}
function textMetric(metric,key){if(metric.value===null)return '—';return key==='rate'||key==='execution'?dkFmt.num(metric.value,1):dkFmt.num(metric.value);}
function metricStatus(metric,key){
 if(metric.code==='empty')return 'Нет наблюдений';
 if(metric.code==='partial'||metric.code==='missing'){
  if('count' in metric)return (metric.code==='partial'?'Частично':'Нет данных')+' · '+dkFmt.num(metric.count)+'/'+dkFmt.num(metric.expected)+' наблюдений'+(metric.count?' · известно '+dkFmt.num(metric.known):'');
  return 'Неполные исходные данные';
 }
 if(metric.code==='zero-denominator')return key==='rate'?'Нет объёма для взвешивания':'Нулевой план';
 return '';
}
function metricHTML(g,key){return esc(textMetric(g[key],key))+(metricStatus(g[key],key)?'<div class="metric-status">'+esc(metricStatus(g[key],key))+'</div>':'');}
function tiles(g){return [['issued','Выдано','кредитов'],['execution','Выполнение плана','%'],['rate','Средняя ставка','%']].map(([key,label,unit])=>'<section class="dk-widget dk-widget--s dk-tile dk-tile--compact dk-col--third" data-kpi="'+key+'"><div class="dk-tile__head"><span class="dk-tile__label">'+label+'</span></div><div class="dk-tile__row"><span class="dk-metric-lg value-line" data-value="'+key+'">'+esc(textMetric(g[key],key))+' <span class="dk-tile__unit">'+unit+'</span></span></div>'+(key==='execution'?'<div class="metric-status">План: '+esc(textMetric(g.issuedPlan,'issuedPlan'))+' кредитов</div>':'')+'<div class="metric-status">'+esc(metricStatus(g[key],key))+'</div></section>').join('');}
function cell(g,key,label){return '<td class="dk-td-num" data-key="'+key+'" data-label="'+label+'">'+metricHTML(g,key)+'</td>';}
function render(){
 view=PortfolioModel.model(source,domain,state);
 $('summary').innerHTML=tiles(view.totals);
 $('period-label').textContent=monthly[state.month]||'Апрель — май 2025';
 const active=Boolean(state.search||state.district||state.month);
 $('reset').hidden=!active;
 $('results').textContent=active?'Найдено регионов: '+dkFmt.num(view.regions.length):view.totals.partial?'Неполные данные':'';
 $('regions').querySelector('tbody').innerHTML=view.regions.map(g=>'<tr data-region="'+esc(g.id)+'"><td data-label="Регион"><button type="button" class="dk-btn dk-btn--ghost region-action" data-detail="'+esc(g.id)+'">'+esc(g.name)+'</button><div class="dk-td-main__sub">'+esc(g.district)+'</div></td>'+cell(g,'issued','Выдано, кредитов')+cell(g,'issuedPlan','План, кредитов')+cell(g,'execution','Выполнение, %')+cell(g,'rate','Средняя ставка, %')+'</tr>').join('');
 $('regions').querySelectorAll('th[data-sortable]').forEach(th=>th.setAttribute('aria-sort',th.dataset.sortable===state.sort?(state.dir==='asc'?'ascending':'descending'):'none'));
 $('empty').hidden=Boolean(view.regions.length);$('regions').parentElement.hidden=!view.regions.length;
}
// dkTable owns keyboard/button headers; sorting is applied to the shared model.
dkTable($('regions'),{onSort:e=>{state.sort=e.column;state.dir=e.dir==='ascending'?'asc':'desc';render();}});
function openDetail(id){
 const g=view.regions.find(r=>r.id===id);if(!g)return false;
 $('detail-title').textContent=g.name;
 $('detail-context').textContent=g.district+' · '+($('period-label').textContent)+(g.partial?' · Неполные данные':'');
 $('detail-metrics').innerHTML=tiles(g);
 $('detail-months').innerHTML=g.months.map(r=>'<tr data-month="'+r.date.slice(0,7)+'"><td data-label="Месяц">'+esc(monthly[r.date.slice(0,7)]||r.date)+'</td>'+cell(r,'issued','Выдано, кредитов')+cell(r,'issuedPlan','План, кредитов')+cell(r,'execution','Выполнение, %')+cell(r,'rate','Средняя ставка, %')+'</tr>').join('');
 details.open();return true;
}
$('regions').addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b)openDetail(b.dataset.detail);});
$('search').addEventListener('input',e=>{state.search=e.target.value;render();});
function reset(){state.search='';state.district='';state.month='';$('search').value='';Object.values(filters).forEach(f=>f.set('all'));render();}
$('reset').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);
$('theme').addEventListener('click',()=>{dkTheme.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';});
dkTooltip($('theme'),{text:'Сменить светлую или тёмную тему'});dkTooltip($('reset'),{text:'Сбросить поиск, округ и месяц'});
$('method-open').addEventListener('click',()=>method.open());
window.portfolio={getView:()=>clone(view),getState:()=>({...state}),setMode,setFilters(next){Object.assign(state,next);$('search').value=state.search;filters.district.set(state.district||'all');filters.month.set(state.month||'all');render();},openDetails:openDetail,reset,replaceSource(next){source=clone(next);state.mode='custom';render();},restoreSource(){setMode('original');}};
render();
