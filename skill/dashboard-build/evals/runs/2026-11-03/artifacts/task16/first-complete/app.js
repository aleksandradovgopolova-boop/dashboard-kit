(function () {
  'use strict';
  var source = window.MONITORING_SOURCE;
  var model = window.familyMortgageData;
  var state = {district: 'all', view: null, detailId: null};
  var select, detail = dkModal('#detail');
  var names = {crit: 'Сильно отстаёт', high: 'Отстаёт', calm: 'По плану', missing: 'Без оценки'};
  function el(id) { return document.getElementById(id); }
  function number(value) { return dkFmt.num(value, 1); }
  function status(value) {
    var tone = value === 'missing' ? '' : ' dk-status--' + value;
    var icon = value === 'calm' ? 'check' : value === 'missing' ? 'minus' : 'alert-triangle';
    return '<span class="dk-status' + tone + '">' + dkIcon(icon, 'dk-i dk-i--sm') + dkEsc(names[value]) + '</span>';
  }
  function metric(label, value, secondary, id) {
    return '<section class="dk-widget dk-widget--s dk-tile dk-tile--compact"><div class="dk-tile__head"><h3 class="dk-tile__label">' + dkEsc(label) + '</h3></div><div class="dk-tile__row"><span class="dk-metric-lg" id="' + dkEsc(id) + '">' + dkEsc(value) + '</span></div><div class="dk-caption">' + dkEsc(secondary) + '</div></section>';
  }
  function render() {
    var view = model.select(source, {district: state.district});
    state.view = view;
    el('attention').textContent = dkFmt.num(view.counts.behind) + ' из ' + dkFmt.num(view.counts.total) + (view.counts.total === 1 ? ' региона' : ' регионов');
    el('assessment').textContent = 'Без оценки: ' + dkFmt.num(view.counts.missing);
    el('performance').textContent = dkFmt.pct(view.kpis.planPct, 1);
    el('issued').textContent = dkFmt.num(view.kpis.issued) + ' из ' + dkFmt.num(view.kpis.issuedPlan) + ' кредитов';
    if (view.kpis.coverage.issued.partial || view.kpis.coverage.issuedPlan.partial) el('issued').textContent += ' · Неполные данные';
    el('result').hidden = state.district === 'all';
    el('result').textContent = 'Регионов: ' + dkFmt.num(view.counts.total);
    el('region-rows').innerHTML = view.ranking.map(function (region) {
      return '<tr data-region="' + dkEsc(region.id) + '"><td><button type="button" class="dk-btn dk-btn--ghost" data-open-region="' + dkEsc(region.id) + '" aria-label="Детали: ' + dkEsc(region.name) + '">' + dkEsc(region.name) + '</button><div class="dk-td-main__sub">' + dkEsc(region.fdName) + ' округ</div></td><td>' + status(region.status) + '</td><td class="dk-td-num" data-value="issued">' + dkFmt.num(region.issued) + ' / ' + dkFmt.num(region.issuedPlan) + '</td><td class="dk-td-num" data-value="performance">' + number(region.planPct) + '</td><td class="dk-td-num" data-value="lag">' + number(region.lag) + '</td></tr>';
    }).join('');
    el('empty').hidden = view.counts.total !== 0;
    el('regions').hidden = !view.counts.total;
  }
  function openRegion(id, opener) {
    var region = state.view.regions.find(function (row) { return row.id === id; });
    if (!region) return false;
    state.detailId = id;
    el('detail-title').textContent = region.name;
    el('detail-context').textContent = region.fdName + ' округ · Апрель — май 2025';
    el('detail-status').innerHTML = status(region.status);
    el('detail-metrics').innerHTML = metric('Выполнение плана выдач', dkFmt.pct(region.planPct, 1), dkFmt.num(region.issued) + ' из ' + dkFmt.num(region.issuedPlan) + ' кредитов', 'detail-performance') + metric('Недовыполнение', number(region.lag) + ' п.п.', 'План: 100%', 'detail-lag');
    el('month-rows').innerHTML = region.monthly.map(function (month) {
      return '<tr data-month="' + dkEsc(month.month) + '"><th scope="row">' + dkEsc(month.label) + '</th><td class="dk-td-num">' + dkFmt.num(month.issued) + '</td><td class="dk-td-num">' + dkFmt.num(month.issuedPlan) + '</td><td class="dk-td-num">' + number(month.planPct) + '</td><td class="dk-td-num">' + number(month.lag) + '</td><td>' + status(month.status) + '</td></tr>';
    }).join('');
    if (opener) opener.focus();
    detail.open();
    return true;
  }
  try {
    source = model.validate(source);
    var options = model.select(source).options.districts.map(function (d) { return {value: d.id, name: d.name + ' округ', count: model.select(source, {district: d.id}).counts.total}; });
    options.unshift({value: 'all', name: 'Все округа', count: model.select(source).counts.total});
    select = dkSelect(el('district'), {label: 'Округ', mode: 'single', defaultValue: 'all', value: 'all', options: options, onChange: function (value) { state.district = value || 'all'; render(); }});
    dkTooltip(el('method'), {text: 'Недовыполнение = max(0; 100 − факт / план × 100), п.п. ≥20 — «Сильно отстаёт»; >0 — «Отстаёт»; иначе «По плану». Источник: учебный numeric-oracle; охват — 2 региона набора.'});
    render();
    el('region-rows').addEventListener('click', function (event) { var trigger = event.target.closest('[data-open-region]'); if (trigger) openRegion(trigger.dataset.openRegion, trigger); });
    el('detail').addEventListener('close', function () { state.detailId = null; });
    window.monitoring = Object.freeze({
      get state() { return {district: state.district, detailId: state.detailId}; },
      get view() { return state.view; },
      selectDistrict: function (value) { select.set(value); state.district = value || 'all'; render(); },
      openRegion: function (id) { return openRegion(id, document.querySelector('[data-open-region="' + CSS.escape(id) + '"]')); },
      closeDetail: function () { detail.close('back'); },
      load: function (input) { source = model.validate(input); render(); }
    });
  } catch (error) {
    el('error').hidden = false;
    el('metrics').hidden = true;
    el('regions').hidden = true;
    console.error(error);
  }
})();
