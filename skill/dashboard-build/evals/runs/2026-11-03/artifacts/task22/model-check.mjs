import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Independent literal arithmetic, written before loading the working model.
const expected = [
  {name: 'all', filters: {}, rows: 4, issued: 80, plan: 150, execution: 53.333333333333336, rate: 5.2727272727272725},
  {name: 'north', filters: {region: ['Север']}, rows: 2, issued: 30, plan: 50, execution: 60, rate: 4.2},
  {name: 'south', filters: {region: ['Юг']}, rows: 2, issued: 50, plan: 100, execution: 50, rate: 6.166666666666667},
  {name: 'online', filters: {channel: ['Онлайн']}, rows: 3, issued: 62, plan: 130, execution: 47.69230769230769, rate: 5.375},
  {name: 'branch', filters: {channel: ['Отделение']}, rows: 1, issued: 18, plan: 20, execution: 90, rate: 5},
  {name: 'empty-intersection', filters: {region: ['Юг'], channel: ['Отделение']}, rows: 0, issued: null, plan: null, execution: null, rate: null}
];
const kit = '/tmp/kit-evals-20261103/source-v2';
const input = '/tmp/kit-evals-20261103/blind-input';
const context = vm.createContext({window: {}});
for (const file of ['dk-dashboard.js', 'dk-metrics.js']) vm.runInContext(fs.readFileSync(`${kit}/js/${file}`, 'utf8'), context);
context.sourceText = fs.readFileSync(`${input}/source.json`, 'utf8');
context.registryText = fs.readFileSync(`${input}/registry.json`, 'utf8');
vm.runInContext('globalThis.source = JSON.parse(sourceText); globalThis.registry = JSON.parse(registryText); globalThis.options = {grain:{time:"day",dimensions:["region"]},coverage:{expectedRows:4}};', context);
const near = (actual, target) => target === null ? assert.equal(actual, null) : assert.ok(Math.abs(actual - target) < 1e-10, `${actual} != ${target}`);
for (const e of expected) {
  context.queryText = JSON.stringify({filters: e.filters});
  const result = JSON.parse(vm.runInContext('JSON.stringify({raw:window.dkDashboard.select(source,JSON.parse(queryText)),named:window.dkMetrics.select(source,registry,JSON.parse(queryText),options)})', context));
  assert.equal(result.raw.rowCount, e.rows);
  for (const metric of ['issued', 'plan']) near(result.raw.totals[metric].value, e[metric]);
  for (const metric of ['execution', 'rate']) {
    near(result.named.totals[metric].value, e[metric]);
    assert.equal(result.named.totals[metric].code, e.rows ? 'ready' : 'empty');
  }
  console.log(`PASS ${e.name}`);
}
const daily = JSON.parse(vm.runInContext('JSON.stringify(window.dkDashboard.select(source,{}).series)', context));
assert.deepEqual(daily.map(x => [x.date, x.values.issued, x.values.plan]), [['2026-10-01',57,90],['2026-10-02',23,60]]);
console.log('PASS daily literal fact/plan');
// Existing source contains a measured zero denominator; verify no substitution.
const noBase = JSON.parse(vm.runInContext('JSON.stringify(window.dkMetrics.select(source,registry,{filters:{region:["Юг"]},period:{from:"2026-10-02",to:"2026-10-02"}},options))', context));
assert.equal(noBase.totals.approval.value, null);
assert.equal(noBase.totals.approval.code, 'zero-denominator');
// In-memory probes only; the supplied files are never edited.
const zero = JSON.parse(vm.runInContext('JSON.stringify((function(){var clone=JSON.parse(sourceText);clone.rows[3].values.issued=0;return window.dkMetrics.select(clone,registry,{filters:{region:["Юг"]},period:{from:"2026-10-02",to:"2026-10-02"}},options);})())', context));
assert.equal(zero.totals.execution.value, 0);
assert.equal(zero.totals.execution.code, 'ready');
const missing = JSON.parse(vm.runInContext('JSON.stringify((function(){var clone=JSON.parse(sourceText);clone.rows[3].values.issued=null;return window.dkMetrics.select(clone,registry,{},options);})())', context));
assert.equal(missing.totals.execution.value, null);
assert.equal(missing.totals.execution.code, 'partial-input');
console.log('PASS measured zero, missing operand and zero denominator differ');
