(function(root){
'use strict';
const keys=['issued','issuedPlan','budgetSpent','budgetPlan','budgetLimit'];
function validate(source){
 if(!source || !Array.isArray(source.rows) || !Array.isArray(source.metrics))throw new TypeError('Неверный источник');
 const ids=new Set();
 for(const row of source.rows){
  if(ids.has(row.id))throw new TypeError('Повтор наблюдения');ids.add(row.id);
  if(!row.dimensions?.region || !row.dimensions?.regionName || !/^\d{4}-\d{2}-01$/.test(row.date))throw new TypeError('Неверное измерение');
  for(const key of keys)if(!(key in row.values) || !(row.values[key]===null || Number.isFinite(row.values[key])&&row.values[key]>=0))throw new TypeError('Неверное значение '+key);
 }
 for(const key of keys){const metric=source.metrics.find(m=>m.id===key);if(!metric||metric.aggregation!=='sum'||metric.unit!==(key.startsWith('issued')?'кредитов':'млн ₽'))throw new TypeError('Неизвестная агрегация '+key);}
 return source;
}
function aggregate(rows){
 const result={count:rows.length,missing:0};
 for(const key of keys){const vals=rows.map(r=>r.values[key]);const missing=vals.filter(v=>v===null).length;result[key]=!rows.length||missing?null:vals.reduce((a,b)=>a+b,0);result.missing+=missing;}
 result.issuedPct=ratio(result.issued,result.issuedPlan);result.budgetPct=ratio(result.budgetSpent,result.budgetPlan);
 result.issuedDelta=subtract(result.issued,result.issuedPlan);result.budgetDelta=subtract(result.budgetSpent,result.budgetPlan);result.budgetRemaining=subtract(result.budgetLimit,result.budgetSpent);
 return result;
}
function ratio(a,b){return a===null||b===null||b===0?null:a/b*100;}
function subtract(a,b){return a===null||b===null?null:a-b;}
function view(source,month='all'){
 validate(source);const rows=source.rows.filter(r=>month==='all'||r.date.slice(0,7)===month);
 const regions=[...new Set(rows.map(r=>r.dimensions.region))].map(id=>{const selected=rows.filter(r=>r.dimensions.region===id);return {id,name:selected[0].dimensions.regionName,...aggregate(selected),monthly:selected.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(r=>({month:r.date.slice(0,7),...aggregate([r])}))};});
 regions.sort((a,b)=>(a.issuedDelta===null)-(b.issuedDelta===null)||(a.issuedDelta??0)-(b.issuedDelta??0)||a.name.localeCompare(b.name,'ru'));
 return {month,summary:aggregate(rows),regions};
}
const api={validate,aggregate,view};root.PlanModel=api;if(typeof module==='object')module.exports=api;
})(typeof window==='object'?window:globalThis);
