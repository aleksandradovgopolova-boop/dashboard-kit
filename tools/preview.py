#!/usr/bin/env python3
"""Local static preview. Never cache UI resources while editing the kit."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8771)
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(Path(__file__).resolve().parent.parent))
    print(f'Preview: http://localhost:{args.port}/dashboard.html?theme=light', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), handler).serve_forever()
