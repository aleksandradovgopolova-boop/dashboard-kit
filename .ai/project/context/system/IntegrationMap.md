---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Карта интеграций

## Продуктовые зависимости
verified: локальные ECharts (графики и карта), Air Datepicker (период), Golos, Tabler-иконки. Версии/лицензии сверять vendor/licenses, THIRD_PARTY_NOTICES.txt и vendor/echarts.modules.json. При отсутствии движка графиков соответствующие компоненты не могут рисовать.

## Сервисы
Продуктовый внешний API и production-деплой unknown; обязательная удалённая загрузка не является контрактом кита.

## Разработка
GitHub Actions и AI Ops. .ai-ops.yaml указывает openai/anthropic, credentials_ref по именам env OPENAI_API_KEY и ANTHROPIC_API_KEY. Наличие значений, рабочий доступ и использование не проверялись. Секреты не читались.

## Неизвестно
Мониторинг production, владельцы интеграций, real-data контракты и доступы.

Источники: [README.md](../../../../README.md); [DECISIONS.md](../../../../DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](../../../../DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](../../../../REVIEW.md); [HANDOFF.md](../../../../HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
