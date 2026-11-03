#!/usr/bin/env python3
"""Validate and build the first static plan-fact recipe without an agent subprocess."""
import argparse
import json
from pathlib import Path
from screen_spec import ROOT, build, read_json, validate

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--input-root", type=Path, default=ROOT)
    parser.add_argument("--kit", type=Path, default=ROOT)
    parser.add_argument("--expect", help="External digest pin, required for an installed --kit")
    args = parser.parse_args()
    try:
        if args.out:
            result = build(args.spec, args.out, args.input_root.resolve(), args.kit.resolve(), args.expect)
        else:
            result = validate(read_json(args.spec), args.input_root.resolve(), args.kit.resolve(), args.expect)
    except (ValueError, OSError) as error:
        parser.exit(1, str(error) + "\n")
    print(json.dumps({"schemaVersion": 1, "status": "built" if args.out else "validated", "screen": result["spec"]["id"], "output": str(args.out) if args.out else None}, ensure_ascii=False))
