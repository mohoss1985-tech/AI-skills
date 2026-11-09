"""Draft: /api/proxy for Analyst Kit V2 (Python 3.9+ stdlib only).

Wire into server.Handler.do_POST:

    if path == "/api/proxy":
        if not proxy.allowed_caller(self.headers, PORT):
            return self.send_json({"error": "Forbidden"}, 403)
        return self.send_json(proxy.send(self.read_json(), PORT))

Request JSON (from the API tester):
    {"method": "POST", "url": "https://httpbin.org/anything?x=1",
     "headers": [["Content-Type", "application/json"], ["Authorization", "Bearer ..."]],
     "body": "{\"amount\": 1200}", "timeout": 30, "follow_redirects": true, "verify_tls": true}
Response JSON:
    {"ok": true, "status": 200, "reason": "OK", "headers": [[k, v], ...], "body": "...",
     "body_encoding": "utf-8" | "base64", "truncated": false, "time_ms": 182, "size": 431,
     "final_url": "...", "redirects": 0}
    or {"ok": false, "error": "Timed out after 30 s", "time_ms": 30001}

Nothing here logs or stores headers/body (server.log_message already returns early).
"""

import base64
import http.client
import ipaddress
import socket
import ssl
import time
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import getproxies, proxy_bypass

MAX_REQUEST_BODY = 1 * 1024 * 1024        # 1 MB sent
MAX_RESPONSE_BODY = 5 * 1024 * 1024       # 5 MB read, rest dropped (truncated=True)
MAX_TIMEOUT = 60                          # seconds, per hop
MAX_REDIRECTS = 5
METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
HOP_BY_HOP = {"connection", "keep-alive", "proxy-authorization", "proxy-connection", "te",
              "trailer", "transfer-encoding", "upgrade", "host", "content-length"}


def allowed_caller(headers, port):
    """Only the Analyst Kit page itself may use the proxy.

    The server already binds 127.0.0.1. This also stops a random website open in the
    browser from using the proxy (CSRF) or reaching it through DNS rebinding:
    - Host must be localhost/127.0.0.1:<port>  (DNS rebinding sends the attacker's host)
    - Origin, when sent, must be the app's own origin
    - a custom header is required: cross-site pages can't add it without a CORS preflight,
      and the server never answers preflights.
    """
    ok_hosts = {f"localhost:{port}", f"127.0.0.1:{port}"}
    if headers.get("Host", "") not in ok_hosts:
        return False
    origin = headers.get("Origin")
    if origin and origin not in {f"http://{h}" for h in ok_hosts}:
        return False
    return headers.get("X-Kit-Proxy") == "1"


def _is_self(host, port, app_port):
    """True when the target is this app (any loopback address on the app's port)."""
    if port != app_port:
        return False
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return False
    return any(ipaddress.ip_address(i[4][0]).is_loopback or ipaddress.ip_address(i[4][0]).is_unspecified
               for i in infos)


def _fail(msg, t0):
    return {"ok": False, "error": msg, "time_ms": round((time.perf_counter() - t0) * 1000)}


def send(req, app_port):
    t0 = time.perf_counter()
    method = str(req.get("method", "GET")).upper()
    if method not in METHODS:
        return _fail(f"Method {method} is not supported", t0)
    url = str(req.get("url", "")).strip()
    body = req.get("body")
    data = body.encode("utf-8") if isinstance(body, str) and body != "" else None
    if data and len(data) > MAX_REQUEST_BODY:
        return _fail("Request body is larger than 1 MB", t0)
    timeout = max(1, min(float(req.get("timeout") or 30), MAX_TIMEOUT))
    follow = req.get("follow_redirects", True)
    ctx = ssl.create_default_context()
    if req.get("verify_tls") is False:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    headers = [(str(k), str(v)) for k, v in (req.get("headers") or [])
               if str(k).strip() and str(k).lower() not in HOP_BY_HOP]
    if not any(k.lower() == "user-agent" for k, _ in headers):
        headers.append(("User-Agent", "AnalystKit/2"))

    redirects = 0
    while True:
        u = urlsplit(url)
        if u.scheme not in ("http", "https") or not u.hostname:
            return _fail("URL must start with http:// or https://", t0)
        port = u.port or (443 if u.scheme == "https" else 80)
        if _is_self(u.hostname, port, app_port):
            return _fail("The API tester can't call Analyst Kit itself", t0)
        target = (u.path or "/") + (f"?{u.query}" if u.query else "")
        Conn = http.client.HTTPSConnection if u.scheme == "https" else http.client.HTTPConnection
        kw = {"context": ctx} if u.scheme == "https" else {}
        # Corporate networks: honour HTTPS_PROXY / HTTP_PROXY / NO_PROXY like curl and urllib do
        # (http.client alone ignores them, and laptops behind a proxy have no direct DNS).
        hdrs = headers
        up = getproxies().get(u.scheme)
        if up and not proxy_bypass(u.hostname):
            p = urlsplit(up if "://" in up else "http://" + up)
            auth = {}
            if p.username:
                tok = base64.b64encode(f"{unquote(p.username)}:{unquote(p.password or '')}".encode()).decode()
                auth = {"Proxy-Authorization": f"Basic {tok}"}
            conn = Conn(p.hostname, p.port or 8080, timeout=timeout, **kw)
            if u.scheme == "https":
                conn.set_tunnel(u.hostname, port, headers=auth)
            else:
                target = url  # absolute-form request line for plain-HTTP proxies
                hdrs = headers + list(auth.items())
        else:
            conn = Conn(u.hostname, port, timeout=timeout, **kw)
        try:
            conn.putrequest(method, target, skip_accept_encoding=True)  # identity: sizes are real
            for k, v in hdrs:
                conn.putheader(k, v)
            if data is not None:
                conn.putheader("Content-Length", str(len(data)))
            conn.endheaders(data)
            resp = conn.getresponse()
            raw = b"" if method == "HEAD" else resp.read(MAX_RESPONSE_BODY + 1)
        except socket.timeout:
            return _fail(f"Timed out after {timeout:g} s", t0)
        except ssl.SSLError as e:
            return _fail(f"TLS error: {e.reason or e}", t0)
        except (OSError, http.client.HTTPException) as e:
            return _fail(f"Could not connect: {e}", t0)
        finally:
            conn.close()

        loc = resp.getheader("Location")
        if follow and resp.status in (301, 302, 303, 307, 308) and loc and redirects < MAX_REDIRECTS:
            redirects += 1
            url = urljoin(url, loc)
            if resp.status == 303 or (resp.status in (301, 302) and method == "POST"):
                method, data = "GET", None  # browsers and Postman do the same
            continue
        break

    truncated = len(raw) > MAX_RESPONSE_BODY
    raw = raw[:MAX_RESPONSE_BODY]
    try:
        text, enc = raw.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        text, enc = base64.b64encode(raw).decode("ascii"), "base64"
    return {"ok": True, "status": resp.status, "reason": resp.reason,
            "headers": [[k, v] for k, v in resp.getheaders()],  # keeps duplicate Set-Cookie
            "body": text, "body_encoding": enc, "truncated": truncated,
            "time_ms": round((time.perf_counter() - t0) * 1000), "size": len(raw),
            "final_url": url, "redirects": redirects}


if __name__ == "__main__":  # smoke test: python3 proxy.py
    import json
    r = send({"method": "POST", "url": "https://httpbin.org/anything?pan=411111******1111",
              "headers": [["Content-Type", "application/json"], ["x-api-key", "demo"]],
              "body": json.dumps({"amount": 1200, "currency": "EUR"})}, 4317)
    print(r["status"], r["time_ms"], "ms", r["size"], "bytes")
    print(send({"url": "http://127.0.0.1:4317/api/state"}, 4317)["error"])
    print(send({"url": "https://httpbin.org/redirect/2"}, 4317)["redirects"])
