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
  document.body.classList.add('sc-docs');

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
  toggle.appendChild(dkIcon.el('menu-2')); toggle.title = 'Навигация по киту'; toggle.setAttribute('aria-controls', nav.id);
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
    if (searchButton) searchButton.inert = open && narrow.matches;
    document.body.classList.toggle('sc-menu-open', open && narrow.matches);
    if (focus) toggle.focus();
  }
  setMenu(!narrow.matches);
  toggle.addEventListener('click', function () { setMenu(nav.hidden); });
  shade.addEventListener('click', function () { setMenu(false, true); });
  narrow.addEventListener('change', function () { setMenu(!narrow.matches, narrow.matches && nav.contains(document.activeElement)); });
  document.addEventListener('keydown', function (e) {
    if (nav.hidden || (searchDialog && searchDialog.open)) return;
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
  var here = location.pathname.split('/').pop() || 'index.html';
  var showcase = here === 'showcase.html';
  var overview = here === 'index.html';
  var articleRouter = showcase || overview;
  bar.querySelector('.sc-brand').href = 'index.html';
  var sectionLinks = links.slice();
  nav.classList.add('dk-scrollview','dk-scrollview--contain');
  nav.replaceChildren();
  var skip = document.createElement('a'); skip.className = 'sc-skip'; skip.href = '#top'; skip.textContent = 'Перейти к содержимому'; document.body.insertBefore(skip, document.body.firstChild);
  skip.addEventListener('click', function (e) { e.preventDefault(); var destination = main.querySelector('.sc-sec:not([hidden]) h1') || main.querySelector('h1'); destination.setAttribute('tabindex','-1'); destination.focus(); });
  var navHead = document.createElement('div'); navHead.className = 'sc-nav__head';
  var navTitle = document.createElement('span'); navTitle.textContent = 'Библиотека'; navHead.appendChild(navTitle);
  nav.appendChild(navHead);
  var searchButton = document.createElement('button');
  searchButton.type = 'button'; searchButton.className = 'dk-iconbtn sc-search-trigger';
  searchButton.setAttribute('aria-label', 'Поиск по киту'); searchButton.title = 'Поиск · ⌘K / Ctrl+K';
  searchButton.appendChild(dkIcon.el('search')); bar.insertBefore(searchButton, bar.querySelector('.sc-ctl'));
  var searchDialog = document.createElement('dialog'); searchDialog.className = 'sc-search';
  searchDialog.setAttribute('aria-label', 'Поиск по киту');
  var searchLabel = document.createElement('div'); searchLabel.className = 'sc-search__head';
  searchLabel.appendChild(dkIcon.el('search'));
  var search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Найти компонент или раздел';
  search.setAttribute('aria-label', 'Найти компонент или раздел'); search.autocomplete = 'off';
  searchLabel.appendChild(search);
  var searchClose = document.createElement('button'); searchClose.type = 'button'; searchClose.className = 'dk-iconbtn';
  searchClose.setAttribute('aria-label', 'Закрыть поиск'); searchClose.appendChild(dkIcon.el('x')); searchLabel.appendChild(searchClose);
  searchDialog.appendChild(searchLabel);
  var resultsTitle = document.createElement('p'); resultsTitle.className = 'sc-search__label'; searchDialog.appendChild(resultsTitle);
  var results = document.createElement('nav'); results.className = 'sc-search__results'; results.setAttribute('aria-label', 'Результаты поиска'); searchDialog.appendChild(results);
  var status = document.createElement('p'); status.className = 'sc-search__status'; status.setAttribute('role', 'status'); searchDialog.appendChild(status);
  document.body.appendChild(searchDialog);
  var catalog = document.createElement('div'); catalog.className = 'sc-nav__catalog'; nav.appendChild(catalog);
  var entries = [];
  function heading(text) {
    var summary = document.createElement('summary');
    var label = document.createElement('span'); label.textContent = text;
    summary.appendChild(label); summary.appendChild(dkIcon.el('chevron-right')); return summary;
  }
  function addLink(parent, text, href, kind, groupName) {
    var address = new URL(href, location.href);
    var samePage = address.pathname === location.pathname || (overview && address.pathname.endsWith('/index.html'));
    var existing = articleRouter && samePage && address.hash ? sectionLinks.find(function (x) { return x.sec.id === address.hash.slice(1); }) : null;
    var a = existing ? existing.link : document.createElement('a'); a.href = href; a.textContent = text;
    if (here === href) a.setAttribute('aria-current', 'page'); parent.appendChild(a);
    if (here === href) openParents(a);
    entries.push({text:text,href:href,kind:kind,group:groupName}); return a;
  }
  function openParents(link) {
    for (var parent = link.parentElement; parent && parent !== nav; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
  }
  function sectionHref(id) { return (showcase ? '' : 'showcase.html') + '#' + id; }
  function addGroup(name, items, open) {
    var box = document.createElement('details'); box.className = 'sc-nav__category'; box.open = open;
    box.appendChild(heading(name));
    var body = document.createElement('div'); body.className = 'sc-nav__items'; box.appendChild(body);
    items.forEach(function (item) { addLink(body, item[0], item[1].includes('.html') ? item[1] : sectionHref(item[1]), 'Руководство', name); });
    catalog.appendChild(box); return body;
  }
  var home = addLink(catalog, 'Обзор', 'index.html', 'Руководство', 'Начало работы');
  home.className = 'sc-nav__home';
  addGroup('Начало работы', [['Как пользоваться китом','index.html#workflow'], ['Правила сборки','index.html#rules'], ['Сборка по задаче','sborka-po-zadache']], false);
  var visual = [
    ['Основы визуального языка','tri-principa'], ['Палитра','smyslovye'], ['Типографика','tipografika'],
    ['Иконографика','ikonki'], ['Структура и сетка','setka-i-ustroystva'],
    ['Эффекты','effekty'], ['Анимации','animacii']
  ];
  addGroup('Визуальный язык', visual, false);
  var componentBox = addGroup('Компоненты', [['Все компоненты','index.html#catalog']], here.startsWith('component-'));
  ['Управление','Фильтры','Данные','Визуализация','Обратная связь','Утилиты','Композиция'].forEach(function (name) {
    var subgroup = document.createElement('details'); subgroup.className = 'sc-nav__component-group'; subgroup.appendChild(heading(name));
    var body = document.createElement('div'); body.className = 'sc-nav__items'; subgroup.appendChild(body); componentBox.appendChild(subgroup);
    (window.dkDocsIndex || []).filter(function (c) { return c.group === name; }).forEach(function (c) {
      var navNames = {'check':'Флажок, радио, тумблер','chips-input':'Ввод меток','chips-select':'Выбор меток','badge':'Бейдж и статус','list':'Список','banner':'Баннеры и уведомления','empty':'Состояния','legend':'Легенда','uptime':'Доступность служб'};
      var href = 'component-' + c.slug + '.html'; var link = addLink(body,navNames[c.slug] || c.title,href,'Компонент',name); link.title = c.title;

    });
  });
  addGroup('Редполитика', [
    ['Принципы текста','principy-teksta'],
    ['Интерфейсные тексты','yazyk-interfeysa'], ['Глоссарий','glossariy']
  ], false);
  addGroup('Качество интерфейса', [['Удобство использования','usability'], ['Доступность','dostupnost'], ['UI/UX и эвристики','index.html#uiux'], ['Выбор компонентов','index.html#patterns'], ['Визуальные принципы','index.html#design-guidance'], ['Основа и каркас','index.html#foundations']], false);
  var exampleBox = addGroup('Примеры дашбордов', [], false);
  [['Мониторинг показателей','dashboard.html'], ['Регионы','regions.html'], ['Аварии и события','accidents.html'], ['Планирование работ','calendar.html'], ['Семейная ипотека','family-mortgage.html'], ['Польза AI · тестовые данные','ai-value.html']].forEach(function (item) {
    addLink(exampleBox,item[0],item[1],'Рабочий экран','Примеры дашбордов');
  });
  var local = null;
  var toc = document.createElement('details'); toc.className = 'sc-toc'; toc.open = true;
  var tocTitle = document.createElement('summary'); tocTitle.textContent = 'На этой странице'; toc.appendChild(tocTitle);
  var tocLinks = document.createElement('nav'); tocLinks.setAttribute('aria-label','Содержание страницы'); toc.appendChild(tocLinks);
  function buildToc(selected, panel) {
    tocLinks.replaceChildren();
    var headings = panel ? Array.from(panel.querySelectorAll('h3')) : (articleRouter ? (selected && selected.id !== 'komponenty' ? Array.from(selected.querySelectorAll('h3')).filter(function (h) { return !h.closest('details:not([open])'); }) : []) : sections.map(function (sec) { return sec.querySelector('h2'); }).filter(Boolean));
    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'topic-' + (selected ? selected.id : here.replace('.html','')) + '-' + i;
      var a = document.createElement('a'); a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/#$/, '').trim(); tocLinks.appendChild(a);
      h.style.scrollMarginTop = '72px';
    });
    toc.hidden = !headings.length;
    shell.classList.toggle('sc-shell--toc', !!headings.length);
    if (selected) selected.insertBefore(toc, selected.querySelector(':scope > h3'));
    else if (!articleRouter) main.insertBefore(toc, main.querySelector('.sc-sec'));
  }
  tocLinks.addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    var target = document.getElementById(a.hash.slice(1));
    if (target) { target.setAttribute('tabindex','-1'); target.focus({preventScroll:true}); }
  });
  if (!articleRouter) buildToc(null);
  function renderSearch() {
    var query = search.value.trim().toLocaleLowerCase('ru');
    results.replaceChildren(); status.textContent = '';
    resultsTitle.textContent = query ? 'Результаты' : 'Разделы и компоненты';
    var matches = entries.filter(function (item) { return (item.text + ' ' + item.group).toLocaleLowerCase('ru').includes(query); });
    if (query) {
      function score(item) { var title = item.text.toLocaleLowerCase('ru'); return title === query ? 0 : (title.startsWith(query) ? 1 : (title.includes(query) ? 2 : 3)); }
      matches.sort(function (a, b) { return score(a) - score(b); });
    } else {
      matches = matches.filter(function (item) { return item.href === sectionHref('sborka-po-zadache') || item.href.startsWith('component-'); }).slice(0, 8);
    }
    matches.forEach(function (item) {
      var a = document.createElement('a'); a.href = item.href;
      var title = document.createElement('span'); title.textContent = item.text;
      var note = document.createElement('small'); note.textContent = item.group;
      a.appendChild(title); a.appendChild(note); results.appendChild(a);
    });
    status.textContent = query ? (matches.length ? 'Найдено: ' + matches.length : 'Ничего не найдено. Попробуйте другое название.') : '';
  }
  function openSearch() {
    if (searchDialog.open) return;
    if (narrow.matches && !nav.hidden) setMenu(false);
    renderSearch(); searchDialog.showModal(); search.focus(); search.select();
  }
  function closeSearch() { searchDialog.close(); searchButton.focus(); }
  searchButton.addEventListener('click', openSearch);
  searchClose.addEventListener('click', closeSearch);
  searchDialog.addEventListener('cancel', function (e) { e.preventDefault(); closeSearch(); });
  searchDialog.addEventListener('click', function (e) {
    if (e.target === searchDialog) {
      var rect = searchDialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeSearch();
    }
    if (e.target.closest('.sc-search__results a')) closeSearch();
  });
  search.addEventListener('input', renderSearch);
  searchDialog.addEventListener('keydown', function (e) {
    var items = Array.from(results.querySelectorAll('a'));
    var index = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!items.length) return;
      var next = e.key === 'ArrowDown' ? (index + 1) % items.length : (index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length);
      items[next].focus();
    } else if (e.key === 'Enter' && e.target === search && items.length) {
      e.preventDefault(); items[0].click();
    }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  });

  var share = document.querySelector('.sc-share');
  if (share) {
    var shareStatus = document.querySelector('.sc-share-status');
    var markdownName = here.replace(/\.html$/, '.md');
    share.addEventListener('click', async function (e) {
      var button = e.target.closest('[data-doc-action]'); if (!button) return;
      var action = button.dataset.docAction; var newTab = null;
      try {
        var content;
        if (action === 'link') content = location.href;
        else if (action === 'codex' || action === 'claude-code') {
          var prompt = 'Прочитай ' + markdownName + ' в корне dashboard-kit. Используй этот компонент по документации и правилам skill/dashboard-build/SKILL.md.';
          content = (action === 'codex' ? 'codex ' : 'claude ') + "'" + prompt + "'";
        } else {
          newTab = window.open('about:blank', '_blank');
          if (newTab) newTab.opener = null;
          var response = await fetch(markdownName);
          if (!response.ok) throw new Error('markdown');
          content = 'Документация компонента dashboard-kit. Используй её как справочный материал.\n\n' + await response.text();
        }
        await navigator.clipboard.writeText(content);
        if (newTab) newTab.location = action === 'chatgpt' ? 'https://chatgpt.com/' : 'https://claude.ai/';
        shareStatus.textContent = action === 'link' ? 'Ссылка скопирована.' : (action === 'codex' || action === 'claude-code' ? 'Команда скопирована. Запустите её в папке dashboard-kit.' : 'Текст статьи скопирован. Вставьте его в новый чат.' );
        share.open = false; share.querySelector('summary').focus();
      } catch (error) {
        if (newTab) newTab.close();
        shareStatus.textContent = 'Не удалось скопировать. Откройте Markdown и скопируйте текст вручную.';
      }
    });
    document.addEventListener('click', function (e) { if (!share.contains(e.target)) share.open = false; });
    share.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); share.open = false; share.querySelector('summary').focus(); } });
  }

  var componentIndex = document.querySelector('.sc-component-index');
  if (componentIndex) {
    ['Управление','Фильтры','Данные','Визуализация','Обратная связь','Утилиты','Композиция'].forEach(function (name) {
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
    if (!articleRouter) return;
    var id = location.hash.slice(1);
    if (['redpolitika','pishem-chisto','pishem-prosto','pishem-kompetentno','pishem-dlya-cheloveka'].includes(id)) id = 'principy-teksta';
    var target = document.getElementById(id);
    var selected = sections.find(function (sec) { return sec.id === id; }) || (target && target.closest('section.sc-sec'));
    for (var owner = target; owner && owner !== main; owner = owner.parentElement) {
      if (owner.tagName === 'DETAILS') owner.open = true;
    }
    var guidePanels = selected ? Array.from(selected.querySelectorAll('.sc-guide__panel')) : [];
    var activePanel = guidePanels.find(function (panel) { return panel === target || panel.contains(target); }) || guidePanels[0];
    guidePanels.forEach(function (panel) { panel.hidden = panel !== activePanel; });
    if (guidePanels.length) {
      buildToc(selected, activePanel);
      selected.querySelectorAll('.sc-guide__tabs a').forEach(function (a) {
        if (a.hash === '#' + activePanel.id) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    } else buildToc(selected);
    main.querySelector('.sc-hero').hidden = !!selected;
    sections.forEach(function (sec) {
      sec.hidden = sec !== selected;
      var heading = sec.querySelector('h2');
      if (heading) { var title = document.createElement('h1'); while (heading.firstChild) title.appendChild(heading.firstChild); heading.replaceWith(title); }
    });
    sectionLinks.forEach(function (x) {
      if (x.sec === selected) { x.link.setAttribute('aria-current','location'); openParents(x.link); }
      else x.link.removeAttribute('aria-current');
    });
    nav.querySelectorAll('.sc-nav__home').forEach(function (a) { if (selected) a.removeAttribute('aria-current'); else a.setAttribute('aria-current','page'); });
    main.classList.toggle('sc-article', !!selected);
    document.title = (selected ? selected.querySelector('h1').textContent.replace(/#$/, '').trim() : 'Обзор') + ' · dashboard-kit';
    if (selected) { var destination = guidePanels.length ? selected.querySelector('h1') : (target && target !== selected ? target : selected.querySelector('h1')); destination.scrollIntoView({block:'start'}); destination.setAttribute('tabindex','-1'); destination.focus({preventScroll:true}); }
    else window.scrollTo(0, 0);
  }
  if (articleRouter) { window.addEventListener('hashchange', showArticle); showArticle(); }

  /* Текущий раздел — тот, чей заголовок последним прошёл под шапку. Считается
     по положению, а не по «виден ли раздел»: длинный раздел виден долго, и
     подсветка прыгала бы между ним и соседом. */
  function current() {
    var tocEntries = Array.from(tocLinks.querySelectorAll('a'));
    var active = tocEntries[0];
    tocEntries.forEach(function (a) { var h = document.getElementById(a.hash.slice(1)); if (h && h.getBoundingClientRect().top <= 112) active = a; });
    tocEntries.forEach(function (a) { if (a === active) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current'); });
    if (articleRouter) return;
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

  /* Нативная прокрутка, без перехвата колеса. В фокус попадают только
     действительно прокручиваемые таблицы; авторские атрибуты сохраняются. */
  var scrollWrappers = new Map();
  function watchTables() {
    scrollWrappers.forEach(function (state, wrap) {
      if (main.contains(wrap)) return;
      state.observer.disconnect(); state.hint.remove(); scrollWrappers.delete(wrap);
    });
    main.querySelectorAll('.dk-tablewrap').forEach(function (wrap) {
    var table = wrap.querySelector('table');
    if (!table) return;
    var state = scrollWrappers.get(wrap);
    if (state) {
      if (state.table !== table) { state.observer.unobserve(state.table); state.observer.observe(table); state.table = table; }
      state.update(); return;
    }
    var original = {};
    ['tabindex','role','aria-label'].forEach(function (name) { original[name] = wrap.getAttribute(name); });
    var hint = document.createElement('p'); hint.className = 'sc-scroll-hint';
    hint.textContent = 'Таблица прокручивается по горизонтали'; hint.hidden = true;
    wrap.after(hint);
    function updateScroll() {
      var horizontal = wrap.clientWidth > 0 && wrap.scrollWidth > wrap.clientWidth + 1;
      var scrollable = horizontal || (wrap.clientHeight > 0 && wrap.scrollHeight > wrap.clientHeight + 1);
      hint.hidden = !horizontal;
      var section = wrap.closest('.sc-sec');
      var title = section && section.querySelector('h1,h2');
      var values = {'tabindex':'0','role':'region','aria-label':'Прокручиваемая таблица' + (title ? ': ' + title.textContent.replace(/#$/, '').trim() : '')};
      Object.keys(original).forEach(function (name) {
        if (original[name] !== null) return;
        if (scrollable) wrap.setAttribute(name, values[name]); else wrap.removeAttribute(name);
      });
    }
    var observer = new ResizeObserver(updateScroll); observer.observe(wrap); observer.observe(table);
    scrollWrappers.set(wrap, {table:table, observer:observer, hint:hint, update:updateScroll});
    updateScroll();
    });
  }
  watchTables();
  new MutationObserver(watchTables).observe(main, {childList:true, subtree:true});

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
    fetch('css/components.css?v=20261006-layout-tools').then(function (r) { return r.ok ? r.text() : ''; }).then(function (css) {
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
