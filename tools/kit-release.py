#!/usr/bin/env python3
"""Build and verify a pinned local runtime package; never publish or deploy it."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
DESCRIPTOR = "kit-release.json"
FIXED_FILES = {
    "LICENSE", "kit-manifest.json",
    "css/tokens.primitives.css", "css/tokens.semantic.css", "css/components.css",
    "css/chrome.css", "css/glass.css", "js/dk-dashboard.js",
    "reference-dashboard.html", "css/reference-dashboard.css",
    "js/reference-dashboard.js", "data/reference-dashboard.json",
    "docs/dashboard-data.md", "docs/releases.md", "docs/reference-server.md",
    "tools/reference-server.py",
    "family-mortgage.html", "js/family-mortgage-data.js", "js/family-mortgage.js",
    "data/family-mortgage-observations.json", "data/regions.topojson", "data/regions-tiles.json",
    "docs/family-mortgage.md",
    "docs/current-state.md", "docs/assembly-rules.md", "docs/2026-10-28/DASHBOARD-DETAIL-MODAL-001.md",
}
HEX = re.compile(r"[0-9a-f]{64}\Z")
VERSION = re.compile(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?\Z")


class ReleaseError(ValueError):
    pass


def unique_object(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            raise ReleaseError(f"Duplicate JSON key: {key}")
        out[key] = value
    return out


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)
    except (OSError, json.JSONDecodeError) as error:
        raise ReleaseError(f"Cannot read JSON {path}: {error}") from error


def relative_path(name):
    if not isinstance(name, str) or not name or "\\" in name or ":" in name or "\x00" in name:
        raise ReleaseError(f"Invalid package path: {name!r}")
    path = PurePosixPath(name)
    if path.is_absolute() or any(p in ("", ".", "..") for p in name.split("/")) or str(path) != name:
        raise ReleaseError(f"Unsafe package path: {name!r}")
    return path


def safe_file(root, name):
    parts = relative_path(name).parts
    path = root
    for part in parts:
        path = path / part
        if path.is_symlink():
            raise ReleaseError(f"Symlinks are not package files: {name}")
    if not path.is_file():
        raise ReleaseError(f"Missing package file: {name}")
    return path


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def digest(document):
    payload = {k: v for k, v in document.items() if k != "contentDigest"}
    return "sha256:" + sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def runtime_files(root):
    """Explicit runtime roots, plus every asset declared by the generated catalog."""
    names = set(FIXED_FILES)
    names.update(p.relative_to(root).as_posix() for p in (root / "js").glob("dk-*.js"))
    for folder in ("vendor", "icons", "assets"):
        for path in (root / folder).rglob("*"):
            if path.is_symlink():
                raise ReleaseError(f"Symlink in runtime assets: {path}")
            if path.is_file():
                names.add(path.relative_to(root).as_posix())
    manifest = read_json(safe_file(root, "kit-manifest.json"))
    try:
        names.update(item["file"] for group in ("css", "scripts") for item in manifest["include"][group])
        names.update(name for part in manifest["parts"] for name in part.get("data", []))
    except (KeyError, TypeError) as error:
        raise ReleaseError("Invalid runtime manifest") from error
    for name in names:
        safe_file(root, name)
    return sorted(names)


def validate_descriptor(document):
    if not isinstance(document, dict) or set(document) != {"schemaVersion", "version", "channel", "dataContractVersion", "files", "contentDigest"}:
        raise ReleaseError("Unsupported release descriptor fields")
    if type(document["schemaVersion"]) is not int or document["schemaVersion"] != 1:
        raise ReleaseError("Unsupported release descriptor version")
    if type(document["dataContractVersion"]) is not int or document["dataContractVersion"] != 1:
        raise ReleaseError("Unsupported dashboard data contract version")
    version = document["version"]
    if not isinstance(version, str) or not VERSION.fullmatch(version):
        raise ReleaseError("Invalid release version")
    if document["channel"] not in ("candidate", "stable"):
        raise ReleaseError("Invalid release channel")
    if (document["channel"] == "candidate") != ("-" in version):
        raise ReleaseError("Candidate requires a prerelease version; stable requires a final version")
    files = document["files"]
    if not isinstance(files, dict) or not FIXED_FILES.issubset(files):
        raise ReleaseError("Descriptor omits required runtime/reference files")
    for name, value in files.items():
        relative_path(name)
        if name == DESCRIPTOR or not isinstance(value, str) or not HEX.fullmatch(value):
            raise ReleaseError(f"Invalid hash entry: {name}")
    if document["contentDigest"] != digest(document):
        raise ReleaseError("Release descriptor digest does not match its metadata and files")
    return document


def build_descriptor(root, version="0.1.0-rc.1", channel="candidate"):
    document = {
        "schemaVersion": 1, "version": version, "channel": channel, "dataContractVersion": 1,
        "files": {name: sha256(safe_file(root, name).read_bytes()) for name in runtime_files(root)},
    }
    document["contentDigest"] = digest(document)
    return validate_descriptor(document)


def write_descriptor(root, version="0.1.0-rc.1", channel="candidate"):
    document = build_descriptor(root, version, channel)
    fd, temporary = tempfile.mkstemp(prefix=".kit-release-", suffix=".json", dir=root)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(document, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
        os.replace(temporary, root / DESCRIPTOR)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return document


def check_source(root):
    document = validate_descriptor(read_json(safe_file(root, DESCRIPTOR)))
    if set(document["files"]) != set(runtime_files(root)):
        raise ReleaseError("Runtime file set changed; regenerate the candidate descriptor after review")
    verify_hashes(root, document)
    return document


def verify_hashes(root, document):
    for name, expected in document["files"].items():
        if sha256(safe_file(root, name).read_bytes()) != expected:
            raise ReleaseError(f"Resource hash mismatch: {name}")


def verify_package(root, expected):
    if not isinstance(expected, str) or not expected.startswith("sha256:") or not HEX.fullmatch(expected[7:]):
        raise ReleaseError("An external --expect sha256:<digest> pin is required")
    document = validate_descriptor(read_json(safe_file(root, DESCRIPTOR)))
    if document["contentDigest"] != expected:
        raise ReleaseError("Package does not match the consumer's pinned digest")
    verify_hashes(root, document)
    actual = set()
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ReleaseError(f"Symlink in package: {path.relative_to(root)}")
        if path.is_file():
            actual.add(path.relative_to(root).as_posix())
    if actual != set(document["files"]) | {DESCRIPTOR}:
        raise ReleaseError("Package contains unexpected or missing files")
    if set(runtime_files(root)) != set(document["files"]):
        raise ReleaseError("Package does not contain the complete declared runtime")
    return document


def pack(root, destination):
    document = check_source(root)
    destination = Path(os.path.abspath(destination))
    if destination.exists() or destination.is_symlink():
        raise ReleaseError("Package destination already exists; choose a new version directory")
    if not destination.parent.is_dir():
        raise ReleaseError("Package parent directory must already exist")
    staging = Path(tempfile.mkdtemp(prefix=".dk-package-", dir=destination.parent))
    created = False
    try:
        for name in document["files"]:
            output = staging / name
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(safe_file(root, name).read_bytes())
        (staging / DESCRIPTOR).write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        verify_package(staging, document["contentDigest"])
        # mkdir is exclusive, so even an empty existing directory cannot be replaced.
        # The descriptor is the commit marker: it appears only after all assets move.
        destination.mkdir(exist_ok=False)
        created = True
        for child in staging.iterdir():
            if child.name != DESCRIPTOR:
                os.rename(child, destination / child.name)
        os.rename(staging / DESCRIPTOR, destination / DESCRIPTOR)
        verify_package(destination, document["contentDigest"])
        return document
    except Exception:
        if created:
            shutil.rmtree(destination)
        raise
    finally:
        shutil.rmtree(staging)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true", help="Regenerate a local candidate descriptor")
    mode.add_argument("--check", action="store_true", help="Check the source tree against its descriptor")
    mode.add_argument("--pack", type=Path, metavar="NEW_DIRECTORY", help="Copy a pinned package; never overwrite")
    mode.add_argument("--verify", type=Path, metavar="DIRECTORY", help="Verify an installed package against an external pin")
    parser.add_argument("--expect", help="Required for --verify: sha256:<digest> from the consumer lock")
    parser.add_argument("--version", default="0.1.0-rc.1", help="Version metadata for --write only")
    parser.add_argument("--channel", choices=("candidate", "stable"), default="candidate", help="Metadata for --write; does not publish")
    args = parser.parse_args()
    if bool(args.verify) != bool(args.expect):
        parser.error("--verify requires --expect; --expect is only valid with --verify")
    try:
        if args.write:
            document = write_descriptor(ROOT, args.version, args.channel)
        elif args.check:
            document = check_source(ROOT)
        elif args.pack:
            document = pack(ROOT, args.pack)
        else:
            document = verify_package(args.verify, args.expect)
        print(f"PASS: {document['version']} ({document['channel']}), {len(document['files'])} files, {document['contentDigest']}")
        return 0
    except (ReleaseError, OSError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
