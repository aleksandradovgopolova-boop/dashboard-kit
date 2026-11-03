# Независимая сборка screen-spec/1 · task22

Потребитель собран настоящим компилятором из замороженного кита. Браузерная и продуктовая приёмка ожидают отдельного прохода root; эта работа не объявляется полной приёмкой экрана.

Полный полученный prompt сохранён в `prompt.txt`. Рабочая область: `/tmp/kit-evals-20261103/task22`. Внешние исходные JSON использованы только для чтения. Evals/expected answers, прежние прогоны, proof-файлы features и каталоги других исполнителей не читались. Chrome, сервер, сеть, git, тяжёлые suites и субагенты не запускались.

## Бриф и состав

Аудитория — владелец программы; решение — определить выполнение плана и сравнить регионы/каналы за закрытый период 01–02.10.2026. Полный локальный snapshot: 4 дневных наблюдения; grain `day`, dimensions `['region']`, expectedRows 4 подтверждены заданием.

Три верхних KPI: «Выдано» (кредитов), «Выполнение плана» (%) и «Средняя ставка» (%). Именованные execution и rate берутся непосредственно из предоставленного реестра. Дневной парный bar сравнивает факт/план в одинаковой единице; таблица регионов показывает выполнение, факт, план и взвешенную ставку. План включён в таблицу, чтобы знаменатель был виден без методики. Детали используют те же показатели и дневные строки текущего среза. Два общих фильтра, сброс и возврат реализует штатный runtime. Карта для двух условных регионов без географических координат не добавлялась.

Аналитический и редакторский проходы выполнены последовательно одним исполнителем; они не являются независимым ревью. Источники правил: AGENTS, dashboard-build SKILL, catalog list/schema/show, docs/screen-spec, docs/named-metrics, assembly-rules/current-state/editorial-review, UIUX и policy, матрица DESIGN-UX-ACCESSIBILITY; соответствующие references composition/recipes/data/charts/numeric-checks/product-review/checks/extensions и стандарт деталей. Решения README/DECISIONS/REVIEW/HANDOFF сверены по релевантным разделам. Браузерное ревью намеренно не выполнено.

## Числовые ответы, выведенные из нового источника

До сборки в `model-check.mjs` записаны литеральные независимые ответы; expected не вычисляется рабочим агрегатором или форматтером.

| Срез | Выдано / план, кредитов | Исполнение | Взвешенная ставка |
|---|---:|---:|---:|
| Все | 80 / 150 | 53,3% | 5,3% |
| Север | 30 / 50 | 60,0% | 4,2% |
| Юг | 50 / 100 | 50,0% | 6,2% |
| Онлайн | 62 / 130 | 47,7% | 5,4% |
| Отделение | 18 / 20 | 90,0% | 5,0% |
| Юг × Отделение | Нет наблюдений | null / empty | null / empty |

Общий расчёт: (12 + 18 + 45 + 5) / (30 + 20 + 60 + 40) × 100; ставка = (3×200 + 5×300 + 7×500 + 2×100) / 1100 = 5800/1100. Дневные суммы: 01.10 — 57/90; 02.10 — 23/60. Нет основания выводить причину отставания или назначать статус ставки «хорошо/плохо».

Модель проверена на всех этих срезах, пустом пересечении и дневных суммах. Реальный 0/0 для approval в Юг/02.10 даёт null/zero-denominator. Отдельные in-memory probes меняют issued на 0 и null: первый сохраняет ready/0, второй блокирует полный execution как partial-input/null. Исходные файлы этими проверками не изменяются. Approval не добавлен на экран, поскольку не входит в задачу владельца.

## Артефакты и идентичность

- `spec.json` — авторская закрытая спецификация; `prompt.txt` — исходное задание.
- `app/index.html`, `app/screen-input.json`, `app/kit/` — вывод компилятора без ручных правок.
- `model-check.mjs`, `model-check.log` — самостоятельные числовые проверки настоящих dkDashboard/dkMetrics.
- `typed-check.log`, `static-check.log`, `policy-check.json`, `compiler-validation.json` — фактические быстрые проверки.
- `hashes.json` — SHA-256 входов, компилятора, runtime и результата.

Предоставленный commit кита: `3add79c` (git не запускался). Пакет `0.1.0-rc.7`, channel candidate. Проверенный contentDigest: `sha256:9802ab4ef705fe01270e6a19b5186c9bf4e81ddc6a429e147aa3b69a360aef20`.

SHA-256 source.json: `847e17ed0724e9f0a04b7878e3b284ac970c54e601b91e2b8c0e09fea977ad81`.

SHA-256 registry.json: `5ec7cdd21b0788dffe4ce5c02ebe3e55ce462e79e5bffd70999c0599f4e1802b`.

## Фактически выполненные проверки

Все команды запускались из task22, Python после начального чтения — с `PYTHONDONTWRITEBYTECODE=1`.

1. `python3 /tmp/kit-evals-20261103/source-v2/tools/build-screen.py /tmp/kit-evals-20261103/task22/spec.json --input-root /tmp/kit-evals-20261103/blind-input --out /tmp/kit-evals-20261103/task22/app` — built, exit 0, первая сборка.
2. Тот же compiler без `--out`, с `--expect sha256:9802ab4ef705fe01270e6a19b5186c9bf4e81ddc6a429e147aa3b69a360aef20` — validated, exit 0.
3. `kit.py validate` для всех семи props filters/widgets — PASS, exit 0.
4. `node model-check.mjs` — восемь сообщений PASS; exit 0. Node v26.7.0.
5. `python3 .../tools/check.py --fast --page .../task22/app/index.html` — exit 0, классы/иконки/dependencies/экранирование/таблицы/токены прошли. Браузерный этап явно пропущен.
6. `python3 .../tools/check-screen-policy.py --page .../task22/app/index.html --json` — issues [], editorialReview required, exit 0.

Статический текстовый проход: основные названия, единицы и единый период предусмотрены штатным runtime, формулы открываются через «Данные и методика». В обычном состоянии авторских поясняющих абзацев не добавлено. Пустое состояние содержит краткий статус, сброс остаётся доступным при активных фильтрах. UI-002/003/006 применимы к согласованному срезу, понятным единицам и возврату контекста; наблюдаемая UI-проверка этих требований остаётся pending.

## Самокоррекции

- Данные: после первой сборки исправлений не было; новый источник дал 80/150 и 5800/1100, литеральные ответы прошли с первой попытки.
- UX/редактура: до первой сборки план добавлен в таблицу как видимый знаменатель; выполнение поставлено первым в региональной таблице/деталях. После сборки исправлений не было. По исходникам удалять дополнительные блоки не потребовалось.
- Технические: compiler и проверки прошли с первой попытки. Вывод compiler вручную не правился.

## Селекторы и API для отдельной приёмки

Корень: `#program-plan-fact`; API: `document.querySelector('#program-plan-fact').dashboardScreen`.

```js
const api = document.querySelector('#program-plan-fact').dashboardScreen;
api.getSnapshot();
api.setFilters({region: ['Север'], channel: ['Онлайн']});
api.setFilters({region: ['Юг'], channel: ['Отделение']}); // empty
api.reset();
```

`setFilters` заменяет полный набор условий; для пересечения передать оба. Поля values снимка: issued, plan, execution, weighted-rate; query.filters и rowCount доступны рядом.

- KPI: `[data-screen-kpis] [data-metric="issued"]`, `[data-metric="execution"]`, `[data-metric="weighted-rate"]`; число `.dk-metric-lg`.
- Фильтры: `[data-screen-filters] .dk-screen__filter` в порядке регион/канал.
- Сброс: `[data-dk-reset]`; до активного фильтра hidden.
- График: `[data-screen-widget="daily-chart"] .dk-chart`.
- Таблица: `[data-screen-table="region-table"]`; строки `[data-group="Север"]`, `[data-group="Юг"]`; детали `[data-open-details="Север"]`.
- Детали: `dialog[data-dk-screen="detail"]`, закрытие `form[method="dialog"] button`; проверить Escape и возврат фокуса.
- Пустое состояние `[data-screen-empty]`, содержимое `[data-screen-content]`, статус `[data-screen-status]`.
- Темы: `[data-theme-set="dark"]` и `[data-theme-set="light"]`; методика `[data-screen-info]`.

## Ограничения и pending

390×844 и 1280×900 в Dark/Light, фактические видимые тексты/числа, геометрия, контраст, tooltip/popover, клавиатура, Escape/возврат фокуса, открытые фильтры, сброс и возврат из деталей пока не проверены браузером. Проверка модели не считается UI binding-проверкой. Не запускались heavy suites или live-device/screen-reader проверки. Snapshot содержит только учебные наблюдения; production и актуальность реального источника не подтверждены.
