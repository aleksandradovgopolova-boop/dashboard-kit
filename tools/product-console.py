#!/usr/bin/env python3
"""Read the project's existing sources; serve a local console or save a dated snapshot.

No agents, deployments, Git writes, or package updates are started by the server.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import tempfile
import os

ROOT = Path(__file__).resolve().parent.parent
CONSOLE = ROOT / 'product-console'
EVIDENCE = ROOT / '.ai/project/product-console'
SUITES = {
    'quick': ['python3', 'tools/check.py', '--fast'],
    'browser': ['python3', 'tools/check.py'],
    'full': ['python3', 'tools/test.py'],
    'runtime': ['python3', 'tools/kit-release.py', '--check'],
    'aiops': ['./ai-ops', 'doctor'],
}


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def read_json(path):
    try:
        return json.loads(path.read_text(encoding='utf-8')), None
    except (OSError, ValueError) as exc:
        return None, f'{path.name}: {type(exc).__name__}'


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.console-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def yaml_document(path):
    try:
        import yaml  # Already required by the installed AI Ops; no new dependency.
        data = yaml.safe_load(path.read_text(encoding='utf-8'))
        if not isinstance(data, dict):
            raise ValueError('Expected a mapping')
        return data, None
    except Exception as exc:
        # A malformed or unavailable source is unknown, never an empty successful plan.
        return None, f'{path.name}: {type(exc).__name__}'


def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True,
                            text=True, timeout=15, check=True)
    return result.stdout.rstrip('\n')


def signature(root):
    """Bind check results to source bytes, not to this page's refresh time."""
    files = set(root.glob('*.html')) | set(root.glob('css/*.css')) | set(root.glob('js/*.js'))
    files |= set(root.glob('tools/*.py')) | set(root.glob('tools/*.mjs'))
    files |= {root / 'kit-release.json', root / '.ai-ops.yaml', root / 'ai-ops',
              root / '.ai/managed/.checksums.json', root / '.ai/repository-profile.yaml',
              root / 'planning/plan.yaml', root / 'product-console/github.json',
              root / 'product-console/upstream.json', root / '.ai-ops/PRODUCT_PASSPORT.md'}
    files |= {p for p in (root / '.ai/managed').rglob('*')
              if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc'}
    digest = hashlib.sha256()
    for path in sorted(files):
        if path.is_file():
            digest.update(str(path.relative_to(root)).encode())
            digest.update(b'\0')
            digest.update(str(path.readlink()).encode() if path.is_symlink() else path.read_bytes())
    return digest.hexdigest()


def collect(root=ROOT):
    data = {'schemaVersion': 1, 'generatedAt': now(), 'mode': 'snapshot', 'errors': []}
    config, error = yaml_document(root / '.ai-ops.yaml')
    parent = (config or {}).get('parent', {})
    if error:
        data['errors'].append(error)
    available, error = read_json(root / 'product-console/upstream.json')
    data['aiops'] = {'installed': parent.get('installed_version'),
                     'policyChannel': parent.get('update_channel'),
                     'updatePolicy': parent.get('update_policy'), 'available': available}
    if error:
        data['errors'].append(error)
    try:
        changes = git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all').split('\0')
        paths = [line[3:] for line in changes if len(line) > 3]
        paths = [name for name in paths if not name.startswith('.ai/project/product-console/')
                 and name not in {'product-console/snapshot.js', 'product-console/snapshot.json'}]
        remote_cache, _ = read_json(root / 'product-console/github.json')
        base = (remote_cache or {}).get('main', {}).get('sha', '')
        committed = []
        if len(base) == 40 and all(c in '0123456789abcdef' for c in base):
            try:
                committed = git(root, 'diff', '--name-only', base, 'HEAD', '--').splitlines()
            except subprocess.SubprocessError:
                data['errors'].append('Не удалось сравнить ветку с опубликованным main')
        data['local'] = {'branch': git(root, 'branch', '--show-current'),
                         'sha': git(root, 'rev-parse', 'HEAD'), 'changedFiles': len(paths),
                         'unpublishedFiles': len(committed),
                         'controlsChanged': any(name in {'css/components.css', 'css/glass.css',
                                                       'css/tokens.semantic.css'} for name in paths + committed)}
    except (OSError, subprocess.SubprocessError):
        data['local'] = None
        data['errors'].append('Git: состояние недоступно')
    plan, error = yaml_document(root / 'planning/plan.yaml')
    data['plan'] = None if error else {'goals': plan.get('goals', []), 'work': plan.get('work', []),
                                     'source': 'planning/plan.yaml'}
    if error:
        data['errors'].append(error)
    remote, error = read_json(root / 'product-console/github.json')
    data['github'] = remote
    if error:
        data['errors'].append(error)
    data['delivery'], _ = read_json(root / '.ai/project/product-console/delivery.json')
    checks, error = read_json(root / '.ai/project/product-console/checks.json')
    current_signature = signature(root)
    data['checks'] = [{**item, 'current': item.get('signature') == current_signature}
                      for item in (checks or {}).get('checks', [])]
    # No evidence means unknown, never zero users or a green check.
    data['metrics'] = [
        {'id': 'dashboards', 'name': 'Создано дашбордов', 'value': None, 'unit': 'целостных экранов'},
        {'id': 'time', 'name': 'Время типовой сборки', 'value': None, 'unit': 'мин'},
        {'id': 'rework', 'name': 'Без ручных исправлений', 'value': None, 'unit': '%'},
    ]
    data['metricSource'] = '.ai-ops/PRODUCT_PASSPORT.md'
    data['metricDefinitionsConfirmedAt'] = '2026-10-06'
    data['adoption'] = {'value': None, 'status': 'unknown'}
    return data


def snapshot(root=ROOT):
    data = collect(root)
    write_json(root / 'product-console/snapshot.json', data)
    text = json.dumps(data, ensure_ascii=False).replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    (root / 'product-console/snapshot.js').write_text('window.DK_PRODUCT_CONSOLE = ' + text + ';\n', encoding='utf-8')
    return data


def check(suite):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    started = now()
    before = signature(ROOT)
    log = EVIDENCE / (suite + '.log')
    with log.open('w', encoding='utf-8') as stream:
        result = subprocess.run(SUITES[suite], cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT)
    after = signature(ROOT)
    report, _ = read_json(EVIDENCE / 'checks.json')
    previous = [item for item in (report or {}).get('checks', []) if item.get('suite') != suite]
    previous.append({'suite': suite, 'startedAt': started, 'completedAt': now(),
                     'status': 'pass' if result.returncode == 0 and before == after else 'fail',
                     'exitCode': result.returncode, 'sourcesChanged': before != after,
                     'signature': after, 'command': ' '.join(SUITES[suite]),
                     'log': '.ai/project/product-console/' + log.name})
    write_json(EVIDENCE / 'checks.json', {'checks': previous})
    snapshot()
    print(f'{suite}: {previous[-1]["status"]}; log: {log}')
    return result.returncode or (1 if before != after else 0)


class ConsoleHTTPServer(ThreadingHTTPServer):
    # A browser loads styles, fonts and scripts concurrently, including on reload.
    request_queue_size = 64


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def do_GET(self):
        path = self.path.split('?', 1)[0]
        if path == '/api/product-console':
            try:
                data = collect()
                data['mode'] = 'local'
                body = json.dumps(data, ensure_ascii=False).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception:
                self.send_error(503, 'Product sources are unavailable')
            return
        # Config, runtime histories and credentials are not public server assets.
        # Evidence logs remain readable for the owner; everything else dot-prefixed is blocked.
        from urllib.parse import unquote
        decoded = unquote(path)
        resolved = Path(self.translate_path(path)).resolve()
        try:
            resolved.relative_to(ROOT.resolve())
        except ValueError:
            self.send_error(403)
            return
        evidence = resolved.parent == EVIDENCE.resolve() and resolved.suffix == '.log'
        passport = resolved in {(ROOT / '.ai-ops/PRODUCT_PASSPORT.md').resolve(), (ROOT / '.ai-ops/DELIVERY.md').resolve()}
        if not evidence and not passport and any(part.startswith('.') for part in decoded.split('/') if part):
            self.send_error(403)
            return
        if path == '/':
            self.path = '/product-console.html'
        super().do_GET()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('snapshot', help='Save local facts and the separately dated GitHub cache')
    sub.add_parser('json', help='Print current local facts without writing files')
    run = sub.add_parser('check', help='Run one named existing verification suite')
    run.add_argument('suite', choices=SUITES)
    serve = sub.add_parser('serve', help='Serve this console on loopback only')
    serve.add_argument('--port', type=int, default=8772)
    args = parser.parse_args()
    if args.command == 'json':
        print(json.dumps(collect(), ensure_ascii=False, indent=2))
    elif args.command == 'snapshot':
        data = snapshot()
        print('Saved product-console/snapshot.json: ' + data['generatedAt'])
    elif args.command == 'check':
        return check(args.suite)
    else:
        snapshot()
        server = ConsoleHTTPServer(('127.0.0.1', args.port), Handler)
        print(f'Product console: http://127.0.0.1:{server.server_port}/product-console.html', flush=True)
        server.serve_forever()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
