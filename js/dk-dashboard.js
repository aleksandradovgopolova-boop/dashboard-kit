/* Dashboard data boundary. No DOM, framework, network state or application globals.
   A view is derived from one validated snapshot; consumers render it atomically.
   Query dates are inclusive. Null is missing, zero is a measured value. */
(function () {
  'use strict';

  var forbidden = ['__proto__', 'prototype', 'constructor'];
  function problem(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }
  function requireValue(ok, path, message, code) {
    if (!ok) throw problem(code || 'INVALID_DATA', path + ': ' + message);
  }
  function record(value, path, code) {
    requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), path, 'ожидается объект', code);
    var proto = Object.getPrototypeOf(value);
    requireValue(proto === null || Object.getPrototypeOf(proto) === null, path, 'ожидается обычный объект данных', code);
    requireValue(Object.getOwnPropertySymbols(value).length === 0, path, 'символьные ключи не поддерживаются', code);
    Object.keys(value).forEach(function (key) {
      requireValue(forbidden.indexOf(key) < 0, path, 'запрещённый ключ', code);
      requireValue(Object.getOwnPropertyDescriptor(value, key).get === undefined, path, 'вычисляемые свойства не поддерживаются', code);
    });
    return value;
  }
  function keys(value, allowed, path, code) {
    record(value, path, code);
    Object.keys(value).forEach(function (key) {
      requireValue(allowed.indexOf(key) >= 0, path, 'неизвестное поле ' + key, code);
    });
  }
  function text(value, path, code) {
    requireValue(typeof value === 'string' && value.trim().length > 0, path, 'ожидается непустая строка', code);
    return value;
  }
  function identifier(value, path) {
    text(value, path);
    requireValue(/^[a-z][a-z0-9_-]*$/i.test(value) && forbidden.indexOf(value) < 0, path, 'некорректный идентификатор');
    return value;
  }
  function date(value, path, code) {
    requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), path, 'ожидается YYYY-MM-DD', code);
    var parsed = new Date(value + 'T00:00:00.000Z');
    requireValue(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value, path, 'недопустимая дата', code);
    return value;
  }
  function period(value, path, code) {
    keys(value, ['from', 'to'], path, code);
    var out = {from: date(value.from, path + '.from', code), to: date(value.to, path + '.to', code)};
    requireValue(out.from <= out.to, path, 'начало позже окончания', code);
    return out;
  }
  function timestamp(value, path) {
    text(value, path);
    var match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/);
    requireValue(!!match, path, 'ожидается ISO timestamp с часовым поясом');
    date(match[1], path);
    requireValue(+match[2] <= 23 && +match[3] <= 59 && +match[4] <= 59, path, 'недопустимое время');
    if (match[5] !== 'Z') requireValue(+match[5].slice(1, 3) <= 23 && +match[5].slice(4) <= 59, path, 'недопустимый часовой пояс');
    requireValue(Number.isFinite(Date.parse(value)), path, 'недопустимый timestamp');
    return value;
  }
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (key) { freeze(value[key]); });
      Object.freeze(value);
    }
    return value;
  }
  function list(value, path, code) {
    requireValue(Array.isArray(value), path, 'ожидается массив', code);
    requireValue(Object.keys(value).length === value.length, path, 'ожидается плотный массив без дополнительных полей', code);
    for (var i = 0; i < value.length; i++) requireValue(Object.prototype.hasOwnProperty.call(value, i), path, 'пропуск элемента массива', code);
    return value;
  }
  function definitions(value, metric) {
    var path = metric ? 'metrics' : 'dimensions', seen = new Set();
    var result = list(value, path).map(function (item, i) {
      var at = path + '[' + i + ']';
      keys(item, metric ? ['id', 'label', 'unit', 'aggregation', 'description'] : ['id', 'label'], at);
      var id = identifier(item.id, at + '.id');
      requireValue(!seen.has(id), at, 'повтор идентификатора'); seen.add(id);
      var out = {id: id, label: text(item.label, at + '.label')};
      if (metric) {
        out.unit = text(item.unit, at + '.unit');
        out.description = text(item.description, at + '.description');
        requireValue(item.aggregation === 'sum' || item.aggregation === 'mean', at, 'агрегация должна быть sum или mean');
        out.aggregation = item.aggregation;
      }
      return out;
    });
    requireValue(!metric || result.length > 0, path, 'нужен хотя бы один показатель');
    return result;
  }
  function validate(input) {
    keys(input, ['schemaVersion', 'source', 'period', 'dimensions', 'metrics', 'rows'], 'snapshot');
    requireValue(input.schemaVersion === 1, 'schemaVersion', 'поддерживается только версия 1', 'UNSUPPORTED_VERSION');
    keys(input.source, ['id', 'label', 'kind', 'updatedAt'], 'source');
    requireValue(['demo', 'live'].indexOf(input.source.kind) >= 0, 'source.kind', 'ожидается demo или live');
    var out = {
      schemaVersion: 1,
      source: {id: text(input.source.id, 'source.id'), label: text(input.source.label, 'source.label'),
        kind: input.source.kind, updatedAt: timestamp(input.source.updatedAt, 'source.updatedAt')},
      period: period(input.period, 'period'), dimensions: definitions(input.dimensions, false),
      metrics: definitions(input.metrics, true), rows: []
    };
    var dimensionIds = out.dimensions.map(function (item) { return item.id; });
    var metricIds = out.metrics.map(function (item) { return item.id; });
    var rowIds = new Set();
    out.rows = list(input.rows, 'rows').map(function (row, i) {
      var at = 'rows[' + i + ']';
      keys(row, ['id', 'label', 'date', 'dimensions', 'values'], at);
      var id = text(row.id, at + '.id');
      requireValue(!rowIds.has(id), at, 'повтор идентификатора строки'); rowIds.add(id);
      var day = date(row.date, at + '.date');
      requireValue(day >= out.period.from && day <= out.period.to, at, 'дата вне периода источника');
      keys(row.dimensions, dimensionIds, at + '.dimensions');
      keys(row.values, metricIds, at + '.values');
      var result = {id: id, label: text(row.label, at + '.label'), date: day, dimensions: {}, values: {}};
      dimensionIds.forEach(function (key) { result.dimensions[key] = text(row.dimensions[key], at + '.dimensions.' + key); });
      metricIds.forEach(function (key) {
        var value = row.values[key];
        requireValue(value === null || typeof value === 'number' && Number.isFinite(value), at + '.values.' + key, 'ожидается конечное число или null');
        result.values[key] = value;
      });
      return result;
    });
    return freeze(out);
  }
  function query(input) {
    if (input === undefined) input = {};
    keys(input, ['filters', 'period', 'page', 'pageSize'], 'query', 'INVALID_QUERY');
    var filters = input.filters === undefined ? {} : input.filters;
    record(filters, 'query.filters', 'INVALID_QUERY');
    var out = {filters: {}, period: input.period === undefined || input.period === null ? null : period(input.period, 'query.period', 'INVALID_QUERY'),
      page: input.page === undefined ? 1 : input.page, pageSize: input.pageSize === undefined ? 20 : input.pageSize};
    requireValue(Number.isSafeInteger(out.page) && out.page >= 1, 'query.page', 'ожидается положительное целое', 'INVALID_QUERY');
    requireValue(Number.isSafeInteger(out.pageSize) && out.pageSize >= 1 && out.pageSize <= 100, 'query.pageSize', 'ожидается целое от 1 до 100', 'INVALID_QUERY');
    requireValue(Number.isSafeInteger((out.page - 1) * out.pageSize), 'query.page', 'слишком большой номер страницы', 'INVALID_QUERY');
    Object.keys(filters).sort().forEach(function (key) {
      requireValue(/^[a-z][a-z0-9_-]*$/i.test(key), 'query.filters', 'некорректный идентификатор', 'INVALID_QUERY');
      list(filters[key], 'query.filters.' + key, 'INVALID_QUERY');
      out.filters[key] = Array.from(new Set(filters[key].map(function (value) { return text(value, 'query.filters.' + key, 'INVALID_QUERY'); }))).sort();
    });
    return freeze(out);
  }
  function checkFilters(data, slice) {
    var dimensionIds = data.dimensions.map(function (item) { return item.id; });
    Object.keys(slice.filters).forEach(function (key) {
      requireValue(dimensionIds.indexOf(key) >= 0, 'query.filters.' + key, 'неизвестное измерение', 'INVALID_QUERY');
    });
  }
  function matches(row, slice, range) {
    return row.date >= range.from && row.date <= range.to && Object.keys(slice.filters).every(function (key) {
        return slice.filters[key].length === 0 || slice.filters[key].indexOf(row.dimensions[key]) >= 0;
      });
  }
  function aggregate(rows, metrics) {
    var totals = {};
    metrics.forEach(function (metric) {
      var values = rows.map(function (row) { return row.values[metric.id]; }).filter(function (value) { return value !== null; });
      var value = values.length ? values.reduce(function (sum, n) { return sum + (metric.aggregation === 'mean' ? n / values.length : n); }, 0) : null;
      requireValue(value === null || Number.isFinite(value), 'totals.' + metric.id, 'результат агрегации вне числового диапазона');
      totals[metric.id] = {value: value, observed: values.length, total: rows.length, partial: values.length < rows.length};
    });
    return totals;
  }
  function localSeries(rows, metrics) {
    var days = new Map();
    rows.forEach(function (row) { if (!days.has(row.date)) days.set(row.date, []); days.get(row.date).push(row); });
    requireValue(days.size <= 366, 'series', 'поддерживается до 366 дат; сократите период');
    return Array.from(days.keys()).sort().map(function (day) {
      var totals = aggregate(days.get(day), metrics), values = {}, coverage = {};
      metrics.forEach(function (metric) {
        values[metric.id] = totals[metric.id].value;
        coverage[metric.id] = {observed: totals[metric.id].observed, total: totals[metric.id].total};
      });
      return {date: day, values: values, coverage: coverage};
    });
  }
  function select(input, requested) {
    var data = validate(input), slice = query(requested);
    checkFilters(data, slice);
    var range = slice.period || data.period;
    // A broader period would make a partial source look like a complete answer.
    requireValue(range.from >= data.period.from && range.to <= data.period.to, 'query.period', 'период вне покрытия источника', 'INVALID_QUERY');
    var rows = data.rows.filter(function (row) { return matches(row, slice, range); });
    var offset = (slice.page - 1) * slice.pageSize;
    return freeze({source: data.source, period: range, dimensions: data.dimensions, metrics: data.metrics,
      rows: rows.slice(offset, offset + slice.pageSize), rowCount: rows.length,
      totals: aggregate(rows, data.metrics), series: localSeries(rows, data.metrics), query: slice});
  }
  function count(value, max, path) {
    requireValue(Number.isSafeInteger(value) && value >= 0 && value <= max, path, 'недопустимое количество');
    return value;
  }
  function measure(value, observed, path) {
    requireValue(observed === 0 ? value === null : typeof value === 'number' && Number.isFinite(value), path, 'значение не соответствует покрытию');
    return value;
  }
  function near(a, b) {
    return a === null && b === null || Number.isFinite(a) && Number.isFinite(b) &&
      (a === b || Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(a), Math.abs(b)));
  }
  function validateResponse(input, requested) {
    keys(input, ['schemaVersion', 'mode', 'query', 'source', 'period', 'dimensions', 'metrics', 'rows', 'rowCount', 'totals', 'series'], 'response');
    requireValue(input.mode === 'server', 'mode', 'ожидается server');
    requireValue(input.query !== undefined, 'query', 'ответ должен повторять запрос', 'QUERY_MISMATCH');
    var slice = query(requested), echo = query(input.query);
    requireValue(JSON.stringify(slice) === JSON.stringify(echo), 'query', 'ответ относится к другому запросу', 'QUERY_MISMATCH');
    var data = validate({schemaVersion: input.schemaVersion, source: input.source, period: input.period,
      dimensions: input.dimensions, metrics: input.metrics, rows: input.rows});
    checkFilters(data, slice);
    requireValue(!slice.period || data.period.from === slice.period.from && data.period.to === slice.period.to, 'period', 'ответ относится к другому периоду', 'QUERY_MISMATCH');
    var rowCount = count(input.rowCount, Number.MAX_SAFE_INTEGER, 'rowCount');
    var offset = (slice.page - 1) * slice.pageSize;
    requireValue(data.rows.length === Math.min(slice.pageSize, Math.max(0, rowCount - offset)), 'rows', 'число строк не соответствует странице');
    data.rows.forEach(function (row) { requireValue(matches(row, slice, data.period), 'rows', 'строка не соответствует фильтру', 'QUERY_MISMATCH'); });
    var metricIds = data.metrics.map(function (item) { return item.id; }), totals = {};
    keys(input.totals, metricIds, 'totals');
    metricIds.forEach(function (id) {
      var total = input.totals[id], path = 'totals.' + id;
      keys(total, ['value', 'observed', 'total', 'partial'], path);
      requireValue(total.total === rowCount, path, 'покрытие должно относиться ко всему срезу');
      var observed = count(total.observed, rowCount, path + '.observed');
      requireValue(total.partial === (observed < rowCount), path, 'некорректный признак частичных данных');
      totals[id] = {value: measure(total.value, observed, path + '.value'), observed: observed, total: rowCount, partial: total.partial};
    });
    var previousDay = '', represented = 0;
    requireValue(list(input.series, 'series').length <= 366, 'series', 'поддерживается до 366 дат');
    var series = input.series.map(function (point, i) {
      var path = 'series[' + i + ']';
      keys(point, ['date', 'values', 'coverage'], path);
      var day = date(point.date, path + '.date');
      requireValue(day > previousDay && day >= data.period.from && day <= data.period.to, path, 'даты должны возрастать и входить в период');
      previousDay = day;
      keys(point.values, metricIds, path + '.values'); keys(point.coverage, metricIds, path + '.coverage');
      var values = {}, coverage = {}, pointTotal = null;
      metricIds.forEach(function (id) {
        var cov = point.coverage[id]; keys(cov, ['observed', 'total'], path + '.coverage.' + id);
        var total = count(cov.total, rowCount, path + '.coverage.' + id + '.total');
        if (pointTotal === null) pointTotal = total;
        requireValue(pointTotal === total, path, 'метрики должны описывать один набор строк');
        var observed = count(cov.observed, total, path + '.coverage.' + id + '.observed');
        coverage[id] = {observed: observed, total: total};
        values[id] = measure(point.values[id], observed, path + '.values.' + id);
      });
      represented += pointTotal;
      requireValue(Number.isSafeInteger(represented), 'series', 'слишком большое покрытие');
      return {date: day, values: values, coverage: coverage};
    });
    requireValue(represented === rowCount, 'series', 'серии должны покрывать весь срез');
    var pageDays = new Map();
    data.rows.forEach(function (row) { if (!pageDays.has(row.date)) pageDays.set(row.date, []); pageDays.get(row.date).push(row); });
    pageDays.forEach(function (rows, day) {
      var point = series.find(function (item) { return item.date === day; });
      requireValue(!!point, 'rows', 'дата строки отсутствует в полной серии');
      var pageTotals = aggregate(rows, data.metrics);
      metricIds.forEach(function (id) {
        var page = pageTotals[id], full = point.coverage[id];
        requireValue(page.total <= full.total && page.observed <= full.observed &&
          page.total - page.observed <= full.total - full.observed, 'rows.' + id, 'покрытие страницы не входит в полную серию');
        if (page.total === full.total) requireValue(near(page.value, point.values[id]), 'rows.' + id, 'таблица и серия содержат разные значения');
      });
    });
    data.metrics.forEach(function (metric) {
      var id = metric.id, observed = series.reduce(function (n, point) { return n + point.coverage[id].observed; }, 0);
      requireValue(observed === totals[id].observed, 'series.' + id, 'покрытие не совпадает с итогом');
      var value = observed ? series.reduce(function (sum, point) {
        if (point.values[id] === null) return sum;
        return sum + point.values[id] * (metric.aggregation === 'mean' ? point.coverage[id].observed / observed : 1);
      }, 0) : null;
      requireValue(near(value, totals[id].value), 'totals.' + id, 'итог не совпадает с полной серией');
    });
    return freeze({source: data.source, period: data.period, dimensions: data.dimensions, metrics: data.metrics,
      rows: data.rows, rowCount: rowCount, totals: totals, series: series, query: slice});
  }
  var messages = {
    INVALID_DATA: 'Источник вернул некорректные данные.',
    UNSUPPORTED_VERSION: 'Версия данных не поддерживается.',
    INVALID_QUERY: 'Проверьте фильтры и период.',
    QUERY_MISMATCH: 'Источник вернул данные для другого среза.',
    RESPONSE_TOO_LARGE: 'Источник вернул слишком большой ответ. Сократите период или размер страницы.',
    HTTP_ERROR: 'Не удалось получить данные от сервера.',
    INVALID_JSON: 'Источник вернул некорректный ответ.',
    TIMEOUT: 'Источник не ответил вовремя. Повторите загрузку.',
    LOAD_FAILED: 'Не удалось загрузить данные. Повторите попытку.'
  };
  function createSession(options) {
    if (!options || typeof options.load !== 'function') throw new TypeError('createSession requires load({query, signal})');
    var timeoutMs = options.timeoutMs === undefined ? 30000 : options.timeoutMs;
    var mode = options.mode === undefined ? 'local' : options.mode;
    if (mode !== 'local' && mode !== 'server') throw new TypeError('mode must be local or server');
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) throw new RangeError('timeoutMs must be positive and <= 2147483647');
    var loader = options.load;
    var current = freeze({status: 'idle', query: query(), view: null, error: null});
    var listeners = new Set(), generation = 0, stopped = false, pending = null;
    var cancelled = {};
    function notify(next) {
      current = freeze(next);
      Array.from(listeners).some(function (listener) {
        if (current !== next) return true; // A subscriber started a newer transition.
        if (listeners.has(listener)) {
          try { listener(current); }
          catch (error) { if (typeof console !== 'undefined') console.error('dkDashboard: subscriber callback failed'); }
        }
        return false;
      });
    }
    function cancelPending() {
      if (pending) { var previous = pending; pending = null; previous.cancel(); }
    }
    async function load(requested) {
      if (stopped) return null;
      var token = ++generation;
      cancelPending();
      var slice;
      try { slice = query(requested); }
      catch (error) {
        // Keep the last valid query so retry never sends malformed input.
        notify({status: 'error', query: current.query, view: null, error: {code: 'INVALID_QUERY', message: messages.INVALID_QUERY}});
        return stopped || token !== generation ? null : current;
      }
      var controller = new AbortController(), timer;
      var cancelResolve;
      var cancellation = new Promise(function (resolve) { cancelResolve = resolve; });
      var task = {cancel: function () { clearTimeout(timer); controller.abort(); cancelResolve(cancelled); }};
      pending = task;
      notify({status: 'loading', query: slice, view: null, error: null});
      if (stopped || token !== generation) return null;
      try {
        var timeout = new Promise(function (resolve, reject) {
          timer = setTimeout(function () { reject(problem('TIMEOUT', messages.TIMEOUT)); controller.abort(); }, timeoutMs);
        });
        var result = await Promise.race([
          Promise.resolve().then(function () { return stopped || token !== generation ? cancelled : loader({query: slice, signal: controller.signal}); }),
          cancellation, timeout
        ]);
        if (result === cancelled || stopped || token !== generation) return null;
        var view = mode === 'server' ? validateResponse(result, slice) : select(result, slice);
        notify({status: view.rowCount ? 'ready' : 'empty', query: slice, view: view, error: null});
        return stopped || token !== generation ? null : current;
      } catch (error) {
        if (stopped || token !== generation) return null;
        var code = error && Object.prototype.hasOwnProperty.call(messages, error.code) ? error.code : 'LOAD_FAILED';
        notify({status: 'error', query: slice, view: null, error: {code: code, message: messages[code]}});
        return stopped || token !== generation ? null : current;
      } finally {
        clearTimeout(timer);
        if (pending === task) pending = null;
      }
    }
    return Object.freeze({
      load: load,
      retry: function () { return load(current.query); },
      getSnapshot: function () { return current; },
      subscribe: function (listener) {
        if (typeof listener !== 'function') throw new TypeError('subscribe requires a function');
        if (stopped) { listener(current); return function () {}; }
        listeners.add(listener);
        try { listener(current); } catch (error) { listeners.delete(listener); throw error; }
        return function () { listeners.delete(listener); };
      },
      destroy: function () {
        if (stopped) return;
        stopped = true; generation++; cancelPending();
        notify({status: 'destroyed', query: current.query, view: null, error: null});
        listeners.clear();
      }
    });
  }
  function fetchSource(url, options) {
    text(url, 'url');
    options = options || {};
    if (options.mode !== undefined && options.mode !== 'server' && options.mode !== 'local') throw new TypeError('mode must be local or server');
    var maxBytes = options.maxBytes === undefined ? 1048576 : options.maxBytes;
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError('maxBytes must be a positive safe integer');
    return async function (request) {
      var init = {signal: request.signal, headers: {Accept: 'application/json'}};
      if (options.mode === 'server') {
        init.method = 'POST'; init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(query(request.query));
      }
      var response = await fetch(url, init);
      if (!response.ok) throw problem('HTTP_ERROR', messages.HTTP_ERROR);
      var declared = response.headers && response.headers.get('content-length');
      if (declared && Number(declared) > maxBytes) {
        if (response.body) await response.body.cancel();
        throw problem('RESPONSE_TOO_LARGE', messages.RESPONSE_TOO_LARGE);
      }
      var body;
      if (response.body && typeof response.body.getReader === 'function') {
        var reader = response.body.getReader(), decoder = new TextDecoder(), bytes = 0;
        body = '';
        try {
          while (true) {
            var chunk = await reader.read(); if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > maxBytes) { await reader.cancel(); throw problem('RESPONSE_TOO_LARGE', messages.RESPONSE_TOO_LARGE); }
            body += decoder.decode(chunk.value, {stream: true});
          }
          body += decoder.decode();
        } finally { reader.releaseLock(); }
      } else if (typeof response.text === 'function') {
        body = await response.text();
        if (new TextEncoder().encode(body).byteLength > maxBytes) throw problem('RESPONSE_TOO_LARGE', messages.RESPONSE_TOO_LARGE);
      } else {
        // Test/host adapters may implement only json(); browsers use the bounded stream above.
        try { body = JSON.stringify(await response.json()); }
        catch (error) { throw problem('INVALID_JSON', messages.INVALID_JSON); }
        if (new TextEncoder().encode(body).byteLength > maxBytes) throw problem('RESPONSE_TOO_LARGE', messages.RESPONSE_TOO_LARGE);
      }
      try { return JSON.parse(body); }
      catch (error) { throw problem('INVALID_JSON', messages.INVALID_JSON); }
    };
  }
  window.dkDashboard = Object.freeze({version: '1.0.0', validate: validate, select: select, validateResponse: validateResponse, createSession: createSession, fetchSource: fetchSource});
})();
