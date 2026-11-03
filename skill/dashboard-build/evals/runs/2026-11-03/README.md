# Реальные fresh-context прогоны #70 · 03.11.2026

Семь отдельных native Codex agents, `fork_turns=none`, без model override.
Это настоящие сборки потребителя, не запуск deterministic fixtures и не
имитация Claude. Точная версия внутренней модели отдельно не раскрывается;
установленный Codex CLI в этих прогонах не использовался.

Каждый получил задачу, read-only каталог/skill и исходный набор. Готовый ответ,
grader expectations, чужой код и предыдущие corrections не передавались.
Прочитанные standard references для16–21 содержат общий учебный fixture;
поэтому только22 называется blind: новые числа отсутствовали в reference.

Исходная версия: c05b74d, rc7, pin в runtime-descriptor.json. После обнаружения
ошибок компилятора/help сохранён 3add79c, на нём fresh task22. Runtime bytes/pin
не менялись: исправлялись инструменты сборки. Task21 original app сохранён;
accepted/ заново построен исправленным настоящим compiler из прежнего spec.

## Результат по задачам

| Задача | Сценарий | Исправления после первого артефакта | Итог |
|---|---|---|---|
|16|Monitoring: внимание, округ, детали/возврат, null|UX2: parent grid и читаемость/доступная прокрутка месячной таблицы|PASS, UX APPROVE|
|17|Plan-fact: разные единицы, месяц, детали, zero plan|Technical1: отсутствовал Glass stylesheet|PASS, UX APPROVE|
|18|Portfolio: search/filter/sort/details, partial/missing row, неизвестные базы|Technical1: штатный pin вместо subset; UX1: grid/карточки деталей|PASS, UX APPROVE|
|19|Operations: город×служба×день, реальный API, отказ/повтор, возврат|UX2: toolbar inset/overlap и labels/details grid|PASS, UX APPROVE|
|20|Один embedded график с числовой альтернативой|Technical1: штатный pin вместо subset; лишнего обзора нет|PASS, UX APPROVE|
|21|Typed daily plan-fact, named metrics, real compiler|Technical1 SDK: compiler выдавал неизвестный класс empty; original FAIL сохранён|accepted PASS, UX APPROVE|
|22|Typed repeat с новым blind input|0|PASS, UX APPROVE|

Отдельная общая technical correction1: `check.py --help` запускал suite.
Четыре исполнителя честно записали EPERM до успешного server/browser запуска.
Исправление справки сохранено, попытки не названы browser PASS. Подготовительные
self corrections перечислены в авторских report.md отдельно от этой таблицы.
По данным не потребовалось исправлений после first-complete: независимые
literal model/DOM проверки прошли, включая новые80/150 и5800/1100.

## Приёмка

Root функционально проверил28views: семь артефактов × Dark/Light ×390/1280.
Данные и реальные controls проверены отдельно: выбор, zero/null, partial,
empty/reset, sort, детали, Escape/возврат фокуса, method. Operations использует
настоящий pinned reference API на временном localhost: отказ одного POST,
повтор с тем же idempotency key, подтверждённый результат и перечитывание.

Первый функциональный PASS **не был** визуальным PASS: независимый reviewer
нашёл четыре проблемных consumers. Их initial shots, исходные файлы и hashes
сохранены. После исправлений повторный28view прогон добавил label geometry,
cards-inside-metrics, metrics-before-table, touch targets и toolbar nonoverlap.
Отдельный4view recheck16 проверяет текст headers внутри th и реальный ArrowRight
scroll, обе темы и возврат. Final UX/editorial review16–22: APPROVE.

Результаты: results.json. Первоначальные, final и последнее recheck evidence
сохранены раздельно. Ни numeric PASS, ни AX не объявляются полной визуальной
проверкой; настоящие screenreader/physical devices не проверялись.

## Что изменено в навыке и инструментах

- Справка check.py больше не запускает тесты/сервер.
- Compiler использует существующий empty class и проверяется настоящим
  consumer page checker; отрицательный missing-glass case сохранён.
- `dk-glass` без glass.css отклоняется page checker.
- references/checks явно требует grid/compact contract для detail metrics,
  видимых label/value/unit, проверки пересечений и наследуемых toolbar margin.
- Старое указание caps Regular заменено действующим18/24 Medium.
- Новые20–22 и общие ожидания добавлены без удаления прежних1–19.

Claude Code отложен прямым ответом владельца: «с клодом чуть позже разберемся».
Авторизации нет; семь Claude cases — blocked/deferred, **не PASS**. #70 целиком
не закрывается до отдельного Claude этапа. #25/#29/#31 также не закрываются.

## Как воспроизвести сохранённый результат

Чтобы не дублировать одинаковые100 runtime-файлов семь раз, здесь сохранены
все авторские файлы, отчёты, исходные неудачные варианты, inputs и общий точный
descriptor. SDK восстанавливается из записанного git commit, не из latest:

```sh
mkdir /tmp/kit-eval-source-recorded
git archive c05b74d | tar -x -C /tmp/kit-eval-source-recorded
python3 skill/dashboard-build/evals/runs/2026-11-03/rehydrate.py \
  --source /tmp/kit-eval-source-recorded --out /tmp/kit-eval-replay
node tools/check-agent-evals.mjs --root /tmp/kit-eval-replay --out /tmp/kit-eval-replay-evidence
```

Выберите отсутствующие пути. Helper сохраняет исходный архив, проверяет source
по записанному pin, копирует артефакты только в новую папку и применяет прежние
pack/verify. Первый task21 original FAIL не заменяется accepted. Worker checks
с абсолютными путями описывают исходное окружение; replay выше проверяет
сохранённые runnable outputs новым независимым root-runner.

Новые ветки не отправлены и remote CI не запущен: automatic approval отклонил
push/workflow, сославшись на прежний запрет. Пропущенная доставка не названа
успешной; новых merge/deploy или изменения настоящего потребителя не было.
