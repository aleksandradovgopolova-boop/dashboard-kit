#!/usr/bin/env python3
"""Читатель описи кита — то, чем скилл сборки дашбордов узнаёт, что есть в ките.

    python3 tools/kit.py list                 все части, по строке на каждую
    python3 tools/kit.py show table map       части целиком: когда брать, классы, API, пример
    python3 tools/kit.py head table map       готовый блок <link>/<script> в верном порядке
    python3 tools/kit.py head tile --embed    то же для кита внутри чужой страницы — без dk-theme.js
    python3 tools/kit.py charts               виды графиков и таблица выбора, с пробелами
    python3 tools/kit.py find карта           где в описи встречается слово

Зачем читатель, если есть kit-manifest.json: опись весит под девяносто
килобайт, в основном за счёт примеров, и целиком в начало работы её не
подставить. Скилл читает её так, как советует Remotion: сначала короткий
список (list — около 3300 знаков, в пятнадцать раз меньше описи), потом
только нужные части (show).

head собирает подключение сам, а не оставляет его на память: порядок здесь не
вкус (README, «Подключить»), и скилл, переписывающий теги руками, однажды
поставит dk-util.js после компонентов. Основа (часть base) входит всегда.

Опись, отставшая от кода, врёт. Поэтому читатель сверяет её с тем, что собрал
бы tools/build-manifest.py, и предупреждает, если файл устарел. Предупреждение
идёт в поток ошибок, чтобы не смешиваться с ответом.
"""

from __future__ import annotations

import difflib
import importlib.util
import io
import contextlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "kit-manifest.json"


def load() -> dict:
    if not MANIFEST.exists():
        raise SystemExit("kit-manifest.json нет — собери: python3 tools/build-manifest.py")
    text = MANIFEST.read_text("utf-8")
    try:
        spec = importlib.util.spec_from_file_location("dk_build_manifest", ROOT / "tools" / "build-manifest.py")
        mod = importlib.util.module_from_spec(spec)
        with contextlib.redirect_stdout(io.StringIO()):
            spec.loader.exec_module(mod)
            fresh = mod.build()
        if fresh != text:
            print("ВНИМАНИЕ: опись отстала от кода — ответ может врать. "
                  "Пересобери: python3 tools/build-manifest.py", file=sys.stderr)
    except Exception as e:                       # noqa: BLE001
        print(f"ВНИМАНИЕ: не удалось сверить опись с кодом ({e}) — свежесть не проверена", file=sys.stderr)
    return json.loads(text)


def first_sentence(s: str) -> str:
    for end in (". ", "? ", "! "):
        i = s.find(end)
        if 0 < i < 140:
            return s[: i + 1]
    return s if len(s) <= 140 else s[:139].rstrip() + "…"


def by_id(m: dict) -> dict[str, dict]:
    return {p["id"]: p for p in m["parts"]}


def pick(m: dict, ids: list[str]) -> list[dict]:
    """Части по именам. Неизвестное имя — ошибка с подсказкой, а не молчание:
    скилл, получивший пустоту, соберёт блок руками."""
    parts = by_id(m)
    out, unknown = [], []
    for i in ids:
        (out if i in parts else unknown).append(parts.get(i) or i)
    if unknown:
        lines = []
        for u in unknown:
            near = difflib.get_close_matches(u, parts, n=3, cutoff=0.5)
            hint = f" Похожие: {', '.join(near)}." if near else ""
            lines.append(f"Части «{u}» в ките нет.{hint} Поиск по словам: python3 tools/kit.py find <слово>")
        raise SystemExit("\n".join(lines))
    return out


# --- команды ---------------------------------------------------------------

def cmd_list(m: dict, _args: list[str]) -> str:
    rows = ["Части кита. Подробно: python3 tools/kit.py show <имя>; подключение: head <имена>.", ""]
    groups: dict[str, list[dict]] = {}
    for p in m["parts"]:
        groups.setdefault(p["group"], []).append(p)
    for group, members in groups.items():
        rows.append(f"{group}:")
        for p in members:
            rows.append(line(p))
    return finish(m, rows)


def line(p: dict) -> str:
    status = "" if p["status"] == "стабильный" else f" [{p['status']}]"
    return f"  {p['id']:9} {p['title']}{status} — {first_sentence(p['purpose'])}"


def finish(m: dict, rows: list[str]) -> str:
    t = m["charts"]["types"]
    gaps = [r for r in m["charts"]["choose"] if r.get("missing")]
    rows += ["", f"Графики ({len(t)} видов): {', '.join(t)}. "
                 f"Нет в ките: {len(gaps)} — python3 tools/kit.py charts."]
    return "\n".join(rows)


def show_part(p: dict) -> str:
    r = [f"# {p['title']} ({p['id']}) · {p['kind']} · {p['group']} · {p['status']}", "", p["purpose"]]
    if p["use_when"]:
        r += ["", "Брать, когда:"] + [f"  - {x}" for x in p["use_when"]]
    if p["instead"]:
        r += ["", "Не брать → чем заменить:"]
        r += [f"  - {x['when']}" + (f" → {x['use']}" if x["use"] else "") for x in p["instead"]]
    r += ["", "Подключить (или head " + p["id"] + "):",
          "  стили: " + (", ".join(p["css"]) or "—"),
          "  скрипты: " + (", ".join(p["include"]) or "не нужны")]
    if p["data"]:
        r.append("  данные: " + ", ".join(p["data"]) + " — страница открывается по http, не двойным щелчком")
    if p["js"]:
        r.append("  функции: " + ", ".join(p["js"]))
    r += ["", f"Классы ({len(p['classes'])}): " + " ".join(p["classes"])]
    if p["api"]:
        r += ["", "Параметры:"] + [f"  {a['name']} — {a['type']} — {a['what']}" for a in p["api"]]
    for title, key in (("Правила", "rules"), ("Не так", "avoid"), ("Доступность", "a11y")):
        if p[key]:
            r += ["", f"{title}:"] + [f"  - {x}" for x in p[key]]
    if p["example"]:
        r += ["", "Пример:", "```", p["example"].rstrip(), "```"]
    r += ["", "Подробно: " + ", ".join(p["docs"])]
    if p["related"]:
        r.append("Связанное: " + ", ".join(p["related"]))
    return "\n".join(r)


def cmd_show(m: dict, args: list[str]) -> str:
    if not args:
        raise SystemExit("Какую часть показать? python3 tools/kit.py show <имя> — имена: list")
    return "\n\n".join(show_part(p) for p in pick(m, args))


def cmd_head(m: dict, args: list[str]) -> str:
    """Блок подключения для набора частей. --prefix путь/ — если кит лежит не рядом."""
    prefix = ""
    if "--prefix" in args:
        i = args.index("--prefix")
        if i + 1 >= len(args):
            raise SystemExit("--prefix без пути: например --prefix ../dashboard-kit/")
        prefix = args[i + 1]
        args = args[:i] + args[i + 2:]
    # --embed: кит внутри чужой страницы. Тему там держит обёртка .dk-root,
    # dk-theme.js ставит атрибут на <html> хозяина и ему не нужен — так
    # устроен образец встраивания embed.html (проверочная задача скилла).
    embed = "--embed" in args
    args = [a for a in args if a != "--embed"]
    ids = ["base"] + [a for a in args if a != "base"]
    parts = pick(m, ids)
    css = {f for p in parts for f in p["css"]}
    js = {f for p in parts for f in p["include"]}
    if embed:
        js.discard("js/dk-theme.js")
    data = [f for p in parts for f in p["data"]]
    css_order = [c["file"] for c in m["include"]["css"]]
    js_order = m["include"]["scripts"]
    first = [s for s in js_order if s["file"] in js and not s["defer"]][:1]
    r = [f"<!-- dashboard-kit: {', '.join(ids)}. Собрано: python3 tools/kit.py head {' '.join(args)} -->"]
    # dk-theme.js — раньше стилей: он ставит тему до первой отрисовки.
    r += [f'<script src="{prefix}{s["file"]}"></script>' for s in first]
    r += [f'<link rel="stylesheet" href="{prefix}{f}">' for f in css_order if f in css]
    for s in js_order:
        if s["file"] in js and s not in first:
            r.append(f'<script src="{prefix}{s["file"]}"{" defer" if s["defer"] else ""}></script>')
    if data:
        r.append(f"<!-- данные рядом с китом: {', '.join(data)}; страница открывается по http -->")
    if embed:
        r.append('<!-- встроенный кит: обёртка <div class="dk-root" data-theme="dark|light" data-accent="blue"> '
                 'вокруг блоков; dk-page и каркас не ставить -->')
    else:
        r.append('<!-- корень: class="dk-root" data-theme="dark|light" data-accent="blue" '
                 'на одном элементе — <html> своей страницы или обёртка внутри чужой; '
                 'dk-page на body — только если кит владеет всей страницей -->')
    return "\n".join(r)


def cmd_charts(m: dict, _args: list[str]) -> str:
    c = m["charts"]
    r = ["Виды графиков (dkChart, часть chart; в плитке — spark, часть tile):"]
    for t, v in c["types"].items():
        r.append(f"  {t:12} {v['for']}")
        r.append(f"  {'':12} не брать: {v['not_for']}")
        r.append(f"  {'':12} скринридеру: {v['a11y']}")
    r += ["", "Что должен сделать читатель → чем показать:"]
    for row in c["choose"]:
        if row.get("missing"):
            r.append(f"  {row['task']} → НЕТ В КИТЕ: {row['missing']}. Вместо: {row['instead']}")
        else:
            opt = f", параметр {row['option']}" if row.get("option") else ""
            r.append(f"  {row['task']} → {', '.join(row['use'])}{opt}")
    r += ["", f"Сначала — нужен ли график вообще: {c['doc']}. Чего нет в ките — называть пробел, "
              f"а не собирать самодельный график."]
    return "\n".join(r)


def cmd_find(m: dict, args: list[str]) -> str:
    if not args:
        raise SystemExit("Что искать? python3 tools/kit.py find <слово>")
    q = " ".join(args).lower()
    hits = []
    for p in m["parts"]:
        fields = [("имя", [p["id"], p["title"]]), ("назначение", [p["purpose"]]),
                  ("когда брать", p["use_when"]), ("вместо", [x["when"] for x in p["instead"]]),
                  ("классы", p["classes"]), ("функции", p["js"]),
                  ("параметры", [a["name"] for a in p["api"]])]
        where = [name for name, vals in fields if any(q in v.lower() for v in vals)]
        if where:
            hits.append(f"  {p['id']:9} {p['title']} — {', '.join(where)}")
    for row in m["charts"]["choose"]:
        if q in row["task"].lower() or q in row.get("missing", "").lower():
            hits.append(f"  график: {row['task']} → charts")
    if not hits:
        return (f"«{q}» в описи не найдено. Если этого нет в ките — так и скажи человеку, "
                f"а не собирай блок руками. Все части: python3 tools/kit.py list")
    return f"«{q}»:\n" + "\n".join(hits)


COMMANDS = {"list": cmd_list, "show": cmd_show, "head": cmd_head, "charts": cmd_charts, "find": cmd_find}


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in COMMANDS:
        print(__doc__.split("\n\n")[1], file=sys.stderr)
        return 2
    print(COMMANDS[argv[0]](load(), argv[1:]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
