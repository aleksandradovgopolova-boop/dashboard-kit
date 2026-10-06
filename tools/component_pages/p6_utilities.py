"""Адаптивные иконки и нативная прокрутка."""

PAGES = [{'slug': 'adaptive-icons',
  'title': 'Адаптивные иконки',
  'group': 'Утилиты',
  'status': 'стабильный',
  'purpose': 'Автоматический размер иконок для мыши и сенсорного управления.',
  'files': ['css/components.css'],
  'scripts': [],
  'live_intro': 'Живой пример в текущем режиме устройства.',
  'live': '<div class="dk-panel"><div class="dk-inline"><button class="dk-btn dk-btn--sm"><svg class="dk-i '
          'dk-i--adaptive" aria-hidden="true"><use href="#ti-search"/></svg>Найти</button><button '
          'class="dk-iconbtn dk-iconbtn--sm" aria-label="Поиск"><svg class="dk-i dk-i--adaptive" '
          'aria-hidden="true"><use href="#ti-search"/></svg></button><button class="dk-btn"><svg class="dk-i '
          'dk-i--adaptive" aria-hidden="true"><use href="#ti-search"/></svg>Найти</button></div></div>',
  'anatomy_html': '<div class="dk-inline"><b class="sc-callout">1</b><svg class="dk-i dk-i--adaptive" '
                  'aria-hidden="true"><use href="#ti-search"/></svg><b class="sc-callout">2</b><span>Размер '
                  'задаёт контекст кнопки и режим указателя.</span></div>',
  'anatomy': [('Иконка', 'Один вектор Tabler, без дублирования SVG.'),
              ('Контекст', 'В S-кнопках иконка меньше; сама сенсорная цель остаётся минимум 44 px.')],
  'when_yes': ['Иконки действий должны соответствовать размеру соседних контролов.',
               'Один экран используется мышью и на сенсорном устройстве.'],
  'when_no': ['Логотип, иллюстрация или график — это не адаптивная иконка.',
              'Фиксированная иконка данных может использовать dk-i--sm или dk-i--lg.'],
  'sizes': 'Обычный контекст: 20 px для мыши, 24 px для тача. Контрол S: 16 / 20 px. Размер определяется '
           'hover/pointer, а не шириной окна.',
  'variants': [('dk-i--adaptive', 'Автоматический размер.', 'Обычный SVG или вызов dkIcon.el.'),
               ('dk-btn--sm / dk-iconbtn--sm', '16 / 20 px внутри S.', 'Компактные контролы.')],
  'states': '<div class="dk-panel"><div class="dk-inline"><button disabled class="dk-btn dk-btn--sm"><svg '
            'class="dk-i dk-i--adaptive" aria-hidden="true"><use '
            'href="#ti-search"/></svg>Найти</button><button class="dk-iconbtn dk-iconbtn--sm" '
            'aria-label="Поиск"><svg class="dk-i dk-i--adaptive" aria-hidden="true"><use '
            'href="#ti-search"/></svg></button><button class="dk-btn"><svg class="dk-i dk-i--adaptive" '
            'aria-hidden="true"><use href="#ti-search"/></svg>Найти</button></div></div>',
  'content_ok': ['Одна иконка одного смысла во всех размерах.',
                 'Используйте существующие названия Tabler из dkIconNames.'],
  'content_bad': ['Маленькое окно автоматически считается телефоном.',
                  'Увеличить иконку, сохранив слишком маленькую область нажатия.'],
  'a11y': ['Декоративная иконка: aria-hidden="true"; имя кнопки задаётся текстом или aria-label.',
           'CSS автоматически реагирует на смену режима указателя.',
           'Tabler — один масштабируемый рисунок. Это адаптация размера, а не переключение двух отдельных '
           'рисунков VKUI.'],
  'tokens': ['dk-i--adaptive'],
  'code_intro': 'Только HTML/CSS. Скрипт иконок подключается вместе с основой кита.',
  'code': '<button class="dk-btn dk-btn--sm"><svg class="dk-i dk-i--adaptive" aria-hidden="true"><use '
          'href="#ti-search"/></svg>Найти</button>',
  'api': [('dk-i--adaptive', 'класс', 'Добавьте к dk-i или передайте в dkIcon.el.')],
  'related': [('component-button.html', 'Кнопка', 'Контекст размера'),
              ('https://vkui.io/components/adaptive-icon-renderer/',
               'Референс VKUI',
               'Автоматический выбор размера')]},
 {'slug': 'scrollview',
  'title': 'Прокручиваемая область',
  'group': 'Утилиты',
  'status': 'стабильный',
  'purpose': 'Нативная прокрутка длинного содержимого внутри ограниченной области.',
  'files': ['css/components.css'],
  'scripts': [],
  'live_intro': 'Живой пример в текущем режиме устройства.',
  'live': '<div class="dk-panel"><div class="dk-scrollview" tabindex="0" role="region" aria-label="Список '
          'отчётов" style="--scrollview-height:200px"><div class="dk-row"><span class="dk-row__label">Отчёт '
          '1</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span '
          'class="dk-row__label">Отчёт 2</span><span class="dk-row__value">Готов</span></div><div '
          'class="dk-row"><span class="dk-row__label">Отчёт 3</span><span '
          'class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт '
          '4</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span '
          'class="dk-row__label">Отчёт 5</span><span class="dk-row__value">Готов</span></div><div '
          'class="dk-row"><span class="dk-row__label">Отчёт 6</span><span '
          'class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт '
          '7</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span '
          'class="dk-row__label">Отчёт 8</span><span class="dk-row__value">Готов</span></div><div '
          'class="dk-row"><span class="dk-row__label">Отчёт 9</span><span '
          'class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт '
          '10</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span '
          'class="dk-row__label">Отчёт 11</span><span class="dk-row__value">Готов</span></div><div '
          'class="dk-row"><span class="dk-row__label">Отчёт 12</span><span '
          'class="dk-row__value">Готов</span></div></div></div>',
  'anatomy_html': '<div class="dk-scrollview" tabindex="0" role="region" aria-label="Пример области"><b '
                  'class="sc-callout">1</b> Контейнер<br><b class="sc-callout">2</b> Нативная полоса '
                  'появляется при переполнении.</div>',
  'anatomy': [('Контейнер', 'Ограниченная высота, фокусируемая именованная область.'),
              ('Полоса', 'Нативная: системное поведение и управление клавиатурой сохраняются.')],
  'when_yes': ['Список в боковой панели или модальном окне с ограниченной высотой.',
               'Широкое содержимое требует горизонтального просмотра.'],
  'when_no': ['Обычная статья — прокручивайте страницу целиком.',
              'Сжимать основные показатели в прокручиваемые карточки ради первого экрана.'],
  'sizes': 'Максимальная высота по умолчанию 320 px. Параметр --scrollview-height меняет ограничение. Без '
           'переполнения прокрутки нет.',
  'variants': [('dk-scrollview',
                'Вертикальная и горизонтальная прокрутка при переполнении.',
                'По умолчанию.'),
               ('dk-scrollview--horizontal', 'Только горизонтальная.', 'Широкий ряд.'),
               ('dk-scrollview--contain',
                'Не передаёт прокрутку родителю на границе.',
                'Панель или модальное окно.'),
               ('dk-scrollview--smooth',
                'Плавная программная прокрутка.',
                'Не влияет на обычную прокрутку колесом.'),
               ('dk-scrollview--hidden-bar',
                'Скрывает полосу.',
                'Только при наличии другого явного способа навигации.')],
  'states': '<div class="dk-panel"><div class="dk-scrollview" tabindex="0" role="region" '
            'aria-label="Короткий список">Один отчёт — прокрутка не нужна.</div></div>',
  'content_ok': ['Понятное имя области: «Список отчётов».',
                 'Полоса видна по правилам системы; содержимое не обрезается по ширине.'],
  'content_bad': ['Скрытая полоса без признаков продолжения содержимого.',
                  'Перехват wheel/touch или ловушка клавиатурного фокуса.'],
  'a11y': ['tabindex="0" позволяет прокручивать область стрелками и PageDown; Tab выводит фокус наружу.',
           'Система может скрывать полосу до прокрутки. CSS не отменяет предпочтения пользователя.',
           'Плавная прокрутка отключается при prefers-reduced-motion.',
           'В forced-colors сохраняется системная полоса; не назначайте роль scrollbar обычному контейнеру.'],
  'tokens': ['dk-scrollview'],
  'code_intro': 'Только HTML/CSS. Скрипт иконок подключается вместе с основой кита.',
  'code': '<div class="dk-scrollview" tabindex="0" role="region" aria-label="Список отчётов" '
          'style="--scrollview-height:200px"><div class="dk-row"><span class="dk-row__label">Отчёт '
          '1</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span '
          'class="dk-row__label">Отчёт 2</span><span class="dk-row__value">Готов</span></div><div '
          'class="dk-row"><span class="dk-row__label">Отчёт 3</span><span '
          'class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт '
          '4</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span '
          'class="dk-row__label">Отчёт 5</span><span class="dk-row__value">Готов</span></div><div '
          'class="dk-row"><span class="dk-row__label">Отчёт 6</span><span '
          'class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт '
          '7</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span '
          'class="dk-row__label">Отчёт 8</span><span class="dk-row__value">Готов</span></div><div '
          'class="dk-row"><span class="dk-row__label">Отчёт 9</span><span '
          'class="dk-row__value">Готов</span></div><div class="dk-row"><span class="dk-row__label">Отчёт '
          '10</span><span class="dk-row__value">Готов</span></div><div class="dk-row"><span '
          'class="dk-row__label">Отчёт 11</span><span class="dk-row__value">Готов</span></div><div '
          'class="dk-row"><span class="dk-row__label">Отчёт 12</span><span '
          'class="dk-row__value">Готов</span></div></div>',
  'api': [('--scrollview-height', 'переменная в style', 'Ограничение высоты, по умолчанию 320px.'),
          ('scroll', 'DOM-событие', 'Стандартный addEventListener; никаких особых API.'),
          ('scrollTo', 'DOM-метод', 'Нативная программная прокрутка.')],
  'related': [('component-table.html', 'Таблица', 'Для таблиц есть dk-tablewrap'),
              ('https://vkui.io/components/custom-scroll-view/',
               'Референс VKUI',
               'Нативная оформленная прокрутка')]}]

PAGES.append({'slug': 'onboarding',
 'title': 'Онбординг-подсказка',
 'group': 'Обратная связь',
 'status': 'стабильный',
 'purpose': 'Короткое знакомство с новым действием: одна подсказка рядом с нужным элементом за раз.',
 'files': ['css/components.css', 'js/dk-onboarding.js'],
 'scripts': ['dk-onboarding.js'],
 'live_intro': 'Запустите два шага. Можно пройти, пропустить или закрыть Escape.',
 'live': '<div class="dk-panel"><div class="dk-inline"><button class="dk-btn dk-btn--sm" '
         'id="onboard-period">30 дней</button><button class="dk-btn dk-btn--sm" '
         'id="onboard-export">Экспорт</button><button class="dk-btn dk-btn--sm dk-btn--primary" '
         'id="onboard-start">Показать подсказки</button></div><p class="dk-hint" id="onboard-status" '
         'role="status"></p></div>',
 'live_script': "window.addEventListener('DOMContentLoaded', function () {\n"
                '  var tour = dkOnboarding({steps:[\n'
                "    {target:'#onboard-period', title:'Выберите период', text:'Период применяется ко всем "
                "показателям экрана.'},\n"
                "    {target:'#onboard-export', title:'Сохраните отчёт', text:'Экспорт использует выбранный "
                "период и фильтры.'}\n"
                "  ], onClose:function(reason){document.getElementById('onboard-status').textContent = "
                "reason === 'complete' ? 'Знакомство завершено' : 'Подсказки закрыты';}});\n"
                "  document.getElementById('onboard-start').addEventListener('click', "
                'function(){tour.start();});\n'
                '});',
 'when_yes': ['Новая функция требует первого знакомства в контексте интерфейса.',
              'Короткая последовательность действий, которую можно пропустить.'],
 'when_no': ['Обычная подсказка при наведении — это tooltip, а не онбординг.',
             'Обязательная инструкция или ошибка должна быть видна постоянно.'],
 'anatomy_html': '<div class="dk-panel"><b class="sc-callout">1</b> Целевой элемент<br><b '
                 'class="sc-callout">2</b> Заголовок и объяснение<br><b class="sc-callout">3</b> Шаг и '
                 'кнопки перехода</div>',
 'anatomy': [('Цель', 'Элемент выделен контуром; подсказка располагается рядом.'),
             ('Объяснение', 'Короткое название и одно предложение о действии.'),
             ('Управление', 'Назад, Далее / Готово и Пропустить.')],
 'sizes': 'Ширина до 320 px, отступ от края экрана минимум 16 px. При нехватке места позиция меняется; '
          'длинное содержимое прокручивается.',
 'variants': [('Один шаг', 'Одна подсказка, кнопка «Готово».', 'Одна новая функция.'),
              ('Несколько шагов', 'Последовательные подсказки, одна видна за раз.', 'Короткое знакомство.'),
              ('storageKey',
               'Запоминает завершение и пропуск между сессиями.',
               'Показ один раз; ключ с версией сценария.')],
 'states': '<div class="dk-panel">До запуска ничего не показано. В живом примере доступны раскрытие, '
           'следующий шаг, возврат, завершение и пропуск.</div>',
 'content_ok': ['«Выберите период» — объясняет конкретное действие.',
                'Не более одного короткого объяснения на шаг.'],
 'content_bad': ['Несколько подсказок одновременно.',
                 'Онбординг запускается при каждом посещении без возможности пропуска.'],
 'a11y': ['Нативный dialog.showModal: фокус внутри, фон недоступен для взаимодействия.',
          'Заголовок и описание связаны через aria-labelledby / aria-describedby.',
          'Escape и внешний клик закрывают; фокус возвращается к кнопке запуска.',
          'Подсказка не исчезает по таймеру. При исчезновении цели сценарий закрывается.'],
 'tokens': ['dk-onboarding'],
 'code_intro': 'Подключите dk-onboarding.js после основы кита. Не запускается автоматически; хранение можно '
               'включить storageKey.',
 'code': '<div class="dk-panel"><div class="dk-inline"><button class="dk-btn dk-btn--sm" '
         'id="onboard-period">30 дней</button><button class="dk-btn dk-btn--sm" '
         'id="onboard-export">Экспорт</button><button class="dk-btn dk-btn--sm dk-btn--primary" '
         'id="onboard-start">Показать подсказки</button></div><p class="dk-hint" id="onboard-status" '
         'role="status"></p></div>\n'
         '<script>\n'
         "window.addEventListener('DOMContentLoaded', function () {\n"
         '  var tour = dkOnboarding({steps:[\n'
         "    {target:'#onboard-period', title:'Выберите период', text:'Период применяется ко всем "
         "показателям экрана.'},\n"
         "    {target:'#onboard-export', title:'Сохраните отчёт', text:'Экспорт использует выбранный период "
         "и фильтры.'}\n"
         "  ], onClose:function(reason){document.getElementById('onboard-status').textContent = reason === "
         "'complete' ? 'Знакомство завершено' : 'Подсказки закрыты';}});\n"
         "  document.getElementById('onboard-start').addEventListener('click', function(){tour.start();});\n"
         '});\n'
         '</script>',
 'api': [('dkOnboarding(options)',
          'функция',
          'Создаёт контроллер; steps — target (селектор или элемент), title, text.'),
         ('start(force)',
          'метод',
          'Показывает первый шаг. force=true позволяет повторить завершённый сценарий.'),
         ('close() / destroy()', 'методы', 'Закрывает / закрывает и освобождает контроллер.'),
         ('storageKey', 'строка', 'Необязательный ключ localStorage; завершение и пропуск отмечаются done.'),
         ('onClose(reason)',
          'функция',
          'complete, skip, escape, outside, close, destroy или missing-target.')],
 'related': [('component-modal.html', 'Модальное окно', 'Задача с обязательным действием'),
             ('https://vkui.io/components/onboarding-tooltip/',
              'Референс VKUI',
              'Последовательность и доступность')]})

PAGES.append({'slug': 'flex',
 'title': 'Flex · гибкая раскладка',
 'group': 'Утилиты',
 'status': 'стабильный',
 'purpose': 'Раскладка элементов в строку или колонку с общими отступами и выравниванием.',
 'files': ['css/components.css'],
 'scripts': [],
 'live_intro': 'Рабочий пример в контексте: попробуйте изменение ширины и клавиатуру.',
 'live': '<div class="dk-panel"><div class="dk-flex dk-flex--between"><span>Отчёты</span><div '
         'class="dk-flex"><button class="dk-btn dk-btn--sm">Обновить</button><button class="dk-btn '
         'dk-btn--sm">Экспорт</button></div></div></div>',
 'when_yes': ['Кнопки и подписи внутри одной группы.', 'Колонка элементов с одинаковым интервалом.'],
 'when_no': ['Сетка карточек — CardGrid или dk-grid.', 'Не меняйте визуальный порядок относительно DOM.'],
 'anatomy_html': '<div class="dk-panel"><b class="sc-callout">1</b> Контейнер<br><b class="sc-callout">2</b> '
                 'Содержимое и управление</div>',
 'anatomy': [('Контейнер', 'Задаёт раскладку или поведение.'),
             ('Содержимое', 'Названия, данные и доступные действия задаёт приложение.')],
 'sizes': 'Используются общие токены интервалов и размеров контролов. Соседние карточки растягиваются до '
          'одинаковой высоты; текст не обрезается.',
 'variants': [('dk-flex', 'Строка с переносом.', 'По умолчанию.'),
              ('dk-flex--column', 'Колонка.', 'Вертикальная группа.'),
              ('dk-flex--between / --center', 'Распределение по главной оси.', 'Шапка / центрирование.'),
              ('dk-flex--start / --stretch',
               'Выравнивание по поперечной оси.',
               'Разная высота / одинаковая высота.'),
              ('dk-flex--nowrap', 'Без переноса.', 'Только если содержимое помещается.')],
 'states': '<div class="dk-panel">Основные состояния доступны в живом примере и описаны в таблице '
           'вариантов.</div>',
 'content_ok': ['Полные названия объектов и конкретные действия.'],
 'content_bad': ['Непонятные подписи «Далее» для перехода к объектам без контекста.'],
 'a11y': ['Порядок чтения и Tab соответствует DOM; не используйте reverse для смысловой перестановки.',
          'На телефоне кнопки имеют область нажатия минимум 44 px.'],
 'tokens': ['dk-flex'],
 'code_intro': 'Используйте общую основу и подключите скрипты в порядке описи кита.',
 'code': '<div class="dk-flex dk-flex--between"><span>Отчёты</span><div class="dk-flex"><button '
         'class="dk-btn dk-btn--sm">Обновить</button><button class="dk-btn '
         'dk-btn--sm">Экспорт</button></div></div>',
 'api': [('--flex-gap', 'переменная в style', 'По умолчанию --gap-inline; используйте токен интервала.')],
 'related': [('https://vkui.io/components/flex/', 'Референс VKUI', 'Структура и поведение')]})

PAGES.append({'slug': 'card-grid',
 'title': 'Сетка карточек · CardGrid',
 'group': 'Утилиты',
 'status': 'стабильный',
 'purpose': 'Адаптивная сетка карточек с равной высотой соседей.',
 'files': ['css/components.css'],
 'scripts': [],
 'live_intro': 'Рабочий пример в контексте: попробуйте изменение ширины и клавиатуру.',
 'live': '<div class="dk-panel"><ul class="dk-card-grid" aria-label="Отчёты"><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 1</h3><p>Продажи по каналам.</p><button '
         'class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 2</h3><p>Продажи по каналам и категориям '
         'товаров.</p><button class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div '
         'class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 3</h3><p>Продажи по '
         'каналам.</p><button class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li></ul></div>',
 'when_yes': ['Сравнить несколько равноправных объектов.',
              'Все карточки должны быть видны в потоке страницы.'],
 'when_no': ['Сложный дашборд с разными долями виджетов — dk-grid.',
             'Последовательные истории — CardScroll.'],
 'anatomy_html': '<div class="dk-panel"><b class="sc-callout">1</b> Контейнер<br><b class="sc-callout">2</b> '
                 'Содержимое и управление</div>',
 'anatomy': [('Контейнер', 'Задаёт раскладку или поведение.'),
             ('Содержимое', 'Названия, данные и доступные действия задаёт приложение.')],
 'sizes': 'Используются общие токены интервалов и размеров контролов. Соседние карточки растягиваются до '
          'одинаковой высоты; текст не обрезается.',
 'variants': [('dk-card-grid', 'Минимальная ширина 240 px, число колонок по месту.', 'Компактные карточки.'),
              ('dk-card-grid--m', 'Минимальная ширина 360 px.', 'Карточки с большим объёмом текста.'),
              ('dk-card-grid--l', 'Одна колонка.', 'Широкие карточки.')],
 'states': '<div class="dk-panel">Основные состояния доступны в живом примере и описаны в таблице '
           'вариантов.</div>',
 'content_ok': ['Полные названия объектов и конкретные действия.'],
 'content_bad': ['Непонятные подписи «Далее» для перехода к объектам без контекста.'],
 'a11y': ['Порядок чтения и Tab соответствует DOM; не используйте reverse для смысловой перестановки.',
          'На телефоне кнопки имеют область нажатия минимум 44 px.'],
 'tokens': ['dk-card-grid'],
 'code_intro': 'Используйте общую основу и подключите скрипты в порядке описи кита.',
 'code': '<ul class="dk-card-grid" aria-label="Отчёты"><li><div class="dk-widget dk-widget--s"><h3 '
         'class="dk-widget__title">Отчёт 1</h3><p>Продажи по каналам.</p><button class="dk-btn '
         'dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div class="dk-widget dk-widget--s"><h3 '
         'class="dk-widget__title">Отчёт 2</h3><p>Продажи по каналам и категориям товаров.</p><button '
         'class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 3</h3><p>Продажи по каналам.</p><button '
         'class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li></ul>',
 'api': [('--card-min-width', 'переменная в style', 'Минимальная ширина, не больше ширины контейнера.')],
 'related': [('https://vkui.io/components/card-grid/', 'Референс VKUI', 'Структура и поведение')]})

PAGES.append({'slug': 'card-scroll',
 'title': 'Лента карточек · CardScroll',
 'group': 'Утилиты',
 'status': 'стабильный',
 'purpose': 'Горизонтальный список карточек с нативной прокруткой и кнопками навигации.',
 'files': ['css/components.css', 'js/dk-card-scroll.js'],
 'scripts': ['dk-card-scroll.js'],
 'live_intro': 'Рабочий пример в контексте: попробуйте изменение ширины и клавиатуру.',
 'live': '<div class="dk-panel"><div class="dk-card-scroll" id="demo-cards"><div '
         'class="dk-card-scroll__actions"><button class="dk-iconbtn dk-iconbtn--sm dk-scroll-arrow" '
         'data-scroll-prev aria-label="Предыдущие отчёты"><svg class="dk-i dk-i--adaptive" '
         'aria-hidden="true"><use href="#ti-chevron-left"/></svg></button><button class="dk-iconbtn '
         'dk-iconbtn--sm dk-scroll-arrow" data-scroll-next aria-label="Следующие отчёты"><svg class="dk-i '
         'dk-i--adaptive" aria-hidden="true"><use href="#ti-chevron-right"/></svg></button></div><ul '
         'class="dk-card-scroll__list" tabindex="0" aria-label="Отчёты"><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 1</h3><p>Продажи по каналам.</p><button '
         'class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 2</h3><p>Продажи по каналам и категориям '
         'товаров.</p><button class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div '
         'class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 3</h3><p>Продажи по '
         'каналам.</p><button class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div '
         'class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 4</h3><p>Продажи по каналам и '
         'категориям товаров.</p><button class="dk-btn dk-btn--sm">Открыть отчёт '
         '{n}</button></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт '
         '5</h3><p>Продажи по каналам.</p><button class="dk-btn dk-btn--sm">Открыть отчёт '
         '{n}</button></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт '
         '6</h3><p>Продажи по каналам и категориям товаров.</p><button class="dk-btn dk-btn--sm">Открыть '
         'отчёт {n}</button></div></li></ul></div></div>',
 'when_yes': ['Последовательность отчётов, материалов или историй.',
              'На телефоне виден край следующей карточки.'],
 'when_no': ['Основные KPI должны быть видны одновременно — CardGrid.',
             'Не включайте автоматическое перелистывание.'],
 'anatomy_html': '<div class="dk-panel"><b class="sc-callout">1</b> Контейнер<br><b class="sc-callout">2</b> '
                 'Содержимое и управление</div>',
 'anatomy': [('Контейнер', 'Задаёт раскладку или поведение.'),
             ('Содержимое', 'Названия, данные и доступные действия задаёт приложение.')],
 'sizes': 'Используются общие токены интервалов и размеров контролов. Соседние карточки растягиваются до '
          'одинаковой высоты; текст не обрезается.',
 'variants': [('dk-card-scroll__list',
               'Горизонтальный список одинаковой высоты.',
               'ul/li сохраняют семантику.'),
              ('dk-card-scroll__actions',
               'Кнопки предыдущего и следующего фрагмента.',
               'Над списком, без наложения на контент.')],
 'states': '<div class="dk-panel">Основные состояния доступны в живом примере и описаны в таблице '
           'вариантов.</div>',
 'content_ok': ['Полные названия объектов и конкретные действия.'],
 'content_bad': ['Непонятные подписи «Далее» для перехода к объектам без контекста.'],
 'a11y': ['Список ul/li, кнопки со смысловыми aria-label.',
          'Tab достигает карточек; стрелки показывают недоступность направления через disabled.',
          'Нативная прокрутка и prefers-reduced-motion сохранены; автоматического перелистывания нет.',
          'RTL: направление перемещения учитывает direction списка.'],
 'tokens': ['dk-card-scroll'],
 'code_intro': 'Используйте общую основу и подключите скрипты в порядке описи кита.',
 'code': '<div class="dk-card-scroll" id="demo-cards"><div class="dk-card-scroll__actions"><button '
         'class="dk-iconbtn dk-iconbtn--sm dk-scroll-arrow" data-scroll-prev aria-label="Предыдущие '
         'отчёты"><svg class="dk-i dk-i--adaptive" aria-hidden="true"><use '
         'href="#ti-chevron-left"/></svg></button><button class="dk-iconbtn dk-iconbtn--sm dk-scroll-arrow" '
         'data-scroll-next aria-label="Следующие отчёты"><svg class="dk-i dk-i--adaptive" '
         'aria-hidden="true"><use href="#ti-chevron-right"/></svg></button></div><ul '
         'class="dk-card-scroll__list" tabindex="0" aria-label="Отчёты"><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 1</h3><p>Продажи по каналам.</p><button '
         'class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 2</h3><p>Продажи по каналам и категориям '
         'товаров.</p><button class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div '
         'class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 3</h3><p>Продажи по '
         'каналам.</p><button class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div '
         'class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 4</h3><p>Продажи по каналам и '
         'категориям товаров.</p><button class="dk-btn dk-btn--sm">Открыть отчёт '
         '{n}</button></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт '
         '5</h3><p>Продажи по каналам.</p><button class="dk-btn dk-btn--sm">Открыть отчёт '
         '{n}</button></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт '
         '6</h3><p>Продажи по каналам и категориям товаров.</p><button class="dk-btn dk-btn--sm">Открыть '
         'отчёт {n}</button></div></li></ul></div>\n'
         '<script>\n'
         "window.addEventListener('DOMContentLoaded',function(){dkCardScroll('#demo-cards');});\n"
         '</script>',
 'api': [('dkCardScroll(root)', 'функция', 'Подключает стрелки и обновляет доступность на границах.'),
         ('refresh() / destroy()', 'методы', 'Обновить границы / удалить обработчики и наблюдателей.'),
         ('--card-width',
          'переменная в style',
          'Ширина карточки, по умолчанию 260 px; ограничена 80% списка.')],
 'related': [('https://vkui.io/components/card-scroll/', 'Референс VKUI', 'Структура и поведение')],
 'live_script': "window.addEventListener('DOMContentLoaded',function(){dkCardScroll('#demo-cards');});"})

PAGES.append({'slug': 'scroll-arrow',
 'title': 'Стрелка прокрутки',
 'group': 'Утилиты',
 'status': 'стабильный',
 'purpose': 'Доступная кнопка перемещения по прокручиваемому содержимому.',
 'files': ['css/components.css', 'js/dk-card-scroll.js'],
 'scripts': ['dk-card-scroll.js'],
 'live_intro': 'Рабочий пример в контексте: попробуйте изменение ширины и клавиатуру.',
 'live': '<div class="dk-panel"><div class="dk-card-scroll" id="demo-cards"><div '
         'class="dk-card-scroll__actions"><button class="dk-iconbtn dk-iconbtn--sm dk-scroll-arrow" '
         'data-scroll-prev aria-label="Предыдущие отчёты"><svg class="dk-i dk-i--adaptive" '
         'aria-hidden="true"><use href="#ti-chevron-left"/></svg></button><button class="dk-iconbtn '
         'dk-iconbtn--sm dk-scroll-arrow" data-scroll-next aria-label="Следующие отчёты"><svg class="dk-i '
         'dk-i--adaptive" aria-hidden="true"><use href="#ti-chevron-right"/></svg></button></div><ul '
         'class="dk-card-scroll__list" tabindex="0" aria-label="Отчёты"><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 1</h3><p>Продажи по каналам.</p><button '
         'class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 2</h3><p>Продажи по каналам и категориям '
         'товаров.</p><button class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div '
         'class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 3</h3><p>Продажи по '
         'каналам.</p><button class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div '
         'class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 4</h3><p>Продажи по каналам и '
         'категориям товаров.</p><button class="dk-btn dk-btn--sm">Открыть отчёт '
         '{n}</button></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт '
         '5</h3><p>Продажи по каналам.</p><button class="dk-btn dk-btn--sm">Открыть отчёт '
         '{n}</button></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт '
         '6</h3><p>Продажи по каналам и категориям товаров.</p><button class="dk-btn dk-btn--sm">Открыть '
         'отчёт {n}</button></div></li></ul></div></div>',
 'when_yes': ['Следующий или предыдущий фрагмент горизонтального списка.'],
 'when_no': ['Стрелка перехода на страницу — обычная ссылка.', 'Одна иконка без имени действия.'],
 'anatomy_html': '<div class="dk-panel"><b class="sc-callout">1</b> Контейнер<br><b class="sc-callout">2</b> '
                 'Содержимое и управление</div>',
 'anatomy': [('Контейнер', 'Задаёт раскладку или поведение.'),
             ('Содержимое', 'Названия, данные и доступные действия задаёт приложение.')],
 'sizes': 'Используются общие токены интервалов и размеров контролов. Соседние карточки растягиваются до '
          'одинаковой высоты; текст не обрезается.',
 'variants': [('dk-scroll-arrow', 'Контурная кнопка без тени.', 'С dk-iconbtn.'),
              ('disabled', 'Недоступное направление.', 'В начале / конце или без переполнения.')],
 'states': '<div class="dk-panel">Основные состояния доступны в живом примере и описаны в таблице '
           'вариантов.</div>',
 'content_ok': ['Полные названия объектов и конкретные действия.'],
 'content_bad': ['Непонятные подписи «Далее» для перехода к объектам без контекста.'],
 'a11y': ['Список ul/li, кнопки со смысловыми aria-label.',
          'Tab достигает карточек; стрелки показывают недоступность направления через disabled.',
          'Нативная прокрутка и prefers-reduced-motion сохранены; автоматического перелистывания нет.',
          'RTL: направление перемещения учитывает direction списка.'],
 'tokens': ['dk-scroll-arrow'],
 'code_intro': 'Используйте общую основу и подключите скрипты в порядке описи кита.',
 'code': '<div class="dk-card-scroll" id="demo-cards"><div class="dk-card-scroll__actions"><button '
         'class="dk-iconbtn dk-iconbtn--sm dk-scroll-arrow" data-scroll-prev aria-label="Предыдущие '
         'отчёты"><svg class="dk-i dk-i--adaptive" aria-hidden="true"><use '
         'href="#ti-chevron-left"/></svg></button><button class="dk-iconbtn dk-iconbtn--sm dk-scroll-arrow" '
         'data-scroll-next aria-label="Следующие отчёты"><svg class="dk-i dk-i--adaptive" '
         'aria-hidden="true"><use href="#ti-chevron-right"/></svg></button></div><ul '
         'class="dk-card-scroll__list" tabindex="0" aria-label="Отчёты"><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 1</h3><p>Продажи по каналам.</p><button '
         'class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div class="dk-widget '
         'dk-widget--s"><h3 class="dk-widget__title">Отчёт 2</h3><p>Продажи по каналам и категориям '
         'товаров.</p><button class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div '
         'class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 3</h3><p>Продажи по '
         'каналам.</p><button class="dk-btn dk-btn--sm">Открыть отчёт {n}</button></div></li><li><div '
         'class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт 4</h3><p>Продажи по каналам и '
         'категориям товаров.</p><button class="dk-btn dk-btn--sm">Открыть отчёт '
         '{n}</button></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт '
         '5</h3><p>Продажи по каналам.</p><button class="dk-btn dk-btn--sm">Открыть отчёт '
         '{n}</button></div></li><li><div class="dk-widget dk-widget--s"><h3 class="dk-widget__title">Отчёт '
         '6</h3><p>Продажи по каналам и категориям товаров.</p><button class="dk-btn dk-btn--sm">Открыть '
         'отчёт {n}</button></div></li></ul></div>\n'
         '<script>\n'
         "window.addEventListener('DOMContentLoaded',function(){dkCardScroll('#demo-cards');});\n"
         '</script>',
 'api': [('aria-label', 'HTML-атрибут', 'Называет действие: «Следующие отчёты».'),
         ('data-scroll-prev / data-scroll-next', 'HTML-атрибуты', 'Подключение к dkCardScroll.')],
 'related': [('https://vkui.io/components/scroll-arrow/', 'Референс VKUI', 'Структура и поведение')],
 'live_script': "window.addEventListener('DOMContentLoaded',function(){dkCardScroll('#demo-cards');});"})

PAGES.append({'slug': 'popout',
 'title': 'Всплывающий слой · PopoutWrapper',
 'group': 'Утилиты',
 'status': 'стабильный',
 'purpose': 'Оболочка модального слоя: размещение, подложка и недоступный фон.',
 'files': ['css/components.css', 'js/dk-modal.js'],
 'scripts': ['dk-modal.js'],
 'live_intro': 'Рабочий пример в контексте: попробуйте изменение ширины и клавиатуру.',
 'live': '<div class="dk-panel"><button class="dk-btn dk-btn--sm" data-modal="#demo-popout">Открыть '
         'слой</button><dialog class="dk-modal dk-popout" id="demo-popout" '
         'aria-labelledby="demo-popout-title"><div class="dk-modal__head"><h2 class="dk-modal__title" '
         'id="demo-popout-title">Настройки отчёта</h2></div><div class="dk-modal__body"><p>Это всплывающий '
         'слой с затемнением и фокусом внутри.</p></div><form method="dialog" class="dk-modal__foot"><button '
         'class="dk-btn dk-btn--sm">Закрыть</button></form></dialog></div>',
 'when_yes': ['Модальное содержимое поверх страницы.', 'Окно по центру или у края экрана.'],
 'when_no': ['Подсказка рядом с действием — Onboarding.', 'Не открывайте второй слой поверх первого.'],
 'anatomy_html': '<div class="dk-panel"><b class="sc-callout">1</b> Контейнер<br><b class="sc-callout">2</b> '
                 'Содержимое и управление</div>',
 'anatomy': [('Контейнер', 'Задаёт раскладку или поведение.'),
             ('Содержимое', 'Названия, данные и доступные действия задаёт приложение.')],
 'sizes': 'Используются общие токены интервалов и размеров контролов. Соседние карточки растягиваются до '
          'одинаковой высоты; текст не обрезается.',
 'variants': [('dk-popout', 'Ограничение размера и подложка.', 'Добавьте к dk-modal.'),
              ('dk-popout--top / --bottom', 'У верхнего / нижнего края.', 'Панель или действие.'),
              ('dk-popout--left / --right', 'У бокового края.', 'Боковая панель.'),
              ('dk-popout--clear',
               'Прозрачная подложка, фон остаётся inert.',
               'Только когда это не мешает пониманию модальности.')],
 'states': '<div class="dk-panel">Основные состояния доступны в живом примере и описаны в таблице '
           'вариантов.</div>',
 'content_ok': ['Полные названия объектов и конкретные действия.'],
 'content_bad': ['Непонятные подписи «Далее» для перехода к объектам без контекста.'],
 'a11y': ['Закрытие доступно кнопкой и Escape; фокус возвращается к запуску.',
          'Заголовок окна связан через aria-labelledby. Фон исключается нативным showModal.',
          'Не выдавайте один цикл Tab за полноценную модальность или недоступность фона.'],
 'tokens': ['dk-popout'],
 'code_intro': 'Используйте общую основу и подключите скрипты в порядке описи кита.',
 'code': '<button class="dk-btn dk-btn--sm" data-modal="#demo-popout">Открыть слой</button><dialog '
         'class="dk-modal dk-popout" id="demo-popout" aria-labelledby="demo-popout-title"><div '
         'class="dk-modal__head"><h2 class="dk-modal__title" id="demo-popout-title">Настройки '
         'отчёта</h2></div><div class="dk-modal__body"><p>Это всплывающий слой с затемнением и фокусом '
         'внутри.</p></div><form method="dialog" class="dk-modal__foot"><button class="dk-btn '
         'dk-btn--sm">Закрыть</button></form></dialog>',
 'api': [('dkModal(root).open() / close()',
          'методы',
          'Нативный dialog; фокус и Escape поддерживает существующий контроллер.'),
         ('data-modal', 'HTML-атрибут', 'Селектор окна для открытия кнопкой.')],
 'related': [('https://vkui.io/components/popout-wrapper/', 'Референс VKUI', 'Структура и поведение')]})

PAGES.append({'slug': 'focus-trap',
 'title': 'Удержание фокуса · FocusTrap',
 'group': 'Утилиты',
 'status': 'стабильный',
 'purpose': 'Tab и Shift+Tab циклически обходят интерактивные элементы открытого слоя.',
 'files': ['css/components.css', 'js/dk-focus-trap.js'],
 'scripts': ['dk-focus-trap.js'],
 'live_intro': 'Рабочий пример в контексте: попробуйте изменение ширины и клавиатуру.',
 'live': '<div class="dk-panel"><button class="dk-btn dk-btn--sm" id="demo-trap-start">Проверить '
         'фокус</button><dialog class="dk-modal dk-popout" id="demo-trap" '
         'aria-labelledby="demo-trap-title"><div class="dk-modal__head"><h2 class="dk-modal__title" '
         'id="demo-trap-title">Проверка фокуса</h2></div><div class="dk-modal__body"><p>Tab и Shift+Tab '
         'остаются внутри. Escape закрывает окно.</p><button class="dk-btn dk-btn--sm">Первое '
         'действие</button><button class="dk-btn dk-btn--sm">Второе действие</button></div><form '
         'method="dialog" class="dk-modal__foot"><button class="dk-btn '
         'dk-btn--sm">Закрыть</button></form></dialog></div>',
 'when_yes': ['Собственный всплывающий слой, где фокус должен оставаться до закрытия.'],
 'when_no': ['Не удерживайте фокус в обычной карточке или меню страницы.',
             'Нативный dialog.showModal уже исключает фон; helper дополняет цикл, но не заменяет inert.'],
 'anatomy_html': '<div class="dk-panel"><b class="sc-callout">1</b> Контейнер<br><b class="sc-callout">2</b> '
                 'Содержимое и управление</div>',
 'anatomy': [('Контейнер', 'Задаёт раскладку или поведение.'),
             ('Содержимое', 'Названия, данные и доступные действия задаёт приложение.')],
 'sizes': 'Используются общие токены интервалов и размеров контролов. Соседние карточки растягиваются до '
          'одинаковой высоты; текст не обрезается.',
 'variants': [('autoFocus: true / root / false',
               'Первый элемент / корень / без автофокуса.',
               'Зависит от содержимого.'),
              ('restoreFocus: false',
               'Не возвращать фокус.',
               'Только когда приложение управляет этим само.')],
 'states': '<div class="dk-panel">Основные состояния доступны в живом примере и описаны в таблице '
           'вариантов.</div>',
 'content_ok': ['Полные названия объектов и конкретные действия.'],
 'content_bad': ['Непонятные подписи «Далее» для перехода к объектам без контекста.'],
 'a11y': ['Закрытие доступно кнопкой и Escape; фокус возвращается к запуску.',
          'Заголовок окна связан через aria-labelledby. Фон исключается нативным showModal.',
          'Не выдавайте один цикл Tab за полноценную модальность или недоступность фона.'],
 'tokens': ['dk-focus-trap'],
 'code_intro': 'Используйте общую основу и подключите скрипты в порядке описи кита.',
 'code': '<button class="dk-btn dk-btn--sm" id="demo-trap-start">Проверить фокус</button><dialog '
         'class="dk-modal dk-popout" id="demo-trap" aria-labelledby="demo-trap-title"><div '
         'class="dk-modal__head"><h2 class="dk-modal__title" id="demo-trap-title">Проверка '
         'фокуса</h2></div><div class="dk-modal__body"><p>Tab и Shift+Tab остаются внутри. Escape закрывает '
         'окно.</p><button class="dk-btn dk-btn--sm">Первое действие</button><button class="dk-btn '
         'dk-btn--sm">Второе действие</button></div><form method="dialog" class="dk-modal__foot"><button '
         'class="dk-btn dk-btn--sm">Закрыть</button></form></dialog>\n'
         '<script>\n'
         "window.addEventListener('DOMContentLoaded',function(){\n"
         ' var '
         "button=document.getElementById('demo-trap-start'),dialog=document.getElementById('demo-trap'),trap;\n"
         ' '
         "button.addEventListener('click',function(){dialog.showModal();trap=dkFocusTrap(dialog,{onEscape:function(){dialog.close();}});});\n"
         " dialog.addEventListener('close',function(){if(trap){trap.destroy();trap=null;}button.focus();});\n"
         '});\n'
         '</script>',
 'api': [('dkFocusTrap(root, options)', 'функция', 'Устанавливает цикл фокуса.'),
         ('destroy()', 'метод', 'Снимает обработчики и возвращает предыдущий фокус.'),
         ('onEscape', 'функция', 'Обязательный путь закрытия для собственного слоя.')],
 'related': [('https://vkui.io/components/focus-trap/', 'Референс VKUI', 'Структура и поведение')],
 'live_script': "window.addEventListener('DOMContentLoaded',function(){\n"
                ' var '
                "button=document.getElementById('demo-trap-start'),dialog=document.getElementById('demo-trap'),trap;\n"
                ' '
                "button.addEventListener('click',function(){dialog.showModal();trap=dkFocusTrap(dialog,{onEscape:function(){dialog.close();}});});\n"
                ' '
                "dialog.addEventListener('close',function(){if(trap){trap.destroy();trap=null;}button.focus();});\n"
                '});'})

PAGES.append({'slug': 'touch',
 'title': 'Жесты · Touch',
 'group': 'Утилиты',
 'status': 'стабильный',
 'purpose': 'Начало, движение, завершение и отмена pointer-жеста для мыши, пера и тача.',
 'files': ['css/components.css', 'js/dk-touch.js'],
 'scripts': ['dk-touch.js'],
 'live_intro': 'Рабочий пример в контексте: попробуйте изменение ширины и клавиатуру.',
 'live': '<div class="dk-panel"><div class="dk-touch dk-touch--pan-y dk-panel" id="demo-touch" '
         'style="min-height:160px"><p>Проведите по этой области мышью или пальцем.</p><p class="dk-hint" '
         'id="demo-touch-status" role="status">Жестов пока нет</p></div></div>',
 'when_yes': ['Движение указателя в собственном слайдере или области жестов.'],
 'when_no': ['Обычная кнопка — нативный click, с клавиатурой.',
             'Не заменяйте нативную прокрутку ленты перехватом жестов.'],
 'anatomy_html': '<div class="dk-panel"><b class="sc-callout">1</b> Контейнер<br><b class="sc-callout">2</b> '
                 'Содержимое и управление</div>',
 'anatomy': [('Контейнер', 'Задаёт раскладку или поведение.'),
             ('Содержимое', 'Названия, данные и доступные действия задаёт приложение.')],
 'sizes': 'Используются общие токены интервалов и размеров контролов. Соседние карточки растягиваются до '
          'одинаковой высоты; текст не обрезается.',
 'variants': [('dk-touch', 'Нативные жесты браузера сохраняются.', 'По умолчанию.'),
              ('dk-touch--pan-y / --pan-x',
               'Сохраняет вертикальное / горизонтальное панорамирование.',
               'Собственный жест в другой оси.')],
 'states': '<div class="dk-panel">Основные состояния доступны в живом примере и описаны в таблице '
           'вариантов.</div>',
 'content_ok': ['Полные названия объектов и конкретные действия.'],
 'content_bad': ['Непонятные подписи «Далее» для перехода к объектам без контекста.'],
 'a11y': ['Жест не должен быть единственным способом выполнить действие: предусмотрите кнопки или '
          'клавиатуру.',
          'pointercancel обрабатывается отдельно от успешного завершения.',
          'Браузер сохраняет pan/zoom; helper не вызывает preventDefault.'],
 'tokens': ['dk-touch'],
 'code_intro': 'Используйте общую основу и подключите скрипты в порядке описи кита.',
 'code': '<div class="dk-touch dk-touch--pan-y dk-panel" id="demo-touch" '
         'style="min-height:160px"><p>Проведите по этой области мышью или пальцем.</p><p class="dk-hint" '
         'id="demo-touch-status" role="status">Жестов пока нет</p></div>\n'
         '<script>\n'
         "window.addEventListener('DOMContentLoaded',function(){\n"
         ' '
         "dkTouch('#demo-touch',{onEnd:function(data){document.getElementById('demo-touch-status').textContent=data.isSlide?'Сдвиг: "
         "'+Math.round(data.shiftX)+' × '+Math.round(data.shiftY)+' px':'Нажатие без "
         "перемещения';},onCancel:function(){document.getElementById('demo-touch-status').textContent='Жест "
         "отменён браузером';}});\n"
         '});\n'
         '</script>',
 'api': [('dkTouch(root, options)',
          'функция',
          'onStart, onMove, onEnd, onCancel; threshold по умолчанию 8 px.'),
         ('payload', 'объект', 'event, pointerType, startX/Y, shiftX/Y, duration, isSlide, isX/Y.'),
         ('destroy()', 'метод', 'Удаляет обработчики и освобождает pointer capture.')],
 'related': [('https://vkui.io/components/touch/', 'Референс VKUI', 'Структура и поведение')],
 'live_script': "window.addEventListener('DOMContentLoaded',function(){\n"
                ' '
                "dkTouch('#demo-touch',{onEnd:function(data){document.getElementById('demo-touch-status').textContent=data.isSlide?'Сдвиг: "
                "'+Math.round(data.shiftX)+' × '+Math.round(data.shiftY)+' px':'Нажатие без "
                "перемещения';},onCancel:function(){document.getElementById('demo-touch-status').textContent='Жест "
                "отменён браузером';}});\n"
                '});'})

for _page in PAGES:
    if _page['slug'] == 'onboarding':
        _page['scripts'] = ['dk-focus-trap.js', 'dk-onboarding.js']
        _page['code_intro'] = 'Подключите dk-focus-trap.js и dk-onboarding.js после основы. Сценарий запускается явно и не открывается поверх другого диалога.'
    if _page['slug'] in ['flex','card-grid','card-scroll','scroll-arrow','popout','focus-trap','touch']:
        _page['title'] = _page['title'].split(' · ')[0]

import re as _re
for _page in PAGES:
    if _page['slug'] in ['card-grid','card-scroll','scroll-arrow']:
        for _field in ['live','code']:
            _page[_field] = _re.sub(r'<button class="dk-btn dk-btn--sm">Открыть отчёт \{n\}</button>', '<a class="dk-btn dk-btn--sm" href="component-table.html">Открыть пример таблицы</a>', _page[_field])
