/* The visible numeric alternative is the single source for this fixed widget. */
(function () {
  'use strict';
  var root = document.getElementById('weekly-requests-root');
  var rows = Array.from(root.querySelectorAll('#weekly-requests-table tbody tr'));
  var data = rows.map(function (row) {
    var cell = row.querySelector('[data-value]');
    var value = Number(cell.dataset.value);
    cell.textContent = dkFmt.num(value);
    return { day: row.dataset.day, value: value };
  });
  var chart = dkChart(document.getElementById('weekly-requests-chart'), {
    type: 'bar',
    label: 'Обращения за неделю, с понедельника по воскресенье, количество обращений',
    categories: data.map(function (row) { return row.day; }),
    series: [{ name: 'Обращений', data: data.map(function (row) { return row.value; }) }]
  });
  var method = dkTooltip(document.getElementById('weekly-requests-method'), {
    text: 'Источник — значения из задания за семь дней Пн–Вс. Каждый столбец показывает число обращений за день. Календарные даты, время обновления и правила учёта обращений не переданы.'
  });
  window.weeklyRequests = {
    chart: chart,
    setTheme: function (theme) {
      if (theme !== 'dark' && theme !== 'light') throw new TypeError('Expected dark or light');
      method.hide();
      root.dataset.theme = theme;
    },
    destroy: function () { method.destroy(); chart.destroy(); }
  };
}());
