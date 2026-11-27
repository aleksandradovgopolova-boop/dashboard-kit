#!/usr/bin/env python3
"""Regression checks for truthful snapshots and the loopback read-only API."""
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import urlopen

spec = importlib.util.spec_from_file_location('product_console', Path(__file__).with_name('product-console.py'))
console = importlib.util.module_from_spec(spec)
spec.loader.exec_module(console)


class ConsoleChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for directory in ['product-console', 'planning', 'css', '.ai-ops', '.ai/project/product-console', '.git']:
            (self.root / directory).mkdir(parents=True)
        (self.root / '.ai-ops.yaml').write_text(json.dumps({'parent': {'installed_version': '4.11.4', 'update_channel': 'stable'}}))
        (self.root / 'planning/plan.yaml').write_text(json.dumps({'goals': [], 'work': [{'id': 'existing', 'title': 'Existing plan', 'status': 'todo'}]}))
        (self.root / 'product-console/upstream.json').write_text('{"version":"4.15.0","channel":"qualification"}')
        (self.root / '.git/config').write_text('private')
        (self.root / '.ai-ops/PRODUCT_PASSPORT.md').write_text('Product passport')
        (self.root / 'product-console.html').write_text('<html lang="ru"><h1>Console</h1></html>')

    def tearDown(self):
        self.temp.cleanup()

    def test_unknown_sources_are_not_zero_or_success(self):
        data = console.collect(self.root)
        self.assertIsNone(data['github'])
        self.assertIsNone(data['local'])
        self.assertTrue(all(metric['value'] is None for metric in data['metrics']))
        self.assertEqual(data['checks'], [])
        self.assertEqual(data['aiops']['installed'], '4.11.4')
        self.assertEqual(data['aiops']['available']['channel'], 'qualification')
        self.assertEqual(data['plan']['work'][0]['id'], 'existing')

    def test_modified_sources_invalidate_a_previous_pass(self):
        proof = {'checks': [{'suite': 'quick', 'status': 'pass', 'signature': console.signature(self.root)}]}
        console.write_json(self.root / '.ai/project/product-console/checks.json', proof)
        self.assertTrue(console.collect(self.root)['checks'][0]['current'])
        (self.root / 'css/test.css').write_text('body { color: red; }')
        self.assertFalse(console.collect(self.root)['checks'][0]['current'])
        self.assertEqual(console.collect(self.root)['checks'][0]['status'], 'pass')

    def test_partial_update_report_is_not_installed_version(self):
        data = console.collect(self.root)
        self.assertNotEqual(data['aiops']['installed'], data['aiops']['available']['version'])
        self.assertEqual(data['aiops']['policyChannel'], 'stable')

    def test_malformed_plan_is_explicitly_unavailable(self):
        (self.root / 'planning/plan.yaml').write_text('work: [invalid:')
        data = console.collect(self.root)
        self.assertIsNone(data['plan'])
        self.assertTrue(any('plan.yaml' in error for error in data['errors']))

    def test_yaml_without_aiops_dependency_is_unknown(self):
        (self.root / '.ai-ops.yaml').write_text('parent:\n  installed_version: 4.15.0\n')
        with patch.dict('sys.modules', {'yaml': None}):
            data = console.collect(self.root)
        self.assertIsNone(data['aiops']['installed'])
        self.assertTrue(any('.ai-ops.yaml' in error for error in data['errors']))

    def test_changed_remote_inputs_invalidate_console_evidence(self):
        proof = {'checks': [{'suite': 'quick', 'status': 'fail', 'signature': console.signature(self.root)}]}
        console.write_json(self.root / '.ai/project/product-console/checks.json', proof)
        (self.root / 'product-console/github.json').write_text('{"issues":[]}')
        data = console.collect(self.root)
        self.assertFalse(data['checks'][0]['current'])
        self.assertEqual(data['checks'][0]['status'], 'fail')

    def test_read_only_api_and_protected_paths(self):
        class QuietHandler(console.Handler):
            def log_message(self, *_):
                pass
        with patch.object(console, 'ROOT', self.root), patch.object(console, 'EVIDENCE', self.root / '.ai/project/product-console'):
            server = console.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f'http://127.0.0.1:{server.server_port}'
            try:
                with urlopen(base + '/product-console.html', timeout=5) as response:
                    self.assertIn(b'<html data-pc-live ', response.read())
                self.assertNotIn('data-pc-live', (self.root / 'product-console.html').read_text())
                with urlopen(base + '/api/product-console', timeout=5) as response:
                    data = json.load(response)
                    self.assertEqual(data['mode'], 'local')
                    self.assertEqual(data['schemaVersion'], 1)
                with urlopen(base + '/.ai-ops/PRODUCT_PASSPORT.md', timeout=5) as response:
                    self.assertEqual(response.read(), b'Product passport')
                for path in ['/.git/config', '/.ai-ops.yaml', '/.ai/project/product-console/../../../.git/config', '/%2egit/config']:
                    with self.assertRaises(HTTPError) as error:
                        urlopen(base + path, timeout=5)
                    self.assertEqual(error.exception.code, 403)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=3)


if __name__ == '__main__':
    unittest.main(verbosity=2)
