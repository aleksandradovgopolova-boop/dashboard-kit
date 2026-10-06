---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---
# Проверка проектного комплекта

- Полный `python3 tools/check.py`: прошёл, включая Chrome и 33 страницы в трёх размерах. [Протокол](evidence/product-context-full-check.txt). Браузер не пропущен; это не полная проверка WCAG/живых устройств.
- Строгая полнота startup-контекста: оба обязательных документа заполнены. [Протокол](evidence/context-completeness.txt). Проверяет now/status, а не все продуктовые утверждения.
- Модель/roadmap/план: валидны, ошибок нет. [Результат](evidence/product-model.json).
- Product layer: passport/delivery/policy/templates valid по форме, без missing/invalid/outdated. [Результат](evidence/product-layer.json). Это не подтверждение владельцев и business KPI.
- Установка: doctor подтвердил 638 managed-файлов и согласованность child. [Протокол](evidence/doctor.txt). Managed не изменён.
- 16 context-документов: frontmatter, draft и локальные Markdown-ссылки проверены. YAML плана, индекса решений и onboarding-answers разбираются. [Результат](evidence/context-links.json).
- `git diff --check`: прошёл. Изменения исходников, зависимостей, workflow и исполняемой POLICY отсутствуют.

Валидация startup-контекста/модели использовала инструменты локального parent `/Users/sasad/ai-ops-kit`, поскольку установленная managed-копия не содержит этих CLI-модулей. Product-layer/doctor использовали установленный 4.3.2. Ничего не устанавливалось.

GitHub API 06.10 подтвердил merged PR #7/#8 (05.10) и #10 (06.10); эти факты исправили устаревший delivery-план. Новый аудит статусов всех CI jobs/production не проводился. Продуктовых baseline, подтверждённой целевой роли и готовой политики раскрытия нет; вопросы — [ONBOARDING](ONBOARDING.md).

Состав/применимость всех managed templates — [TEMPLATE-INVENTORY](TEMPLATE-INVENTORY.md). Все новые восстановленные документы остаются черновиками; первичные решения имеют приоритет.
