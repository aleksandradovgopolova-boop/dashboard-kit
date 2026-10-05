#!/usr/bin/env python3
"""Собирает урезанный vendor/echarts.min.js из списка vendor/echarts.modules.json.

    python3 tools/build-echarts.py

Зачем урезать: полный ECharts весит 1096 КБ, а кит рисует семь типов серий из
двадцати с лишним. Это вес на каждой странице с графиком или картой.

Зачем список отдельным файлом, а не прямо в скрипте: по нему же сверяет
tools/check.py (проверка ДВИЖОК). Урезанная сборка, из которой забыли модуль,
при сборке не падает: у пользователя график остаётся пустым или раскладывается
иначе, и в консоли об этом ни слова (замеры — в шапке проверки ДВИЖОК). Один список на сборку и на проверку —
единственный способ, чтобы они не разошлись, как однажды разошлись тема
графиков и токены.

ЧТО СКРИПТУ НУЖНО: node и npm, и сеть на время сборки — он ставит во временную
папку echarts той версии, что записана в списке, и сборщик esbuild. В сам кит
ничего не ставится и сеть киту не нужна: результат — один файл в vendor/,
как и раньше. Пересобирать после любой правки списка.

Перед заменой скрипт убеждается, что лежащий файл — это либо прошлая урезанная
сборка, либо полный dist/echarts.min.js той же версии байт в байт. Чужой файл
он не перезапишет: его происхождение потом не восстановить.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIST = ROOT / "vendor" / "echarts.modules.json"
OUT = ROOT / "vendor" / "echarts.min.js"

# Версия сборщика закреплена: другой сборщик — другой файл, и тогда по
# разнице в файле уже не понять, поменялся ли список или только инструмент.
ESBUILD = "0.25.0"

# Метка в первой строке собранного файла. По ней скрипт узнаёт свою прошлую
# сборку и не путает её с чужим файлом.
MARK = "dashboard-kit: урезанная сборка ECharts"

# Имя в реестре движка → имя, под которым модуль импортируется. Почти всегда
# это одно и то же слово с большой буквы, но не всегда: оси xAxis и yAxis
# живут внутри модуля сетки, оси полярной системы — внутри Polar.
COMPONENT_IMPORT = {
    "xAxis": "GridComponent", "yAxis": "GridComponent",
    "angleAxis": "PolarComponent", "radiusAxis": "PolarComponent",
    "parallelAxis": "ParallelComponent", "singleAxis": "SingleAxisComponent",
}
# Модули без записи в реестре движка. Имена — те, что стоят в списке и в
# tools/check.py (ECHARTS_FEATURES), там же сказано, какой ключ настроек их
# требует.
FEATURE_IMPORT = {
    "legacyGridContainLabel": ("features", "LegacyGridContainLabel"),
    "labelLayout": ("features", "LabelLayout"),
    "universalTransition": ("features", "UniversalTransition"),
    "axisBreak": ("features", "AxisBreak"),
    "scatterJitter": ("features", "ScatterJitter"),
    "aria": ("components", "AriaComponent"),
}
RENDERER_IMPORT = {"canvas": "CanvasRenderer", "svg": "SVGRenderer"}


def cap(s: str) -> str:
    return s[0].upper() + s[1:]


def entry(want: dict) -> str:
    charts = sorted({cap(s) + "Chart" for s in want["series"]})
    comps = sorted({COMPONENT_IMPORT.get(c, cap(c) + "Component") for c in want["components"]})
    feats: dict[str, set[str]] = {"features": set(), "components": set()}
    for f in want.get("features", []):
        where, name = FEATURE_IMPORT[f]
        feats[where].add(name)
    comps = sorted(set(comps) | feats["components"])
    renderer = RENDERER_IMPORT[want["renderer"]]
    lines = [
        "import * as echarts from 'echarts/core';",
        f"import {{ {', '.join(charts)} }} from 'echarts/charts';",
        f"import {{ {', '.join(comps)} }} from 'echarts/components';",
        f"import {{ {renderer} }} from 'echarts/renderers';",
    ]
    used = charts + comps + [renderer]
    if feats["features"]:
        lines.append(f"import {{ {', '.join(sorted(feats['features']))} }} from 'echarts/features';")
        used += sorted(feats["features"])
    lines.append(f"echarts.use([{', '.join(used)}]);")
    lines.append("export * from 'echarts/core';")
    return "\n".join(lines) + "\n"


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(cmd: list[str], cwd: Path) -> None:
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"не удалось: {' '.join(cmd)}\n{r.stderr.strip()}")


def main() -> int:
    for tool in ("node", "npm"):
        if not shutil.which(tool):
            print(f"нужен {tool}", file=sys.stderr)
            return 1
    want = json.loads(LIST.read_text("utf-8"))
    version = want["echarts"]

    with tempfile.TemporaryDirectory(prefix="dk-echarts-") as tmp:
        work = Path(tmp)
        (work / "package.json").write_text('{"private": true}')
        run(["npm", "install", "--no-audit", "--no-fund", "--ignore-scripts",
             f"echarts@{version}", f"esbuild@{ESBUILD}"], work)
        # --ignore-scripts снимает и установку двоичного файла esbuild; ставим
        # его отдельным шагом, явно, а не чужим скриптом установки.
        run(["node", "node_modules/esbuild/install.js"], work)

        full = work / "node_modules" / "echarts" / "dist" / "echarts.min.js"
        if OUT.exists():
            head = OUT.read_text("utf-8", errors="replace")[:400]
            if MARK not in head and sha(OUT) != sha(full):
                print(f"{OUT.relative_to(ROOT)} — не полный ECharts {version} и не "
                      f"прошлая урезанная сборка. Перезаписывать не буду: откуда он, "
                      f"потом не выяснить. Убери файл руками, если он не нужен.",
                      file=sys.stderr)
                return 1

        (work / "entry.js").write_text(entry(want))
        license_head = full.read_text("utf-8").split("*/", 1)[0] + "*/"
        # Список в отметке — не украшение: по нему tools/check.py сверяет
        # модули без записи в реестре, о которых движок сам не расскажет.
        stamp = json.dumps({k: sorted(want.get(k, [])) for k in
                            ("series", "components", "features")},
                           ensure_ascii=False, separators=(",", ":"))
        banner = (f"/* {MARK} {version} · список: {stamp} · "
                  f"esbuild {ESBUILD} · python3 tools/build-echarts.py */\n"
                  + license_head)
        # Формат iife с глобальным именем echarts — как у полного файла: кит
        # зовёт window.echarts. Хвост отдаёт тот же объект в node: по нему
        # tools/check.py спрашивает движок, что в нём зарегистрировано.
        # NODE_ENV=production — как в полном dist: без отладочных проверок и
        # их веса. Цена: вместе с ними уходят и предупреждения вроде
        # «containLabel без LegacyGridContainLabel» — ровно поэтому существует
        # проверка ДВИЖОК.
        run(["node_modules/.bin/esbuild", "entry.js", "--bundle", "--minify",
             "--format=iife", "--global-name=echarts", "--target=es2017",
             "--define:process.env.NODE_ENV=\"production\"",
             "--legal-comments=none",
             "--banner:js=" + banner,
             "--footer:js=if(typeof module==='object'&&module.exports)module.exports=echarts;",
             "--outfile=out.js"], work)

        out = work / "out.js"
        before = OUT.stat().st_size if OUT.exists() else 0
        shutil.copyfile(out, OUT)

    after = OUT.stat().st_size
    print(f"собрано: {OUT.relative_to(ROOT)} — {after // 1024} КБ"
          + (f" (было {before // 1024} КБ)" if before else ""))
    print("дальше: python3 tools/check.py и проверка страниц в браузере")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
