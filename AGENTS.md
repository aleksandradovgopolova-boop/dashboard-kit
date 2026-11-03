# dashboard-kit: правила работы

Это статическая библиотека HTML/CSS/JavaScript для сборки дашбордов. Сборки продукта нет; не добавлять фреймворк или зависимости ради подключения AI Ops.

- Источники решений: README.md, DECISIONS.md, DESIGN-UX-ACCESSIBILITY.md, REVIEW.md и HANDOFF.md. Шаблоны AI Ops не заменяют эти документы.
- Перед изменением компонентов читать skill/dashboard-build/SKILL.md и нужные references. Существующий .claude/skills/dashboard-build сохранён.
- Токены: primitives → semantic → components. Сохранять порядок скриптов из README: dk-theme первым, dk-util до остальных компонентов.
- Быстрая проверка: `python3 tools/check.py --fast`. Полная: `python3 tools/test.py` (Node.js 22+ и Chrome). Базовая проверка с браузером: `python3 tools/check.py`. Пропуск браузера не считать полной проверкой.
- AI Ops установлен в .ai/managed; не править управляемый слой. Настройки проекта — .ai-ops.yaml и .ai/project; инструкции и команды — ./ai-ops и .ai/generated/codex/prompts.
- Обновления Kit только через PR, канал stable. Не публиковать и не сливать изменения автоматически.
- .ai/repository-profile.yaml — черновой профиль статического стека, составленный по существующим проверкам. При изменении команд актуализировать его; автоматический детектор Kit этот стек без манифестов не распознаёт.
