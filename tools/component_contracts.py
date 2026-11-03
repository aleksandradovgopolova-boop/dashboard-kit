"""Canonical JSON contracts for the small screen-spec adapter, not every JS option."""
from copy import deepcopy
import json
import math
import re

VERSION = 1
TEXT = {"type": "string", "minLength": 1, "maxLength": 240}
IDENTIFIER = {"type": "string", "pattern": r"^[a-z][a-z0-9_-]*(?![\s\S])", "minLength": 1, "maxLength": 80}
METRICS = {"type": "array", "items": IDENTIFIER, "minItems": 1, "maxItems": 6, "uniqueItems": True}


def object_schema(properties, required):
    return {"type": "object", "properties": properties, "required": required, "additionalProperties": False}


CONTRACTS = {
    "tile": {"dependencies": ["dashboard-data", "named-metrics"], "actions": [],
             "parameters": object_schema({"metric": IDENTIFIER}, ["metric"])},
    "chart": {"dependencies": ["dashboard-data"], "actions": ["toggle-series"],
              "parameters": {**object_schema({"title": TEXT, "type": {"type": "string", "enum": ["bar", "line"]},
                    "orientation": {"type": "string", "enum": ["vertical", "horizontal"], "default": "vertical"},
                    "metrics": {**METRICS, "maxItems": 4}, "groupBy": {"type": "string", "const": "date", "default": "date"}}, ["title", "type", "metrics"]),
                 "if": {"properties": {"type": {"const": "line"}}},
                 "then": {"properties": {"orientation": {"const": "vertical"}}}}},
    "table": {"dependencies": ["dashboard-data", "named-metrics", "modal"], "actions": ["sort", "open-details"],
              "parameters": object_schema({"title": TEXT, "dimension": IDENTIFIER, "metrics": METRICS,
                    "details": {"type": "boolean", "default": False},
                    "sort": {"type": "string", "enum": ["asc", "desc"], "default": "asc"}}, ["title", "dimension", "metrics"])},
    "select": {"dependencies": ["dashboard-data"], "actions": ["change-filter"],
               "parameters": object_schema({"dimension": IDENTIFIER, "label": TEXT,
                    "mode": {"type": "string", "const": "single", "default": "single"}}, ["dimension", "label"])},
}


def contract(component, version=VERSION):
    if type(version) is not int or version != VERSION:
        raise ValueError(f"parameter schema version {version}: supported version is {VERSION}")
    if component not in CONTRACTS:
        raise ValueError(f"{component}: no screen-spec parameter contract; supported: {', '.join(CONTRACTS)}")
    return {"schemaVersion": VERSION, "target": "screen-spec/1", "component": component, **deepcopy(CONTRACTS[component])}


def _same(a, b):
    return type(a) is type(b) and a == b


def validate_schema(value, schema, path="parameters"):
    """Closed validator for the vocabulary used by this catalog, not arbitrary JSON Schema."""
    result = deepcopy(value)
    kind = schema.get("type")
    valid_type = {"object": lambda: type(value) is dict, "array": lambda: type(value) is list,
                  "string": lambda: type(value) is str, "boolean": lambda: type(value) is bool,
                  "integer": lambda: type(value) is int,
                  "number": lambda: type(value) in (int, float) and math.isfinite(value), "null": lambda: value is None}
    if kind and (kind not in valid_type or not valid_type[kind]()):
        raise ValueError(f"{path}: expected {kind}")
    if "enum" in schema and not any(_same(value, item) for item in schema["enum"]):
        raise ValueError(f"{path}: expected one of {schema['enum']}")
    if "const" in schema and not _same(value, schema["const"]):
        raise ValueError(f"{path}: expected {schema['const']!r}")
    if type(value) is dict:
        properties = schema.get("properties", {})
        unknown = set(value) - set(properties)
        if schema.get("additionalProperties") is False and unknown:
            raise ValueError(f"{path}: unknown parameter {sorted(unknown)[0]}")
        for key in schema.get("required", []):
            if key not in value:
                raise ValueError(f"{path}.{key}: required")
        for key, field in properties.items():
            if key in value:
                result[key] = validate_schema(value[key], field, path + "." + key)
            elif "default" in field:
                result[key] = validate_schema(field["default"], field, path + "." + key)
    if type(value) is list:
        if len(value) < schema.get("minItems", 0) or len(value) > schema.get("maxItems", float("inf")):
            raise ValueError(f"{path}: invalid number of items")
        if schema.get("uniqueItems") and len({json.dumps(item, sort_keys=True, ensure_ascii=False, allow_nan=False) for item in value}) != len(value):
            raise ValueError(f"{path}: duplicate item")
        result = [validate_schema(item, schema.get("items", {}), f"{path}[{i}]") for i, item in enumerate(value)]
    if type(value) is str:
        if not value.strip() or len(value) < schema.get("minLength", 0) or len(value) > schema.get("maxLength", float("inf")):
            raise ValueError(f"{path}: empty or too long")
        if "pattern" in schema and not re.fullmatch(schema["pattern"], value):
            raise ValueError(f"{path}: invalid identifier")
        if value in {"__proto__", "prototype", "constructor"} and "pattern" in schema:
            raise ValueError(f"{path}: unsafe identifier")
    if "if" in schema:
        try:
            validate_schema(result, schema["if"], path)
        except ValueError:
            branch = schema.get("else")
        else:
            branch = schema.get("then")
        if branch:
            result = validate_schema(result, branch, path)
    return result


def validate(component, parameters, version=VERSION):
    definition = contract(component, version)
    return {"schemaVersion": VERSION, "component": component,
            "parameters": validate_schema(parameters, definition["parameters"])}


def reference():
    lines = ["# Параметры статического screen-spec", "", "СОБРАНО tools/build-manifest.py из tools/component_contracts.py. Руками не править.",
             "", "Версия 1. Это минимальный декларативный адаптер screen-spec, а не полный JS API компонентов.",
             "Проверка: kit.py schema <id>; kit.py validate <id> '<JSON>'. Привязки к данным дополнительно проверяет сборщик экрана.", ""]
    for name, value in CONTRACTS.items():
        lines += ["## " + name, "", "Зависимости: " + ", ".join(value["dependencies"]),
                  "Действия: " + (", ".join(value["actions"]) or "нет"), "", "| Параметр | Тип | Обязательный | По умолчанию / варианты |", "|---|---|---|---|"]
        schema = value["parameters"]
        for key, field in schema["properties"].items():
            choices = field.get("enum", [field["const"]] if "const" in field else [])
            info = ("default=" + json.dumps(field["default"], ensure_ascii=False) + "; " if "default" in field else "") + ", ".join(map(str, choices))
            lines.append(f"| {key} | {field['type']} | {'да' if key in schema['required'] else 'нет'} | {info} |")
        if name == "chart":
            lines += ["", "line требует orientation=vertical; bar/horizontal собирается существующим bar-h."]
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"
