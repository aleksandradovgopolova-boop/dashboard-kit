---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Дизайн-система

## Tokens
verified: css/tokens.primitives.css → css/tokens.semantic.css → css/components.css; каркас в css/chrome.css. Токены изолированы .dk-root. Тема и акцент независимы. Локальные шрифты Golos в vendor/fonts.

## Components and patterns
verified: js/dk-* и component-*.html; опись tools/kit.py. Карта и графики используют ECharts, период — Air Datepicker. Для редактирования компонентов обязательно skill/dashboard-build/SKILL.md и нужные references.

## UX and accessibility
Спокойные поверхности, полные названия, семантический цвет. Имя, состояние, результат и сброс фильтров; доступная таблица для карты; именованный диалог с возвратом фокуса. Проверка AX tree не равна услышанному screenreader.

## Known gaps
Состояние nodata и минимум различимости категорий требуют отдельной оценки; полная доступность unknown.

Источники: [README.md](../../../../README.md); [DECISIONS.md](../../../../DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](../../../../DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](../../../../REVIEW.md); [HANDOFF.md](../../../../HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
