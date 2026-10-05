/* ============================================================================
   dashboard-kit · dk-modal.js
   Открывает модальное окно. Больше в этом файле ничего нет — и не должно быть.

   Ловушку фокуса, Escape, недоступность фона для скринридера и возврат фокуса
   на кнопку-открыватель делает сам <dialog>. Закрытие делает
   <form method="dialog">. Нам остаётся один вызов showModal() и правило, ради
   которого этот файл вообще есть: одновременно открыто не больше одного окна.

       <button data-modal="#confirm-delete">Удалить срез</button>
       <dialog class="dk-modal" id="confirm-delete">…</dialog>

   Окно, открытое поверх окна, — это интерфейс, который загнал человека в угол
   и не даёт вернуться. Если решение требует второго решения, второе должно
   жить внутри первого окна, а не над ним.
   ============================================================================ */

(function () {
  'use strict';

  var opener = null;      // кто открыл окно — туда вернём фокус

  function api(el) {
    return {
      el: el,
      open: function () {
        if (!el.showModal) { console.error('dk-modal: браузер не знает <dialog>'); return; }
        var already = document.querySelector('.dk-modal[open]');
        if (already && already !== el) {
          console.warn('dk-modal: окно поверх окна не открываем — закрыто предыдущее');
          already.close();
        }
        opener = document.activeElement;
        if (!el.open) el.showModal();
      },
      close: function (value) { if (el.open) el.close(value); },
      get returnValue() { return el.returnValue; }
    };
  }

  window.dkModal = function (el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) { console.error('dk-modal: окно не найдено'); return null; }
    return api(el);
  };

  // 30.09: в окне с одной кнопкой Tab в IAB уходил на body. Обрамляем
  // цикл явно; фон по-прежнему исключает нативный showModal().
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || e.defaultPrevented) return;
    var dialog = document.querySelector('.dk-modal[open]');
    if (!dialog) return;
    var targets = Array.prototype.filter.call(dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex]'), function (node) {
      return !node.disabled && node.tabIndex >= 0 && !node.closest('[hidden], [inert]') && node.getClientRects().length;
    });
    if (!targets.length) { e.preventDefault(); dialog.focus(); return; }
    var first = targets[0], last = targets[targets.length - 1];
    if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      e.preventDefault(); first.focus();
    }
  });

  // Escape закрываем сами, хотя <dialog> обязан делать это без нас. Проверка
  // показала, что рассчитывать на это нельзя во всех окружениях, а выход по
  // Escape — не украшение: без него человек, открывший окно с клавиатуры,
  // оказывается в ловушке. Если браузер закрыл окно сам, здесь уже нечего
  // закрывать, и обработчик просто ничего не делает.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;

    // Escape закрывает ровно один слой — самый верхний. Выпадающий список и
    // выбор периода внутри окна обрабатывают Escape раньше и помечают событие
    // обработанным; раньше эта пометка игнорировалась, и человек, закрывавший
    // список, терял вместе с ним всё окно с заполненной формой. Потеря формы
    // из-за нажатия, которым её не собирались закрывать, — это не мелочь
    // доступности, это потерянная работа.
    if (e.defaultPrevented) return;

    var open = document.querySelector('.dk-modal[open]');
    if (open) { open.close('cancel'); }
  });

  // Возврат фокуса на кнопку, которая окно открыла. <dialog> обещает это сам,
  // но только если фокус на ней действительно был: открытие из кода оставляет
  // фокус на <body>, и человек после закрытия оказывается в начале страницы.
  document.addEventListener('close', function (e) {
    if (!e.target.classList || !e.target.classList.contains('dk-modal')) return;
    if (document.activeElement === document.body && opener && opener.focus) opener.focus();
    opener = null;
  }, true);

  // Кнопка с data-modal открывает окно сама — странице не нужен свой код.
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-modal]');
    if (!b) return;
    var m = window.dkModal(b.getAttribute('data-modal'));
    if (m) { e.preventDefault(); m.open(); }
  });
})();
