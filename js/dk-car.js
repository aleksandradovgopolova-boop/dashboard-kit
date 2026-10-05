/* ============================================================================
   dashboard-kit · dk-car.js
   Лента карточек: «Резко выросли за день», «В фокусе дня». Карточки стоят в
   ряд и листаются вбок, каждая прилипает к левому краю.

   Разметку пишет страница (css/components.css, «Лента карточек»), скрипт её
   только оживляет — как dk-table.js оживляет таблицу:
   - счётчик «1 из 5» в шапке ленты;
   - точки под лентой — где ты в ряду;
   - на широком экране с мышью — стрелки «назад» и «вперёд»: колесом вбок
     листает не каждая мышь, а без стрелок лента с мышью — тупик.

   ПОЧЕМУ СЧЁТЧИК СЛОВАМИ, А НЕ ТОЛЬКО ТОЧКИ. Точки — это цвет и ширина, их
   не прочитает скринридер и плохо различит тот, кто плохо видит. «1 из 5»
   говорит то же самое словами; точки при нём — подсказка, а не единственный
   признак (aria-hidden).

   ПОЧЕМУ ПОЗИЦИЯ ПО БЛИЖАЙШЕЙ К КРАЮ КАРТОЧКЕ. Карточка прилипает левым
   краем (scroll-snap-align: start), значит «текущая» — та, чей левый край
   ближе всех к левому краю ленты. Последние карточки до края могут не
   дойти — ряд кончился; тогда текущей считается последняя.
   ============================================================================ */

(function () {
  'use strict';

  function own(el, destroy) {
    if (!window.dkOwn) throw new Error('dashboard-kit: подключите js/dk-util.js первым');
    return window.dkOwn(el, destroy);
  }

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  window.dkCar = function (host) {
    if (!host) { console.error('dk-car: не передан контейнер'); return null; }
    var track = host.querySelector('.dk-car__track');
    if (!track) { console.error('dk-car: нет .dk-car__track'); return null; }
    var items = Array.prototype.slice.call(track.children);
    var posEl = host.querySelector('.dk-car__pos');
    var dotsEl = host.querySelector('.dk-car__dots');
    var prev = host.querySelector('[data-car="prev"]');
    var next = host.querySelector('[data-car="next"]');
    var at = -1;

    if (dotsEl) {
      dotsEl.setAttribute('aria-hidden', 'true');
      // Узлами, а не строкой: правило ЭКРАН одно на все скрипты.
      dotsEl.textContent = '';
      items.forEach(function () { dotsEl.appendChild(document.createElement('span')); });
    }

    function current() {
      var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      var edge = track.scrollLeft;
      var best = 0, dist = Infinity;
      items.forEach(function (it, i) {
        var d = Math.abs(it.offsetLeft - track.offsetLeft - pad - edge);
        if (d < dist) { dist = d; best = i; }
      });
      // Ряд докручен до конца — последние карточки к краю не встанут.
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 2) best = items.length - 1;
      return best;
    }

    function sync() {
      // Все карточки помещаются — листать некуда, и «3 из 3» было бы
      // неправдой: человек видит все три сразу. Счётчик, точки и стрелки
      // тогда прячутся (data-fits, components.css).
      var fits = track.scrollWidth <= track.clientWidth + 2;
      if (host.getAttribute('data-fits') !== String(fits)) { host.setAttribute('data-fits', String(fits)); at = -1; }
      if (fits) return;
      var i = current();
      if (i === at) return;
      at = i;
      if (posEl) posEl.textContent = (i + 1) + ' из ' + items.length;
      if (dotsEl) Array.prototype.forEach.call(dotsEl.children, function (d, k) {
        d.classList.toggle('is-on', k === i);
      });
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === items.length - 1;
    }

    function go(i) {
      i = Math.max(0, Math.min(items.length - 1, i));
      var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      track.scrollTo({
        left: items[i].offsetLeft - track.offsetLeft - pad,
        behavior: reduce && reduce.matches ? 'auto' : 'smooth'
      });
    }

    var raf = 0;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; sync(); });
    }
    function onPrev() { go(current() - 1); }
    function onNext() { go(current() + 1); }

    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    if (prev) prev.addEventListener('click', onPrev);
    if (next) next.addEventListener('click', onNext);
    sync();

    var destroy = own(host, function () {
      track.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (prev) prev.removeEventListener('click', onPrev);
      if (next) next.removeEventListener('click', onNext);
    });

    return {
      get index() { return current(); },
      go: go,
      destroy: destroy
    };
  };
})();
