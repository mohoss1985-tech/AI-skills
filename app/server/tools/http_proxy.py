"""API tester transport (owner C): POST /api/tools/http/send. From research/tech-draft/proxy.py.

The browser cannot call most APIs (CORS), so the page posts the request here and the kit sends it from this
machine with http.client (every method, 4xx/5xx returned as normal answers, our own redirect handling, real
body sizes). Security, on top of B's Host/Origin/X-Kit-Token checks (router, token=True):
  - http/https only; target = this app's own port on a loopback address is refused, except /mock/* which is
    answered in-process by tools/mock_bank.py (so the tester and curl share one mock state);
  - limits: 1 MB request body, 5 MB response (rest cut, truncated=True), timeout <= 60 s, <= 5 redirects;
  - HTTPS_PROXY / HTTP_PROXY / NO_PROXY honoured (corporate laptops have no direct DNS);
  - writes (POST/PUT/PATCH/DELETE) to a production-looking host need "confirm_production": true (SKILL rule:
    never point destructive tests at production); the page asks the user first;
  - nothing is logged or stored here (server.log_message is silent; history is kept by the page, secrets masked).

Request:  {"method", "url", "headers": [[k, v]], "body": str, "timeout": 30, "follow_redirects": true,
           "verify_tls": true, "confirm_production": false}
Response: {"ok": true, "status", "reason", "headers": [[k, v]], "body", "body_encoding": "utf-8"|"base64",
           "truncated", "time_ms", "size", "final_url", "redirects", "via": "proxy"|"mock"}
       or {"ok": false, "code": "http.<reason>", "error": "<plain English>", "time_ms"}
Python 3.9 compatible.
"""

import base64
import http.client
import ipaddress
import re
import socket
import ssl
import time
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import getproxies, proxy_bypass

from router import route

MAX_REQUEST_BODY = 1 * 1024 * 1024
MAX_RESPONSE_BODY = 5 * 1024 * 1024
MAX_TIMEOUT = 60
MAX_REDIRECTS = 5
METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
WRITES = {"POST", "PUT", "PATCH", "DELETE"}
HOP_BY_HOP = {"connection", "keep-alive", "proxy-authorization", "proxy-connection", "te", "trailer",
              "transfer-encoding", "upgrade", "host", "content-length"}
SAFE_HOSTS = ("httpbin.org", "jsonplaceholder.typicode.com", "dummyjson.com", "reqres.in", "postman-echo.com",
              "echo.free.beeceptor.com", "api.restful-api.dev", "restful-booker.herokuapp.com")
SAFE_WORDS = re.compile(r"(^|[.-])(sandbox|test|testing|uat|sit|qa|dev|staging|stage|stg|preprod|demo|mock|local)([.-]|\d|$)", re.I)


def production_like(host):
    """True for a host that looks like a live system: not local, not reserved, not a known echo API, no test word."""
    h = (host or "").lower().strip("[]")
    if not h or h in ("localhost",) or h.endswith((".example", ".test", ".invalid", ".localhost", ".local", ".internal")):
        return False
    try:
        ip = ipaddress.ip_address(h)
        return not (ip.is_private or ip.is_loopback or ip.is_link_local)
    except ValueError:
        pass
    if any(h == s or h.endswith("." + s) for s in SAFE_HOSTS):
        return False
    return not SAFE_WORDS.search(h)


def _is_self(host, port, app_port):
    if port != app_port:
        return False
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        return False
    for i in infos:
        try:
            ip = ipaddress.ip_address(i[4][0].split("%")[0])
        except ValueError:
            continue
        if ip.is_loopback or ip.is_unspecified:
            return True
    return False


def _fail(code, msg, t0):
    return {"ok": False, "code": code, "error": msg, "time_ms": round((time.perf_counter() - t0) * 1000)}


def _mock_answer(method, url, path, headers, data, t0):
    from tools import mock_bank  # same package; imported lazily so a mock bug never breaks the proxy
    m = re.fullmatch(r"/mock/(harbor|lumiere)/v1(/.*)?", path)
    if not m:
        return _fail("http.self_call", "The API tester can't call Analyst Kit itself (only /mock/harbor/v1 and /mock/lumiere/v1).", t0)
    res = mock_bank.BANKS[m.group(1)].handle(method, m.group(2) or "/", headers, (data or b"").decode("utf-8", "replace"))
    raw = res["body"].encode("utf-8")
    return {"ok": True, "status": res["status"], "reason": res["reason"], "headers": res["headers"], "body": res["body"],
            "body_encoding": "utf-8", "truncated": False, "time_ms": round((time.perf_counter() - t0) * 1000),
            "size": len(raw), "final_url": url, "redirects": 0, "via": "mock"}


def send(req, app_port):
    t0 = time.perf_counter()
    method = str(req.get("method") or "GET").upper()
    if method not in METHODS:
        return _fail("http.bad_method", "Method %s is not supported. Use GET, POST, PUT, PATCH or DELETE." % method, t0)
    url = str(req.get("url") or "").strip()
    body = req.get("body")
    data = body.encode("utf-8") if isinstance(body, str) and body != "" else None
    if data and len(data) > MAX_REQUEST_BODY:
        return _fail("http.body_too_large", "The request body is larger than 1 MB. Send a smaller body.", t0)
    try:
        timeout = max(1.0, min(float(req.get("timeout") or 30), MAX_TIMEOUT))
    except (TypeError, ValueError):
        timeout = 30.0
    follow = req.get("follow_redirects", True) is not False
    ctx = ssl.create_default_context()
    if req.get("verify_tls") is False:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    headers = []
    for pair in req.get("headers") or []:
        if not isinstance(pair, (list, tuple)) or len(pair) != 2:
            continue
        k, v = str(pair[0]).strip(), str(pair[1])
        if k and k.lower() not in HOP_BY_HOP and "\n" not in k + v and "\r" not in k + v:
            headers.append((k, v))
    if not any(k.lower() == "user-agent" for k, _ in headers):
        headers.append(("User-Agent", "AnalystKit/2"))

    first = urlsplit(url)
    if first.scheme not in ("http", "https") or not first.hostname:
        return _fail("http.scheme_not_allowed", "The URL must start with http:// or https://.", t0)
    if method in WRITES and production_like(first.hostname) and not req.get("confirm_production"):
        return _fail("http.production_confirm",
                     "%s looks like a production host. Confirm that you really want to send a %s there." % (first.hostname, method), t0)

    redirects = 0
    while True:
        u = urlsplit(url)
        if u.scheme not in ("http", "https") or not u.hostname:
            return _fail("http.scheme_not_allowed", "The URL must start with http:// or https://.", t0)
        try:
            port = u.port or (443 if u.scheme == "https" else 80)
        except ValueError:
            return _fail("http.bad_url", "The port in the URL is not valid.", t0)
        if _is_self(u.hostname, port, app_port):
            return _mock_answer(method, url, u.path, headers, data, t0)
        target = (u.path or "/") + ("?" + u.query if u.query else "")
        Conn = http.client.HTTPSConnection if u.scheme == "https" else http.client.HTTPConnection
        kw = {"context": ctx} if u.scheme == "https" else {}
        hdrs = headers
        up = getproxies().get(u.scheme)
        if up and not proxy_bypass(u.hostname):
            p = urlsplit(up if "://" in up else "http://" + up)
            auth = {}
            if p.username:
                tok = base64.b64encode(("%s:%s" % (unquote(p.username), unquote(p.password or ""))).encode()).decode()
                auth = {"Proxy-Authorization": "Basic " + tok}
            conn = Conn(p.hostname, p.port or 8080, timeout=timeout, **kw)
            if u.scheme == "https":
                conn.set_tunnel(u.hostname, port, headers=auth)
            else:
                target = url
                hdrs = headers + list(auth.items())
        else:
            conn = Conn(u.hostname, port, timeout=timeout, **kw)
        try:
            conn.putrequest(method, target, skip_accept_encoding=True)
            for k, v in hdrs:
                conn.putheader(k, v)
            if data is not None:
                conn.putheader("Content-Length", str(len(data)))
            conn.endheaders(data)
            resp = conn.getresponse()
            raw = b"" if method == "HEAD" else resp.read(MAX_RESPONSE_BODY + 1)
        except socket.timeout:
            return _fail("http.timeout", "No answer after %g s. Check the URL or raise the timeout under More." % timeout, t0)
        except ssl.SSLError as e:
            return _fail("http.tls", "TLS error: %s. For an internal test host with a self-signed certificate, untick Verify TLS under More." % (e.reason or e), t0)
        except socket.gaierror:
            return _fail("http.dns", "%s could not be found. Check the host name (or your proxy settings)." % u.hostname, t0)
        except ConnectionRefusedError:
            return _fail("http.refused", "%s:%d refused the connection. Is the server running?" % (u.hostname, port), t0)
        except (OSError, http.client.HTTPException) as e:
            return _fail("http.connect", "Could not connect: %s" % e, t0)
        finally:
            conn.close()

        loc = resp.getheader("Location")
        if follow and resp.status in (301, 302, 303, 307, 308) and loc and redirects < MAX_REDIRECTS:
            redirects += 1
            url = urljoin(url, loc)
            if resp.status == 303 or (resp.status in (301, 302) and method == "POST"):
                method, data = "GET", None
            continue
        break

    truncated = len(raw) > MAX_RESPONSE_BODY
    raw = raw[:MAX_RESPONSE_BODY]
    try:
        text, enc = raw.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        text, enc = base64.b64encode(raw).decode("ascii"), "base64"
    return {"ok": True, "status": resp.status, "reason": resp.reason, "headers": [[k, v] for k, v in resp.getheaders()],
            "body": text, "body_encoding": enc, "truncated": truncated,
            "time_ms": round((time.perf_counter() - t0) * 1000), "size": len(raw), "final_url": url,
            "redirects": redirects, "via": "proxy"}


@route("POST", r"/api/tools/http/send", db=False, max_body=MAX_REQUEST_BODY + 64 * 1024)
def http_send(h, conn, m, body):
    return h.send_json(send(body or {}, h.server.server_address[1]))
