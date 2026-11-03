#!/usr/bin/env python3
"""Compile-time failures and byte-for-byte deterministic standalone artifacts."""
from copy import deepcopy
import json
from pathlib import Path
import tempfile
from screen_spec import ROOT, build, read_json, render, validate

example = read_json(ROOT/"examples/spec/plan-fact.json")
original = deepcopy(example)
config = validate(example)
assert example == original
assert config["spec"]["widgets"][3]["props"]["orientation"] == "vertical"


def rejects(mutate, message):
    spec = deepcopy(example); mutate(spec)
    try:
        validate(spec)
    except (ValueError, FileNotFoundError):
        return
    raise AssertionError("Accepted invalid spec: " + message)


for mutate, message in [
    (lambda s: s.update(schemaVersion=2), "version"),
    (lambda s: s.update(recipe="operations"), "unsupported recipe"),
    (lambda s: s.update(unknown=True), "unknown spec parameter"),
    (lambda s: s["source"].update(file="../outside.json"), "traversal"),
    (lambda s: s["source"].update(file="/etc/passwd"), "absolute file"),
    (lambda s: s["source"]["coverage"].update(expectedRows=3), "invalid coverage"),
    (lambda s: s["source"]["grain"].update(time="month"), "unsupported source grain"),
    (lambda s: s["source"]["grain"].update(dimensions=["region", "channel"]), "incompatible registry grain"),
    (lambda s: (s["source"]["grain"].update(dimensions=["region", "channel"]), s["source"]["coverage"].update(expectedRows=5)), "incompatible grain even when source is incomplete"),
    (lambda s: s["widgets"][0].update(component="invented"), "unregistered component"),
    (lambda s: s["widgets"][0]["props"].update(unknown=True), "unknown component parameter"),
    (lambda s: s["widgets"][0]["props"].update(metric=123), "wrong parameter type"),
    (lambda s: s["widgets"][0]["props"].update(metric="missing"), "unknown binding"),
    (lambda s: s["filters"][0]["props"].update(dimension="unknown"), "unknown dimension"),
    (lambda s: s["widgets"][3]["props"].update(metrics=["execution"]), "derived chart not implemented"),
    (lambda s: s["widgets"][3]["props"].update(type="line",orientation="horizontal"), "incompatible chart type"),
    (lambda s: s["actions"][1].update(target="missing"), "unknown action target"),
    (lambda s: s["actions"][1].update(type="fetch"), "arbitrary action"),
    (lambda s: s["actions"].pop(), "missing real details action"),
    (lambda s: s["bindings"].append({"id":"bad","kind":"source","field":"missing"}), "missing source field"),
    (lambda s: s["bindings"].extend([{"id":"a","kind":"alias","ref":"b"},{"id":"b","kind":"alias","ref":"a"}]), "cycle"),
    (lambda s: s["widgets"].extend({"id":"extra-"+str(i),"component":"tile","props":{"metric":"issued"}} for i in range(6)), "KPI limit"),
    (lambda s: s["filters"].append({"id":"again","component":"select","props":{"label":"Повтор","dimension":"region"}}), "duplicate filter"),
]:
    rejects(mutate, message)
alias = deepcopy(example); alias["bindings"].append({"id":"issued-alias","kind":"alias","ref":"issued"})
assert validate(alias)["spec"]["bindings"][-1]["field"] == "issued"
different_units = deepcopy(example)
different_units["bindings"].append({"id":"volume","kind":"source","field":"volume"})
different_units["widgets"][3]["props"]["metrics"]=["issued","volume"]
try:
    validate(different_units)
except ValueError as error:
    assert "same unit" in str(error)
else:
    raise AssertionError("Mixed chart units accepted")
xss = deepcopy(example); xss["title"] = '</title><img src=x onerror="window.injected=1">'; xss["question"] = '</script><script>window.injected=1</script>'
text = render(validate(xss))
assert '<img src=x' not in text and '<script>window.injected' not in text and '\\u003c/script' in text
reserved = deepcopy(example); reserved['id'] = 'screen-config'
assert 'data-dk-screen-config="screen-config-config"' in render(validate(reserved))
with tempfile.TemporaryDirectory(prefix="dk-screen-spec-") as directory:
    root = Path(directory); a=root/"a"; b=root/"b"
    build(ROOT/"examples/spec/plan-fact.json",a);build(ROOT/"examples/spec/plan-fact.json",b)
    assert {p.relative_to(a):p.read_bytes() for p in a.rglob('*') if p.is_file()} == {p.relative_to(b):p.read_bytes() for p in b.rglob('*') if p.is_file()}
    pin=read_json(a/"kit/kit-release.json")["contentDigest"]
    try:
        validate(example,kit_root=a/"kit")
    except ValueError as error:
        assert "external --expect" in str(error)
    else:
        raise AssertionError("External code was accepted without an external pin")
    assert validate(example,kit_root=a/"kit",expected=pin)["spec"]["id"]=="plan-fact"
    before=(a/"index.html").read_bytes()
    try:
        build(ROOT/"examples/spec/plan-fact.json",a)
    except ValueError as error:
        assert "exists" in str(error)
    else:
        raise AssertionError("Existing output was overwritten")
    assert (a/"index.html").read_bytes()==before
    (root/"source.json").symlink_to(ROOT/"examples/spec/plan-fact-source.json")
    spec=deepcopy(example);spec['source']['file']='source.json'
    try:
        validate(spec,input_root=root)
    except ValueError as error:
        assert 'symlink' in str(error) or 'escapes' in str(error)
    else:
        raise AssertionError('Symlink source accepted')
print("PASS: closed versioned spec, typed bindings/actions, cycles, invalid inputs, escaping, deterministic standalone build and preservation of existing output")
