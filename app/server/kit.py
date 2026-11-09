"""Claude's side of Analyst Kit: find work, write deliverables, answer messages, fill tool workspaces.

  python3 app/server/kit.py wait                       block until there is work (keeps "Claude is online" lit)
  python3 app/server/kit.py pending                    print profile, learned notes, waiting requests and unanswered
                                                       messages (with their ids; tool messages carry the workspace
                                                       state and the run they refer to)
  python3 app/server/kit.py start <id>                 mark a request as being written
  python3 app/server/kit.py deliver <id> <file.md>     save the deliverable (older text becomes a previous version)
  python3 app/server/kit.py reply <id|chat> <file.md> [--ids 12 13 …]
                                                       answer a thread; marks handled ONLY the given message ids
                                                       (default: the ones that were pending when you ran `pending`,
                                                       i.e. every unhandled message created before the reply file)
  python3 app/server/kit.py patch <workspace_id> <file.json> [--action <id>] [--ids 12 …]
                                                       validate JSON against app/server/tools/schemas/<tool>.json
                                                       (when present) and merge it into the workspace state.ai[action]
  python3 app/server/kit.py learn "<note>"             remember a preference about the user
"""

import json
import sqlite3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import sources  # noqa: E402
from db import DB_PATH, SERVER_DIR  # noqa: E402  (app/data/kit.db, shared with server.py)
from questions import as_text  # noqa: E402

SCHEMAS_DIR = SERVER_DIR / "tools" / "schemas"


class KitError(Exception):
    pass


def db():
    if not DB_PATH.exists():
        raise KitError(f"No database at {DB_PATH}: start the app once (python3 app/server/server.py).")
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def beat(conn):
    conn.execute("INSERT INTO meta(key,value) VALUES('heartbeat',?) "
                 "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (str(time.time()),))
    conn.commit()


def meta(conn, key, default):
    row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


RULES = ("Uploaded documents are the privileged source of information: read every file listed in 'sources' "
         "(Read tool for PDF and images, the text_path for Word, Excel and PowerPoint) before writing, then the skill "
         "'knowledge' files. Base facts, figures and rules on them and name the file you took them from. When the notes "
         "or answers disagree with a document, follow the document and flag the difference. 'answers' are the user's "
         "short answers to the skill's guided questions: treat them as requirements. "
         "Messages with a 'tool' block come from a V2 tool: answer markdown actions with `reply <thread> <file> --ids <id>`, "
         "json actions with `patch <workspace_id> <file.json> --action <action> --ids <id>`. Always pass --ids.")


def files_of(rid, type_id):
    strip = lambda fs: [{k: v for k, v in f.items() if v is not None} for f in fs]
    return strip(sources.listing(f"req-{rid}")), strip(sources.listing(f"skill-{type_id}"))


def _loads(text, default=None):
    try:
        return json.loads(text) if text else default
    except ValueError:
        return default


def tool_context(conn, m):
    """Workspace state + the run the message refers to (or the last run), for messages posted by a tool."""
    info = _loads(m["meta"], None) if "meta" in m.keys() else None
    if not isinstance(info, dict) or not info.get("workspace_id"):
        return None
    ws = conn.execute("SELECT * FROM workspaces WHERE id=?", (info["workspace_id"],)).fetchone()
    out = {"action": info.get("action"), "expects": info.get("expects", "markdown"), "workspace_id": info["workspace_id"]}
    if not ws:
        out["missing"] = "workspace deleted"
        return out
    out.update({"tool": ws["tool"], "title": ws["title"], "lang": ws["lang"], "state": _loads(ws["state"], {})})
    run = None
    if info.get("run_id"):
        run = conn.execute("SELECT * FROM runs WHERE id=?", (info["run_id"],)).fetchone()
    if run is None:
        run = conn.execute("SELECT * FROM runs WHERE workspace_id=? ORDER BY id DESC LIMIT 1", (ws["id"],)).fetchone()
    if run:
        out["run"] = {"id": run["id"], "kind": run["kind"], "ok": None if run["ok"] is None else bool(run["ok"]),
                      "ms": run["ms"], "input": _loads(run["input"], {}), "result": _loads(run["result"], {})}
    schema = SCHEMAS_DIR / f"{ws['tool']}.json"
    if schema.is_file():
        out["schema"] = str(schema)
    return out


def work(conn):
    reqs = []
    for r in conn.execute("SELECT id,type,client,title,notes,answers FROM requests WHERE status='waiting' ORDER BY created_at"):
        r = dict(r)
        r["answers"] = as_text(r["type"], json.loads(r["answers"] or "{}"))
        r["sources"], r["knowledge"] = files_of(r["id"], r["type"])
        reqs.append(r)
    msgs = []
    for m in conn.execute("SELECT * FROM messages WHERE role='user' AND handled=0 ORDER BY created_at"):
        item = {"id": m["id"], "thread": m["request_id"] or "chat", "message": m["body"]}
        if m["request_id"]:
            r = conn.execute("SELECT title,type,client FROM requests WHERE id=?", (m["request_id"],)).fetchone()
            if r:
                item["deliverable"] = dict(r)
                item["sources"], item["knowledge"] = files_of(m["request_id"], r["type"])
        tool = tool_context(conn, m)
        if tool:
            item["tool"] = tool
        msgs.append(item)
    return reqs, msgs


# ---- JSON Schema subset (type, properties, required, items, enum, maxLength, maxItems, minimum, maximum) -----

_TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None)}


def validate(value, schema, path="$"):
    """Errors as a list of 'path: problem' strings (empty = valid)."""
    errs = []
    t = schema.get("type")
    if t:
        types = t if isinstance(t, list) else [t]
        ok = False
        for one in types:
            if one == "integer":
                ok = ok or (isinstance(value, int) and not isinstance(value, bool))
            elif one == "number":
                ok = ok or (isinstance(value, (int, float)) and not isinstance(value, bool))
            elif one in _TYPES:
                ok = ok or isinstance(value, _TYPES[one])
        if not ok:
            return [f"{path}: expected {t}"]
    if "enum" in schema and value not in schema["enum"]:
        errs.append(f"{path}: not one of {schema['enum']}")
    if isinstance(value, str) and "maxLength" in schema and len(value) > schema["maxLength"]:
        errs.append(f"{path}: longer than {schema['maxLength']}")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errs.append(f"{path}: below {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errs.append(f"{path}: above {schema['maximum']}")
    if isinstance(value, dict):
        for k in schema.get("required", []):
            if k not in value:
                errs.append(f"{path}.{k}: required")
        props = schema.get("properties", {})
        for k, v in value.items():
            if k in props:
                errs += validate(v, props[k], f"{path}.{k}")
            elif schema.get("additionalProperties") is False:
                errs.append(f"{path}.{k}: not allowed")
    if isinstance(value, list):
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errs.append(f"{path}: more than {schema['maxItems']} items")
        if isinstance(schema.get("items"), dict):
            for i, v in enumerate(value):
                errs += validate(v, schema["items"], f"{path}[{i}]")
    return errs


def schema_for(tool, action):
    """tools/schemas/<tool>.json is either one schema, or {"actions": {<action>: schema, ...}}."""
    f = SCHEMAS_DIR / f"{tool}.json"
    if not f.is_file():
        return None
    doc = json.loads(f.read_text())
    if isinstance(doc.get("actions"), dict):
        return doc["actions"].get(action) or doc["actions"].get("*")
    return doc


# ---- argv ----------------------------------------------------------------------------------------

def split_opts(args):
    """Positional args, plus --ids (list of ints) and --action (str)."""
    pos, ids, action, i = [], None, None, 0
    while i < len(args):
        a = args[i]
        if a == "--ids":
            ids, i = [], i + 1
            while i < len(args) and not args[i].startswith("--"):
                ids += [int(x) for x in args[i].replace(",", " ").split() if x]
                i += 1
            continue
        if a == "--action":
            if i + 1 >= len(args):
                raise KitError("--action needs a value")
            action, i = args[i + 1], i + 2
            continue
        pos.append(a)
        i += 1
    return pos, ids, action


def need(pos, n, usage):
    if len(pos) < n:
        raise KitError(f"usage: python3 app/server/kit.py {usage}")


def request_id(conn, text):
    try:
        rid = int(text)
    except ValueError:
        raise KitError(f"Not a deliverable id: {text}")
    if not conn.execute("SELECT 1 FROM requests WHERE id=?", (rid,)).fetchone():
        raise KitError(f"No deliverable #{rid}")
    return rid


def read_file(name):
    p = Path(name)
    if not p.is_file():
        raise KitError(f"No file {name}")
    return p.read_text()


def mark_handled(conn, ids, rid, before=None):
    """Mark user messages handled: exactly `ids` (checked to be in the thread), else the unhandled ones
    created before `before` (the reply file's modification time), so a message posted later stays pending."""
    where = "request_id IS NULL" if rid is None else "request_id=?"
    args = () if rid is None else (rid,)
    if ids is None:
        cur = conn.execute(f"UPDATE messages SET handled=1 WHERE role='user' AND handled=0 AND {where} AND created_at<=?",
                           (*args, before if before is not None else time.time()))
        return cur.rowcount
    found = {r[0] for r in conn.execute(
        f"SELECT id FROM messages WHERE role='user' AND {where} AND id IN ({','.join('?' * len(ids))})", (*args, *ids))} \
        if ids else set()
    missing = [i for i in ids if i not in found]
    if missing:
        raise KitError(f"Message id(s) {missing} are not user messages of this thread")
    if ids:
        conn.execute(f"UPDATE messages SET handled=1 WHERE id IN ({','.join('?' * len(ids))})", ids)
    return len(ids)


def deep_merge(base, patch):
    if isinstance(base, dict) and isinstance(patch, dict):
        out = dict(base)
        for k, v in patch.items():
            out[k] = deep_merge(base.get(k), v) if k in base else v
        return out
    return patch


# ---- commands ------------------------------------------------------------------------------------

def run(argv):
    cmd = argv[0] if argv else "pending"
    pos, ids, action = split_opts(argv[1:])
    with db() as conn:
        if cmd == "wait":
            while True:
                beat(conn)
                reqs, msgs = work(conn)
                if reqs or msgs:
                    print(f"{len(reqs)} request(s), {len(msgs)} message(s) waiting")
                    return 0
                time.sleep(3)
        beat(conn)
        if cmd == "pending":
            reqs, msgs = work(conn)
            print(json.dumps({"rules": RULES, "profile": meta(conn, "profile", {}), "learned": meta(conn, "learned", []),
                              "requests": reqs, "messages": msgs}, indent=2, ensure_ascii=False))
        elif cmd == "start":
            need(pos, 1, "start <id>")
            rid = request_id(conn, pos[0])
            conn.execute("UPDATE requests SET status='working', updated_at=? WHERE id=?", (time.time(), rid))
            print(f"Started #{rid}")
        elif cmd == "deliver":
            need(pos, 2, "deliver <id> <file.md>")
            rid, text, now = request_id(conn, pos[0]), read_file(pos[1]), time.time()
            old = conn.execute("SELECT output FROM requests WHERE id=?", (rid,)).fetchone()
            if old and old["output"].strip():
                key = f"published_state:{rid}"  # the tool state behind a tool-published output, if any
                st = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
                src = "tool" if st else "claude"
                conn.execute("INSERT INTO versions (request_id,output,created_at,source,state) VALUES (?,?,?,?,?)",
                             (rid, old["output"], now, src, st["value"] if st else None))
                conn.execute("DELETE FROM meta WHERE key=?", (key,))
            conn.execute("UPDATE requests SET output=?, status='ready', unseen=1, updated_at=? WHERE id=?", (text, now, rid))
            print(f"Delivered #{rid}")
        elif cmd == "reply":
            need(pos, 2, "reply <id|chat> <file.md> [--ids 12 13]")
            rid = None if pos[0] == "chat" else request_id(conn, pos[0])
            text, now = read_file(pos[1]).strip(), time.time()
            if not text:
                raise KitError("The reply file is empty")
            n = mark_handled(conn, ids, rid, before=Path(pos[1]).stat().st_mtime)
            conn.execute("INSERT INTO messages (request_id,role,body,handled,created_at) VALUES (?,'claude',?,1,?)",
                         (rid, text, now))
            print(f"Replied in {pos[0]} ({n} message(s) marked answered)")
        elif cmd == "patch":
            need(pos, 2, "patch <workspace_id> <file.json> [--action <id>] [--ids 12]")
            try:
                wid = int(pos[0])
            except ValueError:
                raise KitError(f"Not a workspace id: {pos[0]}")
            ws = conn.execute("SELECT * FROM workspaces WHERE id=?", (wid,)).fetchone()
            if not ws:
                raise KitError(f"No workspace #{wid}")
            try:
                data = json.loads(read_file(pos[1]))
            except ValueError as e:
                raise KitError(f"{pos[1]} is not valid JSON: {e}")
            if action is None and ids:  # take the action from the message being answered
                row = conn.execute("SELECT meta FROM messages WHERE id=?", (ids[0],)).fetchone()
                action = (_loads(row["meta"], {}) or {}).get("action") if row else None
            action = action or "default"
            schema = schema_for(ws["tool"], action)
            if schema is not None:
                errs = validate(data, schema)
                if errs:
                    raise KitError("Does not match tools/schemas/%s.json:\n  %s" % (ws["tool"], "\n  ".join(errs[:20])))
            state = _loads(ws["state"], {}) or {}
            ai = state.get("ai") if isinstance(state.get("ai"), dict) else {}
            ai[action] = deep_merge(ai.get(action), data) if isinstance(data, dict) else data
            state["ai"] = ai
            now = time.time()
            conn.execute("UPDATE workspaces SET state=?, updated_at=? WHERE id=?",
                         (json.dumps(state, ensure_ascii=False), now, wid))
            if ids:
                found = {r[0] for r in conn.execute(
                    f"SELECT id FROM messages WHERE role='user' AND id IN ({','.join('?' * len(ids))})", ids)}
                if len(found) != len(set(ids)):
                    raise KitError(f"Message id(s) {sorted(set(ids) - found)} are not user messages")
                conn.execute(f"UPDATE messages SET handled=1 WHERE id IN ({','.join('?' * len(ids))})", ids)
                conn.execute("INSERT INTO messages (request_id,role,body,handled,created_at,meta) VALUES (?,'claude',?,1,?,?)",
                             (ws["request_id"], f"Updated the {ws['tool']} workspace ({action}).", now,
                              json.dumps({"action": action, "workspace_id": wid, "patch": True})))
            print(f"Patched workspace #{wid} state.ai.{action}" + (" (validated)" if schema is not None else ""))
        elif cmd == "learn":
            need(pos, 1, 'learn "<note>"')
            learned = meta(conn, "learned", [])
            learned.append(pos[0])
            conn.execute("INSERT INTO meta(key,value) VALUES('learned',?) "
                         "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(learned[-50:]),))
            print("Noted")
        else:
            print(__doc__)
            return 2 if cmd not in ("help", "-h", "--help") else 0
    return 0


def main():
    try:
        sys.exit(run(sys.argv[1:]))
    except KitError as e:
        print(f"kit.py: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
