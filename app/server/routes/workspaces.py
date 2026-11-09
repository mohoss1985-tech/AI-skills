"""Tool workspaces: /api/workspaces[/:id[/runs|/publish|/ai]] (research/07 §3, DESIGN_SPEC §8).

A workspace is one tool document (an API collection, a WSJF table, a BPMN…): `state` is the tool's JSON.
Runs keep the last 50 executions. Publish turns it into a deliverable (V1 features for free).
AI posts a user message carrying `meta`, which kit.py pending expands with the state and last run.
"""

import json

from router import ApiError, route
from toolreg import TOOLS

STATE_MAX = 4 * 1024 * 1024     # bytes of JSON state per workspace
RESULT_MAX = 256 * 1024         # bytes of JSON result per run (bigger results are truncated)
RUNS_KEPT = 50
WS_COLS = "id, tool, title, client, lang, schema, request_id, is_sample, created_at, updated_at"


def _str(body, key, limit, default=""):
    v = body.get(key, default)
    if v is None:
        v = default
    if not isinstance(v, str):
        raise ApiError(400, f"validation.{key}", f"`{key}` must be text.")
    return v.strip()[:limit]


def _state(body):
    st = body.get("state", {})
    if not isinstance(st, dict):
        raise ApiError(400, "validation.state", "`state` must be a JSON object.")
    text = json.dumps(st, ensure_ascii=False)
    if len(text.encode()) > STATE_MAX:
        raise ApiError(413, "workspace.state_too_large", "The tool state is over 4 MB.")
    return text


def _schema(body, default=1):
    v = body.get("schema", default)
    if not isinstance(v, int) or isinstance(v, bool) or v < 1:
        raise ApiError(400, "validation.schema", "`schema` must be a positive integer.")
    return v


def _row(conn, wid):
    row = conn.execute("SELECT * FROM workspaces WHERE id=?", (wid,)).fetchone()
    if not row:
        raise ApiError(404, "workspace.not_found", "This workspace does not exist (deleted?).")
    return row


def _run(r):
    d = dict(r)
    for k in ("input", "result"):
        d[k] = json.loads(d[k] or "{}")
    d["ok"] = None if d["ok"] is None else bool(d["ok"])
    return d


def full(conn, row):
    d = dict(row)
    d["state"] = json.loads(d["state"] or "{}")
    last = conn.execute("SELECT * FROM runs WHERE workspace_id=? ORDER BY id DESC LIMIT 1", (row["id"],)).fetchone()
    d["last_run"] = _run(last) if last else None
    req = None
    if row["request_id"]:
        r = conn.execute("SELECT id, type, title, status, updated_at, sent_at FROM requests WHERE id=?",
                         (row["request_id"],)).fetchone()
        req = dict(r) if r else None
    d["request"] = req
    return d


@route("GET", r"/api/workspaces")
def list_workspaces(h, conn, m, body):
    tool = h.query().get("tool")
    if tool:
        rows = conn.execute(f"SELECT {WS_COLS} FROM workspaces WHERE tool=? ORDER BY updated_at DESC", (tool,))
    else:
        rows = conn.execute(f"SELECT {WS_COLS} FROM workspaces ORDER BY updated_at DESC")
    return h.send_json({"workspaces": [dict(r) for r in rows]})


@route("POST", r"/api/workspaces", max_body=STATE_MAX + 65536)
def create_workspace(h, conn, m, body):
    tool = body.get("tool")
    if not isinstance(tool, str) or (TOOLS and tool not in TOOLS):
        raise ApiError(400, "workspace.bad_tool", "Unknown tool.")
    cur = conn.execute(
        "INSERT INTO workspaces (tool,title,client,lang,state,schema,is_sample,created_at,updated_at) "
        "VALUES (?,?,?,?,?,?,?,?,?)",
        (tool, _str(body, "title", 120), _str(body, "client", 120), _str(body, "lang", 8), _state(body),
         _schema(body), 1 if body.get("is_sample") else 0, h.now, h.now))
    return h.send_json(full(conn, _row(conn, cur.lastrowid)), 201)


@route("GET", r"/api/workspaces/(\d+)")
def get_workspace(h, conn, m, body):
    return h.send_json(full(conn, _row(conn, int(m.group(1)))))


@route("PUT", r"/api/workspaces/(\d+)", max_body=STATE_MAX + 65536)
def update_workspace(h, conn, m, body):
    row = _row(conn, int(m.group(1)))
    sets, args = [], []
    for key, limit in (("title", 120), ("client", 120), ("lang", 8)):
        if key in body:
            sets.append(f"{key}=?")
            args.append(_str(body, key, limit))
    if "state" in body:
        sets.append("state=?")
        args.append(_state(body))
    if "schema" in body:
        sets.append("schema=?")
        args.append(_schema(body))
    sets.append("updated_at=?")
    args.append(h.now)
    conn.execute(f"UPDATE workspaces SET {', '.join(sets)} WHERE id=?", (*args, row["id"]))
    return h.send_json(full(conn, _row(conn, row["id"])))


@route("DELETE", r"/api/workspaces/(\d+)")
def delete_workspace(h, conn, m, body):
    row = _row(conn, int(m.group(1)))
    conn.execute("DELETE FROM runs WHERE workspace_id=?", (row["id"],))
    conn.execute("DELETE FROM workspaces WHERE id=?", (row["id"],))
    conn.execute("UPDATE requests SET workspace_id=NULL WHERE workspace_id=?", (row["id"],))  # deliverable stays
    return h.send_no_content()


# ---- runs ---------------------------------------------------------------------------------------

def _cap_result(result):
    text = json.dumps(result, ensure_ascii=False)
    if len(text.encode()) <= RESULT_MAX:
        return text
    return json.dumps({"truncated": True, "size": len(text.encode()),
                       "preview": text.encode()[:RESULT_MAX // 2].decode("utf-8", "ignore")}, ensure_ascii=False)


@route("POST", r"/api/workspaces/(\d+)/runs", max_body=8 * 1024 * 1024)
def add_run(h, conn, m, body):
    row = _row(conn, int(m.group(1)))
    ok = body.get("ok")
    ms = body.get("ms")
    if ms is not None and (not isinstance(ms, (int, float)) or isinstance(ms, bool) or ms < 0):
        raise ApiError(400, "validation.ms", "`ms` must be a positive number.")
    inp = body.get("input", {})
    inp_text = json.dumps(inp, ensure_ascii=False)
    if len(inp_text.encode()) > RESULT_MAX:
        inp_text = _cap_result(inp)
    cur = conn.execute(
        "INSERT INTO runs (workspace_id,kind,input,result,ok,ms,created_at) VALUES (?,?,?,?,?,?,?)",
        (row["id"], _str(body, "kind", 40), inp_text, _cap_result(body.get("result", {})),
         None if ok is None else (1 if ok else 0), None if ms is None else int(ms), h.now))
    conn.execute("DELETE FROM runs WHERE workspace_id=? AND id NOT IN "
                 "(SELECT id FROM runs WHERE workspace_id=? ORDER BY id DESC LIMIT ?)",
                 (row["id"], row["id"], RUNS_KEPT))
    conn.execute("UPDATE workspaces SET updated_at=? WHERE id=?", (h.now, row["id"]))
    return h.send_json(_run(conn.execute("SELECT * FROM runs WHERE id=?", (cur.lastrowid,)).fetchone()), 201)


@route("GET", r"/api/workspaces/(\d+)/runs")
def list_runs(h, conn, m, body):
    row = _row(conn, int(m.group(1)))
    try:
        limit = max(1, min(RUNS_KEPT, int(h.query().get("limit") or 20)))
    except ValueError:
        raise ApiError(400, "validation.limit", "`limit` must be a number.")
    rows = conn.execute("SELECT * FROM runs WHERE workspace_id=? ORDER BY id DESC LIMIT ?", (row["id"], limit))
    return h.send_json({"runs": [_run(r) for r in rows]})


# ---- publish ------------------------------------------------------------------------------------

@route("POST", r"/api/workspaces/(\d+)/publish", max_body=STATE_MAX + 2 * 1024 * 1024)
def publish(h, conn, m, body):
    """Create or update the linked deliverable from the tool's Markdown (toMarkdown(state, lastRun))."""
    row = _row(conn, int(m.group(1)))
    output = body.get("output")
    if not isinstance(output, str) or not output.strip():
        raise ApiError(400, "validation.output", "Nothing to save: the tool produced no document.")
    if len(output.encode()) > 2 * 1024 * 1024:
        raise ApiError(413, "workspace.output_too_large", "The document is over 2 MB.")
    title = _str(body, "title", 70) or row["title"] or row["tool"]
    rtype = _str(body, "type", 60) or TOOLS.get(row["tool"]) or row["tool"]
    snapshot = row["state"]  # the state that produced the *current* output (pushed with it to versions)
    req = conn.execute("SELECT * FROM requests WHERE id=?", (row["request_id"],)).fetchone() if row["request_id"] else None
    created = req is None
    if created:
        cur = conn.execute(
            "INSERT INTO requests (type,client,title,notes,output,status,lang,workspace_id,unseen,created_at,updated_at)"
            " VALUES (?,?,?,?,?, 'ready', ?, ?, 0, ?, ?)",
            (rtype, row["client"], title, f"Made with the {row['tool']} tool.", output, row["lang"], row["id"],
             h.now, h.now))
        rid = cur.lastrowid
        conn.execute("UPDATE workspaces SET request_id=?, updated_at=? WHERE id=?", (rid, h.now, row["id"]))
    else:
        rid = req["id"]
        if req["output"].strip() and req["output"] != output:
            prev_state = get_publish_state(conn, rid)
            conn.execute("INSERT INTO versions (request_id,output,created_at,source,state) VALUES (?,?,?,?,?)",
                         (rid, req["output"], h.now, "tool", prev_state))
        conn.execute("UPDATE requests SET output=?, title=?, status='ready', workspace_id=?, updated_at=? WHERE id=?",
                     (output, title, row["id"], h.now, rid))
    set_publish_state(conn, rid, snapshot)
    return h.send_json({"request_id": rid, "created": created, "href": f"#/d/{rid}"}, 201 if created else 200)


def get_publish_state(conn, rid):
    """State snapshot of the deliverable's current output (stored in meta, so versions get the right one)."""
    row = conn.execute("SELECT value FROM meta WHERE key=?", (f"published_state:{rid}",)).fetchone()
    return row["value"] if row else None


def set_publish_state(conn, rid, state_json):
    conn.execute("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                 (f"published_state:{rid}", state_json))


# ---- AI -----------------------------------------------------------------------------------------

@route("POST", r"/api/workspaces/(\d+)/ai", max_body=1024 * 1024)
def ask_ai(h, conn, m, body):
    row = _row(conn, int(m.group(1)))
    action = _str(body, "action", 60)
    prompt = _str(body, "prompt", 50000)
    if not action:
        raise ApiError(400, "validation.action", "Pick an AI action.")
    if not prompt:
        raise ApiError(400, "validation.prompt", "The AI action produced no prompt.")
    expects = _str(body, "expects", 20) or "markdown"
    if expects not in ("markdown", "json"):
        raise ApiError(400, "validation.expects", "`expects` is markdown or json.")
    run_id = body.get("run_id")
    if run_id is not None:
        if not isinstance(run_id, int) or not conn.execute(
                "SELECT 1 FROM runs WHERE id=? AND workspace_id=?", (run_id, row["id"])).fetchone():
            raise ApiError(400, "validation.run_id", "That run is not in this workspace.")
    meta = {"action": action, "workspace_id": row["id"], "tool": row["tool"], "run_id": run_id, "expects": expects}
    cur = conn.execute("INSERT INTO messages (request_id,role,body,created_at,meta) VALUES (?,'user',?,?,?)",
                       (row["request_id"], prompt, h.now, json.dumps(meta)))
    return h.send_json({"message_id": cur.lastrowid, "thread": row["request_id"] or "chat", "meta": meta}, 201)
