#!/usr/bin/env python3
"""Complete, fail-closed local/CI suite. No runtime dependencies are installed."""
import os
import shutil
import subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

def run(args, timeout=240):
    subprocess.run(args, cwd=ROOT, check=True, timeout=timeout)

def main():
    node = shutil.which('node')
    if not node:
        raise SystemExit('Node.js 22+ required for the complete suite')
    run([node, '--input-type=module', '-e', "import {findChrome} from './tools/browser-harness.mjs';if(!findChrome())throw Error('Chrome required: full validation cannot skip browser');if(Number(process.versions.node.split('.')[0])<22)throw Error('Node 22+ required')"])
    for file in sorted((ROOT / 'js').glob('*.js')):
        run([node, '--check', str(file)])
    run([node, 'tools/check-dashboard-data.mjs'])
    run([node, 'tools/check-family-mortgage-data.mjs'])
    run(['python3', 'tools/check-reference-server.py'])
    run([node, 'tools/check-reference-contract.mjs'])
    run(['python3', 'tools/check-release.py'])
    run(['python3', 'tools/kit-release.py', '--check'])
    run(['python3', 'tools/check.py'], timeout=600)
    for name in ['docs', 'reference-dashboard', 'family-mortgage', 'select', 'chips', 'meaning', 'advanced', 'runtime', 'filter-context', 'dashboard-overview', 'composition', 'region-focus', 'sdk-snippets']:
        run([node, f'tools/check-{name}.mjs'])
    from tempfile import gettempdir
    evidence = Path(os.environ.get('DK_EVIDENCE_DIR', str(Path(gettempdir()) / 'dashboard-kit-evidence')))
    evidence.mkdir(parents=True, exist_ok=True)
    run([node, 'tools/snap.mjs', 'dashboard.html', '--size', '390x844', '--theme', 'dark', '--out', str(evidence.resolve() / 'dashboard-dark.png')])
    run(['python3', 'tools/check-contract.py'])
    run(['python3', 'tools/check-evals.py'])
    run(['git', 'diff', '--check'])
    print('PASS: complete static, generated files, mobile, browser, runtime, SDK fixture checks')

if __name__ == '__main__':
    main()
