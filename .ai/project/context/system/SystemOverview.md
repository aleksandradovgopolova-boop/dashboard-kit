---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Обзор системы

## Architecture
verified: статический HTML/CSS/JavaScript, без сборки продукта и обязательного пакетного runtime. Python/Node/Chrome — инструменты проверки и генерации сопровождающих артефактов.

## Components
CSS-слои, dk-* скрипты, демонстрационные страницы, vendor, карты data, tools, skill. AI Ops — отдельный контур разработки.

## Environments
Локальный file и HTTP; CI GitHub Actions. Production unknown.

## Boundaries
Хозяин поставляет данные и серверную безопасность; кит рисует, форматирует и управляет UI. Подробнее — корневой ARCHITECTURE.md.

Источники: [README.md](../../../../README.md); [DECISIONS.md](../../../../DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](../../../../DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](../../../../REVIEW.md); [HANDOFF.md](../../../../HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
