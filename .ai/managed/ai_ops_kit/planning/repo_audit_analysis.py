#!/usr/bin/env python3
"""Аналитическое ядро онбординга: классификация зрелости, реконструкция, состояние контуров.

Спутник `repo_audit.py` (module-size, structural split). Здесь — кластер, который ПОНИМАЕТ
репозиторий: классифицирует его зрелость (`classify`/`_maturity`), восстанавливает всё, что можно
ДОКАЗАТЬ (`reconstruct`/`owner_confirmed`), и определяет состояние контуров модели против семи
статусов, включая устаревание (`_contour_state`/`_is_stale`/`_reviewed_at`).

Направление импортов одностороннее: фасад `repo_audit` импортирует этот модуль (для оркестрации и
ре-экспорта прежних имён), а этот модуль фасад НЕ импортирует. Наружу он зависит только от реестра
модели (`contours`), файла ответов владельца (`repo_audit_answers`) и детекторов
(`source_conflict`, `artifact_sections`, `delivery_plan`) — обратного ребра нет.
"""
from __future__ import annotations

from pathlib import Path

import yaml

from ai_ops_kit.planning import contours as _contours
from ai_ops_kit.planning.repo_audit_answers import ANSWERS_REL, read_answers




STALE_AFTER_DAYS = 180

VERIFIED, INFERRED, PARTIAL, MISSING, UNKNOWN, STALE, USER_CONFIRMED = (
    "verified", "inferred", "partial", "missing", "unknown", "stale", "user_confirmed")



CONFLICTING = "conflicting"


def _maturity(evidence: dict, model: dict) -> tuple[int, list[str]]:
    """Суммарный вес присутствующих сигналов зрелости и их человекочитаемые метки.

    Состав сигналов и веса — ДАННЫМИ из реестра (`classification.maturity_signals`), а не в коде:
    инвариант кита требует, чтобы правила класса правились данными живых прогонов. `id` каждого
    сигнала — ключ, который производит `discover()`. Fail-open: если реестр не объявил сигналов,
    вес нулевой и класс определяют только пороги по истории — отсутствие данных не роняет онбординг.
    """
    weight, labels = 0, []
    for sig in (((model.get("classification") or {}).get("maturity_signals")) or []):
        if bool(evidence.get(sig.get("id"))):
            weight += int(sig.get("weight", 0))
            labels.append(sig.get("label") or sig.get("id"))
    return weight, labels


def classify(evidence: dict, model: dict | None = None) -> dict:
    """CLASSIFY — новый продукт, ранний, существующий или неизвестно.

    UNKNOWN — не «пустой». Пустой репозиторий ЧИТАЕТСЯ и даёт нули; нечитаемый не даёт ничего.
    Разница определяет, начинать ли bootstrap или сначала спросить, и поэтому она в коде, а не в
    интуиции читателя.
    """
    model = model or _contours.load_model()
    th = ((model.get("classification") or {}).get("thresholds") or {})
    src = evidence.get("source_files")
    commits = evidence.get("commits")

    if not evidence.get("tree_readable") or src is None:
        return {"class": "UNKNOWN", "confidence": "none",
                "reasons": ["дерево репозитория не читается — сигналы классификации недоступны"],
                "onboarding": "ask_before_acting"}

    has_ci = bool(evidence.get("ci"))
    has_tests = bool(evidence.get("test_files"))
    reasons = []

    if src <= th.get("new_max_source_files", 10) and not has_ci and not has_tests:
        if commits is None:
            reasons.append(f"файлов кода {src}, CI и тестов нет; история git не читается")
            conf = "medium"
        elif commits <= th.get("new_max_commits", 5):
            reasons.append(f"файлов кода {src}, коммитов {commits}, CI и тестов нет")
            conf = "high"
        else:
            reasons.append(f"файлов кода {src}, но коммитов {commits} — это не scaffold")
            return {"class": "EARLY_PRODUCT", "confidence": "medium", "reasons": reasons,
                    "onboarding": "reconstruct_then_bootstrap"}
        return {"class": "NEW_PRODUCT", "confidence": conf, "reasons": reasons,
                "onboarding": "product_bootstrap"}

    
    
    cls_cfg = model.get("classification") or {}
    min_weight = cls_cfg.get("maturity_min_weight", 6)
    weight, live = _maturity(evidence, model)
    if commits is not None and commits >= th.get("existing_min_commits", 50) and weight >= 1:
        reasons.append(f"коммитов {commits}, файлов кода {src}")
        reasons.append("признаки живой системы: " + ", ".join(live))
        return {"class": "EXISTING_PRODUCT", "confidence": "high", "reasons": reasons,
                "onboarding": "reconstruct_first"}
    if weight >= min_weight:
        reasons.append("история короткая или не читается, но признаки зрелой системы на месте: "
                       + ", ".join(live))
        return {"class": "EXISTING_PRODUCT", "confidence": "medium", "reasons": reasons,
                "onboarding": "reconstruct_first"}

    reasons.append(f"код есть (файлов {src}), продуктовой и архитектурной истории почти нет")
    if commits is not None:
        reasons.append(f"коммитов {commits}")
        
        
        
        early_max = th.get("early_max_commits", 50)
        if commits > early_max:
            reasons.append(f"история длиннее порога ранней стадии ({early_max}), но признаков "
                           f"живой системы (CI, тесты, миграции, релизы) меньше двух — "
                           f"состояние определяется как раннее осознанно")
    return {"class": "EARLY_PRODUCT", "confidence": "medium" if commits is not None else "low",
            "reasons": reasons, "onboarding": "reconstruct_then_bootstrap"}


def owner_confirmed(child_root) -> dict:
    """Факты, ПОДТВЕРЖДЁННЫЕ владельцем: `.ai-ops.yaml -> product_operating_model.confirmed`.

    Это единственный производитель состояния `user_confirmed`, и он обязан существовать: состояние
    объявлено в модели с `trust: high` и названо единственным способом повысить `inferred`. Слово в
    реестре, которого не вычисляет никто, — ровно та «capability без реализации», которую
    инварианты кита запрещают (то же правило уже применено к `stale`).
    """
    
    
    
    data = {}
    cfg = Path(child_root) / ".ai-ops.yaml"
    if cfg.is_file():
        try:
            data = yaml.safe_load(cfg.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError:
            data = {}                                  # битый конфиг — забота doctor'а
    if not isinstance(data, dict):
        data = {}
    conf = dict((data.get("product_operating_model") or {}).get("confirmed") or {})
    
    
    conf.update(read_answers(child_root))
    return {k: v for k, v in conf.items() if v not in (None, "")}


def reconstruct(child_root, evidence: dict, model: dict | None = None) -> dict:
    """RECONSTRUCT — что кит утверждает о репозитории и НА КАКОМ ОСНОВАНИИ.

    -> {ключ: {"value": …, "status": verified|inferred|unknown, "evidence": [...]}}

    `verified` — только факт репозитория (файл, манифест, миграция, CI). Всё, что получено
    рассуждением о структуре, — `inferred`, и повышению не подлежит: подтвердить может человек
    (`user_confirmed`), а не убедительность вывода.
    """
    model = model or _contours.load_model()
    root = Path(child_root)
    out = {}

    prof = evidence.get("profile") or {}
    langs = [s.get("language") for s in (prof.get("stacks") or []) if s.get("language")]
    if langs:
        out["languages"] = {"value": langs, "status": VERIFIED,
                            "evidence": sorted({e for s in prof.get("stacks") or []
                                                for e in (s.get("evidence_source") or [])})[:6]}
    else:
        out["languages"] = {"value": None, "status": UNKNOWN,
                            "evidence": [], "note": "манифесты зависимостей не распознаны"}

    fw = sorted({f for s in (prof.get("stacks") or []) for f in (s.get("frameworks") or [])})
    if fw:
        out["frameworks"] = {"value": fw, "status": VERIFIED, "evidence": ["манифесты зависимостей"]}

    if evidence.get("migrations"):
        out["persistence"] = {"value": "реляционная СУБД с миграциями", "status": VERIFIED,
                              "evidence": list(evidence["migrations"])}
    elif evidence.get("containers"):
        out["persistence"] = {"value": None, "status": UNKNOWN,
                              "evidence": list(evidence["containers"]),
                              "note": "хранилище может быть объявлено в compose — не разобрано"}

    if evidence.get("api_schemas"):
        out["api_contracts"] = {"value": "контракты API объявлены файлами", "status": VERIFIED,
                                "evidence": list(evidence["api_schemas"])}

    if evidence.get("ci"):
        cmds = {}
        for s in prof.get("stacks") or []:
            for k, v in (s.get("commands") or {}).items():
                if v:
                    cmds[k] = v
        
        
        
        _cmd_ev = list(evidence.get("dependency_manifests") or [])
        out["ci_pipeline"] = {"value": sorted(cmds) or "CI объявлен", "status": VERIFIED,
                              "evidence": list(evidence["ci"]) + _cmd_ev,
                              "note": "CI продукта обнаружен; перечисленные команды взяты из "
                                      "манифестов стека, шаги workflow не разбирались"}

    if evidence.get("containers"):
        out["deployment"] = {"value": "контейнерная поставка", "status": INFERRED,
                             "evidence": list(evidence["containers"]),
                             "note": "какое окружение считается production — решение владельца"}

    src, tests = evidence.get("source_files") or 0, evidence.get("test_files") or 0
    if src:
        out["test_coverage_presence"] = {
            "value": f"{tests} тестовых файлов на {src} файлов кода",
            "status": VERIFIED if tests else MISSING, "evidence": ["обход дерева"]}

    
    
    style, why = None, []
    if (root / "src" / "modules").is_dir() or (root / "modules").is_dir():
        style, why = "modular_monolith", ["src/modules/*"]
    elif any((root / d).is_dir() for d in ("services", "apps", "packages")):
        style, why = "multi-service / monorepo", [d for d in ("services", "apps", "packages")
                                                  if (root / d).is_dir()]
    elif src:
        style, why = "single application", ["структура каталогов"]
    if style:
        out["architecture_style"] = {"value": style, "status": INFERRED, "evidence": why,
                                     "note": "вывод из структуры; подтверждение владельца желательно"}

    
    for key, note in (("primary_user", "пользователи продукта из репозитория не выводятся"),
                      
                      
                      
                      ("main_goal_now", "цель продукта из репозитория не выводится"),
                      ("sensitive_data", "чувствительность данных определяет владелец")):
        
        
        
        
        
        out[key] = {"value": None, "status": UNKNOWN, "evidence": [], "note": note,
                    "asks_human": True}

    
    
    
    
    if evidence.get("containers") or evidence.get("ci"):
        out["production_env"] = {
            "value": "окружение, куда деплоит существующий конвейер", "status": INFERRED,
            "evidence": list(evidence.get("containers") or evidence.get("ci") or []),
            "note": "какое окружение считается production — решение владельца",
            "asks_human": True}
    else:
        out["production_env"] = {"value": None, "status": UNKNOWN, "evidence": [],
                                 "note": "признаков деплоя не найдено", "asks_human": True}

    
    
    
    
    
    from ai_ops_kit.planning import source_conflict as _conflict
    _conflicts = _conflict.detect(child_root)
    _db_conflict = next((c for c in _conflicts if c["category"] == "database"), None)
    if _db_conflict:
        out["persistence"] = {
            "value": _db_conflict["summary"], "status": CONFLICTING,
            "evidence": [f"{c['source']} ({c['path']}): {', '.join(c['values'])}"
                         for c in _db_conflict["claims"]],
            "note": "источники противоречат — актуальную СУБД определяет владелец, кит не выбирает",
            "conflicts": _conflicts}

    # ПОСЛЕДНИМ: подтверждение владельца перебивает и `inferred`, и `unknown`. Порядок не случаен —
    # человек сильнее любого вывода кита, и обратное затирание сделало бы подтверждение бесполезным.
    _answers = read_answers(child_root)
    for key, value in owner_confirmed(child_root).items():
        where = (ANSWERS_REL if key in _answers else ".ai-ops.yaml")
        out[key] = {"value": value, "status": USER_CONFIRMED,
                    "evidence": [f"подтверждено владельцем ({where})"],
                    "note": "подтверждение человека сильнее вывода кита",
                    "asks_human": (out.get(key) or {}).get("asks_human", False)}
    return out


def _reviewed_at(path: Path):
    """`reviewed_at` из frontmatter документа. -> date|None. None означает «дата не объявлена»,
    и это НЕ «свежий»: судить о свежести документа без даты нечем, поэтому решение остаётся за
    `validate_freshness`, владельцем этой области, а не за онбордингом."""
    import datetime as _dt
    try:
        head = path.read_text(encoding="utf-8", errors="replace")[:800]
    except OSError:
        return None
    if not head.startswith("---"):
        return None
    for line in head.split("---", 2)[1].splitlines():
        if line.strip().startswith("reviewed_at:"):
            raw = line.split(":", 1)[1].strip().strip('"\'')
            try:
                return _dt.date.fromisoformat(raw)
            except ValueError:
                return None
    return None


def _is_stale(root: Path, rels, today=None) -> bool:
    """Устарел ли хоть один источник истины контура. Дата не объявлена -> не устарел (см. выше)."""
    import datetime as _dt
    today = today or _dt.date.today()
    for rel in rels:
        for pre in ("", ".ai/project/", ".ai/custom/"):
            p = root / (pre + rel)
            if p.is_file():
                d = _reviewed_at(p)
                if d and (today - d).days > STALE_AFTER_DAYS:
                    return True
                break
    return False


def _contour_state(child_root, c: dict, evidence: dict, model: dict) -> dict:
    """Состояние контура в терминах семи статусов + что с ним делать.

    Логика намеренно скучная: есть обязательные источники истины -> `verified`; часть есть ->
    `partial`; ничего нет, но контур восстановим -> `inferred` возможен, фактическое состояние
    `missing`; ничего нет и восстановить нечем -> `missing`. `unknown` остаётся за случаем, когда
    дерево не читается: тогда неизвестно даже отсутствие.
    """
    root = Path(child_root)
    
    
    
    
    _sot = _contours.sot_for(model, c["id"], root)
    req = [s for s in _sot if s.get("required")]
    opt = [s for s in _sot if not s.get("required")]

    def _has(rel):
        for pre in ("", ".ai/project/", ".ai/custom/"):
            if (root / (pre + rel)).exists():
                return True
        return False

    def _resolve(rel):
        for pre in ("", ".ai/project/", ".ai/custom/"):
            p = root / (pre + rel)
            if p.is_file():
                return p
        return None

    if not evidence.get("tree_readable"):
        state = UNKNOWN
    else:
        have_req = [s["path"] for s in req if _has(s["path"])]
        have_opt = [s["path"] for s in opt if _has(s["path"])]
        if req and len(have_req) == len(req):
            state = STALE if _is_stale(root, have_req) else VERIFIED
        elif have_req or have_opt:
            state = PARTIAL
        else:
            state = MISSING

    
    if state == VERIFIED and c.get("id") == "planning_execution":
        try:
            from ai_ops_kit.planning import delivery_plan as _dp
            if _dp.is_template(_dp.load(root)):
                state = PARTIAL
        
        
        
        
        
        
        except Exception:  # noqa: BLE001 — любой отказ проверки -> UNKNOWN, а не VERIFIED
            state = UNKNOWN

    rec = c.get("reconstruction") or {}
    qs = c.get("questions") or []
    
    
    
    
    
    
    
    section_findings = []
    if evidence.get("tree_readable"):
        from ai_ops_kit.planning import artifact_sections as _sections
        for s in _sot:
            secs = s.get("required_sections")
            if not secs:
                continue
            p = _resolve(s["path"])
            if p is None:
                continue                               # файла нет — покрыто missing_required
            try:
                states = _sections.section_states(p.read_text(encoding="utf-8"), secs)
            except OSError:
                continue
            empty = [x["name"] for x in states if x["state"] == _sections.EMPTY]
            missing_sec = [x["name"] for x in states if x["state"] == _sections.MISSING]
            if empty or missing_sec:
                section_findings.append({"path": s["path"], "empty_sections": empty,
                                         "missing_sections": missing_sec})

    closed = state == VERIFIED
    return {"contour": c["id"], "title": c.get("title"), "question": c.get("question"),
            "state": state, "owner_role": c.get("owner_role"),
            "present": [s["path"] for s in (c.get("source_of_truth") or []) if _has(s["path"])],
            "missing_required": [s["path"] for s in req if not _has(s["path"])],
            "section_findings": section_findings,
            "ai_can_reconstruct": rec.get("ability", "none"),
            "reconstruct_from": rec.get("from") or [],
            "needs_human": (not closed) and (bool(qs) or rec.get("ability") == "none"),
            "gap_tier": c.get("gap_tier", "opportunistic"),
            "questions": [] if closed else [dict(q) for q in qs]}
