#!/usr/bin/env python3
"""Independent positive/negative acceptance for the small parameter catalog."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
from component_contracts import CONTRACTS, contract, reference, validate

ROOT = Path(__file__).resolve().parent.parent


def rejected(component, values, version=1):
    try:
        validate(component, values, version)
    except ValueError:
        return
    raise AssertionError(f"Accepted invalid {component}: {values!r}")


valid = {"tile": {"metric": "execution"}, "chart": {"title": "Выдачи", "type": "bar", "metrics": ["issued", "plan"]},
         "table": {"title": "Регионы", "dimension": "region", "metrics": ["issued", "execution"]},
         "select": {"dimension": "region", "label": "Регион"}}
for component, parameters in valid.items():
    original = deepcopy(parameters)
    result = validate(component, parameters)
    assert parameters == original and result["schemaVersion"] == 1
    rejected(component, {**parameters, "unknown": True})
    rejected(component, {})
    rejected(component, parameters, 2)
assert validate("chart", valid["chart"])["parameters"] == {**valid["chart"], "orientation": "vertical", "groupBy": "date"}
assert validate("table", valid["table"])["parameters"]["details"] is False
assert validate("select", valid["select"])["parameters"]["mode"] == "single"
assert validate("chart", {**valid["chart"], "orientation": "horizontal"})["parameters"]["orientation"] == "horizontal"
for change in [{"type": "line", "orientation": "horizontal"}, {"metrics": []}, {"metrics": "issued"},
               {"metrics": ["issued", "issued"]}, {"metrics": ["constructor"]}, {"metrics": ["issued"]*5}, {"groupBy": "month"}]:
    rejected("chart", {**valid["chart"], **change})
for value in [0, "false", None]:
    rejected("table", {**valid["table"], "details": value})
rejected("select", {**valid["select"], "mode": "multi"})
rejected("tile", {"metric": "<script>"})
rejected("tile", {"metric": " "})
rejected("tile", {"metric": "execution\n"})
rejected("unknown", {})
manifest = json.loads((ROOT/"kit-manifest.json").read_text())
assert manifest["parameterSchemaVersion"] == 1
parts = {part["id"]: part for part in manifest["parts"]}
for component in CONTRACTS:
    assert parts[component]["parameterContract"] == contract(component)
    assert all(dependency in parts for dependency in contract(component)["dependencies"])
    result = subprocess.run([sys.executable, "tools/kit.py", "schema", component], cwd=ROOT, text=True, capture_output=True, check=True)
    assert json.loads(result.stdout) == contract(component)
    result = subprocess.run([sys.executable, "tools/kit.py", "validate", component, json.dumps(valid[component])], cwd=ROOT, text=True, capture_output=True, check=True)
    assert json.loads(result.stdout) == validate(component, valid[component])
assert (ROOT/"skill/dashboard-build/references/component-parameters.md").read_text() == reference()
for payload in ['{"metric":"issued","metric":"plan"}', '{"metric":NaN}']:
    assert subprocess.run([sys.executable,"tools/kit.py","validate","tile",payload],cwd=ROOT,capture_output=True).returncode != 0
for command, args in [("list", []),("show",["tile"]),("find",["таблица"]),("head",["chart"])]:
    assert subprocess.run([sys.executable,"tools/kit.py",command,*args],cwd=ROOT,capture_output=True).returncode == 0
print("PASS: four canonical parameter schemas, defaults, strict types/unknown fields/combinations, versioning, generated reference and legacy CLI")
