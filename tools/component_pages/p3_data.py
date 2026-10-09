# Данные: таблица, бейдж и статус, KPI-плитка, рейтинг и сводка, список и полосы, доступность служб.

PICK = ('<label class="dk-check" aria-label="{a}"><input type="checkbox" {d}><span class="dk-check__box">'
        '<svg class="dk-i"><use href="#ti-check"/></svg></span></label>')

TABLE_ROWS = """[
    ['Южный', 'RU-CR', 'Крым', 'crit', 82, 1, 1912000, 4],
    ['Южный', 'RU-DON', 'Донецкая Народная Республика', 'crit', 95, 4, 4100000, 12],
    ['Южный', 'RU-ROS', 'Ростовская область', 'high', 73, null, 4200000, 2],
    ['Южный', 'RU-KDA', 'Краснодарский край', 'calm', 41, 0, 5840000, -2],
    ['Сибирский', 'RU-NVS', 'Новосибирская область', 'high', 73, 2, 2780000, -3],
    ['Сибирский', 'RU-KYA', 'Красноярский край', 'high', 61, 2, 2850000, 0],
    ['Сибирский', 'RU-OMS', 'Омская область', 'calm', 58, 1, 1830000, -1],
    ['Сибирский', 'RU-TOM', 'Томская область', 'calm', 44, 0, 1050000, 1],
    ['Дальневосточный', 'RU-SA', 'Саха (Якутия)', 'crit', 81, 3, 1000000, 7],
    ['Дальневосточный', 'RU-PRI', 'Приморский край', 'high', 66, 1, 1820000, 2],
    ['Дальневосточный', 'RU-KHA', 'Хабаровский край', 'calm', 52, null, 1280000, -4],
    ['Дальневосточный', 'RU-SAK', 'Сахалинская область', 'calm', 39, 0, 460000, 0],
    ['Уральский', 'RU-SVE', 'Свердловская область', 'high', 64, 2, 4240000, 3],
    ['Уральский', 'RU-CHE', 'Челябинская область', 'calm', 47, 1, 3400000, -2]
  ]"""

PAGES = [
{
    "slug": "table", "title": "Таблица", "group": "Данные", "status": "стабильный",
    "purpose": "Сравнить много объектов по нескольким показателям: регионы по баллу и событиям, заявки по сроку и "
               "исполнителю. Читается по строкам, сортируется по колонке, выбирается для действия.",
    "files": ["css/components.css", "js/dk-table.js"], "scripts": ["dk-table.js"],
    "live_intro": "Всё, что умеет таблица, в одном месте: закреплённая шапка и первая колонка, сортировка, выбор "
                  "строк со счётчиком, группы с подытогом, строка итога, числа табличными цифрами. В разметке ни "
                  "одного числа руками — все через <code>dkFmt</code>.",
    "live": """<div class="dk-widget">
      <div class="dk-widget__head"><h3 class="dk-widget__title">Регионы · балл риска</h3>
        <div class="dk-chipbar" id="ex-actions"><span class="dk-chipbar__label">Ничего не выбрано — действия появятся здесь</span></div></div>
      <div class="dk-tablewrap dk-tablewrap--tall" style="--table-min:860px;--table-max:420px">
        <table class="dk-table dk-table--zebra dk-table--sticky-head dk-table--sticky-col" id="ex-table">
          <thead><tr>
            <th class="dk-th-pick"><label class="dk-check" aria-label="Выбрать все на странице"><input type="checkbox" data-pick-all><span class="dk-check__box"><svg class="dk-i"><use href="#ti-check"/></svg></span></label></th>
            <th style="width:24%" data-sortable="Регион">Регион</th>
            <th style="width:18%" data-sortable="Состояние">Состояние</th>
            <th style="width:12%" class="dk-td-num" data-sortable="Балл">Балл</th>
            <th style="width:12%" class="dk-td-num" data-sortable="События">События, шт.</th>
            <th style="width:14%" class="dk-td-num" data-sortable="Жителей">Жителей</th>
            <th style="width:14%" class="dk-td-num" data-sortable="Изменение">Изменение за 14 д</th>
          </tr></thead>
          <tbody id="ex-body"></tbody>
          <tfoot><tr><td></td><td>Итого по выбранным округам</td><td></td>
            <td class="dk-td-num" id="ex-t-score">—</td><td class="dk-td-num" id="ex-t-events">—</td>
            <td class="dk-td-num" id="ex-t-people">—</td><td class="dk-td-num" id="ex-t-delta">—</td></tr></tfoot>
        </table>
      </div>
    </div>""",
    "live_script": """  var данные = """ + TABLE_ROWS + """;
  var СТАТУС = { crit: ['crit', 'ti-alert-circle', 'Авария'], high: ['high', 'ti-clock', 'В работе'], calm: ['calm', 'ti-circle-check', 'Норма'] };
  var esc = window.dkEsc, fmt = window.dkFmt, строки = [], группа = null, сумма = null;
  var итог = { n: 0, score: 0, events: 0, people: 0, delta: 0 };
  function подытог(g, s) {
    return '<tr class="dk-tr-group"><td></td><td colspan="2">' + esc(g) + ' · ' + s.n + ' регионов</td>' +
      '<td class="dk-td-num">' + fmt.num(Math.round(s.score / s.n)) + '</td><td class="dk-td-num">' + fmt.num(s.events) + '</td>' +
      '<td class="dk-td-num">' + fmt.compact(s.people) + '</td><td class="dk-td-num">' + fmt.delta(s.delta) + '</td></tr>';
  }
  данные.forEach(function (r) {
    if (r[0] !== группа) { if (сумма) строки.push(подытог(группа, сумма)); группа = r[0]; сумма = { n: 0, score: 0, events: 0, people: 0, delta: 0 }; }
    var st = СТАТУС[r[3]];
    строки.push('<tr data-id="' + esc(r[1]) + '">' +
      '<td class="dk-td-pick"><label class="dk-check" aria-label="Выбрать ' + esc(r[2]) + '"><input type="checkbox" data-pick value="' + esc(r[1]) + '"><span class="dk-check__box"><svg class="dk-i"><use href="#ti-check"/></svg></span></label></td>' +
      '<td>' + esc(r[2]) + '</td>' +
      '<td data-sort="' + ({ crit: 3, high: 2, calm: 1 })[r[3]] + '"><span class="dk-status dk-status--' + st[0] + '"><svg class="dk-i dk-i--sm"><use href="#' + st[1] + '"/></svg>' + st[2] + '</span></td>' +
      '<td class="dk-td-num" data-sort="' + r[4] + '"' + (r[4] >= 80 ? ' style="color:' + window.dkMeaning('crit', 'text') + '"' : r[4] >= 60 ? ' style="color:' + window.dkMeaning('high', 'text') + '"' : '') + '>' + fmt.num(r[4]) + '</td>' +
      '<td class="dk-td-num" data-sort="' + (r[5] == null ? '' : r[5]) + '">' + fmt.num(r[5]) + '</td>' +
      '<td class="dk-td-num" data-sort="' + r[6] + '">' + fmt.num(r[6]) + '</td>' +
      '<td class="dk-td-num" data-sort="' + r[7] + '">' + fmt.delta(r[7]) + '</td></tr>');
    сумма.n++; сумма.score += r[4]; сумма.events += r[5] || 0; сумма.people += r[6]; сумма.delta += r[7];
    итог.n++; итог.score += r[4]; итог.events += r[5] || 0; итог.people += r[6]; итог.delta += r[7];
  });
  строки.push(подытог(группа, сумма));
  document.getElementById('ex-body').innerHTML = строки.join('');
  document.getElementById('ex-t-score').textContent = fmt.num(Math.round(итог.score / итог.n));
  document.getElementById('ex-t-events').textContent = fmt.num(итог.events);
  document.getElementById('ex-t-people').textContent = fmt.compact(итог.people);
  document.getElementById('ex-t-delta').textContent = fmt.delta(итог.delta);
  window.addEventListener('DOMContentLoaded', function () {
    var box = document.getElementById('ex-actions');
    if (typeof dkTable !== 'function') return;
    dkTable(document.getElementById('ex-table'), {
      onSelect: function (ids) {
        box.innerHTML = ids.length
          ? '<span class="dk-chipbar__label">Выбрано ' + ids.length + '</span><button class="dk-btn dk-btn--sm">Взять на контроль</button>'
          : '<span class="dk-chipbar__label">Ничего не выбрано — действия появятся здесь</span>';
      }
    });
  });""",
    "when_yes": ["Объектов больше семи и у каждого несколько показателей — сравнивать нужно по колонкам.",
                 "По строке нужно действие: назначить, открыть, снять с контроля.",
                 "Точное число важнее формы: «73 события», а не «примерно столько же, сколько у соседа»."],
    "when_no": ["Один показатель по многим объектам, вопрос «у кого хуже» — <a href=\"component-rank.html\">Рейтинг</a>: полоса читается быстрее числа.",
                "Одно–четыре главных числа — <a href=\"component-tile.html\">KPI-плитки</a>, а не таблица из одной строки.",
                "Динамика во времени — <a href=\"component-chart.html\">График</a>: таблица покажет числа, но не форму.",
                "Список с одним значением на строку — <a href=\"component-list.html\">Список</a>, у него меньше шума."],
    "anatomy_html": """<div class="dk-tablewrap" style="--table-min:640px"><table class="dk-table dk-table--zebra">
      <thead><tr><th class="dk-th-pick"><b class="sc-callout">1</b>""" + PICK.format(a="Выбрать все", d="") + """</th>
        <th style="width:40%"><b class="sc-callout">2</b>Регион <button type="button" class="dk-th-sort" aria-label="Сортировать"><svg class="dk-i dk-i--sm"><use href="#ti-arrow-up"/></svg></button><b class="sc-callout">3</b></th>
        <th style="width:30%">Состояние</th><th class="dk-td-num"><b class="sc-callout">4</b>Балл</th></tr></thead>
      <tbody>
        <tr><td class="dk-td-pick">""" + PICK.format(a="Выбрать", d="") + """</td><td><b class="sc-callout">5</b>Крым</td><td><b class="sc-callout">6</b><span class="dk-status dk-status--crit"><svg class="dk-i dk-i--sm"><use href="#ti-alert-circle"/></svg>Авария</span></td><td class="dk-td-num"><b class="sc-callout">7</b>82</td></tr>
        <tr class="dk-tr-group"><td colspan="3"><b class="sc-callout">8</b>Сибирский округ</td><td class="dk-td-num">73</td></tr>
        <tr><td class="dk-td-pick">""" + PICK.format(a="Выбрать", d="") + """</td><td>Новосибирская область</td><td><span class="dk-status dk-status--high"><svg class="dk-i dk-i--sm"><use href="#ti-clock"/></svg>В работе</span></td><td class="dk-td-num">73</td></tr>
      </tbody>
      <tfoot><tr><td></td><td><b class="sc-callout">9</b>Итого</td><td></td><td class="dk-td-num">155</td></tr></tfoot>
    </table></div>""",
    "anatomy": [("Колонка выбора", "флажок «все на странице» и по флажку на строку. Выбрано — не только заливкой, но и числом в строке действий."),
                ("Заголовок колонки", "надписью, поверхностью отделён от тела. Границ нет."),
                ("Сортировка", "стрелка показывает, куда отсортировано, а не «здесь можно». Скринридеру то же говорит <code>aria-sort</code>."),
                ("Числовая колонка", "<code>dk-td-num</code>: вправо, табличными цифрами (<code>--font-num</code>), единица в заголовке."),
                ("Главная ячейка", "название; при нужде с подстрокой и значком (<code>dk-td-main</code>)."),
                ("Статус", "всегда со значком и подписью, никогда одним цветом."),
                ("Значение", "цвет смысла только у чисел, которые сравнивают с порогом."),
                ("Группа", "строка <code>dk-tr-group</code>: название надписью, подытог числом."),
                ("Итог", "<code>&lt;tfoot&gt;</code>, в закреплённой таблице прилипает к низу.")],
    "sizes": "Варианты включаются классами и складываются друг с другом. Размеров у таблицы нет: плотность как "
             "настройка (<code>data-density</code>) — открытый вопрос в DECISIONS.md, п. 5.",
    "variants": [("dk-table", "Без разделителей: шапка поверхностью, строки наведением.", "По умолчанию."),
                 ("dk-table--zebra", "Чередование строк полупрозрачной заливкой.", "Длинная плотная таблица."),
                 ("dk-table--cards", "На телефоне строка — карточка «подпись — значение», шапка — пилюли сортировки. Нужен dkTable: он ставит подписи.", "Таблица шире экрана телефона: больше трёх колонок."),
                 ("dk-table--ruled", "Волосяные линейки между строками.", "Печать и очень плотные данные; включается вручную."),
                 ("dk-table--sticky-head", "Шапка и итог закреплены при прокрутке.", "Обёртка dk-tablewrap--tall с --table-max."),
                 ("dk-table--sticky-col", "Первая колонка (и колонка выбора) закреплены.", "Колонок больше, чем помещается."),
                 ("dk-tablewrap", "Горизонтальная прокрутка; --table-min — минимальная ширина.", "Всегда, если колонок больше четырёх.")],
    "states": """<div class="dk-grid--even">
      <div class="dk-panel"><div class="dk-overline" style="margin-bottom:var(--space-5)">Загрузка</div><span class="dk-vh">Загружаем регионы</span>
        <div class="dk-skel" style="height:14px;width:60%;margin-bottom:var(--space-5)"></div><div class="dk-skel" style="height:14px;width:85%;margin-bottom:var(--space-5)"></div><div class="dk-skel" style="height:14px;width:45%"></div></div>
      <div class="dk-panel"><div class="dk-overline" style="margin-bottom:var(--space-5)">Пусто</div><div class="dk-empty"><div class="dk-empty__t">Ничего не найдено</div><div>Под фильтры не попал ни один регион.</div><button class="dk-btn dk-btn--sm" style="margin-top:var(--space-5)">Снять фильтр по округу</button></div></div>
      <div class="dk-panel"><div class="dk-overline" style="margin-bottom:var(--space-5)">Ошибка</div><div class="dk-empty"><div class="dk-empty__t">Данные не загрузились</div><div>Сервер регионов не ответил за 10 с.</div><button class="dk-btn dk-btn--sm" style="margin-top:var(--space-5)">Повторить</button></div></div>
    </div>
    <div class="sc-note"><b>Наведение, выбор и сортировка</b> — в живом примере выше. Пустое состояние отвечает на три вопроса: что случилось, почему и что делать.</div>""",
    "content_ok": ["Единица — в заголовке колонки: «События, шт.», в ячейках только числа.",
                   "Нет значения — прочерк «—». Ноль — это ответ, отсутствие — нет.",
                   "Числа через <code>dkFmt</code>: разряды неразрывным пробелом, дробь запятой, минус настоящий.",
                   "Дельта со знаком всегда: «+4», «−8 мин».",
                   "Заголовки короткие, именительный падеж: «Регион», «Балл»."],
    "content_bad": ["«73 события» в каждой ячейке — единица повторяется сорок раз.",
                    "Пустая ячейка или «0» вместо отсутствующего значения.",
                    "«1240» рядом с «1 240» — читается как два разных числа.",
                    "Цвет статуса без значка и подписи — его видят не все.",
                    "Действия, спрятанные под наведение, — на тачскрине наведения нет."],
    "a11y": ["<b>Клавиатура.</b> Заголовок с сортировкой — кнопка, флажки — настоящие <code>input</code>; кольцо фокуса только при навигации табом.",
             "<b>Роли.</b> Настоящая <code>&lt;table&gt;</code>: скринридер ходит по ячейкам сам. Сортировка — <code>aria-sort</code>; выбранная строка — <code>aria-selected</code>.",
             "<b>Подписи.</b> У каждого флажка свой <code>aria-label</code> с названием строки; у колонки действий — скрытый заголовок.",
             "<b>Контраст.</b> Заголовок на своей поверхности и числа на строке проверяются в обеих темах (КОНТРАСТ, СТУПЕНИ).",
             "<b>Не проверялось.</b> Живой скринридер и тач-устройства — как и у всего кита."],
    "tokens": ["dk-table", "dk-tablewrap", "dk-td-", "dk-th-", "dk-tr-group"],
    "code_intro": "Разметка остаётся разметкой: без скрипта таблица показывает данные, просто не сортируется. Ширины колонок объявляет первый ряд <code>&lt;th&gt;</code>.",
    "code": """<div class="dk-tablewrap dk-tablewrap--tall" style="--table-min:860px;--table-max:420px">
  <table class="dk-table dk-table--zebra dk-table--sticky-head dk-table--sticky-col" id="regions">
    <thead><tr>
      <th class="dk-th-pick"><label class="dk-check" aria-label="Выбрать все на странице">
        <input type="checkbox" data-pick-all><span class="dk-check__box">…</span></label></th>
      <th style="width:24%" data-sortable="Регион">Регион</th>
      <th style="width:12%" class="dk-td-num" data-sortable="Балл">Балл</th>
    </tr></thead>
    <tbody>
      <tr data-id="RU-CR">
        <td class="dk-td-pick">…<input type="checkbox" data-pick value="RU-CR">…</td>
        <td>Крым</td>
        <td class="dk-td-num" data-sort="82">82</td>
      </tr>
      <tr class="dk-tr-group"><td colspan="2">Сибирский округ</td><td class="dk-td-num">73</td></tr>
    </tbody>
    <tfoot><tr><td></td><td>Итого</td><td class="dk-td-num">155</td></tr></tfoot>
  </table>
</div>

<script>
var t = dkTable(document.getElementById('regions'), {
  onSelect: function (ids) { /* выбрано видно числом: ids.length */ },
  onSort:   function (e)   { /* e.column, e.dir — если сортирует сервер */ }
});
t.selected; t.clear();
</script>""",
    "api": [("onSelect(ids)", "функция", "При каждой смене выбора с массивом <code>data-id</code>."),
            ("onSort(e)", "функция", "Передан — таблица не сортирует сама, а сообщает <code>e.column</code> и <code>e.dir</code>."),
            ("data-sortable", "атрибут th", "Имя колонки для сортировки."),
            ("data-sort", "атрибут td", "Значение для сортировки, когда текст ячейки — не оно."),
            ("--table-min, --table-max", "переменные на обёртке", "Минимальная ширина и высота прокрутки; по умолчанию 720 и 480.")],
    "related": [("component-rank.html", "Рейтинг", "один показатель по многим объектам"),
                ("component-badge.html", "Бейдж и статус", "что стоит в ячейках"),
                ("component-select.html", "Фильтр", "что стоит над таблицей"),
                ("component-pager.html", "Пагинация", "как листать длинную таблицу"),
                ("accidents.html", "Страница «Аварии»", "таблица в живом дашборде")],
},
{
    "slug": "badge", "title": "Бейдж, статус, прогресс", "group": "Данные", "status": "стабильный",
    "purpose": "Мелкие детали, из которых собраны таблицы и карточки. Бейдж отвечает «сколько» или «что за штука», "
               "статус — «как дела» и обязан иметь значок и подпись, прогресс — «сколько сделано».",
    "files": ["css/components.css"], "scripts": [],
    "live_intro": "Атомы сами по себе и внутри строки таблицы — ради этого они и нужны.",
    "live": """<div class="dk-panel"><div class="dk-stack">
      <div class="sc-row" style="margin:0"><span class="dk-badge">12</span><span class="dk-badge dk-badge--brand">новое</span><span class="dk-badge dk-badge--crit">23</span><span class="dk-badge dk-badge--high">27</span><span class="dk-badge dk-badge--calm">38</span><span class="dk-badge dk-badge--pill">БПЛА</span></div>
      <div class="sc-row" style="margin:0"><span class="dk-status dk-status--crit"><svg class="dk-i"><use href="#ti-alert-circle"/></svg>Авария</span><span class="dk-status dk-status--high"><svg class="dk-i"><use href="#ti-clock"/></svg>В работе</span><span class="dk-status dk-status--calm"><svg class="dk-i"><use href="#ti-circle-check"/></svg>Устранено</span><span class="dk-status"><svg class="dk-i"><use href="#ti-circle-x"/></svg>Нет данных</span></div>
      <div class="dk-progress"><span class="dk-progress__track"><span class="dk-progress__fill" style="width:72%"></span></span><span class="dk-progress__value">72%</span></div>
      <div class="dk-progress"><span class="dk-progress__track"><span class="dk-progress__fill" style="width:34%;--accent:var(--crit)"></span></span><span class="dk-progress__value">34%</span></div>
      <div class="dk-progress dk-progress--indeterminate"><span class="dk-progress__track"><span class="dk-progress__fill"></span></span><span class="dk-progress__value">—</span></div>
      <div class="dk-inline"><span class="dk-avatars"><span class="dk-avatar" aria-label="Анна">АК</span><span class="dk-avatar" aria-label="Борис">БМ</span><span class="dk-avatar dk-avatar--more" aria-label="ещё 4">+4</span></span><span class="dk-caption">следят за регионом</span></div>
    </div></div>""",
    "when_yes": ["Бейдж: число или короткая метка рядом с названием — «23» у вкладки, «БПЛА» у региона.",
                 "Статус: состояние объекта в строке таблицы или карточке.",
                 "Прогресс: доля выполненного, когда есть известный конец: устранение, готовность."],
    "when_no": ["Категория, которую можно снять, — <a href=\"component-legend.html\">чип-фильтр</a>, не бейдж.",
                "Главное число экрана — <a href=\"component-tile.html\">KPI-плитка</a>, бейдж для этого мелок.",
                "Доступность во времени — <a href=\"component-uptime.html\">Полоса доступности</a>, не прогресс."],
    "anatomy_html": """<div class="dk-stack">
      <div class="sc-row" style="margin:0"><span class="dk-badge dk-badge--crit"><b class="sc-callout">1</b>23</span><span class="dk-badge dk-badge--pill"><b class="sc-callout">2</b>БПЛА</span></div>
      <div class="sc-row" style="margin:0"><span class="dk-status dk-status--high"><b class="sc-callout">3</b><svg class="dk-i"><use href="#ti-clock"/></svg><b class="sc-callout">4</b>В работе</span></div>
      <div class="dk-progress"><b class="sc-callout">5</b><span class="dk-progress__track"><span class="dk-progress__fill" style="width:64%;--accent:var(--high)"></span></span><b class="sc-callout">6</b><span class="dk-progress__value">64%</span></div>
    </div>""",
    "anatomy": [("Бейдж с числом", "цвет смысла — только если число сравнивают с порогом (балл риска); иначе нейтральный."),
                ("Бейдж-метка", "<code>dk-badge--pill</code>: короткое слово-категория, всегда нейтральный."),
                ("Значок статуса", "обязателен: цвет видят не все, в чёрно-белой печати его нет вовсе."),
                ("Подпись статуса", "обязательна по той же причине; статус без слова — не статус."),
                ("Дорожка прогресса", "поверхность третьего уровня; заливка — <code>--accent</code> со значением по умолчанию."),
                ("Число", "рядом с полосой всегда: полоса показывает «примерно», число — «сколько».")],
    "sizes": "Размер один — под строку таблицы и текст карточки. Крупнее нужен не бейдж, а число KPI.",
    "variants": [("dk-badge", "Нейтральный бейдж с числом или словом.", "По умолчанию."),
                 ("dk-badge--crit / --high / --calm", "Цвет смысла.", "Число сравнивают с порогом."),
                 ("dk-badge--brand", "Акцентный: «новое».", "Единственный бейдж с акцентом; открыто в REVIEW.md."),
                 ("dk-badge--pill", "Метка-категория.", "Слово, не число."),
                 ("dk-status / --crit / --high / --calm", "Статус со значком и подписью.", "Состояние объекта; без модификатора — «нет данных»."),
                 ("dk-progress / --indeterminate", "Полоса; неопределённая бежит.", "Известен конец / не известен."),
                 ("dk-avatar / --sm / --more", "Инициалы человека; «+4».", "Кто отвечает, кто следит.")],
    "states": """<div class="dk-panel"><div class="dk-stack">
      <div class="sc-row" style="margin:0"><span class="dk-status dk-status--crit"><svg class="dk-i"><use href="#ti-alert-circle"/></svg>Авария</span><span class="dk-status dk-status--high"><svg class="dk-i"><use href="#ti-clock"/></svg>В работе</span><span class="dk-status dk-status--calm"><svg class="dk-i"><use href="#ti-circle-check"/></svg>Устранено</span><span class="dk-status"><svg class="dk-i"><use href="#ti-circle-x"/></svg>Нет данных</span></div>
      <div class="dk-progress"><span class="dk-progress__track"><span class="dk-progress__fill" style="width:0%"></span></span><span class="dk-progress__value">0%</span></div>
      <div class="dk-progress"><span class="dk-progress__track"><span class="dk-progress__fill" style="width:100%;--accent:var(--calm)"></span></span><span class="dk-progress__value">100%</span></div>
      <div class="dk-progress dk-progress--indeterminate"><span class="dk-progress__track"><span class="dk-progress__fill"></span></span><span class="dk-progress__value">—</span></div>
    </div></div>
    <div class="sc-note"><b>«Нет данных» — отдельное состояние, а не ноль.</b> Статус без модификатора и прогресс с прочерком говорят «не знаем», а не «ничего». Ноль процентов — это ответ.</div>""",
    "content_ok": ["Статус — одно-два слова о состоянии: «В работе», «Устранено».",
                   "Метка — существительное-категория: «БПЛА», «Плановое».",
                   "Прогресс с числом рядом и понятным концом: 64% устранения."],
    "content_bad": ["Статус одним цветом или одним значком.",
                    "Бейдж «новое» на всём подряд — акцент перестаёт значить «новое».",
                    "Прогресс без числа и без известного конца — там неопределённая полоса."],
    "a11y": ["<b>Не только цветом.</b> Статус — значок + подпись; бейдж цвета смысла всегда с числом.",
             "<b>Прогресс</b> — число рядом читается скринридером; сама полоса декоративна.",
             "<b>Аватары</b> — инициалы с <code>aria-label</code> полного имени.",
             "<b>Контраст.</b> Подписи статусов и бейджей на своих заливках проверяются проверкой КОНТРАСТ в обеих темах."],
    "tokens": ["dk-badge", "dk-status", "dk-progress", "dk-avatar", "dk-avatars", "dk-inline"],
    "code_intro": "Только разметка; скрипта нет. Цвет заливки прогресса задаётся входным параметром <code>--accent</code>.",
    "code": """<span class="dk-badge dk-badge--crit">23</span>
<span class="dk-badge dk-badge--pill">БПЛА</span>

<span class="dk-status dk-status--high">
  <svg class="dk-i"><use href="#ti-clock"/></svg>В работе
</span>

<div class="dk-progress">
  <span class="dk-progress__track"><span class="dk-progress__fill" style="width:64%;--accent:var(--high)"></span></span>
  <span class="dk-progress__value">64%</span>
</div>""",
    "api": [("dk-badge--crit | --high | --calm | --brand | --pill", "класс", "Вид бейджа."),
            ("dk-status--crit | --high | --calm", "класс", "Цвет статуса; без модификатора — «нет данных»."),
            ("--accent", "переменная в style", "Цвет заливки прогресса; по умолчанию акцент (открыто в REVIEW.md)."),
            ("dk-progress--indeterminate", "класс", "Конец неизвестен."),
            ("dk-avatar--sm | --more", "класс", "Маленький аватар; «ещё N».")],
    "related": [("component-table.html", "Таблица", "где атомы живут чаще всего"),
                ("component-tabs.html", "Вкладки", "счётчик того же рода"),
                ("component-legend.html", "Фильтры-легенда", "категория, которую можно снять")],
},
{
    "slug": "tile", "title": "KPI-плитка", "group": "Данные", "status": "стабильный",
    "purpose": "Одно главное число с трендом и формой: сколько сейчас и куда идёт. Размер S — четверть колонки; "
               "здесь число и спарклайн, а не график с осями.",
    "files": ["css/components.css", "js/dk-charts.js"], "scripts": ["vendor/echarts.min.js", "dk-chart-theme.js", "dk-charts.js"],
    "live_intro": "Четыре плитки в ряд. Цвет тренда — смысл (рост аварий красный, падение времени реакции зелёный), а не направление стрелки.",
    "live": """<div class="dk-grid">
      <div class="dk-col--quarter"><div class="dk-widget dk-widget--s dk-tile dk-tile--compact dk-tile--prominent" style="--accent:var(--crit-ink)"><div class="dk-tile__head"><span class="dk-tile__icon"><svg class="dk-i dk-i--sm"><use href="#ti-alert-triangle"/></svg></span><span class="dk-tile__label">Аварии за сутки</span></div><div class="dk-tile__row"><span class="dk-metric-lg">23</span><span class="dk-trend" style="--accent:var(--crit-ink)"><svg class="dk-i dk-i--sm"><use href="#ti-arrow-up"/></svg> +18%</span></div></div></div>
      <div class="dk-col--quarter"><div class="dk-widget dk-widget--s dk-tile dk-tile--compact dk-tile--prominent"><div class="dk-tile__head"><span class="dk-tile__icon"><svg class="dk-i dk-i--sm"><use href="#ti-file-text"/></svg></span><span class="dk-tile__label">Обращений</span></div><div class="dk-tile__row"><span class="dk-metric-lg">1 284</span><span class="dk-trend" style="--accent:var(--calm-ink)"><svg class="dk-i dk-i--sm"><use href="#ti-arrow-down"/></svg> −6%</span></div></div></div>
      <div class="dk-col--quarter"><div class="dk-widget dk-widget--s dk-tile dk-tile--compact dk-tile--prominent" style="--accent:var(--high-ink)"><div class="dk-tile__head"><span class="dk-tile__icon"><svg class="dk-i dk-i--sm"><use href="#ti-clock"/></svg></span><span class="dk-tile__label">Среднее время реакции</span></div><div class="dk-tile__row"><span class="dk-metric-lg">42 <span class="dk-tile__unit">мин</span></span></div></div></div>
      <div class="dk-col--quarter"><div class="dk-widget dk-widget--s dk-tile dk-tile--compact dk-tile--prominent" style="--accent:var(--calm-ink)"><div class="dk-tile__head"><span class="dk-tile__icon"><svg class="dk-i dk-i--sm"><use href="#ti-user"/></svg></span><span class="dk-tile__label">Бригад в работе</span></div><div class="dk-tile__row"><span class="dk-metric-lg">17</span><span class="dk-trend">без изменений</span></div></div></div>
    </div>""",
    "when_yes": ["Одно текущее значение, которое смотрят первым: аварий сейчас, время реакции.",
                 "Важно направление: тренд к прошлому периоду.",
                 "Плиток две–шесть в ряд; больше — уже таблица."],
    "when_no": ["Сравнение многих значений — <a href=\"component-chart.html\">График</a> в размере L.",
                "Значение с планом и дельтой к нему — пока нет компонента; открыто в REVIEW.md («KPI с планом»).",
                "Один показатель по многим объектам — <a href=\"component-rank.html\">Рейтинг</a>."],
    "anatomy_html": """<div class="dk-grid"><div class="dk-col--half"><div class="dk-widget dk-widget--s dk-tile" style="--accent:var(--crit-ink)">
      <div class="dk-tile__head"><span class="dk-tile__icon"><b class="sc-callout">1</b><svg class="dk-i dk-i--sm"><use href="#ti-alert-triangle"/></svg></span><span class="dk-tile__label"><b class="sc-callout">2</b>Аварии за сутки</span></div>
      <div class="dk-tile__row"><span class="dk-metric-lg"><b class="sc-callout">3</b>23</span><span class="dk-trend" style="--accent:var(--crit-ink)"><b class="sc-callout">4</b><svg class="dk-i dk-i--sm"><use href="#ti-arrow-up"/></svg> +18%</span></div>
      <div class="dk-chart dk-chart--spark" id="x-an" style="position:relative"><b class="sc-callout" style="position:absolute;z-index:1">5</b></div></div></div></div>""",
    "anatomy": [("Значок", "<code>dk-tile__icon</code>: тон плитки через <code>--accent</code> — только смысл, не украшение."),
                ("Подпись", "что за число и объект учёта. Период добавляйте, если он отличается от общего периода экрана или общий период не указан."),
                ("Число", "<code>dk-metric-lg</code>, Golos 600, пропорциональные цифры: число одно и в колонку не встаёт, а табличная единица в «17» дала бы зазор."),
                ("Тренд", "<code>dk-trend</code>: стрелка и дельта со знаком; цвет — смысл изменения."),
                ("Спарклайн", "<code>type: 'spark'</code>: форма без осей; шкала не от нуля — единственное место, где это правильно.")],
    "sizes": "Компактный вариант без спарклайна: поля 20 px на десктопе и 16 px на телефоне, число 28 px, нейтральный значок 14 px; дельта рядом с числом и может переноситься при крупном тексте. Подписи полностью видны. Обычная плитка — это виджет размера S (<code>dk-widget--s</code>): поле в 14 вместо 18, потому что в четверти "
             "колонки поле в 18 съедает пятую часть ширины. В M и L та же разметка, но там уже график с осями. "
             "На месте шире 320 px (телефон, половина колонки) плитка перестраивается сама: число с трендом "
             "слева, спарклайн справа — иначе она растягивается в пустую полосу.",
    "variants": [("dk-tile--prominent", "Крупное число в обзорной карточке; обычный размер в узком контейнере.", "Вместе с dk-tile--compact, для первого ряда сводки."),
                 ("dk-tile--compact", "Нейтральный значок, полная подпись, число и прямоугольная дельта в одной строке; без спарклайна.", "Компактный ряд основных KPI."),
                 ("dk-tile__unit", "Небольшая единица рядом с числом.", "Минуты, рубли и другие меры, когда они нужны."),
                 ("dk-widget dk-widget--s dk-tile", "Плитка в четверть колонки.", "Ряд KPI сверху дашборда."),
                 ("--accent", "Тон значка и тренда.", "Смысл: crit-ink, high-ink, calm-ink; без него нейтральный."),
                 ("dk-trend", "Дельта к прошлому периоду.", "Если сравнивать есть с чем."),
                 ("dk-chart--spark", "Спарклайн 48 px высотой (64 на широком месте), точка на последнем значении.", "Если есть ряд за период.")],
    "states": """<div class="dk-grid">
      <div class="dk-col--quarter"><div class="dk-widget dk-widget--s dk-tile" aria-busy="true"><div class="dk-tile__head"><span class="dk-tile__label">Загрузка</span></div><span class="dk-vh">Загружаем</span><div class="dk-skel" style="height:28px;width:50%;margin-top:var(--space-4)"></div></div></div>
      <div class="dk-col--quarter"><div class="dk-widget dk-widget--s dk-tile"><div class="dk-tile__head"><span class="dk-tile__label">Нет данных</span></div><div class="dk-tile__row"><span class="dk-metric-lg">—</span><span class="dk-trend">нет замеров за сутки</span></div></div></div>
      <div class="dk-col--quarter"><div class="dk-widget dk-widget--s dk-tile"><div class="dk-tile__head"><span class="dk-tile__label">Без тренда</span></div><div class="dk-tile__row"><span class="dk-metric-lg">17</span><span class="dk-trend">без изменений</span></div></div></div>
      <div class="dk-col--quarter"><div class="dk-widget dk-widget--s dk-tile" style="--accent:var(--crit-ink)"><div class="dk-tile__head"><span class="dk-tile__label">Тревога</span></div><div class="dk-tile__row"><span class="dk-metric-lg" style="color:var(--crit-ink)">23</span><span class="dk-trend" style="--accent:var(--crit-ink)"><svg class="dk-i dk-i--sm"><use href="#ti-arrow-up"/></svg> +18%</span></div></div></div>
    </div>""",
    "content_ok": ["Подпись называет показатель. Общий период указан один раз; отличающийся интервал — в подписи: «Аварии за сутки».",
                   "Тренд со знаком и словами, если нет числа: «без изменений».",
                   "Единица рядом с числом только когда без неё непонятно: «42 мин»."],
    "content_bad": ["Период не указан ни на экране, ни у показателя: «Аварии: 23» — за час? за год?",
                    "Красная стрелка вниз у «времени реакции» — падение здесь хорошо.",
                    "Спарклайн с осями и подписями — в четверти колонки они мельче десяти пикселей."],
    "a11y": ["<b>Число</b> читается текстом; спарклайн — холст без подписи, и это осознанно: он повторяет тренд, который уже сказан словами.",
             "<b>Тренд</b> — стрелка со словом или числом, не только цветом.",
             "<b>Загрузка</b> — <code>aria-busy</code> на плитке и скрытый текст «Загружаем».",
             "<b>Контраст.</b> Число и подпись на поверхности виджета — проверка КОНТРАСТ."],
    "tokens": ["dk-tile", "dk-trend", "dk-metric", "dk-metric-lg", "dk-metric-xl", "dk-widget"],
    "code_intro": "Плитка — разметка; спарклайн рисует <code>dkChart</code> типом <code>spark</code>.",
    "code": """<div class="dk-widget dk-widget--s dk-tile" style="--accent:var(--crit-ink)">
  <div class="dk-tile__head">
    <span class="dk-tile__icon"><svg class="dk-i dk-i--sm"><use href="#ti-alert-triangle"/></svg></span>
    <span class="dk-tile__label">Аварии за сутки</span>
  </div>
  <div class="dk-tile__row">
    <span class="dk-metric-lg">23</span>
    <span class="dk-trend" style="--accent:var(--crit-ink)"><svg class="dk-i dk-i--sm"><use href="#ti-arrow-up"/></svg> +18%</span>
  </div>
  <div class="dk-chart dk-chart--spark" id="sp"></div>
</div>

<script>
dkChart(document.getElementById('sp'), {
  type: 'spark', categories: days,
  series: [{ name: 'Аварии', data: [12, 14, 11, 16, 15, 19, 17] }]
});
</script>""",
    "api": [("dk-tile--prominent", "класс", "Опциональный акцент: метрика 40 px при внутренней ширине от 210 px, иначе 28 px. Полные подписи и перенос дельты сохраняются."),
            ("dk-tile--compact", "класс", "Компактная плитка без спарклайна; число и дельта рядом, полные подписи и адаптивный перенос."),
            ("dk-tile__unit", "класс", "Единица меньшего размера внутри dk-metric-lg, остаётся частью доступного числа."),
            ("--accent", "переменная в style", "Тон значка и тренда; смысловые -ink токены."),
            ("dk-metric-lg / dk-metric-xl", "класс", "Кегль числа 28 или 40."),
            ("type: 'spark'", "dkChart", "Спарклайн; <code>area: false</code> убирает заливку.")],
    "related": [("component-chart.html", "График", "когда нужны оси"),
                ("component-rank.html", "Рейтинг и сводка", "главное число страны с рейтингом"),
                ("dashboard.html", "Сводка", "плитки в живом дашборде")],
},
{
    "slug": "hero", "title": "Главная карточка", "group": "Данные", "status": "стабильный",
    "purpose": "Одно главное число экрана и то, из чего оно сложено: «25 из 89», метка смысла, полоса состава и "
               "чипы с изменением. Отвечает сразу на три вопроса — сколько, много ли это и из чего состоит. "
               "На экране она одна.",
    "files": ["css/components.css"], "scripts": [],
    "live_intro": "Нейтральная поверхность выделяет главное число типографикой и композицией. "
                  "Цвет передаёт данные и исключения, а не декоративную важность карточки.",
    "live": """<div class="dk-grid">
      <div class="dk-col--half"><section class="dk-hero">
        <div class="dk-hero__label">Регионов с высоким риском</div>
        <div class="dk-hero__row">
          <div class="dk-hero__value"><span class="dk-hero__n">25</span><span class="dk-hero__of">из 89</span></div>
          <span class="dk-trend" style="--accent:var(--crit-ink)"><svg class="dk-i dk-i--sm"><use href="#ti-arrow-up-right"/></svg>негатив растёт в 7</span>
        </div>
        <div class="dk-split" role="img" aria-label="Высокий риск 25, средний 35, низкий 29">
          <span class="dk-split__seg" style="--share:25;--swatch:var(--crit)"></span><span class="dk-split__seg" style="--share:35;--swatch:var(--high)"></span><span class="dk-split__seg" style="--share:29;--swatch:var(--calm)"></span>
        </div>
        <div class="dk-keys">
          <span class="dk-key" style="--swatch:var(--crit)"><i class="dk-key__dot"></i>Высокий <b>25</b><span class="dk-key__d">+1</span></span>
          <span class="dk-key" style="--swatch:var(--high)"><i class="dk-key__dot"></i>Средний <b>35</b><span class="dk-key__d">+1</span></span>
          <span class="dk-key" style="--swatch:var(--calm)"><i class="dk-key__dot"></i>Низкий <b>29</b><span class="dk-key__d">−2</span></span>
        </div>
      </section></div>
      <div class="dk-col--half"><section class="dk-hero">
        <div class="dk-hero__label">Публикаций по всей стране · за 14 дней</div>
        <div class="dk-hero__row">
          <div class="dk-hero__value"><span class="dk-hero__n">50 887</span></div>
          <span class="dk-trend" style="--accent:var(--crit-ink)"><svg class="dk-i dk-i--sm"><use href="#ti-alert-triangle"/></svg>19% негатива</span>
        </div>
        <div class="dk-split" role="img" aria-label="Официальные 604, СМИ 14 899, соцсети 35 384">
          <span class="dk-split__seg" style="--share:604;--swatch:var(--series-1)"></span><span class="dk-split__seg" style="--share:14899;--swatch:var(--series-2)"></span><span class="dk-split__seg" style="--share:35384;--swatch:var(--series-3)"></span>
        </div>
        <div class="dk-keys">
          <span class="dk-key" style="--swatch:var(--series-1)"><i class="dk-key__dot"></i>Офиц. <b>604</b></span>
          <span class="dk-key" style="--swatch:var(--series-2)"><i class="dk-key__dot"></i>СМИ <b>14 899</b></span>
          <span class="dk-key" style="--swatch:var(--series-3)"><i class="dk-key__dot"></i>Соцсети <b>35 384</b></span>
        </div>
      </section></div>
    </div>""",
    "when_yes": ["Одно число, ради которого открывают экран: «регионов с высоким риском», «аварий сейчас».",
                 "Число — часть целого, и важно, из чего оно сложено: 25 из 89, по уровням или по источникам.",
                 "Первый экран телефона, если одно главное число отвечает на основной вопрос пользователя."],
    "when_no": ["Главных чисел несколько и они равноправны — ряд <a href=\"component-tile.html\">KPI-плиток</a>: вторая главная карточка на экране отменяет первую.",
                "Нужен ещё и список «кто хуже всех» — <a href=\"component-rank.html\">Рейтинг и сводка</a>.",
                "Долей больше шести или их надо сравнивать точно — <a href=\"component-chart.html\">График</a>: отрезки полосы глазом точно не сравнить."],
    "anatomy_html": """<section class="dk-hero" style="max-width:520px">
      <div class="dk-hero__label"><b class="sc-callout">1</b>Регионов с высоким риском</div>
      <div class="dk-hero__row">
        <div class="dk-hero__value"><b class="sc-callout">2</b><span class="dk-hero__n">25</span><span class="dk-hero__of">из 89</span><b class="sc-callout">3</b></div>
        <span class="dk-trend" style="--accent:var(--crit-ink)"><b class="sc-callout">4</b>негатив растёт в 7</span>
      </div>
      <div class="dk-split" role="img" aria-label="Высокий 25, средний 35, низкий 29"><span class="dk-split__seg" style="--share:25;--swatch:var(--crit)"></span><span class="dk-split__seg" style="--share:35;--swatch:var(--high)"></span><span class="dk-split__seg" style="--share:29;--swatch:var(--calm)"></span></div>
      <div class="dk-keys"><b class="sc-callout">5</b><span class="dk-key" style="--swatch:var(--crit)"><i class="dk-key__dot"></i>Высокий <b>25</b><span class="dk-key__d">+1</span></span><b class="sc-callout">6</b></div>
    </section>""",
    "anatomy": [("Подпись", "что считаем и в каких единицах. Период укажите здесь, если он отличается от общего интервала экрана или общий интервал не указан."),
                ("Главное число", "<code>dk-hero__n</code>, Golos 56 (<code>--type-metric-hero</code>): единственный такой кегль на экране."),
                ("Знаменатель", "<code>dk-hero__of</code> — «из 89». Вдвое мельче и серее: это не второе число, а мера."),
                ("Метка смысла", "пилюля <code>dk-trend</code> с цветом смысла: почему на число стоит смотреть."),
                ("Полоса состава", "<code>dk-split</code>: отрезки в долю (<code>--share</code>), цвет — <code>--swatch</code>."),
                ("Чипы", "<code>dk-key</code>: точка, название, число, изменение. Подписывают полосу — без них полоса цвет без слов.")],
    "variants": [("dk-hero", "Нейтральная поверхность без декоративного оттенка и глубокой тени.", "Одно главное число, выбранное по задаче пользователя."),
                 ("dk-split", "Полоса состава.", "Если число — сумма частей. Долей до шести."),
                 ("--share", "Доля отрезка — просто число.", "Абсолютные значения: 25, 35, 29 — складывать заранее не нужно."),
                 ("dk-keys / dk-key", "Чипы легенды с изменением.", "Всегда вместе с полосой."),
                 ("dk-key__d", "Изменение к прошлому периоду.", "Если сравнивать есть с чем.")],
    "sizes": "Размер один: половина колонки на десктопе, вся ширина на телефоне. Число 56 — меньше не делать: на телефоне это первое, что читают с расстояния руки.",
    "states": """<div class="dk-grid--even">
      <div class="dk-hero" aria-busy="true"><span class="dk-vh">Загружаем сводку</span><div class="dk-skel" style="height:14px;width:60%"></div><div class="dk-skel" style="height:56px;width:40%"></div><div class="dk-skel" style="height:10px"></div></div>
      <div class="dk-hero"><div class="dk-hero__label">Регионов с высоким риском</div><div class="dk-hero__row"><div class="dk-hero__value"><span class="dk-hero__n">0</span><span class="dk-hero__of">из 89</span></div><span class="dk-trend" style="--accent:var(--calm-ink)">всё спокойно</span></div><div class="dk-split" role="img" aria-label="Нет данных по составу"><span class="dk-split__seg"></span></div><div class="dk-keys"><span class="dk-key"><i class="dk-key__dot"></i>нет данных</span></div></div>
    </div>""",
    "content_ok": ["Подпись называет показатель; период добавляется только при отличии от общего интервала или отсутствии общего периода.",
                   "Число с мерой: «25 из 89», а не голое «25».",
                   "Метка отвечает «почему смотреть»: «негатив растёт в 7», «6 режимов ЧС»."],
    "content_bad": ["Две главные карточки на одном экране.",
                    "Декоративный оттенок, глубокая тень или цветная полоса для выделения карточки.",
                    "Полоса без чипов — цвет без подписи."],
    "a11y": ["<b>Полоса — картинка</b>: <code>role=\"img\"</code> и <code>aria-label</code> с составом словами; числа — в чипах под ней.",
             "<b>Цвет не единственный признак</b>: у каждой доли есть название и число в чипе.",
             "<b>Контраст.</b> Знаменатель и подписи на нейтральной поверхности — проверка КОНТРАСТ."],
    "tokens": ["dk-hero", "dk-split", "dk-keys", "dk-key"],
    "code_intro": "Только разметка: скрипта у карточки нет. Числа — через <code>dkFmt</code>, доли — теми же числами в <code>--share</code>.",
    "code": """<section class="dk-hero">
  <div class="dk-hero__label">Регионов с высоким риском</div>
  <div class="dk-hero__row">
    <div class="dk-hero__value"><span class="dk-hero__n">25</span><span class="dk-hero__of">из 89</span></div>
    <span class="dk-trend" style="--accent:var(--crit-ink)">
      <svg class="dk-i dk-i--sm"><use href="#ti-arrow-up-right"/></svg>негатив растёт в 7</span>
  </div>
  <div class="dk-split" role="img" aria-label="Высокий 25, средний 35, низкий 29">
    <span class="dk-split__seg" style="--share:25;--swatch:var(--crit)"></span>
    <span class="dk-split__seg" style="--share:35;--swatch:var(--high)"></span>
    <span class="dk-split__seg" style="--share:29;--swatch:var(--calm)"></span>
  </div>
  <div class="dk-keys">
    <span class="dk-key" style="--swatch:var(--crit)"><i class="dk-key__dot"></i>Высокий <b>25</b><span class="dk-key__d">+1</span></span>
  </div>
</section>""",
    "api": [("dk-hero", "класс", "Нейтральная главная карточка; семантический цвет применяют к данным и обоснованным статусам, а не поверхности."),
            ("--share", "число в style отрезка", "Доля отрезка полосы; складывать заранее не нужно."),
            ("--swatch", "переменная в style", "Цвет отрезка и точки чипа: смысл или серия, один и тот же для пары."),
            ("dk-hero__of", "элемент", "Мера «из скольких»; не пропускать, если она есть.")],
    "related": [("component-tile.html", "KPI-плитка", "несколько равноправных чисел"),
                ("component-rank.html", "Рейтинг и сводка", "главное число и список «кто хуже»"),
                ("component-legend.html", "Фильтры-легенда", "та же легенда, но нажимается")],
},
{
    "slug": "car", "title": "Лента карточек", "group": "Данные", "status": "стабильный",
    "purpose": "Несколько объектов, у каждого своя история: «Резко выросли за день», «В фокусе дня». Карточки стоят в "
               "ряд и листаются вбок; видна одна история целиком и краешек следующей — подсказка, что их несколько.",
    "files": ["css/components.css", "js/dk-car.js"], "scripts": ["dk-car.js"],
    "live_intro": "Пролистайте ленту: счётчик и точки идут за текущей карточкой. На экране с мышью в шапке появляются "
                  "стрелки — колесом вбок листает не каждая мышь.",
    "live": """<div class="dk-car" id="x-car">
      <div class="dk-car__head"><h3 class="dk-car__title">Резко выросли за день</h3><span class="dk-push dk-car__pos">1 из 3</span>
        <span class="dk-car__nav"><button type="button" class="dk-iconbtn dk-iconbtn--sm" data-car="prev" aria-label="Предыдущая"><svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-chevron-left"/></svg></button><button type="button" class="dk-iconbtn dk-iconbtn--sm" data-car="next" aria-label="Следующая"><svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-chevron-right"/></svg></button></span></div>
      <ul class="dk-car__track" role="list">
        <li class="dk-car__item" style="--accent:var(--crit)">
          <span class="dk-car__tags"><span class="dk-trend" style="--accent:var(--crit-ink)"><svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-arrow-up-right"/></svg>+27 за день</span><span class="dk-trend" style="--accent:var(--crit-ink)">средний → высокий</span></span>
          <span class="dk-car__row"><span class="dk-car__who"><span class="dk-car__name">Санкт-Петербург</span><span class="dk-car__sub">СЗФО</span></span>
            <span class="dk-car__change" aria-label="было 30, стало 57"><span class="dk-car__from" style="--from:var(--high-ink)">30</span><span class="dk-car__arrow" aria-hidden="true">→</span><span class="dk-car__to" style="--to:var(--crit-ink)">57</span></span></span>
          <p class="dk-car__text">Авария теплосети; отключения ГВС и отопления в трёх районах.</p>
        </li>
        <li class="dk-car__item" style="--accent:var(--crit)">
          <span class="dk-car__tags"><span class="dk-trend" style="--accent:var(--crit-ink)"><svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-arrow-up-right"/></svg>+26 за день</span></span>
          <span class="dk-car__row"><span class="dk-car__who"><span class="dk-car__name">Ярославская область</span><span class="dk-car__sub">ЦФО</span></span>
            <span class="dk-car__change" aria-label="было 70, стало 96"><span class="dk-car__from" style="--from:var(--high-ink)">70</span><span class="dk-car__arrow" aria-hidden="true">→</span><span class="dk-car__to" style="--to:var(--crit-ink)">96</span></span></span>
          <p class="dk-car__text">После пожара на заводе село обесточено, введён режим ЧС.</p>
        </li>
        <li class="dk-car__item" style="--accent:var(--high)">
          <span class="dk-car__tags"><span class="dk-trend" style="--accent:var(--high-ink)"><svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-arrow-up-right"/></svg>+12 за день</span></span>
          <span class="dk-car__row"><span class="dk-car__who"><span class="dk-car__name">Приморский край</span><span class="dk-car__sub">ДФО</span></span>
            <span class="dk-car__change" aria-label="было 52, стало 64"><span class="dk-car__from">52</span><span class="dk-car__arrow" aria-hidden="true">→</span><span class="dk-car__to" style="--to:var(--high-ink)">64</span></span></span>
          <p class="dk-car__text">Авария на подстанции, без света четыре посёлка.</p>
        </li>
      </ul>
      <div class="dk-car__dots"></div>
    </div>""",
    "live_script": """
  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkCar === 'function') dkCar(document.getElementById('x-car'));
  });""",
    "when_yes": ["Три–семь объектов, и у каждого есть рассказ: было → стало, причина, где.",
                 "Верх телефонного экрана под главной карточкой: «что изменилось сегодня»."],
    "when_no": ["Объектов больше семи или их надо сравнивать между собой — <a href=\"component-rank.html\">Рейтинг</a> или <a href=\"component-table.html\">Таблица</a>: в ленте видна одна карточка за раз.",
                "Одно число с тем, из чего оно сложено — <a href=\"component-hero.html\">Главная карточка</a>.",
                "Список событий по времени — <a href=\"component-list.html\">Список</a>."],
    "anatomy_html": """<div class="dk-car"><div class="dk-car__head"><h3 class="dk-car__title"><b class="sc-callout">1</b>Резко выросли за день</h3><span class="dk-push dk-car__pos">1 из 3</span><b class="sc-callout">2</b></div>
      <ul class="dk-car__track" role="list"><li class="dk-car__item" style="--accent:var(--crit)">
        <span class="dk-car__tags"><b class="sc-callout">3</b><span class="dk-trend" style="--accent:var(--crit-ink)">+27 за день</span></span>
        <span class="dk-car__row"><span class="dk-car__who"><b class="sc-callout">4</b><span class="dk-car__name">Санкт-Петербург</span><span class="dk-car__sub">СЗФО</span></span>
          <span class="dk-car__change"><b class="sc-callout">5</b><span class="dk-car__from">30</span><span class="dk-car__arrow" aria-hidden="true">→</span><span class="dk-car__to" style="--to:var(--crit-ink)">57</span></span></span>
        <p class="dk-car__text"><b class="sc-callout">6</b>Авария теплосети; отключения ГВС и отопления.</p></li></ul></div>""",
    "anatomy": [("Заголовок ленты", "<code>dk-car__title</code>: что объединяет карточки."),
                ("Счётчик", "<code>dk-car__pos</code> «1 из 3» — словами; точки под лентой только подсказка."),
                ("Метки", "<code>dk-car__tags</code>: пилюли <code>dk-trend</code> — почему карточка здесь."),
                ("Кто", "<code>dk-car__name</code> и <code>dk-car__sub</code>: объект и где он."),
                ("Было → стало", "<code>dk-car__change</code>: прежнее мельче, нынешнее крупным числом смысла."),
                ("Рассказ", "<code>dk-car__text</code>, две строки: причина словами.")],
    "variants": [("--accent на dk-car__item", "Оттенок карточки по смыслу.", "Свой у каждой: разные объекты — разный риск."),
                 ("--from / --to", "Цвет прежнего и нынешнего значения.", "Смысл значения: high-ink, crit-ink."),
                 ("a.dk-car__item / button.dk-car__item", "Карточка-ссылка или кнопка.", "Если карточка открывает объект."),
                 ("dk-car__nav", "Стрелки назад и вперёд.", "Всегда в разметке; видны только с мышью.")],
    "sizes": "Карточка 300 px, но не шире 82% экрана: на телефоне от следующей остаётся видимая полоса. Размер один.",
    "states": """<div class="dk-grid--even"><div class="dk-panel"><div class="dk-empty"><div class="dk-empty__t">Сегодня резких изменений нет</div><div>Ни один регион не вырос больше чем на 10 баллов за сутки.</div><div class="dk-empty__do">Лента вернётся, когда изменения появятся.</div></div></div></div>""",
    "content_ok": ["Заголовок отвечает, почему эти карточки вместе: «Резко выросли за день».",
                   "Было → стало числами: «30 → 57».",
                   "Рассказ — причина: «авария теплосети», а не «рост показателя»."],
    "content_bad": ["Лента из одной карточки — это главная карточка.",
                    "Двадцать карточек: до последней не долистают.",
                    "Пустая лента без слов, когда изменений нет."],
    "a11y": ["<b>Лента — список</b>: <code>ul role=\"list\"</code>, карточки — пункты; скринридер называет, сколько их.",
             "<b>Позиция словами</b>: счётчик «1 из 3»; точки скрыты от скринридера (<code>aria-hidden</code>).",
             "<b>Было → стало</b> — <code>aria-label</code> на паре чисел: «было 30, стало 57», стрелка скрыта.",
             "<b>Стрелки</b> — кнопки с подписью; на краях ленты отключаются."],
    "tokens": ["dk-car"],
    "code_intro": "Разметку пишет страница, <code>dkCar</code> только оживляет её: счётчик, точки и стрелки.",
    "code": """<div class="dk-car" id="car">
  <div class="dk-car__head">
    <h3 class="dk-car__title">Резко выросли за день</h3>
    <span class="dk-push dk-car__pos">1 из 5</span>
    <span class="dk-car__nav">
      <button type="button" class="dk-iconbtn dk-iconbtn--sm" data-car="prev" aria-label="Предыдущая">…</button>
      <button type="button" class="dk-iconbtn dk-iconbtn--sm" data-car="next" aria-label="Следующая">…</button>
    </span>
  </div>
  <ul class="dk-car__track" role="list">
    <li class="dk-car__item" style="--accent:var(--crit)">
      <span class="dk-car__tags"><span class="dk-trend" style="--accent:var(--crit-ink)">+27 за день</span></span>
      <span class="dk-car__row">
        <span class="dk-car__who"><span class="dk-car__name">Санкт-Петербург</span><span class="dk-car__sub">СЗФО</span></span>
        <span class="dk-car__change" aria-label="было 30, стало 57">
          <span class="dk-car__from">30</span><span class="dk-car__arrow" aria-hidden="true">→</span>
          <span class="dk-car__to" style="--to:var(--crit-ink)">57</span></span>
      </span>
      <p class="dk-car__text">Авария теплосети; отключения ГВС и отопления.</p>
    </li>
  </ul>
  <div class="dk-car__dots"></div>
</div>

<script>
var car = dkCar(document.getElementById('car'));
car.index;    // текущая карточка
car.go(2);    // пролистать к третьей
</script>""",
    "api": [("dkCar(el)", "функция", "Оживляет разметку ленты; возвращает управление."),
            ("index", "число, чтение", "Номер текущей карточки, с нуля."),
            ("go(i)", "функция", "Пролистать к карточке; движение гасится системной настройкой."),
            ("destroy()", "функция", "Снять обработчики; сторож dk-util.js сделает это сам, когда узел уйдёт.")],
    "related": [("component-hero.html", "Главная карточка", "одно главное число экрана"),
                ("component-rank.html", "Рейтинг и сводка", "много объектов для сравнения"),
                ("component-list.html", "Список", "события по времени")],
},
{
    "slug": "rank", "title": "Рейтинг и сводка", "group": "Данные", "status": "стабильный",
    "purpose": "Правая колонка дашборда: главное число, тренд и ранжированный список — кто хуже всех. "
               "Строки разделяются ритмом и наведением, не линейками.",
    "files": ["css/components.css"], "scripts": [],
    "live_intro": "Сводка по стране и топ-5 регионов; справа — чипы по уровням риска.",
    "live": """<div class="dk-layout"><div class="dk-panel">
      <div class="dk-panel__head"><div><div class="dk-overline">Сводка по стране · 14 дней</div><div class="dk-h2" style="margin-top:var(--space-2)">Российская Федерация</div></div></div>
      <div class="dk-summary" style="--accent:var(--crit-ink)"><div><div class="dk-trend"><svg class="dk-i"><use href="#ti-arrow-up-right"/></svg> негатив растёт в 28</div><div style="font-size:var(--text-caption);color:var(--ink-2);margin-top:var(--space-2)"><b class="dk-num" style="color:var(--ink)">15</b> регионов с событием</div></div><div class="dk-score"><span class="dk-score__v">23</span><span class="dk-score__of">/89</span></div></div>
      <div class="dk-rank" style="margin-top:var(--space-6)"><div class="dk-rank__head"><span class="dk-overline">Регионы</span><svg class="dk-i dk-i--sm"><use href="#ti-arrow-down"/></svg></div>
        <button class="dk-rank__row"><span class="dk-rank__i">01</span><span class="dk-rank__name">Донецкая Народная Республика</span><span class="dk-rank__v" style="--accent:var(--crit-ink)">95</span></button>
        <button class="dk-rank__row"><span class="dk-rank__i">02</span><span class="dk-rank__name">Крым</span><span class="dk-rank__v" style="--accent:var(--crit-ink)">82</span></button>
        <button class="dk-rank__row"><span class="dk-rank__i">03</span><span class="dk-rank__name">Саха (Якутия)</span><span class="dk-rank__v" style="--accent:var(--crit-ink)">81</span></button>
        <button class="dk-rank__row"><span class="dk-rank__i">04</span><span class="dk-rank__name">Новосибирская область</span><span class="dk-rank__v" style="--accent:var(--high-ink)">73</span></button>
        <button class="dk-rank__row"><span class="dk-rank__i">05</span><span class="dk-rank__name">Ростовская область</span><span class="dk-rank__v" style="--accent:var(--high-ink)">73</span></button></div></div>
      <div class="sc-stack"><div class="dk-chip"><span class="dk-chip__n" style="--accent:var(--crit-ink)">23</span><span class="dk-chip__l">высокий риск</span></div><div class="dk-chip"><span class="dk-chip__n" style="--accent:var(--high-ink)">27</span><span class="dk-chip__l">средний</span></div><div class="dk-chip"><span class="dk-chip__n" style="--accent:var(--calm-ink)">38</span><span class="dk-chip__l">низкий</span></div><div class="dk-chip"><span class="dk-chip__n">89</span><span class="dk-chip__l">всего субъектов</span></div></div>
    </div>""",
    "when_yes": ["Вопрос «у кого хуже» по одному показателю: регионы по баллу, команды по просрочке.",
                 "Нужен верх списка, а не весь список — топ-5 или топ-10.",
                 "Строка ведёт к объекту: клик открывает регион."],
    "when_no": ["Несколько показателей на объект — <a href=\"component-table.html\">Таблица</a>.",
                "Доля от самого крупного полосой — <a href=\"component-list.html\">Полосы</a> (<code>dk-bars</code>).",
                "Все 89 регионов — <a href=\"component-map.html\">Плитки регионов</a>."],
    "anatomy_html": """<div class="dk-panel"><div class="dk-summary" style="--accent:var(--crit-ink)"><div><div class="dk-trend"><b class="sc-callout">1</b><svg class="dk-i"><use href="#ti-arrow-up-right"/></svg> негатив растёт в 28</div></div><div class="dk-score"><b class="sc-callout">2</b><span class="dk-score__v">23</span><span class="dk-score__of">/89</span></div></div>
      <div class="dk-rank" style="margin-top:var(--space-6)"><div class="dk-rank__head"><b class="sc-callout">3</b><span class="dk-overline">Регионы</span><svg class="dk-i dk-i--sm"><use href="#ti-arrow-down"/></svg></div>
        <button class="dk-rank__row"><span class="dk-rank__i"><b class="sc-callout">4</b>01</span><span class="dk-rank__name"><b class="sc-callout">5</b>Крым</span><span class="dk-rank__v" style="--accent:var(--crit-ink)"><b class="sc-callout">6</b>82</span></button></div></div>""",
    "anatomy": [("Тренд сводки", "<code>dk-trend</code> внутри <code>dk-summary</code>: куда идёт и в скольких объектах."),
                ("Главное число", "<code>dk-score</code>: значение и «из скольких» мельче."),
                ("Шапка рейтинга", "надпись и стрелка направления сортировки."),
                ("Номер", "<code>dk-rank__i</code>: место в списке, две цифры."),
                ("Название", "переносится и остаётся видимым целиком."),
                ("Значение", "<code>dk-rank__v</code> табличными цифрами; цвет смысла через <code>--accent</code>.")],
    "sizes": "Размер один: правая колонка макета <code>dk-layout</code>. Строк — пять или десять; больше — таблица с пагинацией.",
    "variants": [("dk-summary", "Главное число с трендом.", "Верх правой колонки."),
                 ("dk-rank", "Ранжированный список кнопок.", "Топ-N."),
                 ("dk-chip", "Число с подписью.", "Разбивка по категориям под сводкой."),
                 ("--accent на dk-rank__v / dk-chip__n", "Цвет смысла значения.", "Порог: crit-ink, high-ink, calm-ink.")],
    "states": """<div class="dk-grid--even">
      <div class="dk-panel"><div class="dk-overline" style="margin-bottom:var(--space-5)">Загрузка</div><span class="dk-vh">Загружаем рейтинг</span><div class="dk-skel" style="height:14px;width:80%;margin-bottom:var(--space-5)"></div><div class="dk-skel" style="height:14px;width:65%;margin-bottom:var(--space-5)"></div><div class="dk-skel" style="height:14px;width:70%"></div></div>
      <div class="dk-panel"><div class="dk-overline" style="margin-bottom:var(--space-5)">Ничья и нет данных</div><div class="dk-rank"><button class="dk-rank__row"><span class="dk-rank__i">04</span><span class="dk-rank__name">Новосибирская область</span><span class="dk-rank__v" style="--accent:var(--high-ink)">73</span></button><button class="dk-rank__row"><span class="dk-rank__i">04</span><span class="dk-rank__name">Ростовская область</span><span class="dk-rank__v" style="--accent:var(--high-ink)">73</span></button><button class="dk-rank__row"><span class="dk-rank__i">—</span><span class="dk-rank__name">Чукотский АО</span><span class="dk-rank__v">—</span></button></div></div>
    </div>
    <div class="sc-note"><b>Равные значения делят место.</b> Два региона с баллом 73 — оба четвёртые, следующий шестой. Регион без данных в рейтинг не входит и стоит внизу с прочерком.</div>""",
    "content_ok": ["Заголовок сводки с периодом: «Сводка по стране · 14 дней».",
                   "Главное число с «из скольких»: 23/89.",
                   "Название региона официальное, как в справочнике."],
    "content_bad": ["Рейтинг из двадцати строк — это таблица.",
                    "Число без периода и без «из».",
                    "Цвет значения без порога — «просто красиво»."],
    "a11y": ["<b>Строки — кнопки</b>: Tab и Enter открывают объект; кольцо фокуса при навигации с клавиатуры.",
             "<b>Порядок</b> читается числом номера, не только положением.",
             "<b>Значение</b> цветом и числом; цвет — дополнение.",
             "<b>Контраст.</b> Значения на поверхности панели — проверка КОНТРАСТ."],
    "tokens": ["dk-summary", "dk-score", "dk-rank", "dk-chip", "dk-trend"],
    "code_intro": "Только разметка. Ряды строит страница из данных; клик по строке — её событие.",
    "code": """<div class="dk-summary" style="--accent:var(--crit-ink)">
  <div><div class="dk-trend"><svg class="dk-i"><use href="#ti-arrow-up-right"/></svg> негатив растёт в 28</div></div>
  <div class="dk-score"><span class="dk-score__v">23</span><span class="dk-score__of">/89</span></div>
</div>

<div class="dk-rank">
  <div class="dk-rank__head"><span class="dk-overline">Регионы</span></div>
  <button class="dk-rank__row" data-id="RU-CR">
    <span class="dk-rank__i">01</span>
    <span class="dk-rank__name">Крым</span>
    <span class="dk-rank__v" style="--accent:var(--crit-ink)">82</span>
  </button>
</div>""",
    "api": [("--accent", "переменная в style", "Цвет значения или числа чипа."),
            ("dk-rank__row", "кнопка", "Строка; страница вешает клик."),
            ("dk-score__of", "элемент", "«из скольких» — не пропускать.")],
    "related": [("component-table.html", "Таблица", "несколько показателей на объект"),
                ("component-tile.html", "KPI-плитка", "одно число без списка"),
                ("component-map.html", "Регионы", "те же данные на карте и плитках")],
},
{
    "slug": "list", "title": "Список, полосы, раскрытие", "group": "Данные", "status": "стабильный",
    "purpose": "Три способа показать ряд объектов без таблицы: список событий со значком и значением, полосы "
               "«доля от самого крупного», раскрывающийся блок с итогом в заголовке.",
    "files": ["css/components.css"], "scripts": [],
    "live_intro": "Список последних событий, полосы по видам обращений, свёрнутые подробности.",
    "live": """<div class="dk-grid">
      <div class="dk-col--half"><div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title">Последние события</h3></div><div class="dk-list">
        <button class="dk-list__row" style="--accent:var(--crit-ink)"><span class="dk-list__icon"><svg class="dk-i dk-i--sm"><use href="#ti-alert-triangle"/></svg></span><span class="dk-list__text"><span class="dk-list__name">Прорыв теплотрассы</span><span class="dk-list__sub">Новосибирск · 14:20</span></span><span class="dk-list__v" style="--accent:var(--crit-ink)">1 240 чел.</span></button>
        <button class="dk-list__row" style="--accent:var(--high-ink)"><span class="dk-list__icon"><svg class="dk-i dk-i--sm"><use href="#ti-bolt"/></svg></span><span class="dk-list__text"><span class="dk-list__name">Отключение электроснабжения</span><span class="dk-list__sub">Ростовская область · 12:05</span></span><span class="dk-list__v" style="--accent:var(--high-ink)">380 чел.</span></button>
        <button class="dk-list__row" style="--accent:var(--calm-ink)"><span class="dk-list__icon"><svg class="dk-i dk-i--sm"><use href="#ti-circle-check"/></svg></span><span class="dk-list__text"><span class="dk-list__name">Подача восстановлена</span><span class="dk-list__sub">Крым · 09:48</span></span><span class="dk-list__v" style="--accent:var(--calm-ink)">—</span></button>
        <button class="dk-list__more">Показать все <svg class="dk-i dk-i--sm"><use href="#ti-chevron-right"/></svg></button></div></div></div>
      <div class="dk-col--half"><div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title">Кто больше жжёт</h3><span class="dk-widget__hint" title="Полоса — доля от самого крупного в списке"><svg class="dk-i dk-i--sm"><use href="#ti-info-circle"/></svg></span></div><div class="dk-bars">
        <div class="dk-bar" style="--accent:var(--crit-ink)"><div class="dk-bar__head"><span class="dk-bar__name">Отопление</span><span class="dk-bar__v">520</span></div><div class="dk-bar__track"><div class="dk-bar__fill" style="width:100%"></div></div><div class="dk-bar__meta">41% обращений · 1 240 жителей</div></div>
        <div class="dk-bar" style="--accent:var(--high-ink)"><div class="dk-bar__head"><span class="dk-bar__name">Водоснабжение</span><span class="dk-bar__v">344</span></div><div class="dk-bar__track"><div class="dk-bar__fill" style="width:66%"></div></div><div class="dk-bar__meta">27% обращений · 860 жителей</div></div>
        <div class="dk-bar"><div class="dk-bar__head"><span class="dk-bar__name">Электроснабжение</span><span class="dk-bar__v">228</span></div><div class="dk-bar__track"><div class="dk-bar__fill" style="width:44%"></div></div><div class="dk-bar__meta">18% обращений · 410 жителей</div></div></div>
        <details class="dk-fold" style="margin-top:var(--space-6)"><summary class="dk-fold__head"><span class="dk-fold__title">Вспомогательные серверы</span><span class="dk-fold__sum">серверы 4/4 · туннели 3/3</span><svg class="dk-i dk-i--sm"><use href="#ti-chevron-down"/></svg></summary><div class="dk-fold__body"><div class="dk-row"><span class="dk-row__label">Королёв</span><span class="dk-row__value">работает</span></div><div class="dk-row"><span class="dk-row__label">Франкфурт</span><span class="dk-row__value">работает</span></div></div></details></div></div>
    </div>""",
    "when_yes": ["Список: лента событий с одним значением на строку, где важны время и вид.",
                 "Полосы: доля от самого крупного в списке из трёх–семи категорий.",
                 "Раскрытие: подробности, без которых можно понять итог, — и итог стоит в заголовке."],
    "when_no": ["Несколько показателей на строку — <a href=\"component-table.html\">Таблица</a>.",
                "Доля от целого — <a href=\"component-chart.html\">пончик</a>: полосы показывают долю от максимума, а не от суммы.",
                "Ранжирование по одному числу — <a href=\"component-rank.html\">Рейтинг</a>."],
    "anatomy_html": """<div class="dk-grid"><div class="dk-col--half"><div class="dk-list">
      <button class="dk-list__row" style="--accent:var(--crit-ink)"><span class="dk-list__icon"><b class="sc-callout">1</b><svg class="dk-i dk-i--sm"><use href="#ti-alert-triangle"/></svg></span><span class="dk-list__text"><span class="dk-list__name"><b class="sc-callout">2</b>Прорыв теплотрассы</span><span class="dk-list__sub"><b class="sc-callout">3</b>Новосибирск · 14:20</span></span><span class="dk-list__v" style="--accent:var(--crit-ink)"><b class="sc-callout">4</b>1 240 чел.</span></button>
      <button class="dk-list__more"><b class="sc-callout">5</b>Показать все <svg class="dk-i dk-i--sm"><use href="#ti-chevron-right"/></svg></button></div></div>
      <div class="dk-col--half"><div class="dk-bar" style="--accent:var(--high-ink)"><div class="dk-bar__head"><span class="dk-bar__name"><b class="sc-callout">6</b>Водоснабжение</span><span class="dk-bar__v"><b class="sc-callout">7</b>344</span></div><div class="dk-bar__track"><b class="sc-callout">8</b><div class="dk-bar__fill" style="width:66%"></div></div><div class="dk-bar__meta"><b class="sc-callout">9</b>27% обращений · 860 жителей</div></div></div></div>""",
    "anatomy": [("Значок", "вид события; тон через <code>--accent</code>."),
                ("Название", "что случилось."),
                ("Подстрока", "где и когда."),
                ("Значение", "чем измеряется: жителей, минут; прочерк, если нечем."),
                ("«Показать все»", "<code>dk-list__more</code>: лента показывает верх, остальное по кнопке."),
                ("Название полосы", "категория."),
                ("Значение полосы", "число табличными цифрами — полоса «примерно», число «сколько»."),
                ("Полоса", "ширина — доля от самого крупного в списке; заливка через <code>--accent</code>."),
                ("Пояснение", "<code>dk-bar__meta</code>: доля и что за ней стоит.")],
    "sizes": "Размеры одни: строка списка 56 px, полоса 8 px. Список — в M-виджете, полосы — в M и L.",
    "variants": [("dk-list / dk-list__row", "Лента событий; строка — кнопка.", "Верх ленты с «Показать все»."),
                 ("dk-bars / dk-bar", "Полосы от максимума.", "Три–семь категорий."),
                 ("dk-fold", "Раскрывающийся блок на <code>&lt;details&gt;</code>.", "Подробности с итогом в заголовке."),
                 ("dk-fold--plain", "Раскрытие без заливки: разделительная линия и заголовок с зоной касания не менее 44 px.", "Определения метрик и дополнительные показатели под обзором. Стрелка <code>ti-chevron-down</code> обязательна в разметке."),
                 ("dk-row", "Строка «подпись — значение».", "Внутри раскрытия и в коротких сводках."),
                 ("--accent", "Тон значка, значения, полосы.", "Смысл, не украшение.")],
    "states": """<div class="dk-grid--even">
      <div class="dk-panel"><div class="dk-overline" style="margin-bottom:var(--space-5)">Пустая лента</div><div class="dk-empty"><div class="dk-empty__t">Событий за сутки нет</div><div>Ни одной записи в журнале.</div></div></div>
      <div class="dk-panel"><div class="dk-overline" style="margin-bottom:var(--space-5)">Полоса с нулём</div><div class="dk-bars"><div class="dk-bar"><div class="dk-bar__head"><span class="dk-bar__name">Газоснабжение</span><span class="dk-bar__v">0</span></div><div class="dk-bar__track"><div class="dk-bar__fill" style="width:0%"></div></div><div class="dk-bar__meta">0% обращений</div></div></div></div>
      <div class="dk-panel"><div class="dk-overline" style="margin-bottom:var(--space-5)">Раскрыто</div><details class="dk-fold" open><summary class="dk-fold__head"><span class="dk-fold__title">Серверы</span><span class="dk-fold__sum">3/4</span><svg class="dk-i dk-i--sm"><use href="#ti-chevron-down"/></svg></summary><div class="dk-fold__body"><div class="dk-row"><span class="dk-row__label">Королёв</span><span class="dk-row__value" style="--accent:var(--crit-ink)">не отвечает</span></div></div></details></div>
    </div>
    <div class="sc-note"><b>Нулевая полоса остаётся с числом.</b> Пустая дорожка без «0» читалась бы как отсутствие данных.</div>""",
    "content_ok": ["Подстрока «где · когда» через точку-разделитель.",
                   "Значение с единицей: «1 240 чел.», «—», если измерить нечем.",
                   "Итог в заголовке раскрытия: «серверы 4/4»."],
    "content_bad": ["Лента на сорок строк без «Показать все».",
                    "Полосы без чисел.",
                    "Свёрнуто то, без чего не понять, — это сокрытие, а не сворачивание."],
    "a11y": ["<b>Строки списка — кнопки</b>: Tab, Enter; фокус виден.",
             "<b>Раскрытие</b> — настоящий <code>&lt;details&gt;</code>: клавиатура и скринридер бесплатно.",
             "<b>Полосы</b> — число рядом читается; полоса декоративна.",
             "<b>Контраст.</b> Подстрока <code>--ink-3</code> на поверхности — не ниже 4,07:1."],
    "tokens": ["dk-list", "dk-bars", "dk-bar", "dk-fold", "dk-fold--plain", "dk-row"],
    "code_intro": "Только разметка. «Показать все» — событие страницы.",
    "code": """<div class="dk-list">
  <button class="dk-list__row" style="--accent:var(--crit-ink)" data-id="4821">
    <span class="dk-list__icon"><svg class="dk-i dk-i--sm"><use href="#ti-alert-triangle"/></svg></span>
    <span class="dk-list__text">
      <span class="dk-list__name">Прорыв теплотрассы</span>
      <span class="dk-list__sub">Новосибирск · 14:20</span>
    </span>
    <span class="dk-list__v" style="--accent:var(--crit-ink)">1 240 чел.</span>
  </button>
  <button class="dk-list__more">Показать все</button>
</div>

<div class="dk-bar" style="--accent:var(--high-ink)">
  <div class="dk-bar__head"><span class="dk-bar__name">Водоснабжение</span><span class="dk-bar__v">344</span></div>
  <div class="dk-bar__track"><div class="dk-bar__fill" style="width:66%"></div></div>
  <div class="dk-bar__meta">27% обращений</div>
</div>""",
    "api": [("--accent", "переменная в style", "Тон строки или полосы."),
            ("dk-list__more", "кнопка", "Показать остальное; страница решает как."),
            ("dk-bar__fill style=width", "проценты от максимума", "Считает страница: max = 100%.")],
    "related": [("component-rank.html", "Рейтинг", "ранжирование по числу"),
                ("component-table.html", "Таблица", "когда показателей несколько"),
                ("component-uptime.html", "Доступность служб", "полоса другого рода — во времени")],
},
{
    "slug": "uptime", "title": "Доступность служб", "group": "Данные", "status": "стабильный",
    "purpose": "Полоса из делений по времени: работала служба или нет. Легенда стоит всегда, а не только когда "
               "появился сбой, и «нет данных» не притворяется «работает».",
    "files": ["css/components.css", "js/dk-uptime.js"], "scripts": ["dk-uptime.js"],
    "live_intro": "Три службы, сутки по получасу. Последние деления — «нет данных»: замер ещё не пришёл.",
    "live": """<div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title">Доступность служб · сутки</h3></div><div id="x-uptime"></div></div>""",
    "live_script": """  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkUptime !== 'function') return;
    function strip(down) { var out = []; for (var i = 0; i < 48; i++) out.push(down.indexOf(i) >= 0 ? 'down' : (i > 45 ? 'none' : 'up')); return out; }
    dkUptime(document.getElementById('x-uptime'), { step: '30 минут', labels: ['24 ч назад', 'сейчас'], rows: [
      { name: 'Приём заявок', data: strip([]) }, { name: 'Телеметрия сетей', data: strip([14, 15]) }, { name: 'Рассылка жителям', data: strip([31, 32, 33, 34, 35, 36, 37]) }] });
  });""",
    "when_yes": ["Служба либо работает, либо нет, и важно, когда именно не работала.",
                 "Несколько служб сравнивают по одной шкале времени.",
                 "Период — сутки или неделя с равными делениями."],
    "when_no": ["Значение, а не да/нет, во времени — <a href=\"component-chart.html\">График</a>.",
                "Доля выполненного — <a href=\"component-badge.html\">Прогресс</a>.",
                "Событие с длительностью и описанием — <a href=\"component-calendar.html\">Календарь</a>."],
    "anatomy_html": """<div class="dk-uptime"><div class="dk-uptime__row"><span class="dk-uptime__name"><b class="sc-callout">1</b><span class="dk-dot" style="--accent:var(--high)"></span>Телеметрия сетей</span><span class="dk-uptime__strip" tabindex="0" role="group" aria-label="Телеметрия сетей: делений с перебоями 2"><b class="sc-callout">2</b><span class="dk-uptime__seg" data-state="up"></span><span class="dk-uptime__seg" data-state="up"></span><span class="dk-uptime__seg" data-state="down"></span><span class="dk-uptime__seg" data-state="down"></span><span class="dk-uptime__seg" data-state="up"></span><span class="dk-uptime__seg" data-state="none"></span></span><span class="dk-uptime__v"><b class="sc-callout">3</b>96%</span></div>
      <div class="dk-uptime__axis"><b class="sc-callout">4</b><span>24 ч назад</span><span>сейчас</span></div>
      <div class="dk-uptime__row" style="margin-top:var(--space-3)"><span class="dk-uptime__name"></span><span class="dk-caption"><b class="sc-callout">5</b>легенда: работает · сбой · нет данных</span><span class="dk-uptime__v"></span></div></div>""",
    "anatomy": [("Название службы", "слева, одной строкой."),
                ("Полоса делений", "<code>dk-uptime__strip</code>: одно деление — один шаг времени; цвет состояния: работает, сбой, нет данных. Углы прямые: деление — это интервал, а не плитка."),
                ("Доступность", "процент рабочих делений от известных; «нет данных» в знаменатель не входит."),
                ("Ось", "подписи краёв: откуда и докуда."),
                ("Легенда", "всегда, даже когда сбоев нет: в момент первого сбоя человек увидит новый цвет и должен знать, что он значит.")],
    "sizes": "Размер один: полоса тянется по ширине виджета, деление — доля ширины. Делений до 96 (неделя по два часа); мельче не попасть курсором за подсказкой.",
    "variants": [("rows[].data", "Массив состояний: 'up' | 'down' | 'none'.", "Каждая служба."),
                 ("step", "Подпись шага: «30 минут».", "Идёт в подсказку деления."),
                 ("labels", "Подписи краёв оси.", "['24 ч назад', 'сейчас'] по умолчанию иначе.")],
    "states": """<div class="dk-widget"><div id="x-uptime-states"></div></div>
    <div class="sc-note"><b>Неизвестное состояние — это «нет данных».</b> Значение вне трёх известных не даёт невидимого деления и подписи «undefined»: оно рисуется как отсутствие данных и считается так же.</div>""",
    "content_ok": ["Название службы так, как её зовут дежурные: «Приём заявок».",
                   "Подпись шага и краёв оси словами: «30 минут», «24 ч назад».",
                   "Процент — от известных делений."],
    "content_bad": ["Зелёная полоса там, где замеров не было.",
                    "Легенда, которая появляется только при сбое.",
                    "100% при половине делений «нет данных»."],
    "a11y": ["<b>Полоса фокусируема</b> и описана целиком в <code>aria-label</code>: сколько делений с перебоями.",
             "<b>Не только цветом.</b> Легенда со словами; процент числом.",
             "<b>Подсказка</b> у деления — <code>title</code>: время и состояние.",
             "<b>Контраст.</b> Три цвета делений различимы между собой в обеих темах — проверка СМЫСЛ."],
    "tokens": ["dk-uptime"],
    "code_intro": "Контейнер пустой; данные — массив строк.",
    "code": """<div id="uptime"></div>

<script>
var u = dkUptime(document.getElementById('uptime'), {
  step: '30 минут',
  labels: ['24 ч назад', 'сейчас'],
  rows: [
    { name: 'Приём заявок', data: ['up', 'up', 'down', 'up', 'none'] }
  ]
});
u.setRows(newRows);
</script>""",
    "api": [("rows[]", "массив {name, data[]}", "Состояния делений: 'up', 'down', 'none'."),
            ("step", "строка", "Подпись шага для подсказки."),
            ("labels", "массив из двух строк", "Края оси."),
            ("setRows(list)", "метод", "Обновить данные.")],
    "related": [("component-list.html", "Полосы", "доля, а не время"),
                ("component-banner.html", "Баннер", "если служба не отвечает сутки — это баннер страницы"),
                ("dashboard.html", "Сводка", "полоса в живом дашборде")],
    "live_script_extra": "",
},
]

# Состояния для страницы доступности: вторая полоса с неизвестным состоянием.
PAGES[-1]["live_script"] += """
  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkUptime !== 'function') return;
    dkUptime(document.getElementById('x-uptime-states'), { step: '1 час', labels: ['12 ч назад', 'сейчас'], rows: [
      { name: 'Всё работает', data: ['up','up','up','up','up','up','up','up','up','up','up','up'] },
      { name: 'Сбой сейчас', data: ['up','up','up','up','up','up','up','up','up','up','down','down'] },
      { name: 'Неизвестное состояние', data: ['up','up','up','что-то','up','up','none','none','none','none','none','none'] }] });
  });"""

PAGES.append({'slug': 'avatar',
 'title': 'Аватар',
 'group': 'Данные',
 'status': 'стабильный',
 'purpose': 'Человек рядом с записью, комментарием или списком участников.',
 'files': ['css/components.css'],
 'scripts': [],
 'live_intro': 'Примеры в реальном контексте.',
 'live': '<div class="dk-panel"><div class="dk-stack"><div class="dk-inline"><span class="dk-avatar '
         'dk-avatar--sm" role="img" aria-label="Анна Кузнецова">АК</span><span class="dk-avatar" role="img" '
         'aria-label="Анна Кузнецова">АК</span><span class="dk-avatar dk-avatar--lg" role="img" '
         'aria-label="Анна Кузнецова">АК</span><span>Анна Кузнецова</span></div><div class="dk-inline"><span '
         'class="dk-avatars"><span class="dk-avatar" role="img" aria-label="Анна Кузнецова">АК</span><span '
         'class="dk-avatar" role="img" aria-label="Борис Михайлов">БМ</span><span class="dk-avatar '
         'dk-avatar--more" role="img" aria-label="Ещё 4 '
         'участника">+4</span></span><span>Участники</span></div></div></div>',
 'when_yes': ['Человек рядом с записью, комментарием или списком участников.'],
 'when_no': ['Главное число дашборда — KPI-плитка.', 'Состояние объекта — статус с текстовой подписью.'],
 'anatomy_html': '<span class="dk-avatar" role="img" aria-label="Анна Кузнецова">АК</span>',
 'anatomy': [('Содержимое', 'Подпись и значение доступны без цвета.'),
             ('Контекст', 'Находится рядом с объектом, к которому относится.')],
 'sizes': 'S — 24, M — 32, L — 40 пикселей. Размер изображения не определяет размер кнопки: интерактивная '
          'область на сенсорном экране минимум 44 пикселя.',
 'variants': [('dk-avatar', 'Инициалы или изображение.', 'Человек.'),
              ('dk-avatar--sm / --lg', '24 / 40 пикселей.', 'Плотная строка / профиль.'),
              ('dk-avatars', 'Перекрывающаяся группа.', 'Несколько участников.')],
 'states': '<div class="dk-panel"><div class="dk-inline"><span class="dk-avatar dk-avatar--sm" role="img" '
           'aria-label="Анна Кузнецова">АК</span><span class="dk-avatar" role="img" aria-label="Анна '
           'Кузнецова">АК</span><span class="dk-avatar dk-avatar--lg" role="img" aria-label="Анна '
           'Кузнецова">АК</span><span>Анна Кузнецова</span></div><div class="dk-inline"><span '
           'class="dk-avatars"><span class="dk-avatar" role="img" aria-label="Анна Кузнецова">АК</span><span '
           'class="dk-avatar" role="img" aria-label="Борис Михайлов">БМ</span><span class="dk-avatar '
           'dk-avatar--more" role="img" aria-label="Ещё 4 '
           'участника">+4</span></span><span>Участники</span></div></div>',
 'content_ok': ['Полные названия людей, объектов и значений.',
                'Числа соответствуют данным; тестовые примеры не являются результатами продукта.'],
 'content_bad': ['Цвет без подписи и значения.', 'Непонятное число или инициалы без имени.'],
 'a11y': ['Полное имя доступно скринридеру: role="img" и aria-label для инициалов, alt для изображения.',
          'Рядом есть имя — изображение декоративное, используйте alt=""; инициалы скрывайте '
          'aria-hidden="true".',
          'При недоступной фотографии приложение заменяет её инициалами. Не оставляйте сломанное '
          'изображение.'],
 'tokens': ['dk-avatar', 'dk-avatars'],
 'code_intro': 'HTML и общие стили кита. Изменение данных выполняет приложение.',
 'code': '<span class="dk-avatar" role="img" aria-label="Анна Кузнецова">АК</span>',
 'api': [('dk-avatar', 'класс', 'Инициалы или изображение.'),
         ('dk-avatar--sm / --lg', 'класс', '24 / 40 пикселей.'),
         ('dk-avatars', 'класс', 'Перекрывающаяся группа.')],
 'related': [('component-badge.html', 'Бейдж и статус', 'состояние объекта'),
             ('component-chips-input.html', 'ChipsInput', 'ввод набора'),
             ('component-chips-select.html', 'ChipsSelect', 'выбор набора')]})

PAGES.append({'slug': 'counter',
 'title': 'Счётчик',
 'group': 'Данные',
 'status': 'стабильный',
 'purpose': 'Количество объектов внутри кнопки, вкладки или строки меню.',
 'files': ['css/components.css'],
 'scripts': [],
 'live_intro': 'Примеры в реальном контексте.',
 'live': '<div class="dk-panel"><div class="dk-stack"><div class="dk-inline"><button class="dk-btn '
         'dk-btn--sm">Сообщения <span class="dk-counter">12</span></button><span class="dk-counter '
         'dk-counter--sm" aria-label="3 новых сообщения">3</span><span class="dk-counter dk-counter--brand" '
         'aria-label="12 новых сообщений">12</span><span class="dk-counter dk-counter--crit" aria-label="125 '
         'ошибок">99+</span></div></div></div>',
 'when_yes': ['Количество объектов внутри кнопки, вкладки или строки меню.'],
 'when_no': ['Главное число дашборда — KPI-плитка.', 'Состояние объекта — статус с текстовой подписью.'],
 'anatomy_html': '<button class="dk-btn dk-btn--sm">Сообщения <span class="dk-counter">12</span></button>',
 'anatomy': [('Содержимое', 'Подпись и значение доступны без цвета.'),
             ('Контекст', 'Находится рядом с объектом, к которому относится.')],
 'sizes': 'S — 16, M — 20 пикселей по высоте. Ширина растёт с числом; счётчик не является отдельной кнопкой.',
 'variants': [('dk-counter', 'Нейтральная заливка.', 'Количество объектов.'),
              ('dk-counter--sm', 'Меньший размер.', 'Компактный контекст.'),
              ('dk-counter--brand', 'Акцентная заливка.', 'Новые объекты.'),
              ('dk-counter--crit', 'Критическое состояние.', 'Число ошибок.'),
              ('dk-counter--plain', 'Без заливки, цвет контекста.', 'Внутри акцентной кнопки.')],
 'states': '<div class="dk-panel"><div class="dk-inline"><button class="dk-btn dk-btn--sm">Сообщения <span '
           'class="dk-counter">12</span></button><span class="dk-counter dk-counter--sm" aria-label="3 новых '
           'сообщения">3</span><span class="dk-counter dk-counter--brand" aria-label="12 новых '
           'сообщений">12</span><span class="dk-counter dk-counter--crit" aria-label="125 '
           'ошибок">99+</span></div></div>',
 'content_ok': ['Полные названия людей, объектов и значений.',
                'Числа соответствуют данным; тестовые примеры не являются результатами продукта.'],
 'content_bad': ['Цвет без подписи и значения.', 'Непонятное число или инициалы без имени.'],
 'a11y': ['Внутри подписанной кнопки число входит в её доступное имя.',
          'Для 99+ укажите точное число и объект в aria-label.',
          'Ноль показывайте только если отсутствие объектов важно для решения; скрытие счётчика не должно '
          'менять размер кнопки.'],
 'tokens': ['dk-counter'],
 'code_intro': 'HTML и общие стили кита. Изменение данных выполняет приложение.',
 'code': '<button class="dk-btn dk-btn--sm">Сообщения <span class="dk-counter">12</span></button>',
 'api': [('dk-counter', 'класс', 'Нейтральная заливка.'),
         ('dk-counter--sm', 'класс', 'Меньший размер.'),
         ('dk-counter--brand', 'класс', 'Акцентная заливка.'),
         ('dk-counter--crit', 'класс', 'Критическое состояние.'),
         ('dk-counter--plain', 'класс', 'Без заливки, цвет контекста.')],
 'related': [('component-badge.html', 'Бейдж и статус', 'состояние объекта'),
             ('component-chips-input.html', 'ChipsInput', 'ввод набора'),
             ('component-chips-select.html', 'ChipsSelect', 'выбор набора')]})

PAGES.append({'slug': 'chip',
 'title': 'Чип',
 'group': 'Данные',
 'status': 'стабильный',
 'purpose': 'Отдельное выбранное значение: метка или применённый фильтр. Можно удалить из набора.',
 'files': ['css/components.css'],
 'scripts': [],
 'live_intro': 'Примеры в реальном контексте.',
 'live': '<div class="dk-panel"><div class="dk-stack"><div class="dk-inline" id="x-chip-demo"><span '
         'class="dk-fchip">Email<button type="button" class="dk-fchip__x" aria-label="Убрать фильтр '
         'Email">×</button></span><span class="dk-fchip">В работе<button type="button" class="dk-fchip__x" '
         'aria-label="Убрать фильтр В работе">×</button></span><span class="dk-fchip">Без '
         'удаления</span></div><p class="dk-hint" id="x-chip-status" role="status"></p></div></div>',
 'when_yes': ['Отдельное выбранное значение: метка или применённый фильтр. Можно удалить из набора.'],
 'when_no': ['Главное число дашборда — KPI-плитка.', 'Состояние объекта — статус с текстовой подписью.'],
 'anatomy_html': '<span class="dk-fchip">Email<button type="button" class="dk-fchip__x" aria-label="Убрать '
                 'фильтр Email">×</button></span>',
 'anatomy': [('Содержимое', 'Подпись и значение доступны без цвета.'),
             ('Контекст', 'Находится рядом с объектом, к которому относится.')],
 'sizes': 'Используйте размер существующего чипа-фильтра. Сенсорная область удаления расширяется до 44 '
          'пикселей; сохраняйте расстояние между целями.',
 'variants': [('dk-fchip', 'Значение с необязательным удалением.', 'Применённый фильтр.'),
              ('dk-chipbar', 'Строка применённых фильтров.', 'Набор значений.'),
              ('dk-chip', 'Число с подписью.', 'Состав сводки, а не выбранное значение.')],
 'states': '<div class="dk-panel"><span class="dk-fchip">Без удаления</span></div>',
 'content_ok': ['Полные названия людей, объектов и значений.',
                'Числа соответствуют данным; тестовые примеры не являются результатами продукта.'],
 'content_bad': ['Цвет без подписи и значения.', 'Непонятное число или инициалы без имени.'],
 'a11y': ['Удаление — настоящая кнопка с именем «Убрать фильтр Email», работает Enter и пробелом.',
          'После удаления фокус переходит на следующую кнопку удаления или контейнер набора.',
          'Для ввода или выбора набора используйте ChipsInput / ChipsSelect, где поведение уже реализовано.'],
 'tokens': ['dk-fchip', 'dk-chipbar'],
 'code_intro': 'HTML и общие стили кита. Изменение данных выполняет приложение.',
 'code': '<span class="dk-fchip">Email<button type="button" class="dk-fchip__x" aria-label="Убрать фильтр '
         'Email">×</button></span>',
 'api': [('dk-fchip', 'класс', 'Значение с необязательным удалением.'),
         ('dk-chipbar', 'класс', 'Строка применённых фильтров.'),
         ('dk-chip', 'класс', 'Число с подписью.')],
 'related': [('component-badge.html', 'Бейдж и статус', 'состояние объекта'),
             ('component-chips-input.html', 'ChipsInput', 'ввод набора'),
             ('component-chips-select.html', 'ChipsSelect', 'выбор набора')],
 'live_script': "document.getElementById('x-chip-demo').addEventListener('click', function(event) {\n"
         "  var button = event.target.closest('.dk-fchip__x');\n"
         '  if (!button) return;\n'
         "  var group = button.closest('.dk-inline');\n"
         "  var label = button.getAttribute('aria-label');\n"
         '  button.parentElement.remove();\n'
         "  var next = group.querySelector('button');\n"
         "  if (next) next.focus(); else { group.setAttribute('tabindex', '-1'); group.focus(); }\n"
         "  document.getElementById('x-chip-status').textContent = label + ': фильтр снят';\n"
         '});'})

PAGES.append({'slug': 'accordion',
 'title': 'Аккордеон',
 'group': 'Данные',
 'status': 'стабильный',
 'purpose': 'Раскрывает подробности по запросу: определения метрик, настройки и ответы на вопросы.',
 'files': ['css/components.css'],
 'scripts': [],
 'live_intro': 'Два независимых раздела. Можно раскрыть оба; Enter и пробел работают без JavaScript.',
 'live': '<div class="dk-panel"><div class="dk-stack"><details class="dk-fold "><summary '
         'class="dk-fold__head"><span class="dk-fold__title">Как считается конверсия?</span><svg class="dk-i '
         'dk-i--sm" aria-hidden="true"><use href="#ti-chevron-down"/></svg></summary><div '
         'class="dk-fold__body">Число заказов / число посещений × 100%.</div></details><details '
         'class="dk-fold "><summary class="dk-fold__head"><span class="dk-fold__title">Какие заказы входят в '
         'выручку?</span><svg class="dk-i dk-i--sm" aria-hidden="true"><use '
         'href="#ti-chevron-down"/></svg></summary><div class="dk-fold__body">Оплаченные заказы за выбранный '
         'период.</div></details></div></div>',
 'when_yes': ['Дополнительные сведения, которые не нужны при первом просмотре.',
              'Несколько самостоятельных вопросов или групп настроек.'],
 'when_no': ['Ключевые показатели и ошибки должны быть видны сразу.',
             'Переход между страницами — навигация, а не аккордеон.'],
 'anatomy_html': '<details class="dk-fold "><summary class="dk-fold__head"><span class="dk-fold__title">Как '
                 'считается конверсия?</span><svg class="dk-i dk-i--sm" aria-hidden="true"><use '
                 'href="#ti-chevron-down"/></svg></summary><div class="dk-fold__body">Число заказов / число '
                 'посещений × 100%.</div></details>',
 'anatomy': [('summary', 'Весь заголовок — одна цель раскрытия.'),
             ('Стрелка', 'Поворачивается при раскрытии; декоративна для скринридера.'),
             ('Содержимое', 'Находится внутри details, скрывается браузером.')],
 'sizes': 'Заголовок минимум 44 пикселя по высоте. Содержимое определяет высоту открытого блока.',
 'variants': [('dk-fold', 'На нейтральной поверхности.', 'Самостоятельный блок.'),
              ('dk-fold--plain', 'Без заливки.', 'Раздел внутри страницы.'),
              ('details name="metric-definitions"',
               'Одинаковое name у соседних details.',
               'Только один раздел открыт одновременно в современных браузерах.')],
 'states': '<div class="dk-panel"><details open class="dk-fold "><summary class="dk-fold__head"><span '
           'class="dk-fold__title">Как считается конверсия?</span><svg class="dk-i dk-i--sm" '
           'aria-hidden="true"><use href="#ti-chevron-down"/></svg></summary><div '
           'class="dk-fold__body">Число заказов / число посещений × 100%.</div></details><details '
           'class="dk-fold "><summary class="dk-fold__head"><span class="dk-fold__title">Закрытый '
           'раздел</span><svg class="dk-i dk-i--sm" aria-hidden="true"><use '
           'href="#ti-chevron-down"/></svg></summary><div '
           'class="dk-fold__body">Подробности.</div></details></div>',
 'content_ok': ['Заголовок называет содержимое: «Как считается конверсия?».',
                'Краткий ответ без повторения заголовка.'],
 'content_bad': ['Заголовок «Подробнее» у всех разделов.',
                 'Кнопка или ссылка внутри summary; разместите действия в раскрываемой части.'],
 'a11y': ['Нативные details/summary обеспечивают клавиатуру и состояние раскрытия; не добавляйте им '
          'role="button".',
          'Не ставьте aria-hidden на содержимое вручную: браузер управляет доступностью скрытой части.',
          'Фокус остаётся на summary при раскрытии и закрытии.'],
 'tokens': ['dk-fold'],
 'code_intro': 'Нативный HTML без отдельного скрипта. Атрибут open раскрывает блок по умолчанию.',
 'code': '<details class="dk-fold "><summary class="dk-fold__head"><span class="dk-fold__title">Как '
         'считается конверсия?</span><svg class="dk-i dk-i--sm" aria-hidden="true"><use '
         'href="#ti-chevron-down"/></svg></summary><div class="dk-fold__body">Число заказов / число '
         'посещений × 100%.</div></details>',
 'api': [('open', 'HTML-атрибут', 'Раздел открыт.'),
         ('name', 'HTML-атрибут', 'Общее имя для группы с одним открытым разделом.'),
         ('dk-fold--plain', 'класс', 'Вариант без заливки.')],
 'related': [('component-list.html', 'Список', 'Постоянно видимые строки'),
             ('component-banner.html', 'Баннер', 'Важные сообщения показываются сразу')]})

for _page in PAGES:
    if _page['slug'] == 'chip':
        _page['code'] = _page['live'] + '\n<script>\n' + _page['live_script'] + '\n</script>'
    if _page['slug'] == 'accordion':
        _page['anatomy_html'] = _page['anatomy_html'].replace('Как считается конверсия?', '<b class="sc-callout">1</b> Как считается конверсия?').replace('<svg ', '<b class="sc-callout">2</b><svg ', 1).replace('Число заказов /', '<b class="sc-callout">3</b> Число заказов /').replace('<details ', '<details open ', 1)

for _page in PAGES:
    if _page['slug'] == 'counter':
        _page['live'] = '<div class="dk-panel"><div class="dk-stack"><div class="dk-inline"><button class="dk-btn dk-btn--sm">Сообщения <span class="dk-counter">12</span></button><button class="dk-btn dk-btn--sm dk-btn--primary">Обработать <span class="dk-counter">8</span></button></div><div class="dk-inline"><span class="dk-counter dk-counter--sm" aria-label="3 сообщения">3</span><span class="dk-counter" aria-label="12 сообщений">12</span><span class="dk-counter dk-counter--crit" aria-label="125 ошибок">99+</span><span>Нейтральный · обычный · ошибка</span></div></div></div>'
        _page['states'] = '<div class="dk-panel"><div class="dk-inline"><span>Пусто</span><span class="dk-counter">0</span><span>Один объект</span><span class="dk-counter">1</span><span>Большое количество</span><span class="dk-counter" aria-label="125 объектов">99+</span></div></div>'
        _page['content_ok'] = ['Только число: 12; для больших значений — 99+ с точным доступным именем.', 'Название объекта находится рядом: «Сообщения 12».']
        _page['content_bad'] = ['Слово «новое» внутри счётчика — это бейдж.', 'Цвет ошибки для обычного количества объектов.']
        _page['variants'].append(('Внутри dk-btn--primary', 'Автоматическая контрастная заливка.', 'Основная кнопка.'))
    if _page['slug'] == 'chip':
        _page['live'] = _page['live'].replace('>×</button>', '><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button>')
        _page['states'] = '<div class="dk-panel"><div class="dk-inline"><span class="dk-fchip">Только чтение</span><span class="dk-fchip dk-fchip--secondary">Второстепенная метка</span><span class="dk-fchip">Недоступно<button class="dk-fchip__x" disabled aria-label="Убрать метку Недоступно"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button></span></div></div>'
        _page['variants'].append(('dk-fchip--secondary', 'Менее выраженная поверхность.', 'Второстепенное значение.'))
        _page['api'].append(('disabled', 'HTML-атрибут кнопки', 'Удаление недоступно; без ложного клика.'))
        _page['code'] = _page['live'] + '\n<script>\n' + _page['live_script'] + '\n</script>'
    if _page['slug'] == 'avatar':
        _page['content_ok'] = ['Не более двух инициалов; полное имя рядом или в доступной подписи.', 'Изображение обрезается по контейнеру с object-fit:cover, без искажения пропорций.']
        _page['content_bad'] = ['Случайный цвет аватара, который выглядит как статус риска.', 'Инициалы из пяти букв или фотография без доступного имени.']

for _page in PAGES:
    if _page['slug'] == 'chip':
        _page['content_ok'] = ['Одно выбранное значение: «Email» или «В работе».', 'Подпись удаления включает значение чипа.']
        _page['content_bad'] = ['Обрезанное название, которое нельзя восстановить.', 'Чип выглядит как выбранный фильтр, но не влияет на данные.']
