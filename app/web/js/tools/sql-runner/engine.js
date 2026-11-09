/* SQL runner · engines. Same result shape for both:
     {ok, columns, rows, total, truncated, ms, engine} | {ok: false, error: {code, message}, ms}
   - local : POST /api/tools/sql/run (Python sqlite3, read-only, 2 s limit, 500 rows) — owner D's server plug-in
   - browser: sql.js 1.14.2 (vendor/sql.js/, lazy) in a Web Worker, seeded from data/cards-sample.sql, PRAGMA query_only,
              time limit by terminating the worker. Used in the static demo, and locally if the server route fails. */
export const MAX_ROWS = 500;
export const TIME_LIMIT_MS = 3000;

const abs = (p) => new URL(p, document.baseURI).href;
const SQLJS_BASE = () => abs('vendor/sql.js/');
const SEED = () => abs('data/cards-sample.sql');

let worker = null, ready = null, seq = 0;
const pending = new Map();

function startWorker() {
  worker = new Worker(new URL('./worker.js', import.meta.url));
  worker.onmessage = (e) => { const p = pending.get(e.data.id); if (p) { pending.delete(e.data.id); p(e.data); } };
  worker.onerror = (e) => { for (const p of pending.values()) p({ ok: false, error: { code: 'sql.engine', message: e.message || 'SQL engine error' } }); pending.clear(); };
  ready = call({ type: 'init', base: SQLJS_BASE(), seed: SEED() }, 30000).then((r) => {
    if (!r.ok) { kill(); throw Object.assign(new Error(r.error?.message || 'SQL engine failed'), { code: r.error?.code }); }
    return r;
  });
  return ready;
}

function kill() {
  if (worker) worker.terminate();
  worker = null; ready = null;
  for (const p of pending.values()) p({ ok: false, error: { code: 'sql.engine', message: 'stopped' } });
  pending.clear();
}

function call(msg, timeout) {
  const id = ++seq;
  return new Promise((resolve) => {
    let timer = null;
    pending.set(id, (r) => { clearTimeout(timer); resolve(r); });
    if (timeout) timer = setTimeout(() => {
      pending.delete(id);
      kill(); // the only way to stop a running sql.js statement
      resolve({ ok: false, error: { code: 'sql.timeout', message: `Stopped after ${timeout / 1000} s.` }, ms: timeout });
    }, timeout);
    worker.postMessage({ id, ...msg });
  });
}

/** Load the in-browser engine (idempotent). Rejects with a readable error if sql.js cannot load. */
export function browserReady() { return ready || startWorker(); }
export const browserLoaded = () => !!ready;

export async function runBrowser(sql, maxRows = MAX_ROWS) {
  await browserReady();
  return call({ type: 'run', sql, maxRows }, TIME_LIMIT_MS);
}
export async function schemaBrowser() {
  await browserReady();
  return call({ type: 'schema' }, 10000);
}
/** "Reset sample data": throw the in-memory database away; the next call rebuilds it from the seed. */
export function resetBrowser() { kill(); }

export async function runLocal(server, sql, maxRows = MAX_ROWS) {
  return server.post('/api/tools/sql/run', { sql, max_rows: maxRows });
}
export async function schemaLocal(server) {
  return server.get('/api/tools/sql/schema');
}

/** Pick the engine: 'auto' = local server when there is one, else the browser. Falls back to the browser when the
    local route is missing or the server is down (the answer then says engine: browser). */
export async function runSql({ server, engine = 'auto', sql, maxRows = MAX_ROWS }) {
  if (server && engine !== 'browser') {
    try { const r = await runLocal(server, sql, maxRows); return { ...r, where: 'local' }; }
    catch (e) { if (engine === 'local') return { ok: false, error: { code: 'sql.server', message: e.message } }; }
  }
  try { return { ...(await runBrowser(sql, maxRows)), where: 'browser' }; }
  catch (e) { return { ok: false, error: { code: e.code || 'sql.engine', message: e.message } }; }
}

export async function getSchema({ server, engine = 'auto' }) {
  if (server && engine !== 'browser') {
    try { const r = await schemaLocal(server); return { ...r, ok: true, where: 'local' }; } catch { /* fall back */ }
  }
  const r = await schemaBrowser();
  return { ...r, where: 'browser' };
}
