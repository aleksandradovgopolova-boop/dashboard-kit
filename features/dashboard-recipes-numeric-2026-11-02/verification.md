# Следующий пакет #30 / #66 — проверка и границы

Реализация подготовлена для draft PR поверх #71. **Браузерная приёмка не завершена;
к слиянию пакет не готов.** Merge, deploy и обновление потребителей не выполнялись.

## Результат

- Четыре сценарных рецепта с решением, полями данных, компонентами, фильтрами,
  деталями, контрольными ответами и неподходящими случаями. Они используют
  существующие ипотечный и операционный примеры; нового декоративного экрана нет.
- SKILL.md ссылается на рецепты и числовую приёмку. Evals16–19 добавлены как
  будущие задания; реальные отдельные прогоны Codex/Claude (#70) не выполнялись.
- Маленький fixture из четырёх наблюдений. MODEL проверяет literal числовые
  ответы, UI binding отдельно проверяет literal строки DOM. Дополнительный
  случай с неодинаковыми базами одобрений ловит среднее процентов.
- Optional metadata в dkComparison/dkPeriodComparison: даты, полнота, предметная
  база и её единица, явные minBase/duration. Неполнота/несопоставимость блокируют
  дельту и цвет оценки. Полные календарные месяцы допускаются только по явному
  правилу; автоматической нормализации и универсального minBase нет.
- Краткая причина доступна через существующий Tooltip. Update/destroy очищают
  подсказку; добавлено сохранение фокуса при замене/исчезновении статуса.
- Новые проверки включены в tools/test.py, профиль актуализирован. Формулы
  ипотечной модели, данные штатного примера, токены и стек не менялись.

## Фактические проверки

| Проверка | Результат | Доказательство |
|---|---|---|
| Новые model checks | 22 PASS на окончательном коде | [numeric-model.log](evidence/numeric-model.log) |
| Статика и генераторы | PASS, браузер явно пропущен | [static-final.log](evidence/static-final.log) |
| Release package / descriptor | PASS, локальный candidate rc.4 | [release-final.log](evidence/release-final.log), [descriptor-final.log](evidence/descriptor-final.log) |
| Evals coverage | PASS структуры и ссылок, не исполнения агентов | [evals-final.log](evidence/evals-final.log) |
| Syntax нового browser runner / whitespace | PASS | [browser-syntax.log](evidence/browser-syntax.log), [diff.log](evidence/diff.log) |
| Полный tools/test.py | FAIL на browser mobile/a11y: listen EPERM | [full.log](evidence/full.log) |
| Новая numeric UI проверка | Не стартовала: localhost socket EPERM | [numeric-browser.log](evidence/numeric-browser.log) |

Полный прогон до блокировки выполнил прежние 33 model tests, предыдущую версию
21 нового теста, reference-server/contract и упаковку. После ревью добавлен
22-й тест; изменения final-кода проверены отдельным финальным набором выше.
Это **не** полный PASS. Хеши финальных файлов и коды завершения:
[final-checks.json](evidence/final-checks.json). Node 26.7.0.

Отдельный запуск check-advanced.mjs также не смог запустить тестовый Chrome;
завершён без результата приёмки. Встроенный браузер отклонил локальный file URL
политикой безопасности (разрешены http/https). Обходы не применялись.
Нет новых принятых снимков, результатов 390/1280 Dark/Light, hover/focus/tap/Escape
или живого скринридера. Написанные browser assertions не считаются выполненными.

## Ревью и AI Ops

Отдельный read-only агент проверил требования/план и математику. Учтены:
Tooltip вместо короткой причины в details; атомарность metadata; единица базы;
строгие календарные месяцы; независимые MODEL/UI expected. При ревью кода
исправлены hover в тесте, неоднозначная подпись zero-baseline, слепая зона
процентов и потеря фокуса при update. Итоговое заключение — [review.md](review.md): APPROVE по коду, browser QA pending.

Штатные ai-ops start/work preview и lifecycle.workitem start выполнены;
WorkItem маршрутизирован в ENGINEERING. Requirements и plan прошли собственные
валидаторы AI Ops по форме. ExecutionPreview не выдан за автоматическое исполнение;
TaskState.yaml — фактическая памятка возобновления, не успешный native run.
Формальный статус WorkItem остаётся needs_more_evidence: успешный полный
автоматический цикл не заявляется. Managed/config/workflows не изменены. Отсутствующие build/typecheck статического
ядра не объявляются PASS; прежнее ограничение #29 не маскируется.

## Источник и доставка

Remote база: b23c89249f9f45375153b236b4ab1dacfc1a9fef (PR #71).
Работа ведётся в изолированной копии /tmp/dashboard-kit-recipes-20261102.
Git fetch недоступен из shell; текст базы восстановлен через GitHub connector.
Все 1641 текстовых/доступных blob базы сверены по Git SHA с remote tree
071f9210f4a3987eff34d062fdfe2964d5d611be. Отсутствуют только восемь прежних PNG
доказательств PR #71; remote tree при доставке сохраняет их без изменений.
Основной checkout /Users/sasad/dashboard-kit на ветке example-shell не изменён.

## Следующий шаг

1. В среде с разрешённым localhost и Chrome выполнить
   `DK_EVIDENCE_DIR=/tmp/dashboard-kit-numeric node tools/check-numeric-browser.mjs`.
2. Исправить обнаруженные проблемы; просмотреть снимки обзора, деталей и причин.
   Проверить текст, обе темы, 390/1280, клавиатуру, hover/touch и возврат фокуса.
3. Выполнить `python3 tools/test.py` целиком, записать финальный SHA и вывод.
4. После принятия #71 переназначить базу PR на main; GitHub CI и review отдельно.
   Не закрывать #30/#66 и не публиковать кандидат до завершённой приёмки.
