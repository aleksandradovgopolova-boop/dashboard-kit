# #69 · предпросмотр обновления потребителя

Реализовано tools/kit-update.py: две проверенные внешними pins версии,
либо lock/1 текущего потребителя + новый pin. Только read-only, без apply.
Нет сетевого latest, записи установки, lock, конфигурации или рабочих данных.

Added/changed/removed, конфликты локальных файлов и метаданные API/параметров/
зависимостей доступны текстом и schemaVersion1 JSON. Inventory/1 задаётся явно;
неизвестные связи не объявляются безопасными. Изменённая локальная опись не
используется как доверенная старая версия: её contracts/deps — unknown.
Совместимость поведения требует отдельных consumer tests, не выводится из hash.

## Проверки

check-kit-update.py PASS: реальный pack нескольких изолированных fixture-релизов,
файлы/контракты/зависимости, API-only/version-only, неизвестный inventory,
локальные правки, сохранение bytes/mtime lock/config/packages, CLI text/JSON,
ошибки pins, повреждённый и неполный target, независимый verify/rollback.
Старый check-release.py также сохранён и PASS.

Read-only review APPROVE после исправления текстового вывода API и версий схем.
Реальный rc7→rc8 preview сохранён в update-evidence/real-rc7-rc8.json:
изменилось только руководство releases, writes=[], conflicts=[].
Это проверка процедуры, не обновление настоящего потребителя.

Полный локальный tools/test.py с Node22+ и Chrome прошёл; отдельно настоящий
MCP stdio handshake, семь инструментов, схемы/ресурсы/ошибки — PASS.
MCP dependency установлена только в /tmp venv. Логи сохранены рядом.
После прогона уточнён текст releases; descriptor пересчитан, проверен pack,
verify, dry-run и адресные tests. Runtime JS/CSS от этого не менялся.

## Доставка и ограничения

Пакет #37/#67/#68 сохранён c05b74d. Исправления compiler empty class и безопасной
справки check.py, найденные реальными evals, сохранены отдельно в 3add79c;
новый compiler дополнительно проходит настоящий consumer page checker.
Полный CI нового пакета не запускался: auto-review отклонил push/workflow,
сославшись на прежний пользовательский запрет. Не обходить отклонение.
Ничего из новых пакетов не слито/не опубликовано; PR74/75 остаются открытыми.

Текущий rc8 — локальный кандидат, не stable release. Source checksum фиксирует
содержимое, а не безопасность кода. Произвольный старый изменённый descriptor
без совпадения внешнего pin отклоняется; без достоверной базы diff невозможен.
Новый неизвестный dataContractVersion не принимается старым release verifier.

Источник принципа dry-run/dependency diff: официальный CLI shadcn
https://ui.shadcn.com/docs/cli. Сторонний код и зависимости не переносились.
