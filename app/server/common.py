"""Small helpers shared by the route modules (moved from V1's server.py)."""

import json


def public(files):
    """File listing for the browser: no local paths."""
    return [{k: f[k] for k in ("name", "size", "kind")} | {"extracted": bool(f["text_path"])} for f in files]


def urlparse_query(path):
    return path.partition("?")[2]


def summary(conn, row):
    d = dict(row)
    d.pop("output"), d.pop("notes"), d.pop("changes"), d.pop("answers", None)
    d["unread"] = conn.execute("SELECT COUNT(*) FROM messages WHERE request_id=? AND role='claude' AND read=0",
                               (row["id"],)).fetchone()[0]
    d["awaiting_reply"] = conn.execute("SELECT COUNT(*) FROM messages WHERE request_id=? AND role='user' AND handled=0",
                                       (row["id"],)).fetchone()[0] > 0
    return d


def thread(conn, request_id):
    """Messages of one deliverable (or the general chat when request_id is None); marks Claude's as read."""
    where = "request_id IS NULL" if request_id is None else "request_id=?"
    args = () if request_id is None else (request_id,)
    msgs = []
    for m in conn.execute(f"SELECT * FROM messages WHERE {where} ORDER BY created_at", args):
        d = dict(m)
        if "meta" in d:
            try:
                d["meta"] = json.loads(d["meta"]) if d["meta"] else None
            except ValueError:
                d["meta"] = None
        msgs.append(d)
    conn.execute(f"UPDATE messages SET read=1 WHERE {where} AND role='claude'", args)
    return msgs
