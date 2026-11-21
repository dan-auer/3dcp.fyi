#!/usr/bin/env python3
"""Serve 3dcp.fyi locally, offline.

    python serve.py [port]        # default 8000 -> http://127.0.0.1:8000/

Opening index.html directly (file://) is not enough: browsers block fetch(),
ES modules and module workers there, so search and abstracts break.
Unknown paths get 404.html (status 404), like GitHub Pages, so short links
such as /<bibtex key> or /<author_slug> resolve as on 3dcp.fyi.
Standard library only, Python 3.7+. Ctrl+C to stop.
"""
import functools
import http.server
import os
import sys
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    # Explicit types: the Windows registry can map .js to text/plain, which
    # browsers refuse for module scripts and workers.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".txt": "text/plain; charset=utf-8",
        ".json": "application/json",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # file edits show on reload
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code != 404:
            return super().send_error(code, message, explain)
        with open(os.path.join(ROOT, "404.html"), "rb") as f:
            body = f.read()
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


url = "http://127.0.0.1:%d/" % PORT
try:
    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", PORT), functools.partial(Handler, directory=ROOT))
except OSError:
    sys.exit("Port %d is busy - try: python serve.py %d" % (PORT, PORT + 1))
print("Serving", ROOT, "at", url, "(Ctrl+C to stop)")
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
