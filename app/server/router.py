"""Route registry: every module in routes/ and tools/ registers its handlers with @route.

    from router import route, ApiError

    @route("GET", r"/api/requests/(\\d+)")
    def get_request(h, conn, m, body):
        return h.send_json({...})

Plug-ins: any `app/server/tools/<name>.py` that uses @route is imported automatically at boot
(`load_all()`), so tool owners add endpoints without touching server.py. See research/wave1-B-api.md.

route(method, pattern, db=True, token=True, raw=False, max_body=2 MB)
  method   GET | POST | PUT | PATCH | DELETE
  pattern  regex, re.fullmatch against the path without its query string
  db       True: `conn` is an SQLite connection opened under the global lock, committed on success,
           rolled back on exception. False: conn is None (use for slow work such as outgoing HTTP).
  token    writes (non-GET) need the per-boot X-Kit-Token header unless token=False
           (mock endpoints that curl/pytest exports call). Host and Origin are checked on every request.
  raw      True: `body` is the request bytes (any Content-Type). False: writes must send
           application/json and `body` is the parsed object ({} when empty); GET/DELETE get None.
  max_body bytes accepted before 413.

Handler: fn(h, conn, m, body). `h` offers send_json(data, status=200, headers=None),
send_bytes(data, status=200, content_type=..., headers=None), error(status, code, message),
query() -> {key: last value}, path (without query), now (request time), headers.
Raise ApiError(status, code, message) anywhere to answer {"error": {"code", "message"}}.
"""

import importlib
import pkgutil
import re
import sys
import traceback
from pathlib import Path

ROUTES = []  # (method, compiled pattern, handler, options)
METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")
LOAD_ERRORS = []  # (module, error) for plug-ins that failed to import


class ApiError(Exception):
    """Answered as {"error": {"code": code, "message": message}} with the HTTP status."""

    def __init__(self, status, code, message=""):
        super().__init__(message or code)
        self.status, self.code, self.message = status, code, message or code


def route(method, pattern, db=True, token=True, raw=False, max_body=2 * 1024 * 1024):
    method = method.upper()
    if method not in METHODS:
        raise ValueError(f"@route: unsupported method {method}")

    def register(fn):
        ROUTES.append((method, re.compile(pattern), fn,
                       {"db": db, "token": token, "raw": raw, "max_body": max_body}))
        return fn
    return register


def find(method, path):
    """(fn, match, options) for the first matching route, or None. 'allowed' lists other methods on that path."""
    for meth, rx, fn, opts in ROUTES:
        if meth == method:
            m = rx.fullmatch(path)
            if m:
                return fn, m, opts
    return None


def allowed(path):
    return sorted({meth for meth, rx, _, _ in ROUTES if rx.fullmatch(path)})


_loaded = False


def load_all():
    """Import every module in routes/ and tools/ so their @route decorators run (once).

    A broken tools/ plug-in is reported on stderr and skipped; it never stops the server."""
    global _loaded
    if _loaded:
        return
    here = Path(__file__).resolve().parent
    for pkg in ("routes", "tools"):
        for info in sorted(pkgutil.iter_modules([str(here / pkg)]), key=lambda i: i.name):
            name = f"{pkg}.{info.name}"
            if pkg == "routes":
                importlib.import_module(name)
                continue
            try:
                importlib.import_module(name)
            except Exception as e:  # a tool owner's bug must not take the kit down
                LOAD_ERRORS.append((name, repr(e)))
                print(f"[router] plug-in {name} failed to load: {e!r}", file=sys.stderr)
                traceback.print_exc()
    _loaded = True
