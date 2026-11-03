# Task 20 — один встраиваемый график

## Вход и закрепление

Точный вход сохранён в `input.txt` (UTF-8, завершающий LF):

> Добавь один график «Обращения за неделю» для встраивания в существующий рабочий экран. Дни Пн–Вс:34,28,31,40,36,12,9 обращений. Нужны понятное сравнение дней, единица и числовая альтернатива. Без дополнительного обзора, KPI или навигации. Пояснение по методике — по запросу; минимум постоянного текста, обе темы,390/1280.

SHA-256 входа: `157d02df1db620b6d13a85c6845d630212b7077e44b6ca50ddce1962066863be`.

Читаемый исходный кит: `/tmp/kit-evals-20261103/source`, предоставленный замороженный revision `c05b74d`. Нужные 22 файла скопированы без изменений в `app/kit`; список и SHA-256 каждого файла — `app/kit/PIN.json`. SHA-256 PIN: `0f208d546f1c1f240e2e7a5dbe59218fb3304f9a0fd5c4288513404bc233f8ee`.

Прочитаны AGENTS, dashboard-build/SKILL, assembly-rules, current-state, catalog list/charts/show/head и относящиеся composition/charts/checks/numeric-checks/recipes/product-review/uiux references, UIUX/policy и применимые разделы README/DESIGN/DECISIONS/REVIEW/HANDOFF. Не читались evals, ожидания, результаты других исполнителей или features proofs. Субагенты, git, сеть, сервер и браузер не запускались.

## Решение и артефакт

`app/index.html` — запускаемый статический пример с локальными ресурсами. Работает при открытии HTML или в существующей статической раздаче. Внешние зависимости и сборка отсутствуют. Один `section.dk-widget`, один dkChart bar, постоянно доступная числовая таблица в том же виджете, одна кнопка dkTooltip. Дополнительных KPI, обзора, навигации и оболочки приложения нет.

Бриф: пользователь существующего рабочего экрана сравнивает число обращений по дням недели и получает точные значения без наведения. Единица — обращения, интервал Пн–Вс. Календарная неделя, актуальность и правила учёта не заданы, поэтому даты и причинные выводы не придуманы. Рецепт operations подходит только по предметной задаче сравнения нагрузки; его экранные слоты не нужны для запроса одного виджета.

Столбцы сохраняют хронологию Пн–Вс и общую нулевую базу; это сравнение дневных дискретных количеств, а не непрерывная сглаженная динамика. Значения читаются в таблице с полными названиями дней. При узкой ширине график и таблица расположены друг под другом, при широкой — рядом внутри одной поверхности. Это намерение CSS, а не подтверждённая браузером геометрия.

Встраивание показано на вложенном `main.dk-root[data-theme][data-accent]`; у html нет dk-root, у body нет dk-page. Тема задаётся хозяином, глобальный dk-theme не подключён. Head получен через `kit.py head --embed chart tooltip widget widget-header table button layout`, изменён только префикс путей на `kit/`.

## Проверки и самостоятельная корректировка

- `python3 /tmp/kit-evals-20261103/source/tools/check.py --page /tmp/kit-evals-20261103/task20/app/index.html --fast` — exit 0; browser portion явно пропущен.
- `node --check app/widget.js` — exit 0.
- Локальная структурная проверка: ровно семь пар Пн34/Вт28/Ср31/Чт40/Пт36/Сб12/Вс9; ровно один section; все HTML/CSS ресурсы существуют локально; 22 pinned файла соответствуют SHA-256.
- Независимые ручные контрольные числа: сумма 190, максимум Чт40, минимум Вс9; сумма не вынесена в отдельный KPI. Модель графика читает те же исходные значения из числовой таблицы; форматирование через dkFmt.num, HTML из данных не собирается строками.
- Data correction: не потребовалась; после первоначальной разметки значения не менялись.
- UX correction: перед передачей выделена большая доля первой колонки таблицы (58%), чтобы полные названия дней получали больше места на 390; проверка фактического размещения ожидается. Второй редакторский проход сохранил ноль постоянных поясняющих предложений; видимы только заголовок, период/единица, дни, числа и действие сведений.
- Technical correction: не потребовалась после первого статического PASS. Параметр `--table-min:0px` убирает стандартный минимум 720px для небольшой двухколоночной таблицы через публичный параметр, не меняет кит.

Полный вывод — `checks.log`. SHA-256 `app/index.html`: `2cef24868a9044d7621f4ed1ced7de6c70c7f0c3181d9dfc7eb076a2fbec78a6`.

## Селекторы и API для проверки

- Корень: `#weekly-requests-root`.
- Единственный виджет: `#weekly-requests-widget`.
- Заголовок: `#weekly-requests-title`.
- График: `#weekly-requests-chart`; `window.weeklyRequests.chart.instance` — ECharts instance.
- Таблица: `#weekly-requests-table`, строки `tbody tr[data-day]`, числа `[data-value]`.
- Методика: `#weekly-requests-method`, имя «Методика и источник данных»; стандартный dkTooltip (hover/focus/click/Escape).
- Light: `app/index.html?theme=light`; Dark: `?theme=dark` (по умолчанию).
- После загрузки: `window.weeklyRequests.setTheme('light'|'dark')`; изменение темы также наблюдается самим dkChart через dk-root. API скрывает открытую методику перед сменой темы.
- Очистка: `window.weeklyRequests.destroy()`.

Применимые UI-003/UI-005/UI-010: единица и Пн–Вс видимы сразу, таблица содержит все семь чисел, служебная методика открывается одной кнопкой. Это содержательная статическая оценка; наблюдаемые результаты взаимодействия должен подтвердить браузерный проход. Ошибки/загрузка/пустое состояние не имитируются у фиксированного локального набора; таблица остаётся читаемой даже без выполнения JS.

## Ограничения и оставшаяся приёмка

Браузерная проверка ожидается у родительского агента: 390×844 и 1280×900, обе темы; отсутствие горизонтального переполнения; нулевая база и все семь меток; размер цели info; Tab/Shift+Tab/Enter/Space/hover/click/Escape; закрытие tooltip и изменение локальной темы; контраст/обрезка подписей и таблицы. Нужен отдельный просмотр 200% текста и 320px. Скриншотов и подтверждения визуальной готовности от этого исполнителя нет. Физический телефон и живой скринридер не проверялись. Источник не задаёт календарные даты, полноту учёта или время обновления, и виджет не выдаётся за подключение к production.

## Post-review technical correction 1 — official release package

Родительский review выявил, что первоначальный custom subset PIN не является официальным закреплением kit-release. Исходный PIN сохранён в `initial-subset-pin.json`; его полный состав до исправления:

```json
{
  "source": "/tmp/kit-evals-20261103/source",
  "revision": "c05b74d",
  "files": {
    "LICENSE": "d50a33f4d112b0c74390da57cddd1351c7ac82e77f77a518a5fa24877f068298",
    "THIRD_PARTY_NOTICES.txt": "2adb04cc805ffe2defc44436085ec53c15d7891efef8e3cf918683edc41c42a7",
    "assets/graphite-dark.png": "d212df2d6f3f6d41befd4b11ca743d791db767188120508b873966494cde8a5d",
    "assets/graphite-light.png": "cd330a9ef8bb163f2ffd1fb86e78a875c06e0638eaacf8bba082c191ae6d4d72",
    "css/components.css": "18a3ba9c2549c8652ba04295e88dd624fb43f911fbf056dd931782ffdf698c96",
    "css/tokens.primitives.css": "fac36e2e152d177a9bcbf5f3c610689d3953b33fd15002bc7ff2065bdab9aad1",
    "css/tokens.semantic.css": "b064676266a06e36c8abd553be8a3707e7aca6512ad6ac93f6463828fe72736b",
    "js/dk-chart-theme.js": "16b0c6cff1833ecfde43af0893e7e6c818c917bc037c62d3e4c1f69cff672bdf",
    "js/dk-charts.js": "633c75879676dfee7339fad08bd85fb0796454d0785c3f79a1b033ebbc6b7d15",
    "js/dk-context.js": "a1191301715ef4c0010c177d5b1b4315cedf23e1a5a6de12cae7e6617bdff0e9",
    "js/dk-icons.js": "841e8c93255b13fc64732ddcf380da262472a752a95bdc33fb04f3d68fe131e7",
    "js/dk-table.js": "e5b75840a74be1133150596c2fc55fed26c47dbb34fa39510eb540ad33050659",
    "js/dk-util.js": "837803c39ce320f4f4b35366a91af9c34e9337f7bd635ea67133964ba0f0c70d",
    "vendor/echarts.min.js": "8d008d338a7d3e042916af3f57499865a85cb5f8f5702a303409c5b9f47be580",
    "vendor/fonts/golos-400-cyrillic.woff2": "2f175b8fc40ed4e826742879f92ec903256fc2612d8d95c7c287232fd7138e4b",
    "vendor/fonts/golos-400-latin.woff2": "f8d71091110f0113ba8bd16bee2ac68b51dd6491c5b9404e9fbb82b20ae632f1",
    "vendor/fonts/golos-500-cyrillic.woff2": "2f175b8fc40ed4e826742879f92ec903256fc2612d8d95c7c287232fd7138e4b",
    "vendor/fonts/golos-500-latin.woff2": "f8d71091110f0113ba8bd16bee2ac68b51dd6491c5b9404e9fbb82b20ae632f1",
    "vendor/fonts/golos-600-cyrillic.woff2": "2f175b8fc40ed4e826742879f92ec903256fc2612d8d95c7c287232fd7138e4b",
    "vendor/fonts/golos-600-latin.woff2": "f8d71091110f0113ba8bd16bee2ac68b51dd6491c5b9404e9fbb82b20ae632f1",
    "vendor/fonts/golos-700-cyrillic.woff2": "2f175b8fc40ed4e826742879f92ec903256fc2612d8d95c7c287232fd7138e4b",
    "vendor/fonts/golos-700-latin.woff2": "f8d71091110f0113ba8bd16bee2ac68b51dd6491c5b9404e9fbb82b20ae632f1"
  }
}
```

Runtime заменён командой `python3 /tmp/kit-evals-20261103/source/tools/kit-release.py --pack /tmp/kit-evals-20261103/task20/official-runtime-pack` в новой директории; затем проверенный пакет перемещён в `app/kit`. Первоначальные runtime-файлы сохранены в `initial-runtime-subset/` для истории. `app/kit/PIN.json` больше не применяется; официальный descriptor — `app/kit/kit-release.json`.

Официальный consumer pin взят из frozen `source/kit-release.json`: `sha256:9802ab4ef705fe01270e6a19b5186c9bf4e81ddc6a429e147aa3b69a360aef20`. Версия `0.1.0-rc.7`, канал `candidate`, 100 runtime-файлов. `kit-release.py --verify app/kit --expect sha256:9802ab4ef705fe01270e6a19b5186c9bf4e81ddc6a429e147aa3b69a360aef20` — exit 0.

UI/HTML/CSS/JS приложения не менялись. SHA-256 `app/index.html` после исправления: `2cef24868a9044d7621f4ed1ced7de6c70c7f0c3181d9dfc7eb076a2fbec78a6`. Первоначальные утверждения о subset22/PIN выше оставлены как история и заменены этой поправкой. Браузерная проверка по-прежнему ожидается.
