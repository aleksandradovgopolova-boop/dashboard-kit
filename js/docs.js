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
  var lastMegaTrigger = null, currentMegaId = '';
  var hoverMenu = false, menuCloseTimer = null;
  var desktopHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  var compactNav = window.matchMedia('(max-width:859px)'), compactToggle = null;
  function cancelMenuClose() { clearTimeout(menuCloseTimer); }
  function scheduleMenuClose() {
    cancelMenuClose();
    if (!hoverMenu) return;
    menuCloseTimer = setTimeout(function () { if (!nav.contains(document.activeElement)) setMenu(false); },180);
  }
  var shade = document.createElement('div');
  shade.className = 'sc-shade'; shade.hidden = true;
  shell.insertBefore(shade, nav);
  function revealCurrentComponent() {
    var active = nav.querySelector('.sc-nav__component-group a[aria-current="page"]');
    if (active && !nav.hidden && megaContent) {
      var item = active.getBoundingClientRect(), frame = megaContent.getBoundingClientRect();
      if (item.top < frame.top || item.bottom > frame.bottom) megaContent.scrollTop += item.top - frame.top - megaContent.clientHeight / 2;
    }
  }
  function revealMegaCategory() {
    if (!megaRail || nav.hidden) return;
    var active = megaRail.querySelector('[aria-expanded="true"]');
    if (!active) return;
    var item = active.getBoundingClientRect(), frame = megaRail.getBoundingClientRect();
    if (item.left < frame.left) megaRail.scrollLeft += item.left - frame.left;
    else if (item.right > frame.right) megaRail.scrollLeft += item.right - frame.right;
  }
  function setMenu(open, focus) {
    cancelMenuClose();
    if (!open) hoverMenu = false;
    nav.hidden = !open;
    shell.classList.toggle('sc-shell--closed', !open);
    if (megaButtons) megaButtons.forEach(function (button) { button.setAttribute('aria-expanded', String(open && button.getAttribute('aria-controls') === currentMegaId)); });
    shade.hidden = !open; main.inert = open;
    document.body.classList.toggle('sc-menu-open', open);
    if (compactToggle) compactToggle.setAttribute('aria-expanded',String(open));
    if (focus) { var returnTo = compactNav.matches ? compactToggle : lastMegaTrigger; if (returnTo) returnTo.focus({preventScroll:true}); }
    if (open) requestAnimationFrame(function () {
      revealMegaCategory(); revealCurrentComponent();
    });
  }
  setMenu(false);
  shade.addEventListener('click', function () { setMenu(false, true); });
  window.addEventListener('resize', function () { if (!nav.hidden) requestAnimationFrame(function () { revealMegaCategory(); revealCurrentComponent(); }); });
  document.addEventListener('keydown', function (e) {
    if (nav.hidden || (searchDialog && searchDialog.open)) return;
    if (e.key === 'Escape') { e.preventDefault(); setMenu(false, true); }
    if (e.key === 'Tab') {
      var targets = Array.from(bar.querySelectorAll('a,button,input')).concat(Array.from(nav.querySelectorAll('a,input,button'))).filter(function (el) { return !el.disabled && !el.inert && el.getClientRects().length; });
      var first = targets[0], last = targets[targets.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  nav.addEventListener('pointerenter',cancelMenuClose);
  nav.addEventListener('pointerleave',scheduleMenuClose);
  bar.addEventListener('pointerleave',scheduleMenuClose);
  nav.addEventListener('focusin',function () { hoverMenu = false; cancelMenuClose(); });
  var sections = Array.prototype.slice.call(main.querySelectorAll(':scope > section'));
  var group = '';
  var links = [];

  sections.forEach(function (sec, i) {
    sec.classList.add('sc-sec');
    var h = sec.querySelector('h2');
    if (!h) return;
    var title = h.textContent.trim();
    if (!sec.id) sec.id = slug(title);
    sec.querySelectorAll('h3').forEach(function (heading) { if (!heading.id) heading.id = sec.id + '--' + slug(heading.textContent); });
    if (sec.dataset.group) group = sec.dataset.group;
    var eb = document.createElement('p');
    eb.className = 'sc-eyebrow';
    eb.textContent = group;
    if (sec.dataset.group) sec.insertBefore(eb, h);

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
  searchButton.appendChild(dkIcon.el('search')); var searchText = document.createElement('span'); searchText.className = 'sc-search-trigger__text'; searchText.textContent = 'Поиск в ките…'; searchButton.appendChild(searchText); bar.insertBefore(searchButton, bar.querySelector('.sc-ctl'));
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
  var menuEmoji = {'Обзор':'🏠','Начало работы':'🧭','Дизайн-система':'🎨','Компоненты':'🧩','Разработка':'💻'};
  function emojiLabel(parent, text) {
    if (menuEmoji[text]) { var icon = document.createElement('span'); icon.className = 'sc-nav__emoji'; icon.setAttribute('aria-hidden','true'); icon.textContent = menuEmoji[text]; parent.appendChild(icon); }
    var label = document.createElement('span'); label.className = 'sc-nav__text'; label.textContent = text; parent.appendChild(label);
  }
  function heading(text, iconName) {
    var summary = document.createElement('summary');
    emojiLabel(summary, text);
    summary.appendChild(dkIcon.el('chevron-right')); return summary;
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
      if (parent.classList.contains('sc-mega__panel')) selectMega(parent.id);
    }
  }
  function sectionHref(id) { return (showcase ? '' : 'showcase.html') + '#' + id; }
  function addGroup(name, items, open, iconName) {
    var box = document.createElement('details'); box.className = 'sc-nav__category'; box.open = open;
    box.appendChild(heading(name, iconName));
    var body = document.createElement('div'); body.className = 'sc-nav__items'; box.appendChild(body);
    items.forEach(function (item) { addLink(body, item[0], item[1].includes('.html') ? item[1] : sectionHref(item[1]), 'Руководство', name); });
    catalog.appendChild(box); return body;
  }
  var home = addLink(catalog, 'Обзор', 'index.html', 'Руководство', 'Начало работы');
  home.className = 'sc-nav__home';
  home.replaceChildren(); emojiLabel(home, 'Обзор');
  addGroup('Начало работы', [['Собрать дашборд','index.html#start'], ['Как работать с ИИ','index.html#workflow'], ['Сборка по задаче','sborka-po-zadache'], ['Правила сборки','index.html#rules'], ['Рабочие сценарии','sdk-extensions']], false, 'arrow-up-right');
  function subsection(parent, title) {
    var label = document.createElement('p'); label.className = 'sc-nav__subhead';
    label.textContent = title; parent.appendChild(label);
  }
  var design = addGroup('Дизайн-система', [], false);
  [
    ['Визуальный язык', [['Основы визуального языка','tri-principa'], ['Палитра','smyslovye'], ['Типографика','tipografika'], ['Иконографика','ikonki'], ['Структура и сетка','setka-i-ustroystva'], ['Эффекты','effekty'], ['Анимации','animacii']]],
    ['Редполитика', [['Принципы текста','principy-teksta'], ['Интерфейсные тексты','yazyk-interfeysa'], ['Глоссарий','glossariy']]],
    ['Качество интерфейса', [['Удобство использования','usability'], ['Доступность','dostupnost'], ['UI/UX и эвристики','index.html#uiux'], ['Выбор компонентов','index.html#patterns'], ['Визуальные принципы','index.html#design-guidance']]]
  ].forEach(function (section) {
    subsection(design, section[0]);
    section[1].forEach(function (item) { addLink(design, item[0], item[1].includes('.html') ? item[1] : sectionHref(item[1]), 'Руководство', 'Дизайн-система · ' + section[0]); });
  });
  var components = addGroup('Компоненты', [], false);
  components.parentElement.classList.add('sc-nav__component-group');
  addLink(components, 'Все компоненты', 'index.html#catalog', 'Каталог', 'Компоненты');
  ['Композиция','Управление','Фильтры','Данные','Визуализация','Обратная связь','Утилиты'].forEach(function (name) {
    subsection(components, name);
    (window.dkDocsIndex || []).filter(function (c) { return c.group === name; }).forEach(function (c) {
      var navNames = {'check':'Флажок, радио, тумблер','chips-input':'Ввод меток','chips-select':'Выбор меток','badge':'Бейдж и статус','list':'Список','banner':'Баннеры и уведомления','empty':'Состояния','legend':'Легенда','uptime':'Доступность служб'};
      var link = addLink(components, navNames[c.slug] || c.title, 'component-' + c.slug + '.html', 'Компонент', 'Компоненты · ' + name); link.title = c.title;
    });
  });
  addGroup('Разработка', [['Стек и библиотеки','index.html#development'], ['Контракт и тиражирование','index.html#development--scale'], ['Основа и каркас','index.html#foundations'], ['Подключение и проверка','index.html#development--connect']], false);
  // Examples remain available on the overview and through search.
  [['Эталон · данные и действия','reference-dashboard.html'], ['Мониторинг показателей','dashboard.html'], ['Регионы','regions.html'], ['Аварии и события','accidents.html'], ['Планирование работ','calendar.html'], ['Семейная ипотека','family-mortgage.html'], ['Польза AI · тестовые данные','ai-value.html']].forEach(function (item) {
    entries.push({text:item[0],href:item[1],kind:'Рабочий экран',group:'Примеры дашбордов'});
  });
  // Reuse the existing links and route references in a header megamenu.
  nav.classList.add('sc-mega'); nav.setAttribute('aria-label','Библиотека кита');
  nav.classList.remove('dk-scrollview','dk-scrollview--contain');
  navHead.remove();
  var megaRail = document.createElement('div'); megaRail.className = 'sc-mega__rail sc-topnav'; megaRail.setAttribute('aria-label','Основные разделы');
  var megaContent = document.createElement('div'); megaContent.className = 'sc-mega__content';
  var megaPanels = [], megaButtons = [], initialMega = '';
  var topicEmoji = {'Визуальный язык':'🎨','Редполитика':'✍️','Качество интерфейса':'✅','Композиция':'🧱','Управление':'🎛️','Фильтры':'🔎','Данные':'📋','Визуализация':'📊','Обратная связь':'💬','Утилиты':'🛠️'};
  function selectMega(id) {
    if (!megaPanels) return;
    currentMegaId = id;
    megaPanels.forEach(function (panel) { panel.hidden = panel.id !== id; });
    megaButtons.forEach(function (button) { button.setAttribute('aria-expanded',String(!nav.hidden && button.getAttribute('aria-controls') === id)); });
    if (megaContent) megaContent.scrollTop = 0;
    requestAnimationFrame(revealMegaCategory);
  }
  Array.from(catalog.children).forEach(function (item, index) {
    if (item.tagName === 'A') { item.classList.add('sc-mega__category','sc-mega__home'); megaRail.appendChild(item); return; }
    var title = item.querySelector('summary .sc-nav__text').textContent;
    var button = document.createElement('button'); button.type = 'button'; button.className = 'sc-mega__category';
    button.id = 'sc-mega-trigger-' + index; emojiLabel(button,title);
    var panel = item.querySelector('.sc-nav__items'); panel.id = 'sc-mega-panel-' + index;
    panel.classList.add('sc-mega__panel'); panel.setAttribute('role','region'); panel.setAttribute('aria-labelledby',button.id);
    if (item.classList.contains('sc-nav__component-group')) panel.classList.add('sc-nav__component-group');
    button.setAttribute('aria-controls', panel.id); button.setAttribute('aria-expanded','false');
    if (item.open) initialMega = panel.id;
    var content = Array.from(panel.children), groups = document.createElement('div'), quick = document.createElement('div'), activeGroup = null;
    groups.className = 'sc-mega__groups'; quick.className = 'sc-mega__quicklinks';
    var heading = document.createElement('h2'); heading.className = 'sc-mega__title'; heading.textContent = title;
    content.forEach(function (child) {
      if (child.classList.contains('sc-nav__subhead')) {
        activeGroup = document.createElement('section'); activeGroup.className = 'sc-mega__group';
        var groupTitle = document.createElement('h3'); groupTitle.className = 'sc-mega__group-title';
        var glyph = topicEmoji[child.textContent];
        if (glyph) { var icon = document.createElement('span'); icon.className = 'sc-doc-emoji'; icon.setAttribute('aria-hidden','true'); icon.textContent = glyph; groupTitle.appendChild(icon); }
        groupTitle.appendChild(document.createTextNode(child.textContent)); activeGroup.appendChild(groupTitle); groups.appendChild(activeGroup); child.remove();
      } else (activeGroup || quick).appendChild(child);
    });
    panel.replaceChildren(heading); if (quick.children.length) panel.appendChild(quick); if (groups.children.length) panel.appendChild(groups);
    megaRail.appendChild(button); megaContent.appendChild(panel); megaPanels.push(panel); megaButtons.push(button);
    button.addEventListener('click',function () {
      var close = !nav.hidden && currentMegaId === panel.id;
      if (hoverMenu) close = false;
      hoverMenu = false; lastMegaTrigger = button; selectMega(panel.id); setMenu(!close);
    });
    button.addEventListener('pointerenter',function (event) {
      if (event.pointerType !== 'mouse' || !desktopHover.matches || compactNav.matches || nav.contains(document.activeElement)) return;
      cancelMenuClose(); hoverMenu = true; lastMegaTrigger = button; selectMega(panel.id); setMenu(true);
    });
    button.addEventListener('keydown',function (event) {
      hoverMenu = false; cancelMenuClose();
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); var next = (megaButtons.indexOf(button) + (event.key === 'ArrowRight' ? 1 : -1) + megaButtons.length) % megaButtons.length;
        var wasOpen = !nav.hidden; megaButtons[next].focus();
        if (wasOpen) { lastMegaTrigger = megaButtons[next]; selectMega(lastMegaTrigger.getAttribute('aria-controls')); setMenu(true); }
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault(); lastMegaTrigger = button; selectMega(panel.id); setMenu(true);
        var first = panel.querySelector('a'); if (first) first.focus();
      }
    });
    item.remove();
  });
  catalog.replaceChildren(megaContent);
  bar.insertBefore(megaRail,searchButton);
  megaRail.querySelector('.sc-mega__home').addEventListener('pointerenter',scheduleMenuClose);
  var barTools = document.createElement('div'); barTools.className = 'sc-bar__tools';
  bar.appendChild(barTools); barTools.append(searchButton,bar.querySelector('.sc-ctl'));
  compactToggle = document.createElement('button'); compactToggle.type = 'button'; compactToggle.className = 'sc-bar__menu';
  compactToggle.textContent = 'Меню'; compactToggle.setAttribute('aria-label','Меню разделов кита'); compactToggle.setAttribute('aria-controls',nav.id); compactToggle.setAttribute('aria-expanded','false');
  bar.insertBefore(compactToggle,barTools);
  compactToggle.addEventListener('click',function () { hoverMenu = false; setMenu(nav.hidden); });
  compactToggle.addEventListener('keydown',function (event) { if (event.key === 'ArrowDown') { event.preventDefault(); setMenu(true); megaRail.querySelector('a').focus(); } });
  function syncCompactNavigation() {
    var restore = !nav.hidden || megaRail.contains(document.activeElement) || document.activeElement === compactToggle;
    setMenu(false); compactToggle.hidden = !compactNav.matches;
    if (compactNav.matches) nav.insertBefore(megaRail,catalog);
    else bar.insertBefore(megaRail,compactToggle);
    if (restore) (compactNav.matches ? compactToggle : megaButtons.find(function (button) { return button.getAttribute('aria-controls') === currentMegaId; })).focus({preventScroll:true});
  }
  compactNav.addEventListener('change',syncCompactNavigation); syncCompactNavigation();
  if (!initialMega && showcase) { var designPanel = megaPanels.find(function (panel) { return panel.querySelector('.sc-mega__title').textContent === 'Дизайн-система'; }); if (designPanel) initialMega = designPanel.id; }
  selectMega(initialMega || megaPanels[0].id);
  if (here.startsWith('component-')) requestAnimationFrame(revealCurrentComponent);
  var local = null;
  var toc = document.createElement('details'); toc.className = 'sc-toc'; toc.open = window.innerWidth >= 640;
  var tocTitle = document.createElement('summary'); tocTitle.textContent = 'На этой странице'; toc.appendChild(tocTitle);
  var tocLinks = document.createElement('nav'); tocLinks.setAttribute('aria-label','Содержание страницы'); toc.appendChild(tocLinks);
  function buildToc(selected, panel) {
    tocLinks.replaceChildren();
    var headings = panel ? Array.from(panel.querySelectorAll('h3')) : (articleRouter ? (selected && selected.id !== 'komponenty' ? Array.from(selected.querySelectorAll('h3')).filter(function (h) { return !h.closest('details:not([open])'); }) : []) : sections.map(function (sec) { return sec.querySelector('h2'); }).filter(Boolean));
    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'topic-' + (selected ? selected.id : here.replace('.html','')) + '-' + i;
      var section = h.closest('.sc-sec');
      if (!articleRouter && section && section.dataset.group) {
        var groupLabel = document.createElement('p'); groupLabel.className = 'sc-toc__group';
        groupLabel.textContent = section.dataset.group; tocLinks.appendChild(groupLabel);
      }
      var a = document.createElement('a'); a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/#$/, '').trim(); tocLinks.appendChild(a);
      if (!articleRouter && section) section.querySelectorAll(':scope > h3').forEach(function (sub) {
        var sublink = document.createElement('a'); sublink.href = '#' + sub.id;
        sublink.className = 'sc-toc__sub'; sublink.textContent = sub.textContent;
        tocLinks.appendChild(sublink);
      });
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
    if (!nav.hidden) setMenu(false);
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
    ['Композиция','Управление','Фильтры','Данные','Визуализация','Обратная связь','Утилиты'].forEach(function (name) {
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
    setMenu(false);
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
      var heading = sec.querySelector(':scope > h2');
      if (heading) { var title = document.createElement('h1'); while (heading.firstChild) title.appendChild(heading.firstChild); heading.replaceWith(title); }
    });
    sectionLinks.forEach(function (x) {
      if (x.sec === selected) { x.link.setAttribute('aria-current','location'); openParents(x.link); }
      else x.link.removeAttribute('aria-current');
    });
    megaRail.querySelectorAll('.sc-nav__home').forEach(function (a) { if (selected || !overview) a.removeAttribute('aria-current'); else a.setAttribute('aria-current','page'); });
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

// Task entry works with any assistant; copying does not open an external service.
(function () {
  var button = document.querySelector('[data-copy-task]');
  if (!button) return;
  button.addEventListener('click', async function () {
    var status = document.querySelector('[data-copy-task-status]');
    try {
      await navigator.clipboard.writeText(document.getElementById('dashboard-task-prompt').textContent);
      status.textContent = 'Запрос скопирован. Вставьте его помощнику и добавьте свои данные.';
    } catch (_) {
      status.textContent = 'Не удалось скопировать автоматически. Выделите текст запроса и скопируйте вручную.';
    }
  });
})();
