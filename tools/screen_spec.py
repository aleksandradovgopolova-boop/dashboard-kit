"""Closed, deterministic plan-fact screen compiler. No source text becomes code."""
from __future__ import annotations
import hashlib
import html
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
from component_contracts import IDENTIFIER, TEXT, object_schema, validate_schema

ROOT = Path(__file__).resolve().parent.parent


def require(ok, path, message):
    if not ok:
        raise ValueError(f"{path}: {message}")


def unique(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, "JSON", "duplicate field " + key)
        value[key] = item
    return value


def read_json(path):
    require(path.stat().st_size <= 1048576, str(path), "JSON exceeds 1 MiB")
    return json.loads(path.read_text("utf-8"), object_pairs_hook=unique,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError("non-finite JSON number")))


def source_file(root, relative):
    require(type(relative) is str and relative and not Path(relative).is_absolute(), "source.file", "relative file required")
    path = root / relative
    require(".." not in Path(relative).parts and path.resolve().is_relative_to(root.resolve()), "source.file", "path escapes input root")
    require(not any(parent.is_symlink() for parent in [path, *path.parents] if parent.is_relative_to(root)), "source.file", "symlink not allowed")
    require(path.is_file(), "source.file", "file not found: " + relative)
    return path


def _shape(value, properties, required, path):
    return validate_schema(value, object_schema(properties, required), path)


def release_api():
    descriptor = importlib.util.spec_from_file_location("screen_release", ROOT/"tools/kit-release.py")
    release = importlib.util.module_from_spec(descriptor); descriptor.loader.exec_module(release)
    return release


def trusted_kit(kit_root, expected=None):
    release = release_api()
    if kit_root.resolve() != ROOT.resolve():
        require(expected is not None, "kit", "external --kit requires an external --expect digest before executing its code")
        return release.verify_package(kit_root, expected)
    document = release.check_source(kit_root)
    if expected is not None:
        require(document["contentDigest"] == expected, "kit", "source does not match --expect pin")
    return document


def validate(spec, input_root=ROOT, kit_root=ROOT, expected=None):
    trusted_kit(kit_root, expected)
    source = object_schema({"file": TEXT, "registry": TEXT,
        "grain": object_schema({"time": {"const": "day", "type": "string"}, "dimensions": {"type": "array", "items": IDENTIFIER, "uniqueItems": True}}, ["time", "dimensions"]),
        "coverage": object_schema({"expectedRows": {"type": "integer"}}, ["expectedRows"])}, ["file", "registry", "grain", "coverage"])
    spec = _shape(spec, {"schemaVersion": {"type": "integer", "const": 1}, "id": IDENTIFIER, "title": TEXT,
        "question": TEXT, "recipe": {"type": "string", "const": "plan-fact"}, "kind": {"type": "string", "const": "overview"},
        "source": source, "bindings": {"type": "array", "minItems": 1, "maxItems": 32},
        "filters": {"type": "array", "maxItems": 6, "default": []}, "widgets": {"type": "array", "minItems": 1, "maxItems": 16},
        "actions": {"type": "array", "maxItems": 16, "default": []},
        "responsive": object_schema({"desktop": {"type": "string", "const": "balanced"}, "mobile": {"type": "string", "const": "stack"}}, ["desktop", "mobile"])},
        ["schemaVersion", "id", "title", "question", "recipe", "kind", "source", "bindings", "widgets", "responsive"], "spec")
    manifest = read_json(kit_root / "kit-manifest.json")
    require(manifest.get("parameterSchemaVersion") == 1, "kit", "parameter contract version 1 required")
    parts = {part["id"]: part for part in manifest["parts"]}
    data = read_json(source_file(input_root, spec["source"]["file"]))
    registry = read_json(source_file(input_root, spec["source"]["registry"]))
    # Use the actual pinned JS boundary, never a second Python aggregation engine.
    checker = "const fs=require('node:fs'),vm=require('node:vm');const input=JSON.parse(fs.readFileSync(0,'utf8'));const c=vm.createContext({window:{}});for(const f of ['dk-dashboard.js','dk-metrics.js'])vm.runInContext(fs.readFileSync(input.root+'/js/'+f,'utf8'),c);const d=c.window.dkDashboard.validate(input.data),r=c.window.dkMetrics.validate(input.registry,d);c.window.dkMetrics.select(d,r,{},input.options);const selected=c.window.dkMetrics.select(d,r,{}, {...input.options,coverage:{expectedRows:d.rows.length}});for(const metric of Object.values(selected.totals))if(['grain-unknown','incompatible-grain','ambiguous-grain'].includes(metric.code))throw Error(metric.code);process.stdout.write(JSON.stringify({data:d,registry:r}));"
    result = subprocess.run(["node", "-e", checker], input=json.dumps({"root": str(kit_root), "data": data, "registry": registry,
                            "options": {key: spec["source"][key] for key in ["grain", "coverage"]}}, allow_nan=False), text=True, capture_output=True, timeout=30)
    require(result.returncode == 0, "source", "actual data/metric contract rejected input: " + result.stderr[:1200])
    checked = json.loads(result.stdout); data = checked["data"]; registry = checked["registry"]
    require(len(data["rows"]) <= 1000, "source.rows", "first local recipe supports up to 1000 observations; large/server sources require a separate adapter")
    raw = {field["id"]: field for field in data["metrics"]}; named = {field["id"]: field for field in registry["metrics"]}
    dimensions = {field["id"]: field for field in data["dimensions"]}; bindings = {}
    for index, binding in enumerate(spec["bindings"]):
        binding = _shape(binding, {"id": IDENTIFIER, "kind": {"type": "string", "enum": ["source", "named", "alias"]},
                         "field": IDENTIFIER, "ref": IDENTIFIER}, ["id", "kind"], f"bindings[{index}]")
        require(binding["id"] not in bindings, "bindings", "duplicate binding " + binding["id"])
        if binding["kind"] == "alias":
            require("ref" in binding and "field" not in binding, "bindings", "alias requires only ref")
        else:
            require("field" in binding and "ref" not in binding, "bindings", "source/named requires only field")
        bindings[binding["id"]] = binding
    resolved = {}
    def resolve(name, chain=()):
        require(name in bindings, "bindings", "unknown binding " + name)
        require(name not in chain, "bindings", "cyclic dependency: " + " → ".join((*chain, name)))
        if name in resolved:
            return resolved[name]
        binding = bindings[name]
        if binding["kind"] == "alias":
            item = {**resolve(binding["ref"], (*chain, name)), "id": name}
        else:
            fields = raw if binding["kind"] == "source" else named
            require(binding["field"] in fields, "bindings", "unknown metric " + binding["field"])
            metadata = fields[binding["field"]]
            item = {**binding, "label": metadata["label"], "unit": metadata["unit"],
                    "format": metadata.get("format", {"type": "percent" if metadata["unit"] == "%" else "number", "digits": 1 if metadata.get("aggregation") == "mean" else 0})}
        resolved[name] = item
        return item
    for name in bindings:
        resolve(name)
    ids = set(); widgets = []; filters = []
    for section, entries, output in [("filters", spec["filters"], filters), ("widgets", spec["widgets"], widgets)]:
        for index, entry in enumerate(entries):
            entry = _shape(entry, {"id": IDENTIFIER, "component": IDENTIFIER, "props": {"type": "object"}}, ["id", "component", "props"], f"{section}[{index}]")
            require(entry["id"] not in ids, section, "duplicate ID " + entry["id"]); ids.add(entry["id"])
            allowed = ["select"] if section == "filters" else ["tile", "chart", "table"]
            require(entry["component"] in allowed and entry["component"] in parts, section, "unregistered/unsupported component " + entry["component"])
            definition = parts[entry["component"]].get("parameterContract")
            require(definition and definition["schemaVersion"] == 1, section, "component parameter schema v1 required")
            entry["props"] = validate_schema(entry["props"], definition["parameters"], entry["id"])
            props = entry["props"]
            for name in [props["metric"]] if entry["component"] == "tile" else props.get("metrics", []):
                require(name in resolved, entry["id"], "unresolved metric binding " + name)
            if "dimension" in props:
                require(props["dimension"] in dimensions, entry["id"], "unknown dimension " + props["dimension"])
            if entry["component"] == "chart":
                require(all(resolved[name]["kind"] == "source" for name in props["metrics"]), entry["id"], "v1 charts accept only source daily series; derived series are not implemented")
                require(len({resolved[name]["unit"] for name in props["metrics"]}) == 1, entry["id"], "one chart axis requires the same unit")
            output.append(entry)
    require(len({entry["props"]["dimension"] for entry in filters}) == len(filters), "filters", "duplicate dimension")
    require(sum(entry["component"] == "tile" for entry in widgets) <= 7, "widgets", "overview allows at most seven KPI")
    seen_panel = False
    for widget in widgets:
        require(not (seen_panel and widget["component"] == "tile"), "widgets", "overview KPI must precede detailed panels")
        seen_panel |= widget["component"] != "tile"
    actions = []
    for index, action in enumerate(spec["actions"]):
        action = _shape(action, {"id": IDENTIFIER, "type": {"type": "string", "enum": ["clear-filters", "open-details"]}, "target": IDENTIFIER}, ["id", "type"], f"actions[{index}]")
        require(action["id"] not in ids, "actions", "duplicate ID"); ids.add(action["id"])
        if action["type"] == "clear-filters":
            require("target" not in action and not any(item["type"] == "clear-filters" for item in actions), "actions", "only one untargeted clear-filters action")
        else:
            target = next((entry for entry in widgets if entry["id"] == action.get("target")), None)
            require(target and target["component"] == "table" and target["props"]["details"], "actions", "open-details target must be a table with details enabled")
            require(not any(item.get("target") == target["id"] for item in actions), "actions", "duplicate details action")
        actions.append(action)
    for widget in widgets:
        if widget["component"] == "table" and widget["props"]["details"]:
            require(any(action.get("target") == widget["id"] for action in actions), widget["id"], "details require a real open-details action")
    spec.update(bindings=list(resolved.values()), filters=filters, widgets=widgets, actions=actions)
    return {"spec": spec, "data": data, "registry": registry}


def safe_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).replace("&", "\\u0026").replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def render(config, kit_root=ROOT):
    sys.path.insert(0, str(ROOT/"tools")); import kit
    manifest = read_json(kit_root/"kit-manifest.json")
    includes = kit.cmd_head(manifest, ["screen", "widget", "page-header", "glass", "--prefix", "kit/"])
    spec = config["spec"]; escape = lambda value: html.escape(str(value), quote=True)
    config_id = spec['id'] + '-config'
    digest = hashlib.sha256(safe_json(config).encode()).hexdigest()
    return f'''<!doctype html>
<html lang="ru" class="dk-root" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(spec['title'])}</title>{includes}</head>
<body class="dk-page dk-glass" data-dk-screen="overview"><main class="dk-wrap dk-sections dk-screen" id="{escape(spec['id'])}" data-dk-screen-config="{escape(config_id)}" aria-busy="true">
<header class="dk-head"><div class="dk-head__titles"><h1 class="dk-head__title">{escape(spec['title'])}</h1></div><div class="dk-head__actions"><div class="dk-seg" aria-label="Тема"><button data-theme-set="dark" aria-label="Тёмная тема" title="Тёмная тема"><svg class="dk-i" aria-hidden="true"><use href="#ti-moon"/></svg></button><button data-theme-set="light" aria-label="Светлая тема" title="Светлая тема"><svg class="dk-i" aria-hidden="true"><use href="#ti-sun"/></svg></button></div></div></header>
<div class="dk-screen__meta"><p class="dk-caption" data-screen-source></p><button class="dk-iconbtn dk-iconbtn--sm" type="button" data-screen-info aria-label="Данные и методика" title="Данные и методика"><svg class="dk-i" aria-hidden="true"><use href="#ti-info-circle"/></svg></button></div><div class="dk-screen__filters" data-screen-filters></div>
<div class="dk-caption" role="status" data-screen-status hidden></div>
<section class="dk-empty" data-screen-empty hidden><h2 class="dk-empty__t">Нет результатов</h2></section>
<div class="dk-sections" data-screen-content><div class="dk-grid dk-grid--balanced" data-screen-kpis></div><div class="dk-grid dk-grid--balanced" data-screen-panels></div></div>
</main><script type="application/json" id="{escape(config_id)}">{safe_json(config)}</script><!-- screen-spec/1 inputs:{digest} --></body></html>\n'''


def build(spec_path, destination, input_root=ROOT, kit_root=ROOT, expected=None):
    config = validate(read_json(spec_path), input_root, kit_root, expected)
    html_text = render(config, kit_root)
    from screen_policy import review_html
    require(not review_html("generated/index.html", html_text), "composition", "structural policy rejected generated screen")
    destination = Path(destination)
    require(not destination.exists(), "output", "directory exists; use a new output directory to preserve local changes")
    release = release_api()
    # Build entirely in a fresh directory; no consumer lock/config is changed.
    destination.mkdir(parents=True)
    try:
        release.pack(kit_root, destination/"kit")
        (destination/"index.html").write_text(html_text, "utf-8")
        (destination/"screen-input.json").write_text(safe_json(config) + "\n", "utf-8")
    except BaseException:
        import shutil
        shutil.rmtree(destination)
        raise
    return config
