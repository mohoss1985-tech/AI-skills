// Draft: SQL runner on sql.js 1.14.2 (SQLite compiled to WebAssembly), same code in local app and static demo.
// Loaded lazily, only when the SQL tool opens: sql-wasm.js 46 KB (17 KB gz) + sql-wasm.wasm 658 KB (323 KB gz).
// jsDelivr serves the .wasm with content-type application/wasm and access-control-allow-origin: *,
// so instantiateStreaming works cross-origin from GitHub Pages and from localhost.
const SQLJS = 'https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/';

let sqlReady;
function loadSqlJs() {
  sqlReady ??= new Promise((ok, bad) => {
    const s = Object.assign(document.createElement('script'), { src: SQLJS + 'sql-wasm.js', crossOrigin: 'anonymous' });
    s.onload = () => window.initSqlJs({ locateFile: (f) => SQLJS + f }).then(ok, bad);
    s.onerror = () => bad(new Error('Could not load the SQL engine (offline?)'));
    document.head.appendChild(s);
  });
  return sqlReady;
}

// Seed = a plain .sql file shipped with the app (diffable, ~20-60 KB): v2/data/cards-sample.sql
// CREATE TABLE cards(...), authorisations(...), chargebacks(...), merchants(...) + INSERTs (Visa EN / CB FR rows).
async function openSampleDb(seedUrl = 'data/cards-sample.sql') {
  const SQL = await loadSqlJs();
  const db = new SQL.Database();
  db.exec(await (await fetch(seedUrl)).text());
  return db;
}

// Run what the analyst typed. Every statement runs; the last SELECT's result is shown.
// Safety for a sandbox DB is simple: "Reset sample data" rebuilds it from the seed.
function runSql(db, sql, maxRows = 1000) {
  const t0 = performance.now();
  try {
    const results = db.exec(sql); // [{columns, values}] one per statement that returned rows
    const last = results[results.length - 1] || { columns: [], values: [] };
    return { ok: true, columns: last.columns, rows: last.values.slice(0, maxRows),
      total: last.values.length, changes: db.getRowsModified(), time_ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { ok: false, error: e.message }; // e.g. "no such column: amout" - shown inline under the editor
  }
}

// Schema browser for the side panel.
function schema(db) {
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0]?.values.flat() || [];
  return tables.map((t) => ({ table: t, columns: db.exec(`PRAGMA table_info(${JSON.stringify(t)})`)[0].values.map((r) => ({ name: r[1], type: r[2], pk: !!r[5] })) }));
}

// Export: results to CSV (reuse toCsv from exporters.js) and the whole DB as .sqlite (db.export() -> Uint8Array).
