#!/usr/bin/env python3
"""Run the real Pages preparation step and verify the public console payload."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import subprocess
import tempfile
import textwrap

ROOT = Path(__file__).resolve().parent.parent


class Resources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if tag == 'script' and data.get('src'):
            self.paths.append(data['src'])
        if tag == 'link' and data.get('rel') == 'stylesheet':
            self.paths.append(data['href'])


def main():
    workflow = (ROOT / '.github/workflows/pages.yml').read_text()
    match = re.search(r'- name: Prepare static files\n\s+run: \|\n(.*?)\n      - name: Upload static site', workflow, re.S)
    assert match, 'Pages preparation step must remain inspectable'
    site = ROOT / '_site'
    assert not site.exists() and not site.is_symlink(), 'Refuse to overwrite an existing site'
    with tempfile.TemporaryDirectory(prefix='dashboard-pages-') as directory:
        target = Path(directory).resolve()
        site.symlink_to(target, target_is_directory=True)
        try:
            subprocess.run(['bash', '-e', '-c', textwrap.dedent(match[1])], cwd=ROOT, check=True)
            parser = Resources()
            parser.feed((target / 'product-console.html').read_text())
            for resource in parser.paths:
                assert (target / resource.split('?', 1)[0]).is_file(), f'Missing public resource: {resource}'
            data = json.loads((target / 'product-console/snapshot.json').read_text())
            assert data['public'] and re.fullmatch('[a-f0-9]{40}', data['sourceRevision'])
            assert not (target / '.ai').exists() and not (target / '.ai-ops').exists()
            assert not (target / '.ai-ops.yaml').exists() and not (target / '.git').exists()
            assert 'href="product-console.html"' in (target / 'index.html').read_text()
        finally:
            assert site.is_symlink() and site.resolve() == target, 'Site target changed during the check'
            site.unlink()
    print('PASS: actual Pages payload includes the console, snapshot and every resource; local config/logs excluded; homepage entry present')


if __name__ == '__main__':
    main()
