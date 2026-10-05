/* ============================================================================
   dashboard-kit · docs.js
   Каркас страниц документации: оглавление, номера разделов, значения цветов
   под образцами, числа в шапке витрины. Один файл на все страницы
   документации — иначе вторая страница получила бы вторую копию, а копию
   нельзя починить один раз (см. dk-util.js). В дашборды не идёт.
   ============================================================================ */

/* Каркас витрины: оглавление, номера разделов, значения цветов, числа в шапке.
   Всё выводится из самой страницы и файлов кита, а не пишется руками:
   оглавление, написанное руками, разошлось бы со страницей при первом новом
   разделе — ровно так разошлась тема графиков с токенами. */
(function () {
  'use strict';
  if (!document.querySelector('.sc-nav')) return;

  var LAT = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',
              о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',
              э:'e',ю:'yu',я:'ya' };
  function slug(t) {
    return t.toLowerCase().split('').map(function (c) { return LAT[c] != null ? LAT[c] : c; }).join('')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  var nav = document.querySelector('.sc-nav');
  nav.id = 'sc-navigation';
  var shell = nav.parentElement;
  var bar = document.querySelector('.sc-bar');
  var main = shell.querySelector('.dk-wrap');
  var narrow = window.matchMedia('(max-width:1023px)');
  var toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'dk-btn dk-btn--sm';
  toggle.appendChild(dkIcon.el('layout-grid')); toggle.title = 'Навигация по киту'; toggle.setAttribute('aria-controls', nav.id);
  bar.insertBefore(toggle, bar.firstChild);
  var shade = document.createElement('div');
  shade.className = 'sc-shade'; shade.hidden = true;
  shell.insertBefore(shade, nav);
  function setMenu(open, focus) {
    nav.hidden = !open;
    shell.classList.toggle('sc-shell--closed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Скрыть меню' : 'Открыть меню');
    shade.hidden = !open || !narrow.matches;
    main.inert = open && narrow.matches;
    bar.querySelector('.sc-brand').inert = open && narrow.matches;
    bar.querySelector('.sc-ctl').inert = open && narrow.matches;
    document.body.classList.toggle('sc-menu-open', open && narrow.matches);
    if (focus) toggle.focus();
  }
  setMenu(!narrow.matches);
  toggle.addEventListener('click', function () { setMenu(nav.hidden); });
  shade.addEventListener('click', function () { setMenu(false, true); });
  narrow.addEventListener('change', function () { setMenu(!narrow.matches, true); });
  document.addEventListener('keydown', function (e) {
    if (nav.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); setMenu(false, true); }
    if (e.key === 'Tab' && narrow.matches) {
      var targets = [toggle].concat(Array.from(nav.querySelectorAll('summary, a, input, button')).filter(function (el) { return el.getClientRects().length; }));
      var first = targets[0], last = targets[targets.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  nav.addEventListener('click', function (e) {
    if (narrow.matches && e.target.closest('a')) setMenu(false, true);
  });
  var sections = Array.prototype.slice.call(document.querySelectorAll('section.sc-sec'));
  var group = '';
  var links = [];

  sections.forEach(function (sec, i) {
    var h = sec.querySelector('h2');
    if (!h) return;
    var title = h.textContent.trim();
    if (!sec.id) sec.id = slug(title);
    sec.querySelectorAll('h3').forEach(function (heading) { if (!heading.id) heading.id = sec.id + '--' + slug(heading.textContent); });
    if (sec.dataset.group) group = sec.dataset.group;
    var eb = document.createElement('p');
    eb.className = 'sc-eyebrow';
    eb.textContent = group;
    sec.insertBefore(eb, h);

    var a = document.createElement('a');
    a.className = 'sc-anchor';
    a.href = '#' + sec.id;
    a.textContent = '#';
    a.setAttribute('aria-label', 'Ссылка на раздел «' + title + '»');
    h.appendChild(a);

    var l = document.createElement('a');
    l.href = '#' + sec.id;
    l.textContent = title;
    nav.appendChild(l);
    links.push({ sec: sec, link: l });
  });

  /* Навигация по задачам: обзор и компоненты рядом, без дублирующего
     плоского списка. Названия компонентов приходят из общего указателя. */
  var here = location.pathname.split('/').pop();
  var showcase = here === 'showcase.html';
  var sectionLinks = links.slice();
  nav.replaceChildren();
  var skip = document.createElement('a'); skip.className = 'sc-skip'; skip.href = '#top'; skip.textContent = 'Перейти к содержимому'; document.body.insertBefore(skip, document.body.firstChild);
  skip.addEventListener('click', function (e) { e.preventDefault(); var destination = main.querySelector('.sc-sec:not([hidden]) h1') || main.querySelector('h1'); destination.setAttribute('tabindex','-1'); destination.focus(); });
  var navHead = document.createElement('div'); navHead.className = 'sc-nav__head';
  var navTitle = document.createElement('span'); navTitle.textContent = 'Библиотека'; navHead.appendChild(navTitle);
  nav.appendChild(navHead);
  var searchLabel = document.createElement('label'); searchLabel.className = 'sc-nav__search dk-field';
  var search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Найти в ките';
  search.setAttribute('aria-label', 'Найти раздел или компонент'); search.autocomplete = 'off';
  searchLabel.appendChild(dkIcon.el('search')); searchLabel.appendChild(search); nav.appendChild(searchLabel);
  var catalog = document.createElement('div'); catalog.className = 'sc-nav__catalog'; nav.appendChild(catalog);
  var results = document.createElement('div'); results.className = 'sc-nav__results'; results.hidden = true; nav.appendChild(results);
  var status = document.createElement('p'); status.className = 'sc-nav__status'; status.setAttribute('role', 'status'); nav.appendChild(status);
  var entries = [];
  function heading(text) {
    var summary = document.createElement('summary');
    var label = document.createElement('span'); label.textContent = text;
    summary.appendChild(label); summary.appendChild(dkIcon.el('chevron-right')); return summary;
  }
  function addLink(parent, text, href, kind, groupName) {
    var existing = showcase && href.charAt(0) === '#' ? sectionLinks.find(function (x) { return x.sec.id === href.slice(1); }) : null;
    var a = existing ? existing.link : document.createElement('a'); a.href = href; a.textContent = text;
    if (here === href) a.setAttribute('aria-current', 'page'); parent.appendChild(a);
    entries.push({text:text,href:href,kind:kind,group:groupName}); return a;
  }
  function sectionHref(id) { return (showcase ? '' : 'showcase.html') + '#' + id; }
  function addGroup(name, items, open) {
    var box = document.createElement('details'); box.className = 'sc-nav__category'; box.open = open;
    box.appendChild(heading(name));
    var body = document.createElement('div'); body.className = 'sc-nav__items'; box.appendChild(body);
    items.forEach(function (item) { addLink(body, item[0], sectionHref(item[1]), 'Руководство', name); });
    catalog.appendChild(box); return body;
  }
  var home = document.createElement('a'); home.className = 'sc-nav__home'; home.href = 'showcase.html';
  home.appendChild(document.createTextNode('Обзор')); catalog.appendChild(home);
  var visual = [
    ['Основы визуального языка','tri-principa'], ['Палитра','smyslovye'], ['Типографика','tipografika'],
    ['Иконографика','ikonki'], ['Структура и сетка','setka-i-ustroystva'],
    ['Эффекты','effekty'], ['Анимации','animacii']
  ];
  addGroup('Визуальный язык', visual, false);
  var componentBox = addGroup('Компоненты', [['Все компоненты','komponenty']], !showcase);
  ['Управление','Фильтры','Данные','Визуализация','Обратная связь'].forEach(function (name) {
    var subgroup = document.createElement('details'); subgroup.className = 'sc-nav__component-group'; subgroup.appendChild(heading(name));
    var body = document.createElement('div'); body.className = 'sc-nav__items'; subgroup.appendChild(body); componentBox.appendChild(subgroup);
    (window.dkDocsIndex || []).filter(function (c) { return c.group === name; }).forEach(function (c) {
      var href = 'component-' + c.slug + '.html'; addLink(body,c.title,href,'Компонент',name);
      if (here === href) subgroup.open = true;
    });
  });
  addGroup('Редполитика', [
    ['Принципы текста','principy-teksta'],
    ['Интерфейсные тексты','yazyk-interfeysa'], ['Глоссарий','glossariy']
  ], false);
  addGroup('Качество интерфейса', [['Удобство использования','usability'], ['Доступность','dostupnost']], false);
  var exampleBox = addGroup('Примеры дашбордов', [], false);
  [['Мониторинг показателей','dashboard.html'], ['Аварии и события','accidents.html'], ['Планирование работ','calendar.html']].forEach(function (item) {
    addLink(exampleBox,item[0],item[1],'Рабочий экран','Примеры дашбордов');
  });
  var local = null;
  var toc = document.createElement('details'); toc.className = 'sc-toc'; toc.open = true;
  var tocTitle = document.createElement('summary'); tocTitle.textContent = 'На этой странице'; toc.appendChild(tocTitle);
  var tocLinks = document.createElement('nav'); tocLinks.setAttribute('aria-label','Содержание страницы'); toc.appendChild(tocLinks);
  function buildToc(selected) {
    tocLinks.replaceChildren();
    var headings = showcase ? (selected && selected.id !== 'komponenty' ? Array.from(selected.querySelectorAll(':scope > h3')) : []) : sections.map(function (sec) { return sec.querySelector('h2'); }).filter(Boolean);
    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'topic-' + (selected ? selected.id : here.replace('.html','')) + '-' + i;
      var a = document.createElement('a'); a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/#$/, '').trim(); tocLinks.appendChild(a);
      h.style.scrollMarginTop = '72px';
    });
    toc.hidden = !headings.length;
    shell.classList.toggle('sc-shell--toc', !!headings.length);
    if (selected) selected.insertBefore(toc, selected.querySelector(':scope > h3'));
    else if (!showcase) main.insertBefore(toc, main.querySelector('.sc-sec'));
  }
  tocLinks.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    var target = document.getElementById(a.hash.slice(1));
    if (target) { target.setAttribute('tabindex','-1'); target.focus({preventScroll:true}); }
  });
  if (!showcase) buildToc(null);
  search.addEventListener('input', function () {
    var query = search.value.trim().toLocaleLowerCase('ru');
    catalog.hidden = !!query; results.hidden = !query; if (local) local.hidden = !!query;
    results.replaceChildren(); status.textContent = '';
    if (!query) return;
    var matches = entries.filter(function (item) { return (item.text + ' ' + item.group).toLocaleLowerCase('ru').includes(query); });
    matches.forEach(function (item) {
      var a = document.createElement('a'); a.href = item.href;
      var title = document.createElement('span'); title.textContent = item.text;
      var note = document.createElement('small'); note.textContent = item.kind + ' · ' + item.group;
      a.appendChild(title); a.appendChild(note); results.appendChild(a);
    });
    status.textContent = matches.length ? 'Найдено: ' + matches.length : 'Ничего не найдено. Попробуйте другое название.';
  });

  var componentIndex = document.querySelector('.sc-component-index');
  if (componentIndex) {
    ['Управление','Фильтры','Данные','Визуализация','Обратная связь'].forEach(function (name) {
      var block = document.createElement('div'); var h = document.createElement('h3'); h.textContent = name; block.appendChild(h);
      (window.dkDocsIndex || []).filter(function (c) { return c.group === name; }).forEach(function (c) {
        var a = document.createElement('a'); a.href = 'component-' + c.slug + '.html'; var text = document.createElement('span'); text.className = 'sc-component-index__text';
        var title = document.createElement('strong'); title.textContent = c.title; text.appendChild(title);
        var description = document.createElement('small'); description.textContent = c.description || ''; text.appendChild(description); a.appendChild(text);
        a.appendChild(dkIcon.el('chevron-right')); block.appendChild(a);
      }); componentIndex.appendChild(block);
    });
  }
  /* Витрина читается как документация: один выбранный раздел, а не
     непрерывная лента всех образцов. Существующие адреса разделов сохранены. */
  function showArticle() {
    if (!showcase) return;
    var id = location.hash.slice(1);
    if (['redpolitika','pishem-chisto','pishem-prosto','pishem-kompetentno','pishem-dlya-cheloveka'].includes(id)) id = 'principy-teksta';
    var target = document.getElementById(id);
    var selected = sections.find(function (sec) { return sec.id === id; }) || (target && target.closest('section.sc-sec'));
    buildToc(selected);
    main.querySelector('.sc-hero').hidden = !!selected;
    sections.forEach(function (sec) {
      sec.hidden = sec !== selected;
      var heading = sec.querySelector('h2');
      if (heading) { var title = document.createElement('h1'); while (heading.firstChild) title.appendChild(heading.firstChild); heading.replaceWith(title); }
    });
    sectionLinks.forEach(function (x) {
      if (x.sec === selected) { x.link.setAttribute('aria-current','location'); var owner = x.link.closest('details'); if (owner) owner.open = true; }
      else x.link.removeAttribute('aria-current');
    });
    nav.querySelectorAll('.sc-nav__home').forEach(function (a) { if (selected) a.removeAttribute('aria-current'); else a.setAttribute('aria-current','page'); });
    main.classList.toggle('sc-article', !!selected);
    document.title = (selected ? selected.querySelector('h1').textContent.replace(/#$/, '').trim() + ' · ' : '') + 'dashboard-kit';
    if (selected) { var destination = target && target !== selected ? target : selected.querySelector('h1'); destination.scrollIntoView({block:'start'}); destination.setAttribute('tabindex','-1'); destination.focus({preventScroll:true}); }
  }
  if (showcase) { window.addEventListener('hashchange', showArticle); showArticle(); }

  /* Текущий раздел — тот, чей заголовок последним прошёл под шапку. Считается
     по положению, а не по «виден ли раздел»: длинный раздел виден долго, и
     подсветка прыгала бы между ним и соседом. */
  function current() {
    var tocEntries = Array.from(tocLinks.querySelectorAll('a'));
    var active = tocEntries[0];
    tocEntries.forEach(function (a) { var h = document.getElementById(a.hash.slice(1)); if (h && h.getBoundingClientRect().top <= 112) active = a; });
    tocEntries.forEach(function (a) { if (a === active) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); });
    if (showcase) return;
    var line = 56 + 40;
    var cur = links[0];
    links.forEach(function (x) { if (x.sec.getBoundingClientRect().top <= line) cur = x; });
    links.forEach(function (x) {
      if (x === cur) x.link.setAttribute('aria-current', 'true');
      else x.link.removeAttribute('aria-current');
    });
    // Ссылки на другие страницы компонентов подсветка разделов не трогает.

  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; current(); });
  }, { passive: true });
  current();

  /* Значение под каждым образцом цвета. Берётся с экрана, а не из файла:
     половина токенов собрана color-mix, и в файле у них формула, а не цвет. */
  /* Зонд — внутри обёртки с цветом-меткой. var() с нецветовым значением
     браузер не отвергает при разборе, а делает свойство «наследуемым» уже
     при вычислении: color становится цветом родителя. Метка на самом зонде
     не помогала (её тоже перекрывало наследование), метка на родителе —
     помогает: нецветной токен приходит как rgb(1, 2, 3). */
  var probeWrap = document.createElement('span');
  probeWrap.style.cssText = 'display:none;color:rgb(1, 2, 3)';
  var probe = document.createElement('span');
  probeWrap.appendChild(probe);
  document.body.appendChild(probeWrap);
  /* Сначала ставится цвет-метка, потом значение: если значение — не цвет
     (отступ, шрифт, длительность, необъявленный входной параметр), браузер
     оставит метку, и по ней это видно. Без метки нецветной токен наследовал
     цвет текста, и под --duration-fast стояло #fbfbfb — значение, которое
     врёт. */
  function hex(value) {
    probe.style.color = '';
    probe.style.color = value;
    var c = getComputedStyle(probe).color;
    if (c === 'rgb(1, 2, 3)') return '';
    var m = c.match(/[\d.]+/g);
    if (!m) return '';
    /* Токены из color-mix браузер отдаёт как color(srgb 0.27 0.29 0.33) —
       долями единицы, а не 0–255. Сначала это читалось как 0–255, и под
       --surface-3 стояло #000000: значение, которое врёт, хуже отсутствия. */
    var k = /^color\(/.test(c) ? 255 : 1;
    var h = '#' + m.slice(0, 3).map(function (v) {
      return Math.max(0, Math.min(255, Math.round(+v * k))).toString(16).padStart(2, '0');
    }).join('');
    var a = m[3] != null ? Math.round(+m[3] * 100) : 100;
    return a < 100 ? h + ' · ' + a + '%' : h;
  }
  var chips = [];
  document.querySelectorAll('.sc-sw > div').forEach(function (d) {
    var i = d.querySelector('i'), name = d.querySelector('span');
    if (!i || !name) return;
    var m = /var\((--[\w-]+)\)/.exec(i.getAttribute('style') || '');
    if (!m) return;
    var v = document.createElement('small');
    d.appendChild(v);
    chips.push({ token: m[1], el: v });
  });
  function paint() {
    chips.forEach(function (c) {
      var h = hex('var(' + c.token + ')');
      if (h) { c.el.textContent = h; if (c.sw) c.sw.hidden = false; return; }
      // Не цвет — отступ, шрифт, длительность: показываем значение как есть.
      // Пусто — токен нигде не объявлен: это входной параметр компонента
      // (var(--accent, …)), и так и пишем.
      var raw = getComputedStyle(document.documentElement).getPropertyValue(c.token).trim();
      c.el.textContent = raw ? raw.slice(0, 40) : 'входной параметр';
      if (c.sw) c.sw.hidden = true;
    });
  }
  paint();
  new MutationObserver(paint).observe(document.documentElement,
    { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });

  /* Токены компонента — со страницы стилей, а не руками. Берутся правила,
     чей селектор начинается с одного из перечисленных префиксов; из тел —
     все var(--…). Значение — с экрана, в текущей теме, и обновляется вместе
     с ней. Если файл не прочитать (страница открыта двойным щелчком), список
     остаётся с честной подписью «не прочитан», а не пустым.

     Префикс совпадает по границе имени блока, а не по первым буквам: «dk-tab»
     берёт .dk-tab, .dk-tab__n и .dk-tab--x, но не .dk-table. Сравнение по
     буквам показывало на странице вкладок четырнадцать токенов таблицы. Префикс с дефисом на конце («dk-td-») — это семейство и берёт
     всё, что с него начинается. То же правило в tools/build-manifest.py
     (owns): кому принадлежит класс, решается в ките одним способом. */
  function owns(sel, px) {
    var s = '.' + px;
    if (sel.indexOf(s) !== 0) return false;
    if (px.charAt(px.length - 1) === '-') return true;
    var rest = sel.slice(s.length);
    return !rest || rest.indexOf('__') === 0 || rest.indexOf('--') === 0 || !/[a-z0-9_-]/.test(rest.charAt(0));
  }
  var tokBox = document.querySelector('[data-tokens]');
  if (tokBox) {
    var prefixes = tokBox.dataset.tokens.split(',');
    fetch('css/components.css').then(function (r) { return r.ok ? r.text() : ''; }).then(function (css) {
      css = css.replace(/\/\*[\s\S]*?\*\//g, '');
      var names = {}, m, rule = /([^{}]+)\{([^{}]*)\}/g;
      while ((m = rule.exec(css))) {
        var sels = m[1].split(',').map(function (x) { return x.trim(); });
        var ours = sels.some(function (sel) {
          return prefixes.some(function (px) { return owns(sel, px); });
        });
        if (!ours) continue;
        var v, re = /var\(\s*(--[a-z0-9-]+)/g;
        while ((v = re.exec(m[2]))) names[v[1]] = 1;
      }
      var list = Object.keys(names).sort();
      if (!list.length) { unread(); return; }
      tokBox.textContent = '';
      list.forEach(function (n) {
        var li = document.createElement('li');
        var sw = document.createElement('i'); sw.style.background = 'var(' + n + ')';
        var b = document.createElement('b'); b.textContent = n;
        var s = document.createElement('small');
        li.appendChild(sw); li.appendChild(b); li.appendChild(s); tokBox.appendChild(li);
        chips.push({ token: n, el: s, sw: sw });
      });
      paint();
    }).catch(unread);
  }
  // Разметка собирается узлами, а не строкой: у docs.js нет данных снаружи,
  // но правило ЭКРАН одно на все скрипты, и исключение для «тут точно нет
  // данных» однажды накроет скрипт, где они появятся.
  function unread() {
    var li = document.createElement('li');
    li.className = 'sc-tokens__wait';
    li.textContent = 'Файл стилей не прочитан';
    tokBox.textContent = ''; tokBox.appendChild(li);
  }

})();
