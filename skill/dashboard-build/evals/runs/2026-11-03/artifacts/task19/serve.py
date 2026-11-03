#!/usr/bin/env python3
"""Serve static consumer and the unmodified pinned Kit reference API, same origin."""
import argparse
import importlib.util
from pathlib import Path
import mimetypes
import sys
from urllib.parse import unquote, urlsplit

# Keep imported pinned runtime immutable, including during normal server startup.
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent / 'app'
spec = importlib.util.spec_from_file_location('kit_reference', ROOT / 'kit/tools/reference-server.py')
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)


def make_handler():
    snapshot = reference.decode_body((ROOT / 'kit/data/reference-dashboard.json').read_bytes())
    base = reference.handler_factory(snapshot, ROOT / 'kit')

    class ConsumerHandler(base):
        def do_GET(self):
            try:
                self.check_origin()
                path = unquote(urlsplit(self.path).path)
                reference.require(not path.startswith('/api/'), 'API принимает POST.', 405, 'METHOD_NOT_ALLOWED')
                relative = 'index.html' if path == '/' else path.lstrip('/')
                parts = relative.split('/')
                reference.require(all(p and not p.startswith('.') for p in parts) and '\\' not in path and '\x00' not in path, 'Файл недоступен.', 404, 'NOT_FOUND')
                reference.require(relative in {'index.html','operations.js','operations.css'} or parts[0] == 'kit', 'Файл недоступен.', 404, 'NOT_FOUND')
                candidate = ROOT
                for part in parts:
                    candidate = candidate / part
                    reference.require(not candidate.is_symlink(), 'Файл недоступен.', 404, 'NOT_FOUND')
                reference.require(candidate.is_file() and candidate.suffix in {'.html','.js','.css','.json','.png','.svg','.woff2','.md','.txt','.webmanifest','.topojson'}, 'Файл недоступен.', 404, 'NOT_FOUND')
                mime = {'.js':'text/javascript','.json':'application/json'}.get(candidate.suffix) or mimetypes.guess_type(candidate)[0] or 'application/octet-stream'
                if mime.startswith('text/') or mime == 'application/json': mime += '; charset=utf-8'
                self.send_bytes(200,candidate.read_bytes(),mime)
            except reference.APIError as error:
                self.error(error)
        do_HEAD = do_GET
    return ConsumerHandler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port',type=int,default=8799)
    args = parser.parse_args()
    class Server(reference.ThreadingHTTPServer):
        request_queue_size = 32
    server = Server(('127.0.0.1',args.port),make_handler())
    print(f'http://127.0.0.1:{server.server_port}/index.html',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__ == '__main__': main()
