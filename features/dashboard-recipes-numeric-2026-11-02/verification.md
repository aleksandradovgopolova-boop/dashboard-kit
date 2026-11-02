# Следующий пакет #30 / #66 — проверка и границы

Реализация сохранена в [draft PR #73](https://github.com/aleksandradovgopolova-boop/dashboard-kit/pull/73) поверх #71.
**Полный tools/test.py с Chrome и MCP прошли в GitHub Actions.** Ручной просмотр
снимков остаётся открытым; draft сохранён. Merge, deploy и обновление потребителей
не выполнялись.

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

## GitHub Actions — выполненная браузерная проверка

[Run 41457051676](https://github.com/aleksandradovgopolova-boop/dashboard-kit/actions/runs/41457051676),
job 125316276378, **success**, 02.11.2026. Проверенный head:
`dd87a91a227f6a5ecb240af1d43c7015358d5567`; merge ref: `d042b1d8269b0d92c41798b40230364b2bfbb14c`.
После этого кода добавлены только отчёт и журналы; текущие checks — в PR.

- 22 новых MODEL tests и прежние проверки — PASS.
- Numeric UI binding — PASS в Dark/Light на 390/1280: literal значения,
  фильтры, пагинация, детали/возврат фокуса, 0/null/partial/no-data и восстановление.
- Сопоставимость периодов, видимые даты/базы, hover/focus/tap/Escape,
  update/destroy и сохранение фокуса — PASS.
- Полный `python3 tools/test.py` — PASS, включая 69 страниц × 3 мобильных размера,
  56 страниц компонентов в обеих темах на 320/768/1280/1536, все существующие
  browser suites, SDK fixtures, generated files, release pin, contracts/evals.
- MCP handshake, 5 tools, asset order, embed, resources/errors — PASS.
- Остальные workflow этого коммита: validate, lint, coverage, catalog, secret-scan — success.

[Выборка фактических строк журнала](evidence/ci-success-summary.log) и
[машиночитаемая запись](evidence/ci-result.json). Полный журнал — в Actions.
[Архив снимков](https://github.com/aleksandradovgopolova-boop/dashboard-kit/actions/runs/41457051676/artifacts/13148296094)
сохранён Actions до 16.11.2026. Архив не удалось загрузить в рабочую среду;
**ручной визуальный просмотр не выполнен**, живой скринридер не проверялся.

Первый CI run 41455989928 остановился на Escape в новой проверке Light/390:
[точный фрагмент](evidence/ci-first-failure.log). В тесте разделены остаточный
pointer предыдущего случая и focus нового, добавлены два кадра стабилизации,
проверка конкретного tooltip по aria-describedby, count=1 и устойчивое закрытие
без снятия фокуса. После Escape проверяются hidden сразу и через два кадра.
Причина первого падения окончательно не доказана; повторный полный прогон прошёл.
Продуктовый Tooltip ради зелёного теста не изменялся. Правку теста отдельно
проверил read-only рецензент.

## Локальные проверки до CI (сохранены как история)

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
Это **не** полный локальный PASS; выполненный полный прогон CI приведён выше.
Хеши файлов локального этапа и коды завершения:
[final-checks.json](evidence/final-checks.json). Node 26.7.0.

Отдельный запуск check-advanced.mjs также не смог запустить тестовый Chrome;
завершён без результата приёмки. Встроенный браузер отклонил локальный file URL
политикой безопасности (разрешены http/https). Обходы не применялись.
На этом локальном этапе browser assertions не выполнялись. Позже они прошли
в штатном GitHub Actions, без обхода ограничений локального браузера. Ручной
просмотр новых снимков и живой скринридер по-прежнему не заявляются.

## Ревью и AI Ops

Отдельный read-only агент проверил требования/план и математику. Учтены:
Tooltip вместо короткой причины в details; атомарность metadata; единица базы;
строгие календарные месяцы; независимые MODEL/UI expected. При ревью кода
исправлены hover в тесте, неоднозначная подпись zero-baseline, слепая зона
процентов и потеря фокуса при update. Итоговое заключение — [review.md](review.md): APPROVE по коду; автоматическая browser QA позже прошла в CI, visual review pending.

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

1. Просмотреть архив снимков обзора, деталей и причин на 390/1280 в обеих темах.
   Автоматическую DOM/геометрическую проверку не считать ручным визуальным ревью.
2. Проверить текущие GitHub checks и пересмотреть draft после визуальной приёмки.
3. После принятия #71 переназначить базу #73 на main. Следующий продуктовый пакет —
   #65; реальные agent evals #70 остаются отдельными. #30/#66 пока открыты;
   merge и публикация требуют отдельного этапа.
