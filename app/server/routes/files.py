"""Uploaded sources: list, upload, remove, download (scopes req-N and skill-<id>, see sources.py)."""

import mimetypes
from urllib.parse import parse_qs, unquote

import sources
from common import public, urlparse_query
from router import ApiError, route


@route("GET", r"/files/(req-\d+|skill-[a-z-]+)/(.+)", db=False)
def download(h, conn, m, body):
    f = sources.folder(m.group(1)) / sources.safe_name(unquote(m.group(2)))
    if not f.is_file():
        raise ApiError(404, "files.not_found", "Not found.")
    # Uploaded files are user content: never sniffed (nosniff is global), sandboxed if opened as a page.
    return h.send_bytes(f.read_bytes(), 200, mimetypes.guess_type(f.name)[0] or "application/octet-stream",
                        {"Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"})


@route("GET", r"/api/files")
def list_files(h, conn, m, body):
    scope = (parse_qs(urlparse_query(h.path)).get("scope") or [""])[0]
    try:
        return h.send_json({"files": public(sources.listing(scope))})
    except ValueError:
        raise ApiError(400, "files.bad_scope", "Bad scope.")


@route("POST", r"/api/files", max_body=120 * 1024 * 1024)
def upload(h, conn, m, body):
    try:
        names = [sources.save(body.get("scope"), f.get("name"), f.get("data", "")) for f in body.get("files") or []]
    except (ValueError, TypeError) as e:
        raise ApiError(400, "files.invalid", str(e))
    return h.send_json({"saved": names, "files": public(sources.listing(body.get("scope")))}, 201)


@route("DELETE", r"/api/files", db=False)
def remove(h, conn, m, body):
    qs = parse_qs(urlparse_query(h.path))
    try:
        sources.remove((qs.get("scope") or [""])[0], (qs.get("name") or [""])[0])
    except ValueError:
        raise ApiError(400, "files.bad_scope", "Bad scope.")
    return h.send_json({"ok": True})
