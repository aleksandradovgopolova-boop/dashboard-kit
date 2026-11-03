#!/usr/bin/env python3
"""Кластер изоляции/окружения/сборки evidence execution-pipeline (вынесено из execution_pipeline.py).

Здесь живут фазы прогона, которые ОБРАМЛЯЮТ tool-loop, но не являются самим оркестратором
`run_pipeline`:

  * `_setup_isolation`     — base-binding + worktree-изоляция/resume (ранний честный выход при отказе);
  * `_prepare_environment` — install-deps стека + baseline-evidence + откат мутаций подготовки;
  * `_commit_work`         — фиксация правок на ветке ai-ops/<wid> ДО сбора evidence;
  * `_assemble_evidence`   — сбор evidence на зафиксированном SHA + наполнение gate_ev;
  * `_seam_scan_advisory`  — advisory-детектор «дефекта шва» по дифу base..committed.

Поведение НЕ меняется: это перенос без правок логики. Зависимости берутся из настоящих
модулей-соседей (pipeline_git/pipeline_helpers/pipeline_evidence/pipeline_readiness), а не из
execution_pipeline — иначе получился бы цикл. `run_pipeline` остаётся в execution_pipeline и
вызывает эти функции через реэкспорт.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from ai_ops_kit.engine import tool_broker              # noqa: E402
from ai_ops_kit.gates import evidence_collector       # noqa: E402
from ai_ops_kit.ui import storybook_adapter           # noqa: E402  (v3.1.9 exact-SHA UI evidence)
from ai_ops_kit.engine import living_status as _living_status  # noqa: E402

from ai_ops_kit.engine.pipeline_helpers import _intake_evidence  # noqa: E402
from ai_ops_kit.engine.pipeline_git import (  # noqa: E402
    _git, _has_changes, _tree_clean, _tree_clean_after_checks, _untracked,
    _committed_changed_files, _commit_on_branch, _resolve_base,
    _change_context_range,
    delivery_preflight as _delivery_preflight,
    managed_drift_preflight as _managed_drift_preflight,
)
from ai_ops_kit.engine.pipeline_evidence import (  # noqa: E402
    _install_dependencies, _run_reviews, _reevaluate_artifact_evidence,
    _consume_handoff_verdicts,
)
from ai_ops_kit.engine.pipeline_readiness import _evaluate_security  # noqa: E402


def _setup_isolation(child_root, wid, base, *, isolate, resume, reevaluate_only,
                     discard_previous, open_pr):
    """BASE BINDING + worktree-изоляция/resume: рабочая ветка ai-ops/<wid> форкается от РАЗРЕШЁННОГО
    base (не от HEAD), весь прогон идёт в отдельном worktree, основное дерево не трогается.

    K6: вынесено из run_pipeline без изменения поведения. -> dict: при отказе {"error": <report>}
    (ранний честный выход ДО модели/worktree), иначе {"work_root", "worktree_rel", "resume_info",
    "base_binding", "base_ref", "base_sha"}.
    """
    work_root, worktree_rel = child_root, None
    resume_info = ({"requested": bool(resume), "resumed": False,
                    "reused_worktree": False, "reused_branch": False}
                   if (resume or reevaluate_only) else None)
    
    
    _br = _resolve_base(child_root, base)   # base может быть None (auto) или явной веткой
    base_sha = _br.get("base_sha")
    base_ref = _br.get("base_ref") or base or "HEAD"
    base_binding = {"base_ref": base_ref, "base_sha": base_sha, "mode": _br.get("mode"),
                    "resolved": bool(_br.get("resolved")), "source": _br.get("source"),
                    "reason": _br.get("reason")}
    # B2-23: доставка проверяла remote-базу ПОСЛЕ работы (13.5 мин живой модели, только потом «база
    # сдвинулась»). База известна ЗДЕСЬ, до первого вызова модели — предупреждаем заранее (бесплатно),
    # прогон не останавливаем, но в тех же словах, что скажет доставка.
    delivery_pf = _delivery_preflight(child_root, base_ref, base_sha, open_pr)
    if delivery_pf:
        print(f"  ⚠ {delivery_pf['warning']}")
    # B2-27: update --in-place оставляет managed-файлы в рабочем дереве, а worktree создаётся от HEAD
    # -> прогон на старом ките. Предупреждаем ДО изоляции.
    managed_pf = _managed_drift_preflight(child_root)
    if managed_pf:
        print(f"  ⚠ {managed_pf['warning']}")
    # P0.2: ЯВНО переданная, но неразрешённая base -> preflight-блок ДО модели/worktree (не выполнять
    # от HEAD). auto всегда разрешается, поэтому блокирует только явную несуществующую ветку.
    if isolate and _br.get("mode") == "explicit" and not _br.get("resolved"):
        return {"error": {"schema_version": 1, "kind": "execution-pipeline", "workitem_id": wid,
                "status": "error", "ready_for_pr": False, "base_binding": base_binding,
                "error": (f"base-preflight: явная база '{base}' не разрешается в ветку "
                          f"({_br.get('reason')}) — прогон остановлен ДО вызова модели (не выполняем "
                          f"от произвольного HEAD)"),
                "loop": None, "isolation": {"worktree": None}, "gates": None, "overall_status": "error"}}
    if isolate:
        from ai_ops_kit.engine import worktree as _wt
        # #708: на product-аудитории строку про отдельную копию даёт active-work одной человеческой
        # фразой — id-насыщенный дубль WORKTREE здесь глушим (quiet). Сбой резолва -> полная форма.
        try:
            from ai_ops_kit.ui import presenter
            _wt_quiet = presenter.audience_from_config(child_root) == "product"
        except Exception:  # noqa: BLE001
            _wt_quiet = False
        branch = f"ai-ops/{wid}"
        wp = child_root / ".ai" / "worktrees" / wid
        branch_exists = _wt._branch_exists(child_root, branch)
        
        reused = False
        if (resume or reevaluate_only) and (branch_exists or wp.is_dir()):
            if not wp.is_dir() and branch_exists:
                
                rc = _wt.add(child_root, wid, branch, quiet=_wt_quiet)
                if rc != 0:
                    return {"error": {"schema_version": 1, "kind": "execution-pipeline", "workitem_id": wid,
                            "status": "error",
                            "error": f"resume: не удалось пере-подключить worktree к ветке {branch} "
                                     f"(занята? не в .gitignore?) — прогон остановлен, работа не тронута",
                            "loop": None, "isolation": {"worktree": None}, "gates": None,
                            "ready_for_pr": False, "resume": {**resume_info, "resumed": False}}}
                resume_info["reused_branch"] = True
            else:
                resume_info["reused_worktree"] = True
                resume_info["reused_branch"] = branch_exists
            work_root = wp
            worktree_rel = wp.relative_to(child_root).as_posix()
            resume_info["resumed"] = True
            reused = True
        if not reused:
            if resume:
                
                resume_info["reason"] = (f"ни ветки {branch}, ни worktree нет — продолжать нечего; "
                                         f"выполняется свежий старт")
            
            
            
            
            if wp.is_dir() or branch_exists:
                ahead = 0
                if branch_exists:
                    
                    rc_a, out_a, _ = _git(child_root, "rev-list", "--count", branch, "^HEAD")
                    ahead = int(out_a) if rc_a == 0 and out_a.isdigit() else 0
                if ahead > 0 and not discard_previous:
                    return {"error": {"schema_version": 1, "kind": "execution-pipeline", "workitem_id": wid,
                            "status": "error",
                            
                            
                            
                            
                            
                            "error": f"предыдущий прогон feature='{wid}' имеет {ahead} несохранённых "
                                     f"коммит(ов) на ветке {branch}. Чтобы не потерять работу, прогон "
                                     f"остановлен. Продолжить поверх них: "
                                     f"`ai-ops resume . --feature {wid} --execute`. Перезаписать: "
                                     f"`git branch -D {branch}` и "
                                     f"`ai-ops run . --feature {wid} --execute`. Или возьми другой "
                                     f"--feature.",
                            "loop": None, "isolation": {"worktree": None}, "gates": None,
                            "ready_for_pr": False, "overall_status": "error"}}
                _wt.remove(child_root, wid, force=True)
                _git(child_root, "worktree", "prune")
                _git(child_root, "branch", "-D", branch)
            rc = _wt.add(child_root, wid, branch, base=(base_sha or "HEAD"),   # v3.0.1: форк от base_sha
                         quiet=_wt_quiet)
            if rc == 0:
                work_root = wp
                worktree_rel = wp.relative_to(child_root).as_posix()
                
                if base_sha:
                    _rc_h, _wh, _ = _git(wp, "rev-parse", "HEAD")
                    if _rc_h != 0 or (_wh or "").strip() != base_sha:
                        return {"error": {"schema_version": 1, "kind": "execution-pipeline", "workitem_id": wid,
                                "status": "error", "base_binding": base_binding,
                                "error": (f"base binding нарушен: ветка {branch} форкнулась от "
                                          f"{(_wh or '?').strip()[:12]}, а заявлен base={base_ref}"
                                          f" ({base_sha[:12]}) — прогон остановлен"),
                                "loop": None, "isolation": {"worktree": None}, "gates": None,
                                "ready_for_pr": False, "overall_status": "error"}}
        if work_root is child_root:
            
            
            return {"error": {"schema_version": 1, "kind": "execution-pipeline", "workitem_id": wid,
                    "status": "error",
                    "error": f"isolate=True, но worktree .ai/worktrees/{wid} не создан "
                             f"(ветка занята? не в .gitignore?) — прогон остановлен, основное дерево не тронуто",
                    "loop": None, "isolation": {"worktree": None}, "gates": None,
                    "ready_for_pr": False}}
    return {"work_root": work_root, "worktree_rel": worktree_rel, "resume_info": resume_info,
            "base_binding": base_binding, "base_ref": base_ref, "base_sha": base_sha,
            "delivery_pf": delivery_pf}


# #468 SELF-HOST GATE-TOOLS: когда кит строит САМ СЕБЯ (run --execute в изолированном
# agent-worktree), песочница прогона не видит координаторского .venv, где стоят ворота-инструменты
# (ruff/pytest/…), которыми судит готовность и которыми проверяет CI. Итог — прогон судит
# ОСЛАБЛЕННЫМ набором (exit 127) и расходится с CI. Здесь среда прогона получает те же инструменты.
#
# Якорные инструменты: их присутствия в координаторском venv достаточно, чтобы отличить полный
# dev-venv от голого окружения. Полный набор объявлен в requirements-dev.txt (ruff/pytest/
# pytest-cov/pytest-xdist/hypothesis/mypy); проверять весь список тут незачем — venv либо dev, либо нет.
_KIT_GATE_TOOL_ANCHORS = ("ruff", "pytest")


def _coordinator_bin_dir():
    """Каталог bin КООРДИНАТОРСКОГО интерпретатора (того, под которым исполняется сам кит).

    Кит запущен как `<venv>/bin/python -m ai_ops_kit…`, поэтому `sys.executable` указывает в
    координаторский venv, где уже стоят ворота-инструменты. Их каталог = parent от sys.executable.
    None, если определить нельзя (тогда провижининг честно неуспешен)."""
    try:
        exe = Path(sys.executable)
    except (TypeError, ValueError):
        return None
    return exe.parent if exe.name and exe.parent.is_dir() else None


def _provision_kit_gate_tools(work_root):
    """SELF-HOST: сделать ворота-инструменты кита (ruff/pytest/…) доступными среде прогона (#468).

    Способ выбран НАИМЕНЕЕ ИНВАЗИВНЫЙ и без сети: ПЕРЕИСПОЛЬЗОВАТЬ уже подготовленный
    координаторский venv (тот, под которым исполняется кит), добавив его bin в НАЧАЛО PATH среды
    прогона. Версии инструментов совпадают с координаторскими один-в-один — никакого дрейфа
    установки и никакой правки рантайм-зависимостей кита. Гейты профиля зовут голые `ruff check`/
    `pytest`, и после этого шага shell прогона находит их на PATH ровно как координатор и CI.

    ЧЕСТНАЯ ДЕГРАДАЦИЯ (не выдаём ослабленную зелень за настоящую): если каталог интерпретатора не
    определить ЛИБО якорных инструментов там нет — возвращаем ok=False. Вызывающий кладёт этот
    результат в `prepare`, поэтому prepare_ok становится False и вердикт готовности деградирует
    штатным механизмом (#454/#456: env_qualified = prepare_ok OR проверки реально отработали).

    -> dict {"kind","ok","reason","bin_dir","tools_present","tools_missing"} для наблюдаемости."""
    bin_dir = _coordinator_bin_dir()
    base = {"kind": "self-host-gate-tools"}
    if bin_dir is None:
        return {**base, "ok": False, "bin_dir": None, "tools_present": [],
                "tools_missing": list(_KIT_GATE_TOOL_ANCHORS),
                "reason": "координаторский интерпретатор не определить (sys.executable) — "
                          "ворота-инструменты кита не провижинились; вердикт деградирует честно"}

    def _has(tool):
        return (bin_dir / tool).exists() or (bin_dir / f"{tool}.exe").exists()

    present = [t for t in _KIT_GATE_TOOL_ANCHORS if _has(t)]
    missing = [t for t in _KIT_GATE_TOOL_ANCHORS if t not in present]
    if missing:
        return {**base, "ok": False, "bin_dir": str(bin_dir), "tools_present": present,
                "tools_missing": missing,
                "reason": f"в координаторском venv ({bin_dir}) нет ворот-инструментов кита "
                          f"{missing} — среда прогона не получит их; вердикт деградирует честно "
                          f"(не выдаём ослабленную зелень за настоящую)"}
    # bin координатора — В НАЧАЛО PATH: последующие shell-гейты (ruff/pytest) увидят его первым.
    cur = os.environ.get("PATH", "")
    parts = cur.split(os.pathsep) if cur else []
    if str(bin_dir) not in parts:
        os.environ["PATH"] = os.pathsep.join([str(bin_dir), *parts]) if parts else str(bin_dir)
    return {**base, "ok": True, "bin_dir": str(bin_dir), "tools_present": present,
            "tools_missing": [],
            "reason": f"ворота-инструменты кита провижинились из координаторского venv ({bin_dir}) "
                      f"— прогон судит НАСТОЯЩИМ набором (self-host), как CI"}


def _prepare_environment(profile, work_root, pol, is_git, *, install_deps, isolate, baseline_diff):
    """Фаза install-deps: зависимости стека + baseline-evidence + откат мутаций подготовки до правок
    модели. v3.38 (K6): вынесено из run_pipeline. -> (prepare, prepare_ok, baseline_checks, mutated).

    #468 SELF-HOST: если цель прогона — САМ кит (tool_broker._is_kit_self_host), среда прогона
    ДОПОЛНИТЕЛЬНО получает ворота-инструменты кита (ruff/pytest/…) из координаторского venv, чтобы
    гейты исполнялись НАСТОЯЩИМ набором (как CI), а не ослабленным. Провал провижининга уходит в
    `prepare` -> prepare_ok=False -> честная деградация вердикта. Путь ДОЧЕК (не self-host) не тронут."""
    
    
    untracked_before_prep = _untracked(work_root) if is_git else set()
    
    
    prepare = None
    if install_deps and isolate:
        prepare = _install_dependencies(profile, work_root, pol)
        
        
        if tool_broker._is_kit_self_host(work_root):
            _prov = _provision_kit_gate_tools(work_root)
            
            
            prepare = (prepare or []) + [{
                "language": "kit-self-host", "command": "provision gate-tools",
                "allowed": True, "ok": _prov["ok"], "exit_code": None,
                "output_tail": _prov["reason"][-200:]}]
    # P0.6: install обязан ПРОЙТИ — иначе baseline/проверки недостоверны, прогон не может быть ready.
    prepare_ok = (prepare is None) or all(p.get("ok") for p in prepare)
    
    
    baseline_checks = None
    if baseline_diff:
        baseline_checks = evidence_collector.collect(profile, work_root, pol, broker=tool_broker)["checks"]
    
    
    
    prepare_mutated_tree = False
    if is_git and not _tree_clean(work_root):
        prepare_mutated_tree = True
        _git(work_root, "checkout", "--", ".")
        new_untracked = _untracked(work_root) - untracked_before_prep
        for rel in new_untracked:
            try:
                fp = (work_root / rel)
                if fp.is_file() or fp.is_symlink():
                    fp.unlink()
            except OSError:
                pass
    return prepare, prepare_ok, baseline_checks, prepare_mutated_tree


def _commit_work(work_root, wid, task, is_git, applied, authored, shell_changed, self_committed,
                 head_sha, *, commit, reevaluate_only):
    """Фаза commit: зафиксировать правки на ветке ai-ops/<wid> ДО evidence (evidence бьётся о ТОЧНЫЙ
    SHA); reevaluate переиспользует HEAD. work_produced_by (broker/shell/model-commit) — факт для
    человека. v3.38 (K6): вынесено из run_pipeline. -> (committed_sha, work_branch, produced_by, clean)."""
    committed_sha, work_branch = None, None
    
    work_produced_by = ("broker" if applied else ("shell" if shell_changed else None))
    tree_clean_before_checks = None
    # v2.93: коммитим при правках В ДЕРЕВЕ (git-diff/untracked, вкл. shell и артефакты), не только
    # при applied. Для не-git репо fallback на applied.
    have_work = ((is_git and _has_changes(work_root)) or bool(applied) or bool(authored)
                 or self_committed)
    if reevaluate_only:
        # v3.8.4: существующий HEAD — уже зафиксированная работа; НЕ создаём коммит, план/SHA не меняются.
        work_branch = f"ai-ops/{wid}"
        _rc_h, _out_h, _ = _git(work_root, "rev-parse", "HEAD")
        committed_sha = _out_h.strip() if _rc_h == 0 else None
        tree_clean_before_checks = _tree_clean(work_root)
    elif commit and have_work:
        work_branch = f"ai-ops/{wid}"
        # #404: доставленная работа меняет «что готово» -> обновляем living-status дочки В ТОМ ЖЕ
        # коммите, иначе volatile-док протухает и status-freshness дочки блокирует авто-PR. Управляемого
        # дока нет -> no-op. Best-effort: провал обновления статуса не должен рушить доставку правки.
        try:
            _living_status.refresh(work_root, wid, task)
        except Exception:  # noqa: BLE001,S110 — обновление статус-дока best-effort, не рушит доставку
            pass
        committed_sha = _commit_on_branch(work_root, work_branch,
                                          f"ai-ops: {task[:60]}")
        
        if committed_sha is None and self_committed:
            _rc_b, _out_b, _ = _git(work_root, "rev-parse", "--abbrev-ref", "HEAD")
            work_branch = _out_b.strip() if _rc_b == 0 and _out_b.strip() != "HEAD" else work_branch
            committed_sha = head_sha
            work_produced_by = "model-commit"
        # P0.5: после коммита дерево обязано быть чистым — иначе часть правок не в SHA.
        tree_clean_before_checks = _tree_clean(work_root)
    return committed_sha, work_branch, work_produced_by, tree_clean_before_checks


def _verification_changed_files(root, base_sha, revision):
    """Весь диапазон задачи; неизвестный scope — полный профиль, не docs-only skip."""
    if not base_sha or not revision:
        return None
    rc, output, _ = _git(root, "diff", "--no-renames", "--name-only", "-z", base_sha, revision, "--")
    if rc:
        return None
    return sorted({path for path in output.split("\0") if path})


def _assemble_evidence(profile, work_root, pol, child_root, wid, plan, signals, loop, *,
                       commit, is_git, committed_sha, base_sha, authored_ev, allow_missing_tests,
                       calibrated_enforcement, ui_evidence, review, reviewer_proposer, budget,
                       strict_judge_qualified, security_reviewer_proposer, reevaluate_only, verification_intent="merge_candidate"):
    """Сбор evidence на зафиксированном SHA и наполнение gate_ev: реальный прогон проверок профиля
    через Broker, intake/regression/authored/reevaluate-seed, освобождения по неприменимым проверкам,
    UI-evidence на точном SHA, seam-scan advisory, независимые ревью и доменный security-вердикт.

    K6: вынесено из run_pipeline без изменения поведения. -> dict со всем, что нужно дальше для гейтов
    и отчёта (changed_for_verification/coll/gate_ev/tree_clean_after_checks/regression_proof/exempt/
    not_applicable/exempt_reason/tests_warn/ui_evidence_bundle/seam_advisory/reviews/security_pack_result/
    effective_approval_signals).
    """
    
    _changed_for_verification = (_verification_changed_files(work_root, base_sha, committed_sha)
                                 if commit and is_git else None)
    
    
    coll = evidence_collector.collect(profile, work_root, pol, changed_files=_changed_for_verification,
        broker=tool_broker, lifecycle_intent=verification_intent)

    # 6a. finding аудита (P0.5): проверки могли намутить дерево (build-артефакты, lock-файлы) —
    #     тогда собранный evidence уже не отражает закоммиченный SHA. Фиксируем факт, не скрываем.
    # v2.119: чистота ПОСЛЕ проверок терпима к тул-кэшам (pytest/npm/... создают их рутинно);
    # tracked-правки от проверок по-прежнему делают дерево грязным (evidence-целостность сохранена).
    tree_clean_after_checks = _tree_clean_after_checks(work_root) if (commit and is_git) else None

    
    
    gate_ev = dict(coll["gate_evidence"])
    intake = _intake_evidence(signals)
    if intake:
        gate_ev.setdefault("intake_completeness", intake)
    
    
    
    
    regression_proof = None
    if commit and is_git and committed_sha:
        try:
            from ai_ops_kit.gates import regression_evidence
            regression_proof = regression_evidence.prove(
                work_root, base_sha, committed_sha, profile,
                changed_files=_changed_for_verification)
            gate_ev.setdefault("regression_test_evidence", regression_evidence.gate_evidence(
                regression_proof, behavior_unchanged=(loop or {}).get("behavior_unchanged")))
        except Exception as _e:  # noqa: BLE001 — доказательство не должно ронять уже сделанную работу
            regression_proof = {"kind": "RegressionEvidence", "status": "unverifiable",
                                "reason": f"проверка не отработала: {type(_e).__name__}: {_e}"[:200]}
    # v2.86: evidence артефакт-гейтов (requirements/plan_readiness) из author-стадии — форма
    # подтверждена детерминированно; НЕ перетираем уже имеющееся evidence (setdefault).
    for _gid, _ev in (authored_ev or {}).items():
        gate_ev.setdefault(_gid, _ev)

    
    
    
    
    
    if reevaluate_only:
        
        
        
        try:
            import json as _json
            _rep = Path(child_root) / ".ai" / f"reevaluate-evidence-{wid}.json"
            if _rep.is_file():
                _rj = _json.loads(_rep.read_text(encoding="utf-8"))
                if _rj.get("sha") == committed_sha:
                    for _gid, _ev in (_rj.get("gate_ev") or {}).items():
                        if _gid != "security":
                            gate_ev.setdefault(_gid, _ev)
        
        
        
        
        except Exception:  # noqa: BLE001,S110 — потеря кеша не меняет вердикт, пересчитаем
            pass
        for _gid, _ev in _reevaluate_artifact_evidence(work_root, wid, plan["gates"]).items():
            gate_ev.setdefault(_gid, _ev)

    
    
    
    exempt = set(coll.get("not_applicable") or [])
    tests_warn = None
    if coll.get("tests_absent"):
        if allow_missing_tests:
            exempt.add("tests_passed")
            tests_warn = "нет тестов в стеке — implementation_verification освобождён по tests (allow_missing_tests=True); это осознанное послабление"
        else:
            exempt.discard("tests_passed")   # тесты обязательны -> гейт заблокирует
            tests_warn = "нет тестов, а require_tests -> implementation_verification блокирует"
    not_applicable = {"implementation_verification": exempt}
    
    
    exempt_reason = {"implementation_verification": coll.get("not_applicable_reason")}

    # 6d. v2.83 Full RunPlan: постадийный НЕЗАВИСИМЫЙ ревью для ai-review гейтов плана
    #     (code_review, ux_review, security-non-human, ...). writer ≠ judge: ревьюер — отдельный
    #     вызов под READ-ONLY политикой (писать/шеллить не может), выносит СТРУКТУРНЫЙ вердикт.
    #     Честно: детерминированные артефакт-гейты (requirements/specification/plan_readiness) и
    #     human-approval (security при privileged/destructive) ревьюер НЕ закрывает — остаются
    #     блокирующими. review только на зафиксированной ревизии (иначе судить нечего).
    # v3.1.9 EXACT-SHA UI EVIDENCE (trust-фикс): собираем UI-evidence ПОСЛЕ реализации, из РАБОЧЕГО
    # worktree, на ТОЧНОМ committed_sha, по файлам, изменённым этим коммитом; связываем с committed_sha.
    # Устаревшее/непривязанное/чужое evidence (meta.commit_sha != committed_sha) -> not_run (fail-closed),
    # НЕ освобождает гейт. Инжектированный ui_evidence (bench/синтетика) используется как есть (не строим).
    ui_evidence_bundle = None
    if calibrated_enforcement and ui_evidence is None and committed_sha:
        try:
            _changed = _committed_changed_files(work_root, committed_sha)
            
            
            from ai_ops_kit.ui import ui_readiness as _uir
            _ui_run, _ui_reason = _uir.should_run_ui_evidence(_changed, signals)
            if not _ui_run:
                ui_evidence, ui_evidence_bundle = None, None
            else:
                
                
                try:
                    from ai_ops_kit.ui import ui_evidence_collect
                    ui_evidence_collect.collect(work_root, committed_sha)
                
                
                
                
                except Exception:   # noqa: BLE001,S110 — не собрали -> гейт не освобождён (fail-closed ниже)
                    pass
                ui_evidence_bundle = storybook_adapter.build_bundle(work_root, changed_files=_changed)
                ui_evidence = storybook_adapter.evidence_for_gate(ui_evidence_bundle,
                                                                  expected_sha=committed_sha)
        except Exception:   # noqa: BLE001 — сбой сбора evidence не освобождает гейт (ui_evidence=None)
            ui_evidence, ui_evidence_bundle = None, None

    
    
    
    
    seam_advisory = _seam_scan_advisory(work_root, base_sha, committed_sha)

    reviews = None
    if review and reviewer_proposer is not None and committed_sha:
        gate_ev, reviews = _run_reviews(reviewer_proposer, work_root, plan["gates"], gate_ev,
                                        signals, committed_sha, budget,
                                        calibrated_enforcement=calibrated_enforcement,
                                        ui_evidence=ui_evidence, child_root=child_root)
    elif committed_sha:
        
        
        
        
        
        gate_ev, reviews = _consume_handoff_verdicts(
            work_root, plan["gates"], gate_ev, signals, committed_sha, child_root=child_root,
            calibrated_enforcement=calibrated_enforcement, ui_evidence=ui_evidence)
        
        
        
        reviews = reviews or None

    
    
    gate_ev, security_pack_result, effective_approval_signals = _evaluate_security(
        work_root, child_root, wid, committed_sha, is_git, gate_ev, signals,
        review=review, strict_judge_qualified=strict_judge_qualified,
        security_reviewer_proposer=security_reviewer_proposer,
        reviewer_proposer=reviewer_proposer, budget=budget)
    return {"changed_for_verification": _changed_for_verification, "coll": coll, "gate_ev": gate_ev,
            "tree_clean_after_checks": tree_clean_after_checks, "regression_proof": regression_proof,
            "exempt": exempt, "not_applicable": not_applicable, "exempt_reason": exempt_reason,
            "tests_warn": tests_warn, "ui_evidence_bundle": ui_evidence_bundle,
            "seam_advisory": seam_advisory, "reviews": reviews,
            "security_pack_result": security_pack_result,
            "effective_approval_signals": effective_approval_signals}


def _seam_scan_advisory(work_root, base_sha, committed_sha):
    """v3.7.4 SEAM-SCAN (ADVISORY, non-blocking): детектор «дефекта шва» по дифу base..committed
    (запись без round-trip / catch без happy-path / stub без real-run / optional-поле / смена
    предусловия). НЕ блокирует; станет gate после обкатки. v3.38 (K6): вынесено. -> seam_advisory."""
    seam_advisory = None
    if committed_sha:
        try:
            from ai_ops_kit.security import seam_scan
            _diff = _change_context_range(work_root, base_sha, committed_sha, max_chars=20000)
            _sc = seam_scan.scan_diff(_diff or "")
            _dec = seam_scan.gate_decision(_sc)
            seam_advisory = {"mode": "advisory", "would_block": _dec["block"],
                             "blockers": _dec["blockers"], "advisories": _dec["advisories"],
                             "findings": _sc["findings"]}
        except Exception as _e:  # noqa: BLE001 — advisory-детектор не должен ронять прогон
            seam_advisory = {"error": f"seam_scan failed: {type(_e).__name__}: {_e}"[:200]}
    return seam_advisory
