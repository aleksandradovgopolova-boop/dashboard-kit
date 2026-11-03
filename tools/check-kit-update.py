#!/usr/bin/env python3
"""Independent fixtures: consumer preview never changes its inputs."""
from copy import deepcopy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
loader = importlib.util.spec_from_file_location('kit_update', Path(__file__).with_name('kit-update.py'))
update = importlib.util.module_from_spec(loader); loader.loader.exec_module(update)
release = update.release


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding='utf-8')


def snapshot(root):
    return {p.relative_to(root).as_posix(): (p.read_bytes(), p.stat().st_mtime_ns) for p in root.rglob('*') if p.is_file()}


def rejects(action):
    try:
        action()
    except (release.ReleaseError, OSError):
        return
    raise AssertionError('Invalid package/pin accepted')


with tempfile.TemporaryDirectory(prefix='dk-update-test-') as directory:
    root=Path(directory); source=root/'source'; source.mkdir()
    for name in release.FIXED_FILES | {'js/dk-theme.js','js/dk-util.js','js/dk-fixture.js','vendor/removed.js'}:
        path=source/name; path.parent.mkdir(parents=True,exist_ok=True); path.write_text('fixture '+name)
    manifest={'include': {'css':[{'file':'css/components.css'}], 'scripts':[{'file':'js/dk-theme.js'},{'file':'js/dk-util.js'},{'file':'js/dk-fixture.js'}]},
              'parts':[{'id':'base','css':['css/tokens.primitives.css'],'scripts':['js/dk-theme.js'],'include':['js/dk-theme.js']},
                       {'id':'tile','css':['css/components.css'],'scripts':['js/dk-fixture.js'],'include':['js/dk-util.js','js/dk-fixture.js'], 'data':[], 'api':[{'name':'v1'}]}]}
    write(source/'kit-manifest.json',manifest)
    old=release.write_descriptor(source); installed=root/'consumer/vendor/old'; installed.parent.mkdir(parents=True); release.pack(source,installed)
    inventory=root/'consumer/inventory.json'; write(inventory,{'schemaVersion':1,'components':['tile','unknown-component']})
    lock=root/'consumer/kit-lock.json'; write(lock,{'schemaVersion':1,'package':'vendor/old','version':old['version'],'contentDigest':old['contentDigest']})
    config=root/'consumer/config.json'; write(config,{'kit':'vendor/old'})
    (source/'css/components.css').write_text('changed controls')
    (source/'vendor/removed.js').unlink(); (source/'js/dk-added.js').write_text('new dependency')
    newer=deepcopy(manifest); newer['parameterSchemaVersion']=1
    newer['parts'][1]['parameterContract']={'schemaVersion':1,'parameters':{'type':'object'}}
    newer['parts'][1]['include'].append('js/dk-added.js'); newer['parts'][1]['api']=[{'name':'v2'}]
    newer['include']['scripts'].append({'file':'js/dk-added.js'})
    write(source/'kit-manifest.json',newer)
    new=release.write_descriptor(source,'0.1.0-rc.2'); target=root/'new'; release.pack(source,target)
    initial=snapshot(root)
    result=update.compare(installed,old['contentDigest'],target,new['contentDigest'],inventory)
    assert snapshot(root)==initial,'Dry-run changed package/consumer/lock/config bytes or mtimes'
    assert result['files']['added']==['js/dk-added.js']
    assert result['files']['removed']==['vendor/removed.js']
    assert set(result['files']['changed'])=={'css/components.css','kit-manifest.json'}
    assert result['writes']==[] and not result['conflicts']
    tile=next(item for item in result['contracts']['components'] if item['component']=='tile')
    assert tile['parameters']==tile['dependencies']==tile['apiMetadata']=='changed'
    assert next(item for item in result['impact'] if item['path']=='css/components.css')['components']==['tile']
    assert next(item for item in result['impact'] if item['path']=='vendor/removed.js')['relation']=='unknown'
    assert result['inventory']['unknownComponents']==['unknown-component']
    assert update.compare(installed,old['contentDigest'],target,new['contentDigest'])['inventory']['status']=='unknown'
    cli=[sys.executable,str(ROOT/'tools/kit-update.py'),'--lock',str(lock),'--new',str(target),'--new-expect',new['contentDigest'],'--inventory',str(inventory)]
    for extra in [[],['--json']]:
        run=subprocess.run(cli+extra,text=True,capture_output=True); assert run.returncode==0,run.stderr
        if extra: assert json.loads(run.stdout)==result
        else: assert 'DRY-RUN:' in run.stdout and 'unknown' in run.stdout and 'parameters=changed' in run.stdout
    assert snapshot(root)==initial,'CLI dry-run changed an input'
    path=installed/'css/components.css'; original=path.read_bytes(); path.write_text('consumer local edit')
    (installed/'custom.js').write_text('consumer extra file')
    altered=snapshot(root)
    conflict=update.compare(installed,old['contentDigest'],target,new['contentDigest'],inventory)
    assert {item['path'] for item in conflict['conflicts']}=={'css/components.css','custom.js'}
    run=subprocess.run(cli+['--json'],text=True,capture_output=True); assert run.returncode==2 and json.loads(run.stdout)['status']=='conflicts'
    assert snapshot(root)==altered,'Conflict preview overwrote local changes'
    path.write_bytes(original); (installed/'custom.js').unlink()
    manifest_path=installed/'kit-manifest.json'; original_manifest=manifest_path.read_bytes(); manifest_path.write_text('{broken local edit')
    conflict=update.compare(installed,old['contentDigest'],target,new['contentDigest'],inventory)
    assert conflict['contracts']['parametersVersion']['before']=='unknown'
    assert conflict['dependencies']['before']=='unknown'
    manifest_path.write_bytes(original_manifest)
    rejects(lambda:update.compare(installed,'sha256:'+'0'*64,target,new['contentDigest']))
    rejects(lambda:update.compare(installed,old['contentDigest'],target,'sha256:'+'0'*64))
    damaged=target/'js/dk-added.js'; saved=damaged.read_bytes(); damaged.write_text('corrupt')
    rejects(lambda:update.compare(installed,old['contentDigest'],target,new['contentDigest']))
    run=subprocess.run(cli+['--json'],text=True,capture_output=True); assert run.returncode==1 and json.loads(run.stdout)['status']=='error'
    damaged.unlink(); rejects(lambda:update.compare(installed,old['contentDigest'],target,new['contentDigest']))
    damaged.write_bytes(saved)
    # Both reviewed packages remain independently usable for side-by-side rollback.
    assert release.verify_package(installed,old['contentDigest'])==old
    assert release.verify_package(target,new['contentDigest'])==new
    api_only=deepcopy(newer);api_only['parts'][1]['api']=[{'name':'v3'}]
    write(source/'kit-manifest.json',api_only)
    third=release.write_descriptor(source,'0.1.0-rc.3'); api_target=root/'api-only';release.pack(source,api_target)
    result_api=update.compare(target,new['contentDigest'],api_target,third['contentDigest'])
    change=next(item for item in result_api['contracts']['components'] if item['component']=='tile')
    assert change['apiMetadata']=='changed' and change['parameters']==change['dependencies']=='unchanged'
    assert 'apiMetadata=changed' in update.text_report(result_api)
    api_only['parameterSchemaVersion']=2;write(source/'kit-manifest.json',api_only)
    fourth=release.write_descriptor(source,'0.1.0-rc.4');version_target=root/'version-only';release.pack(source,version_target)
    result_version=update.compare(api_target,third['contentDigest'],version_target,fourth['contentDigest'])
    assert not result_version['contracts']['components']
    assert 'parameter-schema: 1 → 2' in update.text_report(result_version)
    write(lock,{'schemaVersion':1,'package':'vendor/old','version':'wrong','contentDigest':old['contentDigest']})
    run=subprocess.run(cli+['--json'],text=True,capture_output=True); assert run.returncode==1
print('PASS: file/contract/dependency diff, declared/unknown inventory, local conflicts, immutable lock/config/packages, corrupt releases, CLI text/JSON and independent rollback pins')
