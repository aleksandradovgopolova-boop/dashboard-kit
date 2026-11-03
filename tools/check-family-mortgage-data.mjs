// Domain checks use actual page data; no browser or external dependencies.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const context = vm.createContext({window: {}, console});
for (const file of ['dk-dashboard.js', 'family-mortgage-data.js']) {
  vm.runInContext(readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'), context, {filename: file});
}
const api = context.window.familyMortgageData;
const fixture = JSON.parse(readFileSync(new URL('../data/family-mortgage-observations.json', import.meta.url), 'utf8'));
const plain = value => JSON.parse(JSON.stringify(value));
const clone = () => plain(fixture);
const sum = (rows, key) => rows.reduce((value, row) => value + row[key], 0);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);

test('one immutable demo source covers 89 regions and six full months', () => {
  const source = clone(), checked = api.validate(source), view = api.select(checked);
  assert.equal(checked.rows.length, 534);
  assert.equal(view.rowCount, 89);
  assert.equal(view.monthly.length, 6);
  assert.equal(view.source.kind, 'demo');
  assert.equal(Object.isFrozen(source), false);
  assert.equal(Object.isFrozen(checked.rows[0].values), true);
  assert.equal(Object.isFrozen(view.regions[0].monthly), true);
  assert.equal(api.validate(checked), checked);
  source.rows[0].values.issued = 0;
  assert.notEqual(source.rows[0].values.issued, checked.rows[0].values.issued);
});

test('region and month sums reconcile to every additive total', () => {
  const view = api.select(fixture);
  for (const key of ['issued', 'issuedPlan', 'volume', 'applied', 'approved']) {
    assert.equal(sum(view.regions, key), view.kpis[key], key + ' regions');
    assert.equal(sum(view.monthly, key), view.kpis[key], key + ' months');
    assert.equal(sum(view.districts, key), view.kpis[key], key + ' districts');
  }
  for (const key of ['spent', 'plan', 'limit']) {
    assert.equal(view.regions.reduce((total, r) => total + r.budget[key], 0), view.kpis.budget[key]);
    assert.equal(view.monthly.reduce((total, r) => total + r.budget[key], 0), view.kpis.budget[key]);
  }
  assert.equal(view.counts.crit + view.counts.high + view.counts.calm + view.counts.missing, view.rowCount);
  assert.equal(view.counts.behind, view.counts.crit + view.counts.high);
});

test('ratios and average interest use whole-slice weights, not means of percentages', () => {
  const view = api.select(fixture);
  close(view.kpis.planPct, view.kpis.issued / view.kpis.issuedPlan * 100);
  close(view.kpis.approval, view.kpis.approved / view.kpis.applied * 100);
  const rateWeight = fixture.rows.reduce((sum, row) => sum + row.values.rateWeight, 0);
  close(view.kpis.rate, rateWeight / view.kpis.volume / 100);
  close(view.kpis.budget.pct, view.kpis.budget.spent / view.kpis.budget.plan * 100);
  assert.ok(Math.abs(view.kpis.rate - sum(view.regions, 'rate') / view.rowCount) > 1e-5);
});

test('district, month and region search filter every block consistently', () => {
  const query = {district: 'ЦФО', month: '2025-07', search: 'МОСК'};
  const view = api.select(fixture, query);
  const matching = fixture.rows.filter(row => row.dimensions.district === 'ЦФО' && row.date === '2025-07-01' && row.dimensions.regionName.toLowerCase().includes('моск'));
  assert.equal(view.rowCount, 2);
  assert.equal(view.monthly.length, 1);
  assert.equal(view.districts.length, 1);
  assert.equal(view.kpis.issued, matching.reduce((sum, row) => sum + row.values.issued, 0));
  assert.deepEqual(plain(view.period), {from: '2025-07-01', to: '2025-07-31'});
  assert.ok(view.regions.every(row => row.monthly.length === 1));
  assert.equal(view.options.months.length, 6);
  assert.equal(view.options.districts.length, 8);
});

test('pagination and table ordering never change KPI, chart, ranking or map data', () => {
  const first = api.select(fixture, {pageSize: 12});
  const second = api.select(fixture, {page: 2, pageSize: 12});
  const names = api.select(fixture, {sort: 'name'});
  assert.equal(first.rows.length, 12);
  assert.equal(first.pageCount, 8);
  assert.notDeepEqual(plain(first.rows), plain(second.rows));
  for (const view of [second, names]) {
    assert.deepEqual(plain(view.kpis), plain(first.kpis));
    assert.deepEqual(plain(view.monthly), plain(first.monthly));
    assert.deepEqual(plain(view.ranking), plain(first.ranking));
  }
  const outside = api.select(fixture, {page: 999});
  assert.equal(outside.rows.length, 0);
  assert.equal(outside.rowCount, 89);
  assert.deepEqual(plain(outside.kpis), plain(first.kpis));
});

test('unknown selections and no matches stay empty, not silently reset to all', () => {
  for (const query of [{district: 'unknown'}, {month: '2030-01'}, {search: 'Несуществующий регион'}]) {
    const view = api.select(fixture, query);
    assert.equal(view.rowCount, 0);
    assert.equal(view.kpis.issued, null);
    assert.equal(view.kpis.planPct, null);
    assert.equal(view.kpis.rate, null);
    assert.equal(view.kpis.budget.pct, null);
    assert.equal(view.monthly.length, 0);
    assert.equal(view.pageCount, 0);
  }
});

test('one missing measurement invalidates its total and dependent ratio only', () => {
  const data = clone(); data.rows[0].values.issued = null;
  const view = api.select(data);
  assert.equal(view.kpis.issued, null);
  assert.equal(view.kpis.planPct, null);
  assert.equal(view.kpis.lag, null);
  assert.equal(view.kpis.status, 'missing');
  assert.equal(view.kpis.coverage.issued.observed, 533);
  assert.equal(view.kpis.coverage.issued.partial, true);
  assert.equal(view.counts.missing, 1);
  assert.equal(view.monthly[0].issued, null);
  assert.notEqual(view.monthly[1].issued, null);
  assert.notEqual(view.kpis.volume, null);
  assert.notEqual(view.kpis.rate, null);
});

test('zero is an observation; zero denominators are undefined ratios', () => {
  const data = clone(); data.rows.forEach(row => Object.keys(row.values).forEach(key => { row.values[key] = 0; }));
  const view = api.select(data);
  assert.equal(view.kpis.issued, 0);
  assert.equal(view.kpis.volume, 0);
  assert.equal(view.kpis.coverage.issued.observed, 534);
  assert.equal(view.kpis.planPct, null);
  assert.equal(view.kpis.rate, null);
  assert.equal(view.kpis.approval, null);
  assert.equal(view.kpis.budget.pct, null);
  assert.equal(view.counts.missing, 89);
});

test('status thresholds use the unrounded percentage-point shortfall', () => {
  const data = clone(); data.rows.forEach(row => { row.values.issuedPlan = 100; row.values.issued = 80; });
  assert.equal(api.select(data).counts.crit, 89);
  data.rows.forEach(row => { row.values.issued = 81; });
  assert.equal(api.select(data).counts.high, 89);
  data.rows.forEach(row => { row.values.issued = 100; });
  assert.equal(api.select(data).counts.calm, 89);
  data.rows.forEach(row => { row.values.issued = 101; });
  assert.equal(api.select(data).kpis.lag, 0);
});

test('malformed or semantically ambiguous source data fails closed', () => {
  const mutations = [
    d => { d.source.kind = 'live'; },
    d => { d.rows.pop(); },
    d => { const duplicate = plain(d.rows[0]); duplicate.id = 'another-id'; d.rows.push(duplicate); },
    d => { d.rows[0].values.volume = -1; },
    d => { d.rows[0].values.issued = 0.1; },
    d => { d.rows[0].values.approved = d.rows[0].values.applied + 1; },
    d => { d.rows[0].values.volume = 0; },
    d => { d.rows[0].date = '2025-04-02'; },
    d => { d.period.to = '2025-09-29'; },
    d => { d.metrics[0].aggregation = 'mean'; },
    d => { d.metrics[2].unit = 'млрд ₽'; },
    d => { d.rows[0].dimensions.district = 'other'; },
    d => { d.rows[0].dimensions.districtName = 'other'; },
  ];
  for (const mutate of mutations) { const data = clone(); mutate(data); assert.throws(() => api.validate(data)); }
});

test('unknown or malformed queries fail instead of changing filter meaning', () => {
  for (const query of [null, [], {page: 0}, {pageSize: 101}, {page: Number.MAX_SAFE_INTEGER},
    {month: '2025-13'}, {month: ''}, {sort: 'random'}, {sort: null}, {district: null},
    {search: 1}, {unexpected: true}, JSON.parse('{"__proto__":{}}')]) {
    assert.throws(() => api.select(fixture, query), {code: 'INVALID_QUERY'});
  }
  const accessor = {}; Object.defineProperty(accessor, 'month', {enumerable: true, get() { throw Error('Getter ran'); }});
  assert.throws(() => api.select(fixture, accessor), {code: 'INVALID_QUERY'});
});

test('unsafe aggregate sums are rejected even if individual rows are safe', () => {
  const data = clone(); data.rows.forEach(row => { row.values.volume = Number.MAX_SAFE_INTEGER; });
  assert.throws(() => api.select(data), {code: 'INVALID_DATA'});
});
