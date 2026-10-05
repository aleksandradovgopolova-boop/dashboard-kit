#!/usr/bin/env python3
"""Собирает js/dk-chart-theme.js — тему графиков из токенов дизайн-системы.

    python3 tools/build-chart-theme.py

Зачем скрипт, а не тема, написанная руками: тема, написанная руками, через
месяц разойдётся с системой. Цвет серии поменяли в токенах — графики остались
прежними, и никто этого не заметил, потому что они лежат в другом файле.

Здесь тема ВЫВОДИТСЯ из токенов. Поменялся токен — пересобрал, и все графики
во всех дашбордах поменялись вместе с ним. Разойтись они физически не могут.

Пересобирать после любой правки цвета, шрифта или сетки в токенах.
"""

from __future__ import annotations

import json
import sys

import css_tokens as T

OUT = T.ROOT / "js" / "dk-chart-theme.js"

# Сколько секторов выдерживает круговая диаграмма. Канон: дальше читатель
# перестаёт сравнивать доли и начинает гадать. Совпадает с числом слотов серий.
PIE_MAX_SLICES = 6


def px(value: str) -> int:
    """Число из значения вида 14px."""
    return int(str(value).strip().rstrip("px"))


def build(table: dict[str, str], mode: str) -> dict:
    def color(name: str) -> str:
        v = T.resolve(name, table)
        if not v:
            raise SystemExit(f"не удалось разрешить токен {name} для темы {mode}")
        return v

    series = [color(f"--series-{i}") for i in range(1, 7)]
    ink, ink2, ink3 = color("--ink"), color("--ink-2"), color("--ink-3")
    surface = color("--surface")

    grid = T.rgba(ink, 0.07 if mode == "dark" else 0.08)
    axis = T.rgba(ink, 0.16 if mode == "dark" else 0.20)

    # Стек гарнитур передаётся целиком, как в CSS. Обрезать кавычки нельзя:
    # холст не примет строку с непарной кавычкой, молча оставит свой шрифт —
    # и ширины подписей начнут считаться по одному шрифту, а рисоваться другим.
    font = table.get("--face-sans", "sans-serif").strip()
    size_base = px(table.get("--size-12", "12px"))

    label = {"color": ink2, "fontFamily": font, "fontSize": size_base}
    faint = {"color": ink3, "fontFamily": font, "fontSize": size_base}

    axis_common = {
        # Ось — опора, а не содержание: она не должна спорить с данными.
        "axisLine": {"show": True, "lineStyle": {"color": axis}},
        "axisTick": {"show": False},
        "axisLabel": label,
        # Сетка тише самих данных: она опора для глаза, а не содержание.
        # Была в полную силу токена и на тёмной доске спорила со столбцами.
        "splitLine": {"show": True, "lineStyle": {"color": grid, "width": 1, "opacity": 0.55}},
        "splitArea": {"show": False},
    }

    category_axis = dict(axis_common)
    category_axis["splitLine"] = {"show": False}   # у категорий сетка не нужна

    return {
        "color": series,
        "backgroundColor": "transparent",
        "textStyle": {"fontFamily": font, "fontSize": size_base, "color": ink2},

        "title": {
            "textStyle": {"color": ink, "fontFamily": font,
                          "fontSize": px(table.get("--size-16", "16px")), "fontWeight": 600},
            "subtextStyle": faint,
        },

        # Легенда обязательна от двух серий: опознавать серию только по цвету
        # нельзя — это отрезает тех, кто цвета не различает.
        "legend": {"textStyle": label, "icon": "roundRect",
                   "itemWidth": 10, "itemHeight": 10, "itemGap": 16},

        "tooltip": {
            "backgroundColor": surface,
            "borderWidth": 0,
            # Всплывающему слою воздуха нужно больше, чем блоку на странице:
            # он висит сам по себе, и его края — это всё, что у него есть.
            "padding": [10, 14],
            "textStyle": {"color": ink, "fontFamily": font,
                          "fontSize": px(table.get("--size-14", "14px"))},
            "axisPointer": {"lineStyle": {"color": axis}, "crossStyle": {"color": axis}},
        },

        "grid": {"left": 8, "right": 12, "top": 24, "bottom": 8, "containLabel": True},

        "categoryAxis": category_axis,
        "valueAxis": axis_common,
        "logAxis": axis_common,
        "timeAxis": axis_common,

        # Тонкие штрихи: линия 2px, точка от 8px — мельче не попасть курсором.
        "line": {
            "lineStyle": {"width": 2},
            "symbolSize": 8,
            "symbol": "circle",
            "smooth": False,          # сглаживание врёт о промежуточных значениях
        },

        "bar": {
            # ВЕРХ СТОЛБЦА НЕ СКРУГЛЯЕТСЯ. Это не вкус, а то же правило, что уже
            # записано в ките у полосы доступности: «прямой угол, а не
            # скругление».
            #
            # У столбца длина и есть значение. Скруглённая шапка отрезает часть
            # этой длины ровно в той точке, по которой значение читают, — и чем
            # короче столбец, тем больше доля отрезанного: при радиусе 6 и
            # высоте 60 это десятая часть, а на совсем коротких столбец
            # превращается в лозенг, у которого верха просто нет.
            #
            # Скругление сюда поставил я сам, ради «посовременнее», и это была
            # плохая сделка: кит меняет точность на украшение ровно там, где
            # запрещает это делать всем остальным.
            "itemStyle": {"borderRadius": 0},
            # Было 40 — столбец в сутках из двадцати четырёх часов при этом
            # выходил нитью в шесть пикселей: предел ширины не мешал, мешало
            # то, что ширину диктует число категорий. Ограничение сверху
            # осталось, но добавлен пол: тоньше 10 пикселей столбец перестаёт
            # читаться столбцом и превращается в штрих.
            "barMinWidth": 10,
            "barMaxWidth": 28,
        },

        "pie": {
            "itemStyle": {
                # Зазор цветом поверхности: сектора не слипаются в одно пятно.
                "borderColor": surface,
                "borderWidth": 2,
            },
            "label": {"color": ink2, "fontFamily": font, "fontSize": size_base},
            "labelLine": {"lineStyle": {"color": axis}},
        },

        "radar": {
            "axisLine": {"lineStyle": {"color": grid}},
            "splitLine": {"lineStyle": {"color": grid}},
            "splitArea": {"show": False},
            "axisName": {"color": ink3, "fontFamily": font, "fontSize": size_base},
        },

        "sankey": {
            "itemStyle": {"borderWidth": 0},
            "lineStyle": {"color": "gradient", "opacity": 0.35},
            "label": {"color": ink2, "fontFamily": font, "fontSize": size_base},
        },

        "visualMap": {"textStyle": faint},
        "dataZoom": {"textStyle": faint},
    }


TEMPLATE = '''/* ============================================================================
   dashboard-kit · dk-chart-theme.js  —  СОБРАН АВТОМАТИЧЕСКИ, НЕ ПРАВИТЬ РУКАМИ
   Пересобрать: python3 tools/build-chart-theme.py

   Две темы графиков, выведенные из токенов дизайн-системы. Цвета серий, шрифт,
   сетка и оси здесь не выбраны заново — они взяты из тех же токенов, которыми
   покрашен весь остальной интерфейс. Поэтому график не может разойтись с
   дашбордом, в котором он лежит.

   Подключать ПОСЛЕ echarts и ДО dk-charts.js.
   ============================================================================ */

(function () {
  if (typeof echarts === 'undefined') {
    console.error('dk-chart-theme: сначала нужно подключить echarts');
    return;
  }

  var THEMES = __THEMES__;

  echarts.registerTheme('dk-dark', THEMES.dark);
  echarts.registerTheme('dk-light', THEMES.light);

  /* Предел числа секторов круговой диаграммы. Канон: дальше читатель перестаёт
     сравнивать доли и начинает гадать. Лишнее сворачивается в «Прочее». */
  window.DK_PIE_MAX_SLICES = __PIE_MAX__;

  /* Палитра серий отдельно — нужна там, где цвет назначается вручную:
     точка в легенде, метка на карте, кружок рядом со значением. */
  window.DK_SERIES = { dark: THEMES.dark.color, light: THEMES.light.color };
})();
'''


def main() -> int:
    primitives = T.read(T.PRIMITIVES)
    semantic = T.read(T.SEMANTIC)
    tables = T.theme_tables(primitives, semantic)

    themes = {mode: build(table, mode) for mode, table in tables.items()}
    body = json.dumps(themes, ensure_ascii=False, indent=2)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        TEMPLATE.replace("__THEMES__", body).replace("__PIE_MAX__", str(PIE_MAX_SLICES)),
        "utf-8")

    for mode in ("dark", "light"):
        print(f"  {mode:5} серии: {' '.join(themes[mode]['color'])}")
    print(f"\n{OUT.relative_to(T.ROOT)} собран")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
