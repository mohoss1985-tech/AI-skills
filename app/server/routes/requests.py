"""Deliverables: create, read, delete, thread messages, mark as sent, older versions."""

import json
import shutil

import sources
from catalog import TYPE_IDS
from common import public, thread
from db import db, lock
from questions import QUESTIONS
from router import ApiError, route

UPLOAD_MAX = 120 * 1024 * 1024  # base64 files in a JSON body (sources.py caps each file at 25 MB)


@route("GET", r"/api/requests/(\d+)")
def get_request(h, conn, m, body):
    rid = int(m.group(1))
    row = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
    if not row:
        raise ApiError(404, "request.not_found", "Not found.")
    conn.execute("UPDATE requests SET unseen=0 WHERE id=?", (rid,))
    versions = [dict(v) for v in conn.execute(
        "SELECT id, created_at, source, state IS NOT NULL AS has_state FROM versions WHERE request_id=? "
        "ORDER BY created_at", (rid,))]
    ws = None
    if row["workspace_id"]:
        w = conn.execute("SELECT id, tool, title FROM workspaces WHERE id=?", (row["workspace_id"],)).fetchone()
        if w:  # "Open in tool": #/tool/<tool>?ws=<id>
            ws = {**dict(w), "href": f"#/tool/{w['tool']}?ws={w['id']}"}
    return h.send_json({**dict(row), "answers": json.loads(row["answers"] or "{}"), "workspace": ws,
                        "messages": thread(conn, rid), "versions": versions,
                        "sources": public(sources.listing(f"req-{rid}")),
                        "knowledge": public(sources.listing(f"skill-{row['type']}"))})


@route("GET", r"/api/versions/(\d+)")
def get_version(h, conn, m, body):
    row = conn.execute("SELECT * FROM versions WHERE id=?", (int(m.group(1)),)).fetchone()
    if not row:
        raise ApiError(404, "version.not_found", "Not found.")
    d = dict(row)
    d["state"] = json.loads(d["state"]) if d.get("state") else None
    return h.send_json(d)


@route("POST", r"/api/requests", max_body=UPLOAD_MAX)
def create_request(h, conn, m, body):
    notes = (body.get("notes") or "").strip()
    answers = {k: str(v).strip()[:500] for k, v in (body.get("answers") or {}).items() if str(v).strip()}
    files = body.get("files") or []
    if body.get("type") not in TYPE_IDS:
        raise ApiError(400, "validation.type", "Pick a deliverable.")
    missing = [x["en"] for x in QUESTIONS.get(body["type"], []) if x["req"] and not answers.get(x["id"])]
    if missing:
        raise ApiError(400, "validation.answers", "Answer: " + ", ".join(missing))
    if not (notes or answers or files):
        raise ApiError(400, "validation.empty", "Add your notes, answers or a document first.")
    title = ((body.get("title") or "").strip() or next(iter(answers.values()), "")
             or (notes.splitlines() or [""])[0] or (files[0].get("name", "") if files else ""))[:70]
    # Saved as a draft first, so Claude only picks it up once its documents are stored.
    cur = conn.execute(
        "INSERT INTO requests (type,client,title,notes,answers,status,created_at,updated_at) "
        "VALUES (?,?,?,?,?, 'draft', ?, ?)",
        (body["type"], (body.get("client") or "").strip(), title, notes, json.dumps(answers), h.now, h.now))
    rid = cur.lastrowid
    try:
        for f in files:
            sources.save(f"req-{rid}", f.get("name"), f.get("data", ""))
    except (ValueError, TypeError) as e:
        conn.execute("DELETE FROM requests WHERE id=?", (rid,))
        shutil.rmtree(sources.folder(f"req-{rid}"), ignore_errors=True)
        raise ApiError(400, "files.invalid", str(e))
    conn.execute("UPDATE requests SET status='waiting' WHERE id=?", (rid,))
    return h.send_json({"id": rid}, 201)


@route("POST", r"/api/requests/(\d+)/messages")
def post_message(h, conn, m, body):
    text = (body.get("body") or "").strip()
    if not text:
        raise ApiError(400, "validation.message_empty", "Write a message first.")
    rid = int(m.group(1))
    if not conn.execute("SELECT 1 FROM requests WHERE id=?", (rid,)).fetchone():
        raise ApiError(404, "request.not_found", "Not found.")
    cur = conn.execute("INSERT INTO messages (request_id,role,body,created_at) VALUES (?,'user',?,?)",
                       (rid, text[:20000], h.now))
    return h.send_json({"ok": True, "id": cur.lastrowid}, 201)


@route("POST", r"/api/requests/(\d+)/sent")
def mark_sent(h, conn, m, body):
    conn.execute("UPDATE requests SET sent_at=? WHERE id=?",
                 (h.now if body.get("sent") else None, int(m.group(1))))
    return h.send_json({"ok": True})


@route("DELETE", r"/api/requests/(\d+)", db=False)
def delete_request(h, conn, m, body):
    rid = int(m.group(1))
    shutil.rmtree(sources.folder(f"req-{rid}"), ignore_errors=True)
    with lock(), db() as c:
        c.execute("DELETE FROM requests WHERE id=?", (rid,))
        c.execute("DELETE FROM messages WHERE request_id=?", (rid,))
        c.execute("DELETE FROM versions WHERE request_id=?", (rid,))
        c.execute("UPDATE workspaces SET request_id=NULL WHERE request_id=?", (rid,))
    h.send_no_content()
