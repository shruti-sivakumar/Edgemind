"""
health_server.py — minimal threaded HTTP health server.

Runs in a daemon thread completely separate from the asyncio event loop,
so it always responds even when the main loop is saturated with Prometheus queries.
"""

import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 8090
_healthy = True


def set_healthy(val: bool) -> None:
    global _healthy
    _healthy = val


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            body = b'{"ok": true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # silence access logs


def start_health_server() -> None:
    """Start health server in a daemon thread. Call once at startup."""
    server = HTTPServer(("0.0.0.0", PORT), _Handler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()