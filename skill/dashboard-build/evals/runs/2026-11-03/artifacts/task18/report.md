# Task 18 · portfolio / partial

## Prompt

«Сравни регионы из tools/fixtures/numeric/mortgage-source.json по выдачам, выполнению и средней ставке. Нужны поиск, фильтр округа/месяца, сортировка и детали. Не выдумывай интегральную оценку. Дополнительно объясни в отчёте, почему готовых конверсий 10% и 90% без знаменателей недостаточно для общей конверсии. Покажи честное состояние при неполных исходных значениях, сохрани ноль отличимым от отсутствия».

Рабочая область: `/tmp/kit-evals-20261103/task18`. Чтение frozen kit `/tmp/kit-evals-20261103/source`, revision `c05b74d`. Eval expectations, runs, features proofs и reviews не читались. Числовые ответы ниже вычислены непосредственно по исходным 4 строкам; обязательный reference numeric-checks содержит ту же учебную таблицу.

## Kit digest / чтение

Прочитаны AGENTS, skill/dashboard-build/SKILL.md; assembly-rules, current-state; нужные секции README и DESIGN-UX-ACCESSIBILITY; UIUX и policy; references composition, recipes, numeric-checks, product-review, data, checks, extensions, phone; стандарт коротких деталей. Получены `kit.py list`, `show page-header widget-header widget table select search tile modal named-metrics button empty tooltip`; подключение сгенерировано `kit.py head base layout page-header widget table tile modal search select button check glass tooltip`.

Используются канонические kit CSS и JS, скопированные без изменений в `app/kit`. Порядок: dk-theme первым; primitives → semantic → components → glass; dk-util до компонентов. PIN.json фиксирует SHA-256 каждого runtime-файла, включая шрифты и graphite backgrounds; статический тест сверяет байты с frozen source.

`dkMetrics` v1 требует подтверждённую дневную гранулярность; фактический fixture месячный. Поэтому используется небольшой host aggregate с явным ожидаемым доменом наблюдений, без ложного объявления time=day. Никаких новых зависимостей или компонентных классов dk-* не добавлено.

## Бриф и состав

Аудитория — аналитик регионального ипотечного портфеля. Решение — выбрать регион для разбора по наблюдаемым выдачам, выполнению плана и взвешенной ставке. Рецепт portfolio. Устройства — desktop1280/mobile390, Dark/Light. Три KPI всего среза → одна сравнительная таблица → короткие месячные детали региона. Карта, динамика, общий балл и оценка желательности ставки не добавлены: эти вопросы не поставлены. Модель и редакторский проход выполнены последовательно автором; независимое ревью — родительский агент.

Основные вопросы → видимый ответ:

- Где больше выдач / ниже выполнение / выше ставка? Три отдельных столбца с сортировкой, без интегрального ранга.
- Какой срез? Округ и месяц в управляющих полях; период в шапке.
- Из чего сложился региональный итог? Месячные строки и три метрики в деталях.
- Можно ли доверять итогу при пропуске? «—», статус неполноты и известный subtotal суммы с coverage, а не ложный полный итог.

## Данные / независимые константы

Единица наблюдения — регион × месяц. Домен ожидания закреплён исходными 4 строками (2 региона × апрель/май). Фильтр применяется к домену до агрегирования; пропавшая строка сохраняет неполноту, а не исчезает из знаменателя покрытия.

- Выдано: сумма issued. План: сумма issuedPlan.
- Выполнение: Σ issued / Σ issuedPlan × 100%.
- Средняя ставка, %: Σ rateWeight / Σ volume / 100, так как rateWeight задан в б.п.·млн ₽.
- Среднее готовых региональных ставок не применяется.

| Срез | Выдано | План | Выполнение | Средняя ставка |
|---|---:|---:|---:|---:|
| Все | 100 | 200 | 50% | 6,6% |
| Санкт-Петербург / СЗФО | 40 | 50 | 80% | 4,5% |
| Республика Алтай / СФО | 60 | 150 | 40% | 8% |
| Май | 30 | 80 | 37,5% | 4% |
| Санкт-Петербург, май | 30 | 30 | 100% | 4% |
| Республика Алтай, май | 0 | 50 | 0% | —; нулевой объём |

Общая ставка — (60000 + 120000 + 480000) / (100 + 300 + 600) / 100 = 6,6%, не (4,5 + 8) / 2 = 6,25%.

Неполнота не меняет исходный JSON. Явные режимы демо:

1. «Неполные · демо»: у spb-2025-04 issued=null; у altai-rep-2025-04 отсутствует rateWeight. Общая сумма выдач недоступна, известная часть 90 из 3/4 наблюдений; выполнение и ставка недоступны. План остаётся 200. Май остаётся полным: выдачи 30, ставка 4%. Детали сохраняют отдельные пропуски.
2. «Пропуск строки · демо»: убран апрель Санкт-Петербурга, но домен ожидания остаётся 4 строки. Coverage 3/4; агрегаты не выдаются за полные.
3. Май Алтая: настоящий ноль issued=0 и выполнение=0, ставка отсутствует при volume=0. Нулевые rateWeight и volume не дают фиктивную ставку 0%.
4. Пустой поиск: нет регионов, KPI «—», действие восстановления.

### Почему конверсии 10% и 90% не дают общую конверсию

Общая конверсия = (успешные₁ + успешные₂) / (база₁ + база₂). Пары процентов не определяют веса:

- Базы 100 и 900: успехи 10 и 810 → 820/1000 = **82%**.
- Базы 900 и 100: успехи 90 и 90 → 180/1000 = **18%**.
- Только при равных базах общее значение равно 50%.

Нужны числители, знаменатели, одинаковые определения события/единицы и сопоставимые когорты/периоды; при пересечениях когорт нужна дедупликация. По одному среднему процентов нельзя выбрать правильный ответ. Исходные applied/approved в этой задаче не превращены в дополнительную воронку или интегральный балл.

## UX / текст

На обычном обзоре и в деталях нет постоянных поясняющих предложений: только названия, числа, единицы, общий период/дата, краткая метка «Демо», названия округов. Формулы, происхождение и ограничения открываются через «Методика» в dkModal. У отсутствующих/неполных значений остаются краткие статусы (§7 exception); пустой результат имеет действие восстановления. Сброс отсутствует без фильтра. Кнопка темы и сброс имеют dkTooltip; длинный текст не помещён в tooltip. Полные названия регионов не обрезаются.

Мобильный путь использует kit table--cards и явные кнопки сортировки; детали — kit detail modal (на mobile fullscreen). Возврат не пересоздаёт фильтры и сохраняет сортировку. dkModal обеспечивает native dialog, Escape/focus loop/возврат. Это проектное применение API, не утверждение о пройденной браузерной приёмке.

## Artifact / API для независимой проверки

Запуск: `app/index.html` как статическая страница; данные доступны локально через data.js, runtime не делает сетевых запросов. Исходный JSON также приложен. Тесты находятся рядом: model.test.cjs, static.test.py.

Селекторы:

- `#search` — поиск по региону, полному имени округа или аббревиатуре.
- `#district .dk-select__trigger`, `#month .dk-select__trigger`, `#mode .dk-select__trigger`; опции — `[role=option]`.
- `[data-kpi=issued] [data-value=issued]`, аналогично execution/rate (ограничить `#summary` для обзорных KPI).
- `#regions th[data-sortable=issued] button`, аналогично name/issuedPlan/execution/rate. `aria-sort` отражает направление.
- `#regions [data-region=spb]`, `#regions [data-region=altai-rep]`; ячейки `[data-key=issued]` / issuedPlan / execution / rate.
- `[data-detail=spb]`, `[data-detail=altai-rep]` — детали; `#details[open]`, `#detail-metrics`, `#detail-months [data-month="2025-05"]`.
- `#method-open`, `#method`, `#theme`, `#reset`, `#empty`, `#empty-reset`.

`window.portfolio`:

```js
portfolio.getView(); // clone totals + regions + monthly metrics and status codes
portfolio.getState();
portfolio.setFilters({search:'',district:'СФО',month:'2025-05',sort:'rate',dir:'asc'});
portfolio.setMode('partial'); // original | partial | missing-row
portfolio.openDetails('altai-rep');
portfolio.reset(); // filters only, keeps chosen data scenario/sort
portfolio.replaceSource(customJson); // expected domain stays pinned
portfolio.restoreSource();
```

## Technical checks

PASS: `node model.test.cjs` — отдельные числовые константы: всё/месяц/округ/поиск/пересечение, разные веса, настоящий ноль, null, отсутствующее поле/строка, пустой результат, сортировка.

PASS: `node --check app/app.js`.

PASS: `python3 static.test.py` — локальные HTML/CSS зависимости, шрифты/фоны, байтовая идентичность pinned runtime, классы dk-* из реальных CSS.

Браузерные UI binding, геометрия, обе темы при 390/1280, реальный клавиатурный маршрут: **PENDING у родительского агента**, не PASS. Полный suite не засчитывается.

## Self corrections

- Data: при проектировании сохранён исходный домен отдельно от actual rows, чтобы пропущенная строка не выглядела полным набором. Взвешенная ставка применяется к суммам исходников; partial никогда не пересчитывается по доступному подмножеству как общий итог.
- UX: методика вынесена по запросу; статус отсутствия и coverage оставлены у значения. Пустые поясняющие слоты не занимают место.
- Technical: перед сдачей обнаружен и исправлен mismatch callback dkTable (ascending/descending → asc/desc). Статическая проверка dependency graph обнаружила недокопированные шрифты и graphite PNG; оба семейства добавлены с хешами.
- Process: ошибочно вызван `source/tools/check.py --help`, ожидая справку. CLI проигнорировал --help и запустил проверки frozen kit, включая попытку browser modules/server listen. Обе попытки завершились EPERM на listen 127.0.0.1; браузер/сервер успешно не запускались. Это нарушение ограничения на попытку тяжёлого/browser suite, немедленно сообщённое родителю; результаты не являются проверкой приложения и не выданы за PASS. После этого использованы только собственные статические/unit проверки.

## Limits

Нет backend, загрузки сети, новых production-порогов, исходных весов для отдельных готовых конверсий, оценки причин. Набор учебный и исторический. Домен фиксирован исходным fixture; произвольное расширение регионов/месяцев требует обновить домен, а не только replaceSource. Смена темы, реальная сортировка/детали/сброс и mobile flow ждут независимого браузерного прохода. Физические устройства и живой скринридер не проверены.

## Artifact SHA-256

- `app/index.html`: `f92fc7f39fa00c6a5fd9a264a86928c89c60dfff682f3b628209076bd9b090c5`
- `app/model.js`: `8ec803e5a046c80a374655dac588dfe608f53165fd6fb3b95c8fa563037212c6`
- `app/app.js`: `b05f405be374e2f0dd5f0658fc19b72c2c4f9a0d8bd12f567d36aeaa4f609fd4`
- `app/source.json`: `b5241fdd2bc48dc6fb24cfba3f48e97199e89fe9cf1493682f84c5cc77790364`
- `app/kit/PIN.json`: `b96531efebe6ed8a69c0d9318c6365ecc61c1fc00da8e8008a0ae5b51f50c66b`

## Technical correction 1 после ревью

Родительский агент обнаружил несоответствие упаковки: первоначальный `app/kit/PIN.json` фиксировал собственный subset runtime и не являлся официальным release pack. Начальная реализация сохраняется как история, а не выдаётся за корректную официальную упаковку. Начальный subset перемещён в `initial-kit-subset/`; его неизменный PIN сохранён дополнительно в `initial-PIN.json`. Приведённый ранее digest PIN относится к начальной версии. Полный начальный список файлов и их хешей:

```json
{
  "commit": "c05b74d",
  "files": {
    "css/tokens.primitives.css": "fac36e2e152d177a9bcbf5f3c610689d3953b33fd15002bc7ff2065bdab9aad1",
    "css/tokens.semantic.css": "b064676266a06e36c8abd553be8a3707e7aca6512ad6ac93f6463828fe72736b",
    "css/glass.css": "dc4319158349da59c093d11a63976f66feb6d6cd1c4159232864184ae699a7e0",
    "css/components.css": "18a3ba9c2549c8652ba04295e88dd624fb43f911fbf056dd931782ffdf698c96",
    "js/dk-theme.js": "712e8aa734c8c76e0502a42161fbd4577d62787aa9b5ba77920b23679e0ed78e",
    "js/dk-util.js": "837803c39ce320f4f4b35366a91af9c34e9337f7bd635ea67133964ba0f0c70d",
    "js/dk-charts.js": "633c75879676dfee7339fad08bd85fb0796454d0785c3f79a1b033ebbc6b7d15",
    "js/dk-icons.js": "841e8c93255b13fc64732ddcf380da262472a752a95bdc33fb04f3d68fe131e7",
    "js/dk-select.js": "3d333b4e03d7793fc52cac11228d4970ec46495ed6af014784b7e3c99152b46d",
    "js/dk-modal.js": "99a35aa9b118fc07ce102203cc2dabf026e43a4e48338e815f8c37ad2d29c70a",
    "js/dk-context.js": "a1191301715ef4c0010c177d5b1b4315cedf23e1a5a6de12cae7e6617bdff0e9",
    "js/dk-chart-theme.js": "16b0c6cff1833ecfde43af0893e7e6c818c917bc037c62d3e4c1f69cff672bdf",
    "js/dk-table.js": "e5b75840a74be1133150596c2fc55fed26c47dbb34fa39510eb540ad33050659",
    "assets/graphite-light.png": "cd330a9ef8bb163f2ffd1fb86e78a875c06e0638eaacf8bba082c191ae6d4d72",
    "assets/graphite-dark.png": "d212df2d6f3f6d41befd4b11ca743d791db767188120508b873966494cde8a5d",
    "vendor/echarts.min.js": "8d008d338a7d3e042916af3f57499865a85cb5f8f5702a303409c5b9f47be580",
    "vendor/fonts/golos-700-cyrillic.woff2": "2f175b8fc40ed4e826742879f92ec903256fc2612d8d95c7c287232fd7138e4b",
    "vendor/fonts/golos-400-latin.woff2": "f8d71091110f0113ba8bd16bee2ac68b51dd6491c5b9404e9fbb82b20ae632f1",
    "vendor/fonts/golos-600-cyrillic.woff2": "2f175b8fc40ed4e826742879f92ec903256fc2612d8d95c7c287232fd7138e4b",
    "vendor/fonts/golos-700-latin.woff2": "f8d71091110f0113ba8bd16bee2ac68b51dd6491c5b9404e9fbb82b20ae632f1",
    "vendor/fonts/golos-600-latin.woff2": "f8d71091110f0113ba8bd16bee2ac68b51dd6491c5b9404e9fbb82b20ae632f1",
    "vendor/fonts/golos-500-cyrillic.woff2": "2f175b8fc40ed4e826742879f92ec903256fc2612d8d95c7c287232fd7138e4b",
    "vendor/fonts/golos-500-latin.woff2": "f8d71091110f0113ba8bd16bee2ac68b51dd6491c5b9404e9fbb82b20ae632f1",
    "vendor/fonts/golos-400-cyrillic.woff2": "2f175b8fc40ed4e826742879f92ec903256fc2612d8d95c7c287232fd7138e4b"
  }
}
```

Исправление: `source/tools/kit-release.py --pack task18/app/kit` выполнен после освобождения пути (NEW_DIRECTORY). Официальный пакет: `0.1.0-rc.7`, `candidate`, 100 runtime-файлов; `contentDigest = sha256:9802ab4ef705fe01270e6a19b5186c9bf4e81ddc6a429e147aa3b69a360aef20`. Проверка existing `--verify ... --expect sha256:9802ab4ef705fe01270e6a19b5186c9bf4e81ddc6a429e147aa3b69a360aef20` — PASS. Самодельного PIN внутри актуального app/kit больше нет.

Все SDK-файлы из начального subset побайтно совпадают с официальным пакетом. Все файлы app вне kit (HTML/CSS/JS/модель/данные) сверены с `initial-app-digests.json`, изменений нет. Статический тест обновлён на официальный kit-release descriptor и внешний зафиксированный digest. UI, модель и исходные данные не менялись.

Родительский агент сообщил: browser 28 views PASS, снимки сохранены. Это независимый результат родителя, не локальный запуск автора. После технической замены браузер повторно не запускался; используемые SDK байты сохранены. Данная поправка — technical correction 1 после ревью, не исправление аналитики или дизайна.

## Post-review UX/layout correction 1

Родительский браузерный проход обнаружил P1 в detail/dark/390: помесячная таблица накладывалась на второй/третий KPI. Ранее сообщённый browser PASS не подтверждал геометрическую корректность этой детали. Это отдельное замечание UX/layout, не technical pin correction 1.

До исправления сохранены исходные `index.html`, `app.css`, `app.js` и SHA-256 в `pre-layout-correction-1/` (`SHA256.json`). Причина по CSS-контракту: родитель `dk-modal__metrics` без `dk-grid` не становился grid-контейнером; дочерние карточки ошибочно наследовали overview `dk-widget` с height:100% и `dk-col--third`.

Исправлена только компоновочная разметка: `#detail-metrics` теперь `dk-grid dk-modal__metrics`, как в принятом образце коротких деталей. Для detail tile renderer передаётся отдельный параметр; карточки деталей используют `dk-tile dk-tile--compact` без overview widget/column-классов. KPI остаются теми же тремя, в прежнем порядке и с прежними значениями, подписями и действиями. CSS не изменён. Модель, data.js и source.json побайтно совпадают с начальной версией. Frozen SDK не изменён.

Quick checks: JS syntax PASS; static dependencies/classes/pin byte identity PASS; числовые unit PASS. Chrome/server/git/network не запускались. Настоящие rect non-overlap и видимость подписей после исправления — PENDING повторного прохода родителя; локальные проверки не выданы за подтверждение геометрии.

Текущие хеши изменённых файлов:

- `app/index.html`: `4b941e2749f249bc6d0ddd90de069460c64716eeaf1a2b58fe371a7024b6f092`
- `app/app.js`: `40b8891f04a06bd2d538516645dbf38557449f6b70d7d9d48e77e80be80e671d`
