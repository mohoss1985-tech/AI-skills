/* SQL runner · sql.js worker (classic worker). Runs the in-browser engine off the main thread so a runaway query
   can be stopped: the page terminates this worker after the time limit and starts a new one. Owner D.
   Messages in : {id, type: 'init', base, seed} | {id, type: 'run', sql, maxRows} | {id, type: 'schema'}
   Messages out: {id, ok, ...result}  (same shape as POST /api/tools/sql/run) */
let db = null;
let SQLITE_VERSION = '';
const COUNT_LIMIT = 100000;

const cell = (v) => (v instanceof Uint8Array ? `<${v.length} bytes>` : v);

function errCode(msg) {
  if (/readonly|query_only|not authorized/i.test(msg)) return 'sql.read_only';
  return 'sql.error';
}

async function init(base, seed) {
  if (db) return { ok: true, engine: SQLITE_VERSION };
  self.importScripts(base + 'sql-wasm.js');
  const SQL = await self.initSqlJs({ locateFile: (f) => base + f });
  const r = await fetch(seed);
  if (!r.ok) throw new Error('Could not load the sample data (' + r.status + ')');
  const text = await r.text();
  db = new SQL.Database();
  db.exec(text);
  db.exec('PRAGMA query_only = ON');
  SQLITE_VERSION = 'sql.js · sqlite ' + db.exec('SELECT sqlite_version()')[0].values[0][0];
  return { ok: true, engine: SQLITE_VERSION };
}

function run(sql, maxRows) {
  const t0 = performance.now();
  let stmt;
  try {
    stmt = db.prepare(sql);
    const columns = stmt.getColumnNames();
    const rows = [];
    let total = 0;
    while (stmt.step()) {
      total++;
      if (total <= maxRows) rows.push(stmt.get().map(cell));
      if (total >= COUNT_LIMIT) break;
    }
    return { ok: true, columns, rows, total, truncated: total > rows.length, ms: Math.round(performance.now() - t0), engine: SQLITE_VERSION };
  } catch (e) {
    const msg = String(e && e.message || e);
    return { ok: false, error: { code: errCode(msg), message: msg }, ms: Math.round(performance.now() - t0) };
  } finally {
    if (stmt) stmt.free();
  }
}

function schema() {
  const names = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.flat() || [];
  const tables = names.map((n) => ({
    name: n,
    rows: db.exec(`SELECT COUNT(*) FROM "${n}"`)[0].values[0][0],
    columns: db.exec(`PRAGMA table_info("${n}")`)[0].values.map((r) => ({ name: r[1], type: r[2], pk: !!r[5] })),
  }));
  return { ok: true, tables, engine: SQLITE_VERSION };
}

self.onmessage = async (e) => {
  const { id, type } = e.data || {};
  try {
    let out;
    if (type === 'init') out = await init(e.data.base, e.data.seed);
    else if (!db) out = { ok: false, error: { code: 'sql.engine', message: 'The SQL engine is not ready.' } };
    else if (type === 'run') out = run(e.data.sql, e.data.maxRows || 500);
    else if (type === 'schema') out = schema();
    else out = { ok: false, error: { code: 'sql.error', message: 'Unknown message ' + type } };
    self.postMessage({ id, ...out });
  } catch (err) {
    self.postMessage({ id, ok: false, error: { code: 'sql.engine', message: String(err && err.message || err) } });
  }
};
