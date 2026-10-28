// Cross-language consumer check: real Python API business logic -> actual JS validator.
// No server, browser or third-party dependencies; this does not replace HTTP/DOM tests.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const scope=vm.createContext({window:{},AbortController,setTimeout,clearTimeout,console});
vm.runInContext(readFileSync(new URL('../js/dk-dashboard.js',import.meta.url),'utf8'),scope);
const data=JSON.parse(readFileSync(new URL('../data/reference-dashboard.json',import.meta.url),'utf8'));
const queries=[{}, {page:2,pageSize:5}, {page:10,pageSize:5}, {filters:{service:['Водоснабжение']}}, {filters:{region:['Нет такого города']}}, {period:{from:'2026-10-11',to:'2026-10-20'}}, {filters:{service:['Теплоснабжение'],region:['Пермь']}}];
for(const query of queries){
  const response=JSON.parse(execFileSync('python3',['-c',`import importlib.util,json,sys
from pathlib import Path
s=importlib.util.spec_from_file_location('reference_server','tools/reference-server.py')
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
print(json.dumps(m.create_view(json.loads(Path('data/reference-dashboard.json').read_text()),json.load(sys.stdin)),ensure_ascii=False))`],{cwd:root,input:JSON.stringify(query),encoding:'utf8',timeout:10000}));
  const actual=scope.window.dkDashboard.validateResponse(response,query);
  const expected=scope.window.dkDashboard.select(data,query);
  for(const key of ['rows','rowCount','totals','series','query','period'])assert.deepEqual(JSON.parse(JSON.stringify(actual[key])),JSON.parse(JSON.stringify(expected[key])),key+' for '+JSON.stringify(query));
}
console.log('PASS: Python full-slice aggregates, page boundaries and JS contract agree for seven queries');
