---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Процесс разработки

## Изменения
verified: читать пять исходных документов и локальные инструкции. Компоненты — после skill/dashboard-build/SKILL.md и references. Изменения кита через PR, канал stable, без автоматического merge/публикации. Управляемый .ai/managed не редактировать.

## Проверки
Быстро: python3 tools/check.py --fast. Полно: python3 tools/check.py с Node.js 22+ и Chrome. Browser skip не полная проверка. Особые проверки и генераторы — README/HANDOFF; после правок команд актуализировать .ai/repository-profile.yaml.

## Параллельная работа
Не трогать чужие незакоммиченные изменения; выделять worktree и области записи.

## Защищённые пути
.github/workflows/ из .ai-ops.yaml; политика .ai-ops/POLICY.yaml требует решения человека.

## Неизвестно
Ответственные за QA/release/security, SLA ревью и политика релизных версий. Продуктовые решения принимает Саша (user_confirmed, 06.10). Детали — CONTRIBUTING.md и TESTING.md.

Источники: [README.md](../../../../README.md); [DECISIONS.md](../../../../DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](../../../../DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](../../../../REVIEW.md); [HANDOFF.md](../../../../HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
