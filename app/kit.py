"""Claude's side of Analyst Kit: find work, write deliverables, answer messages.

  python3 kit.py wait                       block until there is work (keeps "Claude is online" lit)
  python3 kit.py pending                    print profile, learned notes, waiting requests and unanswered messages
  python3 kit.py start <id>                 mark a request as being written
  python3 kit.py deliver <id> <file.md>     save the deliverable (older text becomes a previous version)
  python3 kit.py reply <id|chat> <file.md>  answer the thread of a deliverable, or the general chat
  python3 kit.py learn "<note>"             remember a preference about the user
"""

import json
import sqlite3
import sys
import time
from pathlib import Path

import sources
from questions import as_text

DB_PATH = Path(__file__).resolve().parent / "data" / "kit.db"


def db():
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
         "short answers to the skill's guided questions: treat them as requirements.")


def files_of(rid, type_id):
    strip = lambda fs: [{k: v for k, v in f.items() if v is not None} for f in fs]
    return strip(sources.listing(f"req-{rid}")), strip(sources.listing(f"skill-{type_id}"))


def work(conn):
    reqs = []
    for r in conn.execute("SELECT id,type,client,title,notes,answers FROM requests WHERE status='waiting' ORDER BY created_at"):
        r = dict(r)
        r["answers"] = as_text(r["type"], json.loads(r["answers"] or "{}"))
        r["sources"], r["knowledge"] = files_of(r["id"], r["type"])
        reqs.append(r)
    msgs = []
    for m in conn.execute("SELECT * FROM messages WHERE role='user' AND handled=0 ORDER BY created_at"):
        item = {"thread": m["request_id"] or "chat", "message": m["body"]}
        if m["request_id"]:
            r = conn.execute("SELECT title,type,client FROM requests WHERE id=?", (m["request_id"],)).fetchone()
            if r:
                item["deliverable"] = dict(r)
                item["sources"], item["knowledge"] = files_of(m["request_id"], r["type"])
        msgs.append(item)
    return reqs, msgs


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "pending"
    with db() as conn:
        if cmd == "wait":
            while True:
                beat(conn)
                reqs, msgs = work(conn)
                if reqs or msgs:
                    print(f"{len(reqs)} request(s), {len(msgs)} message(s) waiting")
                    return
                time.sleep(3)
        beat(conn)
        if cmd == "pending":
            reqs, msgs = work(conn)
            print(json.dumps({"rules": RULES, "profile": meta(conn, "profile", {}), "learned": meta(conn, "learned", []),
                              "requests": reqs, "messages": msgs}, indent=2, ensure_ascii=False))
        elif cmd == "start":
            conn.execute("UPDATE requests SET status='working', updated_at=? WHERE id=?", (time.time(), int(sys.argv[2])))
        elif cmd == "deliver":
            rid, text, now = int(sys.argv[2]), Path(sys.argv[3]).read_text(), time.time()
            old = conn.execute("SELECT output FROM requests WHERE id=?", (rid,)).fetchone()
            if old and old["output"].strip():
                conn.execute("INSERT INTO versions (request_id,output,created_at) VALUES (?,?,?)", (rid, old["output"], now))
            conn.execute("UPDATE requests SET output=?, status='ready', unseen=1, updated_at=? WHERE id=?", (text, now, rid))
            print(f"Delivered #{rid}")
        elif cmd == "reply":
            target, text, now = sys.argv[2], Path(sys.argv[3]).read_text().strip(), time.time()
            rid = None if target == "chat" else int(target)
            where = "request_id IS NULL" if rid is None else "request_id=?"
            args = () if rid is None else (rid,)
            conn.execute(f"UPDATE messages SET handled=1 WHERE role='user' AND {where}", args)
            conn.execute("INSERT INTO messages (request_id,role,body,handled,created_at) VALUES (?,'claude',?,1,?)",
                         (rid, text, now))
            print(f"Replied in {target}")
        elif cmd == "learn":
            learned = meta(conn, "learned", [])
            learned.append(sys.argv[2])
            conn.execute("INSERT INTO meta(key,value) VALUES('learned',?) "
                         "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(learned[-50:]),))
            print("Noted")
        else:
            print(__doc__)


if __name__ == "__main__":
    main()
