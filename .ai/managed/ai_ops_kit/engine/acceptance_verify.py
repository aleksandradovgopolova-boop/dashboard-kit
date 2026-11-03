#!/usr/bin/env python3
"""Сверка критериев приёмки с РЕЗУЛЬТАТОМ (B2-14, живой прогон BNBM 14.08.2026).

ПОВОД — ЗАМЕР. Прогон на реальном продукте отдал владельцу draft PR со `sha_verified: True` и
`overall_status: delivered`, тогда как критерий приёмки требовал дословно «в README нет строк с
`public/media`»: строка осталась, только описание стало расплывчатым. `spec-coverage` при этом
сообщал `acceptance_criteria: complete` — и это не его ошибка: `complete` там означает «раздел
заполнен», а не «критерий выполнен». Разница в одном слове, а цена — единственный ложный green
квалификации, и он на последнем шаге, там, где работа уходит человеку.

ЧТО ДЕЛАЕТ ЭТОТ МОДУЛЬ. Независимый read-only ревьюер (writer ≠ judge) читает дифф ревизии против
КАЖДОГО объявленного критерия и выносит вердикт met/unmet/undetermined с ЦИТАТОЙ как основанием.
Цитата не принимается на слово: код ищет её в изменении и в названном файле.

ЧЕГО КОД ПРОВЕРИТЬ НЕ МОЖЕТ — И ЭТО ГЛАВНЫЙ УРОК ЧЕТЫРЁХ КРУГОВ РЕВЬЮ (PR #118).
Первые три круга пытались сделать заземление цитаты доказательством ВЫПОЛНЕНИЯ критерия. Каждый
круг находил в нём один и тот же класс дефекта, и каждая правка меняла одну ошибку на обратную:
проверка либо принимала то, чего не должна (цитата из удалённой строки, из сообщения коммита, любая
строка, которой в файле нет), либо отвергала честный вердикт (критерий об отсутствии становился
недоказуемым, и сверка объявлялась неполной на выполненной работе). Это признак неверной опоры, а
не недостающих частных случаев: поиск подстроки решает вопрос «есть ли такой текст», а критерий
приёмки — вопрос смысла, и подменять второе первым нельзя.

ПОЭТОМУ ЗАЗЕМЛЕНИЕ ОТВЕЧАЕТ РОВНО НА ОДИН ВОПРОС: настоящая ли цитата. Найдена в изменении или в
названном файле — вердикт опирается на реальный текст; не найдена НИГДЕ — цитата выдумана, и такой
вердикт не принимается ни в какую сторону. Сила основания при этом НАЗЫВАЕТСЯ по каждому критерию
(`basis`), а не выдаётся за доказательство:
  `absence-proof` — самое сильное: фрагмент удалён ИЗ ЭТОГО файла и в файле его больше нет;
  `post-state` / `file` — цитата есть в результате правки;
  `removed-line` — цитата описывает состояние ДО правки: вердикт остаётся суждением судьи;
  `judge-only` — машинного подтверждения нет вовсе.
Отчёт и вывод прогона называют, сколько вердиктов подтверждено цитатой, а сколько держится только
на слове судьи. Это честнее и полезнее, чем и «проверено», и «не сверялись»: владелец видит, где
именно смотреть самому. Слабое основание НЕ обнуляет сверку — иначе механизм ломался бы на самом
частом классе задач (удаление), а сломанную проверку выключают.

ТРИ РАЗНЫХ ФАКТА, И ИХ НЕЛЬЗЯ СМЕШИВАТЬ:
  `verified`        — сверка СОСТОЯЛАСЬ: вердикт есть по каждому критерию и ни одна цитата не выдумана;
  `met_all`         — критерии ВЫПОЛНЕНЫ (по вердиктам судьи);
  `quote_verified`  — сколько вердиктов опираются на подтверждённую цитату.
Ложный green B2-14 родился из смешения первых двух: «доставлено» прочиталось как «выполнено».
Поэтому `verified=True` при `met_all=False` — нормальный и полезный исход, а `met_all=True` при
`quote_verified=0` обязано быть ВИДНО.

ЧЕГО МОДУЛЬ НЕ ДЕЛАЕТ: не блокирует `ready`. Порядок обязателен — сначала advisory и полевые
доказательства качества вердиктов, только потом блокировка (иначе гейт остановит все прогоны на
вердикте, который никто не мерил, и его научатся обходить). Решение о блокировке — отдельное.
"""
from __future__ import annotations

import re
import sys
import textwrap
from pathlib import Path

from ai_ops_kit.engine import tool_loop
from ai_ops_kit.engine import tool_broker
from ai_ops_kit.engine import reviewer_prompt



MAX_READS = 8


_MAX_SOURCE_BYTES = 2_000_000




_BULLET = re.compile(r"^\s*(?:[-*•][ \t]+(?:\[[ xX]\][ \t]*)?|\d+[.)][ \t]+)(.+)$")
# ВТОРОЕ РЕВЬЮ PR #118: требование пробела породило свой класс потерь — при смешанных маркерах
# (`- один`, `*два`) строка без пробела не была пунктом, а непустой список отключал прозаический
# разбор, и критерий ИСЧЕЗАЛ. Поэтому маркер без пробела — тоже пункт (автор явно размечал список),
# а разбор стал построчным автоматом: потерять пункт он не может по построению.
_TIGHT_BULLET = re.compile(r"^\s*([-*•])(?![-*•])(?=\S)(.+)$")




_NO_NEWLINE = "\\ No newline at end of file"



_RULE = re.compile(r"^\s*([-*_])(?:[ \t]*\1){2,}[ \t]*$")
_HEADING = re.compile(r"^\s*(?:#{1,6}\s|\*\*[^*]+\*\*\s*$|__[^_]+__\s*$)")


_NOT_PROVIDED = {"missing", "declined", "not_applicable"}
# `needs_human` — НЕ отказ от критериев, а долг: они ещё будут. Молчать о нём нельзя (четвёртое
# ревью: `spec_levels.assess` на нём не блокирует и списка `needs_human` не читает никто, так что
# тишина здесь дала бы ровно связку «spec-coverage ready + прогон молчит»). Но и «не прочитано,
# проверь вручную» — неверный диагноз. Поэтому у состояния своя формулировка.
_AWAITING_HUMAN = "needs_human"


def _bullet_body(line) -> str | None:
    """Текст пункта списка, либо None — строка пунктом не является.

    Маркер без пробела считается пунктом (смешанное форматирование не должно терять критерии), но
    `*` в этой роли принимается только если в остатке строки нет второй `*`: иначе `*AC-1*: …` и
    `**AC-1**: …` теряли звёздочку, и вердикт выносился по искажённой формулировке (третье и
    четвёртое ревью PR #118 — одна и та же порча, два разных начертания).
    """
    m = _BULLET.match(line)
    if m:
        return m.group(1).strip()
    m = _TIGHT_BULLET.match(line)
    if not m:
        return None
    marker, body = m.group(1), m.group(2)
    if marker == "*" and "*" in body:
        return None                      # это выделение, а не список
    return body.strip()


def parse_criteria(text) -> list:
    """Текст раздела `acceptance_criteria` -> список критериев [{'id': 'AC-1', 'text': ...}].

    Разбор намеренно тупой и детерминированный — ПОСТРОЧНЫЙ АВТОМАТ, а не два прохода (второе
    ревью PR #118). Правила: пункт списка (`- `, `*`, `1.`, чекбокс, маркер и без пробела) начинает
    критерий; неразмеченная строка ВНУТРИ списка продолжает предыдущий пункт (`- |` в YAML —
    многострочный критерий, и его хвост нельзя терять); вне списка непустая строка сама и есть
    критерий; разделитель и заголовок пропускаются.

    Почему автомат: любая схема «сначала найдём пункты, если не нашли — возьмём прозу» ТЕРЯЕТ
    критерии на смешанном форматировании — один найденный пункт выключал прозаический разбор, и
    остальные строки исчезали. Потерянный критерий — это «выполнен по умолчанию», ровно тот класс
    молчания, против которого написан весь модуль.
    """
    raw = (text or "")
    if not isinstance(raw, str):
        raw = str(raw)
    
    
    
    
    raw = textwrap.dedent(raw)
    items, in_list_item = [], False
    for ln in raw.splitlines():
        s = ln.strip()
        if not s or _RULE.match(s) or _HEADING.match(s):
            in_list_item = False          # декор и пустая строка закрывают пункт
            continue
        body = _bullet_body(ln)
        if body is not None:
            if body:
                items.append(body)
                in_list_item = True
            continue
        if in_list_item and ln[:1].isspace():
            
            
            
            
            
            items[-1] = f"{items[-1]} {s}"
            continue
        if len(s) >= 3 and not s.endswith(":"):
            items.append(s)                    # проза: строка и есть критерий
    return [{"id": f"AC-{i}", "text": t} for i, t in enumerate(items, start=1)]


def _section_text(node) -> tuple:
    """Раздел спеки -> (текст, проблема). Форма раздела в ките НЕ одна (ревью PR #118).

    `spec_levels.provided_from_artifacts` принимает раздел и мэппингом (`{status, content}`), и
    ПРОСТОЙ СТРОКОЙ; список пунктов и мэппинг `id -> критерий` в YAML тоже естественны. Прежний
    разбор знал только `{content}`: на строке `.get` бросал `AttributeError`, тот гасился, и функция
    возвращала «критериев нет» — при том что `spec-coverage` для того же файла говорил `complete`.
    Отчёт молчал ровно в том случае, ради которого модуль написан.

    ВТОРОЕ РЕВЬЮ: нераспознанная форма теперь НАЗЫВАЕТСЯ проблемой, а не возвращает «» — иначе
    молчание возвращалось через любую форму, которую разбор не предусмотрел. Единственное молчание,
    оставленное честным, — раздел, не заполненный НАМЕРЕННО (`missing`/`declined`/`not_applicable`).
    """
    if node is None:
        return "", None
    if isinstance(node, str):
        return node.strip(), None
    if isinstance(node, (list, tuple)):
        parts = []
        for x in node:
            t, problem = _section_text(x)
            if problem:
                return "", problem
            
            
            for i, ln in enumerate([l for l in str(t).splitlines() if l.strip()]):
                parts.append(("- " if i == 0 else "  ") + ln.strip())
        return "\n".join(parts), None
    if isinstance(node, dict):
        
        
        
        
        
        
        
        head = []
        for key in ("content", "text", "value"):
            text, problem = _section_text(node.get(key))
            if problem:
                return "", problem
            if text:
                head.append(text)   # ВСЕ три, а не первый непустой: иначе `text` рядом с `content`
                                    
        if head:
            
            
            
            
            
            
            return "\n".join(head), None
        parts, skipped = [], []
        for k, v in node.items():
            if str(k).strip().lower() in ("status", "note", "owner", "updated_at",
                                          "content", "text", "value"):
                continue      # служебные поля и уже проверенные выше пустые content/text/value
            t, problem = _section_text(v)
            if problem:
                return "", problem
            if t:
                
                
                lines = [l.strip() for l in str(t).splitlines() if l.strip()]
                parts.append(f"- {k}: {lines[0]}")
                parts += [f"  {l}" for l in lines[1:]]
            else:
                skipped.append(str(k))
        status = str(node.get("status") or "").strip().lower()
        
        
        
        if not parts and status in _NOT_PROVIDED:
            return "", None
        if skipped:
            
            
            return "", (f"в разделе есть ключи без читаемого текста: {', '.join(sorted(skipped))} — "
                        f"часть критериев была бы потеряна")
        if parts:
            return "\n".join(parts), None
        if status == _AWAITING_HUMAN:
            return "", ("раздел критериев ждёт человека (status: needs_human) — критериев ещё нет, "
                        "сверять нечего, и это НЕ проверено")
        if status:
            return "", (f"раздел объявлен '{status}', но содержимого нет "
                        f"(ключи: {', '.join(sorted(map(str, node)))})")
        return "", (f"раздел — мэппинг без content/text/value и без текстовых значений "
                    f"(ключи: {', '.join(sorted(map(str, node)))})")
    return str(node).strip(), None


def criteria_from_spec(child_root, wid) -> tuple:
    """(текст раздела, критерии, проблема) из features/<wid>/spec.yaml.

    ТРИ ИСХОДА, И ТРЕТИЙ НЕ РАВЕН ВТОРОМУ (ревью PR #118): спеки нет («», [], None) — сверять
    нечего; раздел разобран (текст, пункты, None); спека ЕСТЬ, но её не удалось прочитать или
    разобрать («», [], причина) — это «не знаю», и вызывающий обязан сказать «не сверялись» с
    причиной, а не промолчать. Прежняя двойка исходов делала нечитаемую спеку неотличимой от
    отсутствия критериев — и вывод прогона не печатал ничего.
    """
    try:
        import yaml as _yaml
        from ai_ops_kit.gates import spec_levels as _sl
        sp = _sl._spec_path(Path(child_root), wid)
        if not sp.is_file():
            return "", [], None
        doc = _yaml.safe_load(sp.read_text(encoding="utf-8")) or {}
        sections = doc.get("sections")
        if sections is not None and not isinstance(sections, dict):
            return "", [], f"sections в spec.yaml имеет форму {type(sections).__name__}, ожидался мэппинг"
        text, problem = _section_text((sections or {}).get("acceptance_criteria"))
        if problem:
            return "", [], problem
        return text, parse_criteria(text), None
    except Exception as e:  # noqa: BLE001 — спека есть, но не прочитана: fail-closed С ПРИЧИНОЙ.
        return "", [], f"spec.yaml не разобран ({type(e).__name__}: {e})"[:200]


def _norm(s) -> str:
    """Нормализовать для сравнения: свернуть пробелы, снять регистр.

    Цитата из диффа приходит без ведущего `+`/`-` и с другим отступом; сравнение «как есть»
    краснело бы на форматировании и объявляло выдумкой честную цитату.
    """
    return re.sub(r"\s+", " ", str(s or "")).strip().lower().lstrip("+-")


def _post_state(change_context) -> tuple:
    """Дифф -> (содержимое ПОСЛЕ правки, удалённые строки). Берётся ТОЛЬКО тело ханков.

    Заземление обязано смотреть на состояние ПОСЛЕ, а не «где-нибудь в диффе» (первое ревью
    PR #118): иначе критерий «в README нет строк с public/media» подтверждался цитатой из
    УДАЛЁННОЙ строки — `met`, `grounded=True`, «выполнены все».

    ВТОРОЕ РЕВЬЮ нашло вторую половину той же дыры, и её создала правка про диапазон base..head:
    в рендер контекста входят `--stat`, заголовки файлов и СПИСОК КОММИТОВ, а сообщение коммита —
    это `ai-ops: <текст задачи>`, то есть чаще всего пересказ самого критерия. Судья, цитирующий
    сообщение коммита писателя, получал «основание подтверждено». Поэтому содержимым считается
    только то, что лежит ВНУТРИ ханка (`@@ …`): ни статистика, ни журнал коммитов, ни проза
    вокруг диффа основанием быть не могут.
    """
    by_file = _diff_by_file(change_context)
    kept = "\n".join(v[0] for v in by_file.values() if v[0])
    removed = "\n".join(v[1] for v in by_file.values() if v[1])
    return kept, removed


def _diff_by_file(change_context) -> dict:
    """Дифф -> {путь: (содержимое ПОСЛЕ правки, удалённые строки)} — ПО ФАЙЛАМ.

    По файлам, а не общей кучей (четвёртое ревью PR #118): доказательство удаления обязано
    относиться к тому файлу, о котором говорит вердикт. Пока `removed` был объединением всех
    удалённых строк диффа, критерий об отсутствии в README закрывался строкой, удалённой из
    другого файла — обход не закрылся, а отодвинулся на шаг.
    """
    out, path, in_hunk = {}, None, False
    for ln in str(change_context or "").splitlines():
        if ln.startswith("diff --git"):
            in_hunk, path = False, None
            m = re.search(r" b/(\S+)$", ln)
            if m:
                path = m.group(1)
                out.setdefault(path, ([], []))
            continue
        if ln.startswith("@@"):
            in_hunk = path is not None
            continue
        if not in_hunk:
            
            
            
            
            
            
            if ln.startswith("+++ "):
                cand = ln[4:].strip()
                if cand.startswith("b/"):
                    cand = cand[2:]
                if cand and cand != "/dev/null":
                    path = cand
                    out.setdefault(path, ([], []))
            continue
        if ln == _NO_NEWLINE:
            continue                 # маркер git между вариантами последней строки — не содержимое
        if ln.startswith("-"):
            out[path][1].append(ln[1:])
        elif ln.startswith("+"):
            out[path][0].append(ln[1:])
        elif ln.startswith(" ") or not ln:
            out[path][0].append(ln[1:] if ln else ln)
        else:
            
            
            in_hunk = False
    return {p: ("\n".join(k), "\n".join(r)) for p, (k, r) in out.items()}


def _rel_path(path) -> str:
    """Путь к виду, в котором его печатает git: без `./`, без `a/`|`b/`, с прямыми слэшами.

    Пятое ревью PR #118: сравнение `source` судьи с путями диффа шло дословно, поэтому `./README.md`
    и `b/README.md` теряли `absence-proof` — и владелец получал причину «эта строка не удалялась в
    этом изменении», которая ПРОСТО НЕВЕРНА. Неверная причина хуже отсутствующей: она отправляет
    проверять не туда.
    """
    p = str(path or "").strip().replace("\\", "/")
    while p.startswith("./"):
        p = p[2:]
    if p.startswith(("a/", "b/")):
        p = p[2:]
    return p.strip("/")


def _read_source(work_root, source) -> tuple:
    """(содержимое файла | None, причина если не прочитан). Путь обязан лежать в рабочем дереве."""
    src = str(source or "").strip()
    if not src:
        return None, "source не назван"
    root = Path(work_root).resolve()
    
    
    
    candidates = [src] + ([_rel_path(src)] if _rel_path(src) != src else [])
    last = f"source не найден: {src}"
    for cand in candidates:
        try:
            p = (root / cand).resolve()
            if not p.is_relative_to(root):
                return None, f"source вне рабочего дерева: {src}"
            if not p.is_file():
                continue
            if p.stat().st_size > _MAX_SOURCE_BYTES:
                return None, f"source больше {_MAX_SOURCE_BYTES} Б — не читался"
            return p.read_text(encoding="utf-8", errors="replace"), None
        except OSError as e:
            last = f"source не прочитан ({type(e).__name__})"
    return None, last



STRONG_BASIS = {"absence-proof", "post-state", "file", "absence-refuted"}





FILE_CONFIRMED_BASES = {"file", "absence-proof", "absence-refuted"}


def _ground_quote(quote, change_context, work_root, source, evidence="present") -> tuple:
    """(basis | None, причина). `None` = цитата выдумана — вердикт не принимается ни в какую сторону.

    ДВА ВИДА ОСНОВАНИЯ (второе ревью PR #118). `present` — цитата ЕСТЬ в результате правки (тело
    ханка, затем названный файл). `absent` — цитаты В ФАЙЛЕ НЕТ, и это proof для критериев об
    отсутствии («в README больше нет строк с public/media»).

    Без второго вида механизм ломался на самом частом классе задач: при чистом удалении
    единственное дословное свидетельство — удалённая строка, а её заземление справедливо
    отвергает. Критерий оказывался `undetermined`, и прогон печатал «критерии НЕ сверялись» при
    том что всё выполнено. `absent` при этом СИЛЬНЕЕ прежнего: он ловит и замаскированное удаление
    (строка `public/media` осталась в другом виде) — проверкой файла, а не доверием к вердикту.
    """
    q = _norm(quote)
    if len(q) < 4:
        return None, "цитата короче 4 символов — подтвердить нечем"
    body, read_problem = _read_source(work_root, source)
    by_file = {_rel_path(p): v for p, v in _diff_by_file(change_context).items()}
    src = str(source or "").strip()
    own_post, own_removed = by_file.get(_rel_path(src), ("", ""))
    any_post = "\n".join(v[0] for v in by_file.values())
    any_removed = "\n".join(v[1] for v in by_file.values())

    if evidence == "absent":
        
        
        if body is not None and q not in _norm(body) and q in _norm(own_removed):
            return "absence-proof", None
        if body is not None and q in _norm(body):
            
            
            
            
            
            return "absence-refuted", (f"объявлено отсутствие, но цитата В ФАЙЛЕ ЕСТЬ ({src}) — "
                                       f"основание опровергнуто чтением")
        
        
        
        
        return "judge-only", (f"отсутствие не подтверждено машинно: {read_problem}" if body is None
                              else "отсутствие в файле подтверждено, но эта строка не удалялась "
                                   "в этом изменении — связь с правкой не доказана")

    
    
    
    
    
    
    if body is not None and q in _norm(body):
        return "file", None
    if q in _norm(own_post) or (not src and q in _norm(any_post)):
        return "post-state", None
    if q in _norm(own_removed) or q in _norm(any_removed):
        
        return "removed-line", ("основание — УДАЛЁННАЯ строка диффа: она описывает состояние ДО "
                                "правки, а не результат")
    if q in _norm(any_post):
        return "post-state-other-file", (f"цитата найдена в изменении, но не в {src or 'названном файле'}")
    
    return None, (f"цитата не найдена ни в изменении, ни в {src}" if src else
                  f"цитата не найдена в изменении, а source не назван ({read_problem})")


def make_acceptance_proposer(provider, criteria, revision=None):
    """Обернуть text-provider в судью сверки: он читает и выносит вердикт по каждому критерию.

    Независимость — та же, что у `tool_loop.make_reviewer_proposer`: отдельная роль, отдельный
    промпт и read-only Policy на уровне брокера (write/shell отклоняются физически, а не обещанием).
    """
    listing = "\n".join(f'  {c["id"]}: {c["text"]}' for c in criteria)

    def propose(context):
        
        
        
        
        task = (
            "Ты НЕЗАВИСИМЫЙ ревьюер приёмки (не автор изменения). Только чтение.\n"
            f"Проверяемая ревизия: {revision or 'HEAD'}.\n"
            "Задача: по КАЖДОМУ критерию приёмки сказать, выполнен ли он В ЭТОМ изменении, и "
            "привести ЦИТАТУ-основание.")
        output_format = (
            "На каждом шаге верни РОВНО ОДИН JSON:\n"
            '  {"op":"read","path":"..."}  — прочитать файл, чтобы удостовериться\n'
            '  {"kind":"acceptance-result","criteria":[{"id":"AC-1","status":"met|unmet|'
            'undetermined","evidence":"present|absent","quote":"дословный фрагмент",'
            '"source":"путь/до/файла","reason":"кратко"}]}  — ИТОГ\n'
            "Правила:\n"
            "* вердикт нужен по КАЖДОМУ критерию из списка, ни одного не пропускай;\n"
            "* status=met ТРЕБУЕТ дословной quote и source: цитата ПРОВЕРЯЕТСЯ КОДОМ — в теле "
            "диффа и в названном файле. Цитата, которой нет НИГДЕ, считается выдуманной и обнуляет "
            "вердикт по критерию (станет «не установлено»). Сообщения коммитов и статистика диффа "
            "основанием НЕ считаются — цитируй содержимое файлов;\n"
            "* КРИТЕРИЙ ОБ ОТСУТСТВИИ («в README нет строк с X») доказывается наоборот: "
            'evidence="absent", quote — фрагмент, которого быть НЕ должно (например "public/media"), '
            "source — файл, где его не должно быть. Код прочитает файл и подтвердит отсутствие; если "
            "этот фрагмент вдобавок удалён из того же файла в этом изменении, основание считается "
            "самым сильным. Не удалось подтвердить машинно — вердикт останется твоим суждением и "
            "будет так и НАЗВАН в отчёте, но отвергнут не будет: не подгоняй цитату под проверку;\n"
            "* status=unmet и undetermined требуют reason (или quote) — конкретно, чего не хватает; "
            "нашёл X, которого не должно быть — unmet и цитируй найденное (evidence=present);\n"
            "* честность симметрична: не выдумывай ни met, ни unmet. Не хватило прочитанного — "
            "undetermined с причиной, это законный ответ;\n"
            "* только JSON, без пояснений вокруг.")
        prompt = reviewer_prompt.assemble([
            ("task", task),
            ("criteria", f"Критерии приёмки:\n{listing}"),
            ("output_format", output_format),
            ("context", context),
        ])
        return tool_loop.parse_action(provider(prompt))
    return propose


def _unverified(criteria, reason, declared=None, **extra):
    """Единая форма несостоявшейся сверки: `verified=False` + НАЗВАННАЯ причина.

    Одна точка на все отказы — чтобы ни один путь не мог вернуть «сверено» без вердиктов или
    «не сверено» без причины: непроверенное обязано называть, ПОЧЕМУ оно непроверенное.
    """
    out = {"declared": bool(criteria) if declared is None else bool(declared),
           "count": len(criteria or []), "verified": False, "verifier": None,
           
           
           
           
           "attempted": False,
           "met_all": None, "quote_verified": 0, "judge_only": [],
           "owner_check_required": False, "unmet": [], "undetermined": [],
           "criteria": [{"id": c["id"], "text": c["text"], "status": "undetermined",
                         "basis": None, "grounded": False}
                        for c in (criteria or [])],
           "reads": [], "reason": reason}
    out.update(extra)
    return out


def verify(work_root, criteria, provider, revision=None, change_context=None, budget=None,
           max_reads=MAX_READS):
    """Сверить критерии с изменением. -> блок `acceptance_criteria` отчёта прогона.

    provider — text-provider РЕВЬЮЕРА (не писателя). Нет провайдера -> честное «не сверялись».
    Модуль ничего не пишет: судья гоняется под read-only Policy, попытки write/shell попадают
    в `denied` и видны в отчёте.
    """
    from ai_ops_kit.checks import acceptance_result as var  # чистая проверка формы вниз (лента №5)

    if not criteria:
        return _unverified([], "критерии приёмки не объявлены — сверять нечего", declared=False)
    if provider is None:
        return _unverified(criteria, "независимый ревьюер недоступен — сверка не выполнялась "
                                     "(нужен провайдер судьи; вердикт не фабрикуется)")

    ctx = change_context if change_context is not None else ""
    reviewer = make_acceptance_proposer(provider, criteria, revision)
    ro_policy = tool_broker.Policy(level="read-only", child_root=str(work_root))
    rv = tool_loop.run_review(reviewer, work_root, ro_policy, gate_id=None, budget=budget,
                              max_reads=max_reads, base_context=ctx,
                              reviewed_revision=revision,
                              terminal_kind="acceptance-result", terminal_field="criteria")
    res, reads, denied = rv.get("result"), rv.get("reads") or [], rv.get("denied") or []

    
    
    
    if not isinstance(res, dict):
        return _unverified(criteria, f"ревьюер не вынес вердикт ({rv.get('stopped')}) — сверки нет",
                           reads=reads, denied=denied, attempted=True)
    errs = var.check(res, criterion_ids=[c["id"] for c in criteria])
    if errs:
        return _unverified(criteria, "вердикт ревьюера не соответствует контракту: "
                                     + "; ".join(errs[:3]),
                           reads=reads, denied=denied, errors=errs, attempted=True)

    by_id = {str(c["id"]): c for c in res["criteria"]}
    out, unmet, undet = [], [], []
    for c in criteria:
        v = by_id[c["id"]]
        status = v["status"]
        quote = str(v.get("quote") or "").strip()
        source = str(v.get("source") or "").strip()
        reason = str(v.get("reason") or "").strip()
        evidence = str(v.get("evidence") or "present").strip().lower()
        basis, why = ("judge-only", "цитата не приведена") if not quote else \
            _ground_quote(quote, ctx, work_root, source, evidence)
        if quote and basis is None:
            # ВЫДУМАННАЯ цитата — единственный случай, когда вердикт не принимается ни в какую
            # сторону: он не стоит ни на чём. Симметрия честности сохранена: так же отвергается и
            # `met`, и `unmet`. Слабое, но НАСТОЯЩЕЕ основание вердикт не обнуляет — оно называется.
            status, reason = "undetermined", f"основание не подтверждено: {why}"
        elif status == "met" and basis == "absence-refuted":
            
            
            status = "undetermined"
            reason = why
        elif status == "met" and basis == "removed-line" and evidence != "absent":
            
            
            
            
            status = "undetermined"
            reason = ("вердикт «выполнено» опирается на УДАЛЁННУЮ строку — её в результате нет. "
                      "Для критерия об отсутствии нужен evidence=\"absent\" с фрагментом, "
                      "которого быть не должно")
        elif why and not reason:
            reason = why
        out.append({"id": c["id"], "text": c["text"], "status": status, "evidence": evidence,
                    "quote": quote or None, "source": source or None,
                    "basis": basis, "grounded": basis in STRONG_BASIS,
                    "reason": reason or None})
        if status == "unmet":
            unmet.append(c["id"])
        elif status == "undetermined":
            undet.append(c["id"])

    
    
    
    
    
    
    
    
    
    
    if not reads and not any(c["basis"] in FILE_CONFIRMED_BASES for c in out):
        return _unverified(criteria, "вердикт вынесен без единого чтения (0 reads) и ни одна цитата "
                                     "не сверена с доставленным файлом — рубер-штамп сверкой не "
                                     "является",
                           reads=reads, denied=denied, attempted=True)

    verified = not undet
    met_all = verified and not unmet
    strong = [c["id"] for c in out if c["basis"] in STRONG_BASIS]
    weak = [c["id"] for c in out if c["status"] != "undetermined" and c["basis"] not in STRONG_BASIS]
    if not verified:
        reason = (f"вердикт не установлен по {len(undet)} критериям из {len(criteria)} "
                  f"({', '.join(undet)}) — сверка неполна")
    elif not met_all:
        reason = f"сверка состоялась: НЕ ВЫПОЛНЕНО {len(unmet)} из {len(criteria)}"
    elif weak:
        
        
        reason = (f"все критерии выполнены; подтверждено цитатой {len(strong)} из {len(criteria)}, "
                  f"только суждением судьи — {len(weak)} ({', '.join(weak)})")
    else:
        reason = f"все критерии выполнены, основания подтверждены цитатой ({len(strong)})"
    return {"declared": True, "count": len(criteria), "verified": verified,
            "attempted": True,   # судья отработал (см. _unverified.attempted выше)
            "verifier": (f"independent-reviewer @ {(revision or 'HEAD')[:12]}" if verified else None),
            "met_all": met_all if verified else None,
            "quote_verified": len(strong), "judge_only": weak,
            
            
            
            
            "owner_check_required": bool(met_all and not strong),
            "unmet": unmet, "undetermined": undet, "criteria": out,
            "reads": reads, "denied": denied, "reason": reason}




if __name__ == "__main__":
    print(__doc__)
    print("Сверка требует живого провайдера-судьи и запускается движком "
          "(`ai-ops run --execute`), а не этим модулем напрямую.")
    sys.exit(0)
