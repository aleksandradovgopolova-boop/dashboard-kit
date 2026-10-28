// Node-only behavioural contract tests: no browser, DOM or installed packages.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';

const source = readFileSync(new URL('../js/dk-dashboard.js', import.meta.url), 'utf8');
function runtime(fetchImpl = () => { throw Error('Unexpected network'); }) {
  const context = vm.createContext({window: {}, AbortController, TextDecoder, TextEncoder, setTimeout, clearTimeout, fetch: fetchImpl, console});
  vm.runInContext(source, context, {filename: 'dk-dashboard.js'});
  return context.window.dkDashboard;
}
const dk = runtime();
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
  return {
    schemaVersion: 1,
    source: {id: 'operations-demo', label: 'Тестовые обращения', kind: 'demo', updatedAt: '2026-10-21T09:30:00Z'},
    period: {from: '2026-10-01', to: '2026-10-31'},
    dimensions: [{id: 'team', label: 'Команда'}],
    metrics: [
      {id: 'requests', label: 'Обращения', unit: 'шт.', aggregation: 'sum', description: 'Число обращений за дату наблюдения.'},
      {id: 'hours', label: 'Время', unit: 'ч', aggregation: 'mean', description: 'Среднее по наблюдениям с известным значением; веса одинаковые.'}
    ],
    rows: [
      {id: 'a1', label: 'Вода, 1 октября', date: '2026-10-01', dimensions: {team: 'Вода'}, values: {requests: 10, hours: 2}},
      {id: 'b1', label: 'Тепло, 1 октября', date: '2026-10-01', dimensions: {team: 'Тепло'}, values: {requests: 5, hours: 4}},
      {id: 'a2', label: 'Вода, 2 октября', date: '2026-10-02', dimensions: {team: 'Вода'}, values: {requests: 0, hours: null}},
      {id: 'b2', label: 'Тепло, 2 октября', date: '2026-10-02', dimensions: {team: 'Тепло'}, values: {requests: null, hours: null}}
    ]
  };
}
const water = {filters: {team: ['Вода']}, period: null, page: 1, pageSize: 20};
const heat = {filters: {team: ['Тепло']}, period: null, page: 1, pageSize: 20};
function serverResponse(query) {
  return {schemaVersion: 1, mode: 'server', ...plain(dk.select(fixture(), query))};
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
function requests() {
  const calls = [];
  return {calls, load: args => { const item = {...args, ...deferred()}; calls.push(item); return item.promise; }};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('validation clones and deeply freezes data without freezing caller data', () => {
  const raw = fixture(), validated = dk.validate(raw);
  assert.deepEqual(plain(validated), raw);
  assert.equal(Object.isFrozen(raw), false);
  assert.equal(Object.isFrozen(validated.rows[0].values), true);
  raw.rows[0].values.requests = 900;
  assert.equal(validated.rows[0].values.requests, 10);
  assert.throws(() => { validated.rows[0].values.requests = 12; }, TypeError);
});

test('one filter and period derive rows, sums and means from the same snapshot', () => {
  const view = dk.select(fixture(), water);
  assert.deepEqual(plain(view.rows.map(row => row.id)), ['a1', 'a2']);
  assert.deepEqual(plain(view.totals.requests), {value: 10, observed: 2, total: 2, partial: false});
  assert.deepEqual(plain(view.totals.hours), {value: 2, observed: 1, total: 2, partial: true});
  const day = dk.select(fixture(), {filters: {}, period: {from: '2026-10-02', to: '2026-10-02'}});
  assert.equal(day.rows.length, 2);
  assert.deepEqual(plain(day.totals.requests), {value: 0, observed: 1, total: 2, partial: true});
  assert.deepEqual(plain(day.totals.hours), {value: null, observed: 0, total: 2, partial: true});
  assert.equal(view.source.kind, 'demo');
  assert.equal(view.metrics[0].unit, 'шт.');
});

test('unknown filter values and empty input produce empty results, never fabricated zeros', () => {
  const view = dk.select(fixture(), {filters: {team: ['Нет такой команды']}});
  assert.equal(view.rows.length, 0);
  assert.deepEqual(plain(view.totals.requests), {value: null, observed: 0, total: 0, partial: false});
  const raw = fixture(); raw.rows = [];
  assert.equal(dk.select(raw).totals.requests.value, null);
  assert.equal(dk.select(fixture(), {filters: {team: []}}).rows.length, 4);
});

test('malformed metadata, dates, duplicates, unknown fields and invalid numbers fail closed', () => {
  const changes = [
    d => { d.schemaVersion = 2; }, d => { delete d.source.label; }, d => { d.source.kind = 'fake'; },
    d => { d.source.updatedAt = '2026-02-30T09:30:00Z'; }, d => { d.source.updatedAt = '2026-10-21T25:00:00Z'; },
    d => { d.source.updatedAt = '2026-10-21'; }, d => { d.period.from = '2026-10-32'; },
    d => { d.period.to = '2026-09-30'; }, d => { d.rows[0].date = '2026-09-30'; },
    d => { d.rows.push({...d.rows[0]}); }, d => { d.metrics.push({...d.metrics[0]}); },
    d => { d.dimensions.push({...d.dimensions[0]}); }, d => { d.metrics[0].aggregation = 'median'; },
    d => { d.metrics[0].unit = ''; }, d => { d.metrics[0].description = ''; },
    d => { d.rows[0].values.extra = 1; }, d => { delete d.rows[0].values.requests; },
    d => { d.rows[0].values.requests = Infinity; }, d => { d.rows[0].values.requests = NaN; },
    d => { d.rows[0].values.requests = '10'; }, d => { d.rows[0].dimensions.extra = 'x'; },
    d => { delete d.rows[0]; }, d => { d.metrics.custom = 1; },
    d => { delete d.rows[0].dimensions.team; }, d => { d.rows[0].dimensions.team = ''; },
    d => { d.rows[0].dimensions = Object.create({team: 'Water'}); },
    d => { Object.defineProperty(d.rows[0].values, 'requests', {get() { return 100; }, enumerable: true}); },
    d => { d.source.secret = 'not allowed'; }
  ];
  changes.forEach((change, index) => {
    const value = fixture(); change(value);
    assert.throws(() => dk.validate(value), error => ['INVALID_DATA', 'UNSUPPORTED_VERSION'].includes(error.code), 'case ' + index);
  });
  const valid = fixture(); valid.period.from = '2024-02-29';
  assert.equal(dk.validate(valid).period.from, '2024-02-29');
});

test('dangerous keys and invalid queries cannot enter the data model', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const value = fixture();
    value.rows[0].values = JSON.parse('{"requests":10,"hours":2,"' + key + '":{}}');
    assert.throws(() => dk.validate(value));
    assert.throws(() => dk.select(fixture(), {filters: JSON.parse('{"' + key + '":[]}')}), error => error.code === 'INVALID_QUERY');
  }
  for (const query of [null, {filters: {unknown: []}}, {filters: {team: 'Вода'}}, {filters: {team: [null]}},
    {period: {from: '2026-10-03', to: '2026-10-02'}}, {period: {from: '2026-09-01', to: '2026-10-31'}},
    {page: 0}, {pageSize: 101}, {page: Number.MAX_SAFE_INTEGER}, {sort: 'requests'}]) {
    assert.throws(() => dk.select(fixture(), query), error => error.code === 'INVALID_QUERY');
  }
  assert.equal({}.polluted, undefined);
});

test('overflow is rejected while finite large means remain computable', () => {
  const raw = fixture(); raw.rows.forEach(row => { row.values.requests = Number.MAX_VALUE; row.values.hours = Number.MAX_VALUE; });
  assert.throws(() => dk.select(raw), error => error.code === 'INVALID_DATA');
  raw.rows.forEach(row => { row.values.requests = 1; });
  assert.equal(dk.select(raw).totals.hours.value, Number.MAX_VALUE);
});

test('late success cannot overwrite the latest query, even when loader ignores abort', async () => {
  const source = requests(), session = dk.createSession({load: source.load});
  const states = []; session.subscribe(state => states.push(state));
  const first = session.load(water); await tick();
  const second = session.load(heat); await tick();
  assert.equal(source.calls[0].signal.aborted, true);
  source.calls[1].resolve(fixture());
  assert.equal((await second).view.totals.requests.value, 5);
  source.calls[0].resolve(fixture()); await tick();
  assert.equal(await first, null);
  assert.deepEqual(plain(session.getSnapshot().query), heat);
  assert.equal(states.filter(state => state.status === 'ready').length, 1);
  assert.equal(states.filter(state => state.status === 'loading').every(state => state.view === null), true);
  session.destroy();
});

test('late error and current error never restore or relabel stale data', async () => {
  const source = requests(), session = dk.createSession({load: source.load});
  const first = session.load(water); await tick();
  const second = session.load(heat); await tick();
  source.calls[1].resolve(fixture()); await second;
  source.calls[0].reject(Error('old secret response')); await first; await tick();
  assert.equal(session.getSnapshot().status, 'ready');
  const third = session.load(water); await tick();
  assert.equal(session.getSnapshot().view, null);
  source.calls[2].reject(Error('password=never display me'));
  const error = await third;
  assert.equal(error.status, 'error'); assert.equal(error.view, null);
  assert.equal(error.error.code, 'LOAD_FAILED');
  assert.equal(error.error.message.includes('password'), false);
  assert.deepEqual(plain(error.query), water);
  const retry = session.retry(); await tick();
  assert.deepEqual(plain(source.calls[3].query), water);
  source.calls[3].resolve(fixture()); assert.equal((await retry).status, 'ready');
  session.destroy();
});

test('timeout settles an ignored abort and retry retains the filter', async () => {
  const source = requests(), session = dk.createSession({load: source.load, timeoutMs: 15});
  const result = await session.load(water);
  assert.equal(result.error.code, 'TIMEOUT');
  assert.equal(source.calls[0].signal.aborted, true);
  const retry = session.retry(); await tick();
  source.calls[1].resolve(fixture());
  assert.equal((await retry).view.totals.requests.value, 10);
  source.calls[0].resolve(fixture()); await tick();
  assert.equal(session.getSnapshot().status, 'ready');
  session.destroy();
});

test('destroy aborts work, disconnects subscribers and permits independent remount', async () => {
  const source = requests(), session = dk.createSession({load: source.load});
  const states = []; session.subscribe(state => states.push(state.status));
  const first = session.load(water); await tick();
  session.destroy(); session.destroy();
  assert.equal(source.calls[0].signal.aborted, true);
  assert.equal(await first, null);
  assert.deepEqual(states, ['idle', 'loading', 'destroyed']);
  source.calls[0].resolve(fixture()); await tick();
  assert.equal(await session.load(heat), null);
  assert.deepEqual(states, ['idle', 'loading', 'destroyed']);
  const remount = dk.createSession({load: () => fixture()});
  assert.equal((await remount.load(heat)).status, 'ready'); remount.destroy();
});

test('unsubscribe and consumer mutation cannot corrupt the store or later renderers', async () => {
  const session = dk.createSession({load: () => fixture()});
  let count = 0; const unsubscribe = session.subscribe(() => count++);
  unsubscribe(); unsubscribe();
  const state = await session.load(water);
  assert.equal(count, 1);
  assert.throws(() => state.query.filters.team.push('Тепло'), error => error.name === 'TypeError');
  assert.throws(() => { state.view.totals.requests.value = 999; }, TypeError);
  assert.equal(session.getSnapshot().view.totals.requests.value, 10);
  session.destroy();
});

test('reentrant subscribers can supersede or destroy a load before its loader starts', async () => {
  let calls = 0;
  const session = dk.createSession({load: () => { calls++; return fixture(); }});
  session.subscribe(state => { if (state.status === 'loading') session.destroy(); });
  assert.equal(await session.load(water), null);
  assert.equal(calls, 0);
  assert.equal(session.getSnapshot().status, 'destroyed');
  const another = dk.createSession({load: () => { calls++; return fixture(); }});
  let nested;
  another.subscribe(state => {
    if (state.status === 'loading' && state.query.filters.team[0] === 'Вода') nested = another.load(heat);
  });
  assert.equal(await another.load(water), null);
  assert.equal((await nested).view.totals.requests.value, 5);
  assert.equal(calls, 1); another.destroy();
});

test('invalid queries never reach loader; invalid payload and empty payload have distinct states', async () => {
  let calls = 0;
  const session = dk.createSession({load: () => { calls++; const data = fixture(); data.schemaVersion = 9; return data; }});
  assert.equal((await session.load({filters: {team: 'bad'}})).error.code, 'INVALID_QUERY');
  assert.equal(calls, 0);
  assert.equal((await session.load(water)).error.code, 'UNSUPPORTED_VERSION'); session.destroy();
  const empty = dk.createSession({load: () => fixture()});
  const result = await empty.load({filters: {team: ['Unknown']}});
  assert.equal(result.status, 'empty'); assert.equal(result.view.rows.length, 0);
  assert.equal(result.view.totals.requests.value, null); empty.destroy();
});

test('fetch adapter propagates signal, checks HTTP and hides response parsing errors', async () => {
  let received;
  const controller = new AbortController();
  const ok = runtime(async (url, options) => { received = {url, options}; return {ok: true, json: async () => fixture()}; });
  const data = await ok.fetchSource('data/example.json')({signal: controller.signal});
  assert.equal(data.rows.length, 4); assert.equal(received.url, 'data/example.json');
  assert.equal(received.options.signal, controller.signal);
  const bad = runtime(async () => ({ok: false, status: 500, json: () => { throw Error('must not parse'); }}));
  await assert.rejects(bad.fetchSource('/api')({signal: controller.signal}), error => error.code === 'HTTP_ERROR');
  const json = runtime(async () => ({ok: true, json: () => { throw Error('private response body'); }}));
  await assert.rejects(json.fetchSource('/api')({signal: controller.signal}), error => error.code === 'INVALID_JSON' && !error.message.includes('private'));
});

test('local pagination never changes KPI or chart aggregates', () => {
  const first = dk.select(fixture(), {pageSize: 1});
  const second = dk.select(fixture(), {pageSize: 1, page: 2});
  assert.equal(first.rowCount, 4); assert.equal(first.rows.length, 1);
  assert.notEqual(first.rows[0].id, second.rows[0].id);
  assert.deepEqual(plain(first.totals), plain(second.totals));
  assert.deepEqual(plain(first.series), plain(second.series));
  assert.equal(second.totals.requests.value, 15);
  assert.equal(second.series[0].values.requests, 15);
  assert.equal(second.series[1].values.requests, 0);
  assert.equal(second.series[1].values.hours, null);
});

test('server mode keeps whole-slice totals and charts with only one returned page', async () => {
  const requested = {page: 2, pageSize: 1};
  const result = dk.validateResponse(serverResponse(requested), requested);
  assert.equal(result.rows[0].values.requests, 5);
  assert.equal(result.totals.requests.value, 15);
  assert.equal(result.rowCount, 4);
  const session = dk.createSession({mode: 'server', load: ({query}) => serverResponse(query)});
  assert.equal((await session.load(requested)).view.totals.requests.value, 15);
  const pastEnd = await session.load({page: 10, pageSize: 1});
  assert.equal(pastEnd.status, 'ready'); assert.equal(pastEnd.view.rows.length, 0);
  assert.equal(pastEnd.view.rowCount, 4); session.destroy();
});

test('server contract supports 50000 matching rows without downloading those rows', () => {
  const request = {pageSize: 2}, response = serverResponse(request);
  response.rowCount = 50000;
  response.totals.requests = {value: 50000, observed: 50000, total: 50000, partial: false};
  response.totals.hours = {value: 3, observed: 50000, total: 50000, partial: false};
  response.series = [{date: '2026-10-01', values: {requests: 50000, hours: 3},
    coverage: {requests: {observed: 50000, total: 50000}, hours: {observed: 50000, total: 50000}}}];
  const result = dk.validateResponse(response, request);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rowCount, 50000);
  assert.equal(result.totals.requests.value, 50000);
});

test('server response rejects query mismatch, partial pages, inconsistent totals and coverage', () => {
  const request = {page: 1, pageSize: 2};
  const changes = [
    d => { d.query.page = 2; }, d => { d.query.filters = {team: ['Water']}; },
    d => { d.rows.pop(); }, d => { d.rows.push(fixture().rows[2]); },
    d => { d.rowCount = -1; }, d => { d.rowCount = 4.5; },
    d => { d.totals.requests.total = 2; }, d => { d.totals.requests.value = 100; },
    d => { d.totals.requests.observed = 0; }, d => { d.totals.requests.partial = false; },
    d => { d.totals.hours.value = 2; }, d => { d.series[0].coverage.requests.total = 1; },
    d => { d.series[0].coverage.requests.observed = 0; }, d => { d.series[0].values.requests = null; },
    d => { d.series.reverse(); }, d => { d.series[1].date = d.series[0].date; },
    d => { d.series[1].date = '2026-11-01'; }, d => { d.series.pop(); },
    d => { d.series[0].coverage.extra = {}; }, d => { d.series[0].values.extra = 0; },
    d => { delete d.series[0].values.requests; }, d => { delete d.totals.requests; },
    d => { delete d.query; }, d => { d.rows[0].date = '2026-10-10'; },
    d => { d.rows[0].values.requests = 99; }
  ];
  changes.forEach((change, index) => {
    const response = serverResponse(request); change(response);
    assert.throws(() => dk.validateResponse(response, request), undefined, 'server invalid case ' + index);
  });
  const filtered = serverResponse(water); filtered.rows[0].dimensions.team = 'Тепло';
  assert.throws(() => dk.validateResponse(filtered, water), error => error.code === 'QUERY_MISMATCH');
  const period = {period: {from: '2026-10-01', to: '2026-10-02'}};
  const response = serverResponse(period); response.period.to = '2026-10-03';
  assert.throws(() => dk.validateResponse(response, period), error => error.code === 'QUERY_MISMATCH');
});

test('server means are weighted by observed count and all-null remains missing', () => {
  const raw = fixture();
  raw.rows[0].values.hours = 2; raw.rows[1].values.hours = 4; raw.rows[2].values.hours = 12;
  const view = dk.select(raw);
  const response = {schemaVersion: 1, mode: 'server', ...plain(view)};
  assert.equal(dk.validateResponse(response).totals.hours.value, 6);
  response.totals.hours.value = 7.5; // Incorrect average of daily means (3 + 12) / 2.
  assert.throws(() => dk.validateResponse(response));
  const empty = serverResponse({filters: {team: ['Unknown']}});
  assert.equal(dk.validateResponse(empty, empty.query).totals.hours.value, null);
});

test('server aggregation overflow and table/series disagreement fail closed', () => {
  const response = serverResponse({page: 10, pageSize: 1});
  response.series.forEach(point => { point.values.requests = Number.MAX_VALUE; });
  response.totals.requests.value = Number.MAX_VALUE;
  assert.throws(() => dk.validateResponse(response, response.query), error => error.code === 'INVALID_DATA');
  const full = serverResponse();
  full.rows[0].values.requests = 11;
  assert.throws(() => dk.validateResponse(full), error => error.code === 'INVALID_DATA');
  const missing = serverResponse({pageSize: 1});
  missing.rows[0].values.requests = null;
  assert.throws(() => dk.validateResponse(missing, missing.query), error => error.code === 'INVALID_DATA');
});

test('fetch server mode posts normalized query and limits streamed response bytes', async () => {
  let sent;
  const api = runtime(async (url, options) => {
    sent = options;
    return new Response(JSON.stringify(serverResponse(JSON.parse(options.body))), {headers: {'Content-Type': 'application/json'}});
  });
  const query = {page: 2, pageSize: 1};
  const payload = await api.fetchSource('/api/dashboard', {mode: 'server'})({query, signal: new AbortController().signal});
  assert.equal(sent.method, 'POST'); assert.equal(sent.headers['Content-Type'], 'application/json');
  assert.equal(JSON.parse(sent.body).page, 2); assert.equal(payload.rowCount, 4);
  let cancelled = false;
  const huge = runtime(async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(16)); }, cancel() { cancelled = true; }
  })));
  await assert.rejects(huge.fetchSource('/api', {maxBytes: 20})({signal: new AbortController().signal}), error => error.code === 'RESPONSE_TOO_LARGE');
  assert.equal(cancelled, true);
});
