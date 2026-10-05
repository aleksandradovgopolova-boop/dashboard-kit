/* ============================================================================
   dashboard-kit · dk-icons.js   —   СОБРАН АВТОМАТИЧЕСКИ, НЕ ПРАВИТЬ РУКАМИ
   Источник: Tabler Icons (MIT), https://tabler.io/icons — вариант outline.
   Пересобрать: python3 tools/build-icons.py
   Иконок в наборе: 36

   Спрайт встроен в файл, поэтому иконки работают офлайн и при открытии
   страницы двойным кликом — внешние <use href="file.svg#id"> в этом случае
   браузеры блокируют.

   Как пользоваться:
       <svg class="dk-i"><use href="#ti-search"/></svg>
   или из JavaScript узлом — так, как кит велит собирать разметку в скриптах:
       button.prepend(dkIcon.el('search', 'dk-i--sm'));
   dkIcon(name) без .el отдаёт СТРОКУ разметки — для склейки внутри уже
   экранированного шаблона. Два исполнителя проверочных задач скилла из шести
   приняли строку за узел (29.09), отсюда .el.

   Цвет иконка берёт от текста (currentColor), размер — от font-size.
   Декоративной иконке ничего не нужно: она уже скрыта от скринридера.
   Если иконка несёт смысл сама по себе (кнопка без подписи) — подпись
   ставится на кнопку через aria-label.
   ============================================================================ */

(function () {
  var SPRITE = '<symbol id="ti-search" viewBox="0 0 24 24"><path d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /> <path d="M21 21l-6 -6" /></symbol><symbol id="ti-settings" viewBox="0 0 24 24"><path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065" /> <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /></symbol><symbol id="ti-filter" viewBox="0 0 24 24"><path d="M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227" /></symbol><symbol id="ti-x" viewBox="0 0 24 24"><path d="M18 6l-12 12" /> <path d="M6 6l12 12" /></symbol><symbol id="ti-check" viewBox="0 0 24 24"><path d="M5 12l5 5l10 -10" /></symbol><symbol id="ti-minus" viewBox="0 0 24 24"><path d="M5 12l14 0" /></symbol><symbol id="ti-plus" viewBox="0 0 24 24"><path d="M12 5l0 14" /> <path d="M5 12l14 0" /></symbol><symbol id="ti-chevron-down" viewBox="0 0 24 24"><path d="M6 9l6 6l6 -6" /></symbol><symbol id="ti-chevron-right" viewBox="0 0 24 24"><path d="M9 6l6 6l-6 6" /></symbol><symbol id="ti-chevron-left" viewBox="0 0 24 24"><path d="M15 6l-6 6l6 6" /></symbol><symbol id="ti-dots-vertical" viewBox="0 0 24 24"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /> <path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /></symbol><symbol id="ti-refresh" viewBox="0 0 24 24"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /> <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></symbol><symbol id="ti-download" viewBox="0 0 24 24"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" /> <path d="M7 11l5 5l5 -5" /> <path d="M12 4l0 12" /></symbol><symbol id="ti-external-link" viewBox="0 0 24 24"><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /> <path d="M11 13l9 -9" /> <path d="M15 4h5v5" /></symbol><symbol id="ti-map" viewBox="0 0 24 24"><path d="M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13" /> <path d="M9 4v13" /> <path d="M15 7v13" /></symbol><symbol id="ti-layout-grid" viewBox="0 0 24 24"><path d="M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /> <path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /> <path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /> <path d="M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" /></symbol><symbol id="ti-table" viewBox="0 0 24 24"><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14" /> <path d="M3 10h18" /> <path d="M10 3v18" /></symbol><symbol id="ti-arrow-up" viewBox="0 0 24 24"><path d="M12 5l0 14" /> <path d="M18 11l-6 -6" /> <path d="M6 11l6 -6" /></symbol><symbol id="ti-arrow-down" viewBox="0 0 24 24"><path d="M12 5l0 14" /> <path d="M18 13l-6 6" /> <path d="M6 13l6 6" /></symbol><symbol id="ti-arrow-up-right" viewBox="0 0 24 24"><path d="M17 7l-10 10" /> <path d="M8 7l9 0l0 9" /></symbol><symbol id="ti-alert-triangle" viewBox="0 0 24 24"><path d="M12 9v4" /> <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0" /> <path d="M12 16h.01" /></symbol><symbol id="ti-info-circle" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /> <path d="M12 9h.01" /> <path d="M11 12h1v4h1" /></symbol><symbol id="ti-bolt" viewBox="0 0 24 24"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" /></symbol><symbol id="ti-sun" viewBox="0 0 24 24"><path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /> <path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7" /></symbol><symbol id="ti-moon" viewBox="0 0 24 24"><path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008" /></symbol><symbol id="ti-file-text" viewBox="0 0 24 24"><path d="M14 3v4a1 1 0 0 0 1 1h4" /> <path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /> <path d="M9 9l1 0" /> <path d="M9 13l6 0" /> <path d="M9 17l6 0" /></symbol><symbol id="ti-home" viewBox="0 0 24 24"><path d="M5 12l-2 0l9 -9l9 9l-2 0" /> <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /> <path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></symbol><symbol id="ti-arrow-left" viewBox="0 0 24 24"><path d="M5 12l14 0" /> <path d="M5 12l6 6" /> <path d="M5 12l6 -6" /></symbol><symbol id="ti-alert-circle" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /> <path d="M12 8v4" /> <path d="M12 16h.01" /></symbol><symbol id="ti-plug-connected-x" viewBox="0 0 24 24"><path d="M20 16l-4 4" /> <path d="M7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1 -5 -5l1.5 -1.5" /> <path d="M17 12l-5 -5l1.5 -1.5a3.536 3.536 0 1 1 5 5l-1.5 1.5" /> <path d="M3 21l2.5 -2.5" /> <path d="M18.5 5.5l2.5 -2.5" /> <path d="M10 11l-2 2" /> <path d="M13 14l-2 2" /> <path d="M16 16l4 4" /></symbol><symbol id="ti-lock" viewBox="0 0 24 24"><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6" /> <path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /> <path d="M8 11v-4a4 4 0 1 1 8 0v4" /></symbol><symbol id="ti-user" viewBox="0 0 24 24"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" /> <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" /></symbol><symbol id="ti-circle-check" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /> <path d="M9 12l2 2l4 -4" /></symbol><symbol id="ti-circle-x" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /> <path d="M10 10l4 4m0 -4l-4 4" /></symbol><symbol id="ti-clock" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" /> <path d="M12 7v5l3 3" /></symbol><symbol id="ti-calendar" viewBox="0 0 24 24"><path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12" /> <path d="M16 3v4" /> <path d="M8 3v4" /> <path d="M4 11h16" /> <path d="M11 15h1" /> <path d="M12 15v3" /></symbol>';

  function mount() {
    if (document.getElementById('dk-icon-sprite')) return;
    var host = document.createElement('div');
    host.id = 'dk-icon-sprite';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + SPRITE + '</svg>';
    document.body.insertBefore(host, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  /** Разметка иконки. name — без префикса ti-, например 'search'. */
  window.dkIcon = function (name, className) {
    return '<svg class="dk-i' + (className ? ' ' + className : '') +
           '" aria-hidden="true"><use href="#ti-' + name + '"/></svg>';
  };

  /** Иконка узлом: <svg class="dk-i …"><use href="#ti-…"/></svg>. */
  window.dkIcon.el = function (name, className) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'dk-i' + (className ? ' ' + className : ''));
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#ti-' + name);
    svg.appendChild(use);
    return svg;
  };

  /** Имена всех иконок набора — удобно для витрины и для проверок. */
  window.dkIconNames = SPRITE.match(/id="ti-([a-z0-9-]+)"/g).map(function (s) {
    return s.slice(7, -1);
  });
})();
