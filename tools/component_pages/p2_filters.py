# Фильтры: выпадающий фильтр, период, фильтры-легенда, пагинация.

OKRUGA = ("[{ value: 'cfo', name: 'Центральный', count: 18 }, { value: 'pfo', name: 'Приволжский', count: 14 }, "
          "{ value: 'ufo', name: 'Южный', count: 12 }, { value: 'szfo', name: 'Северо-Западный', count: 11 }, "
          "{ value: 'dfo', name: 'Дальневосточный', count: 11 }, { value: 'sfo', name: 'Сибирский', count: 10 }, "
          "{ value: 'skfo', name: 'Северо-Кавказский', count: 7 }, { value: 'urfo', name: 'Уральский', count: 6 }]")

PAGES = [
{
    "slug": "select", "title": "Фильтр", "group": "Фильтры", "status": "стабильный",
    "purpose": 'Ограничивает данные выбранными значениями из списка. Текущий выбор виден в закрытом фильтре.',
    "files": ["css/components.css", "js/dk-select.js"], "scripts": ["dk-select.js"],
    "live_intro": 'Выберите значение из списка или найдите его поиском. Выбранный фильтр остаётся виден после закрытия; его можно сбросить.',
    "live": """<div class="dk-panel"><div class="dk-toolbar" style="margin-top:0"><div class="dk-toolbar__group">
      <div id="x-okrug"></div><div id="x-tier"></div><div id="x-region"></div>
    </div><div class="dk-result" id="x-result"><b>89</b> регионов</div></div></div>""",
    "live_script": """  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkSelect !== 'function') return;
    var OKRUGA = """ + OKRUGA + """;
    var TIERS = [{ value: 'high', name: 'Высокий', count: 23 }, { value: 'mid', name: 'Средний', count: 27 },
                 { value: 'low', name: 'Низкий', count: 38 }, { value: 'nd', name: 'Мало данных', count: 1 }];
    var REGIONS = ['Донецкая Народная Республика','Крым','Саха (Якутия)','Новосибирская область','Ростовская область',
      'Забайкальский край','Луганская Народная Республика','Красноярский край','Свердловская область','Курская область',
      'Архангельская область','Приморский край','Краснодарский край','Московская область','Санкт-Петербург']
      .map(function (n, i) { return { value: 'r' + i, name: n, count: Math.max(0, 40 - i * 3) }; });
    var st = { okrug: null, tier: [], region: null }, out = document.getElementById('x-result');
    function paint() {
      var left = 89;
      if (st.okrug) left = OKRUGA.filter(function (o) { return o.value === st.okrug; })[0].count;
      if (st.tier.length) left = Math.min(left, st.tier.reduce(function (s, v) { return s + TIERS.filter(function (t) { return t.value === v; })[0].count; }, 0));
      if (st.region) left = 1;
      out.innerHTML = '<b>' + left + '</b>' + (left === 89 ? ' регионов' : ' из 89 регионов');
    }
    dkSelect(document.getElementById('x-okrug'), { label: 'Округ', options: OKRUGA, url: 'okrug', onChange: function (v) { st.okrug = v; paint(); } });
    dkSelect(document.getElementById('x-tier'), { label: 'Уровень риска', mode: 'multi', options: TIERS, search: false, url: 'tier', onChange: function (v) { st.tier = v; paint(); } });
    dkSelect(document.getElementById('x-region'), { label: 'Регион', options: REGIONS, url: 'region', onChange: function (v) { st.region = v; paint(); } });
    paint();
  });""",
    "when_yes": ['Нужно ограничить срез известными значениями: категориями, статусами, исполнителями.', 'Выбор применяется сразу и отражается в связанных показателях. Область действия фильтра понятна.', 'Для длинного списка нужен поиск; количество записей рядом со значением помогает оценить выбор.'],
    "when_no": ["Два–пять значений, видимых сразу, — <a href=\"component-segment.html\">Сегмент</a> или <a href=\"component-legend.html\">Фильтры-легенда</a>.",
                "Даты — <a href=\"component-period.html\">Период</a>.",
                "Ввод значения в форме, которое применяется по кнопке, — <a href=\"component-field.html\">Поле</a> с <code>&lt;select&gt;</code>."],
    "anatomy_html": """<div class="dk-toolbar" style="margin-top:0"><div class="dk-toolbar__group">
      <div class="dk-select" data-active="true"><button type="button" class="dk-select__trigger" aria-haspopup="listbox" aria-expanded="true"><b class="sc-callout">1</b><span class="dk-select__label">Округ: Сибирский</span><b class="sc-callout">2</b><svg class="dk-i"><use href="#ti-chevron-down"/></svg></button></div>
      <div class="dk-select"><button type="button" class="dk-select__trigger" aria-haspopup="listbox" aria-expanded="false"><span class="dk-select__label">Уровень риска</span><span class="dk-select__count"><b class="sc-callout">3</b>2</span><svg class="dk-i"><use href="#ti-chevron-down"/></svg></button></div>
    </div><div class="dk-result"><b class="sc-callout">4</b><b>10</b> из 89 регионов</div></div>
    <div class="dk-menu" style="position:static;margin-top:var(--space-5);max-width:320px"><div class="dk-menu__search"><b class="sc-callout">5</b><input type="search" placeholder="Поиск" aria-label="Поиск по списку"></div>
      <ul class="dk-menu__list" role="listbox"><li><button type="button" class="dk-menu__item" role="option" aria-selected="true"><b class="sc-callout">6</b><span class="dk-menu__name">Сибирский</span><span class="dk-menu__n"><b class="sc-callout">7</b>10</span><svg class="dk-i dk-i--sm dk-menu__mark"><use href="#ti-check"/></svg></button></li>
      <li><button type="button" class="dk-menu__item" role="option" aria-selected="false"><span class="dk-menu__name">Уральский</span><span class="dk-menu__n">6</span><svg class="dk-i dk-i--sm dk-menu__mark"><use href="#ti-check"/></svg></button></li></ul></div>""",
    "anatomy": [("Активный фильтр", "<code>data-active=\"true\"</code>: серая заливка поверх поля и подпись «Округ: Сибирский» — выбранное видно, не открывая меню."),
                ("Стрелка", "поле с меню; <code>aria-expanded</code> говорит скринридеру, открыто ли."),
                ("Счётчик", "<code>dk-select__count</code>: сколько значений выбрано в множественном фильтре."),
                ("Последствие", "<code>dk-result</code>: сколько записей осталось после фильтра — то, что человек обязан видеть сразу."),
                ("Поиск", "появляется сам, когда значений больше восьми."),
                ("Пункт", "<code>role=\"option\"</code>; выбранный отмечен галочкой, а не только цветом."),
                ("Число записей", "за каждым значением; ноль показывается приглушённым, а не прячется.")],
    "sizes": "Высота и радиус из общей шкалы контролов; в стеклянной теме обычный контрол — 44 px, <code>size: 'sm'</code> для шапки виджета. Ширина по подписи; "
             "длинная подпись переносится и остаётся видимой целиком.",
    "variants": [("mode: 'single'", "Один вариант; выбор применяется и закрывает меню.", "По умолчанию."),
                 ("mode: 'multi'", "Несколько; меню остаётся открытым, есть «Выбрать все».", "Уровни, виды работ."),
                 ("search: true | false", "Поле поиска в меню.", "Само включается от 9 значений."),
                 ("size: 'sm'", "Компактная высота через <code>--control-sm</code>; на таче цель не меньше 44 px.", "Шапка виджета."),
                 ("url: 'ключ'", "Значение пишется в адрес и читается при открытии.", "Всегда на дашбордах — ссылка на срез.")],
    "states": """<div class="dk-panel"><div class="dk-toolbar" style="margin-top:0"><div class="dk-toolbar__group">
      <div class="dk-select"><button type="button" class="dk-select__trigger" aria-haspopup="listbox" aria-expanded="false"><span class="dk-select__label">Пусто: Округ</span><svg class="dk-i"><use href="#ti-chevron-down"/></svg></button></div>
      <div class="dk-select" data-active="true"><button type="button" class="dk-select__trigger" aria-haspopup="listbox" aria-expanded="false"><span class="dk-select__label">Выбрано: Сибирский</span><svg class="dk-i"><use href="#ti-chevron-down"/></svg></button></div>
      <div class="dk-select"><button type="button" class="dk-select__trigger" aria-haspopup="listbox" aria-expanded="true" style="background:var(--surface-3)"><span class="dk-select__label">Открыт</span><svg class="dk-i"><use href="#ti-chevron-down"/></svg></button></div>
      <div class="dk-select"><button type="button" class="dk-select__trigger" aria-haspopup="listbox" aria-expanded="false" disabled style="opacity:.45"><span class="dk-select__label">Недоступен</span><svg class="dk-i"><use href="#ti-chevron-down"/></svg></button></div>
    </div></div></div>
    <div class="sc-note"><b>Пустой список — не пустое меню.</b> Если под текущий срез не осталось значений, меню говорит «Ничего не найдено» и предлагает снять поиск; молча пустой список читается как поломка.</div>""",
    "content_ok": ["Подпись — название измерения: «Округ», «Уровень риска»; после выбора — «Округ: Сибирский».",
                   "Число записей рядом с каждым значением.",
                   "Выбранное значение внутри самого фильтра; общий сброс-иконка появляется только при изменённом срезе."],
    "content_bad": ["«Все округа» после выбора — самая дорогая ошибка дашборда.",
                    "«Выбрано несколько» вместо числа.",
                    "Фильтр без счётчика результата: человек выбирает вслепую и попадает в пустой экран."],
    "a11y": ["<b>Роли.</b> Кнопка с <code>aria-haspopup=\"listbox\"</code> и <code>aria-expanded</code>; меню — <code>listbox</code> с <code>option</code> и <code>aria-selected</code>.",
             "<b>Клавиатура.</b> Стрелки, Home, End, Enter, Escape с возвратом фокуса на фильтр. Поиск получает фокус при открытии.",
             "<b>Не только цветом.</b> Выбранное отмечено галочкой; активный фильтр — ещё и текстом подписи.",
             "<b>Контраст.</b> Активный фильтр различим по подписи и мягкому тону поверхности; клавиатурный фокус виден отдельно."],
    "tokens": ["dk-select", "dk-menu", "dk-toolbar", "dk-result", "dk-chipbar", "dk-fchip"],
    "code_intro": "Контейнер пустой, разметку строит скрипт. Значения приходят списком объектов.",
    "code": """<!-- Строка фильтров — прямо на странице, над содержимым. На телефоне она
     переносится по доступной ширине. -->
<div class="dk-toolbar">
  <div class="dk-toolbar__group">
    <div id="period"></div>
    <div id="okrug"></div>
  </div>
</div>

<script>
var f = dkSelect(document.getElementById('okrug'), {
  label: 'Округ',
  options: [{ value: 'sfo', name: 'Сибирский', count: 10 }, /* … */],
  mode: 'single',        // или 'multi'
  url: 'okrug',          // ?okrug=sfo — ссылка на срез
  onChange: function (value) { /* строка или массив (multi) */ }
});
f.value;                 // текущее
f.set('sfo'); f.clear(); f.setOptions(list);
</script>""",
    "api": [("label", "строка", "Название измерения; после выбора становится «Название: значение»."),
            ("options[]", "массив {value, name, count}", "Значения; count — записей за значением, ноль не прячется."),
            ("mode", "'single' | 'multi'", "Одиночный закрывает меню, множественный — нет."),
            ("value", "строка | массив", "Начальное значение; адрес (url) главнее."),
            ("defaultValue", "строка", "Исходное значение одиночного фильтра, например all. Без активной заливки и крестика; clear() возвращает его."),
            ("search", "boolean", "Поле поиска; по умолчанию от 9 значений."),
            ("url", "строка", "Ключ в строке запроса; пусто — не пишется."),
            ("onChange(v)", "функция", "При каждой смене выбора."),
            ("value / set(v) / clear() / setOptions(list)", "API", "Читать и менять снаружи.")],
    "related": [("component-period.html", "Период", "тот же фильтр, только значение — время"),
                ("component-legend.html", "Фильтры-легенда", "фильтр в один ряд, когда значений мало"),
                ("component-table.html", "Таблица", "что стоит под фильтрами"),
                ("showcase.html#filtry", "Витрина: фильтры", "полный пример со строкой применённого")],
},
{
    "slug": "period", "title": "Период", "group": "Фильтры", "status": "стабильный",
    "purpose": 'Задаёт временной диапазон для связанных показателей, графиков и таблиц.',
    "files": ["css/components.css", "js/dk-period.js", "vendor/air-datepicker.js"], "scripts": ["dk-select.js", "vendor/air-datepicker.js", "dk-period.js"],
    "live_intro": 'Готовый период экономит время, собственный диапазон уточняет срез. В примере можно выбрать оба варианта.',
    "live": """<div class="dk-panel"><div class="dk-toolbar" style="margin-top:0"><div class="dk-toolbar__group"><div id="x-period"></div></div>
      <div class="dk-result" id="x-period-out"></div></div></div>""",
    "live_script": """  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkPeriod !== 'function') return;
    var out = document.getElementById('x-period-out');
    var p = dkPeriod(document.getElementById('x-period'), {
      label: 'Период', value: { preset: 7 }, url: 'period',
      onChange: function (v) { out.textContent = v ? dkFmt.range(v.from, v.to) : 'период не выбран'; }
    });
    var v = p.value; out.textContent = v ? dkFmt.range(v.from, v.to) : 'период не выбран';
  });""",
    "when_yes": ["Данные на странице зависят от интервала времени.",
                 "Обычно хватает пресетов, но иногда нужен произвольный диапазон.",
                 "Период должен переноситься ссылкой."],
    "when_no": ["Одна дата в форме (начало работы) — <a href=\"component-field.html\">Поле</a> с <code>type=\"datetime-local\"</code>.",
                "Показ работ по дням — <a href=\"component-calendar.html\">Календарь</a>: это не фильтр, а представление.",
                "Два–три фиксированных интервала без календаря — <a href=\"component-segment.html\">Сегмент</a> «7 дней / 30 дней»."],
    "anatomy_html": """<div class="dk-select dk-period" data-active="true"><button type="button" class="dk-select__trigger" aria-haspopup="dialog" aria-expanded="true"><b class="sc-callout">1</b><svg class="dk-i"><use href="#ti-calendar"/></svg><span class="dk-select__label">Последние 7 дней</span><svg class="dk-i"><use href="#ti-chevron-down"/></svg></button></div>
    <div class="dk-menu dk-period__menu sc-period-anatomy" style="position:static;margin-top:var(--space-5);display:flex;gap:var(--space-7)">
      <ul class="dk-menu__list dk-period__presets" role="list" style="min-width:180px"><b class="sc-callout">2</b>
        <li><button type="button" class="dk-menu__item" aria-pressed="false"><span class="dk-menu__name">Сегодня</span></button></li>
        <li><button type="button" class="dk-menu__item" aria-pressed="true"><span class="dk-menu__name">Последние 7 дней</span></button></li>
        <li><button type="button" class="dk-menu__item" aria-pressed="false"><span class="dk-menu__name">Последние 30 дней</span></button></li></ul>
      <div class="dk-period__cal" style="margin:0"><b class="sc-callout">3</b><span class="dk-caption">календарь Air Datepicker: две даты — диапазон</span></div></div>""",
    "anatomy": [("Поле", "как у фильтра, со значком календаря; подпись — название пресета или «11–24 сен»."),
                ("Пресеты", "список слева; выбранный отмечен. Пресет — это «последние N дней» от сегодня."),
                ("Календарь", "справа; клик по двум датам задаёт свой диапазон, дни внутри залиты серым <code>--control-soft</code>.")],
    "sizes": 'Высота согласована с фильтром; size: sm задаёт компактный вариант. Календарь должен помещаться в доступную ширину и оставаться внутри окна.',
    "variants": [("presets", "Свой список пресетов {name, days}.", "Когда стандартные не подходят."),
                 ("minDate / maxDate", "Границы выбора.", "Нет данных раньше или позже."),
                 ("size", "'sm'.", "Шапка виджета."),
                 ("url: 'period'", "Значение в адресе.", "Всегда на дашбордах.")],
    "states": """<div class="dk-panel"><div class="dk-toolbar" style="margin-top:0"><div class="dk-toolbar__group">
      <div class="dk-select dk-period"><button type="button" class="dk-select__trigger" aria-haspopup="dialog" aria-expanded="false"><svg class="dk-i"><use href="#ti-calendar"/></svg><span class="dk-select__label">Период</span><svg class="dk-i"><use href="#ti-chevron-down"/></svg></button></div>
      <div class="dk-select dk-period" data-active="true"><button type="button" class="dk-select__trigger" aria-haspopup="dialog" aria-expanded="false"><svg class="dk-i"><use href="#ti-calendar"/></svg><span class="dk-select__label">Последние 30 дней</span><svg class="dk-i"><use href="#ti-chevron-down"/></svg></button></div>
      <div class="dk-select dk-period" data-active="true"><button type="button" class="dk-select__trigger" aria-haspopup="dialog" aria-expanded="false"><svg class="dk-i"><use href="#ti-calendar"/></svg><span class="dk-select__label">11–24 сен</span><svg class="dk-i"><use href="#ti-chevron-down"/></svg></button></div>
    </div></div></div>
    <div class="sc-note"><b>Незаконченный выбор не применяется.</b> Одна выбранная дата в календаре — черновик; период меняется только после второй. Закрытие меню черновик отбрасывает.</div>""",
    "content_ok": ["Пресет назван словами: «Последние 14 дней», «Сегодня».",
                   "Свой диапазон — «11–24 сен», без года, если он текущий.",
                   "Строка применённых фильтров называет период так же, как поле."],
    "content_bad": ['Период не указан: непонятно, за какое время рассчитаны показатели.', 'Дата в подписи не совпадает с применённым диапазоном.', 'Смена периода обновляет только часть связанных блоков.'],
    "a11y": ["<b>Роли.</b> Поле — кнопка с <code>aria-haspopup=\"dialog\"</code>; в <code>aria-label</code> — и название пресета, и точные даты.",
             "<b>Клавиатура.</b> По пресетам — стрелки, Enter; Escape закрывает меню и возвращает фокус. Календарь — клавиатура Air Datepicker.",
             "<b>Не только цветом.</b> Выбранный пресет отмечен <code>aria-pressed</code>; диапазон в календаре — заливкой и подписью в поле.",
             "<b>Не проверялось.</b> Календарь — сторонняя библиотека; её доступность со скринридером не измерялась (HANDOFF.md)."],
    "tokens": ["dk-period", "dk-select", "dk-menu"],
    "code_intro": "Нужны dk-select.js (стили меню общие), vendor/air-datepicker.js и dk-period.js.",
    "code": """<!-- Период — первым в строке фильтров: он ограничивает всё остальное. -->
<div class="dk-toolbar">
  <div class="dk-toolbar__group">
    <div id="period"></div>
    <div id="okrug"></div>
  </div>
</div>

<script>
var p = dkPeriod(document.getElementById('period'), {
  label: 'Период',
  value: { preset: 7 },              // или { from: '2026-09-11', to: '2026-09-24' }
  url: 'period',                      // ?period=14d | 2026-09-11..2026-09-24
  onChange: function (v) { /* v = { from: Date, to: Date, preset: 14|null } или null */ }
});
p.value; p.text;                      // «Последние 14 дней»
p.set({ preset: 30 }); p.clear();
</script>""",
    "api": [("value", "{preset} | {from, to}", "Начальное значение; адрес главнее."),
            ("presets[]", "массив {name, days}", "Свой список пресетов."),
            ("minDate / maxDate", "дата", "Границы календаря; по умолчанию до сегодня."),
            ("url", "строка", "Ключ в адресе."),
            ("onChange(v)", "функция", "После применения; черновик не считается."),
            ("value / text / set(v) / clear()", "API", "Читать и менять снаружи.")],
    "related": [("component-select.html", "Фильтр", "та же основа и то же меню"),
                ("component-calendar.html", "Календарь", "представление работ по дням, не фильтр"),
                ("accidents.html", "Страница «Аварии»", "период в живом дашборде")],
},
{
    "slug": "search", "title": "Поиск", "group": "Фильтры", "status": "стабильный",
    "purpose": 'Находит объекты по названию и позволяет быстро очистить запрос.',
    "files": ["css/components.css", "js/dk-util.js"], "scripts": [],
    "live_intro": 'Поле принимает запрос и позволяет очистить его одним действием. Фильтрацию записей подключает приложение; сам пример данные не ищет.',
    "live": """<div class="dk-grid">
      <div class="dk-col--half"><div class="dk-search">
        <svg class="dk-i dk-search__icon" aria-hidden="true"><use href="#ti-search"/></svg>
        <input class="dk-search__input" type="search" placeholder="Регион или округ" aria-label="Найти регион или округ" enterkeyhint="search" autocomplete="off">
        <button type="button" class="dk-search__clear" aria-label="Очистить поиск"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button>
        <span class="dk-search__at" title="Данные на 29 сентября">29.09</span>
      </div></div>
      <div class="dk-col--half"><div class="dk-widget"><div class="dk-search">
        <svg class="dk-i dk-search__icon" aria-hidden="true"><use href="#ti-search"/></svg>
        <input class="dk-search__input" type="search" placeholder="Внутри виджета — плоский" aria-label="Поиск внутри виджета" autocomplete="off">
        <button type="button" class="dk-search__clear" aria-label="Очистить поиск"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button>
      </div></div></div>
    </div>""",
    "when_yes": ["Объектов много, и человек знает имя нужного: регион, дом, котельная.",
                 "Верх экрана на телефоне: поиск и дата данных — одной строкой над фильтрами.",
                 "Список или таблица под поиском фильтруется по вводу."],
    "when_no": ["Значений до двадцати и их надо видеть списком — <a href=\"component-select.html\">Фильтр</a>, в нём поиск уже есть.",
                "Поле в форме заявки — <a href=\"component-field.html\">Поле и форма</a>, <code>dk-field--search</code>.",
                "Ограничить срез по времени — <a href=\"component-period.html\">Период</a>."],
    "anatomy_html": """<div class="dk-search" style="max-width:520px">
      <b class="sc-callout">1</b><svg class="dk-i dk-search__icon" aria-hidden="true"><use href="#ti-search"/></svg>
      <input class="dk-search__input" type="search" placeholder="Регион или округ" aria-label="Пример поиска" autocomplete="off"><b class="sc-callout">2</b>
      <span class="dk-search__at">29.09</span><b class="sc-callout">3</b>
    </div>""",
    "anatomy": [("Значок", "<code>dk-search__icon</code>: говорит «поиск» до того, как прочитана подсказка."),
                ("Поле", "<code>dk-search__input</code>, <code>type=\"search\"</code>, кегль 16: меньше iOS увеличивает страницу при фокусе."),
                ("Дата данных", "<code>dk-search__at</code>: за какой день числа на экране. Пока ищут — прячется, на её месте крестик <code>dk-search__clear</code>.")],
    "variants": [("dk-search", "Строка поиска на доске: нейтральная поверхность и тонкая кромка.", "Верх экрана, над фильтрами."),
                 ("внутри dk-panel / dk-widget", "Та же строка, плоская.", "Поиск по списку внутри блока."),
                 ("dk-search__at", "Дата, на которую данные.", "Если данные не «сейчас», а на день."),
                 ("dk-search__clear", "Крестик очистки.", "Всегда: появляется сам, когда в поле есть текст.")],
    "sizes": 'В стеклянной теме высота согласована с фильтрами и кнопками через --control-lg. Ширина определяется строкой управления; поиск не должен вытеснять другие действия за экран.',
    "states": """<div class="dk-grid--even">
      <div class="dk-search"><svg class="dk-i dk-search__icon" aria-hidden="true"><use href="#ti-search"/></svg><input class="dk-search__input" type="search" placeholder="Пусто: видна дата" aria-label="Пустой поиск" autocomplete="off"><button type="button" class="dk-search__clear" aria-label="Очистить поиск"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button><span class="dk-search__at">29.09</span></div>
      <div class="dk-search"><svg class="dk-i dk-search__icon" aria-hidden="true"><use href="#ti-search"/></svg><input class="dk-search__input" type="search" value="Новосибирская" aria-label="Поиск с запросом" autocomplete="off"><button type="button" class="dk-search__clear" aria-label="Очистить поиск"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button><span class="dk-search__at">29.09</span></div>
    </div>""",
    "content_ok": ["Подсказка называет, что ищут: «Регион или округ».",
                   "Дата короткая: «29.09», полная — в <code>title</code>.",
                   "Ничего не нашлось — пустое состояние с тем, что сделать, а не пустота."],
    "content_bad": ["«Поиск…» — не сказано, что искать.",
                    "Поиск без подписи для скринридера: подсказка не подпись.",
                    "Две строки поиска на экране."],
    "a11y": ["<b>Подпись</b> — <code>aria-label</code> на поле: подсказка исчезает при вводе и подписью не считается.",
             "<b>Крестик</b> — кнопка с <code>aria-label=\"Очистить поиск\"</code>, цель 44 px; после очистки фокус в поле.",
             "<b>Фокус</b> виден кромкой и кольцом акцента, а не только курсором."],
    "tokens": ["dk-search"],
    "code_intro": "Только разметка. Страница слушает <code>input</code> на поле — и ввод, и очистку крестиком.",
    "code": """<div class="dk-search">
  <svg class="dk-i dk-search__icon" aria-hidden="true"><use href="#ti-search"/></svg>
  <input class="dk-search__input" type="search" placeholder="Регион или округ"
         aria-label="Найти регион или округ" enterkeyhint="search" autocomplete="off">
  <button type="button" class="dk-search__clear" aria-label="Очистить поиск">
    <svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button>
  <span class="dk-search__at" title="Данные на 29 сентября">29.09</span>
</div>

<script>
document.querySelector('.dk-search__input').addEventListener('input', function (e) {
  /* фильтровать по e.target.value; пустая строка — показать всё */
});
</script>""",
    "api": [("dk-search__input", "input type=search", "Поле; страница слушает input."),
            ("dk-search__clear", "кнопка", "Очистка без подключения: dk-util.js."),
            ("dk-search__at", "элемент", "Дата данных; необязательна."),
            ("aria-label", "атрибут поля", "Подпись для скринридера — обязательна.")],
    "related": [("component-select.html", "Фильтр", "выбор из известного списка"),
                ("component-empty.html", "Состояния", "что показать, если не нашлось"),
                ("component-field.html", "Поле и форма", "поиск внутри формы")],
},
{
    "slug": "legend", "title": "Фильтры-легенда", "group": "Фильтры", "status": "стабильный",
    "purpose": 'Объясняет цвета категорий и позволяет включать или исключать их из среза.',
    "files": ["css/components.css"], "scripts": [],
    "live_intro": 'Подпись объясняет цвет, счётчик — размер категории. Нажатие меняет выбор; приложение связывает его с данными виджета.',
    "live": """<div class="dk-legend">
      <button class="dk-lg is-on" aria-pressed="true"><i class="dk-lg__sw"></i>Все<b class="dk-lg__n">89</b></button>
      <button class="dk-lg" aria-pressed="false" style="--swatch:var(--crit)"><i class="dk-lg__sw"></i>Высокий<b class="dk-lg__n">23</b></button>
      <button class="dk-lg" aria-pressed="false" style="--swatch:var(--high)"><i class="dk-lg__sw"></i>Средний<b class="dk-lg__n">27</b></button>
      <button class="dk-lg" aria-pressed="false" style="--swatch:var(--calm)"><i class="dk-lg__sw"></i>Низкий<b class="dk-lg__n">38</b></button>
      <button class="dk-lg" aria-pressed="false" style="--swatch:var(--nodata)"><i class="dk-lg__sw"></i>Мало данных<b class="dk-lg__n">1</b></button>
      <button class="dk-lg" aria-pressed="false" style="--swatch:var(--event)"><i class="dk-lg__sw"></i>Событие<b class="dk-lg__n">15</b></button>
    </div>""",
    "live_script": """  document.querySelectorAll('.dk-lg').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on)); b.classList.toggle('is-on', on);
    });
  });""",
    "when_yes": ["Категорий две–шесть, и у каждой есть свой цвет на графике или карте рядом.",
                 "Нужно одновременно объяснить цвета и дать их включать / выключать.",
                 "Рядом с категорией важно число: «Высокий 23»."],
    "when_no": ["Категорий больше шести или у них нет цвета — <a href=\"component-select.html\">Фильтр</a>.",
                "Категории без данных рядом — обычная легенда графика, её рисует <a href=\"component-chart.html\">dkChart</a> сам.",
                "Один вариант из нескольких — <a href=\"component-segment.html\">Сегмент</a>."],
    "anatomy_html": """<div class="dk-legend">
      <button class="dk-lg is-on" aria-pressed="true" style="--swatch:var(--crit)"><b class="sc-callout">1</b><i class="dk-lg__sw"></i><b class="sc-callout">2</b>Высокий<b class="dk-lg__n"><b class="sc-callout">3</b>23</b></button>
      <button class="dk-lg" aria-pressed="false" style="--swatch:var(--calm)"><i class="dk-lg__sw"></i>Низкий<b class="dk-lg__n">38</b></button>
    </div>""",
    "anatomy": [("Чип", "кнопка с <code>aria-pressed</code>; включённый залит своим цветом на 22 %, чтобы не спорить с данными."),
                ("Метка цвета", "<code>dk-lg__sw</code> берёт <code>--swatch</code>; без него — серый."),
                ("Число", "сколько записей за категорией; ноль показывается приглушённым.")],
    "sizes": 'Высота согласуется с соседними контролами и темой. Компактный и крупный варианты задаются dk-lg--sm и dk-lg--lg. На сенсорном экране область нажатия сохраняется не меньше 44 × 44 px.',
    "variants": [("dk-lg", "Чип-фильтр.", "Каждая категория."),
                 ("is-on + aria-pressed", "Включён.", "Ставит скрипт страницы."),
                 ("--swatch", "Цвет категории через стиль.", "Всегда, кроме «Все»."),
                 ("dk-lg--sm / dk-lg--lg", "Размер.", "По соседям.")],
    "states": """<div class="dk-legend">
      <button class="dk-lg" aria-pressed="false" style="--swatch:var(--crit)"><i class="dk-lg__sw"></i>Выключен<b class="dk-lg__n">23</b></button>
      <button class="dk-lg is-on" aria-pressed="true" style="--swatch:var(--crit)"><i class="dk-lg__sw"></i>Включён<b class="dk-lg__n">23</b></button>
      <button class="dk-lg" aria-pressed="false" style="--swatch:var(--crit);outline:var(--focus-width) solid var(--brand);outline-offset:var(--focus-offset)"><i class="dk-lg__sw"></i>Фокус<b class="dk-lg__n">23</b></button>
      <button class="dk-lg" aria-pressed="false" style="--swatch:var(--nodata)"><i class="dk-lg__sw"></i>Пусто<b class="dk-lg__n">0</b></button>
    </div>
    <div class="sc-note" style="margin-top:var(--space-6)"><b>Выключенные категории не исчезают.</b> Чип остаётся на месте с приглушённой меткой: человек видит, что именно он отключил, и может вернуть.</div>""",
    "content_ok": ["Название категории — как в легенде графика рядом, слово в слово.",
                   "Первым — «Все» с общим числом.",
                   "Порядок — по смыслу (от худшего к лучшему), а не по алфавиту."],
    "content_bad": ["Разные названия на чипе и в легенде графика: «Высокий» и «Крит.».",
                    "Чип без числа: выбор вслепую.",
                    "Цвет, розданный по кругу, а не по смыслу."],
    "a11y": ["<b>Роль.</b> Кнопки с <code>aria-pressed</code>; скринридер читает «нажата / не нажата».",
             "<b>Не только цветом.</b> Включённый чип отличается заливкой всего чипа, не только меткой; число и подпись на месте.",
             "<b>Контраст.</b> Заливка 22 % своего цвета поверх поверхности — та же ступень, что у выбранной строки таблицы.",
             "<b>Клавиатура.</b> Обычные кнопки: Tab, Enter, пробел."],
    "tokens": ["dk-legend", "dk-lg"],
    "code_intro": "Поведение задаёт страница: компонент не знает, что делать с данными при выключении категории.",
    "code": """<div class="dk-legend">
  <button class="dk-lg is-on" aria-pressed="true"><i class="dk-lg__sw"></i>Все<b class="dk-lg__n">89</b></button>
  <button class="dk-lg" aria-pressed="false" style="--swatch:var(--crit)"><i class="dk-lg__sw"></i>Высокий<b class="dk-lg__n">23</b></button>
</div>

<script>
legend.addEventListener('click', function (e) {
  var b = e.target.closest('.dk-lg');
  if (!b) return;
  var on = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(on));
  b.classList.toggle('is-on', on);
  // дальше — перерисовать данные
});
</script>""",
    "api": [("--swatch", "переменная в style", "Цвет категории; без него серый."),
            ("aria-pressed + is-on", "атрибут и класс", "Включён; оба ставятся вместе."),
            ("dk-lg__n", "элемент", "Число записей.")],
    "related": [("component-select.html", "Фильтр", "когда категорий больше шести"),
                ("component-chart.html", "График", "легенду самого графика рисует обёртка"),
                ("component-map.html", "Регионы", "легенда шкалы под картой")],
},
{
    "slug": "pager", "title": "Пагинация", "group": "Фильтры", "status": "стабильный",
    "purpose": 'Показывает текущую часть набора данных и позволяет перейти к следующей странице.',
    "files": ["css/components.css", "js/dk-pager.js"], "scripts": ["dk-pager.js"],
    "live_intro": 'Номер страницы и диапазон записей показывают, где вы находитесь в наборе. Переходы вперёд и назад работают в примере.',
    "live": """<div class="dk-panel"><div id="x-pager"></div></div>""",
    "live_script": """  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkPager !== 'function') return;
    dkPager(document.getElementById('x-pager'), { total: 89, size: 20, page: 3, sizes: [10, 20, 50], noun: ['регион', 'региона', 'регионов'], onChange: function () {} });
  });""",
    "when_yes": ["Записей больше, чем помещается на экране, и они равноправны: журнал аварий, список заявок.",
                 "Человеку важно знать, сколько всего и где он сейчас.",
                 "Сортировка и фильтры должны работать по всему набору, а не по видимой странице."],
    "when_no": ["Записей до тридцати — просто прокрутка; полосу прокрутки не прячут.",
                "Лента событий, которую читают сверху вниз, — кнопка «Показать ещё» в <a href=\"component-list.html\">Списке</a>.",
                "Рейтинг — <a href=\"component-rank.html\">Рейтинг</a>: там показывают верх, а не листают."],
    "anatomy_html": """<div class="dk-pager"><div class="dk-pager__count"><b class="sc-callout">1</b><b>41–60</b> из <b>89</b> регионов</div>
      <div class="dk-pager__nav"><button type="button" class="dk-iconbtn dk-iconbtn--sm" aria-label="Назад"><b class="sc-callout">2</b><svg class="dk-i dk-i--sm"><use href="#ti-chevron-left"/></svg></button>
        <div class="dk-pager__pages"><button type="button" class="dk-pager__p">1</button><span class="dk-pager__gap">…</span><button type="button" class="dk-pager__p">2</button><button type="button" class="dk-pager__p" aria-current="page"><b class="sc-callout">3</b>3</button><button type="button" class="dk-pager__p">4</button><button type="button" class="dk-pager__p">5</button></div>
        <button type="button" class="dk-iconbtn dk-iconbtn--sm" aria-label="Вперёд"><svg class="dk-i dk-i--sm"><use href="#ti-chevron-right"/></svg></button>
        <label class="dk-pager__size"><b class="sc-callout">4</b><span class="dk-caption">по</span><div class="dk-field"><select aria-label="Записей на странице"><option>20</option></select><svg class="dk-i"><use href="#ti-chevron-down"/></svg></div></label></div></div>""",
    "anatomy": [("Счётчик", "«41–60 из 89 регионов»: диапазон, всего и существительное в нужном падеже."),
                ("Стрелки", "назад и вперёд; на краях недоступны, но не исчезают."),
                ("Страницы", "первая, последняя и соседи текущей; между ними «…». Текущая — <code>aria-current=\"page\"</code>, серая."),
                ("Размер страницы", "необязательный выбор «по 10 / 20 / 50»; при смене счётчик пересчитывается.")],
    "sizes": "Размер один; на узком экране номера страниц сворачиваются в «3/5» между стрелками — "
             "счётчик и стрелки остаются всегда.",
    "variants": [("sizes: [10, 20, 50]", "Выбор размера страницы.", "Длинные журналы."),
                 ("sizes: null", "Размер не меняется.", "По умолчанию."),
                 ("noun: ['запись', 'записи', 'записей']", "Склонение существительного.", "Всегда, если считаем не записи.")],
    "states": """<div class="dk-panel"><div class="dk-stack">
      <div class="dk-pager"><div class="dk-pager__count"><b>1–20</b> из <b>89</b> регионов</div><div class="dk-pager__nav"><button type="button" class="dk-iconbtn dk-iconbtn--sm" aria-label="Назад" disabled><svg class="dk-i dk-i--sm"><use href="#ti-chevron-left"/></svg></button><div class="dk-pager__pages"><button type="button" class="dk-pager__p" aria-current="page">1</button><button type="button" class="dk-pager__p">2</button><button type="button" class="dk-pager__p">3</button><span class="dk-pager__gap">…</span><button type="button" class="dk-pager__p">5</button></div><button type="button" class="dk-iconbtn dk-iconbtn--sm" aria-label="Вперёд"><svg class="dk-i dk-i--sm"><use href="#ti-chevron-right"/></svg></button></div></div>
      <div class="dk-pager"><div class="dk-pager__count"><b>0</b> регионов</div><div class="dk-pager__nav"><button type="button" class="dk-iconbtn dk-iconbtn--sm" aria-label="Назад" disabled><svg class="dk-i dk-i--sm"><use href="#ti-chevron-left"/></svg></button><button type="button" class="dk-iconbtn dk-iconbtn--sm" aria-label="Вперёд" disabled><svg class="dk-i dk-i--sm"><use href="#ti-chevron-right"/></svg></button></div></div>
    </div></div>
    <div class="sc-note"><b>Первая страница и пустой список.</b> На первой странице стрелка «назад» недоступна, но на месте. При нуле записей пагинация не прячется, а честно пишет «0 регионов» — пустое состояние показывает сам список.</div>""",
    "content_ok": ["«21–40 из 89 регионов» — диапазон, всего, существительное в падеже.",
                   "Существительное — то, что считаем: регионов, заявок, аварий.",
                   "Итог отрицательным не бывает: сдвиг ограничен нулём."],
    "content_bad": ["«Страница 3 из 5» — не говорит, сколько записей.",
                    "«89 записей» для аварий — записи бывают у бухгалтера.",
                    "Пагинация, которая исчезает на одной странице: человек не знает, что видит всё."],
    "a11y": ["<b>Роли.</b> Текущая страница — <code>aria-current=\"page\"</code>; стрелки — кнопки с <code>aria-label</code>.",
             "<b>Живая область.</b> Счётчик объявляется скринридеру при смене страницы.",
             "<b>Клавиатура.</b> Обычные кнопки: Tab, Enter.",
             "<b>Контраст.</b> Текущая страница залита <code>--control-on</code>, цифра на ней 4,79 / 5,04:1."],
    "tokens": ["dk-pager"],
    "code_intro": "Контейнер пустой, разметку строит скрипт. Данные листает страница по <code>onChange</code>.",
    "code": """<div id="pager"></div>

<script>
var pg = dkPager(document.getElementById('pager'), {
  total: 89, size: 20, page: 1,
  sizes: [10, 20, 50],                         // или null
  noun: ['регион', 'региона', 'регионов'],
  onChange: function (e) { /* e.page, e.size — запросить и показать срез */ }
});
pg.page; pg.size; pg.setTotal(120);
</script>""",
    "api": [("total", "число", "Сколько всего записей."),
            ("size / sizes", "число / массив", "Размер страницы и доступные размеры."),
            ("page", "число", "Начальная страница."),
            ("noun", "массив из трёх форм", "«регион, региона, регионов»."),
            ("onChange(e)", "функция", "e.page, e.size при смене."),
            ("page / size / setTotal(n)", "API", "Читать; пересчитать после фильтра.")],
    "related": [("component-table.html", "Таблица", "что листают"),
                ("component-list.html", "Список", "«Показать ещё» вместо страниц"),
                ("accidents.html", "Страница «Аварии»", "пагинация журнала с сортировкой по всему набору")],
},
]

# Составные поля: видимый набор введённых или выбранных значений.
_CHIPS_COMMON = {
    "group": "Фильтры", "status": "стабильный",
    "files": ["css/components.css", "js/dk-chips.js"], "scripts": ["dk-chips.js"],
    "sizes": "Отдельных размеров нет. Поле и кнопки используют размеры существующих компонентов; выбранные значения переносятся на следующую строку.",
    "variants": [("value", "Начальный набор значений.", "Чтобы показать ранее введённые или выбранные данные."),
                 ("disabled", "Отключает изменение набора.", "Когда поле временно недоступно."),
                 ("placeholder", "Подсказка в пустом поле.", "Для примера ввода; не заменяет подпись.")],
    "states": "<p><b>Пустое:</b> видны подпись и поле добавления. <b>Заполненное:</b> каждое значение показано отдельно и доступно для удаления. <b>Отключённое:</b> набор остаётся видимым, изменение недоступно.</p>",
    "content_ok": ["Подпись называет набор: «Метки», «Службы».", "Названия значений сохраняют смысл без соседних элементов.", "Кнопка удаления называет конкретное значение."],
    "content_bad": ["Placeholder вместо постоянной подписи.", "Все выбранные значения скрыты за счётчиком.", "Обязательные условия ввода описаны только после ошибки."],
    "a11y": ["В текстовом поле Enter добавляет значение. Backspace в пустом поле переводит фокус на удаление последней метки; Enter или пробел выполняет удаление.",
             "Выбор из списка использует нативный select. Уже выбранные и отключённые варианты недоступны для повторного выбора.",
             "Поле имеет постоянную видимую подпись. Кнопки удаления получают доступное название с именем значения.",
             "Добавление и удаление должны быть доступны с клавиатуры; фокус остаётся в рабочем контексте поля.",
             "Отключённое состояние запрещает изменение, сохраняя выбранные значения для чтения.",
             "Проверьте работу с длинными названиями, увеличенным текстом и на телефоне. Полная проверка со скринридером требует отдельного прохода."],
    "tokens": ["dk-chips"],
    "code_intro": "Подключите js/dk-chips.js после js/dk-util.js и js/dk-icons.js. Компонент сообщает значения; сохранение и применение фильтра выполняет приложение.",
    "api": [("label", "строка", "Постоянная подпись поля."),
            ("value", "массив строк", "Начальные значения."),
            ("placeholder", "строка", "Подсказка в поле добавления."),
            ("disabled", "boolean", "Запрет изменения набора."),
            ("onChange(value)", "функция", "Получает новый массив значений после изменения пользователем."),
            ("instance.value(nextArray)", "метод", "Без аргумента возвращает набор; с массивом заменяет значения."),
            ("instance.disabled(bool)", "метод", "Без аргумента возвращает состояние; с boolean переключает доступность."),
            ("instance.destroy()", "метод", "Удаление компонента и его обработчиков.")],
}

PAGES.extend([
{
    **_CHIPS_COMMON,
    "slug": "chips-input", "title": "Ввод нескольких значений · ChipsInput",
    "purpose": 'Принимает несколько произвольных значений и показывает их отдельными метками.',
    "live_intro": 'Введите значение и нажмите Enter: оно станет отдельной меткой. Удаление одной метки сохраняет остальные.',
    "live": '<div class="dk-panel"><div id="x-chips-input"></div><p class="dk-hint" id="x-chips-result" role="status"></p></div>',
    "live_script": """window.addEventListener('DOMContentLoaded', function () {
  var out = document.getElementById('x-chips-result');
  dkChipsInput(document.getElementById('x-chips-input'), {
    label: 'Метки', value: ['Плановые работы'], placeholder: 'Введите метку',
    onChange: function (value) { out.textContent = value.length ? 'Метки: ' + value.join(', ') : 'Метки не добавлены'; }
  });
});""",
    "when_yes": ["Пользователь создаёт набор произвольных меток или ключевых слов.", "Каждое значение нужно видеть и удалять независимо."],
    "when_no": ["Выбор ограничен справочником — <a href=\"component-chips-select.html\">Выбор нескольких значений</a>.", "Одно значение или связный текст — <a href=\"component-field.html\">Поле и форма</a>."],
    "anatomy_html": '<div class="dk-ff"><label class="dk-label"><b class="sc-callout">1</b> Метки</label><div class="dk-inline"><span class="dk-chip"><b class="sc-callout">2</b> Плановые работы</span></div><div class="dk-field"><b class="sc-callout">3</b><input aria-label="Пример поля меток" placeholder="Введите метку" readonly></div></div>',
    "anatomy": [("Подпись", "объясняет, какие значения нужно ввести."), ("Набор меток", "показывает уже добавленные значения; у каждой метки есть удаление."), ("Поле добавления", "принимает следующее значение, не заменяя весь набор.")],
    "code": """<div id="tags"></div>
<script>
var tags = dkChipsInput(document.getElementById('tags'), {
  label: 'Метки',
  value: ['Плановые работы'],
  placeholder: 'Введите метку',
  onChange: function (value) { /* сохранить массив строк */ }
});
tags.value(['Проверено']);
// tags.destroy();
</script>""",
    "related": [("component-chips-select.html", "Выбор нескольких значений", "набор из готового справочника"), ("component-field.html", "Поле и форма", "обычный текстовый ввод")],
},
{
    **_CHIPS_COMMON,
    "slug": "chips-select", "title": "Выбор нескольких значений · ChipsSelect",
    "purpose": 'Выбирает несколько значений из справочника и сохраняет выбранный набор на виду.',
    "live_intro": 'Выберите несколько пунктов из справочника. Метки сохраняют выбор на виду и позволяют удалить отдельное значение.',
    "live": '<div class="dk-panel"><div id="x-chips-select"></div><p class="dk-hint" id="x-chips-result" role="status"></p></div>',
    "live_script": """window.addEventListener('DOMContentLoaded', function () {
  var out = document.getElementById('x-chips-result');
  dkChipsSelect(document.getElementById('x-chips-select'), {
    label: 'Службы', value: ['requests'], placeholder: 'Выберите службу',
    options: [{value:'requests',label:'Приём заявок'}, {value:'telemetry',label:'Телеметрия сетей'}, {value:'notifications',label:'Рассылка жителям'}],
    onChange: function (value) { out.textContent = value.length ? 'Выбрано служб: ' + value.length : 'Службы не выбраны'; }
  });
});""",
    "when_yes": ["Пользователь выбирает несколько объектов из известного справочника.", "Выбранный набор важен для задачи и должен оставаться видимым."],
    "when_no": ["Нужно создавать новые значения — <a href=\"component-chips-input.html\">Ввод нескольких значений</a>.", "В компактной строке фильтров достаточно подписи и счётчика — <a href=\"component-select.html\">Фильтр</a>.", "Несколько вариантов должны быть видны одновременно — <a href=\"component-check.html\">Флажки</a>."],
    "anatomy_html": '<div class="dk-ff"><label class="dk-label"><b class="sc-callout">1</b> Службы</label><div class="dk-inline"><span class="dk-chip"><b class="sc-callout">2</b> Приём заявок</span></div><div class="dk-field"><b class="sc-callout">3</b><select aria-label="Пример выбора служб"><option>Выберите службу</option></select></div></div>',
    "anatomy": [("Подпись", "называет выбираемый набор."), ("Выбранные значения", "показывают названия из справочника; каждое можно удалить отдельно."), ("Список добавления", "позволяет выбрать следующее значение из options.")],
    "code": """<div id="services"></div>
<script>
var services = dkChipsSelect(document.getElementById('services'), {
  label: 'Службы',
  options: [
    { value: 'requests', label: 'Приём заявок' },
    { value: 'telemetry', label: 'Телеметрия сетей' }
  ],
  value: ['requests'],
  placeholder: 'Выберите службу',
  onChange: function (value) { /* применить выбранные идентификаторы */ }
});
services.value(['telemetry']);
// services.destroy();
</script>""",
    "api": _CHIPS_COMMON["api"] + [("options", "массив {value, label, disabled?}", "Справочник: value — идентификатор, label — видимое название; disabled запрещает выбор пункта.")],
    "related": [("component-chips-input.html", "Ввод нескольких значений", "произвольные метки"), ("component-select.html", "Фильтр", "компактный выбор из списка"), ("component-check.html", "Флажки", "небольшой набор видимых вариантов")],
},
])
