---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Проверки продукта

## Стратегия
Статические контракты токенов/классов/генераторов и браузерное поведение — разные доказательства. Основная команда: python3 tools/check.py. Быстрый режим python3 tools/check.py --fast пропускает браузер.

## Среда
Python 3; Node.js 22+ и Chrome для полного прогона. Отдельные браузерные проверки лежат tools/check-*.mjs; поиск — node tools/check-select.mjs, телефон — node tools/check-mobile.mjs.

## Границы
Chrome viewport не живое устройство; AX tree не услышанный screenreader. Исторические evidence — docs/2026-09-30/evidence; не выдавать их за новый QA. Полный WCAG, Safari/Firefox, VoiceOver/NVDA и реальные данные требуют дополнительных прогонов.

## CI
.github/workflows/dashboard-check.yml: --fast + browser select; это не полный мобильный прогон. Ограничения supply-chain доступа — docs/ci-access.txt.

Источники: [README.md](README.md); [DECISIONS.md](DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](REVIEW.md); [HANDOFF.md](HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
