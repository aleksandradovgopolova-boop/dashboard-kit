"""Разбор токенов дизайн-системы. Общий модуль для всех скриптов.

Токены живут в CSS, потому что CSS их и применяет. Но их значения нужны и
за пределами браузера: чтобы проверить контраст, чтобы собрать тему графиков.
Этот модуль разворачивает цепочки var(--a) → var(--b) → #hex и отдаёт готовые
таблицы значений отдельно для светлой и тёмной темы.

Единственный источник правды при этом остаётся один — сами файлы токенов.
Ни один скрипт не держит копию значений у себя.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / "css"
PRIMITIVES = CSS / "tokens.primitives.css"
SEMANTIC = CSS / "tokens.semantic.css"
COMPONENTS = CSS / "components.css"

DECL = re.compile(r"(--[a-z0-9-]+)\s*:\s*([^;]+);")
USE = re.compile(r"var\(\s*(--[a-z0-9-]+)")
HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RGB = re.compile(r"\brgba?\(")


# --- чтение ----------------------------------------------------------------

def read(path: Path) -> str:
    """Содержимое файла без комментариев."""
    return re.sub(r"/\*.*?\*/", "", path.read_text("utf-8"), flags=re.S)


def declarations(text: str) -> list[tuple[str, str]]:
    return [(m.group(1), m.group(2).strip()) for m in DECL.finditer(text)]


def blocks(text: str) -> list[tuple[str, str]]:
    """Пары (селектор, тело) верхнего уровня — нужны, чтобы разделить темы."""
    out: list[tuple[str, str]] = []
    depth, sel = 0, ""
    buf: list[str] = []
    for ch in text:
        if ch == "{":
            depth += 1
            if depth == 1:
                sel = "".join(buf).strip()
                buf = []
                continue
        elif ch == "}":
            depth -= 1
            if depth == 0:
                out.append((sel, "".join(buf)))
                buf = []
                continue
        buf.append(ch)
    return out


def theme_tables(primitives: str, semantic: str) -> dict[str, dict[str, str]]:
    """Значения всех токенов для каждой темы.

    Блок без указания темы применяется к обеим; блок с data-theme="light" —
    только к светлой. Именно так их и читает браузер.
    """
    base = dict(declarations(primitives))
    dark, light = dict(base), dict(base)

    for sel, body in blocks(semantic):
        if "@media" in sel:
            continue
        if 'data-theme="light"' in sel:
            targets = [light]
        elif 'data-theme="dark"' in sel:
            targets = [dark]
        else:
            targets = [dark, light]
        for name, value in declarations(body):
            for t in targets:
                t[name] = value
    return {"dark": dark, "light": light}


def resolve(name: str, table: dict[str, str], seen: set[str] | None = None) -> str | None:
    """Цвет токена: разворачивает var(--a) → var(--b) → #hex."""
    seen = seen or set()
    if name in seen or name not in table:
        return None
    seen.add(name)
    value = table[name].strip()
    m = USE.match(value)
    if m:
        return resolve(m.group(1), table, seen)
    return value if parse_color(value) else None


# --- цвет ------------------------------------------------------------------

def parse_color(value: str) -> tuple[float, float, float] | None:
    value = value.strip()
    if HEX.fullmatch(value):
        h = value[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) >= 6:
            return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore
    m = re.fullmatch(r"rgba?\(([^)]+)\)", value)
    if m:
        parts = [p for p in re.split(r"[,\s/]+", m.group(1)) if p]
        if len(parts) >= 3:
            try:
                return tuple(float(p) / 255 for p in parts[:3])  # type: ignore
            except ValueError:
                return None
    return None


def luminance(rgb: tuple[float, float, float]) -> float:
    def lin(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def rgba(value: str, alpha: float) -> str:
    """Тот же цвет с прозрачностью — для сетки и подложек графика."""
    c = parse_color(value)
    if not c:
        return value
    r, g, b = (round(x * 255) for x in c)
    return f"rgba({r},{g},{b},{alpha})"
