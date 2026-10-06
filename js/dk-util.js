/* =============================================================================
   dashboard-kit · ОБЩИЕ ПОМОЩНИКИ
   -----------------------------------------------------------------------------
   Подключается ПЕРВЫМ, до остальных dk-*.js. Всё, что здесь лежит, обязано
   работать само по себе: зависимостей у этого файла нет и не должно быть.

   Зачем он появился. Экранирование было скопировано в пяти файлах и
   отсутствовало в четырёх — то есть кит знал, как надо, и делал это через раз.
   Имя региона из файла данных, название работы в календаре и текст, набранный
   человеком в поле формы, попадали в разметку как есть. Регион с именем вида
   <img src=x onerror=...> выполнил бы скрипт в дашборде диспетчера.

   Копия — не мелочь стиля: пять копий нельзя починить один раз. Поэтому
   функция ровно одна, и каждый компонент зовёт её отсюда.
   ========================================================================== */

(function () {
  'use strict';

  var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  /* Экранирование текста для вставки в innerHTML.

     Одинарная кавычка экранируется тоже, хотя разметка кита пишет атрибуты в
     двойных. Причина простая: правило «пиши атрибуты в двойных» живёт в головах,
     а не в коде, и первый же атрибут в одинарных кавычках в чужом компоненте
     открыл бы дыру обратно.

     null и undefined становятся пустой строкой, а не текстом «null»: подпись
     «undefined» в интерфейсе — это тоже дефект, просто тихий. */
  function dkEsc(value) {
    if (value == null) return '';
    return String(value).replace(/[&<>"']/g, function (c) { return MAP[c]; });
  }

  /* Число для подстановки в style= и в числовые атрибуты. Координаты плиток
     карты и высота часа в календаре приходят из файла данных и попадают прямо
     в style — там достаточно одной строки со скобками, чтобы дописать своё
     правило. Всё, что не конечное число, превращается в запасное значение. */
  function dkNum(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
  }

  /* ===========================================================================
     ЖИЗНЬ И СМЕРТЬ КОМПОНЕНТА
     ---------------------------------------------------------------------------
     График и карта подписываются на тему — то есть на корень документа, а не на
     свой узел. Такая подписка переживает узел: убрали виджет со страницы, а
     экземпляр ECharts, замыкание и оторванное поддерево остались висеть, и
     каждое переключение темы честно перерисовывает все мёртвые графики. В
     обычной странице это заметно не сразу, во встроенном ките со сменой
     маршрутов — через несколько переходов.

     Разбирать за собой должен был destroy(), но звать его никто не обязан, и
     это не забывчивость встраивающего: компонент, который требует ручного
     погребения, рано или поздно его не получит.

     Поэтому здесь один сторож на весь кит. Не по одному на компонент: сто
     наблюдателей за одним и тем же деревом — это та же утечка, только
     разложенная по файлам.

     Три решения, каждое из-за конкретной ошибки:

     1. Список живых экземпляров нигде не хранится. Хранить его значило бы
        держать сильную ссылку на узел — то есть чинить утечку утечкой. Функция
        погребения лежит на самом узле и умирает вместе с ним.
     2. Проверка отложена на микрозадачу. Перенос узла в DOM выглядит как
        удаление плюс вставка; без отсрочки сторож хоронил бы живой виджет
        посреди переезда. Хороним только то, что после отсрочки действительно
        отключено.
     3. Повторная инициализация на том же узле сначала хоронит предыдущий
        экземпляр. Иначе старый продолжает писать в чужой innerHTML — это уже
        случалось.
     ======================================================================== */

  var watching = false;
  var pending = null;

  function bury(node) {
    if (!node || node.nodeType !== 1) return;
    var list = [node];
    if (node.querySelectorAll) {
      list = list.concat(Array.prototype.slice.call(node.querySelectorAll('*')));
    }
    list.forEach(function (el) {
      var off = el.__dkDestroy;
      if (!off) return;
      el.__dkDestroy = null;
      try { off(); } catch (e) { /* похороны не должны ронять страницу */ }
    });
  }

  function watch() {
    if (watching || !window.MutationObserver) return;
    watching = true;
    new MutationObserver(function (records) {
      var gone = [];
      for (var i = 0; i < records.length; i++) {
        var removed = records[i].removedNodes;
        for (var j = 0; j < removed.length; j++) gone.push(removed[j]);
      }
      if (!gone.length) return;
      pending = (pending || []).concat(gone);
      Promise.resolve().then(function () {
        var list = pending; pending = null;
        if (!list) return;
        list.forEach(function (n) { if (!n.isConnected) bury(n); });
      });
    }).observe(document, { childList: true, subtree: true });
  }

  /* Компонент объявляет, как за ним убрать. Возвращает функцию погребения —
     её же компонент отдаёт наружу как destroy(). */
  function dkOwn(el, destroy) {
    if (!el) return function () {};
    if (el.__dkDestroy) {
      var prev = el.__dkDestroy;
      el.__dkDestroy = null;
      try { prev(); } catch (e) {}
    }
    el.__dkDestroy = destroy;
    watch();
    return function () {
      if (el.__dkDestroy !== destroy) return;   // уже похоронен
      el.__dkDestroy = null;
      destroy();
    };
  }

  /* Похоронить всё живое внутри узла, не удаляя его. Нужно тем, кто
     перерисовывает содержимое сам: innerHTML = '' уносит узлы мимо сторожа. */
  function dkDestroy(root) {
    if (!root) return;
    bury(root);
  }

  /* ДЛИТЕЛЬНОСТЬ В МИНУТАХ — СТРОКОЙ ДЛЯ ЧЕЛОВЕКА.

     Появилось из страницы аварий, где в каждой строке таблицы стоит «сколько
     прошло из сколько положено». Первая же самодельная версия написала
     «4 ч 0 мин» — это не время, это вывод формулы. Ноль в младшем разряде не
     пишется никогда: норматив в четыре часа человек читает как «4 ч», и два
     лишних слова в каждой строке таблицы стоят дороже, чем кажется.

     Сутки в ЖКХ — не экзотика: норматив на устранение бывает трёхдневным, и
     «72 ч» такой срок описывает хуже, чем «3 сут». Поэтому от суток и выше
     старший разряд становится сутками, а минуты отбрасываются: рядом с
     тремя сутками сорок минут — шум, а не точность.

     Отрицательное и нечисловое дают пустую строку, а не «NaN мин»: подпись
     «NaN» в интерфейсе — это тоже дефект, просто тихий. */
  function dkDur(minutes) {
    // null и undefined — это «значения нет», а Number(null) даёт ноль. Без
    // этой строки отсутствие длительности показывалось бы как «0 мин», то
    // есть отсутствие притворялось бы значением.
    if (minutes == null || minutes === '') return '';
    var m = Math.round(Number(minutes));
    if (!isFinite(m) || m < 0) return '';
    if (m < 60) return m + ' мин';

    var д = Math.floor(m / 1440);
    var ч = Math.floor((m - д * 1440) / 60);
    var мин = m - д * 1440 - ч * 60;

    if (д) return д + ' сут' + (ч ? ' ' + ч + ' ч' : '');
    return ч + ' ч' + (мин ? ' ' + мин + ' мин' : '');
  }

  /* ===========================================================================
     ФОРМАТИРОВАНИЕ ЧИСЕЛ, ДАТ И ЕДИНИЦ — ОДНА ФУНКЦИЯ НА ВСЮ КОМАНДУ
     ---------------------------------------------------------------------------
     До этого каждая страница форматировала сама: карта делила разряды обычным
     пробелом, страница аварий писала «+4 за сутки» руками, а «1 240 чел.»
     в форме собиралось строкой. Три места — три написания, и первое же
     расхождение («1240» рядом с «1 240») читается как два разных числа.

     Правила русской записи, все проверяемы на глаз:
       · разряды — неразрывным узким пробелом (число не рвётся на переносе);
       · дробь — запятой;
       · минус — настоящий (U+2212), а не дефис: дефис уже, и «-8» читается
         как тире перед числом;
       · знак у дельты стоит всегда, и у плюса тоже: «+4» и «4» — разные
         сообщения;
       · «нет значения» — прочерк, а не «NaN», «null» или «0»: ноль — это
         ответ, отсутствие — нет.
     ======================================================================== */

  var NBSP = '\u00a0';
  var MINUS = '\u2212';
  var MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  function isNone(v) { return v == null || (typeof v === 'string' && v.trim() === '') || !isFinite(Number(v)); }

  /* 1240.5 → «1 240,5». digits — сколько знаков после запятой; по умолчанию
     сколько есть, до двух. */
  function fmtNum(v, digits) {
    if (isNone(v)) return '—';
    var n = Number(v);
    if (!isFinite(n)) return '—';
    var neg = n < 0; n = Math.abs(n);
    var s = digits == null ? String(Math.round(n * 100) / 100) : n.toFixed(digits);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    return (neg ? MINUS : '') + parts.join(',');
  }

  /* 1 240 000 → «1,2 млн», 12 400 → «12,4 тыс.». Для плиток и подписей,
     где место дороже точности; в таблицу — только fmtNum. */
  function fmtCompact(v) {
    if (isNone(v)) return '—';
    var n = Number(v), a = Math.abs(n);
    if (a >= 1e6) return fmtNum(n / 1e6, a >= 1e7 ? 0 : 1) + NBSP + 'млн';
    if (a >= 1e4) return fmtNum(n / 1e3, a >= 1e5 ? 0 : 1) + NBSP + 'тыс.';
    return fmtNum(n);
  }

  /* Дельта: знак всегда. unit — «%», «п. п.», «мин», «чел.» */
  function fmtDelta(v, unit, digits) {
    if (isNone(v)) return '—';
    var n = Number(v);
    var body = fmtNum(Math.abs(n), digits);
    var sign = n > 0 ? '+' : (n < 0 ? MINUS : '');
    return sign + body + (unit ? (unit === '%' ? '' : NBSP) + unit : '');
  }

  function fmtPct(v, digits) { return isNone(v) ? '—' : fmtNum(v, digits) + '%'; }
  function fmtPp(v, digits)  { return fmtDelta(v, 'п. п.', digits); }
  function fmtUnit(v, unit, digits) { return isNone(v) ? '—' : fmtNum(v, digits) + NBSP + unit; }

  /* Деньги: знак рубля отдельным словом, через неразрывный пробел, как
     велит типографика: «1 284 ₽», а не «1 284₽». Неразрывный — чтобы знак не
     уезжал на следующую строку отдельно от числа. */
  function fmtMoney(v, digits) { return isNone(v) ? '—' : fmtNum(v, digits == null ? 0 : digits) + NBSP + '₽'; }

  function toDate(d) {
    if (d == null || d === '') return null;
    var x = d instanceof Date ? d : new Date(d);
    return isNaN(x.getTime()) ? null : x;
  }
  function two(n) { return (n < 10 ? '0' : '') + n; }

  /* «14 сен», «14 сен 2026» (год — только если не текущий или просят),
     «14:20», «14 сен, 14:20». Месяц в родительном падеже и без точки:
     «сен» — сокращение, а «сен.» рядом с запятой даёт две точки подряд. */
  function fmtDate(d, withYear) {
    var x = toDate(d); if (!x) return '—';
    var s = x.getDate() + NBSP + MONTHS[x.getMonth()];
    if (withYear === true || (withYear == null && x.getFullYear() !== new Date().getFullYear())) {
      s += NBSP + x.getFullYear();
    }
    return s;
  }
  function fmtTime(d) { var x = toDate(d); return x ? two(x.getHours()) + ':' + two(x.getMinutes()) : '—'; }
  function fmtDateTime(d) { var x = toDate(d); return x ? fmtDate(x) + ', ' + fmtTime(x) : '—'; }

  /* Диапазон дат: общий месяц не повторяется — «11–24 сен», иначе «28 авг –
     4 сен». Тире короткое без пробелов внутри одного месяца и с пробелами
     между разными, как в типографике. */
  function fmtRange(a, b) {
    var x = toDate(a), y = toDate(b);
    if (!x || !y) return x ? fmtDate(x) : (y ? fmtDate(y) : '—');
    if (x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear()) {
      return x.getDate() + '–' + y.getDate() + NBSP + MONTHS[x.getMonth()] +
             (x.getFullYear() !== new Date().getFullYear() ? NBSP + x.getFullYear() : '');
    }
    return fmtDate(x) + ' – ' + fmtDate(y);
  }

  /* ===========================================================================
     СОСТОЯНИЕ В АДРЕСЕ СТРАНИЦЫ
     ---------------------------------------------------------------------------
     Период и фильтры живут в строке запроса: ?period=14d&region=RU-MOW.
     Ссылку на срез можно прислать коллеге, и он увидит тот же срез, а не
     «все округа за сутки». Без этого каждый разговор о дашборде начинается с
     «поставь 14 дней, выбери Сибирь» — и половина таких разговоров кончается
     тем, что смотрят на разное.

     replaceState, а не pushState: кнопка «назад» ведёт на предыдущую страницу,
     а не отматывает фильтры по одному. Хэш сохраняется — по нему живут якоря.
     Пустое значение убирает ключ: «фильтр снят» — это отсутствие параметра,
     а не region=. Компоненты подключают это по имени ключа (opts.url), и
     страница без такого имени в адрес ничего не пишет. */
  function dkUrlGet(key) {
    try { return new URLSearchParams(location.search).get(key); } catch (e) { return null; }
  }
  function dkUrlSet(key, value) {
    try {
      var q = new URLSearchParams(location.search);
      if (value == null || value === '' || (Array.isArray(value) && !value.length)) q.delete(key);
      else q.set(key, Array.isArray(value) ? value.join(',') : String(value));
      var s = q.toString();
      history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
    } catch (e) { /* file:// или запрет истории — адрес просто не обновится */ }
  }
  window.dkUrl = { get: dkUrlGet, set: dkUrlSet };

  window.dkFmt = {
    num: fmtNum, compact: fmtCompact, delta: fmtDelta, pct: fmtPct, pp: fmtPp,
    unit: fmtUnit, money: fmtMoney, date: fmtDate, time: fmtTime,
    dateTime: fmtDateTime, range: fmtRange, NBSP: NBSP, MINUS: MINUS
  };

  /* КНОПКА «НАЗАД» В ПРИЛОЖЕНИИ. Внутри WebView системная «назад» на Android
     (и жест назад на iOS, если приложение его включило) уходит на прошлую
     страницу, даже когда поверх открыт список, выбор периода, разделы или
     модальное окно. Человек закрывал всплывашку — и терял дашборд со всем
     срезом. На телефоне это самый частый способ закрыть что угодно.

     Приложение перед уходом назад спрашивает страницу: dkBack() закрывает
     ровно один слой, самый верхний, и отвечает true; если закрывать нечего —
     false, и тогда можно уходить. Слои кита в историю не пишут намеренно:
     лишняя запись в истории превращает «назад» в «закрой меню» и в обычном
     браузере, где этого никто не просил.

     Закрытие идёт тем же Escape, которым слои уже закрываются с клавиатуры, —
     второго пути закрытия, который однажды разойдётся с первым, нет. Порядок
     «сначала развёрнутое, потом окно» — тот же, что у Escape: список внутри
     окна закрывается раньше окна (dk-modal.js). */
  function dkBack() {
    var esc = function (el) {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    };
    var opened = document.querySelectorAll('.dk-root [aria-expanded="true"]');
    if (opened.length) { esc(opened[opened.length - 1]); return true; }
    var modal = document.querySelector('.dk-modal[open]');
    if (modal) { esc(modal); return true; }
    return false;
  }

  /* МЕНЮ ПОД КНОПКОЙ НА ТЕЛЕФОНЕ. Фильтры на телефоне стоят строкой, которая
     листается вбок (components.css, «Фильтры на телефоне»), а прокрутка
     обрезает всё, что из неё выходит, — меню фильтра открывалось бы внутри
     полоски высотой в пилюлю. Поэтому на узком экране меню ставится поверх
     страницы (position: fixed) ровно под кнопкой, не уже её и не шире экрана
     без отступов, и едет за кнопкой, пока листают страницу или строку.
     Кнопка ушла с экрана — меню закрывается: висящее над чужим содержимым
     меню от невидимой кнопки читается как поломка.

     На широком экране не делает ничего: там меню стоит под кнопкой обычным
     абсолютным слоем, и обрезать его некому.

     Возвращает функцию «отпустить» — её вызывают при закрытии меню. */
  function dkAnchor(menu, trigger, onLost) {
    var narrow = window.matchMedia('(max-width: 767px)');
    function reset() {
      ['position', 'top', 'left', 'right', 'minWidth'].forEach(function (k) { menu.style[k] = ''; });
    }
    function place() {
      if (!narrow.matches) { reset(); return; }
      var t = trigger.getBoundingClientRect();
      if (t.bottom < 0 || t.top > window.innerHeight || t.right < 0 || t.left > window.innerWidth) {
        if (onLost) onLost();
        return;
      }
      var pad = parseFloat(getComputedStyle(menu).getPropertyValue('--page-pad')) || 18;
      menu.style.position = 'fixed';
      menu.style.right = 'auto';
      menu.style.minWidth = Math.round(t.width) + 'px';
      menu.style.top = Math.round(t.bottom + 6) + 'px';
      var w = menu.offsetWidth;
      var left = Math.min(Math.max(t.left, pad), window.innerWidth - pad - w);
      menu.style.left = Math.round(Math.max(pad, left)) + 'px';
    }
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return function release() {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      reset();
    };
  }

  /* КРЕСТИК В СТРОКЕ ПОИСКА. Поведение без подключения: dk-util.js стоит на
     каждой странице, и строке поиска (.dk-search) не нужен свой скрипт ради
     одной кнопки. Поле очищается, получает событие input — страница, которая
     фильтрует по вводу, узнаёт об очистке тем же путём, что и о вводе, — и
     фокус остаётся в поле: человек сбросил запрос, чтобы набрать новый. */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.dk-search__clear') : null;
    var box = b && b.closest('.dk-search');
    var input = box && box.querySelector('.dk-search__input');
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });

  /* Explicit role prevents data fills from becoming unreadable text.
     Return a CSS expression for DOM; resolve against the owning root for canvas. */
  var meanings = {
    crit: {fill: '--crit', text: '--crit-ink'},
    high: {fill: '--high', text: '--high-ink'},
    calm: {fill: '--calm', text: '--calm-ink'},
    event: {fill: '--event', text: '--ink'},
    nodata: {fill: '--nodata', text: '--nodata-ink'}
  };
  function dkMeaning(name, role) {
    if (!Object.prototype.hasOwnProperty.call(meanings, name) ||
        (role !== 'text' && role !== 'fill')) throw new TypeError('dkMeaning: unknown meaning or role');
    return 'var(' + meanings[name][role] + ')';
  }
  dkMeaning.color = function (name, role, el) {
    var token = dkMeaning(name, role).slice(4, -1);
    var root = el && el.closest ? el.closest('.dk-root') : null;
    return getComputedStyle(root || document.documentElement).getPropertyValue(token).trim();
  };
  dkMeaning.decal = function (el) {
    return {symbol: 'rect', symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [1, 5],
      rotation: -Math.PI / 4, color: getComputedStyle((el && el.closest('.dk-root')) || document.documentElement).getPropertyValue('--nodata-pattern').trim()};
  };
  window.dkMeaning = dkMeaning;

  window.dkAnchor = dkAnchor;
  window.dkBack = dkBack;
  window.dkEsc = dkEsc;
  window.dkNum = dkNum;
  window.dkDur = dkDur;
  window.dkOwn = dkOwn;
  window.dkDestroy = dkDestroy;
})();
