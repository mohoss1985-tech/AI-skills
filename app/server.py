"""Analyst Kit: request a deliverable, Claude (in your chat session) writes it, you hand it to the client.

Stdlib HTTP server + SQLite. No API key: requests and chat messages wait in the
database until Claude picks them up through kit.py and writes back.
"""

import json
import re
import sqlite3
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DB_PATH = ROOT / "data" / "kit.db"
PORT = 4317

TYPES = [
    {"id": "modeling-processes", "name": "Process map", "color": "#5e6ad2",
     "gives": "A process description, SOP or meeting notes",
     "gets": "A BPMN process diagram, a step table and the open questions to ask the client",
     "placeholder": "Paste how the process works today. Who does what, in what order, what happens when something goes wrong…",
     "next": ["writing-prds", "writing-user-stories"]},
    {"id": "writing-prds", "name": "PRD", "color": "#f2994a",
     "gives": "A short brief, an idea, or notes from the client",
     "gets": "A one-page or full PRD with problem, goals, success metrics and requirements",
     "placeholder": "Describe the problem, who has it, any numbers you know, deadlines, and what is out of scope…",
     "next": ["writing-user-stories", "modeling-processes"]},
    {"id": "writing-user-stories", "name": "User stories", "color": "#eb5757",
     "gives": "Requirements, a feature idea or a PRD section",
     "gets": "Sprint-ready user stories with acceptance criteria, ready for Jira or Linear",
     "placeholder": "Paste the requirements or describe the feature. Mention the tool your team uses (Jira, Linear…).",
     "next": ["testing-apis"]},
    {"id": "testing-apis", "name": "API test plan", "color": "#26b5ce",
     "gives": "An API description or example requests",
     "gets": "A test plan with every case to check, plus API documentation the client's developers can use",
     "placeholder": "Paste the endpoint(s), example request and response, and the business rules…",
     "next": []},
    {"id": "generating-sql", "name": "SQL query", "color": "#4cb782",
     "gives": "A business question and the table names",
     "gets": "A ready-to-run SQL query explained in plain language, with checks to trust the numbers",
     "placeholder": "Ask the question in plain words. Add the database type and the tables/columns if you have them…",
     "next": []},
]
TYPES += [
    {"id": "prioritizing-ai-use-cases", "name": "AI use-case roadmap", "color": "#8e4ec6",
     "gives": "Candidate use cases for an AI assistant, with volumes if you have them",
     "gets": "Scored and gated use cases, a value × feasibility view and a Now / Next / Later roadmap",
     "placeholder": "List the customer requests the assistant could handle, with monthly volumes, where the answers live today, and any constraints…",
     "next": ["designing-conversational-journeys", "governing-ai-risk"],
     "example": "Our banking assistant should start handling support. Candidates: access blocked (18k contacts/month), card declined (12k), new phone enrolment (9k, procedure outdated), transfer not received (8k, needs transaction data), disputes (4k, fraud risk). Two use cases per quarter max."},
    {"id": "designing-conversational-journeys", "name": "Conversation design", "color": "#0e9384",
     "gives": "A customer need the assistant should handle",
     "gets": "Journey with branches and hand-off, response rules, user stories with conversational acceptance criteria, test utterances",
     "placeholder": "Describe the customer need, what 'solved' means, what data the assistant can use, and what it must not do…",
     "next": ["evaluating-rag-quality", "writing-user-stories"],
     "example": "Journey: customer's access to the banking app is blocked after 3 wrong codes. Unlock is possible in-app via 'Forgot your code?'. The assistant uses the approved article 'Unlock your access'. Hand off to an advisor if it fails or if the customer mentions fraud."},
    {"id": "evaluating-rag-quality", "name": "RAG evaluation plan", "color": "#2e90fa",
     "gives": "The assistant's scope, or test results to analyse",
     "gets": "Golden test set, metrics, release thresholds, go / no-go report and failure analysis by root cause",
     "placeholder": "Describe the use cases to test, the knowledge sources, the risks, or paste scored test results (CSV)…",
     "next": ["governing-ai-risk", "aligning-stakeholders"],
     "example": "We launch AI Support for 'access blocked' and 'card declined' in 6 weeks. RAG on the help centre and tariff pages. Need an evaluation plan with go/no-go thresholds agreed with data science and compliance, and a production monitoring dashboard."},
    {"id": "governing-ai-risk", "name": "AI risk & guardrails", "color": "#d92d20",
     "gives": "What the assistant sees, does and who uses it",
     "gets": "Risk register, testable guardrail requirements, red-team test cases and a compliance checklist",
     "placeholder": "Describe the assistant: data it can access, actions it can trigger, users, model provider and hosting…",
     "next": ["evaluating-rag-quality"],
     "example": "Customer-facing banking assistant, authenticated users, sees account type and last login errors, can't move money. LLM hosted by a cloud provider in the EU. RAG on help centre + tariffs. Need risks, guardrails and what to confirm with Legal, DPO and Compliance."},
    {"id": "curating-knowledge-bases", "name": "Knowledge base plan", "color": "#6172f3",
     "gives": "Your content sources and top customer questions",
     "gets": "Source audit, coverage gaps, writer-ready content backlog, writing standard and metadata schema",
     "placeholder": "List the content sources (help centre, PDFs, procedures), owners, review dates, and the top customer questions…",
     "next": ["evaluating-rag-quality"],
     "example": "Sources: public help centre (420 articles, owner Digital), tariff PDFs (scanned, owner Pricing), advisor procedures (internal). Top questions: login blocked, card declined abroad, new phone setup, instant transfer fees. Two pages disagree on card limits abroad."},
    {"id": "aligning-stakeholders", "name": "Steering & alignment", "color": "#667085",
     "gives": "The situation, the decision or the update to communicate",
     "gets": "Decision memo, steering committee update, RACI, release notes or change plan, ready for Confluence",
     "placeholder": "What needs deciding or communicating, to whom, by when, with the key numbers and opinions…",
     "next": [],
     "example": "Steerco on Thursday. Evaluation is no-go: one security failure (prompt injection) blocks everything, tariff page outdated for card declined. Options: launch 'access blocked' alone in 2 weeks, or both use cases in 4 weeks. Support and data science favour launching early; marketing wants one launch."},
]
TYPE_IDS = {t["id"] for t in TYPES}
DEFAULT_PROFILE = {"name": "", "title": "Product Owner", "company": "", "tool": "Jira",
                   "language": "English", "tone": "Clear and concise"}

_lock = threading.Lock()


def db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def load_seed():
    """Each seed/*.md file: a JSON header line, then ===INPUT===, then ===OUTPUT===."""
    items = []
    for f in sorted((ROOT / "seed").glob("*.md")):
        head, rest = f.read_text().split("===INPUT===", 1)
        inp, out = rest.split("===OUTPUT===", 1)
        items.append({**json.loads(head), "input": inp.strip(), "output": out.strip()})
    return items


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _lock, db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS requests (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            type        TEXT NOT NULL,
            client      TEXT NOT NULL DEFAULT '',
            title       TEXT NOT NULL,
            notes       TEXT NOT NULL,
            changes     TEXT NOT NULL DEFAULT '',
            output      TEXT NOT NULL DEFAULT '',
            status      TEXT NOT NULL DEFAULT 'waiting',
            is_sample   INTEGER NOT NULL DEFAULT 0,
            created_at  REAL NOT NULL,
            updated_at  REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id  INTEGER,               -- NULL = general chat
            role        TEXT NOT NULL,         -- 'user' or 'claude'
            body        TEXT NOT NULL,
            handled     INTEGER NOT NULL DEFAULT 0,  -- user message answered by Claude
            read        INTEGER NOT NULL DEFAULT 0,  -- Claude message seen by the user
            created_at  REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS versions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id  INTEGER NOT NULL,
            output      TEXT NOT NULL,
            created_at  REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
        """)
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(requests)")}
        if "sent_at" not in cols:
            conn.execute("ALTER TABLE requests ADD COLUMN sent_at REAL")
        if "unseen" not in cols:
            conn.execute("ALTER TABLE requests ADD COLUMN unseen INTEGER NOT NULL DEFAULT 0")
        if conn.execute("SELECT COUNT(*) FROM requests").fetchone()[0] == 0:
            now = time.time()
            for i, r in enumerate(load_seed()):
                t = now - (5 - i) * 3600 * 6
                conn.execute(
                    "INSERT INTO requests (type,client,title,notes,output,status,is_sample,created_at,updated_at) "
                    "VALUES (?,?,?,?,?, 'ready', 1, ?, ?)",
                    (r["skill"], r.get("client", "Sample client"), r["title"], r["input"], r["output"], t, t))


def get_meta(conn, key, default):
    row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def set_meta(conn, key, value):
    conn.execute("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                 (key, json.dumps(value)))


def claude_online(conn):
    row = conn.execute("SELECT value FROM meta WHERE key='heartbeat'").fetchone()
    return bool(row) and time.time() - float(row["value"]) < 45


def summary(conn, row):
    d = dict(row)
    d.pop("output"), d.pop("notes"), d.pop("changes")
    d["unread"] = conn.execute("SELECT COUNT(*) FROM messages WHERE request_id=? AND role='claude' AND read=0",
                               (row["id"],)).fetchone()[0]
    d["awaiting_reply"] = conn.execute("SELECT COUNT(*) FROM messages WHERE request_id=? AND role='user' AND handled=0",
                                       (row["id"],)).fetchone()[0] > 0
    return d


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(STATIC_DIR), **kw)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def thread(self, conn, request_id):
        where = "request_id IS NULL" if request_id is None else "request_id=?"
        args = () if request_id is None else (request_id,)
        msgs = [dict(m) for m in conn.execute(f"SELECT * FROM messages WHERE {where} ORDER BY created_at", args)]
        conn.execute(f"UPDATE messages SET read=1 WHERE {where} AND role='claude'", args)
        return msgs

    def do_GET(self):
        path = self.path.partition("?")[0]
        if not path.startswith("/api/"):
            if path != "/" and not (STATIC_DIR / path.lstrip("/")).is_file():
                self.path = "/"
            return super().do_GET()
        with _lock, db() as conn:
            if path == "/api/state":
                rows = conn.execute("SELECT * FROM requests ORDER BY updated_at DESC").fetchall()
                examples = {r["skill"]: r["input"] for r in load_seed()}
                chat_unread = conn.execute("SELECT COUNT(*) FROM messages WHERE request_id IS NULL AND role='claude' "
                                           "AND read=0").fetchone()[0]
                clients = [r[0] for r in conn.execute(
                    "SELECT client FROM requests WHERE client!='' AND is_sample=0 GROUP BY client ORDER BY MAX(updated_at) DESC")]
                return self.send_json({
                    "types": [{**t, "example": t.get("example") or examples.get(t["id"], "")} for t in TYPES],
                    "requests": [summary(conn, r) for r in rows],
                    "claude_online": claude_online(conn),
                    "chat_unread": chat_unread,
                    "profile": {**DEFAULT_PROFILE, **get_meta(conn, "profile", {})},
                    "learned": get_meta(conn, "learned", []),
                    "clients": clients,
                })
            if path == "/api/chat":
                return self.send_json({"messages": self.thread(conn, None)})
            m = re.fullmatch(r"/api/requests/(\d+)", path)
            if m:
                rid = int(m.group(1))
                row = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
                if not row:
                    return self.send_json({"error": "Not found"}, 404)
                conn.execute("UPDATE requests SET unseen=0 WHERE id=?", (rid,))
                versions = [dict(v) for v in conn.execute(
                    "SELECT id, created_at FROM versions WHERE request_id=? ORDER BY created_at", (rid,))]
                return self.send_json({**dict(row), "messages": self.thread(conn, rid), "versions": versions})
            m = re.fullmatch(r"/api/versions/(\d+)", path)
            if m:
                row = conn.execute("SELECT * FROM versions WHERE id=?", (int(m.group(1)),)).fetchone()
                return self.send_json(dict(row)) if row else self.send_json({"error": "Not found"}, 404)
        self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        path = self.path.partition("?")[0]
        body = self.read_json()
        now = time.time()
        with _lock, db() as conn:
            if path == "/api/requests":
                notes = (body.get("notes") or "").strip()
                if body.get("type") not in TYPE_IDS or not notes:
                    return self.send_json({"error": "Add your notes first."}, 400)
                title = (body.get("title") or "").strip() or notes.splitlines()[0][:70]
                cur = conn.execute(
                    "INSERT INTO requests (type,client,title,notes,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                    (body["type"], (body.get("client") or "").strip(), title, notes, now, now))
                return self.send_json({"id": cur.lastrowid}, 201)
            if path == "/api/chat":
                text = (body.get("body") or "").strip()
                if not text:
                    return self.send_json({"error": "Write a message first."}, 400)
                conn.execute("INSERT INTO messages (request_id,role,body,created_at) VALUES (NULL,'user',?,?)", (text, now))
                return self.send_json({"ok": True}, 201)
            if path == "/api/profile":
                profile = {k: str(body.get(k, "")).strip()[:120] for k in DEFAULT_PROFILE}
                set_meta(conn, "profile", profile)
                if isinstance(body.get("learned"), list):
                    set_meta(conn, "learned", [str(x)[:300] for x in body["learned"]][:50])
                return self.send_json({"ok": True})
            m = re.fullmatch(r"/api/requests/(\d+)/messages", path)
            if m:
                text = (body.get("body") or "").strip()
                if not text:
                    return self.send_json({"error": "Write a message first."}, 400)
                conn.execute("INSERT INTO messages (request_id,role,body,created_at) VALUES (?,'user',?,?)",
                             (int(m.group(1)), text, now))
                return self.send_json({"ok": True}, 201)
            m = re.fullmatch(r"/api/requests/(\d+)/sent", path)
            if m:
                conn.execute("UPDATE requests SET sent_at=? WHERE id=?",
                             (now if body.get("sent") else None, int(m.group(1))))
                return self.send_json({"ok": True})
        self.send_json({"error": "Not found"}, 404)

    def do_DELETE(self):
        m = re.fullmatch(r"/api/requests/(\d+)", self.path)
        if not m:
            return self.send_json({"error": "Not found"}, 404)
        rid = int(m.group(1))
        with _lock, db() as conn:
            conn.execute("DELETE FROM requests WHERE id=?", (rid,))
            conn.execute("DELETE FROM messages WHERE request_id=?", (rid,))
            conn.execute("DELETE FROM versions WHERE request_id=?", (rid,))
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()


def main():
    init_db()
    print(f"Analyst Kit → http://localhost:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
