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
primitives=check.strip_comments((ROOT/'css/tokens.primitives.css').read_text())
semantic=check.strip_comments((ROOT/'css/tokens.semantic.css').read_text())
check.problems.clear();check.check_spot(primitives,semantic.replace('--nodata-pattern: var(--ink);','--nodata-pattern: var(--nodata);'))
assert any('NO DATA' in p for p in check.problems),'guard missed invisible hatch'
print('PASS: deliberate manual/computed JS tokens and invisible hatch are rejected')
