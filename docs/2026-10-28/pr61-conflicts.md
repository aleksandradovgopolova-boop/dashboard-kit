# PR #61: согласование с main · 28.10.2026

Исходный опубликованный head: `058bf10cc70a7fab2cd48821dae922fd5a05099b`.
Включённый main: `106c4d846e10c5494efe5b66339bbf9c27046328` (семь коммитов после общей базы `df1d489`).
Ветка: `codex/dashboard-kit-2026-10-28`, PR: https://github.com/aleksandradovgopolova-boop/dashboard-kit/pull/61.
Оба исходных состояния сохранены локальными refs `backup/pr61-before-conflicts-058bf10`
и `backup/pr61-main-106c4d8`. Объединение сохраняет историю опубликованной ветки.

## Разрешение конфликтов

Разобраны 66 файлов: 56 страниц компонентов, index и девять файлов исходников,
документации и профиля проверок. Массовый выбор ours/theirs не применялся.

| Файл / группа | Решение и происхождение |
| --- | --- |
| tools/build-component-pages.py | Наши Graphite-подключения и utility; ссылка бренда на index из main; обновлённый cache version docs. |
| tools/docs_guide.py | Наша задача → три шага → общий prompt и текущие правила; все новые ссылки примеров main сохранены. |
| README.md | Обзор из main объединён с нашими инструкциями сборки, данных и интеграции. |
| css/docs.css | Скрытие TOC ниже 1440px, period anatomy и focus таблиц из main; наш редакционный и плоский визуал меню. |
| js/docs.js | Плоские категории и пиктограммы текущего PR; маршруты, Back, focus и прокрутка main. |
| tools/check-docs.mjs | Проверки main и PR объединены; ожидания обновлены под принятый обзор и legacy redirect. |
| tools/test.py | Все проверки main плюс слой данных и регрессии reference/family. |
| .ai/repository-profile.yaml | Объединена опись реальных локальных команд; AI Ops не запускался. |
| showcase.html | Согласованы подключения без удаления контента статьи. |
| index.html, component-*.html | Перегенерированы из согласованных исходников. Read-only сравнение до записи: отличия от PR только в cache URLs; [хэши](pr61-conflicts/generation-proof.json). |

Управляемый AI Ops, его конфигурация и hooks взяты из main без локальных правок.
Это сохранение входящих файлов, а не возобновление AI Ops. Код и данные семейной
ипотеки, карта, календарь, модалка, utility и базовые токены совпадают с исходным PR.

## Дополнительные исправления, необходимые после объединения

- Повторный hash-переход превращал внутренний H2 примера в дополнительный H1.
  Выбор ограничен непосредственным заголовком статьи; проверено 160 переходов.
- Подготовка Pages из main теперь копирует assets вместе с runtime, чтобы Graphite
  не терял фоны. Ручной trigger, права, guard main и закреплённые Actions не менялись.
  Workflow не запускался; публикация не выполнялась.
- Учебный reference-server разрешает ровно graphite-dark.png и graphite-light.png;
  сторонние assets и symlink-пути по-прежнему отклоняются. Негативные проверки добавлены.

## Проверки браузера через CUA

- [456 измерений документации](pr61-conflicts/docs-browser-results.json): index и 56 страниц,
  Dark/Light × 320/768/1280/1536px. Нет горизонтального расширения страницы,
  лишних H1, безымянных видимых кнопок и вложенных категорий; overflow-таблицы фокусируемы.
- [160 маршрутов](pr61-conflicts/docs-route-results-final.json): index/showcase,
  обе темы, 320/1280px; overview, rules и developer deeplink. Legacy redpolitika
  ожидаемо ведёт на principy-teksta. Реальные клики CTA, Back, поиск и Escape меню проверены.
- [4 сценария ипотеки](pr61-conflicts/mortgage-regression.json): Dark/Light,
  390/1280px, длинный регион/сброс, сдвиг шапки 0px; карта → список → карта без
  изменения рамки; кликабельная легенда 8 → 89 регионов. Модалка: полный заголовок,
  шесть строк, сортировка, Tab/Shift+Tab, Escape и возврат фокуса/прежнего фильтра.
- [Календарь](pr61-conflicts/calendar-regression.json): повторные month/week,
  390 и 1280px; рамки 262×402 и 854.89×801.52px, сдвиг 0px.
- [Dark desktop](pr61-conflicts/mortgage-dark-1280.jpg) и
  [Light mobile](pr61-conflicts/mortgage-light-390.jpg) просмотрены перед сохранением.

Ограничения: это эмуляция viewport, не физические устройства. Полный tools/test.py,
Chrome AX и VoiceOver не выполнялись. Клавиатурная прокрутка таблиц проверена;
нативный wheel через CUA не дал надёжного измерения — успешный wheel-test не заявлен.
В документации uptime есть ожидаемые предупреждения о специально неверном состоянии;
ошибок консоли при сценариях не обнаружено. При новом клике CSV браузер не предоставил
доступного файла; клик с неопределённым исходом не повторялся. Предыдущая успешная
проверка CSV сохраняется в QA, исходники экспорта не менялись; новая end-to-end
проверка сохранённого CSV в этом проходе не заявлена.

## Gates финального дерева

- `python3 tools/check.py --fast`: PASS; 57 сгенерированных страниц, токены,
  контраст обеих тем, манифест и порядок подключений. Браузерная часть fast не включается.
- Общий и ипотечный data suites: 33/33 PASS; после их выполнения данные не менялись.
- `python3 tools/check-reference-server.py`: PASS, в том числе ровно два PNG-пути,
  отказ на сторонний assets и symlink; 20 000 наблюдений без запуска сервера.
- `node tools/check-reference-contract.mjs`: PASS, семь согласованных Python/JS запросов.
- `python3 tools/check-release.py`: PASS, воспроизводимость, внешний pin,
  повреждения/пути/symlink, изоляция обновления/отката.
- `python3 tools/check-contract.py`: PASS, adversarial guards.
- `python3 tools/check-evals.py`: PASS, 13 SDK entries; AI execution не оценивался.
- JS/MJS syntax: PASS. `git diff origin/main --check`: PASS, изменения PR чистые.
  Проверка merge относительно старого head выявляет whitespace в 228 файлах
  входящего main. Диагностика побайтно совпадает с `git diff 058bf10 106c4d8 --check`;
  эти чужие/управляемые файлы сохранены без форматирования. Чистота всего входящего
  main по whitespace не заявляется.
- `kit-release.py --check`, реальная упаковка и `--verify` с заранее сохранённым
  внешним pin: PASS, candidate `0.1.0-rc.2`, 84 runtime-файла и оба Graphite PNG.
  Digest: `sha256:3c4459fc46d4397307735d33eeeedcd779a608a6244d1ef62b33318652892cf9`.
- После восстановления связи: HEAD058bf10, MERGE_HEAD106c4d8; remote main/head
  совпали с исходной сверкой, неизвестного commit/push не было. 12 UI/data/export
  файлов побайтно совпадают с исходным PR; управляемые файлы/config/hooks — с main.

GitHub Actions и AI Ops STOP сохраняется; commit с [skip ci]. Merge PR, formal approval,
релиз stable, force push и deploy не входят в эту работу.
