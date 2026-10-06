# Управление: кнопки, сегмент, вкладки, флажки, поле и форма.
# Каждая страница — словарь; поля обязательны, пустых блоков не бывает.

CHECK = ('<label class="dk-check"><input type="checkbox"{a}><span class="dk-check__box">'
         '<svg class="dk-i"><use href="#ti-check"/></svg></span>{t}</label>')

PAGES = [
{
    "slug": "button", "title": "Кнопка", "group": "Управление", "status": "стабильный",
    "purpose": "Запустить действие: сохранить, назначить бригаду, открыть отчёт. На экране одна основная "
               "кнопка, остальные обычные или тихие — так видно, чего от человека ждут.",
    "files": ["css/components.css"], "scripts": [],
    "live_intro": "Три размера, четыре вида и кнопка-значок. Пройдите табом — кольцо фокуса появляется "
                  "только при работе с клавиатуры.",
    "live": """<div class="dk-panel">
      <div class="sc-row"><span class="dk-caption" style="width:96px">S · 28</span>
        <button class="dk-btn dk-btn--primary dk-btn--sm">Действие</button>
        <button class="dk-btn dk-btn--sm">Обычная</button>
        <button class="dk-btn dk-btn--ghost dk-btn--sm">Тихая</button>
        <button class="dk-iconbtn dk-iconbtn--sm" title="Настройки" aria-label="Настройки"><svg class="dk-i"><use href="#ti-settings"/></svg></button></div>
      <div class="sc-row"><span class="dk-caption" style="width:96px">M · 32</span>
        <button class="dk-btn dk-btn--primary">Действие</button>
        <button class="dk-btn">Обычная</button>
        <button class="dk-btn dk-btn--ghost">Тихая</button>
        <button class="dk-iconbtn" title="Настройки" aria-label="Настройки"><svg class="dk-i"><use href="#ti-settings"/></svg></button></div>
      <div class="sc-row" style="margin-bottom:0"><span class="dk-caption" style="width:96px">L · 40</span>
        <button class="dk-btn dk-btn--primary dk-btn--lg">Действие</button>
        <button class="dk-btn dk-btn--lg">Обычная</button>
        <button class="dk-btn dk-btn--ghost dk-btn--lg">Тихая</button>
        <button class="dk-iconbtn dk-iconbtn--lg" title="Настройки" aria-label="Настройки"><svg class="dk-i"><use href="#ti-settings"/></svg></button></div>
    </div>""",
    "when_yes": ["Действие меняет данные или открывает новый экран: «Добавить работу», «Закрыть аварию».",
                 "На экране нужно показать, какое действие главное — оно одно и оно основное.",
                 "Действие повторяется в каждой строке таблицы — тогда кнопка-значок с подписью для скринридера."],
    "when_no": ["Переключение вида одних и тех же данных — <a href=\"component-segment.html\">Сегмент</a>.",
                "Переход в другой раздел с адресом — <a href=\"component-tabs.html\">Вкладки</a> или ссылка.",
                "Включить режим без подтверждения — <a href=\"component-check.html\">Тумблер</a>."],
    "anatomy_html": """<div class="sc-row" style="margin:0">
      <button class="dk-btn dk-btn--primary"><b class="sc-callout">1</b>Основное действие</button>
      <button class="dk-btn"><b class="sc-callout">2</b>Обычная</button>
      <button class="dk-btn dk-btn--ghost"><b class="sc-callout">3</b>Тихая</button>
      <button class="dk-btn" disabled><b class="sc-callout">4</b>Недоступна</button>
      <button class="dk-iconbtn" title="Отчёт" aria-label="Отчёт"><b class="sc-callout">5</b><svg class="dk-i"><use href="#ti-file-text"/></svg></button>
      <button class="dk-btn"><b class="sc-callout">6</b><svg class="dk-i"><use href="#ti-refresh"/></svg>Со значком</button>
    </div>""",
    "anatomy": [("Основная", "залита акцентом — единственное место на экране, где акцент разрешён управлению (третий принцип)."),
                ("Обычная", "залита поверхностью второго уровня; рамки нет — форму держит заливка."),
                ("Тихая", "без заливки до наведения; для действий, которые не должны спорить с данными: «Снять выбор»."),
                ("Недоступная", "приглушена, курсор «нельзя». Причину недоступности говорит подсказка или текст рядом, а не сама кнопка."),
                ("Кнопка-значок", "квадрат под один значок; подпись обязательна в <code>aria-label</code> и в <code>title</code>."),
                ("Значок в кнопке", "стоит слева от слова и берёт цвет текста; сам по себе значок кнопкой не бывает.")],
    "sizes": "Три размера — три высоты контролов кита: S 28, M 32, L 40. Размер выбирается по соседям в строке "
             "(поле, сегмент, фильтр одной высоты), а не по важности действия — важность показывает вид.",
    "variants": [("dk-btn", "Обычная кнопка, размер M.", "По умолчанию."),
                 ("dk-btn--primary", "Основное действие, заливка акцентом.", "Одна на экран или на форму."),
                 ("dk-btn--ghost", "Тихая: без заливки до наведения.", "Второстепенное рядом с основным: «Отмена», «Снять выбор»."),
                 ("dk-btn--sm / dk-btn--lg", "Высота 28 или 40 вместо 32.", "Строка действий в таблице (sm), шапка страницы (lg)."),
                 ("dk-iconbtn", "Квадратная кнопка под значок, те же три размера.", "Действия виджета: обновить, скачать, настройки."),
                 ("disabled", "Атрибут: приглушена, не нажимается.", "Только когда причина видна рядом.")],
    "states": """<div class="dk-panel"><div class="sc-row" style="margin:0">
      <button class="dk-btn dk-btn--primary">Обычное</button>
      <button class="dk-btn dk-btn--primary" style="background:var(--brand-hover)">Наведение</button>
      <button class="dk-btn dk-btn--primary" style="outline:var(--focus-width) solid var(--brand);outline-offset:var(--focus-offset)">Фокус</button>
      <button class="dk-btn dk-btn--primary" disabled>Недоступно</button>
      <button class="dk-btn dk-btn--primary" aria-busy="true"><svg class="dk-i"><use href="#ti-refresh"/></svg>Сохраняем…</button>
    </div></div>
    <div class="sc-note"><b>Загрузка — это надпись, а не крутилка.</b> «Сохраняем…» говорит, что происходит; кнопка при этом
      остаётся на месте и не меняет ширину, иначе соседние кнопки прыгают. Отдельного класса для загрузки нет:
      состояние задаёт текст и <code>aria-busy</code>.</div>""",
    "content_ok": ["Глагол в неопределённой форме: «Добавить работу», «Закрыть аварию».",
                   "Одна основная кнопка на форму; стоит справа, обычная «Отмена» — левее и тихая.",
                   "Подпись у кнопки-значка в <code>aria-label</code> совпадает с подсказкой.",
                   "Опасное действие называется своим именем: «Удалить срез», а не «ОК»."],
    "content_bad": ["«ОК», «Да», «Продолжить» — непонятно, что произойдёт.",
                    "Две основные кнопки рядом — человек не знает, какую ждут.",
                    "Значок без подписи: «шестерёнка» для одних настройки, для других фильтр.",
                    "Кнопка, которая ведёт на другую страницу, — это ссылка, и выглядеть должна ссылкой."],
    "a11y": ["<b>Клавиатура.</b> Настоящий <code>&lt;button&gt;</code>: Tab, Enter и пробел работают сами. Кольцо фокуса — только при навигации с клавиатуры.",
             "<b>Подписи.</b> Кнопка-значок обязана иметь <code>aria-label</code>; проверка на витрине это не ловит — на совести автора.",
             "<b>Контраст.</b> Подпись на основной кнопке и силуэт кнопки на поверхности проверяются проверкой КНОПКА на всех акцентах в обеих темах.",
             "<b>Недоступная</b> нативная кнопка с <code>disabled</code> пропускается при Tab; причина видна рядом и доступна при чтении страницы."],
    "tokens": ["dk-btn", "dk-iconbtn"],
    "code_intro": "Обычные кнопки без скрипта. Ссылка с классом кнопки допустима, когда действие — переход.",
    "code": """<button class="dk-btn dk-btn--primary">Добавить работу</button>
<button class="dk-btn dk-btn--ghost">Отмена</button>
<button class="dk-iconbtn" title="Обновить" aria-label="Обновить">
  <svg class="dk-i"><use href="#ti-refresh"/></svg>
</button>
<a class="dk-btn dk-btn--sm" href="component-table.html">Страница компонента →</a>""",
    "api": [("dk-btn--primary", "класс", "Основное действие, одно на экран."),
            ("dk-btn--ghost", "класс", "Тихая кнопка без заливки."),
            ("dk-btn--sm, dk-btn--lg", "класс", "Высота 28 или 40; по умолчанию 32."),
            ("dk-iconbtn", "класс", "Кнопка под значок; те же модификаторы размера."),
            ("aria-busy", "атрибут", "Пока идёт действие; подпись меняется на «…аем»."),
            ("disabled", "атрибут", "Недоступна; причина должна быть видна рядом.")],
    "related": [("component-segment.html", "Сегмент", "переключение вида, а не действие"),
                ("component-tabs.html", "Вкладки", "переход между разделами"),
                ("component-modal.html", "Модальное окно", "подтверждение опасного действия"),
                ("showcase.html#upravlenie", "Витрина: управление", "все контролы в одной строке")],
},
{
    "slug": "segment", "title": "Сегмент", "group": "Управление", "status": "стабильный",
    "purpose": "Переключить вид одних и тех же данных: карта или плитки, 7 или 30 дней, месяц или неделя. "
               "Срабатывает сразу, живёт внутри виджета, выбранное показано серым — цвет на дашборде принадлежит данным.",
    "files": ["css/components.css"], "scripts": [],
    "live_intro": "Три размера, со значками и без. Выбранное — заливкой и жирностью, а не акцентом.",
    "live": """<div class="dk-panel">
      <div class="sc-row"><span class="dk-caption" style="width:96px">S · 28</span>
        <div class="dk-seg dk-seg--sm" role="group" aria-label="Период"><button type="button" aria-pressed="true">7д</button><button type="button" aria-pressed="false">30д</button><button type="button" aria-pressed="false">Год</button></div></div>
      <div class="sc-row"><span class="dk-caption" style="width:96px">M · 32</span>
        <div class="dk-seg" role="group" aria-label="Период"><button type="button" aria-pressed="true">7 дней</button><button type="button" aria-pressed="false">30 дней</button><button type="button" aria-pressed="false">Год</button></div></div>
      <div class="sc-row"><span class="dk-caption" style="width:96px">L · 40</span>
        <div class="dk-seg dk-seg--lg" role="group" aria-label="Период"><button type="button" aria-pressed="true">7 дней</button><button type="button" aria-pressed="false">30 дней</button></div></div>
      <div class="sc-row" style="margin-bottom:0"><span class="dk-caption" style="width:96px">со значками</span>
        <div class="dk-seg" role="group" aria-label="Вид"><button type="button" aria-pressed="true"><svg class="dk-i"><use href="#ti-map"/></svg>Карта</button><button type="button" aria-pressed="false"><svg class="dk-i"><use href="#ti-layout-grid"/></svg>Плитки</button><button type="button" aria-pressed="false"><svg class="dk-i"><use href="#ti-table"/></svg>Таблица</button></div>
        <div class="dk-seg dk-seg--icons" role="group" aria-label="Вид"><button type="button" aria-pressed="true" title="Карта" aria-label="Карта"><svg class="dk-i dk-i--sm"><use href="#ti-map"/></svg></button><button type="button" aria-pressed="false" title="Плитки" aria-label="Плитки"><svg class="dk-i dk-i--sm"><use href="#ti-layout-grid"/></svg></button></div></div>
    </div>""",
    "live_script": """  document.querySelectorAll('.dk-seg:not([aria-label="Тема"]) button').forEach(function (b) {
    b.addEventListener('click', function () {
      b.closest('.dk-seg').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });""",
    "when_yes": ["Два–пять вариантов одного и того же: вид, период, единица измерения.",
                 "Переключение мгновенное и без загрузки страницы.",
                 "Все варианты должны быть видны сразу — выбор из скрытого списка здесь хуже."],
    "when_no": ["Переход в другой раздел со своим адресом — <a href=\"component-tabs.html\">Вкладки</a>.",
                "Больше пяти вариантов — <a href=\"component-select.html\">Фильтр</a> с выпадающим списком.",
                "Независимое «да / нет» — <a href=\"component-check.html\">Флажок или тумблер</a>."],
    "anatomy_html": """<div class="sc-row" style="margin:0"><div class="dk-seg" role="group" aria-label="Вид"><b class="sc-callout">1</b>
      <button type="button" aria-pressed="true"><b class="sc-callout">2</b><svg class="dk-i"><use href="#ti-map"/></svg>Карта</button>
      <button type="button" aria-pressed="false"><b class="sc-callout">3</b>Плитки</button></div></div>""",
    "anatomy": [("Контейнер", "<code>role=\"group\"</code> с <code>aria-label</code>: скринридер слышит «группа Вид», а не «вкладки», и не ждёт новой загрузки."),
                ("Выбранная кнопка", "<code>aria-pressed=\"true\"</code>: серая заливка <code>--control-on</code>, подпись жирнее. Контраст к контейнеру 3,44:1 (проверка ТИШИНА)."),
                ("Обычная кнопка", "прозрачная, при наведении темнеет подпись.")],
    "sizes": "Три высоты, как у кнопок: S 28, M 32, L 40. Сегмент стоит в одной строке с полем или фильтром — "
             "и берёт их размер.",
    "variants": [("dk-seg", "Сегмент размера M.", "По умолчанию."),
                 ("dk-seg--sm / dk-seg--lg", "Высота 28 или 40.", "Шапка виджета (sm), панель страницы (lg)."),
                 ("dk-seg--icons", "Кнопки только со значками, квадратные.", "Когда слов не хватает по ширине; подпись — в aria-label и title."),
                 ("aria-pressed=\"true\"", "Атрибут выбранной кнопки.", "Ровно у одной кнопки группы.")],
    "states": """<div class="dk-panel"><div class="sc-row" style="margin:0">
      <div class="dk-seg" role="group" aria-label="Пример"><button type="button" aria-pressed="true">Выбрано</button><button type="button" aria-pressed="false">Обычное</button><button type="button" aria-pressed="false" style="outline:var(--focus-width) solid var(--brand);outline-offset:var(--focus-offset)">Фокус</button><button type="button" aria-pressed="false" disabled>Недоступно</button></div>
    </div></div>
    <div class="sc-note"><b>Состояния «загрузка» у сегмента нет.</b> Переключение обязано быть мгновенным; если данные для другого вида грузятся, грузится виджет (скелетон), а не кнопка.</div>""",
    "content_ok": ["Короткие подписи одной формы: «Карта / Плитки», «7 дней / 30 дней».",
                   "Первым стоит вид по умолчанию, и он же выбран при открытии.",
                   "Значок и слово вместе; только значки — когда у группы есть aria-label."],
    "content_bad": ["«Показать карту / Показать плитки» — глаголы у сегмента лишние.",
                    "Пустая группа без выбранного: человек не знает, что он смотрит сейчас.",
                    "Сегмент, который ведёт на другую страницу, — это вкладки под чужим видом."],
    "a11y": ["<b>Роль.</b> <code>role=\"group\"</code> + <code>aria-label</code>, кнопки с <code>aria-pressed</code>. Не <code>tablist</code>: вкладки обещают отдельные панели с адресом.",
             "<b>Клавиатура.</b> Tab ходит по кнопкам, Enter и пробел переключают. Стрелки внутри группы кит не перехватывает — это обычные кнопки.",
             "<b>Контраст.</b> Выбранная кнопка к контейнеру не ниже 3:1 в обеих темах и не ярче самой контрастной серии — проверка ТИШИНА.",
             "<b>Не только цветом.</b> Выбранное отличается ещё и жирностью подписи."],
    "tokens": ["dk-seg"],
    "code_intro": "Логику переключения задаёт страница: сегмент не знает, что значит «Карта». Ниже — минимальный обработчик.",
    "code": """<div class="dk-seg" role="group" aria-label="Вид данных">
  <button type="button" data-view="map" aria-pressed="true">Карта</button>
  <button type="button" data-view="tiles" aria-pressed="false">Плитки</button>
</div>

<script>
seg.addEventListener('click', function (e) {
  var b = e.target.closest('button[data-view]');
  if (!b) return;
  seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
  map.view = b.dataset.view;   // например, dkMap
});
</script>""",
    "api": [("aria-pressed", "атрибут", "«true» у выбранной кнопки; страница переключает сама."),
            ("dk-seg--sm, dk-seg--lg", "класс", "Размер группы."),
            ("dk-seg--icons", "класс", "Квадратные кнопки под значки."),
            ("disabled", "атрибут кнопки", "Вариант недоступен — например, нет данных для плиток.")],
    "related": [("component-tabs.html", "Вкладки", "когда варианты — это разделы с адресом"),
                ("component-map.html", "Регионы", "сегмент «карта / плитки» внутри виджета"),
                ("component-button.html", "Кнопка", "те же размеры и кольцо фокуса")],
},
{
    "slug": "tabs", "title": "Вкладки", "group": "Управление", "status": "стабильный",
    "purpose": "Перевести человека в другой раздел: у вкладки свой адрес и своя загрузка. "
               "Счётчик рядом с названием говорит, сколько там ждёт внимания.",
    "files": ["css/components.css"], "scripts": [],
    "live_intro": "Пять разделов мониторинга; текущий отмечен чертой и цветом.",
    "live": """<div class="dk-panel"><nav class="dk-tabs" aria-label="Разделы мониторинга">
      <a class="dk-tab" href="#" aria-current="page">Инфраструктура</a>
      <a class="dk-tab" href="#">Аварии <span class="dk-tab__n">23</span></a>
      <a class="dk-tab" href="#">Заявки <span class="dk-tab__n">7</span></a>
      <a class="dk-tab" href="#">Бригады</a>
      <a class="dk-tab" href="#">Отчёты</a>
    </nav></div>""",
    "when_yes": ["Разделы одного уровня, у каждого свой адрес: «Аварии», «Заявки», «Бригады».",
                 "При переходе меняется вся страница или её основная часть.",
                 "Разделов от двух до шести — больше не помещается в строку на узком экране."],
    "when_no": ["Переключение вида одних данных внутри виджета — <a href=\"component-segment.html\">Сегмент</a>.",
                "Больше шести разделов — боковое меню каркаса (<code>css/chrome.css</code>).",
                "Действие, а не переход — <a href=\"component-button.html\">Кнопка</a>."],
    "anatomy_html": """<nav class="dk-tabs" aria-label="Пример">
      <a class="dk-tab" href="#" aria-current="page"><b class="sc-callout">1</b>Текущий</a>
      <a class="dk-tab" href="#"><b class="sc-callout">2</b>Аварии <span class="dk-tab__n"><b class="sc-callout">3</b>23</span></a>
      <a class="dk-tab" href="#">Отчёты</a>
    </nav>""",
    "anatomy": [("Текущая вкладка", "<code>aria-current=\"page\"</code>: цвет текста ink, жирность и черта снизу цветом <code>--control-on</code> — двумя признаками, не одним."),
                ("Обычная вкладка", "ссылка <code>&lt;a&gt;</code> с адресом; при наведении подпись темнеет."),
                ("Счётчик", "<code>dk-tab__n</code>: сколько объектов в разделе ждут внимания. Ноль не показывается.")],
    "sizes": "Размер один: строка вкладок стоит под заголовком страницы и не бывает мельче текста. На узком экране "
             "строка листается вбок, вкладки не переносятся и не прячутся — спрятанная вкладка выглядит как "
             "отсутствующий раздел.",
    "variants": [("dk-tabs", "Строка вкладок, <code>&lt;nav&gt;</code> с aria-label.", "Всегда."),
                 ("dk-tab", "Вкладка-ссылка.", "На каждый раздел."),
                 ("aria-current=\"page\"", "Текущий раздел.", "Ровно у одной вкладки."),
                 ("dk-tab__n", "Счётчик в вкладке.", "Когда в разделе есть что-то, требующее внимания.")],
    "states": """<div class="dk-panel"><nav class="dk-tabs" aria-label="Состояния">
      <a class="dk-tab" href="#" aria-current="page">Текущая</a>
      <a class="dk-tab" href="#">Обычная</a>
      <a class="dk-tab" href="#" style="outline:var(--focus-width) solid var(--brand);outline-offset:var(--focus-offset)">Фокус</a>
      <a class="dk-tab" href="#">С счётчиком <span class="dk-tab__n">7</span></a>
    </nav></div>
    <div class="sc-note"><b>Недоступных вкладок не бывает.</b> Раздел, в который нельзя попасть, не показывают; если доступа нет — показывают страницу «Нет доступа» (<a href="component-empty.html">Состояния</a>), а не серую вкладку.</div>""",
    "content_ok": ["Существительное во множественном числе: «Аварии», «Заявки», «Отчёты».",
                   "Счётчик — число объектов, требующих действия, а не всего объектов в разделе.",
                   "Порядок вкладок постоянный: люди запоминают положение, а не название."],
    "content_bad": ["Глаголы: «Смотреть аварии».",
                    "Счётчик «1 284» — это статистика, а не сигнал; ей место в разделе.",
                    "Вкладка «Ещё…» с выпадающим списком — значит, разделов слишком много для вкладок."],
    "a11y": ["<b>Роль.</b> <code>&lt;nav aria-label&gt;</code> со ссылками, а не <code>tablist</code>: это переходы между страницами, и скринридер должен ждать загрузку.",
             "<b>Текущая</b> — <code>aria-current=\"page\"</code>, скринридер объявляет «текущая страница».",
             "<b>Клавиатура.</b> Обычные ссылки: Tab и Enter. Кольцо фокуса — только при навигации табом.",
             "<b>Контраст.</b> Черта текущей вкладки — <code>--control-on</code>, тот же серый, что у выбранного управления: не ниже 3:1 к поверхности."],
    "tokens": ["dk-tabs", "dk-tab"],
    "code_intro": "Вкладки — ссылки. Текущую отмечает сервер или страница, скрипта у компонента нет.",
    "code": """<nav class="dk-tabs" aria-label="Разделы мониторинга">
  <a class="dk-tab" href="dashboard.html" aria-current="page">Сводка</a>
  <a class="dk-tab" href="accidents.html">Аварии <span class="dk-tab__n">23</span></a>
  <a class="dk-tab" href="calendar.html">Календарь</a>
</nav>""",
    "api": [("aria-current=\"page\"", "атрибут", "Текущий раздел."),
            ("dk-tab__n", "элемент", "Счётчик; не показывать при нуле."),
            ("aria-label", "атрибут nav", "Название группы разделов для скринридера.")],
    "related": [("component-segment.html", "Сегмент", "переключение вида внутри виджета"),
                ("component-badge.html", "Бейдж", "счётчик того же вида в других местах"),
                ("accidents.html", "Страница «Аварии»", "вкладки в живом дашборде")],
},
{
    "slug": "check", "title": "Флажок, радио, тумблер", "group": "Управление", "status": "стабильный",
    "purpose": "Три способа сказать «да»: флажок — независимое «да / нет» по кнопке, радио — один из немногих, "
               "тумблер — режим, который срабатывает сразу. Отмеченное показано серым, не акцентом.",
    "files": ["css/components.css"], "scripts": [],
    "live_intro": "Подпись всегда кликабельна: попасть в квадратик 18 пикселей тяжело, в строку с текстом — легко.",
    "live": """<div class="dk-grid"><div class="dk-col--half"><div class="dk-panel"><div class="dk-stack">
      """ + CHECK.format(a=" checked", t="Показывать события") + CHECK.format(a="", t="Только официальные источники") +
      CHECK.format(a=" disabled", t="Архив (недоступен)") +
      """<label class="dk-check"><input type="checkbox" checked><span class="dk-check__box dk-check__box--mixed"><svg class="dk-i"><use href="#ti-minus"/></svg></span>Выбрано не всё</label>
    </div></div></div>
    <div class="dk-col--half"><div class="dk-panel"><div class="dk-stack">
      <label class="dk-check dk-check--radio"><input type="radio" name="p" checked><span class="dk-check__box"></span>7 дней</label>
      <label class="dk-check dk-check--radio"><input type="radio" name="p"><span class="dk-check__box"></span>30 дней</label>
      <label class="dk-check dk-check--radio"><input type="radio" name="p"><span class="dk-check__box"></span>365 дней</label>
      <label class="dk-switch"><input type="checkbox" checked><span class="dk-switch__track"><span class="dk-switch__knob"></span></span>Слой событий</label>
      <label class="dk-switch"><input type="checkbox"><span class="dk-switch__track"><span class="dk-switch__knob"></span></span>Подписи на карте</label>
    </div></div></div></div>""",
    "when_yes": ["Флажок: несколько независимых «да / нет», которые применяются по кнопке — например, в форме.",
                 "Радио: один вариант из двух–пяти, все видны сразу.",
                 "Тумблер: режим, который включается сразу и сразу виден — «Слой событий» на карте."],
    "when_no": ["Больше пяти вариантов — <a href=\"component-select.html\">Фильтр</a>.",
                "Переключение вида — <a href=\"component-segment.html\">Сегмент</a>.",
                "Тумблер в форме, которую надо сохранять, — обман: человек переключил, ушёл, ничего не сохранилось. Там флажок."],
    "anatomy_html": """<div class="dk-stack">
      <label class="dk-check"><input type="checkbox" checked><b class="sc-callout">1</b><span class="dk-check__box"><svg class="dk-i"><use href="#ti-check"/></svg></span><b class="sc-callout">2</b>Подпись флажка</label>
      <label class="dk-check dk-check--radio"><input type="radio" name="an" checked><b class="sc-callout">3</b><span class="dk-check__box"></span>Радио</label>
      <label class="dk-switch"><input type="checkbox" checked><b class="sc-callout">4</b><span class="dk-switch__track"><span class="dk-switch__knob"></span></span><b class="sc-callout">5</b>Тумблер</label>
    </div>""",
    "anatomy": [("Настоящий input", "скрыт, но живой: клавиатура, формы и скринридер работают через него."),
                ("Квадрат с галочкой", "<code>dk-check__box</code>: пустой — поверхность третьего уровня, отмеченный — серый <code>--control-on</code> с галочкой. Отличие ещё и формой, не только заливкой."),
                ("Круг радио", "<code>dk-check--radio</code>: форма говорит «только одно»; точка внутри цветом подписи."),
                ("Дорожка тумблера", "<code>dk-switch__track</code>: включённый — серый, выключенный — поверхность."),
                ("Подпись", "часть <code>&lt;label&gt;</code>, поэтому кликабельна целиком.")],
    "sizes": "Размер один: квадрат 18, тумблер 36×18. Мельче — не попасть пальцем, крупнее — контрол спорит с текстом.",
    "variants": [("dk-check", "Флажок с подписью.", "Независимое да / нет."),
                 ("dk-check--radio", "Круглый переключатель.", "Один из двух–пяти вариантов; input type=radio с общим name."),
                 ("dk-check__box--mixed", "Частично отмечен, черта вместо галочки.", "«Выбрано не всё» в шапке списка; ставится скриптом."),
                 ("dk-switch", "Тумблер.", "Режим, срабатывает сразу."),
                 ("disabled", "Атрибут input.", "Причина недоступности видна рядом.")],
    "states": """<div class="dk-panel"><div class="sc-row" style="margin:0">
      """ + CHECK.format(a="", t="Пусто") + CHECK.format(a=" checked", t="Отмечено") +
      """<label class="dk-check"><input type="checkbox" checked><span class="dk-check__box dk-check__box--mixed"><svg class="dk-i"><use href="#ti-minus"/></svg></span>Частично</label>
      <label class="dk-check"><input type="checkbox"><span class="dk-check__box" style="outline:var(--focus-width) solid var(--brand);outline-offset:var(--focus-offset)"><svg class="dk-i"><use href="#ti-check"/></svg></span>Фокус</label>
      """ + CHECK.format(a=" disabled", t="Недоступно") + """
    </div></div>
    <div class="sc-note"><b>Частичное — не «ничего».</b> Черта в шапке списка значит «выбрана часть»; галочка означала бы «все», и это было бы неправдой.</div>""",
    "content_ok": ["Подпись — утверждение, которое становится правдой при отметке: «Показывать события».",
                   "У радио первый вариант — тот, что по умолчанию.",
                   "Недоступный вариант остаётся виден с пояснением: «Архив (недоступен)»."],
    "content_bad": ["Отрицание в подписи: «Не показывать события» — двойное отрицание при снятии.",
                    "Вопрос вместо утверждения: «Показывать события?».",
                    "Тумблер «Сохранить настройки» — тумблер ничего не сохраняет, он включает."],
    "a11y": ["<b>Настоящие input.</b> Флажок и радио — <code>&lt;input&gt;</code> внутри <code>&lt;label&gt;</code>: клавиатура, формы и скринридер бесплатно.",
             "<b>Тумблер</b> — тот же checkbox с другим видом; скринридер читает «флажок», и это честно: семантика та же.",
             "<b>Частичное состояние</b> ставится и в <code>input.indeterminate</code>, и классом — первое для скринридера, второе для глаза.",
             "<b>Контраст.</b> Отмеченный квадрат к поверхности 4,07:1 в тёмной и 5,04:1 в светлой теме; галочка на нём 4,79 / 5,04 (проверка ТИШИНА)."],
    "tokens": ["dk-check", "dk-switch"],
    "code_intro": "Обычная разметка форм; скрипт не нужен. Для «выбрать все» в таблице — <code>dkTable</code>.",
    "code": """<label class="dk-check">
  <input type="checkbox" name="events" checked>
  <span class="dk-check__box"><svg class="dk-i"><use href="#ti-check"/></svg></span>
  Показывать события
</label>

<label class="dk-check dk-check--radio">
  <input type="radio" name="period" value="7" checked>
  <span class="dk-check__box"></span>
  7 дней
</label>

<label class="dk-switch">
  <input type="checkbox" name="layer">
  <span class="dk-switch__track"><span class="dk-switch__knob"></span></span>
  Слой событий
</label>""",
    "api": [("input[type=checkbox|radio]", "элемент", "Состояние живёт в input; классы только рисуют."),
            ("dk-check__box--mixed", "класс", "Частичное; вместе с <code>input.indeterminate = true</code>."),
            ("disabled", "атрибут", "Недоступно; подпись приглушается сама.")],
    "related": [("component-table.html", "Таблица", "флажки выбора строк и «выбрать все»"),
                ("component-field.html", "Поле и форма", "флажки внутри формы"),
                ("component-select.html", "Фильтр", "множественный выбор из длинного списка")],
},
{
    "slug": "field", "title": "Поле и форма", "group": "Управление", "status": "стабильный",
    "purpose": "Принять от человека заявку, работу, комментарий. Форма на дашборде короткая, и правила у неё "
               "жёстче обычных: её заполняют между двумя срочными делами.",
    "files": ["css/components.css", "js/dk-form.js"], "scripts": ["dk-form.js"],
    "live_intro": "Подпись над полем, пример значения внутри, подсказка под ним. Отправьте пустую форму — "
                  "фокус уйдёт на первое неверное поле, а ошибка скажет, что сделать.",
    "live": """<div class="dk-panel"><form class="dk-form" id="ex-form">
      <div class="dk-form__alarm" hidden></div>
      <div class="dk-ff dk-ff--wide">
        <label class="dk-label" for="x-name">Что за работа <span class="dk-label__req">обязательно</span></label>
        <div class="dk-field"><input id="x-name" name="name" placeholder="Замена задвижки на вводе" required minlength="5"></div>
        <div class="dk-hint">Так её увидят диспетчеры смены в календаре</div>
      </div>
      <div class="dk-ff">
        <label class="dk-label" for="x-kind">Вид работы <span class="dk-label__req">обязательно</span></label>
        <div class="dk-field"><select id="x-kind" name="kind" required><option value="">Выберите вид</option><option value="plan">Плановое отключение</option><option value="high">Работа с ограничением</option><option value="crit">Авария</option></select></div>
      </div>
      <div class="dk-ff">
        <label class="dk-label" for="x-people">Затронуто жителей <span class="dk-label__opt">если известно</span></label>
        <div class="dk-field"><input id="x-people" name="people" type="number" min="0" max="500000" placeholder="1240"></div>
        <div class="dk-hint">Человек, а не квартир</div>
      </div>
      <div class="dk-ff dk-ff--wide">
        <label class="dk-label" for="x-note">Что сказать жителям <span class="dk-label__opt">необязательно</span></label>
        <textarea class="dk-area" id="x-note" name="note" maxlength="300" placeholder="Горячей воды не будет с 8:00 до 13:00"></textarea>
        <div class="dk-hint">До 300 знаков — текст уйдёт в рассылку как есть</div>
      </div>
      <div class="dk-form__foot">
        <button type="button" class="dk-btn" id="ex-form-reset">Очистить</button>
        <button type="submit" class="dk-btn dk-btn--primary">Добавить работу</button>
      </div>
    </form><div class="dk-result" id="ex-form-out" style="margin-top:var(--space-6)"></div></div>""",
    "live_script": """  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkForm !== 'function') return;
    var form = document.getElementById('ex-form'), out = document.getElementById('ex-form-out');
    var api = dkForm(form, {
      onSubmit: function (data) {
        out.innerHTML = '<b>Добавлено:</b> ' + dkEsc(data.get('name')) +
          (data.get('people') ? ', жителей ' + dkEsc(dkFmt.num(data.get('people'))) : '');
      }
    });
    document.getElementById('ex-form-reset').addEventListener('click', function () { form.reset(); api.clear(); out.textContent = ''; });
  });""",
    "when_yes": ["Человек вводит то, чего у системы нет: название работы, число жителей, комментарий.",
                 "Полей от одного до восьми; больше — это уже отдельная страница, а не виджет.",
                 "Данные применяются по кнопке, и до неё ничего не меняется."],
    "when_no": ["Выбор значения из известного списка для среза данных — <a href=\"component-select.html\">Фильтр</a>: он применяется сразу.",
                "Выбор дат — <a href=\"component-period.html\">Период</a>.",
                "Подтверждение действия без ввода — <a href=\"component-modal.html\">Модальное окно</a>."],
    "anatomy_html": """<form class="dk-form" onsubmit="return false"><div class="dk-form__alarm"><b class="sc-callout">1</b>Заполните обязательные поля — 2 из 3</div>
      <div class="dk-ff"><label class="dk-label"><b class="sc-callout">2</b>Подпись <span class="dk-label__req">обязательно</span></label>
        <div class="dk-field"><b class="sc-callout">3</b><input placeholder="Пример значения" aria-label="Пример"></div>
        <div class="dk-hint"><b class="sc-callout">4</b>Подсказка под полем</div></div>
      <div class="dk-ff"><label class="dk-label">С ошибкой</label>
        <div class="dk-field"><input value="Зам" aria-label="С ошибкой" aria-invalid="true"></div>
        <div class="dk-err"><b class="sc-callout">5</b>Не короче 5 знаков — сейчас 3</div></div>
      <div class="dk-form__foot"><b class="sc-callout">6</b><button type="button" class="dk-btn">Очистить</button><button type="button" class="dk-btn dk-btn--primary">Добавить</button></div></form>""",
    "anatomy": [("Сводка ошибок", "<code>dk-form__alarm</code> над формой после неудачной отправки: сколько полей не заполнено."),
                ("Подпись над полем", "<code>dk-label</code>; пометка «обязательно» или «если известно» — у того, чего меньше."),
                ("Поле", "<code>dk-field</code> вокруг input или select: заливка вместо рамки; внутри пример значения, а не название."),
                ("Подсказка", "<code>dk-hint</code>: единица, формат, куда попадёт значение."),
                ("Ошибка", "<code>dk-err</code> под полем и <code>aria-invalid</code> на input: говорит, что сделать, а не что не так."),
                ("Подвал", "<code>dk-form__foot</code>: основная кнопка справа, обычная левее.")],
    "sizes": "Поле одной высоты с контролами M (32); отдельных размеров у формы нет. Ширину задаёт сетка формы: "
             "<code>dk-ff</code> занимает половину, <code>dk-ff--wide</code> — всю строку.",
    "variants": [("dk-form", "Форма с сеткой полей.", "Всегда; внутри — dk-ff."),
                 ("dk-ff / dk-ff--wide", "Поле в полстроки или во всю.", "Названия и комментарии — wide, числа и даты — половина."),
                 ("dk-field", "Обёртка input или select.", "Все однострочные поля."),
                 ("dk-field--search", "Поле поиска со значком слева.", "Поиск по списку, не в форме."),
                 ("dk-area", "Многострочное поле.", "Комментарий, текст для рассылки."),
                 ("dk-err + aria-invalid", "Текст ошибки под полем и пометка на input.", "Ставит dk-form.js; руками — только в статичном примере.")],
    "states": """<div class="dk-panel"><div class="dk-form">
      <div class="dk-ff"><label class="dk-label">Обычное</label><div class="dk-field"><input placeholder="Пример" aria-label="Обычное"></div></div>
      <div class="dk-ff"><label class="dk-label">Фокус</label><div class="dk-field" style="outline:var(--focus-width) solid var(--brand);outline-offset:var(--focus-offset)"><input value="Замена задвижки" aria-label="Фокус"></div></div>
      <div class="dk-ff"><label class="dk-label">С ошибкой</label><div class="dk-field"><input value="Зам" aria-invalid="true" aria-label="С ошибкой"></div><div class="dk-err">Не короче 5 знаков — сейчас 3</div></div>
      <div class="dk-ff"><label class="dk-label">Недоступно</label><div class="dk-field"><input value="Заполнено системой" disabled aria-label="Недоступно"></div></div>
    </div></div>
    <div class="sc-note"><b>Проверка не бьёт по рукам на каждом нажатии.</b> Первая — когда человек ушёл из поля или отправил форму; после этого поле проверяется на каждое изменение, чтобы ошибка исчезла сразу, как исправлена.</div>""",
    "content_ok": ["Подпись — название данных: «Затронуто жителей». Внутри поля — пример: «1240».",
                   "Ошибка говорит, что сделать: «Не короче 5 знаков — сейчас 3».",
                   "Подсказка отвечает на вопрос, который возникнет: «Человек, а не квартир».",
                   "Отмечено то, чего меньше: обязательные или необязательные, но не оба сразу."],
    "content_bad": ["Название данных плейсхолдером внутри поля — исчезает при вводе.",
                    "«Неверное значение», «Ошибка» — человек и так знает, что ошибся.",
                    "Звёздочка без расшифровки.",
                    "Кнопка «Отправить» — что именно произойдёт?"],
    "a11y": ["<b>Подписи.</b> <code>&lt;label for&gt;</code> у каждого поля; подсказка и ошибка связаны через текст под полем и <code>aria-invalid</code>.",
             "<b>Фокус после ошибки</b> уходит на первое неверное поле — форма, которая молча не отправилась, заставляет перечитывать её сверху.",
             "<b>Сводка</b> над формой объявляется скринридеру как живой регион.",
             "<b>Клавиатура.</b> Enter в поле отправляет форму; Escape ничего не сбрасывает — потерять набранное дороже, чем нажать «Очистить»."],
    "tokens": ["dk-form", "dk-ff", "dk-field", "dk-fieldset", "dk-label", "dk-hint", "dk-err", "dk-area"],
    "code_intro": "Разметка — обычная форма с браузерными правилами (required, minlength, min/max); dk-form.js добавляет тексты ошибок, сводку и фокус.",
    "code": """<form class="dk-form" id="work">
  <div class="dk-form__alarm" hidden></div>
  <div class="dk-ff dk-ff--wide">
    <label class="dk-label" for="name">Что за работа <span class="dk-label__req">обязательно</span></label>
    <div class="dk-field"><input id="name" name="name" placeholder="Замена задвижки на вводе" required minlength="5"></div>
    <div class="dk-hint">Так её увидят диспетчеры смены</div>
  </div>
  <div class="dk-form__foot">
    <button type="submit" class="dk-btn dk-btn--primary">Добавить работу</button>
  </div>
</form>

<script>
var api = dkForm(document.getElementById('work'), {
  check: function (el) { /* своя проверка сверх браузерной; вернуть текст или null */ return null; },
  onSubmit: function (data) { /* data — FormData; форма прошла проверку */ }
});
api.validate();   // true, если всё верно
api.clear();      // снять ошибки
</script>""",
    "api": [("onSubmit(data)", "функция", "Зовётся только после успешной проверки; <code>data</code> — FormData."),
            ("check(el)", "функция", "Своя проверка поля поверх браузерной: вернуть текст ошибки или null."),
            ("validate()", "метод", "Проверить все поля, показать ошибки; вернуть true/false."),
            ("clear()", "метод", "Снять ошибки и сводку."),
            ("required, minlength, min, max, type", "атрибуты input", "Правила задаёт браузер; кит только формулирует ошибку по-русски.")],
    "related": [("component-check.html", "Флажок, радио, тумблер", "выбор внутри формы"),
                ("component-select.html", "Фильтр", "выбор из списка для среза, не для формы"),
                ("component-period.html", "Период", "даты"),
                ("component-modal.html", "Модальное окно", "короткая форма в окне")],
},
]
