/* ============================================================================
   dashboard-kit · dk-table.js
   Поведение таблицы: выбор строк и сортировка.

   Разметка остаётся разметкой: это обычная <table>, и без этого файла она
   продолжает показывать данные — просто перестаёт сортироваться. Ничего не
   генерируется из данных, никакого своего формата строк: таблицу верстает
   приложение, кит добавляет к ней поведение.

   ---------------------------------------------------------------------------
   ПРАВИЛА

   1. ВЫБРАНО ВИДНО ЧИСЛОМ, А НЕ ТОЛЬКО ЗАЛИВКОЙ.
      «Выбрано 12» — это то, что человек проверяет перед тем, как нажать
      «Удалить». Заливка строк отвечает «какие», число отвечает «сколько», и
      второе важнее: строк может быть больше, чем помещается на экране.

   2. «ВЫБРАТЬ ВСЕ» ЗНАЧИТ «ВСЕ НА ЭТОЙ СТРАНИЦЕ».
      Обещать выбор всех 214 записей, выбрав 20 видимых, — ложь, за которую
      расплачивается тот, кто следом нажмёт «Удалить». Промежуточное состояние
      флажка показывает, что выбрана часть.

   3. СОРТИРОВКА НАЗЫВАЕТ НАПРАВЛЕНИЕ.
      Стрелка показывает не «здесь можно сортировать», а куда именно
      отсортировано: направление — половина ответа на вопрос, что перед тобой.
      Скринридеру то же самое говорит aria-sort.

   4. СОРТИРУЕМ ПО ЗНАЧЕНИЮ, А НЕ ПО ТОМУ, ЧТО НАПИСАНО.
      «1 240 чел.» и «14:20» — это текст, а порядок у них числовой и временной.
      Значение для сортировки берётся из data-sort, и если его нет, колонка
      сортируется как текст.
   ============================================================================ */

(function () {
  'use strict';

  var ICON_SORT = '<svg class="dk-i dk-i--sm"><use href="#ti-arrow-up"/></svg>';

  /* Значение для сортировки. Возвращается пара «тип, значение»: сравнивать
     число с текстом нельзя, а раньше именно это и происходило.

     ЧТО БЫЛО СЛОМАНО. Из ячейки выбрасывались все нецифровые знаки, и остаток
     читался как число: «2 из 10» превращалось в 210, «1 из 3» — в 13. Колонка
     со смешанным текстом сортировалась по мусору, причём правдоподобному — на
     глаз порядок выглядел осмысленным. Второе: значения разных типов попадали
     в один компаратор, где `x > y` ложно в обе стороны. Сравнение выходило
     нетранзитивным, то есть порядок зависел от движка браузера.

     Теперь угадывание числа честное: строка обязана быть числом ЦЕЛИКОМ, с
     поправкой на русскую запись — разряды пробелом (в том числе неразрывным),
     дробь запятой. «2 из 10» числом не притворяется и сортируется как текст.
     Точное значение задаётся через data-sort, это и есть предусмотренный
     способ. */
  function cellValue(tr, i) {
    var td = tr.children[i];
    if (!td) return ['s', ''];
    if (td.dataset.sort != null) {
      var raw = td.dataset.sort.trim();
      var n = Number(raw);
      return (raw !== '' && !isNaN(n)) ? ['n', n] : ['s', raw.toLowerCase()];
    }
    var text = td.textContent.trim();
    var maybe = text.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(maybe)) return ['n', Number(maybe)];
    return ['s', text.toLowerCase()];
  }

  /* Числа идут раньше текста. Это не вкусовщина: иначе «—» в колонке чисел
     оказывается между значениями и читается как значение. */
  function compare(a, b) {
    if (a[0] !== b[0]) return a[0] === 'n' ? -1 : 1;
    if (a[0] === 'n') return a[1] - b[1];
    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
  }

  window.dkTable = function (table, opts) {
    window.dkDestroy(table);
    var releases = [], watch = null, stopped = false;
    function listen(node, type, callback) {
      node.addEventListener(type, callback);
      releases.push(function () { node.removeEventListener(type, callback); });
    }
    opts = opts || {};
    var onSelect = opts.onSelect || function () {};
    var onSort = opts.onSort || null;          // передан — сортируем не мы

    var tbody = table.tBodies[0];
    var all = table.querySelector('[data-pick-all]');

    /* --- выбор строк ------------------------------------------------------ */

    function rows() { return Array.prototype.slice.call(tbody.rows); }
    function boxes() { return Array.prototype.slice.call(tbody.querySelectorAll('[data-pick]')); }

    function syncAll() {
      if (!all) return;
      var list = boxes();
      var on = list.filter(function (b) { return b.checked; }).length;
      all.checked = on > 0 && on === list.length;
      // Правило 2: часть выбранного — это промежуточное состояние, а не «ничего».
      all.indeterminate = on > 0 && on < list.length;
      var mark = all.closest('.dk-check');
      if (mark) mark.querySelector('.dk-check__box')
        .classList.toggle('dk-check__box--mixed', all.indeterminate);
      onSelect(selected());
    }

    /* Строка без data-id и без value у флажка возвращалась как "on" — это
       значение браузер подставляет сам, когда его не задали. Три такие строки
       давали три одинаковых идентификатора, и вызывающий получал выделение,
       по которому ничего нельзя найти. Лучше отдать null и сказать об этом
       вслух, чем отдать правдоподобный мусор. */
    var SAID = false;
    function selected() {
      var out = boxes().filter(function (b) { return b.checked; })
                       .map(function (b) {
        var tr = b.closest('tr');
        var id = tr && tr.dataset.id;
        if (id) return id;
        if (b.value && b.value !== 'on') return b.value;
        if (!SAID) {
          SAID = true;
          console.warn('dk-table: у строки нет data-id, а у флажка — value. ' +
                       'Такая строка возвращается как null: опознать её нечем.');
        }
        return null;
      });
      return out;
    }

    listen(tbody, 'change', function (e) {
      var b = e.target.closest('[data-pick]');
      if (!b) return;
      b.closest('tr').setAttribute('aria-selected', b.checked ? 'true' : 'false');
      syncAll();
    });

    if (all) listen(all, 'change', function () {
      boxes().forEach(function (b) {
        b.checked = all.checked;
        b.closest('tr').setAttribute('aria-selected', all.checked ? 'true' : 'false');
      });
      syncAll();
    });

  /* Экранирование живёт в js/dk-util.js в единственном экземпляре. Если
     помощник не подключён, компонент обязан упасть громко, а не собрать
     разметку без экранирования и сделать вид, что всё хорошо. */
  function esc(s) {
    if (!window.dkEsc) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkEsc(s);
  }

    /* --- сортировка -------------------------------------------------------- */

    var heads = Array.prototype.slice.call(table.querySelectorAll('th[data-sortable]'));

    heads.forEach(function (th, idx) {
      var i = Array.prototype.indexOf.call(th.parentNode.children, th);
      var label = th.textContent.trim();
      // textContent читается как текст, а вставляется как разметка: заголовок
      // «Людей <b>всего</b>» превратился бы из подписи в разметку.
      th.innerHTML = '<button type="button" class="dk-th-sort">' + esc(label) + ICON_SORT + '</button>';
      th.setAttribute('aria-sort', 'none');

      listen(th.querySelector('.dk-th-sort'), 'click', function () {
        var dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
        heads.forEach(function (o) { o.setAttribute('aria-sort', 'none'); });
        th.setAttribute('aria-sort', dir);

        if (onSort) { onSort({ column: th.dataset.sortable || label, dir: dir, index: i }); return; }

        var sign = dir === 'ascending' ? 1 : -1;
        rows().sort(function (a, b) {
          var x = cellValue(a, i), y = cellValue(b, i);
          // Пустое всегда внизу, в обе стороны: «нет значения» — это не
          // «самое маленькое», переворачивать его вместе с данными нечестно.
          var ex = x[0] === 's' && x[1] === '', ey = y[0] === 's' && y[1] === '';
          if (ex !== ey) return ex ? 1 : -1;
          return compare(x, y) * sign;
        }).forEach(function (tr) { tbody.appendChild(tr); });
      });
    });

    syncAll();

    /* --- карточки на телефоне -------------------------------------------
       dk-table--cards: на узком экране строка становится карточкой из пар
       «подпись — значение» (components.css, «Таблица карточками»). Подпись
       — заголовок колонки, и CSS его не знает: у ячейки нет доступа к своему
       заголовку. Поэтому подписи ставит скрипт — атрибутом data-label на
       каждой ячейке, по номеру колонки с учётом colspan. Строки, которые
       страница дорисует потом (листание, сортировка на сервере), получают
       подписи сами: за телом таблицы следит наблюдатель. */
    var watch = null;
    if (table.classList.contains('dk-table--cards')) {
      var headRow = table.tHead && table.tHead.rows[0];
      var labels = headRow ? Array.prototype.map.call(headRow.cells, function (th) {
        return th.dataset.sortable || th.textContent.trim();
      }) : [];
      var labelRows = function () {
        Array.prototype.forEach.call(table.querySelectorAll('tbody tr, tfoot tr'), function (tr) {
          var col = 0;
          Array.prototype.forEach.call(tr.cells, function (td) {
            if (!td.hasAttribute('data-label') && labels[col]) td.setAttribute('data-label', labels[col]);
            col += td.colSpan || 1;
          });
        });
      };
      labelRows();
      watch = new MutationObserver(labelRows);
      Array.prototype.forEach.call(table.tBodies, function (tb) { watch.observe(tb, { childList: true, subtree: true }); });
      if (table.tFoot) watch.observe(table.tFoot, { childList: true, subtree: true });

    }

    var destroy = window.dkOwn(table, function () {
      stopped = true;
      releases.forEach(function (off) { off(); });
      if (watch) watch.disconnect();
    });
    return {
      destroy: destroy,
      update: function (next) {
        if (stopped) return;
        next = next || {};
        if (next.selected) boxes().forEach(function (b) {
          var id = b.closest('tr').dataset.id || b.value;
          b.checked = next.selected.indexOf(id) >= 0;
          b.closest('tr').setAttribute('aria-selected', String(b.checked));
        });
        syncAll();
      },
      get selected() { return selected(); },
      clear: function () {
        if (stopped) return;
        boxes().forEach(function (b) { b.checked = false; b.closest('tr').setAttribute('aria-selected', 'false'); });
        syncAll();
      }
    };
  };
})();
