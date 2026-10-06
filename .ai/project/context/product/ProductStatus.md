---
read_tier: 1
stability: volatile
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Фактическое состояние продукта

## Что реально готово / живёт в проде
| Область | Факт | Доказательство |
|---|---|---|
| Frontend | verified: статическая библиотека и демонстрации | css/, js/, component-*.html, showcase.html |
| Backend / API | verified: серверный продуктовый слой в составе библиотеки не заявлен | README, дерево |
| Генерация / AI-workflow | verified: AI Ops обслуживает разработку; продуктовой AI-генерации не заявлено | .ai-ops.yaml, skill/dashboard-build |
| Данные | verified: локальные карты и демо-данные; production-источник unknown | data/, DESIGN |
| Хранилище | verified: тема хранится в localStorage; продуктовая БД не заявлена | js/dk-theme.js |
| Деплой | verified: локально file/HTTP; production и эксплуатация unknown | README |
| Провайдеры | verified: openai/anthropic указаны для AI Ops; активность и ключи unknown | .ai-ops.yaml |

## Что отложено и почему
Сборка продукта не планируется (README). Штриховка nodata и ассоциативные цвета требуют решения и проверки (HANDOFF). Полноценный VoiceOver/NVDA, реальные устройства и данные требуют отдельной работы (DESIGN).

## Источники истины
Решения — DECISIONS; готовность и пробелы — HANDOFF/REVIEW/DESIGN; CI — .github/workflows/dashboard-check.yml. Исторический полный QA — docs/2026-09-30/evidence/final-check.log; это не новый прогон.

## Неизвестное
Публичный production, пользователи, релизная версия, владение и продуктовый baseline не определены. Наличие демонстрации не подтверждает использование в production.

Источники: [README.md](../../../../README.md); [DECISIONS.md](../../../../DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](../../../../DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](../../../../REVIEW.md); [HANDOFF.md](../../../../HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
