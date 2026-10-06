/* ============================================================================
   dashboard-kit · dk-uptime.js
   Полоса доступности: сутки (или любой период) делениями.

   ---------------------------------------------------------------------------
   ПРАВИЛА

   1. ЦЕНА ДЕЛЕНИЯ НАЗВАНА. Полоса без неё не читается: «зелёно» без «каждое
      деление — 30 минут» не говорит, сбой длился минуту или час.

   2. ЛЕГЕНДА НУЖНА ДО ТОГО, КАК ПОНАДОБИТСЯ. Пока сбоев нет, полоса сплошь
      зелёная, и кажется, что объяснять нечего. В момент первого сбоя человек
      впервые увидит другой цвет — и будет гадать, что он значит, вместо того
      чтобы действовать.

   3. «НЕТ ДАННЫХ» — НЕ «РАБОТАЕТ». Деление, за которое замера не было,
      красится серым и называется в легенде. Закрасить его зелёным значит
      пообещать работоспособность, которую никто не проверял.
   ============================================================================ */

(function () {
  'use strict';

  var NAMES = { up: 'работает', warn: 'с перебоями', down: 'сбой', none: 'нет данных' };

  /* Неизвестное состояние сводится к «нет данных», а не подставляется как есть.
     Раньше 'partial' или 'maintenance' давали data-state, которому в CSS нет
     цвета, — деление становилось невидимым, — и подпись «undefined» в
     подсказке. Невидимое деление читается как «здесь ничего не произошло», то
     есть данные притворяются благополучием. Пустое место честнее.

     Предупреждение в консоль обязательно: молча свести чужое состояние к
     «нет данных» — значит спрятать от разработчика опечатку в его данных. */
  var SAID = {};
  function known(state) {
    var v = state || 'none';
    if (NAMES[v]) return v;
    if (!SAID[v]) {
      SAID[v] = true;
      console.warn('dk-uptime: неизвестное состояние «' + v + '» — показано как «нет данных». ' +
                   'Допустимые: ' + Object.keys(NAMES).join(', '));
    }
    return 'none';
  }

  /* Экранирование живёт в js/dk-util.js в единственном экземпляре. Здесь
     только обращение к нему: пять копий одной функции нельзя починить один раз,
     и именно так четыре файла остались вообще без экранирования. Если помощник
     не подключён, компонент обязан упасть громко, а не собрать разметку без
     экранирования и сделать вид, что всё хорошо. */
  function esc(s) {
    if (!window.dkEsc) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkEsc(s);
  }

  window.dkUptime = function (host, opts) {
    opts = opts || {};
    var rows = opts.rows || [];
    var step = opts.step || '';
    var labels = opts.labels || ['раньше', 'сейчас'];

    // Округление одинаковое во всей колонке, включая ровную сотню: «100%»
    // рядом с «95.7%» — это два разных правила в одном столбце, и числа
    // перестают сравниваться взглядом. Десятая доля здесь не педантизм:
    // в доступности 99.9 и 100 — разные вещи.
    function pct(data) {
      var known = data.filter(function (s) { return s && s !== 'none'; });
      if (!known.length) return null;
      var up = known.filter(function (s) { return s === 'up'; }).length;
      return (up / known.length * 100).toFixed(1);
    }

    function render() {
      var html = '<div class="dk-uptime">';

      rows.forEach(function (r, ri) {
        var p = pct(r.data || []);
        // Полосу делают ради вопроса «когда именно был сбой» — и раньше
        // ответ на него был только у мыши: деления не брали фокус, текста в
        // них нет, а скринридер слышал один итоговый процент. Теперь полоса
        // берёт фокус целиком, стрелки ходят по делениям, а выбранное
        // называется словами рядом.
        var breaks = (r.data || []).filter(function (x) { return x && x !== 'up'; }).length;
        html += '<div class="dk-uptime__row">' +
          '<span class="dk-uptime__name"><span class="dk-dot" style="--accent:var(--' +
          (p === null ? 'nodata' : p >= 99.5 ? 'calm' : p >= 95 ? 'high' : 'crit') + ')"></span>' +
          esc(r.name) + '</span>' +
          '<span class="dk-uptime__strip" tabindex="0" role="group" data-row="' + ri + '"' +
          ' aria-label="' + esc(r.name) + ', ' + (p === null ? 'нет данных' : p + '% доступности') +
          (breaks ? ', делений с перебоями: ' + breaks : '') +
          '. Стрелки — переход по делениям">' +
          (r.data || []).map(function (s, i) {
            var state = known(s);
            var when = r.times && r.times[i] ? r.times[i] + ' · ' : '';
            return '<span class="dk-uptime__seg" data-state="' + state + '" data-i="' + i + '"' +
                   ' title="' + esc(when + NAMES[state]) + '"></span>';
          }).join('') +
          '</span>' +
          '<span class="dk-uptime__v">' + (p === null ? '—' : p + '%') + '</span>' +
          '</div>';
      });

      // Правило 1 и 2: цена деления и легенда стоят всегда, а не появляются
      // вместе с первым сбоем.
      // Подписи оси времени стоят ПОД полосой, а не в колонках имени и
      // значения: «сейчас» в колонке процентов читается как ещё одна строка
      // списка — то есть как значение, которым оно не является.
      html += '<div class="dk-uptime__axis">' +
        '<span>' + esc(labels[0]) + '</span><span>' + esc(labels[1]) + '</span></div>';

      html += '<div class="dk-uptime__row" style="margin-top:var(--space-3)">' +
        '<span class="dk-uptime__name"></span>' +
        '<span class="dk-map__legend" style="flex:1">' +
          '<span class="dk-map__key"><i style="background:var(--calm)"></i>работает</span>' +
          '<span class="dk-map__key"><i style="background:var(--high)"></i>с перебоями</span>' +
          '<span class="dk-map__key"><i style="background:var(--crit)"></i>сбой</span>' +
          '<span class="dk-map__key"><i style="background:var(--nodata)"></i>нет данных</span>' +
        '</span>' +
        '<span class="dk-uptime__v"></span>' +
        '</div>';
      if (step) html += '<p class="dk-caption">Интервал: ' + esc(step) + '</p>';

      // Строка, в которую пишется выбранное деление. Живёт одна на весь
      // виджет: три одинаковых объявления подряд скринридер читает как шум.
      html += '<div class="dk-uptime__now" aria-live="polite"></div>';

      host.innerHTML = html + '</div>';
      wire();
    }

    function say(strip, i) {
      var r = rows[+strip.dataset.row];
      if (!r) return;
      var state = known((r.data || [])[i]);
      var when = r.times && r.times[i] ? r.times[i] : (step ? 'деление ' + (i + 1) : '');
      strip.querySelectorAll('.dk-uptime__seg').forEach(function (el) {
        el.toggleAttribute('data-at', +el.dataset.i === i);
      });
      var out = host.querySelector('.dk-uptime__now');
      if (out) out.textContent = r.name + ' · ' + (when ? when + ' · ' : '') + NAMES[state];
    }

    function wire() {
      host.querySelectorAll('.dk-uptime__strip').forEach(function (strip) {
        var at = 0;
        strip.addEventListener('keydown', function (e) {
          var d = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
          var n = strip.querySelectorAll('.dk-uptime__seg').length;
          if (d) { e.preventDefault(); at = Math.max(0, Math.min(n - 1, at + d)); say(strip, at); return; }
          if (e.key === 'Home') { e.preventDefault(); at = 0; say(strip, at); }
          if (e.key === 'End')  { e.preventDefault(); at = n - 1; say(strip, at); }
        });
        strip.addEventListener('focus', function () { say(strip, at); });
        // Касание по делению — тот же ответ, что и стрелкой.
        strip.addEventListener('click', function (e) {
          var seg = e.target.closest('.dk-uptime__seg');
          if (seg) { at = +seg.dataset.i; say(strip, at); }
        });
      });
    }

    render();

    return {
      setRows: function (list) { rows = list || []; render(); }
    };
  };
})();
