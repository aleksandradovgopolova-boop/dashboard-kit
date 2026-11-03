import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('./', import.meta.url);
const config = JSON.parse(fs.readFileSync(new URL('app/screen-input.json',root),'utf8'));
globalThis.window=globalThis;
for(const name of ['dk-dashboard','dk-metrics']) vm.runInThisContext(fs.readFileSync(new URL(`app/kit/js/${name}.js`,root),'utf8'),{filename:name+'.js'});
const opts={grain:config.spec.source.grain,coverage:config.spec.source.coverage};
const cases=[
 ['all',{},null,[100,200,50,6.6]],
 ['north',{region:['Север']},null,[40,50,80,4.5]],
 ['south',{region:['Юг']},null,[60,150,40,8]],
 ['online',{channel:['Онлайн']},null,[70,170,41.17647058823529,7.714285714285714]],
 ['branch',{channel:['Отделение']},null,[30,30,100,4]],
 ['north-online',{region:['Север'],channel:['Онлайн']},null,[10,20,50,6]],
 ['day1',{}, {from:'2026-10-01',to:'2026-10-01'},[70,120,58.333333333333336,7.714285714285714]],
 ['day2',{}, {from:'2026-10-02',to:'2026-10-02'},[30,80,37.5,4]]
];
for(const [label,filters,period,expected] of cases){
 const query={filters,...(period?{period}:{} )};
 const raw=dkDashboard.select(config.data,query),named=dkMetrics.select(config.data,config.registry,query,opts);
 const actual=[raw.totals.issued.value,raw.totals.plan.value,named.totals.execution.value,named.totals.rate.value];
 actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-10,`${label} [${i}]: ${v} != ${expected[i]}`));
 console.log('PASS '+label+' '+JSON.stringify(actual));
}
const empty=dkMetrics.select(config.data,config.registry,{filters:{region:['Юг'],channel:['Отделение']}},opts);
assert.equal(empty.totals.execution.code,'empty'); assert.equal(empty.totals.execution.value,null);
const zero=dkMetrics.select(config.data,config.registry,{filters:{region:['Юг']},period:{from:'2026-10-02',to:'2026-10-02'}},opts);
assert.equal(zero.totals.execution.value,0); assert.equal(zero.totals.rate.value,null);assert.equal(zero.totals.rate.code,'zero-denominator');
const partial=structuredClone(config.data);partial.rows[0].values.issued=null;
const partialNamed=dkMetrics.select(partial,config.registry,{},opts);
assert.equal(partialNamed.totals.execution.value,null);assert.equal(partialNamed.totals.execution.code,'partial-input');
const nullRate=structuredClone(config.data);nullRate.rows[0].values.rate=null;
assert.equal(dkMetrics.select(nullRate,config.registry,{},opts).totals.rate.code,'partial-input');
const missing=structuredClone(config.data);missing.rows.pop();
assert.equal(dkMetrics.select(missing,config.registry,{},opts).totals.rate.code,'incomplete-source');
assert.equal(dkMetrics.select(config.data,config.registry,{page:2,pageSize:1},opts).totals.rate.value,6.6);
assert.deepEqual(JSON.parse(fs.readFileSync(new URL('app/screen-input.json',root),'utf8')),config);
console.log('PASS empty, genuine zero, zero weight, null issued/rate, missing row, pagination, immutable artifact');
