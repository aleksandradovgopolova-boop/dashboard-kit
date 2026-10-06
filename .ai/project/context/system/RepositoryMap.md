---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Карта репозитория

## Основные каталоги
| Путь | Назначение |
|---|---|
| css/ | Примитивы, семантика, компоненты, каркас |
| js/ | Компоненты dk-*, общие утилиты и документация |
| vendor/ | Локальные библиотеки, шрифты, лицензии |
| data/ | География карты и плиток |
| tools/ | Проверки, генераторы, опись |
| skill/dashboard-build/ | Инструкция сборки, references, evals |
| docs/ | Исторические evidence и сопровождение |
| .github/workflows/ | Проверки и AI Ops update-PR |
| .ai/managed/ | Управляемый слой; не редактировать |
| .ai/project/ | Проектный override контекста |
| .ai-ops/ | Паспорт, delivery и политика |
| planning/ | План работ |

## Точки входа
showcase.html, dashboard.html, regions.html, accidents.html, mobile.html, embed.html; страницы component-*.html. Источники решений — README/DECISIONS/DESIGN/REVIEW/HANDOFF, инструкции — AGENTS.md.

## Порядок подключения
README: dk-theme до отрисовки; primitives → semantic → components; dk-util до dk-*.

Источники: [README.md](../../../../README.md); [DECISIONS.md](../../../../DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](../../../../DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](../../../../REVIEW.md); [HANDOFF.md](../../../../HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
