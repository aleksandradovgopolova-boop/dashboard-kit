---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Как вносить изменения

## Перед правкой
Читать AGENTS, README, DECISIONS, DESIGN, REVIEW, HANDOFF. Для компонентов — skill/dashboard-build/SKILL.md и references. Не добавлять сборку/фреймворк/зависимости ради AI Ops.

## Проверка и PR
python3 tools/check.py --fast — быстрая проверка; python3 tools/test.py — полный suite (Node.js 22+ и Chrome); python3 tools/check.py — правила и мобильная адаптация. Пропуск браузера явно сообщать. После изменений генераторов/тем сверять нужные производные файлы по HANDOFF.

## Ревью
Объяснить проблему, поведение после правки, доказательства и ограничения. Изменения через PR; не сливать и не публиковать автоматически. Managed не редактировать; .github/workflows/ защищён. Нельзя трогать чужие незакоммиченные изменения.

## Документы
Обновлять решения и состояние, когда меняется продукт. Не считать черновики .ai/project новой утверждённой истиной.

Источники: [README.md](README.md); [DECISIONS.md](DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](REVIEW.md); [HANDOFF.md](HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
