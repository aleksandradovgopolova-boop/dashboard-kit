#!/usr/bin/env python3
"""Deterministic SDK/eval coverage; not a claim of independent AI-agent success."""
import json
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
manifest=json.loads((ROOT/'kit-manifest.json').read_text())
parts=manifest['parts']
if isinstance(parts,list): parts={p['id']:p for p in parts}
evals=json.loads((ROOT/'skill/dashboard-build/evals/evals.json').read_text())['evals']
required=['breadcrumbs','tooltip','details-sidebar','heatmap','bullet-chart','period-comparison','timeline-annotations','fullscreen','export','density-controls','tree-select','saved-views','layout-editor']
for name in required:
    assert name in parts, name
    part=parts[name]
    assert part['example'] and part['api'] and part['a11y'] and part['instead'], name
    assert any(name in e.get('components',[]) for e in evals), 'missing skill task: '+name
    subprocess.run(['python3','tools/kit.py','head',name],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
assert len({e['id'] for e in evals})==len(evals),'duplicate eval ids'
print('PASS: 13 new SDK entries, dependency closure, examples, anti-patterns, accessibility and skill task coverage; AI execution not assessed')
