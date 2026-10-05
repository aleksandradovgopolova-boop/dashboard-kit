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
  var narrow = window.matchMedia('(max-width:1199px)');
  var toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'dk-btn dk-btn--sm';
  toggle.textContent = 'Меню'; toggle.setAttribute('aria-controls', nav.id);
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
      var targets = [toggle].concat(Array.from(nav.querySelectorAll('summary, a')).filter(function (el) { return el.getClientRects().length; }));
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
    if (sec.dataset.group) group = sec.dataset.group;
    var eb = document.createElement('p');
    eb.className = 'sc-eyebrow';
    eb.textContent = group + ' · ' + String(i + 1).padStart(2, '0');
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
  var groups = ['Основы', 'Каркас страницы', 'Управление и фильтры', 'Данные', 'Графики и регионы', 'Обратная связь'];
  var sectionGroups = {
    'Каркас':'Каркас страницы', 'Сетка и устройства':'Каркас страницы', 'Размер виджета':'Каркас страницы',
    'Управление':'Управление и фильтры', 'Фильтры-легенда':'Управление и фильтры', 'Фильтры':'Управление и фильтры', 'Формы':'Управление и фильтры',
    'Атомы':'Данные', 'Сводка и рейтинг':'Данные', 'Доступность и списки':'Данные', 'Таблица':'Данные',
    'Календарь':'Графики и регионы', 'Регионы':'Графики и регионы', 'Графики':'Графики и регионы',
    'Состояние страницы':'Обратная связь', 'Страницы ошибок':'Обратная связь', 'Состояния':'Обратная связь'
  };
  var componentGroups = { 'Управление':'Управление и фильтры', 'Фильтры':'Управление и фильтры', 'Данные':'Данные', 'Визуализация':'Графики и регионы', 'Обратная связь':'Обратная связь' };
  var here = location.pathname.split('/').pop();
  var showcase = here === 'showcase.html';
  var sectionLinks = links.slice();
  nav.replaceChildren();
  var home = document.createElement('a'); home.href = 'showcase.html'; home.textContent = 'Обзор кита'; nav.appendChild(home);
  if (!showcase) {
    var pageGroup = document.createElement('details');
    var pageTitle = document.createElement('summary'); pageTitle.textContent = 'На этой странице'; pageGroup.appendChild(pageTitle);
    sectionLinks.forEach(function (x) { pageGroup.appendChild(x.link); }); nav.appendChild(pageGroup);
  }
  groups.forEach(function (name) {
    var box = document.createElement('details');
    var title = document.createElement('summary'); title.textContent = name; box.appendChild(title);
    if (showcase) {
      var overview = sectionLinks.filter(function (x) { return (sectionGroups[x.link.textContent] || 'Основы') === name; });
      overview.forEach(function (x) { box.appendChild(x.link); });
      box.open = name === 'Основы';
    }
    if (!showcase && (name === 'Основы' || name === 'Каркас страницы')) {
      var basics = name === 'Основы' ? ['Три принципа', 'Акцент', 'Смысловые', 'Отступы', 'Иконки', 'Типографика', 'Язык интерфейса'] : ['Каркас', 'Сетка и устройства', 'Размер виджета'];
      basics.forEach(function (text) { var a = document.createElement('a'); a.href = 'showcase.html#' + slug(text); a.textContent = text; box.appendChild(a); });
    }
    (window.dkDocsIndex || []).filter(function (c) { return componentGroups[c.group] === name; }).forEach(function (c, i) {
      if (showcase && i === 0) { var label = document.createElement('div'); label.className = 'sc-nav__label'; label.textContent = 'Подробно о компонентах'; box.appendChild(label); }
      var a = document.createElement('a'); a.href = 'component-' + c.slug + '.html'; a.textContent = c.title;
      if (here === 'component-' + c.slug + '.html') { a.setAttribute('aria-current', 'page'); box.open = true; }
      box.appendChild(a);
    });
    if (box.children.length > 1) nav.appendChild(box);
  });

  /* Текущий раздел — тот, чей заголовок последним прошёл под шапку. Считается
     по положению, а не по «виден ли раздел»: длинный раздел виден долго, и
     подсветка прыгала бы между ним и соседом. */
  function current() {
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

  /* Числа в шапке. Токены смысла — объявления в семантическом слое, блоки —
     имена вида .dk-имя без элемента и модификатора в слое компонентов,
     проверки — функции check_ в tools/check.py. Если файл не прочитать
     (страница открыта двойным щелчком), число остаётся прочерком, а не
     выдуманным. */
  function fact(name, value) {
    var el = document.querySelector('[data-fact="' + name + '"]');
    if (el && value) el.textContent = value;
  }
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

  if (!document.querySelector('[data-fact]')) return;
  fact('sections', String(links.length));
  /* Комментарии вырезаются только у CSS. Сначала вырезались у всех, и
     шапка показывала «10 проверок» вместо двадцати: в check.py сочетания
     слеша со звёздочкой стоят внутри регулярных выражений, и вырезание
     съедало половину функций. Число из файла — тоже утверждение, и его
     сверили с файлом. */
  function count(url, re, css) {
    return fetch(url).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
      var seen = {}, m, n = 0;
      if (css) t = t.replace(/\/\*[\s\S]*?\*\//g, '');
      while ((m = re.exec(t))) { if (!seen[m[1]]) { seen[m[1]] = 1; n++; } }
      return n ? String(n) : '';
    }).catch(function () { return ''; });
  }
  count('css/tokens.semantic.css', /(--[a-z][\w-]*)\s*:/g, true).then(function (n) { fact('tokens', n); });
  count('css/components.css', /\.(dk-[a-z]+(?:-[a-z]+)*)(?![\w-])/g, true).then(function (n) { fact('blocks', n); });
  // Проверки считаются по нумерованному списку в шапке check.py — это их
  // перечень. Не по функциям check_*: среди них есть check_page, команда
  // для чужой страницы, и шапка показывала 26 проверок при 25 (29.09).
  count('tools/check.py', /^\s+(\d+)\.\s+[А-ЯЁ]{3,}/gm).then(function (n) { fact('checks', n); });
})();
