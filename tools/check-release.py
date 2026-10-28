#!/usr/bin/env python3
"""Exercise version pinning, corruption rejection and isolated rollback packages."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile

spec = importlib.util.spec_from_file_location("kit_release", Path(__file__).with_name("kit-release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def rejects(action, message):
    try:
        action()
    except (release.ReleaseError, OSError):
        return
    raise AssertionError(message)


with tempfile.TemporaryDirectory(prefix="dk-release-test-") as temporary:
    base = Path(temporary)
    source = base / "source"
    source.mkdir()
    for name in release.FIXED_FILES | {"js/dk-theme.js", "js/dk-util.js", "vendor/example.js", "icons/favicon.svg", "data/geometry.json", "assets/graphite-dark.png", "assets/graphite-light.png"}:
        path = source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("fixture: " + name, encoding="utf-8")
    (source / "kit-manifest.json").write_text(json.dumps({
        "include": {"css": [{"file": "css/components.css"}], "scripts": [{"file": "js/dk-theme.js"}, {"file": "js/dk-util.js"}, {"file": "js/dk-dashboard.js"}]},
        "parts": [{"data": ["data/geometry.json"]}],
    }), encoding="utf-8")
    first = release.write_descriptor(source)
    assert first == release.build_descriptor(source), "Identical sources must produce identical descriptor bytes/digest"
    assert release.check_source(source) == first
    bundle1 = base / "0.1.0-rc.1"
    release.pack(source, bundle1)
    assert release.verify_package(bundle1, first["contentDigest"]) == first
    for asset in ("assets/graphite-dark.png", "assets/graphite-light.png"):
        assert asset in first["files"], "CSS background omitted from descriptor"
        assert (bundle1 / asset).read_bytes() == (source / asset).read_bytes(), "CSS background omitted from package"
    rejects(lambda: release.verify_package(bundle1, None), "A self-declared digest must not count as a consumer pin")
    rejects(lambda: release.verify_package(bundle1, "sha256:" + "0" * 64), "Wrong external pin accepted")
    rejects(lambda: release.pack(source, bundle1), "An existing version directory was overwritten")
    existing_empty = base / "existing-empty"
    existing_empty.mkdir()
    rejects(lambda: release.pack(source, existing_empty), "An existing empty directory was overwritten")
    assert existing_empty.is_dir() and not list(existing_empty.iterdir())

    runtime = bundle1 / "js/dk-dashboard.js"
    original = runtime.read_bytes()
    runtime.write_bytes(original + b" tampered")
    rejects(lambda: release.verify_package(bundle1, first["contentDigest"]), "Modified runtime was accepted")
    runtime.write_bytes(original)
    descriptor_path = bundle1 / release.DESCRIPTOR
    descriptor_original = descriptor_path.read_bytes()
    tampered = copy.deepcopy(first)
    tampered["version"] = "0.1.0-rc.99"
    tampered["contentDigest"] = release.digest(tampered)
    descriptor_path.write_text(json.dumps(tampered), encoding="utf-8")
    rejects(lambda: release.verify_package(bundle1, first["contentDigest"]), "Changed descriptor bypassed external pin")
    descriptor_path.write_bytes(descriptor_original)

    extra = bundle1 / "injected.js"
    extra.write_text("unexpected", encoding="utf-8")
    rejects(lambda: release.verify_package(bundle1, first["contentDigest"]), "Unexpected runtime file accepted")
    extra.unlink()
    runtime.unlink()
    runtime.symlink_to(source / "js/dk-dashboard.js")
    rejects(lambda: release.verify_package(bundle1, first["contentDigest"]), "Symlink escape accepted")
    runtime.unlink()
    runtime.write_bytes(original)
    for unsafe in ("../escape", "/absolute", "css/../../escape", "css//x", "css/./x", "C:\\x", "x\x00y"):
        document = copy.deepcopy(first)
        document["files"][unsafe] = "0" * 64
        document["contentDigest"] = release.digest(document)
        rejects(lambda d=document: release.validate_descriptor(d), "Unsafe descriptor path accepted: " + repr(unsafe))
    descriptor_path.write_text('{"schemaVersion":1,"schemaVersion":2}', encoding="utf-8")
    rejects(lambda: release.read_json(descriptor_path), "Duplicate JSON fields accepted")
    descriptor_path.write_bytes(descriptor_original)

    # A consumer can switch back to an untouched package after testing a new one.
    (source / "js/dk-dashboard.js").write_bytes(original + b" second version")
    rejects(lambda: release.check_source(source), "Changed source passed the old descriptor")
    second = release.write_descriptor(source, "0.1.0-rc.2")
    assert second["contentDigest"] != first["contentDigest"]
    bundle2 = base / "0.1.0-rc.2"
    release.pack(source, bundle2)
    assert release.verify_package(bundle2, second["contentDigest"]) == second
    assert release.verify_package(bundle1, first["contentDigest"]) == first
    assert (bundle1 / "js/dk-dashboard.js").read_bytes() == original
    rejects(lambda: release.verify_package(bundle2, first["contentDigest"]), "Old consumer pin silently accepted an upgrade")
    (source / "js/dk-unlisted.js").write_text("new runtime module", encoding="utf-8")
    rejects(lambda: release.check_source(source), "A new module was omitted from the source lock")

print("PASS: reproducible runtime package, external version pin, corruption/path/symlink rejection, isolated upgrade and rollback packages")
