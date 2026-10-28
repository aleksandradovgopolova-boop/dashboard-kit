/* ============================================================================
   dashboard-kit · dk-pager.js
   Постраничная навигация по таблице.

   ---------------------------------------------------------------------------
   ПРАВИЛА

   1. ВСЕГДА ВИДНО, СКОЛЬКО ВСЕГО.
      «Показано 21–40 из 89» отвечает сразу на три вопроса: где я, сколько
      вижу и сколько есть. Пагинация из одних стрелок оставляет человека без
      представления о размере данных — он листает вслепую и не знает, десять
      там записей или десять тысяч.

   2. КРАЙНИЕ КНОПКИ ОТКЛЮЧАЮТСЯ, А НЕ ИСЧЕЗАЮТ.
      Исчезнувшая кнопка сдвигает соседнюю под курсор, и следующий щелчок
      попадает не туда, куда целились. Это самая обидная ошибка в списках:
      человек хотел «вперёд», а получил «в конец».

   3. ТЕКУЩАЯ СТРАНИЦА ОТМЕЧЕНА НЕ ТОЛЬКО ЦВЕТОМ — заливкой и aria-current.

   4. СТРАНИЦЫ НЕ ПЕРЕЧИСЛЯЮТСЯ ВСЕ.
      Больше семи номеров подряд человек не читает, а пересчитывает. Показываем
      окно вокруг текущей и края, между ними — многоточие.

   5. РАЗМЕР СТРАНИЦЫ — ЭТО ВЫБОР ЧЕЛОВЕКА, А НЕ ТАЙНА.
      Если строк на странице фиксировано двадцать, об этом надо сказать; если
      можно поменять — дать поменять.
   ============================================================================ */

(function () {
  'use strict';

  var ICON_PREV = '<svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-chevron-left"/></svg>';
  var ICON_NEXT = '<svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-chevron-right"/></svg>';

  function plural(n, one, few, many) {
    var m = n % 100;
    if (m >= 11 && m <= 14) return many;
    m = n % 10;
    return m === 1 ? one : (m >= 2 && m <= 4 ? few : many);
  }

  function nfmt(n) {
    // Разряды неразрывным пробелом: в дашборде числа читают, а не считают.
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /* Окно номеров: края всегда, вокруг текущей — по одному соседу, между ними
     многоточие. Ширина полосы при этом не скачет от страницы к странице. */
  function window7(page, pages) {
    if (pages <= 7) {
      var all = [];
      for (var i = 1; i <= pages; i++) all.push(i);
      return all;
    }
    var out = [1];
    var from = Math.max(2, page - 1);
    var to = Math.min(pages - 1, page + 1);
    if (page <= 3) { from = 2; to = 4; }
    if (page >= pages - 2) { from = pages - 3; to = pages - 1; }
    if (from > 2) out.push('…');
    for (var j = from; j <= to; j++) out.push(j);
    if (to < pages - 1) out.push('…');
    out.push(pages);
    return out;
  }

  /* Экранирование живёт в js/dk-util.js в единственном экземпляре. Если
     помощник не подключён, компонент обязан упасть громко, а не собрать
     разметку без экранирования и сделать вид, что всё хорошо. */
  function esc(s) {
    if (!window.dkEsc) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkEsc(s);
  }

  window.dkPager = function (host, opts) {
    window.dkDestroy(host);
    var stopped = false;
    opts = opts || {};

    // Отрицательный итог даёт «Показано 1–-5 из -5» — надпись, которая
    // выглядит как поломка страницы, хотя поломка в данных. Приводим к числу
    // и отсекаем: ноль — это честное «записей нет», а не минус пять.
    function count(n) { return Math.max(0, Math.floor(window.dkNum(n, 0))); }

    var total = count(opts.total);
    var size = opts.size || 20;
    var page = opts.page || 1;
    var sizes = opts.sizes || null;          // null — размер не меняется
    var noun = opts.noun || ['запись', 'записи', 'записей'];
    var onChange = opts.onChange || function () {};

    host.className = 'dk-pager';

    function pages() { return Math.max(1, Math.ceil(total / size)); }

    function go(next) {
      if (stopped) return;
      next = Math.min(pages(), Math.max(1, next));
      if (next === page) return;

      // Кто сейчас в фокусе — запоминаем по смыслу, а не по узлу: render()
      // переписывает разметку целиком, и старый узел после него мёртв.
      // Без этого человек, листающий журнал с клавиатуры, после каждого
      // нажатия оказывался в начале документа и заново пробегал табом шапку,
      // меню и фильтры.
      var el = document.activeElement;
      var mark = el && host.contains(el)
        ? (el.dataset.step ? '[data-step="' + el.dataset.step + '"]' : null)
        : null;

      page = next;
      render();

      if (mark) {
        var again = host.querySelector(mark);
        // Кнопка края могла стать недоступной — тогда фокус переходит на
        // соседнюю, а не проваливается в начало страницы.
        if (again && !again.disabled) again.focus();
        else {
          var alt = host.querySelector('[data-step]:not([disabled])');
          if (alt) alt.focus();
        }
      }
      onChange({ page: page, size: size, from: (page - 1) * size + 1,
                 to: Math.min(total, page * size) });
    }

    function render() {
      var last = pages();
      if (page > last) page = last;

      var from = total ? (page - 1) * size + 1 : 0;
      var to = Math.min(total, page * size);

      // Правило 1: сначала объём, потом кнопки.
      var count = '<div class="dk-pager__count"></div>';

      var nums = window7(page, last).map(function (p) {
        if (p === '…') return '<span class="dk-pager__gap">…</span>';
        return '<button type="button" class="dk-pager__p" data-p="' + p + '"' +
          (p === page ? ' aria-current="page"' : '') +
          ' aria-label="Страница ' + p + '">' + p + '</button>';
      }).join('');

      // Правило 2: на краях кнопки отключены, а не убраны.
      var nav = '<div class="dk-pager__nav">' +
        '<button type="button" class="dk-iconbtn dk-iconbtn--sm" data-step="-1"' +
        (page === 1 ? ' disabled' : '') + ' title="Предыдущая страница" aria-label="Предыдущая страница">' +
        ICON_PREV + '</button>' +
        '<div class="dk-pager__pages">' + nums + '</div>' +
        '<button type="button" class="dk-iconbtn dk-iconbtn--sm" data-step="1"' +
        (page === last ? ' disabled' : '') + ' title="Следующая страница" aria-label="Следующая страница">' +
        ICON_NEXT + '</button>' +
        '<span class="dk-pager__short" aria-label="Страница ' + page + ' из ' + last + '">' + page + '/' + last + '</span>' +
        '</div>';

      // Правило 5: если размер можно менять — он стоит рядом, а не в настройках.
      var pick = sizes
        ? '<label class="dk-pager__size">На странице' +
          '<select class="dk-select__trigger" data-size>' +
          sizes.map(function (n) {
            return '<option value="' + n + '"' + (n === size ? ' selected' : '') + '>' + n + '</option>';
          }).join('') + '</select></label>'
        : '';

      host.innerHTML = count + nav + pick;

      /* Живая область объявляет смену страницы — и объявляет её, только если
         существовала ДО того, как в ней появился текст.

         Раньше она жила внутри этой же строки: aria-live стоял на узле,
         который создавался уже с готовым текстом. Скринридер объявляет
         ИЗМЕНЕНИЕ живой области, а не её появление, поэтому не говорил
         ничего. То есть правило «человек слышит, что страница сменилась» не
         выполнялось ровно тем кодом, который под ним подписан.

         Теперь область создаётся один раз при инициализации, лежит вне
         перерисовываемой разметки, и меняется в ней только текст. Так же
         сделано в счётчике доступности и в календаре — оттуда и взято. */
      say(total
        ? 'Показано ' + nfmt(from) + '–' + nfmt(to) + ' из ' + nfmt(total) +
          ' ' + plural(total, noun[0], noun[1], noun[2])
        : 'Записей нет');

      var box = host.querySelector('.dk-pager__count');
      if (box) {
        box.innerHTML = total
          ? 'Показано <b>' + nfmt(from) + '–' + nfmt(to) + '</b> из ' + nfmt(total) +
            ' ' + esc(plural(total, noun[0], noun[1], noun[2]))
          : 'Записей нет';
      }
    }

    function onClick(e) {
      var step = e.target.closest('[data-step]');
      if (step && !step.disabled) { go(page + Number(step.dataset.step)); return; }
      var p = e.target.closest('[data-p]');
      if (p) {
        var num = p.dataset.p;
        go(Number(num));
        var again = host.querySelector('[data-p="' + num + '"]');
        if (again) again.focus();
      }
    }

    function onChangeEvent(e) {
      if (!e.target.matches('[data-size]')) return;
      // Держим первую видимую запись на месте: иначе человек, сменивший размер,
      // проваливается в другое место списка и теряет то, что читал.
      var first = (page - 1) * size;
      size = Number(e.target.value);
      page = Math.floor(first / size) + 1;
      render();
      onChange({ page: page, size: size, from: (page - 1) * size + 1,
                 to: Math.min(total, page * size) });
    }

    /* Живая область: один узел на всю жизнь компонента, вне перерисовки.
       Видимого текста в ней нет — видимый счётчик рядом и так на экране,
       дублировать его глазу незачем. */
    var live = document.createElement('div');
    live.className = 'dk-vh';
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('role', 'status');
    host.parentNode ? host.parentNode.insertBefore(live, host.nextSibling) : host.appendChild(live);

    function say(text) { if (live.textContent !== text) live.textContent = text; }

    host.addEventListener('click', onClick);
    host.addEventListener('change', onChangeEvent);
    var destroy = window.dkOwn(host, function () {
      stopped = true;
      host.removeEventListener('click', onClick); host.removeEventListener('change', onChangeEvent);
      host.replaceChildren();
    });
    render();

    return {
      destroy: destroy,
      update: function (next) {
        if (stopped) return;
        next = next || {};
        if (next.total != null) total = count(next.total);
        if (next.size != null) size = Math.max(1, count(next.size));
        if (next.page != null) page = Math.max(1, count(next.page));
        page = Math.min(page, pages()); render();
      },
      get page() { return page; },
      get size() { return size; },
      setTotal: function (n) { if (stopped) return; total = count(n); render(); },
      goTo: go
    };
  };
})();
