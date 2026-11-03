#!/usr/bin/env python3
"""Единый execution-pipeline (v2.58, P0-эпик) — СБОРКА исполнения в один движок.

Аудит: компоненты есть, но не собраны; generic-путь гонял doc-оркестратор, а не tool-loop.
Этот модуль соединяет уже построенные части в ОДНУ цепочку:

  detect (RepositoryProfile) -> tool-loop (модель предлагает, Policy решает, Broker исполняет,
  результат в контекст) -> evidence collector (реальный прогон build/lint/typecheck/test через
  Broker) -> RunPlan-гейты (base_workflow + треки) -> единый отчёт.

Честная граница (НЕ имитируется): commit + reverify на точном SHA и открытие draft PR — ещё НЕ
здесь (нужен git-commit шаг и живой прогон); pipeline доводит до «изменения применены + evidence
собран + гейты оценены». Механика детерминирована и тестируется offline mock-предложителем;
живой предложитель — swap провайдера (как tool_loop.make_model_proposer).

Использование (программно):
  run_pipeline(task, signals, child_root, proposer, policy, budget, max_steps) -> отчёт.
  execution_pipeline.py --selftest
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

from ai_ops_kit.shared import _bootstrap  # noqa: E402
from ai_ops_kit.shared import project_detector      # noqa: E402
from ai_ops_kit.engine import tool_loop             # noqa: E402
from ai_ops_kit.engine import run_plan              # noqa: E402  (build_plan в run_pipeline)






from ai_ops_kit.engine.pipeline_helpers import (  # noqa: E402,F401
    _profile_summary, _intake_evidence, NO_SELF_REVIEW, _reviewable_gates,
    _gate_checklist, _parse_yaml_block, _openspec_validate, _authoring_specs,
    acceptance_blocks_ready,
)
from ai_ops_kit.engine.pipeline_git import (  # noqa: E402,F401
    _git, _has_changes, _head_advanced, _tree_clean, _TOOL_CACHE_RE, _tree_clean_after_checks,
    _untracked, _committed_changed_files, _commit_on_branch, _resolve_base,
    _verify_remote_base, _reverify_against_current_target, _change_context, _change_context_range,
    delivery_preflight as _delivery_preflight,
    managed_drift_preflight as _managed_drift_preflight,
)
from ai_ops_kit.engine.pipeline_failure import (  # noqa: E402,F401
    _ENV_SYMPTOMS, _check_has_env_symptom, _env_proven_ok, _env_unqualified,
    _baseline_failure_summary, _failure_signal, _FAILURE_ID_PATTERNS,
    _VOLATILE_RE, _normalize_failure_id, _failure_ids, _diff_checks,
    _evidence_ref_errors, _security_verdict_errors,
)
from ai_ops_kit.engine.pipeline_evidence import (  # noqa: E402,F401
    _install_dependencies, _author_with_retry, _run_spec_authoring,
    _run_authoring, _authored_context, _reevaluate_artifact_evidence,
    _run_reviews, _review_security, _human_approval_domains_uncovered,
    contour_consistency_evidence,          # v3.35: исполнение гейта connectivity контуров
)



from ai_ops_kit.engine.pipeline_readiness import (  # noqa: E402,F401
    _assess_readiness, _build_not_yet_list, _evaluate_security,
)




from ai_ops_kit.engine.pipeline_setup import (  # noqa: E402,F401
    _setup_isolation, _prepare_environment, _commit_work, _assemble_evidence,
    _seam_scan_advisory, _provision_kit_gate_tools, _coordinator_bin_dir,
)





from ai_ops_kit.engine.pipeline_stages import (  # noqa: E402,F401
    _build_loop_section, _build_commit_section, _build_containment, _plan_delivery,
    _compute_overall_status, _security_pack_for_report, _pipeline_check_spec_drift,
    _pipeline_resolve_policy, _pipeline_run_gates, _pipeline_assess_readiness,
    _pipeline_check_invariants,
)


def _deliver_pr(work_root, work_branch, base_ref, base_sha, base_binding, committed_sha, wid, task,
                delivery_id=None):
    """v3.0.15/v3.0.16 (finding аудита P0/#1): доверенная доставка draft PR — единственная точка открытия
    PR. Fail-closed по remote base (verified-equal -> PR; unverifiable/moved -> НЕ открываем). Вызывается
    ИСКЛЮЧИТЕЛЬНО транзакционным контроллером (ai_ops_run) ПОСЛЕ durable-фиксации RunHandoff+final report+
    journal+DeliveryIntent. run_pipeline НИКОГДА не вызывает эту функцию (только возвращает DeliveryPlan) —
    так прямой вызов pipeline не может обойти lifecycle-барьер. Идемпотентно (pr_open находит существующий
    PR ветки и возвращает 'updated', не создавая дубль). -> delivery dict."""
    delivery = {"requested": True, "base_binding": base_binding}
    if not base_binding.get("resolved") or not base_sha:
        delivery.update(status="unavailable",
                        reason=f"base '{base_ref}' не разрешилась в ветку: {base_binding.get('reason')} "
                               "— PR к произвольному HEAD не открываем")
        return delivery
    _rev = _reverify_against_current_target(work_root, base_ref, base_sha, committed_sha)
    if _rev.get("verdict") == "unverifiable":
        delivery.update(status="unavailable",
                        reason=f"remote-base-unverified: {_rev.get('reason')} — доставка невозможна fail-closed")
        return delivery
    if _rev.get("stale"):
        delivery.update(status="stale-needs-reverify", reason=_rev.get("reason"),
                        evidence_base=_rev.get("evidence_base"),
                        current_target=_rev.get("current_target"), merge_preview=_rev.get("merge_preview"))
        return delivery
    from ai_ops_kit.delivery import pr_open
    from ai_ops_kit.engine import living_status as _living_status
    # #404: тело PR называет судьбу статус-доков — обновлены или почему нет; read-only, не бросает.
    status_docs = _living_status.describe(work_root)
    pr = pr_open.open_draft_pr(work_root, work_branch, title=f"ai-ops: {task[:60]}", base=base_ref,
                               body=pr_open.pr_body(wid, base_ref, base_sha, committed_sha, status_docs),
                               delivery_id=delivery_id)
    delivery.update(status=(pr or {}).get("status"), pr=pr, status_docs=status_docs)
    return delivery


def _pipeline_build_report(*, plan, child_root, profile, sandbox, pol, loop, applied,
                           worktree_rel, base_binding, resume_info, prepare, prepare_ok,
                           env_qualified, prepare_mutated_tree, work_branch, committed_sha,
                           work_produced_by, tree_clean_before_checks, author, author_proposer,
                           authored, spec_prestage_bad, ev, rd, gates, ready, delivery, delivery_plan,
                           overall_status, not_yet):
    """Фаза сборки отчёта прогона: чистая проекция состояния фаз в единый result-dict.
    Локальные имена совпадают с именами из фаз, чтобы тело отчёта осталось прозрачным
    (и швы-пробы, ссылающиеся на конкретные строки, оставались стабильны)."""
    from ai_ops_kit.gates import spec_levels as _sl   # для report.spec_first (_spec_path) ниже
    wid = plan["workitem_id"]
    _changed_for_verification = ev["changed_for_verification"]
    coll = ev["coll"]
    tree_clean_after_checks = ev["tree_clean_after_checks"]
    regression_proof = ev["regression_proof"]
    exempt = ev["exempt"]
    tests_warn = ev["tests_warn"]
    ui_evidence_bundle = ev["ui_evidence_bundle"]
    seam_advisory = ev["seam_advisory"]
    reviews = ev["reviews"]
    security_pack_result = ev["security_pack_result"]
    evidence_revision = rd["evidence_revision"]
    revision_matches = rd["revision_matches"]
    other_blocking_unmet = rd["other_blocking_unmet"]
    approval_recheck = rd["approval_recheck"]
    contour_consistency = rd["contour_consistency"]
    regressions, fixed = rd["regressions"], rd["fixed"]
    no_regressions = rd["no_regressions"]
    baseline_diff = rd["baseline_diff"]
    baseline_checks = rd["baseline_checks"]
    ready_criterion = rd["ready_criterion"]
    _level = rd["level"]
    spec_depth_missing = rd["spec_depth_missing"]
    spec_depth_ok = rd["spec_depth_ok"]
    spec_incomplete = rd["spec_incomplete"]
    spec_complete_ok = rd["spec_complete_ok"]
    context_overflow = rd["context_overflow"]
    acceptance_criteria = rd["acceptance_criteria"]
    report = {
        "schema_version": 1, "kind": "execution-pipeline",
        "workitem_id": plan["workitem_id"],
        "child_root": str(child_root),          # нужен вывода: уровень детализации берётся из репо
        "base_workflow": plan["base_workflow"],
        "profile": {"stacks": [s.get("language") for s in profile.get("stacks", [])],
                    "undetermined": profile.get("undetermined", [])},
        "containment": _build_containment(sandbox, pol, loop),
        "loop": _build_loop_section(loop, applied),
        
        
        
        "isolation": {"worktree": worktree_rel,     # каталог изоляции (None -> прогон в основном дереве)
                      "sandboxed": bool(sandbox),
                      "network": "on" if pol.allow_network else "restricted"},
        "base_binding": base_binding,              # v3.0.1 (P0): base_ref + base_sha, от которого форкнута ветка
        "resume": resume_info,                     # v2.109: продолжение поверх подтверждённой работы (None если resume не запрошен)
        "prepare": prepare,                        # установка зависимостей стека (npm ci/... ) в worktree; None вне изоляции
        "prepare_ok": prepare_ok,                  # install-команды стека прошли (для наблюдаемости)
        "env_qualified": env_qualified,            # v2.118: install прошёл ЛИБО проверки реально отработали
        "prepare_mutated_tree": prepare_mutated_tree,  # P0.6: подготовка меняла tracked -> откачено до модели
        "commit": _build_commit_section(work_branch, committed_sha, evidence_revision,
                                        revision_matches, _changed_for_verification,
                                        work_produced_by, tree_clean_before_checks,
                                        tree_clean_after_checks),
        # v3.30: доказательство исправления — в отчёте, а не только в вердикте гейта: постфактум
        # видно, ЧЕМ подтверждена правка (или почему не подтверждена).
        "regression": regression_proof,
        "checks": coll["checks"],
        "verification": coll.get("verification"),
        "exemptions": sorted(exempt),          # флаги, освобождённые как неприменимые (видно, не тихо)
        "tests_warn": tests_warn,              # громкий сигнал об отсутствии тестов (если есть)
        "gates": {"evaluated": gates["evaluated_gates"], "unmet": gates["unmet_gates"],
                  "blocked": gates["blocked"],
                  "other_blocking_unmet": other_blocking_unmet,   # P0.1: блокирующие ≠ impl_verification
                  
                  
                  
                  "closure": gates.get("closure"),
                  "claim_origins": gates.get("claim_origins"),
                  
                  
                  "evidence_verdict": gates.get("evidence_verdict"),
                  
                  "gate_results": gates.get("gate_results"),
                  "tested_revision": committed_sha},
        
        "approval_recheck": approval_recheck,
        # v3.35.2: НАХОДКИ ГЕЙТА СВЯЗНОСТИ ДОХОДЯТ ДО ЧЕЛОВЕКА. Гейт исполнялся и писал evidence, но
        # вывод прогона о нём молчал: «описание продукта отстало от кода» существовало только внутри
        # yaml-артефакта. Гейт, чьи находки не видны, — это гейт, которого нет.
        "contour_consistency": contour_consistency,
        
        
        "reviews": reviews,
        # v3.1.9: UIEvidenceBundle, собранный на ТОЧНОМ committed_sha (qualification evidence). None,
        # если калибровка выкл / evidence инжектировано / нет коммита. commit_sha в bundle привязан.
        "ui_evidence": ui_evidence_bundle,
        # v3.7.4: seam-scan advisory (дефект шва по дифу base..committed). would_block=true -> шов без
        # доказанного перехода; пока advisory (не влияет на overall), станет gate после обкатки.
        "seam_scan": seam_advisory,
        # v2.95: детерминированный security-скан (секреты/новые зависимости/injection-флаги). None,
        # если гейта security нет в плане или не коммитили. Закрывает no_secrets/deps_approved (факты);
        # no_injection_surface — судье. Находка -> security блокирует.
        # ЗАЯВКА #139 (вторая половина): здесь стояли ровно четыре поля, и `domain_results` — где
        # лежат САМИ находки (path/line/класс) и `applies_because` — в отчёт не попадали вовсе.
        # Гейт отправляет человека в этот артефакт со словами «блокирующие домены (critical/high
        # находки)», поэтому отчёт без находок делает утверждение гейта непроверяемым. Проекция
        # `security_pack.for_report` — белый список полей: значения секретов и содержимое файлов в
        # отчёт не уезжают (он лежит в репозитории и попадает в PR).
        "security_scan": _security_pack_for_report(security_pack_result),
        
        
        "authored": authored,
        # baseline-diff: None вне режима; иначе — статусы проверок на базе + регрессии/починки
        "baseline": ({"checks": {k: (v or {}).get("status") for k, v in (baseline_checks or {}).items()},
                      "regressions": regressions, "fixed": fixed, "no_regressions": no_regressions,
                      "unstable_checks": rd.get("unstable_checks") or []} if baseline_diff else None),
        "ready_criterion": ready_criterion,    # all-green | no-regressions
        
        
        "spec_depth": {"level": _level, "missing": spec_depth_missing, "ok": spec_depth_ok},
        
        "spec_first": {"artifact_present": bool(spec_incomplete) or _sl._spec_path(child_root, wid).is_file(),
                       "incomplete_sections": spec_incomplete, "ok": spec_complete_ok,
                       
                       "prestage": {"ran": bool(author and author_proposer is not None),
                                    "invalid": [e.get("gate") for e in spec_prestage_bad],
                                    "implementation_skipped": bool(spec_prestage_bad)}},
        "context_overflow": context_overflow,
        "acceptance_criteria": acceptance_criteria,   # B2-14: сверялись ли критерии с результатом
        # honest: «готово к PR» = петля done + коммит + evidence на SHA + prepare_ok + spec-depth +
        # не-overflow + (all-green: гейты не блокируют | no-regressions: нет новых провалов И blocking-гейты пройдены)
        "ready_for_pr": ready,
        "delivery": delivery,                  # P0.4: статус доставки draft PR отдельно от ready
        "delivery_plan": delivery_plan,        # v3.0.15 (P0): план для контроллера при defer_delivery
        "overall_status": overall_status,      # error | delivery-failed | delivered | ready-undelivered
        "draft_pr": delivery.get("pr"),        # результат открытия PR (None если deferred/не открыт)
        "not_yet": not_yet,
    }
    return report


def run_pipeline(task, signals, child_root, proposer, policy=None, budget=None,
                 max_steps=40, feature=None, commit=False, allow_missing_tests=True,
                 isolate=False, open_pr=False, install_deps=True, baseline_diff=False,
                 require_fix=False, discard_previous=False, sandbox=False,
                 review=False, reviewer_proposer=None,
                 author=False, author_proposer=None, plan=None, context_prelude=None,
                 resume=False, resume_context=None, write_scope=None, base=None, defer_delivery=False,
                 calibrated_enforcement=False, ui_evidence=None,   # v3.1.8 калиброванное UI-enforcement
                 strict_judge_qualified=True,   # v3.7.1: есть ли QUALIFIED security/integration судья
                 security_reviewer_proposer=None,   # v3.7.3 (#5): ОТДЕЛЬНЫЙ security-судья (не общий reviewer)
                 reevaluate_only=False, verification_intent="merge_candidate"):   # v3.8.4: переоценить гейты существующего HEAD БЕЗ переавторинга
    """Один прогон движка: [worktree-изоляция] -> детект -> правки через tool-loop ->
    [commit на ветке] -> evidence (на зафиксированном SHA) -> гейты RunPlan.

    v2.108 (Operational Context): context_prelude — compiled payload из ContextBundle (реальное
    содержимое релевантных правил/решений/спек), который РЕАЛЬНО попадает в prompt модели (prepend к
    base_context tool loop) — не только статистика в отчёте.

    v2.109 (Real Resume): resume=True — ПРОДОЛЖИТЬ WorkItem поверх уже подтверждённой работы, а не
    начинать заново. Ветка ai-ops/<wid> и её коммиты НЕ удаляются (иначе потеряли бы результат);
    worktree переиспользуется (или пере-подключается к сохранившейся ветке). resume_context —
    состояние из RunHandoff (что сделано/решения/следующий шаг), реально подаётся модели в начало
    prompt, чтобы она продолжила, а не переделала подтверждённое.

    v2.94 (One Run Transaction): если plan передан контроллером — используем ЕГО (не строим второй),
    чтобы pipeline и lifecycle жили в одной транзакции с общим WorkItem/RunPlan."""
    from ai_ops_kit.gates import verification_tiers
    if verification_intent is None:
        verification_intent = "merge_candidate"
    try:
        verification_tiers.decide_tier([], lifecycle_intent=verification_intent)
    except ValueError as exc:
        return {"kind": "execution-pipeline", "status": "error", "ready_for_pr": False, "error": str(exc)}
    from ai_ops_kit.shared import budget as budget_mod
    signals = dict(signals or {})
    try:
        budget = budget_mod.resolve_budget(budget, signals.get("execution_budget"),
                                           (plan or {}).get("execution_budget"))
        budget.ensure_execution_supported()
    except (ValueError, budget_mod.BudgetExceeded) as exc:
        return {"schema_version": 1, "kind": "execution-pipeline", "status": "blocked", "ready_for_pr": False,
                "blocked_by": "execution-budget", "error": str(exc)}
    # K0-проводка: сверка параметров прогона с контрактом ядра (страж дрейфа kernel/ports).
    _pipeline_check_spec_drift(task, signals, child_root, feature, write_scope,
                               max_steps=max_steps, commit=commit, baseline_diff=baseline_diff,
                               require_fix=require_fix, sandbox=sandbox, review=review, author=author)
    child_root = Path(child_root)
    signals = dict(signals or {})
    signals.setdefault("task_text", task)

    
    
    if plan is None:
        plan = run_plan.build_plan(signals, workitem_id=feature)
    plan["execution_budget"] = budget.limits()
    wid = plan["workitem_id"]

    
    
    _iso = _setup_isolation(child_root, wid, base, isolate=isolate, resume=resume,
                            reevaluate_only=reevaluate_only, discard_previous=discard_previous,
                            open_pr=open_pr)
    if _iso.get("error"):
        return _iso["error"]
    work_root, worktree_rel = _iso["work_root"], _iso["worktree_rel"]
    resume_info, base_binding = _iso["resume_info"], _iso["base_binding"]
    base_ref, base_sha, delivery_pf = _iso["base_ref"], _iso["base_sha"], _iso["delivery_pf"]

    
    profile = project_detector.detect(work_root)

    
    pol = _pipeline_resolve_policy(policy, sandbox, work_root, write_scope)
    is_git = _git(work_root, "rev-parse", "--is-inside-work-tree")[0] == 0

    
    prepare, prepare_ok, baseline_checks, prepare_mutated_tree = _prepare_environment(
        profile, work_root, pol, is_git, install_deps=install_deps, isolate=isolate,
        baseline_diff=baseline_diff)

    
    
    ctx, authored, authored_ev, spec_prestage_bad = _assemble_context_and_author(
        task, profile, plan, wid, work_root, budget,
        context_prelude=context_prelude, resume_context=resume_context,
        baseline_diff=baseline_diff, baseline_checks=baseline_checks,
        author=author, author_proposer=author_proposer, reevaluate_only=reevaluate_only)

    
    loop, applied, shell_changed, self_committed, head_sha = _run_tool_loop(
        proposer, work_root, pol, ctx, is_git, budget=budget, max_steps=max_steps,
        reevaluate_only=reevaluate_only, spec_prestage_bad=spec_prestage_bad)

    
    
    committed_sha, work_branch, work_produced_by, tree_clean_before_checks = _commit_work(
        work_root, wid, task, is_git, applied, authored, shell_changed, self_committed, head_sha,
        commit=commit, reevaluate_only=reevaluate_only)

    
    
    _ev = _assemble_evidence(
        profile, work_root, pol, child_root, wid, plan, signals, loop,
        commit=commit, is_git=is_git, committed_sha=committed_sha, base_sha=base_sha,
        authored_ev=authored_ev, allow_missing_tests=allow_missing_tests,
        calibrated_enforcement=calibrated_enforcement, ui_evidence=ui_evidence,
        review=review, reviewer_proposer=reviewer_proposer, budget=budget,
        strict_judge_qualified=strict_judge_qualified,
        security_reviewer_proposer=security_reviewer_proposer, reevaluate_only=reevaluate_only,
        verification_intent=verification_intent)
    
    
    coll = _ev["coll"]
    gate_ev = _ev["gate_ev"]
    tree_clean_after_checks = _ev["tree_clean_after_checks"]
    not_applicable = _ev["not_applicable"]
    exempt_reason = _ev["exempt_reason"]
    security_pack_result = _ev["security_pack_result"]
    effective_approval_signals = _ev["effective_approval_signals"]

    
    gates = _pipeline_run_gates(plan, gate_ev, committed_sha, signals, not_applicable, exempt_reason,
                                reevaluate_only=reevaluate_only, worktree_rel=worktree_rel,
                                child_root=child_root, wid=wid)

    # 8-вердикт: готовность к PR — evidence-ревизия, spec-depth, baseline-diff, окружение,
    #            перепроверка одобрений и связности контуров, итоговый ready (фазовый помощник).
    rd = _pipeline_assess_readiness(
        gates, coll, signals, plan, child_root, wid, work_root,
        baseline_diff=baseline_diff, baseline_checks=baseline_checks,
        committed_sha=committed_sha, base_sha=base_sha,
        reviewer_proposer=reviewer_proposer, budget=budget, loop=loop,
        require_fix=require_fix, tree_clean_before_checks=tree_clean_before_checks,
        tree_clean_after_checks=tree_clean_after_checks, prepare_ok=prepare_ok,
        commit=commit, effective_approval_signals=effective_approval_signals,
        security_pack_result=security_pack_result, gate_ev=gate_ev)
    ready = rd["ready"]
    env_qualified = rd["env_qualified"]
    approval_recheck = rd["approval_recheck"]
    approvals_cover_ok = rd["approvals_cover_ok"]
    acceptance_block = rd["acceptance_block"]
    acceptance_block_reason = rd["acceptance_block_reason"]
    spec_depth_missing = rd["spec_depth_missing"]
    spec_incomplete = rd["spec_incomplete"]
    spec_bad_status = rd["spec_bad_status"]
    context_overflow = rd["context_overflow"]

    
    
    
    
    
    
    
    
    delivery, delivery_plan, can_deliver = _plan_delivery(
        open_pr, ready, committed_sha, work_branch, base_binding, base_ref, base_sha,
        work_root, wid, task, delivery_pf)
    
    overall_status = _compute_overall_status(ready, can_deliver, open_pr)

    not_yet = _build_not_yet_list(commit, env_qualified, open_pr, spec_prestage_bad,
                                  spec_depth_missing, spec_incomplete, spec_bad_status,
                                  context_overflow, approvals_cover_ok, approval_recheck,
                                  acceptance_block_reason=(acceptance_block_reason if acceptance_block else None), checks=coll["checks"])

    
    report = _pipeline_build_report(
        plan=plan, child_root=child_root, profile=profile, sandbox=sandbox, pol=pol,
        loop=loop, applied=applied, worktree_rel=worktree_rel, base_binding=base_binding,
        resume_info=resume_info, prepare=prepare, prepare_ok=prepare_ok,
        env_qualified=env_qualified, prepare_mutated_tree=prepare_mutated_tree,
        work_branch=work_branch, committed_sha=committed_sha,
        work_produced_by=work_produced_by, tree_clean_before_checks=tree_clean_before_checks,
        author=author, author_proposer=author_proposer, authored=authored,
        spec_prestage_bad=spec_prestage_bad, ev=_ev, rd=rd, gates=gates, ready=ready,
        delivery=delivery, delivery_plan=delivery_plan, overall_status=overall_status,
        not_yet=not_yet)
    report["budget"] = budget.to_dict()
    _pipeline_check_invariants(report)
    return report


def _assemble_context_and_author(task, profile, plan, wid, work_root, budget, *,
                                 context_prelude, resume_context, baseline_diff, baseline_checks,
                                 author, author_proposer, reevaluate_only):
    """Фаза spec-gate: собрать base_context tool-loop (task+профиль+prelude/resume+провалы базы) и
    pre-authoring по Spec-First (автор -> валидация формы -> реализация только при валидной спеке).
    v3.38 (K6): вынесено из run_pipeline. -> (ctx, authored, authored_ev, spec_prestage_bad)."""
    ctx = f"{task}\n\n{_profile_summary(profile)}"
    # v2.108: compiled payload из ContextBundle РЕАЛЬНО в prompt (не только отчёт).
    if context_prelude:
        ctx = context_prelude + "\n\n" + ctx
    
    if resume_context:
        ctx = resume_context + "\n\n" + ctx
    if baseline_diff:
        fails = _baseline_failure_summary(baseline_checks)
        if fails:
            ctx += ("\n\n=== ТЕКУЩИЕ ПРОВАЛЫ ПРОВЕРОК НА БАЗЕ (почини относящиеся к задаче; "
                    "не ломай остальное) ===\n" + fails)
    
    
    
    authored, authored_ev = None, {}
    spec_prestage_bad = []
    if author and author_proposer is not None and not reevaluate_only:
        authored_ev, authored, _wrote_art = _run_authoring(
            author_proposer, work_root, plan["gates"], {}, wid, task, budget)
        spec_prestage_bad = [e for e in (authored or []) if e.get("valid") is False]
        if not spec_prestage_bad:
            _spec_ctx = _authored_context(authored, work_root, wid)
            if _spec_ctx:
                ctx = _spec_ctx + "\n\n" + ctx
    return ctx, authored, authored_ev, spec_prestage_bad


def _run_tool_loop(proposer, work_root, pol, ctx, is_git, *, budget, max_steps,
                   reevaluate_only, spec_prestage_bad):
    """Фаза execute: снять HEAD до правок, прогнать реализацию через модель (или пропустить при
    reevaluate/невалидной pre-spec), распознать факт правок из git (broker/shell/model-commit).
    v3.38 (K6): вынесено из run_pipeline. -> (loop, applied, shell_changed, self_committed, head_sha)."""
    
    
    
    _rc_hb, _out_hb, _ = _git(work_root, "rev-parse", "HEAD") if is_git else (1, "", "")
    head_before = _out_hb.strip() if _rc_hb == 0 else None
    
    if reevaluate_only:
        # v3.8.4: НЕ авторим и НЕ гоняем loop — переоцениваем существующий HEAD как есть (0 вызовов).
        loop = {"schema_version": 1, "kind": "tool-loop-report", "stopped": "reevaluate-only",
                "steps": 0, "model_calls": 0, "executed": [], "denied": [], "evidence": [], "transcript": []}
    elif spec_prestage_bad:
        loop = {"schema_version": 1, "kind": "tool-loop-report", "stopped": "spec-prestage-failed",
                "steps": 0, "model_calls": 0, "executed": [], "denied": [], "evidence": [], "transcript": []}
    else:
        loop = tool_loop.run_loop(proposer, work_root, pol, budget=budget,
                                  max_steps=max_steps, base_context=ctx)
    applied = [e for e in loop["executed"] if e.get("op") == "write" and e.get("ok")]
    # v2.93: факт правок из git (tracked-diff ИЛИ новые untracked), не только из счётчика write —
    # иначе правки через shell (sed/форматтер) не считались «применено» и коммит терялся.
    shell_changed = bool(applied) or (is_git and _has_changes(work_root))
    
    
    self_committed, head_sha = (_head_advanced(work_root, head_before)
                                if is_git else (False, None))
    return loop, applied, shell_changed, self_committed, head_sha


def main(argv):
    print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
