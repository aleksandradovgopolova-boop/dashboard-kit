(function(){
'use strict';
const $=id=>document.getElementById(id), esc=dkEsc, fmt=dkFmt;
let source=structuredClone(window.PLAN_SOURCE),month='all',snapshot,selected=null,detailOpener=null;
const details=dkModal('#detail'), method=dkModal('#method-dialog');
const monthNames={'all':'Апрель–май 2025','2025-04':'Апрель 2025','2025-05':'Май 2025'};
const num=(n,d=0)=>n===null?'Нет данных':fmt.num(n,d);
const pct=n=>n===null?'Нет данных':fmt.pct(n,1);
const delta=n=>n===null?'Нет данных':fmt.delta(n,'',1);
function panel(s,type,level=2){
 const issued=type==='issued',actual=s[issued?'issued':'budgetSpent'],plan=s[issued?'issuedPlan':'budgetPlan'],rate=s[issued?'issuedPct':'budgetPct'],diff=s[issued?'issuedDelta':'budgetDelta'],unit=issued?'кредитов':'млн ₽';
 const title=issued?'Выполнение плана выдач':'Использование бюджета';
 const unknown=actual===null||plan===null;
 const status=unknown?'Неполные данные':plan===0?'План равен нулю':diff===0?'Факт равен плану':diff<0?'Факт ниже плана':'Факт выше плана';
 return '<section class="dk-widget dk-col--half dk-tile metric-panel" data-metric="'+type+'"><h'+level+'>'+title+'</h'+level+'><div class="dk-tile__row"><span class="dk-metric-xl" data-value="percent">'+pct(rate)+'</span></div><dl class="metric-values"><div><dt>Факт, '+unit+'</dt><dd data-value="actual">'+num(actual,1)+'</dd></div><div><dt>План, '+unit+'</dt><dd data-value="plan">'+num(plan,1)+'</dd></div><div><dt>Отклонение, '+unit+'</dt><dd data-value="delta">'+delta(diff)+'</dd></div></dl><div class="dk-progress" aria-hidden="true"><span class="dk-progress__track"><span class="dk-progress__fill" style="width:'+ (rate===null?0:Math.max(0,Math.min(100,rate)))+'%"></span></span></div><span class="dk-caption" data-value="status">'+status+'</span>'+(!issued?'<span class="metric-foot">Лимит: '+num(s.budgetLimit,1)+' млн ₽ · Остаток: '+num(s.budgetRemaining,1)+' млн ₽</span>':'')+'</section>';
}
function cells(s){
 return '<td class="dk-td-num" data-label="Выдачи: факт / план, кредитов" data-field="issued">'+num(s.issued)+' / '+num(s.issuedPlan)+'<span class="secondary">'+pct(s.issuedPct)+'</span></td><td class="dk-td-num" data-label="Отклонение, кредитов" data-field="issuedDelta">'+delta(s.issuedDelta)+'</td><td class="dk-td-num" data-label="Бюджет: факт / план, млн ₽" data-field="budget">'+num(s.budgetSpent,1)+' / '+num(s.budgetPlan,1)+'<span class="secondary">'+pct(s.budgetPct)+'</span></td><td class="dk-td-num" data-label="Отклонение, млн ₽" data-field="budgetDelta">'+delta(s.budgetDelta)+'</td>';
}
function render(){
 snapshot=PlanModel.view(source,month);
 $('months').querySelectorAll('[data-month]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.month===month)));
 $('summary').innerHTML=panel(snapshot.summary,'issued')+panel(snapshot.summary,'budget');
 $('regions').innerHTML=snapshot.regions.map(r=>'<tr data-region="'+esc(r.id)+'"><td><button type="button" class="dk-btn dk-btn--ghost" data-open="'+esc(r.id)+'" aria-label="Помесячные детали: '+esc(r.name)+'">'+esc(r.name)+'<svg class="dk-i" aria-hidden="true"><use href="#ti-chevron-right"/></svg></button></td>'+cells(r)+'</tr>').join('');
 const state=!snapshot.summary.count?'Нет наблюдений':snapshot.summary.missing?'Неполные данные':'';
 $('status').textContent=state;$('status').hidden=!state;
}
function openRegion(id,opener){
 const region=snapshot.regions.find(r=>r.id===id);if(!region)return false;
 selected=id;detailOpener=opener||document.activeElement;
 $('detail-title').textContent=region.name;$('detail-period').textContent=monthNames[month]||month;
 $('detail-summary').innerHTML=panel(region,'issued',3)+panel(region,'budget',3);
 $('monthly').innerHTML=region.monthly.map(r=>'<tr data-month="'+esc(r.month)+'"><td>'+esc(monthNames[r.month]||r.month)+'</td>'+cells(r)+'</tr>').join('');
 details.open();return true;
}
$('months').addEventListener('click',e=>{const b=e.target.closest('[data-month]');if(!b)return;month=b.dataset.month;render();});
$('regions').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b)openRegion(b.dataset.open,b);});
$('detail').addEventListener('close',()=>{selected=null;if(detailOpener?.isConnected)detailOpener.focus({preventScroll:true});detailOpener=null;});
$('method').addEventListener('click',()=>method.open());
let tip=dkTooltip(document.querySelector('#detail .dk-modal__close'),{text:'Закрыть детали'});
const methodTip=dkTooltip(document.querySelector('#method-dialog .dk-modal__close'),{text:'Закрыть методику'});
$('method-dialog').addEventListener('close',()=>methodTip.hide());
$('detail').addEventListener('close',()=>tip.hide());
window.planFact={getView:()=>structuredClone(snapshot),setMonth(value){if(!['all','2025-04','2025-05'].includes(value))throw new RangeError('Неизвестный месяц');month=value;if($('detail').open)details.close();render();},openRegion,closeDetails:()=>details.close(),replaceSource(value){PlanModel.validate(value);source=structuredClone(value);if($('detail').open)details.close();render();},resetSource(){this.replaceSource(window.PLAN_SOURCE);}};
render();
})();
