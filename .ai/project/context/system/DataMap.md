---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Карта данных

## Entities
verified: регионы и геометрия карты; значения серий, строки таблиц, периоды, состояния фильтров и событий в API компонентов. Это UI-данные, не серверная доменная модель.

## Sources
data/regions.topojson, data/regions-tiles.json; демо-данные страниц. DESIGN прямо предупреждает о несогласованных production-срезах.

## Storage
Локальные файлы и память браузера; тема — localStorage js/dk-theme.js. Серверная БД и миграции не заявлены.

## Retention
Политика хранения данных приложения-хозяина unknown.

## Sensitivity
Демонстрационные данные не означают разрешение отправлять реальные данные наружу. Классификация реальных данных требует владельца.

## Owners
unknown. При подключении реальных данных определить единицы, пропуски, знаменатели, источник, частоту и владельца.

Источники: [README.md](../../../../README.md); [DECISIONS.md](../../../../DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](../../../../DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](../../../../REVIEW.md); [HANDOFF.md](../../../../HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
