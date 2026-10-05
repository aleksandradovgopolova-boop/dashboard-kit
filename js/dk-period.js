/* ============================================================================
   dashboard-kit · dk-period.js
   Выбор периода: пресеты «7 / 30 / 365 дней» и произвольный диапазон.

   Почему не свой календарь: календарь — это месяцы чужой работы над мелочами,
   которых не видно, пока не столкнёшься. Переходы через границу месяца и года,
   високосный февраль, летнее время, первый день недели, склонение месяцев,
   стрелки и Home/End внутри сетки дней, объявление выбранного диапазона
   скринридеру. Написать это самим — неделя работы и годы багов доступности.
   Поэтому внутри лежит Air Datepicker (MIT), а здесь — только то, ради чего
   он в ките: поведение фильтра и цвет из токенов.

   Air Datepicker выбран из-за одной вещи: он отдаёт наружу 70 CSS-переменных,
   то есть перекрашивается целиком нашими токенами. Сравнивался с flatpickr,
   у которого таких переменных нет вовсе — цвета вшиты в код, и его пришлось
   бы перебивать поверх. Кит это запрещает: цвет живёт в одном месте.

   ---------------------------------------------------------------------------
   ПРАВИЛА ПОВЕДЕНИЯ — те же, что у фильтра, и по той же причине: период
   врёт дороже всех остальных фильтров. Человек, который смотрит на график за
   неделю, думая, что видит год, сделает неверный вывод и не заметит этого.

   1. ВЫБРАННОЕ ВИДНО, НЕ ОТКРЫВАЯ КАЛЕНДАРЬ.
      На фильтре стоит либо имя пресета, либо сами даты. «Период» без значения
      не пишем никогда, когда значение есть.

   2. ВЫБОР ПРИМЕНЯЕТСЯ СРАЗУ И ЗАКРЫВАЕТ КАЛЕНДАРЬ.
      Пресет — по щелчку. Произвольный диапазон — когда названа вторая дата:
      до этого момента выбор не закончен. Кнопки «Применить» нет намеренно:
      она добавляет шаг, на котором человек забывает нажать и уходит с
      несохранённым выбором.

   3. ПОЛОВИНУ ДИАПАЗОНА НЕ ПРИМЕНЯЕМ.
      Если календарь закрыли, назвав одну дату, возвращается прежний период.
      Иначе «с 5 октября по 5 октября» молча подменит собой год данных.

   4. СБРОС ЖИВЁТ НА САМОМ ФИЛЬТРЕ, А НЕ ВНУТРИ КАЛЕНДАРЯ.

   5. ВЫБРАННЫЙ ПРЕСЕТ ОТМЕЧЕН ГАЛОЧКОЙ, А НЕ ТОЛЬКО ЦВЕТОМ.

   6. БУДУЩЕГО В ДАШБОРДЕ НЕТ.
      Дни после сегодняшнего закрыты: данных за них не существует, и выбрать
      их — значит получить пустой график и не понять, почему.
   ============================================================================ */

(function () {
  'use strict';

  var ICON_CAL   = '<svg class="dk-i dk-i--sm"><use href="#ti-calendar"/></svg>';
  var ICON_X     = '<svg class="dk-i dk-i--sm"><use href="#ti-x"/></svg>';
  var ICON_CHECK = '<svg class="dk-i dk-menu__mark"><use href="#ti-check"/></svg>';
  var ICON_PREV  = '<svg class="dk-i dk-i--sm"><use href="#ti-chevron-left"/></svg>';
  var ICON_NEXT  = '<svg class="dk-i dk-i--sm"><use href="#ti-chevron-right"/></svg>';

  var DAY = 86400000;

  var PRESETS = [
    /* Сутки — первый пресет, и появился он не для полноты списка. На странице
       аварий всё живёт в пределах смены: норматив измеряется часами, бригада
       выезжает сегодня, просрочка считается от открытия. Семь дней там — это
       «покажи заодно прошлую неделю», то есть ответ не на тот вопрос.
       Название без числа: «последние сутки» человек читает быстрее, чем
       «последний 1 день», и по-русски это единственная нормальная форма. */
    { days: 1,   name: 'Последние сутки'    },
    { days: 7,   name: 'Последние 7 дней'   },
    { days: 30,  name: 'Последние 30 дней'  },
    { days: 365, name: 'Последние 365 дней' }
  ];

  /* Шестая копия экранирования — её ревьюер даже не заметил, нашла проверка.
     Живёт помощник в js/dk-util.js в единственном экземпляре. */
  function esc(s) {
    if (!window.dkEsc) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkEsc(s);
  }

  // Границы суток. Период «по 5 октября» обязан включать весь день целиком:
  // иначе записи, сделанные днём, молча выпадут из выборки по дате с нулевым
  // временем — это ошибка, которую замечают через недели.
  function dayStart(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function dayEnd(d)   { var x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
  function sameDay(a, b) { return dayStart(a).getTime() === dayStart(b).getTime(); }

  function lastDays(n, today) {
    // «Последние 7 дней» — это сегодня и шесть предыдущих, а не сегодня минус
    // семь: человек считает дни вместе с текущим.
    return { from: dayStart(new Date(today.getTime() - (n - 1) * DAY)), to: dayEnd(today) };
  }


  // Диапазон подписывается одним правилом кита — dkFmt.range: «11–24 сен»,
  // «28 авг – 4 сен», год только если не текущий. Раньше здесь было своё
  // правило на Intl: «1 — 10 сент. 2026» — с годом, длинным тире и
  // «сент.», то есть не так, как все остальные даты кита, и длиннее, чем
  // влезает в пилюлю фильтра. Нашёл исполнитель проверочной задачи скилла
  // (29.09): на странице ему пришлось обходить это через dkFmt.range.
  function rangeLabel(from, to) {
    if (!window.dkFmt) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return sameDay(from, to) ? window.dkFmt.date(from) : window.dkFmt.range(from, to);
  }

  function own(el, destroy) {
    if (!window.dkOwn) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkOwn(el, destroy);
  }

  window.dkPeriod = function (host, opts) {
    opts = opts || {};

    if (typeof window.AirDatepicker !== 'function') {
      throw new Error('dk-period: не подключён vendor/air-datepicker.js');
    }

    var label    = opts.label || 'Период';
    var onChange = opts.onChange || function () {};
    var presets  = opts.presets || PRESETS;
    var today    = opts.today ? new Date(opts.today) : new Date();
    var maxDate  = opts.maxDate !== undefined ? opts.maxDate : dayEnd(today);
    var minDate  = opts.minDate || '';

    var value = null;      // { from, to, preset } либо null
    var open = false;
    var release = null;   // dkAnchor: меню поверх страницы на телефоне
    var dp = null;         // календарь создаём при первом открытии
    var draft = null;      // незаконченный выбор внутри календаря

    host.className = 'dk-select dk-period' + (opts.size ? ' dk-select--' + opts.size : '');
    host.innerHTML =
      '<button type="button" class="dk-select__trigger" aria-haspopup="dialog" aria-expanded="false"></button>' +
      '<div class="dk-menu dk-period__menu" hidden role="dialog" aria-label="' + esc(label) + '">' +
        '<ul class="dk-menu__list dk-period__presets" role="list"></ul>' +
        '<div class="dk-period__cal"></div>' +
      '</div>';

    var trigger  = host.querySelector('.dk-select__trigger');
    var menu     = host.querySelector('.dk-menu');
    var presetEl = host.querySelector('.dk-period__presets');
    var calEl    = host.querySelector('.dk-period__cal');

    /* Период из адреса: «14d» — пресет, «2026-09-11..2026-09-24» — свой
       диапазон. Главнее opts.value по той же причине, что и у фильтра: ссылка
       на срез обязана открыть этот срез. Ниже, в apply, значение пишется
       обратно — в том же виде. */
    function fromUrl(s) {
      if (!s) return null;
      var m = /^(\d+)d$/.exec(s);
      if (m) return { preset: Number(m[1]) };
      m = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(s);
      return m ? { from: m[1], to: m[2] } : null;
    }
    function toUrl(v) {
      if (!v) return null;
      if (v.preset) return v.preset + 'd';
      var iso = function (d) { return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate(); };
      return iso(v.from) + '..' + iso(v.to);
    }
    var изАдреса = opts.url && window.dkUrl ? normalize(fromUrl(window.dkUrl.get(opts.url))) : null;
    if (изАдреса) apply(изАдреса, true);
    else if (opts.value) apply(normalize(opts.value), true);

    function normalize(v) {
      if (!v) return null;
      if (v.preset != null) {
        var p = presets.filter(function (x) { return String(x.days) === String(v.preset); })[0];
        if (p) { var r = lastDays(p.days, today); r.preset = p.days; return r; }
      }
      if (v.from && v.to) {
        // new Date('чушь') — это Invalid Date, а не исключение: падает уже
        // Intl.format, куда эта дата доезжает как готовая. Кривой срез в
        // настройках убирал с экрана весь выбор периода.
        var f = new Date(v.from), t = new Date(v.to);
        if (isNaN(f) || isNaN(t)) return null;
        return { from: dayStart(f), to: dayEnd(t), preset: null };
      }
      return null;
    }

    function renderTrigger() {
      host.setAttribute('data-active', value ? 'true' : 'false');

      var text = label;
      var exact = '';
      if (value) {
        exact = rangeLabel(value.from, value.to);
        text = value.preset ? presetName(value.preset) : exact;
      }

      trigger.innerHTML =
        ICON_CAL +
        '<span class="dk-select__label">' + esc(text) + '</span>' +
        (value
          ? '<span class="dk-select__clear" role="button" tabindex="0" aria-label="Сбросить период">' + ICON_X + '</span>'
          : '<svg class="dk-i dk-i--sm dk-select__caret"><use href="#ti-chevron-down"/></svg>');

      // Пресет на кнопке — это имя, а не даты. Точные даты нужны всё равно:
      // отдаём их скринридеру и всплывающей подсказке, не занимая места.
      trigger.setAttribute('aria-label', label + (value ? ': ' + text + (value.preset ? ', ' + exact : '') : ': не выбран'));
      if (value) trigger.setAttribute('title', exact); else trigger.removeAttribute('title');
    }

    function presetName(days) {
      var p = presets.filter(function (x) { return x.days === days; })[0];
      return p ? p.name : days + ' дней';
    }

    function renderPresets() {
      presetEl.innerHTML = presets.map(function (p) {
        var on = !!(value && value.preset === p.days);
        return '<li role="listitem"><button type="button" class="dk-menu__item" data-days="' + p.days + '"' +
          ' aria-pressed="' + on + '">' + ICON_CHECK +
          '<span class="dk-menu__name">' + esc(p.name) + '</span></button></li>';
      }).join('');
    }

    function apply(next, quiet) {
      value = next;
      draft = null;
      renderTrigger();
      renderPresets();
      if (!quiet) {
        if (opts.url && window.dkUrl) window.dkUrl.set(opts.url, toUrl(value));
        onChange(value ? { from: value.from, to: value.to, preset: value.preset } : null);
      }
    }

    // Библиотека сообщает о выборе и тогда, когда даты проставлены из кода, —
    // причём асинхронно, уже после возврата из selectDate. Флага «не слушать»
    // тут мало: он успевает сброситься. Поэтому глушим на стороне библиотеки,
    // её же параметром silent. Без этого открытие фильтра само себе «выбирало»
    // диапазон и сбрасывало пресет.
    function syncCalendar() {
      if (!dp) return;
      dp.clear({ silent: true });
      if (value) {
        dp.selectDate([value.from, value.to], { silent: true });
        dp.setViewDate(value.to);
      }
    }

    function buildCalendar() {
      dp = new window.AirDatepicker(calEl, {
        inline: true,
        range: true,
        dynamicRange: true,
        toggleSelected: false,      // повторный щелчок по дате не снимает её:
                                    // в диапазоне это почти всегда промах мышью
        keyboardNav: true,
        minDate: minDate,
        maxDate: maxDate,
        prevHtml: ICON_PREV,
        nextHtml: ICON_NEXT,
        navTitles: { days: 'MMMM yyyy', months: 'yyyy', years: 'yyyy1 — yyyy2' },
        onSelect: function (e) {
          var dates = [].concat(e.date || []);
          if (dates.length < 2) { draft = dates[0] || null; return; }
          var a = dates[0], b = dates[1];
          if (a > b) { var t = a; a = b; b = t; }
          apply({ from: dayStart(a), to: dayEnd(b), preset: null });
          close(true);            // правило 2: диапазон назван — применили
        }
      });
      syncCalendar();
    }

    function pickPreset(days) {
      var r = lastDays(Number(days), today);
      r.preset = Number(days);
      apply(r);
      syncCalendar();
      close(true);                // правило 2
    }

    function clear() {
      if (!value) return;
      apply(null);
      syncCalendar();
    }

    function show() {
      if (open) return;
      open = true;
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      if (!dp) buildCalendar(); else syncCalendar();

      // Календарь, не помещающийся справа, разворачивается влево.
      menu.classList.remove('dk-menu--right');
      if (menu.getBoundingClientRect().right > window.innerWidth - 8) {
        menu.classList.add('dk-menu--right');
      }
      // На телефоне календарь поверх страницы: строка фильтров листается вбок
      // и обрезала бы его (dkAnchor в dk-util.js).
      if (window.dkAnchor) release = window.dkAnchor(menu, trigger, closeSelf);

      document.dispatchEvent(new CustomEvent('dk-popup', { detail: closeSelf }));
      document.addEventListener('mousedown', onOutside, true);
      var first = presetEl.querySelector('.dk-menu__item');
      if (first) first.focus();
    }

    function close(focusBack) {
      if (!open) return;
      open = false;
      if (release) { release(); release = null; }
      // Правило 3: половину диапазона не применяем — возвращаем прежний период.
      if (draft) { draft = null; syncCalendar(); }
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', onOutside, true);
      // Возврат фокуса обязателен: без него человек, работающий с клавиатуры,
      // после закрытия оказывается в начале страницы.
      if (focusBack) trigger.focus();
    }

    function closeSelf() { close(false); }

    function onOutside(e) { if (!host.contains(e.target)) close(false); }

    // Одновременно открыт может быть только один всплывающий слой: два меню
    // рядом человек читает как одно и щёлкает не туда.
    function onPopup(e) { if (e.detail !== closeSelf) close(false); }
    document.addEventListener('dk-popup', onPopup);

    trigger.addEventListener('click', function (e) {
      if (e.target.closest('.dk-select__clear')) { e.stopPropagation(); clear(); return; }
      open ? close(true) : show();
    });

    trigger.addEventListener('keydown', function (e) {
      if (e.target.closest('.dk-select__clear') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); e.stopPropagation(); clear(); return;
      }
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); show(); return; }
      // Помечаем событие обработанным, только если действительно закрыли
      // всплывашку. Иначе Escape на закрытом поле съедал бы закрытие
      // модального окна, в котором это поле стоит.
      if (e.key === 'Escape' && open) { e.preventDefault(); close(true); }
    });

    menu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-days]');
      if (b) pickPreset(b.dataset.days);
    });

    // Стрелки ходят по пресетам. Внутри календаря стрелки принадлежат ему —
    // там ими двигают по дням, и перехватывать их нельзя.
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      if (!presetEl.contains(e.target)) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      var items = Array.prototype.slice.call(presetEl.querySelectorAll('.dk-menu__item'));
      var i = items.indexOf(e.target);
      if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = items.length - 1;
      else i = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[i].focus();
    });

    renderTrigger();
    renderPresets();

    return {
      get value() { return value ? { from: value.from, to: value.to, preset: value.preset } : null; },
      // Готовая подпись — для строки применённых фильтров: там период должен
      // называться ровно так же, как на самом фильтре, иначе человек решит,
      // что это два разных ограничения.
      get text() { return value ? (value.preset ? presetName(value.preset) : rangeLabel(value.from, value.to)) : ''; },
      set: function (v) { apply(normalize(v), true); syncCalendar(); },
      clear: clear,
      // Та же история, что и у графика: destroy() был, но звать его никто не
      // обязан, а подписки висят на документе и переживают узел. Теперь за
      // погребением следит сторож из dk-util.js.
      destroy: own(host, function () {
        document.removeEventListener('dk-popup', onPopup);
        document.removeEventListener('mousedown', onOutside, true);
        if (dp) { dp.destroy(); dp = null; }
        close(false);
        host.innerHTML = '';
      })
    };
  };
})();
