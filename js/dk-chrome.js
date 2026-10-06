/* ============================================================================
   dashboard-kit · dk-chrome.js
   Поведение каркаса: разделы на узком экране и свёрнутое меню на широком.

   Кода здесь немного намеренно. Всё, что умеет разметка, делает разметка:
   текущий раздел помечен aria-current, ссылки остаются ссылками, и без этого
   файла меню продолжает работать — просто перестаёт сворачиваться.
   ============================================================================ */

(function () {
  'use strict';

  function setup(app) {
    var burger = app.querySelector('[data-act="nav"]');
    var fold   = app.querySelector('[data-act="fold"]');
    var side   = app.querySelector('.dk-side');

    if (app.classList.contains('dk-app--rail')) {
      app.querySelectorAll('.dk-side__item').forEach(function (item) {
        var label = item.querySelector('.dk-side__label');
        if (label) { item.setAttribute('aria-label', label.textContent.trim()); item.setAttribute('title', label.textContent.trim()); }
      });
      var profile = app.querySelector('.dk-side__profile');
      if (profile) {
        document.addEventListener('click', function (e) { if (!profile.contains(e.target)) profile.open = false; });
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && profile.open) { profile.open = false; profile.querySelector('summary').focus(); e.stopPropagation(); }
        });
      }
    }

    function state() { return app.getAttribute('data-nav') || 'closed'; }

    function open() {
      // Разделы встают ровно под шапкой. Высоту шапки меряем, а не задаём
      // числом: на узком экране она переносится в две строки, и зашитое
      // значение оставило бы меню наезжать на заголовок.
      var top = app.querySelector('.dk-top');
      if (side && top && window.matchMedia('(max-width: 1023px)').matches) {
        side.style.top = (top.offsetHeight + 8) + 'px';
      }
      app.setAttribute('data-nav', 'open');
      if (burger) burger.setAttribute('aria-expanded', 'true');

      // Пока разделы открыты, содержимое под ними недоступно ни табом, ни
      // скринридеру: иначе человек, листающий меню клавиатурой, незаметно
      // уходит в кнопки дашборда, которые в этот момент закрыты попапом, и
      // нажимает не то, что видит. Так же ведёт себя <dialog> в модалке.
      var main = app.querySelector('.dk-main');
      if (main && window.matchMedia('(max-width: 1023px)').matches) {
        main.inert = true;
        if (side) side.setAttribute('aria-modal', 'true');
      }
      // Разделы — такой же всплывающий слой, как меню фильтра, и правило то же:
      // одновременно открыт может быть только один.
      document.dispatchEvent(new CustomEvent('dk-popup', { detail: close }));
      document.addEventListener('mousedown', outside, true);
      var first = side && side.querySelector('.dk-side__item');
      if (first) first.focus();
    }

    function close(focusBack) {
      if (state() !== 'open') return;
      app.setAttribute('data-nav', 'closed');
      var main = app.querySelector('.dk-main');
      if (main) main.inert = false;
      if (side) { side.removeAttribute('aria-modal'); side.style.top = ''; }
      if (burger) burger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', outside, true);
      if (focusBack === true && burger) burger.focus();
    }

    function outside(e) {
      if (side && side.contains(e.target)) return;
      if (burger && burger.contains(e.target)) return;
      close(false);
    }

    if (burger) {
      burger.setAttribute('aria-expanded', 'false');
      burger.addEventListener('click', function () {
        state() === 'open' ? close(true) : open();
      });
    }

    if (fold) {
      fold.addEventListener('click', function () {
        var folded = state() === 'folded';
        app.setAttribute('data-nav', folded ? 'closed' : 'folded');
        fold.setAttribute('aria-pressed', folded ? 'false' : 'true');
        // Подпись меняется вместе с действием. Кнопка, которая в свёрнутом
        // меню продолжает называться «Свернуть», врёт — а для человека со
        // скринридером она вообще единственный источник правды: стрелку он
        // не видит.
        var подпись = folded ? 'Свернуть меню' : 'Развернуть меню';
        fold.setAttribute('title', подпись);
        fold.setAttribute('aria-label', подпись);
        // Состояние не запоминаем: где его хранить — решает приложение, а не
        // библиотека. Кит не знает ни про вход, ни про профиль пользователя.
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close(true);
    });

    document.addEventListener('dk-popup', function (e) {
      if (e.detail !== close) close(false);
    });
  }

  /* Каркас поднимается сам по готовности документа — и его же может позвать
     руками тот, кто встраивает кит. Раньше срабатывали оба: встраивающий звал
     dkChrome(app), получал вторую пару обработчиков на бургере, и меню
     открывалось и тут же закрывалось. На страницах кита не стреляло только
     потому, что они dkChrome не зовут, — то есть дефект ждал первого, кто
     сделает по документации.

     Метка ставится на самом узле: она умирает вместе с ним, и повторная
     инициализация после настоящей замены каркаса снова разрешена. */
  window.dkChrome = function (app) {
    app = app || document.querySelector('.dk-app');
    if (app && !app.__dkChrome) { app.__dkChrome = true; setup(app); }
    return app;
  };

  document.addEventListener('DOMContentLoaded', function () {
    // Через ту же дверь, что и ручной вызов: метка одна, и она не даст
    // подняться дважды, в каком бы порядке ни пришли автозапуск и вызов.
    document.querySelectorAll('.dk-app').forEach(function (app) { window.dkChrome(app); });
  });
})();
