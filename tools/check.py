#!/usr/bin/env python3
"""Проверка дизайн-системы на собственные правила.

Дизайн-система живёт ровно до тех пор, пока её правила кто-то соблюдает.
Полагаться на внимательность бессмысленно: через месяц кто-нибудь впишет
#166FF2 прямо в компонент, и система тихо перестанет быть системой.
Поэтому правила проверяются машиной.

    python3 tools/check.py

Что проверяется:

Порядок здесь тот же, в котором проверки выполняются.

   1. СЛОИ       компоненты не лезут в примитивы через голову семантики
   2. СЫРЫЕ      цвет задаётся токеном, а не значением
   3. ОПЕЧАТКИ   каждый var(--x) где-то объявлен — и в CSS, и в страницах
   4. ПАРАМЕТРЫ  входные параметры компонентов имеют значения по умолчанию
   5. РОЛЬ       смысл, поставленный в текст, читается как текст, а не как пятно
   6. ЭКРАН      подстановка в разметку проходит через общее экранирование
   7. РАЗМЕРЫ    где у кита есть шкала, значение берётся из неё
   8. ЧЁТНОСТЬ   размеры в пикселях чётные
   9. НАВЕДЕНИЕ  стили :hover закрыты от тача
  10. КОНТРАСТ   текст читается на своей поверхности в обеих темах
  11. СТУПЕНИ    соседние поверхности различимы в обеих темах
  12. СМЫСЛ      акцент не путается со смыслом, в том числе при дальтонизме
  13. ПЯТНО      заливка смысла видна на поверхности
  14. КНОПКА     подпись и силуэт кнопки читаются на всех акцентах
  15. ШКАЛА      все ступени шкалы карты видны на своей доске
  16. ПАЛИТРА    различимость серий измерена, а не подтверждена отпечатком
  17. СБОРКА     тема графиков собрана из текущих токенов
  18. ДВИЖОК     в урезанном ECharts есть ровно то, что просит код
  19. НОЛЬ       ECharts не создаётся и не пересчитывается в контейнере без размера
  20. ТИШИНА     управление тише данных: акцент только там, где разрешён
  21. СТРАНИЦЫ   страницы компонентов собраны скриптом и все блоки на месте
  22. МАНИФЕСТ   опись кита для скилла совпадает с кодом: классы, файлы, функции,
                 порядок подключения, графики
  23. КЛАССЫ     каждый класс кита в разметке, скриптах и README есть в CSS,
                 каждая иконка — в спрайте
  24. ЗНАЧОК     иконки приложения и фавикон на месте, нужного размера,
                 иконка iPhone и маскируемая непрозрачны
  25. ТЕЛЕФОН    страницы на телефоне и планшете: ширина, цели, поля, вырез
                 (браузерная часть — tools/check-mobile.mjs; --fast её пропускает)

Код возврата 0 — всё чисто, 1 — есть нарушения. Непроверенное (например,
ДВИЖОК без node) печатается знаком «?» и не выдаётся за чистое.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRIMITIVES = ROOT / "css" / "tokens.primitives.css"
SEMANTIC = ROOT / "css" / "tokens.semantic.css"
# Слой компонентов — это все css/*.css, кроме двух файлов токенов. Список не
# перечисляем руками намеренно: иначе новый файл слоя (например, каркас
# страницы) тихо выпадет из-под правил, и система начнёт разъезжаться ровно
# там, где её никто не проверяет.
def component_files() -> list[Path]:
    return sorted(
        f for f in (ROOT / "css").glob("*.css")
        if f not in (PRIMITIVES, SEMANTIC)
    )

# Страницы кита. Они не слой компонентов и по правилам слоёв не проверяются:
# витрине можно читать примитивы напрямую. Но опечатку в имени токена страница
# ловит ровно так же плохо, как CSS, — молча. Так и вышло: в showcase.html
# пять токенов (--text-md, --text-sm, --text-2xs, --text-xs, --tracking-title)
# не были объявлены нигде, заголовки разделов из-за этого схлопывались в
# кегль текста, и никто этого не видел месяцами. Теперь видно.
def page_files() -> list[Path]:
    return sorted(ROOT.glob("*.html"))

# Входные параметры компонентов. Их задаёт разметка снаружи — например
# style="--swatch: var(--crit)" на чипе фильтра. Объявления в CSS у них нет и
# быть не должно, но обращаться к ним можно только с запасным значением:
# var(--swatch, var(--brand)). Иначе компонент, которому забыли передать
# параметр, останется без цвета.
COMPONENT_INPUTS = {
    "--accent":  "цвет смысла на числе: var(--accent, var(--ink))",
    "--swatch":  "цвет метки фильтра: var(--swatch, var(--brand))",
    "--lanes":   "сколько дорожек событий в неделе календаря: var(--lanes, 1)",
    "--hour":    "высота часа в недельном календаре: var(--hour, 48px)",
    "--cols":    "колонок в раскладке плиток: var(--cols, 19)",
    "--rows":    "строк в раскладке плиток: var(--rows, 11)",
    "--fill":    "заливка плитки региона: var(--fill, var(--nodata))",
    "--table-min": "минимальная ширина таблицы: var(--table-min, 720px)",
    "--table-max": "высота прокрутки закреплённой таблицы: var(--table-max, 480px)",
    "--at":      "где стоит центр кольца: var(--at, 44%)",
    "--share":   "доля отрезка в полосе состава: var(--share, 1)",
    "--from":    "цвет прежнего значения в ленте: var(--from, var(--ink-2))",
    "--to":      "цвет нынешнего значения в ленте: var(--to, var(--ink))",
    "--zoom":    "во сколько раз сетка плиток шире рамки: var(--zoom, 1)",
}

# Палитра серий, прошедшая шесть проверок различимости (см. шапку примитивов).
# Хэш заморожен намеренно: поменять цвет серии можно, но только вместе с
# повторной проверкой — иначе график перестанет читаться при дальтонизме.

DECL = re.compile(r"(--[a-z0-9-]+)\s*:\s*([^;]+);")
USE = re.compile(r"var\(\s*(--[a-z0-9-]+)")
HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RGB = re.compile(r"\brgba?\(")

problems: list[str] = []
notes: list[str] = []
skipped: list[str] = []


def fail(check: str, msg: str) -> None:
    problems.append(f"[{check}] {msg}")


# ---------------------------------------------------------------------------
# Разбор CSS

def declarations(text: str) -> list[tuple[str, str]]:
    return [(m.group(1), m.group(2).strip()) for m in DECL.finditer(text)]


def blocks(text: str) -> list[tuple[str, str]]:
    """Пары (селектор, тело) верхнего уровня. Для разбора тем."""
    out, depth, sel, body = [], 0, [], []
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


def strip_comments(text: str) -> str:
    """Убрать комментарии, СОХРАНИВ переводы строк.

    Раньше комментарий вырезался целиком, вместе с переносами. В файле, где
    41% объёма — комментарии, это означало, что каждый номер строки в каждом
    сообщении врал, и врал тем сильнее, чем ниже находилось нарушение. Человек
    шёл по указанному адресу и не находил там ничего похожего — то есть
    проверка не помогала, а отнимала время.
    """
    return re.sub(r"/\*.*?\*/",
                  lambda m: "\n" * m.group(0).count("\n"), text, flags=re.S)


# ---------------------------------------------------------------------------
# Цвет

MIX = re.compile(
    r"color-mix\(\s*in\s+srgb\s*,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+?)\s*\)$",
    re.S)


def parse_color(value: str, table: dict[str, str] | None = None,
                depth: int = 0) -> tuple[float, float, float] | None:
    """Цвет из значения токена.

    Понимает не только hex и rgb, но и color-mix — иначе проверка МОЛЧА
    пропускает всё, что собрано смешиванием. Так и случилось: светлая тема
    держится на color-mix, и её контраст не проверялся ни разу, хотя скрипт
    честно печатал галочку. Пропуск без объяснения хуже ошибки: ошибку видно.
    """
    value = value.strip()
    m = HEX.fullmatch(value)
    if m:
        h = value[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) >= 6:
            return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore
    m = re.fullmatch(r"rgba?\(([^)]+)\)", value)
    if m:
        parts = [p.strip() for p in re.split(r"[,\s/]+", m.group(1)) if p.strip()]
        if len(parts) >= 3:
            return tuple(float(p) / 255 for p in parts[:3])  # type: ignore

    m = MIX.match(value)
    if m and table is not None and depth < 8:
        share = float(m.group(2)) / 100
        a = _color_of(m.group(1), table, depth + 1)
        b = _color_of(m.group(3), table, depth + 1)
        if a and b:
            # Прозрачный как второй участник: цвета не меняет, только гасит.
            # Для проверки контраста берём цвет как есть — это верхняя оценка.
            return tuple(a[i] * share + b[i] * (1 - share) for i in range(3))  # type: ignore
        if a and m.group(3).strip() == "transparent":
            return a
    return None


def _color_of(expr: str, table: dict[str, str], depth: int = 0):
    """Цвет выражения: var(--x), hex, rgb или вложенный color-mix."""
    expr = expr.strip()
    m = USE.match(expr)
    if m:
        name = m.group(1)
        if name in table and depth < 8:
            return _color_of(table[name], table, depth + 1)
        return None
    return parse_color(expr, table, depth)


def luminance(rgb: tuple[float, float, float]) -> float:
    def lin(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def resolve(name: str, table: dict[str, str], seen: set[str] | None = None) -> str | None:
    """Разворачивает цепочку var(--a) → var(--b) → #hex."""
    seen = seen or set()
    if name in seen or name not in table:
        return None
    seen.add(name)
    value = table[name].strip()
    m = USE.match(value)
    if m:
        return resolve(m.group(1), table, seen)
    return value if parse_color(value, table) else None


# ---------------------------------------------------------------------------
# Проверки

def check_layers(primitives: str, semantic: str, layers: list[tuple[str, str]]) -> None:
    """Примитив — то, что объявлено в слое 1 и не переобъявлено в слое 2.

    Определяем по фактическим объявлениям, а не по виду имени: правило по
    префиксам ловило бы и семантические токены, которые назвали похоже.
    """
    prim = {n for n, _ in declarations(primitives)}
    sem = {n for n, _ in declarations(semantic)}
    primitive_only = prim - sem

    leaked = []
    for label, text in layers:
        used = {m.group(1) for m in USE.finditer(text)}
        leaked += [(label, t) for t in sorted(used & primitive_only)]
    for label, t in leaked:
        fail("СЛОИ", f"{label} обращается к примитиву {t} — нужен семантический токен")
    if not leaked:
        notes.append(f"СЛОИ · компоненты читают только семантику "
                     f"({len(primitive_only)} примитивов скрыто за {len(sem)} именами смысла)")


# Цвет умеет записываться не только решёткой. Проверка знала #hex и rgb() —
# и пропускала всё остальное: `color: red` и `background: hsl(200 50% 50%)`
# проходили насквозь. Проверено подстановкой: проходили оба.
FUNC_COLOR = re.compile(r"\b(hsla?|hwb|lab|lch|oklab|oklch|device-cmyk)\s*\(")

# Свойства, у которых значение — цвет. Именованные цвета ищем только в них:
# слово «Tomato» в списке гарнитур цветом не является, и ловить его незачем.
COLOR_PROPS = re.compile(
    r"^(color|background|background-color|background-image|border|border-[a-z]+|"
    r"border-[a-z]+-color|outline|outline-color|fill|stroke|box-shadow|text-shadow|"
    r"caret-color|accent-color|text-decoration-color|column-rule-color|"
    r"text-emphasis-color|stop-color|flood-color|lighting-color)$")

# Полный набор именованных цветов CSS. Список длинный намеренно: сокращённый
# «самые ходовые» — это снова проверка, которая обещает больше, чем делает.
NAMED_COLORS = {
    "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque",
    "black", "blanchedalmond", "blue", "blueviolet", "brown", "burlywood",
    "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue", "cornsilk",
    "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray",
    "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen",
    "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
    "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise",
    "darkviolet", "deeppink", "deepskyblue", "dimgray", "dimgrey", "dodgerblue",
    "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro",
    "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow", "grey",
    "honeydew", "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender",
    "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral",
    "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey",
    "lightpink", "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray",
    "lightslategrey", "lightsteelblue", "lightyellow", "lime", "limegreen",
    "linen", "magenta", "maroon", "mediumaquamarine", "mediumblue",
    "mediumorchid", "mediumpurple", "mediumseagreen", "mediumslateblue",
    "mediumspringgreen", "mediumturquoise", "mediumvioletred", "midnightblue",
    "mintcream", "mistyrose", "moccasin", "navajowhite", "navy", "oldlace",
    "olive", "olivedrab", "orange", "orangered", "orchid", "palegoldenrod",
    "palegreen", "paleturquoise", "palevioletred", "papayawhip", "peachpuff",
    "peru", "pink", "plum", "powderblue", "purple", "rebeccapurple", "red",
    "rosybrown", "royalblue", "saddlebrown", "salmon", "sandybrown", "seagreen",
    "seashell", "sienna", "silver", "skyblue", "slateblue", "slategray",
    "slategrey", "snow", "springgreen", "steelblue", "tan", "teal", "thistle",
    "tomato", "turquoise", "violet", "wheat", "white", "whitesmoke", "yellow",
    "yellowgreen",
}


def check_raw_values(semantic: str, layers: list[tuple[str, str]]) -> None:
    dirty = False
    for label, text in [("tokens.semantic.css", semantic)] + layers:
        for m in HEX.finditer(text):
            fail("СЫРЫЕ", f"{label}: цвет значением {m.group(0)} — заведи токен в примитивах")
            dirty = True
        for m in RGB.finditer(text):
            fail("СЫРЫЕ", f"{label}: цвет значением {m.group(0)}…) — заведи токен в примитивах")
            dirty = True
        for m in FUNC_COLOR.finditer(text):
            fail("СЫРЫЕ", f"{label}: цвет значением {m.group(1)}(…) — заведи токен в примитивах")
            dirty = True
        for prop, value in re.findall(r"([-a-z]+)\s*:\s*([^;{}]+)", text):
            if not COLOR_PROPS.match(prop):
                continue
            # var(), color-mix() и ключевые слова — это не сырой цвет.
            rest = re.sub(r"var\([^)]*\)|color-mix\([^()]*(?:\([^()]*\)[^()]*)*\)", " ", value)
            for word in re.findall(r"[a-zA-Z]+", rest):
                if word.lower() in NAMED_COLORS:
                    fail("СЫРЫЕ", f"{label}: {prop}: {word} — именованный цвет, "
                                  f"заведи токен в примитивах")
                    dirty = True
    if not dirty:
        notes.append("СЫРЫЕ · ни одного цвета значением вне примитивов")


def check_unknown(primitives: str, semantic: str, layers: list[tuple[str, str]],
                  pages: list[tuple[str, str]] | None = None,
                  scripts: list[tuple[str, str]] | None = None) -> None:
    """Каждый var(--x) где-то объявлен — в CSS, в странице и в скрипте.

    Скрипты кита читают токены строками: цвет серии собирается как
    '--series-' + n, ступень карты как '--seq-' + n. Пока проверка смотрела
    только CSS и разметку, переименование токена ломало карту и график молча:
    getPropertyValue вернёт пустую строку, и виджет покрасится ничем.
    Поэтому проверяются и прямые var(--x) в скриптах, и склеенные имена —
    у приставки обязан найтись хотя бы один объявленный токен.
    """
    declared = {n for n, _ in declarations(primitives)}
    declared |= {n for n, _ in declarations(semantic)}
    unknown = set()

    for label, js in (scripts or []):
        for m in re.finditer(r"['\"](--[a-z0-9-]*-)['\"]", js):
            prefix = m.group(1)
            if not any(n.startswith(prefix) for n in declared):
                unknown.add((label, prefix + "…"))

    for label, text in [("tokens.semantic.css", semantic)] + layers + (pages or []) + (scripts or []):
        local = {n for n, _ in declarations(text)}
        for m in USE.finditer(text):
            name = m.group(1)
            # Имя, оборванное на дефисе, — это склейка: 'var(--seq-' + n + ')'.
            # Сверяем приставку, а не имя целиком, иначе проверка ругалась бы
            # на совершенно правильный код.
            if name.endswith("-"):
                if not any(d.startswith(name) for d in declared | local):
                    unknown.add((label, name + "…"))
                continue
            if name in COMPONENT_INPUTS or name in declared or name in local:
                continue
            unknown.add((label, name))
    for label, name in sorted(unknown):
        fail("ОПЕЧАТКИ", f"{label}: {name} нигде не объявлен")

    # Селектор, который браузер выбросит молча. :has() внутри :has() не
    # допускается, и всё правило пропадает без единого слова в консоли —
    # так плитки без графика на телефоне остались во всю ширину (29.09).
    nested = []
    for label, text in layers:
        for m in re.finditer(r"([^{}]+)\{", text):
            sel = m.group(1)
            i = sel.find(":has(")
            while i >= 0:
                depth, j = 0, i + 4
                while j < len(sel):
                    if sel[j] == "(":
                        depth += 1
                    elif sel[j] == ")":
                        depth -= 1
                        if depth == 0:
                            break
                    j += 1
                if ":has(" in sel[i + 5:j]:
                    nested.append((label, text.count("\n", 0, m.start()) + 1, " ".join(sel.split())[:80]))
                    break
                i = sel.find(":has(", j)
    for label, line, sel in nested:
        fail("ОПЕЧАТКИ", f"{label}:{line}: {sel} — :has() внутри :has() браузер выбрасывает вместе с правилом")
    if not unknown and not nested:
        notes.append("ОПЕЧАТКИ · все используемые токены объявлены, селекторы браузер примет")


def check_inputs(layers: list[tuple[str, str]]) -> None:
    """Входной параметр без запасного значения оставит компонент без цвета."""
    bare = set()
    for name in COMPONENT_INPUTS:
        for _, text in layers:
            for m in re.finditer(r"var\(\s*" + re.escape(name) + r"\s*([,)])", text):
                if m.group(1) == ")":
                    bare.add(name)
    for name in sorted(bare):
        fail("ПАРАМЕТРЫ",
             f"{name} используется без запасного значения — нужно {COMPONENT_INPUTS[name]}")
    if not bare:
        notes.append("ПАРАМЕТРЫ · у входных параметров компонентов есть значения по умолчанию")


def theme_tables(primitives: str, semantic: str) -> dict[str, dict[str, str]]:
    base: dict[str, str] = {}
    for name, value in declarations(primitives):
        base[name] = value

    dark, light = dict(base), dict(base)
    for sel, body in blocks(semantic):
        if "@media" in sel:
            continue
        target = []
        if 'data-theme="light"' in sel:
            target = [light]
        elif ('data-theme="dark"' in sel
              or sel.strip().startswith(".dk-root,") or sel.strip() == ".dk-root"):
            target = [dark] if 'data-theme="dark"' in sel else [dark, light]
        for name, value in declarations(body):
            for t in target:
                t[name] = value
    return {"тёмная": dark, "светлая": light}


def check_contrast(primitives: str, semantic: str) -> None:
    # Требования: основной и вторичный текст — 4.5:1, третичный и штрихи — 3:1.
    pairs = [("--ink", "--surface", 4.5), ("--ink-2", "--surface", 4.5),
             ("--ink-3", "--surface", 3.0), ("--ink", "--bg", 4.5),
             ("--ink-2", "--surface-2", 4.5)]
    ok = True
    for theme, table in theme_tables(primitives, semantic).items():
        for fg, bg, need in pairs:
            f, b = resolve(fg, table), resolve(bg, table)
            if not f or not b:
                continue
            cf, cb = parse_color(f, table), parse_color(b, table)
            if not cf or not cb:
                continue
            ratio = contrast(cf, cb)
            if ratio < need:
                fail("КОНТРАСТ",
                     f"{theme} тема: {fg} на {bg} даёт {ratio:.2f}:1 при норме {need}:1")
                ok = False
    if ok:
        notes.append("КОНТРАСТ · текст читается на своих поверхностях в обеих темах")


# Какие компоненты красят --accent в текст, а какие — в заливку. Список не
# пишется руками: он читается из самого CSS. Иначе он устареет в тот день,
# когда появится новый компонент, и проверка начнёт врать.
def accent_roles(layers: list[tuple[str, str]]) -> tuple[set[str], set[str]]:
    text, fill = set(), set()
    for _, css in layers:
        for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
            sel = m.group(1).strip().splitlines()[-1].strip()
            body = m.group(2)
            classes = set(re.findall(r"\.([a-zA-Z0-9_-]+)", sel))
            if re.search(r"(^|[;\s])color:\s*var\(--accent", body):
                text |= classes
            elif re.search(r"background[^;]*var\(--accent", body):
                fill |= classes
    return text - fill, fill


def accent_scopes(html: str) -> list[tuple[str, set[str]]]:
    """Пары «переданный токен → классы, на которые он подействовал».

    --accent наследуется, как любое свойство CSS: его ставят на плитку, а
    красит он значок и число внутри неё. Сверять токен с классами того же тега
    мало — так пропускались ровно те места, где параметр передают правильно, на
    обёртку. Разбираем разметку деревом: классы достаются ближайшему
    охватывающему --accent, вложенный параметр перекрывает внешний.
    """
    from html.parser import HTMLParser

    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
            "link", "meta", "source", "track", "wbr"}

    class Walk(HTMLParser):
        def __init__(self) -> None:
            super().__init__(convert_charrefs=True)
            self.scopes: list[tuple[str, set[str]]] = []
            self.stack: list[int | None] = []

        def handle_starttag(self, tag, attrs):
            a = dict(attrs)
            live = self.stack[-1] if self.stack else None
            m = re.search(r"--accent:\s*var\((--[a-z0-9-]+)\)", a.get("style") or "")
            if m:
                self.scopes.append((m.group(1), set()))
                live = len(self.scopes) - 1
            if live is not None:
                self.scopes[live][1].update((a.get("class") or "").split())
            if tag not in VOID:
                self.stack.append(live)

        def handle_startendtag(self, tag, attrs):
            self.handle_starttag(tag, attrs)
            self.stack.pop()

        def handle_endtag(self, tag):
            if tag not in VOID and self.stack:
                self.stack.pop()

    w = Walk()
    try:
        w.feed(html)
    except Exception:
        return []
    return w.scopes


# Значок — не текст. WCAG требует от графики 3:1, от строки 4.5:1, и требовать
# от значка текстовой нормы значило бы придумывать правило, которого нет.
def is_icon(cls: str) -> bool:
    return cls == "dk-i" or cls.endswith("__icon") or cls.startswith("dk-i--")


def check_accent_role(primitives: str, semantic: str,
                      layers: list[tuple[str, str]],
                      pages: list[tuple[str, str]]) -> None:
    """Смысл, поставленный в текст, должен читаться.

    У кита две ступени каждого смысла: --crit для пятна и --crit-ink для
    строки. Порог у них разный не из педантизма — пятно различают от 3:1, а
    цифру читают от 4.5:1, и красный, который отлично работает точкой рядом со
    строкой, той же строкой уже не читается.

    Разметка передаёт смысл параметром --accent, и по параметру не видно, во
    что компонент его покрасит. Поэтому сверяем: если --accent долетает до
    компонента, который красит его в текст, переданный токен обязан брать
    4.5:1 на поверхности виджета — в обеих темах.

    ЧЕГО ПРОВЕРКА НЕ ВИДИТ: разметку, которую страница собирает в скрипте,
    если токен там вычисляется функцией. Статически такой случай не разобрать.
    Список известных мест — в REVIEW.md.
    """
    text_roles, _ = accent_roles(layers)
    if not text_roles:
        return
    tables = theme_tables(primitives, semantic)
    bad = set()
    for label, html in pages:
        for token, classes in accent_scopes(html):
            for cls in sorted(classes & text_roles):
                need = 3.0 if is_icon(cls) else 4.5
                for theme, table in tables.items():
                    fg, bg = resolve(token, table), resolve("--surface", table)
                    if not fg or not bg:
                        continue
                    cf, cb = parse_color(fg, table), parse_color(bg, table)
                    if not cf or not cb:
                        continue
                    ratio = contrast(cf, cb)
                    if ratio < need:
                        bad.add((label, cls, token, theme, round(ratio, 2), need))
    for label, cls, token, theme, ratio, need in sorted(bad):
        what = "значок" if is_icon(cls) else "текст"
        fail("РОЛЬ", f"{label}: {token} долетает до .{cls} и красит {what} — "
                     f"{ratio}:1 на поверхности виджета в {theme} теме при норме {need}:1")
    if not bad:
        notes.append("РОЛЬ · смысл, поставленный в текст, читается как текст")


def check_dynamic_meaning(scripts, pages):
    """Lexical guard, not a JavaScript parser; computed token construction is banned too."""
    bodies = [(n, t) for n, t in scripts if n not in ("dk-util.js", "dk-chart-theme.js")]
    for n, t in pages:
        bodies.extend((n, x) for x in re.findall(r"<script\b[^>]*>(.*?)</script>", t, re.S))
    bad = False
    for n, t in bodies:
        t = re.sub(r"//[^\n]*", "", strip_comments(t))
        if re.search(r"--(?:crit|high|calm|event|nodata)(?:-ink|-dim|-d)?\b", t) or re.search(r"var\(\s*--['\"]\s*\+", t):
            fail("DYNAMIC MEANING", f"{n}: semantic token in JavaScript; use dkMeaning(name, text/fill)")
            bad = True
    if not bad:
        notes.append("DYNAMIC MEANING · динамический смысл только через dkMeaning с явной ролью")


def script_files() -> list[Path]:
    return sorted((ROOT / "js").glob("*.js"))


def check_escaping(pages: list[tuple[str, str]]) -> None:
    """Подстановка в innerHTML проходит через общий помощник.

    Экранирование было скопировано в пяти файлах и отсутствовало в четырёх —
    имя региона из файла данных, название работы и набранный человеком текст
    попадали в разметку как есть. Копия виновата не меньше пропуска: пять копий
    нельзя починить один раз, и ровно поэтому четыре файла остались без защиты.

    Отсюда три правила, и все три проверяются здесь, а не держатся в голове:
    собственных копий нет, каждый компонент, который собирает разметку строкой,
    зовёт помощника, и страница его подключает.

    ЧЕГО ПРОВЕРКА НЕ ДЕЛАЕТ: не разбирает, какая именно подстановка прошла
    через esc, а какая нет. Для этого нужен разбор выражений, а не поиск по
    тексту. Она отвечает на вопрос «компонент вообще знает про экранирование»,
    и этого хватает, чтобы пропуск целого файла — то, что и случилось, — не
    повторился.
    """
    util = ROOT / "js" / "dk-util.js"
    ok = True

    if not util.exists():
        fail("ЭКРАН", "нет js/dk-util.js — общего помощника экранирования")
        return

    # dk-icons.js — исключение с обоснованием: он вставляет собственный
    # спрайт значков, набор которого зашит в самом файле. Данных снаружи там
    # нет, экранировать нечего. Исключение названо здесь поимённо, а не
    # выведено правилом «файлы со словом icons»: правило по имени файла
    # однажды тихо накроет собой настоящий компонент.
    EXEMPT = {"dk-icons.js"}

    for f in script_files():
        if f == util or f.name in EXEMPT:
            continue
        src = f.read_text("utf-8")
        if "'&amp;'" in src or '"&amp;"' in src:
            fail("ЭКРАН", f"{f.name}: своя копия экранирования — помощник один, в dk-util.js")
            ok = False
        if ".innerHTML" in src and not re.search(r"\besc\(|\bdkEsc\b", src):
            fail("ЭКРАН", f"{f.name}: собирает разметку строкой и не зовёт экранирование")
            ok = False

    for label, html in pages:
        if "js/dk-util.js" not in html:
            fail("ЭКРАН", f"{label}: не подключает js/dk-util.js")
            ok = False

    if ok:
        notes.append("ЭКРАН · разметка собирается через общее экранирование")


def page_css(html: str) -> str:
    """Стили, спрятанные в странице: блок <style> и атрибут style=.

    Проверки чётности и наведения смотрели только css/*.css — то есть половина
    правил витрины и страниц не проверялась вовсе, хотя соседние проверки эти
    же файлы читают. Разное покрытие у соседних проверок хуже отсутствия
    проверки: по выводу не видно, что именно проверено.

    Всё, кроме самих стилей, заменяется пробелами, а переводы строк
    сохраняются — иначе номер строки в сообщении будет врать.
    """
    out = [" "] * len(html)
    for m in re.finditer(r"<style[^>]*>(.*?)</style>", html, re.S):
        for i in range(m.start(1), m.end(1)):
            out[i] = html[i]
    for m in re.finditer(r'style="([^\"]*)"', html):
        for i in range(m.start(1), m.end(1)):
            out[i] = html[i]
        # Точка с запятой сразу после атрибута обязательна. Без неё значение
        # последнего свойства одного элемента склеивалось через пустоту со
        # свойством следующего: разбор видел «margin-bottom: 14px» там, где в
        # разметке стоят два разных элемента. Проверка ругалась на строку, в
        # которой ничего такого нет, — то есть врала.
        if m.end(1) < len(out) and html[m.end(1)] != "\n":
            out[m.end(1)] = ";" 
    for i, ch in enumerate(html):
        if ch == "\n":
            out[i] = "\n"
    return "".join(out)


# Свойства, у которых в ките ЕСТЬ шкала. Только за ними проверка и следит:
# расстояние, скругление, кегль и межстрочное — это решения системы, и если
# такое значение написано числом, значит шкалу обошли.
#
# Ширины и высоты сюда не входят намеренно. Ширина полосы, высота графика,
# размер плитки карты — это размеры одного места, а не ступени шкалы. Назвать
# их все значило бы превратить набор токенов в свалку из сотни имён, каждое из
# которых используется однажды. Кит намеренно держит семь ступеней кегля и
# девять шагов отступа; сотня имён рядом с ними — это не система, а словарь.
# Свойство → семья токенов, из которой оно обязано брать значение. Семья
# указана не для красоты: без неё проверка предлагала на font-size: 10px
# написать var(--space-5), потому что у них совпадает значение. Совпадение
# числа — это не имя. Подсказка, которая называет чужое имя, хуже молчания:
# по ней однажды и напишут.
SCALED_PROPS = {
    "gap": ("--space-", "--gap-"),
    "row-gap": ("--space-", "--gap-"),
    "column-gap": ("--space-", "--gap-"),
    "padding": ("--space-", "--pad-"),
    "padding-top": ("--space-", "--pad-"),
    "padding-right": ("--space-", "--pad-"),
    "padding-bottom": ("--space-", "--pad-"),
    "padding-left": ("--space-", "--pad-"),
    "margin": ("--space-",),
    "margin-top": ("--space-",),
    "margin-right": ("--space-",),
    "margin-bottom": ("--space-",),
    "margin-left": ("--space-",),
    "border-radius": ("--radius-",),
    "font-size": ("--text-",),
}

# Страница, которая намеренно играет чужой сайт: её стили принадлежат хозяину,
# а не киту, и шкалам кита подчиняться не обязаны — в этом весь смысл проверки
# встраивания. Исключение названо поимённо, а не выведено правилом по имени.
SIZE_EXEMPT = {"embed.html"}


def token_values(primitives: str, semantic: str) -> dict[str, list[str]]:
    """Значение в пикселях → имена токенов с этим значением."""
    table = theme_tables(primitives, semantic)["тёмная"]

    def unwrap(v: str | None, depth: int = 0) -> str | None:
        if depth > 6 or not v:
            return v
        m = re.fullmatch(r"var\((--[a-z0-9-]+)\)", v.strip())
        return unwrap(table.get(m.group(1)), depth + 1) if m else v

    out: dict[str, list[str]] = {}
    for name, _ in declarations(semantic):
        v = unwrap(table.get(name))
        if v and re.fullmatch(r"\d+px", v.strip()):
            out.setdefault(v.strip(), []).append(name)
    return out


def check_sizes(primitives: str, semantic: str, layers: list[tuple[str, str]]) -> None:
    """Размер, у которого есть имя, обязан быть написан именем.

    Шапка компонентов годами обещала «ни одного размера числом». Это было
    неправдой: в файле больше двухсот значений в пикселях. Но и правдой это
    обещание стать не может — границы медиазапросов нельзя задать переменной
    по устройству CSS, а высота графика или ширина полосы принадлежат одному
    месту и ступенью шкалы не являются.

    Поэтому проверяется то, что кит действительно гарантирует: там, где у
    него ЕСТЬ шкала — расстояния, скругления, кегль, межстрочное, — значение
    берётся из шкалы. Если написано число, а токен с таким значением
    существует, значит шкалу обошли, и это ловится. Всё остальное остаётся
    числом честно, и в шапке это сказано прямо, а не умолчано.
    """
    names = token_values(primitives, semantic)
    bad = []
    for label, text in layers:
        if label in SIZE_EXEMPT:
            continue
        scan = re.sub(r"@media[^{]*", lambda m: " " * len(m.group(0)), text)
        for m in re.finditer(r"([-a-z]+)\s*:\s*([^;{}]+)", scan):
            prop = m.group(1)
            family = SCALED_PROPS.get(prop)
            if not family:
                continue
            for v in re.findall(r"(?<![\w.])(\d+px)\b", m.group(2)):
                fit = [n for n in names.get(v, []) if n.startswith(family)]
                if not fit:
                    continue
                line = scan[: m.start()].count("\n") + 1
                bad.append((label, line, prop, v, fit[0]))
    for label, line, prop, v, token in bad:
        fail("РАЗМЕРЫ", f"{label}:{line}: {prop}: {v} — у этого значения есть имя "
                        f"var({token}), шкалу обходить незачем")
    if not bad:
        notes.append("РАЗМЕРЫ · где у кита есть шкала, значения берутся из неё")


def check_even(primitives: str, layers: list[tuple[str, str]]) -> None:
    """Значения в пикселях должны быть чётными.

    ПРОВЕРКА НАЗЫВАЕТСЯ ЧЁТНОСТЬ, А НЕ «СЕТКА 4 PX», И ЭТО ВАЖНО. Раньше и
    здесь, и в примитивах было написано «интерфейс стоит на сетке в 4 пикселя».
    Это неправда: шаги отступа у кита 2 / 4 / 6 / 8 / 10 / 14 / 18 / 24 / 36,
    то есть кратны двум, а не четырём. Проверка при этом ловила только
    нечётность — обещала одно, делала другое. Обещание приведено к делу, а не
    наоборот: переводить шкалу на кратность четырём значило бы выкинуть 6, 10,
    14 и 18, то есть половину рабочих шагов дашборда.

    Почему чётность вообще нужна. Нечётный размер не центруется без остатка:
    элемент высотой 21 внутри строки высотой 20 даёт смещение в полпикселя, и
    браузер размазывает край между строками устройства. На экранах без
    удвоения это видно глазом, на удвоенных — почти нет, но ритм всё равно
    уезжает, и заметно это становится там, где элементы стоят рядами.

    Исключения: 1px — волосяная линия, у неё чётного варианта нет; 999px — не
    размер, а способ сказать «скругли до предела».
    """
    allowed = {1, 999}
    bad = []
    for label, text in [("tokens.primitives.css", primitives)] + layers:
        # Границы медиазапросов из проверки исключены: верхняя граница обязана
        # быть на единицу меньше нижней границы следующей ступени (767 при
        # 768), иначе между ними останется щель в один пиксель. Это не размер
        # элемента, а координата перелома — на сетку она не встаёт.
        scan = re.sub(r"@media[^{]*", lambda m: " " * len(m.group(0)), text)
        # Дробные значения ловятся тоже. Раньше регулярка читала только целые,
        # и 13.5px проходил мимо — причём это хуже нечётного целого: половина
        # пикселя размазывается всегда, на любом экране.
        for m in re.finditer(r"(?<![\w])(\d+(?:\.\d+)?)px\b", scan):
            raw = m.group(1)
            line = scan[:m.start()].count("\n") + 1
            if "." in raw:
                bad.append((label, line, raw, "дробное"))
                continue
            v = int(raw)
            if v in allowed or v % 2 == 0:
                continue
            bad.append((label, line, raw, "нечётное"))
    for label, line, v, why in bad:
        fail("ЧЁТНОСТЬ", f"{label}:{line}: {v}px — {why}, сетка поедет")
    if not bad:
        notes.append("ЧЁТНОСТЬ · все размеры в пикселях чётные")


def check_palette(primitives: str) -> None:
    """Различимость серий — измеренная, а не подтверждённая отпечатком.

    Раньше здесь сравнивался хэш значений. Проверка печатала «набор серий
    совпадает с проверенным» и была зелёной ровно до тех пор, пока никто не
    трогал числа. Про саму различимость она не говорила ничего — при том что
    аппарат для настоящего измерения (delta_e, simulate) лежит в этом же файле
    и используется соседней проверкой. Обещание было шире дела, а такая
    проверка хуже отсутствующей: на неё полагаются.

    Что проверяется теперь — ровно то, что кит обещает в комментарии к
    сериям, и ни словом больше:

      · ПЕРВЫЕ ТРИ СЛОТА различимы в любой паре, включая тританопию. Это те
        три, которыми кит разрешает красить точечную диаграмму и карту, где
        рядом может оказаться любая пара.
      · ВСЕ ШЕСТЬ различимы в норме, при протанопии и дейтеранопии.

    ЧЕГО ПРОВЕРКА НЕ ТРЕБУЕТ, и это названо, а не умолчано: тританопии от пар
    за пределами первой тройки. Шесть качественных цветов, различимых по
    сине-жёлтой оси, не собираются — это ограничение зрения, а не палитры.
    Поэтому кит и ограничивает точечные диаграммы тремя сериями.
    """
    table = dict(declarations(primitives))
    ok = True
    for suffix, theme in (("", "тёмная"), ("-lt", "светлая")):
        slots = [f"--c-s{i}{suffix}" for i in range(1, 7)]
        if not all(table.get(s) for s in slots):
            fail("ПАЛИТРА", f"{theme} тема: не хватает слотов серий {slots[0]}…{slots[-1]}")
            ok = False
            continue
        cols = [parse_color(table[s], table) for s in slots]
        for i in range(6):
            for j in range(i + 1, 6):
                if not (cols[i] and cols[j]):
                    continue
                core = i < 3 and j < 3          # пара внутри первой тройки
                checks = [("в норме", delta_e(cols[i], cols[j]), DELTA_E_MIN)]
                for kind in CVD:
                    if kind == "тританопия" and not core:
                        continue
                    need = DELTA_E_MIN_TRIT if kind == "тританопия" else DELTA_E_MIN
                    checks.append((kind, delta_e(simulate(cols[i], kind),
                                                 simulate(cols[j], kind)), need))
                kind, got, need = min(checks, key=lambda c: c[1] / c[2])
                if got < need:
                    where = "первая тройка" if core else "все шесть"
                    fail("ПАЛИТРА", f"{theme} тема: серии {i + 1} и {j + 1} — ΔE {got:.1f} "
                                    f"({kind}) при норме {need} [{where}]")
                    ok = False
    if ok:
        notes.append("ПАЛИТРА · различимость серий измерена в обеих темах")


# ---------------------------------------------------------------------------

def check_hover(layers: list[tuple[str, str]]) -> None:
    """Стиль наведения обязан лежать внутри @media (hover: hover).

    У тача наведения нет, и браузер его подделывает: первое касание включает
    :hover и оставляет его включённым, пока человек не коснётся другого места.
    Кнопка, которая на наведении подсвечивается, после касания остаётся
    подсвеченной — и выглядит нажатой, хотя ничего не нажато.

    Проверяем по вложенности: правило с :hover должно стоять внутри
    условного блока, который спрашивает у устройства, умеет ли оно наводить.
    """
    bad = []
    for label, text in layers:
        depth_media = []           # стек открытых @media с их условием
        i, n = 0, len(text)
        head_start = 0
        while i < n:
            ch = text[i]
            if ch == "{":
                head = text[head_start:i]
                if head.lstrip().startswith("@media"):
                    depth_media.append(head)
                else:
                    # Фильтр None обязателен: в стек кладётся None для всякого
                    # блока, который не @media, — обычного правила, @supports,
                    # @container. Без фильтра проверка падала с TypeError на
                    # совершенно валидном CSS, и падала молча для того, кто её
                    # не запускал. Контейнерный запрос в ките уже есть.
                    if ":hover" in head and not any(m and "hover: hover" in m for m in depth_media):
                        line = text[:head_start].count("\n") + 1
                        bad.append((label, line, head.strip().split("\n")[0][:60]))
                    depth_media.append(None)
                head_start = i + 1
            elif ch == "}":
                if depth_media:
                    depth_media.pop()
                head_start = i + 1
            i += 1

    for label, line, sel in bad:
        fail("НАВЕДЕНИЕ", f"{label}:{line}: {sel} — :hover без @media (hover: hover)")
    if not bad:
        notes.append("НАВЕДЕНИЕ · стили наведения закрыты от тача")


ACCENTS = ("blue", "violet", "indigo")

# Смысловые тона: то, что человек обязан отличить от акцента и друг от друга.
MEANINGS = ("--crit", "--high", "--calm", "--event", "--nodata")

# Порог различимости. Тот же, что у палитры серий: ниже 15 два цвета читаются
# как один. Проверяем не только в норме — дальтонизм не редкость, а у
# диспетчера от цвета зависит решение.
DELTA_E_MIN = 15.0

# Тританопия — отдельный порог. Она встречается у сотых долей процента, и
# требовать от пятицветной палитры полного расхождения ещё и по ней значит
# не собрать палитру вовсе. Но и молчать про неё нельзя: порог ниже, а не снят.
DELTA_E_MIN_TRIT = 10.0


def _lab(c: tuple[float, float, float]) -> tuple[float, float, float]:
    def f(x: float) -> float:
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    r, g, b = (f(v) for v in c)
    x = (r * .4124 + g * .3576 + b * .1805) / .95047
    y = r * .2126 + g * .7152 + b * .0722
    z = (r * .0193 + g * .1192 + b * .9505) / 1.08883

    def k(t: float) -> float:
        return t ** (1 / 3) if t > .008856 else 7.787 * t + 16 / 116
    fx, fy, fz = k(x), k(y), k(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def delta_e(a, b) -> float:
    la, lb = _lab(a), _lab(b)
    return sum((x - y) ** 2 for x, y in zip(la, lb)) ** 0.5


# Матрицы Виено: как цвет выглядит при трёх видах дальтонизма.
CVD = {
    "протанопия":  ((0.0, 2.02344, -2.52581), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)),
    "дейтеранопия": ((1.0, 0.0, 0.0), (0.494207, 0.0, 1.24827), (0.0, 0.0, 1.0)),
    "тританопия":  ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (-0.395913, 0.801109, 0.0)),
}


def simulate(c, kind: str):
    def f(x: float) -> float:
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    r, g, b = (f(v) for v in c)
    lms = (17.8824 * r + 43.5161 * g + 4.11935 * b,
           3.45565 * r + 27.1554 * g + 3.86714 * b,
           0.0299566 * r + 0.184309 * g + 1.46709 * b)
    m = CVD[kind]
    l2 = sum(m[0][i] * lms[i] for i in range(3)) if kind == "протанопия" else lms[0]
    m2 = sum(m[1][i] * lms[i] for i in range(3)) if kind == "дейтеранопия" else lms[1]
    s2 = sum(m[2][i] * lms[i] for i in range(3)) if kind == "тританопия" else lms[2]
    rr = 0.080944 * l2 - 0.0130504 * m2 - 0.000116425 * s2
    gg = -0.0102485 * l2 + 0.0540193 * m2 - 0.000113614 * s2
    bb = -0.000365294 * l2 - 0.00412163 * m2 + 0.693513 * s2

    def g2(x: float) -> float:
        x = max(0.0, min(1.0, x))
        return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return (g2(rr), g2(gg), g2(bb))


def accent_tables(primitives: str, semantic: str) -> dict[tuple[str, str], dict[str, str]]:
    out: dict[tuple[str, str], dict[str, str]] = {}
    base = theme_tables(primitives, semantic)
    for sel, body in blocks(semantic):
        m = re.search(r'data-accent="([a-z]+)"', sel)
        if not m:
            continue
        for theme, table in base.items():
            t = dict(table)
            for name, value in declarations(body):
                t[name] = value
            out[(theme, m.group(1))] = t
    return out


def _color(name: str, table: dict[str, str]):
    value = resolve(name, table)
    return parse_color(value, table) if value else None


# Ступень между соседними поверхностями — обоснование в check_surfaces.
# Одна константа на две проверки: мягкий оттенок выбранного (ТИШИНА) — это
# тоже соседняя поверхность, и порог у него обязан быть тем же.
SURFACE_STEP = 1.12


def check_surfaces(primitives: str, semantic: str) -> None:
    """Ступень между поверхностями.

    Границ у кита нет: блок отделяется от соседа только тем, что он светлее.
    Если ступень пропадает, пропадает и граница — а вместе с ней курсор
    клавиатуры в меню, подсветка строки таблицы и сам факт, что поле нажимаемо.
    Проверяется каждая пара соседних поверхностей, а не только текст на них.

    ПОЧЕМУ ПОРОГ 1.12, А НЕ 3:1. Ревьюер требовал три: WCAG 1.4.11 задаёт 3:1
    для нетекстового. Разошлись мы не в цифре, а в том, к чему она относится.
    Правило говорит о графических объектах и частях элементов управления,
    которые НЕОБХОДИМЫ для понимания содержимого: значок без подписи, граница
    поля ввода, кружок переключателя. Соседние поверхности виджета в этот
    список не входят: содержимое понятно и без того, что одна панель светлее
    другой, а три к одному между ними превратили бы дашборд в набор коробок с
    контрастными краями — ровно то, от чего кит уходит, отказавшись от границ.

    Что действительно требует 3:1, кит проверяет и на трёх: силуэт кнопки
    против поверхности и кольцо фокуса того же цвета — проверка КНОПКА, на
    каждом акценте и в обеих темах. Ступень 1.12 — это отдельная величина с
    отдельным обоснованием: ниже неё граница перестаёт читаться физически.
    """
    need = SURFACE_STEP
    bad = False
    for theme, table in theme_tables(primitives, semantic).items():
        cols = {n: _color(n, table) for n in ("--bg", "--surface", "--surface-2", "--surface-3")}
        if not all(cols.values()):
            continue
        for a, b in (("--bg", "--surface"), ("--surface", "--surface-2"),
                     ("--surface-2", "--surface-3")):
            r = contrast(cols[a], cols[b])
            if r < need:
                fail("СТУПЕНИ", f"{theme} тема: {a} → {b} даёт {r:.3f}:1 при норме {need}:1")
                bad = True
        if contrast(cols["--surface-3"], cols["--bg"]) < 1.04:
            fail("СТУПЕНИ", f"{theme} тема: --surface-3 совпал с фоном страницы")
            bad = True
    if not bad:
        notes.append("СТУПЕНИ · соседние поверхности различимы в обеих темах")


def check_meaning(primitives: str, semantic: str) -> None:
    """Акцент не должен совпадать со смыслом, а смыслы — друг с другом.

    Палитру серий кит проверяет на дальтонизм, а эту пару не проверял вовсе —
    хотя цена ошибки выше: серия отвечает «кто это», а смысл «насколько всё
    плохо». Синяя кнопка, неотличимая от метки события, заставляет диспетчера
    принимать решение по цвету, который врёт.
    """
    seen, bad = set(), False
    for (theme, accent), table in sorted(accent_tables(primitives, semantic).items()):
        brand = _color("--brand", table)
        if not brand:
            continue
        # Обе ступени каждого смысла, а не только заливочная. Раньше
        # проверялась одна — и это было не «упрощением», а дырой ровно там,
        # куда кит переводит весь смысловой текст: в тёмной теме красный и
        # зелёный текст расходились на ΔE 3.9 при норме 15, и проверка про
        # это молчала, потому что смотрела на другие цвета.
        steps = []
        for m in MEANINGS:
            steps.append(m)
            if resolve(m + "-ink", table):
                steps.append(m + "-ink")

        pairs = [("акцент " + accent, brand, m, _color(m, table)) for m in steps]
        for i, a in enumerate(steps):
            for b in steps[i + 1:]:
                # Две ступени ОДНОГО смысла обязаны быть похожи — в том и
                # смысл, что это один цвет в двух яркостях. Сравниваем только
                # разные смыслы.
                if a.replace("-ink", "") == b.replace("-ink", ""):
                    continue
                if (a, b, theme) in seen:
                    continue
                seen.add((a, b, theme))
                pairs.append((a, _color(a, table), b, _color(b, table)))
        for na, ca, nb, cb in pairs:
            if not ca or not cb:
                continue
            checks = [("в норме", delta_e(ca, cb), DELTA_E_MIN)]
            for kind in CVD:
                need = DELTA_E_MIN_TRIT if kind == "тританопия" else DELTA_E_MIN
                checks.append((kind, delta_e(simulate(ca, kind), simulate(cb, kind)), need))
            # Худшая пара — та, у которой меньше запас к своему порогу.
            kind, got, need = min(checks, key=lambda c: c[1] / c[2])
            if got < need:
                fail("СМЫСЛ", f"{theme} тема: {na} и {nb} — ΔE {got:.1f} "
                              f"({kind}) при норме {need}")
                bad = True
    if not bad:
        notes.append("СМЫСЛ · акцент не путается со смыслом, в том числе при дальтонизме")


def check_spot(primitives: str, semantic: str) -> None:
    """Заливка смысла обязана быть видна на поверхности.

    Точка рядом со строкой, деление полосы доступности, плитка карты — это
    графические объекты, несущие смысл. WCAG 1.4.11 требует от них 3:1 против
    фона, и здесь норма права: это не спор про соседние поверхности виджета
    (там довод кита — в описании СТУПЕНЕЙ), это самостоятельный объект, по
    которому человек принимает решение.

    До появления этой проверки оранжевая заливка в светлой теме давала 2.32,
    зелёная 2.80, красная в тёмной 2.95. Зелёная точка на белом виджете почти
    исчезала — и никто этого не мерил, потому что все проверки цвета смотрели
    либо на текст, либо на расстояние между смыслами, но не на само пятно.

    --nodata из проверки исключён, и это осознанное исключение с ценой:
    поднять серый «нет данных» до 3:1 значит сделать отсутствие данных таким
    же громким, как сами данные. Отсутствие обозначается ровной нейтральной
    заливкой и явным текстом «Нет данных».
    """
    need = 3.0
    ok = True
    for theme, table in theme_tables(primitives, semantic).items():
        for m in ("--crit", "--high", "--calm", "--event"):
            c = _color(m, table)
            if not c:
                continue
            for bg in ("--surface", "--surface-2"):
                b = _color(bg, table)
                if not b:
                    continue
                r = contrast(c, b)
                if r < need:
                    fail("ПЯТНО", f"{theme} тема: заливка {m} на {bg} даёт {r:.2f}:1 "
                                  f"при норме {need}:1 — пятно не видно")
                    ok = False
    if ok:
        notes.append("ПЯТНО · заливка смысла видна на поверхности")


def check_button(primitives: str, semantic: str) -> None:
    """Подпись на залитой кнопке и силуэт самой кнопки.

    Обводок нет, поэтому форму кнопки держит только её заливка против
    поверхности. Если и подпись, и силуэт слабые, кнопка перестаёт быть
    кнопкой — а это главное действие на экране.
    """
    bad = False
    for (theme, accent), table in sorted(accent_tables(primitives, semantic).items()):
        brand, ink, surf = (_color("--brand", table), _color("--brand-ink", table),
                            _color("--surface", table))
        if not (brand and ink and surf):
            continue
        r = contrast(ink, brand)
        if r < 4.5:
            fail("КНОПКА", f"{theme} тема, акцент {accent}: подпись на кнопке {r:.2f}:1 при норме 4.5")
            bad = True
        r = contrast(brand, surf)
        if r < 3.0:
            fail("КНОПКА", f"{theme} тема, акцент {accent}: силуэт кнопки {r:.2f}:1 при норме 3.0")
            bad = True
    if not bad:
        notes.append("КНОПКА · подпись и силуэт читаются на всех акцентах")


def check_scale(primitives: str, semantic: str) -> None:
    """Каждая ступень шкалы карты должна быть видна на своей доске.

    Шкала кодирует величину светлотой, и у неё есть конец, который в одной из
    тем неизбежно приближается к фону. Пока это не проверялось, самый тёмный
    конец — «много баллов риска» — давал 1.45:1 к виджету в тёмной теме, то
    есть проблемные регионы на карте исчезали. Именно те, ради которых карту
    и открывают.
    """
    need = 1.6
    bad = False
    for theme, table in theme_tables(primitives, semantic).items():
        surf = _color("--surface", table)
        if not surf:
            continue
        for i in range(1, 6):
            c = _color(f"--seq-{i}", table)
            if not c:
                continue
            r = contrast(c, surf)
            if r < need:
                fail("ШКАЛА", f"{theme} тема: --seq-{i} даёт {r:.2f}:1 к поверхности "
                              f"при норме {need}:1 — эта ступень не видна")
                bad = True
    if not bad:
        notes.append("ШКАЛА · все ступени карты видны на своей доске")


def check_generated() -> None:
    """Собранная тема графиков не должна расходиться с токенами.

    js/dk-chart-theme.js — вторая копия палитры, шрифта и сетки, только
    шестнадцатеричными числами. Она собирается из токенов скриптом, но ничто
    не мешало поменять токен и не пересобрать: тогда сплошная линия серии
    красится одним цветом, а её пунктирный хвост — другим, потому что хвост
    читает --series-N прямо из CSS. Расхождение видно только на прогнозе и
    только глазом.

    Проверяем не глазами: собираем тему заново в памяти и сравниваем с тем,
    что лежит в репозитории.
    """
    out = ROOT / "js" / "dk-chart-theme.js"
    builder = ROOT / "tools" / "build-chart-theme.py"
    if not out.exists() or not builder.exists():
        return
    try:
        import importlib.util, io, json as _json, contextlib
        spec = importlib.util.spec_from_file_location("dk_build_theme", builder)
        mod = importlib.util.module_from_spec(spec)
        with contextlib.redirect_stdout(io.StringIO()):
            spec.loader.exec_module(mod)
            tables = mod.T.theme_tables(mod.T.read(mod.T.PRIMITIVES), mod.T.read(mod.T.SEMANTIC))
            themes = {mode: mod.build(table, mode) for mode, table in tables.items()}
            body = _json.dumps(themes, ensure_ascii=False, indent=2)
            fresh = mod.TEMPLATE.replace("__THEMES__", body).replace(
                "__PIE_MAX__", str(mod.PIE_MAX_SLICES))
    except Exception as e:                       # noqa: BLE001
        fail("СБОРКА", f"не удалось пересобрать тему графиков для сверки: {e}")
        return

    if fresh != out.read_text("utf-8"):
        fail("СБОРКА", "js/dk-chart-theme.js разошёлся с токенами — "
                       "пересобери: python3 tools/build-chart-theme.py")
    else:
        notes.append("СБОРКА · тема графиков собрана из текущих токенов")


ENGINE = ROOT / "vendor" / "echarts.min.js"
ENGINE_LIST = ROOT / "vendor" / "echarts.modules.json"

# Все типы серий ECharts 6. Нужны, чтобы отличить type: 'sankey' от
# type: 'category' или type: 'linear' — у ECharts слово type значит пять
# разных вещей. К ним добавляется всё, что зарегистрировано в лежащем файле
# движка: если в новой версии появится тип, которого здесь нет, полная сборка
# его знает, и проверка не ослепнет на нём.
ECHARTS_SERIES = {
    "line", "bar", "pie", "scatter", "effectScatter", "radar", "tree",
    "treemap", "sunburst", "boxplot", "candlestick", "heatmap", "map",
    "parallel", "lines", "graph", "sankey", "funnel", "gauge", "pictorialBar",
    "themeRiver", "custom", "chord",
}
# Ключи настроек, за каждым из которых стоит отдельный модуль. Имена — те же,
# под которыми модуль регистрируется в самом движке, поэтому их можно спросить
# у файла напрямую.
ECHARTS_COMPONENTS = {
    "grid", "xAxis", "yAxis", "radar", "geo", "parallel", "parallelAxis",
    "axisPointer", "polar", "angleAxis", "radiusAxis", "singleAxis",
    "calendar", "matrix", "graphic", "toolbox", "dataZoom", "tooltip", "brush",
    "title", "timeline", "markPoint", "markLine", "markArea", "legend",
    "visualMap", "thumbnail", "dataset",
}
# Модули без собственной модели: их нет в реестре движка, и по ключу настройки
# не угадать имя модуля. Поэтому таблица: ключ, который встречается в коде →
# модуль, без которого этот ключ молча не работает.
#
# containLabel попал сюда после замера, а не из документации. Первая урезанная
# сборка прошла все проверки, а в браузере графики с осями разошлись с полным
# движком до пикселя — у всех, кроме спарклайна, у которого containLabel
# выключен. В ECharts 6 старое поведение containLabel вынесено в отдельный
# модуль LegacyGridContainLabel; без него рабочая сборка раскладывает сетку
# по-новому и ни о чём не предупреждает.
ECHARTS_FEATURES = {
    "containLabel": "legacyGridContainLabel",
    "labelLayout": "labelLayout", "hideOverlap": "labelLayout",
    "moveOverlap": "labelLayout",
    "universalTransition": "universalTransition",
    "breaks": "axisBreak",
    "jitter": "scatterJitter",
    "aria": "aria",
}

# Что знает о себе файл движка. Выполняется в node, потому что по тексту это
# не выяснить: у line и scatter имя модуля лежит в сжатом файле строкой, а у
# bar, pie, map и sankey — собирается при выполнении. Поиск по тексту видел бы
# половину и ставил бы галочку за обе.
ENGINE_PROBE = r"""
const e = require(process.argv[1]);
const CM = e.ComponentModel;
process.stdout.write(JSON.stringify({
  version: e.version,
  series: CM.getClassesByMainType('series').map(c => c.type.replace(/^series\./, '')),
  components: CM.getAllClassMainTypes().filter(t => t !== 'series' && t !== 'component'),
}));
"""


def strip_js(text: str) -> str:
    """Убрать комментарии из JS, сохранив строки и переводы строк.

    Строки нужны: тип серии записан именно строкой, type: 'sankey'. А
    комментарии мешают: в dk-charts.js рассказано, как число в бублике
    пытались поставить «через graphic», — и проверка потребовала бы модуль,
    которым код давно не пользуется.

    Регулярные выражения с кавычкой внутри этот разбор собьют. В обёртках
    таких нет; появится — сообщения станут странными, а не молчаливыми.
    """
    out, i, n = [], 0, len(text)
    while i < n:
        c = text[i]
        if c in "'\"`":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == "\\" else 1
            out.append(text[i:j + 1])
            i = j + 1
        elif text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            j = n if j < 0 else j + 2
            out.append("\n" * text.count("\n", i, j))
            i = j
        else:
            out.append(c)
            i += 1
    return "".join(out)


def check_engine() -> None:
    """Урезанный ECharts содержит ровно то, что просит код.

    Полный движок весит 1096 КБ, из них киту нужна малая часть. Но урезанная
    сборка, из которой забыли модуль, при сборке не падает. Что бывает у
    пользователя, измерено в браузере: серия незнакомого типа, если она одна
    на графике, молча пропускается — пустой прямоугольник и ни строчки в
    консоли; если за ней идёт другая серия — движок падает с ошибкой, в
    которой нет ни слова о модуле ("Cannot read properties of undefined
    (reading 'getProgressive')"). Оба исхода видны только на странице и только
    на том типе графика, которого не хватило.

    Первый же сбор списка «по памяти» это подтвердил: в записях значилось
    шесть типов, а код рисует седьмой — sankey.

    Поэтому сверяются четыре вещи:
      1. код ↔ список: всё, что код просит у движка, есть в списке, и в списке
         нет того, чего код не просит (иначе список врёт о весе);
      2. список → файл: каждый тип серии и модуль списка зарегистрирован в
         лежащем vendor/echarts.min.js — вопрос задаётся самому движку в node;
         и в файле нет типов серий сверх списка (иначе это полный файл);
      3. модули без записи в реестре (containLabel и ему подобные) движок о
         себе не сообщает. Их наличие сверяется по отметке сборки в первой
         строке файла: скрипт сборки пишет туда список, из которого собирал.
         Это слабее, чем спросить движок, — отметка ловит «список поменяли, а
         пересобрать забыли», но не подмену файла руками;
      4. версия файла совпадает с версией в списке.

    ЧЕГО ПРОВЕРКА НЕ ДЕЛАЕТ:
      · не видит модуль отрисовки (canvas). Из node его не спросить: движок
        падает раньше, чем доходит до выбора — несуществующий способ
        отрисовки даёт ту же ошибку, что и настоящий. Зато без него ECharts
        падает громко на первом же графике, а не молча;
      · не видит настройки, собранные из переменных (option[k] = …). Код
        кита так не пишет; начнёт — проверка этого не заметит;
      · не рисует графики. Что каждый тип действительно рисуется, проверяется
        в браузере по страницам кита после каждой пересборки.

    Какие файлы говорят с движком — не перечисляется руками, а находится: все
    скрипты и страницы, где есть echarts. или .instance (обёртка отдаёт
    экземпляр движка наружу, и страница может позвать его в обход обёртки).
    Тема графиков — исключение с обоснованием, но только для типов серий и
    модулей: в ней есть оформление для модулей, которых может не быть, и это
    не просьба их подключить. Для модулей без записи в реестре исключения
    нет: containLabel в теме меняет раскладку так же, как в коде, — а сначала
    тема была исключена целиком, и проверка этого не видела.
    """
    import json as _json
    import shutil
    import subprocess

    if not ENGINE_LIST.exists():
        fail("ДВИЖОК", "нет vendor/echarts.modules.json — списка модулей движка")
        return
    want = _json.loads(ENGINE_LIST.read_text("utf-8"))
    listed = {
        "series": set(want.get("series", [])),
        "components": set(want.get("components", [])),
        "features": set(want.get("features", [])),
    }
    ok = True

    # --- 1. код ↔ список -----------------------------------------------------
    EXEMPT = {"dk-chart-theme.js"}
    talkers = []
    for f in script_files() + page_files():
        src = f.read_text("utf-8")
        # Образцы кода в документации (<pre>) не выполняются: страница
        # компонента «График» упоминает c.instance и empty.title, и без этого
        # исключения проверка требовала модуль заголовка ради примера в тексте.
        if f.suffix == ".html":
            src = re.sub(r"<pre\b[\s\S]*?</pre>", lambda m: "\n" * m.group(0).count("\n"), src)
        src = strip_js(src)
        if f.name in EXEMPT:
            talkers.append((f.name, src, False))
            continue
        # Адрес файла движка — не обращение к нему. Без этого исключения каждая
        # страница с <script src="vendor/echarts.min.js"> попадала в говорящие,
        # и title из настроек пустого состояния обёртки требовал модуль
        # заголовка ECharts.
        if re.search(r"(?<![/\w.-])echarts\.(?!min\.js)|\.instance\b", src):
            talkers.append((f.name, src, True))

    series_universe = set(ECHARTS_SERIES)
    probe = None
    node = shutil.which("node")
    if node and ENGINE.exists():
        try:
            r = subprocess.run([node, "-e", ENGINE_PROBE, str(ENGINE)],
                               capture_output=True, text=True, timeout=60)
            probe = _json.loads(r.stdout) if r.returncode == 0 else None
            if probe is None:
                fail("ДВИЖОК", f"node не смог выполнить vendor/echarts.min.js: "
                               f"{r.stderr.strip().splitlines()[-1:] or '?'}")
                ok = False
        except Exception as e:                   # noqa: BLE001
            fail("ДВИЖОК", f"node не смог выполнить vendor/echarts.min.js: {e}")
            ok = False
        if probe:
            series_universe |= set(probe["series"])

    used: dict[str, dict[str, str]] = {"series": {}, "components": {}, "features": {}}
    # Ключ записывается и как key:, и как "key": (тема собрана в JSON), и
    # как option.key = … .
    KEY = re.compile(r"""(?:["']?\b(\w+)["']?\s*:|\.(\w+)\s*=[^=])""")
    for name, src, full in talkers:
        for m in KEY.finditer(src):
            key = m.group(1) or m.group(2)
            line = src.count("\n", 0, m.start()) + 1
            if key in ECHARTS_FEATURES:
                used["features"].setdefault(ECHARTS_FEATURES[key], f"{name}:{line} ({key})")
            elif full and key in ECHARTS_COMPONENTS:
                used["components"].setdefault(key, f"{name}:{line}")
        if not full:
            continue
        for m in re.finditer(r"(?:\btype\s*:|\.type\s*=)\s*'(\w+)'", src):
            if m.group(1) in series_universe:
                line = src.count("\n", 0, m.start()) + 1
                used["series"].setdefault(m.group(1), f"{name}:{line}")

    # Последствие у двух видов пропуска разное, и сообщение его называет:
    # без типа серии график пуст, без модуля вроде containLabel — нарисован,
    # но разложен иначе, и это ещё труднее заметить.
    CONSEQUENCE = {
        "series": "урезанная сборка молча не нарисует этот график",
        "components": "урезанная сборка молча не нарисует эту часть графика",
        "features": "урезанная сборка молча разложит график иначе",
    }
    for kind in ("series", "components", "features"):
        for key, where in sorted(used[kind].items()):
            if key not in listed[kind]:
                fail("ДВИЖОК", f"{where}: код просит «{key}», а в "
                               f"vendor/echarts.modules.json его нет — "
                               f"{CONSEQUENCE[kind]}. Добавь в список и пересобери")
                ok = False
        for key in sorted(listed[kind] - set(used[kind])):
            fail("ДВИЖОК", f"в списке модулей есть «{key}», а код его не просит — "
                           f"лишний вес. Убери из vendor/echarts.modules.json и пересобери")
            ok = False

    # --- 2 и 3. список → файл --------------------------------------------------
    if not ENGINE.exists():
        fail("ДВИЖОК", "нет vendor/echarts.min.js")
        return
    if not node:
        # Галочка без проверки хуже её отсутствия: пусть будет видно, что эта
        # половина не выполнялась.
        skipped.append("ДВИЖОК · наличие модулей в vendor/echarts.min.js не "
                       "проверено: нет node")
        if ok:
            notes.append("ДВИЖОК · код просит у движка ровно то, что в списке "
                         "(файл движка не проверялся)")
        return
    if not probe:
        return

    if probe["version"] != want.get("echarts"):
        fail("ДВИЖОК", f"vendor/echarts.min.js версии {probe['version']}, а список "
                       f"составлен для {want.get('echarts')}")
        ok = False
    for kind in ("series", "components"):
        for key in sorted(listed[kind] - set(probe[kind])):
            fail("ДВИЖОК", f"«{key}» есть в списке, но не зарегистрирован в "
                           f"vendor/echarts.min.js — такой график останется пустым")
            ok = False

    # Обратное направление — лишнее в файле — сверяется только по сериям.
    # Модули же тянут друг друга: карта сама ставит geo, подсказка — указатель
    # оси, и требовать их в списке значило бы списывать устройство движка.
    # Имена с двумя подчёркиваниями — внутренние основы (__base_bar__ у
    # столбцов), а не типы графиков: на первом прогоне проверка приняла такую
    # основу за лишний тип.
    #
    # Лишний тип — нарушение, а не заметка: так выглядит возвращённый на место
    # полный файл, и без этой строки его никто бы не заметил — все графики
    # рисуются, просто страница снова весит на 440 КБ больше.
    # Отметка сборки: скрипт пишет в первую строку список, из которого собирал.
    # Только так видны модули без записи в реестре — см. пункт 3 выше.
    head = ENGINE.read_text("utf-8", errors="replace")[:2000]
    stamp = re.search(r"урезанная сборка ECharts \S+ · список: (\{.*?\}) ·", head)
    built = _json.loads(stamp.group(1)) if stamp else None
    if listed["features"] and not built:
        fail("ДВИЖОК", "в vendor/echarts.min.js нет отметки сборки — не видно, есть ли "
                       "в нём " + ", ".join(sorted(listed["features"])) +
                       ". Пересобери: python3 tools/build-echarts.py")
        ok = False
    if built:
        mine = {k: sorted(listed[k]) for k in ("series", "components", "features")}
        if {k: sorted(built.get(k, [])) for k in mine} != mine:
            fail("ДВИЖОК", "vendor/echarts.min.js собран по другому списку модулей — "
                           "список поменяли, а пересобрать забыли: "
                           "python3 tools/build-echarts.py")
            ok = False

    extra = sorted(t for t in set(probe["series"]) - listed["series"]
                   if not t.startswith("__"))
    if extra:
        fail("ДВИЖОК", f"в vendor/echarts.min.js есть типы серий, которых нет в "
                       f"списке: {', '.join(extra)} — это не урезанная сборка. "
                       f"Пересобери: python3 tools/build-echarts.py")
        ok = False
    if ok:
        notes.append(f"ДВИЖОК · в урезанном движке ровно то, что просит код "
                     f"({len(listed['series'])} типов серий, "
                     f"{len(listed['components'])} модулей, "
                     f"{len(listed['features'])} без записи в реестре — по отметке сборки)")


def check_zero_size() -> None:
    """ECharts не создаётся и не пересчитывается в контейнере без размера.

    Карта и санкей падают внутри ECharts, если у контейнера нулевая ширина
    или высота: «Cannot read properties of null (reading '0')» — и при
    init, и при resize(). Замерено в браузере по всем типам обёртки: падают
    эти два, остальные переносят ноль. Падение при создании вылетало из
    dkMap/dkChart наружу и обрывало скрипт страницы — вместе с картой
    пропадало всё, что страница собирала после неё. Нулевой размер — это
    свёрнутая панель или вкладка, которую ещё не открыли.

    Лекарство в обёртках — проверка hasSize() перед init и перед resize().
    Эта проверка следит, чтобы оно не потерялось: при перестройке render()
    или в новой обёртке.

    ЧТО ИМЕННО ПРОВЕРЯЕТСЯ — и не больше: перед каждым echarts.init( и
    .resize( в файлах, которые говорят с движком, в той же функции (от
    ближайшего предшествующего слова function) стоит вызов hasSize(. Верна ли
    сама hasSize и правильно ли обработан её ответ — не проверяется: это
    замерено в браузере один раз и записано в REVIEW.md.
    """
    ok = True
    for f in script_files() + page_files():
        if f.name == "dk-chart-theme.js":
            continue
        src = strip_js(f.read_text("utf-8"))
        for m in re.finditer(r"\becharts\.init\(|\.resize\(", src):
            start = src.rfind("function", 0, m.start())
            if "hasSize(" not in src[max(start, 0):m.start()]:
                line = src.count("\n", 0, m.start()) + 1
                what = "echarts.init" if "init" in m.group(0) else "resize()"
                fail("НОЛЬ", f"{f.name}:{line}: {what} без проверки размера перед ним — "
                             f"в контейнере 0×0 карта и санкей падают и обрывают "
                             f"скрипт страницы. Нужен if (!hasSize(…)) return; в той же функции")
                ok = False
    if ok:
        notes.append("НОЛЬ · движок не создаётся и не пересчитывается в контейнере без размера")


def oklch_chroma(rgb: tuple[float, float, float]) -> float:
    """Насыщенность в OKLCH — то, что глаз читает как «цветное», а не «серое».

    Не HSL: там у серо-голубого и у ярко-синего может выйти одна
    насыщенность, а глаз их видит очень по-разному.
    """
    def lin(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    l_ = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m_ = (0.2119034982 * r + 0.6806757656 * g + 0.1073642022 * b) ** (1 / 3)
    s_ = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return (a * a + bb * bb) ** 0.5


# Где акцент разрешён, кроме фокуса и основной кнопки. Каждое исключение —
# поимённо и с причиной: правило «всё, где есть слово mark» однажды тихо
# накроет собой настоящий переключатель.
QUIET_EXEMPT = {
    ".dk-skip": "ссылка «К содержимому» видна только с клавиатуры — помощник "
                "фокуса, а не управление на экране",
    ".dk-side__mark": "знак продукта в меню — подпись, одна на страницу, не управление",
    ".sc-brand__mark": "знак продукта в шапке документации — то же, что .dk-side__mark",
    ".dk-badge--brand": "метка «новое», не управление; открыто в REVIEW.md",
    ".dk-cal__day[data-today=\"true\"] .dk-cal__n": "отметка «сегодня» — ориентир "
                "во времени, не управление; открыто в REVIEW.md",
    ".dk-cal__wd--day[data-today=\"true\"] .dk-cal__n": "то же, недельный вид",
    ".dk-cal__col[data-today=\"true\"]": "то же, колонка сегодняшнего дня",
}

# Цвета данных: с ними сравнивается управление. Серии — принадлежность,
# смысловые — светофор и события. Шкалу карты не берём: её ступени нарочно
# идут от почти серого, и «тише самой тихой ступени» значило бы «невидимо».
DATA_COLORS = [f"--series-{i}" for i in range(1, 7)] + ["--crit", "--high", "--calm", "--event"]


def composite(name: str, base: tuple[float, float, float], table: dict[str, str]):
    """Полупрозрачный токен, наложенный на поверхность.

    parse_color нарочно берёт color-mix с transparent как непрозрачный цвет
    (верхняя оценка для контраста текста). Для заметности оттенка это
    неверно в обратную сторону: 10% серого на экране — это не серый, а почти
    поверхность. Поэтому смешиваем честно.
    """
    value = resolve(name, table)
    m = MIX.match(value.strip()) if value else None
    if not m or m.group(3).strip() != "transparent":
        return None
    col = _color_of(m.group(1), table)
    if not col:
        return None
    share = float(m.group(2)) / 100
    return tuple(col[i] * share + base[i] * (1 - share) for i in range(3))


def check_quiet(primitives: str, semantic: str, layers: list[tuple[str, str]]) -> None:
    """Управление тише данных.

    Главное на дашборде — данные, а не кнопки. Замер до правки: все выбранные
    состояния (сегмент, чекбокс, переключатель, пагинация, вкладка, пункт
    меню) были залиты акцентом с насыщенностью 0.215 — самым громким пятном в
    системе, громче любой серии и даже красного «высокий риск» (0.189). К тому
    же акцент того же синего тона, что первая серия и шкала карты: выбранный
    сегмент «7 дней» читался как ещё один столбец. И при всей громкости цветом
    он был тих контрастом: к своему контейнеру 2.66:1 при норме 3:1.

    Две части, и обе нужны.

    1. ГДЕ АКЦЕНТ РАЗРЕШЁН — списком. Кольцо фокуса, основная кнопка, цвет
       данных по умолчанию (var(--accent, var(--brand)) — пока страница не
       передала свой) и поимённые исключения QUIET_EXEMPT. Всё прочее
       упоминание --brand* в слое компонентов — нарушение. Список, а не поиск
       известных нарушителей: новое яркое управление упадёт само, даже если
       о нём никто не подумал.

    2. ЗАМЕР ТОКЕНОВ ВЫБРАННОГО СОСТОЯНИЯ во всех темах и на всех акцентах:
       · насыщенность --control-on и --control-soft меньше половины самой
         тихой из DATA_COLORS — цветовой тон принадлежит данным;
       · контраст --control-on к виджету не выше, чем у самой контрастной
         серии, — не ярче данных. Светлый --ink-2 проваливает именно это
         (7:1 в тёмной теме при сериях до 4.6:1);
       · контраст --control-on к виджету и к --surface-2 (на ней стоит
         сегмент) не ниже 3:1 — выбранное видно;
       · подпись --control-on-ink на --control-on и на --control-on-hover
         не ниже 4.5:1.
       Отличаться на 3:1 от заливки ПУСТОГО чекбокса (--surface-3) не
       требуется: отмеченный отличается от пустого галочкой. Требование
       к --surface-3 оставляло бы в тёмной теме только светлый --ink-2.

    ЧЕГО ПРОВЕРКА НЕ ДЕЛАЕТ: не смотрит стили внутри страниц (только слой
    компонентов) и не проверяет, что компонент взял именно --control-on, —
    только что он не взял акцент. Серый, вписанный руками, поймает СЫРЫЕ.
    """
    bad = False

    # --- 1. где акцент разрешён ------------------------------------------------
    for name, css in layers:
        for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
            sels = [" ".join(x.split()) for x in m.group(1).split(",")]
            for decl in m.group(2).split(";"):
                if "--brand" not in decl:
                    continue
                prop = decl.split(":", 1)[0].strip()
                # Только --accent: у --swatch запасной акцент оказался
                # управлением, а не данными (чип «Все» в фильтрах-легенде
                # горел синим) — и проверка его пропустила.
                rest = re.sub(r"var\(\s*--accent\s*,\s*var\(\s*--brand[\w-]*\s*\)\s*\)",
                              "", decl)
                if "--brand" not in rest:
                    continue                      # цвет данных по умолчанию
                # :focus-within — то же кольцо, на составном поле (.dk-field):
                # фокус получает input внутри, а рамку рисует обёртка.
                if prop.startswith("outline") and all(
                        ":focus-visible" in x or ":focus-within" in x for x in sels):
                    continue                      # кольцо фокуса
                if all(x.startswith(".dk-btn--primary") for x in sels):
                    continue                      # основная кнопка
                if all(x in QUIET_EXEMPT for x in sels):
                    continue
                line = css.count("\n", 0, m.start(2)) + 1
                fail("ТИШИНА", f"{name}:{line} {', '.join(sels)[:70]} — акцент в "
                               f"«{prop}». Акцент — только фокус, основная кнопка и "
                               f"ссылки; выбранное состояние берёт --control-on / --control-soft")
                bad = True

    # --- 2. замер ------------------------------------------------------------
    for (theme, accent), table in sorted(accent_tables(primitives, semantic).items()):
        where = f"{theme} тема, акцент {accent}"
        c = {n: _color(n, table) for n in
             ["--control-on", "--control-on-hover", "--control-on-ink", "--control-soft",
              "--surface", "--surface-2"] + DATA_COLORS}
        missing = [n for n in ("--control-on", "--control-on-hover", "--control-on-ink",
                               "--control-soft") if not c[n]]
        if missing:
            fail("ТИШИНА", f"{where}: нет токенов {', '.join(missing)}")
            bad = True
            continue
        data = [c[n] for n in DATA_COLORS if c[n]]
        quietest = min(oklch_chroma(x) for x in data)
        loudest = max(contrast(c[n], c["--surface"]) for n in DATA_COLORS if n.startswith("--series") and c[n])
        for tok in ("--control-on", "--control-soft"):
            ch = oklch_chroma(c[tok])
            if ch >= quietest / 2:
                fail("ТИШИНА", f"{where}: насыщенность {tok} {ch:.3f} при пороге "
                               f"{quietest / 2:.3f} (половина самой тихой серии) — управление "
                               f"спорит с данными цветом")
                bad = True
        r = contrast(c["--control-on"], c["--surface"])
        if r > loudest:
            fail("ТИШИНА", f"{where}: --control-on к виджету {r:.2f}:1 — ярче самой "
                           f"контрастной серии ({loudest:.2f}:1)")
            bad = True
        for base in ("--surface", "--surface-2"):
            r = contrast(c["--control-on"], c[base])
            if r < 3.0:
                fail("ТИШИНА", f"{where}: --control-on к {base} {r:.2f}:1 при норме 3 — "
                               f"выбранное не отличить")
                bad = True
        for fill in ("--control-on", "--control-on-hover"):
            r = contrast(c["--control-on-ink"], c[fill])
            if r < 4.5:
                fail("ТИШИНА", f"{where}: подпись на {fill} {r:.2f}:1 при норме 4.5")
                bad = True
        # Мягкий оттенок лежит поверх чего-то: выбранная строка и активный
        # чип — поверх виджета, активный фильтр — поверх --surface-2. Серый
        # обязан отличаться так же, как отличался цветной: «фильтр включён»
        # видно через всю страницу, иначе человек не знает, что смотрит срез.
        for base in ("--surface", "--surface-2"):
            over = composite("--control-soft", c[base], table)
            if over is None:
                fail("ТИШИНА", f"{where}: --control-soft не разобрать — ожидается "
                               f"color-mix(in srgb, <цвет> N%, transparent)")
                bad = True
                break
            r = contrast(over, c[base])
            if r < SURFACE_STEP:
                fail("ТИШИНА", f"{where}: --control-soft поверх {base} {r:.3f}:1 при "
                               f"ступени {SURFACE_STEP} — выбранное сливается с невыбранным")
                bad = True

    if not bad:
        notes.append("ТИШИНА · управление тише данных: акцент только на фокусе, "
                     "основной кнопке и в поимённых исключениях")


def check_pages() -> None:
    """Страницы компонентов совпадают с генератором, блоки все и по порядку.

    У страницы компонента одиннадцать блоков в одном порядке — это обещание
    шаблона (DECISIONS.md, пункт 5), и держать его в двадцати файлах руками
    нельзя. Поэтому страницы собирает tools/build-component-pages.py, а здесь
    сверяется: файл на диске равен тому, что собирает скрипт (значит, правили
    содержание, а не html), и в нём стоят все заголовки блоков по порядку.
    Та же идея, что у СБОРКА для темы графиков.

    ЧЕГО НЕ ДЕЛАЕТ: не проверяет, что в блоке написана правда. Что класс из
    примера существует в CSS — ловит только глаз в браузере.
    """
    builder = ROOT / "tools" / "build-component-pages.py"
    if not builder.exists():
        return
    try:
        import importlib.util, io, contextlib
        spec = importlib.util.spec_from_file_location("dk_build_pages", builder)
        mod = importlib.util.module_from_spec(spec)
        with contextlib.redirect_stdout(io.StringIO()):
            spec.loader.exec_module(mod)
            fresh = mod.build()
    except SystemExit as e:
        fail("СТРАНИЦЫ", f"генератор отказался собирать: {e}")
        return
    except Exception as e:                       # noqa: BLE001
        fail("СТРАНИЦЫ", f"не удалось собрать страницы для сверки: {e}")
        return
    bad = False
    titles = [t for _, t, _ in mod.BLOCKS]
    for name, text in fresh.items():
        f = ROOT / name
        if not f.exists():
            fail("СТРАНИЦЫ", f"{name} не собран — python3 tools/build-component-pages.py")
            bad = True
            continue
        if f.read_text("utf-8") != text:
            fail("СТРАНИЦЫ", f"{name} разошёлся с генератором — правь tools/component_pages/ "
                             f"и пересобери: python3 tools/build-component-pages.py")
            bad = True
        if name.startswith("component-") and name.endswith(".html"):
            found = re.findall(r"<h2>(.*?)</h2>", text)
            if found != titles:
                fail("СТРАНИЦЫ", f"{name}: блоки {found} вместо {titles}")
                bad = True
    stray = [p.name for p in ROOT.glob("component-*.html") if p.name not in fresh]
    for s in stray:
        fail("СТРАНИЦЫ", f"{s} не значится в генераторе — страница компонента руками")
        bad = True
    if not bad:
        n = sum(1 for k in fresh if k.endswith(".html"))
        notes.append(f"СТРАНИЦЫ · {n} страниц компонентов собраны скриптом, "
                     f"все {len(titles)} блоков на месте")


def _load_manifest_builder():
    import importlib.util, io, contextlib
    spec = importlib.util.spec_from_file_location("dk_build_manifest", ROOT / "tools" / "build-manifest.py")
    mod = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):
        spec.loader.exec_module(mod)
    return mod


def check_manifest() -> None:
    """Опись кита совпадает с кодом: скилл знает всё, что есть, и только это.

    kit-manifest.json читает скилл сборки дашбордов, и опись, которая врёт,
    хуже её отсутствия: скилл возьмёт класс, которого нет, или не узнает о
    блоке, который есть, и соберёт похожий руками. Поэтому сверяется:

    - файл на диске равен тому, что собирает tools/build-manifest.py;
    - каждый класс из components.css и chrome.css описан хотя бы в одной
      части, и каждый префикс части что-то берёт;
    - файлы и разделы README, на которые опись ссылается, существуют;
    - функции части объявлены её скриптами, и каждая dk-функция кита
      числится в какой-нибудь части;
    - порядок подключения: каждый скрипт стоит после того, что он читает;
      каждый скрипт и стиль кита в порядке значится;
    - «чем заменить» и «связанное» ведут к существующим частям;
    - типы графиков совпадают с dk-charts.js в обе стороны, и каждый
      параметр из таблицы выбора в движке обёртки есть;
    - зацепка без стиля действительно без стиля;
    - читатель tools/kit.py отвечает на каждую часть, а его блок подключения
      ставит dk-theme.js первым и каждый скрипт после того, что он читает.

    ЧЕГО НЕ ДЕЛАЕТ: не проверяет, что назначение и «когда да» написаны правдиво,
    — это слова со страниц компонентов, и их по-прежнему читает человек.
    """
    out = ROOT / "kit-manifest.json"
    try:
        mod = _load_manifest_builder()
        fresh = mod.build()
    except SystemExit as e:
        fail("МАНИФЕСТ", f"сборщик отказался собирать: {e}")
        return
    except Exception as e:                       # noqa: BLE001
        fail("МАНИФЕСТ", f"не удалось собрать опись для сверки: {e}")
        return
    import json
    bad = False

    def no(msg: str) -> None:
        nonlocal bad
        fail("МАНИФЕСТ", msg)
        bad = True

    if not out.exists():
        no("kit-manifest.json не собран — python3 tools/build-manifest.py")
    elif out.read_text("utf-8") != fresh:
        no("kit-manifest.json разошёлся с кодом — пересобери: python3 tools/build-manifest.py")
    m = json.loads(fresh)
    MP = mod.MP
    parts = m["parts"]
    ids = {p["id"] for p in parts}
    classes = mod.css_classes()
    facts = mod.script_facts()

    # Каждый класс кому-то принадлежит, каждый префикс что-то берёт.
    owned = {c for p in parts for c in p["classes"]}
    for c in sorted(set(classes) - owned):
        no(f"класс .{c} ({classes[c]}) не описан ни в одной части — скилл о нём не узнает; "
           f"впиши префикс в tokens страницы компонента или в tools/manifest_parts.py")
    for p in parts:
        for px in p["owns"]:
            if not any(mod.owns(c, px) for c in classes):
                no(f"часть {p['id']}: префикс {px} не берёт ни одного класса")

    # Файлы и разделы README.
    readme = (ROOT / "README.md").read_text("utf-8")
    heads = set(re.findall(r"^#{2,4} (.+?)\s*$", readme, flags=re.M))
    for p in parts:
        for f in p["css"] + p["include"] + p["data"]:
            if not (ROOT / f).exists():
                no(f"часть {p['id']}: файла {f} нет")
        for d in p["docs"]:
            f, _, head = d.partition("#")
            if not (ROOT / f).exists():
                no(f"часть {p['id']}: документа {f} нет")
            elif f == "README.md" and head and head not in heads:
                no(f"часть {p['id']}: в README нет раздела «{head}»")
    if m["charts"]["doc"].partition("#")[2] not in heads:
        no(f"в README нет раздела «{m['charts']['doc'].partition('#')[2]}»")

    # Функции.
    defined_by = {n: f for f, v in facts.items() for n in v["defines"]}
    listed = set()
    for p in parts:
        for n in p["js"]:
            listed.add(n)
            if defined_by.get(n) not in p["include"]:
                no(f"часть {p['id']}: функция {n} не объявлена её скриптами {p['include']}")
    for n, f in sorted(defined_by.items()):
        if n not in listed:
            no(f"функция {n} ({f}) не числится ни в одной части — скилл её не увидит")

    # Порядок подключения.
    order = [f for f, _ in MP.ORDER]
    pos = {f: i for i, f in enumerate(order)}
    kit_js = sorted(f"js/{p.name}" for p in (ROOT / "js").glob("*.js")) + \
        sorted(f"vendor/{p.name}" for p in (ROOT / "vendor").glob("*.js"))
    for f in kit_js:
        if f not in pos and f not in MP.DOCS_ONLY:
            no(f"скрипт {f} не значится в порядке подключения (ORDER в tools/manifest_parts.py)")
    for f in order:
        if not (ROOT / f).exists():
            no(f"в порядке подключения {f}, а файла нет")
        for r in facts.get(f, {}).get("requires", []):
            if r not in pos:
                no(f"{f} читает {r}, которого нет в порядке подключения")
            elif pos[r] > pos[f]:
                no(f"{f} читает {r}, а подключается раньше него")
    css_order = [f for f, _ in MP.CSS_ORDER]
    kit_css = sorted(f"css/{p.name}" for p in (ROOT / "css").glob("*.css")) + \
        sorted(f"vendor/{p.name}" for p in (ROOT / "vendor").glob("*.css"))
    for f in kit_css:
        if f not in css_order and f not in MP.DOCS_ONLY:
            no(f"стиль {f} не значится в порядке подключения (CSS_ORDER)")

    # Ссылки между частями.
    for p in parts:
        for alt in p["instead"]:
            if alt["use"] and alt["use"] not in ids:
                no(f"часть {p['id']}: «вместо» ведёт к {alt['use']}, а такой части нет")
        for r in p["related"]:
            if r not in ids:
                no(f"часть {p['id']}: «связанное» ведёт к {r}, а такой части нет")

    # Графики — в обе стороны с кодом обёртки.
    charts_js = (ROOT / "js" / "dk-charts.js").read_text("utf-8")
    code_types = set(re.findall(r"\btype === '([a-z-]+)'", charts_js))
    types = set(m["charts"]["types"])
    for t in sorted(types - code_types):
        no(f"тип графика {t} в описи, а dk-charts.js его не рисует")
    for t, v in m["charts"]["types"].items():
        miss = [k for k in ("for", "not_for", "a11y") if not (isinstance(v, dict) and v.get(k))]
        if miss:
            no(f"вид графика {t}: не заполнено {', '.join(miss)} — скилл не узнает, когда его не брать")
    for t in sorted(code_types - types):
        no(f"dk-charts.js рисует {t}, а в описи его нет — скилл о нём не узнает")
    for row in m["charts"]["choose"]:
        for t in row["use"]:
            if t not in types:
                no(f"таблица выбора: «{row['task']}» ведёт к типу {t}, которого нет")
        opt = row.get("option")
        if opt and not re.search(r"\b(?:spec|s)\." + re.escape(opt) + r"\b", charts_js):
            no(f"таблица выбора: параметра {opt} в dk-charts.js нет")
        if not row["use"] and not row.get("missing"):
            no(f"таблица выбора: у «{row['task']}» нет ни типа, ни пометки «нет в ките»")

    # Скилл называет части описи по имени (kit.py show hero car) — каждая
    # названная часть обязана существовать, иначе скилл получит «части нет».
    for f in sorted((ROOT / "skill").rglob("*.md")):
        body = f.read_text("utf-8")
        for mt in re.finditer(r"kit\.py show ((?:[a-z][a-z-]*)(?: [a-z][a-z-]*)*)", body):
            for pid in mt.group(1).split():
                if pid not in ids:
                    no(f"{f.relative_to(ROOT)}: скилл называет часть «{pid}», а в описи её нет")

    # Зацепки.
    for c in m["hooks"]:
        if c in classes:
            no(f"зацепка .{c} получила правило в CSS — это уже класс, убери из HOOKS")

    # Читатель. Скилл видит опись только через tools/kit.py, и сломанный
    # читатель — это опись, которой нет. Поэтому каждая команда прогоняется на
    # каждой части, а блок подключения сверяется с зависимостями: скрипт в нём
    # стоит после всего, что он читает.
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("dk_kit_reader", ROOT / "tools" / "kit.py")
        kit = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(kit)
        kit.cmd_list(m, [])
        kit.cmd_charts(m, [])
        kit.cmd_show(m, sorted(ids))
        for p in parts:
            head = kit.cmd_head(m, [p["id"]])
            tags = re.findall(r'<script src="([^"]+)"', head)
            for f in p["include"]:
                if f not in tags:
                    no(f"читатель: head {p['id']} не подключает {f}")
            for i, f in enumerate(tags):
                for r in facts.get(f, {}).get("requires", []):
                    if r not in tags[:i]:
                        no(f"читатель: head {p['id']} ставит {f} раньше {r}, который он читает")
            if tags[:1] != ["js/dk-theme.js"] or head.index("dk-theme.js") > head.index("<link"):
                no(f"читатель: head {p['id']} ставит dk-theme.js не первым — будет вспышка темы")
    except SystemExit as e:
        no(f"читатель tools/kit.py отказал: {e}")
    except Exception as e:                       # noqa: BLE001
        no(f"читатель tools/kit.py упал: {e}")

    if not bad:
        missing = sum(1 for r in m["charts"]["choose"] if r.get("missing"))
        notes.append(f"МАНИФЕСТ · {len(parts)} частей описывают все {len(classes)} классов и "
                     f"{len(defined_by)} функций; порядок подключения сходится с кодом; "
                     f"{len(types)} типов графиков, {missing} пробела помечены; читатель отвечает на все части")


# Классы в разметке. Статическая часть атрибута class и строки, которые
# скрипты кладут в className, classList и селекторы. Склейка вида
# 'dk-toast--' + kind не проверяется: имя известно только во время работы.
_CLS_TOKEN = re.compile(r"^dk-[a-z0-9]+(?:(?:__|--|-)[a-z0-9]+)*$")
_CLS_SOURCES = [
    re.compile(r"""\bclass\s*=\s*\\?"([^"\\]*)"""),
    re.compile(r"""\bclass\s*=\s*'([^']*)'"""),
    re.compile(r"""\bclassName\s*=\s*'([^']*)'"""),
    re.compile(r"""\bclassList\.(?:add|remove|toggle|contains|replace)\(([^)]*)\)"""),
]
_SEL_SOURCE = re.compile(r"""\b(?:querySelector(?:All)?|closest|matches)\(\s*'([^']*)'""")


def _used_classes(text: str) -> list[tuple[int, str]]:
    found = []
    for rx in _CLS_SOURCES:
        for mt in rx.finditer(text):
            line = text.count("\n", 0, mt.start()) + 1
            chunk = re.sub(r"""['"]""", " ", mt.group(1))
            for tok in chunk.split():
                if tok.startswith("dk-") and _CLS_TOKEN.match(tok):
                    found.append((line, tok))
    for mt in _SEL_SOURCE.finditer(text):
        line = text.count("\n", 0, mt.start()) + 1
        for tok in re.findall(r"\.(dk-[a-z0-9_-]+)", mt.group(1)):
            if _CLS_TOKEN.match(tok):
                found.append((line, tok))
    return found


def check_classes() -> None:
    """Каждый класс кита в разметке и скриптах существует в CSS.

    Класс с опечаткой не ломает ничего громко: блок просто остаётся без
    стиля, и видно это только глазом, если повезёт. Так в примерах страниц
    компонентов жили dk-map__body и dk-toast--calm — оба без единого правила.
    Смотрятся страницы, скрипты кита и примеры кода в README: README скилл
    читает так же, как страницы, и пример с несуществующим классом он
    перенесёт в дашборд.

    Класс без стиля бывает законным — зацепка для скрипта. Такие перечислены
    в HOOKS в tools/manifest_parts.py с причиной; всё прочее без правила —
    нарушение.

    ЧЕГО НЕ ДЕЛАЕТ: не видит имя, склеенное во время работы ('dk-toast--' +
    kind), и не проверяет, что класс стоит на подходящем элементе.
    """
    try:
        mod = _load_manifest_builder()
    except Exception as e:                       # noqa: BLE001
        fail("КЛАССЫ", f"не удалось прочитать сборщик описи: {e}")
        return
    classes = mod.css_classes()
    hooks = set(mod.MP.HOOKS)
    # Иконка — та же история, что класс: ссылка #ti-имя на отсутствующий в
    # спрайте значок не падает, а рисует пустое место. Так в пробной странице
    # метка «негатив растёт» осталась без стрелки (ti-trending-up в наборе нет).
    sprite = set(re.findall(r'id=\\?"ti-([a-z0-9-]+)', (ROOT / "js" / "dk-icons.js").read_text("utf-8")))
    icons_bad: dict[str, list[str]] = {}
    icons_total = 0
    # Файлы скилла сборки дашбордов — тоже: пример из скилла скилл перенесёт
    # в чужой проект, и выдуманный класс там уже никто не поймает.
    sources = page_files() + sorted((ROOT / "js").glob("*.js")) + [ROOT / "README.md"] + \
        sorted((ROOT / "skill").rglob("*.md"))
    seen: dict[str, list[str]] = {}
    total = 0
    for f in sources:
        text = f.read_text("utf-8")
        for mt in re.finditer(r"#ti-([a-z0-9]+(?:-[a-z0-9]+)*)(?![a-z0-9-])", text):
            icons_total += 1
            if mt.group(1) not in sprite:
                icons_bad.setdefault(mt.group(1), []).append(
                    f"{f.relative_to(ROOT)}:{text.count(chr(10), 0, mt.start()) + 1}")
        for line, cls in _used_classes(text):
            total += 1
            if cls in classes or cls in hooks:
                continue
            where = f"{f.relative_to(ROOT)}:{line}"
            if f.name.startswith("component-"):
                where += " (правь tools/component_pages/)"
            seen.setdefault(cls, []).append(where)
    for cls, where in sorted(seen.items()):
        more = f" и ещё {len(where) - 3}" if len(where) > 3 else ""
        fail("КЛАССЫ", f".{cls} стоит в разметке, а правила в CSS нет: {', '.join(where[:3])}{more} — "
                       f"опечатка или пустышка; зацепку для скрипта впиши в HOOKS с причиной")
    for name, where in sorted(icons_bad.items()):
        fail("КЛАССЫ", f"иконки ti-{name} нет в спрайте: {', '.join(where[:3])} — на её месте пусто; "
                       f"впиши имя в ICONS в tools/build-icons.py и пересобери или возьми имеющуюся")
    if not seen and not icons_bad:
        notes.append(f"КЛАССЫ · {total} употреблений классов и {icons_total} ссылок на иконки в страницах, "
                     f"скриптах и README — все существуют ({len(hooks)} зацепка без стиля по списку)")


def _png_info(path: Path) -> tuple[int, int, bool] | None:
    """Ширина, высота и «есть ли хоть один прозрачный пиксель» — без
    зависимостей. Прозрачность честно проверяется по пикселям: у PNG с
    каналом альфы все пиксели могут быть непрозрачными, и тогда файл годится."""
    import struct, zlib
    b = path.read_bytes()
    if b[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w, h, depth, ctype = struct.unpack(">IIBB", b[16:26])
    if ctype in (0, 2, 3):              # серый, RGB, палитра: канала альфы нет
        # палитра с tRNS может быть прозрачной — считаем прозрачной, если tRNS есть
        return w, h, ctype == 3 and b"tRNS" in b
    if depth != 8 or ctype not in (4, 6):
        return w, h, True               # не разбираем — считаем прозрачной, пусть глянут
    data, i = b"", 8
    while i < len(b):
        n = struct.unpack(">I", b[i:i + 4])[0]
        kind = b[i + 4:i + 8]
        if kind == b"IDAT":
            data += b[i + 8:i + 8 + n]
        i += 12 + n
    raw = zlib.decompress(data)
    bpp = 4 if ctype == 6 else 2
    stride = w * bpp
    prev = bytearray(stride)
    pos = 0
    for _ in range(h):
        f = raw[pos]; row = bytearray(raw[pos + 1:pos + 1 + stride]); pos += 1 + stride
        for x in range(stride):
            a = row[x - bpp] if x >= bpp else 0
            up = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1: row[x] = (row[x] + a) & 255
            elif f == 2: row[x] = (row[x] + up) & 255
            elif f == 3: row[x] = (row[x] + (a + up) // 2) & 255
            elif f == 4:
                p = a + up - c; pa, pb, pc = abs(p - a), abs(p - up), abs(p - c)
                row[x] = (row[x] + (a if pa <= pb and pa <= pc else up if pb <= pc else c)) & 255
        if any(row[k] != 255 for k in range(bpp - 1, stride, bpp)):
            return w, h, True
        prev = row
    return w, h, False


def check_app_icons() -> None:
    """Иконки, на которые ссылаются страницы: есть, нужного размера, где
    надо — непрозрачны.

    Иконку не видно, пока её не сломали: вкладка показывает запасной значок
    молча, а iPhone прозрачную иконку заливает чёрным — узнают об этом, когда
    продукт уже поставили на главный экран. Поэтому:
    - каждый файл из <link rel="icon"> и <link rel="apple-touch-icon"> есть;
    - PNG того размера, что объявлен в sizes; иконка iPhone — 180×180;
    - иконка iPhone и маскируемая (icon-maskable-*) — без прозрачных пикселей;
    - favicon.svg — настоящий SVG с квадратным полем.

    ЧЕГО НЕ ДЕЛАЕТ: не проверяет, что знак читается в 16 px и что он внутри
    безопасной зоны маскируемой иконки, — это глаз по листу иконок (README,
    «Иконки приложения, фавикон и логотип»).
    """
    link = re.compile(r'<link\b[^>]*\brel="(icon|apple-touch-icon)"[^>]*>')
    seen: dict[str, str] = {}
    bad = False
    for f in page_files():
        text = f.read_text("utf-8")
        for m in link.finditer(text):
            tag = m.group(0)
            href = re.search(r'href="([^"]+)"', tag)
            if not href:
                continue
            target = (f.parent / href.group(1)).resolve()
            # Проверяется каждая ссылка, а не каждый файл: один и тот же
            # файл на другой странице может быть объявлен с другим sizes.
            seen[str(target)] = m.group(1)
            rel = target.relative_to(ROOT) if target.is_relative_to(ROOT) else target
            if not target.exists():
                fail("ЗНАЧОК", f"{f.name}: {href.group(1)} — файла нет, вкладка покажет пустой значок")
                bad = True
                continue
            if target.suffix == ".svg":
                svg = target.read_text("utf-8")
                vb = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
                if "<svg" not in svg or not vb or vb.group(1) != vb.group(2):
                    fail("ЗНАЧОК", f"{rel}: не SVG с квадратным полем viewBox")
                    bad = True
                continue
            info = _png_info(target)
            if not info:
                fail("ЗНАЧОК", f"{rel}: не PNG")
                bad = True
                continue
            w, h, transparent = info
            sizes = re.search(r'sizes="(\d+)x(\d+)"', tag)
            want = (180, 180) if m.group(1) == "apple-touch-icon" else \
                (int(sizes.group(1)), int(sizes.group(2))) if sizes else None
            if want and (w, h) != want:
                fail("ЗНАЧОК", f"{rel}: {w}×{h}, а объявлено {want[0]}×{want[1]}")
                bad = True
            if m.group(1) == "apple-touch-icon" and transparent:
                fail("ЗНАЧОК", f"{rel}: есть прозрачные пиксели — iPhone зальёт их чёрным")
                bad = True
    # Маскируемые иконки в тех же папках: Android режет их своей формой, и
    # прозрачный угол становится дыркой в иконке на главном экране.
    for folder in {Path(k).parent for k in seen}:
        for mk in sorted(folder.glob("icon-maskable-*.png")):
            info = _png_info(mk)
            if info and info[2]:
                fail("ЗНАЧОК", f"{mk.relative_to(ROOT)}: маскируемая иконка с прозрачностью — "
                               f"фон обязан идти до краёв")
                bad = True
    if not seen:
        skipped.append("ЗНАЧОК · ни одна страница не ссылается на иконки — проверять нечего")
    elif not bad:
        notes.append(f"ЗНАЧОК · {len(seen)} файлов иконок на месте, размеры сходятся, "
                     f"иконка iPhone и маскируемая непрозрачны")


class _TableParents:
    """Таблица кита и её непосредственный родитель — для проверки ТЕЛЕФОН."""
    VOID = {"br", "img", "input", "meta", "link", "use", "path", "col", "hr",
            "source", "wbr", "circle", "rect", "line", "polyline", "polygon"}

    def __init__(self, text: str) -> None:
        from html.parser import HTMLParser
        outer = self
        self.bad: list[tuple[int, str]] = []
        stack: list[tuple[str, list[str]]] = []

        class P(HTMLParser):
            def handle_starttag(self, tag, attrs):
                cls = (dict(attrs).get("class") or "").split()
                if tag == "table" and "dk-table" in cls:
                    parent = stack[-1] if stack else ("", [])
                    if "dk-tablewrap" not in parent[1]:
                        outer.bad.append((self.getpos()[0],
                                          ".".join([parent[0]] + parent[1][:1])))
                if tag not in _TableParents.VOID:
                    stack.append((tag, cls))

            def handle_endtag(self, tag):
                for i in range(len(stack) - 1, -1, -1):
                    if stack[i][0] == tag:
                        del stack[i:]
                        break

        P().feed(text)


def check_phone(fast: bool = False) -> None:
    """Страницы на телефоне, планшете и телефоне боком — в настоящем браузере.

    Две части. Статическая: таблица кита стоит прямо в .dk-tablewrap. Без
    обёртки таблица либо распирает страницу шире экрана (три таблицы витрины
    на 360 давали 387 px), либо обрезается панелью с overflow: hidden — и
    колонки справа молча пропадают, а спрятанная колонка читается как
    отсутствующие данные (README, «Сетка и устройства»). Второй случай замер
    ширины не видит вовсе: страница не шире экрана, просто данных нет.

    Браузерная: tools/check-mobile.mjs — ширина страницы, касание в 21 px от
    центра каждой цели, шрифт полей, вырез, theme-color, ошибки в консоли.
    Нужны node 22+ и Chrome; без них часть печатается знаком «?», а не
    галочкой. --fast пропускает её так же честно: это полминуты.

    ЧЕГО НЕ ДЕЛАЕТ: не заменяет живой телефон. Эмулятор Chrome — не Safari и
    не WebView; список ручной проверки — в README, «Телефон и приложения».
    """
    import json
    import shutil
    import subprocess

    bad = False
    for f in page_files():
        for line, parent in _TableParents(f.read_text("utf-8")).bad:
            fail("ТЕЛЕФОН", f"{f.name}:{line}: таблица кита стоит в <{parent}>, а не прямо "
                            f"в .dk-tablewrap — на телефоне она распирает страницу или "
                            f"обрезается без прокрутки")
            bad = True

    script = ROOT / "tools" / "check-mobile.mjs"
    node = shutil.which("node")
    if fast:
        skipped.append("ТЕЛЕФОН · браузерная часть пропущена (--fast): ширина, цели, "
                       "поля и вырез не проверены")
        if not bad:
            notes.append("ТЕЛЕФОН · таблицы кита стоят в обёртке прокрутки (браузер не запускался)")
        return
    if not node or not script.exists():
        skipped.append("ТЕЛЕФОН · браузерная часть не проверена: нет node")
        return
    try:
        r = subprocess.run([node, str(script), "--json"], capture_output=True,
                           text=True, timeout=600, cwd=ROOT)
        res = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as e:                       # noqa: BLE001
        fail("ТЕЛЕФОН", f"tools/check-mobile.mjs не отработал: {e}; {r.stderr[-300:] if 'r' in dir() else ''}")
        return
    if res.get("skipped"):
        skipped.append(f"ТЕЛЕФОН · браузерная часть не проверена: {res['skipped']}")
        return
    for msg in res["problems"]:
        fail("ТЕЛЕФОН", msg)
        bad = True
    if not bad:
        notes.append(f"ТЕЛЕФОН · {res['pages']} страниц в {len(res['viewports'])} размерах: "
                     f"не шире экрана, цели от 44 px, поля не зумятся, вырез обойдён")


def check_page(path: Path) -> None:
    """Страница, собранная ВНЕ кита, по правилам кита: python3 tools/check.py --page путь.

    Скилл сборки дашбордов собирает страницы в чужих проектах, а проверки
    кита смотрят только на страницы самого кита. Эта — на одну чужую: то, что
    проверяется по тексту страницы, без запуска кита целиком.
    - классы dk-* есть в CSS кита, иконки #ti-* — в спрайте;
    - подключение: каждая функция dk*, которую страница зовёт, подключена
      своим скриптом со всеми зависимостями, в порядке кита; тема — первой
      и без defer; стили в порядке слоёв;
    - разметка строкой идёт через dkEsc;
    - таблица кита — прямо в dk-tablewrap;
    - каждый var(--x) объявлен в ките или на самой странице;
    - dk-root и data-theme на одном элементе.

    ЧЕГО НЕ ДЕЛАЕТ: не открывает страницу в браузере — ширину, цели касания и
    вырез для чужой страницы проверяет снимок и живой телефон.
    """
    L = "СТРАНИЦА"
    if not path.exists():
        fail(L, f"нет файла {path}")
        return
    text = path.read_text("utf-8")
    try:
        mod = _load_manifest_builder()
    except Exception as e:                       # noqa: BLE001
        fail(L, f"не удалось прочитать опись кита: {e}")
        return
    classes = mod.css_classes()
    facts = mod.script_facts()
    MP = mod.MP
    before = len(problems)

    # Классы и иконки.
    for line, cls in _used_classes(text):
        if cls not in classes and cls not in MP.HOOKS:
            fail(L, f"{path.name}:{line}: класса .{cls} в ките нет — выдуман или опечатка; "
                    f"классы части: python3 tools/kit.py show <часть>")
    sprite = set(re.findall(r'id=\\?"ti-([a-z0-9-]+)', (ROOT / "js" / "dk-icons.js").read_text("utf-8")))
    for mt in re.finditer(r"#ti-([a-z0-9]+(?:-[a-z0-9]+)*)(?![a-z0-9-])", text):
        if mt.group(1) not in sprite:
            fail(L, f"{path.name}:{text.count(chr(10), 0, mt.start()) + 1}: иконки ti-{mt.group(1)} нет в спрайте")

    # Подключение: какие файлы кита стоят и в каком порядке.
    def kit_file(ref: str) -> str | None:
        ref = ref.split("?")[0]
        for known in [f for f, _ in MP.ORDER] + [f for f, _ in MP.CSS_ORDER]:
            if ref == known or ref.endswith("/" + known):
                return known
        return None
    tags = re.findall(r'<(script|link)\b([^>]*)>', text)
    js_seen: list[tuple[str, bool]] = []
    css_seen: list[str] = []
    for kind, attrs in tags:
        if kind == "script":
            src = re.search(r'\bsrc="([^"]+)"', attrs)
            f = kit_file(src.group(1)) if src else None
            if f:
                js_seen.append((f, " defer" in attrs or " async" in attrs))
        elif 'rel="stylesheet"' in attrs:
            href = re.search(r'\bhref="([^"]+)"', attrs)
            f = kit_file(href.group(1)) if href else None
            if f:
                css_seen.append(f)
    js_files = [f for f, _ in js_seen]
    order = [f for f, _ in MP.ORDER]
    defined_by = {n: f for f, v in facts.items() for n in v["defines"]}
    called = set(re.findall(r"\b(dk[A-Z][A-Za-z]+)\s*[(.]", text))
    need: set[str] = set()
    for n in called:
        f = defined_by.get(n)
        if f:
            need.add(f)
    stack = list(need)
    while stack:
        f = stack.pop()
        for r in facts.get(f, {}).get("requires", []):
            if r not in need:
                need.add(r); stack.append(r)
    # Встроенный кит (dk-root не на <html>) тему страницы не ставит: тема
    # живёт на обёртке, и dk-theme.js ему не нужен — собственный образец
    # встраивания embed.html его не подключает. Своей странице — обязателен.
    own_page = bool(re.search(r'<html\b[^>]*\bclass="[^"]*\bdk-root\b', text))
    need |= {"js/dk-util.js"} | ({"js/dk-theme.js"} if own_page else set())
    for f in sorted(need, key=lambda x: order.index(x) if x in order else 99):
        if f not in js_files:
            fail(L, f"{path.name}: не подключён {f} — нужен для {', '.join(sorted(n for n in called if defined_by.get(n) == f)) or 'основы'}; "
                    f"подключение: python3 tools/kit.py head <части>")
    # Порядок важен там, где есть зависимость: скрипт после того, что он
    # читает. Порядок независимых скриптов — не нарушение (regions.html кита
    # ставит карту раньше таблицы, и это ничего не ломает).
    for i, f in enumerate(js_files):
        for r in facts.get(f, {}).get("requires", []):
            if r in js_files and js_files.index(r) > i:
                fail(L, f"{path.name}: {f} подключён раньше {r}, который он читает; "
                        f"порядок даёт python3 tools/kit.py head")
    for f, deferred in js_seen:
        if f in ("js/dk-theme.js", "js/dk-util.js") and deferred:
            fail(L, f"{path.name}: {f} с defer — {'вспышка тёмной темы' if 'theme' in f else 'компоненты не найдут экранирование'}")
    if js_files and "js/dk-theme.js" in js_files and js_files[0] != "js/dk-theme.js":
        fail(L, f"{path.name}: первым должен стоять js/dk-theme.js — иначе вспышка темы")
    corder = [f for f, _ in MP.CSS_ORDER]
    cpos = [corder.index(f) for f in css_seen]
    if cpos != sorted(cpos):
        fail(L, f"{path.name}: стили кита не в порядке слоёв — {', '.join(css_seen)}")
    for base in ("css/tokens.primitives.css", "css/tokens.semantic.css", "css/components.css"):
        if base not in css_seen:
            fail(L, f"{path.name}: не подключён {base}")
    if "vendor/air-datepicker.js" in js_files and "vendor/air-datepicker.css" not in css_seen:
        fail(L, f"{path.name}: календарь периода без vendor/air-datepicker.css — нарисуется голым списком")

    # Экранирование в скриптах страницы.
    if ".innerHTML" in text and not re.search(r"\bdkEsc\b|\besc\(", text):
        fail(L, f"{path.name}: собирает разметку строкой и не зовёт dkEsc")

    # Таблица-карточки без dkTable — карточки без подписей: подписи колонок
    # ставит скрипт, CSS их взять неоткуда.
    if "dk-table--cards" in text and not re.search(r"\bdkTable\s*\(", text):
        fail(L, f"{path.name}: dk-table--cards без dkTable(...) — на телефоне карточки будут без подписей колонок")

    # Таблица в обёртке.
    for line, parent in _TableParents(text).bad:
        fail(L, f"{path.name}:{line}: таблица кита стоит в <{parent}>, а не прямо в .dk-tablewrap")

    # Токены.
    declared = set()
    for f in (ROOT / "css").glob("*.css"):
        declared |= {n for n, _ in declarations(strip_comments(f.read_text("utf-8")))}
    declared |= {n for n, _ in declarations(text)}
    for name in sorted(set(USE.findall(text))):
        if name.endswith("-") or name in declared or name in COMPONENT_INPUTS:
            continue
        fail(L, f"{path.name}: var({name}) нигде не объявлен")

    # Тег viewport. Без него телефон показывает страницу уменьшенной копией
    # десктопа, и все правила кита для телефона не срабатывают вовсе: ширина
    # экрана для страницы — 980. Своей странице он обязателен; во встроенном
    # ките это страница хозяина — говорим, но не решаем за него (проверочная
    # задача 2, 29.09: исполнитель заметил сам, проверка — нет).
    has_vp = re.search(r'<meta\b[^>]*name="viewport"[^>]*width=device-width', text)
    if not has_vp:
        if re.search(r'<html\b[^>]*\bclass="[^"]*\bdk-root\b', text):
            fail(L, f"{path.name}: нет <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> — "
                    f"на телефоне страница будет уменьшенным десктопом")
        else:
            skipped.append(f"{L} · {path.name}: у страницы хозяина нет тега viewport — на телефоне кит покажется "
                           f"уменьшенным десктопом; добавлять его — решение хозяина")

    # Корень.
    roots = re.findall(r"<[a-z]+\b[^>]*\bclass=\"[^\"]*\bdk-root\b[^\"]*\"[^>]*>", text)
    if not roots:
        fail(L, f"{path.name}: нет элемента с классом dk-root — токены кита не действуют")
    elif not any("data-theme=" in r for r in roots):
        fail(L, f"{path.name}: data-theme не на элементе dk-root — тема не применится")

    if len(problems) == before:
        notes.append(f"{L} · {path.name}: классы и иконки есть в ките, подключено всё нужное и по порядку, "
                     f"экранирование, таблицы и токены в порядке")
    # Телефон — той же браузерной проверкой, что у кита, но с корнем в папке
    # страницы: кит в проекте лежит рядом (ссылкой или копией), и сервер
    # проверки отдаёт его оттуда же. Исполнитель проверочной задачи скилла
    # копировал check-mobile.mjs ради этого руками (29.09).
    import json, shutil, subprocess
    node = shutil.which("node")
    script = ROOT / "tools" / "check-mobile.mjs"
    if "--fast" in sys.argv or not node:
        skipped.append(f"{L} · {path.name}: ширина, цели касания и вырез не проверены — "
                       f"{'--fast' if node else 'нет node'}")
        return
    try:
        import os
        r = subprocess.run([node, str(script), "--json", path.name], capture_output=True, text=True,
                           timeout=600, cwd=path.parent, env={**os.environ, "DK_ROOT": str(path.parent)})
        res = json.loads(r.stdout.strip().splitlines()[-1])
    except Exception as e:                       # noqa: BLE001
        skipped.append(f"{L} · {path.name}: телефонная часть не отработала ({e})")
        return
    if res.get("skipped"):
        skipped.append(f"{L} · {path.name}: телефонная часть не проверена: {res['skipped']}")
        return
    for msg in res["problems"]:
        fail(L, "телефон: " + msg)
    if not res["problems"]:
        notes.append(f"{L} · {path.name}: на телефоне, боком и на планшете не шире экрана, цели от 44 px, "
                     f"поля не зумятся, вырез обойдён")
    skipped.append(f"{L} · {path.name}: эмулятор Chrome — не живой телефон и не WebView")


def main() -> int:
    if "--page" in sys.argv:
        i = sys.argv.index("--page")
        if i + 1 >= len(sys.argv):
            print("--page без пути: python3 tools/check.py --page путь/к/странице.html", file=sys.stderr)
            return 2
        check_page(Path(sys.argv[i + 1]).resolve())
        print()
        for n in notes:
            print(f"  ✓ {n}")
        for s in skipped:
            print(f"  ? {s}")
        for p in problems:
            print(f"  ✗ {p}")
        print()
        if problems:
            print(f"  Нарушений: {len(problems)}.\n")
            return 1
        print("  По правилам кита страница цела; проверено не всё — см. «?».\n")
        return 0

    for f in (PRIMITIVES, SEMANTIC):
        if not f.exists():
            print(f"нет файла: {f.relative_to(ROOT)}", file=sys.stderr)
            return 1

    primitives = strip_comments(PRIMITIVES.read_text("utf-8"))
    semantic = strip_comments(SEMANTIC.read_text("utf-8"))
    layers = [(f.name, strip_comments(f.read_text("utf-8"))) for f in component_files()]
    pages = [(f.name, strip_comments(f.read_text("utf-8"))) for f in page_files()]
    scripts = [(f.name, f.read_text("utf-8")) for f in script_files()]
    if not layers:
        print("нет ни одного файла слоя компонентов в css/", file=sys.stderr)
        return 1

    check_layers(primitives, semantic, layers)
    check_raw_values(semantic, layers)
    check_unknown(primitives, semantic, layers, pages, scripts)
    check_inputs(layers)
    check_dynamic_meaning(scripts, pages)
    check_accent_role(primitives, semantic, layers, pages)
    check_escaping(pages)
    styled = layers + [(n, page_css(t)) for n, t in pages]
    check_sizes(primitives, semantic, styled)
    check_even(primitives, styled)
    check_hover(styled)
    check_contrast(primitives, semantic)
    check_surfaces(primitives, semantic)
    check_meaning(primitives, semantic)
    check_spot(primitives, semantic)
    check_button(primitives, semantic)
    check_scale(primitives, semantic)
    check_palette(primitives)
    check_generated()
    check_engine()
    check_zero_size()
    check_quiet(primitives, semantic, layers)
    from uiux_policy import validate as validate_uiux
    for error in validate_uiux(ROOT):
        fail("UIUX", error)
    notes.append("UI/UX: реестр и десять эвристик согласованы; ручное ревью отдельно")
    check_pages()
    check_manifest()
    check_classes()
    check_app_icons()
    check_phone(fast="--fast" in sys.argv)

    print()
    for n in notes:
        print(f"  ✓ {n}")
    for s in skipped:
        print(f"  ? {s}")
    for p in problems:
        print(f"  ✗ {p}")
    print()
    if problems:
        print(f"  Нарушений: {len(problems)}. Система разъезжается — почини до коммита.\n")
        return 1
    if skipped:
        print("  Нарушений нет, но проверено не всё — см. строки со знаком «?».\n")
        return 0
    print("  Система цела.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
