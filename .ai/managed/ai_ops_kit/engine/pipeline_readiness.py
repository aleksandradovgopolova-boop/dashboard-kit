#!/usr/bin/env python3
"""Оценка готовности и security-вердикт для execution-pipeline.

Вынесено из execution_pipeline.py (v3.38, K6-глубина) без изменения поведения:
spec-depth/spec-first/приёмка/context-budget (readiness) и доменный security-вердикт.
Зависимости берутся из настоящих модулей-соседей, а не из execution_pipeline —
иначе получился бы циклический импорт.
"""
from __future__ import annotations

from ai_ops_kit.engine.pipeline_git import _change_context_range
from ai_ops_kit.engine.pipeline_failure import _diff_checks, _baseline_status_flips
from ai_ops_kit.engine.pipeline_evidence import (
    _review_security, _human_approval_domains_uncovered,
)


def _build_not_yet_list(commit, env_qualified, open_pr, spec_prestage_bad, spec_depth_missing,
                        spec_incomplete, spec_bad_status, context_overflow, approvals_cover_ok,
                        approval_recheck, acceptance_block_reason=None, checks=None):
    """Список «что ещё не сделано» — информирование вызывающего. v3.38 (K6): вынесено из run_pipeline."""
    
    
    from ai_ops_kit.gates import spec_levels as _sl
    not_yet = ["живой предложитель (swap провайдера)"]
    if acceptance_block_reason:
        
        not_yet.insert(0, f"приёмка: {acceptance_block_reason}")
    if spec_prestage_bad:
        not_yet.insert(0, "spec-first (P0.1): author вернул невалидную спецификацию ["
                       + ", ".join(str(e.get("gate")) for e in spec_prestage_bad)
                       + "] — реализация НЕ запускалась (0 tool-loop вызовов); почини author/спеку")
    if not commit:
        not_yet.insert(0, "commit+reverify (запусти с commit=True) — без коммита ready_for_pr всегда False")
    if not env_qualified:
        not_yet.insert(0, "окружение не квалифицировано: install упал И проверки не смогли отработать "
                          "(нет тулчейна/зависимостей) — почини установку стека")
    if not open_pr:
        not_yet.append("draft PR (запусти с open_pr=True + GITHUB_TOKEN)")
    if spec_depth_missing:
        not_yet.append("spec-depth: не закрыты разделы уровня " + ", ".join(spec_depth_missing))
    if spec_incomplete:
        _bad = {b["id"]: b for b in spec_bad_status}
        _empty = [s for s in spec_incomplete if s not in _bad]
        if _empty:
            not_yet.append("spec-first: features/<wid>/spec.yaml неполон — заполни разделы: "
                           + ", ".join(_empty))
        for sid, b in _bad.items():
            not_yet.append(
                f"spec-first: раздел {sid} {'заполнен, но' if b.get('has_content') else 'имеет'} "
                f"нераспознанный статус '{b.get('given')}' — допустимо: "
                + "/".join(sorted(_sl.SECTION_STATUSES - {"missing"})))
    if context_overflow:
        not_yet.append("context budget превышен — задачу нужно декомпозировать (см. work_package)")
    if not approvals_cover_ok:
        not_yet.insert(0, "human-approval: scope одобрения не покрывает изменённые пути ("
                       + ", ".join(u["domain"] for u in approval_recheck.get("uncovered") or [])
                       + ") — переодобри под фактический дифф")
    
    
    from ai_ops_kit.engine.pipeline_failure import _env_degraded_note
    _env_note = _env_degraded_note(checks)
    if _env_note:
        not_yet.append(_env_note)
    return not_yet


def _evaluate_security(work_root, child_root, wid, committed_sha, is_git, gate_ev, signals,
                       *, review, strict_judge_qualified, security_reviewer_proposer,
                       reviewer_proposer, budget):
    """Доменный security-вердикт (security/security-domains.yaml) -> gate_ev['security'].
    v3.38 (K6-глубина): вынесено из run_pipeline без изменения поведения.

    Проверяются только ПРИМЕНИМЫЕ к изменению домены; детерминированные (secrets/deps/
    injection) блокируют по severity; домены с security_reviewer/human -> needs_review
    (судья/человек). security проходит ТОЛЬКО если pack 'clear'. Возвращает обновлённый
    gate_ev, результат пака и effective_approval_signals (намерение + findings-derived).
    -> (gate_ev, security_pack_result, effective_approval_signals)."""
    security_pack_result = None
    _security_scan_error = None
    
    
    
    
    if committed_sha and is_git and "security" not in gate_ev:
        from ai_ops_kit.security import security_pack
        try:
            security_pack_result = security_pack.run_pack(work_root, base=f"{committed_sha}~1", signals=signals)
        except Exception as _e:  # noqa: BLE001
            _security_scan_error = str(_e)
            security_pack_result = None
    
    
    effective_approval_signals = dict(signals)   # v3.0-rc2 (P0.5): signals намерения + findings-derived
    if _security_scan_error:
        gate_ev = dict(gate_ev)
        gate_ev["security"] = {"status": "fail",
                               "blockers": [f"security scan упал (fail-closed): {_security_scan_error}"]}
    elif security_pack_result:
        overall = security_pack_result["overall"]
        gate_ev = dict(gate_ev)
        
        
        
        
        from ai_ops_kit.gates import approvals as _appr
        _merged_sig = {**signals, **_appr.signals_from_findings(security_pack_result)}
        effective_approval_signals = _merged_sig   # v3.0-rc2 (P0.5): используется и в recheck ниже
        _appr_missing = list(_appr.check(_merged_sig, child_root, wid).get("missing") or [])
        if _merged_sig.get("destructive"):
            _recs = _appr.load_approvals(child_root, wid)
            
            
            
            
            _dnow = _appr._now_iso()
            _dph = _appr.plan_binding_hash(child_root, wid)
            if not any(r.get("approval") == "destructive"
                       and _appr._record_valid(r, now=_dnow, plan_hash=_dph, strict=True) for r in _recs):
                _appr_missing.append({"domain": "destructive",
                                      "reason": "нет строго-валидного ApprovalRecord для деструктивного "
                                                "действия (expiry/plan-binding/trusted source)"})
        human_ok = not _appr_missing
        if not human_ok:
            
            
            gate_ev["security"] = {"status": "fail",
                                   "blockers": [f"{m['domain']}: {m.get('reason', 'нужно человеко-одобрение (ApprovalRecord)')}"
                                                for m in _appr_missing],
                                   "approvals_missing": _appr_missing,
                                   "pack": {"applicable": security_pack_result["applicable_domains"]}}
        elif overall in ("clear", "advisory"):
            
            
            
            _adv = security_pack_result.get("advisory") or []
            gate_ev["security"] = {"status": "pass",
                                   "provided": ["no_secrets", "no_injection_surface", "deps_approved"],
                                   "advisory": _adv,
                                   "pack": {"applicable": security_pack_result["applicable_domains"],
                                            "advisory": _adv,
                                            "note": ("все применимые security-домены закрыты детерминированным evidence"
                                                     if not _adv else
                                                     "детерминированные проверки чисты; домены "
                                                     + ", ".join(_adv) + " подняты только совпадением по "
                                                     "содержимому и без находок — предупреждение, не ворота")}}
        elif (overall == "needs_review" and not security_pack_result["blocking"]
              and committed_sha and not (strict_judge_qualified and review)
              and not (signals or {}).get("_sequence_internal")):
            
            
            
            
            
            from ai_ops_kit.gates import approvals as _appr_sec
            _sec_recs = _appr_sec.load_approvals(child_root, wid)
            _sec_now, _sec_ph = _appr_sec._now_iso(), _appr_sec.plan_binding_hash(child_root, wid)
            _sec_domains = {"security", "security_review", *security_pack_result["needs_review"]}
            # v3.8.3: одобрение валидно, если привязано к ревизии плана (_sec_ph) ЛИБО к ТОЧНОМУ committed_sha.
            # SHA-binding стабилен при reevaluate (SHA не меняется, даже если run() перезаписал run-plan.yaml)
            # и семантически сильнее: человек одобряет КОНКРЕТНЫЙ код, а не ревизию плана (как aggregate #4b).
            def _appr_valid_here(r):
                return (_appr_sec._record_valid(r, now=_sec_now, plan_hash=_sec_ph, strict=True)
                        or (committed_sha and _appr_sec._record_valid(r, now=_sec_now, plan_hash=committed_sha, strict=True)))
            _human_closed = any(r.get("approval") in _sec_domains and _appr_valid_here(r) for r in _sec_recs)
            if _human_closed:
                gate_ev["security"] = {"status": "pass",
                                       "provided": ["no_secrets", "no_injection_surface", "deps_approved"],
                                       "human_approved": True,
                                       "pack": {"applicable": security_pack_result["applicable_domains"],
                                                "note": "нет qualified security-судьи -> needs_review закрыт "
                                                        "человеком (валидный ApprovalRecord)"}}
            else:
                _why_no_judge = ("судья на этом уровне задачи выключен автоподбором"
                                 if not review else "нет QUALIFIED security-судьи")
                gate_ev["security"] = {"status": "fail", "human_handoff": True, "pending_human": True,
                                       "blockers": [_why_no_judge + ": needs_review домены "
                                                    "закрывает ТОЛЬКО квалифицированный судья или человек "
                                                    "(валидный ApprovalRecord); общий code reviewer НЕ "
                                                    "закрывает security. Домены: "
                                                    + ", ".join(security_pack_result["needs_review"])
                                                    + ". Человеку закрыть так: python3 "
                                                    ".ai/managed/ai_ops_kit/gates/approvals.py record . "
                                                    + str(wid) + " --approval <домен> --by <кто> "
                                                    "--scope <что> --reason <почему>"],
                                       "pack": {"applicable": security_pack_result["applicable_domains"],
                                                "needs_review": security_pack_result["needs_review"]}}
        elif (overall == "needs_review" and not security_pack_result["blocking"]
              and review and committed_sha and (security_reviewer_proposer or reviewer_proposer) is not None):
            
            
            
            sec_status, sec_res = _review_security(security_reviewer_proposer or reviewer_proposer, work_root,
                                                   security_pack_result, committed_sha, budget)
            if sec_status == "pass":
                gate_ev["security"] = {"status": "pass",
                                       "provided": ["no_secrets", "no_injection_surface", "deps_approved"],
                                       "reviewer": {"status": sec_status},
                                       "pack": {"applicable": security_pack_result["applicable_domains"],
                                                "note": "детерминированные домены чисты + независимый "
                                                        "security-reviewer вынес pass по needs_review"}}
            else:
                
                
                
                _inv = sec_res.get("invalid") if isinstance(sec_res, dict) else None
                _raw = (sec_res.get("raw") if isinstance(sec_res, dict) and "raw" in sec_res else sec_res)
                _diag = {}
                if isinstance(_raw, dict):
                    _dr = _raw.get("domain_results")
                    _diag = {"raw_keys": sorted(_raw.keys()),
                             "has_domain_results": isinstance(_dr, list) and bool(_dr),
                             "domain_results_count": len(_dr) if isinstance(_dr, list) else 0}
                gate_ev["security"] = {"status": "fail", "blockers": ["security-reviewer не вынес pass"],
                                       "reviewer": {"status": sec_status},
                                       "verdict_errors": _inv, "verdict_diag": _diag,
                                       "pack": {"applicable": security_pack_result["applicable_domains"],
                                                "needs_review": security_pack_result["needs_review"]}}
        else:
            blockers = []
            if security_pack_result["blocking"]:
                blockers.append("блокирующие домены (critical/high находки): " + ", ".join(security_pack_result["blocking"]))
            if security_pack_result["needs_review"]:
                blockers.append("нужен независимый security-reviewer/человек по доменам: "
                                + ", ".join(security_pack_result["needs_review"]))
            gate_ev["security"] = {"status": "fail", "blockers": blockers,
                                   "pack": {"applicable": security_pack_result["applicable_domains"],
                                            "blocking": security_pack_result["blocking"],
                                            "needs_review": security_pack_result["needs_review"]}}

        
        
        
        
        
        
        
        
        try:
            from ai_ops_kit.security import security_scan as _ss
            _sec_changed = _ss._git_changed_files(work_root, committed_sha + "^") if committed_sha else []
        except Exception:  # noqa: BLE001
            _sec_changed = []
        _hu = _human_approval_domains_uncovered(child_root, wid, _sec_changed, diff_root=work_root)
        if _hu and (gate_ev.get("security") or {}).get("status") != "fail":
            gate_ev["security"] = {"status": "fail",
                                   "blockers": ["high-risk изменение по путям без человеческого ApprovalRecord "
                                                "(reviewer не закрывает): " + ", ".join(_hu)],
                                   "human_approval_uncovered": _hu,
                                   "pack": {"applicable": security_pack_result["applicable_domains"]}}
    return gate_ev, security_pack_result, effective_approval_signals


def _assess_readiness(gates, coll, signals, plan, child_root, wid, work_root, *,
                      baseline_diff, baseline_checks, committed_sha, base_sha,
                      reviewer_proposer, budget):
    """Ready-критерии уровня спеки: spec-depth enforcement (незакрытые разделы уровня, мапящиеся на
    unmet-гейты), Real Spec-First (реальный spec.yaml неполон -> блок), сверка критериев приёмки
    независимым судьёй (B2-14, не блокирует, но unmet при verified блокирует у вызывающего) и
    context-budget overflow.

    K6: вынесено из run_pipeline без изменения поведения. -> dict (spec_depth_missing/spec_depth_ok/
    spec_incomplete/spec_bad_status/spec_complete_ok/level/acceptance_criteria/context_overflow).
    """
    
    
    
    
    from ai_ops_kit.gates import spec_levels as _sl
    _SECTION_GATE = {
        "goal": "intake_completeness", "scope": "intake_completeness",
        "acceptance_criteria": "intake_completeness",
        "requirements": "requirements", "acceptance_scenarios": "requirements",
        "implementation_plan": "plan_readiness", "verification_strategy": "implementation_verification",
        "problem": "discovery_completeness", "users_jtbd": "discovery_completeness",
        "value": "discovery_completeness", "success_metrics": "analytics_readiness",
    }
    _unmet = set(gates["unmet_gates"])
    
    
    
    
    
    
    
    _iv_baseline_exempt = bool(baseline_diff) and not _diff_checks(baseline_checks, coll["checks"])[0]
    _unmet_for_spec = (_unmet - {"implementation_verification"}) if _iv_baseline_exempt else _unmet
    
    
    
    
    
    _unstable_checks = _baseline_status_flips(baseline_checks, coll["checks"]) if baseline_diff else []
    _level = _sl.classify(signals)["level"]
    _req_sections = set(_sl.required_sections(_level))
    spec_depth_missing = sorted({s for s, g in _SECTION_GATE.items()
                                 if s in _req_sections and g in plan["gates"] and g in _unmet_for_spec})
    spec_depth_ok = not spec_depth_missing

    
    
    
    
    spec_incomplete, spec_bad_status = [], []
    try:
        _cov = _sl.assess_from_artifacts(signals, child_root, wid, work_root=work_root)
        if _cov.get("spec_artifact") and _cov.get("blocking_missing"):
            spec_incomplete = list(_cov["blocking_missing"])
        # F-013: разделы с содержимым, но нераспознанным статусом — это НЕ «не заполнено».
        # Прежний вывод отправлял заполнять уже заполненное; настоящая правка — одно слово.
        spec_bad_status = list(_cov.get("invalid_status") or [])
    except Exception as _e:  # noqa: BLE001 — v3.0.11 (finding аудита P2): FAIL-CLOSED. Прежде исключение
        
        
        spec_incomplete = [f"<spec-assess-failed: {type(_e).__name__}>"]
    spec_complete_ok = not spec_incomplete

    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    from ai_ops_kit.engine import acceptance_verify as _av
    _ac_text, _ac_items, _ac_problem = _av.criteria_from_spec(child_root, wid)
    
    
    
    
    
    if _ac_items and reviewer_proposer is not None and committed_sha:
        try:
            
            
            
            
            
            acceptance_criteria = _av.verify(
                work_root, _ac_items, reviewer_proposer, revision=committed_sha,
                change_context=_change_context_range(work_root, base_sha, committed_sha),
                budget=budget)
        except Exception as _e:  # noqa: BLE001 — FAIL-CLOSED: сбой сверки = «не сверено» с названной
            
            
            acceptance_criteria = _av._unverified(
                _ac_items, f"сверка не выполнена ({type(_e).__name__}: {_e})"[:300], attempted=True)
    elif _ac_problem:
        
        
        acceptance_criteria = _av._unverified(
            [], f"критерии приёмки НЕ прочитаны: {_ac_problem} — сверка невозможна, проверь вручную",
            declared=True)
    elif _ac_text and not _ac_items:
        
        acceptance_criteria = _av._unverified(
            [], "раздел критериев заполнен, но ни одного проверяемого пункта в нём не найдено — "
                "сверять нечего по существу (проверь формат: пункты списка или строки)",
            declared=True)
    else:
        acceptance_criteria = _av._unverified(
            _ac_items,
            ("критерии объявлены, но с результатом НЕ сверялись: независимый ревьюер не запускался "
             "(нужны --execute с коммитом и провайдер судьи); `spec-coverage: complete` означает "
             "«раздел заполнен», а не «критерий выполнен»"
             if _ac_items else "критерии приёмки не объявлены — сверять нечего"),
            declared=bool(_ac_items))

    
    
    
    
    context_overflow = _context_budget_overflow(signals, work_root, plan)
    return {"spec_depth_missing": spec_depth_missing, "spec_depth_ok": spec_depth_ok,
            "spec_incomplete": spec_incomplete, "spec_bad_status": spec_bad_status,
            "spec_complete_ok": spec_complete_ok, "level": _level,
            "acceptance_criteria": acceptance_criteria, "context_overflow": context_overflow,
            "iv_baseline_exempt": _iv_baseline_exempt, "unstable_checks": _unstable_checks}


def _context_budget_overflow(signals, work_root, plan):
    """v2.106 #3 Context-budget: контекст задачи превышает бюджет (ContextBundle overflow) -> пакет
    не атомарен -> блок ready. FAIL-CLOSED: ошибка сборки bundle = overflow. v3.38 (K6): вынесено.
    -> context_overflow (bool)."""
    context_overflow = False
    try:
        from ai_ops_kit.context import context_compiler as _cc
        _bundle = _cc.compile_bundle(signals, work_root, plan=plan)
        context_overflow = bool(_bundle.get("overflow"))
    except Exception:  # noqa: BLE001 — v3.0.11 (P2): FAIL-CLOSED. Прежде исключение -> overflow=False ->
        
        context_overflow = True
    return context_overflow
