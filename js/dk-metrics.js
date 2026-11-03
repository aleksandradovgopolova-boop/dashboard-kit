/* Named metrics v1. Additive to dkDashboard snapshot v1; no expressions or eval. */
(function () {
  'use strict';
  function need(ok, path, message) {
    if (!ok) { var error = new Error(path + ': ' + message); error.code = 'INVALID_METRIC'; throw error; }
  }
  function object(value, allowed, path, optional) {
    need(value && typeof value === 'object' && !Array.isArray(value), path, 'ожидается объект');
    var proto = Object.getPrototypeOf(value);
    need(proto === null || Object.getPrototypeOf(proto) === null, path, 'ожидается обычный объект');
    need(!Object.getOwnPropertySymbols(value).length, path, 'символьные поля запрещены');
    Object.getOwnPropertyNames(value).forEach(function (key) {
      need(allowed.indexOf(key) >= 0 && !['__proto__', 'constructor', 'prototype'].includes(key), path, 'неизвестное поле ' + key);
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      need(!descriptor.get && !descriptor.set && descriptor.enumerable, path, 'вычисляемое или скрытое поле запрещено');
    });
    allowed.forEach(function (key) {
      if (!Object.hasOwn(value, key)) {
        need(!(key in value), path, 'унаследованное поле запрещено: ' + key);
        need((optional || []).includes(key), path, 'отсутствует поле ' + key);
      }
    });
  }
  function list(value, path) {
    need(Array.isArray(value) && Object.getOwnPropertyNames(value).length === value.length + 1 && !Object.getOwnPropertySymbols(value).length, path, 'ожидается плотный массив');
    for (var i = 0; i < value.length; i++) {
      var descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      need(descriptor && !descriptor.get && !descriptor.set && descriptor.enumerable, path, 'пропуск или вычисляемый элемент');
    }
    return value;
  }
  function text(value, path) { need(typeof value === 'string' && value.trim(), path, 'ожидается непустой текст'); return value; }
  function id(value, path) {
    text(value, path); need(/^[a-z][a-z0-9_-]*$/i.test(value) && !['constructor', 'prototype', '__proto__'].includes(value), path, 'неверный идентификатор'); return value;
  }
  function freeze(value) {
    if (value && typeof value === 'object') { Object.keys(value).forEach(function (key) { freeze(value[key]); }); Object.freeze(value); }
    return value;
  }
  function grain(value, path, source) {
    object(value, ['time', 'dimensions'], path);
    need((source ? ['day', 'month'] : ['day']).includes(value.time), path, 'поддерживается только дневная гранулярность метрики');
    var dimensions = list(value.dimensions, path + '.dimensions').map(function (key) { return id(key, path); }).sort();
    need(new Set(dimensions).size === dimensions.length, path, 'повтор измерения');
    return {time: value.time, dimensions: dimensions};
  }
  function validate(registry, snapshot) {
    object(registry, ['schemaVersion', 'metrics'], 'registry');
    need(registry.schemaVersion === 1, 'registry.schemaVersion', 'поддерживается версия 1');
    var fields = new Map(snapshot.metrics.map(function (field) { return [field.id, field]; })), seen = new Set();
    var dimensions = snapshot.dimensions.map(function (dimension) { return dimension.id; });
    var metrics = list(registry.metrics, 'registry.metrics').map(function (metric, index) {
      var path = 'registry.metrics[' + index + ']';
      object(metric, ['id', 'label', 'unit', 'format', 'better', 'grain', 'aggregation', 'inputs', 'scale'], path, ['scale']);
      var name = id(metric.id, path + '.id'); need(!seen.has(name), path, 'повтор метрики'); seen.add(name);
      need(['ratio-of-sums', 'weighted-mean'].includes(metric.aggregation), path, 'поддерживаются ratio-of-sums и weighted-mean');
      need(['increase', 'decrease', 'neutral'].includes(metric.better), path + '.better', 'нужно явное направление');
      object(metric.format, ['type', 'digits'], path + '.format');
      need(['number', 'percent', 'decimal'].includes(metric.format.type) && Number.isInteger(metric.format.digits) && metric.format.digits >= 0 && metric.format.digits <= 6, path + '.format', 'неверный формат');
      var required = metric.aggregation === 'ratio-of-sums' ? ['numerator', 'denominator'] : ['value', 'weight'];
      object(metric.inputs, required, path + '.inputs'); var inputs = {};
      required.forEach(function (key) {
        var field = id(metric.inputs[key], path + '.inputs.' + key); need(fields.has(field), path, 'неизвестное исходное поле ' + field);
        need((metric.aggregation !== 'ratio-of-sums' && key !== 'weight') || fields.get(field).aggregation === 'sum', path, 'для суммы нужно аддитивное исходное поле ' + field);
        inputs[key] = field;
      });
      var inputGrain = grain(metric.grain, path + '.grain', false);
      inputGrain.dimensions.forEach(function (key) { need(dimensions.includes(key), path, 'неизвестное измерение ' + key); });
      var scale = metric.scale === undefined ? 1 : metric.scale;
      need(typeof scale === 'number' && Number.isFinite(scale) && scale > 0, path + '.scale', 'ожидается положительное конечное число');
      return {id: name, label: text(metric.label, path + '.label'), unit: text(metric.unit, path + '.unit'),
        format: {type: metric.format.type, digits: metric.format.digits}, better: metric.better,
        grain: inputGrain, aggregation: metric.aggregation, inputs: inputs, scale: scale};
    });
    need(metrics.length > 0, 'registry.metrics', 'нужна метрика');
    return freeze({schemaVersion: 1, metrics: metrics});
  }
  function select(input, registry, requested, options) {
    // validate rejects server responses/views: their page is never the population.
    var data = window.dkDashboard.validate(input), definitions = validate(registry, data);
    var view = window.dkDashboard.select(data, requested), query = view.query;
    options = options === undefined ? {} : options; object(options, ['grain', 'coverage'], 'options', ['grain', 'coverage']);
    var sourceGrain = options.grain === undefined ? null : grain(options.grain, 'options.grain', true);
    if (sourceGrain) sourceGrain.dimensions.forEach(function (key) { need(data.dimensions.some(function (d) { return d.id === key; }), 'options.grain', 'неизвестное измерение ' + key); });
    var expected = null;
    if (options.coverage !== undefined) {
      object(options.coverage, ['expectedRows'], 'options.coverage'); expected = options.coverage.expectedRows;
      need(Number.isSafeInteger(expected) && expected >= data.rows.length, 'options.coverage.expectedRows', 'ожидается полная численность источника не меньше rows.length');
    }
    var rows = data.rows.filter(function (row) {
      return row.date >= view.period.from && row.date <= view.period.to && Object.keys(query.filters).every(function (key) { return !query.filters[key].length || query.filters[key].includes(row.dimensions[key]); });
    });
    var unique = new Set(), duplicate = false;
    if (sourceGrain) data.rows.forEach(function (row) {
      var key = JSON.stringify([row.date].concat(sourceGrain.dimensions.map(function (dimension) { return row.dimensions[dimension]; })));
      if (unique.has(key)) duplicate = true; unique.add(key);
    });
    var totals = {};
    definitions.metrics.forEach(function (metric) {
      var code = expected === null ? 'coverage-unknown' : expected !== data.rows.length ? 'incomplete-source' :
        !sourceGrain ? 'grain-unknown' : JSON.stringify(sourceGrain) !== JSON.stringify(metric.grain) ? 'incompatible-grain' : duplicate ? 'ambiguous-grain' : 'ready';
      var numerator = 0, denominator = 0, observed = 0;
      rows.forEach(function (row) {
        var a = row.values[metric.inputs.numerator || metric.inputs.value], b = row.values[metric.inputs.denominator || metric.inputs.weight];
        if (metric.aggregation === 'weighted-mean' && b !== null) need(b >= 0, metric.id, 'вес не может быть отрицательным');
        if (a !== null && b !== null) { observed++; numerator += metric.aggregation === 'weighted-mean' ? a * b : a; denominator += b; }
      });
      if (code === 'ready') code = !rows.length ? 'empty' : observed !== rows.length ? 'partial-input' : !Number.isFinite(numerator) || !Number.isFinite(denominator) ? 'overflow' : denominator === 0 ? 'zero-denominator' : 'ready';
      var value = code === 'ready' ? numerator / denominator * metric.scale : null;
      if (value !== null && !Number.isFinite(value)) { value = null; code = 'overflow'; }
      totals[metric.id] = {value: value, code: code, observed: observed, total: rows.length,
        partial: observed < rows.length || expected !== null && expected !== data.rows.length};
    });
    return freeze({schemaVersion: 1, metrics: definitions.metrics, totals: totals, query: query, period: view.period,
      rowCount: rows.length, sourceCoverage: {expected: expected, actual: data.rows.length}});
  }
  window.dkMetrics = Object.freeze({version: '1.0.0', validate: function (registry, input) { return validate(registry, window.dkDashboard.validate(input)); }, select: select});
})();
