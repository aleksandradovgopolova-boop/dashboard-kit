#!/usr/bin/env python3
"""Read-only consumer update preview. No install, lock rewrite or network access."""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path
import sys
sys.dont_write_bytecode = True

MODULE = importlib.util.spec_from_file_location('update_release', Path(__file__).with_name('kit-release.py'))
release = importlib.util.module_from_spec(MODULE); MODULE.loader.exec_module(release)


def read_object(path):
    if path.is_symlink() or path.stat().st_size > 4194304:
        raise release.ReleaseError('Unsafe or oversized JSON: ' + str(path))
    def nonfinite(value):
        raise release.ReleaseError('Non-finite JSON number: '+value)
    value = json.loads(path.read_text('utf-8'),object_pairs_hook=release.unique_object,parse_constant=nonfinite)
    if not isinstance(value, dict):
        raise release.ReleaseError('JSON object required: ' + str(path))
    return value


def load_lock(path):
    value = read_object(path)
    if set(value) != {'schemaVersion', 'package', 'version', 'contentDigest'} or type(value['schemaVersion']) is not int or value['schemaVersion'] != 1:
        raise release.ReleaseError('Consumer lock/1 requires package, version and contentDigest')
    if not isinstance(value['package'], str) or not value['package'] or not isinstance(value['version'], str):
        raise release.ReleaseError('Invalid consumer lock paths/version')
    return path.parent / value['package'], value['contentDigest'], value['version']


def baseline(root, expected):
    if root.is_symlink():
        raise release.ReleaseError('Package root must not be a symlink')
    document = release.validate_descriptor(read_object(release.safe_file(root, release.DESCRIPTOR)))
    if not isinstance(expected, str) or document['contentDigest'] != expected:
        raise release.ReleaseError('Current descriptor does not match the external consumer pin')
    conflicts = []
    for name, wanted in document['files'].items():
        try:
            actual = release.sha256(release.safe_file(root, name).read_bytes())
            if actual != wanted:
                conflicts.append({'path': name, 'reason': 'modified'})
        except (release.ReleaseError, OSError):
            conflicts.append({'path': name, 'reason': 'missing-or-unsafe'})
    for path in sorted(root.rglob('*')):
        name = path.relative_to(root).as_posix()
        if name == release.DESCRIPTOR or name in document['files']:
            continue
        if path.is_symlink() or path.is_file():
            conflicts.append({'path': name, 'reason': 'unexpected-or-unsafe'})
    return document, conflicts


def manifest(root, conflicts=()):
    if any(item['path'] == 'kit-manifest.json' for item in conflicts):
        return None
    value = read_object(release.safe_file(root, 'kit-manifest.json'))
    if not isinstance(value.get('parts'), list) or not isinstance(value.get('include'), dict):
        raise release.ReleaseError('Invalid component inventory in release manifest')
    ids = [part.get('id') for part in value['parts'] if isinstance(part, dict)]
    if len(ids) != len(value['parts']) or any(not isinstance(name, str) for name in ids) or len(set(ids)) != len(ids):
        raise release.ReleaseError('Invalid or duplicate manifest component IDs')
    for part in value['parts']:
        for key in ['css', 'scripts', 'data', 'include']:
            paths = part.get(key, [])
            if not isinstance(paths, list) or any(not isinstance(name, str) for name in paths):
                raise release.ReleaseError('Invalid manifest dependency paths: '+part['id'])
            for name in paths:
                release.relative_path(name)
    return value


def inventory(path):
    if path is None:
        return None
    value = read_object(path)
    if set(value) != {'schemaVersion', 'components'} or type(value['schemaVersion']) is not int or value['schemaVersion'] != 1:
        raise release.ReleaseError('Inventory/1 requires schemaVersion and components')
    names = value['components']
    if not isinstance(names, list) or len(names) > 500 or any(not isinstance(name, str) or not name for name in names) or len(set(names)) != len(names):
        raise release.ReleaseError('Inventory components must be unique component IDs')
    return names


def files_for(part, book):
    base = next((item for item in book['parts'] if item['id'] == 'base'), {})
    # include is the manifest's transitive JS closure; base is always included.
    return {name for item in [base, part] for key in ['css', 'scripts', 'data', 'include'] for name in item.get(key, [])}


def compare(current, current_pin, target, target_pin, inventory_path=None, lock_version=None):
    old, conflicts = baseline(current, current_pin)
    if lock_version is not None and old['version'] != lock_version:
        raise release.ReleaseError('Current package version does not match consumer lock')
    if target.is_symlink():
        raise release.ReleaseError('New package root must not be a symlink')
    new = release.verify_package(target, target_pin)
    before, after = manifest(current, conflicts), manifest(target)
    used = inventory(inventory_path)
    changed = {'added': sorted(set(new['files'])-set(old['files'])),
               'removed': sorted(set(old['files'])-set(new['files'])),
               'changed': sorted(name for name in set(old['files']) & set(new['files']) if old['files'][name] != new['files'][name])}
    parts_old = {p['id']: p for p in before['parts']} if before else {}
    parts_new = {p['id']: p for p in after['parts']}
    component_changes = []
    for name in sorted(set(parts_old)|set(parts_new)):
        a, b = parts_old.get(name), parts_new.get(name)
        if before is None:
            state = 'unknown'
        elif a is None:
            state = 'added'
        elif b is None:
            state = 'removed'
        else:
            state = 'changed' if any(a.get(key) != b.get(key) for key in ['parameterContract', 'api', 'css', 'scripts', 'data', 'include']) else 'unchanged'
        parameter = 'unknown' if before is None else 'unchanged' if (a or {}).get('parameterContract') == (b or {}).get('parameterContract') else 'changed'
        dependencies = 'unknown' if before is None else 'unchanged' if all((a or {}).get(key, []) == (b or {}).get(key, []) for key in ['include', 'css', 'scripts', 'data']) else 'changed'
        if state != 'unchanged':
            component_changes.append({'component': name, 'state': state, 'parameters': parameter,
                'apiMetadata': 'unknown' if before is None else 'unchanged' if (a or {}).get('api') == (b or {}).get('api') else 'changed',
                'dependencies': dependencies,
                'before': {key: (a or {}).get(key) for key in ['parameterContract', 'api', 'css', 'scripts', 'data', 'include']},
                'after': {key: (b or {}).get(key) for key in ['parameterContract', 'api', 'css', 'scripts', 'data', 'include']}})
    impact = []
    for name in sorted(set().union(*map(set, changed.values()))):
        linked = []
        if used is not None:
            for component in used:
                a, b = parts_old.get(component), parts_new.get(component)
                known = (files_for(a, before) if a and before else set()) | (files_for(b, after) if b else set())
                if name in known:
                    linked.append(component)
        impact.append({'path': name, 'components': linked, 'relation': 'declared' if linked else 'unknown'})
    unknown = [] if used is None else sorted(name for name in used if name not in parts_old and name not in parts_new)
    return {'schemaVersion': 1, 'mode': 'dry-run', 'status': 'conflicts' if conflicts else 'review-required',
            'current': {key: old[key] for key in ['version', 'channel', 'contentDigest']},
            'target': {key: new[key] for key in ['version', 'channel', 'contentDigest']},
            'files': changed, 'conflicts': conflicts,
            'contracts': {'data': {'before': old['dataContractVersion'], 'after': new['dataContractVersion']},
                          'parametersVersion': {'before': before.get('parameterSchemaVersion') if before else 'unknown', 'after': after.get('parameterSchemaVersion')},
                          'components': component_changes, 'compatibility': 'unknown; runtime behavior requires consumer tests'},
            'dependencies': {'before': before['include'] if before else 'unknown', 'after': after['include']},
            'inventory': {'status': 'unknown' if used is None else 'provided', 'components': used, 'unknownComponents': unknown},
            'impact': impact, 'writes': []}


def text_report(result):
    lines = [f"DRY-RUN: {result['current']['version']} → {result['target']['version']}",
             'No files, lock or configuration changed; compatibility still requires consumer tests.']
    for kind, names in result['files'].items():
        lines += [f'{kind}: {len(names)}'] + ['  '+name for name in names]
    lines += [f"conflicts: {len(result['conflicts'])}"] + ['  '+item['path']+' ('+item['reason']+')' for item in result['conflicts']]
    lines += ['contracts: '+json.dumps(result['contracts']['data']), 'inventory: '+result['inventory']['status']]
    versions = result['contracts']['parametersVersion']
    lines.append(f"parameter-schema: {versions['before']} → {versions['after']}")
    if result['dependencies']['before'] != result['dependencies']['after']:
        lines += ['dependency graph: changed', '  before: '+json.dumps(result['dependencies']['before'],ensure_ascii=False),
                  '  after: '+json.dumps(result['dependencies']['after'],ensure_ascii=False)]
    for item in result['contracts']['components']:
        lines.append(f"  {item['component']}: {item['state']}; parameters={item['parameters']}; apiMetadata={item['apiMetadata']}; dependencies={item['dependencies']}")
    lines += ['impact:'] + [item['path']+': '+(', '.join(item['components']) if item['components'] else 'unknown') for item in result['impact']]
    if result['inventory']['unknownComponents']:
        lines.append('unknown components: '+', '.join(result['inventory']['unknownComponents']))
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    origin = parser.add_mutually_exclusive_group(required=True)
    origin.add_argument('--lock', type=Path); origin.add_argument('--current', type=Path)
    parser.add_argument('--current-expect'); parser.add_argument('--new', type=Path, required=True)
    parser.add_argument('--new-expect', required=True); parser.add_argument('--inventory', type=Path)
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()
    if bool(args.current) != bool(args.current_expect):
        parser.error('--current requires --current-expect; --lock contains its own reviewed pin')
    try:
        current, pin, version = load_lock(args.lock) if args.lock else (args.current, args.current_expect, None)
        result = compare(current, pin, args.new, args.new_expect, args.inventory, version)
        print(json.dumps(result, indent=2, ensure_ascii=False) if args.json else text_report(result))
        return 2 if result['conflicts'] else 0
    except (release.ReleaseError, OSError, ValueError, TypeError, KeyError) as error:
        if args.json:
            print(json.dumps({'schemaVersion': 1, 'mode': 'dry-run', 'status': 'error', 'error': str(error), 'writes': []}, ensure_ascii=False))
        else:
            print('FAIL: '+str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
