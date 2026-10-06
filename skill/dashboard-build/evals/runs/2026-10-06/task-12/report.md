# Независимый прогон task-12 · 06.10.2026

Запрос: «Сохрани офлайн filters/period/sort/page/size/map-list/density и раскладку widgets: порядок, ширина, hide/show/reset. Сделай keyboard/touch управление, ошибки storage, миграцию версии и cleanup.»

## Discovery и сборка

Кит `/Users/sasad/dashboard-kit-backlog` использован только для чтения. Прочитаны `skill/dashboard-build/SKILL.md`, references extensions/checks/accessibility/phone/layout/data, описания в README и component pages. Сначала `tools/kit.py list`, затем `show base layout saved-views layout-editor density-controls select period pager table segment map empty button` и `head` этих частей. Подключение из head сохранено в `head.txt`. JS реализации компонентов, deterministic fixtures и expected answers не использовались.

Весь результат — в свежем task-12. index.html и app.js; assets связаны symlink с китом. Без фреймворков, зависимостей, изменений кита, commit/push. Данные демонстрационные: имена/округа из опубликованной раскладки, синтетические риск и возраст наблюдения. Нет production-источника и скрытой агрегации.

`dkState` связывает фильтр, dkPeriod, dkTable onSort (ascending/descending адаптированы в asc/desc), dkPager, mode и dkDensity. Один filtered/sorted dataset применяется до пагинации и передаётся карте. Period сериализуется строкой согласно контракту state; custom range разбирается host. Последний срез автоматически хранится отдельной записью version=1; version=0 `{state}` мигрирует; неизвестная версия сохраняется без перезаписи. Именованные виды — штатный dkSavedViews; раскладка — штатный dkLayoutEditor: живые DOM widgets, ширины, скрытие и сброс. Раскладка сохраняется отдельно от вида.

Режим «Список» показывает таблицу; «Карта» дополнительно включает canvas карту. Таблица остаётся доступной альтернативой карты. Скрытие картографического виджета раскладкой сохраняется независимо от выбранного режима. Preferences раскрываются нативной кнопкой с aria-expanded. Все действия именованы. Ошибки хранения сообщаются в status; SDK сообщает ошибки своих записей. Работа продолжается в памяти.

## Проверки и действия

`check.txt`: `python3 /Users/sasad/dashboard-kit-backlog/tools/check.py --page index.html` завершился без нарушений: классы/подключение/экранирование/таблицы/токены, Android 360, landscape и планшет, ширина страницы, touch hit targets, поля, safe area. Это full page check с Chrome, не полная проверка всей библиотеки.

`browser-test.mjs` использует настоящий headless Chrome через CDP и независимый локальный HTTP origin. `browser-results.json` содержит наблюдения:

- Применение всех параметров state и синхронизация UI: фильтр, период, sort aria-sort, page/size, mode aria-pressed, density.
- Create/rename/apply/setDefault/remove именованного вида; восстановление последнего среза после reload.
- Порядок/ширина/hidden, сохранение identity живого DOM, восстановление после reload, reset.
- Пустой фильтр: пустое состояние, ноль строк, page ограничена 1, доступный сброс; «Нет данных» с dk-nodata отличается от настоящего нуля.
- Реальный Enter активирует сброс; Enter двигает widget и удерживает фокус на «Ниже»; Escape закрывает filter и возвращает фокус; Tab переводит фокус.
- Реальное CDP touchStart/touchEnd на 390 открывает настройки; compact не расширяет страницу.
- Двойной destroy, удаление views/editor DOM и remount; после remount state снова обновляет density. Host убирает свои listeners, вызывает destroy всех SDK handles, отменяет поздние async map initialization по generation. pagehide вызывает cleanup, pageshow persisted — remount.
- Миграция host current v0 в v1; штатный SDK применяет legacy view из версии 0. Неизвестная current версия 99 не перезаписывается.
- Инъекция отказа Storage.setItem: status предупреждает; state, именованный вид и раскладка продолжают изменяться в памяти.
- Runtime exception list пуст.

Снимки `index-390-dark.png`, `index-390-light.png`, `index-1280-dark.png`, `index-1280-light.png` созданы штатным snap.mjs и осмотрены. Полные названия сохраняются. На телефоне toolbar и широкая таблица имеют свою горизонтальную прокрутку; страница не распирается. Light/dark читаются, data остаются главными. Визуальный второй проход: настройки свернуты, карта не занимает место в режиме списка; дополнительные KPI/графики не добавлены.

## Найденный пробел и ограничения

Первоначальный вариант с map tiles как режимом списка дал 271 mobile нарушения: tiles 14×14 на Android 360 и 31×31 landscape, перекрытие соседних hit targets. Документированный map init с controls:false и view tiles не обеспечил 44px для данного consumer layout. Кит не правился; в финальном варианте «Список» — доступная таблица, карта только canvas и режим списка служит альтернативой. Итоговая page check чистая. Это ограничение map tiles интеграции, а не доказанный дефект любой страницы кита.

«Офлайн» означает локальные assets и персонализацию без сети при работающем локальном HTTP сервере. Service Worker/PWA для cold start без сервера не добавлены. `file://` для fetch карты не поддерживается. Symlink результат требует доступного исходного кита.

Не проверялись физический телефон, реальный WebView, spoken screen reader, Safari/Firefox, исследование с участниками, heap leak profiling. Lifecycle проверен прямым destroy/remount; реальное возвращение BFCache и уход во время медленного fetch отдельно не воспроизводились. Не выполнены полноценные touch потоки каждого dropdown, календаря и редактора или все комбинации theme/state/layout. Автоматический checker по исходно закрытым preferences не доказывает touch targets раскрытого редактора; отдельный touch тест доказал раскрытие, keyboard — перестановку. SavedViews format v0 успешно читался/применялся; отдельная схема миграции layout v0 не опубликована и не выдумана.
