import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
const read=name=>JSON.parse(readFileSync(new URL('./fixtures/named-metrics/'+name,import.meta.url),'utf8'));
const source=read('source.json'),registry=read('registry.json');
const context=vm.createContext({window:{}});
for(const name of ['dk-dashboard.js','dk-metrics.js'])vm.runInContext(readFileSync(new URL('../js/'+name,import.meta.url),'utf8'),context);
const api=context.window.dkMetrics,legacy=context.window.dkDashboard;
const clone=v=>JSON.parse(JSON.stringify(v));
const options={grain:{time:'day',dimensions:['region']},coverage:{expectedRows:4}};
const select=(query={},input=source,definitions=registry,opts=options)=>api.select(input,definitions,query,opts);
function values(view,expected){for(const [key,value] of Object.entries(expected)){assert.equal(view.totals[key].code,'ready',key);assert(Math.abs(view.totals[key].value-value)<1e-10,key);}}
test('literal independent totals and weighted result, not mean of regional percentages',()=>{
 values(select(),{execution:50,rate:6.6,approval:70});
 values(select({filters:{region:['Север']}}),{execution:80,rate:4.5,approval:50});
 values(select({period:{from:'2026-10-02',to:'2026-10-02'}}),{execution:37.5,rate:4,approval:50});
 values(select({filters:{region:['Север']},period:{from:'2026-10-02',to:'2026-10-02'}}),{execution:100,rate:4,approval:50});
 values(select({page:2,pageSize:1}),{execution:50,rate:6.6,approval:70});
 const changed=clone(source);changed.rows[2].values.applied=200;changed.rows[2].values.approved=180;
 values(select({},changed),{execution:50,rate:6.6,approval:76.66666666666667});
});
test('null of one operand blocks only dependent named metrics; legacy partial sum is unchanged',()=>{
 const data=clone(source);data.rows[0].values.issued=null;
 const view=select({},data);assert.equal(view.totals.execution.value,null);assert.equal(view.totals.execution.code,'partial-input');
 values(view,{rate:6.6,approval:70});
 assert.equal(legacy.select(data).totals.issued.value,90);
 assert.equal(legacy.select(data).totals.issued.partial,true);
});
test('zero numerator, zero denominator, null and empty are distinct states',()=>{
 const view=select({filters:{region:['Юг']},period:{from:'2026-10-02',to:'2026-10-02'}});
 assert.equal(view.totals.execution.value,0);assert.equal(view.totals.execution.code,'ready');
 assert.equal(view.totals.rate.code,'zero-denominator');assert.equal(view.totals.rate.value,null);
 assert.equal(select({filters:{region:['Нет']}}).totals.execution.code,'empty');
 const data=clone(source);data.rows.forEach(r=>r.values.issued=null);
 assert.equal(select({},data).totals.execution.code,'partial-input');
});
test('missing rows and unknown coverage never silently become complete, including filtered slices',()=>{
 const data=clone(source);data.rows.pop();
 for(const query of [{},{filters:{region:['Север']}},{filters:{region:['Нет']}}]){
  assert.equal(select(query,data).totals.execution.code,'incomplete-source');
  assert.equal(select(query,data).totals.execution.value,null);
 }
 assert.equal(select({},source,registry,{grain:options.grain}).totals.execution.code,'coverage-unknown');
 assert.throws(()=>select({},source,registry,{...options,coverage:{expectedRows:3}}),e=>e.code==='INVALID_METRIC');
});
test('grain is explicit, exact, declared and unique; month input cannot pass as day',()=>{
 assert.equal(select({},source,registry,{coverage:options.coverage}).totals.execution.code,'grain-unknown');
 assert.equal(select({},source,registry,{...options,grain:{time:'month',dimensions:['region']}}).totals.execution.code,'incompatible-grain');
 assert.equal(select({},source,registry,{...options,grain:{time:'day',dimensions:[]}}).totals.execution.code,'incompatible-grain');
 const data=clone(source);data.rows[1].date='2026-10-01';
 assert.equal(select({},data).totals.execution.code,'ambiguous-grain');
 assert.throws(()=>select({},source,registry,{...options,grain:{time:'day',dimensions:['unknown']}}),e=>e.code==='INVALID_METRIC');
});
test('registry rejects unsupported versions, parameters, references, distinct and non-additive ratios',()=>{
 for(const mutate of [r=>r.schemaVersion=2,r=>r.unknown=true,r=>r.metrics[0].id='constructor',r=>r.metrics.push(r.metrics[0]),r=>r.metrics[0].inputs.numerator='missing',r=>r.metrics[0].inputs.numerator='execution',r=>r.metrics[0].aggregation='distinct',r=>r.metrics[0].inputs.numerator='rate',r=>r.metrics[0].grain.time='month',r=>r.metrics[0].format.digits=7,r=>r.metrics[0].scale=0,r=>r.metrics[0].better='good',r=>r.metrics[0].grain.dimensions=['region','region']]){
  const definitions=clone(registry);mutate(definitions);assert.throws(()=>select({},source,definitions),e=>e.code==='INVALID_METRIC');
 }
});
test('server responses, paginated views and missing values are rejected rather than reaggregated',()=>{
 const view=legacy.select(source,{page:2,pageSize:1});
 assert.throws(()=>select({},view),e=>e.code==='INVALID_DATA');
 assert.throws(()=>select({},{schemaVersion:1,mode:'server',...view}),e=>e.code==='INVALID_DATA');
 const data=clone(source);delete data.rows[0].values.issued;
 assert.throws(()=>select({},data),e=>e.code==='INVALID_DATA');
});
test('weights are nonnegative; product and scale overflow yield explicit null state',()=>{
 const data=clone(source);data.rows[0].values.volume=-1;assert.throws(()=>select({},data),e=>e.code==='INVALID_METRIC');
 const overflow=clone(source);overflow.rows[0].values.rate=Number.MAX_VALUE;
 assert.equal(select({},overflow).totals.rate.code,'overflow');assert.equal(select({},overflow).totals.rate.value,null);
 const definitions=clone(registry);definitions.metrics[0].scale=Number.MAX_VALUE;definitions.metrics[0].inputs={numerator:'volume',denominator:'issued'};
 assert.equal(select({},source,definitions).totals.execution.code,'overflow');
});
test('results are immutable, source and registry remain caller-owned',()=>{
 const data=clone(source),definitions=clone(registry),view=select({},data,definitions);
 assert(Object.isFrozen(view.totals.execution));assert(!Object.isFrozen(data));assert(!Object.isFrozen(definitions));
 data.rows[0].values.issued=999;definitions.metrics[0].label='Изменено';
 assert.equal(view.totals.execution.value,50);assert.equal(view.metrics[0].label,'Выполнение плана');
 assert.equal(legacy.version,'1.0.0');assert.equal(api.version,'1.0.0');
});

test('JS callers cannot smuggle falsy options or hidden/computed/inherited required fields',()=>{
 for(const opts of [null,false,0,''])assert.throws(()=>select({},source,registry,opts),e=>e.code==='INVALID_METRIC');
 let calls=0;const definitions=clone(registry);
 Object.defineProperty(definitions.metrics[0].format,'type',{get(){calls++;return 'percent'},enumerable:false});
 assert.throws(()=>select({},source,definitions),e=>e.code==='INVALID_METRIC');assert.equal(calls,0);
 const a=clone(registry);Object.defineProperty(a.metrics,'0',{get(){calls++;return registry.metrics[0]},enumerable:true});
 assert.throws(()=>select({},source,a),e=>e.code==='INVALID_METRIC');assert.equal(calls,0);
 const b=clone(registry);delete b.metrics[0].format.type;
 b.metrics[0].format=Object.assign(Object.create(Object.assign(Object.create(null),{type:'percent'})),{digits:1});
 assert.throws(()=>select({},source,b),e=>e.code==='INVALID_METRIC');
});

test('optional inherited getters are rejected before access',()=>{
 let calls=0;const proto=Object.create(null);Object.defineProperty(proto,'grain',{get(){calls++;return options.grain}});
 const opts=Object.assign(Object.create(proto),{coverage:options.coverage});
 assert.throws(()=>select({},source,registry,opts),e=>e.code==='INVALID_METRIC');
 const definitions=clone(registry),parent=Object.create(null);Object.defineProperty(parent,'scale',{get(){calls++;return 100}});
 delete definitions.metrics[0].scale;Object.setPrototypeOf(definitions.metrics[0],parent);
 assert.throws(()=>select({},source,definitions),e=>e.code==='INVALID_METRIC');assert.equal(calls,0);
});
