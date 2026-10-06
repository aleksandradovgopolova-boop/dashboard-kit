---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Модель угроз

## Активы и границы
См. SECURITY.md: данные хозяина, DOM, vendor, исходники; недоверенное значение должно оставаться текстом.

| Угроза | Мера | Остаточный риск |
|---|---|---|
| XSS из входных значений | dk-util экранирование; проверки known regressions | Все пути не прошли полный аудит |
| Подмена vendor | Локальные файлы, лицензии, git review | Источник и update требуют проверки |
| Неверное понимание KPI | Названия, единицы, пороги и доступные альтернативы | Реальные определения и источник unknown |
| Утечка данных через AI development | Секреты не читать; classification до передачи | Реальная data-policy требует владельца |

Принятие остаточного риска unknown; таблица — восстановленный черновик.

Источники: [README.md](../README.md); [DECISIONS.md](../DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](../DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](../REVIEW.md); [HANDOFF.md](../HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
