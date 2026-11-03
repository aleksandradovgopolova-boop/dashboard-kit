from pathlib import Path
import shutil, subprocess, json, hashlib
src=Path('/tmp/kit-evals-20261103/source'); dest=Path('/tmp/kit-evals-20261103/task18/app')
parts='base layout page-header widget table tile modal search select button check glass tooltip'
head=subprocess.check_output(['python3',str(src/'tools/kit.py'),'head',*parts.split()],text=True)
import re
files=re.findall(r'(?:src|href)="([^"]+)"',head)
files+=['fonts/golos-text-vf.woff2'] if (src/'fonts/golos-text-vf.woff2').exists() else []
for folder in ['fonts','assets/fonts']:
 if (src/folder).exists():
  shutil.copytree(src/folder,dest/'kit'/folder,dirs_exist_ok=True)
for f in files:
 p=dest/'kit'/f;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src/f,p)
(dest/'kit'/'PIN.json').write_text(json.dumps({'commit':'c05b74d','files':{f:hashlib.sha256((src/f).read_bytes()).hexdigest() for f in files}},indent=2))
fixture=json.loads((src/'tools/fixtures/numeric/mortgage-source.json').read_text())
(dest/'source.json').write_text(json.dumps(fixture,ensure_ascii=False,indent=2))
(dest/'data.js').write_text('window.MORTGAGE_SOURCE = '+json.dumps(fixture,ensure_ascii=False)+';\n')
(dest/'head.fragment.html').write_text(head.replace('src="','src="kit/').replace('href="','href="kit/'))
