---
read_tier: 2
stability: evolving
reviewed_at: '2026-10-06'
owner: unassigned
status: draft
---

# Архитектура dashboard-kit

## 1. Context

Статическая библиотека для любых дашбордов. user_confirmed (Саша, 06.10.2026): аудитория — Саша, её команда, ИИ-агенты и другие пользователи; кит пока не используется. Корпоративная ИИ-среда — план, deployment unknown.

## 2. Goals

Единые оформление и поведение; запуск без сборки; офлайн; проверяемые контракты из README.

## 3. Non-goals

Фреймворк и обязательная сборка продукта исключены текущим решением README. Серверный продуктовый backend не входит в библиотеку.

## 4. System Overview

HTML подключает CSS-слои и нужные dk-* скрипты; локальные vendor/ и data/. AI Ops обслуживает разработку.

## 5. Components

css/ — дизайн; js/dk-* — UI; vendor/ — ECharts, Air Datepicker, Golos; data/ — география; tools/ — QA/генерация; skill/ — сборка экранов.

## 6. Orchestration

В браузере события пользователя меняют состояния компонентов и представление. Процесс разработки: задача → правка → проверка → PR → ревью; merge/публикация не автоматические.

## 7. Data Flows

Данные хозяина/демо → функции компонентов → DOM/графики. Тема → localStorage. Реальная передача наружу, источники и retention требуют контракта хозяина.

## 8. API Architecture

JS API описаны README и component-*.html; dk-util подключается раньше потребителей. Серверный REST/API, rate limits и auth отсутствуют в заявленном составе.

## 9. Data Architecture

Локальные географические файлы и демо-структуры; серверной БД/миграций нет в заявленном составе. Реальные единицы и источники unknown.

## 10. Authentication & Authorization

Библиотека не предоставляет серверную аутентификацию/авторизацию. Контроль доступа обязан реализовать хозяин; UI-скрытие не защита.

## 11. Security Boundaries

Внешние значения — недоверенные; dk-util предоставляет экранирование для HTML. Защиты хост-приложения и CSP unknown; см. SECURITY.md.

## 12. External Dependencies

Локальные vendor ECharts/Air Datepicker/Golos/Tabler; лицензии THIRD_PARTY_NOTICES.txt. Node/Python/Chrome нужны для разработки, не runtime продукта.

## 13. Deployment Architecture

Нет сборки продукта. Локальный file/HTTP — README. GitHub Actions запускает --fast и check-select; production-деплой unknown. См. docs/DEPLOYMENT.md.

## 14. Scalability

Фактическая нагрузка unknown. Большие массивы и графики требуют замеров в браузере; серверная горизонтальная масштабируемость неприменима библиотеке.

## 15. Reliability

Компоненты и проверки покрывают известные регрессии; карты/графики ждут размер контейнера (REVIEW). Полное поведение при всех ошибках не подтверждено.

## 16. Observability

Автоматические проверки и исторические QA evidence; пользовательские события, production логи/алерты и KPI не настроены как контракт библиотеки.

## 17. Failure Modes

Неверный порядок dk-util → отказ; нулевой размер графика → ожидание размера; ошибка карты → пустое состояние. Проверять действующий код и README перед изменением.

## 18. Architecture Decisions

DECISIONS.md: изоляция .dk-root, ECharts, тема до отрисовки, семантические цвета, телефон, skill. DESIGN 30.09 имеет приоритет над прежней декоративной трактовкой.

## 19. Known Limitations

Демо-данные и демонстрационные действия, nodata, реальные устройства/screenreader, Safari/Firefox, замеры загрузки — DESIGN/REVIEW/HANDOFF.

## 20. Architecture Evolution

Current — работающая статическая библиотека; Next — кандидаты существующего плана; Future — применение в том числе в корпоративной ИИ-среде (план Саши, 06.10); не утверждать текущий deployment или миграцию на сборку/фреймворк.

## 21. AI Development Contract

AGENTS.md и README обязательны; для компонентов skill/dashboard-build и references. Управляемый .ai/managed не менять. --fast не полная проверка. Новые решения записывать в DECISIONS; PR без автоматического merge/публикации.

Источники: [README.md](README.md); [DECISIONS.md](DECISIONS.md); [DESIGN-UX-ACCESSIBILITY.md](DESIGN-UX-ACCESSIBILITY.md); [REVIEW.md](REVIEW.md); [HANDOFF.md](HANDOFF.md).

Все восстановленные сведения — черновик. verified означает факт источника, inferred — вывод, unknown — неизвестно. Владелец документа не назначен; исходные решения имеют приоритет.
