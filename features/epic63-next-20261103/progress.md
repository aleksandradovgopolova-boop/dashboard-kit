# Завершение очереди исследования #63 · 03.11.2026

Владелец поручил закончить нарезанные задачи после опубликованных PR71/PR73.
Claude Code установлен, но auth status: loggedIn=false; владелец ответил
«с клодом чуть позже разберемся». Claude eval откладывается, не считается PASS.
AI Ops managed/config/workflows и потребители SDK не входят в работу.

| Задача | Состояние |
|---|---|
| #65 Именованные метрики | Реализовано; 11 групп адресных тестов, legacy21/mortgage12/numeric22 PASS; code review APPROVE, полный CI первого head PASS 41609338408; после pin/rollback fix fab9e75 полный Chrome/MCP CI41611976943 PASS, PR74 ready |
| #22 Popover | Реализовано; native/fallback × две темы × 320/390/1280, клавиатура/touch/modal/select/lifecycle PASS; полный Chrome/MCP CI41612419473 PASS, PR75 ready |
| #37 Проверки композиции | Реализованы scope/fixtures + runtime; 148 Chrome views и независимая ручная редактура семи примеров PASS |
| #67 Схемы компонентов | Четыре canonical adapter schemas, CLI/MCP/reference, positive/negative PASS; полный protocol CI предстоит |
| #68 Screen spec | Первый plan-fact собран; deterministic/invalid fixtures и 12 Chrome views PASS; analyst/UX APPROVE, полный CI предстоит |
| #69 Dry-run обновления | Независимая задача после основного API |
| #70 Реальные evals | Codex после новых контрактов; Claude отложен владельцем |

Код основы: опубликованный e869cfd плюс сохранённый протокол 006cba8.
Работа в отдельных feature-ветках, существующие изменения сохраняются.
Связанные #25/#29/#31 не закрываются без своей отдельной приёмки.
