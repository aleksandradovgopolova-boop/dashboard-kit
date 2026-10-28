/* Учебная модель программы: одно наблюдение = регион × полный месяц.
   Все блоки считают один срез. Доли — отношение сумм, ставка взвешена по
   объёму выдач. Это правила учебного набора, не методика реальной программы. */
(function () {
  'use strict';
  var trusted = new WeakSet();
  var metricUnits = {
    issued: 'кредитов', issuedPlan: 'кредитов', volume: 'млн ₽',
    rateWeight: 'б.п.·млн ₽', applied: 'заявок', approved: 'заявок',
    budgetSpent: 'млн ₽', budgetPlan: 'млн ₽', budgetLimit: 'млн ₽'
  };
  var metricIds = Object.keys(metricUnits);
  var dimensionIds = ['region', 'regionName', 'district', 'districtName'];
  var monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  function fail(message, code) {
    var error = new Error(message); error.code = code || 'INVALID_DATA'; throw error;
  }
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (key) { freeze(value[key]); });
      Object.freeze(value);
    }
    return value;
  }
  function lastDay(month) {
    var year = +month.slice(0, 4), number = +month.slice(5);
    // setUTCFullYear avoids Date.UTC's special interpretation of years 0–99.
    var day = new Date(0); day.setUTCFullYear(year, number, 0);
    return day.toISOString().slice(0, 10);
  }
  function monthsBetween(period) {
    var months = [], current = period.from.slice(0, 7), last = period.to.slice(0, 7);
    while (current <= last) {
      months.push(current);
      if (months.length > 120) fail('Учебная модель поддерживает не больше 120 месяцев.');
      var year = +current.slice(0, 4), month = +current.slice(5) + 1;
      if (month === 13) { month = 1; year++; }
      current = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0');
    }
    return months;
  }
  function label(month) { return monthNames[+month.slice(5) - 1] + ' ' + month.slice(0, 4); }
  function validate(input) {
    if (trusted.has(input)) return input;
    var data = window.dkDashboard.validate(input);
    if (data.source.kind !== 'demo') fail('Эта модель принимает только учебные данные.');
    if (data.period.from.slice(8) !== '01' || data.period.to !== lastDay(data.period.to.slice(0, 7))) {
      fail('Период должен содержать полные месяцы.');
    }
    if (data.metrics.length !== metricIds.length || data.dimensions.length !== dimensionIds.length) fail('Неверный набор показателей или измерений.');
    data.metrics.forEach(function (metric) {
      if (!Object.prototype.hasOwnProperty.call(metricUnits, metric.id) || metric.aggregation !== 'sum' || metric.unit !== metricUnits[metric.id]) {
        fail('Неверная единица или агрегация показателя ' + metric.id);
      }
    });
    data.dimensions.forEach(function (dimension) {
      if (dimensionIds.indexOf(dimension.id) < 0) fail('Неизвестное измерение ' + dimension.id);
    });
    var months = monthsBetween(data.period), pairs = new Set(), regions = new Map(), districts = new Map();
    data.rows.forEach(function (row) {
      if (row.date.slice(8) !== '01') fail('Дата наблюдения должна обозначать начало полного месяца.');
      var d = row.dimensions, key = d.region + '\n' + row.date;
      if (pairs.has(key)) fail('Повтор региона и месяца.'); pairs.add(key);
      var definition = [d.regionName, d.district, d.districtName].join('\n');
      if (regions.has(d.region) && regions.get(d.region) !== definition) fail('Регион изменил название или округ внутри набора.');
      if (districts.has(d.district) && districts.get(d.district) !== d.districtName) fail('Неоднозначное название округа.');
      regions.set(d.region, definition); districts.set(d.district, d.districtName);
      metricIds.forEach(function (metric) {
        var value = row.values[metric];
        if (value !== null && (!Number.isSafeInteger(value) || value < 0)) fail('Ожидается неотрицательное безопасное целое или null: ' + metric);
      });
      var v = row.values;
      if (v.applied !== null && v.approved !== null && v.approved > v.applied) fail('Одобрений больше рассмотренных заявок.');
      if (v.volume === 0 && v.rateWeight !== null && v.rateWeight !== 0) fail('Вес ставки ненулевой при нулевом объёме выдач.');
    });
    // An omitted region-month cannot masquerade as full coverage. Missing
    // measurements must be explicit nulls in an existing observation.
    if (data.rows.length !== regions.size * months.length) fail('Для каждого региона нужны все месяцы периода; неизвестные значения обозначьте null.');
    trusted.add(data); return data;
  }
  function query(input) {
    input = input === undefined ? {} : input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Некорректный запрос.', 'INVALID_QUERY');
    var proto = Object.getPrototypeOf(input);
    if (proto !== null && Object.getPrototypeOf(proto) !== null || Object.getOwnPropertySymbols(input).length) fail('Некорректный запрос.', 'INVALID_QUERY');
    Object.keys(input).forEach(function (key) {
      if (['district', 'region', 'month', 'search', 'page', 'pageSize', 'sort'].indexOf(key) < 0 || Object.getOwnPropertyDescriptor(input, key).get) fail('Неизвестное поле запроса.', 'INVALID_QUERY');
    });
    var out = {district: input.district === undefined ? 'all' : input.district,
      region: input.region === undefined ? 'all' : input.region,
      month: input.month === undefined ? 'all' : input.month,
      search: input.search === undefined ? '' : input.search,
      page: input.page === undefined ? 1 : input.page,
      pageSize: input.pageSize === undefined ? 12 : input.pageSize,
      sort: input.sort === undefined ? 'lag' : input.sort};
    if (typeof out.district !== 'string' || !out.district.trim() || out.district.length > 100 ||
        typeof out.region !== 'string' || !out.region.trim() || out.region.length > 100 ||
        typeof out.month !== 'string' || !(out.month === 'all' || /^\d{4}-(0[1-9]|1[0-2])$/.test(out.month)) ||
        typeof out.search !== 'string' || out.search.length > 200 ||
        !Number.isSafeInteger(out.page) || out.page < 1 || !Number.isSafeInteger(out.pageSize) || out.pageSize < 1 || out.pageSize > 100 ||
        !Number.isSafeInteger((out.page - 1) * out.pageSize) || ['lag', 'name', 'issued', 'volume'].indexOf(out.sort) < 0) fail('Некорректный запрос.', 'INVALID_QUERY');
    out.search = out.search.trim(); return out;
  }
  function ratio(numerator, denominator, scale) {
    if (numerator === null || denominator === null || denominator === 0) return null;
    var value = numerator / denominator * scale;
    return Number.isFinite(value) ? value : null;
  }
  function aggregate(rows) {
    var values = {}, coverage = {};
    metricIds.forEach(function (key) {
      var sum = 0, observed = 0;
      rows.forEach(function (row) {
        if (row.values[key] === null) return;
        sum += row.values[key]; observed++;
        if (!Number.isSafeInteger(sum)) fail('Сумма превышает безопасную точность: ' + key);
      });
      coverage[key] = {observed: observed, total: rows.length, partial: observed < rows.length};
      values[key] = rows.length && observed === rows.length ? sum : null;
    });
    var planPct = ratio(values.issued, values.issuedPlan, 100);
    var lag = planPct === null ? null : Math.max(0, 100 - planPct);
    return {
      issued: values.issued, issuedPlan: values.issuedPlan, volume: values.volume,
      rate: ratio(values.rateWeight, values.volume, 0.01),
      planPct: planPct, lag: lag, status: lag === null ? 'missing' : lag >= 20 ? 'crit' : lag > 0 ? 'high' : 'calm',
      approval: ratio(values.approved, values.applied, 100), applied: values.applied, approved: values.approved,
      budget: {spent: values.budgetSpent, plan: values.budgetPlan, limit: values.budgetLimit,
        pct: ratio(values.budgetSpent, values.budgetPlan, 100)}, coverage: coverage
    };
  }
  function group(rows, property) {
    var groups = new Map();
    rows.forEach(function (row) {
      var key = property === 'month' ? row.date.slice(0, 7) : row.dimensions[property];
      if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row);
    });
    return groups;
  }
  function monthly(rows) {
    return Array.from(group(rows, 'month')).sort(function (a, b) { return a[0].localeCompare(b[0]); }).map(function (entry) {
      return Object.assign({month: entry[0], label: label(entry[0])}, aggregate(entry[1]));
    });
  }
  function alphabetical(a, b) { return a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id); }
  function descending(metric) {
    return function (a, b) {
      if (a[metric] === null && b[metric] !== null) return 1;
      if (a[metric] !== null && b[metric] === null) return -1;
      return (b[metric] || 0) - (a[metric] || 0) || alphabetical(a, b);
    };
  }
  function searchable(value) { return value.toLocaleLowerCase('ru').replace(/ё/g, 'е'); }
  function select(input, request) {
    var data = validate(input), q = query(request), term = searchable(q.search);
    var filtered = data.rows.filter(function (row) {
      return (q.district === 'all' || row.dimensions.district === q.district) &&
        (q.region === 'all' || row.dimensions.region === q.region) &&
        (q.month === 'all' || row.date.slice(0, 7) === q.month) &&
        (!term || searchable(row.dimensions.regionName).includes(term));
    });
    var regions = Array.from(group(filtered, 'region')).map(function (entry) {
      var d = entry[1][0].dimensions;
      return Object.assign({id: entry[0], name: d.regionName, fd: d.district, fdName: d.districtName,
        monthly: monthly(entry[1])}, aggregate(entry[1]));
    });
    regions.sort(q.sort === 'name' ? alphabetical : descending(q.sort));
    var districts = Array.from(group(filtered, 'district')).map(function (entry) {
      return Object.assign({id: entry[0], name: entry[1][0].dimensions.districtName}, aggregate(entry[1]));
    }).sort(descending('lag'));
    var counts = {crit: 0, high: 0, calm: 0, missing: 0, total: regions.length, behind: 0};
    regions.forEach(function (region) { counts[region.status]++; }); counts.behind = counts.crit + counts.high;
    var options = {districts: Array.from(group(data.rows, 'district')).map(function (entry) {
      return {id: entry[0], name: entry[1][0].dimensions.districtName};
    }).sort(alphabetical), months: monthsBetween(data.period).map(function (month) { return {id: month, label: label(month)}; })};
    return freeze({source: data.source,
      period: q.month === 'all' ? data.period : {from: q.month + '-01', to: lastDay(q.month)}, query: q,
      kpis: aggregate(filtered), counts: counts, monthly: monthly(filtered), regions: regions,
      ranking: regions.slice().sort(descending('lag')), districts: districts,
      rows: regions.slice((q.page - 1) * q.pageSize, q.page * q.pageSize), rowCount: regions.length,
      pageCount: Math.ceil(regions.length / q.pageSize), options: options});
  }
  window.familyMortgageData = Object.freeze({version: '1.0.0', validate: validate, select: select});
})();
