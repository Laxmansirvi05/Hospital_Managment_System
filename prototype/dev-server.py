"""Static server for the prototype that disables caching, so edits show on reload.

Run from the repository root: python3 prototype/dev-server.py
Serves http://127.0.0.1:4100 (port 4000 is kept for the API, see docs/00-decisions.md section 2).
"""
import functools
import http.server
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
PORT = 4100


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as server:
        print(f"Prototype at http://127.0.0.1:{PORT}")
        server.serve_forever()
