"""Analyst Kit: working tools for payments BAs & POs. Claude (in your chat session) drafts on top.

Stdlib HTTP server + SQLite. No API key: requests and chat messages wait in the
database until Claude picks them up through kit.py and writes back.

    python3 app/server/server.py          # http://localhost:4317  (PORT=43xx to change it)

Layout: catalog.py (skills and scenarios), db.py (schema, migrations, samples), router.py (@route),
security.py (Host/Origin/token checks), routes/*.py and tools/*.py (the API), web/ (the front end).
"""

import json
import os
import sys
import time
import traceback
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl

sys.path.insert(0, str(Path(__file__).resolve().parent))

import router  # noqa: E402
import security  # noqa: E402
from db import APP_DIR, db, init_db, lock  # noqa: E402
from router import ApiError  # noqa: E402

STATIC_DIR = APP_DIR / "web"
PORT = int(os.environ.get("PORT") or 4317)
HOST = "127.0.0.1"  # never 0.0.0.0: the kit reads local files and holds client work


class Server(ThreadingHTTPServer):
    # The front end is ~50 ES modules fetched in parallel; the stdlib default backlog (5) resets connections.
    request_queue_size = 128
    daemon_threads = True


class Handler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(STATIC_DIR), **kw)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", getattr(self, "_cache", None) or "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    # ---- responses -------------------------------------------------------------------------
    def send_response(self, code, message=None):
        self._answered = True
        super().send_response(code, message)

    def send_bytes(self, data, status=200, content_type="application/octet-stream", headers=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def send_json(self, data, status=200, headers=None):
        self.send_bytes(json.dumps(data, ensure_ascii=False).encode(), status,
                        "application/json; charset=utf-8", headers)

    def error(self, status, code, message=""):
        """Structured error. `code` is a stable i18n key (e.g. "workspace.not_found"), message is English."""
        self.send_json({"error": {"code": code, "message": message or code}}, status)

    def send_no_content(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Content-Length", "0")
        self.end_headers()

    @property
    def path_only(self):
        return self.path.partition("?")[0]

    def query(self):
        return dict(parse_qsl(self.path.partition("?")[2], keep_blank_values=True))

    # ---- body ------------------------------------------------------------------------------
    def _read_body(self, max_body):
        n = self.headers.get("Content-Length")
        if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
            raise ApiError(411, "request.length_required", "Send a Content-Length header.")
        try:
            n = int(n or 0)
        except ValueError:
            self.close_connection = True
            raise ApiError(400, "request.bad_length", "Content-Length is not a number.")
        if n < 0:
            raise ApiError(400, "request.bad_length", "Content-Length is not a number.")
        if n > max_body:
            self.close_connection = True  # the unread body would desync keep-alive
            raise ApiError(413, "request.too_large", f"Body over {max_body // 1024} KB.")
        return self.rfile.read(n) if n else b""

    def read_json(self):  # V1 name, kept for any caller that wants it
        return self._json(self._read_body(2 * 1024 * 1024))

    def _json(self, raw):
        if not raw.strip():
            return {}
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype != "application/json":
            raise ApiError(415, "request.json_only", "Send the body as application/json.")
        try:
            return json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise ApiError(400, "request.bad_json", "The body is not valid JSON.")

    # ---- dispatch --------------------------------------------------------------------------
    def handle_api(self, method):
        """Security checks, then the matching @route. Returns False when no route matches (GET: static)."""
        self._answered = False
        self._cache = None
        path = self.path_only
        body_raw = b""
        try:
            security.check_host(self)
            security.check_origin(self, method)
            found = router.find(method, path)
            if method != "GET" and method != "HEAD":
                # Always drain the body, so a refused request never desyncs the keep-alive connection.
                body_raw = self._read_body(found[2]["max_body"] if found else 2 * 1024 * 1024)
            if not found:
                if method in ("GET", "HEAD") and not path.startswith(("/api/", "/mock/")):
                    return False
                if router.allowed(path):
                    raise ApiError(405, "request.method_not_allowed", f"{method} is not allowed here.")
                raise ApiError(404, "request.not_found", "Not found.")
            fn, m, opts = found
            if method not in ("GET", "HEAD") and opts["token"]:
                security.check_token(self)
            if opts["raw"]:
                body = body_raw
            elif method in ("POST", "PUT", "PATCH"):
                body = self._json(body_raw)
                if not isinstance(body, dict):
                    raise ApiError(400, "request.bad_json", "The body must be a JSON object.")
            else:
                body = None
            self.now = time.time()
            if not opts["db"]:
                fn(self, None, m, body)
            else:
                with lock():
                    conn = db()
                    try:
                        with conn:  # commit on success, rollback on exception
                            fn(self, conn, m, body)
                    finally:
                        conn.close()
            if not self._answered:
                raise ApiError(500, "server.no_response", "The handler sent no response.")
        except ApiError as e:
            if self._answered:
                return True
            self.error(e.status, e.code, e.message)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception as e:  # never drop the connection on a handler bug
            traceback.print_exc()
            if not self._answered:
                self.error(500, "server.error", f"Server error: {type(e).__name__}.")
        return True

    def do_GET(self):
        if self.handle_api("GET"):
            return
        path = self.path_only
        if path != "/" and not (STATIC_DIR / path.lstrip("/")).is_file():
            self.path = "/"
        return super().do_GET()

    def do_HEAD(self):
        try:
            security.check_host(self)
        except ApiError as e:
            return self.error(e.status, e.code, e.message)
        return super().do_HEAD()

    def do_POST(self):
        self.handle_api("POST")

    def do_PUT(self):
        self.handle_api("PUT")

    def do_PATCH(self):
        self.handle_api("PATCH")

    def do_DELETE(self):
        self.handle_api("DELETE")

    def do_OPTIONS(self):
        # No CORS: the kit is same-origin only. Answer preflights with 403 and no Allow-Origin.
        self.error(403, "security.cors", "Cross-origin requests are not allowed.")


def make_server(port=PORT, host=HOST):
    init_db()
    router.load_all()
    return Server((host, port), Handler)


def main():
    srv = make_server()
    print(f"Analyst Kit → http://localhost:{srv.server_address[1]}", flush=True)
    for name, err in router.LOAD_ERRORS:
        print(f"  plug-in skipped: {name} ({err})", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
