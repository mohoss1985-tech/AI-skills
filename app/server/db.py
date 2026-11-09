"""Database: connection, schema migrations (PRAGMA user_version), meta helpers and the finished samples.

The database lives in app/data/kit.db, the same file V1 used, so an existing workspace upgrades in place.

Schema versions
  1  V1 schema: requests, messages, versions, meta (+ the columns V1 added with ALTER)
  2  V2 tools: workspaces, runs, messages.meta, versions.source/state, requests.workspace_id, indexes
"""

import json
import os
import sqlite3
import threading
import time
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent
APP_DIR = SERVER_DIR.parent
DB_PATH = Path(os.environ["KIT_DB"]) if os.environ.get("KIT_DB") else APP_DIR / "data" / "kit.db"  # KIT_DB: tests
SEED_DIR = SERVER_DIR / "seed"
SCHEMA_VERSION = 2

_lock = threading.Lock()


def db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def lock():
    """The process-wide lock V1 used around every database request."""
    return _lock


def load_seed():
    """Each seed/*.md file: a JSON header line, then ===INPUT===, then ===OUTPUT===."""
    items = []
    for f in sorted(SEED_DIR.glob("*.md"), key=lambda f: int(f.name.split("-")[0])):
        head, rest = f.read_text().split("===INPUT===", 1)
        inp, out = rest.split("===OUTPUT===", 1)
        items.append({**json.loads(head), "input": inp.strip(), "output": out.strip()})
    return items


def get_meta(conn, key, default):
    row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def set_meta(conn, key, value):
    conn.execute("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                 (key, json.dumps(value)))


def claude_online(conn):
    row = conn.execute("SELECT value FROM meta WHERE key='heartbeat'").fetchone()
    return bool(row) and time.time() - float(row["value"]) < 45


def _columns(conn, table):
    return {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}


def _migrate_1(conn):
    """V1 schema. Idempotent, so a V1 database (user_version 0) passes through it safely."""
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
    cols = _columns(conn, "requests")
    if "sent_at" not in cols:
        conn.execute("ALTER TABLE requests ADD COLUMN sent_at REAL")
    if "unseen" not in cols:
        conn.execute("ALTER TABLE requests ADD COLUMN unseen INTEGER NOT NULL DEFAULT 0")
    if "answers" not in cols:
        conn.execute("ALTER TABLE requests ADD COLUMN answers TEXT NOT NULL DEFAULT '{}'")
    if "lang" not in cols:  # samples exist per language: Visa samples in English, CB samples in French
        conn.execute("ALTER TABLE requests ADD COLUMN lang TEXT NOT NULL DEFAULT ''")


def _migrate_2(conn):
    """V2 tools: generic tables, so no tool builder has to write a migration (research/07 §3)."""
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS workspaces (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        tool        TEXT NOT NULL,                 -- tool id from web/js/tools/registry.js
        title       TEXT NOT NULL DEFAULT '',
        client      TEXT NOT NULL DEFAULT '',
        lang        TEXT NOT NULL DEFAULT '',
        state       TEXT NOT NULL DEFAULT '{}',    -- JSON, the tool's editable state
        schema      INTEGER NOT NULL DEFAULT 1,    -- the tool's state version
        request_id  INTEGER,                       -- linked deliverable, once published
        is_sample   INTEGER NOT NULL DEFAULT 0,
        created_at  REAL NOT NULL,
        updated_at  REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id  INTEGER NOT NULL,
        kind          TEXT NOT NULL DEFAULT '',
        input         TEXT NOT NULL DEFAULT '{}',  -- JSON
        result        TEXT NOT NULL DEFAULT '{}',  -- JSON
        ok            INTEGER,
        ms            INTEGER,
        created_at    REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);
    CREATE INDEX IF NOT EXISTS idx_versions_request ON versions(request_id);
    CREATE INDEX IF NOT EXISTS idx_workspaces_tool ON workspaces(tool);
    CREATE INDEX IF NOT EXISTS idx_runs_workspace ON runs(workspace_id);
    """)
    if "meta" not in _columns(conn, "messages"):
        conn.execute("ALTER TABLE messages ADD COLUMN meta TEXT")  # JSON {action, workspace_id, run_id, expects}
    vcols = _columns(conn, "versions")
    if "source" not in vcols:
        conn.execute("ALTER TABLE versions ADD COLUMN source TEXT NOT NULL DEFAULT 'claude'")  # claude|tool|user
    if "state" not in vcols:
        conn.execute("ALTER TABLE versions ADD COLUMN state TEXT")  # JSON snapshot of the tool state
    if "workspace_id" not in _columns(conn, "requests"):
        conn.execute("ALTER TABLE requests ADD COLUMN workspace_id INTEGER")


MIGRATIONS = {1: _migrate_1, 2: _migrate_2}


MIGRATIONS_DIR = SERVER_DIR / "migrations"


def migrate(conn):
    current = conn.execute("PRAGMA user_version").fetchone()[0]
    for version in range(current + 1, SCHEMA_VERSION + 1):
        MIGRATIONS[version](conn)
        conn.execute(f"PRAGMA user_version = {version}")
    migrate_sql(conn)


def migrate_sql(conn):
    """Per-tool SQL migrations: migrations/NNN_<tool>.sql (ranges per owner, research/07 §3: C 100-199, D 200-299 …).

    Each file runs once, in numeric order; applied names are kept in meta 'sql_migrations'.
    Write them idempotent anyway (CREATE TABLE IF NOT EXISTS), and never edit one once shipped."""
    if not MIGRATIONS_DIR.is_dir():
        return
    done = set(get_meta(conn, "sql_migrations", []))
    files = sorted((f for f in MIGRATIONS_DIR.glob("*.sql") if f.name.split("_")[0].isdigit()),
                   key=lambda f: int(f.name.split("_")[0]))
    for f in files:
        if f.name not in done:
            conn.executescript(f.read_text())
            done.add(f.name)
            set_meta(conn, "sql_migrations", sorted(done))


def seed_samples(conn):
    # Add each sample once, so new samples reach existing workspaces and deleted ones stay deleted.
    seeded = set(get_meta(conn, "seeded", [r[0] for r in conn.execute("SELECT title FROM requests WHERE is_sample=1")]))
    seeds = load_seed()
    # Samples replaced by newer ones (e.g. re-themed) leave the workspace with their history.
    current = {r["title"] for r in seeds}
    for rid, title in conn.execute("SELECT id, title FROM requests WHERE is_sample=1").fetchall():
        if title not in current:
            for tbl in ("messages", "versions"):
                conn.execute(f"DELETE FROM {tbl} WHERE request_id=?", (rid,))
            conn.execute("DELETE FROM requests WHERE id=?", (rid,))
    now = time.time()
    for i, r in enumerate(seeds):
        if r["title"] in seeded:
            continue
        t = now - (len(seeds) - i) * 3600 * 2
        conn.execute(
            "INSERT INTO requests (type,client,title,notes,output,status,is_sample,lang,created_at,updated_at) "
            "VALUES (?,?,?,?,?, 'ready', 1, ?, ?, ?)",
            (r["skill"], r.get("client", "Sample client"), r["title"], r["input"], r["output"], r.get("lang", ""), t, t))
        seeded.add(r["title"])
    set_meta(conn, "seeded", sorted(seeded))


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _lock, db() as conn:
        migrate(conn)
        seed_samples(conn)
