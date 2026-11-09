"""SQL runner (owner D): read-only SQL on the Harbor Bank / Banque Lumière sample database.

    POST /api/tools/sql/run     {sql, max_rows?}  -> {ok, columns, rows, total, truncated, ms, engine}
                                                     or {ok: false, error: {code, message}}  (HTTP 200: a bad query is a result)
    GET  /api/tools/sql/schema                      -> {tables: [{name, rows, columns: [{name, type, pk}]}], engine}

Safety (the database is a demo, but the endpoint must still not write anything):
  - the file is opened read-only (`mode=ro` URI) and `PRAGMA query_only = ON`;
  - an authorizer allows only reads (SELECT, READ, FUNCTION, RECURSIVE and a few read-only PRAGMAs);
    ATTACH, writes, DDL and other PRAGMAs are refused;
  - one statement per call (sqlite3 refuses more), time limit through set_progress_handler (2 s);
  - at most 500 rows come back (`total` still counts every row up to 100 000).

The database is built from `tools/sample/cards-sample.sql` on first use (or when the .sql is newer),
the same script that the browser loads into sql.js in the static demo (`web/data/cards-sample.sql`).
`python3 app/server/tools/sample/build_cards_db.py` rebuilds both copies by hand.
"""

import os
import shutil
import sqlite3
import threading
import time
from pathlib import Path

from router import route

HERE = Path(__file__).resolve().parent
SAMPLE_DIR = HERE / "sample"
SEED_SQL = SAMPLE_DIR / "cards-sample.sql"
DB_FILE = SAMPLE_DIR / "cards.db"
WEB_SEED = HERE.parent.parent / "web" / "data" / "cards-sample.sql"

MAX_ROWS = 500
COUNT_LIMIT = 100_000
TIME_LIMIT_S = 2.0
MAX_SQL = 20_000

_build_lock = threading.Lock()

READ_PRAGMAS = {"table_info", "table_xinfo", "table_list", "index_list", "index_info", "foreign_key_list"}


def build_db(force=False, copy_web=True):
    """(Re)build cards.db from cards-sample.sql. Returns the path. Atomic: a temp file is renamed."""
    with _build_lock:
        fresh = DB_FILE.exists() and DB_FILE.stat().st_mtime >= SEED_SQL.stat().st_mtime
        if fresh and not force:
            return DB_FILE
        tmp = DB_FILE.with_suffix(".db.tmp")
        if tmp.exists():
            tmp.unlink()
        conn = sqlite3.connect(tmp)
        try:
            conn.executescript(SEED_SQL.read_text(encoding="utf-8"))
            conn.commit()
        finally:
            conn.close()
        os.replace(tmp, DB_FILE)
        if copy_web:
            WEB_SEED.parent.mkdir(parents=True, exist_ok=True)
            if not WEB_SEED.exists() or WEB_SEED.read_bytes() != SEED_SQL.read_bytes():
                shutil.copyfile(SEED_SQL, WEB_SEED)
        return DB_FILE


def _authorizer(action, arg1, arg2, dbname, source):
    if action in (sqlite3.SQLITE_SELECT, sqlite3.SQLITE_READ, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE):
        return sqlite3.SQLITE_OK
    if action == sqlite3.SQLITE_PRAGMA and (arg1 or "").lower() in READ_PRAGMAS:
        return sqlite3.SQLITE_OK
    return sqlite3.SQLITE_DENY


def open_ro():
    path = build_db()
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True, check_same_thread=False)
    conn.execute("PRAGMA query_only = ON")
    conn.set_authorizer(_authorizer)
    return conn


def _cell(v):
    if isinstance(v, bytes):
        return f"<{len(v)} bytes>"
    return v


def run_sql(sql, max_rows=MAX_ROWS, time_limit=TIME_LIMIT_S):
    """Run one read-only statement. Never raises: errors come back as {ok: False, error}."""
    sql = (sql or "").strip()
    if not sql:
        return {"ok": False, "error": {"code": "sql.empty", "message": "Write a SELECT query first."}}
    if len(sql) > MAX_SQL:
        return {"ok": False, "error": {"code": "sql.too_long", "message": f"The query is over {MAX_SQL} characters."}}
    max_rows = max(1, min(int(max_rows or MAX_ROWS), MAX_ROWS))
    t0 = time.perf_counter()
    deadline = t0 + time_limit
    conn = open_ro()
    timed_out = []

    def progress():
        if time.perf_counter() > deadline:
            timed_out.append(True)
            return 1  # non-zero aborts the statement
        return 0

    conn.set_progress_handler(progress, 10_000)
    try:
        cur = conn.execute(sql.rstrip("; \n\t"))
        columns = [d[0] for d in (cur.description or [])]
        rows, total = [], 0
        for row in cur:
            total += 1
            if total <= max_rows:
                rows.append([_cell(v) for v in row])
            if total >= COUNT_LIMIT:
                break
        ms = round((time.perf_counter() - t0) * 1000)
        return {"ok": True, "columns": columns, "rows": rows, "total": total, "truncated": total > len(rows),
                "ms": ms, "engine": f"sqlite {sqlite3.sqlite_version}"}
    except (sqlite3.Error, sqlite3.Warning) as e:
        msg = str(e)
        if timed_out or "interrupted" in msg:
            code, msg = "sql.timeout", f"The query took longer than {time_limit:g} s and was stopped. Add a WHERE or a LIMIT."
        elif "not authorized" in msg or "readonly" in msg or "query_only" in msg:
            code, msg = "sql.read_only", "This sample database is read-only: only SELECT and WITH queries run here."
        elif "one statement at a time" in msg:
            code, msg = "sql.one_statement", "Run one statement at a time (select it, then press Run)."
        else:
            code = "sql.error"
        return {"ok": False, "error": {"code": code, "message": msg},
                "ms": round((time.perf_counter() - t0) * 1000)}
    finally:
        conn.close()


def schema():
    conn = open_ro()
    try:
        names = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        tables = []
        for n in names:
            cols = [{"name": c[1], "type": c[2], "pk": bool(c[5])} for c in conn.execute(f'PRAGMA table_info("{n}")')]
            rows = conn.execute(f'SELECT COUNT(*) FROM "{n}"').fetchone()[0]
            tables.append({"name": n, "rows": rows, "columns": cols})
        return {"tables": tables, "engine": f"sqlite {sqlite3.sqlite_version}"}
    finally:
        conn.close()


@route("POST", r"/api/tools/sql/run", db=False, max_body=64 * 1024)
def post_run(h, conn, m, body):
    body = body if isinstance(body, dict) else {}
    return h.send_json(run_sql(body.get("sql"), body.get("max_rows") or MAX_ROWS))


@route("GET", r"/api/tools/sql/schema", db=False)
def get_schema(h, conn, m, body):
    return h.send_json(schema())
