#!/usr/bin/env python3
"""Tiny local web server for the FORGED village. Never caches, so edits show up on reload."""
import http.server, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a): pass
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
