/* Reference host adapter. The kit owns components; this file owns this product's
   query, source selection, presentation and command wiring. No application data
   or permissions are inferred from the visual components. */
(function () {
  'use strict';

  window.referenceDashboard = function (root, options) {
    options = options || {};
    if (root.referenceDashboard) root.referenceDashboard.destroy();
    var serverMode = options.mode === 'server' || (!options.mode && new URLSearchParams(location.search).get('source') === 'server');
    var load = options.load || window.dkDashboard.fetchSource(serverMode ? '/api/dashboard' : 'data/reference-dashboard.json', {mode:serverMode ? 'server' : 'local'});
    var session = window.dkDashboard.createSession({load:async function (request) {
      var snapshot = await load(request);
      if (!snapshot.metrics || snapshot.metrics.length !== 2 || snapshot.metrics.some(function (metric,i) { return metric.id !== ['received','completed'][i] || metric.unit !== 'работ' || metric.aggregation !== 'sum'; })) throw Error('Unexpected reference metric contract');
      return snapshot;
    }, mode:serverMode ? 'server' : 'local', timeoutMs:15000});
    var controls = [], releases = [], chart = null, stopped = false, current = null;
    var command = null, actionKey = null, actionRow = null, actionPending = false, actionDone = false;
    var demoCommands = new Map(), attempts = new Map();
    function el(id) { return root.querySelector('#' + id); }
    function listen(node, name, fn) { node.addEventListener(name, fn); releases.push(function () { node.removeEventListener(name, fn); }); }
    function node(tag, text, className) { var n = document.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; }
    function date(value) { return value.split('-').reverse().join('.'); }
    function number(value) { return value === null ? 'Нет данных' : window.dkFmt.num(value); }
    function initialQuery() {
      var params = new URLSearchParams(location.search), filters = {};
      ['region','service'].forEach(function (key) { var v = params.get(key); if (v) filters[key] = [v]; });
      var p = Number(params.get('page') || 1);
      return {filters:filters, period:params.get('period') === 'late' ? {from:'2026-10-11',to:'2026-10-20'} : null, page:Number.isSafeInteger(p) && p > 0 ? p : 1, pageSize:5};
    }
    var query = initialQuery();
    function context(q) {
      var values = ['region','service'].map(function (id) { return q.filters[id] && q.filters[id].length ? q.filters[id].join(', ') : id === 'region' ? 'Все города' : 'все службы'; });
      var period = q.period || {from:'2026-10-01',to:'2026-10-20'};
      return values.join(' · ') + ' · ' + date(period.from) + '–' + date(period.to);
    }
    function storeQuery(push) {
      var url = new URL(location.href);
      ['region','service'].forEach(function (id) { if (query.filters[id] && query.filters[id].length) url.searchParams.set(id,query.filters[id][0]); else url.searchParams.delete(id); });
      if (query.period) url.searchParams.set('period','late'); else url.searchParams.delete('period');
      if (query.page > 1) url.searchParams.set('page',String(query.page)); else url.searchParams.delete('page');
      if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](null,'',url.href);
    }
    function run(push) { if (stopped) return; detail.close(); storeQuery(push); return session.load(query); }
    function filter(id,value) { query.filters[id] = value ? [value] : []; query.page = 1; run(true); }
    var region = window.dkSelect(el('ref-region'), {label:'Город', mode:'single', options:['Москва','Казань','Пермь'].map(function (x) { return {value:x,name:x}; }), onChange:function (v) { filter('region',v); }});
    var service = window.dkSelect(el('ref-service'), {label:'Служба', mode:'single', options:['Водоснабжение','Теплоснабжение'].map(function (x) { return {value:x,name:x}; }), onChange:function (v) { filter('service',v); }});
    var period = window.dkSelect(el('ref-period'), {label:'Период', mode:'single', options:[{value:'all',name:'01–20 октября'},{value:'late',name:'11–20 октября'}], onChange:function (v) { query.period = v === 'late' ? {from:'2026-10-11',to:'2026-10-20'} : null; query.page = 1; run(true); }});
    controls.push(region,service,period);
    function syncControls() { region.set((query.filters.region || [])[0]); service.set((query.filters.service || [])[0]); period.set(query.period ? 'late' : 'all'); }
    function reset() { query = {filters:{},period:null,page:1,pageSize:5}; syncControls(); run(true); }
    var detail = window.dkModal(el('ref-detail'));
    function drawMetrics(view) {
      var box = el('ref-metrics'); box.replaceChildren();
      view.metrics.forEach(function (metric) {
        var total = view.totals[metric.id], tile = node('section',null,'dk-widget dk-widget--s dk-tile');
        tile.append(node('h2',metric.label + ', ' + metric.unit,'dk-tile__label'));
        var value = node('div',null,'dk-tile__row'); value.append(node('span',number(total.value),'dk-metric-lg')); tile.append(value);
        var coverage = total.observed === 0 ? 'Сведения отсутствуют во всех наблюдениях' : total.partial ? 'Неполные данные: сумма по ' + total.observed + ' из ' + total.total + ' наблюдений' : 'Все ' + total.total + ' наблюдений выбранного среза';
        tile.append(node('p',coverage,'dk-caption')); tile.dataset.metric = metric.id; box.append(tile);
      });
    }
    function drawRows(view) {
      var rows = el('ref-rows'); rows.replaceChildren();
      view.rows.forEach(function (row) {
        var tr = node('tr'); tr.dataset.id = row.id;
        var cell = node('td'), button = node('button',row.label,'dk-btn dk-btn--ghost ref-detail-link');
        button.type = 'button'; button.dataset.row = row.id; button.setAttribute('aria-label','Подробности: ' + row.label + ', ' + date(row.date)); cell.append(button); tr.append(cell);
        tr.append(node('td',date(row.date)));
        view.metrics.forEach(function (metric) { tr.append(node('td',number(row.values[metric.id]),'dk-td-num')); }); rows.append(tr);
      });
      var from = view.rows.length ? (view.query.page - 1) * view.query.pageSize + 1 : 0;
      el('ref-count').textContent = view.rows.length ? 'Наблюдения ' + from + '–' + (from + view.rows.length - 1) + ' из ' + view.rowCount : 'На этой странице наблюдений нет';
      el('ref-prev').disabled = view.query.page <= 1;
      el('ref-next').disabled = view.query.page * view.query.pageSize >= view.rowCount;
      el('ref-first').hidden = view.rows.length > 0 || view.rowCount === 0;
      el('ref-page-number').textContent = 'Страница ' + view.query.page + ' · всего ' + Math.max(1,Math.ceil(view.rowCount / view.query.pageSize));
    }
    function drawChart(view) {
      var partial = false;
      var spec = {type:'bar',label:'Поступившие и выполненные работы по дате поступления',unit:'работ',categories:view.series.map(function (point) { return date(point.date); }),series:view.metrics.map(function (metric) {
        return {name:metric.label,data:view.series.map(function (point) { var c = point.coverage[metric.id]; if (c.observed < c.total) { partial = true; return null; } return point.values[metric.id]; })};
      })};
      if (chart) chart.update(spec); else chart = window.dkChart(el('ref-chart'),spec);
      el('ref-chart-note').textContent = partial ? 'Столбец с неполными сведениями пропущен. Известные значения и отсутствие данных показаны в таблице; частичная сумма отмечена в KPI.' : 'Все наблюдения выбранного среза. Переключение страниц таблицы не меняет график и KPI.';
    }
    function render(snapshot) {
      if (stopped) return;
      current = snapshot;
      root.dataset.status = snapshot.status;
      var ready = snapshot.status === 'ready', busy = snapshot.status === 'loading';
      el('ref-content').hidden = !ready;
      el('ref-content').setAttribute('aria-busy',String(busy));
      el('ref-empty').hidden = snapshot.status !== 'empty';
      el('ref-retry').hidden = snapshot.status !== 'error';
      el('ref-export').disabled = !ready || !snapshot.view.rows.length;
      el('ref-refresh').disabled = busy;
      el('ref-context').textContent = context(query);
      el('ref-reset').hidden = !query.period && !Object.keys(query.filters).some(function (k) { return query.filters[k].length; });
      el('ref-status').textContent = busy ? 'Загрузка выбранного среза…' : snapshot.status === 'error' ? 'Не удалось получить данные. Выбранные условия сохранены.' : snapshot.status === 'empty' ? 'По выбранным условиям наблюдений нет.' : ready ? 'Данные обновлены.' : 'Загрузка данных…';
      var view = snapshot.view;
      if (view) el('ref-source').textContent = (view.source.kind === 'demo' ? 'Демонстрационные данные · ' : '') + view.source.label + ' · обновлено ' + new Date(view.source.updatedAt).toLocaleString('ru-RU',{timeZone:'UTC'}) + ' UTC';
      if (!ready) return;
      drawMetrics(view); drawRows(view); drawChart(view);
    }
    function openRow(id) {
      if (!current || !current.view) return;
      var row = current.view.rows.find(function (r) { return r.id === id; }); if (!row) return;
      if (command) command.abort(); command = null;
      var attemptId = current.view.source.id + ':' + row.id;
      if (!attempts.has(attemptId)) attempts.set(attemptId,{key:crypto.randomUUID(),done:false,message:''});
      var attempt = attempts.get(attemptId);
      actionRow = row; actionKey = attempt.key; actionPending = false; actionDone = attempt.done;
      el('ref-detail-title').textContent = row.label;
      var body = el('ref-detail-body'); body.replaceChildren(node('p','Дата поступления: ' + date(row.date)));
      current.view.metrics.forEach(function (metric) { body.append(node('p',metric.label + ': ' + number(row.values[metric.id]) + (row.values[metric.id] === null ? '' : ' ' + metric.unit)),node('p',metric.description,'dk-caption')); });
      body.append(node('p','Демо-поручение проверяет действие на учебных данных. В рабочую систему ничего не отправляется.','dk-caption'));
      el('ref-action').disabled = actionDone; el('ref-action-status').textContent = attempt.message;
      detail.open();
    }
    async function defaultAction(payload, signal) {
      if (!serverMode) {
        if (!demoCommands.has(payload.idempotencyKey)) demoCommands.set(payload.idempotencyKey,{id:'demo-'+payload.idempotencyKey,message:'Демонстрационное поручение создано для ' + actionRow.label + '. Сохранено только до закрытия страницы.'});
        return demoCommands.get(payload.idempotencyKey);
      }
      var response = await fetch('/api/tasks',{method:'POST',signal:signal,headers:{'Content-Type':'application/json','Idempotency-Key':payload.idempotencyKey},body:JSON.stringify({rowId:payload.rowId,sourceId:payload.sourceId})});
      if (!response.ok) throw Error('Command failed');
      return response.json();
    }
    async function act() {
      if (actionPending || actionDone || !actionRow || !current || !current.view) return;
      var key = actionKey, row = actionRow, controller = new AbortController(); command = controller;
      actionPending = true; el('ref-action').disabled = true; el('ref-action-status').textContent = 'Создаём демонстрационное поручение…';
      var abort;
      var cancelled = new Promise(function (_,reject) { abort = function () { reject(Error('Command cancelled')); }; controller.signal.addEventListener('abort',abort,{once:true}); });
      var timer = setTimeout(function () { controller.abort(); },15000);
      try {
        var sourceId = current.view.source.id;
        var result = await Promise.race([Promise.resolve().then(function () { return (options.onAction || defaultAction)({rowId:row.id,sourceId:sourceId,idempotencyKey:key},controller.signal); }),cancelled]);
        if (stopped || key !== actionKey || command !== controller || controller.signal.aborted) return;
        if (!result || typeof result.id !== 'string' || !result.id.trim() || typeof result.message !== 'string' || !result.message.trim()) throw Error('Invalid command result');
        actionDone = true; el('ref-action-status').textContent = result.message;
        var attempt = attempts.get(sourceId + ':' + row.id); attempt.done = true; attempt.message = el('ref-action-status').textContent;
      } catch (error) {
        if (!stopped && key === actionKey && command === controller) el('ref-action-status').textContent = 'Результат не подтверждён. Повторите действие: второе поручение не создастся.';
      } finally {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort',abort);
        if (!stopped && key === actionKey && command === controller) { actionPending = false; el('ref-action').disabled = actionDone; }
      }
    }
    listen(el('ref-rows'),'click',function (event) { var button = event.target.closest('[data-row]'); if (button) openRow(button.dataset.row); });
    listen(el('ref-action'),'click',act);
    listen(el('ref-refresh'),'click',function () { run(false); });
    listen(el('ref-retry'),'click',function () { session.retry(); });
    listen(el('ref-reset'),'click',reset); listen(el('ref-empty-reset'),'click',reset);
    listen(el('ref-prev'),'click',function () { query.page = Math.max(1,query.page-1); run(true); });
    listen(el('ref-next'),'click',function () { query.page += 1; run(true); });
    listen(el('ref-first'),'click',function () { query.page = 1; run(true); });
    listen(el('ref-export'),'click',function () {
      if (!current || !current.view) return;
      var view = current.view;
      window.dkExport.csv(view.rows.map(function (row) { return {label:row.label,date:row.date,received:row.values.received,completed:row.values.completed}; }),[{key:'label',label:'Город и служба'},{key:'date',label:'Дата поступления'},{key:'received',label:'Поступило, работ'},{key:'completed',label:'Выполнено, работ'}],'works-page-'+view.query.page);
    });
    listen(window,'popstate',function () { query = initialQuery(); syncControls(); run(false); });
    var unsubscribe = session.subscribe(render);
    var destroy = window.dkOwn(root,function () {
      stopped = true; unsubscribe(); session.destroy(); if (command) command.abort(); detail.close();
      releases.forEach(function (off) { off(); }); controls.forEach(function (control) { control.destroy(); });
      if (chart) chart.destroy(); root.referenceDashboard = null;
    });
    var api = {session:session,destroy:destroy}; root.referenceDashboard = api;
    syncControls(); run(false); return api;
  };
  window.addEventListener('DOMContentLoaded',function () { var root = document.getElementById('reference-dashboard'); if (root) window.referenceDashboard(root); });
})();
