// Independent numerical oracle: expected values are literal JSON constants.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const read = name => JSON.parse(readFileSync(new URL('./fixtures/numeric/' + name, import.meta.url), 'utf8'));
const source = read('mortgage-source.json'), expected = read('mortgage-expected.json');
const context = vm.createContext({window:{},console});
for (const file of ['dk-dashboard.js','family-mortgage-data.js','dk-analysis.js']) {
  vm.runInContext(readFileSync(new URL('../js/' + file, import.meta.url),'utf8'), context, {filename:file});
}
const api = context.window.familyMortgageData, compare = context.window.dkComparison;
const clone = v => JSON.parse(JSON.stringify(v));
function check(actual, expected, path) {
  for (const [key,value] of Object.entries(expected)) {
    if (value && typeof value === 'object') check(actual[key],value,path + '.' + key);
    else if (typeof value === 'number') assert.ok(typeof actual[key] === 'number' && Math.abs(actual[key]-value)<1e-10,`MODEL ${path}.${key}: ${actual[key]} != ${value}`);
    else assert.equal(actual[key],value,'MODEL ' + path + '.' + key);
  }
}
for (const item of expected.cases) test('MODEL hand-checked mortgage: ' + item.id, () => {
  const input=clone(source);
  if(item.mutation==='approval-bases') { input.rows[2].values.applied=200; input.rows[2].values.approved=180; }
  if(item.mutation==='partial') input.rows[0].values.issued=null;
  if(item.mutation==='no-data') input.rows.forEach(r=>Object.keys(r.values).forEach(k=>r.values[k]=null));
  const view=api.select(input,item.query);
  check(view.kpis,item.kpis,item.id);
  assert.equal(view.rowCount,item.rowCount,'MODEL rowCount '+item.id);
});
test('MODEL independent detail, pagination and boundaries',()=>{
  const view=api.select(source,{pageSize:1,page:2});
  check(view.kpis,expected.cases[0].kpis,'page2');
  assert.equal(view.counts.crit,2,'20 percentage points belongs to crit');
  const region=view.regions.find(r=>r.id==='spb');
  check(region,expected.cases[1].kpis,'detail spb');
  check(region.monthly[0],{issued:10,issuedPlan:20,planPct:50,rate:6,approval:50},'detail april');
  check(region.monthly[1],{issued:30,issuedPlan:30,planPct:100,rate:4,approval:50},'detail may');
});
test('MODEL omission is invalid, partial calendar period is rejected, zero plan is not missing data',()=>{
  for(const mutate of [s=>delete s.rows[0].values.issued,s=>s.rows.pop(),s=>s.period.to='2025-05-15']) {
    const input=clone(source);mutate(input);assert.throws(()=>api.validate(input),e=>e.code==='INVALID_DATA');
  }
  const input=clone(source);input.rows.forEach(r=>r.values.issuedPlan=0);
  const view=api.select(input);assert.equal(view.kpis.issued,100);assert.equal(view.kpis.planPct,null);
  assert.equal(view.kpis.coverage.issuedPlan.partial,false);
});
for (const item of read('comparison.json')) test('MODEL explicit comparison: '+item.id,()=>{
  check(compare(item.current,item.previous,item.better,item.comparison),item.expected,item.id);
});
test('MODEL metadata is atomic, dates and policies fail closed',()=>{
  const valid=read('comparison.json')[0].comparison;
  for (const value of [null,{},[],{...valid,currentPeriod:undefined},{...valid,duration:'per-day'},
    {...valid,minBase:101,previousPeriod:{from:'2025-03-01',to:'2025-03-31',complete:true}},
    {...valid,baseLabel:''},{...valid,minBase:-1},
    {...valid,currentPeriod:{...valid.currentPeriod,complete:'true'}},
    {...valid,currentPeriod:{...valid.currentPeriod,to:'2025-02-30'}},
    {...valid,currentPeriod:{...valid.currentPeriod,from:'2025-06-01'}},
    {...valid,currentPeriod:{...valid.currentPeriod,sampleSize:1.5}}]) {
    assert.throws(()=>compare(10,20,'decrease',value),e=>e.name==='TypeError');
  }
  assert.equal(compare(10,20,'decrease').delta,-10,'legacy without metadata');
  assert.equal(compare(10,20,'decrease',{...valid,duration:'calendar-month',currentPeriod:{...valid.currentPeriod,from:'2025-05-02'}}).comparable,false);
  const leap={...valid,currentPeriod:{from:'2024-02-01',to:'2024-02-29',complete:true},previousPeriod:{from:'2023-02-01',to:'2023-02-28',complete:true},duration:'calendar-month'};
  assert.equal(compare(10,20,'decrease',leap).comparable,true);
  assert.equal(compare(Number.MAX_VALUE,-Number.MAX_VALUE,'increase',valid).code,'overflow');
  assert.equal(compare(10,20,'decrease',{...valid,minBase:40}).comparable,true,'threshold is inclusive');
});
