/* ============================================================================
   dashboard-kit · dk-calendar.js
   Календарь событий: месяц и неделя с часами.

   Это не выбор периода (тот живёт в dk-period.js и построен на чужой
   библиотеке). Здесь другая задача: не «назови дату», а «покажи, что
   происходит» — плановые отключения, ремонты, проверки, аварии.

   ---------------------------------------------------------------------------
   ПРАВИЛА

   1. ЦВЕТ СОБЫТИЯ — ЭТО СМЫСЛ, А НЕ УКРАШЕНИЕ.
      Событие красится по своему виду: авария — красным, работа с ограничением
      — жёлтым, плановое — синим, завершённое — зелёным. Календарь, где цвета
      розданы по кругу, врёт так же, как график с произвольной палитрой.

   2. СЕТКА МЕСЯЦА ВСЕГДА В ШЕСТЬ СТРОК.
      В месяце помещается от четырёх с половиной до шести недель. Рисовать
      столько, сколько вышло, значит заставлять страницу прыгать при каждом
      перелистывании.

   3. СОБЫТИЕ ДЛИННЕЕ ДНЯ РИСУЕТСЯ ОДНОЙ ПОЛОСОЙ, А НЕ ПОВТОРЯЕТСЯ В КАЖДОМ ДНЕ.
      Повторённое имя читается как несколько разных работ: «Ремонт теплотрассы»
      четыре дня подряд выглядит как четыре ремонта. Полоса поперёк недели
      показывает то, что есть на самом деле, — одну работу длиной в четыре дня.
      На переносе через воскресенье полоса обрывается и продолжается на
      следующей строке: это край недели, а не край работы.

   4. ЛИШНИЕ СОБЫТИЯ НЕ ПРЯЧУТСЯ МОЛЧА — «ещё N».

   5. СУТКИ В НЕДЕЛЬНОМ ВИДЕ ПОКАЗЫВАЮТСЯ ЦЕЛИКОМ.
      Соблазн показать «рабочие часы» с 8 до 20 велик, но авария в три часа
      ночи — это тоже работа, и спрятать её значит соврать о сутках. Колонка
      прокручивается и открывается на первом событии дня.
   ============================================================================ */

(function () {
  'use strict';

  var WEEK = 7;
  var ROWS = 6;                      // правило 2
  var DAY_MIN = 1440;

  // Виды событий. Ключ — смысл, значение — семантический токен кита.
  var KINDS = {
    crit:  'crit',                 // авария, отключение без предупреждения
    high:  'high',                 // работа на сети, ограничение
    calm:  'calm',                 // завершено
    event: 'event',                // событие без оценки риска
    plan:  '--brand'                 // плановое, наше собственное
  };

  /* Экранирование живёт в js/dk-util.js в единственном экземпляре. Здесь
     только обращение к нему: пять копий одной функции нельзя починить один раз,
     и именно так четыре файла остались вообще без экранирования. Если помощник
     не подключён, компонент обязан упасть громко, а не собрать разметку без
     экранирования и сделать вид, что всё хорошо. */
  function esc(s) {
    if (!window.dkEsc) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkEsc(s);
  }
  function num(v) {
    if (!window.dkNum) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkNum(v, 48);
  }

  /* --- время ---------------------------------------------------------------
     Дату разбираем руками. new Date('2026-09-14') читается как UTC, и восточнее
     Гринвича день уезжает на предыдущий — ошибка, которую замечают в ноябре,
     когда отчёт за октябрь не сходится на день.                              */
  function parseWhen(v) {
    if (v instanceof Date) {
      return { day: new Date(v.getFullYear(), v.getMonth(), v.getDate()),
               min: v.getHours() * 60 + v.getMinutes() };
    }
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(v));
    if (!m) return null;

    // Формат совпал — это ещё не дата. «2026-13-45» проходит регулярку, а
    // new Date(2026, 12, 45) молча превращается в 14 февраля 2027 года и
    // показывается как настоящая. Молчащая неверная дата в календаре работ
    // хуже пустого места: по ней выедет бригада.
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
    if (m[4] != null && (+m[4] > 23 || +m[5] > 59)) return null;

    return {
      day: d,
      min: m[4] != null ? +m[4] * 60 + +m[5] : null      // null — весь день
    };
  }

  function key(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }

  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function diffDays(a, b) { return Math.round((b - a) / 86400000); }
  function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function startOfWeek(d) { return addDays(d, -((d.getDay() + 6) % WEEK)); }
  function hhmm(min) {
    return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  }

  var fmtMonth = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
  var fmtDayFull = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });
  var fmtDayShort = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

  function weekdayNames(opts) {
    var f = new Intl.DateTimeFormat('ru-RU', opts);
    var out = [];
    for (var i = 0; i < WEEK; i++) out.push(f.format(new Date(2024, 0, 1 + i)));
    return out;                      // 2024-01-01 — понедельник
  }

  /* --- раскладка полос -----------------------------------------------------
     Дорожки: событие занимает первую свободную, где оно ни с кем не пересекается
     по дням. Так две работы, идущие параллельно, встают друг под другом, а не
     налезают одна на другую.                                                 */
  function assignLanes(items) {
    var lanes = [];
    items.forEach(function (it) {
      var l = 0;
      while (lanes[l] && lanes[l].some(function (o) {
        return !(o.to < it.from || o.from > it.to);
      })) l++;
      (lanes[l] = lanes[l] || []).push(it);
      it.lane = l;
    });
    return lanes.length;
  }

  /* Пересекающиеся по времени события делят ширину колонки: иначе верхнее
     накрывает нижнее, и человек не узнает, что в этот час работ было две. */
  function assignColumns(items) {
    var cols = [];
    items.forEach(function (it) {
      var c = 0;
      while (cols[c] && cols[c].some(function (o) {
        return !(o.till <= it.from || o.from >= it.till);
      })) c++;
      (cols[c] = cols[c] || []).push(it);
      it.col = c;
    });
    items.forEach(function (it) {
      // Ширина считается по самой плотной группе, в которую событие попало.
      var group = items.filter(function (o) {
        return !(o.till <= it.from || o.from >= it.till);
      });
      it.cols = Math.max.apply(null, group.map(function (o) { return o.col + 1; }));
    });
    return cols.length;
  }

  window.dkCalendar = function (host, opts) {
    window.dkDestroy(host);
    var stopped = false, releases = [];
    var agendaMedia = window.matchMedia('(max-width: 767px), (pointer: coarse)');
    function listen(node, type, callback) {
      node.addEventListener(type, callback);
      releases.push(function () { node.removeEventListener(type, callback); });
    }
    opts = opts || {};

    var onSelect = opts.onSelect || function () {};
    var onEvent = opts.onEvent || function () {};
    var max = opts.max != null ? opts.max : 3;
    // Разобранная дата или сегодня. Раньше здесь стояло parseWhen(x).day: на
    // всём, что не «ГГГГ-ММ-ДД», parseWhen возвращает null, и календарь падал
    // прямо при создании — то есть одна кривая строка в настройках убирала с
    // экрана весь виджет.
    function day(v, fallback) {
      var r = v != null ? parseWhen(v) : null;
      return r ? r.day : (fallback !== undefined ? fallback : parseWhen(new Date()).day);
    }

    var today = day(opts.today);
    var hourPx = opts.hourHeight || 48;

    var events = [];
    var view = opts.view === 'week' ? 'week' : 'month';
    var anchor = day(opts.month || opts.week, today);
    var cursor = null;
    var selected = opts.value ? day(opts.value, null) : null;

    host.className = 'dk-cal';
    host.innerHTML =
      '<div class="dk-cal__head">' +
        '<button type="button" class="dk-iconbtn dk-iconbtn--sm" data-go="-1" title="Назад" aria-label="Назад">' +
          '<svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-chevron-left"/></svg></button>' +
        '<div class="dk-cal__month" aria-live="polite"></div>' +
        '<button type="button" class="dk-iconbtn dk-iconbtn--sm" data-go="1" title="Вперёд" aria-label="Вперёд">' +
          '<svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-chevron-right"/></svg></button>' +
        '<button type="button" class="dk-btn dk-btn--sm" data-go="today">Сегодня</button>' +
        '<div class="dk-seg dk-seg--sm" role="group" aria-label="Вид календаря">' +
          '<button type="button" data-view="month" aria-pressed="true">Месяц</button>' +
          '<button type="button" data-view="week" aria-pressed="false">Неделя</button>' +
        '</div>' +
      '</div>' +
      '<div class="dk-cal__body"></div>';

    var titleEl = host.querySelector('.dk-cal__month');
    var bodyEl = host.querySelector('.dk-cal__body');

    function setEvents(list) {
      events = (list || []).map(function (e) {
        var a = parseWhen(e.date || e.start);
        if (!a) return null;
        var b = e.end ? parseWhen(e.end) : null;
        var timed = a.min != null;
        var endDay = b ? b.day : a.day;
        // Событие с часами, растянутое на несколько дней, показываем полосой:
        // рисовать его в колонке часов пришлось бы кусками, и человек считал
        // бы куски за отдельные работы.
        if (timed && !sameDay(a.day, endDay)) timed = false;
        return {
          name: e.name, kind: e.kind, raw: e,
          day: a.day, endDay: endDay,
          timed: timed,
          from: timed ? a.min : 0,
          till: timed ? (b && b.min != null ? b.min : Math.min(a.min + 60, DAY_MIN)) : DAY_MIN
        };
      }).filter(Boolean);
    }

    function eventsOn(d) {
      return events.filter(function (e) { return d >= e.day && d <= e.endDay; });
    }

    function tone(e) { return e.kind === 'plan' ? 'var(--brand)' : window.dkMeaning(KINDS[e.kind] || 'event', 'fill'); }

    function label(e) {
      return (e.timed ? hhmm(e.from) + ' ' : '') + e.name;
    }

    /* --- месяц ------------------------------------------------------------ */
    function renderMonth() {
      titleEl.textContent = fmtMonth.format(anchor).replace(' г.', '');

      var first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      var start = startOfWeek(first);
      var html = '<div class="dk-cal__week" aria-hidden="true">' +
        weekdayNames({ weekday: 'short' }).map(function (n) {
          return '<div class="dk-cal__wd">' + esc(n) + '</div>';
        }).join('') + '</div><div class="dk-cal__grid" role="grid">';

      for (var w = 0; w < ROWS; w++) {
        var weekStart = addDays(start, w * WEEK);
        var weekEnd = addDays(weekStart, WEEK - 1);

        // Отрезки событий, попавших в эту неделю. Правило 3: одна полоса на
        // работу, обрезанная краями недели.
        var segs = events.filter(function (e) {
          return e.endDay >= weekStart && e.day <= weekEnd;
        }).map(function (e) {
          return {
            e: e,
            from: Math.max(0, diffDays(weekStart, e.day)),
            to: Math.min(WEEK - 1, diffDays(weekStart, e.endDay)),
            headless: e.day < weekStart,
            tailless: e.endDay > weekEnd
          };
        }).sort(function (a, b) {
          return (a.from - b.from) || ((b.to - b.from) - (a.to - a.from));
        });

        var lanes = assignLanes(segs);
        var shown = segs.filter(function (s) { return s.lane < max; });

        // Сколько работ в каждом дне не поместилось.
        var rest = [];
        for (var i = 0; i < WEEK; i++) {
          rest[i] = segs.filter(function (s) {
            return s.lane >= max && s.from <= i && s.to >= i;
          }).length;
        }

        // role="row" обязателен: gridcell без строки — это сетка, у которой в
        // дереве доступности нет строк. Часть читалок на такой сетке
        // перестаёт объявлять координаты и переходы, то есть человек слышит
        // даты, но не понимает, где он в месяце.
        html += '<div class="dk-cal__row" role="row" style="--lanes:' + Math.min(lanes, max) + '">';

        for (var c = 0; c < WEEK; c++) {
          var d = addDays(weekStart, c);
          var own = d.getMonth() === anchor.getMonth();
          var list = eventsOn(d);
          html += '<div class="dk-cal__day" role="gridcell" style="grid-column:' + (c + 1) + '"' +
            (own ? '' : ' data-other="true"') +
            (sameDay(d, today) ? ' data-today="true"' : '') +
            (sameDay(d, selected) ? ' aria-selected="true"' : '') +
            ' data-date="' + key(d) + '" tabindex="' +
            ((cursor ? sameDay(d, cursor) : (own && d.getDate() === 1)) ? '0' : '-1') + '"' +
            ' aria-label="' + esc(fmtDayFull.format(d)) +
            (list.length ? ', событий: ' + list.length : '') + '">' +
            '<span class="dk-cal__n">' + d.getDate() + '</span>' +
            (rest[c] > 0 ? '<span class="dk-cal__more">ещё ' + rest[c] + '</span>' : '') +
            '</div>';
        }

        shown.forEach(function (s) {
          html += '<button type="button" class="dk-cal__e" tabindex="-1"' +
            ' data-id="' + events.indexOf(s.e) + '"' +
            ' style="--accent:' + tone(s.e) + ';grid-column:' + (s.from + 1) + ' / span ' +
            (s.to - s.from + 1) + ';grid-row:' + (s.lane + 2) + '"' +
            (s.headless ? ' data-headless="true"' : '') +
            (s.tailless ? ' data-tailless="true"' : '') +
            ' title="' + esc(label(s.e)) + '">' + esc(label(s.e)) + '</button>';
        });

        html += '</div>';
      }

      bodyEl.innerHTML = html + '</div>';
    }

    /* --- неделя ------------------------------------------------------------ */
    function renderWeek() {
      var start = startOfWeek(anchor);
      var end = addDays(start, WEEK - 1);
      titleEl.textContent = fmtDayShort.format(start) + ' — ' + fmtDayShort.format(end) +
                            ' ' + end.getFullYear();

      if (agendaMedia.matches) {
        var agenda = '<div class="dk-cal__agenda">';
        for (var ai = 0; ai < WEEK; ai++) {
          var date = addDays(start, ai);
          var list = eventsOn(date).slice().sort(function (a, b) { return a.from - b.from; });
          agenda += '<section><button class="dk-btn" type="button" data-date="' + key(date) + '" aria-pressed="' + String(selected && sameDay(selected, date) || false) + '">' + esc(fmtDayShort.format(date)) + '</button><ul>';
          agenda += list.map(function (event) {
            return '<li><button class="dk-btn dk-btn--ghost" type="button" data-id="' + events.indexOf(event) + '">' + esc(event.timed ? hhmm(event.from) + '–' + hhmm(event.till) + ' · ' + event.name : event.name + ' · весь день') + '</button></li>';
          }).join('') || '<li>Нет событий</li>';
          agenda += '</ul></section>';
        }
        bodyEl.innerHTML = agenda + '</div>';
        return;
      }
      var names = weekdayNames({ weekday: 'short' });
      var html = '<div class="dk-cal__wgrid">';

      // Шапка: дни недели с числами.
      html += '<div class="dk-cal__gutter"></div>';
      for (var c = 0; c < WEEK; c++) {
        var d = addDays(start, c);
        html += '<button type="button" class="dk-cal__wd dk-cal__wd--day"' +
          (sameDay(d, today) ? ' data-today="true"' : '') +
          ' data-date="' + key(d) + '">' + esc(names[c]) +
          ' <span class="dk-cal__n">' + d.getDate() + '</span></button>';
      }

      // Полоса событий на весь день и длиннее дня — над сеткой часов: в часах
      // им места нет, а прятать их нельзя.
      var segs = events.filter(function (e) {
        return !e.timed && e.endDay >= start && e.day <= end;
      }).map(function (e) {
        return { e: e,
                 from: Math.max(0, diffDays(start, e.day)),
                 to: Math.min(WEEK - 1, diffDays(start, e.endDay)),
                 headless: e.day < start, tailless: e.endDay > end };
      }).sort(function (a, b) { return (a.from - b.from) || ((b.to - b.from) - (a.to - a.from)); });
      var lanes = assignLanes(segs);

      html += '<div class="dk-cal__allday" style="--lanes:' + Math.max(lanes, 1) + '">';
      segs.forEach(function (s) {
        html += '<button type="button" class="dk-cal__e" data-id="' + events.indexOf(s.e) + '"' +
          ' style="--accent:' + tone(s.e) + ';grid-column:' + (s.from + 1) + ' / span ' +
          (s.to - s.from + 1) + ';grid-row:' + (s.lane + 1) + '"' +
          (s.headless ? ' data-headless="true"' : '') +
          (s.tailless ? ' data-tailless="true"' : '') +
          ' title="' + esc(s.e.name) + '">' + esc(s.e.name) + '</button>';
      });
      html += '</div>';

      // Часы: сутки целиком (правило 5).
      html += '<div class="dk-cal__hours" style="--hour:' + num(hourPx) + 'px">';
      for (var h = 0; h < 24; h++) {
        html += '<div class="dk-cal__hour"><span>' + String(h).padStart(2, '0') + ':00</span></div>';
      }
      for (var c2 = 0; c2 < WEEK; c2++) {
        var day = addDays(start, c2);
        var list = events.filter(function (e) { return e.timed && sameDay(e.day, day); })
                         .sort(function (a, b) { return a.from - b.from; });
        assignColumns(list);

        html += '<div class="dk-cal__col"' + (sameDay(day, today) ? ' data-today="true"' : '') +
                ' style="grid-column:' + (c2 + 2) + '">';
        list.forEach(function (e) {
          var top = e.from / DAY_MIN * 100;
          var height = Math.max((e.till - e.from) / DAY_MIN * 100, 1.4);
          html += '<button type="button" class="dk-cal__t" data-id="' + events.indexOf(e) + '"' +
            ' style="--accent:' + tone(e) + ';top:' + top.toFixed(3) + '%;height:' + height.toFixed(3) + '%;' +
            'left:' + (e.col / e.cols * 100).toFixed(2) + '%;width:' + (100 / e.cols).toFixed(2) + '%"' +
            ' title="' + esc(hhmm(e.from) + '—' + hhmm(e.till) + ' · ' + e.name) + '">' +
            '<span class="dk-cal__tt">' + esc(hhmm(e.from)) + '</span> ' + esc(e.name) + '</button>';
        });
        html += '</div>';
      }
      html += '</div></div>';

      bodyEl.innerHTML = html;

      // Открываемся на первом событии недели, а не на полуночи: ночь чаще
      // всего пуста, и человек иначе каждый раз прокручивает сам.
      var box = bodyEl.querySelector('.dk-cal__hours');
      var firstTimed = events.filter(function (e) {
        return e.timed && e.day >= start && e.day <= end;
      }).sort(function (a, b) { return a.from - b.from; })[0];
      if (box) box.scrollTop = ((firstTimed ? firstTimed.from : 7 * 60) / DAY_MIN) * box.scrollHeight - 16;
    }

    function render() {
      if (stopped) return;
      host.setAttribute('data-view', view);
      host.querySelectorAll('[data-view]').forEach(function (b) {
        if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.view === view));
      });
      view === 'week' ? renderWeek() : renderMonth();
    }

    function step(delta) {
      var hadFocus = bodyEl.contains(document.activeElement);
      anchor = view === 'week'
        ? addDays(anchor, delta * WEEK)
        : new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
      // Курсор переносится в тот же месяц, а не обнуляется: PageDown обнулял
      // его, render() переписывал тело, и фокус проваливался на <body>.
      // Человек нажимал «следующий месяц» и оказывался в начале документа,
      // после чего заново шёл табом через шапку, меню и фильтры. В move()
      // возврат фокуса сделан, а в step() его забыли.
      cursor = view === 'week' ? startOfWeek(anchor)
                               : new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      render();
      if (hadFocus) {
        var cell = bodyEl.querySelector('[data-date="' + key(cursor) + '"]');
        if (cell) cell.focus();
      }
    }

    function move(days) {
      var base = cursor || (view === 'week' ? startOfWeek(anchor)
                                            : new Date(anchor.getFullYear(), anchor.getMonth(), 1));
      var next = addDays(base, days);
      cursor = next;
      var outside = view === 'week'
        ? (next < startOfWeek(anchor) || next > addDays(startOfWeek(anchor), 6))
        : (next.getMonth() !== anchor.getMonth() || next.getFullYear() !== anchor.getFullYear());
      if (outside) anchor = view === 'week' ? next : new Date(next.getFullYear(), next.getMonth(), 1);
      render();
      var cell = bodyEl.querySelector('[data-date="' + key(next) + '"]');
      if (cell) cell.focus();
    }

    listen(host, 'click', function (e) {
      var v = e.target.closest('[data-view]');
      if (v && v.tagName === 'BUTTON') { view = v.dataset.view; cursor = null; render(); return; }

      var go = e.target.closest('[data-go]');
      if (go) {
        if (go.dataset.go === 'today') { anchor = today; cursor = today; render(); }
        else step(Number(go.dataset.go));
        return;
      }

      var ev = e.target.closest('[data-id]');
      if (ev) { var it = events[+ev.dataset.id]; if (it) onEvent(it.raw); return; }

      var cell = e.target.closest('[data-date]');
      if (cell) {
        selected = parseWhen(cell.dataset.date).day;
        cursor = selected;
        render();
        var again = bodyEl.querySelector('[data-date="' + cell.dataset.date + '"]');
        if (again) again.focus();
        onSelect(selected, eventsOn(selected).map(function (x) { return x.raw; }));
      }
    });

    listen(bodyEl, 'keydown', function (e) {
      var s = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -WEEK, ArrowDown: WEEK }[e.key];
      if (s) {
        if (view === 'week' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
        e.preventDefault(); move(s); return;
      }
      if (e.key === 'PageUp')   { e.preventDefault(); step(-1); return; }
      if (e.key === 'PageDown') { e.preventDefault(); step(1); return; }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        var base = cursor || new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        var shift = (base.getDay() + 6) % WEEK;
        move(e.key === 'Home' ? -shift : (WEEK - 1 - shift));
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        var cell = e.target.closest('[data-date]');
        if (!cell) return;
        e.preventDefault();
        selected = parseWhen(cell.dataset.date).day;
        render();
        var again = bodyEl.querySelector('[data-date="' + cell.dataset.date + '"]');
        if (again) again.focus();
        onSelect(selected, eventsOn(selected).map(function (x) { return x.raw; }));
      }
    });

    function onAgendaChange() {
      var focused = host.contains(document.activeElement);
      render();
      if (focused) host.querySelector('[data-view="' + view + '"]').focus();
    }
    listen(agendaMedia, 'change', onAgendaChange);
    var destroy = window.dkOwn(host, function () {
      stopped = true; releases.forEach(function (off) { off(); }); host.replaceChildren();
    });
    setEvents(opts.events);
    render();

    return {
      destroy: destroy,
      update: function (next) {
        if (stopped) return; next = next || {};
        if (next.events) setEvents(next.events);
        if (next.view) view = next.view === 'week' ? 'week' : 'month';
        render();
      },
      get value() { return selected; },
      get view() { return view; },
      set view(v) { view = v === 'week' ? 'week' : 'month'; render(); },
      setEvents: function (list) { setEvents(list); render(); },
      goTo: function (d) { var p = parseWhen(d); if (p) { anchor = p.day; cursor = p.day; render(); } }
    };
  };
})();
