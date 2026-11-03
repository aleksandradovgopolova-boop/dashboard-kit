#!/usr/bin/env python3
"""Copy saved authored evals to a new directory with their exact pinned runtime."""
import argparse
import importlib.util
import json
from pathlib import Path
import shutil
import sys
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
loader=importlib.util.spec_from_file_location('eval_release',ROOT/'tools/kit-release.py')
release=importlib.util.module_from_spec(loader);loader.loader.exec_module(release)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,required=True,help='Checkout/archive of the recorded kit commit')
    parser.add_argument('--out',type=Path,required=True,help='New directory; existing paths are preserved')
    args=parser.parse_args()
    source=args.source.resolve(); destination=args.out.absolute()
    expected=json.loads((HERE/'runtime-descriptor.json').read_text())['contentDigest']
    actual=release.check_source(source)
    if actual['contentDigest']!=expected:
        parser.error('Source is not the recorded runtime pin; do not replace it with latest')
    if destination.exists() or destination.is_symlink():
        parser.error('Output exists; choose a new directory')
    if destination.resolve().is_relative_to((HERE/'artifacts').resolve()):
        parser.error('Output must be outside saved artifacts')
    destination.mkdir(exist_ok=False)
    try:
        shutil.copytree(HERE/'artifacts',destination,dirs_exist_ok=True)
        shutil.copytree(HERE/'inputs',destination/'eval-input')
        for entry in sorted(destination.glob('task*')):
            for name in ['app','accepted']:
                app=entry/name
                if app.is_dir():
                    release.pack(source,app/'kit')
                    release.verify_package(app/'kit',expected)
        print('Restored authored artifacts and verified pinned runtime:',destination)
    except BaseException:
        if destination.is_dir():
            shutil.rmtree(destination)
        raise

if __name__=='__main__':
    main()
