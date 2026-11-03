/* Host adapter for the pinned reference API. No local data or task simulator. */
(function () {
  'use strict';
  window.referenceDashboard = function (root, options) {
    if (root.referenceDashboard) root.referenceDashboard.destroy();
    const $ = id => root.querySelector('#' + id);
    const node = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
    const date = value => value.split('-').reverse().join('.');
    const number = value => value === null ? 'Нет данных' : dkFmt.num(value);
    const releases = [], controllers = new Set(), attempts = new Map();
    let stopped = false, current = null, selection = null, returnPoint = null, waitingReturn = false;
    function on(target, event, callback) { target.addEventListener(event, callback); releases.push(() => target.removeEventListener(event, callback)); }
    function initialQuery() {
      const params = new URLSearchParams(location.search), filters = {};
      ['region', 'service'].forEach(id => { if (params.get(id)) filters[id] = [params.get(id)]; });
      const page = Number(params.get('page') || 1);
      return {filters, period:params.get('period') === 'late' ? {from:'2026-10-11',to:'2026-10-20'} : null, page:Number.isSafeInteger(page) && page > 0 ? page : 1, pageSize:5};
    }
    let query = initialQuery();
    const session = dkDashboard.createSession({mode:'server', timeoutMs:15000,
      load:async request => {
        const snapshot = await dkDashboard.fetchSource('/api/dashboard', {mode:'server'})(request);
        if (!snapshot.metrics || snapshot.metrics.length !== 2 || snapshot.metrics.some((m,i) => m.id !== ['received','completed'][i] || m.unit !== 'работ' || m.aggregation !== 'sum')) throw Error('Unexpected metric contract');
        return snapshot;
      }
    });
    const modal = dkModal($('ref-detail'));
    const table = options && options.table || dkTable($('ref-table')); 
    function storeQuery(push) {
      const url = new URL(location.href);
      ['region','service'].forEach(id => { const v = query.filters[id]; if (v && v.length) url.searchParams.set(id,v[0]); else url.searchParams.delete(id); });
      if (query.period) url.searchParams.set('period','late'); else url.searchParams.delete('period');
      if (query.page > 1) url.searchParams.set('page',String(query.page)); else url.searchParams.delete('page');
      if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](null,'',url.href);
    }
    function run(push) { if (stopped) return; modal.close(); storeQuery(push); return session.load(query); }
    function filter(id, value) { query.filters[id] = value ? [value] : []; query.page = 1; run(true); }
    const region = dkSelect($('ref-region'), {label:'Город',mode:'single',options:['Москва','Казань','Пермь'].map(name => ({value:name,name})),onChange:value => filter('region',value)});
    const service = dkSelect($('ref-service'), {label:'Служба',mode:'single',options:['Водоснабжение','Теплоснабжение'].map(name => ({value:name,name})),onChange:value => filter('service',value)});
    const period = dkSelect($('ref-period'), {label:'Период',mode:'single',options:[{value:'all',name:'01–20 октября'},{value:'late',name:'11–20 октября'}],onChange:value => { query.period = value === 'late' ? {from:'2026-10-11',to:'2026-10-20'} : null; query.page = 1; run(true); }});
    function syncControls() { region.set((query.filters.region || [])[0]); service.set((query.filters.service || [])[0]); period.set(query.period ? 'late' : 'all'); }
    function reset() { query = {filters:{},period:null,page:1,pageSize:5}; syncControls(); run(true); }
    function context() {
      const selected = ['region','service'].map(id => (query.filters[id] || []).join(', ') || (id === 'region' ? 'Все города' : 'все службы'));
      const p = query.period || {from:'2026-10-01',to:'2026-10-20'};
      return selected.join(' · ') + ' · ' + date(p.from) + '–' + date(p.to);
    }
    function attemptFor(sourceId, rowId) {
      const id = sourceId + ':' + rowId;
      if (!attempts.has(id)) attempts.set(id, {key:crypto.randomUUID(), state:'idle', message:''});
      return attempts.get(id);
    }
    function drawRows(view) {
      const rows = $('ref-rows'); rows.replaceChildren();
      view.rows.forEach(row => {
        const tr = node('tr'); tr.dataset.id = row.id;
        const name = node('td'), open = node('button',row.label,'dk-btn dk-btn--ghost ops-row-link');
        open.type = 'button'; open.dataset.row = row.id; open.dataset.trigger = 'details';
        open.setAttribute('aria-label','Подробности: ' + row.label + ', ' + date(row.date)); name.append(open); tr.append(name);
        tr.append(node('td',date(row.date)));
        view.metrics.forEach(metric => tr.append(node('td',number(row.values[metric.id]),'dk-td-num')));
        const cell = node('td'), action = node('button','Поручение','dk-btn');
        action.type = 'button'; action.dataset.row = row.id; action.dataset.trigger = 'action';
        action.setAttribute('aria-label','Учебное поручение: ' + row.label + ', ' + date(row.date));
        const attempt = attempts.get(view.source.id + ':' + row.id);
        if (attempt && attempt.state === 'done') action.textContent = 'Поручение создано';
        else if (attempt && attempt.state === 'pending') action.textContent = 'Отправляется…';
        cell.append(action); tr.append(cell); rows.append(tr);
      });
      $('ref-count').textContent = 'Город × служба × дата поступления · ' + dkFmt.num(view.rowCount) + ' наблюдений';
      $('ref-prev').disabled = view.query.page <= 1;
      $('ref-next').disabled = view.query.page * view.query.pageSize >= view.rowCount;
      $('ref-first').hidden = view.rows.length > 0 || view.rowCount === 0;
      $('ref-page-number').textContent = 'Страница ' + dkFmt.num(view.query.page) + ' из ' + dkFmt.num(Math.max(1,Math.ceil(view.rowCount/view.query.pageSize)));
      if (!view.rows.length) { const tr = node('tr'), td = node('td','На этой странице наблюдений нет'); td.colSpan = 5; tr.append(td); rows.append(tr); }
    }
    function drawMetrics(view) {
      const box = $('ref-metrics'); box.replaceChildren();
      view.metrics.forEach(metric => {
        const total = view.totals[metric.id], tile = node('section',null,'dk-widget dk-widget--s dk-tile dk-tile--compact'); tile.dataset.metric = metric.id;
        tile.append(node('h2',metric.label + (metric.id === 'completed' ? ' из поступивших' : '') + ', ' + metric.unit,'dk-tile__label'));
        const value = node('div',null,'dk-tile__row'); value.append(node('span',number(total.value),'dk-metric-lg')); tile.append(value);
        if (total.observed === 0) tile.append(node('p','Нет данных','dk-caption'));
        else if (total.partial) tile.append(node('p','Частичные данные · ' + dkFmt.num(total.observed) + ' из ' + dkFmt.num(total.total) + ' наблюдений','dk-caption'));
        box.append(tile);
      });
    }
    function render(snapshot) {
      if (stopped) return;
      current = snapshot; root.dataset.status = snapshot.status;
      const ready = snapshot.status === 'ready', busy = snapshot.status === 'loading';
      $('ref-content').hidden = !ready;
      $('ref-content').setAttribute('aria-busy',String(busy));
      $('ref-empty').hidden = snapshot.status !== 'empty';
      $('ref-retry').hidden = snapshot.status !== 'error';
      $('ref-refresh').disabled = busy;
      $('ref-export').disabled = !ready || !snapshot.view.rows.length;
      $('ref-context').textContent = context();
      $('ref-reset').hidden = !query.period && !Object.values(query.filters).some(v => v.length);
      $('ref-feedback').classList.toggle('dk-vh',ready);
      $('ref-status').textContent = busy ? 'Загрузка выбранного среза…' : snapshot.status === 'error' ? 'Не удалось загрузить наблюдения. Фильтры сохранены.' : snapshot.status === 'empty' ? 'По выбранным условиям наблюдений нет.' : ready ? 'Данные обновлены.' : 'Загрузка данных…';
      if (snapshot.view) {
        const source = snapshot.view.source;
        $('ref-source').textContent = (source.kind === 'demo' ? 'Учебные данные · ' : '') + source.label + ' · ' + new Date(source.updatedAt).toLocaleString('ru-RU',{timeZone:'UTC'}) + ' UTC';
      }
      if (!ready) { $('ref-rows').replaceChildren(); $('ref-metrics').replaceChildren(); return; }
      drawRows(snapshot.view); drawMetrics(snapshot.view);
      if (waitingReturn && !$('ref-detail').open) restoreReturn();
    }
    function syncAction() {
      if (!selection) return;
      const attempt = attemptFor(selection.source.id,selection.row.id), action = $('ref-action'), status = $('ref-action-status');
      const allowed = selection.source.kind === 'demo';
      action.disabled = !allowed || attempt.state === 'pending' || attempt.state === 'done';
      action.textContent = attempt.state === 'pending' ? 'Создаём поручение…' : attempt.state === 'error' ? 'Повторить создание' : attempt.state === 'done' ? 'Поручение создано' : 'Создать учебное поручение';
      status.textContent = allowed ? attempt.message : 'Учебное поручение недоступно для этого источника';
      status.hidden = !status.textContent;
    }
    function openRow(button) {
      if (!current || !current.view || current.status !== 'ready') return;
      const row = current.view.rows.find(row => row.id === button.dataset.row); if (!row) return;
      button.focus({preventScroll:true});
      returnPoint = {row:row.id, trigger:button.dataset.trigger, scroll:window.scrollY, tableScroll:$('ref-table-scroll').scrollTop};
      selection = {row,source:current.view.source}; waitingReturn = false;
      $('ref-detail-title').textContent = row.label;
      const body = $('ref-detail-body'); body.replaceChildren(node('p','Дата поступления · ' + date(row.date),'dk-caption'));
      const values = node('div',null,'dk-modal__metrics');
      current.view.metrics.forEach(metric => {
        const card = node('section',null,'dk-tile'); card.append(node('h3',metric.label + (metric.id === 'completed' ? ' из поступивших' : '') + ', ' + metric.unit,'dk-tile__label'),node('p',number(row.values[metric.id]),'dk-metric-lg')); values.append(card);
      }); body.append(values);
      const method = node('details',null,'ops-method'); method.append(node('summary','Показатели и учебное поручение'));
      method.append(node('p','Одна строка — город × служба × дата поступления, агрегированное наблюдение. Это не отдельный инцидент.'));
      current.view.metrics.forEach(metric => method.append(node('p',metric.description)));
      method.append(node('p','Поручение создаётся в учебном API и хранится только в памяти сервера до его перезапуска. Рабочая система не подключена.'));
      method.append(node('p','Источник: ' + selection.source.label + ' · запись ' + row.id)); body.append(method);
      syncAction(); modal.open();
    }
    async function act() {
      if (!selection || selection.source.kind !== 'demo') return;
      const chosen = selection, attempt = attemptFor(chosen.source.id,chosen.row.id);
      if (attempt.state === 'pending' || attempt.state === 'done') return;
      const controller = new AbortController(); controllers.add(controller);
      attempt.state = 'pending'; attempt.message = 'Отправляем учебное поручение…'; syncAction();
      const timer = setTimeout(() => controller.abort(),15000);
      try {
        const response = await fetch('/api/tasks', {method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','Idempotency-Key':attempt.key},body:JSON.stringify({rowId:chosen.row.id,sourceId:chosen.source.id})});
        if (!response.ok) throw Error('Command failed');
        const result = await response.json();
        if (!result || typeof result.id !== 'string' || !result.id.trim() || typeof result.message !== 'string' || !result.message.trim()) throw Error('Invalid result');
        if (stopped) return;
        attempt.state = 'done'; attempt.message = result.message;
        if (selection && selection.row.id === chosen.row.id && selection.source.id === chosen.source.id) syncAction();
        // Confirmed write: always reread the current server query, keeping detail feedback open.
        await session.load(query);
      } catch (error) {
        if (!stopped) { attempt.state = 'error'; attempt.message = 'Результат не подтверждён. Повторите создание с тем же ключом: второе поручение не создастся.'; }
      } finally {
        clearTimeout(timer); controllers.delete(controller);
        if (!stopped && selection && selection.row.id === chosen.row.id && selection.source.id === chosen.source.id) syncAction();
      }
    }
    function restoreReturn() {
      if (!returnPoint || stopped) return;
      const point = returnPoint;
      const target = Array.from($('ref-rows').querySelectorAll('[data-row]')).find(n => n.dataset.row === point.row && n.dataset.trigger === point.trigger);
      waitingReturn = !target && current && current.status === 'loading';
      if (target) { target.focus({preventScroll:true}); $('ref-table-scroll').scrollTop = point.tableScroll; window.scrollTo(0,point.scroll); }
      else $('ref-refresh').focus({preventScroll:true});
    }
    on($('ref-detail'),'close',restoreReturn);
    on($('ref-rows'),'click',event => { const button = event.target.closest('[data-row]'); if (button) openRow(button); });
    on($('ref-action'),'click',act);
    on($('ref-refresh'),'click',() => run(false)); on($('ref-retry'),'click',() => session.retry());
    on($('ref-reset'),'click',reset); on($('ref-empty-reset'),'click',reset);
    on($('ref-prev'),'click',() => { query.page = Math.max(1,query.page-1); run(true); });
    on($('ref-next'),'click',() => { query.page += 1; run(true); });
    on($('ref-first'),'click',() => { query.page = 1; run(true); });
    on($('ref-export'),'click',() => {
      if (!current || current.status !== 'ready') return;
      const view = current.view;
      dkExport.csv(view.rows.map(row => ({label:row.label,date:row.date,received:row.values.received,completed:row.values.completed === null ? 'Нет данных' : row.values.completed})),[{key:'label',label:'Город и служба'},{key:'date',label:'Дата поступления'},{key:'received',label:'Поступило, работ'},{key:'completed',label:'Выполнено из поступивших, работ'}],'works-page-'+view.query.page);
    });
    on(window,'popstate',() => { query = initialQuery(); syncControls(); run(false); });
    const unsubscribe = session.subscribe(render);
    function destroy() { if (stopped) return; stopped = true; unsubscribe(); session.destroy(); controllers.forEach(c => c.abort()); modal.close(); table.destroy(); [region,service,period].forEach(c => c.destroy()); releases.forEach(off => off()); root.referenceDashboard = null; }
    root.referenceDashboard = {session,destroy}; syncControls(); run(false); return root.referenceDashboard;
  };
})();
