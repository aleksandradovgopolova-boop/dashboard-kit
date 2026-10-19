#!/usr/bin/env python3
"""Собирает kit-manifest.json — опись кита для скилла сборки дашбордов.

    python3 tools/build-manifest.py

Зачем опись, если есть README и витрина: скилл, собирающий дашборд, должен
знать, что в ките есть, до того, как начнёт писать разметку, — иначе он
соберёт «похожий» блок руками или возьмёт класс, которого нет. README для
этого велик, витрину не прочитать без браузера. Опись — одна страница фактов:
части кита, их классы, файлы и порядок подключения, функции, «когда да и
когда нет», графики и чем заменить то, чего в ките нет.

Руками опись не пишется. Части со страницей компонента берутся из tools/component_pages/
(то же, из чего собраны страницы компонентов), остальное — из
tools/manifest_parts.py, а классы, функции и зависимости скриптов читаются из
самого кода. Проверка МАНИФЕСТ в tools/check.py сверяет файл на диске с тем,
что собирает этот скрипт, и опись с кодом.

Файл называется kit-manifest.json, а не manifest.json: manifest.json в корне
сайта браузер и WebView принимают за манифест веб-приложения (README,
«С главного экрана»), а кит его намеренно не поставляет.
"""

from __future__ import annotations

import html
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import manifest_parts as MP  # noqa: E402

OUT = ROOT / "kit-manifest.json"
CSS_FILES = ["css/components.css", "css/chrome.css", "css/glass.css"]
CLASS = re.compile(r"\.(dk-[a-z0-9]+(?:(?:__|--|-)[a-z0-9]+)*)")


def load_pages() -> list[dict]:
    spec = importlib.util.spec_from_file_location("dk_build_pages", ROOT / "tools" / "build-component-pages.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.load_pages()


# --- что есть в коде -------------------------------------------------------

def strip_css_comments(text: str) -> str:
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def css_classes() -> dict[str, str]:
    """Класс → файл, где у него есть правило. Только селекторы, не тела."""
    out: dict[str, str] = {}
    for f in CSS_FILES:
        text = strip_css_comments((ROOT / f).read_text("utf-8"))
        for sel in re.findall(r"([^{}]+)\{", text):
            for c in CLASS.findall(sel):
                out.setdefault(c, f)
    return out


def owns(cls: str, px: str) -> bool:
    """Класс принадлежит префиксу по границе имени блока.

    То же правило, что в js/docs.js (owns) для раздела «Токены»: «dk-tab» берёт
    dk-tab, dk-tab__n, dk-tab--x, но не dk-table. Префикс с дефисом на конце
    («dk-td-») — семейство: всё, что с него начинается.
    """
    if px.endswith("-"):
        return cls.startswith(px)
    return cls == px or cls.startswith(px + "__") or cls.startswith(px + "--")


def script_facts() -> dict[str, dict]:
    """Что каждый скрипт объявляет и что читает у других — из кода.

    Объявления: window.dkX = …, registerTheme('имя'). Чтение: window.dkX,
    echarts., AirDatepicker, имя зарегистрированной темы в кавычках. Зависимость
    выводится, а не пишется: руками её забыли бы ровно так, как забыли
    dk-select.js в списке подключения README.
    """
    files = sorted(p for p in (ROOT / "js").glob("dk-*.js"))
    text = {f"js/{p.name}": p.read_text("utf-8") for p in files}
    defines: dict[str, list[str]] = {}
    themes: dict[str, str] = {}
    for f, t in text.items():
        defines[f] = sorted(set(re.findall(r"window\.(dk[A-Za-z]+)\s*=(?!=)", t)))
        for th in re.findall(r"registerTheme\(\s*'([\w-]+)'", t):
            themes[th] = f
    owner = {name: f for f, names in defines.items() for name in names}
    facts = {}
    for f, t in text.items():
        req = set()
        for name in re.findall(r"window\.(dk[A-Za-z]+)", t):
            if owner.get(name) and owner[name] != f:
                req.add(owner[name])
        if re.search(r"\becharts\.", t):
            req.add("vendor/echarts.min.js")
        if re.search(r"\bAirDatepicker\b", t):
            req.add("vendor/air-datepicker.js")
        for th, tf in themes.items():
            if tf != f and re.search(r"'" + re.escape(th) + r"'", t):
                req.add(tf)
        facts[f] = {"defines": defines[f], "requires": sorted(req)}
    return facts


# --- из разметки страниц в текст -------------------------------------------

def plain(s: str) -> str:
    """HTML из страниц компонентов → текст. <code> остаётся `кодом`."""
    s = re.sub(r"<code>(.*?)</code>", r"`\1`", s, flags=re.S)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def link_target(s: str) -> str | None:
    # Неизвестную ссылку не выбрасываем молча: она попадёт в опись как есть,
    # и проверка МАНИФЕСТ скажет, что части с таким именем нет.
    m = re.search(r'href="component-([a-z-]+)\.html', s)
    return m.group(1) if m else None


def from_page(p: dict) -> dict:
    return {
        "id": p["slug"], "title": p["title"], "kind": "компонент", "group": p["group"],
        "status": p["status"],
        "purpose": plain(p["purpose"]),
        "use_when": [plain(x) for x in p["when_yes"]],
        "instead": [{"when": plain(x), "use": link_target(x)} for x in p["when_no"]],
        "owns": p["tokens"],
        # Скрипты части — её собственный код (files), а не то, что грузит
        # страница компонента (scripts): живому примеру периода нужен ещё и
        # выпадающий список, самому периоду — нет. Зависимости добавит closure.
        "css": [],
        "scripts": [f for f in p["files"] if f.endswith(".js")],
        "data": [f for f in p["files"] if f.startswith("data/")],
        "js": [],
        "docs": [f"component-{p['slug']}.html"],
        "api": [{"name": plain(n), "type": plain(t), "what": plain(d)} for n, t, d in p["api"]],
        "example": p["code"],
        "rules": [plain(x) for x in p["content_ok"]],
        "avoid": [plain(x) for x in p["content_bad"]],
        "a11y": [plain(x) for x in p["a11y"]],
        "related": sorted({m.group(1) for h, _, _ in p["related"]
                           for m in [re.match(r"component-([a-z-]+)\.html", h)] if m}),
    }


def ordered(scripts: set[str]) -> list[str]:
    rank = {f: i for i, (f, _) in enumerate(MP.ORDER)}
    return sorted(scripts, key=lambda f: (rank.get(f, len(rank)), f))


def closure(scripts: list[str], facts: dict[str, dict]) -> list[str]:
    """Скрипты части плюс всё, что они читают, в порядке подключения."""
    seen: set[str] = set()
    stack = list(scripts)
    while stack:
        f = stack.pop()
        if f in seen:
            continue
        seen.add(f)
        stack.extend(facts.get(f, {}).get("requires", []))
    return ordered(seen)


def build() -> str:
    pages = load_pages()
    facts = script_facts()
    classes = css_classes()

    css_rank = {f: i for i, (f, _) in enumerate(MP.CSS_ORDER)}
    parts = [from_page(p) for p in pages] + [dict(p) for p in MP.PARTS]
    for part in parts:
        # Поля у всех частей одни и те же: скилл не должен гадать, отсутствие
        # поля — это «нет» или «забыли».
        for k, empty in (("data", []), ("api", []), ("example", ""), ("rules", []), ("avoid", []),
                         ("a11y", []), ("related", [])):
            part.setdefault(k, empty)
        part["classes"] = sorted(c for c in classes if any(owns(c, px) for px in part["owns"]))
        # Стили — из того, где правила её классов, а не из списка руками: у
        # карты в files нет components.css, хотя все её классы там.
        part["css"] = set(part["css"]) | {classes[c] for c in part["classes"]}
        part["include"] = closure(part["scripts"], facts)
        part["css"] |= {MP.VENDOR_CSS[f] for f in part["include"] if f in MP.VENDOR_CSS}
        part["css"] = sorted(part["css"], key=lambda f: (css_rank.get(f, len(css_rank)), f))
        # Функции части — то, что объявляют её собственные скрипты. У частей из
        # страниц список не пишется руками: он выводится из кода.
        if not part["js"]:
            part["js"] = sorted({n for f in part["scripts"] for n in facts.get(f, {}).get("defines", [])})

    order = {f: note for f, note in MP.ORDER}
    manifest = {
        "about": "Опись dashboard-kit для скилла сборки дашбордов. СОБРАНО tools/build-manifest.py "
                 "из tools/component_pages/, tools/manifest_parts.py и кода — руками не править; "
                 "проверка МАНИФЕСТ в tools/check.py сверяет файл с кодом.",
        "include": {
            "css": [{"file": f, "when": w} for f, w in MP.CSS_ORDER],
            "scripts": [{"file": f, "how": order[f], "defer": "без defer" not in order[f],
                         "requires": facts.get(f, {}).get("requires", [])} for f, _ in MP.ORDER],
            "rule": "Подключать только то, что есть в include частей на странице, в этом порядке. "
                    "Основа (часть base) — всегда.",
        },
        "parts": parts,
        "charts": {"types": MP.CHART_TYPES, "choose": MP.CHART_CHOOSE,
                   "doc": "README.md#Какой график выбрать"},
        "hooks": MP.HOOKS,
        "counts": {"parts": len(parts), "classes": len(classes),
                   "functions": sum(len(v["defines"]) for v in facts.values()),
                   "chart_types": len(MP.CHART_TYPES)},
    }
    return json.dumps(manifest, ensure_ascii=False, indent=1) + "\n"


def main() -> int:
    OUT.write_text(build(), "utf-8")
    print("собрано:", OUT.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
