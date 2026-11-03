/* Runtime of the closed screen-spec/1 plan-fact compiler. Embedded local data only. */
(function () {
  'use strict';
  function node(tag, text, className) {
    var element = document.createElement(tag); if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text; return element;
  }
  var states = {
    'partial-input': ['Частичные данные', 'У части наблюдений нет исходного значения. Полный показатель не вычисляется.'],
    'incomplete-source': ['Частичные данные', 'В источнике меньше строк, чем заявлено в полном охвате.'],
    'coverage-unknown': ['Охват не подтверждён', 'Источник не подтвердил численность полного набора.'],
    'zero-denominator': ['Нет базы', 'Знаменатель или сумма весов равен нулю. Значение не подменяется нулём.'],
    'grain-unknown': ['Нет оценки', 'Источник не подтвердил гранулярность.'],
    'incompatible-grain': ['Нет оценки', 'Гранулярность источника не совпадает с определением метрики.'],
    'ambiguous-grain': ['Нет оценки', 'Ключ наблюдения повторяется; повторная агрегация не подтверждена.'],
    'overflow': ['Нет оценки', 'Числовой результат вне поддерживаемого диапазона.'],
    'empty': ['Нет данных', 'В выбранном срезе нет наблюдений.']
  };
  window.dkScreen = function (root, config) {
    if (!root || !config || config.spec.schemaVersion !== 1 || config.spec.recipe !== 'plan-fact') throw new TypeError('dkScreen: compiled screen-spec/1 required');
    var data = window.dkDashboard.validate(config.data), registry = window.dkMetrics.validate(config.registry, data), spec = config.spec;
    var options = {grain: spec.source.grain, coverage: spec.source.coverage};
    window.dkMetrics.select(data, registry, {}, options);
    window.dkDestroy(root);
    var stopped = false, query = {filters: {}, period: null, page: 1, pageSize: 100}, last = null;
    var bindings = new Map(spec.bindings.map(function (binding) { return [binding.id, binding]; }));
    var controls = [], disposables = [], info = null;
    var kpis = root.querySelector('[data-screen-kpis]'), panels = root.querySelector('[data-screen-panels]');
    var filterHost = root.querySelector('[data-screen-filters]'), status = root.querySelector('[data-screen-status]');
    var empty = root.querySelector('[data-screen-empty]'), content = root.querySelector('[data-screen-content]');
    var reset = node('button', 'Сбросить фильтры', 'dk-btn dk-btn--sm'); reset.type = 'button'; reset.hidden = true; reset.dataset.dkReset = '';
    var dialog = document.createElement('dialog'); dialog.className = 'dk-modal dk-modal--detail dk-screen__detail'; dialog.dataset.dkScreen = 'detail';
    var title = node('h2', '', 'dk-modal__title'); title.id = spec.id + '-detail-title'; dialog.setAttribute('aria-labelledby', title.id);
    var dialogHead = node('div', null, 'dk-modal__head'); dialogHead.append(title);
    var dialogBody = node('div', null, 'dk-modal__body');
    var dialogFoot = node('form', null, 'dk-modal__foot'); dialogFoot.method = 'dialog'; dialogFoot.append(node('button', 'Закрыть', 'dk-btn'));
    dialog.append(dialogHead, dialogBody, dialogFoot); root.append(dialog);
    var details = window.dkModal(dialog);
    function filteredRows(view) {
      return data.rows.filter(function (row) {
        return row.date >= view.period.from && row.date <= view.period.to && Object.keys(view.query.filters).every(function (key) {
          return !view.query.filters[key].length || view.query.filters[key].includes(row.dimensions[key]);
        });
      });
    }
    function calculate(request) {
      var view = window.dkDashboard.select(data, request), named = window.dkMetrics.select(data, registry, request, options), values = {};
      bindings.forEach(function (binding, name) {
        if (binding.kind === 'named') values[name] = named.totals[binding.field];
        else {
          var metric = view.totals[binding.field], code = options.coverage.expectedRows !== data.rows.length ? 'incomplete-source' :
            metric.partial ? 'partial-input' : metric.total === 0 ? 'empty' : 'ready';
          values[name] = {value: code === 'ready' ? metric.value : null, code: code, observed: metric.observed, total: metric.total, partial: metric.partial};
        }
      });
      return {view: view, values: values};
    }
    function format(name, value) {
      if (value === null) return 'Нет данных'; var definition = bindings.get(name);
      return definition.format.type === 'percent' ? window.dkFmt.pct(value, definition.format.digits) : window.dkFmt.num(value, definition.format.digits);
    }
    function tile(name, metric, compact) {
      var definition = bindings.get(name), card = node('section', null, compact ? 'dk-widget dk-widget--s dk-tile dk-tile--compact' : 'dk-tile dk-tile--compact');
      card.dataset.dkKpi = 'true'; card.dataset.metric = name;
      card.append(node('h2', definition.label, 'dk-tile__label'));
      var line = node('div', null, 'dk-tile__row'), value = node('span', format(name, metric.value), 'dk-metric-lg'); line.append(value);
      if (definition.unit !== '%' && metric.value !== null) line.append(node('span', definition.unit, 'dk-tile__unit'));
      card.append(line);
      if (metric.code !== 'ready') {
        var reason = states[metric.code] || ['Нет оценки', 'Данные не позволяют вычислить показатель.'];
        var actions = node('div', null, 'dk-head__actions'), button = node('button', reason[0], 'dk-btn dk-btn--ghost dk-btn--sm');
        button.type = 'button'; button.setAttribute('aria-label', definition.label + ': ' + reason[0]); actions.append(button); card.append(actions);
        disposables.push(window.dkTooltip(button, {text: reason[1]}));
      }
      return card;
    }
    function groupQuery(dimension, value) {
      var filters = JSON.parse(JSON.stringify(query.filters)); filters[dimension] = [value];
      return {filters: filters, period: query.period, page: 1, pageSize: 100};
    }
    function openDetails(widget, value, opener) {
      var dimension = widget.props.dimension, result = calculate(groupQuery(dimension, value));
      window.dkDestroy(dialogBody); dialogBody.replaceChildren(); title.textContent = value;
      dialogBody.append(node('p', (data.source.kind === 'demo' ? 'Учебные данные' : data.source.label) + ' · ' + window.dkFmt.range(result.view.period.from, result.view.period.to), 'dk-caption'));
      var metrics = node('div', null, 'dk-grid dk-modal__metrics');
      widget.props.metrics.forEach(function (name) { metrics.append(tile(name, result.values[name], false)); });
      dialogBody.append(metrics);
      var wrap = node('div', null, 'dk-tablewrap'), table = node('table', null, 'dk-table');
      wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Дневные показатели: ' + value);
      var thead = node('thead'), header = node('tr'); header.append(node('th', 'Дата'));
      widget.props.metrics.forEach(function (name) { header.append(node('th', bindings.get(name).label)); }); thead.append(header); table.append(thead);
      var tbody = node('tbody'), dates = [...new Set(filteredRows(result.view).map(function (row) { return row.date; }))].sort();
      dates.forEach(function (day) {
        var request = groupQuery(dimension, value); request.period = {from: day, to: day}; var daily = calculate(request), row = node('tr');
        row.append(node('td', window.dkFmt.date(day)));
        widget.props.metrics.forEach(function (name) { row.append(node('td', format(name, daily.values[name].value))); }); tbody.append(row);
      });
      table.append(tbody); wrap.append(table); dialogBody.append(wrap); opener.focus(); details.open();
    }
    function panel(widget, result) {
      var column = node('div', null, 'dk-col--half'), card = node('section', null, 'dk-widget'), head = node('div', null, 'dk-widget__head');
      var heading = widget.props.title + (widget.component === 'chart' ? ', ' + bindings.get(widget.props.metrics[0]).unit : '');
      head.append(node('h2', heading, 'dk-head__title')); card.append(head); column.append(card); card.dataset.screenWidget = widget.id;
      var body = node('div', null, 'dk-widget__body'); card.append(body);
      if (widget.component === 'chart') {
        var chart = node('div', null, 'dk-chart'); chart.setAttribute('role', 'img'); chart.setAttribute('aria-label', heading); body.append(chart);
        var fullSource = options.coverage.expectedRows === data.rows.length, partialSeries = !fullSource;
        var series = widget.props.metrics.map(function (name) {
          var definition = bindings.get(name);
          return {name: definition.label, data: result.view.series.map(function (point) {
            var coverage = point.coverage[definition.field];
            if (!fullSource || coverage.observed !== coverage.total) { partialSeries = true; return null; }
            return point.values[definition.field];
          })};
        });
        if (partialSeries) {
          var reason = node('button', 'Частичные данные', 'dk-btn dk-btn--ghost dk-btn--sm'); reason.type = 'button'; reason.dataset.chartState = 'partial';
          reason.setAttribute('aria-label', heading + ': частичные данные'); head.append(reason);
          disposables.push(window.dkTooltip(reason, {text: fullSource ? 'Точки с неполными исходными значениями не вычисляются.' : states['incomplete-source'][1]}));
        }
        disposables.push(window.dkChart(chart, {type: widget.props.type === 'bar' && widget.props.orientation === 'horizontal' ? 'bar-h' : widget.props.type,
          categories: result.view.series.map(function (point) { return window.dkFmt.date(point.date); }), unit: '',
          series: series}));
      } else {
        var wrap = node('div', null, 'dk-tablewrap dk-screen__table'), table = node('table', null, 'dk-table dk-table--cards'); table.dataset.screenTable = widget.id;
        var thead = node('thead'), header = node('tr'), dimension = data.dimensions.find(function (entry) { return entry.id === widget.props.dimension; });
        var first = node('th', dimension.label); first.dataset.sortable = 'dimension'; header.append(first);
        widget.props.metrics.forEach(function (name) {
          var definition = bindings.get(name), th = node('th', definition.label + (definition.unit === '%' ? '' : ', ' + definition.unit));
          th.dataset.sortable = name; th.dataset.type = 'number'; header.append(th);
        }); thead.append(header); table.append(thead);
        var tbody = node('tbody'), values = [...new Set(filteredRows(result.view).map(function (row) { return row.dimensions[widget.props.dimension]; }))].sort(function (a, b) { return a.localeCompare(b, 'ru'); });
        if (widget.props.sort === 'desc') values.reverse();
        values.forEach(function (value) {
          var metrics = calculate(groupQuery(widget.props.dimension, value)).values, row = node('tr'); row.dataset.group = value;
          var cell = node('td');
          if (widget.props.details) {
            var button = node('button', value, 'dk-btn dk-btn--ghost dk-btn--sm'); button.type = 'button'; button.dataset.openDetails = value;
            button.addEventListener('click', function () { openDetails(widget, value, button); }); cell.append(button);
          } else cell.textContent = value;
          row.append(cell);
          widget.props.metrics.forEach(function (name) { var td = node('td', format(name, metrics[name].value)); td.dataset.sort = metrics[name].value === null ? '' : String(metrics[name].value); row.append(td); }); tbody.append(row);
        });
        table.append(tbody); wrap.append(table); body.append(wrap); var tableApi = window.dkTable(table); disposables.push(tableApi); first.setAttribute('aria-sort', widget.props.sort === 'desc' ? 'descending' : 'ascending');
      }
      return column;
    }
    function render() {
      if (stopped) return;
      var result = calculate(query); query = result.view.query;
      disposables.splice(0).forEach(function (api) { if (api) api.destroy(); });
      window.dkDestroy(kpis); window.dkDestroy(panels); kpis.replaceChildren(); panels.replaceChildren();
      var active = Object.values(query.filters).some(function (values) { return values.length; }); reset.hidden = !active;
      var noRows = result.view.rowCount === 0; empty.hidden = !noRows; content.hidden = noRows;
      empty.querySelector('h2').textContent = active ? 'Нет результатов' : 'Данных пока нет';
      var partial = options.coverage.expectedRows !== data.rows.length;
      status.hidden = !partial; status.textContent = partial ? 'Частичные данные' : '';
      if (!noRows) spec.widgets.forEach(function (widget) {
        if (widget.component === 'tile') kpis.append(tile(widget.props.metric, result.values[widget.props.metric], true));
        else panels.append(panel(widget, result));
      });
      kpis.hidden = !kpis.children.length; panels.hidden = !panels.children.length;
      root.dataset.status = noRows ? 'empty' : 'ready'; root.setAttribute('aria-busy', 'false');
      last = {status: root.dataset.status, query: query, values: result.values, rowCount: result.view.rowCount};
    }
    function setFilters(filters) {
      if (stopped) return;
      if (!filters || typeof filters !== 'object' || Array.isArray(filters)) throw new TypeError('dkScreen: filters object required');
      Object.keys(filters).forEach(function (dimension) {
        var control = controls.find(function (entry) { return entry.dimension === dimension; }), chosen = filters[dimension];
        if (!control || !Array.isArray(chosen) || chosen.length > 1 || chosen.some(function (value) { return !control.values.includes(value); })) {
          throw new TypeError('dkScreen: only declared single-select values are supported');
        }
      });
      var next = {filters: filters, period: query.period, page: 1, pageSize: 100};
      window.dkDashboard.select(data, next); var hadDialog = dialog.open; if (hadDialog) dialog.close(); query = next; render();
      controls.forEach(function (entry) {
        var chosen = query.filters[entry.dimension] || [], value = chosen.length ? entry.values.indexOf(chosen[0]) : -1;
        entry.api.update({value: value < 0 ? null : 'value-' + value});
      });
      if (hadDialog) (filterHost.querySelector('button') || root.querySelector('[data-screen-info]')).focus();
    }
    function clear() { setFilters({}); }
    filterHost.replaceChildren();
    spec.filters.forEach(function (filter) {
      var field = node('div', null, 'dk-screen__filter'), host = node('div'), dimension = filter.props.dimension;
      field.append(host); filterHost.append(field);
      var values = [...new Set(data.rows.map(function (row) { return row.dimensions[dimension]; }))].sort(function (a, b) { return a.localeCompare(b, 'ru'); });
      var api = window.dkSelect(host, {label: filter.props.label, value: null, options: [{value: 'all', name: 'Все'}].concat(values.map(function (value, index) { return {value: 'value-' + index, name: value}; })),
        onChange: function (value) { var filters = JSON.parse(JSON.stringify(query.filters)); filters[dimension] = value === 'all' || value === null ? [] : [values[Number(value.slice(6))]]; setFilters(filters); }});
      controls.push({dimension: dimension, values: values, api: api});
    });
    if (spec.actions.some(function (action) { return action.type === 'clear-filters'; })) { reset.addEventListener('click', clear); filterHost.append(reset); }
    root.querySelector('[data-screen-source]').textContent = (data.source.kind === 'demo' ? 'Учебные данные' : data.source.label) + ' · ' + window.dkFmt.range(data.period.from, data.period.to) + ' · Обновлено ' + window.dkFmt.dateTime(data.source.updatedAt);
    var information = node('div'); information.append(node('p', spec.question), node('p', 'Источник: ' + data.source.label));
    spec.bindings.forEach(function (binding) { var definition = binding.kind === 'named' ? registry.metrics.find(function (entry) { return entry.id === binding.field; }) : data.metrics.find(function (entry) { return entry.id === binding.field; }); var explanation = definition.description; if (!explanation) { var labels = new Map(data.metrics.map(function (entry) { return [entry.id, entry.label]; })); explanation = definition.aggregation === 'ratio-of-sums' ? 'Сумма «' + labels.get(definition.inputs.numerator) + '» / сумма «' + labels.get(definition.inputs.denominator) + '»' : 'Сумма («' + labels.get(definition.inputs.value) + '» × «' + labels.get(definition.inputs.weight) + '») / сумма «' + labels.get(definition.inputs.weight) + '»'; if (definition.scale !== 1) explanation += ' × ' + window.dkFmt.num(definition.scale); } information.append(node('p', binding.label + ': ' + explanation)); });
    info = window.dkPopover(root.querySelector('[data-screen-info]'), {label: 'Данные и методика', content: information});
    render();
    var release = window.dkOwn(root, function () {
      if (stopped) return; stopped = true;
      controls.forEach(function (entry) { entry.api.destroy(); }); disposables.splice(0).forEach(function (api) { if (api) api.destroy(); });
      if (info) info.destroy(); if (dialog.open) dialog.close(); dialog.remove(); reset.removeEventListener('click', clear);
      window.dkDestroy(kpis); window.dkDestroy(panels); kpis.replaceChildren(); panels.replaceChildren();
      root.dataset.status = 'destroyed'; if (root.dashboardScreen === api) delete root.dashboardScreen;
    });
    var api = {setFilters: setFilters, reset: clear, getSnapshot: function () { return JSON.parse(JSON.stringify(last)); }, destroy: release};
    root.dashboardScreen = api; return api;
  };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-dk-screen-config]').forEach(function (root) {
      try { window.dkScreen(root, JSON.parse(document.getElementById(root.dataset.dkScreenConfig).textContent)); }
      catch (error) { window.dkDestroy(root); var content = root.querySelector('[data-screen-content]'); if (content) content.hidden = true; root.querySelectorAll('dialog').forEach(function (dialog) { if (dialog.open) dialog.close(); dialog.remove(); }); root.dataset.status = 'error'; root.setAttribute('aria-busy', 'false'); var message = node('p', 'Не удалось открыть дашборд', 'dk-caption'); message.setAttribute('role', 'alert'); root.append(message); console.error(error); }
    });
  });
})();
