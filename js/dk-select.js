/* ============================================================================
   dashboard-kit · dk-select.js
   Выпадающий фильтр: одиночный выбор, множественный, с поиском.

   Почему не нативный <select>: в дашборде фильтру нужно показывать количество
   записей за каждым значением, отмечать несколько значений сразу и оставаться
   открытым при этом. Нативный список ничего из этого не умеет. Взамен всё,
   что нативный список даёт даром, приходится делать руками — и сделано здесь:
   стрелки, Home/End, Escape с возвратом фокуса, объявление для скринридера.

   ---------------------------------------------------------------------------
   ПРАВИЛА ПОВЕДЕНИЯ. Они важнее внешнего вида: фильтр — это место, где человек
   чаще всего обманывается насчёт того, какие данные перед ним.

   1. ВЫБРАННОЕ ВИДНО, НЕ ОТКРЫВАЯ МЕНЮ.
      Фильтр, который после выбора продолжает показывать «Все округа», —
      источник самых дорогих ошибок: человек смотрит на срез и думает, что
      видит всё. Поэтому подпись меняется на значение, а сам фильтр окрашивается.

   2. ОДИНОЧНЫЙ ВЫБОР ПРИМЕНЯЕТСЯ СРАЗУ И ЗАКРЫВАЕТ МЕНЮ.
      Множественный остаётся открытым: человек ещё не закончил. Смешивать эти
      два поведения нельзя — пользователь перестаёт понимать, когда фильтр
      сработал.

   3. РЯДОМ СО ЗНАЧЕНИЕМ СТОИТ ЧИСЛО ЗАПИСЕЙ.
      Без него выбор делается вслепую и приводит в пустой результат.
      Значение с нулём не прячем, а показываем приглушённым: «здесь пусто» —
      это тоже ответ.

   4. СБРОС ЖИВЁТ НА САМОМ ФИЛЬТРЕ, А НЕ ВНУТРИ МЕНЮ.
      Снять фильтр должно быть так же легко, как поставить.

   5. ВЫБОР ОТМЕЧЕН НЕ ТОЛЬКО ЦВЕТОМ.
      Галочка или квадратик — обязательны: цвет видят не все.
   ============================================================================ */

(function () {
  'use strict';

  var ICON_CHECK = '<svg class="dk-i"><use href="#ti-check"/></svg>';
  var ICON_CARET = '<svg class="dk-i dk-i--sm dk-select__caret"><use href="#ti-chevron-down"/></svg>';
  var ICON_X = '<svg class="dk-i dk-i--sm"><use href="#ti-x"/></svg>';
  var ICON_SEARCH = '<svg class="dk-i dk-i--sm"><use href="#ti-search"/></svg>';

  var openOne = null;   // одновременно открыт может быть только один фильтр

  /* Экранирование живёт в js/dk-util.js в единственном экземпляре. Здесь
     только обращение к нему: пять копий одной функции нельзя починить один раз,
     и именно так четыре файла остались вообще без экранирования. Если помощник
     не подключён, компонент обязан упасть громко, а не собрать разметку без
     экранирования и сделать вид, что всё хорошо. */
  function esc(s) {
    if (!window.dkEsc) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkEsc(s);
  }

  function plural(n, one, few, many) {
    var m = n % 100;
    if (m >= 11 && m <= 14) return many;
    m = n % 10;
    return m === 1 ? one : (m >= 2 && m <= 4 ? few : many);
  }

  function own(el, destroy) {
    if (!window.dkOwn) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkOwn(el, destroy);
  }

  var SEQ = 0;

  window.dkSelect = function (host, opts) {
    window.dkDestroy(host);
    var stopped = false;
    opts = opts || {};
    var mode = opts.mode === 'multi' ? 'multi' : 'single';
    var options = opts.options || [];
    var label = opts.label || 'Фильтр';
    var onChange = opts.onChange || function () {};

    // Поиск включается по длине списка, а не по настроению: короткий список
    // с полем поиска выглядит недоверчиво, длинный без поиска — беспомощно.
    var search = opts.search != null ? opts.search : options.length > 8;

    // Значение из адреса главнее значения из настроек: ссылка на срез
    // обязана открыть именно этот срез (см. dk-util.js, «состояние в адресе»).
    var изАдреса = opts.url && window.dkUrl ? window.dkUrl.get(opts.url) : null;
    var selected = new Set(изАдреса != null ? изАдреса.split(',').filter(Boolean)
                                            : (opts.value ? [].concat(opts.value) : []));
    var query = '';
    var cursor = -1;
    var uid = 'dk-sel-' + (++SEQ);
    var open = false;
    var release = null;   // dkAnchor: меню поверх страницы на телефоне

    host.className = 'dk-select' + (opts.size ? ' dk-select--' + opts.size : '');
    host.innerHTML =
      '<button type="button" class="dk-select__trigger" aria-haspopup="listbox" aria-expanded="false"></button>' +
      '<div class="dk-menu" hidden role="presentation"></div>';

    var trigger = host.querySelector('.dk-select__trigger');
    var menu = host.querySelector('.dk-menu');

    function visible() {
      if (!query) return options;
      var q = query.toLowerCase();
      return options.filter(function (o) { return o.name.toLowerCase().indexOf(q) >= 0; });
    }

    function renderTrigger() {
      var n = selected.size;
      host.setAttribute('data-active', n ? 'true' : 'false');

      var text = label;
      if (n === 1) {
        var only = options.filter(function (o) { return selected.has(o.value); })[0];
        text = only ? only.name : label;
      } else if (n > 1) {
        text = label;
      }

      trigger.innerHTML =
        '<span class="dk-select__label">' + esc(text) + '</span>' +
        (n > 1 ? '<span class="dk-select__count">' + n + '</span>' : '') +
        (n ? '<span class="dk-select__clear" role="button" tabindex="0" aria-label="Сбросить фильтр «' +
             esc(label) + '»">' + ICON_X + '</span>' : ICON_CARET);

      // Скринридеру подпись сообщается целиком: «Округ: Центральный».
      trigger.setAttribute('aria-label',
        label + (n === 1 ? ': ' + text : n > 1 ? ': выбрано ' + n : ': не выбрано'));
    }

    function renderMenu() {
      var list = visible();
      var head = search
        ? '<div class="dk-menu__search">' + ICON_SEARCH +
          '<input type="search" value="' + esc(query) + '" placeholder="Поиск" aria-label="Поиск по списку">' +
          '</div>'
        : '';

      var body = list.length
        ? '<ul class="dk-menu__list" role="listbox" id="' + uid + '-list"' +
          (mode === 'multi' ? ' aria-multiselectable="true"' : '') + '>' +
          list.map(function (o, i) {
            var on = selected.has(o.value);
            var mark = mode === 'multi'
              ? '<span class="dk-menu__box">' + ICON_CHECK + '</span>'
              : '<svg class="dk-i dk-menu__mark"><use href="#ti-check"/></svg>';
            return '<li role="presentation"><button type="button" class="dk-menu__item" role="option"' +
              ' id="' + uid + '-opt-' + i + '"' +
              ' aria-selected="' + on + '" data-value="' + esc(o.value) + '"' +
              (i === cursor ? ' data-cursor="true"' : '') + '>' +
              mark +
              '<span class="dk-menu__name">' + esc(o.name) + '</span>' +
              (o.count != null ? '<span class="dk-menu__n">' + esc(o.count) + '</span>' : '') +
              '</button></li>';
          }).join('') + '</ul>'
        : '<div class="dk-menu__empty">Ничего не найдено</div>';

      var foot = (mode === 'multi' && list.length)
        ? '<div class="dk-menu__foot"><span>' + selected.size + ' ' +
          plural(selected.size, 'выбрано', 'выбрано', 'выбрано') + '</span>' +
          // Кнопка называет действие, которое произойдёт, а не то, которое
          // произошло: нажав «Выбрать все» второй раз, человек молча остаётся
          // без фильтра и смотрит на другой срез, чем думает.
          '<button type="button" class="dk-btn dk-btn--ghost dk-btn--sm" data-act="all">' +
          (list.every(function (o) { return selected.has(o.value); }) ? 'Снять выбор' : 'Выбрать все') +
          '</button>' +
          '</div>'
        : '';

      // Поле поиска сохраняется: пересоздание на каждый ввод теряет фокус,
      // выделение и составной ввод (IME). Обновляем только пункты и подвал.
      var input = menu.querySelector('input');
      if (!input) {
        menu.innerHTML = head;
        input = menu.querySelector('input');
        if (input) {
          input.addEventListener('input', function () {
            query = input.value; cursor = -1; renderMenu();
          });
          input.addEventListener('keydown', onKey);
        }
      }
      var searchHead = input && input.parentNode;
      Array.from(menu.children).forEach(function (child) {
        if (child !== searchHead) child.remove();
      });
      if (input && input.value !== query) input.value = query;
      menu.insertAdjacentHTML('beforeend', body + foot);

      /* Скринридеру нужно сказать, ГДЕ стоит курсор. Раньше курсор жил только
         в data-cursor и в подсветке: стрелки двигали видимую рамку, а
         озвучивалось молчание — человек слышал «список из девяти» и дальше
         ничего. aria-activedescendant называет текущий пункт, не уводя с него
         фокус: фокус остаётся в поле поиска, чтобы можно было продолжать
         набирать. */
      syncActive();

      menu.querySelectorAll('.dk-menu__item').forEach(function (b) {
        b.addEventListener('click', function () { pick(b.dataset.value); });
      });

      var all = menu.querySelector('[data-act="all"]');
      if (all) all.addEventListener('click', function () {
        var list2 = visible();
        var every = list2.every(function (o) { return selected.has(o.value); });
        list2.forEach(function (o) { every ? selected.delete(o.value) : selected.add(o.value); });
        renderTrigger(); renderMenu(); emit();
      });

      // Меню, не помещающееся справа, разворачивается влево.
      menu.classList.remove('dk-menu--right');
      var box = menu.getBoundingClientRect();
      if (box.right > window.innerWidth - 8) menu.classList.add('dk-menu--right');
    }

    function pick(value) {
      if (mode === 'multi') {
        selected.has(value) ? selected.delete(value) : selected.add(value);
        renderTrigger(); renderMenu(); emit();
        return;                                   // правило 2: меню не закрываем
      }
      selected.clear();
      selected.add(value);
      renderTrigger(); emit();
      close(true);                                // правило 2: применили и закрыли
    }

    function clear() {
      if (stopped) return;
      if (!selected.size) return;
      selected.clear();
      renderTrigger();
      if (open) renderMenu();
      emit();
    }

    function emit() {
      var v = mode === 'multi' ? Array.from(selected) : (Array.from(selected)[0] || null);
      if (opts.url && window.dkUrl) window.dkUrl.set(opts.url, v);
      onChange(v);
    }

    function show() {
      if (open) return;
      if (openOne && openOne !== close) openOne();
      open = true; cursor = -1; query = '';
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      renderMenu();
      // На телефоне меню поверх страницы: строка фильтров листается вбок и
      // обрезала бы его (dkAnchor в dk-util.js).
      if (window.dkAnchor) release = window.dkAnchor(menu, trigger, function () { close(false); });
      var input = menu.querySelector('input');
      if (input) input.focus();
      openOne = close;
      // О своём открытии слой сообщает всем остальным: одновременно открыт
      // может быть только один. Через событие, а не через общую переменную,
      // потому что фильтр и календарь живут в разных файлах.
      document.dispatchEvent(new CustomEvent('dk-popup', { detail: close }));
      document.addEventListener('mousedown', onOutside, true);
    }

    function close(focusBack) {
      if (!open) return;
      open = false;
      menu.hidden = true;
      if (release) { release(); release = null; }
      trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', onOutside, true);
      if (openOne === close) openOne = null;
      // Возврат фокуса обязателен: без него человек, работающий с клавиатуры,
      // после закрытия оказывается в начале страницы.
      if (focusBack) trigger.focus();
    }

    function onOutside(e) { if (!host.contains(e.target)) close(false); }

    function focusHolder() { return menu.querySelector('input') || trigger; }

    function syncActive() {
      var holder = focusHolder();
      var cur = cursor >= 0 ? menu.querySelector('#' + uid + '-opt-' + cursor) : null;
      [menu.querySelector('input'), trigger].forEach(function (el) {
        if (!el) return;
        if (el === holder && cur) el.setAttribute('aria-activedescendant', cur.id);
        else el.removeAttribute('aria-activedescendant');
      });
      var ul = menu.querySelector('.dk-menu__list');
      if (ul && holder) holder.setAttribute('aria-controls', ul.id);
      else if (holder) holder.removeAttribute('aria-controls');
    }

    /* Уход фокуса за пределы поля закрывает список. Раньше закрывал только
       щелчок мимо: человек уходил табом, меню оставалось висеть поверх
       страницы и перехватывало следующий Escape. */
    function onFocusout(e) {
      if (!open) return;
      if (e.relatedTarget && host.contains(e.relatedTarget)) return;
      if (!e.relatedTarget) return;      // уход фокуса в никуда — не повод
      close(false);
    }
    host.addEventListener('focusout', onFocusout);

    function onKey(e) {
      var list = visible();
      // Пометка ставится, только когда список открыт: Escape на закрытом поле
      // принадлежит слою выше — модальному окну, в котором это поле стоит.
      if (e.key === 'Escape') { if (open) e.preventDefault(); close(true); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) { show(); return; }
        cursor += e.key === 'ArrowDown' ? 1 : -1;
        if (cursor < 0) cursor = list.length - 1;
        if (cursor >= list.length) cursor = 0;
        renderMenu();
        var cur = menu.querySelector('[data-cursor="true"]');
        if (cur) cur.scrollIntoView({ block: 'nearest' });
        var inp = menu.querySelector('input'); if (inp) inp.focus();
        return;
      }
      if (e.key === 'Home' || e.key === 'End') {
        if (!open) return;
        e.preventDefault();
        cursor = e.key === 'Home' ? 0 : list.length - 1;
        renderMenu();
        var inp2 = menu.querySelector('input'); if (inp2) inp2.focus();
        return;
      }
      if (e.key === 'Enter') {
        if (!open) { e.preventDefault(); show(); return; }
        if (cursor >= 0 && list[cursor]) { e.preventDefault(); pick(list[cursor].value); }
      }
    }

    // Подписка на «закройся, открылось другое» висит на документе, то есть
    // переживает свой узел. Раньше снятой она не была вообще: у списка не было
    // destroy(), и убранный со страницы список продолжал слушать и писать в
    // собственный innerHTML, которого уже никто не видит.
    function onPopup(e) { if (e.detail !== close) close(false); }
    document.addEventListener('dk-popup', onPopup);

    var destroy = own(host, function () {
      stopped = true;
      close(false);
      host.removeEventListener('focusout', onFocusout);
      document.removeEventListener('dk-popup', onPopup);
      document.removeEventListener('mousedown', onOutside, true);
      host.innerHTML = '';
    });

    trigger.addEventListener('click', function (e) {
      if (e.target.closest('.dk-select__clear')) { e.stopPropagation(); clear(); return; }
      open ? close(true) : show();
    });
    trigger.addEventListener('keydown', function (e) {
      if (e.target.closest('.dk-select__clear') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); e.stopPropagation(); clear(); return;
      }
      onKey(e);
    });

    renderTrigger();

    return {
      get value() { return mode === 'multi' ? Array.from(selected) : (Array.from(selected)[0] || null); },
      set: function (v) { if (stopped) return; selected = new Set(v ? [].concat(v) : []); renderTrigger(); if (open) renderMenu(); },
      destroy: destroy,
      update: function (next) {
        if (stopped) return;
        next = next || {};
        if (next.options) options = next.options;
        if (Object.prototype.hasOwnProperty.call(next, 'value')) selected = new Set(next.value ? [].concat(next.value) : []);
        renderTrigger(); if (open) renderMenu();
      },
      clear: clear,
      setOptions: function (next) { if (stopped) return; options = next || []; renderTrigger(); if (open) renderMenu(); }
    };
  };
})();
