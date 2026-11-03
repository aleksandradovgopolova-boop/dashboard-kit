from pathlib import Path
import hashlib,json,re
p=Path(__file__).parent/'app';src=Path('/tmp/kit-evals-20261103/source')
for u in re.findall(r'(?:src|href)="([^"#]+)"',(p/'index.html').read_text()):assert (p/u).is_file(),u
pin=json.loads((p/'kit/kit-release.json').read_text())
assert pin['contentDigest']=='sha256:9802ab4ef705fe01270e6a19b5186c9bf4e81ddc6a429e147aa3b69a360aef20'
for f,digest in pin['files'].items():
 assert hashlib.sha256((p/'kit'/f).read_bytes()).hexdigest()==digest,f
 assert (p/'kit'/f).read_bytes()==(src/f).read_bytes(),f
for css in (p/'kit/css').glob('*.css'):
 for u in re.findall(r'url\([\"\']?([^\"\')]+)',css.read_text()):
  if not u.startswith(('data:','http','#')):assert (css.parent/u).is_file(),u
classes=set()
for css in (p/'kit/css').glob('*.css'):classes.update(re.findall(r'\.(dk-[\w-]+)',css.read_text()))
for f in [p/'index.html',p/'app.js']:
 for c in re.findall(r'\bdk-[\w-]+',f.read_text()):
  if c in ['dk-theme','dk-util','dk-icons','dk-chart-theme','dk-charts','dk-select','dk-modal','dk-table','dk-context','dk-root']:continue
  assert c in classes,(f.name,c)
print('PASS: local asset graph, font/background dependencies, pinned runtime byte equality, dk CSS class inventory')
