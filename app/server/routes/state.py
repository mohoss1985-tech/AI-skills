"""GET /api/state (what the browser polls every 3 s) and GET /api/catalog (skills + groups, static per boot).

Both answer with an ETag and 304 on a matching If-None-Match. The catalog is built once per process
(catalog.types_payload is cached, so seed files are read once, not every poll); /api/state keeps `types`
and `groups` for V1 callers, and runs two grouped COUNT queries instead of two per deliverable.
"""

import hashlib
import json

from catalog import DEFAULT_PROFILE, groups_payload, types_payload
from db import claude_online, get_meta
from router import route

_catalog = None


def send_cached(h, payload_bytes):
    tag = '"' + hashlib.sha1(payload_bytes).hexdigest()[:20] + '"'
    inm = h.headers.get("If-None-Match") or ""
    if tag in [t.strip() for t in inm.split(",")]:
        h.send_response(304)
        h.send_header("ETag", tag)
        h.send_header("Content-Length", "0")
        h._cache = "no-cache"
        return h.end_headers()
    h._cache = "no-cache"  # revalidate every time, but allow 304
    return h.send_bytes(payload_bytes, 200, "application/json; charset=utf-8", {"ETag": tag})


def catalog_bytes():
    global _catalog
    if _catalog is None:
        _catalog = json.dumps({"types": types_payload(), "groups": groups_payload()}, ensure_ascii=False).encode()
    return _catalog


@route("GET", r"/api/catalog", db=False)
def get_catalog(h, conn, m, body):
    return send_cached(h, catalog_bytes())


def request_summaries(conn):
    unread = dict(conn.execute("SELECT request_id, COUNT(*) FROM messages WHERE role='claude' AND read=0 "
                               "AND request_id IS NOT NULL GROUP BY request_id").fetchall())
    waiting = {r[0] for r in conn.execute("SELECT DISTINCT request_id FROM messages WHERE role='user' AND handled=0 "
                                          "AND request_id IS NOT NULL")}
    out = []
    for row in conn.execute("SELECT * FROM requests ORDER BY updated_at DESC"):
        d = dict(row)
        for k in ("output", "notes", "changes", "answers"):
            d.pop(k, None)
        d["unread"] = unread.get(row["id"], 0)
        d["awaiting_reply"] = row["id"] in waiting
        out.append(d)
    return out


WS_COLS = "id, tool, title, client, lang, schema, request_id, is_sample, created_at, updated_at"


@route("GET", r"/api/state")
def get_state(h, conn, m, body):
    chat_unread = conn.execute("SELECT COUNT(*) FROM messages WHERE request_id IS NULL AND role='claude' "
                               "AND read=0").fetchone()[0]
    clients = [r[0] for r in conn.execute(
        "SELECT client FROM requests WHERE client!='' AND is_sample=0 GROUP BY client ORDER BY MAX(updated_at) DESC")]
    data = {
        "types": types_payload(),
        "requests": request_summaries(conn),
        "workspaces": [dict(r) for r in conn.execute(f"SELECT {WS_COLS} FROM workspaces ORDER BY updated_at DESC")],
        "claude_online": claude_online(conn),
        "chat_unread": chat_unread,
        "profile": {**DEFAULT_PROFILE, **get_meta(conn, "profile", {})},
        "learned": get_meta(conn, "learned", []),
        "clients": clients,
        "groups": groups_payload(),
    }
    return send_cached(h, json.dumps(data, ensure_ascii=False).encode())
