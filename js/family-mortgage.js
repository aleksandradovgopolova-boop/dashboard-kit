/* Host for the small teaching dataset. Business formulas live in
   family-mortgage-data.js; components only present the selected view. */
(function () {
  'use strict';
  var STATUS = {crit:'Сильно отстаёт', high:'Отстаёт', calm:'По плану', missing:'Нет данных'};
  window.familyMortgageDashboard = function (root, options) {
    options = options || {};
    if (root.familyMortgageDashboard) root.familyMortgageDashboard.destroy();
    var snapshot = null, view = null, stopped = false, controls = [], charts = [], releases = [];
    var map = null, mapFiles = null, mapPending = false, mapFailed = false, mapAttempt = 0;
    var mapAbort = new AbortController(), searchTimer = null;
    var useURL = options.url !== false;
    function el(id) { return root.querySelector('#' + id); }
    function node(tag, text, cls) { var n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; }
    function text(id, value) { el(id).textContent = value; }
    function listen(target, name, fn) { target.addEventListener(name, fn); releases.push(function () { target.removeEventListener(name, fn); }); }
    function num(value, places) { return value == null ? 'Нет данных' : dkFmt.num(value, places || 0); }
    function pct(value) { return value == null ? 'Нет данных' : dkFmt.pct(value, 1); }
    function billion(value) { return value == null ? 'Нет данных' : dkFmt.num(value / 1000, 2); }
    function date(value) { return value.split('-').reverse().join('.'); }
    function defaults() { return {district:'all', region:'all', month:'all', search:'', page:1, pageSize:12, sort:'lag'}; }
    function readQuery() {
      var q = defaults(); if (!useURL) return q;
      var params = new URLSearchParams(location.search);
      ['district','region','month','search','sort'].forEach(function (key) { if (params.has('fm-' + key)) q[key] = params.get('fm-' + key); });
      var page = Number(params.get('fm-page') || 1);
      q.page = Number.isSafeInteger(page) && page > 0 ? page : 1;
      q.search = q.search.slice(0,100);
      if (['lag','name','issued','volume'].indexOf(q.sort) < 0) q.sort = 'lag';
      return q;
    }
    var query = readQuery(), detail = dkModal(el('fm-detail')), detailCSV = [], detailFile = '';
    function storeQuery(push) {
      if (!useURL) return;
      var url = new URL(location.href), base = defaults();
      ['district','region','month','search','sort','page'].forEach(function (key) {
        if (query[key] === base[key]) url.searchParams.delete('fm-' + key);
        else url.searchParams.set('fm-' + key, String(query[key]));
      });
      if (url.href !== location.href) history[push ? 'pushState' : 'replaceState'](null,'',url.href);
    }
    function clearCharts() { charts.forEach(function (chart) { chart.destroy(); }); charts = []; }
    function chart(id, config) { charts.push(dkChart(el(id), config)); }
    function syncControls() {
      if (controls.length) { controls[0].set(query.month); controls[1].set(query.district); controls[2].set(query.sort); }
      if (controls[3]) controls[3].set(query.region);
      var base = defaults();
      el('fm-reset').hidden = ['month','district','region','search','sort','page'].every(function (key) { return query[key] === base[key]; });
    }
    function setQuery(patch, push) {
      if (stopped) return;
      clearTimeout(searchTimer);
      var next = Object.assign({}, query, patch);
      if (['district','region','month','search','sort'].some(function (key) { return next[key] !== query[key]; })) next.page = 1;
      // Validate the whole query before changing the URL or any visible value.
      var nextView = snapshot ? familyMortgageData.select(snapshot,next) : null;
      query = nextView ? nextView.query : next;
      detail.close(); syncControls(); storeQuery(push !== false);
      if (nextView) render(nextView);
    }
    function reset() { setQuery(defaults()); }
    function mountControls() {
      controls.forEach(function (control) { control.destroy(); });
      var choices = familyMortgageData.select(snapshot,defaults()).options;
      var months = [{value:'all',name:'Весь период'}].concat(choices.months.map(function (m) { return {value:m.id,name:m.label}; }));
      var districts = [{value:'all',name:'Все округа'}].concat(choices.districts.map(function (d) { return {value:d.id,name:d.name}; }));
      // A stale deep link must show its value and an empty result, never silently all.
      if (!months.some(function (m) { return m.value === query.month; })) months.push({value:query.month,name:'Период: ' + query.month});
      if (!districts.some(function (d) { return d.value === query.district; })) districts.push({value:query.district,name:'Округ: ' + query.district});
      controls = [
        dkSelect(el('fm-month-filter'),{label:'Период',defaultValue:'all',value:query.month,options:months,onChange:function (v) { setQuery({month:v || 'all'}); }}),
        dkSelect(el('fm-district-filter'),{label:'Федеральный округ',defaultValue:'all',value:query.district,options:districts,onChange:function (v) { setQuery({district:v || 'all',region:'all',search:''}); }}),
        dkSelect(el('fm-sort'),{label:'Сортировка',defaultValue:'lag',value:query.sort,options:[{value:'lag',name:'Недовыполнение ↓'},{value:'name',name:'Название А–Я'},{value:'issued',name:'Выдано ↓'},{value:'volume',name:'Объём ↓'}],onChange:function (v) { setQuery({sort:v || 'lag'}); }})
      ];
      var regions = familyMortgageData.select(snapshot,defaults()).regions.slice().sort(function (a,b) { return a.name.localeCompare(b.name,'ru'); });
      var regionOptions = [{value:'all',name:'Все регионы'}].concat(regions.map(function (r) { return {value:r.id,name:r.name}; }));
      if (!regionOptions.some(function (r) { return r.value === query.region; })) regionOptions.push({value:query.region,name:'Регион: ' + query.region});
      controls.push(dkSelect(el('fm-region-filter'),{label:'Регион',defaultValue:'all',value:query.region,search:true,options:regionOptions,
        onChange:function (value) {
          var region = regions.find(function (r) { return r.id === value; });
          setQuery({region:value || 'all',search:'',district:region && query.district !== 'all' && region.fd !== query.district ? 'all' : query.district});
        }}));
      syncControls();
    }
    function addCell(row, value, cls) { var cell = node('td',value,cls); row.append(cell); return cell; }
    function openRegion(id) {
      if (!view) return;
      var region = view.regions.find(function (r) { return r.id === id; });
      if (!region) { text('fm-status','Регион не соответствует выбранным фильтрам. Измените округ или поиск, чтобы открыть его показатели.'); return; }
      text('fm-detail-title',region.name);
      text('fm-detail-context',region.fdName + ' федеральный округ');
      var body = el('fm-detail-body'); body.replaceChildren();
      var updated = new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short'}).format(new Date(view.source.updatedAt));
      text('fm-detail-period','Период: ' + date(view.period.from) + '–' + date(view.period.to));
      body.append(node('p','Обновлено: ' + updated,'dk-caption'));
      var partial = Object.keys(region.coverage).some(function (key) { return region.coverage[key].partial; });
      if (partial) body.append(node('p','Часть показателей отсутствует. «Нет данных» не означает нулевое значение.','dk-caption'));
      var metrics = node('div',null,'dk-grid dk-modal__metrics'); metrics.id = 'fm-detail-kpis';
      function metric(label,value,context,meaning,unit) {
        var card = node('section',null,'dk-tile dk-tile--compact');
        var valueRow = node('div',null,'dk-tile__row'); valueRow.append(node('span',value,'dk-metric-lg'));
        if (unit) valueRow.append(node('span',unit,'dk-tile__unit'));
        card.append(node('div',label,'dk-tile__label'),valueRow);
        if (context) {
          var note = node('div',context,'dk-caption');
          if (meaning) note.style.color = dkMeaning(meaning,'text');
          card.append(note);
        }
        metrics.append(card);
      }
      metric('Выполнение плана',pct(region.planPct),STATUS[region.status],region.status === 'missing' ? 'nodata' : region.status);
      metric('Выдано кредитов',num(region.issued),'План: ' + num(region.issuedPlan));
      metric('Объём выдач',billion(region.volume),null,null,'млрд ₽');
      metric('Средняя ставка',pct(region.rate));
      body.append(metrics,node('p','Рассмотрено заявок: ' + num(region.applied) + ' · Одобрено: ' + num(region.approved) + ' · Одобрение: ' + pct(region.approval),'dk-caption'));
      var wrap = node('div',null,'dk-tablewrap'); wrap.tabIndex = 0; wrap.setAttribute('role','region'); wrap.setAttribute('aria-label','Помесячные показатели региона');
      var table = node('table',null,'dk-table dk-table--ruled'); table.append(node('caption','Выдачи по месяцам'));
      var head = node('thead'), header = node('tr');
      ['Месяц','Факт, кредитов','План, кредитов','Выполнение, %','Отклонение, кредитов'].forEach(function (label,i) { var cell = node('th',label,i ? 'dk-td-num' : null); cell.scope = 'col'; cell.dataset.sortable = String(i); header.append(cell); }); head.append(header); table.append(head);
      var rows = node('tbody'); region.monthly.forEach(function (m) {
        var row = node('tr'); row.dataset.month = m.month;
        addCell(row,m.label).dataset.sort = m.month;
        addCell(row,num(m.issued),'dk-td-num').dataset.sort = m.issued == null ? '' : String(m.issued);
        addCell(row,num(m.issuedPlan),'dk-td-num').dataset.sort = m.issuedPlan == null ? '' : String(m.issuedPlan);
        var completion = addCell(row,null,'dk-td-num'); completion.dataset.sort = m.planPct == null ? '' : String(m.planPct);
        var progress = node('div',null,'dk-progress');
        if (m.planPct != null) {
          var track = node('span',null,'dk-progress__track');
          track.setAttribute('role','progressbar'); track.setAttribute('aria-label','Выполнение плана: ' + m.label);
          track.setAttribute('aria-valuemin','0'); track.setAttribute('aria-valuemax','100');
          track.setAttribute('aria-valuenow',String(Math.max(0,Math.min(100,m.planPct))));
          track.setAttribute('aria-valuetext',pct(m.planPct) + '; цель — 100% плана');
          var fill = node('span',null,'dk-progress__fill');
          fill.style.width = Math.max(0,Math.min(100,m.planPct)) + '%'; fill.style.setProperty('--accent',dkMeaning(m.status === 'missing' ? 'nodata' : m.status,'fill'));
          track.append(fill); progress.append(track);
        }
        progress.append(node('span',pct(m.planPct),'dk-progress__value')); completion.append(progress);
        var delta = m.issued == null || m.issuedPlan == null ? null : m.issued - m.issuedPlan;
        var deltaCell = addCell(row,null,'dk-td-num'); deltaCell.dataset.sort = delta == null ? '' : String(delta);
        var status = node('span',null,'dk-status' + (delta < 0 || delta > 0 ? ' dk-status--' + (delta < 0 ? 'crit' : 'calm') : ''));
        if (delta != null) status.append(dkIcon.el(delta < 0 ? 'arrow-down' : delta > 0 ? 'arrow-up' : 'minus'));
        status.append(node('span',delta == null ? 'Нет данных' : (delta > 0 ? '+' : '') + num(delta))); deltaCell.append(status); rows.append(row);
      });
      table.append(rows); wrap.append(table);
      dkTable(table); header.firstChild.setAttribute('aria-sort','ascending');
      var note = node('div',null,'dk-banner'); note.append(dkIcon.el('info-circle'),node('span','Источник: ' + view.source.label + '. Отклонение = факт − план; выполнение = факт / план × 100%. Полоса ограничена целью 100%, подпись показывает точное выполнение. Сравнение не устанавливает причины отклонений.'));
      if (region.monthly.length) body.append(wrap);
      else body.append(node('div','За выбранный период помесячных данных нет.','dk-empty'));
      body.append(note);
      el('fm-detail-export').disabled = !region.monthly.length;
      detailCSV = region.monthly.map(function (m) { return {region:region.name,month:m.month,issued:m.issued,plan:m.issuedPlan,planPct:m.planPct,volume:m.volume,source:view.source.label,updatedAt:view.source.updatedAt}; });
      detailFile = 'family-mortgage-' + region.id + '-' + view.period.from + '-' + view.period.to;
      detail.open();
    }
    function renderRows(v) {
      var body = el('fm-tbody'); body.replaceChildren();
      v.rows.forEach(function (r) {
        var row = node('tr'), first = node('td');
        var button = node('button',r.name,'dk-link fm-region-link'); button.type = 'button'; button.dataset.region = r.id;
        first.append(button); row.append(first);
        var district = node('abbr',r.fd);
        district.title = r.fdName + ' федеральный округ';
        addCell(row,null).append(district);
        addCell(row,num(r.issued),'dk-td-num'); addCell(row,billion(r.volume),'dk-td-num');
        addCell(row,pct(r.planPct),'dk-td-num'); addCell(row,pct(r.rate),'dk-td-num');
        var cell = addCell(row,null);
        var status = node('span',null,'dk-status' + (r.status === 'missing' ? '' : ' dk-status--' + r.status));
        var icon = {crit:'alert-circle',high:'clock',calm:'circle-check',missing:'minus'}[r.status];
        status.append(dkIcon.el(icon),node('span',STATUS[r.status]));
        cell.append(status);
        // Card-mode labels remain explicit when the table header is hidden on mobile.
        Array.from(row.children).forEach(function (td,i) { td.dataset.label = ['Регион','ФО','Выдано','Объём, млрд ₽','План, %','Ставка, %','Статус'][i]; });
        body.append(row);
      });
      if (!v.rows.length) { var empty = node('tr'); var cell = addCell(empty,'На этой странице регионов нет. Перейдите на первую.'); cell.colSpan = 7; body.append(empty); }
      text('fm-page-number',query.page + '/' + v.pageCount);
      text('fm-page-announcement','Страница ' + query.page + ' из ' + v.pageCount);
      el('fm-prev').disabled = query.page <= 1;
      el('fm-next').disabled = query.page >= v.pageCount;
      el('fm-first').hidden = !!v.rows.length;
    }
    function renderMap() {
      if (stopped || !view || !view.rowCount) return;
      if (mapFiles) {
        var values = {}; familyMortgageData.select(snapshot,{month:query.month}).regions.forEach(function (r) { values[r.id] = r.lag; });
        var scope = view.regions.map(function (r) { return r.id; });
        if (map) map.update({values:values,scope:scope});
        else map = dkMap(el('fm-map'),{topo:mapFiles[0],object:'ru89',tiles:mapFiles[1],values:values,scope:scope,
          min:0,max:100,steps:[0,20],palette:'risk',
          classify:function (lag) { return lag >= 20 ? 2 : lag > 0 ? 1 : 0; },
          legendLabels:['По плану','Отстаёт','Сильно отстаёт'],legendFilter:true,legendCounts:true,legendPosition:'top',appearance:'glass',legendUnit:'',
          controls:el('fm-map-controls'),unit:'п.п. недовыполнения плана',onSelect:openRegion});
        el('fm-map').dataset.ready = 'true'; el('fm-map-widget').setAttribute('aria-busy','false');
        return;
      }
      if (mapPending || mapFailed) return;
      mapPending = true; el('fm-map-widget').setAttribute('aria-busy','true');
      var attempt = ++mapAttempt;
      var timeout = setTimeout(function () {
        if (stopped || attempt !== mapAttempt || !mapPending) return;
        mapAbort.abort(); mapAttempt++; mapPending = false; mapFailed = true; mapError();
      },15000);
      Promise.all(['data/regions.topojson','data/regions-tiles.json'].map(function (url) {
        return fetch(url,{signal:mapAbort.signal}).then(function (r) { if (!r.ok) throw Error('Map unavailable'); return r.json(); });
      })).then(function (files) {
        if (stopped || attempt !== mapAttempt) return;
        mapFiles = files; mapPending = false; renderMap();
      }).catch(function () {
        if (stopped || attempt !== mapAttempt) return;
        mapPending = false; mapFailed = true; mapError();
      }).finally(function () { clearTimeout(timeout); });
    }
    function mapError() {
      el('fm-map-widget').setAttribute('aria-busy','false');
      var retry = node('button','Повторить загрузку карты','dk-btn'); retry.type = 'button'; retry.dataset.mapRetry = 'true';
      el('fm-map').replaceChildren(node('p','Карта недоступна. Регион можно открыть в рейтинге или таблице.','dk-caption'),retry);
    }
    function render(v) {
      view = v; query = v.query;
      clearCharts();
      root.dataset.status = v.rowCount ? 'ready' : 'empty';
      el('fm-content').hidden = !v.rowCount; el('fm-empty').hidden = !!v.rowCount;
      el('fm-content').setAttribute('aria-busy','false'); el('fm-retry').hidden = true;
      el('fm-export').disabled = !v.rowCount;
      text('fm-status','');
      if (!v.rowCount) { if (map) map.setScope([]); return; }
      var k = v.kpis, c = v.counts;
      text('fm-hero-n',num(c.behind)); text('fm-hero-total','из ' + num(c.total));
      text('fm-k-high',num(c.crit)); text('fm-k-medium',num(c.high)); text('fm-k-low',num(c.calm));
      var incomplete = Object.keys(k.coverage).some(function (key) { return k.coverage[key].partial; });
      text('fm-coverage',(c.missing ? 'Без оценки выполнения: ' + c.missing + ' регионов (нет полного факта/плана или план равен нулю). Они не включены в цветную полосу. ' : '') + (incomplete ? 'Для показателей с неполным покрытием показано «Нет данных».' : ''));
      el('fm-hero').style.setProperty('--accent',dkMeaning(c.crit ? 'crit' : c.high ? 'high' : c.missing ? 'nodata' : 'calm','text'));
      [['high',c.crit],['medium',c.high],['low',c.calm]].forEach(function (pair) { el('fm-seg-' + pair[0]).style.setProperty('--share',pair[1]); });
      el('fm-split').setAttribute('aria-label','Сильно отстают: ' + c.crit + ', отстают: ' + c.high + ', по плану: ' + c.calm + ', нет данных: ' + c.missing);
      el('fm-hero').setAttribute('aria-busy','false');
      text('fm-planpct',pct(k.planPct)); text('fm-issued',num(k.issued)); text('fm-volume',billion(k.volume)); text('fm-rate',pct(k.rate)); text('fm-approval',pct(k.approval));
      var b = k.budget;
      text('fm-bud-spent',billion(b.spent)); text('fm-bud-pct',b.pct == null ? 'Нет данных о выполнении' : pct(b.pct) + ' плана');
      text('fm-bud-s2',billion(b.spent)); text('fm-bud-plan',billion(b.plan)); text('fm-bud-limit',billion(b.limit));
      var hasScale = b.limit != null && b.limit > 0 && b.spent != null && b.plan != null;
      el('fm-bud-bar').hidden = !hasScale;
      if (hasScale) { el('fm-bud-fill').style.width = Math.min(100,b.spent / b.limit * 100) + '%'; el('fm-bud-target').style.left = Math.min(100,b.plan / b.limit * 100) + '%'; }
      el('fm-bud-bar').setAttribute('aria-label','Освоено ' + billion(b.spent) + ' млрд рублей, план ' + billion(b.plan) + ', лимит ' + billion(b.limit) + '.');
      var categories = v.monthly.map(function (m) { return m.label; });
      chart('fm-line',{type:'area',palette:'graphite',label:'Выдано кредитов по месяцам',categories:categories,series:[{name:'Факт',data:v.monthly.map(function (m) { return m.issued; })},{name:'План',reference:true,data:v.monthly.map(function (m) { return m.issuedPlan; })}]});
      chart('fm-demand',{type:'bar',palette:'graphite',label:'Рассмотрено и одобрено заявок за выбранные месяцы',categories:categories,series:[{name:'Рассмотрено',data:v.monthly.map(function (m) { return m.applied; })},{name:'Одобрено',data:v.monthly.map(function (m) { return m.approved; })}]});
      var ranked = v.regions.filter(function (r) { return r.lag != null && r.lag > 0; }).sort(function (a,b) { return b.lag - a.lag || a.name.localeCompare(b.name,'ru'); });
      var rank = el('fm-rank'); rank.replaceChildren();
      var head = node('div',null,'dk-rank__head'); head.append(node('span','Регион','dk-overline'),node('span','Недовыполнение, п.п.','dk-overline')); rank.append(head);
      var rankScale = Math.max(25,Math.ceil((ranked[0] ? ranked[0].lag : 0)/5)*5);
      ranked.slice(0,10).forEach(function (r,i) {
        var row = node('button',null,'dk-rank__row'); row.type = 'button'; row.dataset.region = r.id;
        var val = node('span',num(r.lag,1),'dk-rank__v'); val.style.setProperty('--accent',dkMeaning(r.status,'text'));
        var meter = node('span',null,'dk-rank__meter'); meter.setAttribute('aria-hidden','true');
        var bar = node('span'); bar.style.setProperty('--value',Math.max(0,Math.min(100,r.lag / rankScale * 100)) + '%'); bar.style.setProperty('--fill',dkMeaning(r.status,'fill')); meter.append(bar);
        row.append(node('span',String(i + 1).padStart(2,'0'),'dk-rank__i'),node('span',r.name,'dk-rank__name'),meter,val); rank.append(row);
      });
      if (!ranked.length) rank.append(node('p',c.missing ? 'В регионах с полными данными отставания нет.' : 'Все выбранные регионы выполнили план.','dk-caption'));
      renderRows(v); renderMap(); el('fm-table-widget').setAttribute('aria-busy','false');
    }
    function exportSlice() {
      if (!view || !view.rowCount) return;
      var rows = view.regions.map(function (r) { return {source:view.source.label,kind:'demo',updatedAt:view.source.updatedAt,from:view.period.from,to:view.period.to,region:r.name,district:r.fdName,issued:r.issued,plan:r.issuedPlan,volume:r.volume,rate:r.rate,planPct:r.planPct,lag:r.lag,applied:r.applied,approved:r.approved,approval:r.approval,status:STATUS[r.status]}; });
      dkExport.csv(rows,[['source','Источник'],['kind','Тип данных'],['updatedAt','Версия источника'],['from','Период с'],['to','Период по'],['region','Регион'],['district','Округ'],['issued','Выдано кредитов'],['plan','План кредитов'],['volume','Объём, млн ₽'],['rate','Ставка, %'],['planPct','Выполнение плана, %'],['lag','Недовыполнение, п.п.'],['applied','Рассмотрено заявок'],['approved','Одобрено заявок'],['approval','Одобрено / рассмотрено, %'],['status','Статус']].map(function (c) { return {key:c[0],label:c[1]}; }),'family-mortgage-demo-' + view.period.from + '-' + view.period.to);
      text('fm-status','CSV подготовлен: ' + view.rowCount + ' регионов.');
    }
    var loader = options.load || dkDashboard.fetchSource('data/family-mortgage-observations.json');
    var session = dkDashboard.createSession({timeoutMs:15000,load:async function (request) {
      var loaded = familyMortgageData.validate(await loader(request));
      if (!request.signal.aborted && !stopped) snapshot = loaded;
      return loaded;
    }});
    var unsubscribe = session.subscribe(function (state) {
      if (stopped) return;
      loadingState(state.status === 'loading' || state.status === 'idle');
      if (state.status === 'ready' || state.status === 'empty') {
        try { mountControls(); setQuery(query,false); }
        catch (error) { showFailure(); }
      } else {
        view = null; clearCharts(); root.dataset.status = state.status;
        el('fm-content').hidden = true; el('fm-empty').hidden = true; el('fm-export').disabled = true;
        el('fm-content').setAttribute('aria-busy',state.status === 'loading' ? 'true' : 'false');
        el('fm-retry').hidden = state.status !== 'error';
        text('fm-status',state.status === 'error' ? 'Не удалось загрузить учебные данные. Повторите загрузку.' : 'Загрузка учебных данных…');
      }
    });
    function loadingState(loading) {
      el('fm-loading').hidden = !loading;
      var filters = root.querySelector('.fm-filters');
      filters.inert = loading;
      filters.setAttribute('aria-busy', String(loading));
    }
    function showFailure() {
      loadingState(false);
      view = null; root.dataset.status = 'error'; el('fm-content').hidden = true; el('fm-empty').hidden = true; el('fm-export').disabled = true; el('fm-retry').hidden = false;
      el('fm-content').setAttribute('aria-busy','false'); text('fm-status','Не удалось показать данные. Проверьте фильтры или повторите загрузку.');
    }
    listen(el('fm-detail-export'),'click',function () {
      if (!detailCSV.length) return;
      var ordered = Array.from(el('fm-detail-body').querySelectorAll('tbody tr[data-month]')).map(function (row) { return detailCSV.find(function (item) { return item.month === row.dataset.month; }); }).filter(Boolean);
      dkExport.csv(ordered,[['region','Регион'],['month','Месяц'],['issued','Факт, кредитов'],['plan','План, кредитов'],['planPct','Выполнение, %'],['volume','Объём, млн ₽'],['source','Источник'],['updatedAt','Обновлено']].map(function (c) { return {key:c[0],label:c[1]}; }),detailFile);
    });
    listen(el('fm-reset'),'click',reset); listen(el('fm-empty-reset'),'click',reset);
    listen(el('fm-retry'),'click',function () { snapshot = null; session.retry(); });
    listen(el('fm-prev'),'click',function () { setQuery({page:Math.max(1,query.page - 1)}); });
    listen(el('fm-next'),'click',function () { setQuery({page:query.page + 1}); });
    listen(el('fm-first'),'click',function () { setQuery({page:1}); });
    listen(el('fm-export'),'click',exportSlice);
    listen(root,'click',function (event) {
      var button = event.target.closest('[data-region]'); if (button) openRegion(button.dataset.region);
      if (event.target.closest('[data-map-retry]')) { mapFailed = false; mapAbort = new AbortController(); renderMap(); }
    });
    if (useURL) listen(window,'popstate',function () { clearTimeout(searchTimer); query = readQuery(); detail.close(); syncControls(); if (snapshot) { try { render(familyMortgageData.select(snapshot,query)); } catch (error) { showFailure(); } } });
    var destroy = dkOwn(root,function () {
      loadingState(false);
      stopped = true; clearTimeout(searchTimer); unsubscribe(); session.destroy(); detail.close();
      mapAttempt++; mapAbort.abort(); if (map) map.destroy(); clearCharts(); controls.forEach(function (c) { c.destroy(); }); releases.forEach(function (release) { release(); });
      view = null; snapshot = null; root.dataset.status = 'destroyed'; el('fm-content').hidden = true; el('fm-export').disabled = true;
    });
    var api = {getView:function () { return view; },setQuery:setQuery,session:session,destroy:destroy};
    root.familyMortgageDashboard = api; session.load({pageSize:100}); return api;
  };
  window.addEventListener('DOMContentLoaded',function () { var root = document.getElementById('fm-dashboard'); if (root) window.familyMortgageDashboard(root); });
})();
