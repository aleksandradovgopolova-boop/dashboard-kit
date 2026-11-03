#!/usr/bin/env python3
"""Small unit/static checks. Opens no port and launches no browser."""
import importlib.util
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('consumer_server', ROOT/'serve.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)
api = server.reference
source = json.loads((ROOT/'app/kit/data/reference-dashboard.json').read_text())

# Hand-calculated constants from the nine source observations, never computed
# by the product aggregator or formatter. Values cover full set, filter, dates,
# intersection, pagination, null and measured zero.
cases = [
    ({'filters':{},'period':None,'page':1,'pageSize':5}, 9,85,60,8,'observation-1',12,9),
    ({'filters':{},'period':None,'page':2,'pageSize':5}, 9,85,60,8,'observation-6',6,None),
    ({'filters':{'service':['Водоснабжение']},'period':None,'page':1,'pageSize':5},5,44,35,5,'observation-1',12,9),
    ({'filters':{'region':['Москва']},'period':None,'page':1,'pageSize':5},3,45,32,3,'observation-1',12,9),
    ({'filters':{},'period':{'from':'2026-10-11','to':'2026-10-20'},'page':1,'pageSize':5},6,65,43,5,'observation-4',18,11),
    ({'filters':{'region':['Пермь'],'service':['Водоснабжение']},'period':{'from':'2026-10-01','to':'2026-10-05'},'page':1,'pageSize':5},1,0,0,1,'observation-3',0,0),
    ({'filters':{'region':['Нет такого города']},'period':None,'page':1,'pageSize':5},0,None,None,0,None,None,None),
]
responses=[]
for query,count,received,completed,observed,first,rv,cv in cases:
    view=api.create_view(source,query)
    assert view['rowCount']==count
    assert view['totals']['received']['value']==received
    assert view['totals']['completed']['value']==completed
    assert view['totals']['completed']['observed']==observed
    if first:
        assert view['rows'][0]['id']==first
        assert view['rows'][0]['values']=={'received':rv,'completed':cv}
    else: assert not view['rows']
    responses.append(view)
assert responses[0]['totals']==responses[1]['totals']
assert responses[0]['series']==responses[1]['series']
assert responses[0]['totals']['completed']['partial'] is True
store=api.TaskStore(source)
body={'rowId':'observation-1','sourceId':'reference-demo'}
first=store.create_task(body,'task19-check-key')
assert first==store.create_task(body,'task19-check-key')
assert first['id']=='demo-task-1' and len(store.records)==1
try: store.create_task({'rowId':'observation-2','sourceId':'reference-demo'},'task19-check-key')
except api.APIError as error: assert error.status==409
else: raise AssertionError('Expected idempotency conflict')

# Static consumer assets all exist; external script classes and tokens included.
html=(ROOT/'app/index.html').read_text()
for target in re.findall(r'(?:src|href)="([^"#]+)"',html):
    assert (ROOT/'app'/target).is_file(),target
css='\n'.join(p.read_text() for p in (ROOT/'app/kit/css').glob('*.css'))
js=(ROOT/'app/operations.js').read_text()
for cls in set(re.findall(r'\bdk-[a-z][a-z0-9_-]*',html+'\n'+js)):
    if cls in {'dk-screen'}: continue
    assert re.search(r'\.'+re.escape(cls)+r'\b',css) or cls in {'dk-theme','dk-util','dk-icons','dk-chart-theme','dk-charts','dk-select','dk-modal','dk-table','dk-workspace','dk-dashboard'},cls
for token in re.findall(r'var\((--[a-z0-9-]+)',(ROOT/'app/operations.css').read_text()):
    assert re.search(re.escape(token)+r'\s*:',css),token

# Round-trip the genuine Python API results through the actual Kit validator.
script="""
const fs=require('fs'),vm=require('vm');
const context={window:{},AbortController,setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),context);
const responses=JSON.parse(fs.readFileSync(0,'utf8'));
for(const response of responses) context.window.dkDashboard.validateResponse(response,response.query);
process.stdout.write('7 genuine server responses accepted by pinned JS contract\\n');
"""
subprocess.run(['node','-e',script,str(ROOT/'app/kit/js/dk-dashboard.js')],input=json.dumps(responses),text=True,check=True)
print('7 numeric views + page invariance + null/zero + real TaskStore idempotency/conflict + static references/classes/tokens: checked')
print('Browser/UI binding/screenshots: PENDING')
