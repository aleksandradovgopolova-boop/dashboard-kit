# ai-run — канонический вход (задача → исполнение → отчёт)

Сгенерировано из registry/ — НЕ редактировать вручную
(перегенерация: python3 -m ai_ops_kit.shared.generate_runtime).

## Что делает
Единый транзакционный вход: классификация/маршрут → RunPlan (base_workflow + треки +
агрегированные гейты) → WorkItem → регистрация активной работы → исполнение → компактный
отчёт. Это **основной путь** (3.0-срез 1); `$ai-start-task` сохраняется как совместимый алиас той же
спины и НЕ удаляется (снятие — не раньше 4.0).

## Порядок (исполняет этот раннтайм)
```
PYTHONPATH=.ai/managed python3 -m ai_ops_kit.engine.ai_ops_run run "<задача>" <child_root> \
    --signals '<json сигналов>' \
    --engine controller --runtime codex [--feature <имя-фичи>]
```
0. **Привязка к именованной фиче:** для реальной работы дай `--feature <имя>` — WorkItem
   ляжет на эту фичу, и срезы истории накопятся на неё. Без `--feature` id = `wi-<hash>`,
   и baseline метрик НЕ двигается (finding обкатки). Срез истории для внешнего рантайма пишется на
   стадии `finish` (рантайм исполняет `python3 -m ai_ops_kit.lifecycle.run_report --record`),
   автозаписи «за стадию» нет.
1. Контроллер строит RunPlan по сигналам и создаёт WorkItem (`features/<id>/run-plan.yaml`).
2. Регистрирует активную работу (ветка/зоны/сессия) — conflict forecast.
3. Исполнение: **codex** — контроллер готовит план и каркас, стадии/патчи/тесты
   исполняет этот раннтайм по процедуре `ai-start-task` (status=`planned`).
   Автоматический provider-путь выбирается отдельно: `--engine pipeline --execute`;
   он не запускает native CLI по одному флагу runtime. Legacy controller с
   `--runtime generic-orchestrator` исполняет стадии, но не даёт delivery-гарантий pipeline.
4. Пишет `features/<id>/run-report.json` и показывает резюме.

## Источник истины
Авторитетная процедура спины — `.ai/managed/commands/task/ai-run.md` (и `ai-start-task.md`
для интерактивных стадий). Не дублируй логику; следуй канону.

## Границы (честно)
Кит не притворяется, что исполнил за раннтайм: для codex «сделал» = evidence (commit
SHA, exit codes, структурный reviewer-result), а не факт вызова.
