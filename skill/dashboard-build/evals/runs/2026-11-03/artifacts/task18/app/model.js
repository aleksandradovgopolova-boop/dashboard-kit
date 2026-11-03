/* Monthly additive observations; complete domain is pinned separately from values. */
(function(root){
'use strict';
const finite = v => typeof v === 'number' && Number.isFinite(v);
function model(source, domain, query={}) {
 const q=String(query.search||'').trim().toLocaleLowerCase('ru');
 const expected=domain.rows.filter(r => (!query.month || r.date.startsWith(query.month)) && (!query.district || r.dimensions.district===query.district) && (!q || (r.dimensions.regionName+' '+r.dimensions.districtName+' '+r.dimensions.district).toLocaleLowerCase('ru').includes(q)));
 const grouped=new Map();
 expected.forEach(r=>{let g=grouped.get(r.dimensions.region); if(!g)grouped.set(r.dimensions.region,g={id:r.dimensions.region,name:r.dimensions.regionName,district:r.dimensions.district,expected:[]});g.expected.push(r);});
 const actual=new Map();
 (source.rows||[]).forEach(r=>{if(actual.has(r.id))throw Error('Повтор наблюдения: '+r.id);actual.set(r.id,r);});
 function aggregate(rows){
  const fields=['issued','issuedPlan','volume','rateWeight'];const sums={};
  fields.forEach(k=>{let count=0,known=0; rows.forEach(r=>{const a=actual.get(r.id),v=a?.values?.[k];if(finite(v)){count++;known+=v;}});sums[k]={value:rows.length && count===rows.length?known:null,known,count,expected:rows.length,code:!rows.length?'empty':count===rows.length?'complete':count?'partial':'missing'};});
  function ratio(n,d,scale){const a=sums[n],b=sums[d];return {value:a.value!==null && b.value!==null && b.value>0?a.value/b.value*scale:null,code:!rows.length?'empty':a.value===null || b.value===null?'partial':b.value===0?'zero-denominator':'complete'};}
  return {...sums,execution:ratio('issued','issuedPlan',100),rate:ratio('rateWeight','volume',0.01),coverage:{actual:rows.filter(r=>actual.has(r.id)).length,expected:rows.length},partial:fields.some(k=>sums[k].code!=='complete')};
 }
 let regions=[...grouped.values()].map(g=>({...g,...aggregate(g.expected),months:g.expected.map(r=>({id:r.id,date:r.date,...aggregate([r])}))}));
 const key=query.sort||'issued',dir=query.dir==='asc'?1:-1;
 regions.sort((a,b)=>{const x=key==='name'?a.name:a[key]?.value,y=key==='name'?b.name:b[key]?.value;if(x==null)return y==null?a.name.localeCompare(b.name,'ru'):1;if(y==null)return -1;return dir*(typeof x==='string'?x.localeCompare(y,'ru'):x-y)||a.name.localeCompare(b.name,'ru');});
 return {totals:aggregate(expected),regions,query:{...query},expected:expected.length};
}
if(typeof module!=='undefined' && module.exports)module.exports={model};else root.PortfolioModel={model};
})(typeof window!=='undefined'?window:globalThis);
