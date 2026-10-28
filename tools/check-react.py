#!/usr/bin/env python3
"""Check the optional React adapter using an application's existing dependencies.

No npm install, product build or changes to the application's node_modules.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--dependencies', type=Path, required=True, help='Existing application node_modules')
args = parser.parse_args()
dependencies = args.dependencies.resolve()
root = Path(__file__).resolve().parent.parent
for name in ('react', 'react-dom', 'typescript', 'vitest', 'jsdom', '@testing-library/react'):
    if not (dependencies / name / 'package.json').is_file():
        parser.error(f'Missing dependency: {name} in {dependencies}')
with tempfile.TemporaryDirectory(prefix='dashboard-kit-react-') as folder:
    stage = Path(folder)
    modules = stage / 'node_modules'
    modules.mkdir()
    for entry in dependencies.iterdir():
        # Vite caches must remain in the temporary directory, not the host project.
        if not entry.name.startswith('.vite'):
            (modules / entry.name).symlink_to(entry, target_is_directory=entry.is_dir())
    shutil.copytree(root / 'integrations/react', stage / 'src')
    (stage / 'package.json').write_text('{"type":"module"}\n')
    (stage / 'tsconfig.json').write_text(json.dumps({'compilerOptions': {
        'target': 'ES2022', 'module': 'ESNext', 'moduleResolution': 'bundler',
        'jsx': 'react-jsx', 'strict': True, 'noEmit': True, 'skipLibCheck': True,
        'types': ['node'], 'lib': ['ES2022', 'DOM']}, 'include': ['src']}))
    (stage / 'vitest.config.mjs').write_text(
        'export default {test:{environment:"jsdom",include:["src/**/*.test.tsx"]}};\n')
    env = dict(os.environ, DASHBOARD_KIT_ROOT=str(root))
    subprocess.run(['node', str(dependencies / 'typescript/bin/tsc'), '-p', str(stage / 'tsconfig.json')],
                   cwd=stage, env=env, check=True)
    subprocess.run(['node', str(dependencies / 'vitest/vitest.mjs'), 'run', '--config', str(stage / 'vitest.config.mjs')],
                   cwd=stage, env=env, check=True)
