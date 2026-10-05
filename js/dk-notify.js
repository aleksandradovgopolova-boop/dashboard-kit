/* ============================================================================
   dashboard-kit · dk-notify.js
   Уведомление о выполненном действии.

   ---------------------------------------------------------------------------
   ПРАВИЛА

   1. ТОСТ ПОДТВЕРЖДАЕТ ДЕЙСТВИЕ ЧЕЛОВЕКА, А НЕ СООБЩАЕТ НОВОСТИ СИСТЕМЫ.
      «Срез сброшен», «работа добавлена» — да. «Авария в Новосибирске» — нет:
      это состояние данных, оно живёт в самих данных и в баннере страницы.
      Уехавшее через пять секунд сообщение о новой аварии — это авария,
      которую никто не увидел.

   2. ТО, ЧТО ТРЕБУЕТ РЕШЕНИЯ, НЕ УЕЗЖАЕТ САМО.
      Ошибку, которую надо исправить, показывают на месте — у поля, в виджете,
      баннером. Тост для неё не годится по устройству: он исчезает.

   3. ВРЕМЯ ЖИЗНИ СЧИТАЕТСЯ ПО ДЛИНЕ ТЕКСТА.
      Фиксированные три секунды означают, что длинное сообщение прочитает
      только тот, кто читает быстро. И пока курсор на тосте, отсчёт стоит:
      человек читает.

   4. С ДЕЙСТВИЕМ «ОТМЕНИТЬ» ТОСТ ЖИВЁТ ДОЛЬШЕ.
      Отмена, которую не успели нажать, — это не отмена.

   5. ОДНОВРЕМЕННО ВИДНО НЕ БОЛЬШЕ ТРЁХ.
      Стопка выше закрывает собой интерфейс, ради которого всё это затевалось.
   ============================================================================ */

(function () {
  'use strict';

  var MAX = 3;
  var ICON = {
    calm: 'ti-circle-check',
    high: 'ti-alert-triangle',
    crit: 'ti-alert-circle'
  };

  var box = null;

  /* Полка тостов создаётся один раз и больше не удаляется — даже когда
     пустая. Раньше она появлялась вместе с первым тостом и исчезала вместе с
     последним, а на ней живёт aria-live. Скринридер объявляет ИЗМЕНЕНИЕ живой
     области, а не её появление: область, вставленная сразу с текстом внутри,
     не объявляется вовсе. То есть тосты были озвучены только в коде.

     Пустая полка ничего не стоит: размеров у неё нет, событий она не ловит
     (pointer-events снят в CSS), в поток она не встраивается. */
  function shelf() {
    if (box && document.body.contains(box)) return box;
    box = document.createElement('div');
    box.className = 'dk-toasts';
    // aria-live, а не alert: подтверждение действия не должно перебивать то,
    // что скринридер читает сейчас.
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
    return box;
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

  window.dkToast = function (text, opts) {
    opts = opts || {};
    var kind = ICON[opts.kind] ? opts.kind : 'calm';
    var action = opts.action || null;

    /* Правило 3: четыре секунды плюс сорок миллисекунд на знак, но не больше
       десяти.

       ТОСТ С ДЕЙСТВИЕМ НЕ ИСЧЕЗАЕТ САМ. Раньше ему давали три секунды сверху,
       «чтобы успеть нажать» — и это была догадка о том, как быстро человек
       двигается. Для мыши догадка сносная, для клавиатуры бессмысленная: тост
       вставляется в конец документа, и сколько нажатий Tab до него от текущего
       места — неизвестно никому, включая нас. Любой таймер здесь означает
       «успей или потеряй действие», причём теряют его ровно те, кто и так
       работает медленнее.

       Отсчёт под курсором и под фокусом стоит (ниже), но это помогает только
       после того, как до тоста добрались. Поэтому: есть действие — нет
       таймера. Закрыть можно крестиком, он никуда не делся. Явно переданный
       life уважаем: значит, вызывающий знает, что делает. */
    var life = opts.life != null ? opts.life
      : (action ? Infinity : Math.min(10000, 4000 + String(text).length * 40));

    var host = shelf();
    var el = document.createElement('div');
    el.className = 'dk-toast dk-toast--' + kind;
    el.innerHTML =
      '<svg class="dk-i"><use href="#' + ICON[kind] + '"/></svg>' +
      '<span class="dk-toast__text">' + esc(text) + '</span>' +
      (action ? '<button type="button" class="dk-btn dk-btn--ghost dk-btn--sm">' +
                esc(action.name) + '</button>' : '') +
      '<button type="button" class="dk-iconbtn dk-iconbtn--sm" title="Закрыть" aria-label="Закрыть">' +
      '<svg class="dk-i dk-i--sm"><use href="#ti-x"/></svg></button>';

    host.appendChild(el);

    // Правило 5: лишние снимаем снизу — самые старые.
    while (host.children.length > MAX) host.removeChild(host.firstChild);

    var timer = null;
    function close() {
      clearTimeout(timer);
      if (el.parentNode) el.parentNode.removeChild(el);
      // Полку не убираем: см. комментарий к shelf(). Убрать её — значит
      // выключить объявление следующего тоста.
    }
    function start() {
      clearTimeout(timer);
      if (life === Infinity) return;
      timer = setTimeout(close, life);
    }

    // Правило 3: под курсором отсчёт стоит.
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', start);
    el.addEventListener('focusin', function () { clearTimeout(timer); });
    el.addEventListener('focusout', start);

    el.querySelector('.dk-iconbtn').addEventListener('click', close);
    if (action) el.querySelector('.dk-btn').addEventListener('click', function () {
      close();
      if (action.onClick) action.onClick();
    });

    start();
    return { close: close, el: el };
  };
})();
