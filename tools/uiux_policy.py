"""Validate project-owned policy against the installed, immutable registry."""
import json
import re
from pathlib import Path

MAPPING = ['UI-002','UI-003','UI-006','UI-004','UI-007','UI-005',None,'UI-010','UI-020',None]

def validate(root, policy=None):
    root = Path(root)
    data = policy if policy is not None else json.loads((root/'.ai/project/uiux-policy.json').read_text())
    registry = (root/'.ai/managed/standards/uiux/rules.yaml').read_text()
    ids = set(re.findall(r'^  - id: (\S+)', registry, re.M))
    errors = []
    if data.get('constitution_version') != re.search(r'^version: "([^"]+)"', registry, re.M)[1]:
        errors.append('Версия конституции изменилась: пересмотреть политику')
    if set(data.get('coverage', {})) != ids:
        errors.append('Покрытие должно перечислять все правила установленного реестра')
    hs = data.get('heuristics', [])
    if [h.get('number') for h in hs] != list(range(1,11)) or [h.get('constitution') for h in hs] != MAPPING:
        errors.append('Неверное сопоставление десяти эвристик с AI Ops')
    if any(not h.get('requirement') for h in hs):
        errors.append('Для эвристики нужно прикладное требование')
    for row in data.get('coverage', {}).values():
        if row.get('status') != 'review-required' or not row.get('reason'):
            errors.append('Реестр требований не является отчётом об успешном UX-ревью')
            break
    return errors
