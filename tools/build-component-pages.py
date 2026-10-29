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

GROUPS = ["Управление", "Фильтры", "Данные", "Визуализация", "Обратная связь", "Утилиты", "Композиция"]
MODULES = ["p1_controls", "p2_filters", "p3_data", "p4_viz", "p5_feedback", "p6_utilities", "p6_advanced", "p7_composition"]

# Порядок блоков — из шаблона разбора. Менять порядок здесь, а не в страницах.
BLOCKS = [
    ("zhivoy-primer", "В работе", "Знакомство"),
    ("kogda-ispolzovat", "Когда использовать", None),
    ("anatomiya", "Из чего состоит", None),
    ("varianty-i-razmery", "Варианты и размеры", "Использование"),
    ("sostoyaniya", "Состояния", None),
    ("kontent", "Текст и подписи", None),
    ("dostupnost", "Доступность", None),
    ("svyazannoe", "С чем сочетать", None),
    ("tokeny", "Токены оформления", "Разработка"),
    ("kod", "Код и API", None),
]

REQUIRED = ["slug", "title", "group", "purpose", "status", "files", "scripts",
            "live", "when_yes", "when_no", "anatomy_html", "anatomy", "variants",
            "sizes", "states", "content_ok", "content_bad", "a11y", "tokens",
            "code", "api", "related"]


def esc(s: str) -> str:
    return html.escape(str(s), quote=True)


def li(items) -> str:
    return "".join(f"<li>{x}</li>" for x in items)


PAGE_EMOJI = {'button': '🔘', 'segment': '↔️', 'tabs': '🗂️', 'check': '☑️', 'field': '✍️', 'select': '🔎', 'period': '📆', 'search': '🔍', 'legend': '🎨', 'pager': '📑', 'chips-input': '🏷️', 'chips-select': '🏷️', 'table': '📋', 'badge': '🔖', 'tile': '🔢', 'hero': '🎯', 'car': '🗃️', 'rank': '🏆', 'list': '📝', 'uptime': '📶', 'avatar': '👤', 'counter': '🔢', 'chip': '🏷️', 'accordion': '🪗', 'chart': '📊', 'map': '🗺️', 'calendar': '🗓️', 'banner': '💬', 'modal': '🪟', 'empty': '📭', 'adaptive-icons': '🔣', 'scrollview': '📜', 'onboarding': '👋', 'flex': '↔️', 'card-grid': '🧩', 'card-scroll': '🗃️', 'scroll-arrow': '➡️', 'popout': '🪟', 'focus-trap': '⌨️', 'touch': '👆', 'breadcrumbs': '🧭', 'tooltip': '💡', 'details-sidebar': '📌', 'heatmap': '🌡️', 'bullet-chart': '🎯', 'period-comparison': '⚖️', 'timeline-annotations': '📍', 'fullscreen': '🔎', 'export': '📤', 'density-controls': '📏', 'tree-select': '🌳', 'saved-views': '💾', 'layout-editor': '🧱', 'page-header': '📰', 'widget-header': '🏷️', 'widget': '🧩'}


def render(p: dict) -> str:
    # scripts может быть пустым честно: у кнопки скрипта нет. Остальное — нет.
    missing = [k for k in REQUIRED if k not in p or (k not in ("scripts", "anatomy_html") and p[k] in ("", [], None))]
    if missing:
        raise SystemExit(f"{p.get('slug')}: пустые блоки {missing} — пустой блок не собирается, "
                         f"скажи словами, почему там пусто")
    # Свои скрипты лежат в js/, чужие — в vendor/: путь с косой чертой берётся
    # как есть. На первой сборке vendor/air-datepicker.js получил префикс js/,
    # и страница периода упала — ошибку поймал браузер, не генератор.
    scripts = "".join(f'<script src="{s if "/" in s else "js/" + s}{"?v=20261028-stable-size" if s in ("dk-map.js", "dk-calendar.js") else ""}" defer></script>\n' for s in p["scripts"])
    variants = "".join(
        f"<tr><td><code>{esc(c)}</code></td><td>{w}</td><td>{k}</td></tr>" for c, w, k in p["variants"])
    api = "".join(f"<tr><td><code>{esc(n)}</code></td><td>{t}</td><td>{d}</td></tr>" for n, t, d in p["api"])
    anatomy = "".join(f"<li><b>{b}</b> — {t}</li>" for b, t in p["anatomy"])
    related = "".join(f'<li><a href="{esc(h)}">{t}</a>{(" — " + d) if d else ""}</li>' for h, t, d in p["related"])
    files = " · ".join(f'<a href="{esc(f)}"><code>{esc(f)}</code></a>' for f in p["files"])
    live_script = p.get("live_script", "")
    policy = json.loads((ROOT/".ai/project/uiux-policy.json").read_text())
    guidance = ''.join('<li><a href="index.html#pattern-'+esc(row['id'])+'">'+esc(row['title'])+'</a></li>' for row in policy['patterns'] if p['slug'] in row['components'])
    guidance = '<details class="sc-related-rules"><summary>Правила сочетания</summary><ul class="sc-list">'+guidance+'</ul></details>' if guidance else ''

    sec = []
    for i, (sid, title, group) in enumerate(BLOCKS):
        body = {
            "zhivoy-primer": ((f'<p>{p["live_intro"]}</p>' if p.get("live_intro") else "") + '<div class="sc-playground"><div class="sc-playground__canvas">' + p["live"] + '</div><div class="sc-playground__footer"><a href="#kod">Код примера ↗</a></div></div>'),
            "kogda-ispolzovat": (
                '<div class="sc-cols"><div class="sc-note"><b>Когда использовать</b><ul class="sc-list">' + li(p["when_yes"]) +
                '</ul></div><div class="sc-note"><b>Когда выбрать другое</b><ul class="sc-list">' + li(p["when_no"]) +
                '</ul></div></div>' + guidance),
            "anatomiya": (('<div class="sc-anatomy">' + p['anatomy_html'] + '</div>' if p['anatomy_html'] else '') + '<ol class="sc-anatomy__list">' + anatomy + '</ol>'),
            "varianty-i-razmery": (
                f'<p>{p["sizes"]}</p><div class="dk-tablewrap"><table class="dk-table sc-api">'
                '<thead><tr><th style="width:30%">Класс или параметр</th><th>Что делает</th>'
                f'<th style="width:30%">Когда</th></tr></thead><tbody>{variants}</tbody></table></div>'),
            "sostoyaniya": p["states"],
            "kontent": ('<div class="sc-cols"><div class="sc-note sc-note--ok"><b>Понятно</b><ul class="sc-list">' +
                        li(p["content_ok"]) + '</ul></div><div class="sc-note sc-note--bad"><b>Вызывает вопросы</b>'
                        '<ul class="sc-list">' + li(p["content_bad"]) + '</ul></div></div>'),
            "dostupnost": '<ul class="sc-list sc-list--wide">' + li(p["a11y"]) + '</ul>',
            "tokeny": ('<p>Токены компонента из '
                       '<code>css/components.css</code> для текущей темы. '
                       '</p>'
                       f'<ul class="sc-tokens" data-tokens="{esc(",".join(p["tokens"]))}">'
                       '<li class="sc-tokens__wait">Загружаем токены…</li></ul>'),
            "kod": ((f'<p>{p["code_intro"]}</p>' if p.get("code_intro") else "") + f'<p class="sc-source">Исходники: {files}</p><pre class="sc-code"><code>{esc(p["code"])}</code></pre>'
                    '<h3>Параметры и методы</h3><div class="dk-tablewrap"><table class="dk-table sc-api"><thead><tr>'
                    '<th style="width:26%">Параметр</th><th style="width:22%">Тип</th><th>Что делает</th>'
                    f'</tr></thead><tbody>{api}</tbody></table></div>'),
            "svyazannoe": '<ul class="sc-list sc-list--wide">' + related + '</ul>',
        }[sid]
        grp = f' data-group="{group}"' if group else ""
        sec.append(f'  <section class="sc-sec" id="{sid}"{grp}>\n    <h2>{title}</h2>\n    {body}\n  </section>\n')

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
<link rel="stylesheet" href="css/components.css?v=20261028-detail-final">
<link rel="stylesheet" href="css/docs.css?v=20261029-equal-insets">
<script src="js/dk-util.js?v=20261028-stable-responsive"></script>
<script src="js/dk-icons.js?v=20261006-menu" defer></script>
{scripts}<script src="js/docs-index.js?v=20261026-editorial" defer></script>
<script src="js/docs.js?v=20261029-single-row" defer></script>
<link rel="stylesheet" href="css/glass.css?v=20261029-equal-insets">
</head>
<body class="dk-page dk-glass">

<header class="sc-bar">
  <a class="sc-brand" href="index.html">
    <span class="sc-brand__t">dashboard-kit</span>
  </a>
  <div class="sc-ctl">
    <div class="dk-seg dk-seg--icons" role="group" aria-label="Тема"><button type="button" data-theme-set="dark" aria-pressed="true" aria-label="Тёмная тема" title="Тёмная тема"><svg class="dk-i" aria-hidden="true"><use href="#ti-moon"/></svg></button><button type="button" data-theme-set="light" aria-pressed="false" aria-label="Светлая тема" title="Светлая тема"><svg class="dk-i" aria-hidden="true"><use href="#ti-sun"/></svg></button></div>
  </div>
</header>

<div class="sc-shell sc-shell--closed">
<nav hidden class="sc-nav" aria-label="Разделы страницы"></nav>

<div class="dk-wrap" id="top">

  <header class="sc-hero sc-hero--component">
    <div class="sc-article-tools"><p class="sc-hero__o">Компоненты · {esc(p["group"])}</p>
      <details class="sc-share"><summary>Поделиться <svg class="dk-i dk-i--sm" aria-hidden="true"><use href="#ti-chevron-down"/></svg></summary>
        <div class="sc-share__items">
          <button type="button" data-doc-action="link">Скопировать ссылку</button>
          <a href="component-{esc(p["slug"])}.md" target="_blank" rel="noopener">Открыть как Markdown ↗</a>
          <button type="button" data-doc-action="chatgpt">Открыть в ChatGPT ↗</button>
          <button type="button" data-doc-action="claude">Открыть в Claude ↗</button>
          <button type="button" data-doc-action="claude-code">Скопировать Claude Code команду</button>
          <button type="button" data-doc-action="codex">Скопировать Codex команду</button>
        </div>
      </details>
    </div><p class="sc-share-status" role="status"></p>
    <h1><span class="sc-doc-emoji" aria-hidden="true">{PAGE_EMOJI[p["slug"]]}</span>{esc(p["title"])}</h1>
    <p class="sc-hero__lead">{p["purpose"]}</p>
    <div class="sc-meta">
      <span class="sc-meta__i">Статус: {esc(p["status"])}</span>
      <a href="#zhivoy-primer">Пример</a><a href="#kogda-ispolzovat">Как выбрать</a><a href="#svyazannoe">С чем сочетать</a><a href="#kod">Код и API</a>
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
            additions = {
                "select": [("update({value,options}) / destroy()", "API", "Тихое обновление; cleanup меню, focusout, anchor и подписок. Старые set/clear/setOptions сохранены.")],
                "period": [("update({value}) / destroy()", "API", "Тихое восстановление периода. Старые set/clear сохранены; destroy освобождает календарь и подписки.")],
                "pager": [("update({total,page,size}) / destroy()", "API", "Тихое восстановление, page ограничивается количеством страниц. Старые goTo/setTotal сохранены.")],
                "table": [("update({selected}) / destroy()", "API", "Восстановление выбора по data-id; cleanup обработчиков/observer без удаления таблицы. Sort host связывает через onSort.")],
                "map": [("update({values,scope,view}) / destroy()", "API", "Обновление одним проходом; старые setValues/setScope/view сохранены.")],
                "calendar": [("update({events,view}) / destroy()", "API", "Совместим со старым setEvents/view/goTo. На narrow/coarse неделя — agenda со временем словами и кнопками 44px, на desktop/fine — часовая сетка.")],
                "chart": [("exportImage()", "Promise<Blob>", "PNG текущей отрисовки, отклоняет Promise без готового экземпляра.")],
            }
            p["api"] = list(p["api"]) + additions.get(p["slug"], [])
            pages.append(p)
    # Keep renamed components consistent in navigation, HTML and Markdown.
    renamed = {"page-header":"Заголовок страницы", "widget-header":"Заголовок виджета", "flex":"Строка и колонка", "card-scroll":"Прокручиваемая лента"}
    for page in pages:
        page["related"] = [(href, renamed.get(href.removeprefix("component-").removesuffix(".html"), label), description) for href, label, description in page["related"]]
    return pages


def build() -> dict[str, str]:
    """Имя файла → содержимое, включая указатель."""
    pages = load_pages()
    out = {f"component-{p['slug']}.html": render(p) for p in pages}
    for p in pages:
        text = '# ' + p['title'] + '\n\n' + p['purpose'] + '\n\n'
        for title, key in [('Когда использовать','when_yes'), ('Когда выбрать другое','when_no'), ('Контент: так','content_ok'), ('Контент: не так','content_bad'), ('Доступность','a11y')]:
            text += '## ' + title + '\n\n' + '\n'.join('- ' + re.sub('<[^>]+>', '', html.unescape(item)) for item in p[key]) + '\n\n'
        text += '## Пример\n\n' + p.get('live_intro', '') + '\n\n'
        text += '## Структура\n\n' + '\n'.join('- **' + name + '** — ' + re.sub('<[^>]+>', '', html.unescape(desc)) for name, desc in p['anatomy']) + '\n\n'
        text += '## Состояния\n\n' + re.sub(r'\s+', ' ', re.sub('<[^>]+>', ' ', html.unescape(p['states']))).strip() + '\n\n'
        text += '## Варианты\n\n' + '\n'.join('- `' + name + '` — ' + re.sub('<[^>]+>', '', html.unescape(desc + ' ' + when)) for name, desc, when in p['variants']) + '\n\n'
        text += '## Размеры\n\n' + re.sub('<[^>]+>', '', html.unescape(p['sizes'])) + '\n\n## Код\n\n```html\n' + p['code'] + '\n```\n\n## Параметры\n\n'
        text += '\n'.join('- `' + name + '` (' + typ + '): ' + re.sub('<[^>]+>', '', html.unescape(desc)) for name, typ, desc in p['api']) + '\n'
        text += '\n## С чем сочетать\n\n' + '\n'.join('- [' + label + '](' + href + ') — ' + desc for href, label, desc in p['related']) + '\n'
        out[f"component-{p['slug']}.md"] = "\n".join(line.rstrip() for line in text.splitlines()) + "\n"
    from docs_guide import render as render_guide
    out["index.html"] = render_guide(pages, render)
    index = [{"slug": p["slug"], "title": p["title"], "group": p["group"], "description": p["purpose"]} for p in pages]
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
