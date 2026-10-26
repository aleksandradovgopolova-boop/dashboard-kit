#!/usr/bin/env python3
"""Nightly Product Health Review (v0, read-only).

Собирает delta по изменениям с последнего подтверждённого обзора и формирует утренний бриф.

Граница v0: НИЧЕГО НЕ ПРАВИТ. Только читает и синтезирует.

Структура брифа:
1. Главное одним предложением — что изменилось со вчера
2. Что требует решения (максимум 3 вопроса)
3. Чего система НЕ СТАЛА ДЕЛАТЬ и почему (обязательный раздел — строит доверие)
4. Одна рекомендация дня

Использование:
    nightly_review.py <child_root> [--since COMMIT] [--json]
    nightly_review.py --selftest

Возврат 0 — успех (бриф — данные, решение за людьми).
"""
from __future__ import annotations

import json
import re
import sys
import uuid

import yaml
from datetime import datetime
from pathlib import Path



from ai_ops_kit.intelligence.nightly_collectors import (  # noqa: F401
    _check_ci_status,
    _check_open_prs,
    _check_plan_status,
    _get_changed_files,
    _get_recent_commits,
    _git,
    run_checks,
)


from ai_ops_kit.intelligence.nightly_schedule import (  # noqa: F401
    SCHEDULE_WORKFLOW_REL,
    BRIEFS_DIR_REL,
    deliver_brief,
    format_schedule_status,
    install_schedule,
    schedule_status,
)



from ai_ops_kit.intelligence.nightly_trends import (  # noqa: F401
    HISTORY_REL,
    TREND_WINDOW_DAYS,
    compute_axis_trends,
    compute_trends,
    finding_counts,
    format_trends,
    read_history,
    record_history,
)

from ai_ops_kit.intelligence import nightly_dimensions as nd
from ai_ops_kit.intelligence.nightly_hotspots import format_hotspots_section  # noqa: F401











CONFIRMED_REL = ".ai/project/nightly-review/last-confirmed.json"


def last_confirmed(root: Path) -> dict | None:
    """Последний подтверждённый обзор. -> dict | None (обзора ещё не было).

    Битую запись НЕ считаем отсутствием: «не прочитали» и «не было» — разные ответы, и второй
    молча сдвинул бы точку отсчёта на сутки, потеряв всё, что между.
    """
    p = Path(root) / CONFIRMED_REL
    if not p.is_file():
        return None
    try:
        doc = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        return {"unreadable": f"{type(e).__name__}: {e}"}
    return doc if isinstance(doc, dict) else {"unreadable": "не объект"}


def confirm_review(root: Path, sha: str | None = None, dismissed=None) -> dict:
    """Отметить обзор разобранным: следующая дельта пойдёт отсюда.

    `dismissed` — флаги (имена проверок) ТЕКУЩЕГО обзора, которые владелец счёл ЛОЖНЫМИ
    срабатываниями. Они уходят в обратную связь и питают ИЗМЕРЕННУЮ частоту ложных (см. ниже):
    без обратной связи обзор не вправе называть свою точность числом. Флаги считаются здесь же,
    ДО сдвига точки отсчёта, — так пометка привязана к реальным находкам, а не к вчерашним.
    """
    rc, out, _ = _git(root, "rev-parse", "HEAD")
    head = sha or (out.strip() if rc == 0 else None)
    rec = {"schema_version": 1, "kind": "NightlyReviewConfirmation",
           "confirmed_at": datetime.now().isoformat(), "commit_sha": head}
    flags = review_flags(collect_delta(root))
    p = Path(root) / CONFIRMED_REL
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(rec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    record_feedback(root, flags, dismissed, commit_sha=head, confirmed_at=rec["confirmed_at"])
    return rec


















FEEDBACK_DIR_REL = ".ai/project/nightly-review/feedback"
# Порог: сколько подтверждённых обзоров С ФЛАГАМИ нужно, чтобы назвать частоту числом. Меньше —
# «не измерено». Значение осознанно скромное (v0 обкатывается на ките), поднимается по решению.
MIN_CONFIRMED_FOR_RATE = 3


def review_flags(delta: dict) -> list[str]:
    """Флаги обзора — доказанные расхождения (`ok is False`). Идентификатор флага = имя проверки.

    «Не проверено» (`ok is None`) флагом НЕ считается: нельзя назвать ложным то, чего обзор не
    утверждал. В знаменатель частоты идут только вещи, которые обзор действительно заявил.
    """
    return [f["check"] for f in delta.get("findings", []) if f.get("ok") is False]


def _feedback_dir(root: Path) -> Path:
    return Path(root) / FEEDBACK_DIR_REL


def record_feedback(root: Path, flags, dismissed, *, commit_sha: str | None = None,
                    confirmed_at: str | None = None) -> dict:
    """Записать обратную связь по ОДНОМУ подтверждённому обзору отдельным файлом-шардом.

    `flags` — все флаги обзора; `dismissed` — те из них, что владелец пометил ложными (⊆ flags;
    пометки на несуществующие флаги отбрасываются — нельзя признать ложным то, чего не было).
    Общего файла нет намеренно (#148): каждый обзор — свой шард, слияние веток = объединение.
    """
    flags = list(flags or [])
    dismissed = [d for d in (dismissed or []) if d in flags]
    at = confirmed_at or datetime.now().isoformat()
    rec = {"schema_version": 1, "kind": "NightlyReviewFeedback",
           "confirmed_at": at, "commit_sha": commit_sha,
           "flags": flags, "dismissed": dismissed}
    d = _feedback_dir(root)
    d.mkdir(parents=True, exist_ok=True)
    stamp = re.sub(r"[^0-9A-Za-z]", "", at)[:15] or "0"
    shard = d / f"{stamp}-{(commit_sha or 'nosha')[:8]}-{uuid.uuid4().hex[:8]}.json"
    shard.write_text(json.dumps(rec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return rec


def read_feedback(root: Path) -> list[dict]:
    """Все шарды обратной связи (union каталога). Битый шард пропускаем, не роняя счёт остальных."""
    d = _feedback_dir(root)
    if not d.is_dir():
        return []
    out = []
    for p in sorted(d.glob("*.json")):
        try:
            doc = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(doc, dict) and doc.get("kind") == "NightlyReviewFeedback":
            out.append(doc)
    return out


def false_positive_rate(root: Path) -> dict:
    """Частота ложных срабатываний обзора — ИЗМЕРЕННАЯ из обратной связи, или честное «не измерено».

    -> {measured, rate, false_flags, total_flags, confirmed_reviews, threshold, reason}.
    Считается по подтверждённым обзорам, у которых был ≥1 флаг: rate = ложные / все флаги. Пока
    таких обзоров меньше MIN_CONFIRMED_FOR_RATE (или флагов вовсе не было) — measured=False, число
    НЕ называется, называется порог. Третье состояние («не измерено») не сворачивается в «0%».
    """
    fb = read_feedback(root)
    with_flags = [r for r in fb if r.get("flags")]
    total = sum(len(r.get("flags", [])) for r in with_flags)
    false = sum(len(r.get("dismissed", [])) for r in with_flags)
    base = {"false_flags": false, "total_flags": total,
            "confirmed_reviews": len(with_flags), "threshold": MIN_CONFIRMED_FOR_RATE}
    if len(with_flags) < MIN_CONFIRMED_FOR_RATE or total == 0:
        return {**base, "measured": False, "rate": None,
                "reason": (f"не измерено: нужно ≥{MIN_CONFIRMED_FOR_RATE} подтверждённых обзоров "
                           f"с флагами и пометкой ложных срабатываний "
                           f"(пока {len(with_flags)})")}
    return {**base, "measured": True, "rate": false / total,
            "reason": (f"{false} ложных из {total} флагов "
                       f"за {len(with_flags)} подтверждённых обзоров")}


def format_false_positive_rate(fpr: dict) -> str:
    """Одна строка о частоте ложных — первоклассно в брифе. «Не измерено» остаётся «не измерено»."""
    if not fpr.get("measured"):
        return (f"Частота ложных срабатываний: **не измерено** — {fpr.get('reason')}. "
                f"Пока обзор не может сказать, насколько часто его флаги ошибочны, — доверять "
                f"флагам на слово.")
    pct = round(fpr["rate"] * 100)
    return (f"Частота ложных срабатываний: **{pct}%** "
            f"({fpr['false_flags']} ложных из {fpr['total_flags']} флагов "
            f"за {fpr['confirmed_reviews']} подтверждённых обзоров).")


def review_baseline(root: Path) -> dict:
    """Откуда считать дельту. -> {"since": str|None, "kind": ..., "reason": str}.

    `kind`: confirmed — от подтверждённого обзора; fallback — обзора ещё не было, взяли сутки;
    unreadable — запись есть и не читается, и это ТРЕТЬЕ состояние: работаем как fallback, но
    говорим об этом, а не выдаём за первое.
    """
    rec = last_confirmed(root)
    if rec is None:
        return {"since": None, "kind": "fallback",
                "reason": "подтверждённого обзора ещё не было — беру последние сутки"}
    if rec.get("unreadable"):
        return {"since": None, "kind": "unreadable",
                "reason": (f"запись о последнем обзоре не прочитана ({rec['unreadable']}) — "
                           f"беру последние сутки, но точка отсчёта НЕ подтверждена")}
    sha = rec.get("commit_sha")
    if not sha:
        return {"since": None, "kind": "unreadable",
                "reason": "в записи о последнем обзоре нет commit_sha — точка отсчёта неизвестна"}
    return {"since": sha, "kind": "confirmed",
            "reason": f"дельта с последнего подтверждённого обзора ({rec.get('confirmed_at')})"}


def collect_delta(root: Path, since: str | None = None, *, focus: str | None = None) -> dict:
    """Collect all delta information. `focus` не задан — заглядываем в курсор ротации, НЕ двигая его
    (показ/подтверждение); реальный прогон (run_nightly) передаёт уже сдвинутый фокус."""
    baseline = review_baseline(root) if since is None else {
        "since": since, "kind": "explicit", "reason": "точка отсчёта задана вызывающим"}
    findings = run_checks(root)
    if focus is None:
        focus = nd.rotate_focus(root, advance=False)
    axis_counts = nd.axis_finding_counts(findings)
    return {
        "baseline": baseline,
        "commits": _get_recent_commits(root, baseline["since"]),
        "changed_files": _get_changed_files(root, baseline["since"]),
        "plan": _check_plan_status(root),
        "ci": _check_ci_status(root),
        "prs": _check_open_prs(root),
        "findings": findings,
        "focus": focus,
        "dimensions": nd.group_findings_by_axis(findings),
        "axis_counts": axis_counts,
        "false_positive_rate": false_positive_rate(root),
        
        
        "trends": compute_trends(read_history(root), findings),
        "axis_trends": compute_axis_trends(read_history(root), axis_counts),
        "timestamp": datetime.now().isoformat(),
    }


def format_brief(delta: dict, root: Path) -> str:
    """Утренний бриф: ПЯТЬ вопросов в порядке, в котором их задаёт человек.

    Порядок из ROADMAP (`nightly-product-review`): что изменилось → что система сделала → чего НЕ
    стала делать и почему → где нужно решение → что важнее всего сегодня.

    ТРЕТИЙ РАЗДЕЛ — НЕ ВЕЖЛИВОСТЬ, А УСЛОВИЕ ДОВЕРИЯ. Обзор, который перечисляет только найденное,
    неотличим от обзора, который половину не смотрел. Здесь границы названы поимённо: что не
    проверено и почему, и что v0 не делает по решению, а не по недоделке.
    """
    b = delta.get("baseline") or {}
    commits = delta.get("commits", [])
    files = delta.get("changed_files", [])
    findings = delta.get("findings", [])
    bad = [f for f in findings if f.get("ok") is False]
    unknown = [f for f in findings if f.get("ok") is None]
    prs = delta.get("prs", {})
    open_prs = prs.get("open_prs")
    plan = delta.get("plan", {})

    L = ["# Утренний обзор продукта", ""]

    
    L += ["## Что изменилось", "", f"Точка отсчёта: {b.get('reason', 'не названа')}."]
    if b.get("kind") in ("fallback", "unreadable"):
        L.append("**Это не подтверждённая точка отсчёта** — часть изменений могла остаться за кадром "
                 "или попасть в обзор второй раз.")
    if commits:
        L.append(f"С тех пор: {len(commits)} коммит(ов), {len(files)} файл(ов).")
    else:
        L.append("С тех пор изменений не зафиксировано.")

    
    groups = delta.get("dimensions") or nd.group_findings_by_axis(findings)
    L += ["", "## Что я проверил — по осям", "", *nd.format_dimensions(groups, focus=delta.get("focus"))]
    if isinstance(plan.get("by_status"), dict):
        L.append(f"- план: " + ", ".join(f"{k} — {v}" for k, v in sorted(plan["by_status"].items())))
    elif plan.get("error"):
        L.append(f"- план: {plan['error']}")

    
    
    trend = delta.get("trends") or compute_trends(read_history(root), findings)
    L += ["", "## Тренд за неделю", ""]
    L += [*format_trends(trend), "", *nd.format_axis_trends(delta.get("axis_trends") or {})]

    
    L += format_hotspots_section(root)

    
    
    
    fpr = delta.get("false_positive_rate") or false_positive_rate(root)
    L += ["", "## Насколько можно доверять моим флагам", "", format_false_positive_rate(fpr)]

    
    L += ["", "## Чего я не стал делать и почему", ""]
    L.append("- **Ничего не правил**: v0 работает только на чтение. Это граница выпуска, а не "
             "недоделка: автофикс без измеренного false-positive rate — тот же ложный green, "
             "только теперь он коммитит.")
    for f in unknown:
        L.append(f"- **{f['check']}** не проверена: {f['detail']}")
    if open_prs is None:
        L.append(f"- Состояние запросов на слияние не узнал: "
                 f"{prs.get('unavailable', 'причина не названа')}.")
    if not unknown and open_prs is not None:
        L.append("- Остальное из объявленного объёма проверено.")

    
    L += ["", "## Где нужно твоё решение", ""]
    asks = []
    if b.get("kind") == "unreadable":
        asks.append("Запись о последнем обзоре повреждена — подтвердить обзор заново "
                    "(`--confirm`), иначе точка отсчёта останется неизвестной.")
    if open_prs and open_prs > 3:
        asks.append(f"Открытых запросов на слияние: {open_prs} — очередь копится.")
    for f in bad[:3]:
        asks.append(f"«{f['check']}» разошлась с кодом: решить, чинить или признать границей.")
    if asks:
        L += [f"- {a}" for a in asks]
    else:
        L.append("- Ничего не жду. Решений от тебя сейчас не требуется.")

    
    L += ["", "## Что важнее всего сегодня", ""]
    if bad:
        L.append(f"Разобрать «{bad[0]['check']}»: {bad[0]['detail'][:160]}")
    elif b.get("kind") != "confirmed":
        L.append("Подтвердить этот обзор — тогда завтрашняя дельта будет считаться от него, "
                 "а не от суток.")
    elif unknown:
        L.append(f"Вернуть проверку «{unknown[0]['check']}»: пока она не идёт, её предмет "
                 f"не смотрит никто.")
    elif commits:
        L.append("Спокойная ночь. Проверить, что вчерашние изменения попали в план.")
    else:
        L.append("Спокойная ночь. Можно взять новую работу из плана.")
    return "\n".join(L)






















NIGHTLY_AUTOFIX_ENV = "AI_OPS_NIGHTLY_AUTOFIX"          # =off (любой регистр) -> глушим
AUTOFIX_OFF_SENTINEL = ".ai/project/nightly-review/autofix-off"


class FixerSpec:
    """Детерминированный фиксер класса A. `apply(worktree_path) -> list[str]` изменённых путей.

    Обязан быть обратимым и не менять поведение. Свой allowlist путей фиксер держит сам — движок
    (worktree.apply_fixes_in_worktree) лишь применяет, проверяет и откатывает."""
    def __init__(self, key: str, description: str, apply):
        self.key = key
        self.description = description
        self.apply = apply


def _fix_trailing_whitespace(globs):
    """Фабрика эталонного фиксера: убрать хвостовые пробелы и добить один финальный перевод строки.

    Класс A в чистом виде — детерминированно, обратимо, не меняет поведение. Трогает ТОЛЬКО файлы по
    своим globs. Возвращает apply(worktree_path) -> list[str] изменённых относительных путей."""
    def apply(wt: Path) -> list:
        wt = Path(wt)
        changed = []
        for pat in globs:
            for p in sorted(wt.glob(pat)):
                if not p.is_file():
                    continue
                try:
                    text = p.read_text(encoding="utf-8")
                except (OSError, UnicodeDecodeError):
                    continue
                fixed = "\n".join(line.rstrip() for line in text.split("\n"))
                fixed = fixed.rstrip("\n") + "\n" if fixed.strip() else fixed
                if fixed != text:
                    p.write_text(fixed, encoding="utf-8")
                    changed.append(str(p.relative_to(wt)))
        return changed
    return apply




CLASS_A_FIXERS = {
    "trailing-whitespace": FixerSpec(
        "trailing-whitespace",
        "хвостовые пробелы и финальный перевод строки в Markdown-документах",
        _fix_trailing_whitespace(["docs/**/*.md", "*.md"])),
}


def autofix_kill_switch_off(root: Path) -> str | None:
    """Заглушён ли автофикс. -> причина (str) или None (не заглушён)."""
    val = (__import__("os").environ.get(NIGHTLY_AUTOFIX_ENV) or "").strip().lower()
    if val == "off":
        return f"{NIGHTLY_AUTOFIX_ENV}=off"
    if (Path(root) / AUTOFIX_OFF_SENTINEL).exists():
        return f"файл-сигнал {AUTOFIX_OFF_SENTINEL}"
    return None


def enabled_fixers(root: Path, enabled=None) -> list:
    """Включённые ключи фиксеров. По умолчанию (config nightly.autofix.enabled) — ПУСТО (fail-closed).

    `enabled` (список ключей) переопределяет config — для тестов и явного вызова."""
    if enabled is None:
        cfg = Path(root) / ".ai-ops.yaml"
        enabled = []
        if cfg.is_file():
            try:
                doc = yaml.safe_load(cfg.read_text(encoding="utf-8")) or {}
                enabled = (((doc.get("nightly") or {}).get("autofix") or {}).get("enabled")) or []
            except (OSError, yaml.YAMLError):
                enabled = []
    return [k for k in enabled if k in CLASS_A_FIXERS]


def run_autofix(root: Path, *, dry_run: bool = False, enabled=None, date: str | None = None,
                policy=None, verify=None) -> dict:
    """Собрать включённые правки класса A в ОДИН черновой PR за ночь (или сказать, почему не собрал).

    Возврат (AutoFixResult): {status, reason?, branch?, base_sha?, head_sha?, applied, skipped, pr?,
    budget, enabled}. status: disabled | suggest-only | no_changes | prepared | dry_run | rolled_back.
    Никогда не пишет в main, не мержит, не зовёт модель."""
    from ai_ops_kit.engine import worktree
    from ai_ops_kit.governance import policy_engine
    from ai_ops_kit.shared.budget import Budget

    result = {"applied": [], "skipped": [], "enabled": [], "pr": None,
              "budget": {"max_model_calls": 0, "spent": 0}}

    off = autofix_kill_switch_off(root)
    if off:
        return {**result, "status": "disabled", "reason": f"автофикс заглушён ({off})"}

    keys = enabled_fixers(root, enabled)
    result["enabled"] = keys
    if not keys:
        return {**result, "status": "disabled",
                "reason": "класс A пуст — включённых фиксеров нет (открывается решением владельца)"}

    pol = policy if policy is not None else policy_engine.load_policy(root)
    
    
    if policy_engine.level_for("nightly_autofix", pol) == "suggest":
        return {**result, "status": "suggest-only",
                "reason": "policy: nightly_autofix=suggest — только рекомендация, правку не готовлю"}

    _ = Budget(max_model_calls=0)     # заявленный инвариант: класс A детерминирован, модель не зовёт
    day = date or datetime.now().strftime("%Y-%m-%d")
    branch = f"ai-ops/nightly-autofix/{day}"
    fixers = [{"key": k, "apply": CLASS_A_FIXERS[k].apply} for k in keys]

    res = worktree.apply_fixes_in_worktree(root, branch, fixers, base="HEAD", verify=verify)
    result["applied"] = res.get("applied", [])
    result["skipped"] = res.get("skipped", [])
    result["branch"] = branch
    result["base_sha"] = res.get("base_sha")
    result["head_sha"] = res.get("head_sha")

    if res["status"] == "no_changes":
        return {**result, "status": "no_changes", "reason": "включённые фиксеры не нашли что править"}
    if res["status"] in ("error", "rolled_back"):
        return {**result, "status": "rolled_back",
                "reason": res.get("reason", "правки откачены — ни одна не собрана")}

    if dry_run:
        return {**result, "status": "dry_run",
                "reason": "dry-run: правки собраны в ветку, PR не открыт"}

    from ai_ops_kit.delivery import pr_open
    body = ("Ночной автофикс класса A (детерминированные, обратимые правки).\n\n"
            f"База: {res.get('base_sha')}\nВершина: {res.get('head_sha')}\n\n"
            + "\n".join(f"- {a['key']}: {', '.join(a['files'])}" for a in res.get("applied", []))
            + "\n\nЧерновой PR: слияние — за человеком.")
    pr = pr_open.open_draft_pr(root, branch, "chore: ночной автофикс класса A", body,
                               delivery_id=f"nightly-autofix-{day}")
    result["pr"] = pr
    return {**result, "status": "prepared",
            "reason": "правки класса A собраны в один черновой PR (слияние за человеком)"}


def format_autofix_report(res: dict) -> str:
    """Человеческий отчёт об автофиксе: что собрано / что пропущено / почему выключено."""
    st = res.get("status")
    L = ["# Ночной автофикс (класс A)", ""]
    if st in ("disabled", "suggest-only"):
        L.append(f"Ничего не правил: {res.get('reason')}.")
        L.append("Это граница по решению, а не недоделка: класс A открывается по одному пункту.")
        return "\n".join(L)
    if st == "no_changes":
        L.append(f"Включённые фиксеры ({', '.join(res.get('enabled', []))}) не нашли что править.")
        return "\n".join(L)
    if st == "rolled_back":
        L.append(f"Правки откачены: {res.get('reason')}. В main и в PR ничего не ушло.")
        return "\n".join(L)
    applied = res.get("applied", [])
    L.append(f"Собрано правок: {len(applied)} (ветка {res.get('branch')}).")
    for a in applied:
        L.append(f"- **{a['key']}**: {', '.join(a['files'])}")
    if res.get("skipped"):
        L.append("")
        L.append("Пропущено (не прошло проверку или потолок):")
        for s in res["skipped"]:
            L.append(f"- {s.get('key')}: {s.get('reason')}")
    pr = res.get("pr") or {}
    L.append("")
    if st == "dry_run":
        L.append("Dry-run: PR не открыт.")
    elif pr.get("status") in ("opened", "updated"):
        L.append(f"Черновой PR {pr.get('status')}: {pr.get('url', pr.get('number'))}. Слияние — за тобой.")
    else:
        L.append(f"Черновой PR не открыт: {pr.get('note') or pr.get('status')} "
                 f"(правки собраны в ветке {res.get('branch')}).")
    return "\n".join(L)


def run_nightly(root: Path, *, since: str | None = None, deliver: bool = True,
                date: str | None = None) -> dict:
    """Точка входа расписания: собрать дельту -> бриф -> доставить владельцу.

    -> {"brief", "receipt"|None, "baseline"}. Это ровно то, что зовёт сгенерированный CI-workflow.
    """
    root = Path(root)
    
    
    focus = nd.rotate_focus(root, advance=True)
    delta = collect_delta(root, since, focus=focus)
    brief = format_brief(delta, root)
    
    
    
    record_history(root, delta.get("findings", []), axis_counts=delta.get("axis_counts"))
    receipt = deliver_brief(root, brief, date=date) if deliver else None
    return {"brief": brief, "receipt": receipt, "baseline": delta.get("baseline")}


def main():
    import argparse
    ap = argparse.ArgumentParser(description="Nightly Product Health Review (v0, read-only)")
    ap.add_argument("root", nargs="?", default=".", help="Repository root")
    ap.add_argument("--since", help="Commit SHA or ref to diff from")
    ap.add_argument("--json", action="store_true", help="Output delta as JSON")
    ap.add_argument("--confirm", action="store_true",
                    help="отметить обзор разобранным: завтрашняя дельта пойдёт отсюда")
    ap.add_argument("--dismiss", action="append", default=None, metavar="ФЛАГ",
                    help="с --confirm: пометить флаг (имя проверки) ложным срабатыванием — "
                         "питает измеренную частоту ложных; можно указать несколько раз")
    ap.add_argument("--autofix", action="store_true",
                    help="собрать включённые правки класса A в один черновой PR (по умолчанию класс A пуст)")
    ap.add_argument("--dry-run", action="store_true",
                    help="с --autofix: собрать правки в ветку, но НЕ открывать PR")
    ap.add_argument("--install-schedule", action="store_true",
                    help="поставить реальный ночной триггер (CI-workflow schedule: cron)")
    ap.add_argument("--cron", default="0 3 * * *",
                    help="с --install-schedule: cron ночного запуска (по умолчанию 03:00)")
    ap.add_argument("--schedule-status", action="store_true",
                    help="сказать, идёт ли обзор ночью на самом деле (detected/declared/absent)")
    ap.add_argument("--deliver", action="store_true",
                    help="ночной прогон: собрать бриф И доставить владельцу (инбокс + receipt)")
    ap.add_argument("--selftest", action="store_true", help="Run self-test")
    args = ap.parse_args()

    if args.selftest:
        
        
        
        
        
        
        
        print(__doc__)
        print("Проверки модуля — в tests/unit/ (AGENTS.md: selftest не живёт в продакшн-модуле).")
        return 0

    root = Path(args.root).resolve()
    if not (root / ".git").exists():
        print(f"ERROR: {root} is not a git repository", file=sys.stderr)
        return 1

    if args.confirm:
        
        
        
        rec = confirm_review(root, dismissed=args.dismiss)
        print(f"обзор подтверждён на {rec['commit_sha'] or 'неизвестном коммите'} "
              f"({rec['confirmed_at']}) — завтрашняя дельта пойдёт отсюда")
        if args.dismiss:
            print(f"помечено ложных срабатываний: {', '.join(args.dismiss)} — учтено в частоте")
        fpr = false_positive_rate(root)
        print(format_false_positive_rate(fpr))
        return 0

    if args.autofix:
        
        
        
        res = run_autofix(root, dry_run=args.dry_run)
        if args.json:
            print(json.dumps(res, indent=2, ensure_ascii=False))
        else:
            print(format_autofix_report(res))
        return 0

    if args.schedule_status:
        st = schedule_status(root)
        print(json.dumps(st, indent=2, ensure_ascii=False) if args.json
              else format_schedule_status(st))
        return 0

    if args.install_schedule:
        res = install_schedule(root, cron=args.cron)
        if args.json:
            print(json.dumps(res, indent=2, ensure_ascii=False))
        else:
            print(f"ночной триггер {res['status']}: {res['workflow']} по расписанию `{res['cron']}`. "
                  f"Дальше запускает CI — кит не планировщик.")
        return 0

    if args.deliver:
        
        out = run_nightly(root, since=args.since)
        if args.json:
            print(json.dumps(out, indent=2, ensure_ascii=False))
        else:
            print(out["brief"])
            rec = out["receipt"]
            print(f"\n_Бриф доставлен: {rec['latest']} (и {rec['path']})._")
        return 0

    delta = collect_delta(root, args.since)

    if args.json:
        print(json.dumps(delta, indent=2, ensure_ascii=False))
    else:
        print(format_brief(delta, root))

    return 0


if __name__ == "__main__":
    sys.exit(main())
