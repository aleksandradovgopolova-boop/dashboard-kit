#!/usr/bin/env python3
"""Собирает страницы компонентов component-*.html и указатель js/docs-index.js.

    python3 tools/build-component-pages.py

Зачем скрипт, а не страницы руками: у страницы компонента одиннадцать блоков
в одном порядке (DECISIONS.md, пункт 5), и держать этот порядок в двадцати
файлах руками нельзя — первая же правка шаблона разошлась бы с половиной
страниц, как однажды разошлась тема графиков с токенами. Здесь шаблон один,
содержание лежит в tools/component_pages/*.py, а проверка СТРАНИЦЫ в
tools/check.py следит, что файлы на диске совпадают с тем, что собирает
скрипт: значит, править нужно содержание, а не html.

Пустой блок — сигнал, что компонент не доделан. Поэтому блок нельзя
пропустить: у каждого поля есть обязательное значение, и если сказать нечего,
это пишется словами («размеров нет: …»), а не прячется.
"""

from __future__ import annotations

import html
import importlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

GROUPS = ["Управление", "Фильтры", "Данные", "Визуализация", "Обратная связь"]
MODULES = ["p1_controls", "p2_filters", "p3_data", "p4_viz", "p5_feedback"]

CATALOG_DESCRIPTIONS = {'chips-input': 'Ввод набора произвольных значений с отдельным удалением.', 'chips-select': 'Выбор нескольких значений из справочника с видимым набором.', 'button': 'Выполнение основного или дополнительного действия.', 'segment': 'Переключение вида одних и тех же данных.', 'tabs': 'Переход между разделами продукта.', 'check': 'Независимый выбор, выбор одного варианта и переключение режима.', 'field': 'Ввод данных с подписью, подсказкой и проверкой.', 'select': 'Выбор одного или нескольких значений из списка.', 'period': 'Выбор периода для просмотра и сравнения данных.', 'search': 'Поиск объекта по названию.', 'legend': 'Обозначение категорий данных и фильтрация по ним.', 'pager': 'Переход между страницами набора данных.', 'table': 'Сравнение объектов по общим признакам.', 'badge': 'Краткие метки, статусы и показатели внутри других компонентов.', 'tile': 'Отображение отдельного показателя и его изменения.', 'hero': 'Общее состояние и ключевой показатель экрана.', 'car': 'Группа связанных карточек с навигацией.', 'rank': 'Ранжирование объектов по выбранному показателю.', 'list': 'Список объектов с дополнительными данными и действиями.', 'uptime': 'История доступности служб за выбранный период.', 'chart': 'Сравнение величин, динамики и состава данных.', 'map': 'Географическое распределение показателей и альтернативный вид плитками.', 'calendar': 'Распределение работ и событий по датам.', 'banner': 'Состояние страницы и подтверждение выполненного действия.', 'modal': 'Подтверждение действия или выполнение отдельной задачи.', 'empty': 'Сообщения о загрузке, отсутствии данных и ошибке.'}

# Порядок блоков — из шаблона разбора. Менять порядок здесь, а не в страницах.
BLOCKS = [
    ("zhivoy-primer", "Живой пример", "Обзор"),
    ("kogda-ispolzovat", "Когда использовать", None),
    ("anatomiya", "Анатомия", None),
    ("varianty-i-razmery", "Варианты и размеры", "Использование"),
    ("sostoyaniya", "Состояния", None),
    ("kontent", "Контент", None),
    ("dostupnost", "Доступность", None),
    ("tokeny", "Токены", "Разработка"),
    ("kod", "Код", None),
    ("svyazannoe", "Связанное", None),
]

REQUIRED = ["slug", "title", "group", "purpose", "status", "files", "scripts",
            "live", "when_yes", "when_no", "anatomy_html", "anatomy", "variants",
            "sizes", "states", "content_ok", "content_bad", "a11y", "tokens",
            "code", "api", "related"]


def esc(s: str) -> str:
    return html.escape(str(s), quote=True)


def li(items) -> str:
    return "".join(f"<li>{x}</li>" for x in items)


def render(p: dict) -> str:
    # scripts может быть пустым честно: у кнопки скрипта нет. Остальное — нет.
    missing = [k for k in REQUIRED if k not in p or (k != "scripts" and p[k] in ("", [], None))]
    if missing:
        raise SystemExit(f"{p.get('slug')}: пустые блоки {missing} — пустой блок не собирается, "
                         f"скажи словами, почему там пусто")
    # Свои скрипты лежат в js/, чужие — в vendor/: путь с косой чертой берётся
    # как есть. На первой сборке vendor/air-datepicker.js получил префикс js/,
    # и страница периода упала — ошибку поймал браузер, не генератор.
    scripts = "".join(f'<script src="{s if "/" in s else "js/" + s}" defer></script>\n' for s in p["scripts"])
    variants = "".join(
        f"<tr><td><code>{esc(c)}</code></td><td>{w}</td><td>{k}</td></tr>" for c, w, k in p["variants"])
    api = "".join(f"<tr><td><code>{esc(n)}</code></td><td>{t}</td><td>{d}</td></tr>" for n, t, d in p["api"])
    anatomy = "".join(f"<li><b>{b}</b> — {t}</li>" for b, t in p["anatomy"])
    related = "".join(f'<li><a href="{esc(h)}">{t}</a>{(" — " + d) if d else ""}</li>' for h, t, d in p["related"])
    files = " · ".join(f"<code>{esc(f)}</code>" for f in p["files"])
    live_script = p.get("live_script", "")
    sec = []
    for i, (sid, title, group) in enumerate(BLOCKS):
        body = {
            "zhivoy-primer": f'<p>{p["live_intro"]}</p>{p["live"]}' if p.get("live_intro") else p["live"],
            "kogda-ispolzovat": (
                '<div class="sc-cols"><div class="sc-note"><b>Когда использовать</b><ul class="sc-list">' + li(p["when_yes"]) +
                '</ul></div><div class="sc-note"><b>Когда выбрать другое</b><ul class="sc-list">' + li(p["when_no"]) +
                '</ul></div></div>'),
            "anatomiya": ('<p>Номера на схеме — те же, что в списке.</p><div class="dk-panel sc-anatomy">' +
                          p["anatomy_html"] + '</div><ol class="sc-anatomy__list">' + anatomy + '</ol>'),
            "varianty-i-razmery": (
                f'<p>{p["sizes"]}</p><div class="dk-tablewrap"><table class="dk-table sc-api">'
                '<thead><tr><th style="width:30%">Класс или параметр</th><th>Что делает</th>'
                f'<th style="width:30%">Когда</th></tr></thead><tbody>{variants}</tbody></table></div>'),
            "sostoyaniya": p["states"],
            "kontent": ('<div class="sc-cols"><div class="sc-note sc-note--ok"><b>Так</b><ul class="sc-list">' +
                        li(p["content_ok"]) + '</ul></div><div class="sc-note sc-note--bad"><b>Не так</b>'
                        '<ul class="sc-list">' + li(p["content_bad"]) + '</ul></div></div>'),
            "dostupnost": '<ul class="sc-list sc-list--wide">' + li(p["a11y"]) + '</ul>',
            "tokeny": ('<p>Какие токены читает компонент. Список собирается при открытии страницы из '
                       '<code>css/components.css</code> по префиксам селекторов, а не пишется руками — иначе '
                       'разошёлся бы с кодом при первой правке. Значения — с экрана, в текущей теме.</p>'
                       f'<ul class="sc-tokens" data-tokens="{esc(",".join(p["tokens"]))}">'
                       '<li class="sc-tokens__wait">Читаем css/components.css…</li></ul>'),
            "kod": (f'<p>{p.get("code_intro", "")}</p><pre class="sc-code"><code>{esc(p["code"])}</code></pre>'
                    '<div class="dk-tablewrap"><table class="dk-table sc-api"><thead><tr>'
                    '<th style="width:26%">Параметр</th><th style="width:22%">Тип</th><th>Что делает</th>'
                    f'</tr></thead><tbody>{api}</tbody></table></div>'),
            "svyazannoe": '<ul class="sc-list sc-list--wide">' + related + '</ul>',
        }[sid]
        grp = f' data-group="{group}"' if group else ""
        sec.append(f'  <section class="sc-sec"{grp}>\n    <h2>{title}</h2>\n    {body}\n  </section>\n')

    return f"""<!DOCTYPE html>
<html class="dk-root" lang="ru" data-theme="dark" data-accent="blue">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(p["title"])} · dashboard-kit</title>
<!-- СОБРАНО СКРИПТОМ tools/build-component-pages.py, РУКАМИ НЕ ПРАВИТЬ.
     Содержание — tools/component_pages/{p["module"]}.py. Проверка СТРАНИЦЫ
     в tools/check.py сверяет этот файл с тем, что собирает скрипт. -->
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/icon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<script src="js/dk-theme.js"></script>
<link rel="stylesheet" href="vendor/air-datepicker.css">
<link rel="stylesheet" href="css/tokens.primitives.css">
<link rel="stylesheet" href="css/tokens.semantic.css">
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/docs.css">
<script src="js/dk-util.js"></script>
<script src="js/dk-icons.js" defer></script>
{scripts}<script src="js/docs-index.js" defer></script>
<script src="js/docs.js" defer></script>
</head>
<body class="dk-page">

<header class="sc-bar">
  <a class="sc-brand" href="showcase.html">
    <span class="sc-brand__t">dashboard-kit</span>
    <span class="sc-brand__s">← к витрине</span>
  </a>
  <div class="sc-ctl">
    <div class="dk-seg dk-seg--icons" role="group" aria-label="Тема">
      <button type="button" data-theme-set="light" aria-pressed="false" aria-label="Светлая тема" title="Светлая тема"><svg class="dk-i"><use href="#ti-sun"/></svg></button>
      <button type="button" data-theme-set="dark" aria-pressed="true" aria-label="Тёмная тема" title="Тёмная тема"><svg class="dk-i"><use href="#ti-moon"/></svg></button>
    </div>
  </div>
</header>

<div class="sc-shell sc-shell--closed">
<nav hidden class="sc-nav" aria-label="Разделы страницы"></nav>

<div class="dk-wrap" id="top">

  <header class="sc-hero sc-hero--component">
    <p class="sc-hero__o">Компоненты · {esc(p["group"])}</p>
    <h1>{esc(p["title"])}</h1>
    <p class="sc-hero__lead">{p["purpose"]}</p>
    <div class="sc-meta">
      <span class="dk-status dk-status--calm"><svg class="dk-i dk-i--sm"><use href="#ti-circle-check"/></svg>{esc(p["status"])}</span>
      <span class="sc-meta__i">код: {files}</span>
    </div>
  </header>

{"".join(sec)}
</div>
</div>

<script>
(function () {{
  'use strict';
  var root = document.documentElement;
{live_script}
}})();
</script>
</body>
</html>
"""


def load_pages() -> list[dict]:
    pages = []
    for m in MODULES:
        mod = importlib.import_module(f"component_pages.{m}")
        for p in mod.PAGES:
            p = dict(p)
            p["module"] = m
            pages.append(p)
    return pages


def build() -> dict[str, str]:
    """Имя файла → содержимое, включая указатель."""
    pages = load_pages()
    out = {f"component-{p['slug']}.html": render(p) for p in pages}
    index = [{"slug": p["slug"], "title": p["title"], "group": p["group"], "description": CATALOG_DESCRIPTIONS[p["slug"]]} for p in pages]
    out["js/docs-index.js"] = (
        "/* СОБРАНО tools/build-component-pages.py — указатель страниц компонентов для\n"
        "   оглавления документации (js/docs.js). Руками не править. */\n"
        "window.dkDocsIndex = " + json.dumps(index, ensure_ascii=False, indent=2) + ";\n")
    return out


def main() -> int:
    for name, text in build().items():
        (ROOT / name).write_text(text, "utf-8")
        print("собрано:", name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
