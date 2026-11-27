#!/usr/bin/env python3
"""Области работы и безопасные пути её артефактов.

Зоны выводятся из write_scope; неизвестная зона не считается пересечением.
ID и пути WorkItem проверяются до записи; существующие escaping links запрещены.
Конкурентная враждебная подмена symlink требует отдельной изоляции.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from collections.abc import Iterable
from typing import Any























UNSPECIFIED = "unspecified"


def zone_of(path: object) -> str | None:
    """Одна запись `write_scope` -> зона (каталог). -> строка или None, если зоны нет.

    Зона — самый глубокий КАТАЛОГ записи: глоб-сегменты и имя файла отбрасываются, потому что зона
    отвечает на вопрос «какую часть репозитория держит работа», а `db/x.py` и `db/y.py` — одна часть.
    `api/**` -> `api`; `db/x.py` -> `db`; `ai_ops_kit/engine/` -> `ai_ops_kit/engine`;
    `quality` -> `quality` (без слэша — тоже зона: прежняя формула такие записи ТЕРЯЛА, и работа со
    scope `["quality"]` выглядела как работа без зон вообще).
    """
    segs = []
    for seg in str(path).strip().strip("/").split("/"):
        seg = seg.strip()
        if not seg or seg in (".", ".."):
            continue
        if any(ch in seg for ch in "*?["):      # глоб — дальше каталог не определён
            break
        segs.append(seg)
    if segs and "." in segs[-1] and len(segs) > 1:
        segs.pop()                               # последний сегмент — файл, зона это его каталог
    return "/".join(segs) or None


def from_write_scope(write_scope: Iterable[object] | None) -> list[str]:
    """`write_scope` -> зоны работы. -> отсортированный список; [] если выводить нечего."""
    return sorted({z for z in (zone_of(p) for p in (write_scope or [])) if z})


def areas_for(signals: dict[str, Any] | None = None, write_scope: Iterable[object] | None = None) -> list[str]:
    """Зоны для регистрации и сверки: объявленные -> выведенные из scope -> честная заглушка.

    Порядок именно такой: явные `affected_areas` — заявление человека, оно главнее; вывод из scope —
    то, что кит может узнать сам; `unspecified` остаётся ТОЛЬКО когда неизвестно всё, и тогда это
    признаётся неизвестностью, а не выдаётся за факт.
    """
    declared = (signals or {}).get("affected_areas")
    if declared:
        return list(declared)
    derived = from_write_scope(write_scope if write_scope is not None
                              else (signals or {}).get("write_scope"))
    return derived or [UNSPECIFIED]


def _named(zones: Iterable[str] | None) -> list[str]:
    """Только НАЗВАННЫЕ зоны. `unspecified` отбрасывается ЗДЕСЬ, в одном месте, и это осознанно:
    когда тот же фильтр стоял на обеих сторонах сравнения, ни одна из двух строк не была несущей —
    снятие любой из них оставляло тесты зелёными (поймано пробой `areas-unknown-is-not-a-match`,
    которая ВЫЖИЛА на первой версии). Проверка, продублированная ради надёжности, перестаёт быть
    проверяемой."""
    return [z for z in (zones or []) if z and z != UNSPECIFIED]


def areas_overlap(mine: Iterable[str] | None, theirs: Iterable[str] | None) -> list[str]:
    """Пересечение зон: совпадение ИЛИ вложенность каталогов. -> отсортированный список общих зон.

    `unspecified` из сравнения ИСКЛЮЧЁН: неизвестность не является пересечением. Ровно это и было
    дефектом — две работы без зон «пересекались» друг с другом, и предупреждение говорило человеку
    «не трогай те же файлы», не зная ни одного файла.
    Вложенность считается, потому что `ai_ops_kit` и `ai_ops_kit/engine` — это ОДНО место: работа,
    объявившая пакет целиком, действительно держит его подсистемы.
    """
    a, b = _named(mine), _named(theirs)
    shared = set()
    for x in a:
        for y in b:
            if x == y or x.startswith(y + "/") or y.startswith(x + "/"):
                shared.add(x if len(x) >= len(y) else y)
    return sorted(shared)


WORKITEM_ID_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")


def validate_workitem_id(wid: object) -> str:
    """Reject path separators, traversal and non-slug identifiers before any I/O."""
    if not isinstance(wid, str) or not WORKITEM_ID_RE.fullmatch(wid):
        raise ValueError(
            f"недопустимый workitem_id {wid!r}: разрешён slug {WORKITEM_ID_RE.pattern} "
            "(нижний регистр, [a-z0-9._-], без '/', '\\', '..', 1..64 символа)")
    if wid.startswith(".") or ".." in wid:
        raise ValueError(f"недопустимый workitem_id {wid!r}: '.' в начале или '..' запрещены")
    return wid


def artifact_path(features_dir: str | Path, wid: object, filename: str) -> Path:
    """Reject existing escaping links; concurrent hostile link replacement is not isolated."""
    features = Path(features_dir)
    path = features / validate_workitem_id(wid) / filename
    try:
        within = path.resolve().is_relative_to(features.parent.resolve())
    except (OSError, RuntimeError) as exc:
        raise ValueError("путь артефакта нельзя проверить в пределах проекта") from exc
    if not within:
        raise ValueError("путь артефакта выходит за пределы проекта")
    return path


def validate_feature_links(features_dir: str | Path, wid: object) -> None:
    """Check existing artifact links before CLI processes can write sibling outputs."""
    directory = artifact_path(features_dir, wid, ".")
    if not directory.exists():
        return

    def refuse_scan(exc: OSError) -> None:
        raise ValueError("пути фичи нельзя проверить в пределах проекта") from exc

    for parent, dirs, files in os.walk(directory, onerror=refuse_scan, followlinks=False):
        for name in [*dirs, *files]:
            path = Path(parent) / name
            if path.is_symlink():
                artifact_path(features_dir, wid, path.relative_to(directory).as_posix())
