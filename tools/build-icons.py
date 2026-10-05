#!/usr/bin/env python3
"""Собирает js/dk-icons.js из иконок Tabler.

Зачем скрипт, а не подключение целой библиотеки: в дашборде нужно два десятка
иконок, а в Tabler их пять тысяч. Тянуть всё ради двадцати — лишний вес и
лишняя внешняя зависимость на проде. Здесь мы забираем ровно нужные и кладём
их в репозиторий: дальше дашборд работает офлайн и без сборки.

Добавить иконку: вписать её имя в ICONS и запустить
    python3 tools/build-icons.py

Имена — как на https://tabler.io/icons (вариант outline).
Лицензия Tabler — MIT.
"""

from pathlib import Path
import re
import sys
import urllib.request

CDN = "https://cdn.jsdelivr.net/npm/@tabler/icons@latest/icons/outline/{}.svg"
OUT = Path(__file__).resolve().parent.parent / "js" / "dk-icons.js"

ICONS = [
    # навигация и управление
    "search", "settings", "filter", "x", "check", "minus", "plus",
    "chevron-down", "chevron-right", "chevron-left",
    "dots-vertical", "refresh", "download", "external-link",
    # виды дашборда
    "map", "layout-grid", "table",
    # смысл и состояния
    "arrow-up", "arrow-down", "arrow-up-right",
    "alert-triangle", "info-circle", "bolt",
    # тема
    "sun", "moon", "file-text",
    # ошибки и возврат
    "home", "arrow-left", "alert-circle", "plug-connected-x", "lock",
    # статусы и люди
    "user", "circle-check", "circle-x", "clock",
    # период
    "calendar",
]

# Служебный прозрачный прямоугольник в начале каждой иконки Tabler — распорка
# для редакторов, в вебе не нужна.
SPACER = re.compile(r'<path\s+stroke="none"[^>]*?fill="none"\s*/>')


def fetch(name: str) -> str:
    with urllib.request.urlopen(CDN.format(name), timeout=20) as r:
        if r.status != 200:
            raise RuntimeError(f"{name}: HTTP {r.status}")
        return r.read().decode("utf-8")


def inner(svg: str, name: str) -> str:
    body = svg.split(">", 1)[1].rsplit("</svg>", 1)[0]
    body = SPACER.sub("", body)
    body = re.sub(r"\s+", " ", body).strip()
    if not body:
        raise RuntimeError(f"{name}: пустая иконка")
    return body


def main() -> int:
    symbols = []
    for name in ICONS:
        try:
            symbols.append(
                f'<symbol id="ti-{name}" viewBox="0 0 24 24">{inner(fetch(name), name)}</symbol>'
            )
        except Exception as e:                      # noqa: BLE001
            print(f"не удалось забрать {name}: {e}", file=sys.stderr)
            return 1
        print(f"  {name}")

    sprite = "".join(symbols)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(TEMPLATE.replace("__SPRITE__", sprite).replace("__N__", str(len(ICONS))), "utf-8")
    print(f"\n{len(ICONS)} иконок → {OUT.relative_to(OUT.parent.parent)}")
    return 0


TEMPLATE = '''/* ============================================================================
   dashboard-kit · dk-icons.js   —   СОБРАН АВТОМАТИЧЕСКИ, НЕ ПРАВИТЬ РУКАМИ
   Источник: Tabler Icons (MIT), https://tabler.io/icons — вариант outline.
   Пересобрать: python3 tools/build-icons.py
   Иконок в наборе: __N__

   Спрайт встроен в файл, поэтому иконки работают офлайн и при открытии
   страницы двойным кликом — внешние <use href="file.svg#id"> в этом случае
   браузеры блокируют.

   Как пользоваться:
       <svg class="dk-i"><use href="#ti-search"/></svg>
   или из JavaScript узлом — так, как кит велит собирать разметку в скриптах:
       button.prepend(dkIcon.el('search', 'dk-i--sm'));
   dkIcon(name) без .el отдаёт СТРОКУ разметки — для склейки внутри уже
   экранированного шаблона. Два исполнителя проверочных задач скилла из шести
   приняли строку за узел (29.09), отсюда .el.

   Цвет иконка берёт от текста (currentColor), размер — от font-size.
   Декоративной иконке ничего не нужно: она уже скрыта от скринридера.
   Если иконка несёт смысл сама по себе (кнопка без подписи) — подпись
   ставится на кнопку через aria-label.
   ============================================================================ */

(function () {
  var SPRITE = '__SPRITE__';

  function mount() {
    if (document.getElementById('dk-icon-sprite')) return;
    var host = document.createElement('div');
    host.id = 'dk-icon-sprite';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    host.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' + SPRITE + '</svg>';
    document.body.insertBefore(host, document.body.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  /** Разметка иконки. name — без префикса ti-, например 'search'. */
  window.dkIcon = function (name, className) {
    return '<svg class="dk-i' + (className ? ' ' + className : '') +
           '" aria-hidden="true"><use href="#ti-' + name + '"/></svg>';
  };

  /** Иконка узлом: <svg class="dk-i …"><use href="#ti-…"/></svg>. */
  window.dkIcon.el = function (name, className) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'dk-i' + (className ? ' ' + className : ''));
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(NS, 'use');
    use.setAttribute('href', '#ti-' + name);
    svg.appendChild(use);
    return svg;
  };

  /** Имена всех иконок набора — удобно для витрины и для проверок. */
  window.dkIconNames = SPRITE.match(/id="ti-([a-z0-9-]+)"/g).map(function (s) {
    return s.slice(7, -1);
  });
})();
'''


if __name__ == "__main__":
    raise SystemExit(main())
