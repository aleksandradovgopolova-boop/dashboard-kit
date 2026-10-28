# Обратная связь: баннер и уведомление, модальное окно, состояния страницы и виджета.

PAGES = [
{
    "slug": "banner", "title": "Баннер и уведомление", "group": "Обратная связь", "status": "стабильный",
    "purpose": 'Сообщает о состоянии страницы, а краткое уведомление подтверждает результат действия.',
    "files": ["css/components.css", "js/dk-notify.js"], "scripts": ["dk-notify.js"],
    "live_intro": 'Сравните постоянное сообщение и временное уведомление: важная причина не должна исчезать по таймеру.',
    "live": """<div class="dk-panel"><div class="dk-stack">
      <div class="dk-banner dk-banner--crit dk-banner--priority"><svg class="dk-i" aria-hidden="true"><use href="#ti-alert-triangle"/></svg><div class="dk-banner__text"><div class="dk-banner__title"><span class="dk-banner__number">23</span> аварии требуют решения</div></div><a class="dk-btn dk-btn--sm" href="accidents.html">Открыть аварии</a></div>
      <div class="dk-banner dk-banner--crit"><svg class="dk-i"><use href="#ti-alert-triangle"/></svg><div class="dk-banner__text"><div class="dk-banner__title">Не удалось обновить данные</div><div class="dk-banner__sub">Проверьте подключение и повторите загрузку</div></div></div>
      <div class="dk-banner dk-banner--calm"><svg class="dk-i"><use href="#ti-circle-check"/></svg><div class="dk-banner__text"><div class="dk-banner__title">Данные обновлены</div><div class="dk-banner__sub">Все источники доступны</div></div></div>
      <div class="dk-banner dk-banner--event"><svg class="dk-i"><use href="#ti-file-text"/></svg><div class="dk-banner__text"><div class="dk-banner__title">Выгрузка за сентябрь готова</div><div class="dk-banner__sub">Файл доступен в разделе «Отчёты»</div></div><button class="dk-iconbtn dk-iconbtn--sm dk-banner__x" type="button" title="Закрыть" aria-label="Закрыть" onclick="this.closest('.dk-banner').remove()"><svg class="dk-i dk-i--sm"><use href="#ti-x"/></svg></button></div>
      <div class="sc-row" style="margin:0"><button class="dk-btn dk-btn--sm" data-toast="calm">Показать уведомление</button><button class="dk-btn dk-btn--sm" data-toast="undo">С отменой</button><button class="dk-btn dk-btn--sm" data-toast="crit">Тревожное</button></div>
    </div></div>""",
    "live_script": """  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkToast !== 'function') return;
    document.querySelectorAll('[data-toast]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.toast;
        if (k === 'undo') dkToast('Срез сброшен к настройкам по умолчанию', { action: { name: 'Отменить', onClick: function () { dkToast('Срез возвращён'); } } });
        else if (k === 'crit') dkToast('Не удалось сохранить срез — попробуйте ещё раз', { kind: 'crit' });
        else dkToast('Работа добавлена в календарь');
      });
    });
  });""",
    "when_yes": ["Баннер: состояние, которое касается всей страницы, — сбой служб, устаревшие данные, готовый отчёт.",
                 "Уведомление: подтвердить, что действие человека выполнено: «Срез сброшен», «Работа добавлена».",
                 "Уведомление с «Отменить»: действие обратимо, и отмена дешевле подтверждения заранее."],
    "when_no": ["Новость о данных («Авария в Новосибирске») — не уведомление: уехавшее через пять секунд сообщение о новой аварии — это авария, которую никто не увидел. Это баннер или строка в ленте.",
                "Проблема одного виджета — <a href=\"component-empty.html\">ошибка внутри виджета</a>, не баннер страницы.",
                "Подтверждение опасного действия — <a href=\"component-modal.html\">Модальное окно</a>."],
    "anatomy_html": """<div class="dk-stack"><div class="dk-banner dk-banner--crit"><b class="sc-callout">1</b><svg class="dk-i"><use href="#ti-alert-triangle"/></svg><div class="dk-banner__text"><div class="dk-banner__title"><b class="sc-callout">2</b>Не удалось обновить данные</div><div class="dk-banner__sub"><b class="sc-callout">3</b>Проверьте подключение и повторите загрузку</div></div><div class="dk-banner__stats"><b class="sc-callout">4</b><div class="dk-banner__stat"><b>9/11</b><span>служб</span></div></div></div>
      <div class="dk-toast dk-toast--calm" style="position:static;max-width:520px"><svg class="dk-i"><use href="#ti-circle-check"/></svg><span class="dk-toast__text"><b class="sc-callout">5</b>Срез сброшен к настройкам по умолчанию</span><button type="button" class="dk-btn dk-btn--ghost dk-btn--sm"><b class="sc-callout">6</b>Отменить</button><button type="button" class="dk-iconbtn dk-iconbtn--sm" title="Закрыть" aria-label="Закрыть"><b class="sc-callout">7</b><svg class="dk-i dk-i--sm"><use href="#ti-x"/></svg></button></div></div>""",
    "anatomy": [("Значок баннера", "вид состояния; цвет смысла — crit, high, calm, event."),
                ("Заголовок", "что случилось, с числом."),
                ("Подстрока", "почему и что это значит."),
                ("Показатели", "<code>dk-banner__stats</code>: «9/11 служб» — цифры, по которым видно масштаб."),
                ("Текст уведомления", "одна фраза в прошедшем времени: действие выполнено."),
                ("Действие", "«Отменить»; с ним уведомление не исчезает само."),
                ("Закрыть", "крестик есть всегда; у баннера — только у события.")],
    "sizes": "Размер один: баннер на всю ширину под шапкой страницы, уведомление до 520 px в правом нижнем углу, "
             "не больше трёх одновременно — старые уходят снизу.",
    "variants": [("dk-banner--priority", "Тонированная поверхность, крупное число и выделенное действие.", "Одно главное состояние обзора, вместе с crit/high/calm."),
                 ("dk-banner--crit / --high", "Тревога: не закрывается.", "Сбой, просрочка, устаревшие данные."),
                 ("dk-banner--calm", "Штатно.", "Когда важно сказать, что всё в порядке."),
                 ("dk-banner--event", "Событие, единственный закрываемый.", "Готовый отчёт, обновление."),
                 ("dkToast(text)", "Уведомление, уходит само.", "Подтверждение действия."),
                 ("kind: 'crit' | 'high' | 'calm'", "Вид уведомления.", "По смыслу результата."),
                 ("action: {name, onClick}", "Кнопка в уведомлении; таймера нет.", "Обратимое действие."),
                 ("life", "Время жизни в мс.", "Явно — только если знаете, зачем.")],
    "states": """<div class="dk-panel"><div class="dk-stack">
      <div class="dk-banner dk-banner--high"><svg class="dk-i"><use href="#ti-clock"/></svg><div class="dk-banner__text"><div class="dk-banner__title">Данные устарели</div><div class="dk-banner__sub">Последний срез — 40 минут назад, телеметрия не отвечает</div></div></div>
      <div class="dk-toast dk-toast--crit" style="position:static;max-width:520px"><svg class="dk-i"><use href="#ti-alert-circle"/></svg><span class="dk-toast__text">Не удалось сохранить срез — попробуйте ещё раз</span><button type="button" class="dk-iconbtn dk-iconbtn--sm" title="Закрыть" aria-label="Закрыть"><svg class="dk-i dk-i--sm"><use href="#ti-x"/></svg></button></div>
    </div></div>
    <div class="sc-note"><b>Время жизни считается по длине текста</b>: четыре секунды плюс сорок миллисекунд на знак, не больше десяти. Под курсором и под фокусом отсчёт стоит. С действием таймера нет вовсе: «успей или потеряй» бьёт по тем, кто и так работает медленнее.</div>""",
    "content_ok": ["Крупный значок в сводке: dk-widget-icon — контур на мягком круге; dk-widget-icon--crit — авария. Размер и форма едины с другими виджетами, без обводки.", "Заголовок баннера с числом и глаголом: «Не удалось обновить данные».",
                   "Уведомление в прошедшем времени: «Работа добавлена в календарь».",
                   "Тревожное уведомление говорит, что делать: «попробуйте ещё раз»."],
    "content_bad": ["Баннер «Внимание!» без того, на что.",
                    "Уведомление «Успешно» — что именно?",
                    "Крестик на баннере о сбое — сбой, спрятанный руками человека, который через час о нём забудет."],
    "a11y": ["<b>Уведомления</b> объявляются скринридеру: полка — живой регион.",
             "<b>Крестик</b> с <code>aria-label</code>; кнопка действия — обычная кнопка, Tab до неё возможен, поэтому таймера с действием нет.",
             "<b>Не только цветом.</b> Значок и текст у обоих; цвет — дополнение.",
             "<b>Контраст.</b> Заголовок и подстрока на заливке баннера — проверка КОНТРАСТ в обеих темах."],
    "tokens": ["dk-banner", "dk-toast", "dk-toasts", "dk-widget-icon"],
    "code_intro": "Баннер — разметка. Уведомление — вызов функции; полка создаётся сама.",
    "code": """<div class="dk-banner dk-banner--crit">
  <svg class="dk-i"><use href="#ti-alert-triangle"/></svg>
  <div class="dk-banner__text">
    <div class="dk-banner__title">Не удалось обновить данные</div>
    <div class="dk-banner__sub">Проверьте подключение и повторите загрузку</div>
  </div>
</div>

<script>
dkToast('Работа добавлена в календарь');
dkToast('Срез сброшен', { action: { name: 'Отменить', onClick: restore } });
var t = dkToast('Не удалось сохранить', { kind: 'crit' });
t.close();
</script>""",
    "api": [("dk-banner--priority / dk-banner__number", "классы", "Опциональный главный баннер обзора: крупное число, тонированная поверхность и действие. Использовать с crit/high/calm; обычные сообщения сохраняют прежний вид."),
            ("dkToast(text, opts)", "функция", "Показать уведомление; возвращает {close, el}."),
            ("opts.kind", "'calm' | 'high' | 'crit'", "Вид; по умолчанию calm."),
            ("opts.action", "{name, onClick}", "Кнопка; отключает таймер."),
            ("opts.life", "число мс", "Явное время жизни."),
            ("dk-banner--crit | --high | --calm | --event", "класс", "Вид баннера; закрывается только event.")],
    "related": [("component-empty.html", "Состояния", "ошибка одного виджета"),
                ("component-modal.html", "Модальное окно", "подтверждение до действия"),
                ("component-uptime.html", "Доступность служб", "то, о чём баннер сообщает")],
},
{
    "slug": "modal", "title": "Модальное окно", "group": "Обратная связь", "status": "стабильный",
    "purpose": 'Помогает выполнить короткую задачу или подтвердить действие, сохраняя контекст страницы.',
    "files": ["css/components.css", "js/dk-modal.js"], "scripts": ["dk-modal.js"],
    "live_intro": 'Откройте окно, закройте его и проверьте возврат к исходной кнопке.',
    "live": """<div class="dk-panel"><div class="sc-row" style="margin:0"><button class="dk-btn dk-btn--primary" data-modal="#x-confirm">Удалить запись</button><button class="dk-btn" data-modal="#x-form">Добавить работу</button></div>
      <div class="dk-result" id="x-modal-out" style="margin-top:var(--space-6)">Окно ещё не открывали</div></div>
    <dialog class="dk-modal" id="x-confirm" aria-labelledby="x-confirm-t"><form method="dialog" class="dk-modal__form"><div class="dk-modal__head"><h2 class="dk-modal__title" id="x-confirm-t">Удалить запись</h2><button type="button" class="dk-iconbtn dk-modal__close" data-modal-close aria-label="Закрыть окно" title="Закрыть"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button></div><div class="dk-modal__body"><p>Запись будет удалена. Восстановить её не получится.</p></div><div class="dk-modal__foot"><button class="dk-btn dk-btn--ghost" value="cancel">Отмена</button><button class="dk-btn dk-btn--primary" value="ok">Удалить запись</button></div></form></dialog>
    <dialog class="dk-modal" id="x-form" aria-labelledby="x-form-t"><form method="dialog" class="dk-modal__form"><div class="dk-modal__head"><h2 class="dk-modal__title" id="x-form-t">Добавить работу</h2><button type="button" class="dk-iconbtn dk-modal__close" data-modal-close aria-label="Закрыть окно" title="Закрыть"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button></div><div class="dk-modal__body"><div class="dk-form"><div class="dk-ff dk-ff--wide"><label class="dk-label" for="x-m-name">Название работы</label><div class="dk-field"><input id="x-m-name" placeholder="Замена задвижки на вводе"></div></div></div></div><div class="dk-modal__foot"><button class="dk-btn dk-btn--ghost" value="cancel">Отмена</button><button class="dk-btn dk-btn--primary" value="ok">Добавить</button></div></form></dialog>""",
    "live_script": """  window.addEventListener('DOMContentLoaded', function () {
    if (typeof dkModal !== 'function') return;
    var out = document.getElementById('x-modal-out');
    document.querySelectorAll('[data-modal]').forEach(function (b) {
      var m = dkModal(b.dataset.modal);
      if (!m) return;
      b.addEventListener('click', function () { m.open(); });
      m.el.addEventListener('close', function () { out.textContent = 'Окно «' + m.el.querySelector('.dk-modal__title').textContent + '» закрыто: ' + (m.returnValue || 'Escape'); });
    });
  });""",
    "when_yes": ["Действие необратимо или дорого: удалить запись, удалить срез — нужно подтверждение своими словами.",
                 "Короткая форма из одного–трёх полей, после которой человек возвращается туда же.",
                 "Нужно остановить всё остальное, пока не решено.", "Быстрый обзор региона: 3–5 ключевых метрик, одна короткая таблица и возврат к исходному срезу."],
    "when_no": ["Большой объём данных, сложные сравнения или длительная работа с регионом — отдельная страница дашборда с сохранённым контекстом; не растягивать модалку и не добавлять бесконечные вкладки.",
                "Длинная форма — отдельная страница или <a href=\"component-field.html\">форма</a> в панели.",
                "Уведомление о результате — <a href=\"component-banner.html\">Уведомление</a>."],
    "anatomy_html": """<div class="dk-modal" style="position:static;display:block;max-width:520px;margin:0"><form method="dialog" class="dk-modal__form" onsubmit="return false"><div class="dk-modal__head"><h2 class="dk-modal__title"><b class="sc-callout">1</b>Удалить запись</h2><button type="button" class="dk-iconbtn dk-modal__close" data-modal-close aria-label="Закрыть окно" title="Закрыть"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button></div><div class="dk-modal__body"><p><b class="sc-callout">2</b>Запись будет удалена. Восстановить её не получится.</p></div><div class="dk-modal__foot"><b class="sc-callout">3</b><button type="button" class="dk-btn dk-btn--ghost">Отмена</button><button type="button" class="dk-btn dk-btn--primary"><b class="sc-callout">4</b>Удалить запись</button></div></form></div>""",
    "anatomy": [("Заголовок", "в подтверждении — действие, в краткой детализации — полное название объекта и его контекст."),
                ("Текст", "последствие простыми словами: что произойдёт после «да»."),
                ("Подвал", "тихая «Отмена» слева, основная справа; порядок один во всём ките."),
                ("Подтверждение", "называет действие своим именем — не «ОК» и не «Да»; <code>value</code> кнопки возвращается через <code>returnValue</code>.")],
    "sizes": "Два размера: по умолчанию до 520 px, <code>dk-modal--wide</code> до 880 — для формы в две колонки. "
             "Высота по содержимому, тело прокручивается само.",
    "variants": [("dk-modal--detail / dk-modal__metrics", "Краткая детализация: компактная шапка, период и обновление, 3–5 равных КПЭ, основной контент, пояснение и реальные действия. Стандартная ширина до 800 px, с dk-modal--wide до 960 px; max-height 90dvh. На телефоне — fullscreen, поля 16 px, шапка и действия доступны при внутренней прокрутке.", "Быстрый обзор без длительного анализа; вкладки только при необходимости, отсутствие данных отличается от нуля."), ("dk-modal", "Окно на <code>&lt;dialog&gt;</code>.", "Всегда."),
                 ("dk-modal--wide", "Широкое окно.", "Форма в две колонки, таблица."),
                 ("form method=\"dialog\"", "Закрытие кнопками без скрипта.", "Всегда: value кнопки — результат."),
                 ("data-modal=\"#id\"", "Кнопка-открыватель.", "Соглашение страниц кита; dkModal вешает клик сама или страница.")],
    "states": """<div class="dk-panel"><div class="sc-row" style="margin:0"><button class="dk-btn" data-modal="#x-busy">Окно с ожиданием</button></div></div>
    <dialog class="dk-modal" id="x-busy" aria-labelledby="x-busy-t"><form method="dialog" class="dk-modal__form"><div class="dk-modal__head"><h2 class="dk-modal__title" id="x-busy-t">Сохраняем срез</h2><button type="button" class="dk-iconbtn dk-modal__close" data-modal-close aria-label="Закрыть окно" title="Закрыть"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button></div><div class="dk-modal__body"><span class="dk-vh">Сохраняем</span><div class="dk-skel" style="height:14px;width:70%;margin-bottom:var(--space-5)"></div><div class="dk-skel" style="height:14px;width:45%"></div></div><div class="dk-modal__foot"><button class="dk-btn dk-btn--ghost" value="cancel">Отмена</button><button class="dk-btn dk-btn--primary" disabled aria-busy="true">Сохраняем…</button></div></form></dialog>
    <div class="sc-note"><b>Второе окно не открывается поверх первого.</b> Если решение требует второго решения, второе живёт внутри первого окна. Попытка открыть второе закрывает первое и пишет предупреждение в консоль.</div>""",
    "content_ok": ["Заголовок и кнопка подтверждения — одно и то же действие: «Удалить запись».",
                   "Текст — последствие: «Запись будет удалена без возможности восстановления».",
                   "«Отмена» — всегда так, слева, тихая."],
    "content_bad": ["«Вы уверены?» — не говорит, в чём.",
                    "«ОК / Отмена» — что сделает «ОК»?",
                    "Крестик как единственный способ закрыть без решения."],
    "a11y": ["<b>Ловушка фокуса, фон недоступен, возврат фокуса</b> на кнопку-открыватель — делает <code>&lt;dialog&gt;</code>.",
             "<b>Escape</b> закрывает ровно один слой: открытый внутри окна список закрывается первым, окно с заполненной формой остаётся.",
             "<b>Заголовок</b> связан через <code>aria-labelledby</code>.",
             "<b>Не проверялось</b> со скринридером; в старых браузерах без <code>showModal</code> окно не откроется и напишет ошибку."],
    "tokens": ["dk-modal"],
    "code_intro": "Разметка — <code>&lt;dialog&gt;</code> с формой <code>method=\"dialog\"</code>; скрипт — один вызов.",
    "code": """<button class="dk-btn dk-btn--primary" data-modal="#confirm">Удалить запись</button>

<dialog class="dk-modal" id="confirm" aria-labelledby="confirm-t">
  <form method="dialog" class="dk-modal__form">
    <div class="dk-modal__head"><h2 class="dk-modal__title" id="confirm-t">Удалить запись</h2><button type="button" class="dk-iconbtn dk-modal__close" data-modal-close aria-label="Закрыть окно" title="Закрыть"><svg class="dk-i" aria-hidden="true"><use href="#ti-x"/></svg></button></div>
    <div class="dk-modal__body"><p>Запись будет удалена без возможности восстановления.</p></div>
    <div class="dk-modal__foot">
      <button class="dk-btn dk-btn--ghost" value="cancel">Отмена</button>
      <button class="dk-btn dk-btn--primary" value="ok">Удалить запись</button>
    </div>
  </form>
</dialog>

<script>
var m = dkModal('#confirm');
button.addEventListener('click', m.open);
m.el.addEventListener('close', function () { if (m.returnValue === 'ok') closeAccident(); });
</script>""",
    "api": [("dkModal(el | селектор)", "функция", "Обёртка над dialog; null, если окна нет."),
            ("open()", "метод", "Открыть; предыдущее окно закроется с предупреждением."),
            ("close(value)", "метод", "Закрыть с результатом."),
            ("returnValue", "свойство", "value нажатой кнопки; пусто при Escape."),
            ("el", "свойство", "Сам <code>&lt;dialog&gt;</code> — на него вешают <code>close</code>.")],
    "related": [("component-button.html", "Кнопка", "порядок кнопок в подвале"),
                ("component-field.html", "Поле и форма", "форма внутри окна"),
                ("accidents.html", "Страница «Аварии»", "окно «Удалить запись» в живом дашборде")],
},
{
    "slug": "empty", "title": "Состояния: загрузка, пусто, ошибка", "group": "Обратная связь", "status": "стабильный",
    "purpose": 'Объясняет загрузку, отсутствие результатов или ошибку и подсказывает следующий шаг.',
    "files": ["css/components.css"], "scripts": [],
    "live_intro": 'Сравните причины отсутствия содержимого. У каждой — своё объяснение и уместное действие.',
    "live": """<div class="dk-grid--even">
      <div class="dk-panel"><div class="dk-overline" style="margin-bottom:var(--space-6)">Загрузка</div><span class="dk-vh">Загружаем показатели</span><div class="dk-skel" style="height:14px;width:60%;margin-bottom:var(--space-5)"></div><div class="dk-skel" style="height:14px;width:85%;margin-bottom:var(--space-5)"></div><div class="dk-skel" style="height:14px;width:45%"></div></div>
      <div class="dk-panel"><div class="dk-empty"><div class="dk-empty__t">Ничего не найдено</div><div>Под выбранные фильтры не попал ни один регион.</div><div class="dk-empty__do">Снимите фильтр по округу или расширьте период.</div></div></div>
      <div class="dk-widget"><div class="dk-widget__head"><h3 class="dk-widget__title">Динамика балла</h3><div class="dk-widget__actions"><button class="dk-iconbtn dk-iconbtn--sm" title="Обновить" aria-label="Обновить"><svg class="dk-i"><use href="#ti-refresh"/></svg></button></div></div><div class="dk-error"><span class="dk-error__icon"><svg class="dk-i"><use href="#ti-plug-connected-x"/></svg></span><h4 class="dk-error__title">Виджет не загрузился</h4><p class="dk-error__text">Остальные показатели на странице актуальны.</p><div class="dk-error__actions"><button class="dk-btn dk-btn--sm">Повторить</button></div></div></div>
    </div>
    <div class="dk-panel" style="margin-top:var(--space-6)"><div class="dk-error dk-error--alarm"><span class="dk-error__icon"><svg class="dk-i"><use href="#ti-plug-connected-x"/></svg></span><h3 class="dk-error__title">Данные не загрузились</h3><p class="dk-error__text">Сервер не ответил. Показатели на экране могли остаться со вчерашнего среза — на них сейчас нельзя опираться.</p><div class="dk-error__actions"><button class="dk-btn dk-btn--primary"><svg class="dk-i"><use href="#ti-refresh"/></svg>Попробовать снова</button></div><div class="dk-error__code">ERR_TIMEOUT · 22.09.2026 23:14</div></div></div>""",
    "when_yes": ["Загрузка: данные ещё едут, и место под них известно — скелетон повторяет форму будущего содержимого.",
                 "Пусто: запрос выполнился, а ответ пуст — фильтры, период, новый объект.",
                 "Ошибка: запрос не выполнился; внутри виджета — компактно, на всю страницу — с кодом для поддержки."],
    "when_no": ["Служба не отвечает сутки — это <a href=\"component-banner.html\">Баннер</a> страницы, не ошибка виджета.",
                "Ноль значений — не «пусто»: ноль — это ответ, и его показывает сам компонент (график, таблица).",
                "Нет доступа — страница ошибки 403 (на <a href=\"showcase.html#stranicy-oshibok\">витрине</a>), а не пустое состояние."],
    "anatomy_html": """<div class="dk-grid--even"><div class="dk-panel"><div class="dk-empty"><div class="dk-empty__t"><b class="sc-callout">1</b>Ничего не найдено</div><div><b class="sc-callout">2</b>Под фильтры не попал ни один регион.</div><div class="dk-empty__do"><b class="sc-callout">3</b>Снимите фильтр по округу.</div></div></div>
      <div class="dk-panel"><div class="dk-error dk-error--alarm"><span class="dk-error__icon"><b class="sc-callout">4</b><svg class="dk-i"><use href="#ti-alert-triangle"/></svg></span><h3 class="dk-error__title">Данные не приходят</h3><p class="dk-error__text">Показатели — со среза до сбоя.</p><div class="dk-error__actions"><b class="sc-callout">5</b><button class="dk-btn dk-btn--primary">Попробовать снова</button></div><div class="dk-error__code"><b class="sc-callout">6</b>500 · req 8f3a-21c9</div></div></div></div>""",
    "anatomy": [("Что произошло", "<code>dk-empty__t</code> / <code>dk-error__title</code>: заголовок одной фразой."),
                ("Почему", "строка причины простыми словами."),
                ("Что делать", "<code>dk-empty__do</code> или кнопка действия: без третьей строки человек не знает, его это вина или системы."),
                ("Значок ошибки", "<code>dk-error--alarm</code> красит его смыслом: данные ненадёжны."),
                ("Действие", "«Попробовать снова», «К сводке» — то, что действительно можно сделать."),
                ("Код", "внизу и мелко: нужен поддержке, а не читателю, но без него не объяснить, что сломалось.")],
    "sizes": "Два размера: внутри виджета (<code>h4</code>, кнопка sm) и на всю страницу (<code>h3</code>, основная кнопка, код). "
             "Скелетон — полосы высотой строки текста, ширины разные, чтобы не выглядели таблицей.",
    "variants": [("dk-skel", "Полоса-заглушка; рядом скрытый текст для скринридера.", "Загрузка."),
                 ("dk-empty / __t / __do", "Пустое состояние из трёх строк.", "Пустой ответ."),
                 ("dk-error", "Ошибка виджета или страницы.", "Запрос не выполнился."),
                 ("dk-error--alarm", "Значок цветом тревоги.", "Данные на экране ненадёжны."),
                 ("dk-error__code", "Код для поддержки.", "Страница ошибки; в виджете не нужен."),
                 ("aria-busy=\"true\"", "На виджете во время загрузки.", "Всегда вместе со скелетоном.")],
    "states": """<div class="dk-grid--even">
      <div class="dk-panel"><div class="dk-error"><span class="dk-error__icon"><svg class="dk-i"><use href="#ti-search"/></svg></span><h3 class="dk-error__title">Такой страницы нет</h3><p class="dk-error__text">Возможно, её переименовали или ссылка устарела.</p><div class="dk-error__actions"><button class="dk-btn dk-btn--primary">К сводке</button></div><div class="dk-error__code">404</div></div></div>
      <div class="dk-panel"><div class="dk-error"><span class="dk-error__icon"><svg class="dk-i"><use href="#ti-lock"/></svg></span><h3 class="dk-error__title">Нет доступа к этому разделу</h3><p class="dk-error__text">Запросите доступ у администратора мониторинга.</p><div class="dk-error__actions"><button class="dk-btn dk-btn--primary">Запросить доступ</button></div><div class="dk-error__code">403</div></div></div>
    </div>
    <div class="sc-note"><b>Чего здесь не бывает.</b> Обвинения пользователя («вы ввели неверный адрес»), технических подробностей на видном месте и юмора: смешная картинка на месте сломанного отчёта раздражает того, кому отчёт был нужен к совещанию.</div>""",
    "content_ok": ["Три строки: что, почему, что делать.",
                   "Действие — глаголом и выполнимое: «Снимите фильтр по округу».",
                   "Ошибка честно говорит, чему нельзя верить: «показатели — со вчерашнего среза»."],
    "content_bad": ["«Нет данных» одной строкой — тупик.",
                    "«Что-то пошло не так» — это не ответ на вопрос «что».",
                    "Скелетон, который не похож на то, что загрузится."],
    "a11y": ["<b>Скелетон</b> сопровождается скрытым текстом «Загружаем…» и <code>aria-busy</code> на виджете.",
             "<b>Действие</b> — настоящая кнопка или ссылка; фокус после ошибки уходит на неё, если страница целиком.",
             "<b>Не только цветом.</b> Тревога — значком и словами; красный лишь дополняет.",
             "<b>Контраст.</b> Тексты на поверхности панели — проверка КОНТРАСТ."],
    "tokens": ["dk-skel", "dk-empty", "dk-error"],
    "code_intro": "Только разметка. Обёртка графика показывает пустое состояние сама (<code>empty</code>).",
    "code": """<!-- загрузка -->
<div class="dk-widget" aria-busy="true">
  <span class="dk-vh">Загружаем показатели</span>
  <div class="dk-skel" style="height:14px;width:60%"></div>
</div>

<!-- пусто -->
<div class="dk-empty">
  <div class="dk-empty__t">Ничего не найдено</div>
  <div>Под фильтры не попал ни один регион.</div>
  <div class="dk-empty__do">Снимите фильтр по округу.</div>
</div>

<!-- ошибка виджета -->
<div class="dk-error">
  <span class="dk-error__icon"><svg class="dk-i"><use href="#ti-plug-connected-x"/></svg></span>
  <h4 class="dk-error__title">Виджет не загрузился</h4>
  <p class="dk-error__text">Остальные показатели актуальны.</p>
  <div class="dk-error__actions"><button class="dk-btn dk-btn--sm">Повторить</button></div>
</div>""",
    "api": [("dk-empty__t / __do", "элементы", "Заголовок и «что делать»; средняя строка — без класса."),
            ("dk-error--alarm", "класс", "Данные ненадёжны."),
            ("dk-error__code", "элемент", "Код и время для поддержки."),
            ("aria-busy", "атрибут", "На контейнере во время загрузки.")],
    "related": [("component-banner.html", "Баннер", "состояние всей страницы"),
                ("component-chart.html", "График", "пустое состояние графика — встроенное"),
                ("showcase.html#stranicy-oshibok", "Витрина: страницы ошибок", "все четыре страницы целиком")],
},
]
