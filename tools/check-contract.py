#!/usr/bin/env python3
"""Exercise static guards against deliberate breakage; no files are mutated."""
import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('dk_check',ROOT/'tools/check.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)
for scripts,pages in [([('bad.js',"node.style.color='var(--crit)'")],[]),([], [('bad.html',"<script>node.style.color='var(--' + kind + ')'</script>")])]:
    check.problems.clear();check.check_dynamic_meaning(scripts,pages)
    assert check.problems,'guard missed deliberately broken source'
check.problems.clear();check.check_dynamic_meaning([('ok.js',"node.style.color=dkMeaning('crit','text')")],[])
assert not check.problems
print('PASS: deliberate manual/computed JS tokens are rejected')

from uiux_policy import validate
import json
policy=json.loads((ROOT/'.ai/project/uiux-policy.json').read_text())
assert not validate(ROOT,policy)
policy['heuristics'][6]['constitution']='UI-001'
assert validate(ROOT,policy), 'invented heuristic mapping accepted'
policy=json.loads((ROOT/'.ai/project/uiux-policy.json').read_text())
policy['coverage'].pop(next(iter(policy['coverage'])))
assert validate(ROOT,policy), 'missing constitution rule accepted'
print('PASS: UI/UX policy rejects invented mappings and incomplete coverage')

policy=json.loads((ROOT/'.ai/project/uiux-policy.json').read_text())
policy['patterns'][0]['components']=['nonexistent']
assert validate(ROOT,policy), 'pattern accepted missing component'
print('PASS: UX patterns reference actual component pages')
