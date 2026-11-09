"""Local-only security: Host check (DNS rebinding), Origin check (CSRF) and a per-boot X-Kit-Token on writes.

Threat model (research/05-tech.md): the kit listens on 127.0.0.1 only, but any web page the user opens can
try to reach it. A foreign page cannot
  - pass the Host check through DNS rebinding (Host must be localhost / 127.0.0.1 / [::1] on our port),
  - send a write with its own Origin (refused), nor read /api/config to learn the token (no CORS, and
    /api/config refuses Sec-Fetch-Site: cross-site), so it cannot forge X-Kit-Token.
`curl` and the exported pytest suites send no Origin; they can call /mock/* (token=False routes) freely,
and other writes with  -H "X-Kit-Token: $(curl -s localhost:4317/api/config | jq -r .token)".

KIT_TOKEN env fixes the token (tests, scripts); otherwise a new random one is made at every boot.
"""

import hmac
import os
import secrets

from router import ApiError

TOKEN = os.environ.get("KIT_TOKEN") or secrets.token_urlsafe(32)
LOCAL_NAMES = ("localhost", "127.0.0.1", "[::1]")


def _port(h):
    return h.server.server_address[1]


def allowed_hosts(port):
    return {f"{n}:{port}" for n in LOCAL_NAMES} | ({*LOCAL_NAMES} if port == 80 else set())


def allowed_origins(port):
    return {f"http://{n}:{port}" for n in LOCAL_NAMES}


def check_host(h):
    host = (h.headers.get("Host") or "").strip().lower()
    if host not in allowed_hosts(_port(h)):
        raise ApiError(403, "security.bad_host", "This server only answers on localhost.")


def check_origin(h, method):
    origin = h.headers.get("Origin")
    if origin is None:
        # Browsers send Origin on every non-GET fetch; Sec-Fetch-Site covers the rest.
        if (h.headers.get("Sec-Fetch-Site") or "").lower() == "cross-site":
            raise ApiError(403, "security.bad_origin", "Cross-site requests are not allowed.")
        return
    if origin.strip().lower() not in allowed_origins(_port(h)):
        raise ApiError(403, "security.bad_origin", "Cross-site requests are not allowed.")


def check_token(h):
    sent = h.headers.get("X-Kit-Token") or ""
    if not hmac.compare_digest(sent.encode(), TOKEN.encode()):
        raise ApiError(403, "security.bad_token",
                       "Missing or stale X-Kit-Token. Reload the page (the server restarted).")
