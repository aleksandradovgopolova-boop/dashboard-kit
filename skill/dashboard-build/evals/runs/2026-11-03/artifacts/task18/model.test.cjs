const {model}=require('./app/model.js');
const source=require('./app/source.json'), assert=require('node:assert/strict');
function check(q, expected){const a=model(source,source,q).totals;for(const [k,v]of Object.entries(expected)){assert.ok(Math.abs(a[k].value-v)<1e-10,`${k}: ${a[k].value} != ${v}`);}}
check({}, {issued:100,issuedPlan:200,execution:50,rate:6.6});
check({month:'2025-05'},{issued:30,issuedPlan:80,execution:37.5,rate:4});
check({district:'СЗФО'},{issued:40,issuedPlan:50,execution:80,rate:4.5});
check({search:'алтай'},{issued:60,issuedPlan:150,execution:40,rate:8});
check({search:'Санкт',month:'2025-05'},{issued:30,issuedPlan:30,execution:100,rate:4});
let a=model(source,source,{month:'2025-05',district:'СФО'});assert.equal(a.totals.issued.value,0);assert.equal(a.totals.execution.value,0);assert.equal(a.totals.rate.value,null);assert.equal(a.totals.rate.code,'zero-denominator');
let partial=structuredClone(source);partial.rows[0].values.issued=null;delete partial.rows[2].values.rateWeight;
a=model(partial,source,{});assert.equal(a.totals.issued.value,null);assert.equal(a.totals.issued.known,90);assert.equal(a.totals.execution.value,null);assert.equal(a.totals.rate.value,null);assert.equal(a.regions.length,2);
a=model(partial,source,{month:'2025-05'});assert.equal(a.totals.issued.value,30);assert.equal(a.totals.rate.value,4);
partial=structuredClone(source);partial.rows.shift();a=model(partial,source,{});assert.equal(a.totals.issued.value,null);assert.deepEqual(a.totals.coverage,{actual:3,expected:4});
a=model(source,source,{search:'zzz'});assert.equal(a.regions.length,0);assert.equal(a.totals.issued.value,null);assert.equal(a.totals.issued.code,'empty');
assert.equal(model(source,source,{sort:'rate',dir:'asc'}).regions[0].id,'spb');assert.equal(model(source,source,{sort:'issued',dir:'desc'}).regions[0].id,'altai-rep');
console.log('PASS: hand-computed monthly totals, filters, weights, zero, null, omitted field/row, empty, sort');
