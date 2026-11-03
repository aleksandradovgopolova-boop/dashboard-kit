#!/usr/bin/env python3
"""How to build and call a provider — mock, anthropic, openai(-совместимые), claude-cli.

Вынесено из orchestrator_providers.py (чистый разрез монолита): кластер «собрать/вызвать
провайдера». Вендоры (`make_openai_provider`→`_openai_call`) и claude-CLI
(`make_provider`→`make_claude_cli_provider`→`_claude_cli_call`) живут ВМЕСТЕ намеренно — иначе
`make_provider` и claude-CLI образовали бы цикл импортов.

Направление зависимостей: этот модуль импортирует из `provider_errors` и `provider_writer_lock`
(фундамент) и НЕ импортирует фасад на уровне модуля. `_claude_cli_call` берёт `claude_binary` /
`claude_missing_message` (резолв бинаря живёт в фасаде) ленивым импортом ВНУТРИ функции — на время
загрузки модуля обращения к фасаду нет, цикла импортов не возникает. Поведение байт-в-байт прежнее.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

PKG = next((_p for _p in Path(__file__).resolve().parents if (_p / "VERSION").is_file()),
            Path(__file__).resolve().parents[1])


from ai_ops_kit.providers.orchestrator_http import _http_post_json
from ai_ops_kit.providers.orchestrator_usage import _record_call
from ai_ops_kit.providers.response_contract import (
    ENFORCED,
    JSON_ONLY,
    UNSUPPORTED,
    ProviderRefusal,
    shape_support,
)
from ai_ops_kit.providers.provider_errors import (
    ProviderEnvUnavailableError,
    ProviderLimitError,
    _env_unavailable_envelope,
    _reset_hint,
    _session_limit,
)
from ai_ops_kit.providers.provider_writer_lock import _writer_serialization_lock




def mock_provider(role_prompt: str) -> str:
    """Детерминированный офлайн-провайдер: возвращает структурированную заглушку.

    Контракта формы НЕ принимает намеренно: заглушка вердиктов не выносит. Отдай она валидный по
    схеме `reviewer-result`, гейт получил бы вердикт от того, кто ничего не читал, — фабрикация,
    а не офлайн-детерминизм. Путь «форма обеспечена провайдером» проверяется тестами живых
    адаптеров с подменённым HTTP, а не заглушкой (`tests/unit/test_response_contract_selftest.py`).
    """
    first = role_prompt.splitlines()[0][:80] if role_prompt else ""
    return (f"[mock-provider] Роль принята: {first}\n"
            f"Результат стадии подготовлен согласно контракту роли.")






DEFAULT_MODELS = {"anthropic": "claude-sonnet-5", "openai": "gpt-4o"}











_MAX_TOKENS = 8192


def _anthropic_call(prompt, model, contract=None):
    """Messages API. С контрактом форма ответа обеспечивается механизмом провайдера
    (`output_config.format`), а не разбором прозы; неполученный ответ даёт ОТКАЗ с причиной."""
    import os
    import time
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise SystemExit("ANTHROPIC_API_KEY не задан — живой прогон невозможен. "
                         "Задайте ключ в окружении или используйте --provider mock (офлайн).")
    body = {"model": model, "max_tokens": _MAX_TOKENS,
            "messages": [{"role": "user", "content": prompt}]}
    if contract is not None:
        
        body["output_config"] = {"format": {"type": "json_schema",
                                            "schema": contract.wire_schema}}
    _t0 = time.monotonic()
    data = _http_post_json(
        "https://api.anthropic.com/v1/messages",
        {"x-api-key": key, "anthropic-version": "2023-06-01"}, body)
    _u = data.get("usage") or {}
    _record_call(model, _u.get("input_tokens"), _u.get("output_tokens"), time.monotonic() - _t0)
    parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
    text = "\n".join(parts).strip()
    stop = data.get("stop_reason")
    if contract is not None:
        
        
        
        
        if stop == "max_tokens":
            raise ProviderRefusal("truncated", f"потолок {_MAX_TOKENS} токенов", "anthropic", model)
        if stop == "refusal":
            det = (data.get("stop_details") or {}).get("explanation") or ""
            raise ProviderRefusal("refused_by_model", det, "anthropic", model)
        if not text:
            raise ProviderRefusal("empty_answer", f"stop_reason={stop}", "anthropic", model)
    return text or "(пустой ответ модели)"


def _response_format_for(vendor, contract):
    """`response_format` под объявленный режим вендора — или None, если механизма нет.

    Три состояния, и третье не сворачивается во второе: `enforced` шлёт схему, `json_only` просит
    валидный JSON без схемы (её сверит кит), `unsupported` не шлёт ничего и говорит об этом."""
    if contract is None:
        return None, UNSUPPORTED
    mode = shape_support(vendor)["mode"]
    if mode == ENFORCED:
        return {"type": "json_schema",
                "json_schema": {"name": contract.name.replace("-", "_"), "strict": True,
                                "schema": contract.wire_schema}}, ENFORCED
    if mode == JSON_ONLY:
        return {"type": "json_object"}, JSON_ONLY
    return None, UNSUPPORTED


def _openai_call(prompt, model, base_url="https://api.openai.com/v1/chat/completions",
                 key_env="OPENAI_API_KEY", contract=None, vendor="openai"):
    """OpenAI Chat Completions и любой OpenAI-совместимый endpoint (DeepSeek, local, …)
    через base_url + ключ из указанной env. Секрет — только из env, не в репо/логах.

    С контрактом форма запрашивается механизмом вендора настолько, насколько вендор её умеет
    (см. `response_contract.SHAPE_SUPPORT`); чего он не умеет, кит доверяет не обещанию, а
    собственной сверке — и отказывается вместо того, чтобы отдать пустой вердикт."""
    import os
    key = os.environ.get(key_env)
    if not key:
        raise SystemExit(f"{key_env} не задан — живой прогон невозможен. "
                         "Задайте ключ в окружении или используйте --provider mock (офлайн).")
    import time
    rf, _mode = _response_format_for(vendor, contract)
    
    
    
    for attempt in range(3):
        _t0 = time.monotonic()
        # v3.0-rc7: reasoning-модели медленные (kimi-k3) — 120с не хватало -> 300с default.
        # v3.6.8: таймаут настраиваем через env OPENAI_COMPATIBLE_TIMEOUT (флагман kimi-k3 бывает >300с).
        _to = int(os.environ.get("OPENAI_COMPATIBLE_TIMEOUT", "300"))
        _body = {"model": model, "max_tokens": _MAX_TOKENS,
                 "messages": [{"role": "user", "content": prompt}]}
        if rf is not None:
            _body["response_format"] = rf
        data = _http_post_json(
            base_url, {"authorization": f"Bearer {key}"}, _body, timeout=_to)
        _choice = (data.get("choices", [{}])[0] or {})
        msg = _choice.get("message", {}) or {}
        content = ((msg.get("content") or msg.get("reasoning_content") or "")).strip()
        if content:
            _u = data.get("usage") or {}   # v3.1 trace v0.2: OpenAI-совместимый usage
            _record_call(model, _u.get("prompt_tokens"), _u.get("completion_tokens"), time.monotonic() - _t0)
            
            
            if contract is not None and _choice.get("finish_reason") == "length":
                raise ProviderRefusal("truncated", f"потолок {_MAX_TOKENS} токенов", vendor, model)
            return content
        if attempt < 2:
            time.sleep(2 ** attempt)
    if contract is not None:
        raise ProviderRefusal("empty_answer", "три попытки подряд вернули пустой content",
                              vendor, model)
    return "(пустой ответ модели)"









OPENAI_COMPATIBLE_VENDORS = {
    "deepseek": {"key_env": "DEEPSEEK_API_KEY", "base_url_env": "DEEPSEEK_BASE_URL",
                 "base_url": "https://api.deepseek.com/chat/completions",
                 "default_model": "deepseek-v4-flash"},
    "qwen": {"key_env": "QWEN_API_KEY", "base_url_env": "QWEN_BASE_URL",
             "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
             "default_model": "qwen3-coder-plus"},
    "kimi": {"key_env": "KIMI_API_KEY", "base_url_env": "KIMI_BASE_URL",
             "base_url": "https://api.moonshot.ai/v1/chat/completions",
             "default_model": "kimi-k2.7-code-highspeed"},
}



DECLARED_NOT_IMPLEMENTED = {
    "google": "нет REST-адаптера Gemini (registry: kind hosted-api, protocols [rest])",
    "gigachat": "нужен OAuth-адаптер NGW (registry: adoption_status planned-future)",
    "local": "укажите endpoint явно: --provider openai-compatible + OPENAI_COMPATIBLE_BASE_URL "
             "(registry: LOCAL_LLM_BASE_URL)",
    "custom": "укажите endpoint явно: --provider openai-compatible + OPENAI_COMPATIBLE_BASE_URL",
}


def _tagged(fn, name, model, contract):
    """Повесить на callable честную метку формы: чем именно обеспечен ответ.

    Метка едет ВМЕСТЕ с провайдером, а не выводится вызывающим по имени: как только «кто закрыл»
    считают в двух местах, эти два места расходятся (ровно этот класс кит ловит у гейтов)."""
    sup = shape_support(name)
    fn.shape = {"provider": name, "model": model,
                "contract": getattr(contract, "name", None),
                "mode": sup["mode"] if contract is not None else "not_requested",
                "mechanism": sup["mechanism"], "note": sup["note"]}
    return fn


def make_provider(name: str, model: str = None, contract=None):
    """Вернуть callable(role_prompt)->text для провайдера.
    'mock' (по умолчанию, офлайн, детерминированный) | 'anthropic' | 'openai' |
    'openai-compatible' | 'claude-cli' | вендоры из OPENAI_COMPATIBLE_VENDORS (qwen/deepseek/kimi).
    Живые провайдеры вызывают реальный API по ключу из env; без ключа — честная ошибка.
    ВАЖНО: живой путь опционален (opt-in через --provider) — CI/selftest офлайн на mock.

    `contract` (v3.37, C2) — форма, которую ответ ОБЯЗАН иметь, когда он становится вердиктом.
    Где провайдер умеет её обеспечить, она обеспечивается его механизмом; где не умеет — ответ
    разбирается как раньше, и это НАЗЫВАЕТСЯ, а не подразумевается: у возвращённого callable есть
    поле `.shape` с режимом (`enforced` / `json_only` / `unsupported` / `not_requested`) и именем
    механизма. Без контракта поведение не меняется ни на байт — writer-роли и их ретраи не трогаем.
    """
    if name in (None, "mock"):
        return _tagged(mock_provider, "mock", model, contract)
    if name == "anthropic":
        m = model or DEFAULT_MODELS["anthropic"]
        return _tagged(lambda prompt: _anthropic_call(prompt, m, contract), name, m, contract)
    if name == "openai":
        m = model or DEFAULT_MODELS["openai"]
        return _tagged(lambda prompt: _openai_call(prompt, m, contract=contract, vendor="openai"),
                       name, m, contract)
    if name == "openai-compatible":
        
        base = os.environ.get("OPENAI_COMPATIBLE_BASE_URL")
        if not base:
            raise SystemExit("OPENAI_COMPATIBLE_BASE_URL не задан — для openai-совместимого "
                             "провайдера (напр. DeepSeek: https://api.deepseek.com/chat/completions) "
                             "укажите base URL в env.")
        if not model:
            raise SystemExit("--model обязателен для openai-compatible (напр. deepseek-chat).")
        return _tagged(lambda prompt: _openai_call(prompt, model, base_url=base,
                                                   key_env="OPENAI_COMPATIBLE_API_KEY",
                                                   contract=contract, vendor=name),
                       name, model, contract)
    if name in ("claude-cli", "claude-code-local"):
        
        
        return _tagged(make_claude_cli_provider(model), name, model, contract)
    if name in OPENAI_COMPATIBLE_VENDORS:
        
        
        v = OPENAI_COMPATIBLE_VENDORS[name]
        base = os.environ.get(v["base_url_env"]) or v["base_url"]
        m = model or v["default_model"]
        return _tagged(lambda prompt: _openai_call(prompt, m, base_url=base,
                                                   key_env=v["key_env"],
                                                   contract=contract, vendor=name),
                       name, m, contract)
    if name in DECLARED_NOT_IMPLEMENTED:
        raise SystemExit(f"провайдер '{name}' объявлен в registry/providers.yaml, но не реализован "
                         f"адаптером движка: {DECLARED_NOT_IMPLEMENTED[name]}")
    raise SystemExit(f"неизвестный провайдер '{name}' (есть: mock, anthropic, openai, "
                     f"openai-compatible, claude-cli, "
                     f"{', '.join(sorted(OPENAI_COMPATIBLE_VENDORS))})")


def for_contract(provider_fn, contract):
    """Тот же провайдер, но обязанный отдать ответ ОБЪЯВЛЕННОЙ формы — если он это умеет.

    Пересобираем через `make_provider` по метке `.shape`, которую повесил `_tagged`: имя и модель
    берутся оттуда, а не угадываются вызывающим. Провайдер без метки (собран в обход фабрики —
    тесты, обёртки движка) возвращается КАК ЕСТЬ с режимом `unknown`: подменять чужой callable
    своим было бы тихой заменой исполнителя.

    Механизма нет (`claude-cli`, `mock`, неизвестный вендор) — тоже возвращаем как есть. Это не
    деградация молчком: режим уезжает в отчёт словом, и `claude-cli` остаётся первоклассным путём,
    работающим без ключа."""
    shape = getattr(provider_fn, "shape", None)
    if not isinstance(shape, dict):
        return provider_fn, {"mode": "unknown", "mechanism": None,
                             "note": "провайдер собран в обход make_provider — что он умеет "
                                     "с формой, отсюда не видно"}
    name, model = shape.get("provider"), shape.get("model")
    sup = shape_support(name)
    if sup["mode"] not in (ENFORCED, JSON_ONLY):
        return provider_fn, {**sup, "provider": name, "model": model}
    bound = make_provider(name, model, contract)
    return bound, {**sup, "provider": name, "model": model, "contract": contract.name}


def _human_error(text):
    # F-011a: читаемая причина из JSON claude (content[].text / error) — НЕ резать диагностику до 200 символов
    import json as _json
    try:
        d = _json.loads(text)
    
    
    except (ValueError, TypeError):
        return (text or "").strip()[:2000]
    parts = []
    if d.get("error"):
        parts.append(str(d.get("error")))
    msg = d.get("message") if isinstance(d.get("message"), dict) else None
    for blk in ((msg.get("content") if msg else None) or d.get("content") or []):
        if isinstance(blk, dict) and blk.get("type") == "text" and blk.get("text"):
            parts.append(blk["text"])
    return (" | ".join(parts) or (text or "").strip())[:2000]


def _transient(text):
    t = (text or "").lower()
    
    
    
    return any(s in t for s in ("overloaded", "529", "429", "rate limit", "rate_limit",
                                "500", "502", "503", "504", "internal server error",
                                "temporarily", "transient", "server_error",
                                "timeout", "timed out", "connection"))


def _backoff(n):
    import time
    import random
    time.sleep(min(30.0, 2.0 ** n) + random.uniform(0, 1))   # экспонента + jitter, потолок 30с


def _claude_cli_call(prompt, model=None, runner=None, timeout=600, max_attempts=5):
    """v3.9.0 First-class Claude Code Adapter — локальный `claude -p` как ТЕКСТ-провайдер (сильный writer),
    БЕЗ API-ключа (использует локальную аутентифицированную сессию claude CLI).

    БЕЗОПАСНОСТЬ (executing-adapter контракт): `--allowedTools Read Grep Glob` — ТОЛЬКО read-only инструменты.
    Claude ЧИТАЕТ репо (информированное предложение), но НЕ может писать/исполнять (нет Write/Edit/Bash/git) ->
    НЕ трогает FS/git/сеть, НЕ пушит, НЕ создаёт PR, НЕ меняет checkout, НЕ владеет исполнением/lifecycle.
    Модель ПРЕДЛАГАЕТ действия ТЕКСТОМ (JSON tool-loop); применяет их КИТ через свой sandbox/broker
    (scope-enforced, exact-SHA, gates, delivery) — это policy enforcement, не security isolation:
    брокер управляет операцией и областью записи, но сеть и ресурсы им не ограничены. AI Ops = control plane, Claude Code = сильный ЗАМЕНЯЕМЫЙ
    исполнитель. (Полный tool-less `--tools ""` авторит вслепую -> невалидная спека; read-only даёт контекст
    без права действия — доказано fs-rc3.)

    v3.10.0 Usage Truth: `--output-format json` -> claude usage (input/output_tokens) + total_cost_usd
    ИЗМЕРЯЮТСЯ и пишутся в _record_call (provider=claude-cli). Claude CLI usage больше НЕ исчезает.

    runner инъектируется (офлайн-selftest без вызова CLI); заменяет subprocess.run, а не весь вызов —
    production-path (time.monotonic, json parse, _record_call, retries) проходит полностью. Ключ не требуется.

    Устойчивость к транзиентам (находка F-011, Real-Product Qualification): транзиентные сбои API
    (5xx/429/**529 Overloaded**, сетевые, subprocess-timeout) ретраятся с экспоненциальным backoff+jitter,
    а не после 3 фиксированных пауз — один невосстановленный 529 больше не роняет весь многошаговый прогон.
    Синтетический конверт claude `is_error:true` на rc==0 (напр. 529: `input_tokens:0, stop_reason:stop_sequence`)
    распознаётся и НЕ выдаётся за валидный результат. Полный человекочитаемый текст ошибки сохраняется
    (парсинг `content[].text`/`error`), а не режется до 200 символов (F-011a — обрезка прятала «529 Overloaded»).

    Промпт передаётся ПОСЛЕДНИМ, после разделителя `--` (находка живого прогона на child-репозитории,
    2026-08-14). Промпты ролей — markdown с YAML-фронтматтером, то есть начинаются с `---`; в позиции
    до разделителя CLI разбирал их как ключ и падал с `unknown option '---…'` на КАЖДОЙ из 5 попыток.
    Ломалось не всё подряд: tool-loop строит промпт с текста, а run_workflow подаёт документ роли как
    есть — поэтому `--review`/`--author`/`--reevaluate-only` были недоступны с провайдером claude-cli,
    а обычный прогон работал. Разделитель снимает класс целиком: после `--` любой текст — позиционный
    аргумент, чем бы он ни начинался."""
    
    
    
    
    from ai_ops_kit.providers.orchestrator_providers import claude_binary, claude_missing_message
    
    
    
    
    
    
    binary = "claude"
    if runner is None:
        binary = claude_binary()
        if not binary:
            raise RuntimeError(claude_missing_message())
    cmd = [binary, "-p", "--output-format", "json",
           "--allowedTools", "Read", "Grep", "Glob"]
    if model:
        cmd += ["--model", model]
    cmd += ["--", prompt]
    import subprocess
    import json as _json
    import time
    import random
    
    _run = runner if runner is not None else (lambda c: subprocess.run(c, capture_output=True, text=True, timeout=timeout))

    last = ""
    for _attempt in range(max_attempts):
        _t0 = time.monotonic()
        try:
            
            
            
            if runner is None:
                with _writer_serialization_lock(notify=lambda m: sys.stderr.write(m + "\n")):
                    r = _run(cmd)
            else:
                r = _run(cmd)
        except subprocess.TimeoutExpired:   # обычно слишком большой промпт (весь транскрипт одним argv, см. F-011)
            last = "claude -p: таймаут subprocess (%ss) — вероятно слишком большой промпт" % timeout
            if _attempt + 1 >= max_attempts:
                break
            _backoff(_attempt); continue
        
        
        
        except FileNotFoundError:
            raise RuntimeError(claude_missing_message(
                extra=f"путь был проверен и исчез до запуска: {cmd[0]}")) from None
        except OSError as exc:                # права, битый симлинк, не тот формат бинаря
            raise RuntimeError(
                f"`claude` найден ({cmd[0]}), но не запускается: {exc}. Проверьте права на файл "
                f"и что это исполняемый бинарь, а не обёртка оболочки (alias/function)."
            ) from None
        if r.returncode == 0:
            try:
                d = _json.loads(r.stdout)
            except (ValueError, TypeError):   # не JSON -> usage unavailable (НЕ теряем факт вызова)
                _record_call(model or "claude-code-local", None, None, time.monotonic() - _t0, provider="claude-cli")
                return r.stdout
            if d.get("is_error"):   # синтетический конверт claude (rc=0!), напр. 529 Overloaded — НЕ валидный результат
                last = _human_error(r.stdout)
                # #160: СТРУКТУРНЫЙ ОТКАЗ СРЕДЫ (сессия внутри сессии) распознаётся ПЕРВЫМ — до
                # транзиентной/лимитной веток. Признак (api_error + 0 токенов + duration_api_ms:0)
                # детерминированный: повтор его не лечит. Наружу — последствие и оба выхода фразой.
                if _env_unavailable_envelope(d):
                    raise ProviderEnvUnavailableError("claude-cli", last)
                
                if _session_limit(last):
                    raise ProviderLimitError("claude-cli", last, _reset_hint(last))
                if _transient(last) and _attempt + 1 < max_attempts:
                    _backoff(_attempt); continue
                raise RuntimeError("claude -p вернул is_error (rc=0): %s" % last)
            u = d.get("usage") or {}
            _record_call(d.get("model") or model or "claude-code-local",
                         u.get("input_tokens"), u.get("output_tokens"), time.monotonic() - _t0,
                         provider="claude-cli", cost=d.get("total_cost_usd"))
            
            
            
            
            result = d.get("result") or ""
            if not result.strip():
                raise ProviderRefusal("empty_answer", "claude -p вернул пустой result (rc=0)",
                                      "claude-cli", d.get("model") or model or "claude-code-local")
            return result
        last = _human_error(r.stderr or r.stdout or "")
        # #160: тот же синтетический конверт среды может прийти и с ненулевым кодом — разберём stdout
        # и распознаём структурный отказ до транзиентной/лимитной веток (повтор его не лечит).
        try:
            _env_d = _json.loads(r.stdout)
        except (ValueError, TypeError):
            _env_d = None
        if _env_unavailable_envelope(_env_d):
            raise ProviderEnvUnavailableError("claude-cli", last)
        
        
        
        if _session_limit(last):
            raise ProviderLimitError("claude-cli", last, _reset_hint(last))
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        
        if not _transient(last):
            raise RuntimeError(
                "claude -p отказал структурно (код %s), повтор не назначен — он не сделал бы "
                "систему надёжнее, только медленнее: %s" % (r.returncode, last))
        if _attempt + 1 >= max_attempts:
            break
        _backoff(_attempt)
    raise RuntimeError("claude -p не удался после %d попыток: %s" % (max_attempts, last))


def make_claude_cli_provider(model=None, runner=None):
    """callable(prompt)->text через локальный `claude -p` (tool-less). См. _claude_cli_call: executing-adapter
    контракт — Claude предлагает, кит исполняет и блокирует по гейтам."""
    return lambda prompt: _claude_cli_call(prompt, model=model, runner=runner)


def make_openai_provider(model, base_url, key_env):
    """openai-compatible провайдер с ЯВНЫМ endpoint+key_env — per-role/vendor маршрутизация (v3.7.12,
    Router->ai_ops_run). Ключ читает _openai_call из env по имени key_env; значение не передаётся и не
    логируется. Так writer/reviewer резолвятся в РАЗНЫЕ модели/вендоры в одном прогоне."""
    return lambda prompt: _openai_call(prompt, model, base_url=base_url, key_env=key_env)
